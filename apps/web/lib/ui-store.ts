'use client';
import { create } from 'zustand';

// Presentation preferences only. The persistent workspace owns all scientific state.
export const useUIStore = create<{
  collapsed: boolean;
  facilitiesVisible: boolean;
  toggleSidebar: () => void;
  toggleFacilities: () => void;
}>((set) => ({
  collapsed: false,
  facilitiesVisible: true,
  toggleSidebar: () => set((s) => ({ collapsed: !s.collapsed })),
  toggleFacilities: () => set((s) => ({ facilitiesVisible: !s.facilitiesVisible })),
}));
