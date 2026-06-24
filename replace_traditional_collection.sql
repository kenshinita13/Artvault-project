-- =============================================
-- ArtVault: Traditional Museum Collection Reset
-- Deletes digital / celebrity demo artworks and seeds traditional art.
-- Source images use public-domain Art Institute of Chicago IIIF records.
-- Run this ENTIRE script in Supabase SQL Editor.
-- =============================================

ALTER TABLE public.artworks
ADD COLUMN IF NOT EXISTS artist_name TEXT,
ADD COLUMN IF NOT EXISTS material_used TEXT,
ADD COLUMN IF NOT EXISTS art_style TEXT,
ADD COLUMN IF NOT EXISTS dimensions TEXT,
ADD COLUMN IF NOT EXISTS collector_or_pricing TEXT,
ADD COLUMN IF NOT EXISTS price NUMERIC,
ADD COLUMN IF NOT EXISTS creation_year TEXT,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS medium TEXT,
ADD COLUMN IF NOT EXISTS dominant_color TEXT;

CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS public.artwork_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  artwork_id UUID NOT NULL REFERENCES public.artworks(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  UNIQUE(artwork_id, category_id)
);

DO $$
BEGIN
  IF to_regclass('public.board_items') IS NOT NULL THEN DELETE FROM public.board_items; END IF;
  IF to_regclass('public.likes') IS NOT NULL THEN DELETE FROM public.likes; END IF;
  IF to_regclass('public.comments') IS NOT NULL THEN DELETE FROM public.comments; END IF;
  IF to_regclass('public.reports') IS NOT NULL THEN DELETE FROM public.reports; END IF;
  IF to_regclass('public.artwork_categories') IS NOT NULL THEN DELETE FROM public.artwork_categories; END IF;
END $$;

DELETE FROM public.artworks;
DELETE FROM public.categories
WHERE slug IN ('digital-art', 'anime-manga', 'fan-art', 'concept-art', 'photography');

INSERT INTO public.categories (name, slug) VALUES
  ('Traditional Art', 'traditional-art'),
  ('Renaissance and Old Masters', 'renaissance-old-masters'),
  ('Oil Paintings', 'oil-paintings'),
  ('Works on Paper', 'works-on-paper'),
  ('Portraits', 'portraits'),
  ('Landscapes', 'landscapes'),
  ('Studies and Drawings', 'studies-drawings'),
  ('Museum Collection', 'museum-collection')
ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles) THEN
    RAISE EXCEPTION 'Cannot seed artworks because public.profiles has no users. Create or log in with at least one account first.';
  END IF;
END $$;

