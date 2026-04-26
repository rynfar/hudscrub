import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Mode, SpanLabel } from '../types';

export type ModelId =
  | 'phi-3.5-mini'
  | 'gemma-2-2b'
  | 'qwen-2.5-7b'
  | 'regex-only';

export interface ModelOption {
  id: ModelId;
  name: string;
  sizeLabel: string;
  speedLabel: string;
  qualityLabel: string;
  description: string;
  requiresWebGPU: boolean;
}

export const MODELS: ModelOption[] = [
  {
    id: 'qwen-2.5-7b',
    name: 'Qwen 2.5 7B — best quality',
    sizeLabel: '4.5 GB',
    speedLabel: '~12s / page',
    qualityLabel: 'Highest',
    description: 'Largest model. Highest recall on names, addresses, and edge cases. Recommended for important documents. Needs an M-series Mac or RTX 3060+ to run smoothly.',
    requiresWebGPU: true,
  },
  {
    id: 'phi-3.5-mini',
    name: 'Phi-3.5 mini — recommended balance',
    sizeLabel: '2.2 GB',
    speedLabel: '~5s / page',
    qualityLabel: 'High',
    description: 'Microsoft Phi-3.5-mini (3.8B). Strong at structured extraction, half the download of Qwen, runs comfortably on most modern laptops.',
    requiresWebGPU: true,
  },
  {
    id: 'gemma-2-2b',
    name: 'Gemma 2 2B — fastest LLM',
    sizeLabel: '1.5 GB',
    speedLabel: '~3s / page',
    qualityLabel: 'Good',
    description: "Google's smallest on-device model. Quickest per page and smallest download, but expect to manually add a few more names and addresses the model misses.",
    requiresWebGPU: true,
  },
  {
    id: 'regex-only',
    name: 'No AI — pattern matching only',
    sizeLabel: '0 MB',
    speedLabel: 'Instant',
    qualityLabel: 'Limited',
    description: 'Catches structured PII (SSN, EIN, phone, email, dates, loan numbers). You add names and addresses manually by selecting them in the document.',
    requiresWebGPU: false,
  },
];

export interface Settings {
  mode: Mode;
  enabledRegexPatterns: SpanLabel[];
  llmEnabled: boolean;
  selectedModel: ModelId;
  detectionPasses: 1 | 2 | 3;
  sandboxSeed?: number;
  autoAcceptRegex: boolean;
  hasCompletedOnboarding: boolean;
  /** Models the user has previously installed (via onboarding or settings). */
  installedModels: ModelId[];
}

const DEFAULTS: Settings = {
  mode: 'sandbox',
  enabledRegexPatterns: ['SSN', 'EIN', 'PHONE', 'EMAIL', 'DATE', 'LOAN_NUM'],
  llmEnabled: true,
  selectedModel: 'gemma-2-2b',
  detectionPasses: 2,
  autoAcceptRegex: true,
  hasCompletedOnboarding: false,
  installedModels: [],
};

interface SettingsActions {
  set: (patch: Partial<Settings>) => void;
  reset: () => void;
  markInstalled: (id: ModelId) => void;
}

export const useSettings = create<Settings & SettingsActions>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (patch) => set((s) => ({ ...s, ...patch })),
      reset: () => set(() => ({ ...DEFAULTS })),
      markInstalled: (id) =>
        set((s) =>
          s.installedModels.includes(id)
            ? s
            : { ...s, installedModels: [...s.installedModels, id] },
        ),
    }),
    {
      name: 'hudscrub.settings.v1',
      // Use a no-op stub during SSR / tests so persist doesn't crash.
      // The persist middleware re-evaluates this lazily, picking up the real
      // localStorage when the client takes over.
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined' && window.localStorage) {
          return window.localStorage;
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      partialize: ({ set: _set, reset: _reset, markInstalled: _mi, ...state }) => state,
      version: 2,
      // v1 → v2: 'bert-ner' was removed as a model option; remap any persisted
      // selection or installed entry to the new default. v0 → anything: drop entirely.
      migrate: (persisted: unknown, fromVersion: number) => {
        if (fromVersion < 1) {
          return { ...DEFAULTS };
        }
        const s = persisted as Partial<Settings> & { selectedModel?: string; installedModels?: string[] };
        const remap = (id: string | undefined): ModelId =>
          id === 'bert-ner' ? 'phi-3.5-mini' : ((id as ModelId) ?? DEFAULTS.selectedModel);
        return {
          ...DEFAULTS,
          ...s,
          selectedModel: remap(s.selectedModel),
          installedModels: ((s.installedModels ?? []) as string[])
            .filter((id) => id !== 'bert-ner')
            .map((id) => id as ModelId),
        } as Settings;
      },
    },
  ),
);
