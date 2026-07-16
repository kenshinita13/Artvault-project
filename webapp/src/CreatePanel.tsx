import { useState, useEffect } from 'react';
import { Check, Cloud, FolderPlus, ImagePlus, Link2, Minus, Search, Upload, X } from 'lucide-react';
import { supabase } from './supabaseClient';
import { checkImageIsSafe } from './nsfwHelper';
import toast from 'react-hot-toast';
import './CreatePanel.css';

interface CreatePanelProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  categories: { id: string; name: string; slug: string }[];
  onArtworkCreated?: () => void;
  onBoardCreated?: () => void;
  onRestore?: () => void;
  adminMode?: boolean;
  allUsers?: any[];
  defaultTargetUserId?: string | null;
}

interface CollageArtwork {
  id: string;
  title: string;
  image_url: string;
  artist_name?: string | null;
  art_style?: string | null;
  creation_year?: string | null;
}

const compressImage = (file: File): Promise<File> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1920;
        const MAX_HEIGHT = 1080;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        } else {
          if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; }
        }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          resolve(blob ? new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", { type: 'image/webp' }) : file);
        }, 'image/webp', 0.90);
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
};

const MAX_UPLOAD_SIZE = 10 * 1024 * 1024;
const formatFileSize = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
const ARTWORK_DRAFT_DB = 'artvault-publisher-drafts';
const ARTWORK_DRAFT_FILE_STORE = 'artwork-files';

const openArtworkDraftDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = window.indexedDB.open(ARTWORK_DRAFT_DB, 1);
  request.onupgradeneeded = () => {
    if (!request.result.objectStoreNames.contains(ARTWORK_DRAFT_FILE_STORE)) {
      request.result.createObjectStore(ARTWORK_DRAFT_FILE_STORE);
    }
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const saveArtworkDraftFile = async (key: string, file: File | null) => {
  if (!window.indexedDB) return;
  const database = await openArtworkDraftDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(ARTWORK_DRAFT_FILE_STORE, 'readwrite');
    const store = transaction.objectStore(ARTWORK_DRAFT_FILE_STORE);
    if (file) store.put(file, key);
    else store.delete(key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  database.close();
};

const loadArtworkDraftFile = async (key: string): Promise<File | null> => {
  if (!window.indexedDB) return null;
  const database = await openArtworkDraftDatabase();
  const file = await new Promise<File | null>((resolve, reject) => {
    const request = database.transaction(ARTWORK_DRAFT_FILE_STORE, 'readonly')
      .objectStore(ARTWORK_DRAFT_FILE_STORE)
      .get(key);
    request.onsuccess = () => resolve(request.result instanceof File ? request.result : null);
    request.onerror = () => reject(request.error);
  });
  database.close();
  return file;
};

const validateHttpsImageUrl = (value: string): string => {
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new Error('Enter a valid HTTPS image URL.');
  }

  if (parsed.protocol !== 'https:') {
    throw new Error('Image URLs must use HTTPS.');
  }
  if (parsed.hostname === 'drive.google.com' || parsed.hostname === 'docs.google.com') {
    throw new Error('Google Drive sharing links are coming soon. Use a direct public HTTPS image URL for now.');
  }
  return parsed.toString();
};

const confirmRemoteImageLoads = (url: string): Promise<void> => new Promise((resolve, reject) => {
  const image = new Image();
  const timeout = window.setTimeout(() => reject(new Error('The image URL took too long to respond.')), 12000);
  image.onload = () => {
    window.clearTimeout(timeout);
    resolve();
  };
  image.onerror = () => {
    window.clearTimeout(timeout);
    reject(new Error('The HTTPS address could not be displayed as an image.'));
  };
  image.src = url;
});

const fetchRemoteImageForReview = async (url: string): Promise<File | null> => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.startsWith('image/')) return null;
    const blob = await response.blob();
    return new File([blob], 'remote-artwork', { type: blob.type || contentType });
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
};

