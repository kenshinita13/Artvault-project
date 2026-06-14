import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { X, Flag, Heart, MessageCircle, Share2, MoreHorizontal, Send, ArrowLeft, ChevronDown } from 'lucide-react';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import Avatar from './Avatar';

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: {
    username: string;
    name: string;
    avatar_url?: string;
  };
}

interface Board {
  id: string;
  name: string;
}

interface LightboxProps {
  artwork: any;
  artistName: string;
  onClose: () => void;
  currentUser?: any;
}

const timeAgo = (dateStr: string) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
};

export default function Lightbox({ artwork, artistName, onClose, currentUser }: LightboxProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  // Board state
  const [userBoards, setUserBoards] = useState<Board[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');
  const [savingToBoard, setSavingToBoard] = useState(false);

  // Like state
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [likeAnimating, setLikeAnimating] = useState(false);

  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [loadingComments, setLoadingComments] = useState(true);
  const [submittingComment, setSubmittingComment] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Panning state
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!fullscreen) setPosition({ x: 0, y: 0 });
  }, [fullscreen]);

  const [isAdmin, setIsAdmin] = useState(false);

  // Fetch all related data
  useEffect(() => {
    if (!artwork || !artwork.id) return;

    const fetchData = async () => {
      // 1. Check if admin
      if (currentUser) {
        supabase.from('profiles').select('role').eq('id', currentUser.id).single().then(({ data }) => {
          if (data && data.role === 'admin') setIsAdmin(true);
        });
      }

      // 2. Fetch Likes
      const { data: likesData, error: likesError } = await supabase
        .from('likes')
        .select('user_id')
        .eq('artwork_id', artwork.id);

      if (!likesError && likesData) {
        setLikeCount(likesData.length);
        if (currentUser) {
          setLiked(likesData.some(l => l.user_id === currentUser.id));
        }
      }

      // 3. Fetch Comments
      setLoadingComments(true);
      const { data: commentsData } = await supabase
        .from('comments')
        .select(`*, profiles ( username, name, avatar_url )`)
        .eq('artwork_id', artwork.id)
        .order('created_at', { ascending: true });
      if (commentsData) {
        setComments(commentsData as Comment[]);
      }
      setLoadingComments(false);

      // 4. Fetch User Boards
      if (currentUser) {
        supabase.from('boards').select('id, name').eq('user_id', currentUser.id).order('name').then(({ data }) => {
          if (data) {
            setUserBoards(data);
            if (data.length > 0) setSelectedBoardId(data[0].id);
          }
        });
      }
    };
    fetchData();
  }, [artwork, currentUser]);

  const handleSaveToBoard = async () => {
    if (!currentUser) { toast.error('Sign in to save'); return; }
    if (!selectedBoardId) { toast.error('Create a collage first'); return; }
    
    setSavingToBoard(true);
    const { error } = await supabase.from('board_items').insert({
      board_id: selectedBoardId,
      artwork_id: artwork.id
    });
    
    if (error) {
      console.error('Supabase error inserting into board:', error);
      if (error.code === '23505') toast.error('Already saved to this collage');
      else toast.error('Failed to save: ' + error.message);
    } else {
      toast.success('Saved to collage!');
    }
    setSavingToBoard(false);
  };

  // Scroll to bottom when new comment
  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments.length]);

  const toggleLike = async () => {
    if (!currentUser) {
      toast.error('Sign in to like artworks');
      return;
    }
    if (liked) {
      await supabase.from('likes').delete().eq('artwork_id', artwork.id).eq('user_id', currentUser.id);
      setLiked(false);
      setLikeCount(prev => Math.max(0, prev - 1));
    } else {
      setLikeAnimating(true);
      setTimeout(() => setLikeAnimating(false), 600);
      await supabase.from('likes').insert({ artwork_id: artwork.id, user_id: currentUser.id });
      setLiked(true);
      setLikeCount(prev => prev + 1);
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    if (!currentUser) {
      toast.error('Sign in to comment');
      return;
    }
    setSubmittingComment(true);
    const { data, error } = await supabase
      .from('comments')
      .insert({ artwork_id: artwork.id, user_id: currentUser.id, content: commentText.trim() })
      .select(`*, profiles ( username, name, avatar_url )`)
      .single();
    if (error) {
      toast.error('Failed to post comment');
    } else {
      setComments(prev => [...prev, data as Comment]);
      setCommentText('');
    }
    setSubmittingComment(false);
  };

  const deleteComment = async (commentId: string) => {
    await supabase.from('comments').delete().eq('id', commentId);
    setComments(prev => prev.filter(c => c.id !== commentId));
    toast.success('Comment deleted');
  };

  const handleShare = async () => {
    const url = window.location.origin + `/home?artwork=${artwork.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard!');
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!fullscreen) return;
    e.preventDefault();
    setIsDragging(true);
    dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!fullscreen || !isDragging) return;
    setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };
  const handleMouseUp = () => setIsDragging(false);

  const confirmReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportReason) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("You must be logged in to report."); return; }
      const { error } = await supabase.from('reports').insert({ artwork_id: artwork.id, reporter_id: user.id, reason: reportReason });
      if (error) throw error;
      toast.success("Report submitted to administrators for review.");
      setReportModalOpen(false);
      setReportReason('');
    } catch (err: any) {
      toast.error("Error submitting report: " + err.message);
    }
  };



  return (
    <div className="modal" style={{ display: 'flex' }} onClick={onClose} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }} role="button" tabIndex={0}>
      {/* ─── LIGHTBOX CARD ─── */}
      <div
        className="lightbox-content"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
        role="presentation"
        style={{ flexDirection: 'row' }}
      >

        {/* ─── LEFT: Image ─── */}
        <div
          className={`lightbox-img-wrapper ${fullscreen ? 'fullscreen' : ''}`}
          onClick={() => !fullscreen && setFullscreen(true)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !fullscreen) setFullscreen(true); }}
          role="button"
          tabIndex={0}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            cursor: fullscreen ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
            overflow: 'hidden',
            borderRadius: '20px 0 0 20px',
            background: '#000',
          }}
        >
          {fullscreen && (
            <button className="fullscreen-close" onClick={(e) => { e.stopPropagation(); setFullscreen(false); }} style={{ zIndex: 100 }}>
              <X size={20} />
            </button>
          )}
          <img
            src={artwork.image_url}
            alt={artwork.title}
            style={fullscreen ? { transform: `translate(${position.x}px, ${position.y}px)`, transition: isDragging ? 'none' : 'transform 0.1s ease-out' } : {}}
            draggable={false}
          />
          {!fullscreen && <div className="zoom-indicator">🔍 Click to Zoom</div>}
        </div>

        {/* ─── RIGHT: Info Panel ─── */}
        {!fullscreen && (
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            borderLeft: '1px solid rgba(255,255,255,0.08)',
            minWidth: 0,
          }}>

            {/* ── Top Action Bar ── */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 24px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}>
              {/* Left actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', transition: 'background 0.2s' }} onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')} onMouseOut={e => (e.currentTarget.style.background = 'none')}>
                  <ArrowLeft size={22} />
                </button>

                <button
                  onClick={toggleLike}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '8px',
                    borderRadius: '50%', display: 'flex', alignItems: 'center', gap: '6px',
                    color: liked ? '#ef4444' : '#aaa', transition: 'all 0.2s',
                    transform: likeAnimating ? 'scale(1.3)' : 'scale(1)',
                  }}
                  onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'none')}
                >
                  <Heart size={22} fill={liked ? '#ef4444' : 'none'} />
                  {likeCount > 0 && <span style={{ fontSize: '15px', fontWeight: 700 }}>{likeCount}</span>}
                </button>

                <button onClick={() => document.getElementById('comment-input')?.focus()} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', transition: 'background 0.2s' }} onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')} onMouseOut={e => (e.currentTarget.style.background = 'none')}>
                  <MessageCircle size={22} />
                </button>

                <button onClick={handleShare} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', transition: 'background 0.2s' }} onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')} onMouseOut={e => (e.currentTarget.style.background = 'none')}>
                  <Share2 size={22} />
                </button>
              </div>

              {/* Right actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
                {currentUser && userBoards.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.06)', borderRadius: '24px', padding: '4px' }}>
                    <div style={{ position: 'relative' }}>
                      <select 
                        value={selectedBoardId} 
                        onChange={(e) => setSelectedBoardId(e.target.value)}
                        style={{ appearance: 'none', background: 'transparent', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 600, padding: '8px 32px 8px 16px', outline: 'none', cursor: 'pointer', minWidth: '120px' }}
                      >
                        {userBoards.map(b => (
                          <option key={b.id} value={b.id} style={{ background: '#1e1e2d', color: '#fff' }}>{b.name}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#888' }} />
                    </div>
                    <button 
                      onClick={handleSaveToBoard}
                      disabled={savingToBoard}
                      style={{ background: '#a855f7', color: '#fff', border: 'none', borderRadius: '20px', padding: '8px 16px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', transition: 'background 0.2s' }}
                      onMouseOver={e => e.currentTarget.style.background = '#c084fc'}
                      onMouseOut={e => e.currentTarget.style.background = '#a855f7'}
                    >
                      {savingToBoard ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
                <button onClick={() => setMoreMenuOpen(!moreMenuOpen)} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', padding: '8px', borderRadius: '50%', display: 'flex', transition: 'background 0.2s' }} onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')} onMouseOut={e => (e.currentTarget.style.background = 'none')}>
                  <MoreHorizontal size={22} />
                </button>

                {moreMenuOpen && (
                  <div style={{ position: 'absolute', top: '44px', right: 0, background: 'rgba(30,30,35,0.98)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', padding: '6px 0', minWidth: '160px', zIndex: 100, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                    <button onClick={() => { setMoreMenuOpen(false); setReportModalOpen(true); }} style={{ width: '100%', padding: '10px 16px', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', textAlign: 'left' }}>
                      <Flag size={15} /> Report Artwork
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Artist Info + Description (scrollable middle) ── */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              minHeight: 0,
            }}>
              {/* Artist row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Link to={`/profile/${artwork.user_id}`} onClick={onClose} style={{ textDecoration: 'none' }}>
                  <Avatar userId={artwork.user_id} name={artistName} size={44} />
                </Link>
                <div>
                  <Link to={`/profile/${artwork.user_id}`} onClick={onClose} style={{ color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: '15px', display: 'block' }}>
                    {artistName}
                  </Link>
                  <span style={{ color: '#777', fontSize: '13px' }}>
                    {new Date(artwork.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Title */}
              <h2 style={{ fontSize: '24px', fontWeight: 800, color: '#fff', margin: 0, lineHeight: 1.2 }}>
                {artwork.title}
              </h2>

              {/* Description */}
              {artwork.description && (
                <div>
                  <p style={{ color: '#999', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px', fontWeight: 600 }}>Description</p>
                  <p style={{ color: '#ccc', fontSize: '15px', lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>
                    {artwork.description}
                  </p>
                </div>
              )}

              {/* Advanced Artwork Details */}
              {(artwork.medium || artwork.tools || (artwork.tags && artwork.tags.length > 0)) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '14px', borderRadius: '12px' }}>
                  {artwork.medium && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#999', fontSize: '13px', fontWeight: 600, width: '60px' }}>Medium</span>
                      <span style={{ color: '#eee', fontSize: '14px' }}>{artwork.medium}</span>
                    </div>
                  )}
                  {artwork.tools && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ color: '#999', fontSize: '13px', fontWeight: 600, width: '60px' }}>Tools</span>
                      <span style={{ color: '#eee', fontSize: '14px' }}>{artwork.tools}</span>
                    </div>
                  )}
                  {artwork.tags && artwork.tags.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px' }}>
                      {artwork.tags.map((tag: string, idx: number) => (
                        <span key={idx} style={{ color: '#c084fc', background: 'rgba(168,85,247,0.1)', padding: '4px 10px', borderRadius: '14px', fontSize: '12px', fontWeight: 600 }}>
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Comments Section ── */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px' }}>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '16px' }}>
                  {comments.length} Comment{comments.length !== 1 ? 's' : ''}
                </p>

                {loadingComments ? (
                  <p style={{ color: '#555', fontSize: '13px' }}>Loading comments...</p>
                ) : comments.length === 0 ? (
                  <p style={{ color: '#555', fontSize: '14px', fontStyle: 'italic' }}>No comments yet. Be the first!</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {comments.map(c => (
                      <div key={c.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                        <Link to={`/profile/${c.user_id}`} onClick={onClose} style={{ flexShrink: 0, textDecoration: 'none' }}>
                          <Avatar userId={c.user_id} name={c.profiles?.name || c.profiles?.username || 'U'} size={32} />
                        </Link>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                            <Link to={`/profile/${c.user_id}`} onClick={onClose} style={{ color: '#fff', textDecoration: 'none', fontWeight: 600, fontSize: '13px' }}>
                              {c.profiles?.username || c.profiles?.name || 'User'}
                            </Link>
                            <span style={{ color: '#555', fontSize: '11px' }}>{timeAgo(c.created_at)}</span>
                            {currentUser && (currentUser.id === c.user_id || isAdmin) && (
                              <button onClick={() => deleteComment(c.id)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '11px', padding: '2px 6px', borderRadius: '4px', transition: 'all 0.2s' }} onMouseOver={e => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.1)'; }} onMouseOut={e => { e.currentTarget.style.color = '#555'; e.currentTarget.style.background = 'none'; }}>
                                Delete
                              </button>
                            )}
                          </div>
                          <p style={{ color: '#ccc', fontSize: '14px', lineHeight: 1.5, margin: 0, wordBreak: 'break-word' }}>{c.content}</p>
                        </div>
                      </div>
                    ))}
                    <div ref={commentsEndRef} />
                  </div>
                )}
              </div>
            </div>

            {/* ── Comment Input Bar (sticky bottom) ── */}
            <form onSubmit={submitComment} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '14px 24px',
              borderTop: '1px solid rgba(255,255,255,0.06)',
              flexShrink: 0,
              background: 'rgba(18,18,22,0.6)',
            }}>
              {currentUser && (
                <Avatar userId={currentUser.id} name={currentUser.user_metadata?.name || 'U'} size={32} />
              )}
              <input
                id="comment-input"
                type="text"
                placeholder={currentUser ? "Add a comment..." : "Sign in to comment"}
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                disabled={!currentUser || submittingComment}
                style={{
                  flex: 1,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '24px',
                  padding: '10px 16px',
                  color: '#fff',
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = 'rgba(168,85,247,0.5)')}
                onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
              />
              <button
                type="submit"
                disabled={!commentText.trim() || submittingComment}
                style={{
                  background: commentText.trim() ? 'linear-gradient(135deg, #a855f7, #ec4899)' : 'rgba(255,255,255,0.06)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: commentText.trim() ? 'pointer' : 'default',
                  color: commentText.trim() ? '#fff' : '#555',
                  transition: 'all 0.2s',
                  flexShrink: 0,
                }}
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        )}
      </div>

      {/* ─── Report Modal ─── */}
      {reportModalOpen && (
        <div className="modal" style={{ zIndex: 1000000 }} onClick={(e) => { e.stopPropagation(); setReportModalOpen(false); }} onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setReportModalOpen(false); } }} role="button" tabIndex={0}>
          <div className="modal-content" style={{ maxWidth: '400px' }} onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} role="presentation">
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--danger)' }}>Report Artwork</h3>
              <button onClick={() => setReportModalOpen(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={confirmReport}>
                <div className="form-group" style={{ marginBottom: '25px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>Reason for Reporting</label>
                  <textarea
                    className="search-input"
                    value={reportReason}
                    onChange={e => setReportReason(e.target.value)}
                    style={{ height: '100px', resize: 'vertical' }}
                    placeholder="e.g., Inappropriate content, Copyright violation, Spam"
                    required
                  ></textarea>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setReportModalOpen(false)} style={{ flex: 1 }}>Cancel</button>
                  <button type="submit" className="btn btn-danger" style={{ flex: 1 }}>Submit Report</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
