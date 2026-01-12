# Monte Carlo Report Integrity Warnings

We have this Monte Carlo simulation report:

# Monte Carlo Analysis Report

**Expression**: hurt_anger
**Generated**: 2026-01-12T14:25:41.717Z
**Distribution**: uniform
**Sample Size**: 100000
**Sampling Mode**: static - Prototype-gated sampling (emotions derived from mood axes; not independent)
**Regime Note**: Report includes global vs in-regime (mood-pass) statistics

> **Note**: Emotions are computed via prototype gates, so emotion variables are not independent of mood axes.

---

## Population Summary

- **Total samples**: 100.000 (in-regime 336; 0.34%)
- **Stored contexts**: 10.000 of 100.000 (in-regime 35; 0.35%; limit 10.000)
- **Mood regime**: AND-only mood constraints from prerequisites (moodAxes.* or mood.*).
> **Note**: Stored contexts are capped at 10.000, so sections labeled "Population: stored-*" may not match full-sample counts.


---

## Executive Summary

**Trigger Rate**: 0.00% (95% CI: 0.00% - 0.0038%)
**Rarity**: unobserved (not triggered in 100000 samples—trigger rate is below 0.0038% upper bound, not logically impossible)

Expression never triggers. Primary blocker: AND of 19 conditions Focus on "AND of 19 conditions" (100.0% last-mile failure).

---

## Sampling Coverage

**Sampling Mode**: static

### Summary by Domain

| Domain | Variables | Range Coverage | Bin Coverage | Tail Low | Tail High | Rating |
|--------|-----------|----------------|--------------|----------|-----------|--------|
| emotions | 15 | 92.23% | 94.67% | 86.99% | 0.0096% | good |
| moodAxes | 6 | 100.00% | 100.00% | 10.23% | 10.22% | good |
| previousEmotions | 2 | 84.15% | 85.00% | 91.15% | 0.00% | good |
| previousMoodAxes | 2 | 100.00% | 100.00% | 10.23% | 10.19% | good |

### Lowest Coverage Variables

| Variable | Range Coverage | Bin Coverage | Tail Low | Tail High | Rating |
|----------|----------------|--------------|----------|-----------|--------|
| previousEmotions.lonely_yearning | 78.71% | 80.00% | 98.68% | 0.00% | good |
| emotions.lonely_yearning | 81.19% | 90.00% | 98.72% | 0.00% | good |
| emotions.dissociation | 85.91% | 90.00% | 98.05% | 0.00% | good |
| emotions.freeze | 88.31% | 70.00% | 99.33% | 0.00% | good |
| emotions.contempt | 89.30% | 90.00% | 83.31% | 0.00% | good |

Notes:
- Range coverage is observed span divided by domain span.
- Bin coverage is occupancy across 10 equal-width bins.
- Tail coverage is the share of samples in the bottom/top 10.00% of the domain.
- Variables with unknown domain ranges are excluded from summaries.

### Coverage Conclusions

- emotions: upper tail is effectively untested (top 10% has 0.0096% of samples). High-threshold feasibility results are not trustworthy here.
- previousEmotions: upper tail is effectively untested (top 10% has 0.0000% of samples). High-threshold feasibility results are not trustworthy here.
- moodAxes: coverage looks healthy (full range, bins filled, tails represented). Feasibility failures here likely reflect true constraint strictness.
- previousMoodAxes: coverage looks healthy (full range, bins filled, tails represented). Feasibility failures here likely reflect true constraint strictness.
- Across variables: 17 show near-zero upper-tail coverage; 1 show truncated range. Those regions are effectively unvalidated by current sampling.
- Do not trust feasibility estimates for prerequisites that target the upper end of a domain; the sampler is not generating those states often enough to test them.
- Worst range coverage: min=79%.
- Worst upper-tail coverage: min tailHigh=0.0000%.
- Worst lower-tail coverage: min tailLow=10.1120%.

---

## Ground-Truth Witnesses

No triggering states found during simulation.


---

## Blocker Analysis
Signal: final (gate-clamped intensity).

### Blocker #1: `AND of 19 conditions`

**Condition**: Compound AND block
**Fail% global**: 100.00% (100000 / 100000)
**Fail% | mood-pass**: 100.00% (336 / 336)
**Severity**: critical
**Redundant in regime**: N/A

#### Flags
[DECISIVE] [UPSTREAM]

#### Condition Breakdown

**Required Conditions (ALL must pass)**

| # | Condition | Fail% global | Fail% \| mood-pass | Support | Bound | Threshold | Gap | Tunable | Redundant (regime) | Sole-Blocker Rate | Gate clamp (mood) | Pass \| gate (mood) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `emotions.anger >= 0.4` | 93.64% | 87.20% (293 / 336) | 100000 | 0.94 | 0.40 | -0.54 | moderate | no | 100.00% (N=158) | 23.51% (79 / 336) | 16.73% (43 / 257) |
| 2 | `emotions.rage < 0.55` | 1.83% | 0.30% (1 / 336) | 100000 | 0.00 | 0.55 | -0.55 | low | no | N/A | 51.49% (173 / 336) | 99.39% (162 / 163) |
| 3 | `moodAxes.affiliation >= 20` | 59.66% | 0.00% (0 / 336) | 100000 | 100.00 | 20.00 | -80.00 | moderate | yes | 100.00% (N=7)⚠️ | N/A | N/A |
| 4 | `moodAxes.valence <= -10` | 54.66% | 0.00% (0 / 336) | 100000 | -100.00 | -10.00 | -90.00 | moderate | yes | N/A | N/A | N/A |
| 5 | `moodAxes.self_evaluation <= -5` | 52.39% | 0.00% (0 / 336) | 100000 | -100.00 | -5.00 | -95.00 | moderate | yes | N/A | N/A | N/A |
| 6 | `moodAxes.engagement >= 15` | 57.04% | 0.00% (0 / 336) | 100000 | 100.00 | 15.00 | -85.00 | moderate | yes | N/A | N/A | N/A |
| 7 | `moodAxes.threat >= 10` | 54.66% | 0.00% (0 / 336) | 100000 | 100.00 | 10.00 | -90.00 | moderate | yes | N/A | N/A | N/A |
| 8 | `moodAxes.threat <= 70` | 14.65% | 0.00% (0 / 336) | 100000 | -100.00 | 70.00 | -170.00 | moderate | yes | 100.00% (N=2)⚠️ | N/A | N/A |
| 9 | `moodAxes.arousal >= -5` | 47.14% | 0.00% (0 / 336) | 100000 | 100.00 | -5.00 | -105.00 | moderate | yes | N/A | N/A | N/A |
| 10 | `moodAxes.arousal <= 55` | 22.18% | 0.00% (0 / 336) | 100000 | -100.00 | 55.00 | -155.00 | moderate | yes | 100.00% (N=3)⚠️ | N/A | N/A |
| 11 | `emotions.contempt <= 0.4` | 7.25% | 0.60% (2 / 336) | 100000 | 0.00 | 0.40 | -0.40 | moderate | no | N/A | 59.82% (201 / 336) | 98.52% (133 / 135) |
| 12 | `emotions.disgust <= 0.4` | 8.57% | 0.00% (0 / 336) | 100000 | 0.00 | 0.40 | -0.40 | moderate | yes | N/A | 16.07% (54 / 336) | 100.00% (282 / 282) |
| 13 | `emotions.hatred <= 0.35` | 7.91% | 37.80% (127 / 336) | 100000 | 0.00 | 0.35 | -0.35 | moderate | no | 100.00% (N=39) | 33.04% (111 / 336) | 43.56% (98 / 225) |
| 14 | `emotions.panic <= 0.4` | 0.50% | 0.00% (0 / 336) | 100000 | 0.00 | 0.40 | -0.40 | low | yes | N/A | 100.00% (336 / 336) | N/A |
| 15 | `emotions.terror <= 0.5` | 3.15% | 6.55% (22 / 336) | 100000 | 0.00 | 0.50 | -0.50 | moderate | no | N/A | 84.82% (285 / 336) | 56.86% (29 / 51) |
| 16 | `emotions.freeze <= 0.55` | 0.43% | 7.14% (24 / 336) | 100000 | 0.00 | 0.55 | -0.55 | low | no | N/A | 86.01% (289 / 336) | 51.06% (24 / 47) |
| 17 | `emotions.dissociation <= 0.65` | 0.25% | 0.00% (0 / 336) | 100000 | 0.00 | 0.65 | -0.65 | low | yes | N/A | 100.00% (336 / 336) | N/A |

**OR Block #1 (ANY ONE must pass)**

| # | Condition | Fail% global | Fail% \| mood-pass | Support | Bound | Threshold | Gap | Tunable | Redundant (regime) | Sole-Blocker Rate | Gate clamp (mood) | Pass \| gate (mood) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 18 | `emotions.sadness >= 0.22` | 78.72% | 77.38% (260 / 336) | 100000 | 0.98 | 0.22 | -0.76 | moderate | no | N/A (OR alt) | 69.05% (232 / 336) | 66.35% (69 / 104) |
| 19 | `emotions.grief >= 0.18` | 84.31% | 22.62% (76 / 336) | 100000 | 0.97 | 0.18 | -0.79 | low | no | N/A (OR alt) | 16.07% (54 / 336) | 92.20% (260 / 282) |
| 20 | `emotions.disappointment >= 0.25` | 82.16% | 59.23% (199 / 336) | 100000 | 0.97 | 0.25 | -0.72 | moderate | no | N/A (OR alt) | 53.57% (180 / 336) | 87.82% (137 / 156) |
| 21 | `emotions.regret >= 0.18` | 84.42% | 28.27% (95 / 336) | 100000 | 0.96 | 0.18 | -0.78 | low | no | N/A (OR alt) | 25.89% (87 / 336) | 96.79% (241 / 249) |
| 22 | `emotions.lonely_yearning >= 0.25` | 99.07% | 85.71% (288 / 336) | 100000 | 0.81 | 0.25 | -0.56 | low | no | N/A (OR alt) | 86.01% (289 / 336) | 100.00% (47 / 47) |
| 23 | `emotions.embarrassment >= 0.2` | 85.89% | 20.54% (69 / 336) | 100000 | 0.94 | 0.20 | -0.74 | moderate | no | N/A (OR alt) | 19.64% (66 / 336) | 98.89% (267 / 270) |

**Combined OR Block**: 60.83% pass rate (Fail% global: 39.17% | Fail% \| mood-pass: 1.19%)

**OR Block #1 OR Alternative Coverage** (44102 total successes):