export default function CreatePanel({ isOpen, onClose, user, categories, onArtworkCreated, onBoardCreated, onRestore, adminMode, allUsers = [], defaultTargetUserId }: CreatePanelProps) {
  const [activeTab, setActiveTab] = useState<'menu' | 'artwork' | 'board'>('menu');
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Admin user selection
  const [targetUserId, setTargetUserId] = useState<string>('');
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    if (adminMode && defaultTargetUserId && allUsers.length > 0) {
      setTargetUserId(defaultTargetUserId);
      const targetUser = allUsers.find(u => u.id === defaultTargetUserId);
      if (targetUser) {
        setUserSearchQuery(targetUser.name || targetUser.username || targetUser.email || 'Unnamed');
      }
    }
  }, [adminMode, defaultTargetUserId, allUsers]);

  const filteredUsers = allUsers.filter(u => 
    u.name?.toLowerCase().includes(userSearchQuery.toLowerCase()) || 
    u.username?.toLowerCase().includes(userSearchQuery.toLowerCase())
  ).slice(0, 10);

  const effectiveUserId = adminMode && targetUserId ? targetUserId : user.id;

  // Board Selection
  const [userBoards, setUserBoards] = useState<any[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState<string>('');

  useEffect(() => {
    let active = true;
    async function fetchBoards() {
      if (!effectiveUserId) {
        setUserBoards([]);
        return;
      }
      const { data } = await supabase.from('boards').select('id, name').eq('user_id', effectiveUserId).order('name');
      if (active && data) setUserBoards(data);
    }
    if (isOpen) {
      fetchBoards();
    }
    return () => { active = false; };
  }, [effectiveUserId, isOpen]);
  
  // Artwork form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageSource, setImageSource] = useState<'file' | 'url'>('file');
  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState('');
  const [artistName, setArtistName] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [currentHashtag, setCurrentHashtag] = useState('');
  const [materialUsed, setMaterialUsed] = useState('');
  const [artStyle, setArtStyle] = useState('');
  const [collector, setCollector] = useState('');
  const [price, setPrice] = useState('');
  const [creationYear, setCreationYear] = useState('');
  const [dimensions, setDimensions] = useState('');
  const [uploading, setUploading] = useState(false);
  const [artworkDraftReady, setArtworkDraftReady] = useState(false);

  // Board form
  const [boardName, setBoardName] = useState('');
  const [boardDesc, setBoardDesc] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [creatingBoard, setCreatingBoard] = useState(false);
  const [collageArtworks, setCollageArtworks] = useState<CollageArtwork[]>([]);
  const [selectedCollageArtworkIds, setSelectedCollageArtworkIds] = useState<string[]>([]);
  const [collageSearch, setCollageSearch] = useState('');
  const [loadingCollageArtworks, setLoadingCollageArtworks] = useState(false);
  const [collageDraftReady, setCollageDraftReady] = useState(false);

  const collageDraftOwner = adminMode ? (targetUserId || 'pending-admin-selection') : user.id;
  const collageDraftKey = `artvault:collage-draft:${collageDraftOwner}`;
  const artworkDraftKey = `artvault:artwork-draft:${user.id}`;
  const publisherDockKey = `artvault:publisher-dock:${user.id}`;
  const hasCollageDraft = Boolean(boardName.trim() || boardDesc.trim() || selectedCollageArtworkIds.length > 0 || isPrivate);
  const hasArtworkDraft = Boolean(
    title.trim() || description.trim() || file || imageUrl.trim() || artistName.trim() ||
    selectedCategories.length > 0 || hashtags.length > 0 || currentHashtag.trim() ||
    materialUsed || artStyle.trim() || collector.trim() || price || creationYear.trim() ||
    dimensions.trim() || selectedBoardId || (adminMode && targetUserId)
  );

  useEffect(() => {
    if (isOpen) setIsMinimized(false);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen || isMinimized || (adminMode && !targetUserId)) return;

    try {
      const activeDraftType = window.localStorage.getItem(publisherDockKey);
      if (activeDraftType && activeDraftType !== 'board') return;
      const saved = window.localStorage.getItem(collageDraftKey);
      if (!saved) return;

      const draft = JSON.parse(saved);
      const artworkIds = Array.isArray(draft.artworkIds)
        ? draft.artworkIds.filter((id: unknown) => typeof id === 'string')
        : [];
      const name = typeof draft.name === 'string' ? draft.name : '';
      const description = typeof draft.description === 'string' ? draft.description : '';
      const draftHasContent = Boolean(name.trim() || description.trim() || artworkIds.length > 0 || draft.isPrivate);

      if (!draftHasContent) return;

      setBoardName(name);
      setBoardDesc(description);
      setIsPrivate(Boolean(draft.isPrivate));
      setSelectedCollageArtworkIds(artworkIds);
      setActiveTab('board');
      setIsMinimized(true);
    } catch {
      window.localStorage.removeItem(collageDraftKey);
    }
  }, [adminMode, collageDraftKey, isMinimized, isOpen, publisherDockKey, targetUserId]);

  useEffect(() => {
    if (isOpen || isMinimized) return;

    try {
      if (window.localStorage.getItem(publisherDockKey) !== 'artwork') return;
      const saved = window.localStorage.getItem(artworkDraftKey);
      if (!saved) return;

      const draft = JSON.parse(saved);
      const draftHasContent = Boolean(
        draft.title?.trim() || draft.description?.trim() || draft.hasFile || draft.imageUrl?.trim() ||
        draft.artistName?.trim() || draft.selectedCategories?.length || draft.hashtags?.length ||
        draft.currentHashtag?.trim() || draft.materialUsed || draft.artStyle?.trim() ||
        draft.collector?.trim() || draft.price || draft.creationYear?.trim() || draft.dimensions?.trim() ||
        draft.selectedBoardId || (adminMode && draft.targetUserId)
      );
      if (!draftHasContent) return;

      setTitle(typeof draft.title === 'string' ? draft.title : '');
      setDescription(typeof draft.description === 'string' ? draft.description : '');
      setImageSource(draft.imageSource === 'url' ? 'url' : 'file');
      setImageUrl(typeof draft.imageUrl === 'string' ? draft.imageUrl : '');
      setArtistName(typeof draft.artistName === 'string' ? draft.artistName : '');
      setSelectedCategories(Array.isArray(draft.selectedCategories) ? draft.selectedCategories.filter((id: unknown) => typeof id === 'string') : []);
      setHashtags(Array.isArray(draft.hashtags) ? draft.hashtags.filter((tag: unknown) => typeof tag === 'string') : []);
      setCurrentHashtag(typeof draft.currentHashtag === 'string' ? draft.currentHashtag : '');
      setMaterialUsed(typeof draft.materialUsed === 'string' ? draft.materialUsed : '');
      setArtStyle(typeof draft.artStyle === 'string' ? draft.artStyle : '');
      setCollector(typeof draft.collector === 'string' ? draft.collector : '');
      setPrice(typeof draft.price === 'string' ? draft.price : '');
      setCreationYear(typeof draft.creationYear === 'string' ? draft.creationYear : '');
      setDimensions(typeof draft.dimensions === 'string' ? draft.dimensions : '');
      setSelectedBoardId(typeof draft.selectedBoardId === 'string' ? draft.selectedBoardId : '');
      if (adminMode) {
        setTargetUserId(typeof draft.targetUserId === 'string' ? draft.targetUserId : '');
        setUserSearchQuery(typeof draft.userSearchQuery === 'string' ? draft.userSearchQuery : '');
      }
      setActiveTab('artwork');
      setIsMinimized(true);
    } catch {
      window.localStorage.removeItem(artworkDraftKey);
    }
  }, [adminMode, artworkDraftKey, isMinimized, isOpen, publisherDockKey]);

  useEffect(() => {
    if (!isOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (activeTab !== 'artwork') {
      setArtworkDraftReady(false);
      return;
    }

    let active = true;
    setArtworkDraftReady(false);

    const restoreArtworkDraft = async () => {
      try {
        const saved = window.localStorage.getItem(artworkDraftKey);
        if (saved) {
          const draft = JSON.parse(saved);
          setTitle(typeof draft.title === 'string' ? draft.title : '');
          setDescription(typeof draft.description === 'string' ? draft.description : '');
          setImageSource(draft.imageSource === 'url' ? 'url' : 'file');
          setImageUrl(typeof draft.imageUrl === 'string' ? draft.imageUrl : '');
          setArtistName(typeof draft.artistName === 'string' ? draft.artistName : '');
          setSelectedCategories(Array.isArray(draft.selectedCategories) ? draft.selectedCategories.filter((id: unknown) => typeof id === 'string') : []);
          setHashtags(Array.isArray(draft.hashtags) ? draft.hashtags.filter((tag: unknown) => typeof tag === 'string') : []);
          setCurrentHashtag(typeof draft.currentHashtag === 'string' ? draft.currentHashtag : '');
          setMaterialUsed(typeof draft.materialUsed === 'string' ? draft.materialUsed : '');
          setArtStyle(typeof draft.artStyle === 'string' ? draft.artStyle : '');
          setCollector(typeof draft.collector === 'string' ? draft.collector : '');
          setPrice(typeof draft.price === 'string' ? draft.price : '');
          setCreationYear(typeof draft.creationYear === 'string' ? draft.creationYear : '');
          setDimensions(typeof draft.dimensions === 'string' ? draft.dimensions : '');
          setSelectedBoardId(typeof draft.selectedBoardId === 'string' ? draft.selectedBoardId : '');
          if (adminMode) {
            setTargetUserId(typeof draft.targetUserId === 'string' ? draft.targetUserId : '');
            setUserSearchQuery(typeof draft.userSearchQuery === 'string' ? draft.userSearchQuery : '');
          }
        } else {
          setTitle(''); setDescription(''); setImageSource('file'); setImageUrl(''); setArtistName('');
          setSelectedCategories([]); setHashtags([]); setCurrentHashtag(''); setMaterialUsed('');
          setArtStyle(''); setCollector(''); setPrice(''); setCreationYear(''); setDimensions('');
          setSelectedBoardId('');
        }

        const savedFile = await loadArtworkDraftFile(artworkDraftKey).catch(() => null);
        if (active) setFile(savedFile);
      } catch {
        window.localStorage.removeItem(artworkDraftKey);
        if (active) setFile(null);
      } finally {
        if (active) setArtworkDraftReady(true);
      }
    };

    void restoreArtworkDraft();
    return () => { active = false; };
  }, [activeTab, adminMode, artworkDraftKey]);

  useEffect(() => {
    if (activeTab !== 'artwork' || !artworkDraftReady) return;

    if (!hasArtworkDraft) {
      window.localStorage.removeItem(artworkDraftKey);
      if (window.localStorage.getItem(publisherDockKey) === 'artwork') {
        window.localStorage.removeItem(publisherDockKey);
      }
      return;
    }

    window.localStorage.setItem(artworkDraftKey, JSON.stringify({
      title,
      description,
      imageSource,
      imageUrl,
      artistName,
      selectedCategories,
      hashtags,
      currentHashtag,
      materialUsed,
      artStyle,
      collector,
      price,
      creationYear,
      dimensions,
      selectedBoardId,
      targetUserId: adminMode ? targetUserId : '',
      userSearchQuery: adminMode ? userSearchQuery : '',
      hasFile: Boolean(file),
      fileName: file?.name || '',
      updatedAt: new Date().toISOString(),
    }));
    window.localStorage.setItem(publisherDockKey, 'artwork');
  }, [activeTab, adminMode, artStyle, artistName, artworkDraftKey, artworkDraftReady, collector, creationYear, currentHashtag, description, dimensions, file, hasArtworkDraft, hashtags, imageSource, imageUrl, materialUsed, price, publisherDockKey, selectedBoardId, selectedCategories, targetUserId, title, userSearchQuery]);

  useEffect(() => {
    if (activeTab !== 'artwork' || !artworkDraftReady) return;
    void saveArtworkDraftFile(artworkDraftKey, file).catch(() => {
      if (file) toast.error('The selected image could not be saved with this draft.');
    });
  }, [activeTab, artworkDraftKey, artworkDraftReady, file]);

  useEffect(() => {
    if (activeTab !== 'board') {
      setCollageDraftReady(false);
      return;
    }

    setCollageDraftReady(false);
    try {
      const saved = window.localStorage.getItem(collageDraftKey);
      if (saved) {
        const draft = JSON.parse(saved);
        setBoardName(typeof draft.name === 'string' ? draft.name : '');
        setBoardDesc(typeof draft.description === 'string' ? draft.description : '');
        setIsPrivate(Boolean(draft.isPrivate));
        setSelectedCollageArtworkIds(Array.isArray(draft.artworkIds) ? draft.artworkIds.filter((id: unknown) => typeof id === 'string') : []);
      } else {
        setBoardName('');
        setBoardDesc('');
        setIsPrivate(false);
        setSelectedCollageArtworkIds([]);
      }
    } catch {
      window.localStorage.removeItem(collageDraftKey);
    }
    setCollageDraftReady(true);
  }, [activeTab, collageDraftKey]);

  useEffect(() => {
    if (activeTab !== 'board' || !collageDraftReady) return;
    if (!hasCollageDraft) {
      window.localStorage.removeItem(collageDraftKey);
      if (window.localStorage.getItem(publisherDockKey) === 'board') {
        window.localStorage.removeItem(publisherDockKey);
      }
      return;
    }
    window.localStorage.setItem(collageDraftKey, JSON.stringify({
      name: boardName,
      description: boardDesc,
      isPrivate,
      artworkIds: selectedCollageArtworkIds,
      updatedAt: new Date().toISOString(),
    }));
    window.localStorage.setItem(publisherDockKey, 'board');
  }, [activeTab, boardDesc, boardName, collageDraftKey, collageDraftReady, hasCollageDraft, isPrivate, publisherDockKey, selectedCollageArtworkIds]);

  useEffect(() => {
    if (!isOpen || activeTab !== 'board') return;
    if (adminMode && !targetUserId) {
      setCollageArtworks([]);
      setLoadingCollageArtworks(false);
      return;
    }

    let active = true;
    setLoadingCollageArtworks(true);
    supabase
      .from('artworks')
      .select('id, title, image_url, artist_name, art_style, creation_year')
      .eq('user_id', effectiveUserId)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!active) return;
        if (error) toast.error('Unable to load artworks for this collage.');
        const artworks = (data as CollageArtwork[]) || [];
        const availableIds = new Set(artworks.map((artwork) => artwork.id));
        setCollageArtworks(artworks);
        setSelectedCollageArtworkIds((current) => current.filter((id) => availableIds.has(id)));
        setLoadingCollageArtworks(false);
      });

    return () => { active = false; };
  }, [activeTab, adminMode, effectiveUserId, isOpen, targetUserId]);

  const resetAndClose = () => {
    setActiveTab('menu');
    setTitle(''); setDescription(''); setImageSource('file'); setFile(null); setImageUrl(''); setArtistName(''); setSelectedCategories([]);
    setHashtags([]); setCurrentHashtag(''); setMaterialUsed(''); setArtStyle('');
    setCollector(''); setPrice(''); setCreationYear(''); setDimensions('');
    setBoardName(''); setBoardDesc(''); setIsPrivate(false);
    setSelectedCollageArtworkIds([]); setCollageSearch(''); setCollageArtworks([]);
    setTargetUserId(''); setUserSearchQuery(''); setIsDropdownOpen(false);
    setSelectedBoardId('');
    setIsMinimized(false);
    setArtworkDraftReady(false);
    onClose();
  };

  const clearCollageDraft = () => {
    window.localStorage.removeItem(collageDraftKey);
    if (window.localStorage.getItem(publisherDockKey) === 'board') {
      window.localStorage.removeItem(publisherDockKey);
    }
  };

  const clearArtworkDraft = () => {
    window.localStorage.removeItem(artworkDraftKey);
    if (window.localStorage.getItem(publisherDockKey) === 'artwork') {
      window.localStorage.removeItem(publisherDockKey);
    }
    void saveArtworkDraftFile(artworkDraftKey, null).catch(() => undefined);
  };

  const discardCollageDraft = () => {
    clearCollageDraft();
    resetAndClose();
  };

  const discardArtworkDraft = () => {
    clearArtworkDraft();
    resetAndClose();
  };

  const minimizeCollage = () => {
    window.localStorage.setItem(publisherDockKey, 'board');
    setIsMinimized(true);
    onClose();
  };

  const minimizeArtwork = () => {
    window.localStorage.setItem(publisherDockKey, 'artwork');
    setIsMinimized(true);
    onClose();
  };

  const restoreDraft = () => {
    setIsMinimized(false);
    onRestore?.();
  };

  const dismissPanel = () => {
    if (activeTab === 'board' && hasCollageDraft) {
      minimizeCollage();
      return;
    }
    if (activeTab === 'artwork' && hasArtworkDraft) {
      minimizeArtwork();
      return;
    }
    resetAndClose();
  };

  const toggleCollageArtwork = (artworkId: string) => {
    setSelectedCollageArtworkIds((current) =>
      current.includes(artworkId)
        ? current.filter((id) => id !== artworkId)
        : [...current, artworkId]
    );
  };

  const filteredCollageArtworks = collageArtworks.filter((artwork) => {
    const query = collageSearch.trim().toLowerCase();
    if (!query) return true;
    return [artwork.title, artwork.artist_name, artwork.art_style, artwork.creation_year]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const extractColor = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, 1, 1);
          const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
          resolve("#" + (1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1));
        } else {
          resolve("#2a2a35");
        }
        URL.revokeObjectURL(url);
      };
      img.onerror = () => resolve("#2a2a35");
    });
  };

  const handleHashtagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === ',') {
      e.preventDefault();
      const tag = currentHashtag.trim().replace(/^#/, '');
      if (tag && !hashtags.includes(tag)) {
        setHashtags([...hashtags, tag]);
      }
      setCurrentHashtag('');
    }
  };

  const toggleCategory = (catId: string) => {
    setSelectedCategories(prev =>
      prev.includes(catId) ? prev.filter(c => c !== catId) : [...prev, catId]
    );
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || (imageSource === 'file' ? !file : !imageUrl.trim())) return;
    if (adminMode && !targetUserId) {
      toast.error('Please select an artist to post on behalf of.');
      return;
    }
    if (imageSource === 'file' && file && file.size > MAX_UPLOAD_SIZE) {
      toast.error(`Image must be 10MB or smaller. Selected file is ${formatFileSize(file.size)}.`);
      return;
    }
    setUploading(true);

    try {
      let finalImageUrl = '';
      let extractedColor = '#2a2a35';

      if (imageSource === 'file' && file) {
        const isSafe = await checkImageIsSafe(file);
        if (!isSafe) {
          toast.error('Upload blocked: Inappropriate content detected.');
          return;
        }

        let fileToUpload = file;
        let fileExt = file.name.split('.').pop()?.toLowerCase() || '';
        if (file.type.startsWith('image/') && fileExt !== 'gif') {
          fileToUpload = await compressImage(file);
          fileExt = 'webp';
        }

        if (fileToUpload.size > MAX_UPLOAD_SIZE) {
          toast.error(`Compressed image is still above 10MB (${formatFileSize(fileToUpload.size)}). Please choose a smaller image.`);
          return;
        }

        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${effectiveUserId}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('artworks').upload(filePath, fileToUpload);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('artworks').getPublicUrl(filePath);
        finalImageUrl = urlData.publicUrl;
        extractedColor = await extractColor(fileToUpload);
      } else {
        finalImageUrl = validateHttpsImageUrl(imageUrl);
        await confirmRemoteImageLoads(finalImageUrl);

        const reviewFile = await fetchRemoteImageForReview(finalImageUrl);
        if (reviewFile) {
          const isSafe = await checkImageIsSafe(reviewFile);
          if (!isSafe) {
            toast.error('Registration blocked: Inappropriate content detected.');
            return;
          }
          extractedColor = await extractColor(reviewFile);
        }
      }

      const { data: artwork, error: dbError } = await supabase.from('artworks').insert({
        title, description, image_url: finalImageUrl, user_id: effectiveUserId,
        artist_name: artistName.trim() || null,
        tags: hashtags, material_used: materialUsed, art_style: artStyle,
        collector_or_pricing: collector, price: price ? Number(price) : null, creation_year: creationYear,
        dimensions,
        dominant_color: extractedColor
      }).select().single();
      if (dbError) throw dbError;

      // Tag with categories
      if (selectedCategories.length > 0 && artwork) {
        const { error: categoryError } = await supabase.from('artwork_categories').insert(
          selectedCategories.map(catId => ({ artwork_id: artwork.id, category_id: catId }))
        );
        if (categoryError) throw categoryError;
      }

      // Add to portfolio
      if (selectedBoardId && artwork) {
        const { error: boardItemError } = await supabase.from('board_items').insert({
          board_id: selectedBoardId,
          artwork_id: artwork.id
        });
        if (boardItemError) throw boardItemError;
      }

      toast.success('Artwork registered in the catalog.');
      clearArtworkDraft();
      resetAndClose();
      onArtworkCreated?.();
    } catch (err: any) {
      toast.error('Error: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!boardName.trim()) return;
    if (adminMode && !targetUserId) {
      toast.error('Please select an artist to create the portfolio for.');
      return;
    }
    if (selectedCollageArtworkIds.length === 0) {
      toast.error('Choose at least one registered artwork for the collage.');
      return;
    }
    setCreatingBoard(true);
    try {
      const { data: board, error } = await supabase.from('boards').insert({
        user_id: effectiveUserId, name: boardName.trim(), description: boardDesc.trim(), is_private: isPrivate
      }).select('id').single();
      if (error || !board) throw error || new Error('Collage could not be created.');

      const { error: itemError } = await supabase.from('board_items').insert(
        selectedCollageArtworkIds.map((artworkId) => ({ board_id: board.id, artwork_id: artworkId }))
      );
      if (itemError) {
        await supabase.from('boards').delete().eq('id', board.id);
        throw itemError;
      }

      clearCollageDraft();
      toast.success('Collage published to your portfolio.');
      resetAndClose();
      onBoardCreated?.();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to publish collage.');
    } finally {
      setCreatingBoard(false);
    }
  };

  if (!isOpen && !isMinimized) return null;

  if (!isOpen && isMinimized) {
    const minimizedArtwork = activeTab === 'artwork';
    return (
      <div className="collage-draft-dock" role="status" aria-label={`Minimized ${minimizedArtwork ? 'artwork' : 'collage'} draft`}>
        <button type="button" className="collage-draft-restore" onClick={restoreDraft}>
          <span className="collage-draft-icon">{minimizedArtwork ? <ImagePlus size={18} /> : <FolderPlus size={18} />}</span>
          <span className="collage-draft-copy">
            <strong>{minimizedArtwork ? (title.trim() || file?.name || 'Untitled artwork') : (boardName.trim() || 'Untitled collage')}</strong>
            <small>
              {minimizedArtwork
                ? `${file ? file.name : imageSource === 'url' && imageUrl.trim() ? 'Image URL added' : 'Metadata in progress'} | Draft saved`
                : `${selectedCollageArtworkIds.length} selected | Draft saved`}
            </small>
          </span>
        </button>
        <button type="button" className="collage-draft-discard" onClick={minimizedArtwork ? discardArtworkDraft : discardCollageDraft} aria-label={`Discard ${minimizedArtwork ? 'artwork' : 'collage'} draft`} title="Discard draft">
          <X size={17} />
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Dimmed overlay */}
      <div
        className="create-panel-backdrop"
        onClick={dismissPanel}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
          zIndex: 99998, backdropFilter: 'blur(4px)',
        }}
      />

      {/* Panel */}
      <div className={`create-panel-shell ${activeTab === 'menu' ? 'create-panel-choice' : activeTab === 'board' ? 'create-panel-collage' : 'create-panel-artwork'}`} role="dialog" aria-modal="true" aria-labelledby="create-panel-title" style={{
        position: 'fixed', top: 0, left: 0, width: '380px', maxWidth: '90vw',
        height: '100vh', background: '#fdfbf7', borderRight: '1px solid #e5e0d8',
        zIndex: 99999, display: 'flex', flexDirection: 'column',
        boxShadow: '10px 0 40px rgba(0,0,0,0.1)', backdropFilter: 'blur(20px)',
        animation: 'slideInLeft 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Header */}
        <div className="create-panel-header" style={{ padding: '24px', borderBottom: '1px solid #e5e0d8', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 id="create-panel-title" style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#1a1a1a' }}>
            {activeTab === 'menu' ? 'Publish to ArtVault' : activeTab === 'artwork' ? 'Upload Artwork' : 'Create Collage'}
          </h2>
          <div className="create-panel-header-actions">
            {activeTab !== 'menu' && (
              <button type="button" onClick={activeTab === 'board' ? minimizeCollage : minimizeArtwork} className="create-panel-icon-btn" aria-label={`Minimize ${activeTab === 'board' ? 'collage' : 'artwork'} draft`} title="Minimize draft">
                <Minus size={20} />
              </button>
            )}
            <button type="button" onClick={dismissPanel} className="create-panel-icon-btn" aria-label={(activeTab === 'board' && hasCollageDraft) || (activeTab === 'artwork' && hasArtworkDraft) ? `Minimize ${activeTab === 'board' ? 'collage' : 'artwork'} draft` : 'Close publishing panel'}>
              <X size={22} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="create-panel-body" style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* ─── Menu View ─── */}
          {activeTab === 'menu' && (
            <div className="publish-choice-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p className="publish-choice-intro">Choose how you want to publish your work.</p>
              <button
                className="publish-choice-card"
                onClick={() => setActiveTab('artwork')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px',
                  background: 'rgba(0,0,0,0.04)', border: '1px solid #e5e0d8',
                  borderRadius: '16px', cursor: 'pointer', color: '#1a1a1a', textAlign: 'left', transition: 'all 0.2s',
                }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(74, 52, 36, 0.1)'; e.currentTarget.style.borderColor = 'rgba(74, 52, 36, 0.3)'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#e5e0d8'; }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #4a3424, #382619)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fdfbf7' }}>
                  <ImagePlus size={22} />
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '16px' }}>Upload Artwork</p>
                  <p style={{ margin: 0, color: '#666', fontSize: '13px', marginTop: '2px' }}>Create a catalog entry with image, metadata, and provenance notes</p>
                </div>
              </button>

              <button
                className="publish-choice-card"
                onClick={() => setActiveTab('board')}
                style={{
                  display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px',
                  background: 'rgba(0,0,0,0.04)', border: '1px solid #e5e0d8',
                  borderRadius: '16px', cursor: 'pointer', color: '#1a1a1a', textAlign: 'left', transition: 'all 0.2s',
                }}
                onMouseOver={e => { e.currentTarget.style.background = 'rgba(74, 52, 36, 0.1)'; e.currentTarget.style.borderColor = 'rgba(74, 52, 36, 0.3)'; }}
                onMouseOut={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = '#e5e0d8'; }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #4a3424, #382619)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fdfbf7' }}>
                  <FolderPlus size={22} />
                </div>
                <div>
                  <p style={{ margin: 0, fontWeight: 700, fontSize: '16px' }}>Create Collage</p>
                  <p style={{ margin: 0, color: '#666', fontSize: '13px', marginTop: '2px' }}>Select registered works, save a draft, and publish them as one portfolio</p>
                </div>
              </button>

              <button
                type="button"
                disabled
                aria-disabled="true"
                style={{
                  display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 20px',
                  background: 'linear-gradient(135deg, rgba(184, 145, 85, 0.10), rgba(255, 255, 255, 0.65))',
                  border: '1px solid rgba(184, 145, 85, 0.35)',
                  borderRadius: '16px', cursor: 'not-allowed', color: '#1a1a1a', textAlign: 'left',
                  opacity: 0.95,
                }}
              >
                <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #b89155, #4a3424)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#fdfbf7' }}>
                  <Cloud size={22} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <p style={{ margin: 0, fontWeight: 700, fontSize: '16px' }}>Google Drive Image Vault</p>
                    <span style={{ border: '1px solid rgba(184, 145, 85, 0.45)', color: '#8c6e3d', borderRadius: '999px', padding: '2px 8px', fontSize: '10px', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Coming soon</span>
                  </div>
                  <p style={{ margin: 0, color: '#666', fontSize: '13px', marginTop: '2px' }}>
                    Future image storage and display integration using Google Drive.
                  </p>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                    {['GoogleDriveStorage', 'ImageVault', 'ComingSoon'].map(tag => (
                      <span key={tag} style={{ background: 'rgba(74, 52, 36, 0.08)', color: '#4a3424', borderRadius: '999px', padding: '3px 8px', fontSize: '11px', fontWeight: 700 }}>#{tag}</span>
                    ))}
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* ─── Post Artwork Form ─── */}
          {activeTab === 'artwork' && (
            <form className="artwork-upload-form" onSubmit={handleUpload}>
              <div className="artwork-upload-toolbar">
                <button type="button" onClick={() => setActiveTab('menu')} className="collage-back-btn">
                  Back to publish options
                </button>
                <span className="collage-autosave-status">Draft saved automatically</span>
              </div>

              {adminMode && (
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Post on behalf of (Artist)</label>
                  <input 
                    type="text" 
                    value={userSearchQuery}
                    onChange={e => {
                      setUserSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                      if (targetUserId) setTargetUserId(''); // clear selection if they type again
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                    placeholder="Search name or username..."
                    className="search-input"
                    style={{ width: '100%' }}
                  />
                  {isDropdownOpen && userSearchQuery && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e0d8', borderRadius: '8px', zIndex: 10, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: '4px' }}>
                      {filteredUsers.length > 0 ? filteredUsers.map(u => (
                        <div 
                          key={u.id}
                          onClick={() => {
                            setTargetUserId(u.id);
                            setUserSearchQuery(u.name || u.username || u.email || 'Unnamed');
                            setIsDropdownOpen(false);
                          }}
                          style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f5f0e8' }}
                        >
                          <div style={{ fontWeight: 600, fontSize: '14px', color: '#1a1a1a' }}>{u.name || 'Unnamed'}</div>
                          <div style={{ fontSize: '12px', color: '#888' }}>@{u.username || 'unknown'}</div>
                        </div>
                      )) : (
                        <div style={{ padding: '10px 12px', color: '#888', fontSize: '13px' }}>No users found.</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontSize: '13px', fontWeight: 600 }}>Image Source</label>
                <div role="group" aria-label="Image source" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #d7d0c5', borderRadius: '4px', overflow: 'hidden', background: '#f3efe8' }}>
                  <button
                    type="button"
                    aria-pressed={imageSource === 'file'}
                    onClick={() => setImageSource('file')}
                    style={{ minHeight: '42px', border: 0, borderRight: '1px solid #d7d0c5', background: imageSource === 'file' ? '#1c1917' : 'transparent', color: imageSource === 'file' ? '#fff' : '#57534e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}
                  >
                    <Upload size={15} /> Upload File
                  </button>
                  <button
                    type="button"
                    aria-pressed={imageSource === 'url'}
                    onClick={() => setImageSource('url')}
                    style={{ minHeight: '42px', border: 0, background: imageSource === 'url' ? '#1c1917' : 'transparent', color: imageSource === 'url' ? '#fff' : '#57534e', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}
                  >
                    <Link2 size={15} /> HTTPS URL
                  </button>
                </div>
              </div>

              {imageSource === 'file' ? (
                <div style={{ border: '2px dashed rgba(74, 52, 36, 0.3)', borderRadius: '8px', padding: '30px', textAlign: 'center', cursor: 'pointer', position: 'relative', background: file ? 'rgba(74, 52, 36, 0.05)' : 'transparent', transition: 'all 0.2s' }}>
                  <Upload size={28} style={{ color: '#4a3424', marginBottom: '8px' }} />
                  <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>{file ? `${file.name} (${formatFileSize(file.size)})` : 'Click or drop image here'}</p>
                  <p style={{ color: '#8c6e3d', fontSize: '11px', margin: '6px 0 0', letterSpacing: '0.5px', textTransform: 'uppercase' }}>10MB maximum, optimized to WebP</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => {
                      const selected = e.target.files?.[0] || null;
                      if (selected && selected.size > MAX_UPLOAD_SIZE) {
                        toast.error(`Image must be 10MB or smaller. Selected file is ${formatFileSize(selected.size)}.`);
                        e.currentTarget.value = '';
                        setFile(null);
                        return;
                      }
                      setFile(selected);
                    }}
                    required={imageSource === 'file'}
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                  />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ position: 'relative' }}>
                    <Link2 size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#8a8178', pointerEvents: 'none' }} />
                    <input
                      type="url"
                      inputMode="url"
                      value={imageUrl}
                      onChange={e => setImageUrl(e.target.value)}
                      placeholder="https://images.example.com/artwork.jpg"
                      aria-label="Direct HTTPS image URL"
                      required={imageSource === 'url'}
                      className="search-input"
                      style={{ width: '100%', paddingLeft: '38px' }}
                    />
                  </div>
                  {imageUrl.trim().startsWith('https://') && (
                    <div style={{ border: '1px solid #d7d0c5', background: '#eee8dd', minHeight: '180px', display: 'grid', placeItems: 'center', overflow: 'hidden' }}>
                      <img
                        src={imageUrl.trim()}
                        alt="Remote artwork preview"
                        style={{ display: 'block', width: '100%', height: '220px', objectFit: 'contain' }}
                      />
                    </div>
                  )}
                  <p style={{ margin: 0, color: '#7a6f63', fontSize: '11px', lineHeight: 1.5 }}>
                    Original HTTPS file referenced directly. No compression, conversion, or re-upload.
                  </p>
                </div>
              )}

              <div style={{ border: '1px solid rgba(184, 145, 85, 0.28)', background: 'rgba(184, 145, 85, 0.08)', borderRadius: '14px', padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: '#4a3424', fontWeight: 800, fontSize: '13px' }}>
                  <Cloud size={16} />
                  Google Drive image storage is coming soon
                </div>
                <p style={{ margin: 0, color: '#6f6358', fontSize: '12px', lineHeight: 1.5 }}>
                  Direct HTTPS image URLs are available now. Google Drive sharing and managed display integration will arrive in a future release.
                </p>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {['GoogleDriveStorage', 'ImageDisplay', 'ComingSoon'].map(tag => (
                    <span key={tag} style={{ background: '#fdfbf7', color: '#4a3424', border: '1px solid rgba(74, 52, 36, 0.12)', borderRadius: '999px', padding: '3px 8px', fontSize: '11px', fontWeight: 700 }}>#{tag}</span>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Artwork Title</label>
                <input type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Nocturne in Gold" required className="search-input" style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Original Creator / Artist</label>
                <input
                  type="text"
                  value={artistName}
                  onChange={e => setArtistName(e.target.value)}
                  placeholder="e.g. Vincent van Gogh; leave blank if this is your own work"
                  className="search-input"
                  style={{ width: '100%' }}
                />
                <p style={{ margin: '6px 0 0', color: '#8a8178', fontSize: '11px', lineHeight: 1.5 }}>
                  The logged-in account remains the registered owner of this record.
                </p>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Catalog Notes</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Provenance, exhibition history, condition notes, or collection context" className="search-input" style={{ height: '80px', resize: 'vertical' }} />
              </div>

              {/* Hashtags */}
              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#666', fontSize: '13px', fontWeight: 600 }}>Catalog Tags</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                  {hashtags.map((tag, idx) => (
                    <span key={idx} style={{ background: 'rgba(74, 52, 36, 0.1)', color: '#4a3424', padding: '4px 10px', borderRadius: '14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      #{tag}
                      <button type="button" onClick={() => setHashtags(hashtags.filter(t => t !== tag))} style={{ background: 'none', border: 'none', color: '#4a3424', cursor: 'pointer', padding: 0 }}>×</button>
                    </span>
                  ))}
                </div>
                <input type="text" value={currentHashtag} onChange={e => setCurrentHashtag(e.target.value)} onKeyDown={handleHashtagKeyDown} placeholder="Type a tag and press Enter" className="search-input" />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Material Used</label>
                  <select value={materialUsed} onChange={e => setMaterialUsed(e.target.value)} className="search-input" style={{ width: '100%', appearance: 'none' }}>
                    <option value="">Select Material</option>
                    <option value="Oil on canvas">Oil on canvas</option>
                    <option value="Acrylic on canvas">Acrylic on canvas</option>
                    <option value="Watercolor on paper">Watercolor on paper</option>
                    <option value="Charcoal on paper">Charcoal on paper</option>
                    <option value="Graphite on paper">Graphite on paper</option>
                    <option value="Pastel on paper">Pastel on paper</option>
                    <option value="Gouache">Gouache</option>
                    <option value="Fresco">Fresco</option>
                    <option value="Mixed Media (Traditional)">Mixed Media (Traditional)</option>
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Year Created</label>
                  <input type="text" value={creationYear} onChange={e => setCreationYear(e.target.value)} placeholder="e.g. 1889" className="search-input" style={{ width: '100%' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Art Style</label>
                <input type="text" value={artStyle} onChange={e => setArtStyle(e.target.value)} placeholder="e.g. Renaissance portrait, modern abstraction" className="search-input" style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Dimensions</label>
                <input type="text" value={dimensions} onChange={e => setDimensions(e.target.value)} placeholder="e.g. 23 x 46 in, framed" className="search-input" style={{ width: '100%' }} />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Collector / Status</label>
                  <input type="text" value={collector} onChange={e => setCollector(e.target.value)} placeholder="e.g. Private Collection, Available" className="search-input" style={{ width: '100%' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Price</label>
                  <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. 5000" className="search-input" style={{ width: '100%' }} />
                </div>
              </div>

              {/* Category Tags */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontSize: '13px', fontWeight: 600 }}>Portfolio Categories</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => toggleCategory(cat.id)}
                      style={{
                        padding: '6px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s', border: '1px solid',
                        background: selectedCategories.includes(cat.id) ? 'rgba(74, 52, 36, 0.1)' : 'rgba(0,0,0,0.04)',
                        borderColor: selectedCategories.includes(cat.id) ? '#4a3424' : '#e5e0d8',
                        color: selectedCategories.includes(cat.id) ? '#4a3424' : '#666',
                      }}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Add to Portfolio / Board */}
              <div>
                <label style={{ display: 'block', marginBottom: '8px', color: '#666', fontSize: '13px', fontWeight: 600 }}>Add to Portfolio (Optional)</label>
                <select 
                   value={selectedBoardId} 
                   onChange={e => setSelectedBoardId(e.target.value)}
                   className="search-input" 
                   style={{ width: '100%', appearance: 'none' }}
                >
                  <option value="">No portfolio</option>
                  {userBoards.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div className="artwork-upload-actions">
                <button type="button" className="btn" onClick={discardArtworkDraft}>Discard Draft</button>
                <button type="button" className="btn" onClick={minimizeArtwork}><Minus size={15} /> Minimize</button>
                <button type="submit" className="btn btn-primary" disabled={uploading}>
                  {uploading ? 'Registering...' : 'Register Artwork'}
                </button>
              </div>
            </form>
          )}

          {/* ─── Create Board Form ─── */}
          {activeTab === 'board' && (
            <form className="collage-composer" onSubmit={handleCreateBoard}>
              <div className="collage-composer-toolbar">
                <button type="button" onClick={() => setActiveTab('menu')} className="collage-back-btn">
                  Back to publish options
                </button>
                <span className="collage-autosave-status">Draft saved automatically</span>
              </div>
              
              {adminMode && (
                <div style={{ position: 'relative' }}>
                  <label style={{ display: 'block', marginBottom: '6px', color: '#888', fontSize: '13px', fontWeight: 600 }}>Create for (Artist)</label>
                  <input 
                    type="text" 
                    value={userSearchQuery}
                    onChange={e => {
                      setUserSearchQuery(e.target.value);
                      setIsDropdownOpen(true);
                      if (targetUserId) setTargetUserId(''); // clear selection if they type again
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    onBlur={() => setTimeout(() => setIsDropdownOpen(false), 200)}
                    placeholder="Search name or username..."
                    className="search-input"
                    style={{ width: '100%' }}
                  />
                  {isDropdownOpen && userSearchQuery && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e5e0d8', borderRadius: '8px', zIndex: 10, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: '4px' }}>
                      {filteredUsers.length > 0 ? filteredUsers.map(u => (
                        <div 
                          key={u.id}
                          onClick={() => {
                            setTargetUserId(u.id);
                            setUserSearchQuery(u.name || u.username || u.email || 'Unnamed');
                            setIsDropdownOpen(false);
                          }}
                          style={{ padding: '10px 12px', cursor: 'pointer', borderBottom: '1px solid #f5f0e8' }}
                        >
                          <div style={{ fontWeight: 600, fontSize: '14px', color: '#1a1a1a' }}>{u.name || 'Unnamed'}</div>
                          <div style={{ fontSize: '12px', color: '#888' }}>@{u.username || 'unknown'}</div>
                        </div>
                      )) : (
                        <div style={{ padding: '10px 12px', color: '#888', fontSize: '13px' }}>No users found.</div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="collage-composer-layout">
                <section className="collage-details-panel" aria-labelledby="collage-details-heading">
                  <div>
                    <span className="collage-section-kicker">Collage details</span>
                    <h3 id="collage-details-heading">Build the portfolio record</h3>
                  </div>

                  <label className="collage-field">
                    <span>Collage name</span>
                    <input type="text" value={boardName} onChange={e => setBoardName(e.target.value)} placeholder="Renaissance Masterpieces" required className="search-input" />
                  </label>

                  <label className="collage-field">
                    <span>Description</span>
                    <textarea value={boardDesc} onChange={e => setBoardDesc(e.target.value)} placeholder="Describe the theme, period, or purpose of this collage..." className="search-input" />
                  </label>

                  <label className="collage-privacy-toggle" htmlFor="create-private">
                    <input type="checkbox" id="create-private" checked={isPrivate} onChange={e => setIsPrivate(e.target.checked)} />
                    <span>
                      <strong>Private collage</strong>
                      <small>Only the owner can view this portfolio.</small>
                    </span>
                  </label>

                  <div className="collage-selection-summary">
                    <strong>{selectedCollageArtworkIds.length}</strong>
                    <span>artwork{selectedCollageArtworkIds.length === 1 ? '' : 's'} selected</span>
                  </div>
                </section>

                <section className="collage-artwork-panel" aria-labelledby="collage-artworks-heading">
                  <div className="collage-artwork-heading">
                    <div>
                      <span className="collage-section-kicker">Artwork placement</span>
                      <h3 id="collage-artworks-heading">Choose registered works</h3>
                    </div>
                    <span>{filteredCollageArtworks.length} available</span>
                  </div>

                  <label className="collage-search-field">
                    <Search size={16} aria-hidden="true" />
                    <input
                      type="search"
                      value={collageSearch}
                      onChange={(event) => setCollageSearch(event.target.value)}
                      placeholder="Search title, creator, style, or year"
                      aria-label="Search artworks for collage"
                    />
                  </label>

                  <div className="collage-artwork-grid">
                    {loadingCollageArtworks ? (
                      <div className="collage-artwork-empty">Loading registered works...</div>
                    ) : filteredCollageArtworks.length === 0 ? (
                      <div className="collage-artwork-empty">
                        {adminMode && !targetUserId ? 'Select an artist first.' : 'No registered artworks match this search.'}
                      </div>
                    ) : (
                      filteredCollageArtworks.map((artwork) => {
                        const selected = selectedCollageArtworkIds.includes(artwork.id);
                        return (
                          <button
                            key={artwork.id}
                            type="button"
                            className={`collage-artwork-option ${selected ? 'selected' : ''}`}
                            onClick={() => toggleCollageArtwork(artwork.id)}
                            aria-pressed={selected}
                          >
                            <span className="collage-artwork-image">
                              <img
                                src={artwork.image_url}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                onError={(event) => {
                                  event.currentTarget.style.display = 'none';
                                  event.currentTarget.parentElement?.classList.add('image-unavailable');
                                }}
                              />
                              {selected && <span className="collage-artwork-check"><Check size={14} /></span>}
                            </span>
                            <span className="collage-artwork-copy">
                              <strong>{artwork.title}</strong>
                              <small>{[artwork.artist_name, artwork.creation_year].filter(Boolean).join(' · ') || artwork.art_style || 'Registered work'}</small>
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                </section>
              </div>

              <div className="collage-composer-actions">
                <button type="button" className="btn btn-secondary" onClick={discardCollageDraft}>Discard Draft</button>
                <button type="button" className="btn btn-secondary" onClick={minimizeCollage}><Minus size={15} /> Minimize</button>
                <button type="submit" className="btn btn-primary" disabled={creatingBoard || !boardName.trim() || selectedCollageArtworkIds.length === 0}>
                  {creatingBoard ? 'Publishing...' : `Publish Collage (${selectedCollageArtworkIds.length})`}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </>
  );
}
