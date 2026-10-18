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
  primaryBet?: 'SIZE' | 'COLOR' | 'NUMBER';
  sizeSafety?: 'SAFE' | 'MEDIUM' | 'RISKY';
  colorSafety?: 'SAFE' | 'MEDIUM';
  patternType?: 'STREAK' | 'CHOP' | 'DOUBLE' | 'NORMAL' | 'CYCLE_2_1' | 'CYCLE_1_2' | 'PERIODIC' | 'BRIDGE_MIRROR' | 'CUT_AT_2' | 'CUT_AT_3' | 'NUMBER_REBOUND' | 'COLOR_INERTIA' | 'ANTI_PHASE_INVERSION' | 'EMERGENCY_LOCK' | 'ZERO_FIVE_BREAKER' | 'TWIN_TRANSITION' | 'RED_OSCILLATOR' | 'SEVEN_ANCHOR' | 'SINGLE_ZERO_CHOP' | 'GREEN_PING_PONG' | 'LADDER_EXHAUSTION' | 'DRAGON_TERMINATOR' | 'ONE_SIX_BRIDGE' | 'VIOLET_HARMONIC_WAVE' | 'RED_EVEN_QUADRANT' | 'TRIPLE_ZERO_REBOUND' | 'ONE_TWO_THREE_STAIRS';
  advisoryNote?: string;
  hedgeTip?: string;
  lossStreakPrevented?: boolean;
  consecutiveLosses?: number;
  stakingLevel?: string;
  suggestedMultiplier?: number;
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

export interface SignalLedgerEntry {
  targetPeriod: string;
  predictedSize: BallSize;
  actualSize?: BallSize;
  status: 'PENDING' | 'WIN' | 'LOSS';
  patternType?: string;
  timestamp: number;
}

export interface ServerLiveState {
  histories: Record<Timeframe, DrawResult[]>;
  signals: Record<Timeframe, Signal | null>;
  endpoints: Record<Timeframe, string>;
  updatedAt: Record<Timeframe, string | null>;
  lossStreaks?: Record<Timeframe, number>;
  ledgers?: Record<Timeframe, SignalLedgerEntry[]>;
  serverTime: number;
  serverSynced: boolean;
}