| Alternative | P(alt passes \| OR pass) | P(alt exclusively passes \| OR pass) | First-pass share (order-dependent) |
|------------|---------------------------|------------------------------------|------------------------------------|
| `emotions.sadness >= 0.22` | 48.26% (21283/44102) | 9.61% (4237/44102) | 48.26% (21283/44102) |
| `emotions.disappointment >= 0.25` | 40.44% (17837/44102) | 8.08% (3565/44102) | 13.05% (5755/44102) |
| `emotions.grief >= 0.18` | 35.58% (15690/44102) | 4.54% (2003/44102) | 14.61% (6444/44102) |
| `emotions.regret >= 0.18` | 35.33% (15581/44102) | 4.16% (1834/44102) | 7.07% (3117/44102) |
| `emotions.embarrassment >= 0.2` | 32.00% (14112/44102) | 16.75% (7388/44102) | 16.75% (7388/44102) |
| `emotions.lonely_yearning >= 0.25` | 2.10% (928/44102) | 0.24% (106/44102) | 0.26% (115/44102) |
*First-pass share is order-dependent; use pass/exclusive rates for order-independent attribution.*

**OR Block #2 (ANY ONE must pass)**

| # | Condition | Fail% global | Fail% \| mood-pass | Support | Bound | Threshold | Gap | Tunable | Redundant (regime) | Sole-Blocker Rate | Gate clamp (mood) | Pass \| gate (mood) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 24 | `(emotions.anger - previousEmotions.anger) >= 0.08` | 84.84% | 50.00% (168 / 336) | 100000 | - | - | - | low | N/A | N/A (OR alt) | N/A | N/A |
| 25 | `(emotions.lonely_yearning - previousEmotions.lonely_yearning) >= 0.08` | 98.70% | 85.71% (288 / 336) | 100000 | - | - | - | low | N/A | N/A (OR alt) | N/A | N/A |
| 26 | `(moodAxes.self_evaluation - previousMoodAxes.self_evaluation) <= -10` | 54.76% | 27.68% (93 / 336) | 100000 | - | - | - | low | N/A | N/A (OR alt) | N/A | N/A |
| 27 | `(moodAxes.affiliation - previousMoodAxes.affiliation) <= -12` | 55.76% | 87.50% (294 / 336) | 100000 | - | - | - | low | N/A | N/A (OR alt) | N/A | N/A |
|  | **AND Group (2 conditions - all must pass together)** |  |  |  |  |  |  |  |  |  |  |  |
| 28 | `└─ previousEmotions.anger < 0.4` | 6.34% | 3.87% (13 / 336) | 100000 | 0.00 | 0.40 | -0.40 | moderate | no | N/A (OR alt) | 80.36% (270 / 336) | 80.30% (53 / 66) |
| 29 | `└─ emotions.anger >= 0.4` | 93.64% | 87.20% (293 / 336) | 100000 | 0.94 | 0.40 | -0.54 | moderate | no | N/A (OR alt) | 23.51% (79 / 336) | 16.73% (43 / 257) |

**Combined OR Block**: 75.96% pass rate (Fail% global: 24.04% | Fail% \| mood-pass: 7.44%)

**OR Block #2 OR Alternative Coverage** (74141 total successes):

| Alternative | P(alt passes \| OR pass) | P(alt exclusively passes \| OR pass) | First-pass share (order-dependent) |
|------------|---------------------------|------------------------------------|------------------------------------|
| `(moodAxes.self_evaluation - previousMoodAxes.self_evaluation) <= -10` | 61.01% (45237/74141) | 28.86% (21398/74141) | 51.24% (37992/74141) |
| `(moodAxes.affiliation - previousMoodAxes.affiliation) <= -12` | 59.67% (44242/74141) | 27.09% (20087/74141) | 27.10% (20094/74141) |
| `(emotions.anger - previousEmotions.anger) >= 0.08` | 20.44% (15155/74141) | 3.72% (2760/74141) | 20.44% (15155/74141) |
| `(AND: previousEmotions.anger < 0.4 & emotions.anger >= 0.4)` | 8.07% (5980/74141) | 0.0094% (7/74141) | 0.0094% (7/74141) |
| `(emotions.lonely_yearning - previousEmotions.lonely_yearning) >= 0.08` | 1.75% (1297/74141) | 0.41% (305/74141) | 1.20% (893/74141) |
*First-pass share is order-dependent; use pass/exclusive rates for order-independent attribution.*

#### Worst Offender Analysis

**#1: `emotions.anger >= 0.4`** (Fail% global: 93.64% | Fail% \| mood-pass: N/A)

**#2: `emotions.lonely_yearning >= 0.25`** ⚠️ OR-alternative (Fail% global: 99.07% | Fail% \| mood-pass: N/A)
- ℹ️ This is an alternative within an OR block; other alternatives may cover this case

**#3: `(emotions.lonely_yearning - previousEmotions.lonely_yearning) >= 0.08`** ⚠️ OR-alternative (Fail% global: 98.70% | Fail% \| mood-pass: N/A)
- ℹ️ This is an alternative within an OR block; other alternatives may cover this case

**#4: `emotions.embarrassment >= 0.2`** ⚠️ OR-alternative (Fail% global: 85.89% | Fail% \| mood-pass: N/A)
- ℹ️ This is an alternative within an OR block; other alternatives may cover this case

#### Prototype Math Analysis

**Population**: stored-global (predicate: all; count: 10.000; hash: 1a309bea).
##### 🧠 anger >= 0.40 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.72]
- **Threshold**: 0.40
- **Status**: sometimes
- **Slack**: feasibility +0.321; always -0.400
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 2.90 | **Required Raw Sum**: 1.16

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.32 | 0.46 | 0.00 | 0.94 | 19.65% |
| Global | raw | 0.00 | 0.38 | 0.47 | 0.00 | 0.94 | N/A |
| In mood regime | final | 0.10 | 0.48 | 0.51 | 0.00 | 0.52 | 80.00% |
| In mood regime | raw | 0.14 | 0.48 | 0.51 | 0.00 | 0.52 | N/A |
- **Observed max (global, final)**: 0.94
- **Observed max (mood-regime, final)**: 0.52

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.80 | [-1.00, -0.10] | -1.00 | 0.800 | — |
| arousal | +0.80 | [-0.05, 0.55] | 0.55 | 0.440 | ⚠️ yes |
| agency_control | +0.70 | [-1.00, 1.00] | 1.00 | 0.700 | — |
| threat | +0.30 | [0.10, 0.70] | 0.70 | 0.210 | ⚠️ yes |
| affiliation | -0.30 | [0.20, 1.00] | 0.20 | -0.060 | ⚠️ negative_weight_high_min |

**Gates** ✅:
- ✅ `valence <= -0.15` - Satisfiable | **Observed Fail Rate**: 57.14%
- ✅ `arousal >= 0.10` - Satisfiable | **Observed Fail Rate**: 53.86%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **affiliation**: Has negative weight (-0.30) but constraint requires min 0.20

**Analysis**: Threshold 0.4 is achievable (max: 0.721). Binding conflicts: affiliation has negative weight (-0.30) but constraint requires min=0.20



##### 🧠 rage < 0.55 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.70]
- **Threshold**: 0.55
- **Status**: sometimes
- **Slack**: feasibility +0.550; always -0.150
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 3.50 | **Required Raw Sum**: 1.93

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.25 | 0.43 | 0.00 | 0.94 | 14.74% |
| Global | raw | 0.00 | 0.37 | 0.47 | 0.00 | 0.94 | N/A |
| In mood regime | final | 0.00 | 0.46 | 0.48 | 0.00 | 0.49 | 48.57% |
| In mood regime | raw | 0.14 | 0.46 | 0.48 | 0.00 | 0.49 | N/A |
- **Observed max (global, final)**: 0.94
- **Observed max (mood-regime, final)**: 0.49

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.90 | [-1.00, -0.10] | -1.00 | 0.900 | — |
| arousal | +1.00 | [-0.05, 0.55] | 0.55 | 0.550 | ⚠️ yes |
| agency_control | +0.80 | [-1.00, 1.00] | 1.00 | 0.800 | — |
| threat | +0.40 | [0.10, 0.70] | 0.70 | 0.280 | ⚠️ yes |
| affiliation | -0.40 | [0.20, 1.00] | 0.20 | -0.080 | ⚠️ negative_weight_high_min |

**Gates** ✅:
- ✅ `valence <= -0.25` - Satisfiable | **Observed Fail Rate**: 62.26%
- ✅ `arousal >= 0.25` - Satisfiable | **Observed Fail Rate**: 61.11%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **affiliation**: Has negative weight (-0.40) but constraint requires min 0.20

**Analysis**: Threshold 0.55 is achievable (min: 0.000). Binding conflicts: affiliation has negative weight (-0.40) but constraint requires min=0.20

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 contempt <= 0.40 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.55]
- **Threshold**: 0.40
- **Status**: sometimes
- **Slack**: feasibility +0.400; always -0.148
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 2.30 | **Required Raw Sum**: 0.92

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.34 | 0.48 | 0.00 | 0.87 | 18.72% |
| Global | raw | 0.00 | 0.39 | 0.48 | 0.00 | 0.87 | N/A |
| In mood regime | final | 0.00 | 0.22 | 0.26 | 0.00 | 0.30 | 34.29% |
| In mood regime | raw | 0.00 | 0.22 | 0.26 | 0.00 | 0.30 | N/A |
- **Observed max (global, final)**: 0.87
- **Observed max (mood-regime, final)**: 0.30

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.60 | [-1.00, -0.10] | -1.00 | 0.600 | — |
| agency_control | +0.80 | [-1.00, 1.00] | 1.00 | 0.800 | — |
| engagement | -0.20 | [0.15, 1.00] | 0.15 | -0.030 | ⚠️ negative_weight_high_min |
| self_evaluation | +0.20 | [-1.00, -0.05] | -0.05 | -0.010 | ⚠️ positive_weight_low_max |
| affiliation | -0.50 | [0.20, 1.00] | 0.20 | -0.100 | ⚠️ negative_weight_high_min |

**Gates** ✅:
- ✅ `valence <= -0.10` - Satisfiable | **Observed Fail Rate**: 54.87%
- ✅ `agency_control >= 0.20` - Satisfiable | **Observed Fail Rate**: 58.86%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **engagement**: Has negative weight (-0.20) but constraint requires min 0.15
- ⚠️ **self_evaluation**: Has positive weight (+0.20) but constraint limits max to -0.05
- ⚠️ **affiliation**: Has negative weight (-0.50) but constraint requires min 0.20

