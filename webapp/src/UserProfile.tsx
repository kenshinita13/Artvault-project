import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from './supabaseClient';
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  Globe2,
  Image as ImageIcon,
  Layers3,
  Pencil,
  Search,
  Save,
  Star,
  Trash2,
  Upload,
  UserRound,
  X,
} from 'lucide-react';
import Avatar from './Avatar';
import Lightbox from './Lightbox';
import { logAudit } from './auditHelper';
import { canUpload } from './roles';
import './Dashboard.css';
import './UserProfile.css';

interface Profile {
  id: string;
  name: string;
  username: string;
  role: string;
  about_me?: string | null;
  profile_summary?: string | null;
  profile_title?: string | null;
  is_verified?: boolean;
  status?: 'active' | 'suspended' | 'banned';
  created_at?: string;
}

interface Artwork {
  id: string;
  user_id: string;
  title: string;
  description: string;
  image_url: string;
  created_at: string;
  artist_name?: string;
  creation_year?: string | number;
  medium?: string;
  material_used?: string;
  art_style?: string;
  dimensions?: string;
  profile_featured_rank?: number | null;
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

function ArtworkImage({ artwork, className = '' }: { artwork: Artwork; className?: string }) {
  const [failed, setFailed] = useState(false);

  if (failed || !artwork.image_url) {
    return (
      <div className={`artist-artwork-fallback ${className}`} role="img" aria-label={`${artwork.title} image unavailable`}>
        <ImageIcon size={26} aria-hidden="true" />
        <span>Image unavailable</span>
      </div>
    );
  }

  return (
    <img
      src={artwork.image_url}
      alt={artwork.title}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}

export default function UserProfile({ currentUser }: { currentUser: any | null }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [collages, setCollages] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'collages' ? 'collages' : 'artworks';
  
  const setActiveTab = (tab: 'artworks' | 'collages') => {
    setSearchParams(prev => {
      if (tab === 'artworks') prev.delete('tab');
      else prev.set('tab', tab);
      return prev;
    }, { replace: true });
  };
  
  // Lightbox State
  const [activeArtwork, setActiveArtwork] = useState<Artwork | null>(null);
  
  const [deleteModalArtwork, setDeleteModalArtwork] = useState<Artwork | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string>('user');
  const [searchQuery, setSearchQuery] = useState('');
  const [featuredYear, setFeaturedYear] = useState('all');
  const [featuredArtworkIds, setFeaturedArtworkIds] = useState<string[]>([]);
  const [featuredDraftIds, setFeaturedDraftIds] = useState<string[]>([]);
  const [featuredManagerOpen, setFeaturedManagerOpen] = useState(false);
  const [featuredManagerSearch, setFeaturedManagerSearch] = useState('');
  const [savingFeatured, setSavingFeatured] = useState(false);
  const [editingAbout, setEditingAbout] = useState(false);
  const [aboutDraft, setAboutDraft] = useState('');
  const [summaryDraft, setSummaryDraft] = useState('');
  const [savingAbout, setSavingAbout] = useState(false);

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

  useEffect(() => {
    if (!featuredManagerOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !savingFeatured) setFeaturedManagerOpen(false);
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [featuredManagerOpen, savingFeatured]);

  useEffect(() => {
    if (!id) return;
    const refreshProfile = () => fetchUserProfile();
    window.addEventListener('artwork-created', refreshProfile);
    window.addEventListener('board-created', refreshProfile);
    return () => {
      window.removeEventListener('artwork-created', refreshProfile);
      window.removeEventListener('board-created', refreshProfile);
    };
  }, [id]);

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
    setAboutDraft(profileData.about_me || '');
    setSummaryDraft(profileData.profile_summary || '');

    // Fetch artworks
    const { data: artworksData } = await supabase
      .from('artworks')
      .select('*, profiles(name, username, role)')
      .eq('user_id', id)
      .order('created_at', { ascending: false });

    if (artworksData) {
      const fetchedArtworks = artworksData as unknown as Artwork[];
      setArtworks(fetchedArtworks);
      setFeaturedArtworkIds(
        fetchedArtworks
          .filter(artwork => artwork.profile_featured_rank != null)
          .sort((a, b) => Number(a.profile_featured_rank) - Number(b.profile_featured_rank))
          .map(artwork => artwork.id)
      );
    }

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
        const boardItems = itemsByBoard.get(b.id) || [];
        return {
          ...b,
          item_count: boardItems.length,
          preview_images: boardItems.slice(0, 4).map((i: any) => i.artworks?.image_url).filter(Boolean)
        };
      });
      setCollages(enrichedBoards);
    }
    
