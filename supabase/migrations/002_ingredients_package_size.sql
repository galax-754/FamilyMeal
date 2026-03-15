-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
-- MIGRACIÓN 002 — Tamaño de presentación en ingredientes
-- Permite calcular cuántos paquetes comprar según cantidad necesaria
-- ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

-- Agregar columna package_size al catálogo de ingredientes
-- 1 = precio por unidad/pieza individual (default)
ALTER TABLE ingredients
  ADD COLUMN IF NOT EXISTS package_size numeric DEFAULT 1;

-- ─────────────────────────────────────────
-- Actualizar presentaciones conocidas de HEB
-- ─────────────────────────────────────────

-- Huevo
UPDATE ingredients SET package_size = 12
  WHERE name ILIKE '%huevo%12%';

UPDATE ingredients SET package_size = 18
  WHERE name ILIKE '%huevo%18%';

UPDATE ingredients SET package_size = 30
  WHERE name ILIKE '%huevo%30%';

-- Granos vendidos por kilo (1 kg = 1000 g)
UPDATE ingredients SET package_size = 1000
  WHERE unit = 'kg';

-- Arroz, frijol, azúcar, harina (bolsas de 1 kg)
UPDATE ingredients SET package_size = 1000
  WHERE unit IN ('g', 'gr', 'gramos')
    AND name ILIKE ANY (ARRAY[
      '%arroz%', '%frijol%', '%lenteja%',
      '%azúcar%', '%azucar%', '%harina%',
      '%avena%', '%sal%'
    ]);

-- Leche (litros)
UPDATE ingredients SET package_size = 1000
  WHERE unit IN ('ml', 'l', 'litro', 'litros')
    AND name ILIKE '%leche%';

-- Aceite (botella 946 ml estándar HEB)
UPDATE ingredients SET package_size = 946
  WHERE unit IN ('ml', 'l', 'litro')
    AND name ILIKE '%aceite%';

-- Tortillas (paquete de 30 pzas aprox.)
UPDATE ingredients SET package_size = 30
  WHERE name ILIKE '%tortilla%maíz%'
     OR name ILIKE '%tortilla%maiz%';

UPDATE ingredients SET package_size = 8
  WHERE name ILIKE '%tortilla%harina%';
