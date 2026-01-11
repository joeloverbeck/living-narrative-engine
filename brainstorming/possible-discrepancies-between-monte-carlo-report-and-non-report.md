# Possible discrepancies between Monte Carlo report and non-report output

An example report for the hurt_anger.expression.json is:

# Monte Carlo Analysis Report

**Expression**: hurt_anger
**Generated**: 2026-01-11T09:58:02.358Z
**Distribution**: uniform
**Sample Size**: 100000
**Sampling Mode**: static - Independent sampling (tests logical feasibility)

> **Note**: Trigger rates reflect logical feasibility. Actual gameplay rates depend on LLM narrative decisions.

---

## Executive Summary

**Trigger Rate**: 0.00% (95% CI: 0.00% - 0.0038%)
**Rarity**: unobserved (not triggered in 100000 samples—trigger rate is below 0.0038% upper bound, not logically impossible)

Expression never triggers. Primary blocker: AND of 19 conditions Focus on "AND of 19 conditions" (100.0% last-mile failure).

---

## Ground-Truth Witnesses

No triggering states found during simulation.


---

## Blocker Analysis

### Blocker #1: `AND of 19 conditions`

**Condition**: Compound AND block
**Failure Rate**: 100.00% (100000 / 100000)
**Severity**: critical

#### Flags
[DECISIVE] [UPSTREAM]

#### Condition Breakdown

**Required Conditions (ALL must pass)**

| # | Condition | Fail % | Support | Max Obs | Threshold | Gap | Tunable | Last-Mile |
|---|-----------|--------|---------|---------|-----------|-----|---------|-----------|
| 1 | `emotions.anger >= 0.4` | 93.52% | 100000 | 0.94 | 0.40 | -0.54 | moderate | 100.00% (N=169) |
| 2 | `emotions.rage < 0.55` | 1.94% | 100000 | 0.94 | 0.55 | -0.55 | low | N/A |
| 3 | `moodAxes.affiliation >= 20` | 59.75% | 100000 | 100.00 | 20.00 | -80.00 | low | 100.00% (N=1)⚠️ |
| 4 | `moodAxes.valence <= -10` | 54.58% | 100000 | 100.00 | -10.00 | -90.00 | low | N/A |
| 5 | `moodAxes.self_evaluation <= -5` | 52.28% | 100000 | 100.00 | -5.00 | -95.00 | low | N/A |
| 6 | `moodAxes.engagement >= 15` | 56.90% | 100000 | 100.00 | 15.00 | -85.00 | low | 100.00% (N=1)⚠️ |
| 7 | `moodAxes.threat >= 10` | 54.83% | 100000 | 100.00 | 10.00 | -90.00 | low | N/A |
| 8 | `moodAxes.threat <= 70` | 14.51% | 100000 | 100.00 | 70.00 | -170.00 | low | N/A |
| 9 | `moodAxes.arousal >= -5` | 47.02% | 100000 | 100.00 | -5.00 | -105.00 | low | N/A |
| 10 | `moodAxes.arousal <= 55` | 22.35% | 100000 | 100.00 | 55.00 | -155.00 | low | 100.00% (N=8)⚠️ |
| 11 | `emotions.contempt <= 0.4` | 7.31% | 100000 | 0.92 | 0.40 | -0.40 | moderate | N/A |
| 12 | `emotions.disgust <= 0.4` | 8.48% | 100000 | 0.91 | 0.40 | -0.40 | moderate | N/A |
| 13 | `emotions.hatred <= 0.35` | 8.07% | 100000 | 0.89 | 0.35 | -0.35 | moderate | 100.00% (N=53) |
| 14 | `emotions.panic <= 0.4` | 0.53% | 100000 | 0.88 | 0.40 | -0.40 | low | N/A |
| 15 | `emotions.terror <= 0.5` | 3.10% | 100000 | 0.90 | 0.50 | -0.50 | low | N/A |
| 16 | `emotions.freeze <= 0.55` | 0.39% | 100000 | 0.88 | 0.55 | -0.55 | low | N/A |
| 17 | `emotions.dissociation <= 0.65` | 0.26% | 100000 | 0.86 | 0.65 | -0.65 | low | N/A |

**OR Block #1 (ANY ONE must pass)**

