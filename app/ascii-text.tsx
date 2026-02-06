"use client"

import React, {
  useRef,
  useEffect,
  useCallback,
  useState,
  type HTMLAttributes,
  type CSSProperties,
} from "react"
import { cn } from "@/lib/utils"

// Constants for wave animation behavior
const WAVE_THRESH = 50
const CHAR_MULT = 2
const ANIM_STEP = 35

interface Wave {
  x: number
  startTime: number
  id: number
}

// ============================================================================
// ASCIILine - Core component for single-line text animation
// ============================================================================

interface ASCIILineProps {
  children: string
  duration?: number
  chars?: string
  preserveSpaces?: boolean
  waveSpeed?: number
  spread?: number
  className?: string
  style?: CSSProperties
  /** Callback to propagate wave to adjacent lines */
  onWaveExit?: (direction: "up" | "down", x: number) => void
  /** Receive wave from adjacent line */
  incomingWave?: { x: number; from: "up" | "down" } | null
}

function ASCIILine({
  children,
  duration: durationProp,
  chars = '.,·-─~+:;=*π""░▒▓█▄▀▌▐■!?&#$@0123456789*',
  preserveSpaces = true,
  waveSpeed: waveSpeedProp,
  spread = 1.0,
  className,
  style,
  onWaveExit,
  incomingWave,
}: ASCIILineProps) {
  const containerRef = useRef<HTMLSpanElement>(null)
  const innerRef = useRef<HTMLSpanElement>(null)

  // Animation state refs
  const origTxtRef = useRef(children)
  const wavesRef = useRef<Wave[]>([])
  const cursorRef = useRef({ x: 0 })
  const isHoverRef = useRef(false)
  const isAnimRef = useRef(false)
  const animIdRef = useRef<number | null>(null)
  const charWidthRef = useRef(0)

  const textLength = children.length
  const duration = durationProp ?? Math.max(800, Math.min(textLength * 8, 2000))
  const waveSpeed = (waveSpeedProp ?? 100) / 100

  // Measure average character width
  const measureCharWidth = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const rect = container.getBoundingClientRect()
    charWidthRef.current = rect.width / Math.max(textLength, 1)
  }, [textLength])

  // Calculate wave effect for a character at position x
  const calcWaveEffect = useCallback(
    (charX: number, t: number): { active: boolean; char: string; originalChar: string } => {
      const container = containerRef.current
      if (!container) return { active: false, char: "", originalChar: "" }

      const rect = container.getBoundingClientRect()
      const maxDist = rect.width * spread

      for (const wave of wavesRef.current) {
        const age = t - wave.startTime
        const prog = Math.min((age * waveSpeed) / duration, 1)
        const dist = Math.abs(charX - wave.x)
        const radius = prog * maxDist
        const ringWidth = WAVE_THRESH * spread

        // Check if char falls within the wave ring
        if (dist <= radius && dist > radius - ringWidth) {
          const posInRing = (radius - dist) / ringWidth
          if (posInRing > 0 && posInRing < 1) {
            const animStep = ANIM_STEP / waveSpeed
            const idx = (Math.floor(dist / 10) * CHAR_MULT + Math.floor(age / animStep)) % chars.length
            return { active: true, char: chars[idx], originalChar: "" }
          }
        }
      }

      return { active: false, char: "", originalChar: "" }
    },
    [duration, waveSpeed, spread, chars]
  )

  // Generate scrambled text
  const genScrambledTxt = useCallback(
    (t: number): string => {
      const txt = origTxtRef.current
      const charW = charWidthRef.current || 10

      return txt
        .split("")
        .map((char, i) => {
          if (preserveSpaces && char === " ") return " "
          const charX = i * charW + charW / 2
          const result = calcWaveEffect(charX, t)
          return result.active ? result.char : char
        })
        .join("")
    },
    [preserveSpaces, calcWaveEffect]
  )

  // Cleanup expired waves
  const cleanupWaves = useCallback(
    (t: number) => {
      const container = containerRef.current
      if (!container) return

      const rect = container.getBoundingClientRect()
      const maxDist = rect.width * spread

      wavesRef.current = wavesRef.current.filter((w) => {
        const age = t - w.startTime
        const prog = Math.min((age * waveSpeed) / duration, 1)
        const radius = prog * maxDist

        // Check if wave should propagate to adjacent lines
        if (onWaveExit && prog < 1) {
          // Wave exits on the right
          if (radius > rect.width && w.x < rect.width) {
            // Could propagate down
          }
        }

        return t - w.startTime < duration
      })
    },
    [duration, waveSpeed, spread, onWaveExit]
  )

  // Stop animation
  const stop = useCallback(() => {
    if (innerRef.current) {
      innerRef.current.textContent = origTxtRef.current
    }
    isAnimRef.current = false
  }, [])

  // Animation function ref (to avoid self-reference issues)
  const animateFnRef = useRef<() => void>(() => {})

  // Animation loop - defined separately and stored in ref
  useEffect(() => {
    animateFnRef.current = () => {
      const t = Date.now()
      cleanupWaves(t)

      if (wavesRef.current.length === 0) {
        stop()
        return
      }

      if (innerRef.current) {
        innerRef.current.textContent = genScrambledTxt(t)
      }

      animIdRef.current = requestAnimationFrame(animateFnRef.current)
    }
  }, [cleanupWaves, genScrambledTxt, stop])

  // Start animation
  const start = useCallback(() => {
    if (isAnimRef.current) return
    measureCharWidth()
    isAnimRef.current = true
    animIdRef.current = requestAnimationFrame(animateFnRef.current)
  }, [measureCharWidth])

  // Create wave at position
  const createWave = useCallback(
    (x: number) => {
      wavesRef.current.push({
        x,
        startTime: Date.now(),
        id: Math.random(),
      })
      if (!isAnimRef.current) start()
    },
    [start]
  )

  // Update cursor
  const updateCursor = useCallback((e: React.MouseEvent | MouseEvent) => {
    const container = containerRef.current
    if (!container) return
    const rect = container.getBoundingClientRect()
    cursorRef.current.x = e.clientX - rect.left
  }, [])

  // Event handlers
  const handleEnter = useCallback(
    (e: React.MouseEvent) => {
      isHoverRef.current = true
      updateCursor(e)
      createWave(cursorRef.current.x)
    },
    [updateCursor, createWave]
  )

  const handleMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isHoverRef.current) return
      const oldX = cursorRef.current.x
      updateCursor(e)
      if (Math.abs(cursorRef.current.x - oldX) > 15) {
        createWave(cursorRef.current.x)
      }
    },
    [updateCursor, createWave]
  )

  const handleLeave = useCallback(() => {
    isHoverRef.current = false
  }, [])

  // Handle incoming waves from adjacent lines
  useEffect(() => {
    if (incomingWave) {
      createWave(incomingWave.x)
    }
  }, [incomingWave, createWave])

  // Update refs when children change
  useEffect(() => {
    origTxtRef.current = children
    if (!isAnimRef.current && innerRef.current) {
      innerRef.current.textContent = children
    }
  }, [children])

  // Measure on mount
  useEffect(() => {
    measureCharWidth()
    const handleResize = () => measureCharWidth()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [measureCharWidth])

  // Cleanup
  useEffect(() => {
    return () => {
      if (animIdRef.current) {
        cancelAnimationFrame(animIdRef.current)
      }
    }
  }, [])

  return (
    <span
      ref={containerRef}
      className={cn("cursor-pointer select-none", className ?? "")}
      style={{ 
        display: "block",
        // Use monospace to ensure all chars (including ASCII blocks) have equal width
        fontFamily: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace",
        // Add padding to account for taller ASCII block chars (█▀▄░▒▓■)
        padding: "0.5em",
        // Ensure consistent line-height that accommodates block chars
        lineHeight: 1.3,
        ...style 
      }}
      onMouseEnter={handleEnter}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      <span ref={innerRef}>{children}</span>
    </span>
  )
}

