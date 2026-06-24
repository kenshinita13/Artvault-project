-- =============================================
-- ArtVault: Capstone Requirements Schema Update
-- Adds Artist Name, Material Used, Art Style, Dimensions, Collector/Pricing, Price, and Creation Year
-- Run this ENTIRE script in Supabase SQL Editor
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
ADD COLUMN IF NOT EXISTS medium TEXT;

-- =============================================
-- Backfill Existing Collection Records
-- These are curated, presentation-ready estimates for capstone/demo use.
-- Valuations are intentionally approximate and should be treated as catalog
-- estimates rather than formal appraisals.
-- =============================================

WITH catalog_seed (
  id,
  artist_name,
  material_used,
  art_style,
  dimensions,
  collector_or_pricing,
  price,
  creation_year,
  description,
  tags
) AS (
  VALUES
  (
    'c837abbe-2fd1-4ec6-ad8d-f088753b9689'::uuid,
    'ArtVault Studio Collection',
    'Digital illustration on archival print',
    'Cinematic conceptual pop art',
    '24 x 36 in',
    'Private Collection',
    4200,
    '2026',
    'A cinematic conceptual work with a bold, high-contrast visual identity. Style: contemporary pop-surrealism with narrative poster influence. Estimated catalog value: $4,200. Collection note: early ArtVault upload retained as part of the platform''s founding archive.',
    ARRAY['conceptual', 'pop-art', 'cinematic', 'founding-archive']
  ),
  (
    'bbc710dd-46d4-48cf-90b2-0d56304eccf0'::uuid,
    'ArtVault Studio Collection',
    'Digital portrait study',
    'Contemporary character portrait',
    '18 x 24 in',
    'Available for Acquisition',
    2800,
    '2026',
    'A contemporary portrait study focused on presence, recognizability, and dramatic figure framing. Style: pop-culture realism with clean digital finishing. Estimated catalog value: $2,800.',
    ARRAY['portrait', 'digital-art', 'contemporary', 'pop-culture']
  ),
  (
    '42bed929-5b30-410b-a224-82c361cc2231'::uuid,
    'ArtVault Studio Collection',
    'Digital portrait study',
    'Heroic realism',
    '18 x 24 in',
    'Available for Acquisition',
    3000,
    '2026',
    'A heroic portrait composition emphasizing strength, gesture, and iconic presence. Style: contemporary realism with entertainment-poster influence. Estimated catalog value: $3,000.',
    ARRAY['portrait', 'heroic-realism', 'digital-art', 'figure-study']
  ),
  (
    '05799e5e-954c-4fe7-a303-01cb3dc9e5bc'::uuid,
    'ArtVault Studio Collection',
    'Digital painting',
    'Dark fantasy expressionism',
    '24 x 30 in',
    'Private Collection',
    5200,
    '2026',
    'A dark fantasy figure study using intense expression, rugged texture, and dramatic contrast. Style: fantasy expressionism with graphic-novel influence. Estimated catalog value: $5,200.',
    ARRAY['dark-fantasy', 'expressionism', 'figure-study', 'digital-painting']
  ),
  (
    '352c7f76-f3d8-490b-ac14-b67bb87abb93'::uuid,
    'ArtVault Studio Collection',
    'Digital painting on archival print',
    'Mythic realism',
    '24 x 36 in',
    'Private Collection',
    6500,
    '2026',
    'A mythic warrior composition centered on power, restraint, and sculptural anatomy. Style: mythic realism with cinematic lighting. Estimated catalog value: $6,500.',
    ARRAY['mythic', 'realism', 'warrior', 'digital-painting']
  ),
  (
    '6ff7fc17-ea0d-4579-a151-1ea7ea4ea574'::uuid,
    'ArtVault Studio Collection',
    'Digital concept art',
    'High fantasy action study',
    '24 x 32 in',
    'Available for Acquisition',
    4800,
    '2026',
    'A high-energy fantasy character piece with expressive motion and dramatic atmosphere. Style: action-oriented concept art with painterly digital rendering. Estimated catalog value: $4,800.',
    ARRAY['fantasy', 'concept-art', 'action-study', 'digital']
  ),
  (
    '17732e75-297f-4d5f-9e3a-260eaed08c97'::uuid,
    'ArtVault Studio Collection',
    'Digital character painting',
    'Narrative fantasy portrait',
    '20 x 28 in',
    'Available for Acquisition',
    5100,
    '2026',
    'A narrative fantasy portrait that balances elegance, heroism, and theatrical mood. Style: painterly digital realism. Estimated catalog value: $5,100.',
    ARRAY['fantasy', 'portrait', 'digital-realism', 'narrative-art']
  ),
  (
    '85714d7c-3eab-4110-a264-785fe68bc266'::uuid,
    'ArtVault Studio Collection',
    'Digital painting',
    'Romantic dark fantasy',
    '24 x 36 in',
    'Private Collection',
    7200,
    '2026',
    'A refined fantasy figure study marked by elegance, movement, and ornate visual drama. Style: romantic dark fantasy with painterly detailing. Estimated catalog value: $7,200.',
    ARRAY['dark-fantasy', 'romanticism', 'figure-study', 'digital-painting']
  ),
  (
    '38b6b98d-b747-4267-bd10-1f49bb10a1b8'::uuid,
    'After Leonardo da Vinci',
    'Digital study after oil portrait',
    'Renaissance portrait study',
    '21 x 30 in',
    'Reference Study',
    8900,
    '2026',
    'A Renaissance-inspired catalog study referencing the visual language of classical portraiture. Style: sfumato-influenced portrait study with museum reproduction qualities. Estimated catalog value: $8,900.',
    ARRAY['renaissance', 'portrait', 'classical-study', 'museum-reference']
  ),
  (
    '363af04e-1245-4ab2-86b6-b2698eb12e5c'::uuid,
    'ArtVault Studio Collection',
    'Digital armor study',
    'Medieval fantasy realism',
    '22 x 30 in',
    'Private Collection',
    4600,
    '2026',
    'A medieval fantasy armor composition built around silhouette, metal texture, and heroic atmosphere. Style: fantasy realism with game-art influence. Estimated catalog value: $4,600.',
    ARRAY['armor', 'medieval', 'fantasy-realism', 'digital-art']
  ),
  (
    'f30fc9d6-aec8-45f4-82f5-232124e61202'::uuid,
    'After Vincent van Gogh',
    'Digital study after oil on canvas',
    'Post-Impressionist study',
    '24 x 30 in',
    'Reference Study',
    9500,
    '2026',
    'A Post-Impressionist study inspired by expressive night-sky movement, rhythmic brushwork, and luminous color. Style: expressive landscape study after Van Gogh. Estimated catalog value: $9,500.',
    ARRAY['post-impressionism', 'landscape', 'van-gogh-study', 'expressive']
  ),
  (
    '4be10110-646f-4200-8081-4d39f3efe620'::uuid,
    'ArtVault Studio Collection',
    'Digital fantasy painting',
    'Regal fantasy portrait',
    '24 x 32 in',
    'Private Collection',
    5400,
    '2026',
    'A regal fantasy portrait with emphasis on nobility, luminous detail, and dramatic character identity. Style: high fantasy realism. Estimated catalog value: $5,400.',
    ARRAY['fantasy', 'portrait', 'regal', 'digital-painting']
  ),
  (
    '014d91c9-df11-4f8a-ab57-43e04b7c28a2'::uuid,
    'ArtVault Studio Collection',
    'Digital action composition',
    'Fantasy battle scene',
    '28 x 40 in',
    'Available for Acquisition',
    6700,
    '2026',
    'A battle-scene composition focused on motion, confrontation, and cinematic staging. Style: fantasy action realism with narrative illustration qualities. Estimated catalog value: $6,700.',
    ARRAY['battle-scene', 'fantasy', 'narrative', 'digital-art']
  ),
  (
    'acabae56-d94b-4593-8751-e2689ee436d3'::uuid,
    'ArtVault Studio Collection',
    'Digital landscape painting',
    'Atmospheric landscape',
    '24 x 36 in',
    'Available for Acquisition',
    3900,
    '2026',
    'An atmospheric sunset landscape study using warm light, open space, and contemplative composition. Style: cinematic landscape realism. Estimated catalog value: $3,900.',
    ARRAY['landscape', 'sunset', 'atmospheric', 'digital-painting']
  ),
  (
    'ef726e64-b75e-4d83-a810-cb60527bb391'::uuid,
    'ArtVault Studio Collection',
    'Digital illustration',
    'Celestial fantasy',
    '24 x 32 in',
    'Available for Acquisition',
    4400,
    '2026',
    'A celestial fantasy work using symbolic composition and luminous atmosphere. Style: zodiac-inspired fantasy illustration. Estimated catalog value: $4,400.',
    ARRAY['celestial', 'zodiac', 'fantasy', 'symbolic']
  ),
  (
    'bbb08f64-4377-40d2-aa4e-b47e17eff98d'::uuid,
    'ArtVault Studio Collection',
    'Digital environment art',
    'Pastoral fantasy landscape',
    '24 x 36 in',
    'Collection Archive',
    3600,
    '2026',
    'A pastoral environment study with warm greens, soft light, and immersive world-building detail. Style: fantasy landscape concept art. Estimated catalog value: $3,600.',
    ARRAY['environment-art', 'landscape', 'pastoral', 'fantasy']
  ),
  (
    '9a99ad9c-0e7b-47df-b57d-6b62daae3e8f'::uuid,
    'ArtVault Studio Collection',
    'Digital architectural environment',
    'Epic cityscape concept art',
    '30 x 42 in',
    'Collection Archive',
    6100,
    '2026',
    'An architectural fantasy cityscape centered on scale, grandeur, and civic identity. Style: epic environment concept art. Estimated catalog value: $6,100.',
    ARRAY['cityscape', 'architecture', 'environment-art', 'fantasy']
  ),
  (
    'fdd6ed72-f188-477d-8f8e-55fde6e3f6e7'::uuid,
    'ArtVault Studio Collection',
    'Digital environment art',
    'Mystical woodland study',
    '24 x 36 in',
    'Collection Archive',
    3400,
    '2026',
    'A mystical woodland environment study using soft atmospheric depth and fantasy color language. Style: immersive landscape concept art. Estimated catalog value: $3,400.',
    ARRAY['woodland', 'mystical', 'environment-art', 'fantasy']
  ),
  (
    'bc97c7fa-8272-446f-b885-6711f01ed2c6'::uuid,
    'ArtVault Studio Collection',
    'Digital environment art',
    'Rugged fantasy landscape',
    '24 x 36 in',
    'Collection Archive',
    3300,
    '2026',
    'A rugged landscape concept emphasizing heat, terrain, and cultural atmosphere. Style: fantasy environment art with earth-toned palette. Estimated catalog value: $3,300.',
    ARRAY['landscape', 'environment-art', 'earth-tones', 'fantasy']
  ),
  (
    'b55890a2-0b12-4d1c-be7e-49cfaf283fdd'::uuid,
    'ArtVault Studio Collection',
    'Digital architectural painting',
    'Gothic fortress landscape',
    '30 x 44 in',
    'Private Collection',
    7600,
    '2026',
    'A monumental fortress composition with gothic massing, dramatic scale, and ominous atmosphere. Style: dark fantasy architectural landscape. Estimated catalog value: $7,600.',
    ARRAY['gothic', 'fortress', 'architecture', 'dark-fantasy']
  ),
  (
    '7ea16637-d17f-482f-9497-ae3d8a280e09'::uuid,
    'ArtVault Studio Collection',
    'Digital character portrait',
    'Villain portraiture',
    '20 x 30 in',
    'Private Collection',
    5800,
    '2026',
    'A dramatic character portrait built around elegance, menace, and iconic silhouette. Style: cinematic villain portraiture with fantasy influence. Estimated catalog value: $5,800.',
    ARRAY['portrait', 'villain', 'cinematic', 'fantasy']
  ),
  (
    'b35668d2-2a32-4eaf-9928-9d25346df053'::uuid,
    'ArtVault Studio Collection',
    'Digital character portrait',
    'Heroic fantasy portrait',
    '20 x 30 in',
    'Private Collection',
    5700,
    '2026',
    'A heroic character portrait emphasizing identity, resolve, and stylized realism. Style: fantasy portraiture with cinematic lighting. Estimated catalog value: $5,700.',
    ARRAY['portrait', 'heroic', 'fantasy', 'digital-art']
  ),
  (
    '12dec541-d8af-41c5-b547-8c239e2cff3f'::uuid,
    'ArtVault Studio Collection',
    'Digital pop portrait',
    'Contemporary celebrity study',
    '18 x 24 in',
    'Available for Acquisition',
    4100,
    '2026',
    'A contemporary pop portrait study with emphasis on cultural recognition, graphic composition, and expressive personality. Style: pop-culture portraiture. Estimated catalog value: $4,100.',
    ARRAY['portrait', 'pop-culture', 'celebrity-study', 'digital']
  ),
  (
    '67acd1b9-1e8b-4d8f-9eea-71a3dd241f50'::uuid,
    'ArtVault Studio Collection',
    'Digital automotive art',
    'Motorsport realism',
    '24 x 36 in',
    'Available for Acquisition',
    3500,
    '2026',
    'An automotive composition celebrating speed, engineering form, and polished surface detail. Style: motorsport realism with digital poster finishing. Estimated catalog value: $3,500.',
    ARRAY['automotive', 'motorsport', 'realism', 'digital-art']
  ),
  (
    'f6cdd5a1-210a-44c4-b73c-1883a44c36ba'::uuid,
    'ArtVault Studio Collection',
    'Mixed media digital composition',
    'Modern abstraction',
    '24 x 24 in',
    'Available for Acquisition',
    2900,
    '2026',
    'A modern abstract composition balancing form, color, and gallery-ready minimal structure. Style: contemporary abstraction. Estimated catalog value: $2,900.',
    ARRAY['modern-art', 'abstract', 'contemporary', 'mixed-media']
  ),
  (
    '5adc8139-3aa0-4ec6-8c86-cfc584a01256'::uuid,
    'ArtVault Studio Collection',
    'Mixed media digital composition',
    'Contemporary abstraction',
    '24 x 24 in',
    'Available for Acquisition',
    3100,
    '2026',
    'A contemporary abstract work with expressive balance, visual rhythm, and refined negative space. Style: modern gallery abstraction. Estimated catalog value: $3,100.',
    ARRAY['abstract', 'modern-art', 'gallery-study', 'contemporary']
  ),
  (
    'f221008d-0015-4726-8ced-ceecb31ad9fd'::uuid,
    'ArtVault Studio Collection',
    'Mixed media digital composition',
    'Triptych-inspired abstraction',
    '24 x 30 in',
    'Available for Acquisition',
    3300,
    '2026',
    'A composition study arranged with the rhythm and restraint of a small abstract series. Style: triptych-inspired contemporary abstraction. Estimated catalog value: $3,300.',
    ARRAY['abstract', 'series', 'modern-art', 'composition-study']
  ),
  (
    '3663bc90-9abd-4b6b-9ecd-3391517e7e16'::uuid,
    'ArtVault Studio Collection',
    'Mixed media digital composition',
    'Minimal contemporary study',
    '20 x 24 in',
    'Available for Acquisition',
    2500,
    '2026',
    'A compact contemporary study focused on simple form, balance, and clean presentation. Style: minimalist modern abstraction. Estimated catalog value: $2,500.',
    ARRAY['minimalism', 'abstract', 'modern-art', 'study']
  ),
  (
    'b6dfa400-b1a7-413d-929a-f1dc8211ddd9'::uuid,
    'Andrei A. Macaspac',
    'Pencil and graphite on paper',
    'Traditional academic sketch',
    '11 x 17 in',
    'Artist Archive',
    1800,
    '2023',
    'A traditional graphite work from the artist''s early archive, completed at age 17. Style: academic sketch study with personal developmental value. Estimated catalog value: $1,800.',
    ARRAY['pencil', 'graphite', 'traditional', 'artist-archive']
  ),
  (
    '3b4dc22f-a1ab-442f-a402-87d259db9610'::uuid,
    'Thirmizi Tahajid',
    'Pastel on paper',
    'Historical warrior portrait',
    '23 x 46 in',
    'Private Collector',
    6000,
    '1889',
    'A dramatic warrior portrait inspired by the legendary swordsman Miyamoto Musashi. Style: historical character portrait with pastel texture and classical presentation. Estimated catalog value: $6,000.',
    ARRAY['pastel', 'historical', 'warrior', 'portrait']
  )
)
UPDATE public.artworks AS a
SET
  artist_name = COALESCE(NULLIF(a.artist_name, ''), catalog_seed.artist_name),
  material_used = COALESCE(NULLIF(a.material_used, ''), catalog_seed.material_used),
  art_style = COALESCE(NULLIF(a.art_style, ''), catalog_seed.art_style),
  dimensions = COALESCE(NULLIF(a.dimensions, ''), catalog_seed.dimensions),
  collector_or_pricing = COALESCE(NULLIF(a.collector_or_pricing, ''), catalog_seed.collector_or_pricing),
  price = COALESCE(a.price, catalog_seed.price),
  creation_year = COALESCE(NULLIF(a.creation_year, ''), catalog_seed.creation_year),
  description = CASE
    WHEN a.description IS NULL OR length(trim(a.description)) < 35 THEN catalog_seed.description
    WHEN a.description NOT ILIKE '%Estimated catalog value:%' THEN
      trim(a.description) || E'\n\n' ||
      'Catalog note: ' || catalog_seed.art_style || '. Estimated catalog value: $' ||
      trim(to_char(catalog_seed.price, 'FM999,999,999')) || '.'
    ELSE a.description
  END,
  tags = CASE
    WHEN a.tags IS NULL OR cardinality(a.tags) = 0 THEN catalog_seed.tags
    ELSE (
      SELECT array_agg(DISTINCT tag)
      FROM unnest(a.tags || catalog_seed.tags) AS tag
    )
  END,
  medium = COALESCE(NULLIF(a.medium, ''), catalog_seed.art_style)
FROM catalog_seed
WHERE a.id = catalog_seed.id;

-- Reload Schema Cache for API
NOTIFY pgrst, 'reload schema';