| # | Condition | Fail % | Support | Max Obs | Threshold | Gap | Tunable | Last-Mile |
|---|-----------|--------|---------|---------|-----------|-----|---------|-----------|
| 18 | `emotions.sadness >= 0.22` | 78.92% | 100000 | 0.99 | 0.22 | -0.77 | moderate | N/A (OR alt) |
| 19 | `emotions.grief >= 0.18` | 84.37% | 100000 | 0.98 | 0.18 | -0.80 | low | N/A (OR alt) |
| 20 | `emotions.disappointment >= 0.25` | 82.34% | 100000 | 0.96 | 0.25 | -0.71 | moderate | N/A (OR alt) |
| 21 | `emotions.regret >= 0.18` | 84.50% | 100000 | 0.96 | 0.18 | -0.78 | low | N/A (OR alt) |
| 22 | `emotions.lonely_yearning >= 0.25` | 99.00% | 100000 | 0.77 | 0.25 | -0.52 | low | N/A (OR alt) |
| 23 | `emotions.embarrassment >= 0.2` | 85.97% | 100000 | 0.95 | 0.20 | -0.75 | moderate | N/A (OR alt) |

**Combined OR Block**: 60.58% pass rate (39.42% fail when ALL alternatives fail)

**OR Block #1 Success Breakdown** (43997 total successes):
├─ `emotions.sadness >= 0.22`: 47.92% of OR passes (21085/43997)
├─ `emotions.embarrassment >= 0.2`: 16.81% of OR passes (7397/43997)
├─ `emotions.grief >= 0.18`: 14.72% of OR passes (6475/43997)
├─ `emotions.disappointment >= 0.25`: 13.01% of OR passes (5722/43997)
├─ `emotions.regret >= 0.18`: 7.21% of OR passes (3171/43997)
└─ `emotions.lonely_yearning >= 0.25`: 0.33% of OR passes (147/43997)

**OR Block #2 (ANY ONE must pass)**

| # | Condition | Fail % | Support | Max Obs | Threshold | Gap | Tunable | Last-Mile |
|---|-----------|--------|---------|---------|-----------|-----|---------|-----------|
| 24 | `(emotions.anger - previousEmotions.anger) >= 0.08` | 84.56% | 100000 | - | - | - | low | N/A (OR alt) |
| 25 | `(emotions.lonely_yearning - previousEmotions.lonely_yearning) >= 0.08` | 98.61% | 100000 | - | - | - | low | N/A (OR alt) |
| 26 | `(moodAxes.self_evaluation - previousMoodAxes.self_evaluation) <= -10` | 54.76% | 100000 | - | - | - | low | N/A (OR alt) |
| 27 | `(moodAxes.affiliation - previousMoodAxes.affiliation) <= -12` | 55.40% | 100000 | - | - | - | low | N/A (OR alt) |
| | **AND Group (2 conditions - all must pass together)** | | | | | | | |
| 28 | `└─ previousEmotions.anger < 0.4` | 6.38% | 100000 | 0.92 | 0.40 | -0.40 | moderate | N/A (OR alt) |
| 29 | `└─ emotions.anger >= 0.4` | 93.52% | 100000 | 0.94 | 0.40 | -0.54 | moderate | N/A (OR alt) |

**Combined OR Block**: 76.24% pass rate (23.76% fail when ALL alternatives fail)

**OR Block #2 Success Breakdown** (74412 total successes):
├─ `(moodAxes.self_evaluation - previousMoodAxes.self_evaluation) <= -10`: 50.66% of OR passes (37698/74412)
├─ `(moodAxes.affiliation - previousMoodAxes.affiliation) <= -12`: 27.32% of OR passes (20328/74412)
├─ `(emotions.anger - previousEmotions.anger) >= 0.08`: 20.75% of OR passes (15442/74412)
└─ `(emotions.lonely_yearning - previousEmotions.lonely_yearning) >= 0.08`: 1.25% of OR passes (932/74412)

#### Worst Offender Analysis

**#1: `emotions.lonely_yearning >= 0.25`** (99.00% failure)

**#2: `(emotions.lonely_yearning - previousEmotions.lonely_yearning) >= 0.08`** (98.61% failure)

**#3: `emotions.anger >= 0.4`** (93.52% failure)

**#4: `emotions.embarrassment >= 0.2`** (85.97% failure)



#### Distribution Analysis
- **Compound Node**: Aggregated from 29 leaf conditions (19 top-level conditions; 29 when OR blocks expanded)
- **Highest Avg Violation**: 71.40 (from `(moodAxes.affiliation - previousMoodAxes.affiliation) <= -12`)
- **Highest P90 Violation**: 145.00
- **Highest P95 Violation**: 164.00
- **Highest P99 Violation**: 190.00
- **Interpretation**: Worst violator: (moodAxes.affiliation - previousMoodAxes.affiliation) <= -12

#### Ceiling Analysis
- **Compound Node**: Contains multiple conditions
- **Status**: No ceiling effects detected in leaf conditions
- **Insight**: All thresholds appear achievable based on observed values

