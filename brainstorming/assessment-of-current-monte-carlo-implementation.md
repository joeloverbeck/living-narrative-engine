# Potential issues with our Monte Carlo implementation and the reports created

My goal with the reports generated in expression-diagnostics.html through the Monte Carlo section is that on their own they should be enough to determine what to tune in a prerequisite or in an upstream prototype. Regarding the hurt_anger.expression.json, that currently is considered rare to pass by Monte Carlo, the report generated is:

# Monte Carlo Analysis Report

**Expression**: hurt_anger
**Generated**: 2026-01-12T12:24:57.554Z
**Distribution**: uniform
**Sample Size**: 100000
**Sampling Mode**: static - Prototype-gated sampling (emotions derived from mood axes; not independent)
**Regime Note**: Report includes global vs in-regime (mood-pass) statistics

> **Note**: Emotions are computed via prototype gates, so emotion variables are not independent of mood axes.

---

## Population Summary

- **Total samples**: 100.000 (in-regime 326; 0.33%)
- **Stored contexts**: 10.000 of 100.000 (in-regime 23; 0.23%; limit 10.000)
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
| emotions | 15 | 91.18% | 92.00% | 87.05% | 0.0080% | good |
| moodAxes | 6 | 100.00% | 100.00% | 10.24% | 10.19% | good |
| previousEmotions | 2 | 85.62% | 95.00% | 91.09% | 5.00e-4% | good |
| previousMoodAxes | 2 | 100.00% | 100.00% | 10.24% | 10.22% | good |

### Lowest Coverage Variables

| Variable | Range Coverage | Bin Coverage | Tail Low | Tail High | Rating |
|----------|----------------|--------------|----------|-----------|--------|
| emotions.lonely_yearning | 77.04% | 80.00% | 98.71% | 0.00% | good |
| previousEmotions.lonely_yearning | 81.10% | 90.00% | 98.66% | 0.00% | good |
| emotions.panic | 84.99% | 70.00% | 99.47% | 0.00% | good |
| emotions.terror | 89.39% | 90.00% | 91.17% | 0.00% | good |
| emotions.disgust | 89.67% | 90.00% | 72.42% | 0.00% | good |

Notes:
- Range coverage is observed span divided by domain span.
- Bin coverage is occupancy across 10 equal-width bins.
- Tail coverage is the share of samples in the bottom/top 10.00% of the domain.
- Variables with unknown domain ranges are excluded from summaries.

### Coverage Conclusions

- emotions: upper tail is effectively untested (top 10% has 0.0080% of samples). High-threshold feasibility results are not trustworthy here.
- previousEmotions: upper tail is effectively untested (top 10% has 0.0005% of samples). High-threshold feasibility results are not trustworthy here.
- moodAxes: coverage looks healthy (full range, bins filled, tails represented). Feasibility failures here likely reflect true constraint strictness.
- previousMoodAxes: coverage looks healthy (full range, bins filled, tails represented). Feasibility failures here likely reflect true constraint strictness.
- Across variables: 17 show near-zero upper-tail coverage; 1 show truncated range. Those regions are effectively unvalidated by current sampling.
- Do not trust feasibility estimates for prerequisites that target the upper end of a domain; the sampler is not generating those states often enough to test them.
- Worst range coverage: min=77%.
- Worst upper-tail coverage: min tailHigh=0.0000%.
- Worst lower-tail coverage: min tailLow=10.0960%.

---

## Ground-Truth Witnesses

No triggering states found during simulation.


---

## Blocker Analysis
Signal: final (gate-clamped intensity).

### Blocker #1: `AND of 19 conditions`

**Condition**: Compound AND block
**Fail% global**: 100.00% (100000 / 100000)
**Fail% | mood-pass**: 100.00% (326 / 326)
**Severity**: critical
**Redundant in regime**: N/A

#### Flags
[DECISIVE] [UPSTREAM]

#### Condition Breakdown

**Required Conditions (ALL must pass)**

| # | Condition | Fail% global | Fail% \| mood-pass | Support | Bound | Threshold | Gap | Tunable | Redundant (regime) | Sole-Blocker Rate |
|---|-----------|--------------|-------------------|---------|-------|-----------|-----|---------|-------------------|-------------------|
| 1 | `emotions.anger >= 0.4` | 93.58% | 86.81% (283 / 326) | 100000 | 0.90 | 0.40 | -0.50 | moderate | no | 100.00% (N=139) |
| 2 | `emotions.rage < 0.55` | 1.89% | 0.00% (0 / 326) | 100000 | 0.00 | 0.55 | -0.55 | low | yes | N/A |
| 3 | `moodAxes.affiliation >= 20` | 59.84% | 0.00% (0 / 326) | 100000 | 100.00 | 20.00 | -80.00 | moderate | yes | 100.00% (N=4)⚠️ |
| 4 | `moodAxes.valence <= -10` | 54.78% | 0.00% (0 / 326) | 100000 | -100.00 | -10.00 | -90.00 | moderate | yes | N/A |
| 5 | `moodAxes.self_evaluation <= -5` | 52.27% | 0.00% (0 / 326) | 100000 | -100.00 | -5.00 | -95.00 | moderate | yes | N/A |
| 6 | `moodAxes.engagement >= 15` | 57.39% | 0.00% (0 / 326) | 100000 | 100.00 | 15.00 | -85.00 | moderate | yes | N/A |
| 7 | `moodAxes.threat >= 10` | 54.93% | 0.00% (0 / 326) | 100000 | 100.00 | 10.00 | -90.00 | moderate | yes | N/A |
| 8 | `moodAxes.threat <= 70` | 14.65% | 0.00% (0 / 326) | 100000 | -100.00 | 70.00 | -170.00 | moderate | yes | N/A |
| 9 | `moodAxes.arousal >= -5` | 47.05% | 0.00% (0 / 326) | 100000 | 100.00 | -5.00 | -105.00 | moderate | yes | N/A |
| 10 | `moodAxes.arousal <= 55` | 22.31% | 0.00% (0 / 326) | 100000 | -100.00 | 55.00 | -155.00 | moderate | yes | 100.00% (N=4)⚠️ |
| 11 | `emotions.contempt <= 0.4` | 7.22% | 0.31% (1 / 326) | 100000 | 0.00 | 0.40 | -0.40 | moderate | no | N/A |
| 12 | `emotions.disgust <= 0.4` | 8.63% | 0.00% (0 / 326) | 100000 | 0.00 | 0.40 | -0.40 | moderate | yes | N/A |
| 13 | `emotions.hatred <= 0.35` | 7.93% | 38.96% (127 / 326) | 100000 | 0.00 | 0.35 | -0.35 | moderate | no | 100.00% (N=42) |
| 14 | `emotions.panic <= 0.4` | 0.53% | 0.00% (0 / 326) | 100000 | 0.00 | 0.40 | -0.40 | low | yes | N/A |
| 15 | `emotions.terror <= 0.5` | 3.04% | 3.99% (13 / 326) | 100000 | 0.00 | 0.50 | -0.50 | low | no | N/A |
| 16 | `emotions.freeze <= 0.55` | 0.42% | 9.51% (31 / 326) | 100000 | 0.00 | 0.55 | -0.55 | low | no | N/A |
| 17 | `emotions.dissociation <= 0.65` | 0.26% | 0.00% (0 / 326) | 100000 | 0.00 | 0.65 | -0.65 | low | yes | N/A |

**OR Block #1 (ANY ONE must pass)**

