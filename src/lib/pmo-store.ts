"use client";

import { create } from "zustand";

export type ViewKey =
  | "overview"
  | "kanban"
  | "list"
  | "scheduler"
  | "referred"
  | "mytasks"
  | "members"
  | "groups"
  | "admin";

export type CurrentMember = {
  id: string;
  name: string;
  handle: string;
  role: string;
  groupId: string | null;
  groupName: string | null;
  supervisorId: string | null;
};

interface TMState {
  member: CurrentMember | null;
  authLoading: boolean;
  setMember: (m: CurrentMember | null) => void;
  setAuthLoading: (v: boolean) => void;
  view: ViewKey;
  setView: (v: ViewKey) => void;
  taskVersion: number;
  bumpTaskVersion: () => void;
}

export const useTMStore = create<TMState>((set) => ({
  member: null,
  authLoading: true,
  setMember: (member) => set({ member }),
  setAuthLoading: (authLoading) => set({ authLoading }),
  view: "overview",
  setView: (view) => set({ view }),
  taskVersion: 0,
  bumpTaskVersion: () => set((s) => ({ taskVersion: s.taskVersion + 1 })),
}));