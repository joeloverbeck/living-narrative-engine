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

# Monte Carlo Analysis Report

**Expression**: hurt_anger
**Generated**: 2026-01-12T01:05:27.597Z
**Distribution**: uniform
**Sample Size**: 100000
**Sampling Mode**: static - Prototype-gated sampling (emotions derived from mood axes; not independent)
**Regime Note**: Report includes global vs in-regime (mood-pass) statistics

> **Note**: Emotions are computed via prototype gates, so emotion variables are not independent of mood axes.

---

## Executive Summary

**Trigger Rate**: 0.0010% (95% CI: 1.77e-4% - 0.0057%)
**Rarity**: rare

Expression triggers rarely (0.001%). 1 clause(s) frequently fail. Focus on "AND of 19 conditions" (100.0% last-mile failure).

---

## Sampling Coverage

**Sampling Mode**: static

### Summary by Domain

| Domain | Variables | Range Coverage | Bin Coverage | Tail Low | Tail High | Rating |
|--------|-----------|----------------|--------------|----------|-----------|--------|
| emotions | 15 | 90.90% | 93.33% | 87.11% | 0.0099% | good |
| moodAxes | 6 | 100.00% | 100.00% | 10.30% | 10.21% | good |
| previousEmotions | 2 | 86.05% | 90.00% | 91.13% | 0.0010% | good |
| previousMoodAxes | 2 | 100.00% | 100.00% | 10.37% | 10.25% | good |

### Lowest Coverage Variables

| Variable | Range Coverage | Bin Coverage | Tail Low | Tail High | Rating |
|----------|----------------|--------------|----------|-----------|--------|
| previousEmotions.lonely_yearning | 78.37% | 80.00% | 98.74% | 0.00% | good |
| emotions.panic | 84.43% | 70.00% | 99.52% | 0.00% | good |
| emotions.dissociation | 86.97% | 90.00% | 98.07% | 0.00% | good |
| emotions.lonely_yearning | 87.44% | 90.00% | 98.67% | 0.00% | good |
| emotions.rage | 88.43% | 90.00% | 87.41% | 0.00% | good |

Notes:
- Range coverage is observed span divided by domain span.
- Bin coverage is occupancy across 10 equal-width bins.
- Tail coverage is the share of samples in the bottom/top 10.00% of the domain.
- Variables with unknown domain ranges are excluded from summaries.

### Coverage Conclusions

- emotions: upper tail is effectively untested (top 10% has 0.0099% of samples). High-threshold feasibility results are not trustworthy here.
- previousEmotions: upper tail is effectively untested (top 10% has 0.0010% of samples). High-threshold feasibility results are not trustworthy here.
- moodAxes: coverage looks healthy (full range, bins filled, tails represented). Feasibility failures here likely reflect true constraint strictness.
- previousMoodAxes: coverage looks healthy (full range, bins filled, tails represented). Feasibility failures here likely reflect true constraint strictness.
- Across variables: 17 show near-zero upper-tail coverage; 1 show truncated range. Those regions are effectively unvalidated by current sampling.
- Do not trust feasibility estimates for prerequisites that target the upper end of a domain; the sampler is not generating those states often enough to test them.
- Worst range coverage: min=78%.
- Worst upper-tail coverage: min tailHigh=0.0000%.
- Worst lower-tail coverage: min tailLow=10.1670%.

---

## Ground-Truth Witnesses

These states were verified to trigger the expression during simulation.
Each witness represents a valid combination of mood, sexual state, and affect traits.

### Witness #1

**Computed Emotions (Current)**:
- anger: 0.432
- contempt: 0.203
- disappointment: 0.000
- disgust: 0.000
- dissociation: 0.000
- embarrassment: 0.488
- freeze: 0.000
- grief: 0.000
- hatred: 0.000
- lonely_yearning: 0.000
- panic: 0.000
- rage: 0.000
- regret: 0.000
- sadness: 0.000
- terror: 0.293

**Computed Emotions (Previous)**:
- anger: 0.000
- contempt: 0.000
- disappointment: 0.000
- disgust: 0.000
- dissociation: 0.000
- embarrassment: 0.000
- freeze: 0.000
- grief: 0.000
- hatred: 0.000
- lonely_yearning: 0.000
- panic: 0.000
- rage: 0.000
- regret: 0.000
- sadness: 0.000
- terror: 0.000

**Mood State (Current)**:
- valence: -18
- arousal: 41
- agency_control: 99
- threat: 54
- engagement: 91
- future_expectancy: 76
- self_evaluation: -63
- affiliation: 25

**Mood State (Previous)**:
- valence: 6
- arousal: -88
- agency_control: 58
- threat: -41
- engagement: -48
- future_expectancy: 39
- self_evaluation: -45
- affiliation: 4

**Sexual State (Current)**:
- sex_excitation: 66
- sex_inhibition: 92
- baseline_libido: 5

**Sexual State (Previous)**:
- sex_excitation: 2
- sex_inhibition: 7
- baseline_libido: -4

**Affect Traits**:
- affective_empathy: 22
- cognitive_empathy: 59
- harm_aversion: 11

---

## Blocker Analysis

### Blocker #1: `AND of 19 conditions`

**Condition**: Compound AND block
**Fail% global**: 100.00% (99999 / 100000)
**Fail% | mood-pass**: 99.69% (326 / 327)
**Severity**: critical
**Redundant in regime**: N/A

#### Flags
[DECISIVE] [UPSTREAM]

#### Condition Breakdown

**Required Conditions (ALL must pass)**

