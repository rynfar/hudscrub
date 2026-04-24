import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Mode, SpanLabel } from '../types';

export type ModelId = 'bert-ner' | 'phi-4-mini' | 'gemma-3-4b' | 'qwen-2.5-7b' | 'regex-only';

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
    id: 'phi-4-mini',
    name: 'Balanced — recommended',
    sizeLabel: '2.3 GB',
    speedLabel: '~5s/page',
    qualityLabel: 'High',
    description: 'Best for most users. ~3 minutes for a 10-page document.',
    requiresWebGPU: true,
  },
  {
    id: 'gemma-3-4b',
    name: 'High quality (Gemma 3 4B)',
    sizeLabel: '2.5 GB',
    speedLabel: '~5s/page',
    qualityLabel: 'High',
    description: 'Different strengths than Balanced.',
    requiresWebGPU: true,
  },
  {
    id: 'qwen-2.5-7b',
    name: 'Highest quality (slow)',
    sizeLabel: '4.5 GB',
    speedLabel: '~12s/page',
    qualityLabel: 'Highest',
    description: 'M-series Mac or RTX 3060+ recommended.',
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
}

const DEFAULTS: Settings = {
  mode: 'redact',
  enabledRegexPatterns: ['SSN', 'EIN', 'PHONE', 'EMAIL', 'DATE', 'LOAN_NUM'],
  llmEnabled: true,
  selectedModel: 'bert-ner',
  detectionPasses: 2,
  autoAcceptRegex: true,
  hasCompletedOnboarding: false,
};

interface SettingsActions {
  set: (patch: Partial<Settings>) => void;
  reset: () => void;
}

const safeStorage = () =>
  typeof window !== 'undefined'
    ? localStorage
    : { getItem: () => null, setItem: () => {}, removeItem: () => {} };

export const useSettings = create<Settings & SettingsActions>()(
  persist(
    (set) => ({
      ...DEFAULTS,
      set: (patch) => set((s) => ({ ...s, ...patch })),
      reset: () => set(() => ({ ...DEFAULTS })),
    }),
    {
      name: 'hudscrub.settings.v1',
      storage: createJSONStorage(safeStorage),
      partialize: ({ set: _set, reset: _reset, ...state }) => state,
    },
  ),
);
