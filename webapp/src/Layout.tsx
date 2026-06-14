import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { X, LogOut, LayoutDashboard, Users, User, Settings, Shield, Home, FolderOpen, Plus, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import Avatar from './Avatar';
import CreatePanel from './CreatePanel';
import './Dashboard.css';

export default function Layout({ user }: { user: any }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [createPanelOpen, setCreatePanelOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [categories, setCategories] = useState<any[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [localSearch, setLocalSearch] = useState(searchParams.get('search') || '');

  useEffect(() => {
    setLocalSearch(searchParams.get('search') || '');
  }, [searchParams.get('search')]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (window.location.pathname === '/home' || window.location.pathname === '/') {
        const currentSearchParam = searchParams.get('search') || '';
        if (localSearch !== currentSearchParam) {
          if (localSearch) {
            setSearchParams({ search: localSearch });
          } else {
            setSearchParams({});
          }
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [localSearch, setSearchParams, searchParams]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalSearch(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (window.location.pathname !== '/home' && window.location.pathname !== '/') {
         navigate(`/home?search=${encodeURIComponent(localSearch)}`);
      }
    }
  };

  // Fetch categories for CreatePanel
  useEffect(() => {
    supabase.from('categories').select('*').order('name').then(({ data }) => {
      if (data) setCategories(data);
    });
  }, []);

  useEffect(() => {
    if (!user) return;

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

    // Fetch notifications
    const fetchNotifs = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*, profiles!notifications_actor_id_fkey(name, username, avatar_url), artworks(title, image_url)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      if (data) {
        setNotifications(data);
        setUnreadCount(data.filter((n: any) => !n.is_read).length);
      }
    };
    fetchNotifs();

    // Listen for new notifications
    const notifChannel = supabase.channel('user-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        fetchNotifs();
      }).subscribe();

    return () => {
      supabase.removeChannel(channel);
      supabase.removeChannel(notifChannel);
    };
  }, [user?.id]);

  const markAsRead = async () => {
    if (unreadCount === 0 || !user) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const toggleNotifications = () => {
    if (!notificationsOpen) markAsRead();
    setNotificationsOpen(!notificationsOpen);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <>
      {/* ─── LEFT SIDEBAR (Desktop only) ─── */}
      <nav className="hidden md:flex fixed top-0 left-0 h-screen w-[72px] bg-[#09090b]/95 backdrop-blur-md border-r border-white/5 flex-col items-center py-5 z-[1000] gap-1">
        {/* Logo */}
        <Link to="/home" className="mb-6 mt-1">
          <img src="/Artlogo.png" alt="AV" className="w-10 h-10 object-contain mix-blend-screen" />
        </Link>

        {/* Nav Items */}
        <NavIcon to="/home" icon={<Home size={22} />} label="Home" active={isActive('/home')} />
        {user && <NavIcon to="/boards" icon={<FolderOpen size={22} />} label="My Boards" active={isActive('/boards')} />}
        {user && (
          <button
            onClick={() => setCreatePanelOpen(true)}
            className={`group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-200 ${createPanelOpen ? 'bg-white/15 text-white' : 'text-zinc-500 hover:bg-white/8 hover:text-white'}`}
          >
            <Plus size={24} />
            <span className="absolute left-[60px] px-3 py-1.5 bg-zinc-800 text-white text-xs font-semibold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity shadow-lg border border-white/5">
              Create
            </span>
          </button>
        )}
        {user && <NavIcon to="/artists" icon={<Users size={22} />} label="Artists" active={isActive('/artists')} />}
        {user && (
          <button
            onClick={toggleNotifications}
            className={`group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-200 ${notificationsOpen ? 'bg-white/15 text-white' : 'text-zinc-500 hover:bg-white/8 hover:text-white'}`}
          >
            <div className="relative">
              <Bell size={22} />
              {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full">{unreadCount}</span>}
            </div>
            <span className="absolute left-[60px] px-3 py-1.5 bg-zinc-800 text-white text-xs font-semibold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity shadow-lg border border-white/5 z-[2000]">
              Notifications
            </span>
          </button>
        )}

        {/* Bottom icons */}
        <div className="mt-auto flex flex-col items-center gap-1 mb-3">
          {user && <NavIcon to="/settings" icon={<Settings size={22} />} label="Settings" active={isActive('/settings')} />}
          {profile?.role === 'admin' && <NavIcon to="/admin_panel" icon={<Shield size={22} />} label="Admin" active={isActive('/admin_panel')} />}
        </div>
      </nav>

      {/* ─── MOBILE BOTTOM TAB BAR ─── */}
      <nav className="md:hidden fixed bottom-0 left-0 w-full h-16 bg-[#09090b]/95 backdrop-blur-md border-t border-white/5 flex items-center justify-around z-[1000] px-2">
        <MobileTab to="/home" icon={<Home size={22} />} label="Home" active={isActive('/home')} />
        {user && <MobileTab to="/boards" icon={<FolderOpen size={22} />} label="Boards" active={isActive('/boards')} />}
        {user && (
          <button
            onClick={() => setCreatePanelOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 text-zinc-500 active:text-white"
          >
            <div className="w-10 h-10 rounded-full bg-gradient-to-r from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-purple-500/30">
              <Plus size={20} />
            </div>
          </button>
        )}
        {user && <MobileTab to="/settings" icon={<Settings size={22} />} label="Settings" active={isActive('/settings')} />}
        {user ? (
          <button onClick={() => setAvatarMenuOpen(!avatarMenuOpen)} className="flex flex-col items-center justify-center gap-0.5 relative">
            <Avatar userId={user.id} name={user.user_metadata?.name || 'U'} size={28} />
          </button>
        ) : (
          <MobileTab to="/login" icon={<User size={22} />} label="Sign In" active={false} />
        )}
      </nav>

      {/* ─── Slide-out Drawer Navigation (hamburger) ─── */}
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
          {user && (
            <>
              <Link to="/boards" className="drawer-item" onClick={() => setDrawerOpen(false)}>
                <FolderOpen className="drawer-icon" /> My Boards
              </Link>
              <Link to={`/profile/${user.id}`} className="drawer-item" onClick={() => setDrawerOpen(false)}>
                <User className="drawer-icon" /> My Public Profile
              </Link>
              <Link to="/settings" className="drawer-item" onClick={() => setDrawerOpen(false)}>
                <Settings className="drawer-icon" /> Studio Dashboard / Settings
              </Link>
            </>
          )}
          {profile?.role === 'admin' && (
            <Link to="/admin_panel" className="drawer-item" onClick={() => setDrawerOpen(false)}>
              <Shield className="drawer-icon" /> Administrator Panel
            </Link>
          )}
          <hr className="drawer-divider" />
          {user ? (
            <button className="drawer-item logout" onClick={handleLogout} style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer' }}>
              <LogOut className="drawer-icon" /> Logout Session
            </button>
          ) : (
            <Link to="/login" className="drawer-item" onClick={() => setDrawerOpen(false)}>
              <LogOut className="drawer-icon" style={{ transform: 'rotate(180deg)' }} /> Sign In / Sign Up
            </Link>
          )}
        </div>
      </div>
      
      {/* Drawer overlay */}
      <div 
        className={`drawer-overlay ${drawerOpen ? 'open' : ''}`} 
        onClick={() => setDrawerOpen(false)}
      ></div>

      {/* ─── TOP NAVBAR ─── */}
      <header className="top-navbar-desktop fixed top-0 left-0 w-full h-16 md:h-20 bg-[#09090b]/90 backdrop-blur-md border-b border-white/10 flex items-center justify-between px-3 md:px-10 z-[999] gap-2">
        <div className="flex items-center gap-1 md:gap-4 shrink-0">
          <button className="waffle-btn p-1 md:p-2 md:hidden" onClick={() => setDrawerOpen(true)}>
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
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
          {/* Mobile logo */}
          <Link to="/home" className="nav-logo flex items-center overflow-visible md:hidden">
            <img src="/Artlogo.png" alt="ArtVault Studio" className="h-[30px] scale-[1.8] origin-left ml-4 mix-blend-screen block" />
          </Link>
        </div>

        <div className="flex-1 flex justify-center px-2 md:px-5">
          <input 
            type="text" 
            className="search-input text-sm md:text-base w-full max-w-[600px] m-0" 
            placeholder="Search artworks..." 
            value={localSearch}
            onChange={handleSearchChange}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div className="nav-actions shrink-0 hidden md:flex">
          {user ? (
            <div style={{ position: 'relative' }}>
              <button className="nav-avatar-btn !w-9 !h-9 md:!w-11 md:!h-11" onClick={() => setAvatarMenuOpen(!avatarMenuOpen)} style={{ padding: 0 }}>
                <Avatar userId={user.id} name={user.user_metadata?.name || 'User'} size={36} />
              </button>
              
              {/* Avatar Dropdown */}
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
          ) : (
            <Link to="/login" className="btn btn-primary whitespace-nowrap !px-3 !py-1.5 md:!px-4 md:!py-2 !text-xs md:!text-sm" style={{ background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)', border: 'none', borderRadius: '8px', color: 'white', fontWeight: 'bold' }}>
               Sign In
            </Link>
          )}
        </div>
      </header>

      {/* ─── MAIN CONTENT (offset for sidebar + top bar) ─── */}
      <div className="main-content-wrapper">
        <Outlet />
      </div>

      {/* ─── CREATE PANEL ─── */}
      {user && (
        <CreatePanel
          isOpen={createPanelOpen}
          onClose={() => setCreatePanelOpen(false)}
          user={user}
          categories={categories}
          onArtworkCreated={() => { /* triggers re-fetch in Dashboard */ window.dispatchEvent(new Event('artwork-created')); }}
          onBoardCreated={() => { window.dispatchEvent(new Event('board-created')); }}
        />
      )}

      {/* Mobile avatar dropdown */}
      {avatarMenuOpen && user && (
        <div className="md:hidden fixed inset-0 z-[1001]" onClick={() => setAvatarMenuOpen(false)}>
          <div className="absolute bottom-20 right-3 w-[240px] bg-[#18181b]/98 border border-white/10 rounded-2xl shadow-xl p-2 flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-4 py-3 border-b border-white/5">
              <p className="text-sm font-bold text-white">{user.user_metadata?.name || 'User'}</p>
              <p className="text-xs text-zinc-500">{user.email}</p>
            </div>
            <Link to={`/profile/${user.id}`} className="dropdown-item" onClick={() => setAvatarMenuOpen(false)}>
              <User size={16} /> My Profile
            </Link>
            <Link to="/settings" className="dropdown-item" onClick={() => setAvatarMenuOpen(false)}>
              <Settings size={16} /> Settings
            </Link>
            <hr className="border-white/5 my-1" />
            <button className="dropdown-item logout" onClick={handleLogout} style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer' }}>
              <LogOut size={16} /> Logout
            </button>
          </div>
        </div>
      )}

      {/* ─── NOTIFICATIONS SLIDE PANEL (Desktop) ─── */}
      <div 
        className={`fixed top-0 h-screen w-[340px] bg-[#09090b] border-r border-white/10 z-[990] transition-transform duration-300 ${notificationsOpen ? 'translate-x-[72px]' : '-translate-x-full'} hidden md:flex flex-col shadow-2xl`}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-2xl font-bold text-white tracking-tight">Updates</h2>
          <button onClick={() => setNotificationsOpen(false)} className="text-zinc-400 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
          <h3 className="text-[13px] font-bold text-zinc-400 uppercase tracking-wider mb-2">Recent Activity</h3>
          {notifications.length === 0 ? (
            <p className="text-zinc-500 text-sm italic text-center mt-10">You have no new notifications.</p>
          ) : (
            notifications.map((n, i) => (
              <div 
                key={i} 
                className={`flex gap-3 p-3 rounded-xl transition-colors cursor-pointer ${n.is_read ? 'hover:bg-white/5' : 'bg-purple-500/10 hover:bg-purple-500/20'}`} 
                onClick={() => {
                  setNotificationsOpen(false);
                  navigate(`/home?search=${encodeURIComponent(n.artworks?.title || '')}`);
                }}
              >
                <div className="mt-1">
                  <Avatar userId={n.actor_id} name={n.profiles?.name || n.profiles?.username || 'U'} size={36} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] text-zinc-200 leading-snug mb-1">
                    <span className="font-semibold text-white">{n.profiles?.name || n.profiles?.username}</span> 
                    {n.type === 'like' ? ' liked your artwork.' : ' commented on your artwork.'}
                  </p>
                  <p className="text-[11px] text-zinc-500 font-medium">
                    {new Date(n.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                {n.artworks?.image_url && (
                  <img src={n.artworks.image_url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-white/10" />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Sidebar Icon Component ─── */
function NavIcon({ to, icon, label, active }: { to: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      className={`group relative flex items-center justify-center w-12 h-12 rounded-2xl transition-all duration-200 ${active ? 'bg-white/15 text-white' : 'text-zinc-500 hover:bg-white/8 hover:text-white'}`}
    >
      {icon}
      <span className="absolute left-[60px] px-3 py-1.5 bg-zinc-800 text-white text-xs font-semibold rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap transition-opacity shadow-lg border border-white/5">
        {label}
      </span>
    </Link>
  );
}

/* ─── Mobile Tab Component ─── */
function MobileTab({ to, icon, label, active }: { to: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link to={to} className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${active ? 'text-white' : 'text-zinc-500'}`}>
      {icon}
      <span>{label}</span>
    </Link>
  );
}
