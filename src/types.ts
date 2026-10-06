export type Timeframe = '30S' | '1M' | '3M' | '5M';

export interface DrawResult {
  period: string;
  number: number;
}

export type BallColor = 'GREEN' | 'RED' | 'VIOLET' | 'RED_VIOLET' | 'GREEN_VIOLET';
export type BallSize = 'SMALL' | 'BIG';

export interface BacktestResult {
  samples: number;
  numberHits: number;
  sizeHits: number;
  colorHits: number;
}

export interface Signal {
  number: number;
  size: BallSize;
  color: BallColor;
  numberShare: number;
  sizeShare: number;
  colorShare: number;
  numberDistribution: number[];
  targetPeriod: string;
  backtest: BacktestResult | null;
}

export type SourceMode = 'none' | 'api' | 'manual' | 'simulated';

export interface AppState {
  endpoints: Record<Timeframe, string>;
  histories: Record<Timeframe, DrawResult[]>;
  sourceModes: Record<Timeframe, SourceMode>;
  manualTexts: Record<Timeframe, string>;
  updatedAt: Record<Timeframe, string | null>;
  liveSyncEnabled?: boolean;
  liveSyncInterval?: number; // in seconds, default 30
}

export interface ServerLiveState {
  histories: Record<Timeframe, DrawResult[]>;
  signals: Record<Timeframe, Signal | null>;
  endpoints: Record<Timeframe, string>;
  updatedAt: Record<Timeframe, string | null>;
  serverTime: number;
  serverSynced: boolean;
}


