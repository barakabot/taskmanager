"use client";

import { create } from "zustand";

export type ViewKey =
  | "overview"
  | "kanban"
  | "list"
  | "calendar"
  | "bi"
  | "reports"
  | "mytasks"
  | "members"
  | "admin";

export type CurrentMember = {
  id: string;
  name: string;
  handle: string;
  department: string;
  role: "MANAGER" | "MEMBER";
};

interface PMOState {
  // Auth
  member: CurrentMember | null;
  authLoading: boolean;
  setMember: (m: CurrentMember | null) => void;
  setAuthLoading: (v: boolean) => void;
  isManager: boolean;

  // Navigation
  view: ViewKey;
  setView: (v: ViewKey) => void;

  // Task refresh signal
  taskVersion: number;
  bumpTaskVersion: () => void;
}

export const usePMOStore = create<PMOState>((set) => ({
  member: null,
  authLoading: true,
  setMember: (member) =>
    set({ member, isManager: member?.role === "MANAGER" }),
  setAuthLoading: (authLoading) => set({ authLoading }),
  isManager: false,

  view: "overview",
  setView: (view) => set({ view }),

  taskVersion: 0,
  bumpTaskVersion: () => set((s) => ({ taskVersion: s.taskVersion + 1 })),
}));
