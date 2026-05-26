import { useState, useEffect } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Search, X, LogOut, LayoutDashboard, Users, User, Settings, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import Avatar from './Avatar';
import './Dashboard.css';

export default function Layout({ user }: { user: any }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    supabase.from('profiles').select('role, status, suspension_end').eq('id', user.id).single().then(async ({ data }) => {
      if (data) {
        if (data.status === 'banned') {
          await supabase.auth.signOut();
          toast.error("Your account has been permanently banned.");
          return;
        }
        if (data.status === 'suspended' && data.suspension_end) {
          if (new Date() < new Date(data.suspension_end)) {
            await supabase.auth.signOut();
            toast.error(`Your account is suspended until ${new Date(data.suspension_end).toLocaleDateString()}.`);
            return;
          } else {
            await supabase.from('profiles').update({ status: 'active', suspension_end: null }).eq('id', user.id);
            data.status = 'active';
          }
        }
        setProfile(data);
      }
    });

    // Real-time listener for Live Bans/Suspensions
    const channel = supabase
      .channel('profile-status-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`
        },
        async (payload) => {
          const newData = payload.new;
          if (newData.status === 'banned') {
            await supabase.auth.signOut();
            toast.error("Your account has just been permanently banned by an administrator.");
          } else if (newData.status === 'suspended') {
            await supabase.auth.signOut();
            const suspendedUntil = newData.suspension_end ? new Date(newData.suspension_end).toLocaleDateString() : 'a later date';
            toast.error(`Your account has just been suspended until ${suspendedUntil}.`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  return (
    <>
      {/* Slide-out Drawer Navigation */}
      <div className={`nav-drawer ${drawerOpen ? 'open' : ''}`}>
        <div className="nav-drawer-header">
          <h3 style={{ margin: 0 }}>🧭 Quick Navigation</h3>
          <button className="close-drawer" onClick={() => setDrawerOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
            <X size={24} />
          </button>
        </div>
        <div className="nav-drawer-body">
          <Link to="/home" className="drawer-item" onClick={() => setDrawerOpen(false)}>
            <LayoutDashboard className="drawer-icon" /> Global Showcase
          </Link>
          <Link to="/artists" className="drawer-item" onClick={() => setDrawerOpen(false)}>
            <Users className="drawer-icon" /> Artists Directory
          </Link>
          <Link to={`/profile/${user.id}`} className="drawer-item" onClick={() => setDrawerOpen(false)}>
            <User className="drawer-icon" /> My Public Profile
          </Link>
          <Link to="/settings" className="drawer-item" onClick={() => setDrawerOpen(false)}>
            <Settings className="drawer-icon" /> Studio Dashboard / Settings
          </Link>
          {profile?.role === 'admin' && (
            <Link to="/admin_panel" className="drawer-item" onClick={() => setDrawerOpen(false)}>
              <Shield className="drawer-icon" /> Administrator Panel
            </Link>
          )}
          <hr className="drawer-divider" />
          <button className="drawer-item logout" onClick={handleLogout} style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer' }}>
            <LogOut className="drawer-icon" /> Logout Session
          </button>
        </div>
      </div>
      
      {/* Drawer overlay */}
      <div 
        className={`drawer-overlay ${drawerOpen ? 'open' : ''}`} 
        onClick={() => setDrawerOpen(false)}
      ></div>

      {/* Top Navbar */}
      <header className="navbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <button className="waffle-btn" onClick={() => setDrawerOpen(true)}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
                <rect x="3" y="3" width="4" height="4" rx="1" />
                <rect x="10" y="3" width="4" height="4" rx="1" />
                <rect x="17" y="3" width="4" height="4" rx="1" />
                <rect x="3" y="10" width="4" height="4" rx="1" />
                <rect x="10" y="10" width="4" height="4" rx="1" />
                <rect x="17" y="10" width="4" height="4" rx="1" />
                <rect x="3" y="17" width="4" height="4" rx="1" />
                <rect x="10" y="17" width="4" height="4" rx="1" />
                <rect x="17" y="17" width="4" height="4" rx="1" />
            </svg>
          </button>
          <Link to="/home" className="nav-logo">
            🎨 <span>ArtVault</span> Gallery
          </Link>
        </div>

        <form className="search-form" onSubmit={(e) => { e.preventDefault(); /* search logic */ }} style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search by title, description, or artist..." 
            style={{ paddingLeft: '40px' }}
          />
        </form>

        <div className="nav-actions">
          <div style={{ position: 'relative' }}>
            <button className="nav-avatar-btn" onClick={() => setAvatarMenuOpen(!avatarMenuOpen)} style={{ padding: 0 }}>
              <Avatar userId={user.id} name={user.user_metadata?.name || 'User'} size={36} />
            </button>
            
            {/* Avatar Dropdown */}
            <div className={`avatar-dropdown ${avatarMenuOpen ? 'open' : ''}`} style={{ display: avatarMenuOpen ? 'flex' : 'none' }}>
              <div className="dropdown-header">
                <span className="dropdown-name">{user.user_metadata?.name || 'User'}</span>
                <span className="dropdown-email">{user.email}</span>
              </div>
              <Link to="/settings" className="dropdown-item" onClick={() => setAvatarMenuOpen(false)}>
                 <Settings size={16} /> Profile Settings
              </Link>
              {profile?.role === 'admin' && (
                <Link to="/admin_panel" className="dropdown-item" onClick={() => { setAvatarMenuOpen(false); }}>
                   <Shield size={16} /> Administrator Panel
                </Link>
              )}
              <hr className="dropdown-divider" />
              <button className="dropdown-item logout" onClick={handleLogout} style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer' }}>
                 <LogOut size={16} /> Logout Session
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <Outlet />
    </>
  );
}
