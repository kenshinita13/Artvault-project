-- Fix: Allow Administrators to update other users' profiles without triggering infinite recursion.
-- We use a SECURITY DEFINER function to bypass the recursive RLS check safely.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Drop the policy if it already exists to avoid errors
DROP POLICY IF EXISTS "Admins can update profiles" ON public.profiles;

-- Create the policy using the secure function
CREATE POLICY "Admins can update profiles" 
ON public.profiles 
FOR UPDATE 
USING (public.is_admin());