**Analysis**: Threshold 0.4 is achievable (min: 0.000). Binding conflicts: engagement has negative weight (-0.20) but constraint requires min=0.15; self_evaluation has positive weight (+0.20) but constraint limits it to max=-0.05; affiliation has negative weight (-0.50) but constraint requires min=0.20

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 disgust <= 0.40 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.46]
- **Threshold**: 0.40
- **Status**: sometimes
- **Slack**: feasibility +0.400; always -0.056
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 2.40 | **Required Raw Sum**: 0.96

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.37 | 0.48 | 0.00 | 0.86 | 37.74% |
| Global | raw | 0.00 | 0.39 | 0.49 | 0.00 | 0.86 | N/A |
| In mood regime | final | 0.05 | 0.16 | 0.21 | 0.00 | 0.25 | 77.14% |
| In mood regime | raw | 0.05 | 0.16 | 0.21 | 0.00 | 0.25 | N/A |
- **Observed max (global, final)**: 0.86
- **Observed max (mood-regime, final)**: 0.25

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.90 | [-1.00, -0.10] | -1.00 | 0.900 | — |
| arousal | +0.40 | [-0.05, 0.55] | 0.55 | 0.220 | ⚠️ yes |
| engagement | -0.30 | [0.15, 1.00] | 0.15 | -0.045 | ⚠️ negative_weight_high_min |
| threat | +0.20 | [0.10, 0.70] | 0.70 | 0.140 | ⚠️ yes |
| affiliation | -0.60 | [0.20, 1.00] | 0.20 | -0.120 | ⚠️ negative_weight_high_min |

**Gates** ✅:
- ✅ `valence <= -0.25` - Satisfiable | **Observed Fail Rate**: 62.26%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **engagement**: Has negative weight (-0.30) but constraint requires min 0.15
- ⚠️ **affiliation**: Has negative weight (-0.60) but constraint requires min 0.20

**Analysis**: Threshold 0.4 is achievable (min: 0.000). Binding conflicts: engagement has negative weight (-0.30) but constraint requires min=0.15; affiliation has negative weight (-0.60) but constraint requires min=0.20

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 hatred <= 0.35 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.87]
- **Threshold**: 0.35
- **Status**: sometimes
- **Slack**: feasibility +0.350; always -0.517
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 2.70 | **Required Raw Sum**: 0.94

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.29 | 0.45 | 0.00 | 0.89 | 17.37% |
| Global | raw | 0.00 | 0.38 | 0.47 | 0.00 | 0.89 | N/A |
| In mood regime | final | 0.20 | 0.64 | 0.68 | 0.00 | 0.70 | 65.71% |
| In mood regime | raw | 0.28 | 0.64 | 0.68 | 0.07 | 0.70 | N/A |
- **Observed max (global, final)**: 0.89
- **Observed max (mood-regime, final)**: 0.70

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.90 | [-1.00, -0.10] | -1.00 | 0.900 | — |
| arousal | +0.60 | [-0.05, 0.55] | 0.55 | 0.330 | ⚠️ yes |
| agency_control | +0.60 | [-1.00, 1.00] | 1.00 | 0.600 | — |
| engagement | +0.30 | [0.15, 1.00] | 1.00 | 0.300 | — |
| threat | +0.30 | [0.10, 0.70] | 0.70 | 0.210 | ⚠️ yes |

**Gates** ✅:
- ✅ `valence <= -0.25` - Satisfiable | **Observed Fail Rate**: 62.26%
- ✅ `arousal >= 0.10` - Satisfiable | **Observed Fail Rate**: 53.86%

**Binding Axes**: arousal, threat (constraints limit optimal values)

**Analysis**: Threshold 0.35 is achievable (min: 0.000)

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 panic <= 0.40 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.84]
- **Threshold**: 0.40
- **Status**: sometimes
- **Slack**: feasibility +0.400; always -0.437
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 4.60 | **Required Raw Sum**: 1.84

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.76 | 0.49% |
| Global | raw | 0.00 | 0.33 | 0.42 | 0.00 | 0.79 | N/A |
| In mood regime | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00% |
| In mood regime | raw | 0.29 | 0.54 | 0.57 | 0.05 | 0.61 | N/A |
- **Observed max (global, final)**: 0.76
- **Observed max (mood-regime, final)**: 0.00

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| threat | +1.00 | [0.10, 0.70] | 0.70 | 0.700 | ⚠️ yes |
| arousal | +1.00 | [-0.05, 0.55] | 0.55 | 0.550 | ⚠️ yes |
| agency_control | -1.00 | [-1.00, 1.00] | -1.00 | 1.000 | — |
| valence | -0.70 | [-1.00, -0.10] | -1.00 | 0.700 | — |
| engagement | +0.55 | [0.15, 1.00] | 1.00 | 0.550 | — |
| future_expectancy | -0.35 | [-1.00, 1.00] | -1.00 | 0.350 | — |

**Gates** ✅:
- ✅ `threat >= 0.50` - Satisfiable | **Observed Fail Rate**: 73.90%
- ✅ `arousal >= 0.55` - Satisfiable | **Observed Fail Rate**: 76.51%
- ✅ `agency_control <= -0.10` - Satisfiable | **Observed Fail Rate**: 54.83%
- ✅ `valence <= -0.15` - Satisfiable | **Observed Fail Rate**: 57.14%
- ✅ `engagement >= 0.10` - Satisfiable | **Observed Fail Rate**: 54.12%

**Binding Axes**: threat, arousal (constraints limit optimal values)

**Analysis**: Threshold 0.4 is achievable (min: 0.000)

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 terror <= 0.50 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.77]
- **Threshold**: 0.50
- **Status**: sometimes
- **Slack**: feasibility +0.500; always -0.266
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 3.20 | **Required Raw Sum**: 1.60

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.00 | 0.45 | 0.00 | 0.86 | 9.85% |
| Global | raw | 0.00 | 0.40 | 0.49 | 0.00 | 0.86 | N/A |
| In mood regime | final | 0.00 | 0.39 | 0.56 | 0.00 | 0.61 | 17.14% |
| In mood regime | raw | 0.35 | 0.49 | 0.56 | 0.19 | 0.61 | N/A |
- **Observed max (global, final)**: 0.86
- **Observed max (mood-regime, final)**: 0.61

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| threat | +1.00 | [0.10, 0.70] | 0.70 | 0.700 | ⚠️ yes |
| arousal | +1.00 | [-0.05, 0.55] | 0.55 | 0.550 | ⚠️ yes |
| valence | -0.60 | [-1.00, -0.10] | -1.00 | 0.600 | — |
| agency_control | -0.35 | [-1.00, 1.00] | -1.00 | 0.350 | — |
| engagement | +0.25 | [0.15, 1.00] | 1.00 | 0.250 | — |

**Gates** ✅:
- ✅ `threat >= 0.50` - Satisfiable | **Observed Fail Rate**: 73.90%
- ✅ `arousal >= 0.30` - Satisfiable | **Observed Fail Rate**: 64.04%

**Binding Axes**: threat, arousal (constraints limit optimal values)

**Analysis**: Threshold 0.5 is achievable (min: 0.000)

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 freeze <= 0.55 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.84]
- **Threshold**: 0.55
- **Status**: sometimes
- **Slack**: feasibility +0.550; always -0.289
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 2.75 | **Required Raw Sum**: 1.51

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.87 | 0.67% |
| Global | raw | 0.00 | 0.42 | 0.52 | 0.00 | 0.92 | N/A |
| In mood regime | final | 0.00 | 0.56 | 0.57 | 0.00 | 0.70 | 17.14% |
| In mood regime | raw | 0.30 | 0.56 | 0.57 | 0.00 | 0.70 | N/A |
- **Observed max (global, final)**: 0.87
- **Observed max (mood-regime, final)**: 0.70

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| threat | +1.00 | [0.10, 0.70] | 0.70 | 0.700 | ⚠️ yes |
| agency_control | -1.00 | [-1.00, 1.00] | -1.00 | 1.000 | — |
| valence | -0.35 | [-1.00, -0.10] | -1.00 | 0.350 | — |
| arousal | -0.15 | [-0.05, 0.55] | -0.05 | 0.007 | ⚠️ yes |
| engagement | +0.25 | [0.15, 1.00] | 1.00 | 0.250 | — |

**Gates** ✅:
- ✅ `threat >= 0.35` - Satisfiable | **Observed Fail Rate**: 66.16%
- ✅ `agency_control <= -0.30` - Satisfiable | **Observed Fail Rate**: 64.23%
- ✅ `valence <= -0.05` - Satisfiable | **Observed Fail Rate**: 52.31%
- ✅ `arousal >= -0.10` - Satisfiable | **Observed Fail Rate**: 45.44%
- ✅ `arousal <= 0.40` - Satisfiable | **Observed Fail Rate**: 30.56%
- ✅ `engagement >= 0.05` - Satisfiable | **Observed Fail Rate**: 51.60%

**Binding Axes**: threat, arousal (constraints limit optimal values)

**Analysis**: Threshold 0.55 is achievable (min: 0.000)

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 dissociation <= 0.65 ✅ ALWAYS

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.51]
- **Threshold**: 0.65
- **Status**: always
- **Slack**: feasibility +0.650; always +0.145
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 3.45 | **Required Raw Sum**: 2.24

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.78 | 1.82% |
| Global | raw | 0.00 | 0.35 | 0.45 | 0.00 | 0.79 | N/A |
| In mood regime | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00% |
| In mood regime | raw | 0.00 | 0.16 | 0.25 | 0.00 | 0.26 | N/A |
- **Observed max (global, final)**: 0.78
- **Observed max (mood-regime, final)**: 0.00

**Gate Compatibility (mood regime)**: ❌ incompatible - gate "engagement <= -0.20" conflicts with mood regime engagement in [0.15, 1]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| threat | +0.75 | [0.10, 0.70] | 0.70 | 0.525 | ⚠️ yes |
| agency_control | -0.85 | [-1.00, 1.00] | -1.00 | 0.850 | — |
| engagement | -1.00 | [0.15, 1.00] | 0.15 | -0.150 | ⚠️ negative_weight_high_min |
| arousal | -0.35 | [-0.05, 0.55] | -0.05 | 0.017 | ⚠️ yes |
| valence | -0.15 | [-1.00, -0.10] | -1.00 | 0.150 | — |
| future_expectancy | -0.25 | [-1.00, 1.00] | -1.00 | 0.250 | — |
| self_evaluation | -0.10 | [-1.00, -0.05] | -1.00 | 0.100 | — |

**Gates** ❌:
- ✅ `threat >= 0.35` - Satisfiable | **Observed Fail Rate**: 66.16%
- ✅ `agency_control <= -0.20` - Satisfiable | **Observed Fail Rate**: 59.59%
- ❌ `engagement <= -0.20` - Constraint min (0.15) > gate requirement (-0.2) | **Observed Fail Rate**: 59.12%
- ✅ `arousal <= 0.35` - Satisfiable | **Observed Fail Rate**: 32.85%
- ✅ `valence <= 0.10` - Satisfiable | **Observed Fail Rate**: 45.95%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **engagement**: Has negative weight (-1.00) but constraint requires min 0.15

**Analysis**: Condition always satisfied by axis bounds but gates are blocked. Binding conflicts: engagement has negative weight (-1.00) but constraint requires min=0.15. Blocked gates: engagement <= -0.20

