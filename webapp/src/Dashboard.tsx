import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Lightbox from './Lightbox';
import { useCachedQuery, invalidateCache } from './useCachedQuery';
import './Dashboard.css';

// Supabase image optimization helper — serves WebP at correct size
function optimizedUrl(url: string, width: number, quality = 75): string {
  if (!url || !url.includes('supabase.co')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}width=${width}&quality=${quality}`;
}

interface Artwork {
  id: string;
  user_id: string;
  title: string;
  description: string;
  image_url: string;
  created_at: string;
  profiles?: {
    username: string;
    name: string;
  };
  artwork_categories?: { categories: { name: string; slug: string } }[];
  tags?: string[];
  medium?: string;
  tools?: string;
  dominant_color?: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

// Global artwork cache (simple module-level cache for artworks; categories use useCachedQuery)
let cachedArtworks: Artwork[] | null = null;

export default function Dashboard({ user }: { user: any }) {
  const [artworks, setArtworks] = useState<Artwork[]>(cachedArtworks || []);
  const [loading, setLoading] = useState(!cachedArtworks);
  const [activeArtwork, setActiveArtwork] = useState<Artwork | null>(null);

  // Shared cached categories (same cache key as Layout.tsx)
  const { data: cachedCategories } = useCachedQuery<Category[]>(
    'categories',
    async () => {
      const { data } = await supabase.from('categories').select('*').order('name');
      return data || [];
    },
    { ttl: 10 * 60 * 1000 }
  );
  const categories = cachedCategories || [];
  
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  // Reset page when search or category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeCategory]);

  useEffect(() => {
    fetchData();

    const handleRefresh = () => {
      cachedArtworks = null;
      fetchData();
    };

    window.addEventListener('artwork-created', handleRefresh);
    return () => window.removeEventListener('artwork-created', handleRefresh);
  }, []);

  async function fetchData() {
    if (!cachedArtworks) setLoading(true);

    // Fetch artworks
    const { data, error } = await supabase
      .from('artworks')
      .select(`
        *,
        profiles (username, name),
        artwork_categories (categories (name, slug))
      `)
      .order('created_at', { ascending: false });

    if (!error && data) {
      cachedArtworks = data as unknown as Artwork[];
      setArtworks(cachedArtworks);
    } else if (error) {
      // Fallback if artwork_categories relation doesn't exist yet
      const { data: safeData, error: safeError } = await supabase
        .from('artworks')
        .select('*, profiles (username, name)')
        .order('created_at', { ascending: false });
        
      if (!safeError && safeData) {
        const injectedData = safeData.map((art: any) => ({
          ...art,
          artwork_categories: []
        }));
        cachedArtworks = injectedData as unknown as Artwork[];
        setArtworks(cachedArtworks);
      }
    }
    setLoading(false);
  }

  const filteredArtworks = artworks.filter(a => {
    // Category filter
    if (activeCategory !== 'all') {
      const hasCat = a.artwork_categories?.some(ac => ac.categories?.slug === activeCategory);
      if (!hasCat) return false;
    }

    // Search filter
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    
    // Check if searching for a hashtag
    if (q.startsWith('#')) {
      const tagQuery = q.slice(1);
      return a.tags && a.tags.some((tag: string) => tag.toLowerCase().includes(tagQuery));
    }

    return a.title.toLowerCase().includes(q) || 
      (a.description && a.description.toLowerCase().includes(q)) ||
      (a.profiles?.name && a.profiles.name.toLowerCase().includes(q)) ||
      (a.profiles?.username && a.profiles.username.toLowerCase().includes(q)) ||
      (a.medium && a.medium.toLowerCase().includes(q)) ||
      (a.tools && a.tools.toLowerCase().includes(q)) ||
      (a.tags && a.tags.some((tag: string) => tag.toLowerCase().includes(q)));
  });

  const totalPages = Math.ceil(filteredArtworks.length / itemsPerPage);
  const paginatedArtworks = filteredArtworks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      {/* Category Pills Header */}
      <div className="category-filter-bar">
        <button 
          className={`category-pill ${activeCategory === 'all' ? 'active' : ''}`}
          onClick={() => setActiveCategory('all')}
        >
          All
        </button>
        {categories.map(cat => (
          <button 
            key={cat.id}
            className={`category-pill ${activeCategory === cat.slug ? 'active' : ''}`}
            onClick={() => setActiveCategory(cat.slug)}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <main className="gallery-container" style={{ paddingTop: '80px', paddingLeft: '16px', paddingRight: '16px' }}>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)' }}>Loading gallery...</p>
        ) : filteredArtworks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-secondary)' }}>
            <span style={{ fontSize: '48px' }}>🔍</span>
            <h4 style={{ marginTop: '15px' }}>No Artworks Found</h4>
            <p style={{ marginTop: '5px' }}>{searchQuery ? "No artworks match your search." : "The gallery is currently empty."}</p>
          </div>
        ) : (
          <>
            <div className="masonry-grid">
              {paginatedArtworks.map((artwork) => (
                <div 
                  key={artwork.id} 
                  className="masonry-item art-card"
                  onClick={() => setActiveArtwork(artwork)}
                  style={{
                    '--glow-color': artwork.dominant_color || 'transparent'
                  } as React.CSSProperties}
                  onMouseEnter={(e) => {
                    if (artwork.dominant_color && artwork.dominant_color !== '#2a2a35') {
                      e.currentTarget.style.boxShadow = `0 10px 40px -10px ${artwork.dominant_color}80`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <img 
                    src={optimizedUrl(artwork.image_url, 400)}
                    srcSet={`${optimizedUrl(artwork.image_url, 400)} 400w, ${optimizedUrl(artwork.image_url, 800)} 800w`}
                    sizes="(max-width: 600px) 50vw, (max-width: 900px) 33vw, 25vw"
                    alt={artwork.title} 
                    loading="lazy"
                    decoding="async"
                    style={{ background: artwork.dominant_color || '#1a1a24' }}
                  />
                  <div className="art-card-overlay">
                    <h4 className="art-title truncate">{artwork.title}</h4>
                    <p className="art-author truncate">@{artwork.profiles?.username || artwork.profiles?.name}</p>
                    
                    {/* Render Category Badges */}
                    {artwork.artwork_categories && artwork.artwork_categories.length > 0 && (
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                        {artwork.artwork_categories.map((ac, idx) => ac.categories && (
                          <span key={idx} style={{ background: 'rgba(255,255,255,0.2)', padding: '2px 6px', borderRadius: '4px', fontSize: '10px', color: '#fff', backdropFilter: 'blur(4px)' }}>
                            {ac.categories.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '40px 0', flexWrap: 'wrap' }}>
                <button
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="btn"
                  style={{ background: currentPage === 1 ? 'rgba(255,255,255,0.05)' : 'var(--input-bg)', color: currentPage === 1 ? '#666' : 'white', border: '1px solid var(--panel-border)', cursor: currentPage === 1 ? 'not-allowed' : 'pointer' }}
                >
                  Previous
                </button>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className="btn"
                    style={{
                      background: currentPage === page ? 'var(--accent)' : 'var(--input-bg)',
                      color: 'white',
                      border: '1px solid var(--panel-border)',
                      minWidth: '40px'
                    }}
                  >
                    {page}
                  </button>
                ))}

                <button
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="btn"
                  style={{ background: currentPage === totalPages ? 'rgba(255,255,255,0.05)' : 'var(--input-bg)', color: currentPage === totalPages ? '#666' : 'white', border: '1px solid var(--panel-border)', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer' }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {activeArtwork && (
        <Lightbox 
          artwork={activeArtwork} 
          artistName={activeArtwork.profiles?.username || activeArtwork.profiles?.name || 'Unknown Artist'}
          onClose={() => setActiveArtwork(null)}
          currentUser={user}
        />
      )}
    </>
  );
}
