import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { supabase } from './supabaseClient';
import { LogOut, User, Settings, Shield, X } from 'lucide-react';
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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [localSearch, setLocalSearch] = useState(searchParams.get('search') || '');

  const searchValue = searchParams.get('search') || '';

  useEffect(() => {
    setLocalSearch(searchValue);
  }, [searchValue]);

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

  // Cached categories — shared with Dashboard, fetched once across navigation
  const { data: cachedCategories } = useCachedQuery<any[]>(
    'categories',
    async () => {
      const { data } = await supabase.from('categories').select('*').order('name');
      return data || [];
    },
    { ttl: 10 * 60 * 1000 } // 10 min
  );
  const categories = cachedCategories || [];

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <>

      {/* ─── TOP NAVBAR ─── */}
      <header className="top-navbar-desktop fixed top-0 left-0 w-full h-16 md:h-20 flex items-center justify-between px-3 md:px-10 z-[999] gap-2" style={{ background: 'rgba(245,240,232,0.95)', backdropFilter: 'blur(16px)', borderBottom: '1px solid #d6cfc3' }}>
        <div className="flex items-center gap-1 md:gap-4 shrink-0">
          {/* Mobile logo */}
          <Link to="/home" className="nav-logo flex items-center overflow-visible md:hidden">
            <img src="/Artlogo.png" alt="ArtVault Studio" className="h-[30px] scale-[1.8] origin-left ml-4 filter brightness-0 block" />
          </Link>
        </div>

        <div className="flex-1 flex justify-center px-2 md:px-5">
          <div className="hidden md:flex items-center gap-10">
            <Link to="/home" className="text-[12px] font-bold text-[#1c1917] tracking-[2px] uppercase hover:text-[#b8975a] transition-colors">Discover</Link>
            <Link to="/artists" className="text-[12px] font-bold text-[#78716c] tracking-[2px] uppercase hover:text-[#1c1917] transition-colors">Artists</Link>
            <Link to="/home" className="text-[12px] font-bold text-[#78716c] tracking-[2px] uppercase hover:text-[#1c1917] transition-colors">Registry</Link>
            <Link to="/about" className="text-[12px] font-bold text-[#78716c] tracking-[2px] uppercase hover:text-[#1c1917] transition-colors">About</Link>
          </div>
        </div>

        <div className="nav-actions shrink-0 hidden md:flex items-center">
          {user ? (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* Submit Artwork — hidden for admin/moderator staff accounts */}
              {canUpload(profile?.role) && (
                <button 
                  onClick={() => setCreatePanelOpen(true)}
                  className="btn btn-primary whitespace-nowrap !px-3 !py-1.5 md:!px-4 md:!py-2 !text-xs md:!text-sm" 
                  style={{ background: '#b8975a', border: 'none', borderRadius: '4px', color: '#1c1917', fontWeight: '700', letterSpacing: '1px', textTransform: 'uppercase' }}
                >
                  Submit Artwork
                </button>
              )}
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
                {/* Admin/Moderator Panel Links — only shown to respective roles */}
                {canAccessAdmin(profile?.role) && (
                  <Link to="/admin_panel" className="dropdown-item" onClick={() => { setAvatarMenuOpen(false); }}>
                     <Shield size={16} /> Administrator Panel
                  </Link>
                )}
                {profile?.role === 'moderator' && (
                  <Link to="/moderation" className="dropdown-item" onClick={() => { setAvatarMenuOpen(false); }}>
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
            <Link to="/login" className="btn btn-primary whitespace-nowrap !px-3 !py-1.5 md:!px-4 md:!py-2 !text-xs md:!text-sm" style={{ background: '#1c1917', border: '1px solid #1c1917', borderRadius: '4px', color: '#f5f0e8', fontWeight: '600', letterSpacing: '1px', textTransform: 'uppercase' }}>
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
        className={`fixed top-0 h-screen w-[340px] z-[990] transition-transform duration-300 ${notificationsOpen ? 'translate-x-[72px]' : '-translate-x-full'} hidden md:flex flex-col`}
        style={{ background: '#fdfaf5', borderRight: '1px solid #d6cfc3', boxShadow: '6px 0 24px rgba(28,25,23,0.1)' }}
      >
        <div className="flex items-center justify-between p-5" style={{ borderBottom: '1px solid #d6cfc3' }}>
          <div>
            <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 600, color: '#1c1917' }}>Updates</h2>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, letterSpacing: '2px', textTransform: 'uppercase', color: '#78716c', marginTop: 2 }}>Recent Activity</p>
          </div>
          <button onClick={() => setNotificationsOpen(false)} style={{ background: 'none', border: 'none', color: '#78716c', cursor: 'pointer', padding: 6, borderRadius: 4, transition: 'color 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#1c1917')}
            onMouseLeave={e => (e.currentTarget.style.color = '#78716c')}
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 custom-scrollbar">
          {notifications.length === 0 ? (
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#78716c', fontStyle: 'italic', textAlign: 'center', marginTop: 40 }}>No new updates.</p>
          ) : (
            notifications.map((n, i) => (
              <div 
                key={i} 
                className="flex gap-3 p-3 cursor-pointer transition-colors"
                style={{ borderRadius: 8, background: n.is_read ? 'transparent' : 'rgba(184,151,90,0.08)', borderBottom: '1px solid #ede7d9' }}
                onClick={() => { setNotificationsOpen(false); navigate(`/home?search=${encodeURIComponent(n.artworks?.title || '')}`); }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(28,25,23,0.04)')}
                onMouseLeave={e => (e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(184,151,90,0.08)')}
              >
                <div className="mt-1">
                  <Avatar userId={n.actor_id} name={n.profiles?.name || n.profiles?.username || 'U'} size={34} />
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#44403c', lineHeight: 1.5, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600, color: '#1c1917' }}>{n.profiles?.name || n.profiles?.username}</span>{' '}
                    {n.type === 'like' ? 'acknowledged your work.' : 'added a note to your work.'}
                  </p>
                  <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#78716c', letterSpacing: '0.5px' }}>
                    {new Date(n.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </p>
                </div>
                {n.artworks?.image_url && (
                  <img src={n.artworks.image_url} alt="" style={{ width: 52, height: 52, borderRadius: 4, objectFit: 'cover', flexShrink: 0, border: '1px solid #d6cfc3' }} />
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}


