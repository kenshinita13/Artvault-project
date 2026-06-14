import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

// 6 images for the masonry grid (mobile) + 4 for desktop collage
const fallbackImages = [
  "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?q=80&w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1578301978018-3005759f48f7?q=80&w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1557672172-298e090bd0f1?q=80&w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1541961017774-22349e4a1262?q=80&w=600&auto=format&fit=crop",
  "https://images.unsplash.com/photo-1536924940846-227afb31e2a5?q=80&w=600&auto=format&fit=crop",
];

// Desktop floating card config
const desktopCards = [
  { delay: 0,   className: "w-48 h-56 md:w-48 md:h-56 -top-10 left-0" },
  { delay: 0.2, className: "w-64 h-80 md:w-64 md:h-80 top-20 left-40 z-10" },
  { delay: 0.4, className: "w-40 h-48 md:w-40 md:h-48 bottom-0 right-10" },
  { delay: 0.6, className: "w-44 h-44 md:w-44 md:h-44 -bottom-10 left-10" },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [imageUrls, setImageUrls] = useState<string[]>(fallbackImages);
  const dbUrlsRef = useRef<string[]>([]);

  const shuffleAndSet = () => {
    const urls = dbUrlsRef.current;
    if (urls.length === 0) return;
    const shuffled = [...urls].sort(() => 0.5 - Math.random());
    // Ensure we always have at least 6 images
    const padded = shuffled.length >= 6
      ? shuffled.slice(0, 6)
      : [...shuffled, ...fallbackImages].slice(0, 6);
    setImageUrls(padded);
  };

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    const fetchArtworks = async () => {
      const { data } = await supabase
        .from('artworks')
        .select('image_url')
        .order('created_at', { ascending: false })
        .limit(20);
      if (data && data.length > 0) {
        dbUrlsRef.current = data.map(item => item.image_url).filter(Boolean);
        shuffleAndSet();
        intervalId = setInterval(shuffleAndSet, 8000);
      }
    };
    fetchArtworks();
    return () => { if (intervalId) clearInterval(intervalId); };
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0c10] text-white overflow-x-hidden font-sans">

      {/* ─── Header ─── */}
      <header className="fixed top-0 w-full h-16 md:h-20 px-4 md:px-6 flex justify-between items-center z-50 bg-[#0b0c10]/90 backdrop-blur-md border-b border-white/5">
        {/* Logo */}
        <div className="relative flex items-center h-full">
          <img
            src="/artvault_logo.png"
            alt="ArtVault Logo"
            className="absolute left-0 top-1/2 -translate-y-1/2 h-[90px] sm:h-[120px] md:h-[160px] w-auto object-contain mix-blend-screen pointer-events-none"
          />
          {/* invisible spacer so flex doesn't collapse */}
          <span className="inline-block w-[80px] sm:w-[110px] md:w-[150px]" />
        </div>

        {/* Nav Buttons */}
        <div className="flex gap-2 sm:gap-3 z-10">
          <button
            onClick={() => navigate('/login?mode=login')}
            className="px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-full font-medium text-white hover:bg-white/10 transition-colors whitespace-nowrap"
          >
            Log in
          </button>
          <button
            onClick={() => navigate('/login?mode=register')}
            className="px-3 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base rounded-full font-semibold bg-white text-black hover:bg-gray-200 transition-colors whitespace-nowrap"
          >
            Sign up
          </button>
        </div>
      </header>

      {/* ─────────────────────────────────────────────────────────
          MOBILE HERO  (visible only on < lg screens)
          Pinterest-style: masonry grid → text → buttons
      ───────────────────────────────────────────────────────── */}
      <div className="lg:hidden flex flex-col min-h-screen pt-16">

        {/* Masonry image grid */}
        <div className="w-full px-2 pt-3 pb-4">
          <div className="columns-3 gap-2 [column-fill:_balance]">
            {imageUrls.map((url, idx) => (
              <motion.div
                key={`${url}-${idx}`}
                className="mb-2 rounded-xl overflow-hidden break-inside-avoid"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.07 }}
              >
                <AnimatePresence mode="wait">
                  <motion.img
                    key={url}
                    src={url}
                    alt="ArtVault Artwork"
                    className="w-full h-auto object-cover"
                    style={{ aspectRatio: idx % 3 === 1 ? '3/4' : idx % 3 === 0 ? '4/5' : '2/3' }}
                    initial={{ opacity: 0, filter: 'blur(8px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.6 }}
                    loading="lazy"
                  />
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Text + Buttons below the grid */}
        <div className="flex flex-col items-center text-center px-6 pb-12 pt-2">
          <motion.h1
            className="text-4xl font-extrabold tracking-tight leading-tight text-white"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Create the gallery you{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
              love on ArtVault
            </span>
          </motion.h1>

          <motion.p
            className="mt-4 text-base text-gray-400 max-w-sm"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
          >
            The world's premier platform to discover, showcase, and curate breathtaking digital masterpieces.
          </motion.p>

          <motion.div
            className="mt-6 flex flex-col gap-3 w-full max-w-xs"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <button
              onClick={() => navigate('/login?mode=register')}
              className="w-full py-3.5 rounded-full font-semibold text-base bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg shadow-purple-500/30"
            >
              Join ArtVault for free
            </button>
            <button
              onClick={() => navigate('/login?mode=login')}
              className="w-full py-3.5 rounded-full font-semibold text-base bg-white/5 hover:bg-white/10 border border-white/15 transition-all"
            >
              I already have an account
            </button>
          </motion.div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────
          DESKTOP HERO  (visible only on lg+ screens)
          Original side-by-side: text left, floating collage right
      ───────────────────────────────────────────────────────── */}
      <main className="hidden lg:flex relative pt-32 pb-20 px-16 xl:px-24 max-w-[1400px] mx-auto flex-row items-center justify-between min-h-[90vh]">

        {/* Left Content */}
        <div className="w-1/2 flex flex-col items-start text-left z-20 pr-10">
          <motion.h1
            className="text-6xl xl:text-7xl font-extrabold tracking-tight leading-[1.1]"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            Create the <br />
            gallery you <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
              love on ArtVault
            </span>
          </motion.h1>

          <motion.p
            className="mt-6 text-xl text-gray-400 max-w-lg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            The world's premier platform to discover, showcase, and curate breathtaking digital masterpieces.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-col sm:flex-row gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
          >
            <button
              onClick={() => navigate('/login?mode=register')}
              className="px-8 py-4 rounded-full font-semibold text-lg bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 transition-all shadow-lg shadow-purple-500/25"
            >
              Join ArtVault for free
            </button>
            <button
              onClick={() => navigate('/login?mode=login')}
              className="px-8 py-4 rounded-full font-semibold text-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
            >
              I already have an account
            </button>
          </motion.div>
        </div>

        {/* Right Content - Floating Collage */}
        <div className="w-1/2 h-[600px] relative perspective-1000 flex justify-center">
          <div className="relative w-[420px] h-full flex-shrink-0">
            {desktopCards.map((card, idx) => (
              <motion.div
                key={idx}
                className={`absolute rounded-2xl overflow-hidden shadow-2xl border border-white/10 ${card.className}`}
                initial={{ opacity: 0, y: 50, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 1, delay: card.delay, type: "spring", stiffness: 100, damping: 20 }}
                whileHover={{ scale: 1.05, zIndex: 50, transition: { duration: 0.3 } }}
              >
                <motion.div
                  className="w-full h-full relative"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: card.delay }}
                >
                  <AnimatePresence mode="wait">
                    <motion.img
                      key={imageUrls[idx] || idx}
                      src={imageUrls[idx] || fallbackImages[idx]}
                      alt="ArtVault Artwork"
                      className="absolute inset-0 w-full h-full object-cover"
                      initial={{ opacity: 0.5, filter: "blur(10px)", scale: 1.1 }}
                      animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
                      exit={{ opacity: 0.5, filter: "blur(10px)", scale: 1.1 }}
                      transition={{ duration: 0.8 }}
                    />
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>
      </main>

      {/* ─── Secondary Section ─── */}
      <section className="bg-zinc-900/40 py-20 sm:py-32 px-6 sm:px-8 md:px-16 border-t border-white/5 text-center flex flex-col items-center justify-center relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[2px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent" />
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

        <motion.h2
          className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight mb-6 sm:mb-8 text-white relative z-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          Bring your creative ideas to life
        </motion.h2>
        <motion.div
          className="text-base sm:text-lg md:text-xl text-gray-400 max-w-3xl leading-relaxed relative z-10 space-y-2 px-4 sm:px-0"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <p>With ArtVault, you unlock powerful tools that spark your creativity.</p>
          <p>Connect with brilliant artists globally, curate stunning galleries, and find endless inspiration to fuel your next masterpiece.</p>
        </motion.div>
      </section>
    </div>
  );
}
