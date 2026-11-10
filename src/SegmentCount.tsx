const DIGITS = 2
// DSEG glyphs: "!" is a blank one digit wide, "~" lights every segment.
const BLANK = '!'
const ALL_SEGMENTS = '~'

/** `value` undefined shows an unlit display. */
export function SegmentCount({ value, className = '' }: { value: number | undefined; className?: string }) {
  return (
    <span aria-hidden className={`relative inline-block font-segment font-bold ${className}`}>
      <span className="text-base-content/10">{ALL_SEGMENTS.repeat(DIGITS)}</span>
      <span className="absolute inset-0 text-primary">{value === undefined ? BLANK.repeat(DIGITS) : String(value).padStart(DIGITS, BLANK)}</span>
    </span>
  )
}
