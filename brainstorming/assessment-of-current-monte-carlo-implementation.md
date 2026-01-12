# Potential issues with our Monte Carlo implementation and the reports created

My goal with the reports generated in expression-diagnostics.html through the Monte Carlo section is that on their own they should be enough to determine what to tune in a prerequisite or in an upstream prototype. Regarding the hurt_anger.expression.json, that currently is considered rare to pass by Monte Carlo, the report generated is:

# Monte Carlo Analysis Report

**Expression**: hurt_anger
**Generated**: 2026-01-12T00:27:17.370Z
**Distribution**: uniform
**Sample Size**: 10000
**Sampling Mode**: static - Prototype-gated sampling (emotions derived from mood axes; not independent)
**Regime Note**: Report includes global vs in-regime (mood-pass) statistics

> **Note**: Emotions are computed via prototype gates, so emotion variables are not independent of mood axes.

---

## Executive Summary

**Trigger Rate**: 0.00% (95% CI: 0.00% - 0.04%)
**Rarity**: unobserved (not triggered in 10000 samples—trigger rate is below 0.04% upper bound, not logically impossible)

Expression never triggers. Primary blocker: AND of 19 conditions Focus on "AND of 19 conditions" (100.0% last-mile failure).

---

## Sampling Coverage

**Sampling Mode**: static

### Summary by Domain

| Domain | Variables | Range Coverage | Bin Coverage | Tail Low | Tail High | Rating |
|--------|-----------|----------------|--------------|----------|-----------|--------|
| emotions | 15 | 87.23% | 88.67% | 87.17% | 0.0053% | good |
| moodAxes | 6 | 100.00% | 100.00% | 10.30% | 10.22% | good |
| previousEmotions | 2 | 77.65% | 85.00% | 91.05% | 0.00% | good |
| previousMoodAxes | 2 | 100.00% | 100.00% | 10.18% | 9.93% | good |

### Lowest Coverage Variables

| Variable | Range Coverage | Bin Coverage | Tail Low | Tail High | Rating |
|----------|----------------|--------------|----------|-----------|--------|
| previousEmotions.lonely_yearning | 72.44% | 80.00% | 98.49% | 0.00% | partial |
| emotions.lonely_yearning | 75.81% | 80.00% | 98.68% | 0.00% | good |
| emotions.dissociation | 81.74% | 80.00% | 97.89% | 0.00% | good |
| previousEmotions.anger | 82.86% | 90.00% | 83.62% | 0.00% | good |
| emotions.contempt | 82.96% | 90.00% | 83.32% | 0.00% | good |

Notes:
- Range coverage is observed span divided by domain span.
- Bin coverage is occupancy across 10 equal-width bins.
- Tail coverage is the share of samples in the bottom/top 10.00% of the domain.
- Variables with unknown domain ranges are excluded from summaries.

### Coverage Conclusions

- emotions: upper tail is effectively untested (top 10% has 0.0053% of samples). High-threshold feasibility results are not trustworthy here.
- previousEmotions: upper tail is effectively untested (top 10% has 0.0000% of samples). High-threshold feasibility results are not trustworthy here.
- previousEmotions: observed range spans only 78% of the domain. This suggests ceilings/floors or gating; feasibility conclusions involving missing ranges are low-confidence.
- moodAxes: coverage looks healthy (full range, bins filled, tails represented). Feasibility failures here likely reflect true constraint strictness.
- previousMoodAxes: coverage looks healthy (full range, bins filled, tails represented). Feasibility failures here likely reflect true constraint strictness.
- Across variables: 17 show near-zero upper-tail coverage; 2 show truncated range. Those regions are effectively unvalidated by current sampling.
- Do not trust feasibility estimates for prerequisites that target the upper end of a domain; the sampler is not generating those states often enough to test them.
- Worst range coverage: min=72%.
- Worst upper-tail coverage: min tailHigh=0.0000%.
- Worst lower-tail coverage: min tailLow=10.1200%.

---

## Ground-Truth Witnesses

No triggering states found during simulation.


---

## Blocker Analysis

### Blocker #1: `AND of 19 conditions`

**Condition**: Compound AND block
**Fail% global**: 100.00% (10000 / 10000)
**Fail% | mood-pass**: 100.00% (40 / 40)
**Severity**: critical
**Redundant in regime**: N/A

#### Flags
[DECISIVE] [UPSTREAM]

#### Condition Breakdown

**Required Conditions (ALL must pass)**

| # | Condition | Fail% global | Fail% \| mood-pass | Support | Bound | Threshold | Gap | Tunable | Redundant (regime) | Sole-Blocker Rate |
|---|-----------|--------------|-------------------|---------|-------|-----------|-----|---------|-------------------|-------------------|
| 1 | `emotions.anger >= 0.4` | 93.48% | 82.50% (33 / 40) | 10000 | 0.88 | 0.40 | -0.48 | moderate | no | 100.00% (N=16) |
| 2 | `emotions.rage < 0.55` | 2.05% | 0.00% (0 / 40) | 10000 | 0.00 | 0.55 | -0.55 | low | yes | N/A |
| 3 | `moodAxes.affiliation >= 20` | 60.22% | 0.00% (0 / 40) | 10000 | 100.00 | 20.00 | -80.00 | moderate | yes | N/A |
| 4 | `moodAxes.valence <= -10` | 55.06% | 0.00% (0 / 40) | 10000 | -100.00 | -10.00 | -90.00 | moderate | yes | N/A |
| 5 | `moodAxes.self_evaluation <= -5` | 52.58% | 0.00% (0 / 40) | 10000 | -100.00 | -5.00 | -95.00 | moderate | yes | N/A |
| 6 | `moodAxes.engagement >= 15` | 57.19% | 0.00% (0 / 40) | 10000 | 100.00 | 15.00 | -85.00 | moderate | yes | N/A |
| 7 | `moodAxes.threat >= 10` | 54.93% | 0.00% (0 / 40) | 10000 | 100.00 | 10.00 | -90.00 | moderate | yes | N/A |
| 8 | `moodAxes.threat <= 70` | 14.71% | 0.00% (0 / 40) | 10000 | -100.00 | 70.00 | -170.00 | moderate | yes | N/A |
| 9 | `moodAxes.arousal >= -5` | 48.16% | 0.00% (0 / 40) | 10000 | 100.00 | -5.00 | -105.00 | moderate | yes | N/A |
| 10 | `moodAxes.arousal <= 55` | 21.86% | 0.00% (0 / 40) | 10000 | -100.00 | 55.00 | -155.00 | moderate | yes | N/A |
| 11 | `emotions.contempt <= 0.4` | 7.39% | 0.00% (0 / 40) | 10000 | 0.00 | 0.40 | -0.40 | moderate | yes | N/A |
| 12 | `emotions.disgust <= 0.4` | 8.48% | 0.00% (0 / 40) | 10000 | 0.00 | 0.40 | -0.40 | moderate | yes | N/A |
| 13 | `emotions.hatred <= 0.35` | 7.86% | 37.50% (15 / 40) | 10000 | 0.00 | 0.35 | -0.35 | moderate | no | 100.00% (N=7)⚠️ |
| 14 | `emotions.panic <= 0.4` | 0.42% | 0.00% (0 / 40) | 10000 | 0.00 | 0.40 | -0.40 | low | yes | N/A |
| 15 | `emotions.terror <= 0.5` | 3.29% | 7.50% (3 / 40) | 10000 | 0.00 | 0.50 | -0.50 | low | no | N/A |
| 16 | `emotions.freeze <= 0.55` | 0.44% | 12.50% (5 / 40) | 10000 | 0.00 | 0.55 | -0.55 | low | no | N/A |
| 17 | `emotions.dissociation <= 0.65` | 0.23% | 0.00% (0 / 40) | 10000 | 0.00 | 0.65 | -0.65 | low | yes | N/A |

