export function initReveal() {
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('visible'), i * 70)
        obs.unobserve(e.target)
      }
    })
  }, { threshold: 0.08 })
  document.querySelectorAll('.reveal').forEach(el => obs.observe(el))
  return () => obs.disconnect()
}

export function init3DHover() {
  const cards = document.querySelectorAll('.card-interactive')
  const handlers: Array<() => void> = []

  cards.forEach(card => {
    const el = card as HTMLElement
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect()
      const x = ((e.clientX - r.left) / r.width - 0.5) * 10
      const y = ((e.clientY - r.top) / r.height - 0.5) * 10
      el.style.transform = `perspective(700px) rotateY(${x}deg) rotateX(${-y}deg) scale(1.02)`
    }
    const onLeave = () => {
      el.style.transform = 'perspective(700px) rotateY(0deg) rotateX(0deg) scale(1)'
    }
    el.addEventListener('mousemove', onMove)
    el.addEventListener('mouseleave', onLeave)
    handlers.push(() => {
      el.removeEventListener('mousemove', onMove)
      el.removeEventListener('mouseleave', onLeave)
    })
  })
  return () => handlers.forEach(h => h())
}