    setLoading(false);
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
        const { error: storageError } = await supabase.storage.from('artworks').remove([pathParts[1]]);
        if (storageError) throw storageError;
      }

      const { error: deleteError } = await supabase.from('artworks').delete().eq('id', deleteModalArtwork.id);
      if (deleteError) throw deleteError;
      setArtworks(artworks.filter(a => a.id !== deleteModalArtwork.id));
      setFeaturedArtworkIds(current => current.filter(artworkId => artworkId !== deleteModalArtwork.id));
      setFeaturedDraftIds(current => current.filter(artworkId => artworkId !== deleteModalArtwork.id));
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

  const getArtworkYear = (artwork: Artwork) => {
    const catalogYear = String(artwork.creation_year || '').match(/\d{4}/)?.[0];
    return catalogYear || new Date(artwork.created_at).getFullYear().toString();
  };

  const openFeaturedManager = () => {
    setFeaturedDraftIds(featuredArtworkIds);
    setFeaturedManagerSearch('');
    setFeaturedManagerOpen(true);
  };

  const toggleFeaturedArtwork = (artworkId: string) => {
    setFeaturedDraftIds(current => {
      if (current.includes(artworkId)) return current.filter(id => id !== artworkId);
      if (current.length >= 4) {
        toast.error('You can feature up to four artworks.');
        return current;
      }
      return [...current, artworkId];
    });
  };

  const moveFeaturedArtwork = (artworkId: string, direction: -1 | 1) => {
    setFeaturedDraftIds(current => {
      const index = current.indexOf(artworkId);
      const targetIndex = index + direction;
      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) return current;
      const reordered = [...current];
      [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];
      return reordered;
    });
  };

  const saveFeaturedArtworks = async () => {
    if (!currentUser || currentUser.id !== profile.id) return;
    setSavingFeatured(true);

    const previousRanks = artworks
      .filter(artwork => artwork.profile_featured_rank != null)
      .map(artwork => ({ id: artwork.id, rank: Number(artwork.profile_featured_rank) }));

    try {
      const { error: clearError } = await supabase
        .from('artworks')
        .update({ profile_featured_rank: null })
        .eq('user_id', profile.id)
        .not('profile_featured_rank', 'is', null);
      if (clearError) throw clearError;

      for (let index = 0; index < featuredDraftIds.length; index += 1) {
        const { error } = await supabase
          .from('artworks')
          .update({ profile_featured_rank: index + 1 })
          .eq('id', featuredDraftIds[index])
          .eq('user_id', profile.id);
        if (error) throw error;
      }

      setFeaturedArtworkIds(featuredDraftIds);
      setArtworks(current => current.map(artwork => ({
        ...artwork,
        profile_featured_rank: featuredDraftIds.includes(artwork.id)
          ? featuredDraftIds.indexOf(artwork.id) + 1
          : null,
      })));
      setFeaturedManagerOpen(false);
      toast.success(featuredDraftIds.length ? 'Featured artworks updated.' : 'Profile showcase cleared.');
    } catch (error: any) {
      await supabase
        .from('artworks')
        .update({ profile_featured_rank: null })
        .eq('user_id', profile.id)
        .not('profile_featured_rank', 'is', null);
      for (const previous of previousRanks) {
        await supabase
          .from('artworks')
          .update({ profile_featured_rank: previous.rank })
          .eq('id', previous.id)
          .eq('user_id', profile.id);
      }
      toast.error(`Could not update featured artworks: ${error.message}`);
    } finally {
      setSavingFeatured(false);
    }
  };

  const saveProfileNarrative = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!currentUser || currentUser.id.toLowerCase() !== profile.id.toLowerCase()) return;

    const aboutMe = aboutDraft.trim().replace(/\r\n/g, '\n');
    const profileSummary = summaryDraft.trim().replace(/\r\n/g, '\n');
    if (aboutMe.length > 1000) {
      toast.error('About me must be 1,000 characters or fewer.');
      return;
    }
    if (profileSummary.length > 320) {
      toast.error('Profile introduction must be 320 characters or fewer.');
      return;
    }

    setSavingAbout(true);
    const { data, error } = await supabase
      .from('profiles')
      .update({
        about_me: aboutMe || null,
        profile_summary: profileSummary || null,
      })
      .eq('id', profile.id)
      .select('about_me, profile_summary')
      .single();

    if (error) {
      toast.error(`Could not update profile text: ${error.message}`);
      setSavingAbout(false);
      return;
    }

    const savedAbout = data?.about_me || '';
    const savedSummary = data?.profile_summary || '';
    setProfile(current => current ? {
      ...current,
      about_me: savedAbout || null,
      profile_summary: savedSummary || null,
    } : current);
    setAboutDraft(savedAbout);
    setSummaryDraft(savedSummary);
    setEditingAbout(false);
    setSavingAbout(false);
    await logAudit('Profile Narrative Updated', 'User updated their public profile introduction and biography.');
    toast.success('Profile text updated.');
  };

  const cancelProfileNarrativeEdit = () => {
    setAboutDraft(profile.about_me || '');
    setSummaryDraft(profile.profile_summary || '');
    setEditingAbout(false);
  };

  const artworkYears = Array.from(new Set(artworks.map(getArtworkYear))).sort((a, b) => Number(b) - Number(a));
  const curatedArtworks = featuredArtworkIds.length > 0
    ? featuredArtworkIds.map(featuredId => artworks.find(artwork => artwork.id === featuredId)).filter((artwork): artwork is Artwork => Boolean(artwork))
    : artworks;
  const featuredArtworks = curatedArtworks
    .filter(artwork => featuredYear === 'all' || getArtworkYear(artwork) === featuredYear)
    .slice(0, 4);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const normalizedFeaturedSearch = featuredManagerSearch.trim().toLowerCase();
  const featuredManagerArtworks = artworks.filter(artwork => !normalizedFeaturedSearch || [
    artwork.title,
    artwork.artist_name,
    artwork.medium,
    artwork.material_used,
    artwork.creation_year,
  ].some(value => String(value || '').toLowerCase().includes(normalizedFeaturedSearch)));
  const filteredArtworks = artworks.filter(artwork => {
    if (!normalizedSearch) return true;
    return [
      artwork.title,
      artwork.description,
      artwork.artist_name,
      artwork.medium,
      artwork.material_used,
      artwork.art_style,
      getArtworkYear(artwork),
    ].some(value => String(value || '').toLowerCase().includes(normalizedSearch));
  });

  const totalPages = Math.ceil(filteredArtworks.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentItems = filteredArtworks.slice(startIndex, startIndex + itemsPerPage);
  const isOwnProfile = currentUser?.id?.toLowerCase() === profile.id?.toLowerCase();
  const roleLabel = profile.role === 'admin'
    ? 'Administrator'
    : profile.role === 'artist'
      ? 'Artist'
      : profile.role === 'curator'
        ? 'Curator'
        : 'Collection Contributor';
  const publicTitle = profile.profile_title?.trim() || roleLabel;
  const accountStatus = profile.status === 'suspended'
    ? 'Suspended'
    : profile.status === 'banned'
      ? 'Restricted'
      : 'Active';
  const creatorsRepresented = new Set(artworks.map(artwork => artwork.artist_name || profile.name).filter(Boolean)).size;
  const collectionYears = artworks
    .map(artwork => Number(getArtworkYear(artwork)))
    .filter(year => Number.isFinite(year));
  const earliestCollectionYear = collectionYears.length ? Math.min(...collectionYears) : null;
  const latestCollectionYear = collectionYears.length ? Math.max(...collectionYears) : null;
  const memberSince = profile.created_at ? new Date(profile.created_at).getFullYear() : null;
  const yearsActive = memberSince ? Math.max(1, new Date().getFullYear() - memberSince + 1) : 1;

  const openProfileNarrativeEditor = () => {
    setSummaryDraft(profile.profile_summary || '');
    setAboutDraft(profile.about_me || '');
    setEditingAbout(true);
    window.setTimeout(() => {
      document.getElementById('about-artist')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  const scrollToCollection = () => {
    document.getElementById('artist-collection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

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
      <main className="artist-profile-page">
        <div className="artist-profile-shell">
          <button className="artist-profile-back" type="button" onClick={() => navigate('/artists')}>
            <ArrowLeft size={17} aria-hidden="true" />
            Back to Artists
          </button>

          <section className="artist-profile-hero" aria-labelledby="artist-profile-name">
            <div className="artist-profile-portrait">
              <Avatar userId={profile.id} name={profile.name} size={320} shape="square" />
            </div>

            <div className="artist-profile-intro">
              <div className="artist-profile-title-row">
                <h1 id="artist-profile-name">{profile.name}</h1>
                {profile.is_verified && <BadgeCheck size={22} aria-label="Verified ArtVault profile" />}
              </div>
              <div className="artist-profile-identity-line">
                <span>{publicTitle}</span>
                <span aria-hidden="true">•</span>
                <span>@{profile.username}</span>
                <span aria-hidden="true">•</span>
                <span className={`artist-profile-account-status ${profile.status || 'active'}`}>
                  <span aria-hidden="true" /> {accountStatus}
                </span>
              </div>
              <p className={`artist-profile-summary ${profile.profile_summary ? 'artist-profile-summary-authored' : ''}`}>
                {profile.profile_summary || `${profile.name} maintains an archival collection of ${artworks.length} registered ${artworks.length === 1 ? 'work' : 'works'} on ArtVault, preserving creator attribution, material details, and collection history in one public record.`}
              </p>
              {isOwnProfile ? (
                <button className="artist-profile-text-link" type="button" onClick={openProfileNarrativeEditor}>
                  <Pencil size={14} aria-hidden="true" /> Edit profile text
                </button>
              ) : (
                <button className="artist-profile-text-link" type="button" onClick={() => document.getElementById('about-artist')?.scrollIntoView({ behavior: 'smooth' })}>
                  View profile record <span aria-hidden="true">→</span>
                </button>
              )}

              <div className="artist-profile-actions">
                <button className="artist-profile-button artist-profile-button-primary" type="button" onClick={scrollToCollection}>
                  <ImageIcon size={17} aria-hidden="true" /> View Registered Works
                </button>
                {isOwnProfile && canUpload(currentUserRole) ? (
                  <button className="artist-profile-button" type="button" onClick={() => window.dispatchEvent(new Event('open-artvault-publisher'))}>
                    <Upload size={17} aria-hidden="true" /> Register Work
                  </button>
                ) : currentUser ? (
                  <button className="artist-profile-button" type="button" onClick={() => { setActiveTab('collages'); scrollToCollection(); }}>
                    <Layers3 size={17} aria-hidden="true" /> View Portfolios
                  </button>
                ) : (
                  <button className="artist-profile-button" type="button" onClick={() => navigate('/login')}>
                    <UserRound size={17} aria-hidden="true" /> Sign in to ArtVault
                  </button>
                )}
              </div>
            </div>

            <aside className="artist-profile-metrics" aria-label="Profile statistics">
              <div className="artist-profile-metric">
                <ImageIcon size={25} aria-hidden="true" />
                <div><strong>{artworks.length}</strong><span>Registered Works</span></div>
              </div>
              <div className="artist-profile-metric">
                <CalendarDays size={25} aria-hidden="true" />
                <div><strong>{yearsActive}+</strong><span>Years Active</span></div>
              </div>
              <div className="artist-profile-metric">
                <Globe2 size={25} aria-hidden="true" />
                <div><strong>{creatorsRepresented}</strong><span>Creators Represented</span></div>
              </div>
            </aside>
          </section>

          <section className="artist-featured-section" aria-labelledby="featured-artworks-heading">
            <div className="artist-section-heading artist-featured-heading">
              <div>
                <p className="artist-profile-kicker">{featuredArtworkIds.length > 0 ? 'Curated by the profile owner' : 'Selected from the registry'}</p>
                <h2 id="featured-artworks-heading">Featured Artworks</h2>
              </div>
              <div className="artist-featured-controls">
                {isOwnProfile && (
                  <button className="artist-manage-featured-button" type="button" onClick={openFeaturedManager}>
                    <Star size={16} aria-hidden="true" /> Manage Featured
                  </button>
                )}
                <label className="sr-only" htmlFor="featured-year">Filter featured artworks by year</label>
                <select id="featured-year" value={featuredYear} onChange={event => setFeaturedYear(event.target.value)}>
                  <option value="all">All Years</option>
                  {artworkYears.map(year => <option key={year} value={year}>{year}</option>)}
                </select>
                <button type="button" onClick={scrollToCollection}>View all artworks <span aria-hidden="true">→</span></button>
              </div>
            </div>

            {featuredArtworks.length > 0 ? (
              <div className="artist-featured-grid">
                {featuredArtworks.map(artwork => (
                  <button key={artwork.id} className="artist-feature-card" type="button" onClick={() => setActiveArtwork(artwork)}>
                    <div className="artist-feature-image">
                      <ArtworkImage artwork={artwork} />
                    </div>
                    <div className="artist-feature-copy">
                      <h3>{artwork.title}</h3>
                      <p>{artwork.artist_name || profile.name}</p>
                      <span>{getArtworkYear(artwork)}{artwork.medium || artwork.material_used ? ` • ${artwork.medium || artwork.material_used}` : ''}</span>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="artist-profile-empty">No registered artworks are available for this year.</div>
            )}
          </section>

          <section className="artist-collection-section" id="artist-collection" aria-labelledby="artist-collection-heading">
            <div className="artist-section-heading">
              <div>
                <p className="artist-profile-kicker">Public collection record</p>
                <h2 id="artist-collection-heading">Collection Registry</h2>
              </div>
              {isOwnProfile && canUpload(currentUserRole) && (
                <button className="artist-profile-button artist-profile-button-primary" type="button" onClick={() => window.dispatchEvent(new Event('open-artvault-publisher'))}>
                  <Upload size={17} aria-hidden="true" /> Register Work
                </button>
              )}
            </div>

            <div className="artist-collection-toolbar">
              <div className="artist-profile-tabs" role="tablist" aria-label="Artist collection views">
                <button type="button" role="tab" aria-selected={activeTab === 'artworks'} className={activeTab === 'artworks' ? 'active' : ''} onClick={() => setActiveTab('artworks')}>
                  Artworks <span>{artworks.length}</span>
                </button>
                <button type="button" role="tab" aria-selected={activeTab === 'collages'} className={activeTab === 'collages' ? 'active' : ''} onClick={() => setActiveTab('collages')}>
                  Portfolios <span>{collages.length}</span>
                </button>
              </div>
              <label className="artist-profile-search">
                <Search size={17} aria-hidden="true" />
                <span className="sr-only">Search this profile</span>
                <input
                  type="search"
                  placeholder={activeTab === 'artworks' ? 'Search title, creator, medium, or year' : 'Search portfolios'}
                  value={searchQuery}
                  onChange={event => setSearchQuery(event.target.value)}
                />
              </label>
            </div>

            {activeTab === 'artworks' ? (
              <>
                {filteredArtworks.length === 0 ? (
                  <div className="artist-profile-empty">
                    <ImageIcon size={28} aria-hidden="true" />
                    <h3>No Registered Works Found</h3>
                    <p>{searchQuery ? 'No registered works match your search.' : 'This collection profile is currently empty.'}</p>
                  </div>
                ) : (
                  <div className="artist-work-grid">
                    {currentItems.map(artwork => (
                      <article key={artwork.id} className="artist-work-card">
                        <button className="artist-work-open" type="button" onClick={() => setActiveArtwork(artwork)} aria-label={`Open ${artwork.title}`}>
                          <div className="artist-work-image"><ArtworkImage artwork={artwork} /></div>
                          <div className="artist-work-copy">
                            <span className="artist-work-accession">Registered {new Date(artwork.created_at).toLocaleDateString()}</span>
                            <h3>{artwork.title}</h3>
                            <p>{artwork.artist_name || profile.name}</p>
                            <dl>
                              <div><dt>Year</dt><dd>{getArtworkYear(artwork)}</dd></div>
                              <div><dt>Medium</dt><dd>{artwork.medium || artwork.material_used || 'Not recorded'}</dd></div>
                            </dl>
                          </div>
                        </button>
                        {(currentUser?.id === artwork.user_id || currentUserRole === 'admin') && (
                          <button type="button" className="artist-work-delete" onClick={event => handleDeleteClick(event, artwork)}>
                            <Trash2 size={15} aria-hidden="true" /> Delete record
                          </button>
                        )}
                      </article>
                    ))}
                  </div>
                )}

                {totalPages > 1 && (
                  <nav className="artist-profile-pagination" aria-label="Artwork pages">
                    <button type="button" onClick={() => setCurrentPage(previous => Math.max(previous - 1, 1))} disabled={currentPage === 1}>Previous</button>
                    {getPaginationGroup().map((page, index) => page === '...' ? (
                      <span key={`dots-${index}`}>...</span>
                    ) : (
                      <button key={`page-${page}`} type="button" className={currentPage === page ? 'active' : ''} aria-current={currentPage === page ? 'page' : undefined} onClick={() => setCurrentPage(page as number)}>{page}</button>
                    ))}
                    <button type="button" onClick={() => setCurrentPage(previous => Math.min(previous + 1, totalPages))} disabled={currentPage === totalPages}>Next</button>
                  </nav>
                )}
              </>
            ) : (
              <>
                {collages.filter(collage => collage.name.toLowerCase().includes(normalizedSearch)).length === 0 ? (
                  <div className="artist-profile-empty">
                    <Layers3 size={28} aria-hidden="true" />
                    <h3>{searchQuery ? 'No Portfolios Found' : 'No Public Portfolios'}</h3>
                    <p>{searchQuery ? 'No portfolios match your search.' : 'This contributor has not created any public portfolios yet.'}</p>
                  </div>
                ) : (
                  <div className="artist-portfolio-grid">
                    {collages.filter(collage => collage.name.toLowerCase().includes(normalizedSearch)).map(collage => (
                      <button key={collage.id} className="artist-portfolio-card" type="button" onClick={() => navigate(`/collage/${collage.id}`)}>
                        <div className="artist-portfolio-preview">
                          {[0, 1, 2, 3].map(index => (
                            <div key={index}>
                              {collage.preview_images?.[index] && <img src={collage.preview_images[index]} alt="" loading="lazy" />}
                            </div>
                          ))}
                        </div>
                        <div className="artist-portfolio-copy">
                          <span>{collage.item_count || 0} works</span>
                          <h3>{collage.name}</h3>
                          {collage.description && <p>{collage.description}</p>}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          <section className="artist-profile-context" id="about-artist" aria-label="About this profile">
            <article className="artist-about-record">
              <div className="artist-about-heading-row">
                <div>
                  <p className="artist-profile-kicker">Profile record</p>
                  <h2>About the Contributor</h2>
                </div>
                {isOwnProfile && !editingAbout && (
                  <button className="artist-about-edit-trigger" type="button" onClick={openProfileNarrativeEditor}>
                    <Pencil size={15} aria-hidden="true" /> Edit Profile Text
                  </button>
                )}
              </div>

              {editingAbout && isOwnProfile ? (
                <form className="artist-about-editor" onSubmit={saveProfileNarrative}>
                  <div className="artist-about-editor-field">
                    <label htmlFor="artist-profile-summary">Profile introduction</label>
                    <textarea
                      id="artist-profile-summary"
                      value={summaryDraft}
                      onChange={event => setSummaryDraft(event.target.value)}
                      maxLength={320}
                      rows={4}
                      autoFocus
                      placeholder="Write the short introduction shown beside your profile image."
                      disabled={savingAbout}
                    />
                    <span>{summaryDraft.length} / 320</span>
                  </div>

                  <div className="artist-about-editor-field">
                    <label htmlFor="artist-about-me">About me</label>
                    <textarea
                      id="artist-about-me"
                      value={aboutDraft}
                      onChange={event => setAboutDraft(event.target.value)}
                      maxLength={1000}
                      rows={8}
                      placeholder="Share your artistic practice, influences, collection interests, or professional background."
                      disabled={savingAbout}
                    />
                    <span>{aboutDraft.length} / 1,000</span>
                  </div>

                  <div className="artist-about-editor-footer">
                    <p>Blank fields use ArtVault's generated registry text.</p>
                    <div>
                      <button className="artist-profile-button" type="button" onClick={cancelProfileNarrativeEdit} disabled={savingAbout}>Cancel</button>
                      <button className="artist-profile-button artist-profile-button-primary" type="submit" disabled={savingAbout}>
                        <Save size={15} aria-hidden="true" /> {savingAbout ? 'Saving...' : 'Save Profile Text'}
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                <>
                  <p className={profile.about_me ? 'artist-about-authored-copy' : undefined}>
                    {profile.about_me || `${profile.name} is an ArtVault ${roleLabel.toLowerCase()} responsible for a public registry of ${artworks.length} ${artworks.length === 1 ? 'artwork' : 'artworks'}. The collection preserves attribution to ${creatorsRepresented} ${creatorsRepresented === 1 ? 'original creator' : 'original creators'} while identifying @${profile.username} as the record owner.`}
                  </p>
                  {!profile.about_me && earliestCollectionYear && latestCollectionYear && (
                    <p>
                      Cataloged works span {earliestCollectionYear === latestCollectionYear ? earliestCollectionYear : `${earliestCollectionYear}–${latestCollectionYear}`}, bringing historical and contemporary records together in one maintained archive.
                    </p>
                  )}
                </>
              )}
            </article>

            <article>
              <p className="artist-profile-kicker">Curated groupings</p>
              <h2>Portfolios</h2>
              <p>
                {collages.length > 0
                  ? `${collages.length} public ${collages.length === 1 ? 'portfolio organizes' : 'portfolios organize'} works from this registry into focused collection views.`
                  : 'Portfolio records for this contributor have not been published yet.'}
              </p>
              <button type="button" className="artist-profile-button" onClick={() => { setActiveTab('collages'); scrollToCollection(); }}>
                View Portfolios <span aria-hidden="true">→</span>
              </button>
            </article>

            <aside className="artist-vault-card">
              <div className="artist-vault-title"><ImageIcon size={22} aria-hidden="true" /><h2>In the Vault</h2></div>
              <div className="artist-vault-stat"><ImageIcon size={22} aria-hidden="true" /><div><strong>{artworks.length}</strong><span>Registered artworks</span></div></div>
              <div className="artist-vault-stat"><UserRound size={22} aria-hidden="true" /><div><strong>{creatorsRepresented}</strong><span>Creators represented</span></div></div>
              <div className="artist-vault-stat"><Layers3 size={22} aria-hidden="true" /><div><strong>{collages.length}</strong><span>Public portfolios</span></div></div>
              <button className="artist-profile-button artist-profile-button-primary" type="button" onClick={scrollToCollection}>Explore Artworks <span aria-hidden="true">→</span></button>
            </aside>
          </section>
        </div>
      </main>

      {featuredManagerOpen && isOwnProfile && (
        <div className="artist-feature-manager-backdrop" role="presentation" onMouseDown={event => {
          if (event.target === event.currentTarget && !savingFeatured) setFeaturedManagerOpen(false);
        }}>
          <section className="artist-feature-manager" role="dialog" aria-modal="true" aria-labelledby="featured-manager-title">
            <header className="artist-feature-manager-header">
              <div>
                <p className="artist-profile-kicker">Profile showcase</p>
                <h2 id="featured-manager-title">Manage Featured Artworks</h2>
                <p>Choose up to four works and arrange the order visitors will see.</p>
              </div>
              <button type="button" aria-label="Close featured artwork manager" onClick={() => setFeaturedManagerOpen(false)} disabled={savingFeatured}>
                <X size={22} aria-hidden="true" />
              </button>
            </header>

            <div className="artist-feature-manager-toolbar">
              <label className="artist-profile-search">
                <Search size={17} aria-hidden="true" />
                <span className="sr-only">Search registered artworks</span>
                <input
                  type="search"
                  placeholder="Search title, creator, medium, or year"
                  value={featuredManagerSearch}
                  onChange={event => setFeaturedManagerSearch(event.target.value)}
                />
              </label>
              <strong>{featuredDraftIds.length} of 4 selected</strong>
            </div>

            {featuredDraftIds.length > 0 && (
              <div className="artist-feature-order" aria-label="Featured artwork order">
                {featuredDraftIds.map((artworkId, index) => {
                  const artwork = artworks.find(item => item.id === artworkId);
                  if (!artwork) return null;
                  return (
                    <div key={artwork.id} className="artist-feature-order-item">
                      <span className="artist-feature-order-rank">{index + 1}</span>
                      <ArtworkImage artwork={artwork} />
                      <div><strong>{artwork.title}</strong><span>{artwork.artist_name || profile.name}</span></div>
                      <div className="artist-feature-order-actions">
                        <button type="button" aria-label={`Move ${artwork.title} earlier`} disabled={index === 0} onClick={() => moveFeaturedArtwork(artwork.id, -1)}><ChevronUp size={16} /></button>
                        <button type="button" aria-label={`Move ${artwork.title} later`} disabled={index === featuredDraftIds.length - 1} onClick={() => moveFeaturedArtwork(artwork.id, 1)}><ChevronDown size={16} /></button>
                        <button type="button" onClick={() => toggleFeaturedArtwork(artwork.id)}>Remove</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="artist-feature-picker">
              {featuredManagerArtworks.map(artwork => {
                const selectedIndex = featuredDraftIds.indexOf(artwork.id);
                return (
                  <article key={artwork.id} className={`artist-feature-picker-item ${selectedIndex >= 0 ? 'selected' : ''}`}>
                    <div className="artist-feature-picker-image"><ArtworkImage artwork={artwork} /></div>
                    <div className="artist-feature-picker-copy">
                      <h3>{artwork.title}</h3>
                      <p>{artwork.artist_name || profile.name}</p>
                      <span>{getArtworkYear(artwork)}{artwork.medium || artwork.material_used ? ` • ${artwork.medium || artwork.material_used}` : ''}</span>
                    </div>
                    <button
                      type="button"
                      className={selectedIndex >= 0 ? 'selected' : ''}
                      onClick={() => toggleFeaturedArtwork(artwork.id)}
                      disabled={selectedIndex < 0 && featuredDraftIds.length >= 4}
                    >
                      {selectedIndex >= 0 ? `Featured ${selectedIndex + 1}` : 'Add'}
                    </button>
                  </article>
                );
              })}
            </div>

            <footer className="artist-feature-manager-footer">
              <button type="button" className="artist-profile-button" onClick={() => setFeaturedManagerOpen(false)} disabled={savingFeatured}>Cancel</button>
              <button type="button" className="artist-profile-button artist-profile-button-primary" onClick={saveFeaturedArtworks} disabled={savingFeatured}>
                {savingFeatured ? 'Saving Showcase...' : 'Save Featured Artworks'}
              </button>
            </footer>
          </section>
        </div>
      )}

      {/* Lightbox Modal */}
      {activeArtwork && (
        <Lightbox 
          artwork={activeArtwork} 
          artistName={profile.name} 
          onClose={() => setActiveArtwork(null)}
          currentUser={currentUser}
        />
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
