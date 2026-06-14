-- =============================================
-- ArtVault: Full Style Migration
-- Run this ENTIRE script in Supabase SQL Editor
-- =============================================

-- ─── LIKES TABLE ───
CREATE TABLE IF NOT EXISTS public.likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  artwork_id UUID NOT NULL REFERENCES public.artworks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(artwork_id, user_id)
);

-- ─── COMMENTS TABLE ───
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  artwork_id UUID NOT NULL REFERENCES public.artworks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── BOARDS TABLE (Collections) ───
CREATE TABLE IF NOT EXISTS public.boards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── BOARD ITEMS (Saved artworks in boards) ───
CREATE TABLE IF NOT EXISTS public.board_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  artwork_id UUID NOT NULL REFERENCES public.artworks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(board_id, artwork_id)
);

-- ─── CATEGORIES TABLE ───
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE
);

-- ─── ARTWORK CATEGORIES (many-to-many) ───
CREATE TABLE IF NOT EXISTS public.artwork_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  artwork_id UUID NOT NULL REFERENCES public.artworks(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  UNIQUE(artwork_id, category_id)
);

-- ════════════════════════════════════
-- Enable RLS on ALL new tables
-- ════════════════════════════════════
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.artwork_categories ENABLE ROW LEVEL SECURITY;

-- ─── LIKES POLICIES ───
CREATE POLICY "Anyone can view likes" ON public.likes FOR SELECT USING (true);
CREATE POLICY "Authenticated users can like" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike their own" ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- ─── COMMENTS POLICIES ───
CREATE POLICY "Anyone can view comments" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Authenticated users can comment" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own comments" ON public.comments FOR DELETE USING (auth.uid() = user_id);

-- ─── BOARDS POLICIES ───
CREATE POLICY "Users can view own boards" ON public.boards FOR SELECT USING (auth.uid() = user_id OR is_private = false);
CREATE POLICY "Authenticated users can create boards" ON public.boards FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own boards" ON public.boards FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own boards" ON public.boards FOR DELETE USING (auth.uid() = user_id);

-- ─── BOARD ITEMS POLICIES ───
CREATE POLICY "Anyone can view board items" ON public.board_items FOR SELECT USING (true);
CREATE POLICY "Authenticated users can save to boards" ON public.board_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can remove from own boards" ON public.board_items FOR DELETE USING (auth.uid() = user_id);

-- ─── CATEGORIES POLICIES ───
CREATE POLICY "Anyone can view categories" ON public.categories FOR SELECT USING (true);

-- ─── ARTWORK CATEGORIES POLICIES ───
CREATE POLICY "Anyone can view artwork categories" ON public.artwork_categories FOR SELECT USING (true);
CREATE POLICY "Authenticated users can tag artworks" ON public.artwork_categories FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can remove tags" ON public.artwork_categories FOR DELETE USING (true);

-- ════════════════════════════════════
-- Seed Categories (Art Vault themed)
-- ════════════════════════════════════
INSERT INTO public.categories (name, slug) VALUES
  ('Classic Art', 'classic-art'),
  ('Modern Art', 'modern-art'),
  ('Digital Art', 'digital-art'),
  ('Anime & Manga', 'anime-manga'),
  ('Photography', 'photography'),
  ('Sculpture', 'sculpture'),
  ('Abstract', 'abstract'),
  ('Portraits', 'portraits'),
  ('Landscapes', 'landscapes'),
  ('Fan Art', 'fan-art'),
  ('Concept Art', 'concept-art'),
  ('Illustration', 'illustration')
ON CONFLICT (slug) DO NOTHING;
