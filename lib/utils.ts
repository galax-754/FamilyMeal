export function cn(...inputs: (string | undefined | null | false)[]) {
  return inputs.filter(Boolean).join(' ')
}

export const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
export const MEAL_TYPES: Array<{ key: 'desayuno' | 'comida' | 'cena'; label: string; iconKey: 'Sunrise' | 'Sun' | 'Moon' }> = [
  { key: 'desayuno', label: 'Desayuno', iconKey: 'Sunrise' },
  { key: 'comida',   label: 'Comida',   iconKey: 'Sun' },
  { key: 'cena',     label: 'Cena',     iconKey: 'Moon' },
]

export const CATEGORY_LABELS: Record<string, string> = {
  desayuno: 'Desayuno',
  comida: 'Comida',
  cena: 'Cena',
  snack: 'Snack',
}

export const CATEGORY_COLORS: Record<string, string> = {
  desayuno: 'cat-badge cat-desayuno',
  comida:   'cat-badge cat-comida',
  cena:     'cat-badge cat-cena',
  snack:    'cat-badge cat-snack',
}

export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date)
  const day = d.getDay()
  // Ajustar para que la semana empiece el lunes (0=Dom → -6, 1=Lun → 0, ...)
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

export function formatWeekRange(weekStart: Date): string {
  const end = new Date(weekStart)
  end.setDate(end.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
  return `${weekStart.toLocaleDateString('es-MX', opts)} – ${end.toLocaleDateString('es-MX', opts)}`
}

export function toDateString(date: Date): string {
  return date.toISOString().split('T')[0]
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // Remover el prefijo data:image/xxx;base64,
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function formatPrepTime(minutes: number | null): string {
  if (!minutes) return ''
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}
