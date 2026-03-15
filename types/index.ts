export interface Family {
  id: string
  name: string
  invite_code: string
  budget_weekly: number | null
  created_at: string
}

export interface Profile {
  id: string
  family_id: string | null
  name: string
  avatar_url: string | null
  role: 'admin' | 'member' | 'child'
  created_at: string
  updated_at: string
}

export type MealCategory = 'desayuno' | 'comida' | 'cena' | 'snack'
export type MealType = 'desayuno' | 'comida' | 'cena'

export interface Meal {
  id: string
  family_id: string
  name: string
  description: string | null
  category: MealCategory
  prep_time_minutes: number | null
  estimated_cost: number | null
  meal_emoji: string | null
  is_diabetic_friendly: boolean
  is_healthy: boolean
  tags: string[] | null
  image_url: string | null
  image_base64: string | null
  analyzed_by_ai: boolean
  ai_description: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  difficulty?: string | null
  chef_tip?: string | null
  // Joined / JSONB
  vote_score?: number
  my_vote?: -1 | 0 | 1 | null
  ingredients?: Ingredient[]
  instructions?: MealInstruction[]
}

export interface SwipeVote {
  id: string
  meal_id: string
  profile_id: string
  family_id: string
  vote: number
  week_number: number
  year: number
  created_at: string
}

export interface Ingredient {
  id?: string
  meal_id?: string
  name: string
  quantity: string | number | null
  unit: string | null
  estimated_price_mxn?: number
  created_at?: string
}

export interface MealInstruction {
  step: number
  title: string
  text: string
}

export interface MealVote {
  id: string
  meal_id: string
  profile_id: string
  vote: -1 | 0 | 1
  created_at: string
  updated_at: string
}

export interface WeeklyMenu {
  id: string
  family_id: string
  week_start: string
  day_of_week: number
  meal_type: MealType
  meal_id: string | null
  created_at: string
  // Joined
  meal?: Meal | null
}

export interface Chore {
  id: string
  family_id: string
  title: string
  assigned_to: string | null
  due_date: string | null
  completed: boolean
  completed_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Joined
  assignee?: Profile | null
}

export interface WeeklyMenuSlot {
  day_of_week: number
  meal_type: MealType
  entry: WeeklyMenu | null
}
