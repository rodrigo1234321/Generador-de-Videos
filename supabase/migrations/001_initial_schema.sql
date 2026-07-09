-- Tablas para el Generador de Videos MVP (100% Gratis)

-- Videos generados
CREATE TABLE IF NOT EXISTS videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt TEXT NOT NULL,
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending','script_generated','audio_generated','images_generated','rendering','completed','error')),
  script JSONB,
  audio_url TEXT,
  video_url TEXT,
  duration_seconds FLOAT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Escenas individuales de cada video
CREATE TABLE IF NOT EXISTS scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES videos(id) ON DELETE CASCADE,
  scene_order INTEGER NOT NULL,
  narration TEXT NOT NULL,
  image_prompt TEXT NOT NULL,
  image_url TEXT,
  duration_seconds FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar Row Level Security (RLS)
-- Para el MVP sin autenticación, permitimos acceso público.
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read videos" ON videos;
DROP POLICY IF EXISTS "Allow public insert videos" ON videos;
DROP POLICY IF EXISTS "Allow public update videos" ON videos;
CREATE POLICY "Allow public read videos" ON videos FOR SELECT USING (true);
CREATE POLICY "Allow public insert videos" ON videos FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update videos" ON videos FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow public read scenes" ON scenes;
DROP POLICY IF EXISTS "Allow public insert scenes" ON scenes;
DROP POLICY IF EXISTS "Allow public update scenes" ON scenes;
CREATE POLICY "Allow public read scenes" ON scenes FOR SELECT USING (true);
CREATE POLICY "Allow public insert scenes" ON scenes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update scenes" ON scenes FOR UPDATE USING (true);

-- Nota: Recordá crear un bucket público en Supabase Storage llamado 'video-assets'
-- y habilitar las políticas de lectura/escritura pública para dicho bucket:
-- 1. Permitir SELECT a todos los usuarios.
-- 2. Permitir INSERT/UPDATE/DELETE a todos los usuarios (para desarrollo).