| # | Condition | Fail% global | Fail% \| mood-pass | Support | Bound | Threshold | Gap | Tunable | Redundant (regime) | Sole-Blocker Rate |
|---|-----------|--------------|-------------------|---------|-------|-----------|-----|---------|-------------------|-------------------|
| 18 | `emotions.sadness >= 0.22` | 78.78% | 73.62% (240 / 326) | 100000 | 0.97 | 0.22 | -0.75 | moderate | no | N/A (OR alt) |
| 19 | `emotions.grief >= 0.18` | 84.51% | 26.69% (87 / 326) | 100000 | 0.94 | 0.18 | -0.76 | low | no | N/A (OR alt) |
| 20 | `emotions.disappointment >= 0.25` | 82.43% | 63.80% (208 / 326) | 100000 | 0.97 | 0.25 | -0.72 | moderate | no | N/A (OR alt) |
| 21 | `emotions.regret >= 0.18` | 84.61% | 28.22% (92 / 326) | 100000 | 0.97 | 0.18 | -0.79 | low | no | N/A (OR alt) |
| 22 | `emotions.lonely_yearning >= 0.25` | 99.06% | 84.66% (276 / 326) | 100000 | 0.77 | 0.25 | -0.52 | low | no | N/A (OR alt) |
| 23 | `emotions.embarrassment >= 0.2` | 85.95% | 20.55% (67 / 326) | 100000 | 0.95 | 0.20 | -0.75 | moderate | no | N/A (OR alt) |

**Combined OR Block**: 60.47% pass rate (Fail% global: 39.53% | Fail% \| mood-pass: 2.45%)

**OR Block #1 OR Alternative Coverage** (44043 total successes):

| Alternative | P(alt passes \| OR pass) | P(alt exclusively passes \| OR pass) | First-pass share (order-dependent) |
|------------|---------------------------|------------------------------------|------------------------------------|
| `emotions.sadness >= 0.22` | 48.18% (21222/44043) | 9.78% (4309/44043) | 48.18% (21222/44043) |
| `emotions.disappointment >= 0.25` | 39.89% (17568/44043) | 8.34% (3675/44043) | 13.23% (5825/44043) |
| `emotions.grief >= 0.18` | 35.18% (15493/44043) | 4.40% (1938/44043) | 14.30% (6298/44043) |
| `emotions.regret >= 0.18` | 34.95% (15394/44043) | 4.08% (1795/44043) | 7.02% (3093/44043) |
| `emotions.embarrassment >= 0.2` | 31.91% (14053/44043) | 16.99% (7481/44043) | 16.99% (7481/44043) |
| `emotions.lonely_yearning >= 0.25` | 2.15% (945/44043) | 0.26% (115/44043) | 0.28% (124/44043) |
*First-pass share is order-dependent; use pass/exclusive rates for order-independent attribution.*

**OR Block #2 (ANY ONE must pass)**

| # | Condition | Fail% global | Fail% \| mood-pass | Support | Bound | Threshold | Gap | Tunable | Redundant (regime) | Sole-Blocker Rate |
|---|-----------|--------------|-------------------|---------|-------|-----------|-----|---------|-------------------|-------------------|
| 24 | `(emotions.anger - previousEmotions.anger) >= 0.08` | 84.81% | 51.53% (168 / 326) | 100000 | - | - | - | low | N/A | N/A (OR alt) |
| 25 | `(emotions.lonely_yearning - previousEmotions.lonely_yearning) >= 0.08` | 98.69% | 84.36% (275 / 326) | 100000 | - | - | - | low | N/A | N/A (OR alt) |
| 26 | `(moodAxes.self_evaluation - previousMoodAxes.self_evaluation) <= -10` | 54.67% | 28.53% (93 / 326) | 100000 | - | - | - | low | N/A | N/A (OR alt) |
| 27 | `(moodAxes.affiliation - previousMoodAxes.affiliation) <= -12` | 55.49% | 85.89% (280 / 326) | 100000 | - | - | - | low | N/A | N/A (OR alt) |
| | **AND Group (2 conditions - all must pass together)** | | | | | | | | | |
| 28 | `└─ previousEmotions.anger < 0.4` | 6.43% | 5.83% (19 / 326) | 100000 | 0.00 | 0.40 | -0.40 | moderate | no | N/A (OR alt) |
| 29 | `└─ emotions.anger >= 0.4` | 93.58% | 86.81% (283 / 326) | 100000 | 0.90 | 0.40 | -0.50 | moderate | no | N/A (OR alt) |

**Combined OR Block**: 76.14% pass rate (Fail% global: 23.86% | Fail% \| mood-pass: 10.43%)

**OR Block #2 OR Alternative Coverage** (74349 total successes):

| Alternative | P(alt passes \| OR pass) | P(alt exclusively passes \| OR pass) | First-pass share (order-dependent) |
|------------|---------------------------|------------------------------------|------------------------------------|
| `(moodAxes.self_evaluation - previousMoodAxes.self_evaluation) <= -10` | 60.97% (45334/74349) | 28.71% (21343/74349) | 51.12% (38005/74349) |
| `(moodAxes.affiliation - previousMoodAxes.affiliation) <= -12` | 59.87% (44513/74349) | 27.26% (20264/74349) | 27.28% (20282/74349) |
| `(emotions.anger - previousEmotions.anger) >= 0.08` | 20.43% (15187/74349) | 3.66% (2719/74349) | 20.43% (15187/74349) |
| `(AND: previousEmotions.anger < 0.4 & emotions.anger >= 0.4)` | 8.09% (6012/74349) | 0.02% (13/74349) | 0.02% (13/74349) |
| `(emotions.lonely_yearning - previousEmotions.lonely_yearning) >= 0.08` | 1.77% (1315/74349) | 0.40% (299/74349) | 1.16% (862/74349) |
*First-pass share is order-dependent; use pass/exclusive rates for order-independent attribution.*

#### Worst Offender Analysis

**#1: `emotions.anger >= 0.4`** (Fail% global: 93.58% | Fail% \| mood-pass: N/A)

**#2: `emotions.lonely_yearning >= 0.25`** ⚠️ OR-alternative (Fail% global: 99.06% | Fail% \| mood-pass: N/A)
- ℹ️ This is an alternative within an OR block; other alternatives may cover this case

**#3: `(emotions.lonely_yearning - previousEmotions.lonely_yearning) >= 0.08`** ⚠️ OR-alternative (Fail% global: 98.69% | Fail% \| mood-pass: N/A)
- ℹ️ This is an alternative within an OR block; other alternatives may cover this case

