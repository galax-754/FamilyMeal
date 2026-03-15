'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, UtensilsCrossed, CalendarDays, CheckSquare, Users } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/inicio',   label: 'Inicio',  Icon: Home },
  { href: '/comidas',  label: 'Comidas', Icon: UtensilsCrossed },
  { href: '/menu',     label: 'Menú',    Icon: CalendarDays },
  { href: '/tareas',   label: 'Tareas',  Icon: CheckSquare },
  { href: '/familia',  label: 'Familia', Icon: Users },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="bottom-nav">
      {NAV_ITEMS.map(({ href, label, Icon }) => {
        const active = pathname === href || pathname.startsWith(href + '/')
        return (
          <Link
            key={href}
            href={href}
            className={`nav-item${active ? ' active' : ''}`}
          >
            <Icon
              style={{ width: 22, height: 22 }}
              strokeWidth={active ? 2.5 : 2}
            />
            <span>{label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
