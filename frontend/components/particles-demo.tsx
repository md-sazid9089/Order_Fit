"use client"

import React from "react"
import { Particles, ParticlesProvider } from "@tsparticles/react"
import { loadSlim } from "@tsparticles/slim"

export function ParticlesDemo() {
  return (
    <ParticlesProvider init={async (engine) => { await loadSlim(engine) }}>
      <div className="relative h-64 w-full overflow-hidden rounded-xl border border-border bg-zinc-950 p-6 flex flex-col items-center justify-center text-center">
        <Particles
          id="tsparticles-demo"
          className="absolute inset-0 pointer-events-none"
          options={{
            background: {
              color: {
                value: "transparent",
              },
            },
            fpsLimit: 60,
            particles: {
              color: {
                value: "#38bdf8",
              },
              links: {
                color: "#38bdf8",
                distance: 120,
                enable: true,
                opacity: 0.3,
                width: 1,
              },
              move: {
                direction: "none",
                enable: true,
                outModes: {
                  default: "bounce",
                },
                random: false,
                speed: 1.2,
                straight: false,
              },
              number: {
                density: {
                  enable: true,
                },
                value: 40,
              },
              opacity: {
                value: 0.5,
              },
              shape: {
                type: "circle",
              },
              size: {
                value: { min: 1, max: 3 },
              },
            },
            detectRetina: true,
          }}
        />
        <div className="relative z-10 flex flex-col items-center space-y-2">
          <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-400 border border-cyan-500/20">
            tsParticles Interactive Canvas
          </span>
          <h4 className="text-xl font-bold text-white tracking-tight">
            Subtle Ambient Particle Network
          </h4>
          <p className="max-w-md text-xs text-zinc-400">
            Lightweight dynamic background rendering particle constellations smoothly with high performance.
          </p>
        </div>
      </div>
    </ParticlesProvider>
  )
}
