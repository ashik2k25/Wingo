export type Timeframe = '30S' | '1M' | '3M' | '5M';

export interface DrawResult {
  period: string;
  number: number;
  timestamp?: string | number;
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
  primaryBet?: 'SIZE' | 'COLOR' | 'NUMBER' | 'PASS' | 'DUAL_SHIELD';
  sizeSafety?: 'SAFE' | 'MEDIUM' | 'RISKY';
  colorSafety?: 'SAFE' | 'MEDIUM';
  patternType?: 'STREAK' | 'CHOP' | 'DOUBLE' | 'NORMAL' | 'CYCLE_2_1' | 'CYCLE_1_2' | 'PERIODIC' | 'BRIDGE_MIRROR' | 'CUT_AT_2' | 'CUT_AT_3' | 'NUMBER_REBOUND' | 'COLOR_INERTIA' | 'ANTI_PHASE_INVERSION' | 'EMERGENCY_LOCK' | 'ZERO_FIVE_BREAKER' | 'ZERO_FIVE_SANDWICH' | 'TWIN_TRANSITION' | 'RED_OSCILLATOR' | 'SEVEN_ANCHOR' | 'SINGLE_ZERO_CHOP' | 'GREEN_PING_PONG' | 'LADDER_EXHAUSTION' | 'DRAGON_TERMINATOR' | 'ONE_SIX_BRIDGE' | 'VIOLET_HARMONIC_WAVE' | 'RED_EVEN_QUADRANT' | 'TRIPLE_ZERO_REBOUND' | 'ONE_TWO_THREE_STAIRS' | 'DELAYED_TWIN_SNAP' | 'COLOR_INERTIA_CUT' | 'VIOLET_DIPOLE_RESONANCE' | 'EVEN_PARITY_SATURATION' | 'COLOR_CHOP_RHYTHM' | 'HARMONIC_DIPOLE_PRNG';
  advisoryNote?: string;
  hedgeTip?: string;
  lossStreakPrevented?: boolean;
  consecutiveLosses?: number;
  stakingLevel?: string;
  suggestedMultiplier?: number;
  colorPatternType?: string;
  colorConfidence?: number;
  colorPatternName?: string;
  colorAdvisory?: string;
  crossLocked?: boolean;
  dualShield?: DualShieldPlay;
  dbMatchStatus?: string;
  hashMatchStatus?: string;
  hashValue?: string;
  dbMatchesCount?: number;
}

export interface DualShieldPlay {
  size: BallSize;
  color: BallColor;
  coveragePct: number;
  winningDigits: number[];
  missDigits: number[];
  hedgeRule: string;
}

export type SourceMode = 'none' | 'api' | 'manual' | 'simulated';

export interface DigitTrendStat {
  digit: number;
  count: number;
  percentage: number;
  currentMissing: number;
  maxMissing: number;
  avgMissing: number;
  isHot: boolean;
  isCold: boolean;
}

export interface TrendStatistics {
  timeframe: Timeframe;
  sampleSize: number;
  digitStats: DigitTrendStat[];
  sizeStats: {
    bigCount: number;
    smallCount: number;
    bigPercentage: number;
    smallPercentage: number;
    currentSizeStreak: number;
    currentStreakSize: BallSize;
    sizeMissing: { BIG: number; SMALL: number };
  };
  colorStats: {
    redCount: number;
    greenCount: number;
    violetCount: number;
    redPercentage: number;
    greenPercentage: number;
    violetPercentage: number;
    currentColorStreak: number;
    currentStreakColor: BallColor;
    colorMissing: { RED: number; GREEN: number; VIOLET: number };
  };
  hotDigits: number[];
  coldDigits: number[];
}

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
  predictedColor?: BallColor;
  actualColor?: BallColor;
  colorStatus?: 'PENDING' | 'WIN' | 'LOSS';
  dualShieldStatus?: 'PENDING' | 'DOUBLE_WIN' | 'SIZE_WIN' | 'COLOR_WIN' | 'DOUBLE_MISS';
  patternType?: string;
  timestamp: number;
}

export interface PeakAccuracyWindow {
  id: string;
  label: string;
  timeRange: string;
  durationMins: number;
  applicableTimeframe?: Timeframe;
  gameTitle?: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  startMins?: number;
  endMins?: number;
  winRate: number;
  errorRate: number;
  errorCount: number;
  totalRounds: number;
  winningRounds: number;
  isActiveNow: boolean;
  isVolatile?: boolean;
  statusText: string;
  marketNote: string;
  postSessionSafe?: boolean;
  postSessionBufferDesc?: string;
}

export interface HighestLossRecord {
  streak: number;
  occurredAt: string;
  period: string;
  timeframe: Timeframe;
}

export interface AlertHistoryLog {
  id: string;
  type: 'CALL_ALERT' | 'TELEGRAM_REPORT';
  recipient: string;
  time: string;
  message: string;
  success: boolean;
  details?: string;
}

export interface GoldenAlertConfig {
  phoneNumber: string;
  telegramChatId: string;
  callAlertEnabled: boolean;
  telegramReportEnabled: boolean;
  leadTimeMinutes: number; // default 1 minute
  lastAlertTime?: number | null;
  lastReportTime?: number | null;
  lastCallStatus?: string | null;
  lastReportStatus?: string | null;
  historyLogs: AlertHistoryLog[];
}

export interface ServerLiveState {
  histories: Record<Timeframe, DrawResult[]>;
  signals: Record<Timeframe, Signal | null>;
  endpoints: Record<Timeframe, string>;
  trendEndpoints?: Record<Timeframe, string>;
  updatedAt: Record<Timeframe, string | null>;
  lossStreaks?: Record<Timeframe, number>;
  highestLossRecord?: Record<Timeframe, HighestLossRecord>;
  peakAccuracyWindows?: PeakAccuracyWindow[];
  ledgers?: Record<Timeframe, SignalLedgerEntry[]>;
  goldenAlertConfig?: GoldenAlertConfig;
  serverTime: number;
  serverSynced: boolean;
}


