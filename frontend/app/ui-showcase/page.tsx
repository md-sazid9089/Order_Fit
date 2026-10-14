"use client"

import React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { useShowcaseStore } from "@/lib/store"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Separator } from "@/components/ui/separator"
import { FormDemo } from "@/components/form-demo"
import { MotionDemo } from "@/components/motion-demo"
import { TanStackTableDemo } from "@/components/table-demo"
import { RechartsDemo } from "@/components/chart-demo"
import { ParticlesDemo } from "@/components/particles-demo"
import {
  Sparkles,
  Layers,
  Database,
  BarChart3,
  Sliders,
  ChevronDown,
  Info,
  Plus,
  Minus,
} from "lucide-react"

export default function UIShowcasePage() {
  const { counter, increment, decrement } = useShowcaseStore()

  return (
    <div className="min-h-screen bg-background text-foreground antialiased">
      {/* Header Bar */}
      <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold shadow-sm">
              OF
            </div>
            <div>
              <span className="font-semibold tracking-tight text-sm sm:text-base">Order_Fit UI/UX Suite</span>
              <Badge variant="outline" className="ml-2 font-mono text-[10px]">
                v1.0.0
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                toast.success("Design System Ready", {
                  description: "All 18+ frontend libraries are installed & configured.",
                })
              }}
            >
              Test Notification
            </Button>
            <Button asChild size="sm">
              <Link href="/">Back to Home</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-10">
        <section className="space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" />
            Modern Frontend UI/UX Toolkit Active
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl lg:text-5xl">
            Frontend Architecture & UI Showcase
          </h1>
          <p className="max-w-3xl text-sm sm:text-base text-muted-foreground leading-relaxed">
            A comprehensive, verified suite of modern frontend libraries and component systems:
            Tailwind CSS v4, shadcn/ui (radix-nova), Radix UI primitives, Motion, GSAP, Lucide Icons,
            TanStack Query, TanStack Table, Zustand, Recharts, React Hook Form, Zod, Sonner, and tsParticles.
          </p>
        </section>

        {/* Showcase Tabs */}
        <Tabs defaultValue="components" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto p-1 gap-1">
            <TabsTrigger value="components" className="py-2 text-xs sm:text-sm">
              <Layers className="size-3.5 mr-1.5" /> UI Components
            </TabsTrigger>
            <TabsTrigger value="forms" className="py-2 text-xs sm:text-sm">
              <Sliders className="size-3.5 mr-1.5" /> Forms & Zod
            </TabsTrigger>
            <TabsTrigger value="motion" className="py-2 text-xs sm:text-sm">
              <Sparkles className="size-3.5 mr-1.5" /> Motion & GSAP
            </TabsTrigger>
            <TabsTrigger value="data" className="py-2 text-xs sm:text-sm">
              <Database className="size-3.5 mr-1.5" /> Table & State
            </TabsTrigger>
            <TabsTrigger value="charts" className="py-2 text-xs sm:text-sm">
              <BarChart3 className="size-3.5 mr-1.5" /> Analytics & Canvas
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: UI Components */}
          <TabsContent value="components" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Buttons & Badges */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Buttons & Variants</CardTitle>
                  <CardDescription className="text-xs">
                    Styled with class-variance-authority and Tailwind
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm">Primary</Button>
                    <Button size="sm" variant="secondary">Secondary</Button>
                    <Button size="sm" variant="outline">Outline</Button>
                    <Button size="sm" variant="ghost">Ghost</Button>
                    <Button size="sm" variant="destructive">Destructive</Button>
                  </div>
                  <Separator />
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge>Default</Badge>
                    <Badge variant="secondary">Secondary</Badge>
                    <Badge variant="outline">Outline</Badge>
                    <Badge variant="destructive">Destructive</Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Overlays & Modals */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Modals & Overlays</CardTitle>
                  <CardDescription className="text-xs">
                    Radix UI accessible dialog, sheet & dropdown
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {/* Dialog */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">Open Dialog</Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Radix UI Accessible Modal</DialogTitle>
                          <DialogDescription>
                            This dialog locks focus, manages screen reader attributes, and closes gracefully.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-3 text-sm text-muted-foreground">
                          Order_Fit UI components maintain strict accessibility standards.
                        </div>
                      </DialogContent>
                    </Dialog>

                    {/* Sheet */}
                    <Sheet>
                      <SheetTrigger asChild>
                        <Button size="sm" variant="outline">Open Sheet</Button>
                      </SheetTrigger>
                      <SheetContent>
                        <SheetHeader>
                          <SheetTitle>Slide-Over Sheet</SheetTitle>
                          <SheetDescription>
                            Useful for mobile navigation, drawer menus, and filter panels.
                          </SheetDescription>
                        </SheetHeader>
                        <div className="mt-4 space-y-3">
                          <Skeleton className="h-4 w-3/4" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-5/6" />
                        </div>
                      </SheetContent>
                    </Sheet>

                    {/* Dropdown Menu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline">
                          Dropdown <ChevronDown className="ml-1 size-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => toast.info("Project Settings clicked")}>
                          Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toast.info("Export Data triggered")}>
                          Export Report
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>

              {/* Tooltip & Select */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Tooltips & Inputs</CardTitle>
                  <CardDescription className="text-xs">
                    Enhanced micro-interactions & select pickers
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <TooltipProvider>
                    <div className="flex items-center gap-2">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="sm" variant="outline" className="gap-1.5">
                            <Info className="size-3.5" /> Hover for Info
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Accessible tooltip powered by Radix UI primitive</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>

                  <Select defaultValue="order_fit_core">
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select component preset" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="order_fit_core">Order_Fit Standard</SelectItem>
                      <SelectItem value="order_fit_pro">Order_Fit Analytics Pro</SelectItem>
                      <SelectItem value="order_fit_enterprise">Order_Fit Enterprise</SelectItem>
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 2: Forms & Validation */}
          <TabsContent value="forms">
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="text-lg">React Hook Form + Zod Schema Validation</CardTitle>
                <CardDescription className="text-xs">
                  Type-safe client-side form management with instant feedback and toast alerts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <FormDemo />
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 3: Motion & GSAP */}
          <TabsContent value="motion" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Motion & GSAP Interactive Transitions</CardTitle>
                <CardDescription className="text-xs">
                  Physics-based spring animations paired with GreenSock RAF timeline control.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MotionDemo />
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAB 4: TanStack Table & Zustand */}
          <TabsContent value="data" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Zustand Demo */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Zustand Global State</CardTitle>
                  <CardDescription className="text-xs">
                    Lightweight reactivity without Context boilerplate
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
                    <span className="text-sm font-medium">Counter Value:</span>
                    <span className="font-mono text-xl font-bold text-primary">{counter}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 gap-1" onClick={increment}>
                      <Plus className="size-3.5" /> Increment
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={decrement}>
                      <Minus className="size-3.5" /> Decrement
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* TanStack Table */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base font-semibold">TanStack Table Data Grid</CardTitle>
                  <CardDescription className="text-xs">
                    Headless, high-performance table engine integrated with shadcn Table
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TanStackTableDemo />
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* TAB 5: Charts & Particles */}
          <TabsContent value="charts" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recharts */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">Recharts Area Visualization</CardTitle>
                  <CardDescription className="text-xs">
                    Responsive SVG charts styled with modern gradient fills
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <RechartsDemo />
                </CardContent>
              </Card>

              {/* tsParticles */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base font-semibold">tsParticles Ambient Canvas</CardTitle>
                  <CardDescription className="text-xs">
                    Interactive particle backgrounds for landing pages or hero headers
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ParticlesDemo />
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
