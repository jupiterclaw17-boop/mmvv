
-- =============================================
-- ETAPA 2 — Schema completo do Sistema de Multitracks e Escalas
-- =============================================

-- 1. Enum de roles
CREATE TYPE public.app_role AS ENUM ('ministro_guia', 'dm', 'admin');

-- 2. Tabela user_roles (segurança — usada apenas nas RLS policies)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 3. Função has_role (security definer — evita recursão em RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Helper: check if user has any of dm or admin roles
CREATE OR REPLACE FUNCTION public.has_dm_or_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('dm', 'admin')
  )
$$;

-- 4. Tabela users_profiles
CREATE TABLE public.users_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('ministro_guia', 'dm', 'admin')),
  team_id UUID, -- FK adicionada após criar teams
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.users_profiles ENABLE ROW LEVEL SECURITY;

-- 5. Tabela artists
CREATE TABLE public.artists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;

-- 6. Tabela songs
CREATE TABLE public.songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE RESTRICT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (name, artist_id)
);
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

-- 7. Tabela teams
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  worship_leader_id UUID NOT NULL REFERENCES public.users_profiles(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa', 'inativa')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Agora adicionar FK team_id em users_profiles
ALTER TABLE public.users_profiles
  ADD CONSTRAINT fk_users_profiles_team
  FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;

-- 8. Tabela multitracks
CREATE TABLE public.multitracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artist_id UUID NOT NULL REFERENCES public.artists(id) ON DELETE RESTRICT,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE RESTRICT,
  youtube_version_url TEXT,
  song_key TEXT NOT NULL,
  bpm INTEGER,
  storage_url TEXT,
  storage_path TEXT,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.multitracks ENABLE ROW LEVEL SECURITY;

-- 9. Tabela services (Escalas)
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_date DATE NOT NULL,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE RESTRICT,
  worship_leader_id UUID NOT NULL REFERENCES public.users_profiles(id) ON DELETE RESTRICT,
  dm_id UUID REFERENCES public.users_profiles(id) ON DELETE SET NULL,
  period TEXT NOT NULL CHECK (period IN ('manha', 'tarde', 'noite')),
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- 10. Tabela service_songs
CREATE TABLE public.service_songs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES public.songs(id) ON DELETE RESTRICT,
  song_key TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.service_songs ENABLE ROW LEVEL SECURITY;

-- 11. Tabela logs
CREATE TABLE public.logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  log_type TEXT NOT NULL CHECK (log_type IN ('audit', 'error')),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name TEXT,
  action TEXT,
  entity TEXT,
  entity_id TEXT,
  description TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.logs ENABLE ROW LEVEL SECURITY;

-- =============================================
-- TRIGGERS E FUNCTIONS
-- =============================================

-- Trigger: normalizar nomes para MAIÚSCULAS
CREATE OR REPLACE FUNCTION public.normalize_name_to_upper()
RETURNS TRIGGER AS $$
BEGIN
  NEW.name := UPPER(NEW.name);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER artists_normalize_name
  BEFORE INSERT OR UPDATE ON public.artists
  FOR EACH ROW EXECUTE FUNCTION public.normalize_name_to_upper();

CREATE TRIGGER songs_normalize_name
  BEFORE INSERT OR UPDATE ON public.songs
  FOR EACH ROW EXECUTE FUNCTION public.normalize_name_to_upper();

-- Trigger: updated_at automático
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_users_profiles_updated_at BEFORE UPDATE ON public.users_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_artists_updated_at BEFORE UPDATE ON public.artists FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_songs_updated_at BEFORE UPDATE ON public.songs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_multitracks_updated_at BEFORE UPDATE ON public.multitracks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: criar perfil e role ao registrar usuário no Auth
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _role TEXT;
BEGIN
  _role := COALESCE(NEW.raw_user_meta_data->>'role', 'ministro_guia');
  
  INSERT INTO public.users_profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    _role,
    'ativo'
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role::app_role);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- RLS POLICIES
-- =============================================

-- user_roles: admin pode ler todos; usuário vê o próprio
CREATE POLICY "user_roles_select" ON public.user_roles
  FOR SELECT USING (
    auth.uid() = user_id OR public.has_role(auth.uid(), 'admin')
  );

-- users_profiles
CREATE POLICY "users_profiles_select" ON public.users_profiles
  FOR SELECT USING (
    auth.uid() = id OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "users_profiles_insert" ON public.users_profiles
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users_profiles_update" ON public.users_profiles
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "users_profiles_delete" ON public.users_profiles
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- artists
CREATE POLICY "artists_select" ON public.artists
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "artists_insert" ON public.artists
  FOR INSERT WITH CHECK (public.has_dm_or_admin(auth.uid()));

CREATE POLICY "artists_update" ON public.artists
  FOR UPDATE USING (public.has_dm_or_admin(auth.uid()));

-- songs
CREATE POLICY "songs_select" ON public.songs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "songs_insert" ON public.songs
  FOR INSERT WITH CHECK (public.has_dm_or_admin(auth.uid()));

CREATE POLICY "songs_update" ON public.songs
  FOR UPDATE USING (public.has_dm_or_admin(auth.uid()));

-- multitracks
CREATE POLICY "multitracks_select" ON public.multitracks
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "multitracks_insert" ON public.multitracks
  FOR INSERT WITH CHECK (public.has_dm_or_admin(auth.uid()));

CREATE POLICY "multitracks_update" ON public.multitracks
  FOR UPDATE USING (public.has_dm_or_admin(auth.uid()));

CREATE POLICY "multitracks_delete" ON public.multitracks
  FOR DELETE USING (public.has_dm_or_admin(auth.uid()));

-- teams
CREATE POLICY "teams_select" ON public.teams
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "teams_insert" ON public.teams
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "teams_update" ON public.teams
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "teams_delete" ON public.teams
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- services
CREATE POLICY "services_select" ON public.services
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "services_insert" ON public.services
  FOR INSERT WITH CHECK (public.has_dm_or_admin(auth.uid()));

CREATE POLICY "services_update" ON public.services
  FOR UPDATE USING (public.has_dm_or_admin(auth.uid()));

CREATE POLICY "services_delete" ON public.services
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- service_songs
CREATE POLICY "service_songs_select" ON public.service_songs
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "service_songs_insert" ON public.service_songs
  FOR INSERT WITH CHECK (public.has_dm_or_admin(auth.uid()));

CREATE POLICY "service_songs_update" ON public.service_songs
  FOR UPDATE USING (public.has_dm_or_admin(auth.uid()));

CREATE POLICY "service_songs_delete" ON public.service_songs
  FOR DELETE USING (public.has_dm_or_admin(auth.uid()));

-- logs
CREATE POLICY "logs_select" ON public.logs
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "logs_insert" ON public.logs
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- =============================================
-- STORAGE BUCKET
-- =============================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('multitracks', 'multitracks', true);

-- Storage policies
CREATE POLICY "multitracks_storage_select" ON storage.objects
  FOR SELECT USING (bucket_id = 'multitracks');

CREATE POLICY "multitracks_storage_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'multitracks' AND public.has_dm_or_admin(auth.uid())
  );

CREATE POLICY "multitracks_storage_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'multitracks' AND public.has_dm_or_admin(auth.uid())
  );

CREATE POLICY "multitracks_storage_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'multitracks' AND public.has_dm_or_admin(auth.uid())
  );