**OR Block #1 (ANY ONE must pass)**

| # | Condition | Fail% global | Fail% \| mood-pass | Support | Bound | Threshold | Gap | Tunable | Redundant (regime) | Sole-Blocker Rate |
|---|-----------|--------------|-------------------|---------|-------|-----------|-----|---------|-------------------|-------------------|
| 18 | `emotions.sadness >= 0.22` | 79.11% | 65.00% (26 / 40) | 10000 | 0.93 | 0.22 | -0.71 | moderate | no | N/A (OR alt) |
| 19 | `emotions.grief >= 0.18` | 84.13% | 22.50% (9 / 40) | 10000 | 0.88 | 0.18 | -0.70 | low | no | N/A (OR alt) |
| 20 | `emotions.disappointment >= 0.25` | 82.17% | 52.50% (21 / 40) | 10000 | 0.91 | 0.25 | -0.66 | moderate | no | N/A (OR alt) |
| 21 | `emotions.regret >= 0.18` | 84.53% | 17.50% (7 / 40) | 10000 | 0.92 | 0.18 | -0.74 | low | no | N/A (OR alt) |
| 22 | `emotions.lonely_yearning >= 0.25` | 99.00% | 87.50% (35 / 40) | 10000 | 0.76 | 0.25 | -0.51 | low | no | N/A (OR alt) |
| 23 | `emotions.embarrassment >= 0.2` | 86.41% | 17.50% (7 / 40) | 10000 | 0.95 | 0.20 | -0.75 | moderate | no | N/A (OR alt) |

**Combined OR Block**: 60.45% pass rate (Fail% global: 39.55% | Fail% \| mood-pass: 0.00%)

**OR Block #1 OR Alternative Coverage** (4342 total successes):

| Alternative | P(alt passes \| OR pass) | P(alt exclusively passes \| OR pass) | First-pass share (order-dependent) |
|------------|---------------------------|------------------------------------|------------------------------------|
| `emotions.sadness >= 0.22` | 48.11% (2089/4342) | 9.49% (412/4342) | 48.11% (2089/4342) |
| `emotions.disappointment >= 0.25` | 41.06% (1783/4342) | 8.89% (386/4342) | 13.22% (574/4342) |
| `emotions.grief >= 0.18` | 36.55% (1587/4342) | 4.86% (211/4342) | 15.18% (659/4342) |
| `emotions.regret >= 0.18` | 35.63% (1547/4342) | 3.78% (164/4342) | 7.02% (305/4342) |
| `emotions.embarrassment >= 0.2` | 31.30% (1359/4342) | 16.08% (698/4342) | 16.08% (698/4342) |
| `emotions.lonely_yearning >= 0.25` | 2.30% (100/4342) | 0.35% (15/4342) | 0.39% (17/4342) |
*First-pass share is order-dependent; use pass/exclusive rates for order-independent attribution.*

**OR Block #2 (ANY ONE must pass)**

| # | Condition | Fail% global | Fail% \| mood-pass | Support | Bound | Threshold | Gap | Tunable | Redundant (regime) | Sole-Blocker Rate |
|---|-----------|--------------|-------------------|---------|-------|-----------|-----|---------|-------------------|-------------------|
| 24 | `(emotions.anger - previousEmotions.anger) >= 0.08` | 85.51% | 55.00% (22 / 40) | 10000 | - | - | - | low | N/A | N/A (OR alt) |
| 25 | `(emotions.lonely_yearning - previousEmotions.lonely_yearning) >= 0.08` | 98.67% | 87.50% (35 / 40) | 10000 | - | - | - | low | N/A | N/A (OR alt) |
| 26 | `(moodAxes.self_evaluation - previousMoodAxes.self_evaluation) <= -10` | 54.62% | 25.00% (10 / 40) | 10000 | - | - | - | low | N/A | N/A (OR alt) |
| 27 | `(moodAxes.affiliation - previousMoodAxes.affiliation) <= -12` | 54.66% | 80.00% (32 / 40) | 10000 | - | - | - | low | N/A | N/A (OR alt) |
| | **AND Group (2 conditions - all must pass together)** | | | | | | | | | |
| 28 | `└─ previousEmotions.anger < 0.4` | 6.17% | 7.50% (3 / 40) | 10000 | 0.00 | 0.40 | -0.40 | moderate | no | N/A (OR alt) |
| 29 | `└─ emotions.anger >= 0.4` | 93.48% | 82.50% (33 / 40) | 10000 | 0.88 | 0.40 | -0.48 | moderate | no | N/A (OR alt) |

**Combined OR Block**: 76.33% pass rate (Fail% global: 23.67% | Fail% \| mood-pass: 10.00%)

**OR Block #2 OR Alternative Coverage** (7488 total successes):

| Alternative | P(alt passes \| OR pass) | P(alt exclusively passes \| OR pass) | First-pass share (order-dependent) |
|------------|---------------------------|------------------------------------|------------------------------------|
| `(moodAxes.self_evaluation - previousMoodAxes.self_evaluation) <= -10` | 60.60% (4538/7488) | 28.54% (2137/7488) | 51.47% (3854/7488) |
| `(moodAxes.affiliation - previousMoodAxes.affiliation) <= -12` | 60.55% (4534/7488) | 27.94% (2092/7488) | 27.95% (2093/7488) |
| `(emotions.anger - previousEmotions.anger) >= 0.08` | 19.35% (1449/7488) | 3.67% (275/7488) | 19.35% (1449/7488) |
| `(AND: previousEmotions.anger < 0.4 & emotions.anger >= 0.4)` | 8.04% (602/7488) | 0.03% (2/7488) | 0.03% (2/7488) |
| `(emotions.lonely_yearning - previousEmotions.lonely_yearning) >= 0.08` | 1.78% (133/7488) | 0.39% (29/7488) | 1.20% (90/7488) |
*First-pass share is order-dependent; use pass/exclusive rates for order-independent attribution.*

#### Worst Offender Analysis

**#1: `emotions.anger >= 0.4`** (Fail% global: 93.48% | Fail% \| mood-pass: N/A)

**#2: `emotions.lonely_yearning >= 0.25`** ⚠️ OR-alternative (Fail% global: 99.00% | Fail% \| mood-pass: N/A)
- ℹ️ This is an alternative within an OR block; other alternatives may cover this case

**#3: `(emotions.lonely_yearning - previousEmotions.lonely_yearning) >= 0.08`** ⚠️ OR-alternative (Fail% global: 98.67% | Fail% \| mood-pass: N/A)
- ℹ️ This is an alternative within an OR block; other alternatives may cover this case

