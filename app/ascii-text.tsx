"use client"

import React, {
  useRef,
  useEffect,
  useCallback,
  useLayoutEffect,
  type HTMLAttributes,
} from "react"
import { cn } from "@/lib/utils"

// Constants for wave animation behavior
const WAVE_THRESH = 40 // pixel threshold for wave edge effect
const CHAR_MULT = 2
const ANIM_STEP = 35

interface CharPosition {
  x: number
  y: number
  char: string
}

interface Wave2D {
  x: number // pixel x position
  y: number // pixel y position
  startTime: number
  id: number
}

interface ASCIITextProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  children: string
  /** Animation duration in ms (default: auto-scales with text length) */
  duration?: number
  /** Character set to use for scrambling */
  chars?: string
  /** Whether to preserve spaces during animation */
  preserveSpaces?: boolean
  /** Wave speed - higher = faster wave expansion (default 100) */
  waveSpeed?: number
  /** Wave spread - affects how wide the wave ring is (default 1.0) */
  spread?: number
  /** Render as a different element */
  as?: "p" | "span" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "div" | "label"
}

export function ASCIIText({
  children,
  duration: durationProp,
  chars = '.,·-─~+:;=*π""░▒▓█▄▀▌▐■!?&#$@0123456789*',
  preserveSpaces = true,
  waveSpeed: waveSpeedProp,
  spread = 1.0,
  as: Component = "p",
  className,
  ...props
}: ASCIITextProps) {
  const elRef = useRef<HTMLElement>(null)

  // Mutable refs for animation state (no React re-renders during animation)
  const origTxtRef = useRef(children)
  const origCharsRef = useRef(children.split(""))
  const charPositionsRef = useRef<CharPosition[]>([])
  const isAnimRef = useRef(false)
  const cursorRef = useRef({ x: 0, y: 0 })
  const wavesRef = useRef<Wave2D[]>([])
  const animIdRef = useRef<number | null>(null)
  const isHoverRef = useRef(false)
  const origDimensionsRef = useRef<{ width: number; height: number } | null>(null)
  const measurerRef = useRef<HTMLElement | null>(null)

  // Auto-scale duration based on text length
  const textLength = children.length
  const duration =
    durationProp ?? Math.max(800, Math.min(textLength * 6, 2000))
  const waveSpeed = (waveSpeedProp ?? 100) / 100

  /**
   * Measure character positions using individual span elements
   */
  const measureCharPositions = useCallback(() => {
    const el = elRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    const style = window.getComputedStyle(el)

    // Create or reuse measurer element
    if (!measurerRef.current) {
      measurerRef.current = document.createElement("div")
      measurerRef.current.style.cssText = `
        position: absolute;
        visibility: hidden;
        pointer-events: none;
        white-space: pre-wrap;
        word-wrap: break-word;
      `
      document.body.appendChild(measurerRef.current)
    }

    const measurer = measurerRef.current
    measurer.style.width = `${rect.width}px`
    measurer.style.font = style.font
    measurer.style.letterSpacing = style.letterSpacing
    measurer.style.lineHeight = style.lineHeight
    measurer.style.padding = style.padding

    // Wrap each character in a span
    const chars = origCharsRef.current
    measurer.innerHTML = chars
      .map(
        (char, i) =>
          `<span data-i="${i}" style="display:inline">${char === " " ? "&nbsp;" : char.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>`
      )
      .join("")

    // Measure each character's position
    const measurerRect = measurer.getBoundingClientRect()
    const positions: CharPosition[] = []

    const spans = measurer.querySelectorAll("span")
    spans.forEach((span, i) => {
      const spanRect = span.getBoundingClientRect()
      positions.push({
        x: spanRect.left - measurerRect.left + spanRect.width / 2,
        y: spanRect.top - measurerRect.top + spanRect.height / 2,
        char: chars[i],
      })
    })

    charPositionsRef.current = positions
  }, [])

  /**
   * 2D distance calculation
   */
  const distance2D = (x1: number, y1: number, x2: number, y2: number) => {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
  }

  /**
   * Updates cursor position in 2D pixels
   */
  const updateCursorPos = useCallback((e: React.MouseEvent | MouseEvent) => {
    const el = elRef.current
    if (!el) return

    const rect = el.getBoundingClientRect()
    cursorRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    }
  }, [])

  /**
   * Stops the animation and resets to original text
   */
  const stop = useCallback(() => {
    const el = elRef.current
    if (!el) return

    el.textContent = origTxtRef.current
    el.classList.remove("as")

    // Reset dimensions
    if (origDimensionsRef.current !== null) {
      el.style.width = ""
      el.style.height = ""
      el.style.minHeight = ""
      origDimensionsRef.current = null
    }
    isAnimRef.current = false
  }, [])

  /**
   * Clean up expired waves
   */
  const cleanupWaves = useCallback(
    (t: number) => {
      wavesRef.current = wavesRef.current.filter(
        (w) => t - w.startTime < duration
      )
    },
    [duration]
  )

  /**
   * Calculates wave effect for a character at given 2D position
   */
  const calcWaveEffect = useCallback(
    (
      charPos: CharPosition,
      charIdx: number,
      t: number
    ): { shouldAnim: boolean; char: string } => {
      let shouldAnim = false
      let resultChar = charPos.char

      // Get max possible distance (diagonal of container)
      const el = elRef.current
      if (!el) return { shouldAnim: false, char: resultChar }

      const rect = el.getBoundingClientRect()
      const maxDist = Math.sqrt(rect.width ** 2 + rect.height ** 2) * spread

      for (const w of wavesRef.current) {
        const age = t - w.startTime
        const prog = Math.min((age * waveSpeed) / duration, 1)

        // Calculate 2D distance from wave origin to character
        const dist = distance2D(charPos.x, charPos.y, w.x, w.y)

        // Wave radius expands over time
        const radius = prog * maxDist

        // Wave is a ring, not a filled circle
        const ringWidth = WAVE_THRESH * spread

        if (dist <= radius && dist > radius - ringWidth) {
          shouldAnim = true

          // How far into the ring are we? (0 = inner edge, 1 = outer edge)
          const posInRing = (radius - dist) / ringWidth

          // Characters in the ring zone shift through character sequence
          if (posInRing > 0 && posInRing < 1) {
            const animStep = ANIM_STEP / waveSpeed
            const idx =
              (Math.floor(dist / 10) * CHAR_MULT + Math.floor(age / animStep)) %
              chars.length
            resultChar = chars[idx]
          }
        }
      }

      return { shouldAnim, char: resultChar }
    },
    [duration, waveSpeed, chars, spread]
  )

  /**
   * Generates scrambled text based on current waves using 2D positions
   */
  const genScrambledTxt = useCallback(
    (t: number): string => {
      const positions = charPositionsRef.current
      if (positions.length === 0) return origTxtRef.current

      return positions
        .map((pos, i) => {
          if (preserveSpaces && pos.char === " ") return " "
          const res = calcWaveEffect(pos, i, t)
          return res.shouldAnim ? res.char : pos.char
        })
        .join("")
    },
    [preserveSpaces, calcWaveEffect]
  )

  /**
   * Start the animation loop
   */
  const start = useCallback(() => {
    if (isAnimRef.current) return

    const el = elRef.current
    if (!el) return

    // Measure character positions before starting
    measureCharPositions()

    // Preserve original dimensions to prevent layout shifts
    if (origDimensionsRef.current === null) {
      const rect = el.getBoundingClientRect()
      origDimensionsRef.current = { width: rect.width, height: rect.height }
      el.style.width = `${rect.width}px`
      el.style.minHeight = `${rect.height}px`
    }

    isAnimRef.current = true
    el.classList.add("as")

    const animate = () => {
      const t = Date.now()

      // Clean up expired waves first
      cleanupWaves(t)

      if (wavesRef.current.length === 0) {
        stop()
        return
      }

      // Generate scrambled text and update DOM directly
      if (elRef.current) {
        elRef.current.textContent = genScrambledTxt(t)
      }
      animIdRef.current = requestAnimationFrame(animate)
    }

    animIdRef.current = requestAnimationFrame(animate)
  }, [cleanupWaves, genScrambledTxt, stop, measureCharPositions])

  /**
   * Starts a new wave animation from current cursor position (2D)
   */
  const startWave = useCallback(() => {
    wavesRef.current.push({
      x: cursorRef.current.x,
      y: cursorRef.current.y,
      startTime: Date.now(),
      id: Math.random(),
    })

    if (!isAnimRef.current) start()
  }, [start])

  const handleEnter = useCallback(
    (e: React.MouseEvent) => {
      isHoverRef.current = true
      updateCursorPos(e)
      startWave()
    },
    [updateCursorPos, startWave]
  )

  const handleMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isHoverRef.current) return

      const oldX = cursorRef.current.x
      const oldY = cursorRef.current.y
      updateCursorPos(e)

      // Only create new wave if mouse moved enough (prevents wave spam)
      const moved = distance2D(
        oldX,
        oldY,
        cursorRef.current.x,
        cursorRef.current.y
      )
      if (moved > 15) {
        startWave()
      }
    },
    [updateCursorPos, startWave]
  )

  const handleLeave = useCallback(() => {
    isHoverRef.current = false
  }, [])

  // Update refs when children change
  useEffect(() => {
    origTxtRef.current = children
    origCharsRef.current = children.split("")
    if (!isAnimRef.current && elRef.current) {
      elRef.current.textContent = children
    }
    // Re-measure positions when text changes
    measureCharPositions()
  }, [children, measureCharPositions])

  // Initial measurement
  useLayoutEffect(() => {
    measureCharPositions()

    // Re-measure on resize
    const handleResize = () => measureCharPositions()
    window.addEventListener("resize", handleResize)

    return () => {
      window.removeEventListener("resize", handleResize)
      // Cleanup measurer element
      if (measurerRef.current) {
        document.body.removeChild(measurerRef.current)
        measurerRef.current = null
      }
    }
  }, [measureCharPositions])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animIdRef.current !== null) {
        cancelAnimationFrame(animIdRef.current)
      }
    }
  }, [])

  return (
    <Component
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={elRef as any}
      className={cn("cursor-pointer select-none", className ?? "")}
      onMouseEnter={handleEnter}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      aria-label={children}
      {...props}
    >
      {children}
    </Component>
  )
}