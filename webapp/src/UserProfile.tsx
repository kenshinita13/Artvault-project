import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from './supabaseClient';
import { Trash2, X, Upload } from 'lucide-react';
import Avatar from './Avatar';
import Lightbox from './Lightbox';
import { checkImageIsSafe } from './nsfwHelper';
import { canUpload } from './roles';
import './Dashboard.css';

interface Profile {
  id: string;
  name: string;
  username: string;
  role: string;
}

interface Artwork {
  id: string;
  user_id: string;
  title: string;
  description: string;
  image_url: string;
  created_at: string;
  artist_name?: string;
  profiles?: Profile;
}

interface Board {
  id: string;
  name: string;
  description: string;
  is_private: boolean;
  preview_images?: string[];
  item_count?: number;
}

export default function UserProfile({ currentUser }: { currentUser: any | null }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [collages, setCollages] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'artworks' | 'collages'>('artworks');
  
  // Lightbox State
  const [activeArtwork, setActiveArtwork] = useState<Artwork | null>(null);
  
  // Upload Modal State
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [artistName, setArtistName] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const [deleteModalArtwork, setDeleteModalArtwork] = useState<Artwork | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('user');
  const [searchQuery, setSearchQuery] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  useEffect(() => {
    if (id) {
      fetchUserProfile();
    }
    if (currentUser?.id) {
      fetchCurrentUserRole();
    }
  }, [id, currentUser]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeTab]);

  async function fetchCurrentUserRole() {
    const { data } = await supabase.from('profiles').select('role').eq('id', currentUser.id).single();
    if (data) {
      setCurrentUserRole(data.role);
    }
  }

  async function fetchUserProfile() {
    setLoading(true);
    
    // Fetch profile
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (profileError) {
      console.error(profileError);
      setLoading(false);
      return;
    }
    setProfile(profileData);

    // Fetch artworks
    const { data: artworksData } = await supabase
      .from('artworks')
      .select('*, profiles(name, username, role)')
      .eq('user_id', id)
      .order('created_at', { ascending: false });

    if (artworksData) setArtworks(artworksData as unknown as Artwork[]);

    // Fetch collages (respecting privacy: if not owner, only public collages are returned by RLS)
    const { data: boardsData } = await supabase
      .from('boards')
      .select('*')
      .eq('user_id', id)
      .order('created_at', { ascending: false });

    if (boardsData) {
      // Batch-fetch all board items in a single query (fixes N+1 query problem)
      const boardIds = boardsData.map(b => b.id);
      const { data: allItems } = boardIds.length > 0
        ? await supabase
            .from('board_items')
            .select('board_id, artworks(image_url)')
            .in('board_id', boardIds)
        : { data: [] };

      // Group items by board_id
      const itemsByBoard = new Map<string, any[]>();
      for (const item of (allItems || [])) {
        const list = itemsByBoard.get(item.board_id) || [];
        list.push(item);
        itemsByBoard.set(item.board_id, list);
      }

      const enrichedBoards = boardsData.map(b => {
        const boardItems = (itemsByBoard.get(b.id) || []).slice(0, 4);
        return {
          ...b,
          item_count: boardItems.length,
          preview_images: boardItems.map((i: any) => i.artworks?.image_url).filter(Boolean)
        };
      });
      setCollages(enrichedBoards);
    }
    
    setLoading(false);
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) {
      toast.error('Please sign in to register artwork.');
      return;
    }
    if (!file || !title) return;

    try {
      setUploading(true);
      
      // NSFW AI Moderation
      const isSafe = await checkImageIsSafe(file);
      if (!isSafe) {
        toast.error('Upload blocked: Image contains explicit or inappropriate content.');
        setUploading(false);
        return;
      }

      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${currentUser.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('artworks')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Storage Upload Error:', uploadError);
        throw new Error(`Storage failed: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage
        .from('artworks')
        .getPublicUrl(filePath);

      if (!urlData || !urlData.publicUrl) {
        throw new Error('Failed to generate public URL for the uploaded image.');
      }

      const { error: dbError } = await supabase
        .from('artworks')
        .insert({
          title,
          description,
          artist_name: artistName.trim() || null,
          image_url: urlData.publicUrl,
          user_id: currentUser.id
        });

      if (dbError) {
        console.error('Database Insert Error:', dbError);
        throw new Error(`Database failed: ${dbError.message}`);
      }

      toast.success('Artwork published successfully!');
      setTitle('');
      setDescription('');
      setArtistName('');
      setFile(null);
      setShowUpload(false);
      fetchUserProfile();
    } catch (error: any) {
      console.error('Full Upload Exception:', error);
      alert('Error uploading: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteClick = (e: React.MouseEvent, artwork: Artwork) => {
    e.stopPropagation();
    setDeleteModalArtwork(artwork);
  };

  const confirmDelete = async () => {
    if (!deleteModalArtwork) return;

    try {
      const pathParts = deleteModalArtwork.image_url.split('/artworks/');
      if (pathParts.length > 1) {
        await supabase.storage.from('artworks').remove([pathParts[1]]);
      }

      await supabase.from('artworks').delete().eq('id', deleteModalArtwork.id);
      setArtworks(artworks.filter(a => a.id !== deleteModalArtwork.id));
      if (activeArtwork?.id === deleteModalArtwork.id) {
        setActiveArtwork(null);
      }
      toast.success('Artwork deleted successfully.');
      setDeleteModalArtwork(null);
    } catch (error: any) {
      toast.error('Error deleting: ' + error.message);
    }
  };

  if (loading) {
    return <div style={{ padding: '100px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading Collection...</div>;
  }

  if (!profile) {
    return <div style={{ padding: '100px', textAlign: 'center', color: 'var(--danger)' }}>Collection profile not found.</div>;
  }

  const filteredArtworks = artworks.filter(a => 
    a.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    (a.description && a.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const totalPages = Math.ceil(filteredArtworks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredArtworks.slice(startIndex, startIndex + itemsPerPage);
  const isOwnProfile = currentUser?.id?.toLowerCase() === profile.id?.toLowerCase();

  const getPaginationGroup = () => {
      let pages = [];
      if (totalPages <= 5) {
          for (let i = 1; i <= totalPages; i++) pages.push(i);
      } else {
          if (currentPage <= 3) {
              pages = [1, 2, 3, 4, '...', totalPages];
          } else if (currentPage >= totalPages - 2) {
              pages = [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
          } else {
              pages = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
          }
      }
      return pages;
  };

  return (
    <>
      <main className="studio-container">
        
        {/* Header Card */}
        <div className="studio-header-card">
          <div className="studio-avatar" style={{ padding: 0, overflow: 'hidden' }}>
            <Avatar userId={profile.id} name={profile.name} size={100} />
          </div>
          <div className="studio-meta">
            <h1>{profile.name}</h1>
            <div className="studio-username">@{profile.username}</div>
            <div className="studio-badges">
              <span className={`badge ${profile.role === 'admin' ? 'admin' : ''}`}>
                {profile.role === 'admin' ? 'Administrator' : 'Collection Contributor'}
              </span>
              <span className="badge">
                Registered Works {artworks.length}
              </span>
            </div>
          </div>
          {isOwnProfile && canUpload(currentUserRole) && (
            <div style={{ marginLeft: 'auto' }}>
              <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
                <Upload size={16} /> Register Work
              </button>
            </div>
          )}
        </div>

        {/* Search Bar */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '30px' }}>
          <input 
            type="text" 
            placeholder="Search artworks by title or description..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
            style={{ width: '100%', maxWidth: '500px' }}
          />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginBottom: '30px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
          <button 
            onClick={() => setActiveTab('artworks')}
            style={{ 
              background: 'none', border: 'none', fontSize: '16px', fontWeight: 600, cursor: 'pointer',
              color: activeTab === 'artworks' ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'artworks' ? '2px solid var(--primary-color)' : '2px solid transparent',
              paddingBottom: '8px'
            }}
          >
            Registered Works ({artworks.length})
          </button>
          <button 
            onClick={() => setActiveTab('collages')}
            style={{ 
              background: 'none', border: 'none', fontSize: '16px', fontWeight: 600, cursor: 'pointer',
              color: activeTab === 'collages' ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderBottom: activeTab === 'collages' ? '2px solid var(--primary-color)' : '2px solid transparent',
              paddingBottom: '8px'
            }}
          >
            Portfolios ({collages.length})
          </button>
        </div>

        {/* Collection / Portfolio Grid Layout */}
        {activeTab === 'artworks' ? (
          <>
            {filteredArtworks.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
                <span className="registry-empty-icon">AV</span>
                <h4 style={{ marginTop: '15px' }}>No Registered Works Found</h4>
                <p style={{ marginTop: '5px' }}>{searchQuery ? "No registered works match your search." : "This collection profile is currently empty."}</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 items-start w-full">
                {currentItems.map(artwork => (
                  <div key={artwork.id} className="art-card" onClick={() => setActiveArtwork(artwork)} onKeyDown={(e) => { if (e.key === 'Enter') setActiveArtwork(artwork); }} role="button" tabIndex={0}>
                    <div className="art-preview">
                      <img src={artwork.image_url} alt={artwork.title} loading="lazy" decoding="async" />
                    </div>
                    <div className="art-details">
                      <div className="art-title">{artwork.title}</div>
                      <div className="catalog-artist" style={{ marginBottom: '6px' }}>
                        {artwork.artist_name || profile.name}
                      </div>
                      <div className="catalog-registrant" style={{ marginBottom: '10px' }}>
                        Registered by {profile.name}
                      </div>
                      <div className="art-desc-preview">{artwork.description || 'No description provided.'}</div>
                      
                      <div className="art-meta">
                        <span className="art-date">{new Date(artwork.created_at).toLocaleDateString()}</span>
                      </div>

                      <div className="art-actions">
                        {(currentUser?.id === artwork.user_id || currentUserRole === 'admin') && (
                          <button onClick={(e) => handleDeleteClick(e, artwork)} className="btn btn-danger" style={{ flex: 1 }}>
                            <Trash2 size={14} /> Delete
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '40px', gap: '8px' }}>
                    <button
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                        className="btn btn-secondary"
                        style={{ opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                    >
                        Prev
                    </button>
                    {getPaginationGroup().map((page, idx) => (
                        page === '...' ? (
                            <span key={`dots-${idx}`} style={{ padding: '0 8px', color: 'var(--text-secondary)' }}>...</span>
                        ) : (
                            <button
                                key={`page-${page}`}
                                onClick={() => setCurrentPage(page as number)}
                                className={currentPage === page ? "btn btn-primary" : "btn btn-secondary"}
                                style={{ width: '40px', padding: '8px 0', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
                            >
                                {page}
                            </button>
                        )
                    ))}
                    <button
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                        className="btn btn-secondary"
                        style={{ opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                    >
                        Next
                    </button>
                </div>
            )}
          </>
        ) : (
          <>
            {collages.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
                <span className="registry-empty-icon">AV</span>
                <h4 style={{ marginTop: '15px' }}>No Public Portfolios</h4>
                <p style={{ marginTop: '5px' }}>This contributor has not created any public portfolios yet.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
                {collages.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())).map(collage => (
                  <div key={collage.id} className="board-card" style={{ background: 'var(--card-bg)', borderRadius: '16px', overflow: 'hidden', border: '1px solid var(--border-color)', transition: 'all 0.3s ease', cursor: 'pointer' }} onClick={() => navigate('/collage/' + collage.id)}>
                    <div style={{ height: '180px', background: 'var(--bg-color)', display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: '2px', padding: '2px' }}>
                      {[0, 1, 2, 3].map(i => (
                        <div key={i} style={{ background: 'rgba(0,0,0,0.05)', width: '100%', height: '100%' }}>
                          {collage.preview_images?.[i] && (
                            <img src={collage.preview_images[i]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          )}
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 600 }}>{collage.name}</h3>
                          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                            {collage.item_count} items
                          </p>
                        </div>
                      </div>
                      {collage.description && (
                        <p style={{ marginTop: '12px', fontSize: '14px', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {collage.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Lightbox Modal */}
      {activeArtwork && (
        <Lightbox 
          artwork={activeArtwork} 
          artistName={profile.name} 
          onClose={() => setActiveArtwork(null)}
          currentUser={currentUser}
        />
      )}

      {/* Upload Modal */}
      {showUpload && (
        <div className="modal">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '18px' }}>Register Work to Collection</h3>
              <button onClick={() => setShowUpload(false)} style={{ background: 'none', border: 'none', color: '#1a1a1a', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleUpload}>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Artwork Title</label>
                  <input 
                    type="text" 
                    className="search-input" 
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Starry Night" 
                    required 
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Original Creator / Artist</label>
                  <input
                    type="text"
                    className="search-input"
                    value={artistName}
                    onChange={e => setArtistName(e.target.value)}
                    placeholder="e.g. Vincent van Gogh; leave blank if this is your own work"
                  />
                  <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: '12px' }}>
                    This profile remains the registered owner of the record.
                  </p>
                </div>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Description</label>
                  <textarea 
                    className="search-input" 
                    style={{ height: '100px', resize: 'vertical' }}
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Tell the community about your artwork..."
                  ></textarea>
                </div>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Select Image</label>
                  <div className="file-upload-wrapper">
                    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {file ? file.name : 'Click to choose file'}
                    </span>
                    <input 
                      type="file" 
                      accept="image/*"
                      onChange={e => setFile(e.target.files?.[0] || null)}
                      required 
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '25px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowUpload(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={uploading}>
                    {uploading ? 'Registering...' : 'Register Work'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteModalArtwork && (
        <div className="modal">
          <div className="modal-content" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--danger)' }}>Delete Artwork</h3>
              <button onClick={() => setDeleteModalArtwork(null)} style={{ background: 'none', border: 'none', color: '#1a1a1a', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '20px', color: 'var(--text-secondary)' }}>
                Are you sure you want to delete <strong>{deleteModalArtwork.title}</strong>? 
                This action cannot be undone.
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setDeleteModalArtwork(null)} style={{ flex: 1 }}>
                  Cancel
                </button>
                <button type="button" className="btn btn-danger" onClick={confirmDelete} style={{ flex: 1 }}>
                  Yes, Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </>
  );
}