**#4: `emotions.embarrassment >= 0.2`** ⚠️ OR-alternative (Fail% global: 86.41% | Fail% \| mood-pass: N/A)
- ℹ️ This is an alternative within an OR block; other alternatives may cover this case

#### Prototype Math Analysis

##### 🧠 anger >= 0.40 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Achievable range**: [0.00, 0.72]
- **Threshold**: 0.40
- **Status**: sometimes
- **Slack**: feasibility +0.321; always -0.400
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 2.90 | **Required Raw Sum**: 1.16

**Regime Stats**:
| Regime | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|-----|-----|-----|-----|-----|----------|
| Global | 0.00 | 0.30 | 0.44 | 0.00 | 0.88 | 48.99% |
| In mood regime | 0.13 | 0.45 | 0.49 | 0.00 | 0.52 | 95.00% |

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
- ✅ `valence <= -0.15` - Satisfiable
- ✅ `arousal >= 0.10` - Satisfiable | **Observed Fail Rate**: 51.01%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **affiliation**: Has negative weight (-0.30) but constraint requires min 0.20

**Analysis**: Threshold 0.4 is achievable (max: 0.721). Binding conflicts: affiliation has negative weight (-0.30) but constraint requires min=0.20



##### 🧠 rage < 0.55 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Achievable range**: [0.00, 0.70]
- **Threshold**: 0.55
- **Status**: sometimes
- **Slack**: feasibility +0.550; always -0.150
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 3.50 | **Required Raw Sum**: 1.93

**Regime Stats**:
| Regime | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|-----|-----|-----|-----|-----|----------|
| Global | 0.00 | 0.24 | 0.42 | 0.00 | 0.89 | 48.99% |
| In mood regime | 0.00 | 0.43 | 0.46 | 0.00 | 0.50 | 95.00% |

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
- ✅ `valence <= -0.25` - Satisfiable
- ✅ `arousal >= 0.25` - Satisfiable | **Observed Fail Rate**: 51.01%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **affiliation**: Has negative weight (-0.40) but constraint requires min 0.20

**Analysis**: Threshold 0.55 is achievable (min: 0.000). Binding conflicts: affiliation has negative weight (-0.40) but constraint requires min=0.20

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 contempt <= 0.40 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Achievable range**: [0.00, 0.55]
- **Threshold**: 0.40
- **Status**: sometimes
- **Slack**: feasibility +0.400; always -0.148
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 2.30 | **Required Raw Sum**: 0.92

**Regime Stats**:
| Regime | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|-----|-----|-----|-----|-----|----------|
| Global | 0.00 | 0.33 | 0.47 | 0.00 | 0.83 | 49.72% |
| In mood regime | 0.00 | 0.24 | 0.33 | 0.00 | 0.33 | 50.00% |

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
- ✅ `valence <= -0.10` - Satisfiable
- ✅ `agency_control >= 0.20` - Satisfiable | **Observed Fail Rate**: 50.28%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **engagement**: Has negative weight (-0.20) but constraint requires min 0.15
- ⚠️ **self_evaluation**: Has positive weight (+0.20) but constraint limits max to -0.05
- ⚠️ **affiliation**: Has negative weight (-0.50) but constraint requires min 0.20

**Analysis**: Threshold 0.4 is achievable (min: 0.000). Binding conflicts: engagement has negative weight (-0.20) but constraint requires min=0.15; self_evaluation has positive weight (+0.20) but constraint limits it to max=-0.05; affiliation has negative weight (-0.50) but constraint requires min=0.20

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 disgust <= 0.40 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Achievable range**: [0.00, 0.46]
- **Threshold**: 0.40
- **Status**: sometimes
- **Slack**: feasibility +0.400; always -0.056
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 2.40 | **Required Raw Sum**: 0.96

**Regime Stats**:
| Regime | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|-----|-----|-----|-----|-----|----------|
| Global | 0.00 | 0.37 | 0.48 | 0.00 | 0.85 | 100.00% |
| In mood regime | 0.08 | 0.21 | 0.24 | 0.00 | 0.24 | 100.00% |

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
- ✅ `valence <= -0.25` - Satisfiable

**Binding Axes (Structural Conflicts)**:
- ⚠️ **engagement**: Has negative weight (-0.30) but constraint requires min 0.15
- ⚠️ **affiliation**: Has negative weight (-0.60) but constraint requires min 0.20

**Analysis**: Threshold 0.4 is achievable (min: 0.000). Binding conflicts: engagement has negative weight (-0.30) but constraint requires min=0.15; affiliation has negative weight (-0.60) but constraint requires min=0.20

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 hatred <= 0.35 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Achievable range**: [0.00, 0.87]
- **Threshold**: 0.35
- **Status**: sometimes
- **Slack**: feasibility +0.350; always -0.517
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 2.70 | **Required Raw Sum**: 0.94

**Regime Stats**:
| Regime | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|-----|-----|-----|-----|-----|----------|
| Global | 0.00 | 0.29 | 0.44 | 0.00 | 0.88 | 48.99% |
| In mood regime | 0.21 | 0.59 | 0.63 | 0.00 | 0.65 | 95.00% |

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
- ✅ `valence <= -0.25` - Satisfiable
- ✅ `arousal >= 0.10` - Satisfiable | **Observed Fail Rate**: 51.01%

**Binding Axes**: arousal, threat (constraints limit optimal values)

**Analysis**: Threshold 0.35 is achievable (min: 0.000)

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 panic <= 0.40 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Achievable range**: [0.00, 0.84]
- **Threshold**: 0.40
- **Status**: sometimes
- **Slack**: feasibility +0.400; always -0.437
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 4.60 | **Required Raw Sum**: 1.84

**Regime Stats**:
| Regime | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|-----|-----|-----|-----|-----|----------|
| Global | 0.00 | 0.00 | 0.00 | 0.00 | 0.84 | 12.15% |
| In mood regime | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 95.00% |

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
- ✅ `threat >= 0.50` - Satisfiable | **Observed Fail Rate**: 50.70%
- ✅ `arousal >= 0.55` - Satisfiable | **Observed Fail Rate**: 51.01%
- ✅ `agency_control <= -0.10` - Satisfiable
- ✅ `valence <= -0.15` - Satisfiable
- ✅ `engagement >= 0.10` - Satisfiable | **Observed Fail Rate**: 50.32%

**Binding Axes**: threat, arousal (constraints limit optimal values)

**Analysis**: Threshold 0.4 is achievable (min: 0.000)

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 terror <= 0.50 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Achievable range**: [0.00, 0.77]
- **Threshold**: 0.50
- **Status**: sometimes
- **Slack**: feasibility +0.500; always -0.266
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 3.20 | **Required Raw Sum**: 1.60

**Regime Stats**:
| Regime | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|-----|-----|-----|-----|-----|----------|
| Global | 0.00 | 0.00 | 0.42 | 0.00 | 0.89 | 24.07% |
| In mood regime | 0.00 | 0.45 | 0.58 | 0.00 | 0.58 | 95.00% |

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
- ✅ `threat >= 0.50` - Satisfiable | **Observed Fail Rate**: 50.70%
- ✅ `arousal >= 0.30` - Satisfiable | **Observed Fail Rate**: 51.01%

**Binding Axes**: threat, arousal (constraints limit optimal values)