| # | Condition | Fail% global | Fail% \| mood-pass | Support | Bound | Threshold | Gap | Tunable | Redundant (regime) | Sole-Blocker Rate |
|---|-----------|--------------|-------------------|---------|-------|-----------|-----|---------|-------------------|-------------------|
| 1 | `emotions.anger >= 0.4` | 93.71% | 86.54% (283 / 327) | 100000 | 0.89 | 0.40 | -0.49 | moderate | no | 99.32% (N=146) |
| 2 | `emotions.rage < 0.55` | 1.83% | 0.31% (1 / 327) | 100000 | 0.00 | 0.55 | -0.55 | low | no | 0.00% (N=1)⚠️ |
| 3 | `moodAxes.affiliation >= 20` | 59.78% | 0.00% (0 / 327) | 100000 | 100.00 | 20.00 | -80.00 | moderate | yes | 90.00% (N=10) |
| 4 | `moodAxes.valence <= -10` | 54.97% | 0.00% (0 / 327) | 100000 | -100.00 | -10.00 | -90.00 | moderate | yes | 0.00% (N=1)⚠️ |
| 5 | `moodAxes.self_evaluation <= -5` | 52.22% | 0.00% (0 / 327) | 100000 | -100.00 | -5.00 | -95.00 | moderate | yes | 50.00% (N=2)⚠️ |
| 6 | `moodAxes.engagement >= 15` | 57.33% | 0.00% (0 / 327) | 100000 | 100.00 | 15.00 | -85.00 | moderate | yes | 0.00% (N=1)⚠️ |
| 7 | `moodAxes.threat >= 10` | 54.71% | 0.00% (0 / 327) | 100000 | 100.00 | 10.00 | -90.00 | moderate | yes | 0.00% (N=1)⚠️ |
| 8 | `moodAxes.threat <= 70` | 14.75% | 0.00% (0 / 327) | 100000 | -100.00 | 70.00 | -170.00 | moderate | yes | 0.00% (N=1)⚠️ |
| 9 | `moodAxes.arousal >= -5` | 47.53% | 0.00% (0 / 327) | 100000 | 100.00 | -5.00 | -105.00 | moderate | yes | 0.00% (N=1)⚠️ |
| 10 | `moodAxes.arousal <= 55` | 22.29% | 0.00% (0 / 327) | 100000 | -100.00 | 55.00 | -155.00 | moderate | yes | 75.00% (N=4)⚠️ |
| 11 | `emotions.contempt <= 0.4` | 7.25% | 0.31% (1 / 327) | 100000 | 0.00 | 0.40 | -0.40 | moderate | no | 0.00% (N=1)⚠️ |
| 12 | `emotions.disgust <= 0.4` | 8.45% | 0.00% (0 / 327) | 100000 | 0.00 | 0.40 | -0.40 | moderate | yes | 0.00% (N=1)⚠️ |
| 13 | `emotions.hatred <= 0.35` | 7.76% | 40.37% (132 / 327) | 100000 | 0.00 | 0.35 | -0.35 | moderate | no | 97.50% (N=40) |
| 14 | `emotions.panic <= 0.4` | 0.47% | 0.61% (2 / 327) | 100000 | 0.00 | 0.40 | -0.40 | low | no | 0.00% (N=1)⚠️ |
| 15 | `emotions.terror <= 0.5` | 3.02% | 4.89% (16 / 327) | 100000 | 0.00 | 0.50 | -0.50 | moderate | no | 0.00% (N=1)⚠️ |
| 16 | `emotions.freeze <= 0.55` | 0.42% | 6.12% (20 / 327) | 100000 | 0.00 | 0.55 | -0.55 | low | no | 0.00% (N=1)⚠️ |
| 17 | `emotions.dissociation <= 0.65` | 0.25% | 0.00% (0 / 327) | 100000 | 0.00 | 0.65 | -0.65 | low | yes | 0.00% (N=1)⚠️ |

**OR Block #1 (ANY ONE must pass)**

| # | Condition | Fail% global | Fail% \| mood-pass | Support | Bound | Threshold | Gap | Tunable | Redundant (regime) | Sole-Blocker Rate |
|---|-----------|--------------|-------------------|---------|-------|-----------|-----|---------|-------------------|-------------------|
| 18 | `emotions.sadness >= 0.22` | 78.62% | 73.39% (240 / 327) | 100000 | 0.97 | 0.22 | -0.75 | moderate | no | N/A (OR alt) |
| 19 | `emotions.grief >= 0.18` | 84.41% | 23.55% (77 / 327) | 100000 | 0.95 | 0.18 | -0.77 | low | no | N/A (OR alt) |
| 20 | `emotions.disappointment >= 0.25` | 82.40% | 63.91% (209 / 327) | 100000 | 0.96 | 0.25 | -0.71 | moderate | no | N/A (OR alt) |
| 21 | `emotions.regret >= 0.18` | 84.57% | 27.83% (91 / 327) | 100000 | 0.92 | 0.18 | -0.74 | low | no | N/A (OR alt) |
| 22 | `emotions.lonely_yearning >= 0.25` | 99.03% | 82.87% (271 / 327) | 100000 | 0.87 | 0.25 | -0.62 | low | no | N/A (OR alt) |
| 23 | `emotions.embarrassment >= 0.2` | 85.89% | 21.10% (69 / 327) | 100000 | 0.93 | 0.20 | -0.73 | moderate | no | N/A (OR alt) |

**Combined OR Block**: 60.66% pass rate (Fail% global: 39.34% | Fail% \| mood-pass: 1.83%)

**OR Block #1 OR Alternative Coverage** (44086 total successes):

| Alternative | P(alt passes \| OR pass) | P(alt exclusively passes \| OR pass) | First-pass share (order-dependent) |
|------------|---------------------------|------------------------------------|------------------------------------|
| `emotions.sadness >= 0.22` | 48.49% (21379/44086) | 9.54% (4205/44086) | 48.49% (21379/44086) |
| `emotions.disappointment >= 0.25` | 39.92% (17601/44086) | 8.11% (3576/44086) | 12.69% (5596/44086) |
| `emotions.grief >= 0.18` | 35.36% (15591/44086) | 4.47% (1970/44086) | 14.27% (6290/44086) |
| `emotions.regret >= 0.18` | 35.00% (15432/44086) | 4.16% (1834/44086) | 7.07% (3117/44086) |
| `emotions.embarrassment >= 0.2` | 32.00% (14109/44086) | 17.19% (7577/44086) | 17.19% (7577/44086) |
| `emotions.lonely_yearning >= 0.25` | 2.19% (967/44086) | 0.27% (120/44086) | 0.29% (127/44086) |
*First-pass share is order-dependent; use pass/exclusive rates for order-independent attribution.*

**OR Block #2 (ANY ONE must pass)**

| # | Condition | Fail% global | Fail% \| mood-pass | Support | Bound | Threshold | Gap | Tunable | Redundant (regime) | Sole-Blocker Rate |
|---|-----------|--------------|-------------------|---------|-------|-----------|-----|---------|-------------------|-------------------|
| 24 | `(emotions.anger - previousEmotions.anger) >= 0.08` | 85.18% | 48.93% (160 / 327) | 100000 | - | - | - | low | N/A | N/A (OR alt) |
| 25 | `(emotions.lonely_yearning - previousEmotions.lonely_yearning) >= 0.08` | 98.66% | 82.57% (270 / 327) | 100000 | - | - | - | low | N/A | N/A (OR alt) |
| 26 | `(moodAxes.self_evaluation - previousMoodAxes.self_evaluation) <= -10` | 54.58% | 26.61% (87 / 327) | 100000 | - | - | - | low | N/A | N/A (OR alt) |
| 27 | `(moodAxes.affiliation - previousMoodAxes.affiliation) <= -12` | 55.76% | 83.49% (273 / 327) | 100000 | - | - | - | low | N/A | N/A (OR alt) |
| | **AND Group (2 conditions - all must pass together)** | | | | | | | | | |
| 28 | `└─ previousEmotions.anger < 0.4` | 6.26% | 6.73% (22 / 327) | 100000 | 0.00 | 0.40 | -0.40 | moderate | no | N/A (OR alt) |
| 29 | `└─ emotions.anger >= 0.4` | 93.71% | 86.54% (283 / 327) | 100000 | 0.89 | 0.40 | -0.49 | moderate | no | N/A (OR alt) |

