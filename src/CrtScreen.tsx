import { useEffect, useRef, useState, type ReactNode } from 'react'

const TITLE = '開拓録'
const COPYRIGHT = `© ${new Date().getFullYear()} MikanDev`
const FONT_WAIT_MS = 1500

export function CrtScreen({
  children,
  onMapReveal,
  onBooted,
}: {
  children: ReactNode
  onMapReveal: () => void
  onBooted: () => void
}) {
  const screen = useRef<HTMLDivElement>(null)
  const [fontsReady, setFontsReady] = useState(false)

  // Hold the startup until the title fonts load, so the title never sweeps in using a fallback font.
  useEffect(() => {
    let active = true
    const fonts = Promise.all([
      document.fonts.load('600 1em "Klee One"', TITLE),
      document.fonts.load('1em "DotGothic16"', COPYRIGHT),
    ])
    const timeout = new Promise((resolve) => setTimeout(resolve, FONT_WAIT_MS))
    Promise.race([fonts, timeout]).finally(() => active && setFontsReady(true))
    return () => {
      active = false
    }
  }, [])

  // Boot is over once every CRT animation has finished. With animations disabled there are none,
  // so this resolves at once instead of leaving the page waiting for an event that never fires.
  useEffect(() => {
    let active = true
    const startup = screen.current!
      .getAnimations({ subtree: true })
      .filter((a) => a instanceof CSSAnimation && a.animationName.startsWith('crt-'))
    const done = () => active && onBooted()
    Promise.all(startup.map((a) => a.finished)).then(done, done)
    return () => {
      active = false
    }
  }, [onBooted])

  return (
    <div
      ref={screen}
      className={`relative size-full overflow-hidden rounded-box ${fontsReady ? '' : 'crt-waiting'}`}
      // The title card's own animation is the one that cuts it away to reveal the map.
      onAnimationStart={(e) => (e.target as Element).classList.contains('crt-title') && onMapReveal()}
    >
      {children}
      <TitleCard rows="odd" />
      <TitleCard rows="even" />
      <div aria-hidden className="crt-overlay pointer-events-none absolute inset-0" />
    </div>
  )
}

function TitleCard({ rows }: { rows: 'odd' | 'even' }) {
  return (
    <div aria-hidden className={`crt-title crt-title-${rows} crt-rows-${rows}`}>
      <div className="crt-title-content flex flex-col items-center justify-center gap-4">
        <p className="font-title text-7xl font-semibold text-primary lg:text-8xl">{TITLE}</p>
        <p className="font-dot text-sm text-base-content/70">{COPYRIGHT}</p>
      </div>
    </div>
  )
}