**Analysis**: Threshold 0.5 is achievable (min: 0.000)

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 freeze <= 0.55 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Achievable range**: [0.00, 0.84]
- **Threshold**: 0.55
- **Status**: sometimes
- **Slack**: feasibility +0.550; always -0.289
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 2.75 | **Required Raw Sum**: 1.51

**Regime Stats**:
| Regime | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|-----|-----|-----|-----|-----|----------|
| Global | 0.00 | 0.00 | 0.00 | 0.00 | 0.85 | 12.70% |
| In mood regime | 0.00 | 0.58 | 0.62 | 0.00 | 0.63 | 5.00% |

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
- ✅ `threat >= 0.35` - Satisfiable | **Observed Fail Rate**: 50.70%
- ✅ `agency_control <= -0.30` - Satisfiable
- ✅ `valence <= -0.05` - Satisfiable
- ✅ `arousal >= -0.10` - Satisfiable
- ✅ `arousal <= 0.40` - Satisfiable | **Observed Fail Rate**: 48.99%
- ✅ `engagement >= 0.05` - Satisfiable | **Observed Fail Rate**: 50.32%

**Binding Axes**: threat, arousal (constraints limit optimal values)

**Analysis**: Threshold 0.55 is achievable (min: 0.000)

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 dissociation <= 0.65 ✅ ALWAYS

**Feasibility (gated)**
- **Achievable range**: [0.00, 0.51]
- **Threshold**: 0.65
- **Status**: always
- **Slack**: feasibility +0.650; always +0.145
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 3.45 | **Required Raw Sum**: 2.24

**Regime Stats**:
| Regime | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|-----|-----|-----|-----|-----|----------|
| Global | 0.00 | 0.00 | 0.00 | 0.00 | 0.82 | 12.56% |
| In mood regime | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 5.00% |

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
- ✅ `threat >= 0.35` - Satisfiable | **Observed Fail Rate**: 50.70%
- ✅ `agency_control <= -0.20` - Satisfiable
- ❌ `engagement <= -0.20` - Constraint min (0.15) > gate requirement (-0.2)
- ✅ `arousal <= 0.35` - Satisfiable | **Observed Fail Rate**: 48.99%
- ✅ `valence <= 0.10` - Satisfiable | **Observed Fail Rate**: 50.24%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **engagement**: Has negative weight (-1.00) but constraint requires min 0.15

**Analysis**: Condition always satisfied by axis bounds but gates are blocked. Binding conflicts: engagement has negative weight (-1.00) but constraint requires min=0.15. Blocked gates: engagement <= -0.20

**Recommendation**: Always satisfies threshold within constraints.

##### 🧠 sadness >= 0.22 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Achievable range**: [0.00, 0.74]
- **Threshold**: 0.22
- **Status**: sometimes
- **Slack**: feasibility +0.516; always -0.220
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 1.80 | **Required Raw Sum**: 0.40

**Regime Stats**:
| Regime | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|-----|-----|-----|-----|-----|----------|
| Global | 0.00 | 0.49 | 0.60 | 0.00 | 0.93 | 51.01% |
| In mood regime | 0.00 | 0.47 | 0.48 | 0.00 | 0.58 | 5.00% |

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -1.00 | [-1.00, -0.10] | -1.00 | 1.000 | — |
| arousal | -0.50 | [-0.05, 0.55] | -0.05 | 0.025 | ⚠️ yes |
| agency_control | -0.30 | [-1.00, 1.00] | -1.00 | 0.300 | — |

**Gates** ✅:
- ✅ `valence <= -0.20` - Satisfiable
- ✅ `arousal <= 0.20` - Satisfiable | **Observed Fail Rate**: 48.99%

**Binding Axes**: arousal (constraints limit optimal values)

**Analysis**: Threshold 0.22 is achievable (max: 0.736)



##### 🧠 grief >= 0.18 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Achievable range**: [0.00, 0.88]
- **Threshold**: 0.18
- **Status**: sometimes
- **Slack**: feasibility +0.696; always -0.180
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 2.30 | **Required Raw Sum**: 0.41

**Regime Stats**:
| Regime | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|-----|-----|-----|-----|-----|----------|
| Global | 0.00 | 0.38 | 0.52 | 0.00 | 0.88 | 49.68% |
| In mood regime | 0.35 | 0.57 | 0.61 | 0.00 | 0.63 | 100.00% |

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -1.00 | [-1.00, -0.10] | -1.00 | 1.000 | — |
| arousal | -0.30 | [-0.05, 0.55] | -0.05 | 0.015 | ⚠️ yes |
| engagement | +0.60 | [0.15, 1.00] | 1.00 | 0.600 | — |
| agency_control | -0.40 | [-1.00, 1.00] | -1.00 | 0.400 | — |

**Gates** ✅:
- ✅ `valence <= -0.25` - Satisfiable
- ✅ `engagement >= 0.10` - Satisfiable | **Observed Fail Rate**: 50.32%

**Binding Axes**: arousal (constraints limit optimal values)

**Analysis**: Threshold 0.18 is achievable (max: 0.876)



##### 🧠 disappointment >= 0.25 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Achievable range**: [0.00, 0.94]
- **Threshold**: 0.25
- **Status**: sometimes
- **Slack**: feasibility +0.691; always -0.250
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 1.60 | **Required Raw Sum**: 0.40

**Regime Stats**:
| Regime | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|-----|-----|-----|-----|-----|----------|
| Global | 0.00 | 0.45 | 0.57 | 0.00 | 0.91 | 100.00% |
| In mood regime | 0.21 | 0.62 | 0.64 | 0.00 | 0.68 | 100.00% |

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.70 | [-1.00, -0.10] | -1.00 | 0.700 | — |
| future_expectancy | -0.60 | [-1.00, 1.00] | -1.00 | 0.600 | — |
| arousal | -0.10 | [-0.05, 0.55] | -0.05 | 0.005 | ⚠️ yes |
| agency_control | -0.20 | [-1.00, 1.00] | -1.00 | 0.200 | — |

**Gates** ✅:
- ✅ `valence <= -0.10` - Satisfiable
- ✅ `future_expectancy <= -0.10` - Satisfiable

**Binding Axes**: arousal (constraints limit optimal values)

**Analysis**: Threshold 0.25 is achievable (max: 0.941)



##### 🧠 regret >= 0.18 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Achievable range**: [0.00, 0.96]
- **Threshold**: 0.18
- **Status**: sometimes
- **Slack**: feasibility +0.775; always -0.180
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 2.00 | **Required Raw Sum**: 0.36

**Regime Stats**:
| Regime | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|-----|-----|-----|-----|-----|----------|
| Global | 0.00 | 0.40 | 0.54 | 0.00 | 0.92 | 100.00% |
| In mood regime | 0.45 | 0.65 | 0.70 | 0.00 | 0.77 | 100.00% |

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.70 | [-1.00, -0.10] | -1.00 | 0.700 | — |
| self_evaluation | -0.80 | [-1.00, -0.05] | -1.00 | 0.800 | — |
| future_expectancy | -0.30 | [-1.00, 1.00] | -1.00 | 0.300 | — |
| arousal | +0.20 | [-0.05, 0.55] | 0.55 | 0.110 | ⚠️ yes |

**Gates** ✅:
- ✅ `self_evaluation <= -0.2` - Satisfiable
- ✅ `valence <= -0.2` - Satisfiable

