import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import { logAudit } from './auditHelper';
import { ROLES, type ArtVaultRole, canAccessAdmin } from './roles';
import './AdminPanel.css';

// ─── Types ────────────────────────────────────────────────────────
type Tab = 'dashboard' | 'users' | 'registry' | 'reports' | 'logs';

const emptyArtworkForm = {
  title: '',
  artist_name: '',
  creation_year: '',
  material_used: '',
  art_style: '',
  dimensions: '',
  collector_or_pricing: '',
  price: '',
  tags: '',
  category_ids: [] as string[],
  description: '',
  image_url: '',
};

// ─── Role Badge ───────────────────────────────────────────────────
function RoleBadge({ role }: { role: string }) {
  const def = ROLES[role as ArtVaultRole] || ROLES.user;
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: 700,
      letterSpacing: '0.5px',
      background: def.bg,
      color: def.color,
      border: `1px solid ${def.border}`,
      fontFamily: "'Inter', sans-serif",
    }}>
      {def.label}
    </span>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    active:    { label: 'Active',    color: '#166534', bg: 'rgba(22,101,52,0.1)' },
    suspended: { label: 'Suspended', color: '#92400e', bg: 'rgba(146,64,14,0.1)' },
    banned:    { label: 'Banned',    color: '#991b1b', bg: 'rgba(153,27,27,0.1)' },
  };
  const s = map[status] || map.active;
  return (
    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, background: s.bg, color: s.color, fontFamily: "'Inter', sans-serif" }}>
      {s.label}
    </span>
  );
}

