import { useState, useRef, useEffect } from 'react';
import { X, Flag, MoreHorizontal, ArrowLeft } from 'lucide-react';
import { supabase } from './supabaseClient';
import toast from 'react-hot-toast';
import Avatar from './Avatar';

interface LightboxProps {
  artwork: any;
  artistName: string;
  onClose: () => void;
  currentUser?: any;
}

export default function Lightbox({ artwork, artistName, onClose }: LightboxProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  // Panning state (fullscreen zoom)
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const dragStart = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!fullscreen) setPosition({ x: 0, y: 0 });
  }, [fullscreen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!fullscreen) return;
    e.preventDefault(); setIsDragging(true);
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
      if (!user) { toast.error('You must be logged in to report.'); return; }
      const { error } = await supabase.from('reports').insert({
        artwork_id: artwork.id, reporter_id: user.id, reason: reportReason,
      });
      if (error) throw error;
      toast.success('Report submitted for review.');
      setReportModalOpen(false); setReportReason('');
    } catch (err: any) { toast.error('Error: ' + err.message); }
  };

  const registryNo = `AV-${artwork.id?.slice(0, 6).toUpperCase()}`;
  const displayArtist = artwork.artist_name || artistName;
  const category = artwork.artwork_categories?.[0]?.categories?.name;

  const catalogRows: { label: string; value: React.ReactNode; highlight?: boolean }[] = [
    displayArtist && { label: 'Artist', value: displayArtist },
    artwork.creation_year  && { label: 'Year',         value: artwork.creation_year },
    category               && { label: 'Collection',   value: category },
    artwork.material_used  && { label: 'Medium',        value: artwork.material_used },
    artwork.art_style      && { label: 'Art Style',     value: artwork.art_style },
    artwork.dimensions     && { label: 'Dimensions',    value: artwork.dimensions },
    artwork.collector_or_pricing && { label: 'Status',  value: artwork.collector_or_pricing },
    artwork.price != null  && { label: 'Valuation',     value: `$${Number(artwork.price).toLocaleString()}`, highlight: true },
    { label: 'Registry No.', value: registryNo },
    { label: 'Date Registered', value: new Date(artwork.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
  ].filter(Boolean) as { label: string; value: React.ReactNode; highlight?: boolean }[];

  return (
    <div
      className="modal"
      style={{ display: 'flex' }}
      onClick={onClose}
      onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
      role="button" tabIndex={0}
    >
      {/* ─── LIGHTBOX CARD ─── */}
      <div
        className="lightbox-content"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
        role="presentation"
        style={{ flexDirection: 'row', borderRadius: '4px', overflow: 'hidden', maxHeight: '90vh' }}
      >

        {/* ─── LEFT: Image ─── */}
        <div
          className={`lightbox-img-wrapper ${fullscreen ? 'fullscreen' : ''}`}
          onClick={() => !fullscreen && setFullscreen(true)}
          onKeyDown={e => { if (e.key === 'Enter' && !fullscreen) setFullscreen(true); }}
          role="button" tabIndex={0}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{
            cursor: fullscreen ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
            overflow: 'hidden',
            borderRadius: fullscreen ? '0' : '4px 0 0 4px',
            background: '#0a0a0a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {fullscreen && (
            <button
              className="fullscreen-close"
              onClick={e => { e.stopPropagation(); setFullscreen(false); }}
              style={{ zIndex: 100 }}
            >
              <X size={20} />
            </button>
          )}
          <img
            src={artwork.image_url}
            alt={artwork.title}
            style={fullscreen
              ? { transform: `scale(2) translate(${position.x / 2}px, ${position.y / 2}px)`, transition: isDragging ? 'none' : 'transform 0.1s ease-out' }
              : { maxHeight: '90vh', maxWidth: '100%', objectFit: 'contain' }
            }
            draggable={false}
          />
          {!fullscreen && (
            <div
              className="zoom-indicator"
              style={{
                background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
                color: '#fff', border: 'none', letterSpacing: '1.5px',
                fontSize: '10px', fontWeight: 600,
              }}
            >
              ⊕ CLICK TO ZOOM
            </div>
          )}
        </div>

        {/* ─── RIGHT: Info Panel ─── */}
        {!fullscreen && (
          <div style={{
            width: '360px', flexShrink: 0, display: 'flex', flexDirection: 'column',
            height: '100%', background: '#fdfaf5', borderLeft: '1px solid #d6cfc3',
          }}>

            {/* ── Top Action Bar ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 20px', borderBottom: '1px solid #d6cfc3', flexShrink: 0,
            }}>
              <button onClick={onClose} className="lb-action-btn" style={{ color: '#78716c' }}>
                <ArrowLeft size={18} />
              </button>

              {/* Report via ⋯ */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setMoreMenuOpen(!moreMenuOpen)}
                  className="lb-action-btn"
                  style={{ color: '#78716c' }}
                >
                  <MoreHorizontal size={18} />
                </button>
                {moreMenuOpen && (
                  <div style={{
                    position: 'absolute', top: '40px', right: 0,
                    background: '#fdfaf5', border: '1px solid #d6cfc3',
                    borderRadius: '4px', padding: '4px 0', minWidth: '160px',
                    zIndex: 100, boxShadow: '0 8px 24px rgba(28,25,23,0.12)',
                  }}>
                    <button
                      onClick={() => { setMoreMenuOpen(false); setReportModalOpen(true); }}
                      style={{
                        width: '100%', padding: '10px 16px', background: 'none',
                        border: 'none', color: '#991b1b', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: '8px',
                        fontSize: '13px', fontFamily: "'Inter', sans-serif", fontWeight: 500,
                      }}
                    >
                      <Flag size={14} /> Report Artwork
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Scrollable body ── */}
            <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>

              {/* Artist Strip */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '20px 24px', borderBottom: '1px solid #ede7d9',
              }}>
                <div style={{ flexShrink: 0 }}>
                  <Avatar userId={artwork.user_id} name={displayArtist} size={40} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, color: '#1c1917', fontSize: '14px', letterSpacing: '0.2px' }}>
                    {displayArtist}
                  </div>
                  <div style={{ fontFamily: "'Inter', sans-serif", color: '#a8a29e', fontSize: '11px', letterSpacing: '1px', marginTop: '2px', textTransform: 'uppercase' }}>
                    Artist
                  </div>
                </div>
              </div>

              {/* Title & Registry No. */}
              <div style={{ padding: '24px 24px 0' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                  <h2 style={{
                    fontFamily: "'Playfair Display', serif", fontSize: '22px', fontWeight: 600,
                    color: '#1c1917', margin: 0, lineHeight: 1.2, letterSpacing: '-0.01em', flex: 1,
                  }}>
                    {artwork.title}
                  </h2>
                  <span style={{
                    fontFamily: "'Inter', sans-serif", fontSize: '10px', color: '#a8a29e',
                    fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase',
                    flexShrink: 0, paddingTop: '5px',
                  }}>
                    {registryNo}
                  </span>
                </div>
                {category && (
                  <span style={{
                    display: 'inline-block', fontFamily: "'Inter', sans-serif",
                    fontSize: '10px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase',
                    color: '#8c6e3d', background: 'rgba(184,151,90,0.12)',
                    padding: '3px 10px', borderRadius: '2px', marginBottom: '18px',
                    border: '1px solid rgba(184,151,90,0.2)',
                  }}>
                    {category}
                  </span>
                )}
              </div>

              {/* Description */}
              {artwork.description && (
                <div style={{ padding: '12px 24px 20px', borderBottom: '1px solid #ede7d9' }}>
                  <p style={{
                    fontFamily: "'Inter', sans-serif", color: '#57534e',
                    fontSize: '13.5px', lineHeight: 1.8, margin: 0, whiteSpace: 'pre-wrap',
                  }}>
                    {artwork.description}
                  </p>
                </div>
              )}

              {/* Catalog Table */}
              <div>
                <div style={{ padding: '16px 24px 10px', display: 'flex', alignItems: 'center' }}>
                  <span style={{
                    fontFamily: "'Inter', sans-serif", fontSize: '9px', fontWeight: 800,
                    letterSpacing: '2.5px', textTransform: 'uppercase', color: '#a8a29e',
                  }}>
                    Catalog Record
                  </span>
                  <div style={{ flex: 1, height: '1px', background: '#ede7d9', marginLeft: '12px' }} />
                </div>

                {catalogRows.map((row, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start',
                    padding: '11px 24px',
                    borderBottom: i < catalogRows.length - 1 ? '1px solid #f0ebe0' : 'none',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(245,240,232,0.4)',
                  }}>
                    <span style={{
                      fontFamily: "'Inter', sans-serif", color: '#a8a29e',
                      fontSize: '10px', fontWeight: 700, letterSpacing: '1.2px',
                      textTransform: 'uppercase', width: '110px', flexShrink: 0, paddingTop: '2px',
                    }}>
                      {row.label}
                    </span>
                    <span style={{
                      fontFamily: row.highlight ? "'Playfair Display', serif" : "'Inter', sans-serif",
                      color: row.highlight ? '#8c6e3d' : '#1c1917',
                      fontSize: row.highlight ? '17px' : '13.5px',
                      fontWeight: row.highlight ? 600 : 500,
                      flex: 1, lineHeight: 1.4,
                    }}>
                      {row.value}
                    </span>
                  </div>
                ))}
              </div>

              {/* Tags */}
              {artwork.tags && artwork.tags.length > 0 && (
                <div style={{ padding: '16px 24px 24px', borderTop: '1px solid #ede7d9' }}>
                  <div style={{
                    fontFamily: "'Inter', sans-serif", fontSize: '9px', fontWeight: 800,
                    letterSpacing: '2px', textTransform: 'uppercase', color: '#a8a29e', marginBottom: '10px',
                  }}>
                    Tags
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {artwork.tags.map((tag: string, idx: number) => (
                      <span key={idx} style={{
                        fontFamily: "'Inter', sans-serif", color: '#57534e',
                        background: '#ede7d9', padding: '4px 12px', borderRadius: '2px',
                        fontSize: '11px', fontWeight: 600, letterSpacing: '0.5px',
                      }}>
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── Provenance Footer ── */}
            <div style={{
              padding: '14px 24px', borderTop: '1px solid #d6cfc3', background: '#f5f0e8',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
            }}>
              <span style={{
                fontFamily: "'Inter', sans-serif", fontSize: '10px',
                color: '#a8a29e', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase',
              }}>
                ArtVault Registry
              </span>
              <span style={{
                fontFamily: "'Inter', sans-serif", fontSize: '11px',
                color: '#78716c', fontWeight: 500, letterSpacing: '0.3px',
              }}>
                Verified Provenance Record
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ─── Report Modal ─── */}
      {reportModalOpen && (
        <div
          className="modal" style={{ zIndex: 1000000 }}
          onClick={e => { e.stopPropagation(); setReportModalOpen(false); }}
          onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setReportModalOpen(false); } }}
          role="button" tabIndex={0}
        >
          <div
            className="modal-content" style={{ maxWidth: '400px', borderRadius: '4px' }}
            onClick={e => e.stopPropagation()} onKeyDown={e => e.stopPropagation()} role="presentation"
          >
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: '18px', color: '#991b1b', fontFamily: "'Playfair Display', serif" }}>
                Report Artwork
              </h3>
              <button onClick={() => setReportModalOpen(false)} style={{ background: 'none', border: 'none', color: '#78716c', cursor: 'pointer' }}>
                <X size={22} />
              </button>
            </div>
            <div className="modal-body">
              <form onSubmit={confirmReport}>
                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label style={{
                    display: 'block', marginBottom: '8px', color: '#78716c',
                    fontSize: '11px', fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase',
                  }}>
                    Reason for Reporting
                  </label>
                  <textarea
                    className="search-input"
                    value={reportReason}
                    onChange={e => setReportReason(e.target.value)}
                    style={{ height: '100px', resize: 'vertical' }}
                    placeholder="e.g. Inappropriate content, copyright violation"
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setReportModalOpen(false)} style={{ flex: 1 }}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-danger" style={{ flex: 1 }}>
                    Submit Report
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
