import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from './supabaseClient';

const fallbackImages = [
  {
    url: "https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?q=80&w=600&auto=format&fit=crop",
    className: "w-40 h-48 md:w-48 md:h-56 -top-10 left-0",
    delay: 0
  },
  {
    url: "https://images.unsplash.com/photo-1547826039-bfc35e0f1ea8?q=80&w=600&auto=format&fit=crop",
    className: "w-48 h-64 md:w-64 md:h-80 top-20 left-32 md:left-40 z-10",
    delay: 0.2
  },
  {
    url: "https://images.unsplash.com/photo-1578301978018-3005759f48f7?q=80&w=600&auto=format&fit=crop",
    className: "w-32 h-40 md:w-40 md:h-48 bottom-0 -right-4 md:right-10",
    delay: 0.4
  },
  {
    url: "https://images.unsplash.com/photo-1557672172-298e090bd0f1?q=80&w=600&auto=format&fit=crop",
    className: "w-36 h-36 md:w-44 md:h-44 -bottom-10 left-10",
    delay: 0.6
  }
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [displayImages, setDisplayImages] = useState(fallbackImages);
  const dbUrlsRef = useRef<string[]>([]);

  const shuffleAndSet = () => {
    const urls = dbUrlsRef.current;
    if (urls.length === 0) return;
    const shuffled = [...urls].sort(() => 0.5 - Math.random());
    setDisplayImages(fallbackImages.map((fallback, i) => ({
      ...fallback,
      url: shuffled[i] || fallback.url
    })));
  };

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval>;
    
    const fetchArtworks = async () => {
      // Fetch up to 20 recent artworks from the database
      const { data } = await supabase.from('artworks').select('image_url').order('created_at', { ascending: false }).limit(20);
      
      if (data && data.length > 0) {
        dbUrlsRef.current = data.map(item => item.image_url).filter(Boolean);
        shuffleAndSet(); // Run initially
        intervalId = setInterval(shuffleAndSet, 8000); // Reshuffle every 8 seconds
      }
    };
    
    fetchArtworks();
    
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0c10] text-white overflow-x-hidden font-sans">
      {/* Header */}
      <header className="fixed top-0 w-full h-20 px-6 flex justify-between items-center z-50 bg-[#0b0c10]/80 backdrop-blur-md border-b border-white/5">
        {/* Logo Container - Absolute centering to handle massive image padding */}
        <div className="flex items-center">
          <img 
            src="/artvault_logo.png" 
            alt="ArtVault Logo" 
            className="absolute left-2 md:left-6 top-1/2 -translate-y-1/2 h-[160px] md:h-[200px] w-auto object-contain mix-blend-screen pointer-events-none" 
          />
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => navigate('/login?mode=login')}
            className="px-4 py-2 rounded-full font-medium hover:bg-white/10 transition-colors"
          >
            Log in
          </button>
          <button 
            onClick={() => navigate('/login?mode=register')}
            className="px-4 py-2 rounded-full font-medium bg-white text-black hover:bg-gray-200 transition-colors"
          >
            Sign up
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="relative pt-32 pb-20 px-8 md:px-16 xl:px-24 max-w-[1400px] mx-auto flex flex-col lg:flex-row items-center justify-between min-h-[90vh]">
        
        {/* Left Content */}
        <div className="w-full lg:w-1/2 flex flex-col items-center text-center z-20 mt-10 lg:mt-0 lg:pr-10">
          <motion.h1 
            className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.1]"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            Create the <br/>
            gallery you <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-500">
              love on ArtVault
            </span>
          </motion.h1>
          
          <motion.p 
            className="mt-6 text-lg md:text-xl text-gray-400 max-w-lg"
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
        <div className="w-full lg:w-1/2 h-[500px] md:h-[600px] relative mt-32 lg:mt-0 perspective-1000 flex justify-center">
          <div className="relative w-[340px] md:w-[420px] h-full flex-shrink-0">
            {displayImages.map((img, idx) => (
              <motion.div
                key={idx}
                className={`absolute rounded-2xl overflow-hidden shadow-2xl border border-white/10 ${img.className}`}
                initial={{ opacity: 0, y: 50, scale: 0.9, rotateX: 10, rotateY: -10 }}
                animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0, rotateY: 0 }}
                transition={{ 
                  duration: 1, 
                  delay: img.delay, 
                  type: "spring",
                  stiffness: 100,
                  damping: 20
                }}
                whileHover={{ scale: 1.05, zIndex: 50, transition: { duration: 0.3 } }}
              >
                <motion.div 
                  className="w-full h-full relative"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ 
                    duration: 4, 
                    repeat: Infinity, 
                    ease: "easeInOut",
                    delay: img.delay 
                  }}
                >
                  <AnimatePresence mode="wait">
                    <motion.img 
                      key={img.url}
                      src={img.url} 
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

      {/* Secondary Section */}
      <section className="bg-zinc-900/40 py-32 px-8 md:px-16 border-t border-white/5 text-center flex flex-col items-center justify-center relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[2px] bg-gradient-to-r from-transparent via-purple-500/50 to-transparent"></div>
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none"></div>

        <motion.h2 
          className="text-4xl md:text-5xl font-extrabold tracking-tight mb-8 text-white relative z-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          Bring your creative ideas to life
        </motion.h2>
        <motion.div 
          className="text-lg md:text-xl text-gray-400 max-w-3xl leading-relaxed relative z-10 space-y-2"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <p>
            With ArtVault, you unlock powerful tools that spark your creativity.
          </p>
          <p>
            Connect with brilliant artists globally, curate stunning galleries, and find endless inspiration to fuel your next masterpiece.
          </p>
        </motion.div>
      </section>
    </div>
  );
}