**Binding Axes**: arousal (constraints limit optimal values)

**Analysis**: Threshold 0.18 is achievable (max: 0.955)



##### 🧠 lonely_yearning >= 0.25 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Achievable range**: [0.00, 0.91]
- **Threshold**: 0.25
- **Status**: sometimes
- **Slack**: feasibility +0.659; always -0.250
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 3.50 | **Required Raw Sum**: 0.88

**Regime Stats**:
| Regime | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|-----|-----|-----|-----|-----|----------|
| Global | 0.00 | 0.00 | 0.00 | 0.00 | 0.76 | 12.46% |
| In mood regime | 0.00 | 0.40 | 0.49 | 0.00 | 0.54 | 0.00% |

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
- ✅ `engagement >= 0.25` - Satisfiable | **Observed Fail Rate**: 50.32%
- ✅ `valence <= -0.10` - Satisfiable
- ✅ `threat <= 0.40` - Satisfiable | **Observed Fail Rate**: 49.30%
- ✅ `arousal >= -0.10` - Satisfiable
- ✅ `arousal <= 0.35` - Satisfiable | **Observed Fail Rate**: 48.99%
- ✅ `future_expectancy >= -0.05` - Satisfiable

**Binding Axes (Structural Conflicts)**:
- ⚠️ **threat**: Has negative weight (-0.25) but constraint requires min 0.10

**Analysis**: Threshold 0.25 is achievable (max: 0.909). Binding conflicts: threat has negative weight (-0.25) but constraint requires min=0.10



##### 🧠 embarrassment >= 0.20 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Achievable range**: [0.00, 0.81]
- **Threshold**: 0.20
- **Status**: sometimes
- **Slack**: feasibility +0.607; always -0.200
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 2.10 | **Required Raw Sum**: 0.42

**Regime Stats**:
| Regime | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|-----|-----|-----|-----|-----|----------|
| Global | 0.00 | 0.32 | 0.47 | 0.00 | 0.95 | 49.30% |
| In mood regime | 0.42 | 0.55 | 0.59 | 0.00 | 0.64 | 100.00% |

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| self_evaluation | -0.70 | [-1.00, -0.05] | -1.00 | 0.700 | — |
| arousal | +0.50 | [-0.05, 0.55] | 0.55 | 0.275 | ⚠️ yes |
| threat | +0.60 | [0.10, 0.70] | 0.70 | 0.420 | ⚠️ yes |
| valence | -0.30 | [-1.00, -0.10] | -1.00 | 0.300 | — |

**Gates** ✅:
- ✅ `self_evaluation <= -0.10` - Satisfiable
- ✅ `threat >= 0.20` - Satisfiable | **Observed Fail Rate**: 50.70%

**Binding Axes**: arousal, threat (constraints limit optimal values)

**Analysis**: Threshold 0.2 is achievable (max: 0.807)



##### 🧠 anger >= 0.40 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Achievable range**: [0.00, 0.72]
- **Threshold**: 0.40
- **Status**: sometimes
- **Slack**: feasibility +0.321; always -0.400
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 2.90 | **Required Raw Sum**: 1.16

**Regime Stats**:
| Regime | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|-----|-----|-----|-----|-----|----------|
| Global | 0.00 | 0.30 | 0.44 | 0.00 | 0.88 | 48.99% |
| In mood regime | 0.13 | 0.45 | 0.49 | 0.00 | 0.52 | 95.00% |

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
- ✅ `valence <= -0.15` - Satisfiable
- ✅ `arousal >= 0.10` - Satisfiable | **Observed Fail Rate**: 51.01%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **affiliation**: Has negative weight (-0.30) but constraint requires min 0.20

**Analysis**: Threshold 0.4 is achievable (max: 0.721). Binding conflicts: affiliation has negative weight (-0.30) but constraint requires min=0.20



#### Distribution Analysis
- **Compound Node**: Aggregated from 29 leaf conditions (19 top-level conditions; 29 when OR blocks expanded)
- **Highest Avg Violation**: 72.14 (from `(moodAxes.self_evaluation - previousMoodAxes.self_evaluation) <= -10`)
- **Highest P90 Violation**: 144.00
- **Highest P95 Violation**: 166.00
- **Highest P99 Violation**: 191.00
- **Interpretation**: Worst violator: (moodAxes.self_evaluation - previousMoodAxes.self_evaluation) <= -10

#### Ceiling Analysis
- **Compound Node**: Contains multiple conditions
- **Status**: No ceiling effects detected in leaf conditions
- **Insight**: All thresholds appear achievable based on observed values

#### Near-Miss Analysis
- **Compound Node**: Contains 29 leaf conditions
- **Most Tunable Condition**: `emotions.hatred <= 0.35`
- **Near-Miss Rate**: 3.32% (epsilon: 0.05)
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

**Mood regime filter**: 40 contexts where all mood constraints pass
- Constraints: `moodAxes.affiliation >= 20`, `moodAxes.valence <= -10`, `moodAxes.self_evaluation <= -5`, `moodAxes.engagement >= 15`, `moodAxes.threat >= 10`, `moodAxes.threat <= 70`, `moodAxes.arousal >= -5`, `moodAxes.arousal <= 55`

| Condition | P(pass \| mood) | Passes | CI (95%) |
|-----------|-----------------|--------|----------|
| `emotions.lonely_yearning >= 0.25` | 12.50% | 5/40 | [5.46%, 26.11%] |
| `emotions.anger >= 0.4` | 17.50% | 7/40 | [8.75%, 31.95%] |
| `emotions.sadness >= 0.22` | 35.00% | 14/40 | [22.13%, 50.49%] |
| `emotions.disappointment >= 0.25` | 47.50% | 19/40 | [32.94%, 62.50%] |
| `emotions.hatred <= 0.35` | 62.50% | 25/40 | [47.03%, 75.78%] |
| `emotions.grief >= 0.18` | 77.50% | 31/40 | [62.50%, 87.68%] |
| `emotions.regret >= 0.18` | 82.50% | 33/40 | [68.05%, 91.25%] |
| `emotions.embarrassment >= 0.2` | 82.50% | 33/40 | [68.05%, 91.25%] |
| `emotions.freeze <= 0.55` | 87.50% | 35/40 | [73.89%, 94.54%] |
| `emotions.terror <= 0.5` | 92.50% | 37/40 | [80.14%, 97.42%] |
| `emotions.rage < 0.55` | 100.00% | 40/40 | [91.24%, 100.00%] |
| `emotions.contempt <= 0.4` | 100.00% | 40/40 | [91.24%, 100.00%] |
| `emotions.disgust <= 0.4` | 100.00% | 40/40 | [91.24%, 100.00%] |
| `emotions.panic <= 0.4` | 100.00% | 40/40 | [91.24%, 100.00%] |
| `emotions.dissociation <= 0.65` | 100.00% | 40/40 | [91.24%, 100.00%] |

**Interpretation**: These rates show how often each emotion condition passes
when the mood state is already suitable. Low rates indicate emotion-specific
blockers that persist even in favorable mood regimes.

---


## Global Expression Sensitivity Analysis

**Insufficient data**: fewer than 5 baseline expression hits. Global sensitivity tables are suppressed for low-confidence runs.