**#4: `emotions.embarrassment >= 0.2`** ⚠️ OR-alternative (Fail% global: 85.95% | Fail% \| mood-pass: N/A)
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
| Global | final | 0.00 | 0.32 | 0.45 | 0.00 | 0.83 | 19.79% |
| Global | raw | 0.00 | 0.38 | 0.47 | 0.00 | 0.83 | N/A |
| In mood regime | final | 0.00 | 0.49 | 0.49 | 0.00 | 0.55 | 47.83% |
| In mood regime | raw | 0.20 | 0.49 | 0.49 | 0.00 | 0.55 | N/A |
- **Observed max (global, final)**: 0.83
- **Observed max (mood-regime, final)**: 0.55

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
- ✅ `valence <= -0.15` - Satisfiable | **Observed Fail Rate**: 56.35%
- ✅ `arousal >= 0.10` - Satisfiable | **Observed Fail Rate**: 54.26%

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
| Global | final | 0.00 | 0.25 | 0.42 | 0.00 | 0.82 | 14.68% |
| Global | raw | 0.00 | 0.37 | 0.47 | 0.00 | 0.82 | N/A |
| In mood regime | final | 0.00 | 0.47 | 0.47 | 0.00 | 0.53 | 26.09% |
| In mood regime | raw | 0.19 | 0.47 | 0.47 | 0.00 | 0.53 | N/A |
- **Observed max (global, final)**: 0.82
- **Observed max (mood-regime, final)**: 0.53

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
- ✅ `valence <= -0.25` - Satisfiable | **Observed Fail Rate**: 61.43%
- ✅ `arousal >= 0.25` - Satisfiable | **Observed Fail Rate**: 61.63%

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
| Global | final | 0.00 | 0.35 | 0.47 | 0.00 | 0.88 | 18.87% |
| Global | raw | 0.00 | 0.39 | 0.49 | 0.00 | 0.88 | N/A |
| In mood regime | final | 0.00 | 0.25 | 0.25 | 0.00 | 0.33 | 47.83% |
| In mood regime | raw | 0.00 | 0.25 | 0.25 | 0.00 | 0.33 | N/A |
- **Observed max (global, final)**: 0.88
- **Observed max (mood-regime, final)**: 0.33

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
- ✅ `valence <= -0.10` - Satisfiable | **Observed Fail Rate**: 53.84%
- ✅ `agency_control >= 0.20` - Satisfiable | **Observed Fail Rate**: 59.27%

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
| Global | final | 0.00 | 0.38 | 0.49 | 0.00 | 0.87 | 38.57% |
| Global | raw | 0.00 | 0.39 | 0.49 | 0.00 | 0.87 | N/A |
| In mood regime | final | 0.08 | 0.17 | 0.18 | 0.00 | 0.24 | 78.26% |
| In mood regime | raw | 0.08 | 0.17 | 0.18 | 0.00 | 0.24 | N/A |
- **Observed max (global, final)**: 0.87
- **Observed max (mood-regime, final)**: 0.24

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
- ✅ `valence <= -0.25` - Satisfiable | **Observed Fail Rate**: 61.43%

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
| Global | final | 0.00 | 0.29 | 0.45 | 0.00 | 0.86 | 17.44% |
| Global | raw | 0.00 | 0.38 | 0.48 | 0.00 | 0.86 | N/A |
| In mood regime | final | 0.00 | 0.63 | 0.66 | 0.00 | 0.70 | 43.48% |
| In mood regime | raw | 0.36 | 0.66 | 0.70 | 0.00 | 0.70 | N/A |
- **Observed max (global, final)**: 0.86
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
- ✅ `valence <= -0.25` - Satisfiable | **Observed Fail Rate**: 61.43%
- ✅ `arousal >= 0.10` - Satisfiable | **Observed Fail Rate**: 54.26%

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
| Global | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.81 | 0.55% |
| Global | raw | 0.00 | 0.32 | 0.41 | 0.00 | 0.81 | N/A |
| In mood regime | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00% |
| In mood regime | raw | 0.21 | 0.46 | 0.49 | 0.06 | 0.52 | N/A |
- **Observed max (global, final)**: 0.81
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
- ✅ `threat >= 0.50` - Satisfiable | **Observed Fail Rate**: 74.55%
- ✅ `arousal >= 0.55` - Satisfiable | **Observed Fail Rate**: 76.67%
- ✅ `agency_control <= -0.10` - Satisfiable | **Observed Fail Rate**: 53.91%
- ✅ `valence <= -0.15` - Satisfiable | **Observed Fail Rate**: 56.35%
- ✅ `engagement >= 0.10` - Satisfiable | **Observed Fail Rate**: 55.04%

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
| Global | final | 0.00 | 0.00 | 0.40 | 0.00 | 0.94 | 9.06% |
| Global | raw | 0.00 | 0.38 | 0.48 | 0.00 | 0.94 | N/A |
| In mood regime | final | 0.00 | 0.00 | 0.39 | 0.00 | 0.50 | 8.70% |
| In mood regime | raw | 0.29 | 0.47 | 0.48 | 0.00 | 0.50 | N/A |
- **Observed max (global, final)**: 0.94
- **Observed max (mood-regime, final)**: 0.50

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
- ✅ `threat >= 0.50` - Satisfiable | **Observed Fail Rate**: 74.55%
- ✅ `arousal >= 0.30` - Satisfiable | **Observed Fail Rate**: 64.32%

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
| Global | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.81 | 0.68% |
| Global | raw | 0.00 | 0.42 | 0.52 | 0.00 | 0.86 | N/A |
| In mood regime | final | 0.00 | 0.44 | 0.61 | 0.00 | 0.63 | 17.39% |
| In mood regime | raw | 0.19 | 0.61 | 0.61 | 0.00 | 0.63 | N/A |
- **Observed max (global, final)**: 0.81
- **Observed max (mood-regime, final)**: 0.63

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
- ✅ `threat >= 0.35` - Satisfiable | **Observed Fail Rate**: 67.33%
- ✅ `agency_control <= -0.30` - Satisfiable | **Observed Fail Rate**: 63.69%
- ✅ `valence <= -0.05` - Satisfiable | **Observed Fail Rate**: 51.61%
- ✅ `arousal >= -0.10` - Satisfiable | **Observed Fail Rate**: 45.02%
- ✅ `arousal <= 0.40` - Satisfiable | **Observed Fail Rate**: 30.39%
- ✅ `engagement >= 0.05` - Satisfiable | **Observed Fail Rate**: 52.40%

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
| Global | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.87 | 2.14% |
| Global | raw | 0.00 | 0.36 | 0.45 | 0.00 | 0.87 | N/A |
| In mood regime | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.00 | 0.00% |
| In mood regime | raw | 0.00 | 0.16 | 0.26 | 0.00 | 0.33 | N/A |
- **Observed max (global, final)**: 0.87
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
- ✅ `threat >= 0.35` - Satisfiable | **Observed Fail Rate**: 67.33%
- ✅ `agency_control <= -0.20` - Satisfiable | **Observed Fail Rate**: 58.70%
- ❌ `engagement <= -0.20` - Constraint min (0.15) > gate requirement (-0.2) | **Observed Fail Rate**: 58.95%
- ✅ `arousal <= 0.35` - Satisfiable | **Observed Fail Rate**: 32.80%
- ✅ `valence <= 0.10` - Satisfiable | **Observed Fail Rate**: 45.25%
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
| Global | final | 0.00 | 0.50 | 0.61 | 0.00 | 0.96 | 24.63% |
| Global | raw | 0.00 | 0.51 | 0.61 | 0.00 | 0.96 | N/A |
| In mood regime | final | 0.00 | 0.46 | 0.51 | 0.00 | 0.59 | 47.83% |
| In mood regime | raw | 0.27 | 0.51 | 0.53 | 0.07 | 0.59 | N/A |
- **Observed max (global, final)**: 0.96
- **Observed max (mood-regime, final)**: 0.59

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -1.00 | [-1.00, -0.10] | -1.00 | 1.000 | — |
| arousal | -0.50 | [-0.05, 0.55] | -0.05 | 0.025 | ⚠️ yes |
| agency_control | -0.30 | [-1.00, 1.00] | -1.00 | 0.300 | — |

**Gates** ✅:
- ✅ `valence <= -0.20` - Satisfiable | **Observed Fail Rate**: 58.91%
- ✅ `arousal <= 0.20` - Satisfiable | **Observed Fail Rate**: 40.27%

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
| Global | final | 0.00 | 0.39 | 0.52 | 0.00 | 0.86 | 17.33% |
| Global | raw | 0.00 | 0.43 | 0.52 | 0.00 | 0.86 | N/A |
| In mood regime | final | 0.39 | 0.50 | 0.58 | 0.00 | 0.61 | 78.26% |
| In mood regime | raw | 0.40 | 0.51 | 0.58 | 0.15 | 0.61 | N/A |
- **Observed max (global, final)**: 0.86
- **Observed max (mood-regime, final)**: 0.61

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -1.00 | [-1.00, -0.10] | -1.00 | 1.000 | — |
| arousal | -0.30 | [-0.05, 0.55] | -0.05 | 0.015 | ⚠️ yes |
| engagement | +0.60 | [0.15, 1.00] | 1.00 | 0.600 | — |
| agency_control | -0.40 | [-1.00, 1.00] | -1.00 | 0.400 | — |

