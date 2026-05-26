import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import { Trash2, Users, BarChart3, Edit2, Shield, X } from 'lucide-react';
import './Dashboard.css';

export default function AdminPanel({ user }: { user: any }) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allArtworks, setAllArtworks] = useState<any[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [adminSubTab, setAdminSubTab] = useState<'stats' | 'users' | 'artworks' | 'reports'>('stats');

  const [editingUser, setEditingUser] = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', username: '' });

  const [suspendModalUser, setSuspendModalUser] = useState<any>(null);
  const [suspendDays, setSuspendDays] = useState('7');
  
  const [banModalUser, setBanModalUser] = useState<any>(null);


  async function fetchProfile() {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (data) {
      setProfile(data);
      if (data.role === 'admin') {
        fetchAllUsers();
        fetchAllArtworks();
        fetchAllReports();
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchProfile();
  }, []);

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
      const { data } = await supabase.from('reports').select('*, artworks(*, profiles(name, username))').order('created_at', { ascending: false });
      if (data) setReports(data);
    } catch (e) {
      console.log('Reports table might not exist yet.');
    }
  };

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
      toast.success(`@${banModalUser.username} has been permanently banned.`);
      setBanModalUser(null);
    } catch (err: any) {
      toast.error(err.message);
    }
  };
  
  const handleUnbanUser = async (u: any) => {
    try {
      const { error } = await supabase.from('profiles').update({ status: 'active', suspension_end: null }).eq('id', u.id);
      if (error) throw error;
      setAllUsers(allUsers.map(user => user.id === u.id ? { ...user, status: 'active', suspension_end: null } : user));
      toast.success(`@${u.username} is now active.`);
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

  const handleTakeDownArtwork = async (report: any) => {
    if (!confirm('Are you sure you want to take down this artwork?')) return;
    try {
      if (report.artworks?.image_url) {
        const imgUrl = report.artworks.image_url;
        const pathParts = imgUrl.split('/artworks/');
        if (pathParts.length > 1) {
            await supabase.storage.from('artworks').remove([pathParts[1]]);
        }
      }
      await supabase.from('artworks').delete().eq('id', report.artwork_id);
      await supabase.from('reports').update({ status: 'resolved' }).eq('id', report.id);
      setReports(reports.map(r => r.id === report.id ? { ...r, status: 'resolved' } : r));
      setAllArtworks(allArtworks.filter(a => a.id !== report.artwork_id));
      toast.success("Artwork taken down and report resolved.");
    } catch (err: any) {
      toast.error(err.message);
    }
  };


  const handleDeleteUser = async (userId: string) => {
    if (userId === user.id) {
      toast.error("You cannot delete your own admin account!");
      return;
    }
    if (!confirm('Are you sure you want to delete this user? This will also delete their artworks.')) return;

    try {
      const { error } = await supabase.from('profiles').delete().eq('id', userId);
      if (error) throw error;
      setAllUsers(allUsers.filter(u => u.id !== userId));
      toast.success("User deleted successfully.");
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

  const handleDeleteArtworkAdmin = async (artworkId: string, imagePath: string) => {
    if (!confirm('Are you sure you want to delete this artwork globally?')) return;
    try {
      await supabase.storage.from('artworks').remove([imagePath]);
      const { error } = await supabase.from('artworks').delete().eq('id', artworkId);
      if (error) throw error;
      setAllArtworks(allArtworks.filter(a => a.id !== artworkId));
      toast.success("Artwork removed successfully.");
    } catch (err: any) {
      toast.error("Error removing artwork: " + err.message);
    }
  };

  const handleUpdateArtworkDescr = async (artworkId: string, currentDescr: string) => {
    const newDescr = prompt("Enter new description:", currentDescr);
    if (newDescr === null || newDescr === currentDescr) return;

    try {
      const { error } = await supabase.from('artworks').update({ description: newDescr }).eq('id', artworkId);
      if (error) throw error;
      setAllArtworks(allArtworks.map(a => a.id === artworkId ? { ...a, description: newDescr } : a));
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
                          <button className="btn btn-secondary btn-sm" onClick={() => handleUnbanUser(u)} disabled={u.id === user.id}>
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
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteUser(u.id)} disabled={u.id === user.id}>
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
                        <button className="btn btn-secondary btn-sm" onClick={() => handleUpdateArtworkDescr(a.id, a.description)} style={{ marginRight: '8px' }}>
                          <Edit2 size={14} /> Edit Descr.
                        </button>
                        <button className="btn btn-danger btn-sm" onClick={() => handleDeleteArtworkAdmin(a.id, a.image_path)}>
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
            <h3>Active Moderation Tickets</h3>
            {reports.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No active reports.</p>
            ) : (
              <div className="data-table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Artwork</th>
                      <th>Report Reason</th>
                      <th>Reporter</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map(r => (
                      <tr key={r.id}>
                        <td>
                          <span style={{ 
                            padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold',
                            backgroundColor: r.status === 'pending' ? 'var(--warning)' : r.status === 'resolved' ? 'var(--success)' : 'var(--panel-border)',
                            color: r.status === 'pending' ? '#000' : '#fff'
                          }}>
                            {r.status.toUpperCase()}
                          </span>
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
                        <td>{r.reason}</td>
                        <td style={{ fontSize: '13px' }}>
                          {r.profiles ? `@${r.profiles.username}` : 'Unknown'}
                        </td>
                        <td style={{ textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          {r.status === 'pending' && (
                            <>
                              <button className="btn btn-danger btn-sm" onClick={() => handleTakeDownArtwork(r)}>
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

    </div>
  );
}