**Combined OR Block**: 75.93% pass rate (Fail% global: 24.07% | Fail% \| mood-pass: 9.17%)

**OR Block #2 OR Alternative Coverage** (74136 total successes):

| Alternative | P(alt passes \| OR pass) | P(alt exclusively passes \| OR pass) | First-pass share (order-dependent) |
|------------|---------------------------|------------------------------------|------------------------------------|
| `(moodAxes.self_evaluation - previousMoodAxes.self_evaluation) <= -10` | 61.27% (45423/74136) | 29.03% (21525/74136) | 51.46% (38148/74136) |
| `(moodAxes.affiliation - previousMoodAxes.affiliation) <= -12` | 59.67% (44239/74136) | 27.32% (20257/74136) | 27.34% (20267/74136) |
| `(emotions.anger - previousEmotions.anger) >= 0.08` | 19.99% (14820/74136) | 3.59% (2662/74136) | 19.99% (14820/74136) |
| `(AND: previousEmotions.anger < 0.4 & emotions.anger >= 0.4)` | 7.92% (5868/74136) | 0.01% (11/74136) | 0.01% (11/74136) |
| `(emotions.lonely_yearning - previousEmotions.lonely_yearning) >= 0.08` | 1.81% (1343/74136) | 0.44% (327/74136) | 1.20% (890/74136) |
*First-pass share is order-dependent; use pass/exclusive rates for order-independent attribution.*

#### Worst Offender Analysis

**#1: `emotions.anger >= 0.4`** (Fail% global: 93.71% | Fail% \| mood-pass: N/A)

**#2: `emotions.lonely_yearning >= 0.25`** ⚠️ OR-alternative (Fail% global: 99.03% | Fail% \| mood-pass: N/A)
- ℹ️ This is an alternative within an OR block; other alternatives may cover this case

**#3: `(emotions.lonely_yearning - previousEmotions.lonely_yearning) >= 0.08`** ⚠️ OR-alternative (Fail% global: 98.66% | Fail% \| mood-pass: N/A)
- ℹ️ This is an alternative within an OR block; other alternatives may cover this case

**#4: `emotions.embarrassment >= 0.2`** ⚠️ OR-alternative (Fail% global: 85.89% | Fail% \| mood-pass: N/A)
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
| Global | 0.00 | 0.31 | 0.44 | 0.00 | 0.87 | 50.25% |
| In mood regime | 0.16 | 0.45 | 0.48 | 0.00 | 0.50 | 88.57% |

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
- ✅ `arousal >= 0.10` - Satisfiable | **Observed Fail Rate**: 49.75%

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
| Global | 0.00 | 0.24 | 0.41 | 0.00 | 0.86 | 50.25% |
| In mood regime | 0.00 | 0.41 | 0.46 | 0.00 | 0.49 | 88.57% |

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
- ✅ `arousal >= 0.25` - Satisfiable | **Observed Fail Rate**: 49.75%

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
| Global | 0.00 | 0.33 | 0.47 | 0.00 | 0.82 | 50.33% |
| In mood regime | 0.00 | 0.23 | 0.26 | 0.00 | 0.28 | 60.00% |

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
- ✅ `agency_control >= 0.20` - Satisfiable | **Observed Fail Rate**: 49.67%

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
| Global | 0.00 | 0.37 | 0.47 | 0.00 | 0.86 | 100.00% |
| In mood regime | 0.04 | 0.23 | 0.26 | 0.00 | 0.26 | 100.00% |

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
| Global | 0.00 | 0.29 | 0.44 | 0.00 | 0.88 | 50.25% |
| In mood regime | 0.29 | 0.58 | 0.63 | 0.00 | 0.67 | 88.57% |

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
- ✅ `arousal >= 0.10` - Satisfiable | **Observed Fail Rate**: 49.75%

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
| Global | 0.00 | 0.00 | 0.00 | 0.00 | 0.80 | 12.67% |
| In mood regime | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 88.57% |

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
- ✅ `threat >= 0.50` - Satisfiable | **Observed Fail Rate**: 50.10%
- ✅ `arousal >= 0.55` - Satisfiable | **Observed Fail Rate**: 49.75%
- ✅ `agency_control <= -0.10` - Satisfiable
- ✅ `valence <= -0.15` - Satisfiable
- ✅ `engagement >= 0.10` - Satisfiable | **Observed Fail Rate**: 50.30%

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
| Global | 0.00 | 0.00 | 0.42 | 0.00 | 0.88 | 25.28% |
| In mood regime | 0.00 | 0.36 | 0.45 | 0.00 | 0.59 | 88.57% |

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
- ✅ `threat >= 0.50` - Satisfiable | **Observed Fail Rate**: 50.10%
- ✅ `arousal >= 0.30` - Satisfiable | **Observed Fail Rate**: 49.75%

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
| Global | 0.00 | 0.00 | 0.00 | 0.00 | 0.78 | 12.11% |
| In mood regime | 0.00 | 0.51 | 0.62 | 0.00 | 0.65 | 11.43% |

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
- ✅ `threat >= 0.35` - Satisfiable | **Observed Fail Rate**: 50.10%
- ✅ `agency_control <= -0.30` - Satisfiable
- ✅ `valence <= -0.05` - Satisfiable
- ✅ `arousal >= -0.10` - Satisfiable
- ✅ `arousal <= 0.40` - Satisfiable | **Observed Fail Rate**: 50.25%
- ✅ `engagement >= 0.05` - Satisfiable | **Observed Fail Rate**: 50.30%

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
| Global | 0.00 | 0.00 | 0.00 | 0.00 | 0.87 | 12.27% |
| In mood regime | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 11.43% |

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
- ✅ `threat >= 0.35` - Satisfiable | **Observed Fail Rate**: 50.10%
- ✅ `agency_control <= -0.20` - Satisfiable
- ❌ `engagement <= -0.20` - Constraint min (0.15) > gate requirement (-0.2)
- ✅ `arousal <= 0.35` - Satisfiable | **Observed Fail Rate**: 50.25%
- ✅ `valence <= 0.10` - Satisfiable | **Observed Fail Rate**: 49.68%
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
| Global | 0.00 | 0.48 | 0.59 | 0.00 | 0.95 | 49.75% |
| In mood regime | 0.00 | 0.35 | 0.37 | 0.00 | 0.57 | 11.43% |

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -1.00 | [-1.00, -0.10] | -1.00 | 1.000 | — |
| arousal | -0.50 | [-0.05, 0.55] | -0.05 | 0.025 | ⚠️ yes |
| agency_control | -0.30 | [-1.00, 1.00] | -1.00 | 0.300 | — |