**Gates** ✅:
- ✅ `valence <= -0.25` - Satisfiable | **Observed Fail Rate**: 61.43%
- ✅ `engagement >= 0.10` - Satisfiable | **Observed Fail Rate**: 55.04%

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
| Global | final | 0.00 | 0.46 | 0.58 | 0.00 | 0.94 | 20.97% |
| Global | raw | 0.00 | 0.47 | 0.58 | 0.00 | 0.94 | N/A |
| In mood regime | final | 0.00 | 0.58 | 0.62 | 0.00 | 0.71 | 39.13% |
| In mood regime | raw | 0.23 | 0.58 | 0.62 | 0.00 | 0.71 | N/A |
- **Observed max (global, final)**: 0.94
- **Observed max (mood-regime, final)**: 0.71

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.70 | [-1.00, -0.10] | -1.00 | 0.700 | — |
| future_expectancy | -0.60 | [-1.00, 1.00] | -1.00 | 0.600 | — |
| arousal | -0.10 | [-0.05, 0.55] | -0.05 | 0.005 | ⚠️ yes |
| agency_control | -0.20 | [-1.00, 1.00] | -1.00 | 0.200 | — |

**Gates** ✅:
- ✅ `valence <= -0.10` - Satisfiable | **Observed Fail Rate**: 53.84%
- ✅ `future_expectancy <= -0.10` - Satisfiable | **Observed Fail Rate**: 54.54%

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
| Global | final | 0.00 | 0.40 | 0.53 | 0.00 | 0.91 | 16.71% |
| Global | raw | 0.01 | 0.44 | 0.54 | 0.00 | 0.91 | N/A |
| In mood regime | final | 0.27 | 0.67 | 0.70 | 0.00 | 0.75 | 56.52% |
| In mood regime | raw | 0.40 | 0.67 | 0.70 | 0.00 | 0.75 | N/A |
- **Observed max (global, final)**: 0.91
- **Observed max (mood-regime, final)**: 0.75

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.70 | [-1.00, -0.10] | -1.00 | 0.700 | — |
| self_evaluation | -0.80 | [-1.00, -0.05] | -1.00 | 0.800 | — |
| future_expectancy | -0.30 | [-1.00, 1.00] | -1.00 | 0.300 | — |
| arousal | +0.20 | [-0.05, 0.55] | 0.55 | 0.110 | ⚠️ yes |

**Gates** ✅:
- ✅ `self_evaluation <= -0.2` - Satisfiable | **Observed Fail Rate**: 58.50%
- ✅ `valence <= -0.2` - Satisfiable | **Observed Fail Rate**: 58.91%

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
| Global | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.77 | 1.36% |
| Global | raw | 0.00 | 0.33 | 0.42 | 0.00 | 0.77 | N/A |
| In mood regime | final | 0.00 | 0.45 | 0.45 | 0.00 | 0.53 | 30.43% |
| In mood regime | raw | 0.44 | 0.53 | 0.55 | 0.21 | 0.66 | N/A |
- **Observed max (global, final)**: 0.77
- **Observed max (mood-regime, final)**: 0.53

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
- ✅ `engagement >= 0.25` - Satisfiable | **Observed Fail Rate**: 62.65%
- ✅ `valence <= -0.10` - Satisfiable | **Observed Fail Rate**: 53.84%
- ✅ `threat <= 0.40` - Satisfiable | **Observed Fail Rate**: 29.94%
- ✅ `arousal >= -0.10` - Satisfiable | **Observed Fail Rate**: 45.02%
- ✅ `arousal <= 0.35` - Satisfiable | **Observed Fail Rate**: 32.80%
- ✅ `future_expectancy >= -0.05` - Satisfiable | **Observed Fail Rate**: 47.50%

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
| Global | final | 0.00 | 0.34 | 0.48 | 0.00 | 0.93 | 18.12% |
| Global | raw | 0.00 | 0.40 | 0.50 | 0.00 | 0.93 | N/A |
| In mood regime | final | 0.37 | 0.58 | 0.65 | 0.00 | 0.66 | 73.91% |
| In mood regime | raw | 0.39 | 0.58 | 0.65 | 0.15 | 0.66 | N/A |
- **Observed max (global, final)**: 0.93
- **Observed max (mood-regime, final)**: 0.66

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| self_evaluation | -0.70 | [-1.00, -0.05] | -1.00 | 0.700 | — |
| arousal | +0.50 | [-0.05, 0.55] | 0.55 | 0.275 | ⚠️ yes |
| threat | +0.60 | [0.10, 0.70] | 0.70 | 0.420 | ⚠️ yes |
| valence | -0.30 | [-1.00, -0.10] | -1.00 | 0.300 | — |

**Gates** ✅:
- ✅ `self_evaluation <= -0.10` - Satisfiable | **Observed Fail Rate**: 53.70%
- ✅ `threat >= 0.20` - Satisfiable | **Observed Fail Rate**: 60.24%

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
| Global | final | 0.00 | 0.32 | 0.45 | 0.00 | 0.83 | 19.79% |
| Global | raw | 0.00 | 0.38 | 0.47 | 0.00 | 0.83 | N/A |
| In mood regime | final | 0.00 | 0.49 | 0.49 | 0.00 | 0.55 | 47.83% |
| In mood regime | raw | 0.20 | 0.49 | 0.49 | 0.00 | 0.55 | N/A |
- **Observed max (global, final)**: 0.83
- **Observed max (mood-regime, final)**: 0.55

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
- ✅ `valence <= -0.15` - Satisfiable | **Observed Fail Rate**: 56.35%
- ✅ `arousal >= 0.10` - Satisfiable | **Observed Fail Rate**: 54.26%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **affiliation**: Has negative weight (-0.30) but constraint requires min 0.20

**Analysis**: Threshold 0.4 is achievable (max: 0.721). Binding conflicts: affiliation has negative weight (-0.30) but constraint requires min=0.20



#### Distribution Analysis
- **Compound Node**: Aggregated from 29 leaf conditions (19 top-level conditions; 29 when OR blocks expanded)
- **Highest Avg Violation**: 71.17 (from `(moodAxes.affiliation - previousMoodAxes.affiliation) <= -12`)
- **Highest P90 Violation**: 145.10
- **Highest P95 Violation**: 163.05
- **Highest P99 Violation**: 189.01
- **Interpretation**: Worst violator: (moodAxes.affiliation - previousMoodAxes.affiliation) <= -12

#### Ceiling Analysis
- **Compound Node**: Contains multiple conditions
- **Status**: No ceiling effects detected in leaf conditions
- **Insight**: All thresholds appear achievable based on observed values

#### Near-Miss Analysis
- **Compound Node**: Contains 29 leaf conditions
- **Most Tunable Condition**: `moodAxes.arousal <= 55`
- **Near-Miss Rate**: 4.56% (epsilon: 5.00)
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

**Population**: stored-mood-regime (predicate: moodAxes.affiliation >= 20, moodAxes.arousal <= 55, moodAxes.arousal >= -5, moodAxes.engagement >= 15, moodAxes.self_evaluation <= -5, moodAxes.threat <= 70, moodAxes.threat >= 10, moodAxes.valence <= -10; count: 23; hash: c6119de6).
**Mood regime filter**: 23 contexts where all mood constraints pass
- Constraints: `moodAxes.affiliation >= 20`, `moodAxes.valence <= -10`, `moodAxes.self_evaluation <= -5`, `moodAxes.engagement >= 15`, `moodAxes.threat >= 10`, `moodAxes.threat <= 70`, `moodAxes.arousal >= -5`, `moodAxes.arousal <= 55`

