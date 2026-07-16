import { useState, useEffect, useRef, useMemo, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeftRight, ChevronLeft, ChevronRight, RefreshCw, Shuffle } from 'lucide-react';
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
  discover_display_rank?: number | null;
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

type DiscoveryEra = 'all' | 'before-1800' | '1800s' | 'early-1900s' | 'post-1950';
type DiscoveryPath = 'unexpected' | 'old-masters' | 'paper' | 'modern';

const DISCOVERY_ERAS: { id: DiscoveryEra; label: string }[] = [
  { id: 'all', label: 'All periods' },
  { id: 'before-1800', label: 'Before 1800' },
  { id: '1800s', label: '1800-1899' },
  { id: 'early-1900s', label: '1900-1949' },
  { id: 'post-1950', label: '1950-now' },
];

const DISCOVERY_PATHS: { id: DiscoveryPath; label: string; description: string }[] = [
  { id: 'unexpected', label: 'Unexpected', description: 'Three distant records brought together by chance.' },
  { id: 'old-masters', label: 'Old masters', description: 'Works made before 1800, read through the present archive.' },
  { id: 'paper', label: 'On paper', description: 'Drawings, watercolors, pastels, and works shaped by paper.' },
  { id: 'modern', label: 'Modern voices', description: 'Twentieth-century and contemporary positions in the collection.' },
];

function getNumericArtworkYear(value?: string | null): number | null {
  if (!value) return null;
  const match = String(value).match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  return match ? Number(match[1]) : null;
}

function artworkMatchesEra(artwork: Artwork, era: DiscoveryEra): boolean {
  if (era === 'all') return true;
  const year = getNumericArtworkYear(artwork.creation_year);
  if (year === null) return false;
  if (era === 'before-1800') return year < 1800;
  if (era === '1800s') return year >= 1800 && year <= 1899;
  if (era === 'early-1900s') return year >= 1900 && year <= 1949;
  return year >= 1950;
}

function artworkMatchesDiscoveryPath(artwork: Artwork, path: DiscoveryPath): boolean {
  if (path === 'unexpected') return true;
  const year = getNumericArtworkYear(artwork.creation_year);
  if (path === 'old-masters') return year !== null && year < 1800;
  if (path === 'modern') return year !== null && year >= 1900;
  const material = `${artwork.material_used || ''} ${artwork.medium || ''} ${artwork.art_style || ''}`.toLowerCase();
  return ['paper', 'watercolor', 'pastel', 'charcoal', 'graphite', 'gouache', 'drawing'].some((term) => material.includes(term));
}

