import { useState, useEffect, Suspense, lazy, useCallback, useMemo } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from './supabaseClient';
import { logAudit } from './auditHelper';
import { canAccessStaffConsole } from './roles';

const Layout = lazy(() => import('./Layout'));
const Dashboard = lazy(() => import('./Dashboard'));
const Artists = lazy(() => import('./Artists'));
const UserProfile = lazy(() => import('./UserProfile'));
const CollageView = lazy(() => import('./CollageView'));
const Settings = lazy(() => import('./Settings'));
const AdminPanel = lazy(() => import('./AdminPanel'));
const LandingPage = lazy(() => import('./LandingPage'));
const About = lazy(() => import('./About'));
const LegalPage = lazy(() => import('./LegalPage'));
const AuthForm = lazy(() => import('./AuthForm'));

function App() {
  const [session, setSession] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isValidatingLogin, setIsValidatingLogin] = useState(false);
  const [banMessage, setBanMessage] = useState<string | null>(null);

  // MFA Challenge State (kept at App level since it affects routing decisions)
  const [showMfaChallenge, setShowMfaChallenge] = useState(false);
  const [mfaFactorIds, setMfaFactorIds] = useState<string[]>([]);

  const navigate = useNavigate();

  // Validate profile account status (ban/suspension enforcement)
  const verifyAccountStatus = useCallback(async (userId: string) => {
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, name, username, role, status, suspension_end')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn('Profile fetch warning during auth check:', error.message);
        return null;
      }

      if (profile) {
        if (profile.status === 'banned') {
          await supabase.auth.signOut();
          setBanMessage('Access Denied: Your account has been permanently banned.');
          return { banned: true, profile: null };
        }
        if (profile.status === 'suspended' && profile.suspension_end) {
          const endDate = new Date(profile.suspension_end);
          if (endDate > new Date()) {
            await supabase.auth.signOut();
            setBanMessage(`Access Denied: Account suspended until ${endDate.toLocaleString()}.`);
            return { suspended: true, profile: null };
          } else {
            // Suspension expired - auto-reactivate
            await supabase.from('profiles').update({ status: 'active', suspension_end: null }).eq('id', userId);
            profile.status = 'active';
            profile.suspension_end = null;
          }
        }
      }
      return { banned: false, suspended: false, profile };
    } catch (err) {
      console.warn('Network error checking account status:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    let authListenerUnsubscribe: (() => void) | null = null;

    const setupAuth = async () => {
      // Failsafe timeout to prevent indefinite loading screen on network lockups
      const failsafeTimer = setTimeout(() => {
        if (isMounted) {
          console.warn('Auth initialization reached failsafe timeout (5s)');
          setIsInitializing(false);
        }
      }, 5000);

      try {
        // 1. Initial session load from storage
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) {
          console.error('Supabase getSession error:', sessionError);
        }

        const initialSession = sessionData?.session;

        if (initialSession?.user && isMounted) {
          setSession(initialSession);
          const statusResult = await verifyAccountStatus(initialSession.user.id);
          if (isMounted) {
            if (statusResult?.profile) {
              setUserProfile(statusResult.profile);
            } else if (statusResult?.banned || statusResult?.suspended) {
              setSession(null);
              setUserProfile(null);
            }
          }
        } else if (isMounted) {
          setSession(null);
          setUserProfile(null);
        }
      } catch (err) {
        console.error('Error during initial session verification:', err);
      } finally {
        clearTimeout(failsafeTimer);
        if (isMounted) {
          setIsInitializing(false);
        }
      }

      // 2. Set up auth state change listener
      let currentUserId: string | null = null;
      const { data: authSubscription } = supabase.auth.onAuthStateChange(async (event, newSession) => {
        if (!isMounted) return;

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
          if (newSession?.user) {
            setSession(newSession);
            const statusResult = await verifyAccountStatus(newSession.user.id);
            if (statusResult?.profile) {
              setUserProfile(statusResult.profile);
            } else if (statusResult?.banned || statusResult?.suspended) {
              setSession(null);
              setUserProfile(null);
            }

            if (event === 'SIGNED_IN' && newSession.user.id !== currentUserId) {
              currentUserId = newSession.user.id;
              logAudit('User Login', 'User authenticated successfully.', currentUserId);
            }
          }
        } else if (event === 'SIGNED_OUT') {
          setSession(null);
          setUserProfile(null);
          setShowMfaChallenge(false);
          setIsValidatingLogin(false);
          if (currentUserId) {
            logAudit('User Logout', 'User logged out securely.', currentUserId);
            currentUserId = null;
          }
        } else if (event === 'INITIAL_SESSION') {
          // Handled primarily by initial getSession call above
          if (newSession) {
            setSession(newSession);
          }
        }
      });

      authListenerUnsubscribe = () => {
        authSubscription.subscription.unsubscribe();
      };
    };

    setupAuth();

    return () => {
      isMounted = false;
      if (authListenerUnsubscribe) {
        authListenerUnsubscribe();
      }
    };
  }, [verifyAccountStatus]);

  // Real-time listener for profile status changes (admin banning / suspending this user)
  useEffect(() => {
    if (!session?.user?.id) return;

    const profileSubscription = supabase
      .channel('public:profiles-status-guard')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` },
        async (payload) => {
          const { status, suspension_end } = payload.new;
          setUserProfile((prev: any) => ({ ...(prev || {}), ...payload.new }));

          if (status === 'banned') {
            await supabase.auth.signOut();
            setBanMessage('Access Denied: Your account has been permanently banned.');
            setSession(null);
            setUserProfile(null);
          } else if (status === 'suspended' && suspension_end) {
            const endDate = new Date(suspension_end);
            if (endDate > new Date()) {
              await supabase.auth.signOut();
              setBanMessage(`Access Denied: Account suspended until ${endDate.toLocaleString()}.`);
              setSession(null);
              setUserProfile(null);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(profileSubscription);
    };
  }, [session?.user?.id]);

  // Stable callback — does not change on re-renders, preventing AuthForm from re-mounting
  const handleLoginComplete = useCallback(async (data: any, profile?: any) => {
    if (data?.user) {
      let resolvedProfile = profile;
      
      // Fetch profile role if not already provided
      if (!resolvedProfile) {
        const { data: p } = await supabase
          .from('profiles')
          .select('id, name, username, role, status')
          .eq('id', data.user.id)
          .single();
        resolvedProfile = p;
      }
        
      setSession(data.session || { user: data.user });
      if (resolvedProfile) {
        setUserProfile(resolvedProfile);
      }

      toast.success('Login successful!');
      setIsValidatingLogin(false);
      setShowMfaChallenge(false);
      
      if (canAccessStaffConsole(resolvedProfile?.role)) {
        navigate('/staff_panel');
      } else {
        navigate('/home');
      }
    } else {
      setIsValidatingLogin(false);
    }
  }, [navigate]);

  // Auth UI rendered via the extracted AuthForm component
  const renderAuthUI = useCallback(() => (
    <AuthForm
      onLoginComplete={handleLoginComplete}
      banMessage={banMessage}
      setBanMessage={setBanMessage}
      setIsValidatingLogin={setIsValidatingLogin}
      showMfaChallenge={showMfaChallenge}
      setShowMfaChallenge={setShowMfaChallenge}
      mfaFactorIds={mfaFactorIds}
      setMfaFactorIds={setMfaFactorIds}
    />
  ), [banMessage, handleLoginComplete, mfaFactorIds, showMfaChallenge]);

  const isStaff = useMemo(() => {
    return canAccessStaffConsole(userProfile?.role);
  }, [userProfile?.role]);

  if (isInitializing) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: 'var(--text-secondary)' }}>
        Loading Collection...
      </div>
    );
  }

  if (isValidatingLogin) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-secondary)' }}>
        Authenticating...
      </div>
    );
  }

  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-secondary)' }}>Loading...</div>}>
      <Routes>
        {/* Public Landing & Login */}
        <Route path="/" element={session && !showMfaChallenge ? <Navigate to="/home" replace /> : <LandingPage />} />
        <Route path="/login" element={session && !showMfaChallenge ? <Navigate to="/home" replace /> : <><LandingPage />{renderAuthUI()}</>} />
        
        {/* Staff Directory & Portal */}
        <Route
          path="/staff"
          element={
            session && !showMfaChallenge ? (
              isStaff ? <Navigate to="/staff_panel" replace /> : <Navigate to="/home" replace />
            ) : (
              renderAuthUI()
            )
          }
        />
        {/* Legacy /admin redirects directly to /staff */}
        <Route path="/admin" element={<Navigate to="/staff" replace />} />
        
        {/* Publicly Accessible Layout */}
        <Route element={<Layout user={session?.user || null} />}>
          {/* Public Routes */}
          <Route path="/home" element={<Dashboard user={session?.user || null} mode="discover" />} />
          <Route path="/registry" element={<Dashboard user={session?.user || null} mode="registry" />} />
          <Route path="/about" element={<About user={session?.user || null} />} />
          <Route path="/privacy" element={<LegalPage type="privacy" />} />
          <Route path="/terms" element={<LegalPage type="terms" />} />
          <Route path="/artists" element={<Artists />} />
          <Route path="/profile/:id" element={<UserProfile currentUser={session?.user || null} />} />
          <Route path="/collage/:id" element={<CollageView user={session?.user || null} />} />
          
          {/* Protected Routes */}
          <Route
            path="/settings"
            element={session ? <Settings user={session.user} /> : <Navigate to="/login" replace />}
          />
          
          {/* Staff Workspace Console */}
          <Route
            path="/staff_panel"
            element={
              session ? (
                <AdminPanel user={session.user} />
              ) : (
                <Navigate to="/staff" replace />
              )
            }
          />
          
          {/* Legacy route redirects to new staff paths */}
          <Route path="/admin_panel" element={<Navigate to="/staff_panel" replace />} />
          <Route path="/moderation" element={<Navigate to="/staff_panel" replace />} />
          
          {/* Fallback */}
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;

