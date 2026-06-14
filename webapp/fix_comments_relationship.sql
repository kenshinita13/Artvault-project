-- Run this in the Supabase SQL Editor to fix the Comments Relationship error

ALTER TABLE public.comments
ADD CONSTRAINT comments_user_id_fkey_profiles 
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Reload Schema Cache for API
NOTIFY pgrst, 'reload schema';