#### Near-Miss Analysis
- **Compound Node**: Contains 29 leaf conditions
- **Most Tunable Condition**: `emotions.anger >= 0.4`
- **Near-Miss Rate**: 3.50% (epsilon: 0.05)
- **Tunability**: moderate
- **Insight**: Adjusting threshold for this condition offers the best chance of improving trigger rate

#### Last-Mile Analysis
- **Compound Node**: This is the only prerequisite block
- **Note**: Analyze individual leaf conditions to identify bottlenecks
- **Insight**: This compound block contains the only prerequisite; analyze individual leaf conditions for actionable insights

#### Recommendation
**Action**: adjust_upstream
**Priority**: medium
**Guidance**: Decisive blocker but values are far from threshold - adjust prototypes

---

## Conditional Pass Rates (Given Mood Constraints Satisfied)

**Mood regime filter**: 24 contexts where all mood constraints pass
- Constraints: `moodAxes.affiliation >= 20`, `moodAxes.valence <= -10`, `moodAxes.self_evaluation <= -5`, `moodAxes.engagement >= 15`, `moodAxes.threat >= 10`, `moodAxes.threat <= 70`, `moodAxes.arousal >= -5`, `moodAxes.arousal <= 55`

| Condition | P(pass \| mood) | Passes | CI (95%) |
|-----------|-----------------|--------|----------|
| `emotions.lonely_yearning >= 0.25` | 12.50% | 3/24 | [4.34%, 31.00%] |
| `emotions.anger >= 0.4` | 16.67% | 4/24 | [6.68%, 35.85%] |
| `emotions.sadness >= 0.22` | 25.00% | 6/24 | [12.00%, 44.90%] |
| `emotions.disappointment >= 0.25` | 37.50% | 9/24 | [21.16%, 57.29%] |
| `emotions.regret >= 0.18` | 54.17% | 13/24 | [35.07%, 72.11%] |
| `emotions.hatred <= 0.35` | 58.33% | 14/24 | [38.83%, 75.53%] |
| `emotions.grief >= 0.18` | 58.33% | 14/24 | [38.83%, 75.53%] |
| `emotions.embarrassment >= 0.2` | 79.17% | 19/24 | [59.53%, 90.76%] |
| `emotions.freeze <= 0.55` | 87.50% | 21/24 | [69.00%, 95.66%] |
| `emotions.terror <= 0.5` | 95.83% | 23/24 | [79.76%, 99.26%] |
| `emotions.rage < 0.55` | 100.00% | 24/24 | [86.20%, 100.00%] |
| `emotions.contempt <= 0.4` | 100.00% | 24/24 | [86.20%, 100.00%] |
| `emotions.disgust <= 0.4` | 100.00% | 24/24 | [86.20%, 100.00%] |
| `emotions.panic <= 0.4` | 100.00% | 24/24 | [86.20%, 100.00%] |
| `emotions.dissociation <= 0.65` | 100.00% | 24/24 | [86.20%, 100.00%] |

**Interpretation**: These rates show how often each emotion condition passes
when the mood state is already suitable. Low rates indicate emotion-specific
blockers that persist even in favorable mood regimes.

---


## Global Expression Sensitivity Analysis

This section shows how adjusting thresholds affects the **entire expression trigger rate**, not just individual clause pass rates.
This is the key metric for tuning—it answers "What actually happens to the expression if I change this?"

> ⚠️ **Low Confidence Warning**: All sensitivity analyses below have fewer than 5 baseline expression hits.
> With rare expressions, sampling noise dominates and threshold comparisons may not be statistically meaningful.
> Consider increasing sample count or using importance sampling for reliable sensitivity analysis.


### 🎯 Global Expression Sensitivity: emotions.lonely_yearning >= [threshold]

> **Note**: This shows how the threshold change affects the WHOLE EXPRESSION trigger rate, not just the clause.

| Threshold | Trigger Rate | Change | Samples |
|-----------|--------------|--------|---------|
| 0.05 | 0.00% | 0% | 10.000 |
| 0.10 | 0.00% | 0% | 10.000 |
| 0.15 | 0.00% | 0% | 10.000 |
| 0.20 | 0.00% | 0% | 10.000 |
| **0.25** | **0.00%** | **baseline** | 10.000 |
| 0.30 | 0.00% | 0% | 10.000 |
| 0.35 | 0.00% | 0% | 10.000 |
| 0.40 | 0.00% | 0% | 10.000 |
| 0.45 | 0.00% | 0% | 10.000 |

**⚠️ No Triggers Found**: None of the tested thresholds produced expression triggers. The expression may require more extreme threshold changes or other blocking conditions may dominate.

