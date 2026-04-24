import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Mode, SpanLabel } from '../types';

export type ModelId =
  | 'bert-ner'
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
    id: 'bert-ner',
    name: 'Fast — works on any device',
    sizeLabel: '110 MB',
    speedLabel: 'Instant',
    qualityLabel: 'Good',
    description: 'Good for older machines or quick trials.',
    requiresWebGPU: false,
  },
  {
    id: 'phi-3.5-mini',
    name: 'Balanced — recommended (Phi-3.5-mini)',
    sizeLabel: '2.2 GB',
    speedLabel: '~5s/page',
    qualityLabel: 'High',
    description: 'Microsoft Phi-3.5-mini, 4-bit quantized. Strong instruction following.',
    requiresWebGPU: true,
  },
  {
    id: 'gemma-2-2b',
    name: 'Compact (Gemma 2 2B)',
    sizeLabel: '1.5 GB',
    speedLabel: '~3s/page',
    qualityLabel: 'High',
    description: "Google's on-device model. Smaller download than Phi.",
    requiresWebGPU: true,
  },
  {
    id: 'qwen-2.5-7b',
    name: 'Highest quality (slow)',
    sizeLabel: '4.5 GB',
    speedLabel: '~12s/page',
    qualityLabel: 'Highest',
    description: 'Qwen 2.5 7B. M-series Mac or RTX 3060+ recommended.',
    requiresWebGPU: true,
  },
  {
    id: 'regex-only',
    name: 'Regex only (no AI)',
    sizeLabel: '0 MB',
    speedLabel: 'Instant',
    qualityLabel: 'Limited',
    description: 'Names and addresses must be added manually.',
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
  mode: 'redact',
  enabledRegexPatterns: ['SSN', 'EIN', 'PHONE', 'EMAIL', 'DATE', 'LOAN_NUM'],
  llmEnabled: true,
  selectedModel: 'bert-ner',
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
      version: 1,
    },
  ),
);