| Condition | P(pass \| mood) | Passes | CI (95%) |
|-----------|-----------------|--------|----------|
| `emotions.anger >= 0.4` | 26.09% | 6/23 | [12.55%, 46.47%] |
| `emotions.lonely_yearning >= 0.25` | 30.43% | 7/23 | [15.60%, 50.87%] |
| `emotions.sadness >= 0.22` | 34.78% | 8/23 | [18.81%, 55.11%] |
| `emotions.disappointment >= 0.25` | 39.13% | 9/23 | [22.16%, 59.21%] |
| `emotions.regret >= 0.18` | 56.52% | 13/23 | [36.81%, 74.37%] |
| `emotions.hatred <= 0.35` | 60.87% | 14/23 | [40.79%, 77.84%] |
| `emotions.grief >= 0.18` | 73.91% | 17/23 | [53.53%, 87.45%] |
| `emotions.embarrassment >= 0.2` | 73.91% | 17/23 | [53.53%, 87.45%] |
| `emotions.freeze <= 0.55` | 86.96% | 20/23 | [67.87%, 95.46%] |
| `emotions.rage < 0.55` | 100.00% | 23/23 | [85.69%, 100.00%] |
| `emotions.contempt <= 0.4` | 100.00% | 23/23 | [85.69%, 100.00%] |
| `emotions.disgust <= 0.4` | 100.00% | 23/23 | [85.69%, 100.00%] |
| `emotions.panic <= 0.4` | 100.00% | 23/23 | [85.69%, 100.00%] |
| `emotions.terror <= 0.5` | 100.00% | 23/23 | [85.69%, 100.00%] |
| `emotions.dissociation <= 0.65` | 100.00% | 23/23 | [85.69%, 100.00%] |

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
| 0.20 | 0.00% | 0% | 10.000 |
| 0.25 | 0.00% | 0% | 10.000 |
| 0.30 | 0.00% | 0% | 10.000 |
| 0.35 | 0.00% | 0% | 10.000 |
| **0.40** | **0.00%** | **baseline (stored contexts)** | 10.000 |
| 0.45 | 0.00% | 0% | 10.000 |
| 0.50 | 0.00% | 0% | 10.000 |
| 0.55 | 0.00% | 0% | 10.000 |
| 0.60 | 0.00% | 0% | 10.000 |