**Recommendation**: Always satisfies threshold within constraints.

##### 🧠 sadness >= 0.22 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.74]
- **Threshold**: 0.22
- **Status**: sometimes
- **Slack**: feasibility +0.516; always -0.220
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 1.80 | **Required Raw Sum**: 0.40

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.49 | 0.61 | 0.00 | 0.96 | 23.89% |
| Global | raw | 0.00 | 0.50 | 0.61 | 0.00 | 0.96 | N/A |
| In mood regime | final | 0.00 | 0.30 | 0.51 | 0.00 | 0.52 | 20.00% |
| In mood regime | raw | 0.17 | 0.50 | 0.52 | 0.00 | 0.59 | N/A |
- **Observed max (global, final)**: 0.96
- **Observed max (mood-regime, final)**: 0.52

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -1.00 | [-1.00, -0.10] | -1.00 | 1.000 | — |
| arousal | -0.50 | [-0.05, 0.55] | -0.05 | 0.025 | ⚠️ yes |
| agency_control | -0.30 | [-1.00, 1.00] | -1.00 | 0.300 | — |

**Gates** ✅:
- ✅ `valence <= -0.20` - Satisfiable | **Observed Fail Rate**: 59.72%
- ✅ `arousal <= 0.20` - Satisfiable | **Observed Fail Rate**: 40.54%

**Binding Axes**: arousal (constraints limit optimal values)

**Analysis**: Threshold 0.22 is achievable (max: 0.736)



##### 🧠 grief >= 0.18 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.88]
- **Threshold**: 0.18
- **Status**: sometimes
- **Slack**: feasibility +0.696; always -0.180
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 2.30 | **Required Raw Sum**: 0.41

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.37 | 0.51 | 0.00 | 0.93 | 17.07% |
| Global | raw | 0.00 | 0.42 | 0.52 | 0.00 | 0.93 | N/A |
| In mood regime | final | 0.34 | 0.50 | 0.69 | 0.00 | 0.69 | 77.14% |
| In mood regime | raw | 0.34 | 0.50 | 0.69 | 0.09 | 0.69 | N/A |
- **Observed max (global, final)**: 0.93
- **Observed max (mood-regime, final)**: 0.69

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -1.00 | [-1.00, -0.10] | -1.00 | 1.000 | — |
| arousal | -0.30 | [-0.05, 0.55] | -0.05 | 0.015 | ⚠️ yes |
| engagement | +0.60 | [0.15, 1.00] | 1.00 | 0.600 | — |
| agency_control | -0.40 | [-1.00, 1.00] | -1.00 | 0.400 | — |

**Gates** ✅:
- ✅ `valence <= -0.25` - Satisfiable | **Observed Fail Rate**: 62.26%
- ✅ `engagement >= 0.10` - Satisfiable | **Observed Fail Rate**: 54.12%

**Binding Axes**: arousal (constraints limit optimal values)

**Analysis**: Threshold 0.18 is achievable (max: 0.876)



##### 🧠 disappointment >= 0.25 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.94]
- **Threshold**: 0.25
- **Status**: sometimes
- **Slack**: feasibility +0.691; always -0.250
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 1.60 | **Required Raw Sum**: 0.40

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.46 | 0.58 | 0.00 | 0.90 | 20.97% |
| Global | raw | 0.00 | 0.47 | 0.58 | 0.00 | 0.90 | N/A |
| In mood regime | final | 0.00 | 0.58 | 0.70 | 0.00 | 0.87 | 42.86% |
| In mood regime | raw | 0.23 | 0.58 | 0.70 | 0.00 | 0.87 | N/A |
- **Observed max (global, final)**: 0.90
- **Observed max (mood-regime, final)**: 0.87

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.70 | [-1.00, -0.10] | -1.00 | 0.700 | — |
| future_expectancy | -0.60 | [-1.00, 1.00] | -1.00 | 0.600 | — |
| arousal | -0.10 | [-0.05, 0.55] | -0.05 | 0.005 | ⚠️ yes |
| agency_control | -0.20 | [-1.00, 1.00] | -1.00 | 0.200 | — |

**Gates** ✅:
- ✅ `valence <= -0.10` - Satisfiable | **Observed Fail Rate**: 54.87%
- ✅ `future_expectancy <= -0.10` - Satisfiable | **Observed Fail Rate**: 54.20%

**Binding Axes**: arousal (constraints limit optimal values)

**Analysis**: Threshold 0.25 is achievable (max: 0.941)



##### 🧠 regret >= 0.18 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.96]
- **Threshold**: 0.18
- **Status**: sometimes
- **Slack**: feasibility +0.775; always -0.180
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 2.00 | **Required Raw Sum**: 0.36

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.41 | 0.55 | 0.00 | 0.93 | 16.46% |
| Global | raw | 0.00 | 0.44 | 0.55 | 0.00 | 0.93 | N/A |
| In mood regime | final | 0.36 | 0.65 | 0.75 | 0.00 | 0.84 | 62.86% |
| In mood regime | raw | 0.37 | 0.65 | 0.75 | 0.00 | 0.84 | N/A |
- **Observed max (global, final)**: 0.93
- **Observed max (mood-regime, final)**: 0.84

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.70 | [-1.00, -0.10] | -1.00 | 0.700 | — |
| self_evaluation | -0.80 | [-1.00, -0.05] | -1.00 | 0.800 | — |
| future_expectancy | -0.30 | [-1.00, 1.00] | -1.00 | 0.300 | — |
| arousal | +0.20 | [-0.05, 0.55] | 0.55 | 0.110 | ⚠️ yes |

**Gates** ✅:
- ✅ `self_evaluation <= -0.2` - Satisfiable | **Observed Fail Rate**: 59.57%
- ✅ `valence <= -0.2` - Satisfiable | **Observed Fail Rate**: 59.72%

**Binding Axes**: arousal (constraints limit optimal values)

**Analysis**: Threshold 0.18 is achievable (max: 0.955)



##### 🧠 lonely_yearning >= 0.25 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.91]
- **Threshold**: 0.25
- **Status**: sometimes
- **Slack**: feasibility +0.659; always -0.250
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 3.50 | **Required Raw Sum**: 0.88

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.73 | 1.23% |
| Global | raw | 0.00 | 0.33 | 0.41 | 0.00 | 0.82 | N/A |
| In mood regime | final | 0.00 | 0.00 | 0.38 | 0.00 | 0.43 | 8.57% |
| In mood regime | raw | 0.43 | 0.58 | 0.60 | 0.21 | 0.61 | N/A |
- **Observed max (global, final)**: 0.73
- **Observed max (mood-regime, final)**: 0.43

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| engagement | +0.90 | [0.15, 1.00] | 1.00 | 0.900 | — |
| valence | -0.60 | [-1.00, -0.10] | -1.00 | 0.600 | — |
| future_expectancy | +0.35 | [-1.00, 1.00] | 1.00 | 0.350 | — |
| self_evaluation | -0.25 | [-1.00, -0.05] | -1.00 | 0.250 | — |
| agency_control | -0.15 | [-1.00, 1.00] | -1.00 | 0.150 | — |
| arousal | +0.10 | [-0.05, 0.55] | 0.55 | 0.055 | ⚠️ yes |
| threat | -0.25 | [0.10, 0.70] | 0.10 | -0.025 | ⚠️ negative_weight_high_min |
| affiliation | +0.90 | [0.20, 1.00] | 1.00 | 0.900 | — |

**Gates** ✅:
- ✅ `engagement >= 0.25` - Satisfiable | **Observed Fail Rate**: 61.71%
- ✅ `valence <= -0.10` - Satisfiable | **Observed Fail Rate**: 54.87%
- ✅ `threat <= 0.40` - Satisfiable | **Observed Fail Rate**: 30.92%
- ✅ `arousal >= -0.10` - Satisfiable | **Observed Fail Rate**: 45.44%
- ✅ `arousal <= 0.35` - Satisfiable | **Observed Fail Rate**: 32.85%
- ✅ `future_expectancy >= -0.05` - Satisfiable | **Observed Fail Rate**: 47.71%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **threat**: Has negative weight (-0.25) but constraint requires min 0.10

**Analysis**: Threshold 0.25 is achievable (max: 0.909). Binding conflicts: threat has negative weight (-0.25) but constraint requires min=0.10



##### 🧠 embarrassment >= 0.20 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.81]
- **Threshold**: 0.20
- **Status**: sometimes
- **Slack**: feasibility +0.607; always -0.200
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 2.10 | **Required Raw Sum**: 0.42

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.35 | 0.50 | 0.00 | 0.91 | 19.26% |
| Global | raw | 0.00 | 0.41 | 0.51 | 0.00 | 0.91 | N/A |
| In mood regime | final | 0.39 | 0.53 | 0.57 | 0.00 | 0.65 | 82.86% |
| In mood regime | raw | 0.43 | 0.53 | 0.57 | 0.19 | 0.65 | N/A |
- **Observed max (global, final)**: 0.91
- **Observed max (mood-regime, final)**: 0.65

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| self_evaluation | -0.70 | [-1.00, -0.05] | -1.00 | 0.700 | — |
| arousal | +0.50 | [-0.05, 0.55] | 0.55 | 0.275 | ⚠️ yes |
| threat | +0.60 | [0.10, 0.70] | 0.70 | 0.420 | ⚠️ yes |
| valence | -0.30 | [-1.00, -0.10] | -1.00 | 0.300 | — |

**Gates** ✅:
- ✅ `self_evaluation <= -0.10` - Satisfiable | **Observed Fail Rate**: 54.64%
- ✅ `threat >= 0.20` - Satisfiable | **Observed Fail Rate**: 58.10%

**Binding Axes**: arousal, threat (constraints limit optimal values)

**Analysis**: Threshold 0.2 is achievable (max: 0.807)



##### 🧠 anger >= 0.40 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.72]
- **Threshold**: 0.40
- **Status**: sometimes
- **Slack**: feasibility +0.321; always -0.400
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 2.90 | **Required Raw Sum**: 1.16

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.32 | 0.46 | 0.00 | 0.94 | 19.65% |
| Global | raw | 0.00 | 0.38 | 0.47 | 0.00 | 0.94 | N/A |
| In mood regime | final | 0.10 | 0.48 | 0.51 | 0.00 | 0.52 | 80.00% |
| In mood regime | raw | 0.14 | 0.48 | 0.51 | 0.00 | 0.52 | N/A |
- **Observed max (global, final)**: 0.94
- **Observed max (mood-regime, final)**: 0.52

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.80 | [-1.00, -0.10] | -1.00 | 0.800 | — |
| arousal | +0.80 | [-0.05, 0.55] | 0.55 | 0.440 | ⚠️ yes |
| agency_control | +0.70 | [-1.00, 1.00] | 1.00 | 0.700 | — |
| threat | +0.30 | [0.10, 0.70] | 0.70 | 0.210 | ⚠️ yes |
| affiliation | -0.30 | [0.20, 1.00] | 0.20 | -0.060 | ⚠️ negative_weight_high_min |

