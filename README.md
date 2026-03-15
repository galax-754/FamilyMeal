# 🍽️ FamilyMeal

Planeador de comidas familiar con votaciones, menú semanal, análisis por IA y gestión de tareas.

---

## Funcionalidades

| Sección | Descripción |
|---------|-------------|
| 🏠 Inicio | Dashboard con menú de hoy, tareas pendientes y top comidas |
| 🍽️ Comidas | Lista, votación, búsqueda y filtrado por categoría |
| 📷 Nueva comida | Foto + análisis automático con Claude IA |
| 📅 Menú semanal | Grid lunes-domingo, asignar o sortear al azar |
| ✅ Tareas | Gestión de tareas del hogar por persona y fecha |
| 👨‍👩‍👧 Familia | Código de invitación, miembros y sugerencias con Groq |

---

## Stack técnico

- **Next.js 14** (App Router)
- **TypeScript + Tailwind CSS**
- **Supabase** (Auth + PostgreSQL + Storage)
- **Claude API** (análisis de imágenes de comida)
- **Groq API** (sugerencias de platillos con Llama 3)
- Deploy en **Vercel**

---

## Configuración local

### 1. Clona el repo

```bash
git clone https://github.com/TU_USUARIO/familymeal.git
cd familymeal
npm install
```

### 2. Configura las claves

Copia el archivo de ejemplo:

```bash
cp config.example.js config.js
```

Abre `config.js` y llena tus claves:

```js
export const SUPABASE_URL   = 'https://TU_PROJECT.supabase.co'
export const SUPABASE_ANON  = 'eyJ...'
export const CLAUDE_API_KEY = 'sk-ant-...'
export const GROQ_API_KEY   = 'gsk_...'
```

> ⚠️ `config.js` está en `.gitignore`. **NUNCA** lo subas a GitHub.

### 3. Configura Supabase

1. Crea un proyecto en [supabase.com](https://supabase.com)
2. Ve a **SQL Editor** y ejecuta `supabase/schema.sql`
3. Ve a **Storage** → crea un bucket llamado `meal-images` (público)
4. En Storage Policies, agrega:
   - SELECT: public
   - INSERT: authenticated

### 4. Levanta el servidor de desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000)

---

## Deploy en Vercel

1. Sube el código a GitHub (sin `config.js`)
2. Importa el repo en [vercel.com](https://vercel.com)
3. En **Environment Variables** agrega:

| Variable | Valor |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | tu URL de Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON` | tu clave anon de Supabase |
| `CLAUDE_API_KEY` | tu clave de Anthropic |
| `GROQ_API_KEY` | tu clave de Groq |

4. Haz click en **Deploy** ✅

---

## Estructura del proyecto

```
/
├── app/
│   ├── (auth)/login/         ← Login
│   ├── (auth)/registrar/     ← Registro
│   ├── (app)/inicio/         ← Dashboard
│   ├── (app)/comidas/        ← Lista + detalle
│   ├── (app)/comidas/nueva/  ← Nueva comida + IA
│   ├── (app)/menu/           ← Menú semanal
│   ├── (app)/tareas/         ← Tareas del hogar
│   ├── (app)/familia/        ← Familia + sugerencias
│   └── api/                  ← Claude & Groq endpoints
├── components/
│   ├── ui/                   ← Button, Modal, Toast, Skeleton...
│   ├── layout/               ← BottomNav, PageHeader
│   ├── meals/                ← MealCard, MealForm, ImageUpload
│   ├── menu/                 ← WeeklyGrid
│   ├── chores/               ← ChoreItem
│   └── family/               ← FamilySetup
├── lib/
│   ├── supabase/             ← Cliente SSR y browser
│   ├── claude.ts             ← Análisis de imagen
│   ├── groq.ts               ← Sugerencias de comida
│   └── utils.ts              ← Helpers
├── types/index.ts            ← Tipos TypeScript
├── supabase/schema.sql       ← Esquema completo con RLS
├── config.js                 ← 🔒 GITIGNORED — tus claves
└── config.example.js         ← Plantilla de configuración
```

---

## Reglas UX aplicadas

- ✅ Botones mínimo 52px de alto
- ✅ Texto mínimo 14px
- ✅ Íconos nav 22px, acción 24px
- ✅ Mensajes de error en español claro
- ✅ Confirmación antes de sortear de nuevo
- ✅ Skeleton + mensaje amigable en todos los cargamentos
- ✅ Overlay oscuro sobre imágenes con texto
