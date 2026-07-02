-- =============================================
-- ArtVault: Admin RLS Bypass Policies
-- Run this ENTIRE script in the Supabase SQL Editor
-- This allows Admins and Moderators to create records on behalf of other users
-- =============================================

-- 1. Bypass for Boards (Portfolios)
CREATE POLICY "Admins can insert boards"
ON public.boards FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  )
);

-- 2. Bypass for Board Items (Assigning artwork to a portfolio)
CREATE POLICY "Admins can insert board items"
ON public.board_items FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  )
);

-- 3. Bypass for Artworks
CREATE POLICY "Admins can insert artworks"
ON public.artworks FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  )
);

-- 4. Bypass for Artwork Categories (Tagging categories)
CREATE POLICY "Admins can insert artwork categories"
ON public.artwork_categories FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'moderator')
  )
);

-- Reload Schema Cache for API
NOTIFY pgrst, 'reload schema';
