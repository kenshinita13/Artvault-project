import { useState, useEffect, useRef, useMemo, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Lightbox from './Lightbox';
import { useCachedQuery } from './useCachedQuery';
import './Dashboard.css';

const IMAGE_URL_REPLACEMENTS: Record<string, string> = {
  'https://www.artic.edu/iiif/2/8f9f77a5-003f-a185-873d-8c0f71cf5cf1/full/843,/0/default.jpg':
    'https://upload.wikimedia.org/wikipedia/commons/1/15/Adolph_Menzel_-_Halbfigur_eines_alten_Mannes_%281855%29.jpg',
  'https://www.artic.edu/iiif/2/7f753e93-8579-abab-6c79-1a35ff67ba53/full/843,/0/default.jpg':
    'https://upload.wikimedia.org/wikipedia/commons/1/1b/Adolph_Menzel%2C_Study_of_a_Woman%2C_c._1875-1890%2C_NGA_56918.jpg',
};

function resolveArtworkImageUrl(url: string): string {
  return IMAGE_URL_REPLACEMENTS[url] || url;
}

// Supabase image optimization helper — serves WebP at correct size
function optimizedUrl(url: string, width: number, quality = 80): string {
  url = resolveArtworkImageUrl(url);
  if (!url || !url.includes('supabase.co')) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}width=${width}&quality=${quality}`;
}

function formatYear(val?: string | number | null): string {
  if (!val) return '';
  return String(val);
}

function getRegistryNumber(id: string): string {
  return `AV-${id.slice(0, 6).toUpperCase()}`;
}

function getRegisteredBy(artwork: Artwork): string {
  return artwork.profiles?.name || artwork.profiles?.username || 'ArtVault Contributor';
}

function getOriginalCreator(artwork: Artwork): string {
  return artwork.artist_name || getRegisteredBy(artwork);
}

function activateOnKey(event: KeyboardEvent<HTMLElement>, action: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    action();
  }
}

interface Artwork {
  id: string;
  user_id: string;
  title: string;
  description: string;
  image_url: string;
  created_at: string;
  profiles?: { username: string; name: string };
  artwork_categories?: { categories: { name: string; slug: string } }[];
  tags?: string[];
  medium?: string;
  artist_name?: string;
  material_used?: string;
  art_style?: string;
  collector_or_pricing?: string;
  price?: number;
  creation_year?: string;
  dimensions?: string;
  dominant_color?: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface RegistryStats {
  total: number;
  withArtist: number;
  withProvenance: number;
}

let cachedArtworks: Artwork[] | null = null;

// ── Skeleton shimmer card ──────────────────────────────────────
function SkeletonCard() {
  return (
    <div style={{
      background: 'var(--ivory-white)',
      display: 'flex', flexDirection: 'column',
      animation: 'shimmer 1.6s infinite'
    }}>
      <div style={{ width: '100%', paddingBottom: '75%', background: 'var(--ivory-deep)', position: 'relative' }} />
      <div style={{ padding: '18px 20px 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 10, background: 'var(--beige)', borderRadius: 2, marginBottom: 8, width: '40%' }} />
        <div style={{ height: 18, background: 'var(--beige)', borderRadius: 2, marginBottom: 6, width: '80%' }} />
        <div style={{ height: 14, background: 'var(--ivory-deep)', borderRadius: 2, marginBottom: 16, width: '60%' }} />
        <div style={{ marginTop: 'auto', paddingTop: 10, borderTop: '1px solid var(--beige)', display: 'flex', gap: 12 }}>
          <div style={{ height: 20, background: 'var(--ivory-deep)', borderRadius: 2, width: '30%' }} />
          <div style={{ height: 20, background: 'var(--ivory-deep)', borderRadius: 2, width: '30%' }} />
        </div>
      </div>
    </div>
  );
}

// ── View toggle icon ──────────────────────────────────────────
function GridIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/>
      <rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/>
    </svg>
  );
}
function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
      <rect x="1" y="2" width="14" height="3" rx="1"/><rect x="1" y="7" width="14" height="3" rx="1"/>
      <rect x="1" y="12" width="14" height="3" rx="1"/>
    </svg>
  );
}

// ── Catalog Card (grid view) ──────────────────────────────────
function CatalogCard({ artwork, onClick }: { artwork: Artwork; onClick: () => void }) {
  const artistDisplay = getOriginalCreator(artwork);
  const registeredBy = getRegisteredBy(artwork);
  const category = artwork.artwork_categories?.[0]?.categories?.name;

  return (
    <article
      className="catalog-card"
      onClick={onClick}
      onKeyDown={(event) => activateOnKey(event, onClick)}
      role="button"
      tabIndex={0}
      aria-label={`Open catalog entry for ${artwork.title}`}
    >
      <div className="catalog-card-image">
        <img
          src={optimizedUrl(artwork.image_url, 600)}
          alt={artwork.title}
          loading="lazy"
          decoding="async"
        />
        <div className="catalog-card-badge-row">
          {category && (
            <span className="catalog-badge">{category}</span>
          )}
          {artwork.collector_or_pricing && (
            <span className="catalog-badge catalog-badge-status">{artwork.collector_or_pricing}</span>
          )}
        </div>
      </div>
      <div className="catalog-card-body">
        <p className="catalog-registry-no">{getRegistryNumber(artwork.id)}</p>
        <h3 className="catalog-title">{artwork.title}</h3>
        <p className="catalog-artist">{artistDisplay}</p>
        <p className="catalog-registrant">Registered by {registeredBy}</p>
        <div className="catalog-meta-row">
          {artwork.creation_year && (
            <span className="catalog-meta-item">
              <span className="catalog-meta-label">Year</span>
              <span className="catalog-meta-value">{formatYear(artwork.creation_year)}</span>
            </span>
          )}
          {artwork.material_used && (
            <span className="catalog-meta-item">
              <span className="catalog-meta-label">Medium</span>
              <span className="catalog-meta-value">{artwork.material_used}</span>
            </span>
          )}
          {artwork.art_style && (
            <span className="catalog-meta-item">
              <span className="catalog-meta-label">Style</span>
              <span className="catalog-meta-value">{artwork.art_style}</span>
            </span>
          )}
          {artwork.dimensions && (
            <span className="catalog-meta-item">
              <span className="catalog-meta-label">Size</span>
              <span className="catalog-meta-value">{artwork.dimensions}</span>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

// ── Catalog Row (list view) ───────────────────────────────────
function CatalogRow({ artwork, onClick }: { artwork: Artwork; onClick: () => void }) {
  const artistDisplay = getOriginalCreator(artwork);
  const registeredBy = getRegisteredBy(artwork);
  const category = artwork.artwork_categories?.[0]?.categories?.name;

  return (
    <article
      className="catalog-row"
      onClick={onClick}
      onKeyDown={(event) => activateOnKey(event, onClick)}
      role="button"
      tabIndex={0}
      aria-label={`Open catalog entry for ${artwork.title}`}
    >
      <div className="catalog-row-thumb">
        <img src={optimizedUrl(artwork.image_url, 200)} alt={artwork.title} loading="lazy" decoding="async" />
      </div>
      <div className="catalog-row-info">
        <div className="catalog-row-top">
          <span className="catalog-registry-no">{getRegistryNumber(artwork.id)}</span>
          {category && <span className="catalog-badge">{category}</span>}
        </div>
        <h3 className="catalog-title">{artwork.title}</h3>
        <p className="catalog-artist">{artistDisplay}</p>
        <p className="catalog-registrant">Registered by {registeredBy}</p>
      </div>
      <div className="catalog-row-meta">
        {artwork.creation_year && (
          <div className="catalog-meta-item">
            <span className="catalog-meta-label">Year</span>
            <span className="catalog-meta-value">{formatYear(artwork.creation_year)}</span>
          </div>
        )}
        {artwork.material_used && (
          <div className="catalog-meta-item">
            <span className="catalog-meta-label">Medium</span>
            <span className="catalog-meta-value">{artwork.material_used}</span>
          </div>
        )}
        {artwork.art_style && (
          <div className="catalog-meta-item">
            <span className="catalog-meta-label">Style</span>
            <span className="catalog-meta-value">{artwork.art_style}</span>
          </div>
        )}
        {artwork.dimensions && (
          <div className="catalog-meta-item">
            <span className="catalog-meta-label">Dimensions</span>
            <span className="catalog-meta-value">{artwork.dimensions}</span>
          </div>
        )}
        {artwork.collector_or_pricing && (
          <div className="catalog-meta-item">
            <span className="catalog-meta-label">Status</span>
            <span className="catalog-meta-value">{artwork.collector_or_pricing}</span>
          </div>
        )}
      </div>
      <div className="catalog-row-action">
        <span style={{ fontSize: 12, color: '#b8975a', fontWeight: 600, letterSpacing: '0.5px' }}>View Record →</span>
      </div>
    </article>
  );
}

// ── Featured Acquisition panel ────────────────────────────────
function FeaturedAcquisition({ artwork, onClick }: { artwork: Artwork; onClick: () => void }) {
  const artistDisplay = getOriginalCreator(artwork);
  const registeredBy = getRegisteredBy(artwork);
  const regNo = getRegistryNumber(artwork.id);
  const category = artwork.artwork_categories?.[0]?.categories?.name;

  return (
    <section className="featured-acquisition">
      <div
        className="featured-image-panel"
        onClick={onClick}
        onKeyDown={(event) => activateOnKey(event, onClick)}
        role="button"
        tabIndex={0}
        aria-label={`Open featured catalog entry for ${artwork.title}`}
      >
        <img src={optimizedUrl(artwork.image_url, 900)} alt={artwork.title} />
        <div className="featured-image-overlay">
          <span className="featured-label-chip">Latest Acquisition</span>
        </div>
      </div>
      <div className="featured-info-panel">
        <div className="featured-header">
          <span className="featured-section-label">Featured Work</span>
          <span className="featured-reg-no">{regNo}</span>
        </div>
        <h2 className="featured-title">{artwork.title}</h2>
        <p className="featured-artist">{artistDisplay}</p>
        <p className="featured-registrant">Registered by {registeredBy}</p>
        {artwork.description && (
          <p className="featured-desc">{artwork.description.slice(0, 180)}{artwork.description.length > 180 ? '…' : ''}</p>
        )}
        <div className="featured-catalog-table">
          <div className="featured-row">
            <span className="featured-row-label">Original Creator</span>
            <span className="featured-row-value">{artistDisplay}</span>
          </div>
          <div className="featured-row">
            <span className="featured-row-label">Registered By</span>
            <span className="featured-row-value">{registeredBy}</span>
          </div>
          {category && (
            <div className="featured-row">
              <span className="featured-row-label">Collection</span>
              <span className="featured-row-value">{category}</span>
            </div>
          )}
          {artwork.creation_year && (
            <div className="featured-row">
              <span className="featured-row-label">Year</span>
              <span className="featured-row-value">{formatYear(artwork.creation_year)}</span>
            </div>
          )}
          {artwork.material_used && (
            <div className="featured-row">
              <span className="featured-row-label">Medium</span>
              <span className="featured-row-value">{artwork.material_used}</span>
            </div>
          )}
          {artwork.art_style && (
            <div className="featured-row">
              <span className="featured-row-label">Art Style</span>
              <span className="featured-row-value">{artwork.art_style}</span>
            </div>
          )}
          {artwork.dimensions && (
            <div className="featured-row">
              <span className="featured-row-label">Dimensions</span>
              <span className="featured-row-value">{artwork.dimensions}</span>
            </div>
          )}
          {artwork.collector_or_pricing && (
            <div className="featured-row">
              <span className="featured-row-label">Current Status</span>
              <span className="featured-row-value">{artwork.collector_or_pricing}</span>
            </div>
          )}
          {artwork.price != null && (
            <div className="featured-row">
              <span className="featured-row-label">Valuation</span>
              <span className="featured-row-value featured-valuation">${Number(artwork.price).toLocaleString()}</span>
            </div>
          )}
          <div className="featured-row">
            <span className="featured-row-label">Registered</span>
            <span className="featured-row-value">
              {new Date(artwork.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </span>
          </div>
        </div>
        <button className="featured-view-btn" onClick={onClick}>Open Catalog Entry →</button>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN DASHBOARD COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function Dashboard({ user, mode = 'discover' }: { user: any; mode?: 'discover' | 'registry' }) {
  const [artworks, setArtworks] = useState<Artwork[]>(cachedArtworks || []);
  const [loading, setLoading] = useState(!cachedArtworks);
  const [activeArtwork, setActiveArtwork] = useState<Artwork | null>(null);
  const [stats, setStats] = useState<RegistryStats>({ total: 0, withArtist: 0, withProvenance: 0 });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(mode === 'registry' ? 'list' : 'grid');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(264);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const isResizing = useRef(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!mobileFiltersOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setMobileFiltersOpen(false);
    };

    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileFiltersOpen]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const newWidth = Math.max(200, Math.min(e.clientX, 600));
      setSidebarWidth(newWidth);
    };
    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = 'default';
    };
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const { data: cachedCategories } = useCachedQuery<Category[]>(
    'categories',
    async () => {
      const { data } = await supabase.from('categories').select('*').order('name');
      return data || [];
    },
    { ttl: 10 * 60 * 1000 }
  );
  const categories = cachedCategories || [];

  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeMedium, setActiveMedium] = useState('all');
  const [activeArtist, setActiveArtist] = useState('all');
  const [artistSearch, setArtistSearch] = useState('');
  const [activeArtistLetter, setActiveArtistLetter] = useState('All');
  const [activePriceRange, setActivePriceRange] = useState('all');
  const [customMinPrice, setCustomMinPrice] = useState<string>('');
  const [customMaxPrice, setCustomMaxPrice] = useState<string>('');
  // Unique artists and mediums for filters
  const uniqueArtists = useMemo(() => {
    return (Array.from(new Set(
      artworks.map(a => getOriginalCreator(a)).filter(Boolean)
    )) as string[]).sort((a, b) => a.localeCompare(b));
  }, [artworks]);

  const artistLetters = useMemo(() => {
    const letters = new Set<string>();
    uniqueArtists.forEach((artist) => {
      const first = artist.trim().charAt(0).toUpperCase();
      letters.add(/^[A-Z]$/.test(first) ? first : '#');
    });
    return ['All', ...Array.from(letters).sort((a, b) => {
      if (a === '#') return 1;
      if (b === '#') return -1;
      return a.localeCompare(b);
    })];
  }, [uniqueArtists]);

  const filteredArtistOptions = useMemo(() => {
    const query = artistSearch.trim().toLowerCase();
    return uniqueArtists.filter((artist) => {
      const first = artist.trim().charAt(0).toUpperCase();
      const letter = /^[A-Z]$/.test(first) ? first : '#';
      const matchesLetter = activeArtistLetter === 'All' || letter === activeArtistLetter;
      const matchesSearch = !query || artist.toLowerCase().includes(query);
      return matchesLetter && matchesSearch;
    });
  }, [activeArtistLetter, artistSearch, uniqueArtists]);

  const uniqueMediums = Array.from(new Set(
    artworks.map(a => a.material_used).filter(Boolean)
  )) as string[];

  const activeFiltersCount = [
    activeCategory !== 'all',
    activeMedium !== 'all',
    activeArtist !== 'all',
    activePriceRange !== 'all',
  ].filter(Boolean).length;

  useEffect(() => { setCurrentPage(1); }, [searchQuery, activeCategory, activeMedium, activePriceRange, activeArtist]);

  useEffect(() => {
    fetchData();
    const handleRefresh = () => { cachedArtworks = null; fetchData(); };
    window.addEventListener('artwork-created', handleRefresh);
    return () => window.removeEventListener('artwork-created', handleRefresh);
  }, []);

  // Sync local search from URL
  useEffect(() => { setLocalSearch(searchQuery); }, [searchQuery]);

  useEffect(() => {
    const nextSearch = localSearch.trim();
    const currentSearch = searchQuery.trim();
    const timeout = window.setTimeout(() => {
      if (nextSearch === currentSearch) return;
      setSearchParams(nextSearch ? { search: nextSearch } : {});
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [localSearch, searchQuery, setSearchParams]);

  async function fetchData() {
    if (!cachedArtworks) setLoading(true);

    const { data, error } = await supabase
      .from('artworks')
      .select('*, profiles (username, name), artwork_categories (categories (name, slug))')
      .order('created_at', { ascending: false });

    if (!error && data) {
      cachedArtworks = data as unknown as Artwork[];
      setArtworks(cachedArtworks);
      setStats({
        total: data.length,
        withArtist: new Set(data.map((a: any) => a.artist_name || a.profiles?.name || a.profiles?.username).filter(Boolean)).size,
        withProvenance: data.filter((a: any) => a.material_used || a.art_style || a.creation_year || a.collector_or_pricing || a.dimensions).length,
      });
    } else if (error) {
      const { data: safeData } = await supabase
        .from('artworks')
        .select('*, profiles (username, name)')
        .order('created_at', { ascending: false });
      if (safeData) {
        const d = safeData.map((art: any) => ({ ...art, artwork_categories: [] }));
        cachedArtworks = d as unknown as Artwork[];
        setArtworks(cachedArtworks);
        setStats({
          total: d.length,
          withArtist: new Set(d.map((a: any) => a.artist_name || a.profiles?.name || a.profiles?.username).filter(Boolean)).size,
          withProvenance: d.filter((a: any) => a.material_used || a.art_style || a.creation_year || a.collector_or_pricing || a.dimensions).length,
        });
      }
    }
    setLoading(false);
  }

  function clearAllFilters() {
    setActiveCategory('all');
    setActiveMedium('all');
    setActiveArtist('all');
    setArtistSearch('');
    setActiveArtistLetter('All');
    setActivePriceRange('all');
    setCustomMinPrice('');
    setCustomMaxPrice('');
    setLocalSearch('');
    setSearchParams({});
    setMobileFiltersOpen(false);
  }

  const filteredArtworks = artworks.filter(a => {
    if (activeCategory !== 'all') {
      const hasCat = a.artwork_categories?.some(ac => ac.categories?.slug === activeCategory);
      if (!hasCat) return false;
    }
    if (activeMedium !== 'all' && a.material_used !== activeMedium) return false;
    if (activePriceRange !== 'all') {
      const p = a.price || 0;
      if (activePriceRange === 'under500' && p >= 500) return false;
      if (activePriceRange === '500to5000' && (p < 500 || p > 5000)) return false;
      if (activePriceRange === 'over5000' && p <= 5000) return false;
      if (activePriceRange === 'custom') {
        const min = customMinPrice ? Number(customMinPrice) : 0;
        const max = customMaxPrice ? Number(customMaxPrice) : Infinity;
        if (p < min || p > max) return false;
      }
    }
    if (activeArtist !== 'all') {
      const name = getOriginalCreator(a);
      if (name !== activeArtist) return false;
    }
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase().trim();
    if (q.startsWith('#')) {
      const tagQ = q.slice(1);
      return a.tags?.some((t: string) => t.toLowerCase().includes(tagQ));
    }
    return (
      a.title.toLowerCase().includes(q) ||
      (a.description?.toLowerCase().includes(q)) ||
      (a.artist_name?.toLowerCase().includes(q)) ||
      (a.profiles?.name?.toLowerCase().includes(q)) ||
      (a.profiles?.username?.toLowerCase().includes(q)) ||
      (a.material_used?.toLowerCase().includes(q)) ||
      (a.art_style?.toLowerCase().includes(q)) ||
      (a.dimensions?.toLowerCase().includes(q)) ||
      (a.tags?.some((t: string) => t.toLowerCase().includes(q)))
    );
  });

  const totalPages = Math.ceil(filteredArtworks.length / itemsPerPage);
  const paginatedArtworks = filteredArtworks.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  function handlePageChange(page: number) {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (localSearch.trim()) {
      setSearchParams({ search: localSearch.trim() });
    } else {
      setSearchParams({});
    }
  }

  // Featured artwork = rotates among top 5
  const [featuredIndex, setFeaturedIndex] = useState(0);
  
  useEffect(() => {
    if (artworks.length === 0) return;
    const maxIndex = Math.min(artworks.length, 5);
    const timer = setInterval(() => {
      setFeaturedIndex(prev => (prev + 1) % maxIndex);
    }, 8000);
    return () => clearInterval(timer);
  }, [artworks.length]);

  const featuredArtwork = artworks[featuredIndex] || null;
  const showFeatured = mode === 'discover' && !loading && featuredArtwork && !searchQuery && activeCategory === 'all' && activeMedium === 'all' && activeArtist === 'all' && activePriceRange === 'all';

  return (
    <div className="dashboard-layout">
      {/* ─── Mobile Filter Toggle ─── */}
      <div className="mobile-filter-toggle md:hidden">
        <button className="mobile-filter-btn" onClick={() => setMobileFiltersOpen(true)} aria-label="Open artwork filters">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
          Filters {activeFiltersCount > 0 && <span style={{ background: '#b8975a', color: '#1c1917', borderRadius: '10px', padding: '0 6px', fontSize: 10, fontWeight: 700 }}>{activeFiltersCount}</span>}
        </button>
        <span style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#78716c', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
          {filteredArtworks.length} Works
        </span>
      </div>

      {/* ─── Left Filter Sidebar ─── */}
      {!sidebarVisible && (
        <button 
          className="sidebar-toggle-show hidden-desktop-toggle" 
          onClick={() => setSidebarVisible(true)}
          title="Show Filters"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="13 17 18 12 13 7"></polyline>
            <line x1="6" y1="17" x2="6" y2="7"></line>
          </svg>
        </button>
      )}

      {mobileFiltersOpen && (
        <button
          type="button"
          className="mobile-filter-backdrop"
          onClick={() => setMobileFiltersOpen(false)}
          aria-label="Close artwork filters"
        />
      )}
      
      <aside 
        className={`filter-sidebar ${mobileFiltersOpen ? 'open' : ''} ${!sidebarVisible ? 'hidden-desktop' : ''}`}
        style={{ width: mobileFiltersOpen ? undefined : sidebarWidth }}
      >
        <div 
          className="sidebar-resizer hidden-desktop-toggle"
          onMouseDown={(e) => {
            e.preventDefault();
            isResizing.current = true;
            document.body.style.cursor = 'col-resize';
          }}
        />
        <div className="sidebar-header">
          <h3>Archive Filters</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {activeFiltersCount > 0 && (
              <button className="clear-all-btn" onClick={clearAllFilters}>Clear all</button>
            )}
            <button className="close-sidebar md:hidden" onClick={() => setMobileFiltersOpen(false)} aria-label="Close artwork filters">×</button>
            <button className="close-sidebar hidden-desktop-toggle" onClick={() => setSidebarVisible(false)} title="Hide Filters" aria-label="Hide artwork filters" style={{ fontSize: '18px', display: 'flex', alignItems: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="11 17 6 12 11 7"></polyline>
                <line x1="18" y1="17" x2="18" y2="7"></line>
              </svg>
            </button>
          </div>
        </div>

        {/* Collection Type */}
        <div className="filter-section">
          <h4>Collection Type</h4>
          <div className="filter-options">
            <label className="filter-option">
              <input type="radio" name="category" checked={activeCategory === 'all'} onChange={() => setActiveCategory('all')} />
              <span>All Collections</span>
            </label>
            {categories.map(cat => (
              <label key={cat.id} className="filter-option">
                <input type="radio" name="category" checked={activeCategory === cat.slug} onChange={() => setActiveCategory(cat.slug)} />
                <span>{cat.name}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Medium */}
        {uniqueMediums.length > 0 && (
          <div className="filter-section">
            <h4>Medium</h4>
            <div className="filter-options">
              <label className="filter-option">
                <input type="radio" name="medium" checked={activeMedium === 'all'} onChange={() => setActiveMedium('all')} />
                <span>All Mediums</span>
              </label>
              {uniqueMediums.slice(0, 8).map((m, i) => (
                <label key={i} className="filter-option">
                  <input type="radio" name="medium" checked={activeMedium === m} onChange={() => setActiveMedium(m)} />
                  <span>{m}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Valuation Range */}
        <div className="filter-section">
          <h4>Valuation Range</h4>
          <div className="filter-options">
            {[
              { v: 'all', label: 'Any Valuation' },
              { v: 'under500', label: 'Under $500' },
              { v: '500to5000', label: '$500 – $5,000' },
              { v: 'over5000', label: 'Over $5,000' },
              { v: 'custom', label: 'Custom Value' },
            ].map(r => (
              <label key={r.v} className="filter-option">
                <input type="radio" name="price" checked={activePriceRange === r.v} onChange={() => setActivePriceRange(r.v)} />
                <span>{r.label}</span>
              </label>
            ))}
            
            {activePriceRange === 'custom' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
                <input 
                  type="number" 
                  placeholder="Min" 
                  value={customMinPrice}
                  onChange={(e) => setCustomMinPrice(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--beige)', background: 'var(--ivory-white)', borderRadius: 2, fontSize: 13, color: 'var(--charcoal)', outline: 'none' }}
                />
                <span style={{ color: 'var(--charcoal-light)' }}>-</span>
                <input 
                  type="number" 
                  placeholder="Max" 
                  value={customMaxPrice}
                  onChange={(e) => setCustomMaxPrice(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', border: '1px solid var(--beige)', background: 'var(--ivory-white)', borderRadius: 2, fontSize: 13, color: 'var(--charcoal)', outline: 'none' }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Artist */}
        {uniqueArtists.length > 0 && (
          <div className="filter-section">
            <div className="filter-section-heading-row">
              <h4>Artist</h4>
              {activeArtist !== 'all' && (
                <button type="button" className="filter-mini-reset" onClick={() => setActiveArtist('all')}>
                  Reset
                </button>
              )}
            </div>

            <div className="artist-filter-tools">
              <input
                type="search"
                value={artistSearch}
                onChange={(event) => setArtistSearch(event.target.value)}
                placeholder="Find artist"
                aria-label="Find artist"
              />

              <div className="artist-letter-filter" aria-label="Filter artists by first letter">
                {artistLetters.map((letter) => (
                  <button
                    key={letter}
                    type="button"
                    className={activeArtistLetter === letter ? 'active' : ''}
                    onClick={() => setActiveArtistLetter(letter)}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-options artist-filter-options">
              <label className="filter-option">
                <input
                  type="radio"
                  name="artist"
                  checked={activeArtist === 'all'}
                  onChange={() => setActiveArtist('all')}
                />
                <span>All Artists</span>
              </label>

              {filteredArtistOptions.length === 0 ? (
                <div className="artist-filter-empty">No matching artists</div>
              ) : (
                filteredArtistOptions.map((artist) => (
                <label key={artist} className="filter-option">
                  <input type="radio" name="artist" checked={activeArtist === artist} onChange={() => setActiveArtist(artist)} />
                  <span>{artist}</span>
                </label>
                ))
              )}
            </div>
          </div>
        )}
      </aside>

      {/* ─── Main Registry Content ─── */}
      <main className="registry-content">

        {/* ── Registry Masthead ──────────────────────────────── */}
        <div className="registry-masthead">
          <div className="registry-masthead-left">
            <span className="registry-masthead-title">{mode === 'registry' ? 'Accession Registry' : 'Collection Registry'}</span>
            {searchQuery && (
              <span className="registry-search-context">
                Results for <em>"{searchQuery}"</em>
              </span>
            )}
          </div>
          <div className="registry-masthead-stats">
            <div className="masthead-stat">
              <span className="masthead-stat-value">{loading ? '-' : stats.total.toLocaleString()}</span>
              <span className="masthead-stat-label">Registered Works</span>
            </div>
            <div className="masthead-stat-divider" />
            <div className="masthead-stat">
              <span className="masthead-stat-value">{loading ? '-' : stats.withArtist.toLocaleString()}</span>
              <span className="masthead-stat-label">Verified Artists</span>
            </div>
            <div className="masthead-stat-divider" />
            <div className="masthead-stat">
              <span className="masthead-stat-value">{loading ? '-' : stats.withProvenance.toLocaleString()}</span>
              <span className="masthead-stat-label">Provenance Records</span>
            </div>
          </div>
        </div>

        {/* ── Enterprise Search Panel ────────────────────────── */}
        <div className="search-panel">
          <form className="search-panel-form" onSubmit={handleSearchSubmit}>
            <div className="search-panel-inner">
              <svg className="search-panel-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                className="search-panel-input"
                placeholder="Search by artist, medium, title, or period..."
                aria-label="Search the artwork registry"
                value={localSearch}
                onChange={e => setLocalSearch(e.target.value)}
              />
              {localSearch && (
                <button type="button" className="search-panel-clear" aria-label="Clear registry search" onClick={() => { setLocalSearch(''); setSearchParams({}); }}>
                  x
                </button>
              )}
              <button type="submit" className="search-panel-btn">Search Registry</button>
            </div>
          </form>
          <div className="search-live-status" aria-live="polite">
            {searchQuery
              ? `${filteredArtworks.length} live result${filteredArtworks.length !== 1 ? 's' : ''} for "${searchQuery}"`
              : `Showing all ${filteredArtworks.length} registered work${filteredArtworks.length !== 1 ? 's' : ''}`}
          </div>
        </div>

        {/* ── Provenance Strip ───────────────────────────────── */}
        {mode === 'discover' && (
          <div className="provenance-strip">
            <span className="provenance-strip-icon">AV</span>
            <p className="provenance-strip-text">
              Every work in the ArtVault Registry maintains documented ownership, exhibition history, and legal provenance in accordance with institutional archival standards.
            </p>
          </div>
        )}

        {/* ── Featured Acquisition ──────────────────────────── */}
        {showFeatured && featuredArtwork && (
          <FeaturedAcquisition artwork={featuredArtwork} onClick={() => setActiveArtwork(featuredArtwork)} />
        )}

        {/* ── Collection Registry Header ────────────────────── */}
        <div className="collection-header">
          <div className="collection-header-left">
            <div className="museum-rule-inline">
              <span className="museum-rule-text">
                {searchQuery
                  ? `Search Results - ${filteredArtworks.length} Work${filteredArtworks.length !== 1 ? 's' : ''}`
                  : activeFiltersCount > 0
                  ? `Filtered Registry - ${filteredArtworks.length} Work${filteredArtworks.length !== 1 ? 's' : ''}`
                  : mode === 'registry'
                  ? 'Accession Index'
                  : 'Full Collection Registry'}
              </span>
            </div>
          </div>
          <div className="collection-header-right">
            {/* View toggle */}
            <div className="view-toggle">
              <button
                className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
                onClick={() => setViewMode('grid')}
                title="Grid view"
                aria-label="Show artworks in a grid"
                aria-pressed={viewMode === 'grid'}
              >
                <GridIcon />
              </button>
              <button
                className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
                onClick={() => setViewMode('list')}
                title="List view"
                aria-label="Show artworks in a list"
                aria-pressed={viewMode === 'list'}
              >
                <ListIcon />
              </button>
            </div>
          </div>
        </div>

        {/* ── Registry Content ──────────────────────────────── */}
        {loading ? (
          <div className={viewMode === 'grid' ? 'catalog-grid' : 'catalog-list'}>
            {Array.from({ length: 9 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : filteredArtworks.length === 0 ? (
          <div className="registry-empty">
            <div className="registry-empty-icon">AV</div>
            <h3 className="registry-empty-title">No Works Found</h3>
            <p className="registry-empty-desc">
              {searchQuery
                ? `No catalog entries match "${searchQuery}". Try a different artist, medium, or title.`
                : 'No works match the current archive filters. Clear filters to view the full collection.'}
            </p>
            <button className="registry-empty-btn" onClick={clearAllFilters}>Clear Filters & View All</button>
          </div>
        ) : (
          <>
            {viewMode === 'grid' ? (
              <div className="catalog-grid">
                {paginatedArtworks.map(artwork => (
                  <CatalogCard key={artwork.id} artwork={artwork} onClick={() => setActiveArtwork(artwork)} />
                ))}
              </div>
            ) : (
              <div className="catalog-list">
                {paginatedArtworks.map(artwork => (
                  <CatalogRow key={artwork.id} artwork={artwork} onClick={() => setActiveArtwork(artwork)} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="registry-pagination">
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <div className="pagination-pages">
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    let page: number;
                    if (totalPages <= 7) {
                      page = i + 1;
                    } else if (currentPage <= 4) {
                      page = i + 1;
                    } else if (currentPage >= totalPages - 3) {
                      page = totalPages - 6 + i;
                    } else {
                      page = currentPage - 3 + i;
                    }
                    return (
                      <button
                        key={page}
                        className={`pagination-page ${currentPage === page ? 'active' : ''}`}
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>
                <button
                  className="pagination-btn"
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* ─── Artwork Lightbox ─── */}
      {activeArtwork && (
        <Lightbox
          artwork={{ ...activeArtwork, image_url: resolveArtworkImageUrl(activeArtwork.image_url) }}
          artistName={activeArtwork.artist_name || activeArtwork.profiles?.username || activeArtwork.profiles?.name || 'Unknown Artist'}
          onClose={() => setActiveArtwork(null)}
          currentUser={user}
        />
      )}
    </div>
  );
}
