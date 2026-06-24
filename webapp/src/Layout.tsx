import { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Archive, Home, Info, LogOut, Settings, Shield, User, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import Avatar from './Avatar';
import CreatePanel from './CreatePanel';
import { useCachedQuery } from './useCachedQuery';
import './Dashboard.css';
import { canUpload, canAccessAdmin } from './roles';

export default function Layout({ user }: { user: any }) {
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const location = useLocation();

  const { data: cachedCategories } = useCachedQuery<any[]>(
    'categories',
    async () => {
      const { data } = await supabase.from('categories').select('*').order('name');
      return data || [];
    },
    { ttl: 10 * 60 * 1000 }
  );
  const categories = cachedCategories || [];

  useEffect(() => {
    if (!user) return;

    supabase.from('profiles').select('role, status, suspension_end').eq('id', user.id).single().then(async ({ data }) => {
      if (!data) return;
      if (data.status === 'banned') {
        await supabase.auth.signOut();
        toast.error('Your account has been permanently banned.');
        return;
      }
      if (data.status === 'suspended' && data.suspension_end) {
        if (new Date() < new Date(data.suspension_end)) {
          await supabase.auth.signOut();
          toast.error(`Your account is suspended until ${new Date(data.suspension_end).toLocaleDateString()}.`);
          return;
        }
        await supabase.from('profiles').update({ status: 'active', suspension_end: null }).eq('id', user.id);
        data.status = 'active';
      }
      setProfile(data);
    });

    const channel = supabase
      .channel('profile-status-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        async (payload) => {
          const newData = payload.new;
          if (newData.status === 'banned') {
            await supabase.auth.signOut();
            toast.error('Your account has just been permanently banned by an administrator.');
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
  }, [user?.id]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navLinkStyle = (path: string) =>
    `text-[12px] font-bold tracking-[2px] uppercase transition-colors ${
      location.pathname === path ? 'text-[#1c1917]' : 'text-[#78716c] hover:text-[#1c1917]'
    }`;

  const mobileNavItems = [
    { path: '/home', label: 'Discover', icon: Home },
    { path: '/registry', label: 'Registry', icon: Archive },
    { path: '/artists', label: 'Artists', icon: Users },
    { path: '/about', label: 'About', icon: Info },
  ];

  return (
    <>
      <header
        className="top-navbar-desktop fixed top-0 left-0 w-full h-16 md:h-20 flex items-center justify-between px-3 md:px-10 z-[999] gap-2"
        style={{ background: 'rgba(245,240,232,0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #d6cfc3' }}
      >
        <div className="flex items-center gap-1 md:gap-4 shrink-0">
          <Link to="/home" className="nav-logo flex items-center overflow-visible md:hidden">
            <img src="/Artlogo.png" alt="ArtVault" className="h-[30px] scale-[1.8] origin-left ml-4 filter brightness-0 block" />
          </Link>
        </div>

        <div className="flex-1 flex justify-center px-2 md:px-5">
          <div className="hidden md:flex items-center gap-10">
            <Link to="/home" className={navLinkStyle('/home')}>Discover</Link>
            <Link to="/registry" className={navLinkStyle('/registry')}>Registry</Link>
            <Link to="/artists" className={navLinkStyle('/artists')}>Artists</Link>
            <Link to="/about" className={navLinkStyle('/about')}>About</Link>
          </div>
        </div>

        <div className="nav-actions shrink-0 hidden md:flex items-center">
          {user ? (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '16px' }}>
              {canUpload(profile?.role) && (
                <button
                  onClick={() => setCreatePanelOpen(true)}
                  className="btn btn-primary whitespace-nowrap !px-3 !py-1.5 md:!px-4 md:!py-2 !text-xs md:!text-sm"
                  style={{ background: '#b8975a', border: 'none', borderRadius: '4px', color: '#1c1917', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' }}
                >
                  Register Work
                </button>
              )}
              <button className="nav-avatar-btn !w-9 !h-9 md:!w-11 md:!h-11" onClick={() => setAvatarMenuOpen(!avatarMenuOpen)} style={{ padding: 0 }}>
                <Avatar userId={user.id} name={user.user_metadata?.name || 'User'} size={36} />
              </button>

              <div className={`avatar-dropdown ${avatarMenuOpen ? 'open' : ''}`} style={{ display: avatarMenuOpen ? 'flex' : 'none' }}>
                <div className="dropdown-header">
                  <span className="dropdown-name">{user.user_metadata?.name || 'User'}</span>
                  <span className="dropdown-email">{user.email}</span>
                </div>
                <Link to={`/profile/${user.id}`} className="dropdown-item" onClick={() => setAvatarMenuOpen(false)}>
                  <User size={16} /> My Profile
                </Link>
                <Link to="/settings" className="dropdown-item" onClick={() => setAvatarMenuOpen(false)}>
                  <Settings size={16} /> Profile Settings
                </Link>
                {canAccessAdmin(profile?.role) && (
                  <Link to="/admin_panel" className="dropdown-item" onClick={() => setAvatarMenuOpen(false)}>
                    <Shield size={16} /> Administrator Panel
                  </Link>
                )}
                {profile?.role === 'moderator' && (
                  <Link to="/moderation" className="dropdown-item" onClick={() => setAvatarMenuOpen(false)}>
                    <Shield size={16} /> Moderation Panel
                  </Link>
                )}
                <hr className="dropdown-divider" />
                <button className="dropdown-item logout" onClick={handleLogout} style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer' }}>
                  <LogOut size={16} /> Logout Session
                </button>
              </div>
            </div>
          ) : (
            <Link
              to="/login"
              className="btn btn-primary whitespace-nowrap !px-3 !py-1.5 md:!px-4 md:!py-2 !text-xs md:!text-sm"
              style={{ background: '#1c1917', border: '1px solid #1c1917', borderRadius: '4px', color: '#f5f0e8', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }}
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      <div className="main-content-wrapper">
        <Outlet />
      </div>

      <nav className="mobile-bottom-nav" aria-label="Mobile primary navigation">
        {mobileNavItems.map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={`mobile-bottom-nav-item ${location.pathname === path ? 'active' : ''}`}
          >
            <Icon size={18} strokeWidth={1.8} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>

      {user && (
        <CreatePanel
          isOpen={createPanelOpen}
          onClose={() => setCreatePanelOpen(false)}
          user={user}
          categories={categories}
          onArtworkCreated={() => window.dispatchEvent(new Event('artwork-created'))}
          onBoardCreated={() => window.dispatchEvent(new Event('board-created'))}
        />
      )}
    </>
  );
}
