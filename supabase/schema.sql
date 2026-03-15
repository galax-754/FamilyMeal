-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- FamilyMeal — Esquema Supabase
-- Ejecuta esto en el SQL Editor de Supabase
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Extensiones
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────
-- TABLA: families
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS families (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT    NOT NULL,
  invite_code TEXT    UNIQUE DEFAULT substr(encode(gen_random_bytes(4), 'hex'), 1, 8),
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────
-- TABLA: profiles (extiende auth.users)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id   UUID    REFERENCES families(id) ON DELETE SET NULL,
  name        TEXT    NOT NULL,
  avatar_url  TEXT,
  role        TEXT    NOT NULL DEFAULT 'member'
                      CHECK (role IN ('admin', 'member', 'child')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────
-- TABLA: meals
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meals (
  id                 UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id          UUID    NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  name               TEXT    NOT NULL,
  description        TEXT,
  category           TEXT    NOT NULL DEFAULT 'comida'
                             CHECK (category IN ('desayuno', 'comida', 'cena', 'snack')),
  prep_time_minutes  INTEGER,
  -- Columnas de imagen e IA
  image_url          TEXT,
  image_base64       TEXT,
  image_search_query TEXT,
  analyzed_by_ai     BOOLEAN NOT NULL DEFAULT false,
  generated_by_ai    BOOLEAN NOT NULL DEFAULT false,
  ai_description     TEXT,
  created_by         UUID    REFERENCES profiles(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────
-- TABLA: ingredients
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ingredients (
  id        UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id   UUID  NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  name      TEXT  NOT NULL,
  quantity  TEXT,
  unit      TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────
-- TABLA: meal_votes
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS meal_votes (
  id          UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id     UUID     NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  profile_id  UUID     NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote        SMALLINT NOT NULL CHECK (vote IN (-1, 0, 1)),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(meal_id, profile_id)
);

-- ─────────────────────────────────────────
-- TABLA: weekly_menu
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS weekly_menu (
  id           UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    UUID     NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  week_start   DATE     NOT NULL,
  day_of_week  SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Lunes
  meal_type    TEXT     NOT NULL CHECK (meal_type IN ('desayuno', 'comida', 'cena')),
  meal_id      UUID     REFERENCES meals(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE(family_id, week_start, day_of_week, meal_type)
);

-- ─────────────────────────────────────────
-- TABLA: chores
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS chores (
  id           UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    UUID  NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  title        TEXT  NOT NULL,
  assigned_to  UUID  REFERENCES profiles(id) ON DELETE SET NULL,
  due_date     DATE,
  completed    BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_by   UUID  REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- ROW LEVEL SECURITY
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

ALTER TABLE families    ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE meals       ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_votes  ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE chores      ENABLE ROW LEVEL SECURITY;

-- families
CREATE POLICY "Ver familia propia" ON families
  FOR SELECT USING (
    id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
  );
CREATE POLICY "Crear familia" ON families
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Ver por invite_code" ON families
  FOR SELECT USING (true);

-- profiles
CREATE POLICY "Ver propio perfil" ON profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Insertar propio perfil" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Actualizar propio perfil" ON profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Ver miembros de la familia" ON profiles
  FOR SELECT USING (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
  );

-- meals
CREATE POLICY "Ver comidas familiares" ON meals
  FOR SELECT USING (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
  );
CREATE POLICY "Crear comida" ON meals
  FOR INSERT WITH CHECK (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
  );
CREATE POLICY "Editar comida" ON meals
  FOR UPDATE USING (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
  );
CREATE POLICY "Borrar comida" ON meals
  FOR DELETE USING (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
  );

-- ingredients
CREATE POLICY "Ver ingredientes" ON ingredients
  FOR SELECT USING (
    meal_id IN (
      SELECT id FROM meals WHERE family_id IN (
        SELECT family_id FROM profiles WHERE id = auth.uid()
      )
    )
  );
CREATE POLICY "Gestionar ingredientes" ON ingredients
  FOR ALL USING (
    meal_id IN (
      SELECT id FROM meals WHERE family_id IN (
        SELECT family_id FROM profiles WHERE id = auth.uid()
      )
    )
  );

-- meal_votes
CREATE POLICY "Ver votos familiares" ON meal_votes
  FOR SELECT USING (
    meal_id IN (
      SELECT id FROM meals WHERE family_id IN (
        SELECT family_id FROM profiles WHERE id = auth.uid()
      )
    )
  );
CREATE POLICY "Gestionar votos propios" ON meal_votes
  FOR ALL USING (profile_id = auth.uid());

-- weekly_menu
CREATE POLICY "Ver menú familiar" ON weekly_menu
  FOR SELECT USING (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
  );
CREATE POLICY "Gestionar menú familiar" ON weekly_menu
  FOR ALL USING (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
  );

-- chores
CREATE POLICY "Ver tareas familiares" ON chores
  FOR SELECT USING (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
  );
CREATE POLICY "Gestionar tareas familiares" ON chores
  FOR ALL USING (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
  );

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TRIGGER: Crear perfil al registrarse
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- STORAGE BUCKET para imágenes de comidas
-- (ejecutar desde el dashboard de Supabase Storage)
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('meal-images', 'meal-images', true);

-- CREATE POLICY "Subir imagen de comida" ON storage.objects
--   FOR INSERT WITH CHECK (bucket_id = 'meal-images' AND auth.role() = 'authenticated');
-- CREATE POLICY "Ver imagen de comida" ON storage.objects
--   FOR SELECT USING (bucket_id = 'meal-images');

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TABLA: shopping_list
-- Lista de compras generada automáticamente por semana
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS shopping_list (
  id                    UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id             UUID           REFERENCES families(id) ON DELETE CASCADE,
  week_number           INTEGER        NOT NULL,
  year                  INTEGER        NOT NULL,
  items                 JSONB          NOT NULL DEFAULT '[]',
  total_estimated_cost  DECIMAL(10,2)  DEFAULT 0,
  budget_weekly         DECIMAL(10,2)  DEFAULT 0,
  generated_at          TIMESTAMPTZ    DEFAULT now(),
  UNIQUE(family_id, week_number, year)
);

ALTER TABLE shopping_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver lista familiar" ON shopping_list
  FOR SELECT USING (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
  );
CREATE POLICY "Gestionar lista familiar" ON shopping_list
  FOR ALL USING (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
  );

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- MIGRACIÓN: budget_weekly en families
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE families
  ADD COLUMN IF NOT EXISTS budget_weekly DECIMAL(10,2) DEFAULT NULL;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- MIGRACIÓN: Columnas para imágenes Unsplash
-- Ejecuta esto en el SQL Editor de Supabase
-- si la tabla meals ya existe en producción
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALTER TABLE meals
  ADD COLUMN IF NOT EXISTS image_search_query TEXT,
  ADD COLUMN IF NOT EXISTS generated_by_ai    BOOLEAN NOT NULL DEFAULT false;

-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- TABLA: generated_meals_history
-- Historial de recetas generadas por IA por semana
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CREATE TABLE IF NOT EXISTS generated_meals_history (
  id          UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id   UUID  NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  meal_name   TEXT  NOT NULL,
  week_number INTEGER NOT NULL,
  year        INTEGER NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE generated_meals_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver historial familiar" ON generated_meals_history
  FOR SELECT USING (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
  );
CREATE POLICY "Insertar historial familiar" ON generated_meals_history
  FOR INSERT WITH CHECK (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
  );
