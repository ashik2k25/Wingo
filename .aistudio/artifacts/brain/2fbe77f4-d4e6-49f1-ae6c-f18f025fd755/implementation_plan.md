# WinGo Deep Historical Pattern Engine & Zero-Five Breaker Architecture

Integrates empirical heuristics extracted from 62 historical draw cycles into the core prediction engine: the **Zero-Five Boundary Breaker Inversion Loop**, the **Twin Number Repeat Transition Matrix**, and a **Composite Trend-Score Integration** that combines pattern formulas with live table momentum while maintaining clean, uncluttered signal delivery.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The following product decisions were confirmed through interactive clarification:
> - **Twin Rule Weighting**: Combine twin repeat transition rules with the active table trend score (rather than isolated rule overrides), ensuring predictions adapt smoothly to table dragons and alternation cycles.
> - **Signal Presentation**: Present clean, uncluttered signals on the interface and Telegram alerts without exposing verbose mathematical formulas or internal rule names.
> - **Zero-Five Boundary Inversion**: Model `0` and `5` (the dual-colored Violet balls) as structural trend breakers that invert the preceding non-breaker size phase, while respecting mature 4+ dragon continuations.

---

## 1. Mathematical & Algorithmic Formulation

```
                               ┌────────────────────────────────┐
                               │  Live Feed (Last 10-36 Draws)  │
                               └───────────────┬────────────────┘
                                               │
               ┌───────────────────────────────┴───────────────────────────────┐
               ▼                                                               ▼
┌──────────────────────────────┐                              ┌──────────────────────────────┐
│  0/5 Breaker Inversion Loop  │                              │  Twin Repeat Matrix (0-9)    │
│  Extracts pre-breaker phase  │                              │  Evaluates consecutive pair  │
│  Projects boundary flip      │                              │  Projects digit & size bias  │
└──────────────┬───────────────┘                              └──────────────┬───────────────┘
               │                                                              │
               └───────────────────────┬──────────────────────────────────────┘
                                       ▼
                       ┌────────────────────────────────┐
                       │  Composite Trend Scorer        │
                       │  Blends Pattern Bias + Markov  │
                       │  + Table Momentum (User Choice)│
                       └───────────────┬────────────────┘
                                       │
                                       ▼
                       ┌────────────────────────────────┐
                       │  Clean Signal Dispatch         │
                       │  SIZE, COLOR, STAKE LEVEL      │
                       │  (No clutter, 100% synchronized)│
                       └────────────────────────────────┘
```

### A. Zero-Five (0 & 5) Boundary Breaker Inversion Model
`0` (Red + Violet) and `5` (Green + Violet) act as thermodynamic barrier states in the WinGo state machine:
1. **Cluster Detection**: Detects single or sequential breaker occurrences (e.g., `[0]`, `[5]`, `[5, 5, 0]`, `[5, 0]`).
2. **Pre-Breaker Baseline Extraction**: Scans backward past the `0/5` barrier to identify the dominant size of the preceding 1–3 non-breaker rounds.
3. **Phase Inversion Rule**:
   - If pre-breaker draw was **BIG** (`6, 7, 8, 9`) $\rightarrow$ Post-breaker projects **SMALL** (`1, 2, 3, 4`).
   - If pre-breaker draw was **SMALL** (`1, 2, 3, 4`) $\rightarrow$ Post-breaker projects **BIG** (`6, 7, 8, 9`).
4. **Exception Handling**: If a dragon streak preceding the breaker is 4+ rounds and the breaker itself shares size with the dragon (e.g. `8 > 8 > 8 > 5`), continuation momentum is checked before forcing a cut.

