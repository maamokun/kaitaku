import { animate, useMotionValue, useMotionValueEvent, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'

/** Animates from 0 to `target`; `count` is the raw value for smooth visuals, `shown` its rounded value. */
export function useCountUp(target: number | undefined) {
  const count = useMotionValue(0)
  const [shown, setShown] = useState(0)
  const reduceMotion = useReducedMotion()

  useMotionValueEvent(count, 'change', (v) => setShown(Math.round(v)))

  useEffect(() => {
    if (target === undefined) return
    if (reduceMotion) {
      count.set(target)
      return
    }
    const controls = animate(count, target, { duration: 1.5, ease: [0.23, 1, 0.32, 1] })
    return () => controls.stop()
  }, [count, target, reduceMotion])

  return { count, shown }
}