**Gates** ✅:
- ✅ `valence <= -0.15` - Satisfiable | **Observed Fail Rate**: 57.14%
- ✅ `arousal >= 0.10` - Satisfiable | **Observed Fail Rate**: 53.86%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **affiliation**: Has negative weight (-0.30) but constraint requires min 0.20

**Analysis**: Threshold 0.4 is achievable (max: 0.721). Binding conflicts: affiliation has negative weight (-0.30) but constraint requires min=0.20



#### Distribution Analysis
- **Compound Node**: Aggregated from 29 leaf conditions (19 top-level conditions; 29 when OR blocks expanded)
- **Highest Avg Violation**: 71.18 (from `(moodAxes.affiliation - previousMoodAxes.affiliation) <= -12`)
- **Highest P90 Violation**: 143.00
- **Highest P95 Violation**: 162.05
- **Highest P99 Violation**: 190.00
- **Interpretation**: Worst violator: (moodAxes.affiliation - previousMoodAxes.affiliation) <= -12

#### Ceiling Analysis
- **Compound Node**: Contains multiple conditions
- **Status**: No ceiling effects detected in leaf conditions
- **Insight**: All thresholds appear achievable based on observed values

#### Near-Miss Analysis
- **Compound Node**: Contains 29 leaf conditions
- **Most Tunable Condition**: `moodAxes.threat <= 70`
- **Near-Miss Rate**: 4.47% (epsilon: 5.00)
- **Tunability**: moderate
- **Insight**: Adjusting threshold for this condition offers the best chance of improving trigger rate

#### Sole-Blocker Analysis
- **Compound Node**: This is the only prerequisite block
- **Note**: Analyze individual leaf conditions to identify bottlenecks
- **Insight**: This compound block contains the only prerequisite; analyze individual leaf conditions for actionable insights

#### Recommendation
**Action**: adjust_upstream
**Priority**: medium
**Guidance**: Decisive blocker but values are far from threshold - adjust prototypes

---


> **Note on Sole-Blocker N values**: Each clause's N represents samples where all *other* clauses passed (excluding itself). Different clauses have different "others" sets, so N naturally varies. This is correct behavior indicating which clause is the decisive blocker when others succeed.

## Conditional Pass Rates (Given Mood Constraints Satisfied)

**Population**: stored-mood-regime (predicate: moodAxes.affiliation >= 20, moodAxes.arousal <= 55, moodAxes.arousal >= -5, moodAxes.engagement >= 15, moodAxes.self_evaluation <= -5, moodAxes.threat <= 70, moodAxes.threat >= 10, moodAxes.valence <= -10; count: 35; hash: fb21a3c1).
**Mood regime filter**: 35 contexts where all mood constraints pass
- Constraints: `moodAxes.affiliation >= 20`, `moodAxes.valence <= -10`, `moodAxes.self_evaluation <= -5`, `moodAxes.engagement >= 15`, `moodAxes.threat >= 10`, `moodAxes.threat <= 70`, `moodAxes.arousal >= -5`, `moodAxes.arousal <= 55`

| Condition | P(pass \| mood) | Passes | CI (95%) |
|-----------|-----------------|--------|----------|
| `emotions.lonely_yearning >= 0.25` | 8.57% | 3/35 | [2.96%, 22.38%] |
| `emotions.anger >= 0.4` | 14.29% | 5/35 | [6.26%, 29.38%] |
| `emotions.sadness >= 0.22` | 17.14% | 6/35 | [8.10%, 32.68%] |
| `emotions.disappointment >= 0.25` | 42.86% | 15/35 | [27.98%, 59.14%] |
| `emotions.regret >= 0.18` | 62.86% | 22/35 | [46.34%, 76.83%] |
| `emotions.hatred <= 0.35` | 71.43% | 25/35 | [54.94%, 83.67%] |
| `emotions.grief >= 0.18` | 71.43% | 25/35 | [54.94%, 83.67%] |
| `emotions.embarrassment >= 0.2` | 80.00% | 28/35 | [64.11%, 89.96%] |
| `emotions.freeze <= 0.55` | 88.57% | 31/35 | [74.05%, 95.46%] |
| `emotions.terror <= 0.5` | 94.29% | 33/35 | [81.39%, 98.42%] |
| `emotions.rage < 0.55` | 100.00% | 35/35 | [90.11%, 100.00%] |
| `emotions.contempt <= 0.4` | 100.00% | 35/35 | [90.11%, 100.00%] |
| `emotions.disgust <= 0.4` | 100.00% | 35/35 | [90.11%, 100.00%] |
| `emotions.panic <= 0.4` | 100.00% | 35/35 | [90.11%, 100.00%] |
| `emotions.dissociation <= 0.65` | 100.00% | 35/35 | [90.11%, 100.00%] |

**Interpretation**: These rates show how often each emotion condition passes
when the mood state is already suitable. Low rates indicate emotion-specific
blockers that persist even in favorable mood regimes.

---


## Global Expression Sensitivity Analysis

This section shows how adjusting thresholds affects the **entire expression trigger rate**, not just individual clause pass rates.
This is the key metric for tuning—it answers "What actually happens to the expression if I change this?"
> ⚠️ **Low confidence**: fewer than 5 baseline expression hits. Global sensitivity tables are shown for reference.

**Baseline (full sample)**: 0.00% | **Baseline (stored contexts)**: 0.00%
**Population**: stored-global (predicate: all; count: 10.000; hash: 1a309bea).
### 🎯 Global Expression Sensitivity: emotions.lonely_yearning >= [threshold]


> **Note**: This shows how the threshold change affects the WHOLE EXPRESSION trigger rate, not just the clause.

| Threshold | Trigger Rate | Change | Samples |
|-----------|--------------|--------|---------|
| 0.05 | 0.00% | 0% | 10.000 |
| 0.10 | 0.00% | 0% | 10.000 |
| 0.15 | 0.00% | 0% | 10.000 |
| 0.20 | 0.00% | 0% | 10.000 |
| **0.25** | **0.00%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 0.00% | 0% | 10.000 |
| 0.35 | 0.00% | 0% | 10.000 |
| 0.40 | 0.00% | 0% | 10.000 |
| 0.45 | 0.00% | 0% | 10.000 |

**⚠️ No Triggers Found**: None of the tested thresholds produced expression triggers. The expression may require more extreme threshold changes or other blocking conditions may dominate.

### 🎯 Global Expression Sensitivity: emotions.anger >= [threshold]


> **Note**: This shows how the threshold change affects the WHOLE EXPRESSION trigger rate, not just the clause.

| Threshold | Trigger Rate | Change | Samples |
|-----------|--------------|--------|---------|
| 0.20 | 0.03% | +∞ | 10.000 |
| 0.25 | 0.02% | +∞ | 10.000 |
| 0.30 | 0.00% | 0% | 10.000 |
| 0.35 | 0.00% | 0% | 10.000 |
| **0.40** | **0.00%** | **baseline (stored contexts)** | 10.000 |
| 0.45 | 0.00% | 0% | 10.000 |
| 0.50 | 0.00% | 0% | 10.000 |
| 0.55 | 0.00% | 0% | 10.000 |
| 0.60 | 0.00% | 0% | 10.000 |

**🎯 First threshold with triggers**: 0.20 → 0.03% trigger rate
**💡 Actionable Insight**: Adjusting threshold to 0.20 would achieve ~0.03% expression trigger rate.

### 🎯 Global Expression Sensitivity: emotions.embarrassment >= [threshold]


> **Note**: This shows how the threshold change affects the WHOLE EXPRESSION trigger rate, not just the clause.

| Threshold | Trigger Rate | Change | Samples |
|-----------|--------------|--------|---------|
| 0.00 | 0.00% | 0% | 10.000 |
| 0.05 | 0.00% | 0% | 10.000 |
| 0.10 | 0.00% | 0% | 10.000 |
| 0.15 | 0.00% | 0% | 10.000 |
| **0.20** | **0.00%** | **baseline (stored contexts)** | 10.000 |
| 0.25 | 0.00% | 0% | 10.000 |
| 0.30 | 0.00% | 0% | 10.000 |
| 0.35 | 0.00% | 0% | 10.000 |
| 0.40 | 0.00% | 0% | 10.000 |

**⚠️ No Triggers Found**: None of the tested thresholds produced expression triggers. The expression may require more extreme threshold changes or other blocking conditions may dominate.
## Marginal Clause Pass-Rate Sweep