### 🎯 Global Expression Sensitivity: emotions.anger >= [threshold]

> **Note**: This shows how the threshold change affects the WHOLE EXPRESSION trigger rate, not just the clause.

| Threshold | Trigger Rate | Change | Samples |
|-----------|--------------|--------|---------|
| 0.20 | 0.01% | +∞ | 10.000 |
| 0.25 | 0.01% | +∞ | 10.000 |
| 0.30 | 0.01% | +∞ | 10.000 |
| 0.35 | 0.00% | 0% | 10.000 |
| **0.40** | **0.00%** | **baseline** | 10.000 |
| 0.45 | 0.00% | 0% | 10.000 |
| 0.50 | 0.00% | 0% | 10.000 |
| 0.55 | 0.00% | 0% | 10.000 |
| 0.60 | 0.00% | 0% | 10.000 |

**🎯 First threshold with triggers**: 0.20 → 0.01% trigger rate
**💡 Actionable Insight**: Adjusting threshold to 0.20 would achieve ~0.01% expression trigger rate.

### 🎯 Global Expression Sensitivity: emotions.embarrassment >= [threshold]

> **Note**: This shows how the threshold change affects the WHOLE EXPRESSION trigger rate, not just the clause.

| Threshold | Trigger Rate | Change | Samples |
|-----------|--------------|--------|---------|
| 0.00 | 0.00% | 0% | 10.000 |
| 0.05 | 0.00% | 0% | 10.000 |
| 0.10 | 0.00% | 0% | 10.000 |
| 0.15 | 0.00% | 0% | 10.000 |
| **0.20** | **0.00%** | **baseline** | 10.000 |
| 0.25 | 0.00% | 0% | 10.000 |
| 0.30 | 0.00% | 0% | 10.000 |
| 0.35 | 0.00% | 0% | 10.000 |
| 0.40 | 0.00% | 0% | 10.000 |

**⚠️ No Triggers Found**: None of the tested thresholds produced expression triggers. The expression may require more extreme threshold changes or other blocking conditions may dominate.
## Sensitivity Analysis

This section shows how adjusting emotion/sexual thresholds would affect the trigger rate.
Use this to identify optimal threshold values for your desired trigger frequency.

### emotions.anger >= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.20 | 14.12% | +109.50% | 10.000 |
| 0.25 | 12.38% | +83.68% | 10.000 |
| 0.30 | 10.50% | +55.79% | 10.000 |
| 0.35 | 8.53% | +26.56% | 10.000 |
| **0.40** | **6.74%** | **baseline** | 10.000 |
| 0.45 | 5.17% | -23.29% | 10.000 |
| 0.50 | 3.54% | -47.48% | 10.000 |
| 0.55 | 2.21% | -67.21% | 10.000 |
| 0.60 | 1.30% | -80.71% | 10.000 |

### emotions.rage < [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.35 | 92.83% | -5.33% | 10.000 |
| 0.40 | 94.19% | -3.95% | 10.000 |
| 0.45 | 95.56% | -2.55% | 10.000 |
| 0.50 | 96.96% | -1.12% | 10.000 |
| **0.55** | **98.06%** | **baseline** | 10.000 |
| 0.60 | 98.77% | +0.72% | 10.000 |
| 0.65 | 99.41% | +1.38% | 10.000 |
| 0.70 | 99.72% | +1.69% | 10.000 |
| 0.75 | 99.87% | +1.85% | 10.000 |

### emotions.contempt <= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.20 | 84.97% | -7.75% | 10.000 |
| 0.25 | 86.62% | -5.96% | 10.000 |
| 0.30 | 88.59% | -3.82% | 10.000 |
| 0.35 | 90.23% | -2.04% | 10.000 |
| **0.40** | **92.11%** | **baseline** | 10.000 |
| 0.45 | 94.08% | +2.14% | 10.000 |
| 0.50 | 95.72% | +3.92% | 10.000 |
| 0.55 | 97.02% | +5.33% | 10.000 |
| 0.60 | 98.19% | +6.60% | 10.000 |

### emotions.disgust <= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.20 | 77.82% | -14.90% | 10.000 |
| 0.25 | 81.24% | -11.15% | 10.000 |
| 0.30 | 84.90% | -7.15% | 10.000 |
| 0.35 | 88.23% | -3.51% | 10.000 |
| **0.40** | **91.44%** | **baseline** | 10.000 |
| 0.45 | 93.65% | +2.42% | 10.000 |
| 0.50 | 95.87% | +4.84% | 10.000 |
| 0.55 | 97.32% | +6.43% | 10.000 |
| 0.60 | 98.51% | +7.73% | 10.000 |