WITH seed_owner AS (
  SELECT id
  FROM public.profiles
  ORDER BY
    CASE role
      WHEN 'curator' THEN 1
      WHEN 'artist' THEN 2
      WHEN 'user' THEN 3
      ELSE 4
    END,
    created_at NULLS LAST
  LIMIT 1
), seed_rows AS (
  SELECT *
  FROM jsonb_to_recordset($seed$
[
  {
    "title": "Fisherman's Cottage",
    "description": "Fisherman's Cottage is a traditional oil on canvas work cataloged for ArtVault's institutional gallery collection. The record highlights traditional oil painting, 1906, and Norway. Estimated catalog value: $19,237. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/efef304d-190c-294f-1cba-73374b3361a3/full/843,/0/default.jpg",
    "artist_name": "Harald Oscar Sohlberg",
    "material_used": "Oil on canvas",
    "art_style": "Traditional oil painting",
    "dimensions": "109 x 94 cm (43 x 37 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 19237,
    "creation_year": "1906",
    "tags": [
      "oil-on-canvas",
      "traditional-oil-painting",
      "traditional-art"
    ]
  },
  {
    "title": "Farm near Duivendrecht",
    "description": "Farm near Duivendrecht is a traditional oil on canvas work cataloged for ArtVault's institutional gallery collection. The record highlights traditional oil painting, c. 1916, and Netherlands. Estimated catalog value: $28,804. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/b8ca5039-1d0c-648d-ad46-838ecea3e14c/full/843,/0/default.jpg",
    "artist_name": "Piet Mondrian",
    "material_used": "Oil on canvas",
    "art_style": "Traditional oil painting",
    "dimensions": "86.3 x 107.9 cm (34 x 42 1/2 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 28804,
    "creation_year": "c. 1916",
    "tags": [
      "oil-on-canvas",
      "traditional-oil-painting",
      "traditional-art"
    ]
  },
  {
    "title": "Day (Truth)",
    "description": "Day (Truth) is a traditional oil on canvas work cataloged for ArtVault's institutional gallery collection. The record highlights realist and impressionist-era painting, 1896/98, and Switzerland. Estimated catalog value: $19,134. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/ba6ef7ee-677c-0bcd-8150-ef7487f17a36/full/843,/0/default.jpg",
    "artist_name": "Ferdinand Hodler",
    "material_used": "Oil on canvas",
    "art_style": "Realist and Impressionist-era painting",
    "dimensions": "200.5 x 105 cm (79 x 41 1/2 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 19134,
    "creation_year": "1896/98",
    "tags": [
      "oil-on-canvas",
      "realist-and-impressionist-era-painting",
      "traditional-art"
    ]
  },
  {
    "title": "The Prairie on Fire",
    "description": "The Prairie on Fire is a traditional oil on canvas work cataloged for ArtVault's institutional gallery collection. The record highlights romantic and academic painting, 1827, and United States. Estimated catalog value: $21,493. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/7951054b-f49a-6824-10ab-a3a301f39115/full/843,/0/default.jpg",
    "artist_name": "Alvan Fisher",
    "material_used": "Oil on canvas",
    "art_style": "Romantic and academic painting",
    "dimensions": "61 x 83.8 cm (24 x 33 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 21493,
    "creation_year": "1827",
    "tags": [
      "oil-on-canvas",
      "romantic-and-academic-painting",
      "traditional-art"
    ]
  },
  {
    "title": "Madame Paul Escudier (Louise Lefevre)",
    "description": "Madame Paul Escudier (Louise Lefevre) is a traditional oil on canvas work cataloged for ArtVault's institutional gallery collection. The record highlights impressionism, 1882, and United States. Estimated catalog value: $32,231. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/c6da9f8c-643b-f331-0f8f-a9b6a844caf6/full/843,/0/default.jpg",
    "artist_name": "John Singer Sargent",
    "material_used": "Oil on canvas",
    "art_style": "Impressionism",
    "dimensions": "129.5 x 91.4 cm (51 x 36 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 32231,
    "creation_year": "1882",
    "tags": [
      "oil-on-canvas",
      "impressionism",
      "traditional-art"
    ]
  },
  {
    "title": "Coming Squall (Nahant Beach with a Summer Shower)",
    "description": "Coming Squall (Nahant Beach with a Summer Shower) is a traditional oil on canvas work cataloged for ArtVault's institutional gallery collection. The record highlights romantic and academic painting, 1835, and United States. Estimated catalog value: $19,070. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/28a7765b-fc38-1a56-87dd-cbcdb647fcdb/full/843,/0/default.jpg",
    "artist_name": "Thomas Doughty",
    "material_used": "Oil on canvas",
    "art_style": "Romantic and academic painting",
    "dimensions": "52.1 x 71.4 cm (20 1/2 x 28 1/8 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 19070,
    "creation_year": "1835",
    "tags": [
      "oil-on-canvas",
      "romantic-and-academic-painting",
      "traditional-art"
    ]
  },
  {
    "title": "An Abundance of Fruit",
    "description": "An Abundance of Fruit is a traditional oil on canvas work cataloged for ArtVault's institutional gallery collection. The record highlights realist and impressionist-era painting, c. 1860, and Germany. Estimated catalog value: $20,603. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/12f32e59-cba2-0a32-972e-cf4d7856560c/full/843,/0/default.jpg",
    "artist_name": "Severin Roesen",
    "material_used": "Oil on canvas",
    "art_style": "Realist and Impressionist-era painting",
    "dimensions": "63.5 x 76.2 cm (25 x 30 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 20603,
    "creation_year": "c. 1860",
    "tags": [
      "oil-on-canvas",
      "realist-and-impressionist-era-painting",
      "traditional-art"
    ]
  },
  {
    "title": "Solitude",
    "description": "Solitude is a traditional oil on canvas work cataloged for ArtVault's institutional gallery collection. The record highlights romantic and academic painting, 1818, and United States. Estimated catalog value: $21,652. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/63e18e3e-35a6-699c-a824-d75228c2f1fa/full/843,/0/default.jpg",
    "artist_name": "Joshua Shaw",
    "material_used": "Oil on canvas",
    "art_style": "Romantic and academic painting",
    "dimensions": "54.5 x 78.7 cm (21 1/2 x 31 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 21652,
    "creation_year": "1818",
    "tags": [
      "oil-on-canvas",
      "romantic-and-academic-painting",
      "traditional-art"
    ]
  },
  {
    "title": "Apples",
    "description": "Apples is a traditional oil on canvas work cataloged for ArtVault's institutional gallery collection. The record highlights traditional oil painting, 1916, and France. Estimated catalog value: $29,097. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/b2bc0fc2-8d17-1fcd-8cae-8626421c11ef/full/843,/0/default.jpg",
    "artist_name": "Henri Matisse",
    "material_used": "Oil on canvas",
    "art_style": "Traditional oil painting",
    "dimensions": "116.5 x 89.5 cm (45 7/8 x 35 3/16 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 29097,
    "creation_year": "1916",
    "tags": [
      "oil-on-canvas",
      "traditional-oil-painting",
      "traditional-art"
    ]
  },
  {
    "title": "Self-Portrait",
    "description": "Self-Portrait is a traditional oil on canvas work cataloged for ArtVault's institutional gallery collection. The record highlights realist and impressionist-era painting, 1878, and United States. Estimated catalog value: $21,744. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/7b7a6f39-1cd8-ea2f-9811-18b0e23edac0/full/843,/0/default.jpg",
    "artist_name": "Walter Shirlaw",
    "material_used": "Oil on canvas",
    "art_style": "Realist and Impressionist-era painting",
    "dimensions": "70.2 x 53.4 cm (27 5/8 x 21 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 21744,
    "creation_year": "1878",
    "tags": [
      "oil-on-canvas",
      "realist-and-impressionist-era-painting",
      "traditional-art"
    ]
  },
  {
    "title": "Madam Pompadour",
    "description": "Madam Pompadour is a traditional oil on canvas work cataloged for ArtVault's institutional gallery collection. The record highlights traditional oil painting, 1915, and Italy. Estimated catalog value: $30,451. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/fdc1a755-ff86-487d-f16b-f03c40a30bee/full/843,/0/default.jpg",
    "artist_name": "Amedeo Modigliani",
    "material_used": "Oil on canvas",
    "art_style": "Traditional oil painting",
    "dimensions": "61.1 x 50.2 cm (24 1/16 x 19 3/4 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 30451,
    "creation_year": "1915",
    "tags": [
      "oil-on-canvas",
      "traditional-oil-painting",
      "traditional-art"
    ]
  },
  {
    "title": "Lights of Other Days",
    "description": "Lights of Other Days is a traditional oil on canvas work cataloged for ArtVault's institutional gallery collection. The record highlights realism, 1906, and United States. Estimated catalog value: $21,663. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/438fbefa-e576-bd5f-983f-1c9626cd4a60/full/843,/0/default.jpg",
    "artist_name": "John Frederick Peto",
    "material_used": "Oil on canvas",
    "art_style": "Realism",
    "dimensions": "77.5 x 4514 cm (30 1/2 x 45 1/4 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 21663,
    "creation_year": "1906",
    "tags": [
      "oil-on-canvas",
      "realism",
      "traditional-art"
    ]
  },
  {
    "title": "A Sunday on La Grande Jatte - 1884",
    "description": "A Sunday on La Grande Jatte - 1884 is a traditional oil on canvas work cataloged for ArtVault's institutional gallery collection. The record highlights pointillism, 1884-86, border added 1888-89, and France. Estimated catalog value: $29,736. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/2d484387-2509-5e8e-2c43-22f9981972eb/full/843,/0/default.jpg",
    "artist_name": "Georges Seurat",
    "material_used": "Oil on canvas",
    "art_style": "Pointillism",
    "dimensions": "207.5 x 308.1 cm (81 3/4 x 121 1/4 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 29736,
    "creation_year": "1884-86, border added 1888-89",
    "tags": [
      "oil-on-canvas",
      "pointillism",
      "traditional-art"
    ]
  },
  {
    "title": "Pastoral Landscape with Ruins",
    "description": "Pastoral Landscape with Ruins is a traditional oil on canvas work cataloged for ArtVault's institutional gallery collection. The record highlights 17th century, 1664, and Holland. Estimated catalog value: $23,144. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/a34d9d72-c4ec-0750-389e-a01215c9aab0/full/843,/0/default.jpg",
    "artist_name": "Adriaen van de Velde",
    "material_used": "Oil on canvas",
    "art_style": "17th Century",
    "dimensions": "67 x 78.4 cm (26 3/8 x 30 7/8 in.); Framed: 81.3 x 92.4 x 6.4 cm (32 x 36 3/8 x 2 1/2 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 23144,
    "creation_year": "1664",
    "tags": [
      "oil-on-canvas",
      "17th-century",
      "traditional-art"
    ]
  },
  {
    "title": "Sawmill, Outskirts of Paris",
    "description": "Sawmill, Outskirts of Paris is a traditional oil on canvas work cataloged for ArtVault's institutional gallery collection. The record highlights realist and impressionist-era painting, c. 1893/95, and France. Estimated catalog value: $32,651. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/3826e366-e82a-e853-12e4-b303a1618103/full/843,/0/default.jpg",
    "artist_name": "Henri Rousseau",
    "material_used": "Oil on canvas",
    "art_style": "Realist and Impressionist-era painting",
    "dimensions": "25.5 x 45.5 cm (10 x 17 7/8 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 32651,
    "creation_year": "c. 1893/95",
    "tags": [
      "oil-on-canvas",
      "realist-and-impressionist-era-painting",
      "traditional-art"
    ]
  },
  {
    "title": "Interior of St. Mark's, Venice",
    "description": "Interior of St. Mark's, Venice is a traditional oil on canvas work cataloged for ArtVault's institutional gallery collection. The record highlights realist and impressionist-era painting, 1869, and Venice. Estimated catalog value: $22,564. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/b55d836c-ee20-59f8-1f0c-a95e09905361/full/843,/0/default.jpg",
    "artist_name": "David Dalhoff Neal",
    "material_used": "Oil on canvas",
    "art_style": "Realist and Impressionist-era painting",
    "dimensions": "184.2 x 148.9 cm (72 1/2 x 58 1/2 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 22564,
    "creation_year": "1869",
    "tags": [
      "oil-on-canvas",
      "realist-and-impressionist-era-painting",
      "traditional-art"
    ]
  },
  {
    "title": "Paris Street; Rainy Day",
    "description": "Paris Street; Rainy Day is a traditional oil on canvas work cataloged for ArtVault's institutional gallery collection. The record highlights impressionism, 1877, and Paris. Estimated catalog value: $31,376. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/f8fd76e9-c396-5678-36ed-6a348c904d27/full/843,/0/default.jpg",
    "artist_name": "Gustave Caillebotte",
    "material_used": "Oil on canvas",
    "art_style": "Impressionism",
    "dimensions": "212.2 x 276.2 cm (83 1/2 x 108 3/4 in.); Framed: 241.3 x 306.1 x 10.2 cm (95 x 120 1/2 x 4 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 31376,
    "creation_year": "1877",
    "tags": [
      "oil-on-canvas",
      "impressionism",
      "traditional-art"
    ]
  },
  {
    "title": "Lozenge Composition with Yellow, Black, Blue, Red, and Gray",
    "description": "Lozenge Composition with Yellow, Black, Blue, Red, and Gray is a traditional oil on canvas work cataloged for ArtVault's institutional gallery collection. The record highlights modernism, 1921, and Netherlands. Estimated catalog value: $29,948. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/25f660ee-f1db-d13b-42a5-56df97c98ba7/full/843,/0/default.jpg",
    "artist_name": "Piet Mondrian",
    "material_used": "Oil on canvas",
    "art_style": "Modernism",
    "dimensions": "60 x 60 cm (23 5/8 x 23 5/8 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 29948,
    "creation_year": "1921",
    "tags": [
      "oil-on-canvas",
      "modernism",
      "traditional-art"
    ]
  },
  {
    "title": "The Bewitched Mill",
    "description": "The Bewitched Mill is a traditional oil on canvas work cataloged for ArtVault's institutional gallery collection. The record highlights traditional oil painting, 1913, and Germany. Estimated catalog value: $21,087. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/6829aab0-8d0e-9438-aebf-a1a379572951/full/843,/0/default.jpg",
    "artist_name": "Franz Marc",
    "material_used": "Oil on canvas",
    "art_style": "Traditional oil painting",
    "dimensions": "Without frame: 130.2 x 90.8 cm (51 5/16 x 35 3/4 in.); 130.2 x 91.2 cm (51 1/4 x 35 7/8 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 21087,
    "creation_year": "1913",
    "tags": [
      "oil-on-canvas",
      "traditional-oil-painting",
      "traditional-art"
    ]
  },
  {
    "title": "Unfinished Study of Sheep",
    "description": "Unfinished Study of Sheep is a traditional oil on canvas work cataloged for ArtVault's institutional gallery collection. The record highlights nineteenth century, c. 1850, and France. Estimated catalog value: $21,501. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/e204d686-0e19-c10c-cf72-1000aae5be4a/full/843,/0/default.jpg",
    "artist_name": "Constant Troyon",
    "material_used": "Oil on canvas",
    "art_style": "nineteenth century",
    "dimensions": "45.8 x 37.8 cm (18 x 14 7/8 in.); Framed: 75 x 67.4 x 15.3 cm (29 1/2 x 26 1/2 x 6 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 21501,
    "creation_year": "c. 1850",
    "tags": [
      "oil-on-canvas",
      "nineteenth-century",
      "traditional-art"
    ]
  },
  {
    "title": "New York Street",
    "description": "New York Street is a traditional oil on canvas work cataloged for ArtVault's institutional gallery collection. The record highlights impressionism, 1902, and United States. Estimated catalog value: $18,034. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/8ed7e389-dbe7-ed35-ade2-fe7743943479/full/843,/0/default.jpg",
    "artist_name": "Childe Hassam",
    "material_used": "Oil on canvas",
    "art_style": "Impressionism",
    "dimensions": "59.7 x 49.5 cm (23 1/2 x 19 1/2 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 18034,
    "creation_year": "1902",
    "tags": [
      "oil-on-canvas",
      "impressionism",
      "traditional-art"
    ]
  },
  {
    "title": "Water Lilies",
    "description": "Water Lilies is a traditional oil on canvas work cataloged for ArtVault's institutional gallery collection. The record highlights impressionism, 1906, and France. Estimated catalog value: $29,645. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/3c27b499-af56-f0d5-93b5-a7f2f1ad5813/full/843,/0/default.jpg",
    "artist_name": "Claude Monet",
    "material_used": "Oil on canvas",
    "art_style": "Impressionism",
    "dimensions": "89.9 x 94.1 cm (35 3/8 x 37 1/16 in.); Framed: 103.2 x 107 x 5.8 cm (40 5/8 x 42 1/8 x 2 1/4 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 29645,
    "creation_year": "1906",
    "tags": [
      "oil-on-canvas",
      "impressionism",
      "traditional-art"
    ]
  },
  {
    "title": "Tiger Resting",
    "description": "Tiger Resting is a traditional oil on canvas work cataloged for ArtVault's institutional gallery collection. The record highlights 19th century, c. 1845, and France. Estimated catalog value: $21,898. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/1bc44619-6b1d-5398-cf41-f4af38f6e17f/full/843,/0/default.jpg",
    "artist_name": "Pierre Andrieu",
    "material_used": "Oil on canvas",
    "art_style": "19th century",
    "dimensions": "20.3 x 38.1 cm (8 x 15 in.); Framed: 45.1 x 62.9 x 8.3 cm (17 3/4 x 24 3/4 x 3 1/4 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 21898,
    "creation_year": "c. 1845",
    "tags": [
      "oil-on-canvas",
      "19th-century",
      "traditional-art"
    ]
  },
  {
    "title": "The Bedroom",
    "description": "The Bedroom is a traditional oil on canvas work cataloged for ArtVault's institutional gallery collection. The record highlights post-impressionism, 1889, and Saint-Rémy-de-Provence. Estimated catalog value: $20,311. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/6644829f-f292-c5c4-a73c-0356a6fdbf0d/full/843,/0/default.jpg",
    "artist_name": "Vincent van Gogh",
    "material_used": "Oil on canvas",
    "art_style": "Post-Impressionism",
    "dimensions": "73.6 x 92.3 cm (29 x 36 5/8 in.); Framed: 88.9 x 108 x 8.9 cm (35 x 42 1/2 x 3 1/2 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 20311,
    "creation_year": "1889",
    "tags": [
      "oil-on-canvas",
      "post-impressionism",
      "traditional-art"
    ]
  },
  {
    "title": "Improvisation No. 30 (Cannons)",
    "description": "Improvisation No. 30 (Cannons) is a traditional oil on canvas work cataloged for ArtVault's institutional gallery collection. The record highlights modernism, 1913, and Germany. Estimated catalog value: $21,879. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/b5bc6b66-9e6e-fe57-dcec-fc49e820e904/full/843,/0/default.jpg",
    "artist_name": "Vasily Kandinsky",
    "material_used": "Oil on canvas",
    "art_style": "Modernism",
    "dimensions": "111 x 111.3 cm (43 11/16 x 43 13/16 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 21879,
    "creation_year": "1913",
    "tags": [
      "oil-on-canvas",
      "modernism",
      "traditional-art"
    ]
  },
  {
    "title": "Plate 125 from The Plan of Chicago, 1909: Chicago. Elevation of Grant Park and Harbor; the Eastern Facade of the City on Michigan Avenue, and the Dome of the Administration Building of the Civic Center, Looking from Lake Michigan.",
    "description": "Plate 125 from The Plan of Chicago, 1909: Chicago. Elevation of Grant Park and Harbor; the Eastern Facade of the City on Michigan Avenue, and the Dome of the Administration Building of the Civic Center, Looking from Lake Michigan. is a traditional graphite on paper work cataloged for ArtVault's institutional gallery collection. The record highlights graphite drawing study, 1909, and Chicago. Estimated catalog value: $7,195. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/c69391a6-0313-4bce-088d-8eeb4c76df3d/full/843,/0/default.jpg",
    "artist_name": "Daniel Hudson Burnham",
    "material_used": "Graphite on paper",
    "art_style": "Graphite drawing study",
    "dimensions": "40.6 x 321.3 cm (16 x 126 1/2 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 7195,
    "creation_year": "1909",
    "tags": [
      "graphite-on-paper",
      "graphite-drawing-study",
      "traditional-art"
    ]
  },
  {
    "title": "Asavari Ragini, page from a Garland of Musical Ragas (Ragamala) Set",
    "description": "Asavari Ragini, page from a Garland of Musical Ragas (Ragamala) Set is a traditional gouache work cataloged for ArtVault's institutional gallery collection. The record highlights south asian, Mid-to late 17th century, and India. Estimated catalog value: $8,461. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/37a27b5f-013a-87d2-1dc5-5ccbb08cca3f/full/843,/0/default.jpg",
    "artist_name": "Unknown Artist",
    "material_used": "Gouache",
    "art_style": "South Asian",
    "dimensions": "Image: 20.3 x 13.3 cm (8 x 5 1/4 in.); Outermost Border: 25 x 16.7 cm (9 13/16 x 6 9/16 in.); Paper: 28 x 19.8 cm (11 1/16 x 7 13/16 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 8461,
    "creation_year": "Mid-to late 17th century",
    "tags": [
      "gouache",
      "south-asian",
      "traditional-art"
    ]
  },
  {
    "title": "Battle of the Forces of Krishna and Bana, from a copy of the Dispersed Bhagavat Purana",
    "description": "Battle of the Forces of Krishna and Bana, from a copy of the Dispersed Bhagavat Purana is a traditional gouache work cataloged for ArtVault's institutional gallery collection. The record highlights opaque watercolor study, c. 1520-1530, and India. Estimated catalog value: $9,548. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/831534f4-dd88-4100-41b3-0016f19e4d7a/full/843,/0/default.jpg",
    "artist_name": "Unknown Artist",
    "material_used": "Gouache",
    "art_style": "Opaque watercolor study",
    "dimensions": "Paper: 18 x 23.5 cm (7 1/8 x 9 1/4 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 9548,
    "creation_year": "c. 1520-1530",
    "tags": [
      "gouache",
      "opaque-watercolor-study",
      "traditional-art"
    ]
  },
  {
    "title": "Saint-Cloud",
    "description": "Saint-Cloud is a traditional watercolor on paper work cataloged for ArtVault's institutional gallery collection. The record highlights transparent watercolor tradition, 1889, and United States. Estimated catalog value: $13,467. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/c6f933da-b9af-0c38-340c-0e2bc737ad1e/full/843,/0/default.jpg",
    "artist_name": "Childe Hassam",
    "material_used": "Watercolor on paper",
    "art_style": "Transparent watercolor tradition",
    "dimensions": "18 x 27.5 cm (7 1/8 x 10 7/8 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 13467,
    "creation_year": "1889",
    "tags": [
      "watercolor-on-paper",
      "transparent-watercolor-tradition",
      "traditional-art"
    ]
  },
  {
    "title": "Farhad Carrying Shirin and Her Horse, from a copy of the Khamsa of Nizami",
    "description": "Farhad Carrying Shirin and Her Horse, from a copy of the Khamsa of Nizami is a traditional gouache work cataloged for ArtVault's institutional gallery collection. The record highlights opaque watercolor study, Timurid dynasty (ca. 1370-1507), dated 1485 (890 A.H.), and Iran. Estimated catalog value: $10,917. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/c7e064e5-9906-489d-7335-9d33428255ee/full/843,/0/default.jpg",
    "artist_name": "Islamic",
    "material_used": "Gouache",
    "art_style": "Opaque watercolor study",
    "dimensions": "27.9 x 17.8 cm (11 x 7 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 10917,
    "creation_year": "Timurid dynasty (ca. 1370-1507), dated 1485 (890 A.H.)",
    "tags": [
      "gouache",
      "opaque-watercolor-study",
      "traditional-art"
    ]
  },
  {
    "title": "The Sorceress of the Yakuts in North East Asia",
    "description": "The Sorceress of the Yakuts in North East Asia is a traditional watercolor on paper work cataloged for ArtVault's institutional gallery collection. The record highlights transparent watercolor tradition, n.d., and United States. Estimated catalog value: $9,546. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/1bf5c49e-8eeb-c3de-8d16-bb31fd285c6a/full/843,/0/default.jpg",
    "artist_name": "Ernst Damitz",
    "material_used": "Watercolor on paper",
    "art_style": "Transparent watercolor tradition",
    "dimensions": "23.3 x 37 cm (9 3/16 x 14 5/8 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 9546,
    "creation_year": "n.d.",
    "tags": [
      "watercolor-on-paper",
      "transparent-watercolor-tradition",
      "traditional-art"
    ]
  },
  {
    "title": "The Artist's Farm and Vineyard",
    "description": "The Artist's Farm and Vineyard is a traditional watercolor on paper work cataloged for ArtVault's institutional gallery collection. The record highlights transparent watercolor tradition, n.d., and United States. Estimated catalog value: $9,833. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/92272a75-e704-6a0b-fb04-88a21bdc4581/full/843,/0/default.jpg",
    "artist_name": "Ernst Damitz",
    "material_used": "Watercolor on paper",
    "art_style": "Transparent watercolor tradition",
    "dimensions": "11.2 x 17.1 cm (4 7/16 x 6 3/4 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 9833,
    "creation_year": "n.d.",
    "tags": [
      "watercolor-on-paper",
      "transparent-watercolor-tradition",
      "traditional-art"
    ]
  },
  {
    "title": "Family Group at Piano",
    "description": "Family Group at Piano is a traditional watercolor on paper work cataloged for ArtVault's institutional gallery collection. The record highlights transparent watercolor tradition, c. 1820, and United States. Estimated catalog value: $12,134. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/b666dd6b-6bd7-2bb7-ab15-714d752e976e/full/843,/0/default.jpg",
    "artist_name": "Eunice Pinney",
    "material_used": "Watercolor on paper",
    "art_style": "Transparent watercolor tradition",
    "dimensions": "35.5 x 41 cm (14 x 16 3/16 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 12134,
    "creation_year": "c. 1820",
    "tags": [
      "watercolor-on-paper",
      "transparent-watercolor-tradition",
      "traditional-art"
    ]
  },
  {
    "title": "French Town, Buildings and River",
    "description": "French Town, Buildings and River is a traditional watercolor on paper work cataloged for ArtVault's institutional gallery collection. The record highlights transparent watercolor tradition, 1821/8, and England. Estimated catalog value: $10,346. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/a5e8fa44-1cdc-d5b7-2768-b3b71c029c54/full/843,/0/default.jpg",
    "artist_name": "Richard Parkes Bonington",
    "material_used": "Watercolor on paper",
    "art_style": "Transparent watercolor tradition",
    "dimensions": "18.1 x 14.3 cm (7 1/8 x 5 5/8 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 10346,
    "creation_year": "1821/8",
    "tags": [
      "watercolor-on-paper",
      "transparent-watercolor-tradition",
      "traditional-art"
    ]
  },
  {
    "title": "Bhairavi Ragini, Page from a Bundi Ragamala Set",
    "description": "Bhairavi Ragini, Page from a Bundi Ragamala Set is a traditional gouache work cataloged for ArtVault's institutional gallery collection. The record highlights south asian, c. 1765-1780, and Bundi. Estimated catalog value: $11,797. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/9bf0e287-22b6-871f-e617-be62497dbfc3/full/843,/0/default.jpg",
    "artist_name": "Unknown Artist",
    "material_used": "Gouache",
    "art_style": "South Asian",
    "dimensions": "Image: 18.3 x 12.8 cm (7 1/4 x 5 in.); Border: 20.4 x 14.7 cm (8 x 5 3/4 in.); Paper: 27.7 x 21.8 cm (10 7/8 x 8 5/8 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 11797,
    "creation_year": "c. 1765-1780",
    "tags": [
      "gouache",
      "south-asian",
      "traditional-art"
    ]
  },
  {
    "title": "Khusrau Gazing at Shirin, from a copy of the Khamsa of Nizami",
    "description": "Khusrau Gazing at Shirin, from a copy of the Khamsa of Nizami is a traditional gouache work cataloged for ArtVault's institutional gallery collection. The record highlights opaque watercolor study, 1485 (890 A.H.), and Iran. Estimated catalog value: $11,744. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/f9721ac8-8ee1-65f0-6f31-b16f258d48bc/full/843,/0/default.jpg",
    "artist_name": "Islamic",
    "material_used": "Gouache",
    "art_style": "Opaque watercolor study",
    "dimensions": "28.1 x 34.7 cm (11 1/16 x 13 1/4 in.); Left page: W.: 17.4 cm (6 7/8 in.); Right page: W.: 17.3 cm (6 13/16 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 11744,
    "creation_year": "1485 (890 A.H.)",
    "tags": [
      "gouache",
      "opaque-watercolor-study",
      "traditional-art"
    ]
  },
  {
    "title": "Four Recruits in White Dhotis, page from the Fraser Album",
    "description": "Four Recruits in White Dhotis, page from the Fraser Album is a traditional gouache work cataloged for ArtVault's institutional gallery collection. The record highlights south asian, Company School, c. 1815-1816, and India. Estimated catalog value: $9,848. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/42855e11-dd90-3f7f-8038-91cbd1a95166/full/843,/0/default.jpg",
    "artist_name": "Unknown Artist",
    "material_used": "Gouache",
    "art_style": "South Asian",
    "dimensions": "25 x 37.8 cm (9 7/8 x 21 3/8 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 9848,
    "creation_year": "Company School, c. 1815-1816",
    "tags": [
      "gouache",
      "south-asian",
      "traditional-art"
    ]
  },
  {
    "title": "Moonlight Scene",
    "description": "Moonlight Scene is a traditional charcoal on paper work cataloged for ArtVault's institutional gallery collection. The record highlights academic charcoal drawing, 19th century, and France. Estimated catalog value: $9,555. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/7a63b68a-a84f-87b0-80a4-2848404f1ad6/full/843,/0/default.jpg",
    "artist_name": "Unknown artist",
    "material_used": "Charcoal on paper",
    "art_style": "Academic charcoal drawing",
    "dimensions": "10.3 x 13.6 cm (4 1/16 x 5 3/8 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 9555,
    "creation_year": "19th century",
    "tags": [
      "charcoal-on-paper",
      "academic-charcoal-drawing",
      "traditional-art"
    ]
  },
  {
    "title": "Head of an Old Man",
    "description": "Head of an Old Man is a traditional pastel on paper work cataloged for ArtVault's institutional gallery collection. The record highlights pastel portrait and drawing tradition, c. 1850, and Germany. Estimated catalog value: $12,144. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/8f9f77a5-003f-a185-873d-8c0f71cf5cf1/full/843,/0/default.jpg",
    "artist_name": "Adolph Friedrich Erdmann von Menzel",
    "material_used": "Pastel on paper",
    "art_style": "Pastel portrait and drawing tradition",
    "dimensions": "15.5 x 13 cm (6 1/8 x 5 1/8 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 12144,
    "creation_year": "c. 1850",
    "tags": [
      "pastel-on-paper",
      "pastel-portrait-and-drawing-tradition",
      "traditional-art"
    ]
  },
  {
    "title": "Portrait of a Peasant Woman",
    "description": "Portrait of a Peasant Woman is a traditional charcoal on paper work cataloged for ArtVault's institutional gallery collection. The record highlights academic charcoal drawing, 1884, and Germany. Estimated catalog value: $11,960. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/7f753e93-8579-abab-6c79-1a35ff67ba53/full/843,/0/default.jpg",
    "artist_name": "Adolph Friedrich Erdmann von Menzel",
    "material_used": "Charcoal on paper",
    "art_style": "Academic charcoal drawing",
    "dimensions": "19.5 x 12.5 cm (7 11/16 x 4 15/16 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 11960,
    "creation_year": "1884",
    "tags": [
      "charcoal-on-paper",
      "academic-charcoal-drawing",
      "traditional-art"
    ]
  },
  {
    "title": "Sheet of Studies",
    "description": "Sheet of Studies is a traditional charcoal on paper work cataloged for ArtVault's institutional gallery collection. The record highlights academic charcoal drawing, c. 1900, and France. Estimated catalog value: $7,762. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/8ae41ef2-edb5-0573-93ae-ae8db425c6c3/full/843,/0/default.jpg",
    "artist_name": "Henri Cros",
    "material_used": "Charcoal on paper",
    "art_style": "Academic charcoal drawing",
    "dimensions": "27.5 x 38.5 cm (10 7/8 x 15 3/16 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 7762,
    "creation_year": "c. 1900",
    "tags": [
      "charcoal-on-paper",
      "academic-charcoal-drawing",
      "traditional-art"
    ]
  },
  {
    "title": "Feet of John the Baptist (fragment)",
    "description": "Feet of John the Baptist (fragment) is a traditional charcoal on paper work cataloged for ArtVault's institutional gallery collection. The record highlights academic charcoal drawing, n.d., and Europe. Estimated catalog value: $9,333. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/f72c4c2b-15fa-d1ef-562e-ae7b4bffdc79/full/843,/0/default.jpg",
    "artist_name": "Unknown artist",
    "material_used": "Charcoal on paper",
    "art_style": "Academic charcoal drawing",
    "dimensions": "Dimensions not recorded",
    "collector_or_pricing": "Institutional Collection",
    "price": 9333,
    "creation_year": "n.d.",
    "tags": [
      "charcoal-on-paper",
      "academic-charcoal-drawing",
      "traditional-art"
    ]
  },
  {
    "title": "Sketch for 'Dido on the Funeral Pyre' (recto); Erotic Sketch of Man and Woman (verso)",
    "description": "Sketch for 'Dido on the Funeral Pyre' (recto); Erotic Sketch of Man and Woman (verso) is a traditional charcoal on paper work cataloged for ArtVault's institutional gallery collection. The record highlights academic charcoal drawing, c. 1781, and England. Estimated catalog value: $10,742. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/969697ee-07c2-2484-1034-37f4c2ff7646/full/843,/0/default.jpg",
    "artist_name": "Henry Fuseli",
    "material_used": "Charcoal on paper",
    "art_style": "Academic charcoal drawing",
    "dimensions": "53.9 x 37.2 cm (21 1/4 x 14 11/16 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 10742,
    "creation_year": "c. 1781",
    "tags": [
      "charcoal-on-paper",
      "academic-charcoal-drawing",
      "traditional-art"
    ]
  },
  {
    "title": "Sketch for The Revolt of Cairo",
    "description": "Sketch for The Revolt of Cairo is a traditional charcoal on paper work cataloged for ArtVault's institutional gallery collection. The record highlights nineteenth century, c. 1810, and France. Estimated catalog value: $12,042. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/ec14e825-ed02-c8a5-c25d-c04cbbc6a471/full/843,/0/default.jpg",
    "artist_name": "Anne-Louis Girodet de Roussy-Trioson",
    "material_used": "Charcoal on paper",
    "art_style": "nineteenth century",
    "dimensions": "30.8 x 45.1 cm (12 1/8 x 17 3/4 in.); Framed: 43.2 x 58.5 x 6.4 cm (17 x 23 x 2 1/2 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 12042,
    "creation_year": "c. 1810",
    "tags": [
      "charcoal-on-paper",
      "nineteenth-century",
      "traditional-art"
    ]
  },
  {
    "title": "Some Account of the Art of Photogenic Drawing, or the Process by which Natural Objects May Be Made to Delineate Themselves without the Aid of the Artist's Pencil",
    "description": "Some Account of the Art of Photogenic Drawing, or the Process by which Natural Objects May Be Made to Delineate Themselves without the Aid of the Artist's Pencil is a traditional charcoal on paper work cataloged for ArtVault's institutional gallery collection. The record highlights 19th century, Read before the Royal Society, January 31, 1839, and England. Estimated catalog value: $9,266. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/30043a9f-bbe6-f53d-362e-8512dbb23c77/full/843,/0/default.jpg",
    "artist_name": "William Henry Fox Talbot",
    "material_used": "Charcoal on paper",
    "art_style": "19th century",
    "dimensions": "23.2 x 30 cm (9 3/16 x 11 13/16 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 9266,
    "creation_year": "Read before the Royal Society, January 31, 1839",
    "tags": [
      "charcoal-on-paper",
      "19th-century",
      "traditional-art"
    ]
  },
  {
    "title": "Seated Breton Woman",
    "description": "Seated Breton Woman is a traditional pastel on paper work cataloged for ArtVault's institutional gallery collection. The record highlights pastel portrait and drawing tradition, 1886, and France. Estimated catalog value: $19,525. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/239ebe0d-ff0e-a8aa-754b-e4a816eda0f5/full/843,/0/default.jpg",
    "artist_name": "Paul Gauguin",
    "material_used": "Pastel on paper",
    "art_style": "Pastel portrait and drawing tradition",
    "dimensions": "32.9 x 48.3 cm (13 x 19 1/16 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 19525,
    "creation_year": "1886",
    "tags": [
      "pastel-on-paper",
      "pastel-portrait-and-drawing-tradition",
      "traditional-art"
    ]
  },
  {
    "title": "Woman in Profile, Turned Right",
    "description": "Woman in Profile, Turned Right is a traditional charcoal on paper work cataloged for ArtVault's institutional gallery collection. The record highlights academic charcoal drawing, 1898/99, and Germany. Estimated catalog value: $6,280. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/57ea3022-afc6-3ba3-3b0b-2aac8efcb75c/full/843,/0/default.jpg",
    "artist_name": "Paula Modersohn-Becker",
    "material_used": "Charcoal on paper",
    "art_style": "Academic charcoal drawing",
    "dimensions": "46.7 x 65.4 cm (18 7/16 x 25 3/4 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 6280,
    "creation_year": "1898/99",
    "tags": [
      "charcoal-on-paper",
      "academic-charcoal-drawing",
      "traditional-art"
    ]
  },
  {
    "title": "Caricature of Jules Didier (\"Butterfly Man\")",
    "description": "Caricature of Jules Didier (\"Butterfly Man\") is a traditional charcoal on paper work cataloged for ArtVault's institutional gallery collection. The record highlights academic charcoal drawing, c. 1858, and France. Estimated catalog value: $16,442. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/ffceac7e-98d9-eb34-daeb-6587c998ad73/full/843,/0/default.jpg",
    "artist_name": "Claude Monet",
    "material_used": "Charcoal on paper",
    "art_style": "Academic charcoal drawing",
    "dimensions": "61.6 x 43.6 cm (24 5/16 x 17 3/16 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 16442,
    "creation_year": "c. 1858",
    "tags": [
      "charcoal-on-paper",
      "academic-charcoal-drawing",
      "traditional-art"
    ]
  },
  {
    "title": "Sketches of Legs and Feet",
    "description": "Sketches of Legs and Feet is a traditional charcoal on paper work cataloged for ArtVault's institutional gallery collection. The record highlights academic charcoal drawing, 1917/21, and United States. Estimated catalog value: $18,907. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/ea2a2d71-d080-7edf-50be-2950be4621b8/full/843,/0/default.jpg",
    "artist_name": "John Singer Sargent",
    "material_used": "Charcoal on paper",
    "art_style": "Academic charcoal drawing",
    "dimensions": "47.3 x 62.4 cm (18 5/8 x 24 5/8 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 18907,
    "creation_year": "1917/21",
    "tags": [
      "charcoal-on-paper",
      "academic-charcoal-drawing",
      "traditional-art"
    ]
  },
  {
    "title": "McVickers Theater, Chicago, Illinois, Sketch",
    "description": "McVickers Theater, Chicago, Illinois, Sketch is a traditional graphite on paper work cataloged for ArtVault's institutional gallery collection. The record highlights architectural graphite study, c. 1883-1891, and Madison Street, 78-84 West. Estimated catalog value: $11,460. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/0d9e8440-5049-35c8-bc9e-3acdfad162b3/full/843,/0/default.jpg",
    "artist_name": "Louis H. Sullivan",
    "material_used": "Graphite on paper",
    "art_style": "Architectural graphite study",
    "dimensions": "34.6 x 21 cm (13 5/8 x 8 1/4 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 11460,
    "creation_year": "c. 1883-1891",
    "tags": [
      "graphite-on-paper",
      "architectural-graphite-study",
      "traditional-art"
    ]
  },
  {
    "title": "Little Lie-A-Bed's Sad Breakfast",
    "description": "Little Lie-A-Bed's Sad Breakfast is a traditional graphite on paper work cataloged for ArtVault's institutional gallery collection. The record highlights graphite drawing study, 1900, and Sweden. Estimated catalog value: $5,773. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/cfc29577-a594-de0b-9db7-4fcce8003ad0/full/843,/0/default.jpg",
    "artist_name": "Carl Olof Larsson",
    "material_used": "Graphite on paper",
    "art_style": "Graphite drawing study",
    "dimensions": "51 x 35.8 cm (20 1/8 x 14 1/8 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 5773,
    "creation_year": "1900",
    "tags": [
      "graphite-on-paper",
      "graphite-drawing-study",
      "traditional-art"
    ]
  },
  {
    "title": "Plate 119 from The Plan of Chicago, 1909: Chicago. Sketch Plan of the Intersection of Michigan Avenue and Twelfth Street",
    "description": "Plate 119 from The Plan of Chicago, 1909: Chicago. Sketch Plan of the Intersection of Michigan Avenue and Twelfth Street is a traditional graphite on paper work cataloged for ArtVault's institutional gallery collection. The record highlights graphite drawing study, 1907, and Chicago. Estimated catalog value: $9,043. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/da041fc1-52c9-27c9-2396-579ab992f3a3/full/843,/0/default.jpg",
    "artist_name": "Daniel Hudson Burnham",
    "material_used": "Graphite on paper",
    "art_style": "Graphite drawing study",
    "dimensions": "73.6 x 83.8 cm (29 x 33 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 9043,
    "creation_year": "1907",
    "tags": [
      "graphite-on-paper",
      "graphite-drawing-study",
      "traditional-art"
    ]
  },
  {
    "title": "McVickers Theater: Sketch for Untitled Ornamental Band",
    "description": "McVickers Theater: Sketch for Untitled Ornamental Band is a traditional graphite on paper work cataloged for ArtVault's institutional gallery collection. The record highlights architectural graphite study, c. 1883-1891, and Madison Street, 78-84 West. Estimated catalog value: $11,255. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/7f23280b-22a6-3518-1e01-5cff99ad4e21/full/843,/0/default.jpg",
    "artist_name": "Louis H. Sullivan",
    "material_used": "Graphite on paper",
    "art_style": "Architectural graphite study",
    "dimensions": "34.6 x 21 cm (13 5/8 x 8 1/4 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 11255,
    "creation_year": "c. 1883-1891",
    "tags": [
      "graphite-on-paper",
      "architectural-graphite-study",
      "traditional-art"
    ]
  },
  {
    "title": "Multiple Sketches",
    "description": "Multiple Sketches is a traditional graphite on paper work cataloged for ArtVault's institutional gallery collection. The record highlights graphite drawing study, 1881, and United States. Estimated catalog value: $8,650. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/df8d9b95-5ab1-3890-2103-26bc23764fe0/full/843,/0/default.jpg",
    "artist_name": "Louis H. Sullivan",
    "material_used": "Graphite on paper",
    "art_style": "Graphite drawing study",
    "dimensions": "16 x 11 cm (6 5/16 x 4 5/16 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 8650,
    "creation_year": "1881",
    "tags": [
      "graphite-on-paper",
      "graphite-drawing-study",
      "traditional-art"
    ]
  },
  {
    "title": "McVickers Theater, Chicago, Illinois, Sketch",
    "description": "McVickers Theater, Chicago, Illinois, Sketch is a traditional graphite on paper work cataloged for ArtVault's institutional gallery collection. The record highlights architectural graphite study, c. 1883-1891, and Madison Street, 78-84 West. Estimated catalog value: $7,946. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/af56fd91-21e4-e068-9a95-bd59f8566fdb/full/843,/0/default.jpg",
    "artist_name": "Louis H. Sullivan",
    "material_used": "Graphite on paper",
    "art_style": "Architectural graphite study",
    "dimensions": "34.6 x 21 cm (13 5/8 x 8 1/4 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 7946,
    "creation_year": "c. 1883-1891",
    "tags": [
      "graphite-on-paper",
      "architectural-graphite-study",
      "traditional-art"
    ]
  },
  {
    "title": "Land Title and Trust Building with Addition, Philadelphia, Pennsylvania, Perspective Rendering",
    "description": "Land Title and Trust Building with Addition, Philadelphia, Pennsylvania, Perspective Rendering is a traditional graphite on paper work cataloged for ArtVault's institutional gallery collection. The record highlights graphite drawing study, 1900 (drawing executed) 1897 (main building) 1904 (addition), and Philadelphia. Estimated catalog value: $5,583. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/4ae11006-29e6-7f61-c6e6-e8d7960c2a30/full/843,/0/default.jpg",
    "artist_name": "D.H. Burnham & Co.",
    "material_used": "Graphite on paper",
    "art_style": "Graphite drawing study",
    "dimensions": "132.7 x 77.1 cm (52 1/4 x 30 7/16 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 5583,
    "creation_year": "1900 (drawing executed) 1897 (main building) 1904 (addition)",
    "tags": [
      "graphite-on-paper",
      "graphite-drawing-study",
      "traditional-art"
    ]
  },
  {
    "title": "The Property of John P. and Catharina Schuring, Franklin Town, Allegheny County, Pennsylvania",
    "description": "The Property of John P. and Catharina Schuring, Franklin Town, Allegheny County, Pennsylvania is a traditional graphite on paper work cataloged for ArtVault's institutional gallery collection. The record highlights graphite drawing study, 1883, and United States. Estimated catalog value: $8,885. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/be5e7f91-9bb6-daf5-b8c2-95cdfd94e94f/full/843,/0/default.jpg",
    "artist_name": "Ferdinand A. Brader",
    "material_used": "Graphite on paper",
    "art_style": "Graphite drawing study",
    "dimensions": "78 x 134.5 cm (30 3/4 x 53 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 8885,
    "creation_year": "1883",
    "tags": [
      "graphite-on-paper",
      "graphite-drawing-study",
      "traditional-art"
    ]
  },
  {
    "title": "World's Columbian Exposition Fine Arts Museum, Chicago, Illinois, Perspective",
    "description": "World's Columbian Exposition Fine Arts Museum, Chicago, Illinois, Perspective is a traditional graphite on paper work cataloged for ArtVault's institutional gallery collection. The record highlights 19th century, c. 1890-1891, and United States. Estimated catalog value: $6,654. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/bdd5c4fe-b64d-4b14-e165-5532a45eedf6/full/843,/0/default.jpg",
    "artist_name": "John Wellborn Root",
    "material_used": "Graphite on paper",
    "art_style": "19th century",
    "dimensions": "55.6 x 116.3 cm (21 7/8 x 45 3/4 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 6654,
    "creation_year": "c. 1890-1891",
    "tags": [
      "graphite-on-paper",
      "19th-century",
      "traditional-art"
    ]
  },
  {
    "title": "Landscape",
    "description": "Landscape is a traditional graphite on paper work cataloged for ArtVault's institutional gallery collection. The record highlights graphite drawing study, c. 1875, and France. Estimated catalog value: $9,937. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/3f64a2fd-cc98-003c-0cbd-c90489297ef2/full/843,/0/default.jpg",
    "artist_name": "Léon Richet",
    "material_used": "Graphite on paper",
    "art_style": "Graphite drawing study",
    "dimensions": "23.4 x 33.4 cm (9 1/4 x 13 3/16 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 9937,
    "creation_year": "c. 1875",
    "tags": [
      "graphite-on-paper",
      "graphite-drawing-study",
      "traditional-art"
    ]
  },
  {
    "title": "Susan in a Straw Bonnet",
    "description": "Susan in a Straw Bonnet is a traditional pastel on paper work cataloged for ArtVault's institutional gallery collection. The record highlights pastel portrait and drawing tradition, c. 1883, and United States. Estimated catalog value: $10,367. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/a67e56f3-b839-d9d5-a9d5-88986039902e/full/843,/0/default.jpg",
    "artist_name": "Mary Cassatt",
    "material_used": "Pastel on paper",
    "art_style": "Pastel portrait and drawing tradition",
    "dimensions": "62.3 x 51.2 cm (24 1/2 x 20 1/8 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 10367,
    "creation_year": "c. 1883",
    "tags": [
      "pastel-on-paper",
      "pastel-portrait-and-drawing-tradition",
      "traditional-art"
    ]
  },
  {
    "title": "Breakfast after the Bath",
    "description": "Breakfast after the Bath is a traditional pastel on paper work cataloged for ArtVault's institutional gallery collection. The record highlights impressionism, 1895/98, and France. Estimated catalog value: $19,832. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/dfcec184-6452-468b-3375-36df831b2628/full/843,/0/default.jpg",
    "artist_name": "Hilaire Germain Edgar Degas",
    "material_used": "Pastel on paper",
    "art_style": "Impressionism",
    "dimensions": "92 x 81 cm (36 1/4 x 31 15/16 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 19832,
    "creation_year": "1895/98",
    "tags": [
      "pastel-on-paper",
      "impressionism",
      "traditional-art"
    ]
  },
  {
    "title": "Mrs. Henry Hill (Anna Barrett)",
    "description": "Mrs. Henry Hill (Anna Barrett) is a traditional pastel on paper work cataloged for ArtVault's institutional gallery collection. The record highlights pastel portrait and drawing tradition, c. 1765-70, and United States. Estimated catalog value: $12,060. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/0291ae9f-e025-39d5-69da-d28f5e3c14e1/full/843,/0/default.jpg",
    "artist_name": "John Singleton Copley",
    "material_used": "Pastel on paper",
    "art_style": "Pastel portrait and drawing tradition",
    "dimensions": "58.4 x 43.2 cm (23 x 17 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 12060,
    "creation_year": "c. 1765-70",
    "tags": [
      "pastel-on-paper",
      "pastel-portrait-and-drawing-tradition",
      "traditional-art"
    ]
  },
  {
    "title": "Lovers in an Arbor",
    "description": "Lovers in an Arbor is a traditional pastel on paper work cataloged for ArtVault's institutional gallery collection. The record highlights pastel portrait and drawing tradition, c. 1895, and France. Estimated catalog value: $10,065. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/0712cd90-74f8-58ee-01eb-3772dbbbebe9/full/843,/0/default.jpg",
    "artist_name": "Henri-Gabriel Ibels",
    "material_used": "Pastel on paper",
    "art_style": "Pastel portrait and drawing tradition",
    "dimensions": "17.8 x 27.8 cm (7 1/16 x 11 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 10065,
    "creation_year": "c. 1895",
    "tags": [
      "pastel-on-paper",
      "pastel-portrait-and-drawing-tradition",
      "traditional-art"
    ]
  },
  {
    "title": "Plate 50 A from Plan of Chicago 1909: Chicago. View of the Proposed Park on the South Shore Looking Northwest Towards the City.",
    "description": "Plate 50 A from Plan of Chicago 1909: Chicago. View of the Proposed Park on the South Shore Looking Northwest Towards the City. is a traditional pastel on paper work cataloged for ArtVault's institutional gallery collection. The record highlights pastel portrait and drawing tradition, 1896, and Chicago. Estimated catalog value: $12,855. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/f4123169-3cf0-6980-4a23-f6786f5cc1b9/full/843,/0/default.jpg",
    "artist_name": "Daniel Hudson Burnham",
    "material_used": "Pastel on paper",
    "art_style": "Pastel portrait and drawing tradition",
    "dimensions": "93.6 x 129.5 cm (37 x 51 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 12855,
    "creation_year": "1896",
    "tags": [
      "pastel-on-paper",
      "pastel-portrait-and-drawing-tradition",
      "traditional-art"
    ]
  },
  {
    "title": "Le Marquis de Puente-Fuerte",
    "description": "Le Marquis de Puente-Fuerte is a traditional pastel on paper work cataloged for ArtVault's institutional gallery collection. The record highlights pastel portrait and drawing tradition, 1761-62, and France. Estimated catalog value: $9,764. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/768abe80-88ff-8c9d-27e9-24be12d76bdf/full/843,/0/default.jpg",
    "artist_name": "Jean-Baptiste Perronneau",
    "material_used": "Pastel on paper",
    "art_style": "Pastel portrait and drawing tradition",
    "dimensions": "69.9 x 56.5 cm (27 9/16 x 22 1/4 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 9764,
    "creation_year": "1761-62",
    "tags": [
      "pastel-on-paper",
      "pastel-portrait-and-drawing-tradition",
      "traditional-art"
    ]
  },
  {
    "title": "The Orchestra",
    "description": "The Orchestra is a traditional pastel on paper work cataloged for ArtVault's institutional gallery collection. The record highlights pastel portrait and drawing tradition, c. 1880, and France. Estimated catalog value: $13,309. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/f8480fdf-15cf-e9b9-59b9-3e37d61a436a/full/843,/0/default.jpg",
    "artist_name": "Jean Louis Forain",
    "material_used": "Pastel on paper",
    "art_style": "Pastel portrait and drawing tradition",
    "dimensions": "45.7 x 36.8 cm (18 x 14 1/2 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 13309,
    "creation_year": "c. 1880",
    "tags": [
      "pastel-on-paper",
      "pastel-portrait-and-drawing-tradition",
      "traditional-art"
    ]
  },
  {
    "title": "Sleeping Girl",
    "description": "Sleeping Girl is a traditional pastel on paper work cataloged for ArtVault's institutional gallery collection. The record highlights pastel portrait and drawing tradition, c. 1750, and Italy. Estimated catalog value: $10,071. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/390aa41a-1cb8-7d99-ef9f-5b171cdec99c/full/843,/0/default.jpg",
    "artist_name": "Conte Pietro Antonio Rotari",
    "material_used": "Pastel on paper",
    "art_style": "Pastel portrait and drawing tradition",
    "dimensions": "40 x 30.2 cm (15 3/4 x 11 15/16 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 10071,
    "creation_year": "c. 1750",
    "tags": [
      "pastel-on-paper",
      "pastel-portrait-and-drawing-tradition",
      "traditional-art"
    ]
  },
  {
    "title": "Summit of the Sierras",
    "description": "Summit of the Sierras is a traditional gouache work cataloged for ArtVault's institutional gallery collection. The record highlights opaque watercolor study, 1872/75, and United States. Estimated catalog value: $11,921. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/fdca1465-3f25-bba8-8692-ac4697c0e3e8/full/843,/0/default.jpg",
    "artist_name": "Thomas Moran",
    "material_used": "Gouache",
    "art_style": "Opaque watercolor study",
    "dimensions": "36 x 25 cm (14 3/16 x 9 7/8 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 11921,
    "creation_year": "1872/75",
    "tags": [
      "gouache",
      "opaque-watercolor-study",
      "traditional-art"
    ]
  },
  {
    "title": "Cupid's Hunting Fields",
    "description": "Cupid's Hunting Fields is a traditional gouache work cataloged for ArtVault's institutional gallery collection. The record highlights opaque watercolor study, 1885, and England. Estimated catalog value: $9,093. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/4bdff9ea-3a92-cde8-b3a2-0bde3f0d717a/full/843,/0/default.jpg",
    "artist_name": "Sir Edward Burne-Jones",
    "material_used": "Gouache",
    "art_style": "Opaque watercolor study",
    "dimensions": "99.5 x 76.9 cm (39 3/16 x 30 5/16 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 9093,
    "creation_year": "1885",
    "tags": [
      "gouache",
      "opaque-watercolor-study",
      "traditional-art"
    ]
  },
  {
    "title": "Venetian Atmosphere",
    "description": "Venetian Atmosphere is a traditional gouache work cataloged for ArtVault's institutional gallery collection. The record highlights opaque watercolor study, n.d., and United States. Estimated catalog value: $10,564. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/d64500c5-3b04-f3eb-abac-0c117b49dca3/full/843,/0/default.jpg",
    "artist_name": "Style of James McNeill Whistler",
    "material_used": "Gouache",
    "art_style": "Opaque watercolor study",
    "dimensions": "12.7 x 21.8 cm (5 x 8 5/8 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 10564,
    "creation_year": "n.d.",
    "tags": [
      "gouache",
      "opaque-watercolor-study",
      "traditional-art"
    ]
  },
  {
    "title": "Perseus and Andromeda, study for The Doom Fulfilled",
    "description": "Perseus and Andromeda, study for The Doom Fulfilled is a traditional gouache work cataloged for ArtVault's institutional gallery collection. The record highlights opaque watercolor study, 1875, and England. Estimated catalog value: $11,959. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/0534abcb-8bf1-dbc8-16a7-5eeb818dbcf7/full/843,/0/default.jpg",
    "artist_name": "Sir Edward Burne-Jones",
    "material_used": "Gouache",
    "art_style": "Opaque watercolor study",
    "dimensions": "33 x 30.3 cm (13 x 11 15/16 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 11959,
    "creation_year": "1875",
    "tags": [
      "gouache",
      "opaque-watercolor-study",
      "traditional-art"
    ]
  },
  {
    "title": "Children Sitting on a Fence",
    "description": "Children Sitting on a Fence is a traditional gouache work cataloged for ArtVault's institutional gallery collection. The record highlights opaque watercolor study, 1874, and United States. Estimated catalog value: $17,276. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/625e0150-0937-02e0-97ea-cdce76429cb5/full/843,/0/default.jpg",
    "artist_name": "Winslow Homer",
    "material_used": "Gouache",
    "art_style": "Opaque watercolor study",
    "dimensions": "19.3 x 23.9 cm (7 5/8 x 9 7/16 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 17276,
    "creation_year": "1874",
    "tags": [
      "gouache",
      "opaque-watercolor-study",
      "traditional-art"
    ]
  },
  {
    "title": "Sunset and Moonrise",
    "description": "Sunset and Moonrise is a traditional gouache work cataloged for ArtVault's institutional gallery collection. The record highlights opaque watercolor study, c. 1832, and England. Estimated catalog value: $9,249. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/5cd5edc1-be1a-486c-9210-468da7668939/full/843,/0/default.jpg",
    "artist_name": "Joseph Mallord William Turner",
    "material_used": "Gouache",
    "art_style": "Opaque watercolor study",
    "dimensions": "29.4 x 45.5 cm (11 5/8 x 17 15/16 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 9249,
    "creation_year": "c. 1832",
    "tags": [
      "gouache",
      "opaque-watercolor-study",
      "traditional-art"
    ]
  },
  {
    "title": "Port of the Alhambra from the Dario",
    "description": "Port of the Alhambra from the Dario is a traditional gouache work cataloged for ArtVault's institutional gallery collection. The record highlights opaque watercolor study, n.d., and England. Estimated catalog value: $8,889. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/629f8ab0-613f-e726-8860-fb7bd87b674f/full/843,/0/default.jpg",
    "artist_name": "Richard Ford",
    "material_used": "Gouache",
    "art_style": "Opaque watercolor study",
    "dimensions": "26.5 x 18 cm (10 7/16 x 7 1/8 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 8889,
    "creation_year": "n.d.",
    "tags": [
      "gouache",
      "opaque-watercolor-study",
      "traditional-art"
    ]
  },
  {
    "title": "A Capriccio with Horses Watering in a River Outside a Walled Town",
    "description": "A Capriccio with Horses Watering in a River Outside a Walled Town is a traditional gouache work cataloged for ArtVault's institutional gallery collection. The record highlights opaque watercolor study, c. 1720, and Italy. Estimated catalog value: $8,118. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/47e54490-4761-aeb5-958c-2234aeb2da24/full/843,/0/default.jpg",
    "artist_name": "Marco Ricci",
    "material_used": "Gouache",
    "art_style": "Opaque watercolor study",
    "dimensions": "31.6 x 45.6 cm (12 1/2 x 18 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 8118,
    "creation_year": "c. 1720",
    "tags": [
      "gouache",
      "opaque-watercolor-study",
      "traditional-art"
    ]
  },
  {
    "title": "Mural Fragment Depicting a Maguey Bloodletting Ritual",
    "description": "Mural Fragment Depicting a Maguey Bloodletting Ritual is a traditional fresco work cataloged for ArtVault's institutional gallery collection. The record highlights teotihuacán, 500-600 CE, and Teotihuacán. Estimated catalog value: $14,043. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/09d2b000-8e44-c735-5099-126d6453aaaa/full/843,/0/default.jpg",
    "artist_name": "Teotihuacan",
    "material_used": "Fresco",
    "art_style": "teotihuacán",
    "dimensions": "63.8 x 95 cm (25 x 37 1/2 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 14043,
    "creation_year": "500-600 CE",
    "tags": [
      "fresco",
      "teotihuac-n",
      "traditional-art"
    ]
  },
  {
    "title": "Sketch for a Ceiling Fresco",
    "description": "Sketch for a Ceiling Fresco is a traditional fresco work cataloged for ArtVault's institutional gallery collection. The record highlights 18th century, c. 1740, and Italy. Estimated catalog value: $20,085. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/c0e3572f-f756-a351-fe0f-bcecb20a5090/full/843,/0/default.jpg",
    "artist_name": "Giovanni Domenico Ferretti",
    "material_used": "Fresco",
    "art_style": "18th Century",
    "dimensions": "65 x 50.8 cm (25 5/8 x 19 15/16 in.); Framed: 81.3 x 67.4 x 6.4 cm (32 x 26 1/2 x 2 1/2 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 20085,
    "creation_year": "c. 1740",
    "tags": [
      "fresco",
      "18th-century",
      "traditional-art"
    ]
  },
  {
    "title": "Tripod Vessel with a Blowgunner Scene",
    "description": "Tripod Vessel with a Blowgunner Scene is a traditional fresco work cataloged for ArtVault's institutional gallery collection. The record highlights teotihuacán, 300-500 CE, and Mexico. Estimated catalog value: $14,692. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/96900cc1-d9cf-5e6b-ce5b-e5bcc83872d9/full/843,/0/default.jpg",
    "artist_name": "Teotihuacan",
    "material_used": "Fresco",
    "art_style": "teotihuacán",
    "dimensions": "8.9 x 15.9 cm (3 1/2 x 6 1/4 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 14692,
    "creation_year": "300-500 CE",
    "tags": [
      "fresco",
      "teotihuac-n",
      "traditional-art"
    ]
  },
  {
    "title": "Bowl Depicting a Female Figure with Shield and Darts Motifs",
    "description": "Bowl Depicting a Female Figure with Shield and Darts Motifs is a traditional fresco work cataloged for ArtVault's institutional gallery collection. The record highlights teotihuacán, 300-600 CE, and Valley of Mexico. Estimated catalog value: $17,625. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/ac08eb6b-a3ac-08de-c33b-075e1c93ca39/full/843,/0/default.jpg",
    "artist_name": "Teotihuacan",
    "material_used": "Fresco",
    "art_style": "teotihuacán",
    "dimensions": "Diam.: 22.5 cm (8 7/8 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 17625,
    "creation_year": "300-600 CE",
    "tags": [
      "fresco",
      "teotihuac-n",
      "traditional-art"
    ]
  },
  {
    "title": "Girl's Face, from Spring Fresco of Jusélius Mausoleum",
    "description": "Girl's Face, from Spring Fresco of Jusélius Mausoleum is a traditional fresco work cataloged for ArtVault's institutional gallery collection. The record highlights ancient and mural tradition, 1905, and Finland. Estimated catalog value: $15,535. This entry is intended for capstone demonstration, collection browsing, and museum-style metadata presentation.",
    "image_url": "https://www.artic.edu/iiif/2/303477a5-489f-4474-5ec2-aa734a2ec2f9/full/843,/0/default.jpg",
    "artist_name": "Akseli Gallen-Kallela",
    "material_used": "Fresco",
    "art_style": "Ancient and mural tradition",
    "dimensions": "Image: 18 x 13.8 cm (7 1/8 x 5 7/16 in.); Plate: 18.4 x 14.3 cm (7 1/4 x 5 11/16 in.); Sheet: 35 x 22.5 cm (13 13/16 x 8 7/8 in.)",
    "collector_or_pricing": "Institutional Collection",
    "price": 15535,
    "creation_year": "1905",
    "tags": [
      "fresco",
      "ancient-and-mural-tradition",
      "traditional-art"
    ]
  }
]
$seed$::jsonb) AS x(
    title TEXT,
    description TEXT,
    image_url TEXT,
    artist_name TEXT,
    material_used TEXT,
    art_style TEXT,
    dimensions TEXT,
    collector_or_pricing TEXT,
    price NUMERIC,
    creation_year TEXT,
    tags TEXT[]
  )
), inserted AS (
  INSERT INTO public.artworks (
    user_id,
    title,
    description,
    image_url,
    artist_name,
    material_used,
    art_style,
    dimensions,
    collector_or_pricing,
    price,
    creation_year,
    tags,
    medium,
    dominant_color
  )
  SELECT
    seed_owner.id,
    seed_rows.title,
    seed_rows.description,
    seed_rows.image_url,
    seed_rows.artist_name,
    seed_rows.material_used,
    seed_rows.art_style,
    seed_rows.dimensions,
    seed_rows.collector_or_pricing,
    seed_rows.price,
    seed_rows.creation_year,
    seed_rows.tags,
    seed_rows.art_style,
    '#b8975a'
  FROM seed_owner
  CROSS JOIN seed_rows
  RETURNING id, title, material_used, art_style
)
INSERT INTO public.artwork_categories (artwork_id, category_id)
SELECT inserted.id, categories.id
FROM inserted
JOIN public.categories ON categories.slug = CASE
  WHEN inserted.material_used = 'Oil on canvas' THEN 'oil-paintings'
  WHEN inserted.material_used IN ('Watercolor on paper', 'Charcoal on paper', 'Graphite on paper', 'Pastel on paper', 'Gouache') THEN 'works-on-paper'
  WHEN inserted.material_used = 'Fresco' THEN 'renaissance-old-masters'
  ELSE 'traditional-art'
END
ON CONFLICT DO NOTHING;

INSERT INTO public.artwork_categories (artwork_id, category_id)
SELECT artworks.id, categories.id
FROM public.artworks
CROSS JOIN public.categories
WHERE categories.slug = 'museum-collection'
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
