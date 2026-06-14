import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Lock, X, Trash2 } from 'lucide-react';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import './Dashboard.css';

interface Board {
  id: string;
  name: string;
  description: string;
  is_private: boolean;
  created_at: string;
  updated_at: string;
  item_count?: number;
  preview_images?: string[];
}

export default function Boards({ user }: { user: any }) {
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [boardName, setBoardName] = useState('');
  const [boardDesc, setBoardDesc] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleteBoard, setDeleteBoard] = useState<Board | null>(null);

  useEffect(() => {
    if (user) fetchBoards();
    else setLoading(false);
  }, [user]);

  async function fetchBoards() {
    setLoading(true);
    const { data: boardsData } = await supabase
      .from('boards')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (boardsData) {
      // Fetch item counts and preview images for each board
      const enriched = await Promise.all(
        boardsData.map(async (board: any) => {
          const { count } = await supabase
            .from('board_items')
            .select('*', { count: 'exact', head: true })
            .eq('board_id', board.id);

          const { data: items } = await supabase
            .from('board_items')
            .select('artwork_id, artworks(image_url)')
            .eq('board_id', board.id)
            .order('created_at', { ascending: false })
            .limit(3);

          return {
            ...board,
            item_count: count || 0,
            preview_images: items?.map((i: any) => i.artworks?.image_url).filter(Boolean) || [],
          };
        })
      );
      setBoards(enriched);
    }
    setLoading(false);
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardName.trim()) return;
    setCreating(true);
    const { error } = await supabase.from('boards').insert({
      user_id: user.id,
      name: boardName.trim(),
      description: boardDesc.trim(),
      is_private: isPrivate,
    });
    if (error) {
      toast.error('Failed to create board');
    } else {
      toast.success('Board created!');
      setBoardName('');
      setBoardDesc('');
      setIsPrivate(false);
      setShowCreate(false);
      fetchBoards();
    }
    setCreating(false);
  };

  const confirmDelete = async () => {
    if (!deleteBoard) return;
    await supabase.from('board_items').delete().eq('board_id', deleteBoard.id);
    await supabase.from('boards').delete().eq('id', deleteBoard.id);
    setBoards(prev => prev.filter(b => b.id !== deleteBoard.id));
    setDeleteBoard(null);
    toast.success('Board deleted');
  };

  if (!user) {
    return (
      <main className="gallery-container" style={{ textAlign: 'center', paddingTop: '140px' }}>
        <span style={{ fontSize: '64px' }}>📋</span>
        <h2 style={{ marginTop: '16px', fontSize: '24px' }}>Sign in to view your boards</h2>
        <p style={{ color: 'var(--text-secondary)', marginTop: '8px' }}>Create collections to save and organize your favorite artworks.</p>
        <Link to="/login" className="btn btn-primary" style={{ marginTop: '20px', display: 'inline-flex' }}>Sign In</Link>
      </main>
    );
  }

  return (
    <>
      <main className="gallery-container">
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <h2 style={{ fontSize: '28px', fontWeight: 700 }}>My Boards</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
              Organize and save artworks into collections
            </p>
          </div>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} /> New Board
          </button>
        </div>

        {/* Boards Grid */}
        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading boards...</p>
        ) : boards.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '48px' }}>📁</span>
            <h4 style={{ marginTop: '15px' }}>No Boards Yet</h4>
            <p style={{ marginTop: '5px' }}>Create your first board to start saving artworks!</p>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)} style={{ marginTop: '20px' }}>
              <Plus size={16} /> Create Board
            </button>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
            {boards.map(board => (
              <div key={board.id} className="art-card" style={{ cursor: 'default', position: 'relative' }}>
                {/* Preview Collage */}
                <div style={{ display: 'grid', gridTemplateColumns: board.preview_images.length === 1 ? '1fr' : '1.5fr 1fr', gridTemplateRows: '140px', gap: '2px', overflow: 'hidden', borderRadius: '16px 16px 0 0', background: '#1a1a24' }}>
                  {board.preview_images.length > 0 ? (
                    <>
                      <img src={board.preview_images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', gridRow: board.preview_images.length > 2 ? '1 / 3' : '1' }} />
                      {board.preview_images.slice(1, 3).map((url, i) => (
                        <img key={i} src={url} alt="" style={{ width: '100%', height: '70px', objectFit: 'cover' }} />
                      ))}
                    </>
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444', fontSize: '40px', gridColumn: '1 / -1' }}>
                      📁
                    </div>
                  )}
                </div>

                {/* Info */}
                <div style={{ padding: '16px 20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '17px', fontWeight: 700, margin: 0 }}>{board.name}</h3>
                    {board.is_private && <Lock size={14} style={{ color: '#888' }} />}
                  </div>
                  <p style={{ color: '#888', fontSize: '13px', marginTop: '4px' }}>
                    {board.item_count} artwork{board.item_count !== 1 ? 's' : ''} · {new Date(board.updated_at).toLocaleDateString()}
                  </p>
                </div>

                {/* Delete button */}
                <button
                  onClick={() => setDeleteBoard(board)}
                  style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#aaa', cursor: 'pointer', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', backdropFilter: 'blur(4px)' }}
                  onMouseOver={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.2)'; }}
                  onMouseOut={e => { e.currentTarget.style.color = '#aaa'; e.currentTarget.style.background = 'rgba(0,0,0,0.6)'; }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Board Modal */}
      {showCreate && (
        <div className="modal" style={{ display: 'flex' }} onClick={() => setShowCreate(false)}>
          <div className="modal-content" style={{ maxWidth: '420px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '18px' }}>📁 Create New Board</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleCreate}>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Board Name</label>
                  <input
                    type="text"
                    className="search-input"
                    value={boardName}
                    onChange={e => setBoardName(e.target.value)}
                    placeholder='e.g. "Renaissance Favorites"'
                    required
                  />
                </div>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Description (optional)</label>
                  <textarea
                    className="search-input"
                    style={{ height: '80px', resize: 'vertical' }}
                    value={boardDesc}
                    onChange={e => setBoardDesc(e.target.value)}
                    placeholder="What kind of artworks belong here?"
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                  <input
                    type="checkbox"
                    id="private-toggle"
                    checked={isPrivate}
                    onChange={e => setIsPrivate(e.target.checked)}
                    style={{ width: '18px', height: '18px', accentColor: '#a855f7' }}
                  />
                  <label htmlFor="private-toggle" style={{ color: 'var(--text-secondary)', fontSize: '14px', cursor: 'pointer' }}>
                    <Lock size={13} style={{ display: 'inline', marginRight: '4px' }} /> Make this board private
                  </label>
                </div>
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={creating}>
                    {creating ? 'Creating...' : 'Create Board'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteBoard && (
        <div className="modal" style={{ display: 'flex' }} onClick={() => setDeleteBoard(null)}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--danger)' }}>Delete Board</h3>
              <button onClick={() => setDeleteBoard(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>
                Delete <strong>{deleteBoard.name}</strong>? All saved items will be removed from this board.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-secondary" onClick={() => setDeleteBoard(null)} style={{ flex: 1 }}>Cancel</button>
                <button className="btn btn-danger" onClick={confirmDelete} style={{ flex: 1 }}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
