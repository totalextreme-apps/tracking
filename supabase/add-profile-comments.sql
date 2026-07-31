-- Create profile_comments table for Guestbook feature
CREATE TABLE IF NOT EXISTS public.profile_comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  parent_id UUID REFERENCES public.profile_comments(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.profile_comments ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Profile comments are viewable by everyone" ON public.profile_comments;
CREATE POLICY "Profile comments are viewable by everyone"
  ON public.profile_comments FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can insert own profile comments" ON public.profile_comments;
CREATE POLICY "Users can insert own profile comments"
  ON public.profile_comments FOR INSERT
  WITH CHECK (auth.uid() = author_id OR author_id = '00000000-0000-0000-0000-000000000000');

DROP POLICY IF EXISTS "Users can update own profile comments" ON public.profile_comments;
CREATE POLICY "Users can update own profile comments"
  ON public.profile_comments FOR UPDATE
  USING (auth.uid() = author_id OR author_id = '00000000-0000-0000-0000-000000000000');

DROP POLICY IF EXISTS "Users can delete own or guestbook profile comments" ON public.profile_comments;
CREATE POLICY "Users can delete own or guestbook profile comments"
  ON public.profile_comments FOR DELETE
  USING (auth.uid() = author_id OR auth.uid() = profile_id OR author_id = '00000000-0000-0000-0000-000000000000' OR profile_id = '00000000-0000-0000-0000-000000000000');