This sweep shows how adjusting thresholds changes marginal clause pass rates across stored contexts.
It does **not** estimate overall expression trigger rate.
**Population**: stored-global (predicate: all; count: 10.000; hash: 1a309bea).
### Marginal Clause Pass-Rate Sweep: emotions.anger >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.20 | 13.71% | +104.93% | 10.000 |
| 0.25 | 12.09% | +80.72% | 10.000 |
| 0.30 | 10.38% | +55.16% | 10.000 |
| 0.35 | 8.50% | +27.06% | 10.000 |
| **0.40** | **6.69%** | **baseline (stored contexts)** | 10.000 |
| 0.45 | 5.05% | -24.51% | 10.000 |
| 0.50 | 3.57% | -46.64% | 10.000 |
| 0.55 | 2.30% | -65.62% | 10.000 |
| 0.60 | 1.38% | -79.37% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.rage < [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.35 | 92.82% | -5.26% | 10.000 |
| 0.40 | 94.31% | -3.74% | 10.000 |
| 0.45 | 95.70% | -2.32% | 10.000 |
| 0.50 | 96.92% | -1.07% | 10.000 |
| **0.55** | **97.97%** | **baseline (stored contexts)** | 10.000 |
| 0.60 | 98.72% | +0.77% | 10.000 |
| 0.65 | 99.23% | +1.29% | 10.000 |
| 0.70 | 99.59% | +1.65% | 10.000 |
| 0.75 | 99.85% | +1.92% | 10.000 |

### Marginal Clause Pass-Rate Sweep: moodAxes.affiliation >= [threshold]


| Threshold | Effective Threshold | Pass Rate | Change | Samples |
|-----------|---------------------|-----------|--------|---------|
| 16 | 16 | 42.44% | +4.97% | 10.000 |
| 17 | 17 | 41.94% | +3.73% | 10.000 |
| 18 | 18 | 41.46% | +2.55% | 10.000 |
| 19 | 19 | 41.00% | +1.41% | 10.000 |
| **20** | **20** | **40.43%** | **baseline (stored contexts)** | 10.000 |
| 21 | 21 | 39.94% | -1.21% | 10.000 |
| 22 | 22 | 39.45% | -2.42% | 10.000 |
| 23 | 23 | 38.88% | -3.83% | 10.000 |
| 24 | 24 | 38.27% | -5.34% | 10.000 |

_Thresholds are integer-effective; decimals collapse to integer boundaries._

### Marginal Clause Pass-Rate Sweep: moodAxes.valence <= [threshold]


| Threshold | Effective Threshold | Pass Rate | Change | Samples |
|-----------|---------------------|-----------|--------|---------|
| -14 | -14 | 42.91% | -3.94% | 10.000 |
| -13 | -13 | 43.31% | -3.04% | 10.000 |
| -12 | -12 | 43.75% | -2.06% | 10.000 |
| -11 | -11 | 44.23% | -0.99% | 10.000 |
| **-10** | **-10** | **44.67%** | **baseline (stored contexts)** | 10.000 |
| -9 | -9 | 45.33% | +1.48% | 10.000 |
| -8 | -8 | 45.74% | +2.40% | 10.000 |
| -7 | -7 | 46.20% | +3.43% | 10.000 |
| -6 | -6 | 46.66% | +4.45% | 10.000 |

_Thresholds are integer-effective; decimals collapse to integer boundaries._

### Marginal Clause Pass-Rate Sweep: moodAxes.self_evaluation <= [threshold]


| Threshold | Effective Threshold | Pass Rate | Change | Samples |
|-----------|---------------------|-----------|--------|---------|
| -9 | -9 | 45.38% | -4.34% | 10.000 |
| -8 | -8 | 45.88% | -3.29% | 10.000 |
| -7 | -7 | 46.45% | -2.09% | 10.000 |
| -6 | -6 | 47.03% | -0.86% | 10.000 |
| **-5** | **-5** | **47.44%** | **baseline (stored contexts)** | 10.000 |
| -4 | -4 | 47.95% | +1.08% | 10.000 |
| -3 | -3 | 48.45% | +2.13% | 10.000 |
| -2 | -2 | 49.03% | +3.35% | 10.000 |
| -1 | -1 | 49.54% | +4.43% | 10.000 |

_Thresholds are integer-effective; decimals collapse to integer boundaries._

### Marginal Clause Pass-Rate Sweep: moodAxes.engagement >= [threshold]


| Threshold | Effective Threshold | Pass Rate | Change | Samples |
|-----------|---------------------|-----------|--------|---------|
| 11 | 11 | 44.84% | +4.84% | 10.000 |
| 12 | 12 | 44.18% | +3.30% | 10.000 |
| 13 | 13 | 43.65% | +2.06% | 10.000 |
| 14 | 14 | 43.17% | +0.94% | 10.000 |
| **15** | **15** | **42.77%** | **baseline (stored contexts)** | 10.000 |
| 16 | 16 | 42.33% | -1.03% | 10.000 |
| 17 | 17 | 41.76% | -2.36% | 10.000 |
| 18 | 18 | 41.29% | -3.46% | 10.000 |
| 19 | 19 | 40.77% | -4.68% | 10.000 |

_Thresholds are integer-effective; decimals collapse to integer boundaries._

### Marginal Clause Pass-Rate Sweep: moodAxes.threat >= [threshold]


| Threshold | Effective Threshold | Pass Rate | Change | Samples |
|-----------|---------------------|-----------|--------|---------|
| 6 | 6 | 48.23% | +4.42% | 10.000 |
| 7 | 7 | 47.72% | +3.31% | 10.000 |
| 8 | 8 | 47.25% | +2.29% | 10.000 |
| 9 | 9 | 46.76% | +1.23% | 10.000 |
| **10** | **10** | **46.19%** | **baseline (stored contexts)** | 10.000 |
| 11 | 11 | 45.75% | -0.95% | 10.000 |
| 12 | 12 | 45.23% | -2.08% | 10.000 |
| 13 | 13 | 44.74% | -3.14% | 10.000 |
| 14 | 14 | 44.29% | -4.11% | 10.000 |

_Thresholds are integer-effective; decimals collapse to integer boundaries._

### Marginal Clause Pass-Rate Sweep: moodAxes.threat <= [threshold]


| Threshold | Effective Threshold | Pass Rate | Change | Samples |
|-----------|---------------------|-----------|--------|---------|
| 66 | 66 | 83.13% | -2.29% | 10.000 |
| 67 | 67 | 83.62% | -1.72% | 10.000 |
| 68 | 68 | 84.03% | -1.23% | 10.000 |
| 69 | 69 | 84.58% | -0.59% | 10.000 |
| **70** | **70** | **85.08%** | **baseline (stored contexts)** | 10.000 |
| 71 | 71 | 85.61% | +0.62% | 10.000 |
| 72 | 72 | 86.16% | +1.27% | 10.000 |
| 73 | 73 | 86.60% | +1.79% | 10.000 |
| 74 | 74 | 87.07% | +2.34% | 10.000 |

_Thresholds are integer-effective; decimals collapse to integer boundaries._

### Marginal Clause Pass-Rate Sweep: moodAxes.arousal >= [threshold]


| Threshold | Effective Threshold | Pass Rate | Change | Samples |
|-----------|---------------------|-----------|--------|---------|
| -9 | -9 | 54.59% | +3.76% | 10.000 |
| -8 | -8 | 54.01% | +2.66% | 10.000 |
| -7 | -7 | 53.61% | +1.90% | 10.000 |
| -6 | -6 | 53.06% | +0.86% | 10.000 |
| **-5** | **-5** | **52.61%** | **baseline (stored contexts)** | 10.000 |
| -4 | -4 | 52.16% | -0.86% | 10.000 |
| -3 | -3 | 51.76% | -1.62% | 10.000 |
| -2 | -2 | 51.37% | -2.36% | 10.000 |
| -1 | -1 | 50.89% | -3.27% | 10.000 |

_Thresholds are integer-effective; decimals collapse to integer boundaries._

### Marginal Clause Pass-Rate Sweep: moodAxes.arousal <= [threshold]


| Threshold | Effective Threshold | Pass Rate | Change | Samples |
|-----------|---------------------|-----------|--------|---------|
| 51 | 51 | 75.55% | -2.59% | 10.000 |
| 52 | 52 | 76.06% | -1.93% | 10.000 |
| 53 | 53 | 76.50% | -1.37% | 10.000 |
| 54 | 54 | 77.06% | -0.64% | 10.000 |
| **55** | **55** | **77.56%** | **baseline (stored contexts)** | 10.000 |
| 56 | 56 | 78.08% | +0.67% | 10.000 |
| 57 | 57 | 78.57% | +1.30% | 10.000 |
| 58 | 58 | 79.07% | +1.95% | 10.000 |
| 59 | 59 | 79.55% | +2.57% | 10.000 |

_Thresholds are integer-effective; decimals collapse to integer boundaries._

### Marginal Clause Pass-Rate Sweep: emotions.contempt <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.20 | 85.38% | -7.86% | 10.000 |
| 0.25 | 86.75% | -6.38% | 10.000 |
| 0.30 | 88.61% | -4.37% | 10.000 |
| 0.35 | 90.71% | -2.10% | 10.000 |
| **0.40** | **92.66%** | **baseline (stored contexts)** | 10.000 |
| 0.45 | 94.39% | +1.87% | 10.000 |
| 0.50 | 96.13% | +3.74% | 10.000 |
| 0.55 | 97.45% | +5.17% | 10.000 |
| 0.60 | 98.38% | +6.17% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.disgust <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.20 | 78.75% | -14.03% | 10.000 |
| 0.25 | 82.36% | -10.09% | 10.000 |
| 0.30 | 85.85% | -6.28% | 10.000 |
| 0.35 | 88.94% | -2.90% | 10.000 |
| **0.40** | **91.60%** | **baseline (stored contexts)** | 10.000 |
| 0.45 | 94.02% | +2.64% | 10.000 |
| 0.50 | 95.76% | +4.54% | 10.000 |
| 0.55 | 97.35% | +6.28% | 10.000 |
| 0.60 | 98.46% | +7.49% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.hatred <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.15 | 86.00% | -6.36% | 10.000 |
| 0.20 | 87.25% | -5.00% | 10.000 |
| 0.25 | 88.86% | -3.24% | 10.000 |
| 0.30 | 90.56% | -1.39% | 10.000 |
| **0.35** | **91.84%** | **baseline (stored contexts)** | 10.000 |
| 0.40 | 93.52% | +1.83% | 10.000 |
| 0.45 | 95.16% | +3.61% | 10.000 |
| 0.50 | 96.67% | +5.26% | 10.000 |
| 0.55 | 97.98% | +6.69% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.panic <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.20 | 99.55% | -0.02% | 10.000 |
| 0.25 | 99.55% | -0.02% | 10.000 |
| 0.30 | 99.55% | -0.02% | 10.000 |
| 0.35 | 99.55% | -0.02% | 10.000 |
| **0.40** | **99.57%** | **baseline (stored contexts)** | 10.000 |
| 0.45 | 99.58% | +0.01% | 10.000 |
| 0.50 | 99.61% | +0.04% | 10.000 |
| 0.55 | 99.65% | +0.08% | 10.000 |
| 0.60 | 99.74% | +0.17% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.terror <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.30 | 92.28% | -4.50% | 10.000 |
| 0.35 | 93.07% | -3.68% | 10.000 |
| 0.40 | 94.20% | -2.51% | 10.000 |
| 0.45 | 95.31% | -1.37% | 10.000 |
| **0.50** | **96.63%** | **baseline (stored contexts)** | 10.000 |
| 0.55 | 97.74% | +1.15% | 10.000 |
| 0.60 | 98.55% | +1.99% | 10.000 |
| 0.65 | 99.25% | +2.71% | 10.000 |
| 0.70 | 99.60% | +3.07% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.freeze <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.35 | 99.36% | -0.25% | 10.000 |
| 0.40 | 99.38% | -0.23% | 10.000 |
| 0.45 | 99.40% | -0.21% | 10.000 |
| 0.50 | 99.52% | -0.09% | 10.000 |
| **0.55** | **99.61%** | **baseline (stored contexts)** | 10.000 |
| 0.60 | 99.76% | +0.15% | 10.000 |
| 0.65 | 99.88% | +0.27% | 10.000 |
| 0.70 | 99.96% | +0.35% | 10.000 |
| 0.75 | 99.98% | +0.37% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.dissociation <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.45 | 98.67% | -1.08% | 10.000 |
| 0.50 | 98.94% | -0.81% | 10.000 |
| 0.55 | 99.20% | -0.55% | 10.000 |
| 0.60 | 99.47% | -0.28% | 10.000 |
| **0.65** | **99.75%** | **baseline (stored contexts)** | 10.000 |
| 0.70 | 99.89% | +0.14% | 10.000 |
| 0.75 | 99.98% | +0.23% | 10.000 |
| 0.80 | 100.00% | +0.25% | 10.000 |
| 0.85 | 100.00% | +0.25% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.sadness >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.02 | 23.58% | +13.75% | 10.000 |
| 0.07 | 23.27% | +12.25% | 10.000 |
| 0.12 | 22.80% | +9.99% | 10.000 |
| 0.17 | 21.89% | +5.60% | 10.000 |
| **0.22** | **20.73%** | **baseline (stored contexts)** | 10.000 |
| 0.27 | 19.02% | -8.25% | 10.000 |
| 0.32 | 17.02% | -17.90% | 10.000 |
| 0.37 | 15.10% | -27.16% | 10.000 |
| 0.42 | 12.63% | -39.07% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.grief >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| -0.02 | 100.00% | +569.79% | 10.000 |
| 0.03 | 16.43% | +10.05% | 10.000 |
| 0.08 | 16.16% | +8.24% | 10.000 |
| 0.13 | 15.66% | +4.89% | 10.000 |
| **0.18** | **14.93%** | **baseline (stored contexts)** | 10.000 |
| 0.23 | 14.08% | -5.69% | 10.000 |
| 0.28 | 12.68% | -15.07% | 10.000 |
| 0.33 | 11.07% | -25.85% | 10.000 |
| 0.38 | 9.21% | -38.31% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.disappointment >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 20.43% | +13.75% | 10.000 |
| 0.10 | 20.22% | +12.58% | 10.000 |
| 0.15 | 19.90% | +10.80% | 10.000 |
| 0.20 | 19.04% | +6.01% | 10.000 |
| **0.25** | **17.96%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 16.39% | -8.74% | 10.000 |
| 0.35 | 14.53% | -19.10% | 10.000 |
| 0.40 | 12.35% | -31.24% | 10.000 |
| 0.45 | 10.23% | -43.04% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.regret >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| -0.02 | 100.00% | +552.32% | 10.000 |
| 0.03 | 16.06% | +4.76% | 10.000 |
| 0.08 | 15.97% | +4.17% | 10.000 |
| 0.13 | 15.77% | +2.87% | 10.000 |
| **0.18** | **15.33%** | **baseline (stored contexts)** | 10.000 |
| 0.23 | 14.66% | -4.37% | 10.000 |
| 0.28 | 13.72% | -10.50% | 10.000 |
| 0.33 | 12.35% | -19.44% | 10.000 |
| 0.38 | 10.94% | -28.64% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.lonely_yearning >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 1.13% | +46.75% | 10.000 |
| 0.10 | 1.07% | +38.96% | 10.000 |
| 0.15 | 0.94% | +22.08% | 10.000 |
| 0.20 | 0.87% | +12.99% | 10.000 |
| **0.25** | **0.77%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 0.70% | -9.09% | 10.000 |
| 0.35 | 0.54% | -29.87% | 10.000 |
| 0.40 | 0.38% | -50.65% | 10.000 |
| 0.45 | 0.27% | -64.94% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.embarrassment >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.00 | 100.00% | +573.40% | 10.000 |
| 0.05 | 17.81% | +19.93% | 10.000 |
| 0.10 | 17.04% | +14.75% | 10.000 |
| 0.15 | 15.95% | +7.41% | 10.000 |
| **0.20** | **14.85%** | **baseline (stored contexts)** | 10.000 |
| 0.25 | 13.30% | -10.44% | 10.000 |
| 0.30 | 11.57% | -22.09% | 10.000 |
| 0.35 | 9.68% | -34.81% | 10.000 |
| 0.40 | 8.04% | -45.86% | 10.000 |

## 🎯 Prototype Fit Analysis

Ranking of emotion prototypes by how well they fit this expression's mood regime.

**Population**: stored-mood-regime (predicate: moodAxes.affiliation >= 20, moodAxes.arousal <= 55, moodAxes.arousal >= -5, moodAxes.engagement >= 15, moodAxes.self_evaluation <= -5, moodAxes.threat <= 70, moodAxes.threat >= 10, moodAxes.valence <= -10; count: 35; hash: fb21a3c1).
| Rank | Prototype | Gate Pass | P(I≥t) | Conflict | Composite |
|------|-----------|-----------|--------|----------|-----------|
| 1 | **protest_anger** | 90.00% | 100.00% | 0.00% | 0.97 |
| 2 | **guilt** | 75.00% | 100.00% | 0.00% | 0.92 |
| 3 | **interest** | 92.50% | 83.78% | 16.67% | 0.89 |
| 4 | **embarrassment** | 82.50% | 81.82% | 0.00% | 0.88 |
| 5 | **frustration** | 60.00% | 100.00% | 0.00% | 0.88 |
| 6 | **unease** | 100.00% | 65.00% | 0.00% | 0.88 |
| 7 | **regret** | 62.50% | 96.00% | 0.00% | 0.87 |
| 8 | **hypervigilance** | 50.00% | 100.00% | 0.00% | 0.85 |
| 9 | **irritation** | 100.00% | 55.00% | 0.00% | 0.84 |
| 10 | **confusion** | 65.00% | 84.62% | 0.00% | 0.84 |

### Top 3 Prototype Details

#### 1. protest_anger

- **Intensity Distribution**: P50=0.50, P90=0.65, P95=0.68
- **Conflicting Axes**: None

#### 2. guilt

- **Intensity Distribution**: P50=0.46, P90=0.66, P95=0.66
- **Conflicting Axes**: None

#### 3. interest

- **Intensity Distribution**: P50=0.43, P90=0.57, P95=0.59
- **Conflicting Axes**: valence (weight=0.20, wants positive)
- **Conflict Magnitude**: 0.20

---

## 🧭 Implied Prototype from Prerequisites

Analysis of which prototypes best match the expression's constraint pattern.

**Population**: stored-mood-regime (predicate: moodAxes.affiliation >= 20, moodAxes.arousal <= 55, moodAxes.arousal >= -5, moodAxes.engagement >= 15, moodAxes.self_evaluation <= -5, moodAxes.threat <= 70, moodAxes.threat >= 10, moodAxes.valence <= -10; count: 35; hash: fb21a3c1).

### Target Signature

| Axis | Direction | Importance |
|------|-----------|------------|
| affiliation | ↑ High | 0.55 |
| valence | ↓ Low | 0.53 |
| self_evaluation | ↓ Low | 0.51 |
| engagement | ↑ High | 0.54 |
| threat | ↑ High | 0.60 |
| arousal | ↑ High | 0.60 |

### Top 5 by Cosine Similarity

| Rank | Prototype | Similarity | Gate Pass | Combined |
|------|-----------|------------|-----------|----------|
| 1 | **protest_anger** | 0.93 | 90.00% | 0.92 |
| 2 | **hypervigilance** | 0.79 | 50.00% | 0.68 |
| 3 | **embarrassment** | 0.79 | 82.50% | 0.81 |
| 4 | **humiliation** | 0.76 | 52.50% | 0.67 |
| 5 | **terror** | 0.76 | 15.00% | 0.52 |

### Top 5 by Gate Pass Rate

| Rank | Prototype | Gate Pass | Similarity | Combined |
|------|-----------|-----------|------------|----------|
| 1 | **unease** | 100.00% | 0.66 | 0.79 |
| 2 | **irritation** | 100.00% | 0.64 | 0.78 |
| 3 | **envy** | 100.00% | 0.65 | 0.79 |
| 4 | **interest** | 92.50% | 0.45 | 0.64 |
| 5 | **anticipation** | 90.00% | 0.33 | 0.56 |

### Top 5 by Combined Score

| Rank | Prototype | Combined | Similarity | Gate Pass |
|------|-----------|----------|------------|----------|
| 1 | **protest_anger** | 0.92 | 0.93 | 90.00% |
| 2 | **jealousy** | 0.81 | 0.75 | 90.00% |
| 3 | **embarrassment** | 0.81 | 0.79 | 82.50% |
| 4 | **unease** | 0.79 | 0.66 | 100.00% |
| 5 | **envy** | 0.79 | 0.65 | 100.00% |

---

## 🔍 Prototype Gap Detection

Analysis of prototype coverage in "prototype space".

**Population**: stored-mood-regime (predicate: moodAxes.affiliation >= 20, moodAxes.arousal <= 55, moodAxes.arousal >= -5, moodAxes.engagement >= 15, moodAxes.self_evaluation <= -5, moodAxes.threat <= 70, moodAxes.threat >= 10, moodAxes.valence <= -10; count: 35; hash: fb21a3c1).

### ✅ Good Coverage

**Nearest Distance**: 0.13 - within acceptable range.

**Distance Context**: Distance 0.13 is farther than 14% of prototype nearest-neighbor distances (z=-0.97).

### k-Nearest Prototypes

| Rank | Prototype | Distance | Weight Dist | Gate Dist |
|------|-----------|----------|-------------|----------|
| 1 | **protest_anger** | 0.13 | 0.18 | 0.00 |
| 2 | **embarrassment** | 0.24 | 0.34 | 0.00 |
| 3 | **jealousy** | 0.24 | 0.35 | 0.00 |
| 4 | **awkwardness** | 0.25 | 0.35 | 0.00 |
| 5 | **hypervigilance** | 0.25 | 0.35 | 0.00 |

---


## Report Integrity Warnings
- I1_GATE_FAILED_NONZERO_FINAL: Gate failed but final intensity is non-zero in stored contexts. [population=1a309bea; prototype=freeze; signal=final] examples: index 4134
- I1_GATE_FAILED_NONZERO_FINAL: Gate failed but final intensity is non-zero in stored contexts. [population=1a309bea; prototype=dissociation; signal=final] examples: index 738, 4923, 5343, 7155
- I1_GATE_FAILED_NONZERO_FINAL: Gate failed but final intensity is non-zero in stored contexts. [population=1a309bea; prototype=sadness; signal=final] examples: index 69, 379, 613, 738, 1211
- I1_GATE_FAILED_NONZERO_FINAL: Gate failed but final intensity is non-zero in stored contexts. [population=fb21a3c1; prototype=sadness; signal=final] examples: index 6925
- I1_GATE_FAILED_NONZERO_FINAL: Gate failed but final intensity is non-zero in stored contexts. [population=1a309bea; prototype=lonely_yearning; signal=final] examples: index 2707, 3884, 7608, 7976, 8825

> **Impact**: Gate/final mismatches can invalidate pass-rate and blocker metrics; treat threshold feasibility as provisional until resolved.

## Legend

### Global Metrics
- **Trigger Rate**: Probability (0-100%) that the expression evaluates to true across random samples
- **Confidence Interval**: 95% Wilson score interval indicating statistical certainty of the trigger rate
- **Sample Size**: Number of random state pairs generated for simulation
- **Rarity Categories**: impossible (0%), extremely_rare (<0.001%), rare (<0.05%), normal (<2%), frequent (>=2%)

### Per-Clause Metrics
- **Fail% global**: Percentage of samples where this specific clause evaluated to false (unconditional)
- **Fail% | mood-pass**: Percentage of samples where this clause evaluated to false within the mood regime
- **Gate clamp (mood)**: Percentage of mood-regime samples where gates failed and the final intensity was clamped to 0 (emotion-threshold clauses only)
- **Pass | gate (mood)**: Percentage of gate-pass samples that passed the threshold within the mood regime (emotion-threshold clauses only)
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
- **Sole-Blocker Rate (N)**: Failure rate among samples where ALL OTHER clauses passed. N differs per clause because each clause excludes itself from the "others" check: Clause A's N = samples where B,C,D... passed; Clause B's N = samples where A,C,D... passed. This variance is mathematically correct and order-invariant
- **Bound**: The relevant extreme value for verifying Gap. For `>=` operators: Max Observed (highest value seen). For `<=` operators: Min Observed (lowest value seen)
- **Ceiling Gap**: Direction-aware calculation. For `>=` operators: (Threshold - Max Observed). For `<=` operators: (Min Observed - Threshold). Positive = threshold unreachable; negative = threshold achievable

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

## Integrity issues

The report says the following:

Report Integrity Warnings
- I1_GATE_FAILED_NONZERO_FINAL: Gate failed but final intensity is non-zero in stored contexts. [population=1a309bea; prototype=freeze; signal=final] examples: index 4134
- I1_GATE_FAILED_NONZERO_FINAL: Gate failed but final intensity is non-zero in stored contexts. [population=1a309bea; prototype=dissociation; signal=final] examples: index 738, 4923, 5343, 7155
- I1_GATE_FAILED_NONZERO_FINAL: Gate failed but final intensity is non-zero in stored contexts. [population=1a309bea; prototype=sadness; signal=final] examples: index 69, 379, 613, 738, 1211
- I1_GATE_FAILED_NONZERO_FINAL: Gate failed but final intensity is non-zero in stored contexts. [population=fb21a3c1; prototype=sadness; signal=final] examples: index 6925
- I1_GATE_FAILED_NONZERO_FINAL: Gate failed but final intensity is non-zero in stored contexts. [population=1a309bea; prototype=lonely_yearning; signal=final] examples: index 2707, 3884, 7608, 7976, 8825

> **Impact**: Gate/final mismatches can invalidate pass-rate and blocker metrics; treat threshold feasibility as provisional until resolved.

We need to investigate whether these are due to bugs in the code.

ChatGPT commented that this is most likely a bug. I asked it what to do about the issue.

### ChatGPT's response

#### Where the bug most likely lives (code hotspots)

A) The prototype evaluation pipeline (the #1 suspect)

Look for the function(s) that do something like:

raw = dot(weights, normalizedMoodAxes)

gatePass = evalGates(gates, mood)

final = gatePass ? clamp01(raw) : 0

Hotspot patterns to search for

computeEmotionIntensities

evaluatePrototype

prototypeToIntensity

applyGates

gatePass

clamp, clamp01, Math.max(0, ...)

rawIntensity, finalIntensity

Likely failure modes

Clamp is applied to the wrong variable (raw gets clamped but never zeroed on gate fail).

Gate failure doesn’t force zero (you treat gates as “eligibility” elsewhere, but still store final > 0).

Order-of-operations bug: you compute/store emotions.* first, then evaluate gates later for reporting/expression checks.

Why the report implicates this: you literally have samples where gateFail and final>0 for multiple prototypes (freeze, dissociation, sadness, lonely_yearning). That’s systemic, not a one-off clause.

B) The “stored contexts” snapshot/export step (very common)

