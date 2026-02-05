"use client"

import React from "react"

import { useRef, useEffect, useCallback, useState, type HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

// Constants for wave animation behavior
const WAVE_THRESH = 6
const CHAR_MULT = 2
const ANIM_STEP = 45
const WAVE_BUF = 10

interface CharPosition {
  x: number
  y: number
  char: string
  index: number
}

interface Wave {
  x: number
  y: number
  startTime: number
  id: number
}

interface ASCIITextProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  children: string
  /** Animation duration in ms (auto-scales with text length if not set) */
  duration?: number
  /** Character set to use for scrambling */
  chars?: string
  /** Whether to preserve spaces during animation */
  preserveSpaces?: boolean
  /** Wave speed - pixels per second (higher = faster ripple) */
  waveSpeed?: number
  /** Wave spread multiplier - controls how far the wave extends (default 1.5) */
  spread?: number
  /** Render as a different element (span, h1, etc) */
  as?: "p" | "span" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "div" | "label"
}

export function ASCIIText({
  children,
  duration: durationProp,
  chars = '.,·-─~+:;=*π""┐┌┘┴┬╗╔╝╚╬╠╣╩╦║░▒▓█▄▀▌▐■!?&#$@0123456789*',
  preserveSpaces = true,
  waveSpeed: waveSpeedProp,
  spread = 1.5,
  as: Component = "p",
  className,
  ...props
}: ASCIITextProps) {
  const containerRef = useRef<HTMLElement>(null)
  const [animatedText, setAnimatedText] = useState<string | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  
  const wavesRef = useRef<Wave[]>([])
  const charPositionsRef = useRef<CharPosition[]>([])
  const isHoverRef = useRef(false)
  const animIdRef = useRef<number | null>(null)
  const cursorRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  
  // Derive displayText: use animated text when animating, otherwise use children directly
  const displayText = isAnimating && animatedText !== null ? animatedText : children
  
  const origChars = children.split("")
  
  // Auto-scale duration based on text length
  const textLength = children.length
  const duration = durationProp ?? Math.max(1500, Math.min(textLength * 12, 3500))
  const waveSpeed = waveSpeedProp ?? 150 // pixels per second

  /**
   * Measure character positions using a hidden span with individual character spans
   */
  const measureCharPositions = useCallback(() => {
    if (!containerRef.current) return
    
    const container = containerRef.current
    const rect = container.getBoundingClientRect()
    const style = window.getComputedStyle(container)
    
    // Create a temporary measuring element that matches the container's styles
    const measurer = document.createElement("span")
    measurer.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre-wrap;
      word-wrap: break-word;
      width: ${rect.width}px;
      font: ${style.font};
      letter-spacing: ${style.letterSpacing};
      line-height: ${style.lineHeight};
      padding: ${style.padding};
    `
    document.body.appendChild(measurer)
    
    const positions: CharPosition[] = []
    
    // Wrap each character in a span to measure its position
    measurer.innerHTML = origChars
      .map((char, i) => `<span data-idx="${i}">${char === " " ? "&nbsp;" : char}</span>`)
      .join("")
    
    const charSpans = measurer.querySelectorAll("span")
    charSpans.forEach((span, i) => {
      const charRect = span.getBoundingClientRect()
      const measurerRect = measurer.getBoundingClientRect()
      positions.push({
        x: charRect.left - measurerRect.left + charRect.width / 2,
        y: charRect.top - measurerRect.top + charRect.height / 2,
        char: origChars[i],
        index: i
      })
    })
    
    document.body.removeChild(measurer)
    charPositionsRef.current = positions
  }, [origChars])

  /**
   * Clean up expired waves
   */
  const cleanupWaves = useCallback((t: number) => {
    wavesRef.current = wavesRef.current.filter((w) => t - w.startTime < duration)
  }, [duration])

  /**
   * Calculate 2D distance between two points
   */
  const distance2D = (x1: number, y1: number, x2: number, y2: number) => {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
  }

  /**
   * Calculates wave effect for a character at given position using 2D distance
   */
  const calcWaveEffect = useCallback((charPos: CharPosition, t: number): { shouldAnim: boolean; char: string } => {
    let shouldAnim = false
    let resultChar = charPos.char

    for (const w of wavesRef.current) {
      const age = t - w.startTime
      const prog = Math.min(age / duration, 1)
      
      // Calculate 2D distance from wave origin to character
      const dist = distance2D(charPos.x, charPos.y, w.x, w.y)
      
      // Wave radius expands over time (in pixels)
      const maxRadius = Math.max(
        containerRef.current?.getBoundingClientRect().width ?? 500,
        containerRef.current?.getBoundingClientRect().height ?? 200
      ) * spread
      
      const rad = prog * (maxRadius + WAVE_BUF * 10) * (waveSpeed / 100)

      if (dist <= rad) {
        shouldAnim = true
        const intens = Math.max(0, rad - dist)
        
        // Characters in the wave zone shift through character sequence
        const threshold = WAVE_THRESH * 10 // Scale threshold for pixel distances
        if (intens <= threshold && intens > 0) {
          const idx = (Math.floor(dist / 8) * CHAR_MULT + Math.floor(age / ANIM_STEP)) % chars.length
          resultChar = chars[idx]
        }
      }
    }

    return { shouldAnim, char: resultChar }
  }, [duration, waveSpeed, chars, spread])

  /**
   * Generates scrambled text based on current waves using 2D positions
   */
  const genScrambledTxt = useCallback((t: number): string => {
    if (charPositionsRef.current.length === 0) return children
    
    return charPositionsRef.current
      .map((pos) => {
        if (preserveSpaces && pos.char === " ") return " "
        const res = calcWaveEffect(pos, t)
        return res.shouldAnim ? res.char : pos.char
      })
      .join("")
  }, [children, preserveSpaces, calcWaveEffect])

  /**
   * Stops the animation and resets to original text
   */
  const stop = useCallback(() => {
    setAnimatedText(null)
    setIsAnimating(false)
  }, [])

  /**
   * Start the animation loop
   */
  const start = useCallback(() => {
    if (animIdRef.current !== null) return
    
    // Measure character positions before starting animation
    measureCharPositions()
    
    setIsAnimating(true)

    const animate = () => {
      const t = Date.now()
      cleanupWaves(t)

      if (wavesRef.current.length === 0) {
        animIdRef.current = null
        stop()
        return
      }

      setAnimatedText(genScrambledTxt(t))
      animIdRef.current = requestAnimationFrame(animate)
    }

    animIdRef.current = requestAnimationFrame(animate)
  }, [cleanupWaves, genScrambledTxt, stop, measureCharPositions])

  /**
   * Updates cursor position based on mouse move (now tracks actual pixel position)
   */
  const updateCursorPos = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return
    
    const rect = containerRef.current.getBoundingClientRect()
    cursorRef.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    }
  }, [])

  /**
   * Starts a new wave animation from current cursor position
   */
  const startWave = useCallback(() => {
    wavesRef.current.push({
      x: cursorRef.current.x,
      y: cursorRef.current.y,
      startTime: Date.now(),
      id: Math.random()
    })
    
    if (animIdRef.current === null) {
      start()
    }
  }, [start])

  const handleEnter = useCallback((e: React.MouseEvent) => {
    isHoverRef.current = true
    updateCursorPos(e)
    startWave()
  }, [updateCursorPos, startWave])

  const handleMove = useCallback((e: React.MouseEvent) => {
    if (!isHoverRef.current) return
    
    const oldX = cursorRef.current.x
    const oldY = cursorRef.current.y
    updateCursorPos(e)
    
    // Start new wave if cursor moved significantly
    const moved = distance2D(oldX, oldY, cursorRef.current.x, cursorRef.current.y)
    if (moved > 8) {
      startWave()
    }
  }, [updateCursorPos, startWave])

  const handleLeave = useCallback(() => {
    isHoverRef.current = false
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animIdRef.current !== null) {
        cancelAnimationFrame(animIdRef.current)
      }
    }
  }, [])


  // Re-measure on resize
  useEffect(() => {
    const handleResize = () => {
      if (isAnimating) {
        measureCharPositions()
      }
    }
    
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [isAnimating, measureCharPositions])

  return (
    <Component
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={containerRef as any}
      className={cn("cursor-pointer select-none", className ?? "")}
      onMouseEnter={handleEnter}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      aria-label={children}
      {...props}
    >
      {displayText}
    </Component>
  )
}