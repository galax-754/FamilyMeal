-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- MIGRACIÓN 001 — Presupuesto y Sistema de Match
-- Ejecuta esto en el SQL Editor de Supabase
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- ─────────────────────────────────────────
-- families: columna de presupuesto semanal
-- ─────────────────────────────────────────
ALTER TABLE families
  ADD COLUMN IF NOT EXISTS budget_weekly NUMERIC(10,2);

-- ─────────────────────────────────────────
-- meals: nuevas columnas
-- ─────────────────────────────────────────
ALTER TABLE meals
  ADD COLUMN IF NOT EXISTS meal_emoji           TEXT    DEFAULT '🍽️',
  ADD COLUMN IF NOT EXISTS estimated_cost       NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS is_diabetic_friendly BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_healthy           BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS tags                 JSONB   DEFAULT '[]';

-- ─────────────────────────────────────────
-- swipe_votes: votos del sistema de match
-- Separado de meal_votes (votos -1/0/1 tradicionales)
-- ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS swipe_votes (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id     UUID    NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  profile_id  UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  family_id   UUID    NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  vote        BOOLEAN NOT NULL,
  week_number INTEGER NOT NULL,
  year        INTEGER NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(meal_id, profile_id, week_number, year)
);

ALTER TABLE swipe_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver swipe votos familiares" ON swipe_votes
  FOR SELECT USING (
    family_id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Gestionar swipe votos propios" ON swipe_votes
  FOR ALL USING (profile_id = auth.uid());

-- ─────────────────────────────────────────
-- Política para UPDATE en families (presupuesto)
-- ─────────────────────────────────────────
CREATE POLICY IF NOT EXISTS "Actualizar presupuesto familiar" ON families
  FOR UPDATE USING (
    id IN (SELECT family_id FROM profiles WHERE id = auth.uid())
  );
