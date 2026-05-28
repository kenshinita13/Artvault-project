import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import { Trash2, Users, BarChart3, Edit2, Shield, X, Activity } from 'lucide-react';
import './Dashboard.css';
import { logAudit } from './auditHelper';

export default function AdminPanel({ user }: { user: any }) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allArtworks, setAllArtworks] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [adminSubTab, setAdminSubTab] = useState<'stats' | 'users' | 'artworks' | 'reports' | 'logs'>('stats');

  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', username: '' });

  const [suspendModalUser, setSuspendModalUser] = useState<any>(null);
  const [suspendDays, setSuspendDays] = useState('7');
  
  const [banModalUser, setBanModalUser] = useState<any>(null);
  const [unbanModalUser, setUnbanModalUser] = useState<any>(null);
  const [deleteUserModal, setDeleteUserModal] = useState<any>(null);
  
  const [deleteArtworkModal, setDeleteArtworkModal] = useState<any>(null);
  const [editArtworkDescModal, setEditArtworkDescModal] = useState<any>(null);
  const [editDescForm, setEditDescForm] = useState('');
  
  const [takeDownReportModal, setTakeDownReportModal] = useState<any>(null);
  const [viewReportModal, setViewReportModal] = useState<any>(null);
  const [reportSearchQuery, setReportSearchQuery] = useState('');


  async function fetchProfile() {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (data) {
      setProfile(data);
      if (data.role === 'admin') {
        fetchAllUsers();
        fetchAllArtworks();
        fetchAllReports();
        fetchAuditLogs();
      }
    }
    setLoading(false);
  };

  async function fetchAuditLogs() {
    try {
      const { data } = await supabase.from('audit_logs').select('*, profiles(username)').order('created_at', { ascending: false }).limit(100);
      if (data) setAuditLogs(data);
    } catch {
       console.log('Audit logs table might not exist yet.');
    }
  }

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (profile?.role === 'admin' && adminSubTab === 'reports') {
      interval = setInterval(() => {
        fetchAllReports();
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [profile, adminSubTab]);

  async function fetchAllUsers() {
    const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
    if (data) setAllUsers(data);
  };

  async function fetchAllArtworks() {
    const { data } = await supabase.from('artworks').select(`
      *,
      profiles (name, username)
    `).order('created_at', { ascending: false });
    if (data) setAllArtworks(data);
  };

  async function fetchAllReports() {
    try {
      const { data, error } = await supabase.from('reports').select('*, reporter:profiles!reporter_id(*), artworks(*, profiles(name, username))').order('created_at', { ascending: false });
      
      if (error) {
        console.error('Fetch reports error:', error);
        // Fallback for when the foreign key to profiles is missing or named differently
        const { data: fallbackData, error: fallbackError } = await supabase.from('reports').select('*, artworks(*, profiles(name, username))').order('created_at', { ascending: false });
        
        if (fallbackError) {
           console.error('Fallback fetch error:', fallbackError);
           // Absolute fallback without any joins
           const { data: rawData } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
           if (rawData) await populateReporters(rawData);
        } else if (fallbackData) {
           await populateReporters(fallbackData);
        }
      } else if (data) {
        setReports(data);
      }
    } catch {
      console.log('Reports table might not exist yet.');
    }
  };

  async function populateReporters(reportList: any[]) {
    // Extract unique reporter IDs
    const reporterIds = [...new Set(reportList.map(r => r.reporter_id).filter(Boolean))];
    if (reporterIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('*').in('id', reporterIds);
      if (profiles) {
         const profileMap = Object.fromEntries(profiles.map((p: any) => [p.id, p]));
         const populated = reportList.map(r => ({
           ...r,
           reporter: profileMap[r.reporter_id] || null
         }));
         setReports(populated);
         return;
      }
    }
    setReports(reportList);
  }

  const confirmSuspendUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suspendModalUser) return;
    const days = parseInt(suspendDays);
    if (isNaN(days) || days <= 0) return;
    
    const end = new Date();
    end.setDate(end.getDate() + days);
    
    try {
      const { error } = await supabase.from('profiles').update({ status: 'suspended', suspension_end: end.toISOString() }).eq('id', suspendModalUser.id);
      if (error) throw error;
      setAllUsers(allUsers.map(user => user.id === suspendModalUser.id ? { ...user, status: 'suspended', suspension_end: end.toISOString() } : user));
      logAudit('User Suspended', `Suspended @${suspendModalUser.username} for ${days} days.`);
      toast.success(`@${suspendModalUser.username} suspended for ${days} days.`);
      setSuspendModalUser(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const confirmBanUser = async () => {
    if (!banModalUser) return;
    try {
      const { error } = await supabase.from('profiles').update({ status: 'banned', suspension_end: null }).eq('id', banModalUser.id);
      if (error) throw error;
      setAllUsers(allUsers.map(user => user.id === banModalUser.id ? { ...user, status: 'banned', suspension_end: null } : user));
      logAudit('User Banned', `Permanently banned @${banModalUser.username}.`);
      toast.success(`@${banModalUser.username} has been permanently banned.`);
      setBanModalUser(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };
  
  const confirmUnbanUser = async () => {
    if (!unbanModalUser) return;
    try {
      const { error } = await supabase.from('profiles').update({ status: 'active', suspension_end: null }).eq('id', unbanModalUser.id);
      if (error) throw error;
      setAllUsers(allUsers.map(user => user.id === unbanModalUser.id ? { ...user, status: 'active', suspension_end: null } : user));
      toast.success(`@${unbanModalUser.username} is now active.`);
      setUnbanModalUser(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDismissReport = async (reportId: string) => {
    try {
      const { error } = await supabase.from('reports').update({ status: 'dismissed' }).eq('id', reportId);
      if (error) throw error;
      setReports(reports.map(r => r.id === reportId ? { ...r, status: 'dismissed' } : r));
      toast.success("Report dismissed.");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const confirmTakeDownArtwork = async () => {
    if (!takeDownReportModal) return;
    try {
      if (takeDownReportModal.artworks?.image_url) {
        const imgUrl = takeDownReportModal.artworks.image_url;
        const pathParts = imgUrl.split('/artworks/');
        if (pathParts.length > 1) {
            await supabase.storage.from('artworks').remove([pathParts[1]]);
        }
      }
      await supabase.from('artworks').delete().eq('id', takeDownReportModal.artwork_id);
      await supabase.from('reports').update({ status: 'resolved' }).eq('id', takeDownReportModal.id);
      setReports(reports.map(r => r.id === takeDownReportModal.id ? { ...r, status: 'resolved' } : r));
      setAllArtworks(allArtworks.filter(a => a.id !== takeDownReportModal.artwork_id));
      logAudit('Artwork Takedown', `Enforced takedown for reported artwork ID: ${takeDownReportModal.artwork_id}.`);
      toast.success("Artwork taken down and report resolved.");
      setTakeDownReportModal(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };


  const confirmDeleteUser = async () => {
    if (!deleteUserModal) return;

    try {
      const { error } = await supabase.from('profiles').delete().eq('id', deleteUserModal.id);
      if (error) throw error;
      setAllUsers(allUsers.filter(u => u.id !== deleteUserModal.id));
      logAudit('User Deleted', `Permanently deleted user @${deleteUserModal.username}.`);
      toast.success("User deleted successfully.");
      setDeleteUserModal(null);
    } catch (err: any) {
      toast.error("Error deleting user: " + err.message);
    }
  };

  const handleEditUser = (u: any) => {
    setEditingUser(u);
    setEditForm({ name: u.name, username: u.username });
  };

  const saveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    if (editForm.name === editingUser.name && editForm.username === editingUser.username) {
        setEditingUser(null);
        return;
    }

    try {
      const { error } = await supabase.from('profiles').update({ name: editForm.name, username: editForm.username }).eq('id', editingUser.id);
      if (error) throw error;
      setAllUsers(allUsers.map(user => user.id === editingUser.id ? { ...user, name: editForm.name, username: editForm.username } : user));
      toast.success("User details updated.");
      setEditingUser(null);
    } catch (err: any) {
      toast.error("Error updating user: " + err.message);
    }
  };

  const confirmDeleteArtworkAdmin = async () => {
    if (!deleteArtworkModal) return;
    try {
      await supabase.storage.from('artworks').remove([deleteArtworkModal.image_path]);
      const { error } = await supabase.from('artworks').delete().eq('id', deleteArtworkModal.id);
      if (error) throw error;
      setAllArtworks(allArtworks.filter(a => a.id !== deleteArtworkModal.id));
      logAudit('Admin Artwork Deletion', `Deleted artwork: ${deleteArtworkModal.title}.`);
      toast.success("Artwork removed successfully.");
      setDeleteArtworkModal(null);
    } catch (err: any) {
      toast.error("Error removing artwork: " + err.message);
    }
  };

  const confirmUpdateArtworkDescr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editArtworkDescModal || editDescForm === editArtworkDescModal.description) {
        setEditArtworkDescModal(null);
        return;
    }

    try {
      const { error } = await supabase.from('artworks').update({ description: editDescForm }).eq('id', editArtworkDescModal.id);
      if (error) throw error;
      setAllArtworks(allArtworks.map(a => a.id === editArtworkDescModal.id ? { ...a, description: editDescForm } : a));
      toast.success("Description updated successfully.");
      setEditArtworkDescModal(null);
    } catch (err: any) {
      toast.error("Error updating description: " + err.message);
    }
  };

  const handleUpdateUserRole = async (userId: string, newRole: string) => {
    if (userId === user.id) {
      toast.error("You cannot change your own role!");
      return;
    }

    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
      if (error) throw error;
      setAllUsers(allUsers.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err: any) {
      toast.error("Error updating user: " + err.message);
    }
  };

  if (loading) return <div style={{ padding: '100px', textAlign: 'center' }}>Loading Admin Panel...</div>;

  if (profile?.role !== 'admin') {
    return <div style={{ padding: '100px', textAlign: 'center', color: 'red' }}>Unauthorized Access</div>;
  }

  return (
    <div className="settings-container">
      <div className="settings-sidebar">
        <ul className="sidebar-menu">
          <li>
            <button className={`tab-btn ${adminSubTab === 'stats' ? 'active' : ''}`} onClick={() => setAdminSubTab('stats')}>
              <BarChart3 size={18} /> Platform Stats
            </button>
          </li>
          <li>
            <button className={`tab-btn ${adminSubTab === 'users' ? 'active' : ''}`} onClick={() => setAdminSubTab('users')}>
              <Users size={18} /> Manage Users
            </button>
          </li>
          <li>
            <button className={`tab-btn ${adminSubTab === 'artworks' ? 'active' : ''}`} onClick={() => setAdminSubTab('artworks')}>
              <Shield size={18} /> Global Artworks
            </button>
          </li>
          <li>
            <button className={`tab-btn ${adminSubTab === 'reports' ? 'active' : ''}`} onClick={() => setAdminSubTab('reports')}>
              <Shield size={18} /> Tickets & Reports
            </button>
          </li>
          <li>
            <button className={`tab-btn ${adminSubTab === 'logs' ? 'active' : ''}`} onClick={() => { setAdminSubTab('logs'); fetchAuditLogs(); }}>
              <Activity size={18} /> Audit Logs
            </button>
          </li>
        </ul>
      </div>

      <div className="settings-content">
        <div className="settings-header">
          <h2>Administrator Gateway</h2>
          <p>Global oversight and moderation tools</p>
        </div>

        {adminSubTab === 'stats' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
            <div className="content-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{allUsers.length}</div>
              <div style={{ color: 'var(--text-secondary)' }}>Total Registered Users</div>
            </div>
            <div className="content-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{allArtworks.length}</div>
              <div style={{ color: 'var(--text-secondary)' }}>Total Artworks Uploaded</div>
            </div>
            <div className="content-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{allUsers.filter(u => u.role === 'admin').length}</div>
              <div style={{ color: 'var(--text-secondary)' }}>Active Administrators</div>
            </div>
          </div>
        )}

        {adminSubTab === 'users' && (
          <div className="content-card">
            <h3>Artist & User Directory</h3>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>Modify roles using the dynamic selector or permanently remove accounts.</p>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>User Identity</th>
                    <th>Privilege Role</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map(u => (
                    <tr key={u.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{u.name}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>@{u.username}</div>
                      </td>
                      <td>
                        <select 
                          value={u.role} 
                          onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                          disabled={u.id === user.id}
                          className="search-input"
                          style={{ width: 'auto', padding: '4px 8px', height: 'auto', background: 'var(--panel-bg)', borderColor: 'var(--panel-border)' }}
                        >
                          <option value="user">Artist</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>
                      <td style={{ textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end', alignItems: 'center' }}>
                        {u.status === 'banned' ? (
                          <span style={{ color: 'var(--danger)', fontSize: '12px', fontWeight: 'bold' }}>BANNED</span>
                        ) : u.status === 'suspended' ? (
                          <span style={{ color: 'var(--warning)', fontSize: '12px', fontWeight: 'bold' }}>SUSPENDED</span>
                        ) : null}
                        
                        {u.status === 'banned' || u.status === 'suspended' ? (
                          <button className="btn btn-secondary btn-sm" onClick={() => setUnbanModalUser(u)} disabled={u.id === user.id}>
                            Unban / Unsuspend
                          </button>
                        ) : (
                          <>
                            <button className="btn btn-secondary btn-sm" onClick={() => { setSuspendModalUser(u); setSuspendDays('7'); }} disabled={u.id === user.id}>
                              Suspend
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => setBanModalUser(u)} disabled={u.id === user.id}>
                              Ban
                            </button>
                          </>
                        )}
                        <button className="btn btn-primary btn-sm" onClick={() => handleEditUser(u)}>
                          <Edit2 size={14} /> Edit
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDeleteUserModal(u)} disabled={u.id === user.id}>
                          <Trash2 size={14} /> Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {adminSubTab === 'artworks' && (
          <div className="content-card">
            <h3>Global Artworks Management</h3>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Preview</th>
                    <th>Artwork Details</th>
                    <th>Artist</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allArtworks.map(a => (
                    <tr key={a.id}>
                      <td>
                        <img src={a.image_url} alt={a.title} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' }} />
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{a.title}</div>
                        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {a.description}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '13px' }}>@{a.profiles?.username}</div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => { setEditArtworkDescModal(a); setEditDescForm(a.description || ''); }} style={{ marginRight: '8px' }}>
                          <Edit2 size={14} /> Edit Descr.
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => setDeleteArtworkModal(a)}>
                          <Trash2 size={14} /> Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {adminSubTab === 'reports' && (
          <div className="content-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0 }}>Active Moderation Tickets</h3>
              <input 
                type="text" 
                placeholder="Search reports..." 
                className="search-input" 
                style={{ width: '250px' }}
                value={reportSearchQuery}
                onChange={e => setReportSearchQuery(e.target.value)}
              />
            </div>
            {reports.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No active reports.</p>
            ) : (
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Reported On</th>
                      <th>Artwork</th>
                      <th>Report Reason</th>
                      <th>Reporter</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.filter(r => {
                      const q = reportSearchQuery.toLowerCase();
                      const title = r.artworks?.title?.toLowerCase() || '';
                      const reason = r.reason?.toLowerCase() || '';
                      const reporter = r.reporter?.username?.toLowerCase() || '';
                      return title.includes(q) || reason.includes(q) || reporter.includes(q);
                    }).map(r => (
                      <tr key={r.id}>
                        <td>
                          <span style={{ 
                            padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold',
                            backgroundColor: r.status === 'pending' ? 'rgba(234, 179, 8, 0.15)' : r.status === 'resolved' ? 'rgba(34, 197, 94, 0.15)' : 'var(--panel-border)',
                            color: r.status === 'pending' ? '#eab308' : r.status === 'resolved' ? '#22c55e' : '#fff',
                            border: r.status === 'pending' ? '1px solid rgba(234, 179, 8, 0.3)' : r.status === 'resolved' ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid transparent'
                          }}>
                            {r.status.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {new Date(r.created_at).toLocaleDateString()}
                        </td>
                        <td>
                          {r.artworks ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <img src={r.artworks.image_url} alt="reported" style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px' }} />
                              <div>
                                <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{r.artworks.title}</div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>by @{r.artworks.profiles?.username}</div>
                              </div>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>Artwork Deleted</span>
                          )}
                        </td>
                        <td style={{ maxWidth: '200px' }}>
                          <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {r.reason}
                          </div>
                        </td>
                        <td style={{ fontSize: '13px' }}>
                          {r.reporter ? `@${r.reporter.username}` : 'Unknown'}
                        </td>
                        <td style={{ textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button className="btn btn-primary btn-sm" onClick={() => setViewReportModal(r)}>
                            Review Ticket
                          </button>
                          {r.status === 'pending' && (
                            <>
                              <button className="btn btn-danger btn-sm" onClick={() => setTakeDownReportModal(r)}>
                                Take Down
                              </button>
                              <button className="btn btn-secondary btn-sm" onClick={() => handleDismissReport(r.id)}>
                                Dismiss
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {adminSubTab === 'logs' && (
          <div className="content-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0 }}>System Audit Logs</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => fetchAuditLogs()}>
                 Refresh Logs
              </button>
            </div>
            {auditLogs.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No audit logs available. Run setup_audit_logs.sql in Supabase to enable this feature.</p>
            ) : (
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>User/Actor</th>
                      <th>Action</th>
                      <th>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {auditLogs.map(log => (
                      <tr key={log.id}>
                        <td style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {new Date(log.created_at).toLocaleString()}
                        </td>
                        <td>
                          {log.profiles ? `@${log.profiles.username}` : 'System/Unknown'}
                        </td>
                        <td>
                          <span style={{ fontWeight: 'bold' }}>{log.action}</span>
                        </td>
                        <td style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {log.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Edit User Modal */}
      {editingUser && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '18px' }}>Edit User Identity</h3>
              <button onClick={() => setEditingUser(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={saveEditUser}>
                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Account Email</label>
                  <input 
                    type="text" 
                    className="search-input" 
                    value="Restricted by Auth Policies" 
                    disabled 
                    style={{ opacity: 0.5, cursor: 'not-allowed' }}
                  />
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    Email addresses are tied to core authentication credentials and cannot be changed by administrators due to strict security policies.
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: '15px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Full Name</label>
                  <input 
                    type="text" 
                    className="search-input" 
                    value={editForm.name}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                    required 
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Username</label>
                  <input 
                    type="text" 
                    className="search-input" 
                    value={editForm.username}
                    onChange={e => setEditForm({ ...editForm, username: e.target.value })}
                    required 
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
                  Save Changes
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Suspend User Modal */}
      {suspendModalUser && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '18px' }}>Suspend Account</h3>
              <button onClick={() => setSuspendModalUser(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={confirmSuspendUser}>
                <div style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
                  You are about to suspend <strong>@{suspendModalUser.username}</strong>. They will be immediately disconnected and unable to log in until the suspension expires.
                </div>
                <div className="form-group" style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Suspension Duration (Days)</label>
                  <select 
                    className="search-input" 
                    value={suspendDays}
                    onChange={e => setSuspendDays(e.target.value)}
                    required 
                  >
                    <option value="1">1 Day</option>
                    <option value="3">3 Days</option>
                    <option value="7">1 Week</option>
                    <option value="14">2 Weeks</option>
                    <option value="30">1 Month</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setSuspendModalUser(null)} style={{ flex: 1 }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                    Enforce Suspension
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Ban User Modal */}
      {banModalUser && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--danger)' }}>Permanent Ban</h3>
              <button onClick={() => setBanModalUser(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
                You are about to <strong>permanently ban @{banModalUser.username}</strong>. 
                <br /><br />
                This action will permanently restrict their access to ArtVault. Their live sessions will be terminated immediately. Are you absolutely sure?
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setBanModalUser(null)} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger" onClick={confirmBanUser} style={{ flex: 1 }}>
                  Yes, Ban User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unban User Modal */}
      {unbanModalUser && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--success)' }}>Lift Restriction</h3>
              <button onClick={() => setUnbanModalUser(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
                Are you sure you want to restore access for <strong>@{unbanModalUser.username}</strong>? 
                This will lift their {unbanModalUser.status === 'banned' ? 'ban' : 'suspension'} and immediately allow them to log in again.
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setUnbanModalUser(null)} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary" onClick={confirmUnbanUser} style={{ flex: 1 }}>
                  Yes, Lift Restriction
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Modal */}
      {deleteUserModal && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--danger)' }}>Delete User Account</h3>
              <button onClick={() => setDeleteUserModal(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
                Are you sure you want to permanently delete <strong>@{deleteUserModal.username}</strong>? 
                This action will irrevocably destroy their profile and <strong>all</strong> of their uploaded artworks.
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setDeleteUserModal(null)} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger" onClick={confirmDeleteUser} style={{ flex: 1 }}>
                  Yes, Delete User
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Artwork Modal */}
      {deleteArtworkModal && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--danger)' }}>Global Artwork Deletion</h3>
              <button onClick={() => setDeleteArtworkModal(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
                Are you sure you want to delete <strong>{deleteArtworkModal.title}</strong> globally? 
                This action cannot be undone.
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setDeleteArtworkModal(null)} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger" onClick={confirmDeleteArtworkAdmin} style={{ flex: 1 }}>
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Artwork Description Modal */}
      {editArtworkDescModal && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '18px' }}>Edit Artwork Description</h3>
              <button onClick={() => setEditArtworkDescModal(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={confirmUpdateArtworkDescr}>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Description</label>
                  <textarea 
                    className="search-input" 
                    style={{ height: '100px', resize: 'vertical' }}
                    value={editDescForm}
                    onChange={e => setEditDescForm(e.target.value)}
                  ></textarea>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setEditArtworkDescModal(null)} style={{ flex: 1 }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Take Down Report Artwork Modal */}
      {takeDownReportModal && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--danger)' }}>Take Down Reported Artwork</h3>
              <button onClick={() => setTakeDownReportModal(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
                You are about to enforce a takedown on a reported artwork. This will permanently delete the image from the global showcase and resolve the report. Proceed?
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setTakeDownReportModal(null)} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger" onClick={confirmTakeDownArtwork} style={{ flex: 1 }}>
                  Yes, Enforce Takedown
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* View Full Report Modal */}
      {viewReportModal && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: '600px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '18px' }}>Moderation Ticket Details</h3>
              <button onClick={() => setViewReportModal(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                {viewReportModal.artworks ? (
                  <>
                    <img src={viewReportModal.artworks.image_url} alt="Reported Artwork" style={{ width: '150px', height: '150px', objectFit: 'cover', borderRadius: '8px', border: '1px solid var(--panel-border)' }} />
                    <div>
                      <h4 style={{ margin: '0 0 5px 0' }}>{viewReportModal.artworks.title}</h4>
                      <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '0 0 10px 0' }}>
                        Posted by: <strong>@{viewReportModal.artworks.profiles?.username || 'Unknown'}</strong>
                      </p>
                      <div style={{ fontSize: '13px', lineHeight: '1.4', color: 'var(--text-secondary)' }}>
                        {viewReportModal.artworks.description || 'No description provided.'}
                      </div>
                    </div>
                  </>
                ) : (
                  <div style={{ width: '100%', padding: '20px', textAlign: 'center', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--panel-border)' }}>
                    Artwork has been deleted.
                  </div>
                )}
              </div>
              
              <div style={{ padding: '15px', background: 'rgba(234, 179, 8, 0.1)', borderRadius: '8px', border: '1px solid rgba(234, 179, 8, 0.2)', marginBottom: '20px' }}>
                <div style={{ marginBottom: '10px', fontSize: '13px' }}>
                  <strong>Reported By:</strong> {viewReportModal.reporter ? `@${viewReportModal.reporter.username}` : 'Unknown'}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '5px' }}>Reason for Report:</div>
                <div style={{ fontSize: '14px', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                  {viewReportModal.reason}
                </div>
              </div>
              
              <div style={{ display: 'flex', gap: '10px' }}>
                {viewReportModal.status === 'pending' && (
                  <button type="button" className="btn btn-danger" onClick={() => { setViewReportModal(null); setTakeDownReportModal(viewReportModal); }} style={{ flex: 1 }}>
                    Take Down Artwork
                  </button>
                )}
                <button type="button" className="btn btn-secondary" onClick={() => setViewReportModal(null)} style={{ flex: 1 }}>
                  Close Ticket
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