**Gates** ✅:
- ✅ `valence <= -0.20` - Satisfiable
- ✅ `arousal <= 0.20` - Satisfiable | **Observed Fail Rate**: 50.25%

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
| Global | 0.00 | 0.36 | 0.50 | 0.00 | 0.91 | 49.70% |
| In mood regime | 0.34 | 0.52 | 0.68 | 0.00 | 0.75 | 100.00% |

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
- ✅ `engagement >= 0.10` - Satisfiable | **Observed Fail Rate**: 50.30%

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
| Global | 0.00 | 0.45 | 0.56 | 0.00 | 0.96 | 100.00% |
| In mood regime | 0.24 | 0.57 | 0.64 | 0.00 | 0.67 | 100.00% |

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
| Global | 0.00 | 0.38 | 0.53 | 0.00 | 0.91 | 100.00% |
| In mood regime | 0.36 | 0.59 | 0.84 | 0.00 | 0.87 | 100.00% |

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
| Global | 0.00 | 0.00 | 0.00 | 0.00 | 0.74 | 12.71% |
| In mood regime | 0.00 | 0.42 | 0.48 | 0.00 | 0.53 | 0.00% |

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
- ✅ `engagement >= 0.25` - Satisfiable | **Observed Fail Rate**: 50.30%
- ✅ `valence <= -0.10` - Satisfiable
- ✅ `threat <= 0.40` - Satisfiable | **Observed Fail Rate**: 49.90%
- ✅ `arousal >= -0.10` - Satisfiable
- ✅ `arousal <= 0.35` - Satisfiable | **Observed Fail Rate**: 50.25%
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
| Global | 0.00 | 0.33 | 0.47 | 0.00 | 0.92 | 49.90% |
| In mood regime | 0.39 | 0.59 | 0.72 | 0.00 | 0.72 | 100.00% |

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
- ✅ `threat >= 0.20` - Satisfiable | **Observed Fail Rate**: 50.10%

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
| Global | 0.00 | 0.31 | 0.44 | 0.00 | 0.87 | 50.25% |
| In mood regime | 0.16 | 0.45 | 0.48 | 0.00 | 0.50 | 88.57% |

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
- ✅ `arousal >= 0.10` - Satisfiable | **Observed Fail Rate**: 49.75%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **affiliation**: Has negative weight (-0.30) but constraint requires min 0.20

**Analysis**: Threshold 0.4 is achievable (max: 0.721). Binding conflicts: affiliation has negative weight (-0.30) but constraint requires min=0.20



#### Distribution Analysis
- **Compound Node**: Aggregated from 29 leaf conditions (19 top-level conditions; 29 when OR blocks expanded)
- **Highest Avg Violation**: 71.26 (from `(moodAxes.affiliation - previousMoodAxes.affiliation) <= -12`)
- **Highest P90 Violation**: 146.00
- **Highest P95 Violation**: 166.00
- **Highest P99 Violation**: 193.00
- **Interpretation**: Worst violator: (moodAxes.affiliation - previousMoodAxes.affiliation) <= -12

#### Ceiling Analysis
- **Compound Node**: Contains multiple conditions
- **Status**: No ceiling effects detected in leaf conditions
- **Insight**: All thresholds appear achievable based on observed values

#### Near-Miss Analysis
- **Compound Node**: Contains 29 leaf conditions
- **Most Tunable Condition**: `moodAxes.affiliation >= 20`
- **Near-Miss Rate**: 4.41% (epsilon: 5.00)
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

**Mood regime filter**: 35 contexts where all mood constraints pass
- Constraints: `moodAxes.affiliation >= 20`, `moodAxes.valence <= -10`, `moodAxes.self_evaluation <= -5`, `moodAxes.engagement >= 15`, `moodAxes.threat >= 10`, `moodAxes.threat <= 70`, `moodAxes.arousal >= -5`, `moodAxes.arousal <= 55`

| Condition | P(pass \| mood) | Passes | CI (95%) |
|-----------|-----------------|--------|----------|
| `emotions.lonely_yearning >= 0.25` | 14.29% | 5/35 | [6.26%, 29.38%] |
| `emotions.anger >= 0.4` | 17.14% | 6/35 | [8.10%, 32.68%] |
| `emotions.sadness >= 0.22` | 25.71% | 9/35 | [14.16%, 42.07%] |
| `emotions.disappointment >= 0.25` | 48.57% | 17/35 | [32.99%, 64.43%] |
| `emotions.hatred <= 0.35` | 57.14% | 20/35 | [40.86%, 72.02%] |
| `emotions.regret >= 0.18` | 57.14% | 20/35 | [40.86%, 72.02%] |
| `emotions.grief >= 0.18` | 77.14% | 27/35 | [60.98%, 87.93%] |
| `emotions.embarrassment >= 0.2` | 77.14% | 27/35 | [60.98%, 87.93%] |
| `emotions.freeze <= 0.55` | 91.43% | 32/35 | [77.62%, 97.04%] |
| `emotions.terror <= 0.5` | 97.14% | 34/35 | [85.47%, 99.49%] |
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

**Insufficient data**: fewer than 5 baseline expression hits. Global sensitivity tables are suppressed for low-confidence runs.

## Sensitivity Analysis

This section shows how adjusting emotion/sexual thresholds would affect the trigger rate.
Use this to identify optimal threshold values for your desired trigger frequency.

### emotions.anger >= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.20 | 13.96% | +114.44% | 10.000 |
| 0.25 | 12.10% | +85.87% | 10.000 |
| 0.30 | 10.43% | +60.22% | 10.000 |
| 0.35 | 8.40% | +29.03% | 10.000 |
| **0.40** | **6.51%** | **baseline** | 10.000 |
| 0.45 | 4.78% | -26.57% | 10.000 |
| 0.50 | 3.23% | -50.38% | 10.000 |
| 0.55 | 2.10% | -67.74% | 10.000 |
| 0.60 | 1.29% | -80.18% | 10.000 |