### emotions.hatred <= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.15 | 85.41% | -7.00% | 10.000 |
| 0.20 | 86.82% | -5.47% | 10.000 |
| 0.25 | 88.32% | -3.83% | 10.000 |
| 0.30 | 90.08% | -1.92% | 10.000 |
| **0.35** | **91.84%** | **baseline** | 10.000 |
| 0.40 | 93.56% | +1.87% | 10.000 |
| 0.45 | 95.25% | +3.71% | 10.000 |
| 0.50 | 96.51% | +5.08% | 10.000 |
| 0.55 | 97.65% | +6.33% | 10.000 |

### emotions.panic <= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.20 | 99.47% | — | 10.000 |
| 0.25 | 99.47% | — | 10.000 |
| 0.30 | 99.47% | — | 10.000 |
| 0.35 | 99.47% | — | 10.000 |
| **0.40** | **99.47%** | **baseline** | 10.000 |
| 0.45 | 99.51% | +0.04% | 10.000 |
| 0.50 | 99.55% | +0.08% | 10.000 |
| 0.55 | 99.63% | +0.16% | 10.000 |
| 0.60 | 99.79% | +0.32% | 10.000 |

### emotions.terror <= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.30 | 92.61% | -4.26% | 10.000 |
| 0.35 | 93.44% | -3.40% | 10.000 |
| 0.40 | 94.48% | -2.33% | 10.000 |
| 0.45 | 95.71% | -1.05% | 10.000 |
| **0.50** | **96.73%** | **baseline** | 10.000 |
| 0.55 | 97.78% | +1.09% | 10.000 |
| 0.60 | 98.59% | +1.92% | 10.000 |
| 0.65 | 99.24% | +2.59% | 10.000 |
| 0.70 | 99.58% | +2.95% | 10.000 |

### emotions.freeze <= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.35 | 99.28% | -0.33% | 10.000 |
| 0.40 | 99.30% | -0.31% | 10.000 |
| 0.45 | 99.35% | -0.26% | 10.000 |
| 0.50 | 99.45% | -0.16% | 10.000 |
| **0.55** | **99.61%** | **baseline** | 10.000 |
| 0.60 | 99.79% | +0.18% | 10.000 |
| 0.65 | 99.87% | +0.26% | 10.000 |
| 0.70 | 99.94% | +0.33% | 10.000 |
| 0.75 | 99.99% | +0.38% | 10.000 |

### emotions.dissociation <= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.45 | 98.64% | -1.08% | 10.000 |
| 0.50 | 98.95% | -0.77% | 10.000 |
| 0.55 | 99.16% | -0.56% | 10.000 |
| 0.60 | 99.49% | -0.23% | 10.000 |
| **0.65** | **99.72%** | **baseline** | 10.000 |
| 0.70 | 99.89% | +0.17% | 10.000 |
| 0.75 | 99.95% | +0.23% | 10.000 |
| 0.80 | 99.99% | +0.27% | 10.000 |
| 0.85 | 100.00% | +0.28% | 10.000 |

### emotions.sadness >= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.02 | 24.00% | +13.31% | 10.000 |
| 0.07 | 23.78% | +12.28% | 10.000 |
| 0.12 | 23.19% | +9.49% | 10.000 |
| 0.17 | 22.47% | +6.09% | 10.000 |
| **0.22** | **21.18%** | **baseline** | 10.000 |
| 0.27 | 19.77% | -6.66% | 10.000 |
| 0.32 | 17.74% | -16.24% | 10.000 |
| 0.37 | 15.44% | -27.10% | 10.000 |
| 0.42 | 13.17% | -37.82% | 10.000 |

### emotions.grief >= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| -0.02 | 100.00% | +541.03% | 10.000 |
| 0.03 | 17.26% | +10.64% | 10.000 |
| 0.08 | 16.94% | +8.59% | 10.000 |
| 0.13 | 16.43% | +5.32% | 10.000 |
| **0.18** | **15.60%** | **baseline** | 10.000 |
| 0.23 | 14.56% | -6.67% | 10.000 |
| 0.28 | 13.21% | -15.32% | 10.000 |
| 0.33 | 11.65% | -25.32% | 10.000 |
| 0.38 | 9.52% | -38.97% | 10.000 |

### emotions.disappointment >= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 20.71% | +15.63% | 10.000 |
| 0.10 | 20.43% | +14.07% | 10.000 |
| 0.15 | 19.94% | +11.33% | 10.000 |
| 0.20 | 19.01% | +6.14% | 10.000 |
| **0.25** | **17.91%** | **baseline** | 10.000 |
| 0.30 | 16.48% | -7.98% | 10.000 |
| 0.35 | 14.87% | -16.97% | 10.000 |
| 0.40 | 12.83% | -28.36% | 10.000 |
| 0.45 | 10.39% | -41.99% | 10.000 |

