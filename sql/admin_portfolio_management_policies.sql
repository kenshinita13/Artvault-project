-- =============================================
-- ArtVault: Admin Portfolio Management Policies
-- Allows administrator accounts to manage portfolios and portfolio items
-- owned by any user. Run once in Supabase SQL Editor.
-- =============================================

ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'boards'
      AND policyname = 'Admins can manage all boards'
  ) THEN
    CREATE POLICY "Admins can manage all boards"
    ON public.boards
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
      )
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'board_items'
      AND policyname = 'Admins can manage all board items'
  ) THEN
    CREATE POLICY "Admins can manage all board items"
    ON public.board_items
    FOR ALL
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
      )
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
