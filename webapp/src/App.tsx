import { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from './supabaseClient';
import { logAudit } from './auditHelper';
import { canAccessAdmin, canAccessModeration } from './roles';

const Layout = lazy(() => import('./Layout'));
const Dashboard = lazy(() => import('./Dashboard'));
const Artists = lazy(() => import('./Artists'));
const UserProfile = lazy(() => import('./UserProfile'));
const CollageView = lazy(() => import('./CollageView'));
const Settings = lazy(() => import('./Settings'));
const AdminPanel = lazy(() => import('./AdminPanel'));
const ModerationPanel = lazy(() => import('./ModerationPanel'));
const LandingPage = lazy(() => import('./LandingPage'));
const About = lazy(() => import('./About'));
const LegalPage = lazy(() => import('./LegalPage'));
const AuthForm = lazy(() => import('./AuthForm'));

function RoleGate({
  user,
  allow,
  children,
}: {
  user: any;
  allow: (role: string) => boolean;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<'checking' | 'allowed' | 'denied'>('checking');

  useEffect(() => {
    let active = true;

    async function checkRole() {
      if (!user?.id) {
        setState('denied');
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('role, status, suspension_end')
        .eq('id', user.id)
        .single();

      if (!active) return;
      const restrictionExpired = data?.status === 'suspended'
        && data.suspension_end
        && new Date(data.suspension_end) <= new Date();
      const hasActiveAccess = data?.status === 'active' || restrictionExpired;
      setState(data && hasActiveAccess && allow(data.role) ? 'allowed' : 'denied');
    }

    setState('checking');
    checkRole();

    return () => {
      active = false;
    };
  }, [user?.id, allow]);

  if (!user) return <Navigate to="/login" replace />;
  if (state === 'checking') {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-secondary)' }}>Checking Access...</div>;
  }
  if (state === 'denied') return <Navigate to="/home" replace />;
  return <>{children}</>;
}

function App() {
  const [session, setSession] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isValidatingLogin, setIsValidatingLogin] = useState(false);
  const [banMessage, setBanMessage] = useState<string | null>(null);



  // MFA Challenge State (kept at App level since it affects routing decisions)
  const [showMfaChallenge, setShowMfaChallenge] = useState(false);
  const [mfaFactorIds, setMfaFactorIds] = useState<string[]>([]);

  const navigate = useNavigate();

  useEffect(() => {
    const checkStatus = async (userSession: any) => {
      if (!userSession?.user) return null;
      const { data: profile } = await supabase.from('profiles').select('status, suspension_end').eq('id', userSession.user.id).single();
      
      if (profile) {
        if (profile.status === 'banned') {
          await supabase.auth.signOut();
          setBanMessage('Access Denied: Your account has been permanently banned.');
          return null;
        }
        if (profile.status === 'suspended' && profile.suspension_end) {
          const endDate = new Date(profile.suspension_end);
          if (endDate > new Date()) {
            await supabase.auth.signOut();
            setBanMessage(`Access Denied: Account suspended until ${endDate.toLocaleString()}.`);
            return null;
          } else {
            await supabase.from('profiles').update({ status: 'active', suspension_end: null }).eq('id', userSession.user.id);
          }
        }
      }
      return userSession;
    };

    const initSession = async () => {
      // Failsafe timeout to prevent infinite loading screen
      const failsafeTimeout = setTimeout(() => {
        console.warn("Auth initialization timed out after 5 seconds");
        setIsInitializing(false);
      }, 5000);

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error("Supabase getSession error:", error);
        }
        
        try {
          const valid = await checkStatus(data?.session);
          setSession(valid);
        } catch (statusError) {
          console.error("checkStatus error:", statusError);
          setSession(null);
        }
      } catch (err) {
        console.error("Unexpected error during auth init:", err);
        setSession(null);
      } finally {
        clearTimeout(failsafeTimeout);
        setIsInitializing(false);
      }
    };

    initSession();

    let currentUserId: string | null = null;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session && (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED')) {
         const valid = await checkStatus(session);
         setSession(valid);
      } else {
         setSession(session);
      }
      
      if (_event === 'SIGNED_IN' && session?.user) {
         currentUserId = session.user.id;
         logAudit('User Login', 'User authenticated successfully.', currentUserId);
      } else if (_event === 'SIGNED_OUT') {
         if (currentUserId) {
            logAudit('User Logout', 'User logged out securely.', currentUserId);
            currentUserId = null;
         }
      }

      if (!session) {
        setShowMfaChallenge(false);
        setIsValidatingLogin(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id) return;

    const profileSubscription = supabase
      .channel('public:profiles')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${session.user.id}` },
        async (payload) => {
          const { status, suspension_end } = payload.new;
          if (status === 'banned') {
            await supabase.auth.signOut();
            setBanMessage('Access Denied: Your account has been permanently banned.');
          } else if (status === 'suspended' && suspension_end) {
            const endDate = new Date(suspension_end);
            if (endDate > new Date()) {
              await supabase.auth.signOut();
              setBanMessage(`Access Denied: Account suspended until ${endDate.toLocaleString()}.`);
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
  // Must be declared before any early returns (React hooks rule)
  const handleLoginComplete = useCallback(async (data: any, profile?: any) => {
    if (data?.user) {
      let userRole = profile?.role;
      
      // Only fetch if not already provided
      if (!userRole) {
        const { data: p } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();
        userRole = p?.role;
      }
        
      toast.success('Login successful!');
      setIsValidatingLogin(false);
      setShowMfaChallenge(false);
      
      if (userRole === 'admin') {
        navigate('/admin_panel');
      } else if (userRole === 'moderator') {
        navigate('/moderation');
      } else {
        navigate('/home');
      }
    } else {
      setIsValidatingLogin(false);
    }
  }, [navigate]);

  if (isInitializing) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: 'var(--text-secondary)' }}>Loading Collection...</div>;
  }

  // Auth UI rendered via the extracted AuthForm component
  const renderAuthUI = () => (
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
  );

  if (isValidatingLogin) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-secondary)' }}>Loading Collection...</div>;
  }

  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-secondary)' }}>Loading...</div>}>
      <Routes>
        <Route path="/" element={session && !showMfaChallenge ? <Navigate to="/home" replace /> : <LandingPage />} />
        <Route path="/login" element={session && !showMfaChallenge ? <Navigate to="/home" replace /> : <><LandingPage />{renderAuthUI()}</>} />
        <Route path="/admin" element={session && !showMfaChallenge ? <Navigate to="/admin_panel" replace /> : renderAuthUI()} />
        
        {/* Publically Accessible Layout */}
        <Route element={<Layout user={session?.user || null} />}>
          {/* Public Route */}
          <Route path="/home" element={<Dashboard user={session?.user || null} mode="discover" />} />
          <Route path="/registry" element={<Dashboard user={session?.user || null} mode="registry" />} />
          <Route path="/about" element={<About user={session?.user || null} />} />
          <Route path="/privacy" element={<LegalPage type="privacy" />} />
          <Route path="/terms" element={<LegalPage type="terms" />} />
          
          <Route path="/artists" element={<Artists />} />
          <Route path="/profile/:id" element={<UserProfile currentUser={session?.user || null} />} />
          <Route path="/collage/:id" element={<CollageView user={session?.user || null} />} />
          {/* Protected Routes */}
          <Route path="/settings" element={session ? <Settings user={session.user} /> : <Navigate to="/login" replace />} />
          <Route
            path="/admin_panel"
            element={
              <RoleGate user={session?.user || null} allow={canAccessAdmin}>
                <AdminPanel user={session?.user || null} />
              </RoleGate>
            }
          />
          <Route
            path="/moderation"
            element={
              <RoleGate user={session?.user || null} allow={canAccessModeration}>
                <ModerationPanel user={session?.user || null} />
              </RoleGate>
            }
          />
          
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