### emotions.rage < [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.35 | 93.19% | -5.01% | 10.000 |
| 0.40 | 94.72% | -3.45% | 10.000 |
| 0.45 | 96.12% | -2.02% | 10.000 |
| 0.50 | 97.22% | -0.90% | 10.000 |
| **0.55** | **98.10%** | **baseline** | 10.000 |
| 0.60 | 98.83% | +0.74% | 10.000 |
| 0.65 | 99.31% | +1.23% | 10.000 |
| 0.70 | 99.64% | +1.57% | 10.000 |
| 0.75 | 99.85% | +1.78% | 10.000 |

### moodAxes.affiliation >= [threshold]

| Threshold | Effective Threshold | Pass Rate | Change | Samples |
|-----------|---------------------|-----------|--------|---------|
| 16 | 16 | 41.95% | +5.32% | 10.000 |
| 17 | 17 | 41.51% | +4.22% | 10.000 |
| 18 | 18 | 40.95% | +2.81% | 10.000 |
| 19 | 19 | 40.32% | +1.23% | 10.000 |
| **20** | **20** | **39.83%** | **baseline** | 10.000 |
| 21 | 21 | 39.30% | -1.33% | 10.000 |
| 22 | 22 | 38.82% | -2.54% | 10.000 |
| 23 | 23 | 38.32% | -3.79% | 10.000 |
| 24 | 24 | 37.90% | -4.85% | 10.000 |

_Thresholds are integer-effective; decimals collapse to integer boundaries._

### moodAxes.valence <= [threshold]

| Threshold | Effective Threshold | Pass Rate | Change | Samples |
|-----------|---------------------|-----------|--------|---------|
| -14 | -14 | 42.67% | -5.22% | 10.000 |
| -13 | -13 | 43.21% | -4.02% | 10.000 |
| -12 | -12 | 43.94% | -2.40% | 10.000 |
| -11 | -11 | 44.42% | -1.33% | 10.000 |
| **-10** | **-10** | **45.02%** | **baseline** | 10.000 |
| -9 | -9 | 45.57% | +1.22% | 10.000 |
| -8 | -8 | 46.27% | +2.78% | 10.000 |
| -7 | -7 | 46.94% | +4.26% | 10.000 |
| -6 | -6 | 47.49% | +5.49% | 10.000 |

_Thresholds are integer-effective; decimals collapse to integer boundaries._

### moodAxes.self_evaluation <= [threshold]

| Threshold | Effective Threshold | Pass Rate | Change | Samples |
|-----------|---------------------|-----------|--------|---------|
| -9 | -9 | 45.68% | -3.73% | 10.000 |
| -8 | -8 | 46.13% | -2.78% | 10.000 |
| -7 | -7 | 46.55% | -1.90% | 10.000 |
| -6 | -6 | 46.94% | -1.07% | 10.000 |
| **-5** | **-5** | **47.45%** | **baseline** | 10.000 |
| -4 | -4 | 48.01% | +1.18% | 10.000 |
| -3 | -3 | 48.62% | +2.47% | 10.000 |
| -2 | -2 | 49.09% | +3.46% | 10.000 |
| -1 | -1 | 49.54% | +4.40% | 10.000 |

_Thresholds are integer-effective; decimals collapse to integer boundaries._

### moodAxes.engagement >= [threshold]

| Threshold | Effective Threshold | Pass Rate | Change | Samples |
|-----------|---------------------|-----------|--------|---------|
| 11 | 11 | 44.17% | +4.99% | 10.000 |
| 12 | 12 | 43.61% | +3.66% | 10.000 |
| 13 | 13 | 43.03% | +2.28% | 10.000 |
| 14 | 14 | 42.59% | +1.24% | 10.000 |
| **15** | **15** | **42.07%** | **baseline** | 10.000 |
| 16 | 16 | 41.56% | -1.21% | 10.000 |
| 17 | 17 | 40.97% | -2.61% | 10.000 |
| 18 | 18 | 40.45% | -3.85% | 10.000 |
| 19 | 19 | 40.08% | -4.73% | 10.000 |

_Thresholds are integer-effective; decimals collapse to integer boundaries._

### moodAxes.threat >= [threshold]

| Threshold | Effective Threshold | Pass Rate | Change | Samples |
|-----------|---------------------|-----------|--------|---------|
| 6 | 6 | 47.69% | +4.35% | 10.000 |
| 7 | 7 | 47.16% | +3.19% | 10.000 |
| 8 | 8 | 46.64% | +2.06% | 10.000 |
| 9 | 9 | 46.11% | +0.90% | 10.000 |
| **10** | **10** | **45.70%** | **baseline** | 10.000 |
| 11 | 11 | 45.21% | -1.07% | 10.000 |
| 12 | 12 | 44.75% | -2.08% | 10.000 |
| 13 | 13 | 44.13% | -3.44% | 10.000 |
| 14 | 14 | 43.60% | -4.60% | 10.000 |

_Thresholds are integer-effective; decimals collapse to integer boundaries._

### moodAxes.threat <= [threshold]

| Threshold | Effective Threshold | Pass Rate | Change | Samples |
|-----------|---------------------|-----------|--------|---------|
| 66 | 66 | 83.29% | -2.37% | 10.000 |
| 67 | 67 | 83.80% | -1.77% | 10.000 |
| 68 | 68 | 84.36% | -1.11% | 10.000 |
| 69 | 69 | 84.83% | -0.56% | 10.000 |
| **70** | **70** | **85.31%** | **baseline** | 10.000 |
| 71 | 71 | 85.77% | +0.54% | 10.000 |
| 72 | 72 | 86.11% | +0.94% | 10.000 |
| 73 | 73 | 86.53% | +1.43% | 10.000 |
| 74 | 74 | 87.00% | +1.98% | 10.000 |

_Thresholds are integer-effective; decimals collapse to integer boundaries._

### moodAxes.arousal >= [threshold]

| Threshold | Effective Threshold | Pass Rate | Change | Samples |
|-----------|---------------------|-----------|--------|---------|
| -9 | -9 | 55.02% | +3.11% | 10.000 |
| -8 | -8 | 54.68% | +2.47% | 10.000 |
| -7 | -7 | 54.26% | +1.69% | 10.000 |
| -6 | -6 | 53.90% | +1.01% | 10.000 |
| **-5** | **-5** | **53.36%** | **baseline** | 10.000 |
| -4 | -4 | 52.88% | -0.90% | 10.000 |
| -3 | -3 | 52.39% | -1.82% | 10.000 |
| -2 | -2 | 51.93% | -2.68% | 10.000 |
| -1 | -1 | 51.51% | -3.47% | 10.000 |

