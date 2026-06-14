import { useState, useEffect, Suspense, lazy } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { supabase } from './supabaseClient';
import { logAudit } from './auditHelper';

const Layout = lazy(() => import('./Layout'));
const Dashboard = lazy(() => import('./Dashboard'));
const Artists = lazy(() => import('./Artists'));
const UserProfile = lazy(() => import('./UserProfile'));
const Settings = lazy(() => import('./Settings'));
const AdminPanel = lazy(() => import('./AdminPanel'));
const LandingPage = lazy(() => import('./LandingPage'));
const Boards = lazy(() => import('./Boards'));

function App() {
  const [session, setSession] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeForm, setActiveForm] = useState<'login' | 'register'>('login');
  const [isValidatingLogin, setIsValidatingLogin] = useState(false);
  const [banMessage, setBanMessage] = useState<string | null>(null);

  const location = useLocation();
  const isAdminRoute = location.pathname === '/admin';

  // MFA Challenge State
  const [showMfaChallenge, setShowMfaChallenge] = useState(false);
  const [mfaFactorIds, setMfaFactorIds] = useState<string[]>([]);
  const [mfaCode, setMfaCode] = useState('');

  const navigate = useNavigate();
  
  // States for forms
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const role = 'user';
  
  // States for feedback
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const mode = params.get('mode');
    if (mode === 'register') {
      setActiveForm('register');
    } else if (mode === 'login') {
      setActiveForm('login');
    }
  }, [location.search]);

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
        setEmail('');
        setPassword('');
        setSuccess('');
        setError('');
        setMfaCode('');
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

  if (isInitializing) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: 'var(--text-secondary)' }}>Loading Studio...</div>;
  }
  
  const validateAdminAccess = (profile: any, isAdminLogin: boolean): string | null => {
    if (isAdminLogin && profile?.role !== 'admin') {
      return 'Access denied. Only administrators can log in here.';
    }
    if (!isAdminLogin && profile?.role === 'admin') {
      return 'Admins must log in through the /admin portal.';
    }
    return null;
  };

  const validateProfileStatus = async (profile: any, userId: string): Promise<string | null> => {
    if (!profile) return null;

    if (profile.status === 'banned') {
      await supabase.auth.signOut();
      return 'Access Denied: Your account has been permanently banned.';
    }

    if (profile.status === 'suspended' && profile.suspension_end) {
      const endDate = new Date(profile.suspension_end);
      if (endDate > new Date()) {
        await supabase.auth.signOut();
        return `Access Denied: Account suspended until ${endDate.toLocaleString()}.`;
      } else {
        await supabase.from('profiles').update({ status: 'active', suspension_end: null }).eq('id', userId);
      }
    }
    return null;
  };

  const checkMfaRequirements = async (mfaData: any): Promise<boolean> => {
    if (mfaData && mfaData.nextLevel === 'aal2' && mfaData.currentLevel === 'aal1') {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.data && factors.data.totp.length > 0) {
        const verifiedFactors = factors.data.totp.filter((f: any) => f.status === 'verified');
        if (verifiedFactors.length > 0) {
          verifiedFactors.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setMfaFactorIds(verifiedFactors.map((f: any) => f.id));
          setShowMfaChallenge(true);
          return true; // MFA is required
        }
      }
    }
    return false; // MFA is not required
  };

  const handleLogin = async (e: React.FormEvent, isAdminLogin = false) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    setIsValidatingLogin(true);

    try {
      const { error, data } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        throw error;
      }

      if (data?.user) {
        const [profileResponse, mfaResponse] = await Promise.all([
          supabase.from('profiles').select('role, status, suspension_end').eq('id', data.user.id).single(),
          supabase.auth.mfa.getAuthenticatorAssuranceLevel()
        ]);

        const profile = profileResponse.data;
        const mfaData = mfaResponse.data;

        const statusError = await validateProfileStatus(profile, data.user.id);
        if (statusError) {
          setError(statusError);
          setBanMessage(statusError);
          setLoading(false);
          setIsValidatingLogin(false);
          return;
        }

        const adminError = validateAdminAccess(profile, isAdminLogin);
        if (adminError) {
          await supabase.auth.signOut();
          setError(adminError);
          toast.error(adminError);
          setLoading(false);
          setIsValidatingLogin(false);
          return;
        }

        const requiresMfa = await checkMfaRequirements(mfaData);
        if (requiresMfa) {
          setLoading(false);
          setIsValidatingLogin(false);
          return;
        }

        completeLogin(data, profile);
      } else {
        setLoading(false);
        setIsValidatingLogin(false);
      }
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'An unexpected error occurred. Please try again.');
      toast.error(err.message || 'Login failed. Please try again.');
      setLoading(false);
      setIsValidatingLogin(false);
    }
  };

  const completeLogin = async (data: any, profile?: any) => {
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
        
      setSuccess('Login successful! Redirecting...');
      toast.success('Login successful!');
      setIsValidatingLogin(false);
      setShowMfaChallenge(false);
      
      if (userRole === 'admin') {
        navigate('/admin_panel');
      } else {
        navigate('/home');
      }
    } else {
      setIsValidatingLogin(false);
    }
    setLoading(false);
  };

  const handleMfaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    setIsValidatingLogin(true);

    let success = false;
    let lastError = null;

    for (const factorId of mfaFactorIds) {
      const challenge = await supabase.auth.mfa.challenge({ factorId });
      if (challenge.error) {
        lastError = challenge.error;
        continue;
      }

      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: mfaCode
      });

      if (!verify.error) {
        success = true;
        break;
      } else {
        lastError = verify.error;
      }
    }

    if (!success) {
      setError("Verification error: " + (lastError?.message || "Invalid TOTP code"));
      toast.error("Invalid TOTP code. Please try again.");
      setLoading(false); 
      setIsValidatingLogin(false);
      return;
    }

    // MFA verified successfully
    setShowMfaChallenge(false);
    const { data } = await supabase.auth.getUser();
    completeLogin({ user: data.user });
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin + '/home',
        data: {
          name,
          username,
          role
        }
      }
    });

    if (error) {
      setError(error.message);
      toast.error(error.message);
    } else {
      if (data?.user?.id) {
        logAudit('User Registration', `New account created: @${username}`, data.user.id);
      }
      setSuccess('Registration successful! Please check your email to verify.');
      toast.success('Registration successful! Check email to verify.');
    }
    setLoading(false);
  };

  // If user is logged in and not validating checks, show the App via React Router
  // Refactored Authentication UI
  const renderAuthUI = () => (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md p-4"
      >
        {!isAdminRoute && (
          <button 
            onClick={() => navigate('/')} 
            className="absolute top-6 right-8 text-white/70 hover:text-white text-3xl transition-colors z-50"
          >
            ✕
          </button>
        )}
        
        {banMessage && (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="fixed inset-0 bg-black/80 z-[99999] flex justify-center items-center p-4"
          >
            <div className="bg-[#1e1e2d] p-10 rounded-2xl text-center max-w-md w-full border border-red-500/50 shadow-[0_10px_40px_rgba(239,68,68,0.2)]">
                <div className="text-6xl mb-6">🚨</div>
                <h2 className="text-red-500 mb-4 text-2xl font-bold">Account Restricted</h2>
                <p className="text-zinc-400 mb-8 text-base leading-relaxed">{banMessage}</p>
                <button 
                  onClick={() => setBanMessage(null)} 
                  className="w-full bg-red-500 hover:bg-red-600 text-white py-3 rounded-xl font-bold transition-colors"
                >
                  Acknowledge
                </button>
            </div>
          </motion.div>
        )}

        <motion.div 
          initial={{ scale: 0.95, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="container max-w-md w-full relative"
        >
          <div className="flex flex-col items-center mb-8 text-center">
            {/* Logo Container - Handles large transparent image bounds */}
            <div className="relative w-full h-16 flex items-center justify-center mb-4">
              <img 
                src="/artvault_logo.png" 
                alt="ArtVault Logo" 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[160px] w-auto mix-blend-screen pointer-events-none" 
              />
            </div>
            <h2 className="text-3xl font-extrabold text-white mb-2 tracking-tight mt-4">
              {isAdminRoute ? 'Admin Portal' : activeForm === 'register' ? 'Join the Studio' : 'Welcome Back'}
            </h2>
            <p className="text-zinc-400 text-base">
              {isAdminRoute ? 'Secure access to ArtVault administration.' : activeForm === 'register' ? 'Join the community and share your work.' : 'Access your creative portfolio.'}
            </p>
          </div>

        {showMfaChallenge && (
          <div className="form-box active">
            <h2>Two-Factor Authentication</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '20px', textAlign: 'center', fontSize: '14px' }}>
              Please enter the 6-digit code from Google Authenticator to verify your identity.
            </p>
            {error && <div className="alert error">❌ {error}</div>}
            
            <form onSubmit={e => handleMfaSubmit(e)}>
              <div className="form-group">
                <input 
                  type="text" 
                  value={mfaCode} 
                  onChange={(e) => setMfaCode(e.target.value.replace(/[^0-9]/g, ''))} 
                  required 
                  className="form-control"
                  placeholder="123456"
                  maxLength={6}
                  style={{ letterSpacing: mfaCode.length > 0 ? '8px' : 'normal', textAlign: 'center', fontSize: '24px', fontWeight: 'bold' }}
                />
              </div>
              
              <button type="submit" disabled={loading || mfaCode.length !== 6}>
                {loading ? 'Verifying...' : 'Verify Secure Code'}
              </button>
            </form>
            <div className="form-footer">
              <a href="#" onClick={(e) => { e.preventDefault(); supabase.auth.signOut(); setShowMfaChallenge(false); setIsValidatingLogin(false); }}>
                Cancel & Logout
              </a>
            </div>
          </div>
        )}
        
        {!isAdminRoute && activeForm === 'login' && !showMfaChallenge && (
          <div className="form-box active">
            {error && <div className="alert error">❌ {error}</div>}
            {success && <div className="alert success">✅ {success}</div>}

            <form onSubmit={(e) => handleLogin(e, false)}>
              <div className="form-group">
                <label htmlFor="login_email">Email Address</label>
                <input 
                  type="email" 
                  id="login_email" 
                  className="form-control" 
                  placeholder="Enter your email" 
                  required 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="login_pass">Password</label>
                <input 
                  type="password" 
                  id="login_pass" 
                  className="form-control" 
                  placeholder="Enter your password" 
                  required 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>

              <button type="submit" disabled={loading}>
                {loading ? 'Authenticating...' : 'Enter Studio'}
              </button>

              <div className="form-footer">
                New to ArtVault?{' '}
                <a href="#" onClick={(e) => { 
                  e.preventDefault(); 
                  setError(''); setSuccess('');
                  setActiveForm('register'); 
                }}>
                  Create an Artist Profile
                </a>
              </div>

            </form>
          </div>
        )}

        {isAdminRoute && !showMfaChallenge && (
          <div className="form-box active" style={{ borderTop: '4px solid #7494ec' }}>
            <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '15px' }}>🛡️</div>
            
            <div style={{ background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid rgba(234, 179, 8, 0.2)', fontSize: '14px' }}>
              <strong>⚠️ Restricted Access:</strong> This area is for administrators only.
            </div>

            {error && <div className="alert error">❌ {error}</div>}
            {success && <div className="alert success">✅ {success}</div>}

            <form onSubmit={(e) => handleLogin(e, true)}>
              <div className="form-group">
                <label htmlFor="admin_email">Admin Email</label>
                <input 
                  type="email" 
                  id="admin_email" 
                  className="form-control" 
                  placeholder="Enter your admin email" 
                  required 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  style={{ borderColor: 'rgba(116, 148, 236, 0.5)' }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="admin_pass">Password</label>
                <input 
                  type="password" 
                  id="admin_pass" 
                  className="form-control" 
                  placeholder="Enter your password" 
                  required 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  style={{ borderColor: 'rgba(116, 148, 236, 0.5)' }}
                />
              </div>

              <button type="submit" disabled={loading} style={{ background: '#7494ec', marginTop: '20px' }}>
                {loading ? 'Authenticating...' : '🔐 Login as Administrator'}
              </button>
            </form>
          </div>
        )}

        {!isAdminRoute && activeForm === 'register' && !showMfaChallenge && (
          <div className="form-box active">

            {error && <div className="alert error">❌ {error}</div>}
            {success && <div className="alert success">✅ {success}</div>}

            <form onSubmit={handleRegister}>
              <div className="form-group">
                <label htmlFor="reg_name">Artist/Full Name</label>
                <input 
                  type="text" 
                  id="reg_name" 
                  className="form-control" 
                  placeholder="e.g. Leonardo da Vinci" 
                  required 
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg_username">Username</label>
                <input 
                  type="text" 
                  id="reg_username" 
                  className="form-control" 
                  placeholder="e.g. leonardo" 
                  required 
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg_email">Email Address</label>
                <input 
                  type="email" 
                  id="reg_email" 
                  className="form-control" 
                  placeholder="e.g. leo@artvault.com" 
                  required 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="reg_pass">Password</label>
                <input 
                  type="password" 
                  id="reg_pass" 
                  className="form-control" 
                  placeholder="Create a secure password" 
                  required 
                  minLength={4}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>



              <button type="submit" disabled={loading} className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold py-3 px-4 rounded-xl shadow-lg transition-all mt-4">
                {loading ? 'Registering...' : 'Onboard Account'}
              </button>

              <div className="text-center mt-6 text-zinc-400 text-sm">
                Already registered?{' '}
                <a href="#" className="text-purple-400 hover:text-purple-300 font-semibold" onClick={(e) => { 
                  e.preventDefault(); 
                  setError(''); setSuccess('');
                  navigate('/login?mode=login');
                }}>
                  Sign In to Studio
                </a>
              </div>
            </form>
          </div>
        )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
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
          
          {/* Protected Routes */}
          <Route path="/boards" element={session ? <Boards user={session.user} /> : <Navigate to="/login" replace />} />
          <Route path="/artists" element={session ? <Artists /> : <Navigate to="/login" replace />} />
          <Route path="/profile/:id" element={session ? <UserProfile currentUser={session.user} /> : <Navigate to="/login" replace />} />
          <Route path="/settings" element={session ? <Settings user={session.user} /> : <Navigate to="/login" replace />} />
          <Route path="/admin_panel" element={session ? <AdminPanel user={session.user} /> : <Navigate to="/login" replace />} />
          
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export default App;