// ─── Confirm Modal ────────────────────────────────────────────────
function ConfirmModal({ title, message, danger = false, onConfirm, onCancel, children }: {
  title: string; message?: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void; children?: React.ReactNode;
}) {
  return (
    <div className="ap-modal-overlay" onClick={onCancel}>
      <div className="ap-modal" onClick={e => e.stopPropagation()}>
        <div className="ap-modal-header">
          <h3 style={{ margin: 0, color: danger ? '#991b1b' : '#1c1917' }}>{title}</h3>
          <button className="ap-modal-close" onClick={onCancel}>✕</button>
        </div>
        <div className="ap-modal-body">
          {message && <p style={{ color: '#57534e', lineHeight: 1.7, marginBottom: 20 }}>{message}</p>}
          {children}
          <div className="ap-modal-actions">
            <button className="ap-btn ap-btn-ghost" onClick={onCancel}>Cancel</button>
            <button className={`ap-btn ${danger ? 'ap-btn-danger' : 'ap-btn-primary'}`} onClick={onConfirm}>
              {danger ? 'Confirm Action' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────
export default function AdminPanel({ user }: { user: any }) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('dashboard');

  // Data
  const [allUsers, setAllUsers]     = useState<any[]>([]);
  const [allArtworks, setAllArtworks] = useState<any[]>([]);
  const [reports, setReports]       = useState<any[]>([]);
  const [auditLogs, setAuditLogs]   = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // Search/filter
  const [userSearch, setUserSearch]       = useState('');
  const [artworkSearch, setArtworkSearch] = useState('');
  const [reportSearch, setReportSearch]   = useState('');
  const [selectedArtist, setSelectedArtist] = useState<any>(null); // for "edit folder" modal

  // Modals
  const [roleModal, setRoleModal]           = useState<any>(null);
  const [suspendModal, setSuspendModal]     = useState<any>(null);
  const [banModal, setBanModal]             = useState<any>(null);
  const [unbanModal, setUnbanModal]         = useState<any>(null);
  const [deleteUserModal, setDeleteUserModal] = useState<any>(null);
  const [deleteArtworkModal, setDeleteArtworkModal] = useState<any>(null);
  const [editArtworkModal, setEditArtworkModal] = useState<any>(null);
  const [editArtworkForm, setEditArtworkForm] = useState(emptyArtworkForm);
  const [suspendDays, setSuspendDays]       = useState('7');
  const [pendingRole, setPendingRole]       = useState('');

  // Pagination
  const PER_PAGE = 12;
  const [userPage, setUserPage]       = useState(1);
  const [artworkPage, setArtworkPage] = useState(1);
  const [reportPage, setReportPage]   = useState(1);
  const [logPage, setLogPage]         = useState(1);

  // ── Fetch ────────────────────────────────────────────────────────
  useEffect(() => { init(); }, []);

  async function init() {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (data) {
      setProfile(data);
      if (canAccessAdmin(data.role)) {
        await Promise.all([fetchUsers(), fetchArtworks(), fetchReports(), fetchLogs(), fetchCategories()]);
      }
    }
    setLoading(false);
  }

  async function fetchUsers() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) setAllUsers(data);
  }

  async function fetchArtworks() {
    const { data } = await supabase
      .from('artworks')
      .select('*, profiles(id, name, username, role), artwork_categories(category_id, categories(id, name, slug))')
      .order('created_at', { ascending: false });
    if (data) setAllArtworks(data);
  }

  async function fetchCategories() {
    const { data } = await supabase.from('categories').select('id, name, slug').order('name');
    if (data) setCategories(data);
  }

  async function fetchReports() {
    try {
      const { data } = await supabase.from('reports').select('*, artworks(*, profiles(name, username))').order('created_at', { ascending: false });
      if (data) {
        const reporterIds = [...new Set(data.map((r: any) => r.reporter_id).filter(Boolean))];
        if (reporterIds.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, username, name').in('id', reporterIds);
          if (profiles) {
            const pm = Object.fromEntries(profiles.map((p: any) => [p.id, p]));
            setReports(data.map((r: any) => ({ ...r, reporter: pm[r.reporter_id] || null })));
            return;
          }
        }
        setReports(data);
      }
    } catch { /* table may not exist */ }
  }

  async function fetchLogs() {
    try {
      const { data } = await supabase.from('audit_logs').select('*, profiles(username)').order('created_at', { ascending: false }).limit(200);
      if (data) setAuditLogs(data);
    } catch { /* table may not exist */ }
  }

  // ── Stats ────────────────────────────────────────────────────────
  const stats = {
    totalUsers:    allUsers.length,
    totalArtworks: allArtworks.length,
    pendingReports: reports.filter(r => r.status === 'pending').length,
    restricted:    allUsers.filter(u => u.status === 'banned' || u.status === 'suspended').length,
    admins:        allUsers.filter(u => u.role === 'admin').length,
    artists:       allUsers.filter(u => u.role === 'artist' || u.role === 'curator').length,
  };

  // ── Filtered data ─────────────────────────────────────────────────
  const filteredUsers = allUsers.filter(u => {
    const q = userSearch.toLowerCase();
    return !q || u.name?.toLowerCase().includes(q) || u.username?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  const filteredArtworks = allArtworks.filter(a => {
    const q = artworkSearch.toLowerCase();
    if (selectedArtist) return a.profiles?.id === selectedArtist.id;
    return !q || a.title?.toLowerCase().includes(q) || a.profiles?.username?.toLowerCase().includes(q);
  });

  const filteredReports = reports.filter(r => {
    const q = reportSearch.toLowerCase();
    return !q || r.artworks?.title?.toLowerCase().includes(q) || r.reason?.toLowerCase().includes(q) || r.reporter?.username?.toLowerCase().includes(q);
  });

  const isProtectedAccount = (target: any) => target?.id === user.id || target?.role === 'admin';

  // ── Actions ───────────────────────────────────────────────────────
  const handleChangeRole = async () => {
    if (!roleModal || !pendingRole) return;
    if (roleModal.id === user.id) { toast.error("Cannot change your own role."); return; }
    if (roleModal.role === 'admin') { toast.error('Administrator accounts are protected from role changes.'); return; }
    if (!ROLES[pendingRole as ArtVaultRole]) { toast.error('Invalid role selected.'); return; }
    const { error } = await supabase.from('profiles').update({ role: pendingRole }).eq('id', roleModal.id);
    if (error) { toast.error(error.message); return; }
    setAllUsers(prev => prev.map(u => u.id === roleModal.id ? { ...u, role: pendingRole } : u));
    logAudit('Role Changed', `Changed @${roleModal.username} role to ${pendingRole}.`);
    toast.success(`Role updated to ${ROLES[pendingRole as ArtVaultRole]?.label || pendingRole}.`);
    setRoleModal(null);
  };

  const handleSuspend = async () => {
    if (!suspendModal) return;
    if (isProtectedAccount(suspendModal)) { toast.error('Administrator accounts are protected from suspension.'); return; }
    const days = parseInt(suspendDays);
    const end = new Date(); end.setDate(end.getDate() + days);
    const { error } = await supabase.from('profiles').update({ status: 'suspended', suspension_end: end.toISOString() }).eq('id', suspendModal.id);
    if (error) { toast.error(error.message); return; }
    setAllUsers(prev => prev.map(u => u.id === suspendModal.id ? { ...u, status: 'suspended', suspension_end: end.toISOString() } : u));
    logAudit('User Suspended', `Suspended @${suspendModal.username} for ${days} days.`);
    toast.success(`@${suspendModal.username} suspended for ${days} days.`);
    setSuspendModal(null);
  };

  const handleBan = async () => {
    if (!banModal) return;
    if (isProtectedAccount(banModal)) { toast.error('Administrator accounts are protected from bans.'); return; }
    const { error } = await supabase.from('profiles').update({ status: 'banned', suspension_end: null }).eq('id', banModal.id);
    if (error) { toast.error(error.message); return; }
    setAllUsers(prev => prev.map(u => u.id === banModal.id ? { ...u, status: 'banned' } : u));
    logAudit('User Banned', `Permanently banned @${banModal.username}.`);
    toast.success(`@${banModal.username} permanently banned.`);
    setBanModal(null);
  };

  const handleUnban = async () => {
    if (!unbanModal) return;
    const { error } = await supabase.from('profiles').update({ status: 'active', suspension_end: null }).eq('id', unbanModal.id);
    if (error) { toast.error(error.message); return; }
    setAllUsers(prev => prev.map(u => u.id === unbanModal.id ? { ...u, status: 'active' } : u));
    toast.success(`@${unbanModal.username} access restored.`);
    setUnbanModal(null);
  };

  const handleDeleteUser = async () => {
    if (!deleteUserModal) return;
    if (isProtectedAccount(deleteUserModal)) { toast.error('Administrator accounts are protected from deletion.'); return; }
    const { error } = await supabase.from('profiles').delete().eq('id', deleteUserModal.id);
    if (error) { toast.error(error.message); return; }
    setAllUsers(prev => prev.filter(u => u.id !== deleteUserModal.id));
    logAudit('User Deleted', `Deleted @${deleteUserModal.username}.`);
    toast.success('User account deleted.');
    setDeleteUserModal(null);
  };

  const handleDeleteArtwork = async () => {
    if (!deleteArtworkModal) return;
    const url = deleteArtworkModal.image_url;
    if (url) {
      const path = url.split('/artworks/')?.[1];
      if (path) await supabase.storage.from('artworks').remove([path]);
    }
    const { error } = await supabase.from('artworks').delete().eq('id', deleteArtworkModal.id);
    if (error) { toast.error(error.message); return; }
    setAllArtworks(prev => prev.filter(a => a.id !== deleteArtworkModal.id));
    logAudit('Artwork Deleted', `Admin deleted artwork: ${deleteArtworkModal.title}.`);
    toast.success('Artwork removed from registry.');
    setDeleteArtworkModal(null);
  };

  const handleSaveArtwork = async () => {
    if (!editArtworkModal) return;
    const parsedPrice = editArtworkForm.price.trim() === '' ? null : Number(editArtworkForm.price);
    if (parsedPrice !== null && Number.isNaN(parsedPrice)) {
      toast.error('Valuation must be a valid number.');
      return;
    }

    const updates = {
      title: editArtworkForm.title.trim(),
      artist_name: editArtworkForm.artist_name.trim() || null,
      creation_year: editArtworkForm.creation_year.trim() || null,
      material_used: editArtworkForm.material_used.trim() || null,
      art_style: editArtworkForm.art_style.trim() || null,
      dimensions: editArtworkForm.dimensions.trim() || null,
      collector_or_pricing: editArtworkForm.collector_or_pricing.trim() || null,
      price: parsedPrice,
      tags: editArtworkForm.tags
        .split(',')
        .map(tag => tag.trim().replace(/^#/, ''))
        .filter(Boolean),
      description: editArtworkForm.description.trim(),
      image_url: editArtworkForm.image_url.trim() || editArtworkModal.image_url,
    };

    const { error } = await supabase.from('artworks').update(updates).eq('id', editArtworkModal.id);
    if (error) { toast.error(error.message); return; }

    const { error: deleteCategoryError } = await supabase
      .from('artwork_categories')
      .delete()
      .eq('artwork_id', editArtworkModal.id);
    if (deleteCategoryError) { toast.error(deleteCategoryError.message); return; }

    if (editArtworkForm.category_ids.length > 0) {
      const { error: insertCategoryError } = await supabase.from('artwork_categories').insert(
        editArtworkForm.category_ids.map(categoryId => ({
          artwork_id: editArtworkModal.id,
          category_id: categoryId,
        }))
      );
      if (insertCategoryError) { toast.error(insertCategoryError.message); return; }
    }

    const artworkCategories = editArtworkForm.category_ids.map(categoryId => ({
      category_id: categoryId,
      categories: categories.find(category => category.id === categoryId) || null,
    }));

    setAllArtworks(prev => prev.map(a => a.id === editArtworkModal.id ? { ...a, ...updates, artwork_categories: artworkCategories } : a));
    logAudit('Artwork Edited', `Admin edited full artwork record: ${updates.title}.`);
    toast.success('Artwork record updated.');
    setEditArtworkModal(null);
  };

  const handleDismissReport = async (id: string) => {
    await supabase.from('reports').update({ status: 'dismissed', reviewed_by: profile.id }).eq('id', id);
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'dismissed' } : r));
    logAudit('Report Dismissed', `Dismissed report ${id}.`);
    toast.success('Report dismissed.');
  };

  const handleTakedown = async (report: any) => {
    if (report.artwork_id) {
      const url = report.artworks?.image_url;
      if (url) { const p = url.split('/artworks/')?.[1]; if (p) await supabase.storage.from('artworks').remove([p]); }
      await supabase.from('artworks').delete().eq('id', report.artwork_id);
      setAllArtworks(prev => prev.filter(a => a.id !== report.artwork_id));
    }
    await supabase.from('reports').update({ status: 'resolved', reviewed_by: profile.id }).eq('id', report.id);
    setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: 'resolved' } : r));
    logAudit('Artwork Takedown', `Enforced takedown for reported artwork.`);
    toast.success('Artwork removed and report resolved.');
  };

  // ── Pagination helper ──────────────────────────────────────────────
  function Pagination({ page, setPage, total }: { page: number; setPage: (p: number) => void; total: number }) {
    const pages = Math.ceil(total / PER_PAGE);
    if (pages <= 1) return null;
    return (
      <div className="ap-pagination">
        <button className="ap-page-btn" disabled={page === 1} onClick={() => setPage(page - 1)}>←</button>
        <span className="ap-page-info">{page} / {pages}</span>
        <button className="ap-page-btn" disabled={page === pages} onClick={() => setPage(page + 1)}>→</button>
      </div>
    );
  }

  // ── Guards ─────────────────────────────────────────────────────────
  if (loading) return (
    <div className="ap-loading">
      <div className="ap-loading-spinner" />
      <p>Loading Admin Panel…</p>
    </div>
  );

  if (!profile || !canAccessAdmin(profile.role)) return (
    <div className="ap-unauthorized">
      <div className="ap-unauth-icon">⛔</div>
      <h2>Unauthorized Access</h2>
      <p>You do not have permission to access the Administrator Panel.</p>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────
  return (
    <div className="ap-root">

      {/* Sidebar */}
      <aside className="ap-sidebar">
        <div className="ap-sidebar-brand">
          <span className="ap-sidebar-label">ADMIN GATEWAY</span>
        </div>
        {([
          { id: 'dashboard', icon: '◈', label: 'Dashboard',     badge: undefined as number | undefined },
          { id: 'users',     icon: '◉', label: 'Users & Roles',  badge: undefined as number | undefined },
          { id: 'registry',  icon: '⊞', label: 'Art Registry',   badge: undefined as number | undefined },
          { id: 'reports',   icon: '⚑', label: 'Reports',        badge: stats.pendingReports as number | undefined },
          { id: 'logs',      icon: '≡', label: 'Audit Logs',     badge: undefined as number | undefined },
        ] as const).map(item => (
          <button
            key={item.id}
            className={`ap-nav-item ${tab === item.id ? 'active' : ''}`}
            onClick={() => { setTab(item.id); if (item.id === 'logs') fetchLogs(); }}
          >
            <span className="ap-nav-icon">{item.icon}</span>
            <span className="ap-nav-label">{item.label}</span>
            {item.badge ? <span className="ap-nav-badge">{item.badge}</span> : null}
          </button>
        ))}
      </aside>

      {/* Main */}
      <main className="ap-main">

        {/* ── DASHBOARD ── */}
        {tab === 'dashboard' && (
          <div className="ap-content">
            <div className="ap-page-header">
              <h1 className="ap-page-title">Platform Overview</h1>
              <p className="ap-page-sub">Real-time statistics and activity for Art Vault</p>
            </div>

            <div className="ap-stat-grid">
              {[
                { label: 'Total Users',       value: stats.totalUsers,     icon: '◉', color: '#1c1917' },
                { label: 'Registered Works',  value: stats.totalArtworks,  icon: '⊞', color: '#b8975a' },
                { label: 'Active Artists',    value: stats.artists,        icon: '◈', color: '#0f766e' },
                { label: 'Pending Reports',   value: stats.pendingReports, icon: '⚑', color: stats.pendingReports > 0 ? '#991b1b' : '#78716c' },
                { label: 'Admin Staff',       value: stats.admins,         icon: '⊛', color: '#92400e' },
                { label: 'Restricted Accts',  value: stats.restricted,     icon: '⊘', color: '#b91c1c' },
              ].map((s, i) => (
                <div key={i} className="ap-stat-card">
                  <div className="ap-stat-icon" style={{ color: s.color }}>{s.icon}</div>
                  <div className="ap-stat-value" style={{ color: s.color }}>{s.value}</div>
                  <div className="ap-stat-label">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="ap-two-col">
              <div className="ap-card">
                <h3 className="ap-card-title">Recent Activity</h3>
                {auditLogs.length === 0 ? (
                  <p className="ap-empty">No audit logs yet.</p>
                ) : auditLogs.slice(0, 8).map(log => (
                  <div key={log.id} className="ap-log-row">
                    <div>
                      <div className="ap-log-action">{log.action}</div>
                      <div className="ap-log-detail">{log.details}</div>
                    </div>
                    <div className="ap-log-meta">
                      <div>{log.profiles ? `@${log.profiles.username}` : 'System'}</div>
                      <div>{new Date(log.created_at).toLocaleTimeString()}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="ap-card">
                <h3 className="ap-card-title">Role Distribution</h3>
                {(['admin','moderator','curator','artist','user'] as ArtVaultRole[]).map(r => {
                  const count = allUsers.filter(u => u.role === r).length;
                  const pct = stats.totalUsers ? Math.round((count / stats.totalUsers) * 100) : 0;
                  return (
                    <div key={r} className="ap-role-row">
                      <div className="ap-role-row-left">
                        <RoleBadge role={r} />
                        <span className="ap-role-count">{count}</span>
                      </div>
                      <div className="ap-role-bar-wrap">
                        <div className="ap-role-bar" style={{ width: `${pct}%`, background: ROLES[r].color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── USERS & ROLES ── */}
        {tab === 'users' && (
          <div className="ap-content">
            <div className="ap-page-header">
              <h1 className="ap-page-title">Users & Roles</h1>
              <p className="ap-page-sub">Manage accounts, assign roles, and enforce restrictions</p>
            </div>
            <div className="ap-card">
              <div className="ap-toolbar">
                <input className="ap-search" placeholder="Search by name, username or email…" value={userSearch} onChange={e => { setUserSearch(e.target.value); setUserPage(1); }} />
                <span className="ap-count">{filteredUsers.length} accounts</span>
              </div>
              <div className="ap-table-wrap">
                <table className="ap-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Joined</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.slice((userPage-1)*PER_PAGE, userPage*PER_PAGE).map(u => {
                      const protectedAccount = isProtectedAccount(u);
                      return (
                      <tr key={u.id}>
                        <td>
                          <div className="ap-user-cell">
                            <div>
                              <div className="ap-user-name">{u.name || '—'}</div>
                              <div className="ap-user-sub">@{u.username}</div>
                              <div className="ap-user-email">{u.email}</div>
                            </div>
                          </div>
                        </td>
                        <td><RoleBadge role={u.role} /></td>
                        <td><StatusBadge status={u.status || 'active'} /></td>
                        <td className="ap-date">{new Date(u.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className="ap-action-group">
                            {/* Change Role */}
                            <button className="ap-btn ap-btn-sm ap-btn-ghost"
                              disabled={protectedAccount}
                              onClick={() => { setRoleModal(u); setPendingRole(u.role || 'user'); }}
                            >Change Role</button>

                            {/* View Folder */}
                            <button className="ap-btn ap-btn-sm ap-btn-ghost"
                              onClick={() => { setSelectedArtist(u); setArtworkSearch(''); setTab('registry'); }}
                            >View Folder</button>

                            {/* Suspend / Unban */}
                            {u.status === 'banned' || u.status === 'suspended' ? (
                              <button className="ap-btn ap-btn-sm ap-btn-ghost" disabled={protectedAccount} onClick={() => setUnbanModal(u)}>Restore</button>
                            ) : (
                              <>
                                <button className="ap-btn ap-btn-sm ap-btn-ghost" disabled={protectedAccount} onClick={() => { setSuspendModal(u); setSuspendDays('7'); }}>Suspend</button>
                                <button className="ap-btn ap-btn-sm ap-btn-danger" disabled={protectedAccount} onClick={() => setBanModal(u)}>Ban</button>
                              </>
                            )}
                            <button className="ap-btn ap-btn-sm ap-btn-danger" disabled={protectedAccount} onClick={() => setDeleteUserModal(u)}>Delete</button>
                          </div>
                        </td>
                      </tr>
                    );})}
                  </tbody>
                </table>
              </div>
              <Pagination page={userPage} setPage={setUserPage} total={filteredUsers.length} />
            </div>
          </div>
        )}

        {/* ── REGISTRY ── */}
        {tab === 'registry' && (
          <div className="ap-content">
            <div className="ap-page-header">
              <div>
                <h1 className="ap-page-title">
                  {selectedArtist ? `${selectedArtist.name || selectedArtist.username}'s Folder` : 'Art Registry'}
                </h1>
                <p className="ap-page-sub">
                  {selectedArtist ? `Viewing and editing artwork folder for @${selectedArtist.username}` : 'All registered artworks — edit metadata or remove entries'}
                </p>
              </div>
              {selectedArtist && (
                <button className="ap-btn ap-btn-ghost" onClick={() => setSelectedArtist(null)}>← All Artworks</button>
              )}
            </div>
            <div className="ap-card">
              <div className="ap-toolbar">
                <input className="ap-search" placeholder={selectedArtist ? 'Search in this folder…' : 'Search artwork or artist…'} value={artworkSearch} onChange={e => { setArtworkSearch(e.target.value); setArtworkPage(1); }} />
                <span className="ap-count">{filteredArtworks.length} works</span>
              </div>
              <div className="ap-artwork-grid">
                {filteredArtworks.slice((artworkPage-1)*PER_PAGE, artworkPage*PER_PAGE).map(a => (
                  <div key={a.id} className="ap-artwork-card">
                    <img src={a.image_url} alt={a.title} className="ap-artwork-img" />
                    <div className="ap-artwork-body">
                      <div className="ap-artwork-title">{a.title}</div>
                      <div className="ap-artwork-artist">
                        {a.artist_name || 'Unknown original creator'} · registered by @{a.profiles?.username || '—'}
                        {a.profiles?.role && <RoleBadge role={a.profiles.role} />}
                      </div>
                      <div className="ap-artwork-meta">
                        {a.creation_year && <span>{a.creation_year}</span>}
                        {a.artwork_categories?.map((entry: any) => entry.categories?.name).filter(Boolean).map((name: string) => <span key={name}>{name}</span>)}
                        {a.material_used && <span>{a.material_used}</span>}
                        {a.art_style && <span>{a.art_style}</span>}
                        {a.dimensions && <span>{a.dimensions}</span>}
                        {a.price != null && <span>${Number(a.price).toLocaleString()}</span>}
                        {a.collector_or_pricing && <span>{a.collector_or_pricing}</span>}
                      </div>
                      {a.description && <div className="ap-artwork-desc">{a.description}</div>}
                    </div>
                    <div className="ap-artwork-actions">
                      <button className="ap-btn ap-btn-sm ap-btn-ghost" onClick={() => {
                        setEditArtworkModal(a);
                        setEditArtworkForm({
                          title: a.title || '',
                          artist_name: a.artist_name || '',
                          creation_year: a.creation_year || '',
                          material_used: a.material_used || '',
                          art_style: a.art_style || '',
                          dimensions: a.dimensions || '',
                          collector_or_pricing: a.collector_or_pricing || '',
                          price: a.price != null ? String(a.price) : '',
                          tags: Array.isArray(a.tags) ? a.tags.join(', ') : '',
                          category_ids: Array.isArray(a.artwork_categories) ? a.artwork_categories.map((entry: any) => entry.category_id).filter(Boolean) : [],
                          description: a.description || '',
                          image_url: a.image_url || '',
                        });
                      }}>Edit</button>
                      <button className="ap-btn ap-btn-sm ap-btn-danger" onClick={() => setDeleteArtworkModal(a)}>Remove</button>
                    </div>
                  </div>
                ))}
                {filteredArtworks.length === 0 && <p className="ap-empty">No artworks found.</p>}
              </div>
              <Pagination page={artworkPage} setPage={setArtworkPage} total={filteredArtworks.length} />
            </div>
          </div>
        )}

        {/* ── REPORTS ── */}
        {tab === 'reports' && (
          <div className="ap-content">
            <div className="ap-page-header">
              <h1 className="ap-page-title">Reports & Tickets</h1>
              <p className="ap-page-sub">Review and action moderation reports submitted by users</p>
            </div>
            <div className="ap-card">
              <div className="ap-toolbar">
                <input className="ap-search" placeholder="Search reports…" value={reportSearch} onChange={e => { setReportSearch(e.target.value); setReportPage(1); }} />
                <button className="ap-btn ap-btn-ghost ap-btn-sm" onClick={fetchReports}>↻ Refresh</button>
              </div>
              <div className="ap-table-wrap">
                <table className="ap-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Artwork</th>
                      <th>Reason</th>
                      <th>Reporter</th>
                      <th>Date</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReports.slice((reportPage-1)*PER_PAGE, reportPage*PER_PAGE).map(r => (
                      <tr key={r.id}>
                        <td>
                          <span className={`ap-report-status ${r.status}`}>{r.status.toUpperCase()}</span>
                        </td>
                        <td>
                          {r.artworks ? (
                            <div className="ap-report-artwork">
                              <img src={r.artworks.image_url} alt="" className="ap-report-thumb" />
                              <div>
                                <div className="ap-user-name">{r.artworks.title}</div>
                                <div className="ap-user-sub">@{r.artworks.profiles?.username}</div>
                              </div>
                            </div>
                          ) : <span className="ap-empty-inline">Deleted</span>}
                        </td>
                        <td className="ap-report-reason">{r.reason}</td>
                        <td className="ap-date">@{r.reporter?.username || '—'}</td>
                        <td className="ap-date">{new Date(r.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className="ap-action-group">
                            {r.status === 'pending' && (
                              <>
                                <button className="ap-btn ap-btn-sm ap-btn-danger" onClick={() => handleTakedown(r)}>Take Down</button>
                                <button className="ap-btn ap-btn-sm ap-btn-ghost" onClick={() => handleDismissReport(r.id)}>Dismiss</button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredReports.length === 0 && <p className="ap-empty" style={{ padding: '32px' }}>No reports found.</p>}
              </div>
              <Pagination page={reportPage} setPage={setReportPage} total={filteredReports.length} />
            </div>
          </div>
        )}

        {/* ── AUDIT LOGS ── */}
        {tab === 'logs' && (
          <div className="ap-content">
            <div className="ap-page-header">
              <h1 className="ap-page-title">Audit Logs</h1>
              <p className="ap-page-sub">Chronological record of all administrative actions</p>
            </div>
            <div className="ap-card">
              <div className="ap-toolbar">
                <span className="ap-count">{auditLogs.length} events</span>
                <button className="ap-btn ap-btn-ghost ap-btn-sm" onClick={fetchLogs}>↻ Refresh</button>
              </div>
              <div className="ap-table-wrap">
                <table className="ap-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>Actor</th>
                      <th>Action</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.slice((logPage-1)*PER_PAGE, logPage*PER_PAGE).map(log => (
                      <tr key={log.id}>
                        <td className="ap-date">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="ap-user-sub">{log.profiles ? `@${log.profiles.username}` : 'System'}</td>
                        <td><span className="ap-log-action-badge">{log.action}</span></td>
                        <td className="ap-date">{log.details}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {auditLogs.length === 0 && <p className="ap-empty" style={{ padding: '32px' }}>No audit logs available. Ensure the audit_logs table exists in Supabase.</p>}
              </div>
              <Pagination page={logPage} setPage={setLogPage} total={auditLogs.length} />
            </div>
          </div>
        )}

      </main>

      {/* ── MODALS ── */}

      {/* Change Role */}
      {roleModal && (
        <ConfirmModal title="Change User Role" onConfirm={handleChangeRole} onCancel={() => setRoleModal(null)}>
          <p style={{ color: '#57534e', marginBottom: 16 }}>Changing role for <strong>@{roleModal.username}</strong>:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {(['admin','moderator','curator','artist','user'] as ArtVaultRole[]).map(r => (
              <label key={r} className={`ap-role-option ${pendingRole === r ? 'selected' : ''}`} onClick={() => setPendingRole(r)}>
                <input type="radio" checked={pendingRole === r} onChange={() => setPendingRole(r)} style={{ display: 'none' }} />
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <RoleBadge role={r} />
                  <span style={{ fontSize: 12, color: '#78716c', maxWidth: 240, textAlign: 'right' }}>{ROLES[r].description}</span>
                </div>
              </label>
            ))}
          </div>
        </ConfirmModal>
      )}

      {/* Suspend */}
      {suspendModal && (
        <ConfirmModal title="Suspend Account" danger onConfirm={handleSuspend} onCancel={() => setSuspendModal(null)}
          message={`Suspend @${suspendModal.username}. They will be unable to log in until the suspension expires.`}>
          <label className="ap-form-label">Duration</label>
          <select className="ap-select" value={suspendDays} onChange={e => setSuspendDays(e.target.value)}>
            <option value="1">1 Day</option>
            <option value="3">3 Days</option>
            <option value="7">1 Week</option>
            <option value="14">2 Weeks</option>
            <option value="30">1 Month</option>
          </select>
        </ConfirmModal>
      )}

      {/* Ban */}
      {banModal && (
        <ConfirmModal title="Permanently Ban Account" danger
          message={`You are about to permanently ban @${banModal.username}. Their sessions will be terminated and they will be unable to log in again. This cannot be undone without admin intervention.`}
          onConfirm={handleBan} onCancel={() => setBanModal(null)} />
      )}

      {/* Unban */}
      {unbanModal && (
        <ConfirmModal title="Restore Account Access"
          message={`Restore access for @${unbanModal.username}? This will lift their ${unbanModal.status === 'banned' ? 'ban' : 'suspension'} immediately.`}
          onConfirm={handleUnban} onCancel={() => setUnbanModal(null)} />
      )}

      {/* Delete User */}
      {deleteUserModal && (
        <ConfirmModal title="Delete User Account" danger
          message={`Permanently delete @${deleteUserModal.username}? This will irrevocably destroy their profile and all uploaded artworks. This action cannot be undone.`}
          onConfirm={handleDeleteUser} onCancel={() => setDeleteUserModal(null)} />
      )}

      {/* Delete Artwork */}
      {deleteArtworkModal && (
        <ConfirmModal title="Remove Artwork from Registry" danger
          message={`Permanently remove "${deleteArtworkModal.title}" from the registry? This action cannot be undone.`}
          onConfirm={handleDeleteArtwork} onCancel={() => setDeleteArtworkModal(null)} />
      )}

      {/* Edit Artwork */}
      {editArtworkModal && (
        <ConfirmModal title="Edit Artwork Record" onConfirm={handleSaveArtwork} onCancel={() => setEditArtworkModal(null)}>
          <div className="ap-record-form-grid">
            <div>
              <label className="ap-form-label">Title</label>
              <input className="ap-input" value={editArtworkForm.title} onChange={e => setEditArtworkForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="ap-form-label">Original Creator</label>
              <input className="ap-input" value={editArtworkForm.artist_name} onChange={e => setEditArtworkForm(f => ({ ...f, artist_name: e.target.value }))} placeholder="e.g. Vincent van Gogh" />
            </div>
            <div>
              <label className="ap-form-label">Year Created</label>
              <input className="ap-input" value={editArtworkForm.creation_year} onChange={e => setEditArtworkForm(f => ({ ...f, creation_year: e.target.value }))} placeholder="e.g. 1889" />
            </div>
            <div>
              <label className="ap-form-label">Medium</label>
              <select className="ap-select" value={editArtworkForm.material_used} onChange={e => setEditArtworkForm(f => ({ ...f, material_used: e.target.value }))}>
                <option value="">Select medium</option>
                <option value="Oil on canvas">Oil on canvas</option>
                <option value="Acrylic on canvas">Acrylic on canvas</option>
                <option value="Watercolor on paper">Watercolor on paper</option>
                <option value="Charcoal on paper">Charcoal on paper</option>
                <option value="Graphite on paper">Graphite on paper</option>
                <option value="Pastel on paper">Pastel on paper</option>
                <option value="Gouache">Gouache</option>
                <option value="Fresco">Fresco</option>
                <option value="Mixed Media (Traditional)">Mixed Media (Traditional)</option>
              </select>
            </div>
            <div>
              <label className="ap-form-label">Art Style</label>
              <input className="ap-input" value={editArtworkForm.art_style} onChange={e => setEditArtworkForm(f => ({ ...f, art_style: e.target.value }))} placeholder="e.g. Post-Impressionism" />
            </div>
            <div>
              <label className="ap-form-label">Dimensions</label>
              <input className="ap-input" value={editArtworkForm.dimensions} onChange={e => setEditArtworkForm(f => ({ ...f, dimensions: e.target.value }))} placeholder="e.g. 73.7 x 92.1 cm" />
            </div>
            <div>
              <label className="ap-form-label">Status / Collector</label>
              <input className="ap-input" value={editArtworkForm.collector_or_pricing} onChange={e => setEditArtworkForm(f => ({ ...f, collector_or_pricing: e.target.value }))} placeholder="e.g. Institutional Collection" />
            </div>
            <div>
              <label className="ap-form-label">Valuation</label>
              <input className="ap-input" type="number" value={editArtworkForm.price} onChange={e => setEditArtworkForm(f => ({ ...f, price: e.target.value }))} placeholder="e.g. 25000" />
            </div>
            <div className="ap-record-form-wide">
              <label className="ap-form-label">Image URL</label>
              <input className="ap-input" value={editArtworkForm.image_url} onChange={e => setEditArtworkForm(f => ({ ...f, image_url: e.target.value }))} />
            </div>
            <div className="ap-record-form-wide">
              <label className="ap-form-label">Collection Categories</label>
              <div className="ap-category-edit-grid">
                {categories.map(category => (
                  <label key={category.id} className="ap-category-edit-option">
                    <input
                      type="checkbox"
                      checked={editArtworkForm.category_ids.includes(category.id)}
                      onChange={e => setEditArtworkForm(f => ({
                        ...f,
                        category_ids: e.target.checked
                          ? [...f.category_ids, category.id]
                          : f.category_ids.filter(id => id !== category.id),
                      }))}
                    />
                    <span>{category.name}</span>
                  </label>
                ))}
                {categories.length === 0 && (
                  <span className="ap-empty-inline">No categories available.</span>
                )}
              </div>
            </div>
            <div className="ap-record-form-wide">
              <label className="ap-form-label">Tags</label>
              <input className="ap-input" value={editArtworkForm.tags} onChange={e => setEditArtworkForm(f => ({ ...f, tags: e.target.value }))} placeholder="oil-on-canvas, traditional-art, museum-record" />
            </div>
            <div className="ap-record-form-wide">
              <label className="ap-form-label">Description</label>
              <textarea className="ap-input" rows={4} style={{ resize: 'vertical' }} value={editArtworkForm.description} onChange={e => setEditArtworkForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
        </ConfirmModal>
      )}

    </div>
  );
}