_Thresholds are integer-effective; decimals collapse to integer boundaries._

### moodAxes.arousal <= [threshold]

| Threshold | Effective Threshold | Pass Rate | Change | Samples |
|-----------|---------------------|-----------|--------|---------|
| 51 | 51 | 75.02% | -2.81% | 10.000 |
| 52 | 52 | 75.46% | -2.24% | 10.000 |
| 53 | 53 | 76.05% | -1.48% | 10.000 |
| 54 | 54 | 76.62% | -0.74% | 10.000 |
| **55** | **55** | **77.19%** | **baseline** | 10.000 |
| 56 | 56 | 77.71% | +0.67% | 10.000 |
| 57 | 57 | 78.26% | +1.39% | 10.000 |
| 58 | 58 | 78.72% | +1.98% | 10.000 |
| 59 | 59 | 79.14% | +2.53% | 10.000 |

_Thresholds are integer-effective; decimals collapse to integer boundaries._

### emotions.contempt <= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.20 | 85.16% | -7.96% | 10.000 |
| 0.25 | 86.73% | -6.27% | 10.000 |
| 0.30 | 88.74% | -4.10% | 10.000 |
| 0.35 | 90.83% | -1.84% | 10.000 |
| **0.40** | **92.53%** | **baseline** | 10.000 |
| 0.45 | 94.22% | +1.83% | 10.000 |
| 0.50 | 96.03% | +3.78% | 10.000 |
| 0.55 | 97.39% | +5.25% | 10.000 |
| 0.60 | 98.39% | +6.33% | 10.000 |

### emotions.disgust <= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.20 | 79.07% | -13.78% | 10.000 |
| 0.25 | 82.22% | -10.35% | 10.000 |
| 0.30 | 85.27% | -7.02% | 10.000 |
| 0.35 | 88.78% | -3.19% | 10.000 |
| **0.40** | **91.71%** | **baseline** | 10.000 |
| 0.45 | 94.14% | +2.65% | 10.000 |
| 0.50 | 96.01% | +4.69% | 10.000 |
| 0.55 | 97.34% | +6.14% | 10.000 |
| 0.60 | 98.54% | +7.45% | 10.000 |

### emotions.hatred <= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.15 | 85.55% | -6.86% | 10.000 |
| 0.20 | 87.02% | -5.26% | 10.000 |
| 0.25 | 88.52% | -3.63% | 10.000 |
| 0.30 | 90.28% | -1.71% | 10.000 |
| **0.35** | **91.85%** | **baseline** | 10.000 |
| 0.40 | 93.79% | +2.11% | 10.000 |
| 0.45 | 95.40% | +3.86% | 10.000 |
| 0.50 | 96.74% | +5.32% | 10.000 |
| 0.55 | 97.94% | +6.63% | 10.000 |

### emotions.panic <= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.20 | 99.62% | -0.01% | 10.000 |
| 0.25 | 99.62% | -0.01% | 10.000 |
| 0.30 | 99.62% | -0.01% | 10.000 |
| 0.35 | 99.63% | — | 10.000 |
| **0.40** | **99.63%** | **baseline** | 10.000 |
| 0.45 | 99.66% | +0.03% | 10.000 |
| 0.50 | 99.72% | +0.09% | 10.000 |
| 0.55 | 99.81% | +0.18% | 10.000 |
| 0.60 | 99.91% | +0.28% | 10.000 |

### emotions.terror <= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.30 | 92.66% | -4.40% | 10.000 |
| 0.35 | 93.58% | -3.45% | 10.000 |
| 0.40 | 94.69% | -2.30% | 10.000 |
| 0.45 | 95.81% | -1.15% | 10.000 |
| **0.50** | **96.92%** | **baseline** | 10.000 |
| 0.55 | 97.76% | +0.87% | 10.000 |
| 0.60 | 98.66% | +1.80% | 10.000 |
| 0.65 | 99.25% | +2.40% | 10.000 |
| 0.70 | 99.73% | +2.90% | 10.000 |

### emotions.freeze <= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.35 | 99.54% | -0.16% | 10.000 |
| 0.40 | 99.54% | -0.16% | 10.000 |
| 0.45 | 99.56% | -0.14% | 10.000 |
| 0.50 | 99.62% | -0.08% | 10.000 |
| **0.55** | **99.70%** | **baseline** | 10.000 |
| 0.60 | 99.81% | +0.11% | 10.000 |
| 0.65 | 99.87% | +0.17% | 10.000 |
| 0.70 | 99.93% | +0.23% | 10.000 |
| 0.75 | 99.96% | +0.26% | 10.000 |

### emotions.dissociation <= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.45 | 98.67% | -1.04% | 10.000 |
| 0.50 | 98.90% | -0.81% | 10.000 |
| 0.55 | 99.18% | -0.53% | 10.000 |
| 0.60 | 99.51% | -0.20% | 10.000 |
| **0.65** | **99.71%** | **baseline** | 10.000 |
| 0.70 | 99.83% | +0.12% | 10.000 |
| 0.75 | 99.96% | +0.25% | 10.000 |
| 0.80 | 99.98% | +0.27% | 10.000 |
| 0.85 | 99.99% | +0.28% | 10.000 |

### emotions.sadness >= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.02 | 23.59% | +13.69% | 10.000 |
| 0.07 | 23.18% | +11.71% | 10.000 |
| 0.12 | 22.72% | +9.49% | 10.000 |
| 0.17 | 21.93% | +5.69% | 10.000 |
| **0.22** | **20.75%** | **baseline** | 10.000 |
| 0.27 | 19.05% | -8.19% | 10.000 |
| 0.32 | 17.09% | -17.64% | 10.000 |
| 0.37 | 14.77% | -28.82% | 10.000 |
| 0.42 | 12.61% | -39.23% | 10.000 |

### emotions.grief >= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| -0.02 | 100.00% | +547.67% | 10.000 |
| 0.03 | 16.61% | +7.58% | 10.000 |
| 0.08 | 16.47% | +6.67% | 10.000 |
| 0.13 | 16.11% | +4.34% | 10.000 |
| **0.18** | **15.44%** | **baseline** | 10.000 |
| 0.23 | 14.33% | -7.19% | 10.000 |
| 0.28 | 12.85% | -16.77% | 10.000 |
| 0.33 | 11.15% | -27.78% | 10.000 |
| 0.38 | 9.25% | -40.09% | 10.000 |