**⚠️ No Triggers Found**: None of the tested thresholds produced expression triggers. The expression may require more extreme threshold changes or other blocking conditions may dominate.

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
| 0.20 | 13.70% | +106.64% | 10.000 |
| 0.25 | 12.04% | +81.60% | 10.000 |
| 0.30 | 10.25% | +54.60% | 10.000 |
| 0.35 | 8.32% | +25.49% | 10.000 |
| **0.40** | **6.63%** | **baseline (stored contexts)** | 10.000 |
| 0.45 | 4.87% | -26.55% | 10.000 |
| 0.50 | 3.36% | -49.32% | 10.000 |
| 0.55 | 2.23% | -66.37% | 10.000 |
| 0.60 | 1.23% | -81.45% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.rage < [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.35 | 93.21% | -5.03% | 10.000 |
| 0.40 | 94.58% | -3.64% | 10.000 |
| 0.45 | 96.04% | -2.15% | 10.000 |
| 0.50 | 97.23% | -0.94% | 10.000 |
| **0.55** | **98.15%** | **baseline (stored contexts)** | 10.000 |
| 0.60 | 98.97% | +0.84% | 10.000 |
| 0.65 | 99.48% | +1.36% | 10.000 |
| 0.70 | 99.80% | +1.68% | 10.000 |
| 0.75 | 99.89% | +1.77% | 10.000 |

### Marginal Clause Pass-Rate Sweep: moodAxes.affiliation >= [threshold]


| Threshold | Effective Threshold | Pass Rate | Change | Samples |
|-----------|---------------------|-----------|--------|---------|
| 16 | 16 | 42.33% | +4.26% | 10.000 |
| 17 | 17 | 41.89% | +3.18% | 10.000 |
| 18 | 18 | 41.40% | +1.97% | 10.000 |
| 19 | 19 | 41.02% | +1.03% | 10.000 |
| **20** | **20** | **40.60%** | **baseline (stored contexts)** | 10.000 |
| 21 | 21 | 39.98% | -1.53% | 10.000 |
| 22 | 22 | 39.45% | -2.83% | 10.000 |
| 23 | 23 | 39.00% | -3.94% | 10.000 |
| 24 | 24 | 38.43% | -5.34% | 10.000 |

_Thresholds are integer-effective; decimals collapse to integer boundaries._

### Marginal Clause Pass-Rate Sweep: moodAxes.valence <= [threshold]


| Threshold | Effective Threshold | Pass Rate | Change | Samples |
|-----------|---------------------|-----------|--------|---------|
| -14 | -14 | 43.80% | -4.24% | 10.000 |
| -13 | -13 | 44.31% | -3.13% | 10.000 |
| -12 | -12 | 44.77% | -2.12% | 10.000 |
| -11 | -11 | 45.22% | -1.14% | 10.000 |
| **-10** | **-10** | **45.74%** | **baseline (stored contexts)** | 10.000 |
| -9 | -9 | 46.20% | +1.01% | 10.000 |
| -8 | -8 | 46.55% | +1.77% | 10.000 |
| -7 | -7 | 47.08% | +2.93% | 10.000 |
| -6 | -6 | 47.47% | +3.78% | 10.000 |

_Thresholds are integer-effective; decimals collapse to integer boundaries._

### Marginal Clause Pass-Rate Sweep: moodAxes.self_evaluation <= [threshold]


| Threshold | Effective Threshold | Pass Rate | Change | Samples |
|-----------|---------------------|-----------|--------|---------|
| -9 | -9 | 46.31% | -4.02% | 10.000 |
| -8 | -8 | 46.94% | -2.72% | 10.000 |
| -7 | -7 | 47.28% | -2.01% | 10.000 |
| -6 | -6 | 47.78% | -0.97% | 10.000 |
| **-5** | **-5** | **48.25%** | **baseline (stored contexts)** | 10.000 |
| -4 | -4 | 48.79% | +1.12% | 10.000 |
| -3 | -3 | 49.37% | +2.32% | 10.000 |
| -2 | -2 | 49.83% | +3.27% | 10.000 |
| -1 | -1 | 50.29% | +4.23% | 10.000 |

_Thresholds are integer-effective; decimals collapse to integer boundaries._

### Marginal Clause Pass-Rate Sweep: moodAxes.engagement >= [threshold]


| Threshold | Effective Threshold | Pass Rate | Change | Samples |
|-----------|---------------------|-----------|--------|---------|
| 11 | 11 | 43.98% | +5.52% | 10.000 |
| 12 | 12 | 43.40% | +4.13% | 10.000 |
| 13 | 13 | 42.87% | +2.86% | 10.000 |
| 14 | 14 | 42.27% | +1.42% | 10.000 |
| **15** | **15** | **41.68%** | **baseline (stored contexts)** | 10.000 |
| 16 | 16 | 41.07% | -1.46% | 10.000 |
| 17 | 17 | 40.64% | -2.50% | 10.000 |
| 18 | 18 | 40.12% | -3.74% | 10.000 |
| 19 | 19 | 39.68% | -4.80% | 10.000 |

_Thresholds are integer-effective; decimals collapse to integer boundaries._

### Marginal Clause Pass-Rate Sweep: moodAxes.threat >= [threshold]


| Threshold | Effective Threshold | Pass Rate | Change | Samples |
|-----------|---------------------|-----------|--------|---------|
| 6 | 6 | 46.24% | +4.73% | 10.000 |
| 7 | 7 | 45.65% | +3.40% | 10.000 |
| 8 | 8 | 45.20% | +2.38% | 10.000 |
| 9 | 9 | 44.56% | +0.93% | 10.000 |
| **10** | **10** | **44.15%** | **baseline (stored contexts)** | 10.000 |
| 11 | 11 | 43.66% | -1.11% | 10.000 |
| 12 | 12 | 43.10% | -2.38% | 10.000 |
| 13 | 13 | 42.61% | -3.49% | 10.000 |
| 14 | 14 | 42.04% | -4.78% | 10.000 |

_Thresholds are integer-effective; decimals collapse to integer boundaries._

### Marginal Clause Pass-Rate Sweep: moodAxes.threat <= [threshold]


| Threshold | Effective Threshold | Pass Rate | Change | Samples |
|-----------|---------------------|-----------|--------|---------|
| 66 | 66 | 83.63% | -2.34% | 10.000 |
| 67 | 67 | 84.04% | -1.86% | 10.000 |
| 68 | 68 | 84.51% | -1.31% | 10.000 |
| 69 | 69 | 85.05% | -0.68% | 10.000 |
| **70** | **70** | **85.63%** | **baseline (stored contexts)** | 10.000 |
| 71 | 71 | 86.07% | +0.51% | 10.000 |
| 72 | 72 | 86.50% | +1.02% | 10.000 |
| 73 | 73 | 86.95% | +1.54% | 10.000 |
| 74 | 74 | 87.49% | +2.17% | 10.000 |

_Thresholds are integer-effective; decimals collapse to integer boundaries._

### Marginal Clause Pass-Rate Sweep: moodAxes.arousal >= [threshold]


| Threshold | Effective Threshold | Pass Rate | Change | Samples |
|-----------|---------------------|-----------|--------|---------|
| -9 | -9 | 54.89% | +3.98% | 10.000 |
| -8 | -8 | 54.36% | +2.97% | 10.000 |
| -7 | -7 | 53.75% | +1.82% | 10.000 |
| -6 | -6 | 53.20% | +0.78% | 10.000 |
| **-5** | **-5** | **52.79%** | **baseline (stored contexts)** | 10.000 |
| -4 | -4 | 52.25% | -1.02% | 10.000 |
| -3 | -3 | 51.83% | -1.82% | 10.000 |
| -2 | -2 | 51.23% | -2.96% | 10.000 |
| -1 | -1 | 50.79% | -3.79% | 10.000 |

_Thresholds are integer-effective; decimals collapse to integer boundaries._

### Marginal Clause Pass-Rate Sweep: moodAxes.arousal <= [threshold]


| Threshold | Effective Threshold | Pass Rate | Change | Samples |
|-----------|---------------------|-----------|--------|---------|
| 51 | 51 | 75.78% | -2.60% | 10.000 |
| 52 | 52 | 76.22% | -2.03% | 10.000 |
| 53 | 53 | 76.76% | -1.34% | 10.000 |
| 54 | 54 | 77.24% | -0.72% | 10.000 |
| **55** | **55** | **77.80%** | **baseline (stored contexts)** | 10.000 |
| 56 | 56 | 78.41% | +0.78% | 10.000 |
| 57 | 57 | 78.90% | +1.41% | 10.000 |
| 58 | 58 | 79.41% | +2.07% | 10.000 |
| 59 | 59 | 79.94% | +2.75% | 10.000 |

_Thresholds are integer-effective; decimals collapse to integer boundaries._

### Marginal Clause Pass-Rate Sweep: emotions.contempt <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.20 | 85.16% | -7.86% | 10.000 |
| 0.25 | 86.67% | -6.22% | 10.000 |
| 0.30 | 88.43% | -4.32% | 10.000 |
| 0.35 | 90.34% | -2.25% | 10.000 |
| **0.40** | **92.42%** | **baseline (stored contexts)** | 10.000 |
| 0.45 | 94.34% | +2.08% | 10.000 |
| 0.50 | 96.04% | +3.92% | 10.000 |
| 0.55 | 97.28% | +5.26% | 10.000 |
| 0.60 | 98.41% | +6.48% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.disgust <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.20 | 78.75% | -13.73% | 10.000 |
| 0.25 | 82.18% | -9.97% | 10.000 |
| 0.30 | 85.45% | -6.39% | 10.000 |
| 0.35 | 88.54% | -3.00% | 10.000 |
| **0.40** | **91.28%** | **baseline (stored contexts)** | 10.000 |
| 0.45 | 93.75% | +2.71% | 10.000 |
| 0.50 | 95.75% | +4.90% | 10.000 |
| 0.55 | 97.17% | +6.45% | 10.000 |
| 0.60 | 98.37% | +7.77% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.hatred <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.15 | 85.89% | -6.85% | 10.000 |
| 0.20 | 87.18% | -5.45% | 10.000 |
| 0.25 | 89.00% | -3.48% | 10.000 |
| 0.30 | 90.60% | -1.75% | 10.000 |
| **0.35** | **92.21%** | **baseline (stored contexts)** | 10.000 |
| 0.40 | 93.75% | +1.67% | 10.000 |
| 0.45 | 95.39% | +3.45% | 10.000 |
| 0.50 | 96.83% | +5.01% | 10.000 |
| 0.55 | 97.97% | +6.25% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.panic <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.20 | 99.51% | -0.01% | 10.000 |
| 0.25 | 99.51% | -0.01% | 10.000 |
| 0.30 | 99.51% | -0.01% | 10.000 |
| 0.35 | 99.51% | -0.01% | 10.000 |
| **0.40** | **99.52%** | **baseline (stored contexts)** | 10.000 |
| 0.45 | 99.53% | +0.01% | 10.000 |
| 0.50 | 99.59% | +0.07% | 10.000 |
| 0.55 | 99.65% | +0.13% | 10.000 |
| 0.60 | 99.75% | +0.23% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.terror <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.30 | 93.10% | -4.26% | 10.000 |
| 0.35 | 94.13% | -3.20% | 10.000 |
| 0.40 | 95.26% | -2.04% | 10.000 |
| 0.45 | 96.29% | -0.98% | 10.000 |
| **0.50** | **97.24%** | **baseline (stored contexts)** | 10.000 |
| 0.55 | 97.93% | +0.71% | 10.000 |
| 0.60 | 98.71% | +1.51% | 10.000 |
| 0.65 | 99.30% | +2.12% | 10.000 |
| 0.70 | 99.60% | +2.43% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.freeze <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.35 | 99.31% | -0.24% | 10.000 |
| 0.40 | 99.34% | -0.21% | 10.000 |
| 0.45 | 99.36% | -0.19% | 10.000 |
| 0.50 | 99.46% | -0.09% | 10.000 |
| **0.55** | **99.55%** | **baseline (stored contexts)** | 10.000 |
| 0.60 | 99.64% | +0.09% | 10.000 |
| 0.65 | 99.79% | +0.24% | 10.000 |
| 0.70 | 99.88% | +0.33% | 10.000 |
| 0.75 | 99.95% | +0.40% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.dissociation <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.45 | 98.39% | -1.31% | 10.000 |
| 0.50 | 98.73% | -0.97% | 10.000 |
| 0.55 | 99.24% | -0.46% | 10.000 |
| 0.60 | 99.55% | -0.15% | 10.000 |
| **0.65** | **99.70%** | **baseline (stored contexts)** | 10.000 |
| 0.70 | 99.84% | +0.14% | 10.000 |
| 0.75 | 99.96% | +0.26% | 10.000 |
| 0.80 | 99.99% | +0.29% | 10.000 |
| 0.85 | 100.00% | +0.30% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.sadness >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.02 | 24.42% | +13.00% | 10.000 |
| 0.07 | 24.14% | +11.71% | 10.000 |
| 0.12 | 23.69% | +9.63% | 10.000 |
| 0.17 | 22.83% | +5.65% | 10.000 |
| **0.22** | **21.61%** | **baseline (stored contexts)** | 10.000 |
| 0.27 | 20.02% | -7.36% | 10.000 |
| 0.32 | 18.07% | -16.38% | 10.000 |
| 0.37 | 15.93% | -26.28% | 10.000 |
| 0.42 | 13.60% | -37.07% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.grief >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| -0.02 | 100.00% | +552.32% | 10.000 |
| 0.03 | 16.84% | +9.85% | 10.000 |
| 0.08 | 16.53% | +7.83% | 10.000 |
| 0.13 | 16.07% | +4.83% | 10.000 |
| **0.18** | **15.33%** | **baseline (stored contexts)** | 10.000 |
| 0.23 | 14.47% | -5.61% | 10.000 |
| 0.28 | 13.01% | -15.13% | 10.000 |
| 0.33 | 11.48% | -25.11% | 10.000 |
| 0.38 | 9.87% | -35.62% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.disappointment >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 20.47% | +13.47% | 10.000 |
| 0.10 | 20.24% | +12.20% | 10.000 |
| 0.15 | 19.70% | +9.20% | 10.000 |
| 0.20 | 19.04% | +5.54% | 10.000 |
| **0.25** | **18.04%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 16.52% | -8.43% | 10.000 |
| 0.35 | 14.66% | -18.74% | 10.000 |
| 0.40 | 12.68% | -29.71% | 10.000 |
| 0.45 | 10.18% | -43.57% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.regret >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| -0.02 | 100.00% | +543.09% | 10.000 |
| 0.03 | 16.35% | +5.14% | 10.000 |
| 0.08 | 16.24% | +4.44% | 10.000 |
| 0.13 | 15.99% | +2.83% | 10.000 |
| **0.18** | **15.55%** | **baseline (stored contexts)** | 10.000 |
| 0.23 | 14.77% | -5.02% | 10.000 |
| 0.28 | 13.75% | -11.58% | 10.000 |
| 0.33 | 12.38% | -20.39% | 10.000 |
| 0.38 | 10.52% | -32.35% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.lonely_yearning >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 1.41% | +42.42% | 10.000 |
| 0.10 | 1.36% | +37.37% | 10.000 |
| 0.15 | 1.24% | +25.25% | 10.000 |
| 0.20 | 1.12% | +13.13% | 10.000 |
| **0.25** | **0.99%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 0.86% | -13.13% | 10.000 |
| 0.35 | 0.73% | -26.26% | 10.000 |
| 0.40 | 0.62% | -37.37% | 10.000 |
| 0.45 | 0.41% | -58.59% | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.embarrassment >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.00 | 100.00% | +619.42% | 10.000 |
| 0.05 | 16.85% | +21.22% | 10.000 |
| 0.10 | 16.20% | +16.55% | 10.000 |
| 0.15 | 15.11% | +8.71% | 10.000 |
| **0.20** | **13.90%** | **baseline (stored contexts)** | 10.000 |
| 0.25 | 12.53% | -9.86% | 10.000 |
| 0.30 | 10.73% | -22.81% | 10.000 |
| 0.35 | 9.20% | -33.81% | 10.000 |
| 0.40 | 7.53% | -45.83% | 10.000 |

## 🎯 Prototype Fit Analysis

Ranking of emotion prototypes by how well they fit this expression's mood regime.

**Population**: stored-mood-regime (predicate: moodAxes.affiliation >= 20, moodAxes.arousal <= 55, moodAxes.arousal >= -5, moodAxes.engagement >= 15, moodAxes.self_evaluation <= -5, moodAxes.threat <= 70, moodAxes.threat >= 10, moodAxes.valence <= -10; count: 23; hash: c6119de6).
| Rank | Prototype | Gate Pass | P(I≥t) | Conflict | Composite |
|------|-----------|-----------|--------|----------|-----------|
| 1 | **irritation** | 100.00% | 66.67% | 0.00% | 0.88 |
| 2 | **protest_anger** | 66.67% | 93.75% | 0.00% | 0.88 |
| 3 | **guilt** | 58.33% | 100.00% | 0.00% | 0.88 |
| 4 | **embarrassment** | 75.00% | 83.33% | 0.00% | 0.87 |
| 5 | **grief** | 83.33% | 75.00% | 16.67% | 0.83 |
| 6 | **hatred** | 50.00% | 91.67% | 0.00% | 0.82 |
| 7 | **regret** | 62.50% | 80.00% | 0.00% | 0.82 |
| 8 | **humiliation** | 54.17% | 84.62% | 0.00% | 0.81 |
| 9 | **shame** | 75.00% | 66.67% | 0.00% | 0.81 |
| 10 | **interest** | 100.00% | 54.17% | 16.67% | 0.81 |

### Top 3 Prototype Details

#### 1. irritation

- **Intensity Distribution**: P50=0.35, P90=0.60, P95=0.62
- **Conflicting Axes**: None

#### 2. protest_anger

- **Intensity Distribution**: P50=0.53, P90=0.63, P95=0.64
- **Conflicting Axes**: None

#### 3. guilt

- **Intensity Distribution**: P50=0.50, P90=0.67, P95=0.70
- **Conflicting Axes**: None

---

## 🧭 Implied Prototype from Prerequisites

Analysis of which prototypes best match the expression's constraint pattern.

**Population**: stored-mood-regime (predicate: moodAxes.affiliation >= 20, moodAxes.arousal <= 55, moodAxes.arousal >= -5, moodAxes.engagement >= 15, moodAxes.self_evaluation <= -5, moodAxes.threat <= 70, moodAxes.threat >= 10, moodAxes.valence <= -10; count: 23; hash: c6119de6).

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
| 1 | **protest_anger** | 0.93 | 66.67% | 0.83 |
| 2 | **hypervigilance** | 0.79 | 29.17% | 0.59 |
| 3 | **embarrassment** | 0.79 | 75.00% | 0.78 |
| 4 | **humiliation** | 0.76 | 54.17% | 0.67 |
| 5 | **terror** | 0.76 | 8.33% | 0.49 |

### Top 5 by Gate Pass Rate

| Rank | Prototype | Gate Pass | Similarity | Combined |
|------|-----------|-----------|------------|----------|
| 1 | **interest** | 100.00% | 0.45 | 0.67 |
| 2 | **unease** | 100.00% | 0.66 | 0.79 |
| 3 | **irritation** | 100.00% | 0.64 | 0.78 |
| 4 | **envy** | 100.00% | 0.65 | 0.79 |
| 5 | **grief** | 83.33% | 0.39 | 0.57 |

### Top 5 by Combined Score

| Rank | Prototype | Combined | Similarity | Gate Pass |
|------|-----------|----------|------------|----------|
| 1 | **protest_anger** | 0.83 | 0.93 | 66.67% |
| 2 | **unease** | 0.79 | 0.66 | 100.00% |
| 3 | **envy** | 0.79 | 0.65 | 100.00% |
| 4 | **irritation** | 0.78 | 0.64 | 100.00% |
| 5 | **jealousy** | 0.78 | 0.75 | 83.33% |

---

## 🔍 Prototype Gap Detection

Analysis of prototype coverage in "prototype space".

**Population**: stored-mood-regime (predicate: moodAxes.affiliation >= 20, moodAxes.arousal <= 55, moodAxes.arousal >= -5, moodAxes.engagement >= 15, moodAxes.self_evaluation <= -5, moodAxes.threat <= 70, moodAxes.threat >= 10, moodAxes.valence <= -10; count: 23; hash: c6119de6).

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
- I1_GATE_FAILED_NONZERO_FINAL: Gate failed but final intensity is non-zero in stored contexts. [population=1a309bea; prototype=freeze; signal=final]
- I1_GATE_FAILED_NONZERO_FINAL: Gate failed but final intensity is non-zero in stored contexts. [population=c6119de6; prototype=freeze; signal=final]
- I1_GATE_FAILED_NONZERO_FINAL: Gate failed but final intensity is non-zero in stored contexts. [population=1a309bea; prototype=dissociation; signal=final]
- I1_GATE_FAILED_NONZERO_FINAL: Gate failed but final intensity is non-zero in stored contexts. [population=1a309bea; prototype=sadness; signal=final]
- I1_GATE_FAILED_NONZERO_FINAL: Gate failed but final intensity is non-zero in stored contexts. [population=1a309bea; prototype=lonely_yearning; signal=final]

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

### Add this per-clause row:

Gate clamp rate in mood-regime (how often the prototype gates force the emotion to 0)

P(threshold | gates pass, mood-regime) (so you can tell whether the issue is “gate mismatch” vs “threshold too high”)

For this expression, that would instantly reveal:

“anger is failing mostly because the gate isn’t satisfied + affiliation weight conflicts”
…which is the real reason you’re stuck.

If you apply the 4 fixes above, you should start seeing witnesses quickly (and they’ll actually look like hurt anger, not random “generic anger but somehow affiliative” contradictions).

### Where in the code to look (based on what your report already shows)

Your report already has a pipeline that can produce:

“Mood-only constraints pass count” (you showed 326)

Per-clause failure rates + avg violation + severity

“P(pass | mood)” for a clause (you showed it for anger >= 0.4)

So you already have these conceptual stages:

#### A. Emotion evaluation (the only place gates exist)

Search for the function that computes an emotion intensity from mood axes + prototype weights:

likely something like: computeEmotionIntensity, evaluateEmotion, calcEmotion, applyPrototype, prototypeMatch

it will:

evaluate prototype gates

if gates pass, compute weighted sum / normalize / clamp

return a number in [0..1]

This is where you must instrument gate outcomes, because “gate clamp rate” is literally: how often this function forced the output to 0 because gates failed.

Desired output from that function (internally):

{
  value: number,              // current behavior
  gatesPassed: boolean,        // new
  failedGates: string[],       // new (ids or readable strings)
}


If you don’t want to touch runtime code, do it inside the Monte Carlo “shadow evaluator” that already computes emotions — but it must use the exact same gate logic as runtime or you’ll get misleading diagnostics.

#### B. “Mood-regime” filter construction (you already have it)

You already compute something like:

moodRegimeSamples = samples.filter(passMoodOnlyConstraints(expression))

This is where your report’s “Mood-only constraints: 326” comes from.

You need this exact subset as the denominator for both new metrics.

If your code currently builds that regime by:

taking only clauses that reference moodAxes.* (and maybe sexualArousal, sexualStates.*)
then keep it consistent and document it in UI as:

“Mood-regime = all samples where the non-emotion constraints for this expression are satisfied.”

(That’s what your report implicitly means.)

#### C. Clause analyzer / stats aggregator

Some module is walking your prerequisite JSON and producing rows like:

clause text

failure rate

avg violation

severity

P(pass | mood) (for primary signals)

That’s where you add two new per-clause fields for emotion-threshold clauses:

gateClampRateInMoodRegime

pThresholdGivenGatesPassInMoodRegime

Mechanically it needs access to:

the mood-regime sample set

the emotion gate results per sample (from A)

the threshold for that clause (from the parsed clause)

So this is usually the “ClauseStatsBuilder” or “PrereqAnalyzer” stage.

#### D. Report/UI rendering components

Wherever you render “Top Blockers” and the clause table, add:

two columns + tooltips + an optional “expand gates” row.

This is straightforward once the report JSON includes the two new numbers + optional gate breakdown.

### 2) Invariants that must hold (or your new numbers are lying)

These invariants are the sanity rails. If any fail, the analyzer is not faithful to runtime.

Emotion calculation invariants

Gate clamp correctness

If gatesPassed === false then value MUST be 0.

If you ever see gatesPassed=false and value>0, your gating instrumentation is wrong.

Range

0 <= value <= 1 always.

Determinism with seed

With fixed PRNG seed and same sample count, all reported rates should be stable (within floating noise if you parallelize).

Gate evaluation matches runtime

For the same input state, “gatesPassed” in Monte Carlo must match what the runtime emotion system would do.

Probability identity invariant (the key one)

For any emotion threshold clause E >= t:

Let:

N_mood = number of samples in mood-regime

N_gatePass = number of mood-regime samples where E’s gates pass

N_threshPass = number of mood-regime samples where E >= t

Then:

gatePassRate = N_gatePass / N_mood

condPassRate = N_threshPass / N_gatePass (defined as 0 if N_gatePass=0)

effectivePassRate = N_threshPass / N_mood

Invariant:
effectivePassRate == gatePassRate * condPassRate (up to floating rounding)

This is exactly how you separate:

“gate mismatch” (low gatePassRate)

“threshold too high” (low condPassRate despite high gatePassRate)

Denominator invariants (common bug source)

N_gatePass <= N_mood

N_threshPass <= N_gatePass (because if gates fail the value is 0; it can’t pass a positive threshold)

### 3) Tests that prove it (not “seems right”, but actually right)

You want tests at 3 levels: unit, analyzer-level, UI-level.

#### A. Unit tests (fast, surgical)

Test 1: gate clamp enforcement
Create a tiny prototype with a single gate, e.g. arousal >= 0.10.

input: arousal=0.05 → expect {gatesPassed:false, value:0}

input: arousal=0.10 → expect {gatesPassed:true, value>=0}

Test 2: failed gate reasons are stable
For a multi-gate prototype, ensure failedGates returns the exact gate ids/strings you expect, and is sorted (stable ordering helps UI diffs).

Test 3: probability identity on a hand-constructed set
Manually feed a small list of states (no randomness) into the analyzer:

10 mood-regime states, 4 gate-pass, 2 threshold-pass
Expect:

gatePassRate=0.4

condPassRate=0.5

effective=0.2
And verify the identity exactly.

#### B. Analyzer tests (Monte Carlo logic correctness)

Test 4: “gate mismatch” scenario produces the right diagnosis
Build an expression whose mood-regime allows arousal low, but the emotion gate requires arousal high.

Example:

mood-regime: arousal >= -5 (i.e. many samples below 0.10 normalized)

emotion gate: arousal >= 0.10

threshold: E >= 0.4

With a symmetric sampling distribution for arousal around 0, you should see:

high gateClampRate

condPassRate maybe decent (because among gate-pass cases, the threshold might not be crazy)

This is the “anger in hurt_anger” pattern you described.

Test 5: “threshold too high” scenario
Make gates always pass (or trivially pass) but set threshold too high relative to weights.
Expect:

gateClampRate ~ 0

condPassRate low

Test 6: regression test for “gates ignored” bug
If you previously had a bug where gates weren’t respected, this test catches it:

Pick a prototype with gates that fail frequently.

If your analyzer ever reports gateClampRate ≈ 0 while the gate clearly fails on many samples, it’s broken.

### C. UI tests (prevent future confusion)

Test 7: column rendering & tooltips
Snapshot test the clause table row for an emotion threshold clause ensuring:

“Gate clamp (mood-regime)” is present

“Pass given gate” is present

Tooltip text includes denominators (e.g. 127/326)

Test 8: sorting
If you allow sorting by these new fields, test the sort order.

### 4) UI changes that communicate this without confusion

The biggest risk: users misread conditional probability as unconditional. Solve it with funnel framing and explicit denominators.

#### A. For every emotion-threshold clause row, show a 3-stage funnel

In the clause table row for emotions.anger >= 0.4, show:

Mood-regime N

N_mood (e.g. 326)

Gate clamp (forced zero)

Gate clamp: 38.9% (127/326)
Tooltip: “% of mood-regime samples where prototype gates failed → intensity forced to 0.”

Pass given gate

Pass | gate: 26.1% (6/23)
Tooltip: “Among samples where gates passed, fraction meeting threshold.”

Also optionally show:

Effective pass

Effective: 1.84% (6/326)
This ties it back to the original “why doesn’t it trigger” question.

This is way clearer than two raw columns, because it encodes the causal story.

#### B. Expandable “Gates breakdown” panel (per emotion clause)

Clicking the clause expands:

Prototype name + quick link: anger (or whatever key)

Gate list with per-gate failure rates within mood-regime:

Example layout:

arousal >= 0.10 — fails 35.6% (116/326)

engagement >= 0.00 — fails 2.1% (7/326)

This immediately tells you which gate is killing you.

Also include a one-liner:

“If any gate fails, intensity is clamped to 0.”

#### C. Classification badge to reduce cognitive load

Add a small badge next to the clause (computed from the two rates):

Gate mismatch if gateClampRate is high and pass|gate is not terrible

Threshold too high if gateClampRate is low but pass|gate is low

Both if both are bad

This makes the “what do I change?” decision immediate.

#### D. Avoid UI traps

These are the common confusion points and fixes:

Trap: Showing Pass | gate without the denominator.
Fix: Always display as x/y (counts) and percent.

Trap: Calling it “clamp rate” with no explanation.
Fix: Label it “Gate clamp (forced 0)”.

Trap: Mixing this into “Top Blockers” in a way that looks like a prerequisite clause.
Fix: Keep “Top Blockers” as it is, but allow a hover/click on an emotion clause to show the funnel + gates panel.

