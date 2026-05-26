import { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import { Trash2, Users, BarChart3, Edit2, Shield } from 'lucide-react';
import './Dashboard.css';

export default function AdminPanel({ user }: { user: any }) {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [allArtworks, setAllArtworks] = useState<any[]>([]);
  const [adminSubTab, setAdminSubTab] = useState<'stats' | 'users' | 'artworks'>('stats');


  async function fetchProfile() {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
    if (data) {
      setProfile(data);
      if (data.role === 'admin') {
        fetchAllUsers();
        fetchAllArtworks();
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

  const handleEditUser = async (u: any) => {
    const newName = prompt("Enter new name:", u.name);
    if (!newName) return;
    const newUsername = prompt("Enter new username:", u.username);
    if (!newUsername) return;

    if (newName === u.name && newUsername === u.username) return;

    try {
      const { error } = await supabase.from('profiles').update({ name: newName, username: newUsername }).eq('id', u.id);
      if (error) throw error;
      setAllUsers(allUsers.map(user => user.id === u.id ? { ...user, name: newName, username: newUsername } : user));
      toast.success("User details updated.");
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
                      <td style={{ textAlign: 'right', display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
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
      </div>
    </div>
  );
}