### emotions.disappointment >= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 20.55% | +16.36% | 10.000 |
| 0.10 | 20.26% | +14.72% | 10.000 |
| 0.15 | 19.69% | +11.49% | 10.000 |
| 0.20 | 19.00% | +7.59% | 10.000 |
| **0.25** | **17.66%** | **baseline** | 10.000 |
| 0.30 | 16.18% | -8.38% | 10.000 |
| 0.35 | 14.17% | -19.76% | 10.000 |
| 0.40 | 11.88% | -32.73% | 10.000 |
| 0.45 | 9.81% | -44.45% | 10.000 |

### emotions.regret >= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| -0.02 | 100.00% | +568.00% | 10.000 |
| 0.03 | 15.71% | +4.94% | 10.000 |
| 0.08 | 15.62% | +4.34% | 10.000 |
| 0.13 | 15.44% | +3.14% | 10.000 |
| **0.18** | **14.97%** | **baseline** | 10.000 |
| 0.23 | 14.23% | -4.94% | 10.000 |
| 0.28 | 13.27% | -11.36% | 10.000 |
| 0.33 | 11.79% | -21.24% | 10.000 |
| 0.38 | 10.16% | -32.13% | 10.000 |

### emotions.lonely_yearning >= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 1.39% | +49.46% | 10.000 |
| 0.10 | 1.32% | +41.94% | 10.000 |
| 0.15 | 1.21% | +30.11% | 10.000 |
| 0.20 | 1.09% | +17.20% | 10.000 |
| **0.25** | **0.93%** | **baseline** | 10.000 |
| 0.30 | 0.83% | -10.75% | 10.000 |
| 0.35 | 0.72% | -22.58% | 10.000 |
| 0.40 | 0.59% | -36.56% | 10.000 |
| 0.45 | 0.41% | -55.91% | 10.000 |

### emotions.embarrassment >= [threshold]

| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.00 | 100.00% | +614.29% | 10.000 |
| 0.05 | 17.08% | +22.00% | 10.000 |
| 0.10 | 16.34% | +16.71% | 10.000 |
| 0.15 | 15.26% | +9.00% | 10.000 |
| **0.20** | **14.00%** | **baseline** | 10.000 |
| 0.25 | 12.65% | -9.64% | 10.000 |
| 0.30 | 11.07% | -20.93% | 10.000 |
| 0.35 | 9.16% | -34.57% | 10.000 |
| 0.40 | 7.49% | -46.50% | 10.000 |

## 🎯 Prototype Fit Analysis

Ranking of emotion prototypes by how well they fit this expression's mood regime.

| Rank | Prototype | Gate Pass | P(I≥t) | Conflict | Composite |
|------|-----------|-----------|--------|----------|-----------|
| 1 | **protest_anger** | 89.19% | 93.94% | 0.00% | 0.95 |
| 2 | **embarrassment** | 75.68% | 92.86% | 0.00% | 0.90 |
| 3 | **irritation** | 100.00% | 67.57% | 0.00% | 0.89 |
| 4 | **interest** | 91.89% | 79.41% | 16.67% | 0.87 |
| 5 | **unease** | 100.00% | 62.16% | 0.00% | 0.87 |
| 6 | **regret** | 59.46% | 95.45% | 0.00% | 0.86 |
| 7 | **surprise_startle** | 86.49% | 65.63% | 0.00% | 0.84 |
| 8 | **frustration** | 59.46% | 86.36% | 0.00% | 0.83 |
| 9 | **hatred** | 70.27% | 76.92% | 0.00% | 0.83 |
| 10 | **shame** | 72.97% | 74.07% | 0.00% | 0.83 |

### Top 3 Prototype Details

#### 1. protest_anger

- **Intensity Distribution**: P50=0.46, P90=0.62, P95=0.64
- **Conflicting Axes**: None

#### 2. embarrassment

- **Intensity Distribution**: P50=0.43, P90=0.59, P95=0.60
- **Conflicting Axes**: None

#### 3. irritation

- **Intensity Distribution**: P50=0.36, P90=0.58, P95=0.60
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
| 1 | **protest_anger** | 0.93 | 89.19% | 0.92 |
| 2 | **hypervigilance** | 0.79 | 40.54% | 0.64 |
| 3 | **embarrassment** | 0.79 | 75.68% | 0.78 |
| 4 | **humiliation** | 0.76 | 51.35% | 0.66 |
| 5 | **terror** | 0.76 | 16.22% | 0.52 |

### Top 5 by Gate Pass Rate

| Rank | Prototype | Gate Pass | Similarity | Combined |
|------|-----------|-----------|------------|----------|
| 1 | **unease** | 100.00% | 0.66 | 0.79 |
| 2 | **irritation** | 100.00% | 0.64 | 0.78 |
| 3 | **envy** | 100.00% | 0.65 | 0.79 |
| 4 | **interest** | 91.89% | 0.45 | 0.64 |
| 5 | **anticipation** | 89.19% | 0.33 | 0.56 |

### Top 5 by Combined Score

| Rank | Prototype | Combined | Similarity | Gate Pass |
|------|-----------|----------|------------|----------|
| 1 | **protest_anger** | 0.92 | 0.93 | 89.19% |
| 2 | **unease** | 0.79 | 0.66 | 100.00% |
| 3 | **envy** | 0.79 | 0.65 | 100.00% |
| 4 | **irritation** | 0.78 | 0.64 | 100.00% |
| 5 | **embarrassment** | 0.78 | 0.79 | 75.68% |

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

### “Mood-pass” sample count is inconsistent (and doesn’t match the math)

You have three different “how many samples are in the mood regime?” numbers:

Blocker section uses 327 (“Fail% | mood-pass … /327”).

Later you say 35 contexts where “all mood constraints pass”.

Back-of-the-envelope from your own global fail rates suggests it should be around ~1,000-ish out of 100,000 if mood axes are uniform and independent:

Using your global pass rates (which look exactly like uniform [-100,100] sampling):

affiliation ≥ 20 → ~40%

valence ≤ -10 → ~45%

self_eval ≤ -5 → ~47.5%

engagement ≥ 15 → ~42.5%

threat ∈ [10,70] → ~30%

arousal ∈ [-5,55] → ~30%

Multiply: 0.40×0.45×0.475×0.425×0.30×0.30 ≈ 1.1% → ~1,100 samples expected.

So 35 and 327 are both suspicious. This is the biggest “something is wrong” signal in the report.

Actionable reporting fix: define one regime name (“mood-regime”) and print its exact filter expression and exact count once, then reuse that count everywhere.

