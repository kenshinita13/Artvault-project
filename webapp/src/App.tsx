import { useState, useEffect, Suspense, lazy, useCallback } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from './supabaseClient';
import { logAudit } from './auditHelper';

const Layout = lazy(() => import('./Layout'));
const Dashboard = lazy(() => import('./Dashboard'));
const Artists = lazy(() => import('./Artists'));
const UserProfile = lazy(() => import('./UserProfile'));
const Settings = lazy(() => import('./Settings'));
const AdminPanel = lazy(() => import('./AdminPanel'));
const ModerationPanel = lazy(() => import('./ModerationPanel'));
const LandingPage = lazy(() => import('./LandingPage'));
const About = lazy(() => import('./About'));
const AuthForm = lazy(() => import('./AuthForm'));

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
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: 'var(--text-secondary)' }}>Loading Studio...</div>;
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
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: 'var(--text-secondary)' }}>Loading Studio...</div>;
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
          <Route path="/home" element={<Dashboard user={session?.user || null} />} />
          <Route path="/about" element={<About />} />
          
          {/* Protected Routes */}
          <Route path="/artists" element={session ? <Artists /> : <Navigate to="/login" replace />} />
          <Route path="/profile/:id" element={session ? <UserProfile currentUser={session.user} /> : <Navigate to="/login" replace />} />
          <Route path="/settings" element={session ? <Settings user={session.user} /> : <Navigate to="/login" replace />} />
          <Route path="/admin_panel" element={session ? <AdminPanel user={session.user} /> : <Navigate to="/login" replace />} />
          <Route path="/moderation" element={session ? <ModerationPanel user={session.user} /> : <Navigate to="/login" replace />} />
          
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