## Sensitivity Analysis

This section shows how adjusting emotion/sexual thresholds would affect the trigger rate.
Use this to identify optimal threshold values for your desired trigger frequency.

### emotions.anger >= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.20 | 13.37% | +105.06% | 10.000 |
| 0.25 | 11.77% | +80.52% | 10.000 |
| 0.30 | 9.85% | +51.07% | 10.000 |
| 0.35 | 8.07% | +23.77% | 10.000 |
| **0.40** | **6.52%** | **baseline** | 10.000 |
| 0.45 | 4.80% | -26.38% | 10.000 |
| 0.50 | 3.52% | -46.01% | 10.000 |
| 0.55 | 2.42% | -62.88% | 10.000 |
| 0.60 | 1.44% | -77.91% | 10.000 |

### emotions.rage < [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.35 | 93.19% | -4.86% | 10.000 |
| 0.40 | 94.47% | -3.55% | 10.000 |
| 0.45 | 95.95% | -2.04% | 10.000 |
| 0.50 | 97.04% | -0.93% | 10.000 |
| **0.55** | **97.95%** | **baseline** | 10.000 |
| 0.60 | 98.77% | +0.84% | 10.000 |
| 0.65 | 99.32% | +1.40% | 10.000 |
| 0.70 | 99.72% | +1.81% | 10.000 |
| 0.75 | 99.90% | +1.99% | 10.000 |

### moodAxes.affiliation >= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 19.80 | 39.78% | — | 10.000 |
| 19.85 | 39.78% | — | 10.000 |
| 19.90 | 39.78% | — | 10.000 |
| 19.95 | 39.78% | — | 10.000 |
| **20.00** | **39.78%** | **baseline** | 10.000 |
| 20.05 | 39.30% | -1.21% | 10.000 |
| 20.10 | 39.30% | -1.21% | 10.000 |
| 20.15 | 39.30% | -1.21% | 10.000 |
| 20.20 | 39.30% | -1.21% | 10.000 |

### moodAxes.valence <= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| -10.20 | 44.46% | -1.07% | 10.000 |
| -10.15 | 44.46% | -1.07% | 10.000 |
| -10.10 | 44.46% | -1.07% | 10.000 |
| -10.05 | 44.46% | -1.07% | 10.000 |
| **-10.00** | **44.94%** | **baseline** | 10.000 |
| -9.95 | 44.94% | — | 10.000 |
| -9.90 | 44.94% | — | 10.000 |
| -9.85 | 44.94% | — | 10.000 |
| -9.80 | 44.94% | — | 10.000 |

### moodAxes.self_evaluation <= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| -5.20 | 46.89% | -1.12% | 10.000 |
| -5.15 | 46.89% | -1.12% | 10.000 |
| -5.10 | 46.89% | -1.12% | 10.000 |
| -5.05 | 46.89% | -1.12% | 10.000 |
| **-5.00** | **47.42%** | **baseline** | 10.000 |
| -4.95 | 47.42% | — | 10.000 |
| -4.90 | 47.42% | — | 10.000 |
| -4.85 | 47.42% | — | 10.000 |
| -4.80 | 47.42% | — | 10.000 |

### moodAxes.engagement >= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 14.80 | 42.81% | — | 10.000 |
| 14.85 | 42.81% | — | 10.000 |
| 14.90 | 42.81% | — | 10.000 |
| 14.95 | 42.81% | — | 10.000 |
| **15.00** | **42.81%** | **baseline** | 10.000 |
| 15.05 | 42.29% | -1.21% | 10.000 |
| 15.10 | 42.29% | -1.21% | 10.000 |
| 15.15 | 42.29% | -1.21% | 10.000 |
| 15.20 | 42.29% | -1.21% | 10.000 |

### moodAxes.threat >= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 9.80 | 45.07% | — | 10.000 |
| 9.85 | 45.07% | — | 10.000 |
| 9.90 | 45.07% | — | 10.000 |
| 9.95 | 45.07% | — | 10.000 |
| **10.00** | **45.07%** | **baseline** | 10.000 |
| 10.05 | 44.66% | -0.91% | 10.000 |
| 10.10 | 44.66% | -0.91% | 10.000 |
| 10.15 | 44.66% | -0.91% | 10.000 |
| 10.20 | 44.66% | -0.91% | 10.000 |

### moodAxes.threat <= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 69.80 | 84.84% | -0.53% | 10.000 |
| 69.85 | 84.84% | -0.53% | 10.000 |
| 69.90 | 84.84% | -0.53% | 10.000 |
| 69.95 | 84.84% | -0.53% | 10.000 |
| **70.00** | **85.29%** | **baseline** | 10.000 |
| 70.05 | 85.29% | — | 10.000 |
| 70.10 | 85.29% | — | 10.000 |
| 70.15 | 85.29% | — | 10.000 |
| 70.20 | 85.29% | — | 10.000 |

### moodAxes.arousal >= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| -5.20 | 51.84% | — | 10.000 |
| -5.15 | 51.84% | — | 10.000 |
| -5.10 | 51.84% | — | 10.000 |
| -5.05 | 51.84% | — | 10.000 |
| **-5.00** | **51.84%** | **baseline** | 10.000 |
| -4.95 | 51.25% | -1.14% | 10.000 |
| -4.90 | 51.25% | -1.14% | 10.000 |
| -4.85 | 51.25% | -1.14% | 10.000 |
| -4.80 | 51.25% | -1.14% | 10.000 |

### moodAxes.arousal <= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 54.80 | 77.57% | -0.73% | 10.000 |
| 54.85 | 77.57% | -0.73% | 10.000 |
| 54.90 | 77.57% | -0.73% | 10.000 |
| 54.95 | 77.57% | -0.73% | 10.000 |
| **55.00** | **78.14%** | **baseline** | 10.000 |
| 55.05 | 78.14% | — | 10.000 |
| 55.10 | 78.14% | — | 10.000 |
| 55.15 | 78.14% | — | 10.000 |
| 55.20 | 78.14% | — | 10.000 |

### emotions.contempt <= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.20 | 85.75% | -7.41% | 10.000 |
| 0.25 | 87.34% | -5.69% | 10.000 |
| 0.30 | 88.81% | -4.10% | 10.000 |
| 0.35 | 90.77% | -1.99% | 10.000 |
| **0.40** | **92.61%** | **baseline** | 10.000 |
| 0.45 | 94.25% | +1.77% | 10.000 |
| 0.50 | 95.88% | +3.53% | 10.000 |
| 0.55 | 97.30% | +5.06% | 10.000 |
| 0.60 | 98.42% | +6.27% | 10.000 |

### emotions.disgust <= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.20 | 78.86% | -13.83% | 10.000 |
| 0.25 | 82.30% | -10.07% | 10.000 |
| 0.30 | 85.72% | -6.34% | 10.000 |
| 0.35 | 88.68% | -3.10% | 10.000 |
| **0.40** | **91.52%** | **baseline** | 10.000 |
| 0.45 | 93.76% | +2.45% | 10.000 |
| 0.50 | 95.82% | +4.70% | 10.000 |
| 0.55 | 97.23% | +6.24% | 10.000 |
| 0.60 | 98.34% | +7.45% | 10.000 |

