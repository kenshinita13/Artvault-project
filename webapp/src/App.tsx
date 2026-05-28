import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation, Navigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from './supabaseClient';
import Layout from './Layout';
import Dashboard from './Dashboard';
import Artists from './Artists';
import UserProfile from './UserProfile';
import Settings from './Settings';

import AdminPanel from './AdminPanel';
import { logAudit } from './auditHelper';

function App() {
  const [session, setSession] = useState<any>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeForm, setActiveForm] = useState<'login' | 'register'>('login');
  const [isValidatingLogin, setIsValidatingLogin] = useState(false);

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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsInitializing(false);
    });

    let currentUserId: string | null = null;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      
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

  if (isInitializing) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', color: 'var(--text-secondary)' }}>Loading Studio...</div>;
  }
  
  const handleLogin = async (e: React.FormEvent, isAdminLogin = false) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    setIsValidatingLogin(true);

    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      toast.error(error.message);
      setLoading(false);
      setIsValidatingLogin(false);
      return;
    }

    // Role and Status check before proceeding to MFA or completing login
    if (data?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role, status, suspension_end')
        .eq('id', data.user.id)
        .single();

      if (profile) {
        if (profile.status === 'banned') {
          await supabase.auth.signOut();
          const msg = 'Access Denied: Your account has been permanently banned.';
          setError(msg);
          toast.error(msg);
          setLoading(false);
          setIsValidatingLogin(false);
          return;
        }

        if (profile.status === 'suspended' && profile.suspension_end) {
          const endDate = new Date(profile.suspension_end);
          if (endDate > new Date()) {
            await supabase.auth.signOut();
            const msg = `Access Denied: Account suspended until ${endDate.toLocaleString()}.`;
            setError(msg);
            toast.error(msg);
            setLoading(false);
            setIsValidatingLogin(false);
            return;
          } else {
            // Suspension has expired, auto-restore them
            await supabase.from('profiles').update({ status: 'active', suspension_end: null }).eq('id', data.user.id);
          }
        }
      }

      if (isAdminLogin && profile?.role !== 'admin') {
        await supabase.auth.signOut();
        setError('Access denied. Only administrators can log in here.');
        toast.error('Access denied. Only administrators can log in here.');
        setLoading(false);
        setIsValidatingLogin(false);
        return;
      }

      if (!isAdminLogin && profile?.role === 'admin') {
        await supabase.auth.signOut();
        setError('Admins must log in through the /admin portal.');
        toast.error('Admins must log in through the /admin portal.');
        setLoading(false);
        setIsValidatingLogin(false);
        return;
      }
    }

    // Check for MFA
    const { data: mfaData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (mfaData && mfaData.nextLevel === 'aal2' && mfaData.currentLevel === 'aal1') {
      const factors = await supabase.auth.mfa.listFactors();
      if (factors.data && factors.data.totp.length > 0) {
        const verifiedFactors = factors.data.totp.filter(f => f.status === 'verified');
        if (verifiedFactors.length > 0) {
          verifiedFactors.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          setMfaFactorIds(verifiedFactors.map((f: any) => f.id));
          setShowMfaChallenge(true);
          setLoading(false);
          setIsValidatingLogin(false);
          return;
        }
      }
    }

    // If no MFA required, proceed as normal
    completeLogin(data);
  };

  const completeLogin = async (data: any) => {
    if (data?.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single();
        
      setSuccess('Login successful! Redirecting...');
      toast.success('Login successful!');
      setIsValidatingLogin(false);
      setShowMfaChallenge(false);
      
      if (profile?.role === 'admin') {
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
  if (session && !isValidatingLogin && !showMfaChallenge) {
    return (
      <Routes>
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/login" element={<Navigate to="/home" replace />} />
        <Route path="/admin" element={<Navigate to="/admin_panel" replace />} />
        <Route element={<Layout user={session.user} />}>
          <Route path="/home" element={<Dashboard user={session.user} />} />
          <Route path="/artists" element={<Artists />} />
          <Route path="/profile/:id" element={<UserProfile currentUser={session.user} />} />
          <Route path="/settings" element={<Settings user={session.user} />} />
          <Route path="/admin_panel" element={<AdminPanel user={session.user} />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Route>
      </Routes>
    );
  }

  // Enforce unauthenticated routing to /login or /admin
  if (!isValidatingLogin && location.pathname !== '/login' && location.pathname !== '/admin') {
    return <Navigate to="/login" replace />;
  }

  // Otherwise, show Login/Register form
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', width: '100%', padding: '20px', position: 'relative' }}>
      <div className="glow-blob glow-1"></div>
      <div className="glow-blob glow-2"></div>

      <div className="container">
        <div className="brand-header">
          <div className="brand-logo">🎨</div>
          <h1 className="brand-title">ArtVault Studio</h1>
          <p className="brand-subtitle">The Canvas of Digital Artists & Creators</p>
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
            <h2>Artist Sign In</h2>
            
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
            <div style={{ fontSize: '48px', textAlign: 'center', marginBottom: '10px' }}>🛡️</div>
            <h2>Admin Login</h2>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '25px', fontSize: '14px' }}>Secure access to ArtVault administration</p>
            
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
            <h2>Register Artist</h2>

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



              <button type="submit" disabled={loading}>
                {loading ? 'Registering...' : 'Onboard Account'}
              </button>

              <div className="form-footer">
                Already registered?{' '}
                <a href="#" onClick={(e) => { 
                  e.preventDefault(); 
                  setError(''); setSuccess('');
                  setActiveForm('login'); 
                }}>
                  Sign In to Studio
                </a>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