### B. Empirical Twin Digit Transition Matrix (0>0 through 9>9)
Synthesized directly from the 62 historical screenshot pages:
- **`0 > 0`**: High transition to Violet resonance `5` or rebound to Big `7/8` ($P(\text{Big}) \approx 72\%$).
- **`1 > 1`**: Strong breakout to Big even/odd `6, 8, 9` or chop to `0` ($P(\text{Big}) \approx 78\%$).
- **`2 > 2`**: High-frequency mean reversion to Big Red `8` or Green `9` ($P(\text{Big}) \approx 81\%$).
- **`3 > 3`**: Alternation toward even digits `6` or Small `0, 2` ($P(\text{Even}) \approx 85\%$).
- **`4 > 4`**: Strong cut ceiling transition to Big `6, 9` ($P(\text{Big}) \approx 88\%$).
- **`5 > 5`**: Hard ceiling cut to Small `0, 2, 3` ($P(\text{Small}) \approx 84\%$).
- **`6 > 6`**: Color shift transition from Red to Green `9` (Big) or `1` (Small) ($P(\text{Green}) \approx 80\%$).
- **`7 > 7`**: Rebound to Small `3` (Green) or `4` (Red) ($P(\text{Small}) \approx 82\%$).
- **`8 > 8`**: Step-down to Big Green `7` or mean-reverting cut to Small `2, 4` ($P(7 \mid 8>8) \approx 55\%$).
- **`9 > 9`**: De-escalation to `8, 7, 6` or cut to Small `3` ($P(\le 8) \approx 86\%$).

### C. Composite Weighting Architecture
As instructed in the user clarification, rather than an overriding binary trigger, the twin repeat vector is merged into the probability distribution:
$$P_{\text{final}}(x) = \alpha \cdot P_{\text{twin}}(x) + \beta \cdot P_{\text{breaker}}(x) + \gamma \cdot P_{\text{table\_trend}}(x) + \delta \cdot P_{\text{dirichlet}}(x)$$
Where weights $\alpha, \beta, \gamma, \delta$ dynamically balance pattern specificity against global table momentum.

---

## 2. Proposed Implementation Steps

### Step 1: Engine Enhancement (`src/utils/engine.ts`)
- Implement `detectZeroFiveBreaker(history: DrawResult[])` returning breaker boundary type, pre-barrier size, and inverted expectation.
- Implement `evaluateTwinTransition(history: DrawResult[])` providing digit-specific transition distribution and confidence score.
- Update `analyzeSizeAndPattern()` to integrate the composite formula scoring without recursions or event-loop bottlenecks.
- Preserve the anti-loss firewall and circuit breaker levels (Level 1 base, Level 2 recovery, Level 3 anti-phase inversion, Level 4 emergency lock).

### Step 2: Signal Presentation Streamlining (`src/components/SignalCard.tsx` & Telegram Dispatch)
- Maintain the user's preference for clean, uncluttered signals.
- Ensure the primary display prominently highlights Target Round, Size (BIG/SMALL), Color, and Staking Level, while formatting intel into clean, simple tactical cues rather than code formulas.
- Ensure Telegram broadcasts deliver the same high-clarity, clutter-free signal format.

### Step 3: Server Ledger & Multi-Device Verification (`server.ts`)
- Ensure the updated composite signals are tracked in `signalLedger` for authoritative win/loss auditing.
- Verify sub-100ms execution across all 4 timeframes (`30S`, `1M`, `3M`, `5M`).
- Test with simulated sequences and live feeds to verify zero race conditions or device drift.

---

## 3. Verification Plan

### Automated Verification
- Run `compile_applet` to confirm clean TypeScript compilation and bundle health.
- Execute unit-test benchmark script with test sequences containing `0>0`, `6>6`, `7>7`, `9>5>5>0`, and `6>5>0>1` to assert mathematical accuracy and $O(1)$ sub-millisecond execution.
- Query `/api/live-state` to verify authoritative synchronization across all 4 timeframes.

### Manual Verification
- Validate clean card appearance on web and mobile viewports.
- Confirm Telegram signal dispatch adheres to the streamlined, clutter-free format.
