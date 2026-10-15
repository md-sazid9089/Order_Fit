import { create } from "zustand"

interface ShowcaseState {
  counter: number
  activeTab: string
  increment: () => void
  decrement: () => void
  setActiveTab: (tab: string) => void
}

export const useShowcaseStore = create<ShowcaseState>((set) => ({
  counter: 0,
  activeTab: "overview",
  increment: () => set((state) => ({ counter: state.counter + 1 })),
  decrement: () => set((state) => ({ counter: state.counter - 1 })),
  setActiveTab: (tab) => set({ activeTab: tab }),
}))