Your warnings are explicitly “in stored contexts”. That suggests this flow:

Compute something (maybe raw or pre-gate)

Store snapshot (for later reporting)

Later, compute final/gated version for actual evaluation

So the report reads the snapshot and sees final that’s actually “raw”.

Hotspot patterns

storeContext, captureContext, recordSample, pushStoredContext

any “cap at 10,000” logic

“hash population” logic

Classic bug

You store emotions before gating is applied.

Or you store an object reference, and later mutate it (so “final” ends up mismatched with “gatePass” computed on a different state).

C) Report-side gate evaluation (second biggest suspect)

If the simulator and the report each implement gate evaluation separately, you will eventually get mismatches.

Hotspot patterns

evaluateGateExpression, evalJsonLogic, resolveVar, getVarValue

normalization functions (very important): normalizeMoodAxes, toUnitRange, axisTo01

Typical mismatch causes

Different scale: simulator gates use normalized [-1..1] but report uses raw [-100..100] (or vice versa).

Different field: simulator uses moodAxes.engagement, report uses mood.engagement or nested paths incorrectly.

Operator drift: < vs <=, rounding, integer-effective thresholds, etc.

Your dissociation example is a giant clue: the report says gate engagement <= -0.20 is incompatible with the regime (engagement in [0.15..1]) yet it found non-zero final while gate-failed. That’s either “final is not clamped” OR “the report’s gate eval is not the same as runtime.”

