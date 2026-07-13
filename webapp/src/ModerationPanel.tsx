import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import { logAudit } from './auditHelper';
import { canAccessModeration } from './roles';
import './AdminPanel.css';

type Tab = 'registry' | 'reports';

export default function ModerationPanel({ user }: { user: any }) {
  const [profile, setProfile]     = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState<Tab>('reports');

  const [allArtworks, setAllArtworks] = useState<any[]>([]);
  const [reports, setReports]         = useState<any[]>([]);

  const [artworkSearch, setArtworkSearch] = useState('');
  const [reportSearch, setReportSearch]   = useState('');
  const [selectedArtist, setSelectedArtist] = useState<any>(null);

  const [deleteArtworkModal, setDeleteArtworkModal] = useState<any>(null);
  const [editArtworkModal, setEditArtworkModal]     = useState<any>(null);
  const [editForm, setEditForm] = useState({ title: '', description: '', category: '' });

  const PER_PAGE = 12;
  const [artworkPage, setArtworkPage] = useState(1);
  const [reportPage, setReportPage]   = useState(1);

  useEffect(() => { init(); }, []);

  async function init() {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (data) {
      setProfile(data);
      if (canAccessModeration(data.role)) {
        await Promise.all([fetchArtworks(), fetchReports()]);
      }
    }
    setLoading(false);
  }

  async function fetchArtworks() {
    const { data } = await supabase.from('artworks').select('*, profiles(id, name, username, role)').order('created_at', { ascending: false });
    if (data) setAllArtworks(data);
  }

  async function fetchReports() {
    try {
      const { data } = await supabase.from('reports').select('*, artworks(*, profiles(name, username))').order('created_at', { ascending: false });
      if (data) {
        const ids = [...new Set(data.map((r: any) => r.reporter_id).filter(Boolean))];
        if (ids.length > 0) {
          const { data: profiles } = await supabase.from('profiles').select('id, username, name').in('id', ids);
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

  const filteredArtworks = allArtworks.filter(a => {
    if (selectedArtist) return a.profiles?.id === selectedArtist.id;
    const q = artworkSearch.toLowerCase();
    return !q || a.title?.toLowerCase().includes(q) || a.profiles?.username?.toLowerCase().includes(q);
  });

  const filteredReports = reports.filter(r => {
    const q = reportSearch.toLowerCase();
    return !q || r.artworks?.title?.toLowerCase().includes(q) || r.reason?.toLowerCase().includes(q) || r.reporter?.username?.toLowerCase().includes(q);
  });

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
    logAudit('Artwork Removed', `Moderator removed artwork: ${deleteArtworkModal.title}.`);
    toast.success('Artwork removed from registry.');
    setDeleteArtworkModal(null);
  };

  const handleSaveArtwork = async () => {
    if (!editArtworkModal) return;
    const { error } = await supabase.from('artworks').update({
      title: editForm.title,
      description: editForm.description,
      category: editForm.category,
    }).eq('id', editArtworkModal.id);
    if (error) { toast.error(error.message); return; }
    setAllArtworks(prev => prev.map(a => a.id === editArtworkModal.id ? { ...a, ...editForm } : a));
    logAudit('Artwork Edited', `Moderator edited artwork: ${editForm.title}.`);
    toast.success('Artwork updated.');
    setEditArtworkModal(null);
  };

  const handleDismiss = async (id: string) => {
    await supabase.from('reports').update({ status: 'dismissed', reviewed_by: profile.id }).eq('id', id);
    setReports(prev => prev.map(r => r.id === id ? { ...r, status: 'dismissed' } : r));
    logAudit('Report Dismissed', `Moderator dismissed report ${id}.`);
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
    logAudit('Artwork Takedown', 'Moderator enforced takedown for reported artwork.');
    toast.success('Artwork removed and report resolved.');
  };

  function renderPagination(page: number, setPage: (p: number) => void, total: number) {
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

  if (loading) return (
    <div className="ap-loading">
      <div className="ap-loading-spinner" />
      <p>Loading Moderation Panel…</p>
    </div>
  );

  if (!profile || !canAccessModeration(profile.role)) return (
    <div className="ap-unauthorized">
      <div className="ap-unauth-icon">⛔</div>
      <h2>Unauthorized Access</h2>
      <p>You do not have permission to access the Moderation Panel.</p>
    </div>
  );

  const pendingCount = reports.filter(r => r.status === 'pending').length;

  return (
    <div className="ap-root">
      {/* Sidebar */}
      <aside className="ap-sidebar">
        <div className="ap-sidebar-brand">
          <span className="ap-sidebar-label">MODERATION</span>
        </div>
        {([
          { id: 'reports',  icon: '⚑', label: 'Reports & Tickets', badge: pendingCount as number | undefined },
          { id: 'registry', icon: '⊞', label: 'Art Registry',        badge: undefined as number | undefined },
        ] as const).map(item => (
          <button key={item.id} className={`ap-nav-item ${tab === item.id ? 'active' : ''}`}
            onClick={() => setTab(item.id)}>
            <span className="ap-nav-icon">{item.icon}</span>
            <span className="ap-nav-label">{item.label}</span>
            {item.badge ? <span className="ap-nav-badge">{item.badge}</span> : null}
          </button>
        ))}
      </aside>

      {/* Main */}
      <main className="ap-main">

        {/* ── REPORTS ── */}
        {tab === 'reports' && (
          <div className="ap-content">
            <div className="ap-page-header">
              <h1 className="ap-page-title">Reports & Tickets</h1>
              <p className="ap-page-sub">Review and action moderation reports</p>
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
                        <td><span className={`ap-report-status ${r.status}`}>{r.status.toUpperCase()}</span></td>
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
                                <button className="ap-btn ap-btn-sm ap-btn-ghost" onClick={() => handleDismiss(r.id)}>Dismiss</button>
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
              {renderPagination(reportPage, setReportPage, filteredReports.length)}
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
                  {selectedArtist ? `Editing folder for @${selectedArtist.username}` : 'Browse all registered artworks — edit or remove entries'}
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
                      <div className="ap-artwork-artist">by @{a.profiles?.username || '—'}</div>
                      <div className="ap-artwork-meta">
                        {a.category && <span>{a.category}</span>}
                        {a.year && <span>{a.year}</span>}
                      </div>
                      {a.description && <div className="ap-artwork-desc">{a.description}</div>}
                    </div>
                    <div className="ap-artwork-actions">
                      <button className="ap-btn ap-btn-sm ap-btn-ghost" onClick={() => {
                        setEditArtworkModal(a);
                        setEditForm({ title: a.title || '', description: a.description || '', category: a.category || '' });
                      }}>Edit</button>
                      <button className="ap-btn ap-btn-sm ap-btn-danger" onClick={() => setDeleteArtworkModal(a)}>Remove</button>
                    </div>
                  </div>
                ))}
                {filteredArtworks.length === 0 && <p className="ap-empty">No artworks found.</p>}
              </div>
              {renderPagination(artworkPage, setArtworkPage, filteredArtworks.length)}
            </div>
          </div>
        )}
      </main>

      {/* ── MODALS ── */}
      {deleteArtworkModal && (
        <div className="ap-modal-overlay" onClick={() => setDeleteArtworkModal(null)}>
          <div className="ap-modal" onClick={e => e.stopPropagation()}>
            <div className="ap-modal-header">
              <h3 style={{ margin: 0, color: '#991b1b' }}>Remove Artwork</h3>
              <button className="ap-modal-close" onClick={() => setDeleteArtworkModal(null)}>✕</button>
            </div>
            <div className="ap-modal-body">
              <p style={{ color: '#57534e', lineHeight: 1.7 }}>Permanently remove "<strong>{deleteArtworkModal.title}</strong>" from the registry? This cannot be undone.</p>
              <div className="ap-modal-actions">
                <button className="ap-btn ap-btn-ghost" onClick={() => setDeleteArtworkModal(null)}>Cancel</button>
                <button className="ap-btn ap-btn-danger" onClick={handleDeleteArtwork}>Remove</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editArtworkModal && (
        <div className="ap-modal-overlay" onClick={() => setEditArtworkModal(null)}>
          <div className="ap-modal" onClick={e => e.stopPropagation()}>
            <div className="ap-modal-header">
              <h3 style={{ margin: 0 }}>Edit Artwork</h3>
              <button className="ap-modal-close" onClick={() => setEditArtworkModal(null)}>✕</button>
            </div>
            <div className="ap-modal-body">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label className="ap-form-label">Title</label>
                  <input className="ap-input" value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} />
                </div>
                <div>
                  <label className="ap-form-label">Category</label>
                  <input className="ap-input" value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))} />
                </div>
                <div>
                  <label className="ap-form-label">Description</label>
                  <textarea className="ap-input" rows={4} style={{ resize: 'vertical' }} value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} />
                </div>
              </div>
              <div className="ap-modal-actions" style={{ marginTop: 20 }}>
                <button className="ap-btn ap-btn-ghost" onClick={() => setEditArtworkModal(null)}>Cancel</button>
                <button className="ap-btn ap-btn-primary" onClick={handleSaveArtwork}>Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
