import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from './supabaseClient';
import Lightbox from './Lightbox';
import './Dashboard.css';

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
}

interface Category {
  id: string;
  name: string;
  slug: string;
}

// Global cache
let cachedArtworks: Artwork[] | null = null;
let cachedCategories: Category[] | null = null;

export default function Dashboard({ user }: { user: any }) {
  const [artworks, setArtworks] = useState<Artwork[]>(cachedArtworks || []);
  const [categories, setCategories] = useState<Category[]>(cachedCategories || []);
  const [loading, setLoading] = useState(!cachedArtworks);
  const [activeArtwork, setActiveArtwork] = useState<Artwork | null>(null);
  
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  const [activeCategory, setActiveCategory] = useState<string>('all');

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

    // Fetch categories
    if (!cachedCategories) {
      const { data: catData } = await supabase.from('categories').select('*').order('name');
      if (catData) {
        cachedCategories = catData;
        setCategories(catData);
      }
    }

    // Fetch artworks with categories
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
    const q = searchQuery.toLowerCase();
    return a.title.toLowerCase().includes(q) || 
      (a.description && a.description.toLowerCase().includes(q)) ||
      (a.profiles?.name && a.profiles.name.toLowerCase().includes(q)) ||
      (a.profiles?.username && a.profiles.username.toLowerCase().includes(q));
  });

  return (
    <>
      {/* Category Pills Header */}
      <div className="category-filter-bar">
        <button 
          className={`category-pill ${activeCategory === 'all' ? 'active' : ''}`}
          onClick={() => setActiveCategory('all')}
        >
          Lahat (All)
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
          <div className="masonry-grid">
            {filteredArtworks.map((artwork) => (
              <div 
                key={artwork.id} 
                className="masonry-item art-card"
                onClick={() => setActiveArtwork(artwork)}
              >
                <img 
                  src={artwork.image_url} 
                  alt={artwork.title} 
                  loading="lazy"
                />
                <div className="art-card-overlay">
                  <h4 className="art-title truncate">{artwork.title}</h4>
                  <p className="art-author truncate">@{artwork.profiles?.username || artwork.profiles?.name}</p>
                </div>
              </div>
            ))}
          </div>
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