### emotions.regret >= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| -0.02 | 100.00% | +560.50% | 10.000 |
| 0.03 | 15.99% | +5.61% | 10.000 |
| 0.08 | 15.85% | +4.69% | 10.000 |
| 0.13 | 15.66% | +3.43% | 10.000 |
| **0.18** | **15.14%** | **baseline** | 10.000 |
| 0.23 | 14.40% | -4.89% | 10.000 |
| 0.28 | 13.37% | -11.69% | 10.000 |
| 0.33 | 11.94% | -21.14% | 10.000 |
| 0.38 | 10.43% | -31.11% | 10.000 |

### emotions.lonely_yearning >= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 1.29% | +46.59% | 10.000 |
| 0.10 | 1.20% | +36.36% | 10.000 |
| 0.15 | 1.10% | +25.00% | 10.000 |
| 0.20 | 1.03% | +17.05% | 10.000 |
| **0.25** | **0.88%** | **baseline** | 10.000 |
| 0.30 | 0.75% | -14.77% | 10.000 |
| 0.35 | 0.62% | -29.55% | 10.000 |
| 0.40 | 0.46% | -47.73% | 10.000 |
| 0.45 | 0.34% | -61.36% | 10.000 |

### emotions.embarrassment >= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.00 | 100.00% | +619.42% | 10.000 |
| 0.05 | 17.04% | +22.59% | 10.000 |
| 0.10 | 16.24% | +16.83% | 10.000 |
| 0.15 | 15.26% | +9.78% | 10.000 |
| **0.20** | **13.90%** | **baseline** | 10.000 |
| 0.25 | 12.48% | -10.22% | 10.000 |
| 0.30 | 10.75% | -22.66% | 10.000 |
| 0.35 | 9.09% | -34.60% | 10.000 |
| 0.40 | 7.45% | -46.40% | 10.000 |

## Legend

### Global Metrics
- **Trigger Rate**: Probability (0-100%) that the expression evaluates to true across random samples
- **Confidence Interval**: 95% Wilson score interval indicating statistical certainty of the trigger rate
- **Sample Size**: Number of random state pairs generated for simulation
- **Rarity Categories**: impossible (0%), extremely_rare (<0.001%), rare (<0.05%), normal (<2%), frequent (>=2%)

### Per-Clause Metrics
- **Failure Rate**: Percentage of samples where this specific clause evaluated to false
- **Support**: Number of samples evaluated for this clause (evaluation count)
- **Violation Magnitude**: How far the actual value was from the threshold when the clause failed
- **P50 (Median)**: Middle value of violations; 50% of failures had violations at or below this
- **P90 (90th Percentile)**: 90% of failures had violations at or below this; indicates severity of worst cases
- **P95 (95th Percentile)**: 95% of failures had violations at or below this; shows extreme violations
- **P99 (99th Percentile)**: 99% of failures had violations at or below this; identifies outlier violations
- **Min Observed**: Lowest value observed for this variable across all samples
- **Mean Observed**: Average value observed for this variable across all samples
- **Near-Miss Rate**: Percentage of ALL samples where the value was within epsilon of the threshold (close calls)
- **Epsilon**: The tolerance distance used to detect near-misses (typically 5% of value range)
- **Last-Mile Failure Rate**: Failure rate only among samples where ALL OTHER clauses passed; reveals if this clause is the final bottleneck
- **Ceiling Gap**: (Threshold - Max Observed). Positive = threshold is unreachable; negative = threshold is achievable

### Tunability Levels
- **High**: >10% near-miss rate; threshold adjustments will help significantly
- **Moderate**: 2-10% near-miss rate; threshold adjustments may help somewhat
- **Low**: <2% near-miss rate; threshold adjustments won't help; fix upstream

### Severity Levels
- **Critical**: Ceiling detected or fundamentally broken condition
- **High**: Decisive blocker with tuning potential
- **Medium**: Moderate contributor to failures
- **Low**: Other clauses fail first; lower priority

### Recommended Actions
- **redesign**: Condition is fundamentally problematic; rethink the logic
- **tune_threshold**: Adjust threshold value; quick win available
- **adjust_upstream**: Modify prototypes, gates, or weights that feed this variable
- **lower_priority**: Focus on other blockers first
- **investigate**: Needs further analysis

