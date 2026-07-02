-- =============================================
-- ArtVault: Notifications System
-- Run this ENTIRE script in Supabase SQL Editor
-- =============================================

-- 1. Create Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, -- The owner of the artwork receiving the notification
  actor_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- The person who liked/commented
  artwork_id UUID REFERENCES public.artworks(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'system')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only SEE their own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can UPDATE their own notifications (e.g., mark as read)
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- 2. Function to handle new likes
CREATE OR REPLACE FUNCTION handle_new_like()
RETURNS TRIGGER AS $$
DECLARE
  art_owner UUID;
BEGIN
  -- Get the owner of the artwork
  SELECT user_id INTO art_owner FROM public.artworks WHERE id = NEW.artwork_id;
  
  -- Don't notify if the user liked their own art
  IF art_owner != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, artwork_id, type)
    VALUES (art_owner, NEW.user_id, NEW.artwork_id, 'like');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger for new likes
DROP TRIGGER IF EXISTS on_like_created ON public.likes;
CREATE TRIGGER on_like_created
  AFTER INSERT ON public.likes
  FOR EACH ROW EXECUTE FUNCTION handle_new_like();

-- 4. Function to handle new comments
CREATE OR REPLACE FUNCTION handle_new_comment()
RETURNS TRIGGER AS $$
DECLARE
  art_owner UUID;
BEGIN
  -- Get the owner of the artwork
  SELECT user_id INTO art_owner FROM public.artworks WHERE id = NEW.artwork_id;
  
  -- Don't notify if the user commented on their own art
  IF art_owner != NEW.user_id THEN
    INSERT INTO public.notifications (user_id, actor_id, artwork_id, type)
    VALUES (art_owner, NEW.user_id, NEW.artwork_id, 'comment');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger for new comments
DROP TRIGGER IF EXISTS on_comment_created ON public.comments;
CREATE TRIGGER on_comment_created
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION handle_new_comment();

-- Reload Schema Cache for API
NOTIFY pgrst, 'reload schema';