let cachedArtworks: Artwork[] | null = null;
const DISCOVERY_SCROLL_STORAGE_KEY = 'artvault:discover-return-scroll';

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
  const [loadError, setLoadError] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(mode === 'registry' ? 'list' : 'grid');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(264);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const isResizing = useRef(false);
  
  const [currentPage, setCurrentPage] = useState(1);
  const [activeDiscoveryPath, setActiveDiscoveryPath] = useState<DiscoveryPath>('unexpected');
  const [discoveryPathSeed, setDiscoveryPathSeed] = useState(0);
  const [activeDiscoveryEra, setActiveDiscoveryEra] = useState<DiscoveryEra>('all');
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [spotlightPaused, setSpotlightPaused] = useState(false);
  const [dialogueIndex, setDialogueIndex] = useState(0);
  const itemsPerPage = 10;
  const searchInputRef = useRef<HTMLInputElement>(null);
  const promenadeRef = useRef<HTMLDivElement>(null);

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
  const artistQuery = searchParams.get('artist') || '';
  const discoveryReturnScrollRef = useRef<number | null>(null);
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
    if (mode !== 'discover') return;
    setActiveCategory('all');
    setActiveMedium('all');
    setActiveArtist(artistQuery || 'all');
    setArtistSearch('');
    setActiveArtistLetter('All');
    setActivePriceRange('all');
    setCustomMinPrice('');
    setCustomMaxPrice('');
    setMobileFiltersOpen(false);
    setLocalSearch('');
    if (searchQuery) setSearchParams(artistQuery ? { artist: artistQuery } : {});
  }, [artistQuery, mode, searchQuery, setSearchParams]);

  useEffect(() => {
    fetchData();
    const handleRefresh = () => { cachedArtworks = null; fetchData(); };
    window.addEventListener('artwork-created', handleRefresh);
    return () => window.removeEventListener('artwork-created', handleRefresh);
  }, []);

  // Sync local search from URL
  useEffect(() => { setLocalSearch(mode === 'registry' ? searchQuery : ''); }, [mode, searchQuery]);

  useEffect(() => {
    if (mode !== 'discover' || artistQuery) return;

    const storedPosition = window.sessionStorage.getItem(DISCOVERY_SCROLL_STORAGE_KEY);
    const returnPosition = discoveryReturnScrollRef.current ?? (storedPosition === null ? null : Number(storedPosition));
    if (returnPosition === null || !Number.isFinite(returnPosition)) return;

    const restorePosition = () => {
      const root = document.documentElement;
      const previousScrollBehavior = root.style.scrollBehavior;
      root.style.scrollBehavior = 'auto';
      window.scrollTo(0, returnPosition);
      root.style.scrollBehavior = previousScrollBehavior;
    };

    let secondFrame = 0;
    const frame = window.requestAnimationFrame(() => {
      restorePosition();
      secondFrame = window.requestAnimationFrame(restorePosition);
    });
    const finalRestore = window.setTimeout(() => {
      restorePosition();
      discoveryReturnScrollRef.current = null;
      window.sessionStorage.removeItem(DISCOVERY_SCROLL_STORAGE_KEY);
    }, 120);
    return () => {
      window.cancelAnimationFrame(frame);
      window.cancelAnimationFrame(secondFrame);
      window.clearTimeout(finalRestore);
    };
  }, [artistQuery, mode]);

  useEffect(() => {
    if (mode !== 'registry') return;
    const nextSearch = localSearch.trim();
    const currentSearch = searchQuery.trim();
    const timeout = window.setTimeout(() => {
      if (nextSearch === currentSearch) return;
      setSearchParams(nextSearch ? { search: nextSearch } : {});
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [localSearch, mode, searchQuery, setSearchParams]);

  async function fetchData() {
    if (!cachedArtworks) setLoading(true);
    setLoadError('');

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
      const { data: safeData, error: safeError } = await supabase
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
      } else {
        setLoadError(safeError?.message || 'The collection could not be loaded.');
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

  const discoveryPathCounts = useMemo(() => {
    return DISCOVERY_PATHS.reduce<Record<DiscoveryPath, number>>((counts, path) => {
      counts[path.id] = artworks.filter((artwork) => artworkMatchesDiscoveryPath(artwork, path.id)).length;
      return counts;
    }, { unexpected: 0, 'old-masters': 0, paper: 0, modern: 0 });
  }, [artworks]);

  const discoveryPathPool = useMemo(
    () => artworks.filter((artwork) => artworkMatchesDiscoveryPath(artwork, activeDiscoveryPath)),
    [activeDiscoveryPath, artworks]
  );

  const discoveryPathWorks = useMemo(() => {
    const pool = discoveryPathPool.length > 0 ? discoveryPathPool : artworks;
    if (pool.length <= 3) return pool;
    const offset = discoveryPathSeed % pool.length;
    const rotated = [...pool.slice(offset), ...pool.slice(0, offset)];
    const positions = [0, Math.floor(rotated.length / 3), Math.floor(rotated.length * 2 / 3)];
    return positions.map((position) => rotated[position]);
  }, [artworks, discoveryPathPool, discoveryPathSeed]);

  const activeDiscoveryPathMeta = DISCOVERY_PATHS.find((path) => path.id === activeDiscoveryPath) || DISCOVERY_PATHS[0];

  const curatedDiscoverWorks = useMemo(() => artworks
    .filter((artwork) => artwork.discover_display_rank != null)
    .sort((a, b) => Number(a.discover_display_rank) - Number(b.discover_display_rank)), [artworks]);

  const promenadeWorks = useMemo(() => {
    if (curatedDiscoverWorks.length > 0) return curatedDiscoverWorks.slice(0, 6);
    if (artworks.length <= 6) return artworks;
    const step = Math.max(1, Math.floor(artworks.length / 6));
    return Array.from({ length: 6 }, (_, index) => artworks[index * step]).filter(Boolean);
  }, [artworks, curatedDiscoverWorks]);

  const discoveryEraCounts = useMemo(() => {
    return DISCOVERY_ERAS.reduce<Record<DiscoveryEra, number>>((counts, era) => {
      counts[era.id] = artworks.filter((artwork) => artworkMatchesEra(artwork, era.id)).length;
      return counts;
    }, { all: 0, 'before-1800': 0, '1800s': 0, 'early-1900s': 0, 'post-1950': 0 });
  }, [artworks]);

  const discoveryEraPool = useMemo(
    () => artworks.filter((artwork) => artworkMatchesEra(artwork, activeDiscoveryEra)),
    [activeDiscoveryEra, artworks]
  );

  const discoverySelection = useMemo(() => {
    if (discoveryEraPool.length <= 3) return discoveryEraPool;
    const step = Math.max(1, Math.floor(discoveryEraPool.length / 3));
    return [discoveryEraPool[0], discoveryEraPool[step], discoveryEraPool[step * 2]];
  }, [discoveryEraPool]);

  const spotlightArtists = useMemo(() => {
    const groups = new Map<string, Artwork[]>();
    artworks.forEach((artwork) => {
      const artist = getOriginalCreator(artwork);
      const existing = groups.get(artist) || [];
      existing.push(artwork);
      groups.set(artist, existing);
    });
    return Array.from(groups, ([name, works]) => ({ name, works }))
      .filter(({ name, works }) => works.length >= 2 && name !== 'ArtVault Contributor')
      .sort((a, b) => b.works.length - a.works.length || a.name.localeCompare(b.name));
  }, [artworks]);

  const spotlightArtist = spotlightArtists.length > 0
    ? spotlightArtists[spotlightIndex % spotlightArtists.length]
    : null;

  const spotlightSummary = useMemo(() => {
    if (!spotlightArtist) return { medium: 'Mixed practice', styleCount: 0 };
    const mediumCounts = new Map<string, number>();
    spotlightArtist.works.forEach((artwork) => {
      const medium = artwork.material_used || 'Unspecified medium';
      mediumCounts.set(medium, (mediumCounts.get(medium) || 0) + 1);
    });
    const medium = Array.from(mediumCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Mixed practice';
    const styleCount = new Set(spotlightArtist.works.map((artwork) => artwork.art_style).filter(Boolean)).size;
    return { medium, styleCount };
  }, [spotlightArtist]);

  const dialoguePair = useMemo<[Artwork, Artwork] | null>(() => {
    if (artworks.length < 2) return null;
    const first = artworks[dialogueIndex % artworks.length];
    const firstYear = getNumericArtworkYear(first.creation_year);
    const candidates = artworks.filter((artwork) => {
      if (artwork.id === first.id || getOriginalCreator(artwork) === getOriginalCreator(first)) return false;
      const year = getNumericArtworkYear(artwork.creation_year);
      return firstYear === null || year === null || Math.abs(firstYear - year) >= 40;
    });
    const pool = candidates.length > 0 ? candidates : artworks.filter((artwork) => artwork.id !== first.id);
    const second = pool[(dialogueIndex * 7 + Math.floor(pool.length / 2)) % pool.length];
    return [first, second];
  }, [artworks, dialogueIndex]);

  const dialogueNote = useMemo(() => {
    if (!dialoguePair) return '';
    const [first, second] = dialoguePair;
    const firstYear = getNumericArtworkYear(first.creation_year);
    const secondYear = getNumericArtworkYear(second.creation_year);
    if (firstYear !== null && secondYear !== null) {
      return `${Math.abs(firstYear - secondYear)} years apart`;
    }
    if (first.material_used && first.material_used === second.material_used) {
      return `A shared ${first.material_used.toLowerCase()} practice`;
    }
    return `${first.material_used || 'One medium'} meets ${second.material_used || 'another'}`;
  }, [dialoguePair]);

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

  function openSurpriseArtwork() {
    if (discoveryEraPool.length === 0) return;
    const randomIndex = Math.floor(Math.random() * discoveryEraPool.length);
    setActiveArtwork(discoveryEraPool[randomIndex]);
  }

  function moveArtistSpotlight(direction: number) {
    if (spotlightArtists.length === 0) return;
    setSpotlightIndex((current) => (current + direction + spotlightArtists.length) % spotlightArtists.length);
  }

  function openSpotlightCatalog() {
    if (!spotlightArtist) return;
    const returnPosition = window.scrollY;
    discoveryReturnScrollRef.current = returnPosition;
    window.sessionStorage.setItem(DISCOVERY_SCROLL_STORAGE_KEY, String(returnPosition));
    setSearchParams({ artist: spotlightArtist.name });
    setCurrentPage(1);
    window.setTimeout(() => {
      document.querySelector('.discovery-catalog-return, .collection-header')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function returnToDiscovery() {
    setActiveArtist('all');
    setSearchParams({});
    setCurrentPage(1);
  }

  function movePromenade(direction: number) {
    const viewport = promenadeRef.current;
    if (!viewport) return;
    viewport.scrollBy({ left: direction * viewport.clientWidth * 0.72, behavior: 'smooth' });
  }

  // Administrators may curate the Discover rotation; otherwise use recent works.
  const [featuredIndex, setFeaturedIndex] = useState(0);
  const featuredRotationWorks = curatedDiscoverWorks.length > 0
    ? curatedDiscoverWorks
    : artworks.slice(0, 5);
  
  useEffect(() => {
    if (featuredRotationWorks.length === 0) return;
    setFeaturedIndex(0);
    const timer = setInterval(() => {
      setFeaturedIndex(prev => (prev + 1) % featuredRotationWorks.length);
    }, 8000);
    return () => clearInterval(timer);
  }, [featuredRotationWorks.length]);

  useEffect(() => {
    if (mode !== 'discover' || spotlightPaused || spotlightArtists.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = window.setInterval(() => {
      setSpotlightIndex((current) => (current + 1) % spotlightArtists.length);
    }, 12000);
    return () => window.clearInterval(timer);
  }, [mode, spotlightArtists.length, spotlightPaused]);

  const featuredArtwork = featuredRotationWorks[featuredIndex % Math.max(featuredRotationWorks.length, 1)] || null;
  const showDiscoveryExperience = mode === 'discover' && !loading && !loadError && artworks.length > 0 && !searchQuery && activeCategory === 'all' && activeMedium === 'all' && activeArtist === 'all' && activePriceRange === 'all';
  const showFeatured = showDiscoveryExperience && featuredArtwork;
  const showCatalogIndex = mode === 'registry' || !showDiscoveryExperience;

  useEffect(() => {
    if (!showDiscoveryExperience) return;
    const elements = Array.from(document.querySelectorAll<HTMLElement>(
      '.discovery-portal, .featured-acquisition, .curatorial-lens, .museum-promenade, .artist-spotlight, .visual-dialogue'
    ));
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      elements.forEach((element) => element.classList.add('discover-motion-visible'));
      return;
    }

    elements.forEach((element) => element.classList.add('discover-motion-ready'));
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('discover-motion-visible');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [showDiscoveryExperience]);

  return (
    <div className="dashboard-layout">
      {mode === 'registry' && (
        <>
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
        </>
      )}

      {/* ─── Main Registry Content ─── */}
      <main className={`registry-content ${mode === 'discover' ? 'discover-content' : ''}`}>

        {showDiscoveryExperience && (
          <section className="discovery-portal" aria-labelledby="discovery-portal-title">
            <div className="discovery-portal-copy">
              <div className="discovery-portal-eyebrow">
                <span>Discovery Room</span>
                <span>{artworks.length} works in motion</span>
              </div>
              <h1 id="discovery-portal-title">Begin with what catches your eye.</h1>
              <p className="discovery-portal-intro">
                Move through the collection by instinct, material, period, and unexpected kinship.
              </p>

              <div className="discovery-path-nav" aria-label="Choose a discovery path">
                {DISCOVERY_PATHS.map((path) => (
                  <button
                    key={path.id}
                    type="button"
                    className={activeDiscoveryPath === path.id ? 'active' : ''}
                    aria-pressed={activeDiscoveryPath === path.id}
                    disabled={discoveryPathCounts[path.id] === 0}
                    onClick={() => {
                      setActiveDiscoveryPath(path.id);
                      setDiscoveryPathSeed(0);
                    }}
                  >
                    <span>{path.label}</span>
                    <small>{discoveryPathCounts[path.id]}</small>
                  </button>
                ))}
              </div>

              <div className="discovery-path-note" aria-live="polite">
                <div>
                  <span>Current path</span>
                  <p>{activeDiscoveryPathMeta.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setDiscoveryPathSeed((seed) => seed + 7)}
                  disabled={discoveryPathWorks.length < 2}
                >
                  <Shuffle size={15} /> Reshuffle
                </button>
              </div>
            </div>

            <div className="discovery-portal-stage">
              {discoveryPathWorks.map((artwork, index) => (
                <button
                  key={`${activeDiscoveryPath}-${artwork.id}`}
                  type="button"
                  className={`discovery-portal-work discovery-portal-work-${index + 1}`}
                  onClick={() => setActiveArtwork(artwork)}
                  aria-label={`Open ${artwork.title} by ${getOriginalCreator(artwork)}`}
                >
                  <span
                    className="discovery-portal-work-backdrop"
                    style={{ backgroundImage: `url("${optimizedUrl(artwork.image_url, 1000, 82)}")` }}
                    aria-hidden="true"
                  />
                  <img
                    src={optimizedUrl(artwork.image_url, index === 0 ? 1200 : 800, 88)}
                    alt=""
                    decoding="async"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                      event.currentTarget.parentElement?.classList.add('image-unavailable');
                    }}
                  />
                  <span className="discovery-portal-work-shade" />
                  <span className="discovery-portal-work-copy">
                    <small>{String(index + 1).padStart(2, '0')} / {formatYear(artwork.creation_year) || 'Undated'}</small>
                    <strong>{artwork.title}</strong>
                    <span>{getOriginalCreator(artwork)}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── Registry Masthead ──────────────────────────────── */}
        {mode === 'registry' && <div className="registry-masthead">
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
        </div>}

        {/* ── Enterprise Search Panel ────────────────────────── */}
        {mode === 'registry' && <div className="search-panel">
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
        </div>}

        {/* ── Featured Acquisition ──────────────────────────── */}
        {showFeatured && featuredArtwork && (
          <FeaturedAcquisition key={featuredArtwork.id} artwork={featuredArtwork} onClick={() => setActiveArtwork(featuredArtwork)} />
        )}

        {/* ── Curatorial Lens ───────────────────────────────── */}
        {showDiscoveryExperience && artworks.length > 0 && (
          <section className="curatorial-lens" aria-labelledby="curatorial-lens-title">
            <div className="curatorial-lens-header">
              <div className="curatorial-lens-heading">
                <span className="curatorial-lens-kicker">Curatorial Lens</span>
                <h2 id="curatorial-lens-title">A route through time</h2>
                <p>Five centuries of practice, material, and provenance drawn from the live collection.</p>
              </div>
              <button
                type="button"
                className="curatorial-surprise-btn"
                onClick={openSurpriseArtwork}
                disabled={discoveryEraPool.length === 0}
              >
                <Shuffle size={16} /> Surprise Me
              </button>
            </div>

            <div className="curatorial-era-nav" aria-label="Browse discovery works by period">
              {DISCOVERY_ERAS.map((era) => (
                <button
                  key={era.id}
                  type="button"
                  className={activeDiscoveryEra === era.id ? 'active' : ''}
                  aria-pressed={activeDiscoveryEra === era.id}
                  disabled={discoveryEraCounts[era.id] === 0}
                  onClick={() => setActiveDiscoveryEra(era.id)}
                >
                  <span>{era.label}</span>
                  <small>{discoveryEraCounts[era.id]}</small>
                </button>
              ))}
            </div>

            {discoverySelection.length > 0 ? (
              <div className="curatorial-mosaic">
                {discoverySelection.map((artwork, index) => (
                  <button
                    key={artwork.id}
                    type="button"
                    className={`curatorial-work ${index === 0 ? 'curatorial-work-primary' : ''}`}
                    onClick={() => setActiveArtwork(artwork)}
                    aria-label={`Open ${artwork.title} by ${getOriginalCreator(artwork)}`}
                  >
                    <img
                      src={optimizedUrl(artwork.image_url, index === 0 ? 1200 : 700, 86)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                        event.currentTarget.parentElement?.classList.add('image-unavailable');
                      }}
                    />
                    <span className="curatorial-work-shade" />
                    <span className="curatorial-work-copy">
                      <small>{getRegistryNumber(artwork.id)}{artwork.creation_year ? ` / ${formatYear(artwork.creation_year)}` : ''}</small>
                      <strong>{artwork.title}</strong>
                      <span>{getOriginalCreator(artwork)}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="curatorial-empty">No dated works are available for this period.</div>
            )}
          </section>
        )}

        {/* ── Museum Promenade ──────────────────────────────── */}
        {showDiscoveryExperience && promenadeWorks.length > 0 && (
          <section className="museum-promenade" aria-labelledby="museum-promenade-title">
            <div className="museum-promenade-header">
              <div>
                <span className="museum-promenade-kicker">Open Display / Gallery 01</span>
                <h2 id="museum-promenade-title">The collection, installed</h2>
                <p>A changing salon of works brought out of the archive and into conversation.</p>
              </div>
              <div className="museum-promenade-controls" aria-label="Move through the gallery display">
                <button type="button" onClick={() => movePromenade(-1)} aria-label="Previous gallery works" title="Previous works">
                  <ChevronLeft size={19} />
                </button>
                <button type="button" onClick={() => movePromenade(1)} aria-label="Next gallery works" title="Next works">
                  <ChevronRight size={19} />
                </button>
              </div>
            </div>

            <div className="museum-promenade-viewport" ref={promenadeRef}>
              <div className="museum-promenade-wall">
                {promenadeWorks.map((artwork, index) => (
                  <article key={artwork.id} className={`museum-promenade-piece museum-promenade-piece-${index % 3}`}>
                    <button
                      type="button"
                      className="museum-promenade-frame"
                      onClick={() => setActiveArtwork(artwork)}
                      aria-label={`Open ${artwork.title} by ${getOriginalCreator(artwork)}`}
                    >
                      <span className="museum-promenade-mat">
                        <img
                          src={optimizedUrl(artwork.image_url, 800, 88)}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                            event.currentTarget.closest('.museum-promenade-frame')?.classList.add('image-unavailable');
                          }}
                        />
                      </span>
                    </button>
                    <div className="museum-promenade-label">
                      <small>{getRegistryNumber(artwork.id)} / {formatYear(artwork.creation_year) || 'Undated'}</small>
                      <strong>{artwork.title}</strong>
                      <span>{getOriginalCreator(artwork)}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
            <div className="museum-promenade-floorline" aria-hidden="true"><span>ArtVault / Permanent Collection</span></div>
          </section>
        )}

        {/* ── Artist Spotlight ──────────────────────────────── */}
        {showDiscoveryExperience && spotlightArtist && (
          <section
            className="artist-spotlight"
            aria-labelledby="artist-spotlight-title"
            onMouseEnter={() => setSpotlightPaused(true)}
            onMouseLeave={() => setSpotlightPaused(false)}
            onFocusCapture={() => setSpotlightPaused(true)}
            onBlurCapture={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setSpotlightPaused(false);
            }}
          >
            <div className="artist-spotlight-gallery">
              {spotlightArtist.works.slice(0, 3).map((artwork, index) => (
                <button
                  key={artwork.id}
                  type="button"
                  className={index === 0 ? 'artist-spotlight-work primary' : 'artist-spotlight-work'}
                  onClick={() => setActiveArtwork(artwork)}
                  aria-label={`Open ${artwork.title}`}
                >
                  <img
                    src={optimizedUrl(artwork.image_url, index === 0 ? 1000 : 600, 86)}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none';
                      event.currentTarget.parentElement?.classList.add('image-unavailable');
                    }}
                  />
                  <span>{artwork.title}</span>
                </button>
              ))}
            </div>

            <div className="artist-spotlight-info">
              <div className="artist-spotlight-topline">
                <span className="artist-spotlight-kicker">Artist Spotlight</span>
                <div className="artist-spotlight-controls">
                  <button type="button" onClick={() => moveArtistSpotlight(-1)} aria-label="Previous featured artist" title="Previous artist">
                    <ChevronLeft size={18} />
                  </button>
                  <span>{spotlightIndex % spotlightArtists.length + 1} / {spotlightArtists.length}</span>
                  <button type="button" onClick={() => moveArtistSpotlight(1)} aria-label="Next featured artist" title="Next artist">
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
              <h2 id="artist-spotlight-title">{spotlightArtist.name}</h2>
              <p>
                {spotlightArtist.works.length} registered works trace a distinct practice across the ArtVault collection.
              </p>
              <div className="artist-spotlight-metrics">
                <div><small>Registered Works</small><strong>{spotlightArtist.works.length}</strong></div>
                <div><small>Primary Medium</small><strong>{spotlightSummary.medium}</strong></div>
                <div><small>Documented Styles</small><strong>{spotlightSummary.styleCount || 1}</strong></div>
              </div>
              <div className="artist-spotlight-actions">
                <button type="button" className="artist-spotlight-primary-btn" onClick={openSpotlightCatalog}>View Artist Catalog</button>
                <button type="button" className="artist-spotlight-secondary-btn" onClick={() => setActiveArtwork(spotlightArtist.works[0])}>Open Featured Work</button>
              </div>
            </div>
          </section>
        )}

        {/* ── Visual Dialogue ───────────────────────────────── */}
        {showDiscoveryExperience && dialoguePair && (
          <section className="visual-dialogue" aria-labelledby="visual-dialogue-title">
            <div className="visual-dialogue-header">
              <div>
                <span className="visual-dialogue-kicker">Visual Dialogue</span>
                <h2 id="visual-dialogue-title">Two records, one conversation</h2>
              </div>
              <button type="button" className="visual-dialogue-refresh" onClick={() => setDialogueIndex((current) => current + 1)}>
                <RefreshCw size={15} /> New Dialogue
              </button>
            </div>

            <div className="visual-dialogue-stage">
              {dialoguePair.map((artwork, index) => (
                <button
                  key={artwork.id}
                  type="button"
                  className={`visual-dialogue-work visual-dialogue-work-${index + 1}`}
                  onClick={() => setActiveArtwork(artwork)}
                  aria-label={`Open ${artwork.title} by ${getOriginalCreator(artwork)}`}
                >
                  <span className="visual-dialogue-image">
                    <img
                      src={optimizedUrl(artwork.image_url, 900, 86)}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                        event.currentTarget.parentElement?.classList.add('image-unavailable');
                      }}
                    />
                  </span>
                  <span className="visual-dialogue-copy">
                    <small>{artwork.creation_year ? formatYear(artwork.creation_year) : 'Undated'} / {artwork.material_used || 'Medium not recorded'}</small>
                    <strong>{artwork.title}</strong>
                    <span>{getOriginalCreator(artwork)}</span>
                  </span>
                </button>
              ))}

              <div className="visual-dialogue-bridge" aria-hidden="true">
                <span><ArrowLeftRight size={19} /></span>
                <strong>{dialogueNote}</strong>
                <small>Different hands. Shared archive.</small>
              </div>
            </div>
          </section>
        )}

        {/* ── Collection Registry Header ────────────────────── */}
        {showCatalogIndex && (
          <>
        {mode === 'discover' && activeArtist !== 'all' && (
          <div className="discovery-catalog-return">
            <button type="button" onClick={returnToDiscovery}>
              <ChevronLeft size={18} /> Back to Discover
            </button>
            <div>
              <span>Artist Catalog</span>
              <strong>{activeArtist}</strong>
            </div>
          </div>
        )}
        <div className="collection-header">
          <div className="collection-header-left">
            <div className="museum-rule-inline">
              <span className="museum-rule-text">
                {searchQuery
                  ? `Search Results - ${filteredArtworks.length} Work${filteredArtworks.length !== 1 ? 's' : ''}`
                  : mode === 'discover' && activeArtist !== 'all'
                  ? `${activeArtist} - ${filteredArtworks.length} Work${filteredArtworks.length !== 1 ? 's' : ''}`
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
            <h3 className="registry-empty-title">
              {loadError ? 'Collection Temporarily Unavailable' : artworks.length === 0 ? 'No Registered Works Yet' : 'No Works Found'}
            </h3>
            <p className="registry-empty-desc">
              {loadError
                ? 'ArtVault could not retrieve the collection. Your filters and account remain unchanged.'
                : artworks.length === 0
                ? 'The collection is currently empty. Retry to check for newly registered works.'
                : searchQuery
                ? `No catalog entries match "${searchQuery}". Try a different artist, medium, or title.`
                : 'No works match the current archive filters. Clear filters to view the full collection.'}
            </p>
            <button
              className="registry-empty-btn"
              onClick={loadError || artworks.length === 0 ? () => { cachedArtworks = null; void fetchData(); } : clearAllFilters}
            >
              {loadError || artworks.length === 0 ? 'Retry Collection' : 'Clear Filters & View All'}
            </button>
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
