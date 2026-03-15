-- =============================================
-- FamilyMeal — Seed de recetas saludables
-- aptas para diabéticos con precios HEB reales
-- Monterrey/Santiago NL, marzo 2026
-- =============================================
--
-- INSTRUCCIONES:
--   1. Ejecuta primero la migración 001_swipe_and_budget.sql
--   2. Reemplaza el UUID en @family_id con el ID real de tu familia
--      Puedes obtenerlo con: SELECT id FROM families LIMIT 1;
--   3. Ejecuta este script en el SQL Editor de Supabase
-- =============================================

-- Reemplaza este UUID con el ID de tu familia:
DO $$
DECLARE
  v_family_id UUID := '00000000-0000-0000-0000-000000000001';
BEGIN

INSERT INTO meals (
  family_id,
  name,
  description,
  category,
  meal_emoji,
  estimated_cost,
  prep_time_minutes,
  is_diabetic_friendly,
  is_healthy,
  tags,
  analyzed_by_ai
) VALUES

-- 1. Caldo Tlalpeño
(
  v_family_id,
  'Caldo Tlalpeño',
  'Caldo sustancioso de pollo con garbanzos, chile chipotle y epazote. Rico en proteína y fibra, bajo en carbohidratos simples.',
  'comida',
  '🍲',
  148.00,
  40,
  true,
  true,
  '["diabético friendly","alta proteína","sin gluten","mexicano","sopa"]',
  false
),

-- 2. Pollo a las Hierbas al Horno
(
  v_family_id,
  'Pollo a las Hierbas al Horno',
  'Pechuga de pollo marinada con ajo, limón, orégano y aceite de oliva, horneada con brócoli y zanahoria. Sin carbohidratos simples.',
  'comida',
  '🍗',
  185.00,
  45,
  true,
  true,
  '["diabético friendly","alta proteína","sin gluten","horneado","bajo en carbohidratos"]',
  false
),

-- 3. Ensalada de Atún con Aguacate
(
  v_family_id,
  'Ensalada de Atún con Aguacate',
  'Atún en agua con lechuga romana, jitomate, aguacate y limón. Alto en proteína y grasas saludables. Listo en 10 minutos.',
  'comida',
  '🥗',
  118.00,
  10,
  true,
  true,
  '["diabético friendly","sin cocción","rápido","alta proteína","omega-3"]',
  false
),

-- 4. Sopa de Lentejas con Espinaca
(
  v_family_id,
  'Sopa de Lentejas con Espinaca',
  'Sopa nutritiva de lentejas con espinaca baby, zanahoria y jitomate. Alta en fibra, hierro y proteína vegetal. Excelente para diabéticos.',
  'comida',
  '🥣',
  112.00,
  35,
  true,
  true,
  '["diabético friendly","vegetariano","alta fibra","hierro","económico"]',
  false
),

-- 5. Nopales con Huevo a la Mexicana
(
  v_family_id,
  'Nopales con Huevo a la Mexicana',
  'Platillo tradicional con nopal limpio salteado con huevo, jitomate y cebolla. El nopal reduce el azúcar en sangre — ideal para diabéticos.',
  'desayuno',
  '🌵',
  88.00,
  20,
  true,
  true,
  '["diabético friendly","desayuno","nopal","bajo glucémico","mexicano","económico"]',
  false
),

-- 6. Pollo al Limón con Champiñones
(
  v_family_id,
  'Pollo al Limón con Champiñones',
  'Pechuga salteada con champiñones frescos, ajo y limón en aceite de oliva. Bajo en calorías, alto en proteína y vitamina D.',
  'cena',
  '🍄',
  175.00,
  25,
  true,
  true,
  '["diabético friendly","cena ligera","sin carbohidratos","vitamina D","rápido"]',
  false
),

-- 7. Tacos de Frijoles con Nopal
(
  v_family_id,
  'Tacos de Frijoles con Nopal',
  'Tortillas de maíz con frijoles negros guisados y nopal asado. Combinación alta en fibra que ayuda a controlar el azúcar en sangre.',
  'comida',
  '🌮',
  95.00,
  30,
  true,
  true,
  '["diabético friendly","vegetariano","alta fibra","mexicano","económico"]',
  false
),

-- 8. Avena Integral con Canela
(
  v_family_id,
  'Avena Integral con Canela',
  'Avena cocida con canela, sin azúcar añadida. La canela ayuda a sensibilizar la insulina. Puedes agregarle fruta fresca de temporada.',
  'desayuno',
  '🥣',
  52.00,
  10,
  true,
  true,
  '["diabético friendly","desayuno","sin azúcar","canela","rápido","económico"]',
  false
),

-- 9. Chile Relleno de Atún al Horno
(
  v_family_id,
  'Chile Relleno de Atún al Horno',
  'Chile poblano relleno de atún con jitomate y cebolla, horneado sin aceite ni capeado. Versión saludable del clásico mexicano.',
  'cena',
  '🫑',
  132.00,
  35,
  true,
  true,
  '["diabético friendly","cena","sin gluten","horneado","mexicano","sin carbohidratos"]',
  false
),

-- 10. Ensalada Tibia de Pollo con Espinaca
(
  v_family_id,
  'Ensalada Tibia de Pollo con Espinaca',
  'Espinaca baby con pechuga de pollo grillada, zanahoria rallada, queso panela y aderezo de limón y aceite de oliva.',
  'cena',
  '🥗',
  162.00,
  20,
  true,
  true,
  '["diabético friendly","cena ligera","alta proteína","hierro","ensalada"]',
  false
);

END $$;
