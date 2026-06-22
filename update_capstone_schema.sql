-- =============================================
-- ArtVault: Capstone Requirements Schema Update
-- Adds Artist Name, Material Used, Collector/Pricing, Price, and Creation Year
-- Run this ENTIRE script in Supabase SQL Editor
-- =============================================

ALTER TABLE public.artworks
ADD COLUMN IF NOT EXISTS artist_name TEXT,
ADD COLUMN IF NOT EXISTS material_used TEXT,
ADD COLUMN IF NOT EXISTS collector_or_pricing TEXT,
ADD COLUMN IF NOT EXISTS price NUMERIC,
ADD COLUMN IF NOT EXISTS creation_year TEXT;

-- Reload Schema Cache for API
NOTIFY pgrst, 'reload schema';