D) Normalization / variable resolver (silent killer)

If gate evaluation and intensity computation don’t use the exact same normalized inputs, you can pass gates in one place and fail in another.

Hotspot patterns

any function mapping moodAxes integers to floats

any resolver mapping "var": "moodAxes.threat" to a number

Concrete check

Put a breakpoint/log: what exact numeric value does engagement have when intensity is computed vs when gates are evaluated?

E) Caching / memoization / reuse across samples

If you cache gate results or normalized mood vectors and reuse them incorrectly, you get “gate failed but final nonzero” intermittently.

Hotspot patterns

memoize, cache, Map<prototypeId,...>, “lastMood”, “lastComputed”

#### Invariants that must pass (non-negotiable)

Assuming your design is “hard gates clamp to 0” (your report assumes it is):

##### Core invariants (per prototype, per sample)

Hard clamp

gatePass == false ⇒ finalIntensity == 0 (within epsilon like 1e-9)

Non-zero implies gate pass

finalIntensity > eps ⇒ gatePass == true

Gate pass preserves raw

gatePass == true ⇒ finalIntensity == clamp01(rawIntensity)
(or exactly equals your final transform; point is: no gate-related change)

Gate evaluation consistency

The gates used by the simulator and the report must be bit-identical:

same resolver

same normalization

same operator semantics

##### Storage invariants (snapshots)

Stored context immutability

Once stored, the snapshot must not change (deep clone or structural sharing guarantee).

Stored “final” must be post-gate

If you store emotions.* that the report treats as “final”, it must be the post-gate value.

If you want raw too, store it separately as emotionsRaw.*.

##### Report invariants

If any I1 mismatch exists in a population:

Mark “Gate clamp (mood)” and “Pass|gate (mood)” as invalid unless you recompute using canonical evaluator.

#### Tests that must pass (minimal but deadly effective)
Unit tests (fast, pinpoint the bug)

T1: Gate fail clamps to zero

Construct mood state that yields raw > 0 but fails one gate.

Assert gatePass=false and final==0.

T2: Gate pass leaves intensity intact

Construct mood that satisfies all gates.

Assert gatePass=true and final==clamp01(raw).

T3: Report gate evaluator matches runtime

For a fixed mood sample, run:

runtime gatePassRuntime

report gatePassReport

Assert equal for each prototype (or delete report evaluator and import runtime function).

T4: Dissociation regression (based on your report)

Build mood with engagement high (in your regime it’s ≥ 0.15 normalized).

Dissociation has gate engagement <= -0.20 (per report).

Assert gatePass=false and final==0.

If this fails, you’ve found the bug.

Integration tests (Monte Carlo / storage)

T5: No I1 warnings on a small deterministic run

Seed RNG, run e.g. 2k samples.

Generate report.

Assert: I1_GATE_FAILED_NONZERO_FINAL count == 0.

T6: Stored contexts are post-gate

Run sampler.

Pick a stored sample.

Recompute final from raw+gates via canonical evaluator.

Assert stored final matches recomputed final for several prototypes.

Property-based test (the “never regress” net)

T7: For random moods, invariant holds
For N random mood states (even 500 is enough in CI):

For each prototype:

compute (raw, gatePass, final)

assert invariants #1–#3

This catches edge cases and refactors breaking things.

#### UI/report improvements to maximize clarity and reduce confusion
A) Make the model explicit: “hard gate” vs “soft gate”

Add a single line at the top:

Gating model: HARD (gate fail ⇒ final=0)
or

Gating model: SOFT (gate fail reduces final)

If it’s hard, the I1 warning is a true integrity violation. If it’s soft, the warning should change wording (and your “gate clamp” columns must be redesigned).

B) Show the “signal lineage” for every emotion variable

For each emotion in tables, show:

rawIntensity (pre-gate)

gatePass

finalIntensity (post-gate)

Right now you’re assuming final is post-gate, but the warnings prove it isn’t always.

C) Add a dedicated “Integrity” panel per population

A compact summary:

mismatchCount / samples

list of prototypes affected

“first 3 examples” with:

mood axes

which gate failed

raw/final values

And then:

If mismatches > 0: grey out or label as INVALID:

Gate clamp (mood)

Pass|gate (mood)

any gate-conditional stats

This stops the user from trusting poisoned metrics.

D) Drill-down view for a flagged sample index

Make the “index 4134” clickable:

Shows gate evaluation per clause

Shows resolved numeric values (with scale!)

Shows raw/final

This turns “WTF?” into “oh, engagement normalization is wrong” instantly.

E) Show the numeric scale everywhere it matters

You already do integer-effective thresholds for moodAxes. Add to every gate display:

engagement (raw=-12, normalized=-0.12) or whatever your mapping is.

Half of gate bugs are just “wrong scale”.

F) Gate-aware blocker attribution improvements

When integrity is OK, make your blocker table clearer by splitting:

For each emotion threshold clause:

P(gatePass | mood)

P(thresholdPass | gatePass, mood)

P(thresholdPass | mood) (this one includes clamps)

Those three numbers tell you immediately: “gate mismatch vs threshold too high”.

#### Other recommendations (strongly suggested)
1) Kill duplicated logic

Do not implement gate evaluation in two places.

Export the runtime evaluateGates() and computeIntensity() and import them in the report generator.

This alone usually eliminates I1 warnings forever.

2) Store evaluation traces in samples

When sampling, store per prototype:

raw

gatePass

failedGateIds (or first failed gate)

final

Then the report doesn’t need to “guess” gate behavior later. It becomes pure aggregation.

3) Add version hashes to the report

Include:

prototype definition hash

evaluator code version (git commit or build id)

normalization version

So when you change something, you can tell whether an old report is still comparable.

4) Fix integrity first, then revisit feasibility

Right now, the tuning guidance (“lower anger threshold gives 0.03% triggers”) is potentially real, but any gate-conditional reasoning is suspect until I1 is gone.