### emotions.hatred <= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.15 | 86.35% | -6.28% | 10.000 |
| 0.20 | 87.59% | -4.94% | 10.000 |
| 0.25 | 88.89% | -3.53% | 10.000 |
| 0.30 | 90.37% | -1.92% | 10.000 |
| **0.35** | **92.14%** | **baseline** | 10.000 |
| 0.40 | 93.68% | +1.67% | 10.000 |
| 0.45 | 95.27% | +3.40% | 10.000 |
| 0.50 | 96.91% | +5.18% | 10.000 |
| 0.55 | 97.79% | +6.13% | 10.000 |

### emotions.panic <= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.20 | 99.57% | -0.01% | 10.000 |
| 0.25 | 99.57% | -0.01% | 10.000 |
| 0.30 | 99.57% | -0.01% | 10.000 |
| 0.35 | 99.57% | -0.01% | 10.000 |
| **0.40** | **99.58%** | **baseline** | 10.000 |
| 0.45 | 99.59% | +0.01% | 10.000 |
| 0.50 | 99.66% | +0.08% | 10.000 |
| 0.55 | 99.70% | +0.12% | 10.000 |
| 0.60 | 99.74% | +0.16% | 10.000 |

### emotions.terror <= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.30 | 92.98% | -3.86% | 10.000 |
| 0.35 | 93.87% | -2.94% | 10.000 |
| 0.40 | 94.70% | -2.08% | 10.000 |
| 0.45 | 95.63% | -1.12% | 10.000 |
| **0.50** | **96.71%** | **baseline** | 10.000 |
| 0.55 | 97.57% | +0.89% | 10.000 |
| 0.60 | 98.41% | +1.76% | 10.000 |
| 0.65 | 99.12% | +2.49% | 10.000 |
| 0.70 | 99.60% | +2.99% | 10.000 |

### emotions.freeze <= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.35 | 99.30% | -0.26% | 10.000 |
| 0.40 | 99.33% | -0.23% | 10.000 |
| 0.45 | 99.40% | -0.16% | 10.000 |
| 0.50 | 99.45% | -0.11% | 10.000 |
| **0.55** | **99.56%** | **baseline** | 10.000 |
| 0.60 | 99.69% | +0.13% | 10.000 |
| 0.65 | 99.76% | +0.20% | 10.000 |
| 0.70 | 99.86% | +0.30% | 10.000 |
| 0.75 | 99.92% | +0.36% | 10.000 |

### emotions.dissociation <= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.45 | 98.47% | -1.30% | 10.000 |
| 0.50 | 98.89% | -0.88% | 10.000 |
| 0.55 | 99.32% | -0.45% | 10.000 |
| 0.60 | 99.59% | -0.18% | 10.000 |
| **0.65** | **99.77%** | **baseline** | 10.000 |
| 0.70 | 99.89% | +0.12% | 10.000 |
| 0.75 | 99.95% | +0.18% | 10.000 |
| 0.80 | 99.99% | +0.22% | 10.000 |
| 0.85 | 100.00% | +0.23% | 10.000 |

### emotions.sadness >= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.02 | 23.76% | +13.74% | 10.000 |
| 0.07 | 23.52% | +12.59% | 10.000 |
| 0.12 | 22.88% | +9.53% | 10.000 |
| 0.17 | 22.15% | +6.03% | 10.000 |
| **0.22** | **20.89%** | **baseline** | 10.000 |
| 0.27 | 19.48% | -6.75% | 10.000 |
| 0.32 | 17.42% | -16.61% | 10.000 |
| 0.37 | 15.27% | -26.90% | 10.000 |
| 0.42 | 13.03% | -37.63% | 10.000 |

### emotions.grief >= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| -0.02 | 100.00% | +530.12% | 10.000 |
| 0.03 | 17.03% | +7.31% | 10.000 |
| 0.08 | 16.84% | +6.11% | 10.000 |
| 0.13 | 16.42% | +3.47% | 10.000 |
| **0.18** | **15.87%** | **baseline** | 10.000 |
| 0.23 | 14.75% | -7.06% | 10.000 |
| 0.28 | 13.35% | -15.88% | 10.000 |
| 0.33 | 11.73% | -26.09% | 10.000 |
| 0.38 | 9.95% | -37.30% | 10.000 |

### emotions.disappointment >= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 20.18% | +13.18% | 10.000 |
| 0.10 | 19.97% | +12.00% | 10.000 |
| 0.15 | 19.47% | +9.20% | 10.000 |
| 0.20 | 18.82% | +5.55% | 10.000 |
| **0.25** | **17.83%** | **baseline** | 10.000 |
| 0.30 | 16.30% | -8.58% | 10.000 |
| 0.35 | 14.50% | -18.68% | 10.000 |
| 0.40 | 12.33% | -30.85% | 10.000 |
| 0.45 | 10.18% | -42.91% | 10.000 |

### emotions.regret >= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| -0.02 | 100.00% | +546.41% | 10.000 |
| 0.03 | 16.24% | +4.98% | 10.000 |
| 0.08 | 16.18% | +4.59% | 10.000 |
| 0.13 | 16.02% | +3.56% | 10.000 |
| **0.18** | **15.47%** | **baseline** | 10.000 |
| 0.23 | 14.65% | -5.30% | 10.000 |
| 0.28 | 13.56% | -12.35% | 10.000 |
| 0.33 | 12.24% | -20.88% | 10.000 |
| 0.38 | 10.67% | -31.03% | 10.000 |

### emotions.lonely_yearning >= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 1.37% | +37.00% | 10.000 |
| 0.10 | 1.32% | +32.00% | 10.000 |
| 0.15 | 1.26% | +26.00% | 10.000 |
| 0.20 | 1.18% | +18.00% | 10.000 |
| **0.25** | **1.00%** | **baseline** | 10.000 |
| 0.30 | 0.88% | -12.00% | 10.000 |
| 0.35 | 0.75% | -25.00% | 10.000 |
| 0.40 | 0.59% | -41.00% | 10.000 |
| 0.45 | 0.45% | -55.00% | 10.000 |

### emotions.embarrassment >= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.00 | 100.00% | +635.84% | 10.000 |
| 0.05 | 16.83% | +23.84% | 10.000 |
| 0.10 | 16.22% | +19.35% | 10.000 |
| 0.15 | 15.04% | +10.67% | 10.000 |
| **0.20** | **13.59%** | **baseline** | 10.000 |
| 0.25 | 11.99% | -11.77% | 10.000 |
| 0.30 | 10.38% | -23.62% | 10.000 |
| 0.35 | 9.01% | -33.70% | 10.000 |
| 0.40 | 7.41% | -45.47% | 10.000 |

## 🎯 Prototype Fit Analysis

Ranking of emotion prototypes by how well they fit this expression's mood regime.