### Problem Flags
- **[CEILING]**: Threshold is unreachable (max observed never reaches threshold)
- **[DECISIVE]**: This clause is the primary bottleneck
- **[TUNABLE]**: Many samples are borderline; small adjustments help
- **[UPSTREAM]**: Values are far from threshold; fix upstream data
- **[OUTLIERS-SKEW]**: Median violation much lower than mean (outliers skew average)
- **[SEVERE-TAIL]**: Some samples fail badly while most are moderate



----

However, I suspect that the non-report output in the Monte Carlo section of expression-diagnostics.html shows information incompatible with the report:

Top Blockers
Rank	Clause	Fail %	Violation	Last-Mile	Recommendation	Severity
▼	1	AND of 19 conditions	100.00%	
worst Δ: 71.40 ((moodAxes.affiliation - previousMoodA...)
most tunable: emotions.disgust <= 0.4 (5.30%)
100.00%
Decisive blocker but values are far from threshold - adjust prototypes
critical
∧
AND of 19 conditions
100.00%
LM: 100.00%
├
●
emotions.anger >= 0.4
93.52%
Δ0.37
thresh: 0.40
max: 0.94
gap: -0.54
moderate
p50: 0.40 | p90: 0.40 | p95: 0.40 | p99: 0.40
├
●
emotions.rage < 0.55
1.94%
Δ0.09
thresh: 0.55
max: 0.94
gap: -0.55
low
p50: 0.07 | p90: 0.18 | p95: 0.22 | p99: 0.29 [OUTLIERS]
├
●
moodAxes.affiliation >= 20
59.75%
Δ60.03
thresh: 20.00
max: 100.00
gap: -80.00
low
p50: 60.00 | p90: 108.00 | p95: 114.00 | p99: 119.00
├
●
moodAxes.valence <= -10
54.58%
Δ55.29
thresh: -10.00
max: 100.00
gap: -90.00
low
p50: 55.00 | p90: 99.00 | p95: 104.00 | p99: 109.00
├
●
moodAxes.self_evaluation <= -5
52.28%
Δ52.61
thresh: -5.00
max: 100.00
gap: -95.00
low
p50: 52.00 | p90: 94.00 | p95: 100.00 | p99: 104.00
├
●
moodAxes.engagement >= 15
56.90%
Δ57.82
thresh: 15.00
max: 100.00
gap: -85.00
low
p50: 58.00 | p90: 104.00 | p95: 109.00 | p99: 114.00
├
●
moodAxes.threat >= 10
54.83%
Δ55.22
thresh: 10.00
max: 100.00
gap: -90.00
low
p50: 55.00 | p90: 99.00 | p95: 105.00 | p99: 109.00
├
●
moodAxes.threat <= 70
14.51%
Δ15.30
thresh: 70.00
max: 100.00
gap: -170.00
low
p50: 15.00 | p90: 27.00 | p95: 29.00 | p99: 30.00
├
●
moodAxes.arousal >= -5
47.02%
Δ47.69
thresh: -5.00
max: 100.00
gap: -105.00
low
p50: 48.00 | p90: 86.00 | p95: 90.00 | p99: 94.00
├
●
moodAxes.arousal <= 55
22.35%
Δ22.77
thresh: 55.00
max: 100.00
gap: -155.00
low
p50: 23.00 | p90: 41.00 | p95: 43.00 | p99: 45.00
├
●
emotions.contempt <= 0.4
7.31%
Δ0.13
thresh: 0.40
max: 0.92
gap: -0.40
moderate
p50: 0.11 | p90: 0.27 | p95: 0.31 | p99: 0.40 [OUTLIERS]
├
●
emotions.disgust <= 0.4
8.48%
Δ0.12
thresh: 0.40
max: 0.91
gap: -0.40
moderate
p50: 0.10 | p90: 0.25 | p95: 0.30 | p99: 0.38 [OUTLIERS]
├
●
emotions.hatred <= 0.35
8.07%
Δ0.14
thresh: 0.35
max: 0.89
gap: -0.35
moderate
p50: 0.12 | p90: 0.29 | p95: 0.33 | p99: 0.41 [OUTLIERS]
├
●
emotions.panic <= 0.4
0.526%
Δ0.21
thresh: 0.40
max: 0.88
gap: -0.40
low
p50: 0.20 | p90: 0.33 | p95: 0.37 | p99: 0.42
├
●
emotions.terror <= 0.5
3.10%
Δ0.10
thresh: 0.50
max: 0.90
gap: -0.50
low
p50: 0.09 | p90: 0.22 | p95: 0.26 | p99: 0.32 [OUTLIERS]
├
●
emotions.freeze <= 0.55
0.392%
Δ0.10
thresh: 0.55
max: 0.88
gap: -0.55
low
p50: 0.09 | p90: 0.20 | p95: 0.23 | p99: 0.26
├
●
emotions.dissociation <= 0.65
0.256%
Δ0.05
thresh: 0.65
max: 0.86
gap: -0.65
low
p50: 0.04 | p90: 0.11 | p95: 0.15 | p99: 0.19 [OUTLIERS]
├
∨
OR of 6 conditions
60.58% pass
├
●
emotions.sadness >= 0.22
78.92%
Δ0.21
thresh: 0.22
max: 0.99
gap: -0.77
moderate
p50: 0.22 | p90: 0.22 | p95: 0.22 | p99: 0.22
LM: N/A
├
●
emotions.grief >= 0.18
84.37%
Δ0.18
thresh: 0.18
max: 0.98
gap: -0.80
low
p50: 0.18 | p90: 0.18 | p95: 0.18 | p99: 0.18
LM: N/A
├
●
emotions.disappointment >= 0.25
82.34%
Δ0.24
thresh: 0.25
max: 0.96
gap: -0.71
moderate
p50: 0.25 | p90: 0.25 | p95: 0.25 | p99: 0.25
LM: N/A
├
●
emotions.regret >= 0.18
84.50%
Δ0.18
thresh: 0.18
max: 0.96
gap: -0.78
low
p50: 0.18 | p90: 0.18 | p95: 0.18 | p99: 0.18
LM: N/A
├
●
emotions.lonely_yearning >= 0.25
99.00%
Δ0.25
thresh: 0.25
max: 0.77
gap: -0.52
low
p50: 0.25 | p90: 0.25 | p95: 0.25 | p99: 0.25
LM: N/A
├
●
emotions.embarrassment >= 0.2
85.97%
Δ0.20
thresh: 0.20
max: 0.95
gap: -0.75
moderate
p50: 0.20 | p90: 0.20 | p95: 0.20 | p99: 0.20
LM: N/A
Combined: 60.58% pass rate
Which alternatives fire (43997 total passes)
emotions.sadness >= 0.22: 47.92% (21085/43997)
emotions.embarrassment >= 0.2: 16.81% (7397/43997)
emotions.grief >= 0.18: 14.72% (6475/43997)
emotions.disappointment >= 0.25: 13.01% (5722/43997)
emotions.regret >= 0.18: 7.21% (3171/43997)
emotions.lonely_yearning >= 0.25: 0.334% (147/43997)
├
∨
OR of 5 conditions
76.24% pass
├
●
(emotions.anger - previousEmotions.anger) >= 0.08
84.56%
Δ0.14
low
p50: 0.08 | p90: 0.38 | p95: 0.52 | p99: 0.70 [OUTLIERS]
LM: N/A
├
●
(emotions.lonely_yearning - previousEmotions.lonely_yearning) >= 0.08
98.61%
Δ0.08
low
p50: 0.08 | p90: 0.08 | p95: 0.08 | p99: 0.30 [OUTLIERS]
LM: N/A
├
●
(moodAxes.self_evaluation - previousMoodAxes.self_evaluation) <= -10
54.76%
Δ70.57
low
p50: 62.00 | p90: 144.00 | p95: 164.00 | p99: 189.00 [OUTLIERS]
LM: N/A
├
●
(moodAxes.affiliation - previousMoodAxes.affiliation) <= -12
55.40%
Δ71.40
low
p50: 63.00 | p90: 145.00 | p95: 164.00 | p99: 190.00 [OUTLIERS]
LM: N/A
├
∧
AND of 2 conditions
93.93%
├
●
previousEmotions.anger < 0.4
6.38%
Δ0.13
thresh: 0.40
max: 0.92
gap: -0.40
moderate
p50: 0.11 | p90: 0.26 | p95: 0.32 | p99: 0.40 [OUTLIERS]
LM: N/A
├
●
emotions.anger >= 0.4
93.52%
Δ0.37
thresh: 0.40
max: 0.94
gap: -0.54
moderate
p50: 0.40 | p90: 0.40 | p95: 0.40 | p99: 0.40
LM: N/A
Combined: 76.24% pass rate
Which alternatives fire (74412 total passes)
(moodAxes.self_evaluation - previousMoodAxes.self_evaluation) <= -10: 50.66% (37698/74412)
(moodAxes.affiliation - previousMoodAxes.affiliation) <= -12: 27.32% (20328/74412)
(emotions.anger - previousEmotions.anger) >= 0.08: 20.75% (15442/74412)
(emotions.lonely_yearning - previousEmotions.lonely_yearning) >= 0.08: 1.25% (932/74412)
AND of 2 conditions: 0.016% (12/74412)