### How to investigate this

First: the “~1,000-ish” expectation has a math slip.
With your own pass-rates you get:

0.40 × 0.45 = 0.18

0.18 × 0.475 = 0.0855

0.0855 × 0.425 ≈ 0.03634

0.03634 × 0.30 ≈ 0.01090

0.01090 × 0.30 ≈ 0.00327 = 0.327%

So for 100,000 samples, the expected “mood-regime” count is ~327, not ~1,100. That makes the 327 denominator plausible. The real red flag is the “35 contexts” number: it’s almost certainly a different unit or a different filter.

Below is what I’d inspect, the invariants that must always hold, and the tests that prove it.

### What to look into (highest probability culprits)
1) “Samples” vs “contexts” confusion (unit mismatch)

If “35 contexts” means unique contexts, deduped buckets, witness contexts, world-states, etc., it’s not comparable to a raw sample denominator like 327.

Fix: every report number must declare its unit:

sample_count (raw Monte Carlo draws)

context_count (whatever your grouping is)

unique_mood_vectors (if you dedupe by mood tuple)

etc.

2) Same name, different predicate (filter mismatch)

You likely have multiple predicates that are all being described as “mood pass”:

“mood constraints pass” (current mood only)

“mood constraints + previousMood constraints”

“mood constraints + prototype gates”

“mood constraints + derived emotion ceilings”

“mood constraints + expression prerequisites”

Fix: define one canonical regime object and reuse it everywhere:

exact predicate (stringified / serialized)

exact indices (sample ids)

exact count

3) Report sections computed off different pipelines (dataflow mismatch)

Common bug: one section uses allSamples, another uses filteredSamples, a third uses failedSamples, etc., but all print as if they were the same population.

Fix: every section should print:

population_name

population_count

and ideally a population_hash (hash of indices) so you can assert equality across sections.

4) Boundary semantics / off-by-one in ranges

threat ∈ [10,70] can mean any of:

inclusive both ends

inclusive/exclusive

normalized float space vs integer space

clamped values before checking vs after checking

These tiny differences can absolutely explain “327 vs 35” if one section uses different boundary semantics.

5) Cache / reuse bugs

If you compute mood-regime once, then later recompute with a different seed or overwrite a variable, sections will diverge.

Fix: make the regime immutable and passed by reference.

### Invariants that must hold (assert these in code)
A) Regime identity invariants

If two sections claim they’re using “mood-regime”, then:

Same count

countA == countB

Same members

set(indicesA) == set(indicesB) (or same hash)

Same predicate

printed predicate strings match exactly (or canonical JSON of the predicate AST matches)

If any of these fails, your report is lying.

B) Basic probability sanity invariants (for uniform independent sampling)

For a simple constraint like axis >= t or axis in [a,b], the measured pass-rate should match the theoretical rate within normal sampling error.

For N = 100,000 and p ≈ 0.00327, the standard deviation of the count is about sqrt(N p (1-p)) ≈ sqrt(327) ≈ 18.
So counts in roughly [290, 365] are “totally normal.” Counts like 35 are not.

C) Logical consistency invariants (AND/OR)

For an AND of clauses C1..Ck in the same population:

pass(AND) <= pass(Ci) for every i

fail(AND) >= fail(Ci) for every i

pass(AND) = count(samples where all clauses pass) / denom

For an OR of alternatives A1..Am:

pass(OR) >= pass(Aj) for every j

pass(OR) = pass(union of Aj pass-sets)

D) Clause accounting invariants (blocker reports)

If you compute per-clause fail rates within a population:

For every clause i: pass_i + fail_i == denom

If you compute “primary blocker” as “fails clause X most often”, then:

failRate(X) must be computed over the same denom as the AND-fail rate you’re comparing it to.

If you compute “sole blocker counts” (cases where exactly one clause fails):

sum(sole_blocker_counts) <= failCount(AND)

and: sole_blocker_count_i == count(failing AND samples where clause i fails and all others pass)

E) Gate/intensity invariants (prototype gating)

If you have prototype gates that zero an emotion intensity:

gate == false => intensity == 0 (or intensity undefined but then prerequisites must never treat it as nonzero)

Any report that claims “emotion ceiling within mood-regime” must use the same gate rules as runtime evaluation.

A frequent bug: reporting uses “raw prototype score”, runtime uses “gated score”.

### Tests to prove it (minimal but decisive)
1) “Regime contract” unit test (smokes out 80% of reporting bugs)

Create a function that returns:

moodRegime = { predicate, indices, count, hash }

Then every report section must accept a population object (not recompute).

Test:

Generate report.

Assert every section labeled “mood-regime” prints the same count and same hash.

2) Population equivalence tests (set-based)

For each named population your report uses (all, mood-regime, failed, passed, etc.):

Test:

passedSet ∪ failedSet == populationSet

passedSet ∩ failedSet == ∅

3) AND/OR set algebra property tests

Pick random samples (or use your Monte Carlo batch) and compute sets explicitly:

andSet == ⋂ clausePassSets

orSet == ⋃ altPassSets

This catches subtle evaluator-vs-reporter differences immediately.

4) Boundary semantics tests (range inclusivity)

Hardcode small, surgical cases:

threat = 10, 70, 9.999, 70.0001 (or integer neighbors)

arousal = -5, 55, etc.

Test:

predicate evaluation matches your declared semantics (inclusive/exclusive).

reporter uses the same predicate evaluator as runtime.

5) Monotonicity property tests (great for threshold bugs)

For any constraint x >= t:

lowering t must not decrease pass-rate
For any range [a,b]:

widening the range must not decrease pass-rate

You can run this on a fixed sample batch to avoid randomness.

6) Gate consistency tests

Construct samples where the gate is false but raw score would be high.

Test:

runtime emotion intensity is 0

report’s intensity/ceiling stats also treat it as 0 (or exclude identically)

7) Golden snapshot test for one expression (end-to-end regression)

With a fixed seed and N (even 10k is fine):

generate report JSON

snapshot it

assert key denominators and hashes never drift unexpectedly

This prevents “someone refactors reporting and silently breaks invariants.”

### The blunt diagnosis from your numbers

327 “mood-pass /327” is probably fine once the arithmetic is corrected.

The suspicious number is “35 contexts”: it’s either (a) a different filter, or (b) a different unit, or (c) a broken aggregation path. Your first job is to force the report to prove what population that 35 is drawn from (predicate + indices hash).

If you paste the relevant chunks of the report output (the lines around the 327 denominator and the “35 contexts” sentence), I can tell you which mismatch pattern it most likely is and what assertion will fail first.