export interface ModelLoadProgress {
  status: 'downloading' | 'unpacking' | 'initializing' | 'ready' | 'error';
  progress: number;
  downloaded?: number;
  total?: number;
  message?: string;
}

export type ProgressCallback = (p: ModelLoadProgress) => void;
