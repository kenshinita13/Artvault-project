-- =============================================
-- ArtVault: Create Collages (Boards) Schema
-- Run this ENTIRE script in Supabase SQL Editor
-- =============================================

-- 1. Create the boards table
CREATE TABLE IF NOT EXISTS public.boards (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_private BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create the board_items table (junction table between boards and artworks)
CREATE TABLE IF NOT EXISTS public.board_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  board_id UUID NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  artwork_id UUID NOT NULL REFERENCES public.artworks(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(board_id, artwork_id) -- Prevent adding the same artwork twice to the same board
);

-- 3. Enable RLS on boards
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;

-- 4. Enable RLS on board_items
ALTER TABLE public.board_items ENABLE ROW LEVEL SECURITY;

-- ========================================================
-- Security Policies for Boards (Collages)
-- ========================================================
CREATE POLICY "Users can insert own boards"
ON public.boards FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own boards"
ON public.boards FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own boards"
ON public.boards FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view public boards"
ON public.boards FOR SELECT
USING (is_private = false OR auth.uid() = user_id);

-- ========================================================
-- Security Policies for Board Items (Items inside collages)
-- ========================================================
CREATE POLICY "Users can add items to their own boards"
ON public.board_items FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.boards 
    WHERE id = board_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Users can remove items from their own boards"
ON public.board_items FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.boards 
    WHERE id = board_id AND user_id = auth.uid()
  )
);

CREATE POLICY "Anyone can view items in public boards"
ON public.board_items FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.boards 
    WHERE id = board_id AND (is_private = false OR user_id = auth.uid())
  )
);

-- Reload Schema Cache for API
NOTIFY pgrst, 'reload schema';