| Rank | Prototype | Gate Pass | P(I≥t) | Conflict | Composite |
|------|-----------|-----------|--------|----------|-----------|
| 1 | **protest_anger** | 85.71% | 97.22% | 0.00% | 0.95 |
| 2 | **regret** | 85.71% | 91.67% | 0.00% | 0.93 |
| 3 | **embarrassment** | 83.33% | 91.43% | 0.00% | 0.92 |
| 4 | **irritation** | 100.00% | 69.05% | 0.00% | 0.89 |
| 5 | **unease** | 100.00% | 54.76% | 0.00% | 0.84 |
| 6 | **shame** | 78.57% | 72.73% | 0.00% | 0.84 |
| 7 | **dread** | 52.38% | 90.91% | 0.00% | 0.83 |
| 8 | **interest** | 90.48% | 65.79% | 16.67% | 0.82 |
| 9 | **grief** | 88.10% | 67.57% | 16.67% | 0.82 |
| 10 | **hypervigilance** | 33.33% | 100.00% | 0.00% | 0.80 |

### Top 3 Prototype Details

#### 1. protest_anger

- **Intensity Distribution**: P50=0.50, P90=0.59, P95=0.61
- **Conflicting Axes**: None

#### 2. regret

- **Intensity Distribution**: P50=0.50, P90=0.67, P95=0.77
- **Conflicting Axes**: None

#### 3. embarrassment

- **Intensity Distribution**: P50=0.44, P90=0.57, P95=0.59
- **Conflicting Axes**: None

---

## 🧭 Implied Prototype from Prerequisites

Analysis of which prototypes best match the expression's constraint pattern.


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
| 1 | **protest_anger** | 0.93 | 85.71% | 0.90 |
| 2 | **hypervigilance** | 0.79 | 33.33% | 0.61 |
| 3 | **embarrassment** | 0.79 | 83.33% | 0.81 |
| 4 | **humiliation** | 0.76 | 59.52% | 0.69 |
| 5 | **terror** | 0.76 | 14.29% | 0.51 |

### Top 5 by Gate Pass Rate

| Rank | Prototype | Gate Pass | Similarity | Combined |
|------|-----------|-----------|------------|----------|
| 1 | **unease** | 100.00% | 0.66 | 0.79 |
| 2 | **irritation** | 100.00% | 0.64 | 0.78 |
| 3 | **envy** | 100.00% | 0.65 | 0.79 |
| 4 | **interest** | 90.48% | 0.45 | 0.63 |
| 5 | **grief** | 88.10% | 0.39 | 0.58 |

### Top 5 by Combined Score

| Rank | Prototype | Combined | Similarity | Gate Pass |
|------|-----------|----------|------------|----------|
| 1 | **protest_anger** | 0.90 | 0.93 | 85.71% |
| 2 | **embarrassment** | 0.81 | 0.79 | 83.33% |
| 3 | **jealousy** | 0.80 | 0.75 | 88.10% |
| 4 | **unease** | 0.79 | 0.66 | 100.00% |
| 5 | **envy** | 0.79 | 0.65 | 100.00% |

---

## 🔍 Prototype Gap Detection

Analysis of prototype coverage in "prototype space".

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


## Legend

### Global Metrics
- **Trigger Rate**: Probability (0-100%) that the expression evaluates to true across random samples
- **Confidence Interval**: 95% Wilson score interval indicating statistical certainty of the trigger rate
- **Sample Size**: Number of random state pairs generated for simulation
- **Rarity Categories**: impossible (0%), extremely_rare (<0.001%), rare (<0.05%), normal (<2%), frequent (>=2%)

### Per-Clause Metrics
- **Fail% global**: Percentage of samples where this specific clause evaluated to false (unconditional)
- **Fail% | mood-pass**: Percentage of samples where this clause evaluated to false within the mood regime
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



---

I asked ChatGPT if the report indicated issues with our Monte Carlo implementation, if we should add more data, etc.


## ChatGPT's response

### Sensitivity tables for integer mood axes are basically noise at 0.05 increments

Your mood axes are integers (-100…100). Stepping thresholds by 0.05 yields mostly “no change” until you cross an integer boundary. So those tables look precise but are not very informative.

### Examples from your sensitivity tables (and why they’re “noise”)
1) moodAxes.affiliation >= 20

You printed:

19.80 → 39.88%

19.85 → 39.88%

19.90 → 39.88%

19.95 → 39.88%

20.00 → 39.88% (baseline)

20.05 → 39.37%

20.10 → 39.37%

20.15 → 39.37%

20.20 → 39.37%

If affiliation is an integer, then:

affiliation >= 19.95 is identical to affiliation >= 20

affiliation >= 20.05 is identical to affiliation >= 21 (because 20 no longer qualifies)

So the “precision” is fake: you’re just toggling between >=20 and >=21, but hiding it.

2) moodAxes.valence <= -10

You printed:

-10.20 → 45.09%

-10.15 → 45.09%

-10.10 → 45.09%

-10.05 → 45.09%

-10.00 → 45.63% (baseline)

-9.95 → 45.63%

-9.90 → 45.63%

-9.85 → 45.63%

-9.80 → 45.63%

With integer valence:

valence <= -10.05 is effectively valence <= -11

valence <= -10.00 is valence <= -10

valence <= -9.95 is still effectively valence <= -10

So again: you’re not seeing a smooth sensitivity curve; you’re seeing a step function at the integer boundary.

3) moodAxes.threat <= 70

You printed:

69.80 → 84.62%

69.95 → 84.62%

70.00 → 85.13% (baseline)

70.05 → 85.13%

Integer threat interpretation:

threat <= 69.95 is effectively threat <= 69

threat <= 70.00 is threat <= 70

threat <= 70.05 is still threat <= 70

So the only meaningful change here is between 69 and 70.

4) moodAxes.arousal <= 55

You printed:

54.80 → 76.59%

54.95 → 76.59%

55.00 → 77.04% (baseline)

55.05 → 77.04%

Integer arousal interpretation:

arousal <= 54.95 is effectively arousal <= 54

arousal <= 55.00 is arousal <= 55

So again: it’s showing “decimal precision” but it’s just “54 vs 55”.

### What thresholds should you step through instead?
Rule of thumb (simple and correct)

For integer mood axes:

Step thresholds by 1 if you want fine-grained local sensitivity

Step by 5 or 10 if you want readable, “designer-friendly” sensitivity

### What I’d consider “reasonable + useful” in practice
Option A: Local window around the actual threshold (best default)

For any threshold t:

Show t-10 … t+10 in integer steps (21 rows max)

This makes it immediately obvious whether loosening by 1–3 points matters.

Example for affiliation >= 20:

test: 10, 12, 15, 18, 19, 20, 21, 22, 25, 30
(or just 10–30 step 1 if you can spare rows)

Example for valence <= -10:

test: -30, -20, -15, -12, -11, -10, -9, -8, -5, 0

Option B: Coarse designer steps (compact summary)

Use: t ± {0, 5, 10, 20, 30} (integers), clamped to [-100,100].

Example for threat <= 70:

40, 50, 60, 70, 80, 90, 100

This answers: “Is this bound doing anything at all?”

Option C: Quantile-based thresholds (most informative if distributions are weird)

Instead of arbitrary stepping, pick thresholds at:

P1, P5, P10, P25, P50, P75, P90, P95, P99 of that axis (under the relevant regime)

This is killer because it tells you sensitivity where the mass is, not where no samples live.

### One extra thing that would make the table instantly clearer

For each tested threshold, also print the effective integer threshold implied by integer granularity:

For >= t: effective = ceil(t)

For <= t: effective = floor(t)

Then your earlier table would literally say:

affiliation >= 20.05 (effective >= 21)

…and nobody gets fooled by decimals ever again.