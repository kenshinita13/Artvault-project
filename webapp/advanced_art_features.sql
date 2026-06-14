-- =============================================
-- ArtVault: Advanced Artwork Features
-- Adds Hashtags, Medium, Tools, and Dominant Color support
-- Run this ENTIRE script in Supabase SQL Editor
-- =============================================

-- Add new columns to the artworks table safely
ALTER TABLE public.artworks
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS medium TEXT,
ADD COLUMN IF NOT EXISTS tools TEXT,
ADD COLUMN IF NOT EXISTS dominant_color TEXT;

-- Reload Schema Cache for API
NOTIFY pgrst, 'reload schema';
