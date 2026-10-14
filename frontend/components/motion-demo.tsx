"use client"

import React, { useRef, useEffect } from "react"
import { motion } from "motion/react"
import gsap from "gsap"
import { Sparkles, Activity } from "lucide-react"

export function MotionDemo() {
  const gsapBoxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!gsapBoxRef.current) return
    const ctx = gsap.context(() => {
      gsap.to(gsapBoxRef.current, {
        rotation: 360,
        duration: 8,
        repeat: -1,
        ease: "linear",
      })
    })
    return () => ctx.revert()
  }, [])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Motion Component */}
      <div className="flex flex-col items-center justify-center p-6 border rounded-xl bg-card text-card-foreground">
        <motion.div
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col items-center gap-3 p-5 rounded-xl border border-primary/20 bg-primary/5 cursor-pointer select-none"
        >
          <div className="p-3 rounded-full bg-primary/10 text-primary">
            <Sparkles className="size-6" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-sm">Interactive Motion Card</p>
            <p className="text-xs text-muted-foreground mt-1">
              Hover or tap to trigger spring motion transitions
            </p>
          </div>
        </motion.div>
        <span className="text-xs text-muted-foreground mt-4 font-mono">
          Powered by motion (Motion for React)
        </span>
      </div>

      {/* GSAP Component */}
      <div className="flex flex-col items-center justify-center p-6 border rounded-xl bg-card text-card-foreground">
        <div className="flex flex-col items-center gap-3 p-5">
          <div
            ref={gsapBoxRef}
            className="flex items-center justify-center size-12 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-500 text-white shadow-md"
          >
            <Activity className="size-6" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-sm">GSAP Smooth Timeline Rotation</p>
            <p className="text-xs text-muted-foreground mt-1">
              Hardware-accelerated continuous RAF animation loop
            </p>
          </div>
        </div>
        <span className="text-xs text-muted-foreground mt-2 font-mono">
          Powered by gsap (GreenSock)
        </span>
      </div>
    </div>
  )
}
