import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { Archive, Home, ImagePlus, Info, LogOut, Settings, Shield, User, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import Avatar from './Avatar';
import CreatePanel from './CreatePanel';
import { useCachedQuery } from './useCachedQuery';
import './Dashboard.css';
import { canUpload, canAccessAdmin, canAccessStaffConsole } from './roles';

export default function Layout({ user }: { user: any }) {
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const accountMenuRef = useRef<HTMLDivElement>(null);
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
          setProfile((current: any) => ({ ...(current || {}), ...newData }));
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

  useEffect(() => {
    setAvatarMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const openPublisher = () => {
      if (canUpload(profile?.role)) setCreatePanelOpen(true);
    };
    window.addEventListener('open-artvault-publisher', openPublisher);
    return () => window.removeEventListener('open-artvault-publisher', openPublisher);
  }, [profile?.role]);

  useEffect(() => {
    if (!avatarMenuOpen) return;

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        setAvatarMenuOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAvatarMenuOpen(false);
    };

    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [avatarMenuOpen]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error('Unable to sign out. Please try again.');
  };

  const navLinkStyle = (path: string) =>
    `app-primary-nav-link ${location.pathname === path ? 'active' : ''}`;

  const mobileNavItems = [
    { path: '/home', label: 'Discover', icon: Home },
    { path: '/registry', label: 'Registry', icon: Archive },
    { path: '/artists', label: 'Artists', icon: Users },
    ...(canAccessStaffConsole(profile?.role)
      ? [{ path: '/staff_panel', label: 'Workspace', icon: Shield }]
      : [{ path: '/about', label: 'About', icon: Info }]),
    ...(user ? [{ path: `/profile/${user.id}`, label: 'Profile', icon: User }] : []),
  ];

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <header
        className="top-navbar-desktop fixed top-0 left-0 w-full h-16 md:h-20 flex items-center justify-between px-3 md:px-10 z-[999] gap-2"
        style={{ background: 'rgba(245,240,232,0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #d6cfc3' }}
      >
        <div className="flex items-center gap-1 md:gap-4 shrink-0">
          <Link to="/home" className="nav-logo flex items-center shrink-0 md:hidden" aria-label="ArtVault Home">
            <img src="/Artlogo.png" alt="ArtVault" className="h-7 w-auto object-contain filter brightness-0 block" />
          </Link>
          <Link to="/home" className="app-brand hidden md:flex" aria-label="ArtVault Enterprise Edition">
            <img src="/Artlogo.png" alt="" className="app-brand-mark" aria-hidden="true" />
            <span className="app-brand-copy">
              <strong>ARTVAULT</strong>
              <small>Enterprise Edition</small>
            </span>
          </Link>
        </div>

        <div className="flex-1 flex justify-center px-2 md:px-5">
          <nav className="app-primary-nav hidden md:flex" aria-label="Primary navigation">
            <Link to="/home" className={navLinkStyle('/home')}>Discover</Link>
            <Link to="/registry" className={navLinkStyle('/registry')}>Registry</Link>
            <Link to="/artists" className={navLinkStyle('/artists')}>Artists</Link>
            <Link to="/about" className={navLinkStyle('/about')}>About</Link>
          </nav>
        </div>

        <div className="nav-actions shrink-0 flex items-center gap-2 md:gap-4">
          {user ? (
            <div ref={accountMenuRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '12px' }}>
              {canAccessStaffConsole(profile?.role) && (
                <Link
                  to="/staff_panel"
                  className="btn staff-workspace-link whitespace-nowrap !px-3 !py-1.5 md:!px-4 md:!py-2 !text-xs md:!text-sm hidden md:inline-flex"
                  style={{ border: '1px solid #8e7450', borderRadius: '4px', color: '#503d25', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase', alignItems: 'center', gap: '7px' }}
                  aria-label="Open operations workspace"
                >
                  <Shield size={16} strokeWidth={1.8} aria-hidden="true" />
                  Workspace
                </Link>
              )}
              {canUpload(profile?.role) && (
                <button
                  onClick={() => setCreatePanelOpen(true)}
                  className="header-publish-btn hidden md:inline-flex"
                  aria-label="Register a new artwork"
                  title="Register artwork"
                >
                  <ImagePlus size={19} strokeWidth={1.8} aria-hidden="true" />
                  <span>Publish Art</span>
                </button>
              )}
              <button
                className="nav-avatar-btn !w-8 !h-8 md:!w-11 md:!h-11"
                onClick={() => setAvatarMenuOpen(!avatarMenuOpen)}
                style={{ padding: 0 }}
                aria-label="Open account menu"
                aria-expanded={avatarMenuOpen}
                aria-controls="account-menu"
              >
                <Avatar userId={user.id} name={user.user_metadata?.name || 'User'} size={32} />
              </button>

              <div id="account-menu" className={`avatar-dropdown ${avatarMenuOpen ? 'open' : ''}`} style={{ display: avatarMenuOpen ? 'flex' : 'none' }}>
                <div className="dropdown-header">
                  <span className="dropdown-name">{user.user_metadata?.name || 'User'}</span>
                  <span className="dropdown-email">{user.email}</span>
                </div>
                {canUpload(profile?.role) && (
                  <>
                    <button
                      type="button"
                      className="dropdown-item dropdown-item-register"
                      onClick={() => {
                        setAvatarMenuOpen(false);
                        setCreatePanelOpen(true);
                      }}
                    >
                      <ImagePlus size={16} /> Register New Artwork
                    </button>
                    <hr className="dropdown-divider" />
                  </>
                )}
                <Link to={`/profile/${user.id}`} className="dropdown-item" onClick={() => setAvatarMenuOpen(false)}>
                  <User size={16} /> My Profile
                </Link>
                <Link to="/settings" className="dropdown-item" onClick={() => setAvatarMenuOpen(false)}>
                  <Settings size={16} /> Profile Settings
                </Link>
                {canAccessStaffConsole(profile?.role) && (
                  <Link to="/staff_panel" className="dropdown-item" onClick={() => setAvatarMenuOpen(false)}>
                    <Shield size={16} /> {canAccessAdmin(profile?.role)
                      ? 'Administrator Panel'
                      : profile?.role === 'moderator'
                        ? 'Moderation Workspace'
                        : 'Curatorial Workspace'}
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
              className="btn btn-primary whitespace-nowrap !px-3 !py-1.5 md:!px-4 md:!py-2 !text-xs md:!text-sm inline-flex items-center"
              style={{ background: '#1c1917', border: '1px solid #1c1917', borderRadius: '4px', color: '#f5f0e8', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }}
            >
              Sign In
            </Link>
          )}
        </div>
      </header>

      <div id="main-content" className="main-content-wrapper" tabIndex={-1}>
        <Outlet />
      </div>

      {user && canUpload(profile?.role) && (
        <button
          type="button"
          className="mobile-publish-fab"
          onClick={() => setCreatePanelOpen(true)}
          aria-label="Publish artwork"
        >
          <ImagePlus size={18} strokeWidth={1.9} aria-hidden="true" />
          <span>Publish</span>
        </button>
      )}

      <nav
        className="mobile-bottom-nav"
        aria-label="Mobile primary navigation"
        style={{ gridTemplateColumns: `repeat(${mobileNavItems.length}, minmax(0, 1fr))` }}
      >
        {mobileNavItems.map(({ path, label, icon: Icon }) => (
          <Link
            key={path}
            to={path}
            className={`mobile-bottom-nav-item ${location.pathname === path || (path.startsWith('/profile/') && location.pathname.startsWith('/profile/')) ? 'active' : ''}`}
            aria-current={location.pathname === path || (path.startsWith('/profile/') && location.pathname.startsWith('/profile/')) ? 'page' : undefined}
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
          onRestore={() => setCreatePanelOpen(true)}
          user={user}
          categories={categories}
          onArtworkCreated={() => window.dispatchEvent(new Event('artwork-created'))}
          onBoardCreated={() => window.dispatchEvent(new Event('board-created'))}
        />
      )}
    </>
  );
}
