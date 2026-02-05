"use client"

import React, { useRef, useEffect, useCallback, type HTMLAttributes } from "react"
import { cn } from "@/lib/utils"

// Constants for wave animation behavior
const WAVE_THRESH = 3
const CHAR_MULT = 3
const ANIM_STEP = 40
const WAVE_BUF = 5

interface Wave {
  startPos: number
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
  /** Wave speed - affects animation timing (not currently used, reserved for future) */
  waveSpeed?: number
  /** Wave spread - lower = tighter wave, higher = wider (default 0.3) */
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
  spread = 0.3,
  as: Component = "p",
  className,
  ...props
}: ASCIITextProps) {
  const elRef = useRef<HTMLElement>(null)
  
  // Mutable refs for animation state (no React re-renders during animation)
  const origTxtRef = useRef(children)
  const origCharsRef = useRef(children.split(""))
  const isAnimRef = useRef(false)
  const cursorPosRef = useRef(0)
  const wavesRef = useRef<Wave[]>([])
  const animIdRef = useRef<number | null>(null)
  const isHoverRef = useRef(false)
  const origWidthRef = useRef<number | null>(null)
  
  // Auto-scale duration based on text length
  const textLength = children.length
  const duration = durationProp ?? Math.max(600, Math.min(textLength * 8, 1500))

  /**
   * Updates cursor position based on mouse X relative to element width
   */
  const updateCursorPos = useCallback((e: React.MouseEvent | MouseEvent) => {
    const el = elRef.current
    if (!el) return
    
    const rect = el.getBoundingClientRect()
    const x = e.clientX - rect.left
    const len = origTxtRef.current.length
    const pos = Math.round((x / rect.width) * len)
    cursorPosRef.current = Math.max(0, Math.min(pos, len - 1))
  }, [])

  /**
   * Stops the animation and resets to original text
   */
  const stop = useCallback(() => {
    const el = elRef.current
    if (!el) return
    
    el.textContent = origTxtRef.current
    el.classList.remove("as")
    
    // Reset width to allow natural text flow
    if (origWidthRef.current !== null) {
      el.style.width = ""
      origWidthRef.current = null
    }
    isAnimRef.current = false
  }, [])

  /**
   * Clean up expired waves that have exceeded their duration
   */
  const cleanupWaves = useCallback((t: number) => {
    wavesRef.current = wavesRef.current.filter((w) => t - w.startTime < duration)
  }, [duration])

  /**
   * Calculates wave effect for a character at given index
   */
  const calcWaveEffect = useCallback((charIdx: number, t: number): { shouldAnim: boolean; char: string } => {
    let shouldAnim = false
    let resultChar = origCharsRef.current[charIdx]

    for (const w of wavesRef.current) {
      const age = t - w.startTime
      const prog = Math.min(age / duration, 1)
      const dist = Math.abs(charIdx - w.startPos)
      const maxDist = Math.max(w.startPos, origCharsRef.current.length - w.startPos - 1)
      const rad = (prog * (maxDist + WAVE_BUF)) / spread

      if (dist <= rad) {
        shouldAnim = true
        const intens = Math.max(0, rad - dist)

        // Characters in the wave zone shift through character sequence
        if (intens <= WAVE_THRESH && intens > 0) {
          const idx = (dist * CHAR_MULT + Math.floor(age / ANIM_STEP)) % chars.length
          resultChar = chars[idx]
        }
      }
    }

    return { shouldAnim, char: resultChar }
  }, [duration, spread, chars])

  /**
   * Generates scrambled text based on current waves
   */
  const genScrambledTxt = useCallback((t: number): string => {
    return origCharsRef.current
      .map((char, i) => {
        if (preserveSpaces && char === " ") return " "
        const res = calcWaveEffect(i, t)
        return res.shouldAnim ? res.char : char
      })
      .join("")
  }, [preserveSpaces, calcWaveEffect])

  /**
   * Start the animation loop
   */
  const start = useCallback(() => {
    if (isAnimRef.current) return
    
    const el = elRef.current
    if (!el) return

    // Preserve original width to prevent layout shifts
    if (origWidthRef.current === null) {
      origWidthRef.current = el.getBoundingClientRect().width
      el.style.width = `${origWidthRef.current}px`
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
  }, [cleanupWaves, genScrambledTxt, stop])

  /**
   * Starts a new wave animation from current cursor position
   */
  const startWave = useCallback(() => {
    wavesRef.current.push({
      startPos: cursorPosRef.current,
      startTime: Date.now(),
      id: Math.random()
    })

    if (!isAnimRef.current) start()
  }, [start])

  const handleEnter = useCallback((e: React.MouseEvent) => {
    isHoverRef.current = true
    updateCursorPos(e)
    startWave()
  }, [updateCursorPos, startWave])

  const handleMove = useCallback((e: React.MouseEvent) => {
    if (!isHoverRef.current) return
    const old = cursorPosRef.current
    updateCursorPos(e)
    if (cursorPosRef.current !== old) startWave()
  }, [updateCursorPos, startWave])

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
  }, [children])

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