// ============================================================================
// ASCIIText - Smart wrapper that splits text into lines
// ============================================================================

interface ASCIITextProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  children: string
  duration?: number
  chars?: string
  preserveSpaces?: boolean
  waveSpeed?: number
  spread?: number
  as?: "p" | "span" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "div" | "label"
}

export function ASCIIText({
  children,
  duration,
  chars,
  preserveSpaces,
  waveSpeed,
  spread,
  as: Component = "p",
  className,
  ...props
}: ASCIITextProps) {
  const containerRef = useRef<HTMLElement>(null)
  const [lines, setLines] = useState<string[]>([children])
  const [isReady, setIsReady] = useState(false)
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null)

  // Split text into visual lines based on container width
  const detectLines = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    if (containerRect.width === 0) return

    // Capture current height before changing anything
    const currentHeight = containerRect.height
    setMeasuredHeight(currentHeight)

    // Get computed styles
    const style = window.getComputedStyle(container)

    // Create a hidden measurer on document.body (avoids nesting issues)
    const measurer = document.createElement("div")
    measurer.style.cssText = `
      position: absolute;
      visibility: hidden;
      pointer-events: none;
      white-space: pre-wrap;
      word-wrap: break-word;
      width: ${containerRect.width}px;
      font: ${style.font};
      letter-spacing: ${style.letterSpacing};
      line-height: ${style.lineHeight};
      padding: ${style.padding};
    `
    document.body.appendChild(measurer)

    // Wrap each word in a span to detect line breaks
    const words = children.split(/(\s+)/)
    measurer.innerHTML = words
      .map((word, i) => `<span data-i="${i}">${word.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</span>`)
      .join("")

    // Group words by their Y position
    const wordSpans = measurer.querySelectorAll("span")
    const lineGroups: Map<number, string[]> = new Map()

    wordSpans.forEach((span) => {
      const rect = span.getBoundingClientRect()
      const y = Math.round(rect.top)

      if (!lineGroups.has(y)) {
        lineGroups.set(y, [])
      }
      lineGroups.get(y)!.push(span.textContent || "")
    })

    // Cleanup
    document.body.removeChild(measurer)

    // Sort by Y position and join words
    const sortedLines = Array.from(lineGroups.entries())
      .sort(([a], [b]) => a - b)
      .map(([, words]) => words.join("").trim())
      .filter((line) => line.length > 0)

    // If no lines detected, use original text
    if (sortedLines.length === 0) {
      setLines([children])
    } else {
      setLines(sortedLines)
    }

    // Use RAF to release height lock after render
    requestAnimationFrame(() => {
      setIsReady(true)
      // Release height lock after another frame to ensure smooth transition
      requestAnimationFrame(() => {
        setMeasuredHeight(null)
      })
    })
  }, [children])

  // Detect lines on mount and resize
  useEffect(() => {
    // Use RAF to ensure layout is complete
    const rafId = requestAnimationFrame(() => {
      detectLines()
    })

    const handleResize = () => {
      setIsReady(false)
      setMeasuredHeight(null)
      requestAnimationFrame(detectLines)
    }

    window.addEventListener("resize", handleResize)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener("resize", handleResize)
    }
  }, [detectLines])

  // Container style to prevent layout shift
  const containerStyle: CSSProperties = measuredHeight !== null 
    ? { minHeight: measuredHeight, height: measuredHeight }
    : {}

  return (
    <Component
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={containerRef as any}
      className={cn(className ?? "")}
      aria-label={children}
      style={containerStyle}
      {...props}
    >
      {/* Always render lines - start with single line containing full text */}
      {lines.map((line, i) => (
        <ASCIILine
          key={isReady ? `ready-${i}-${line.slice(0, 20)}` : `init-${i}`}
          duration={duration}
          chars={chars}
          preserveSpaces={preserveSpaces}
          waveSpeed={waveSpeed}
          spread={spread}
        >
          {line}
        </ASCIILine>
      ))}
    </Component>
  )
}