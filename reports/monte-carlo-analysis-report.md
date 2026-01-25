# Monte Carlo Analysis Report

**Expression**: admiration_swell
**Generated**: 2026-01-24T22:45:18.601Z
**Distribution**: uniform
**Sample Size**: 10000
**Sampling Mode**: static - Prototype-gated sampling (emotions derived from mood axes; not independent)
**Gating model**: HARD (gate fail => final = 0)
**Regime Note**: Report includes global vs in-regime (mood-pass) statistics

> **Note**: Emotions are computed via prototype gates, so emotion variables are not independent of mood axes.

---

## Population Summary

- **Total samples**: 10.000 (in-regime 10.000; 100.00%)
- **Stored contexts**: 10.000 of 10.000 (in-regime 10.000; 100.00%; limit 10.000)
- **Mood regime**: Mood axis constraints derived from gates of emotion/sexual prototypes referenced in prerequisites.

---

## Integrity Summary

- **Integrity warnings**: 20
- **Gate/final mismatches**: 0
- **Gate-dependent metrics**: OK
- **Affected prototypes**: None
- **Example indices**: None

---

## Signal Lineage

- **Raw**: Weighted sum of normalized axes (clamped to 0..1).
- **Gated**: Raw value when gate constraints pass; otherwise 0.
- **Final**: Hard-gated output (final = gated).

**Gate input scales**
- Mood axes: raw [-100, 100] -> normalized [-1, 1]
- Sexual axes: raw [0, 100] -> normalized [0, 1] (sexual_arousal derived, clamped)
- Affect traits: raw [0, 100] -> normalized [0, 1]

---

## Executive Summary

**Trigger Rate**: 1.03% (95% CI: 0.85% - 1.25%)
**Rarity**: normal

Expression triggers occasionally (1.030%). Consider adjusting thresholds. Focus on "AND of 18 conditions" (99.0% last-mile failure).

---

## Independence Baseline Comparison

This section compares Monte Carlo results against naive probability estimates (assuming clause independence) to identify correlation effects. Deviations indicate clauses are not statistically independent.

| Metric | Value |
|--------|-------|
| Naive probability (product of pass rates) | 0.05% |
| Expected hits per 10.000 samples | 4.84 |
| Actual hits | 103 |
| P(0 hits \| expected=4.84) | 0.79% |

### Interpretation

✅ **Normal**: Actual hits (103) align with expected (4.8).

> **Note**: 18 clause factors omitted for brevity.

---

## Sampling Coverage

**Sampling Mode**: static

### Summary by Domain

| Domain | Variables | Range Coverage | Bin Coverage | Tail Low | Tail High | Zero Rate Avg | Rating |
|--------|-----------|----------------|--------------|----------|-----------|---------------|--------|
| emotions | 20 | 73.28% | 76.00% | 88.23% | 0.0050% | 86.69% | partial |
| previousEmotions | 5 | 77.57% | 84.00% | 85.83% | 0.01% | 84.43% | good |

### Lowest Coverage Variables

| Variable | Range Coverage | Bin Coverage | Tail Low | Tail High | Rating |
|----------|----------------|--------------|----------|-----------|--------|
| emotions.wrath | 58.87% | 60.00% | 98.52% | 0.00% | partial |
| emotions.envy | 61.80% | 70.00% | 87.07% | 0.00% | partial |
| emotions.resentment | 63.06% | 70.00% | 98.12% | 0.00% | partial |
| previousEmotions.quiet_absorption | 63.66% | 70.00% | 98.28% | 0.00% | partial |
| emotions.quiet_absorption | 64.04% | 70.00% | 98.16% | 0.00% | partial |

Notes:
- Range coverage is observed span divided by domain span.
- Bin coverage is occupancy across 10 equal-width bins.
- Tail coverage is the share of samples in the bottom/top 10.00% of the domain.
- Variables with unknown domain ranges are excluded from summaries.

### Coverage Conclusions

- emotions: sampling looks skewed/zero-inflated zeroRateAvg=86.69%; zero-heavy or gated distributions can mask threshold behavior.
- emotions: upper tail is effectively untested (top 10% has 0.0050% of samples). High-threshold feasibility results are not trustworthy here.
- previousEmotions: sampling looks skewed/zero-inflated zeroRateAvg=84.43%; zero-heavy or gated distributions can mask threshold behavior.
- previousEmotions: upper tail is effectively untested (top 10% has 0.0120% of samples). High-threshold feasibility results are not trustworthy here.
- emotions: observed range spans only 73% of the domain. This suggests ceilings/floors or gating; feasibility conclusions involving missing ranges are low-confidence.
- previousEmotions: observed range spans only 78% of the domain. This suggests ceilings/floors or gating; feasibility conclusions involving missing ranges are low-confidence.
- Across variables: 25 show near-zero upper-tail coverage; 18 show truncated range. Those regions are effectively unvalidated by current sampling.
- Do not trust feasibility estimates for prerequisites that target the upper end of a domain; the sampler is not generating those states often enough to test them.
- Worst range coverage: min=59%.
- Worst upper-tail coverage: min tailHigh=0.0000%.
- Worst lower-tail coverage: min tailLow=63.3200%.

---

## Ground-Truth Witnesses

These states were verified to trigger the expression during simulation.
Each witness represents a valid combination of mood, sexual state, and affect traits.

### Witness #1

**Computed Emotions (Current)**:
- admiration: 0.696
- aesthetic_appreciation: 0.000
- anxiety: 0.000
- contempt: 0.000
- cynicism: 0.000
- disgust: 0.000
- envy: 0.000
- fear: 0.000
- humiliation: 0.000
- hypervigilance: 0.000
- inspiration: 0.452
- interest: 0.799
- jealousy: 0.000
- moral_outrage: 0.000
- protest_anger: 0.000
- quiet_absorption: 0.000
- rage: 0.000
- resentment: 0.000
- shame: 0.000
- wrath: 0.000

**Computed Emotions (Previous)**:
- admiration: 0.000
- aesthetic_appreciation: 0.000
- anxiety: 0.347
- contempt: 0.000
- cynicism: 0.000
- disgust: 0.000
- envy: 0.000
- fear: 0.317
- humiliation: 0.000
- hypervigilance: 0.000
- inspiration: 0.000
- interest: 0.000
- jealousy: 0.000
- moral_outrage: 0.000
- protest_anger: 0.000
- quiet_absorption: 0.000
- rage: 0.000
- resentment: 0.000
- shame: 0.000
- wrath: 0.000

**Mood State (Current)**:
- valence: 84
- arousal: 38
- agency_control: -81
- threat: 8
- engagement: 98
- future_expectancy: 18
- self_evaluation: 85
- affiliation: -1

**Mood State (Previous)**:
- valence: 43
- arousal: 14
- agency_control: -94
- threat: 88
- engagement: -74
- future_expectancy: -79
- self_evaluation: 19
- affiliation: 79

**Sexual State (Current)**:
- sex_excitation: 97
- sex_inhibition: 70
- baseline_libido: 22

**Sexual State (Previous)**:
- sex_excitation: 89
- sex_inhibition: 93
- baseline_libido: -7

**Affect Traits**:
- affective_empathy: 55
- cognitive_empathy: 22
- harm_aversion: 88

### Witness #2

**Computed Emotions (Current)**:
- admiration: 0.656
- aesthetic_appreciation: 0.000
- anxiety: 0.000
- contempt: 0.000
- cynicism: 0.000
- disgust: 0.000
- envy: 0.000
- fear: 0.000
- humiliation: 0.000
- hypervigilance: 0.000
- inspiration: 0.498
- interest: 0.573
- jealousy: 0.000
- moral_outrage: 0.000
- protest_anger: 0.000
- quiet_absorption: 0.000
- rage: 0.000
- resentment: 0.000
- shame: 0.000
- wrath: 0.000

**Computed Emotions (Previous)**:
- admiration: 0.000
- aesthetic_appreciation: 0.000
- anxiety: 0.245
- contempt: 0.000
- cynicism: 0.000
- disgust: 0.000
- envy: 0.000
- fear: 0.214
- humiliation: 0.000
- hypervigilance: 0.320
- inspiration: 0.000
- interest: 0.000
- jealousy: 0.000
- moral_outrage: 0.000
- protest_anger: 0.000
- quiet_absorption: 0.000
- rage: 0.145
- resentment: 0.000
- shame: 0.000
- wrath: 0.000

**Mood State (Current)**:
- valence: 80
- arousal: 57
- agency_control: 8
- threat: 27
- engagement: 49
- future_expectancy: 26
- self_evaluation: 37
- affiliation: 99

**Mood State (Previous)**:
- valence: -54
- arousal: 35
- agency_control: 14
- threat: 37
- engagement: -27
- future_expectancy: 19
- self_evaluation: 79
- affiliation: 68

**Sexual State (Current)**:
- sex_excitation: 23
- sex_inhibition: 26
- baseline_libido: 24

**Sexual State (Previous)**:
- sex_excitation: 59
- sex_inhibition: 77
- baseline_libido: 32

**Affect Traits**:
- affective_empathy: 95
- cognitive_empathy: 25
- harm_aversion: 29

### Witness #3

**Computed Emotions (Current)**:
- admiration: 0.689
- aesthetic_appreciation: 0.000
- anxiety: 0.000
- contempt: 0.000
- cynicism: 0.000
- disgust: 0.000
- envy: 0.000
- fear: 0.000
- humiliation: 0.000
- hypervigilance: 0.000
- inspiration: 0.538
- interest: 0.720
- jealousy: 0.000
- moral_outrage: 0.000
- protest_anger: 0.000
- quiet_absorption: 0.000
- rage: 0.000
- resentment: 0.000
- shame: 0.000
- wrath: 0.000

**Computed Emotions (Previous)**:
- admiration: 0.000
- aesthetic_appreciation: 0.000
- anxiety: 0.000
- contempt: 0.000
- cynicism: 0.000
- disgust: 0.000
- envy: 0.000
- fear: 0.000
- humiliation: 0.000
- hypervigilance: 0.000
- inspiration: 0.000
- interest: 0.000
- jealousy: 0.000
- moral_outrage: 0.000
- protest_anger: 0.000
- quiet_absorption: 0.000
- rage: 0.000
- resentment: 0.000
- shame: 0.557
- wrath: 0.000

**Mood State (Current)**:
- valence: 81
- arousal: 45
- agency_control: 14
- threat: 2
- engagement: 79
- future_expectancy: 26
- self_evaluation: 85
- affiliation: 28

**Mood State (Previous)**:
- valence: 10
- arousal: 20
- agency_control: -29
- threat: 12
- engagement: -17
- future_expectancy: -70
- self_evaluation: -87
- affiliation: 58

**Sexual State (Current)**:
- sex_excitation: 39
- sex_inhibition: 32
- baseline_libido: 43

**Sexual State (Previous)**:
- sex_excitation: 63
- sex_inhibition: 12
- baseline_libido: -28

**Affect Traits**:
- affective_empathy: 47
- cognitive_empathy: 71
- harm_aversion: 29

### Witness #4

**Computed Emotions (Current)**:
- admiration: 0.651
- aesthetic_appreciation: 0.000
- anxiety: 0.000
- contempt: 0.000
- cynicism: 0.000
- disgust: 0.000
- envy: 0.000
- fear: 0.000
- humiliation: 0.224
- hypervigilance: 0.000
- inspiration: 0.000
- interest: 0.749
- jealousy: 0.000
- moral_outrage: 0.000
- protest_anger: 0.000
- quiet_absorption: 0.000
- rage: 0.000
- resentment: 0.000
- shame: 0.103
- wrath: 0.000

**Computed Emotions (Previous)**:
- admiration: 0.000
- aesthetic_appreciation: 0.000
- anxiety: 0.340
- contempt: 0.000
- cynicism: 0.272
- disgust: 0.231
- envy: 0.147
- fear: 0.000
- humiliation: 0.000
- hypervigilance: 0.000
- inspiration: 0.000
- interest: 0.000
- jealousy: 0.000
- moral_outrage: 0.000
- protest_anger: 0.000
- quiet_absorption: 0.000
- rage: 0.000
- resentment: 0.000
- shame: 0.434
- wrath: 0.000

**Mood State (Current)**:
- valence: 98
- arousal: 53
- agency_control: 24
- threat: -29
- engagement: 81
- future_expectancy: -59
- self_evaluation: -32
- affiliation: 78

**Mood State (Previous)**:
- valence: -50
- arousal: -25
- agency_control: -39
- threat: 22
- engagement: -7
- future_expectancy: -70
- self_evaluation: -47
- affiliation: -11

**Sexual State (Current)**:
- sex_excitation: 89
- sex_inhibition: 34
- baseline_libido: 32

**Sexual State (Previous)**:
- sex_excitation: 56
- sex_inhibition: 28
- baseline_libido: 0

**Affect Traits**:
- affective_empathy: 3
- cognitive_empathy: 13
- harm_aversion: 18

### Witness #5

**Computed Emotions (Current)**:
- admiration: 0.631
- aesthetic_appreciation: 0.000
- anxiety: 0.216
- contempt: 0.000
- cynicism: 0.000
- disgust: 0.000
- envy: 0.000
- fear: 0.144
- humiliation: 0.000
- hypervigilance: 0.000
- inspiration: 0.495
- interest: 0.572
- jealousy: 0.000
- moral_outrage: 0.000
- protest_anger: 0.000
- quiet_absorption: 0.000
- rage: 0.000
- resentment: 0.000
- shame: 0.000
- wrath: 0.000

**Computed Emotions (Previous)**:
- admiration: 0.000
- aesthetic_appreciation: 0.000
- anxiety: 0.000
- contempt: 0.000
- cynicism: 0.000
- disgust: 0.500
- envy: 0.288
- fear: 0.432
- humiliation: 0.000
- hypervigilance: 0.527
- inspiration: 0.000
- interest: 0.000
- jealousy: 0.000
- moral_outrage: 0.000
- protest_anger: 0.000
- quiet_absorption: 0.000
- rage: 0.049
- resentment: 0.000
- shame: 0.501
- wrath: 0.000

**Mood State (Current)**:
- valence: 84
- arousal: -4
- agency_control: -90
- threat: 47
- engagement: 75
- future_expectancy: 68
- self_evaluation: 65
- affiliation: 44

**Mood State (Previous)**:
- valence: -62
- arousal: 79
- agency_control: -38
- threat: 79
- engagement: 10
- future_expectancy: 21
- self_evaluation: -86
- affiliation: -12

**Sexual State (Current)**:
- sex_excitation: 19
- sex_inhibition: 62
- baseline_libido: 38

**Sexual State (Previous)**:
- sex_excitation: 96
- sex_inhibition: 9
- baseline_libido: 2

**Affect Traits**:
- affective_empathy: 93
- cognitive_empathy: 43
- harm_aversion: 19

---

## Blocker Analysis
Signal: final (gate-clamped intensity).
> **[FULL PREREQS]** **[GLOBAL]**
> *Computed from ALL prerequisites using post-gate (final) values.*

### Probability Funnel
- **Full sample**: 10.000
- **Mood-regime pass**: 100.00% (10000 / 10000)
- **Prototype gate pass (`admiration`)**: 20.46% (2046 / 10000)
- **Threshold pass | gate (`emotions.admiration >= 0.6`)**: 6.79% (139 / 2046)
- **Prototype gate pass (`hypervigilance`)**: 14.49% (1449 / 10000)
- **Threshold pass | gate (`emotions.hypervigilance <= 0.25`)**: 25.81% (374 / 1449)
- **OR union pass | mood-pass (OR Block #1)**: 24.64% (2464 / 10000)
- **OR union pass | mood-pass (OR Block #2)**: 32.67% (3267 / 10000)
- **Final trigger**: 1.03% (103 / 10000)

### Blocker #1: `AND of 18 conditions`


**Condition**: Compound AND block
**Fail% global**: 98.97% (9897 / 10000)
**Fail% | mood-pass**: 98.97% (9897 / 10000)
**Severity**: high
**Redundant in regime**: N/A
**Clamp-trivial in regime**: N/A

#### Flags
[DECISIVE] [UPSTREAM]

#### Condition Breakdown

**Required Conditions (ALL must pass)**

| # | Condition | Fail% global | Fail% \| mood-pass | Support | Bound | Threshold | Gap | Tunable | Redundant (regime) | Clamp-trivial (regime) | Sole-Blocker Rate | Headroom (10%) | Gate pass (mood) | Gate clamp (mood) | Pass \| gate (mood) | Pass \| mood (mood) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `emotions.admiration >= 0.6` | 98.61% | 98.61% (9861 / 10000) | 10000 | 0.88 | 0.60 | -0.28 | low | no | N/A | 92.24% (N=1328) | ×7.2 | 20.46% (2046 / 10000) | 79.54% (7954 / 10000) | 6.79% (139 / 2046) | 1.39% (139 / 10000) |
| 2 | `emotions.envy <= 0.3` | 3.24% | 3.24% (324 / 10000) | 10000 | 0.00 | 0.30 | -0.30 | moderate | no | no | 0.00% (N=103) | — | 22.69% (2269 / 10000) | 77.31% (7731 / 10000) | 85.72% (1945 / 2269) | 96.76% (9676 / 10000) |
| 3 | `emotions.jealousy <= 0.25` | 2.00% | 2.00% (200 / 10000) | 10000 | 0.00 | 0.25 | -0.25 | low | no | no | 0.00% (N=103) | — | 3.76% (376 / 10000) | 96.24% (9624 / 10000) | 46.81% (176 / 376) | 98.00% (9800 / 10000) |
| 4 | `emotions.resentment <= 0.3` | 1.48% | 1.48% (148 / 10000) | 10000 | 0.00 | 0.30 | -0.30 | low | no | no | 0.00% (N=103) | — | 1.88% (188 / 10000) | 98.12% (9812 / 10000) | 21.28% (40 / 188) | 98.52% (9852 / 10000) |
| 5 | `emotions.cynicism <= 0.4` | 3.78% | 3.78% (378 / 10000) | 10000 | 0.00 | 0.40 | -0.40 | moderate | no | no | 0.00% (N=103) | — | 16.90% (1690 / 10000) | 83.10% (8310 / 10000) | 77.63% (1312 / 1690) | 96.22% (9622 / 10000) |
| 6 | `emotions.contempt <= 0.2` | 9.69% | 9.69% (969 / 10000) | 10000 | 0.00 | 0.20 | -0.20 | moderate | no | no | 0.00% (N=103) | — | 18.62% (1862 / 10000) | 81.38% (8138 / 10000) | 47.96% (893 / 1862) | 90.31% (9031 / 10000) |
| 7 | `emotions.disgust <= 0.2` | 12.81% | 12.81% (1281 / 10000) | 10000 | 0.00 | 0.20 | -0.20 | moderate | no | no | 0.00% (N=103) | — | 14.47% (1447 / 10000) | 85.53% (8553 / 10000) | 11.47% (166 / 1447) | 87.19% (8719 / 10000) |
| 8 | `emotions.shame <= 0.5` | 6.24% | 6.24% (624 / 10000) | 10000 | 0.00 | 0.50 | -0.50 | moderate | no | no | 0.00% (N=103) | — | 37.87% (3787 / 10000) | 62.13% (6213 / 10000) | 83.52% (3163 / 3787) | 93.76% (9376 / 10000) |
| 9 | `emotions.humiliation <= 0.25` | 10.25% | 10.25% (1025 / 10000) | 10000 | 0.00 | 0.25 | -0.25 | moderate | no | no | 1.90% (N=105) | — | 12.38% (1238 / 10000) | 87.62% (8762 / 10000) | 17.21% (213 / 1238) | 89.75% (8975 / 10000) |
| 10 | `emotions.fear <= 0.25` | 10.04% | 10.04% (1004 / 10000) | 10000 | 0.00 | 0.25 | -0.25 | moderate | no | no | 0.96% (N=104) | — | 35.33% (3533 / 10000) | 64.67% (6467 / 10000) | 71.58% (2529 / 3533) | 89.96% (8996 / 10000) |
| 11 | `emotions.anxiety <= 0.3` | 2.68% | 2.68% (268 / 10000) | 10000 | 0.00 | 0.30 | -0.30 | moderate | no | no | 0.96% (N=104) | — | 10.32% (1032 / 10000) | 89.68% (8968 / 10000) | 74.03% (764 / 1032) | 97.32% (9732 / 10000) |
| 12 | `emotions.hypervigilance <= 0.25` | 10.75% | 10.75% (1075 / 10000) | 10000 | 0.00 | 0.25 | -0.25 | moderate | no | no | 18.25% (N=126) | — | 14.49% (1449 / 10000) | 85.51% (8551 / 10000) | 25.81% (374 / 1449) | 89.25% (8925 / 10000) |
| 13 | `emotions.rage <= 0.25` | 4.99% | 4.99% (499 / 10000) | 10000 | 0.00 | 0.25 | -0.25 | moderate | no | no | 0.00% (N=103) | — | 16.25% (1625 / 10000) | 83.75% (8375 / 10000) | 69.29% (1126 / 1625) | 95.01% (9501 / 10000) |
| 14 | `emotions.wrath <= 0.25` | 1.09% | 1.09% (109 / 10000) | 10000 | 0.00 | 0.25 | -0.25 | low | no | no | 0.00% (N=103) | — | 1.49% (149 / 10000) | 98.51% (9851 / 10000) | 26.85% (40 / 149) | 98.91% (9891 / 10000) |
| 15 | `emotions.protest_anger <= 0.35` | 0.73% | 0.73% (73 / 10000) | 10000 | 0.00 | 0.35 | -0.35 | low | no | no | 0.00% (N=103) | — | 0.85% (85 / 10000) | 99.15% (9915 / 10000) | 14.12% (12 / 85) | 99.27% (9927 / 10000) |
| 16 | `emotions.moral_outrage <= 0.35` | 0.42% | 0.42% (42 / 10000) | 10000 | 0.00 | 0.35 | -0.35 | low | no | no | 0.00% (N=103) | — | 0.45% (45 / 10000) | 99.55% (9955 / 10000) | 6.67% (3 / 45) | 99.58% (9958 / 10000) |

**OR Block #1 (ANY ONE must pass)**

| # | Condition | Fail% global | Fail% \| mood-pass | Support | Bound | Threshold | Gap | Tunable | Redundant (regime) | Clamp-trivial (regime) | Sole-Blocker Rate | Headroom (10%) | Gate pass (mood) | Gate clamp (mood) | Pass \| gate (mood) | Pass \| mood (mood) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 17 | `emotions.aesthetic_appreciation >= 0.25` | 97.16% | 97.16% (9716 / 10000) | 10000 | 0.79 | 0.25 | -0.54 | low | no | N/A | N/A (OR alt) | ×3.5 | 3.26% (326 / 10000) | 96.74% (9674 / 10000) | 87.12% (284 / 326) | 2.84% (284 / 10000) |
| 18 | `emotions.quiet_absorption >= 0.25` | 98.50% | 98.50% (9850 / 10000) | 10000 | 0.64 | 0.25 | -0.39 | low | no | N/A | N/A (OR alt) | ×6.7 | 1.87% (187 / 10000) | 98.13% (9813 / 10000) | 80.21% (150 / 187) | 1.50% (150 / 10000) |
| 19 | `emotions.interest >= 0.35` | 77.18% | 77.18% (7718 / 10000) | 10000 | 0.96 | 0.35 | -0.61 | moderate | no | N/A | N/A (OR alt) | — | 40.29% (4029 / 10000) | 59.71% (5971 / 10000) | 56.64% (2282 / 4029) | 22.82% (2282 / 10000) |
| 20 | `emotions.inspiration >= 0.25` | 91.86% | 91.86% (9186 / 10000) | 10000 | 0.82 | 0.25 | -0.57 | moderate | no | N/A | N/A (OR alt) | ×1.2 | 18.35% (1835 / 10000) | 81.65% (8165 / 10000) | 44.36% (814 / 1835) | 8.14% (814 / 10000) |

**Combined OR Block**: 24.64% pass rate (Fail% global: 75.36% | Fail% \| mood-pass: 75.36%)

**OR Block #1 OR Alternative Coverage** (2464 total successes):

| Alternative | P(alt passes \| OR pass) | P(alt exclusively passes \| OR pass) | First-pass share (order-dependent) |
|------------|---------------------------|------------------------------------|------------------------------------|
| `emotions.interest >= 0.35` | 92.61% (2282/2464) | 58.20% (1434/2464) | 81.62% (2011/2464) |
| `emotions.inspiration >= 0.25` | 33.04% (814/2464) | 4.63% (114/2464) | 4.63% (114/2464) |
| `emotions.aesthetic_appreciation >= 0.25` | 11.53% (284/2464) | 1.54% (38/2464) | 11.53% (284/2464) |
| `emotions.quiet_absorption >= 0.25` | 6.09% (150/2464) | 0.32% (8/2464) | 2.23% (55/2464) |
*First-pass share is order-dependent; use pass/exclusive rates for order-independent attribution.*

**OR Block #1 OR Overlap (absolute rates)**:

| Population | Union (any pass) | Exclusive (exactly one) | Overlap (2+ pass) | Top overlap pair |
|------------|------------------|------------------------|-------------------|------------------|
| Global | 24.64% (2464/10.000) | 15.94% (1594/10.000) | 8.70% (870/10.000) | `emotions.interest >= 0.35` + `emotions.inspiration >= 0.25` 6.87% (687/10.000) |
| Mood regime | 24.64% (2464/10.000) | 15.94% (1594/10.000) | 8.70% (870/10.000) | `emotions.interest >= 0.35` + `emotions.inspiration >= 0.25` 6.87% (687/10.000) |

**OR Block #2 (ANY ONE must pass)**

| # | Condition | Fail% global | Fail% \| mood-pass | Support | Bound | Threshold | Gap | Tunable | Redundant (regime) | Clamp-trivial (regime) | Sole-Blocker Rate | Headroom (10%) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 21 | `(emotions.admiration - previousEmotions.admiration) >= 0.12` | 84.54% | 84.54% (8454 / 10000) | 10000 | - | - | - | low | N/A | N/A | N/A (OR alt) | — |
| 22 | `(emotions.inspiration - previousEmotions.inspiration) >= 0.1` | 88.23% | 88.23% (8823 / 10000) | 10000 | - | - | - | low | N/A | N/A | N/A (OR alt) | — |
| 23 | `(emotions.aesthetic_appreciation - previousEmotions.aesthetic_appreciation) >= 0.1` | 96.79% | 96.79% (9679 / 10000) | 10000 | - | - | - | low | N/A | N/A | N/A (OR alt) | ×3.1 |
| 24 | `(emotions.quiet_absorption - previousEmotions.quiet_absorption) >= 0.1` | 98.16% | 98.16% (9816 / 10000) | 10000 | - | - | - | low | N/A | N/A | N/A (OR alt) | ×5.4 |
| 25 | `(emotions.interest - previousEmotions.interest) >= 0.15` | 73.34% | 73.34% (7334 / 10000) | 10000 | - | - | - | low | N/A | N/A | N/A (OR alt) | — |

**Combined OR Block**: 32.67% pass rate (Fail% global: 67.33% | Fail% \| mood-pass: 67.33%)

**OR Block #2 OR Alternative Coverage** (3267 total successes):

| Alternative | P(alt passes \| OR pass) | P(alt exclusively passes \| OR pass) | First-pass share (order-dependent) |
|------------|---------------------------|------------------------------------|------------------------------------|
| `(emotions.interest - previousEmotions.interest) >= 0.15` | 81.60% (2666/3267) | 32.29% (1055/3267) | 32.29% (1055/3267) |
| `(emotions.admiration - previousEmotions.admiration) >= 0.12` | 47.32% (1546/3267) | 8.39% (274/3267) | 47.32% (1546/3267) |
| `(emotions.inspiration - previousEmotions.inspiration) >= 0.1` | 36.03% (1177/3267) | 5.20% (170/3267) | 18.49% (604/3267) |
| `(emotions.aesthetic_appreciation - previousEmotions.aesthetic_appreciation) >= 0.1` | 9.83% (321/3267) | 0.31% (10/3267) | 1.16% (38/3267) |
| `(emotions.quiet_absorption - previousEmotions.quiet_absorption) >= 0.1` | 5.63% (184/3267) | 0.21% (7/3267) | 0.73% (24/3267) |
*First-pass share is order-dependent; use pass/exclusive rates for order-independent attribution.*

**OR Block #2 OR Overlap (absolute rates)**:

| Population | Union (any pass) | Exclusive (exactly one) | Overlap (2+ pass) | Top overlap pair |
|------------|------------------|------------------------|-------------------|------------------|
| Global | 32.67% (3267/10.000) | 15.16% (1516/10.000) | 17.51% (1751/10.000) | `(emotions.admiration - previousEmotions.admiration) >= 0.12` + `(emotions.interest - previousEmotions.interest) >= 0.15` 11.52% (1152/10.000) |
| Mood regime | 32.67% (3267/10.000) | 15.16% (1516/10.000) | 17.51% (1751/10.000) | `(emotions.admiration - previousEmotions.admiration) >= 0.12` + `(emotions.interest - previousEmotions.interest) >= 0.15` 11.52% (1152/10.000) |

#### Worst Offender Analysis

**#1: `emotions.admiration >= 0.6`** (Fail% global: 98.61% | Fail% \| mood-pass: 98.61% (9861 / 10000), 92.24% last-mile)
- Values are far from threshold (low near-miss rate)
- Recommendation: **adjust_upstream** - Review prototypes/generation rules

**#2: `(emotions.quiet_absorption - previousEmotions.quiet_absorption) >= 0.1`** ⚠️ OR-alternative (Fail% global: 98.16% | Fail% \| mood-pass: 98.16% (9816 / 10000), 70.41% last-mile)
- ℹ️ This is an alternative within an OR block; other alternatives may cover this case
- Values are far from threshold (low near-miss rate)
- Recommendation: **adjust_upstream** - Review prototypes/generation rules

**#3: `emotions.quiet_absorption >= 0.25`** ⚠️ OR-alternative (Fail% global: 98.50% | Fail% \| mood-pass: 98.50% (9850 / 10000), 69.15% last-mile)
- ℹ️ This is an alternative within an OR block; other alternatives may cover this case
- Values are far from threshold (low near-miss rate)
- Recommendation: **adjust_upstream** - Review prototypes/generation rules

**#4: `emotions.aesthetic_appreciation >= 0.25`** ⚠️ OR-alternative (Fail% global: 97.16% | Fail% \| mood-pass: 97.16% (9716 / 10000), 35.56% last-mile)
- ℹ️ This is an alternative within an OR block; other alternatives may cover this case
- Values are far from threshold (low near-miss rate)
- Recommendation: **adjust_upstream** - Review prototypes/generation rules

**#5: `(emotions.aesthetic_appreciation - previousEmotions.aesthetic_appreciation) >= 0.1`** ⚠️ OR-alternative (Fail% global: 96.79% | Fail% \| mood-pass: 96.79% (9679 / 10000), 21.62% last-mile)
- ℹ️ This is an alternative within an OR block; other alternatives may cover this case
- Values are far from threshold (low near-miss rate)
- Recommendation: **adjust_upstream** - Review prototypes/generation rules

#### Prototype Math Analysis

**Population**: full (N=10.000; predicate: all; hash: 1a309bea).
##### 🧠 admiration >= 0.60 ❌ IMPOSSIBLE

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.24]
- **Threshold**: 0.60
- **Status**: impossible
- **Slack**: feasibility -0.363; always -0.600
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 1.90 | **Required Raw Sum**: 1.14

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.33 | 0.45 | 0.00 | 0.88 | 20.46% |
| Global | raw | 0.00 | 0.37 | 0.46 | 0.00 | 0.88 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.33 | 0.45 | 0.00 | 0.88 | 20.46% |
| In mood regime (no mood constraints) | raw | 0.00 | 0.37 | 0.46 | 0.00 | 0.88 | N/A |
- **Observed max (global, final)**: 0.88
- **Observed max (mood-regime, final)**: 0.88

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | +0.60 | [0.20, -0.25] | -0.25 | -0.150 | ⚠️ positive_weight_low_max |
| engagement | +0.50 | [0.35, 1.00] | 1.00 | 0.500 | — |
| self_evaluation | +0.30 | [-1.00, -0.25] | -0.25 | -0.075 | ⚠️ positive_weight_low_max |
| arousal | +0.20 | [0.35, 0.35] | 0.35 | 0.070 | ⚠️ positive_weight_low_max |
| affiliation | +0.30 | [0.10, 0.35] | 0.35 | 0.105 | ⚠️ positive_weight_low_max |

**Gates** ❌:
- ✅ `engagement >= 0.10` - Satisfiable | **Observed Fail Rate**: 54.60%
- ❌ `valence >= 0.10` - Constraint max (-0.25) < gate requirement (0.1) | **Observed Fail Rate**: 55.15%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **valence**: Has positive weight (+0.60) but constraint limits max to -0.25
- ⚠️ **self_evaluation**: Has positive weight (+0.30) but constraint limits max to -0.25
- ⚠️ **arousal**: Has positive weight (+0.20) but constraint limits max to 0.35
- ⚠️ **affiliation**: Has positive weight (+0.30) but constraint limits max to 0.35

**Analysis**: Threshold 0.6 is NOT achievable (max: 0.237). Binding conflicts: valence has positive weight (+0.60) but constraint limits it to max=-0.25; self_evaluation has positive weight (+0.30) but constraint limits it to max=-0.25; arousal has positive weight (+0.20) but constraint limits it to max=0.35; affiliation has positive weight (+0.30) but constraint limits it to max=0.35. Blocked gates: valence >= 0.10

**Recommendation**: Gates cannot be satisfied with current axis constraints. Consider relaxing the conflicting constraints or adjusting gate thresholds in the prototype.

##### 🧠 aesthetic_appreciation >= 0.25 ❌ IMPOSSIBLE

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.15]
- **Threshold**: 0.25
- **Status**: impossible
- **Slack**: feasibility -0.102; always -0.250
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 3.00 | **Required Raw Sum**: 0.75

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.79 | 3.26% |
| Global | raw | 0.02 | 0.34 | 0.43 | 0.00 | 0.80 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.79 | 3.26% |
| In mood regime (no mood constraints) | raw | 0.02 | 0.34 | 0.43 | 0.00 | 0.80 | N/A |
- **Observed max (global, final)**: 0.79
- **Observed max (mood-regime, final)**: 0.79

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | +0.75 | [0.20, -0.25] | -0.25 | -0.188 | ⚠️ positive_weight_low_max |
| engagement | +0.85 | [0.35, 1.00] | 1.00 | 0.850 | — |
| arousal | -0.35 | [0.35, 0.35] | 0.35 | -0.122 | ⚠️ negative_weight_high_min |
| threat | -0.45 | [0.30, 0.35] | 0.30 | -0.135 | ⚠️ negative_weight_high_min |
| agency_control | -0.15 | [0.20, 0.10] | 0.20 | -0.030 | ⚠️ negative_weight_high_min |
| future_expectancy | +0.15 | [0.15, -0.20] | -0.20 | -0.030 | ⚠️ positive_weight_low_max |
| self_evaluation | +0.10 | [-1.00, -0.25] | -0.25 | -0.025 | ⚠️ positive_weight_low_max |
| inhibitory_control | +0.10 | [0.20, 0.25] | 0.25 | 0.025 | ⚠️ positive_weight_low_max |
| self_control | +0.10 | [0.20, 1.00] | 1.00 | 0.100 | — |

**Gates** ❌:
- ❌ `valence >= 0.20` - Constraint max (-0.25) < gate requirement (0.2) | **Observed Fail Rate**: 59.94%
- ✅ `engagement >= 0.25` - Satisfiable | **Observed Fail Rate**: 62.23%
- ✅ `threat <= 0.35` - Satisfiable | **Observed Fail Rate**: 32.26%
- ✅ `arousal <= 0.35` - Satisfiable | **Observed Fail Rate**: 32.25%
- ✅ `arousal >= -0.30` - Satisfiable | **Observed Fail Rate**: 34.98%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **valence**: Has positive weight (+0.75) but constraint limits max to -0.25
- ⚠️ **arousal**: Has negative weight (-0.35) but constraint requires min 0.35
- ⚠️ **threat**: Has negative weight (-0.45) but constraint requires min 0.30
- ⚠️ **agency_control**: Has negative weight (-0.15) but constraint requires min 0.20
- ⚠️ **future_expectancy**: Has positive weight (+0.15) but constraint limits max to -0.20
- ⚠️ **self_evaluation**: Has positive weight (+0.10) but constraint limits max to -0.25
- ⚠️ **inhibitory_control**: Has positive weight (+0.10) but constraint limits max to 0.25

**Analysis**: Threshold 0.25 is NOT achievable (max: 0.148). Binding conflicts: valence has positive weight (+0.75) but constraint limits it to max=-0.25; arousal has negative weight (-0.35) but constraint requires min=0.35; threat has negative weight (-0.45) but constraint requires min=0.30; agency_control has negative weight (-0.15) but constraint requires min=0.20; future_expectancy has positive weight (+0.15) but constraint limits it to max=-0.20; self_evaluation has positive weight (+0.10) but constraint limits it to max=-0.25; inhibitory_control has positive weight (+0.10) but constraint limits it to max=0.25. Blocked gates: valence >= 0.20

**Recommendation**: Gates cannot be satisfied with current axis constraints. Consider relaxing the conflicting constraints or adjusting gate thresholds in the prototype.

##### 🧠 quiet_absorption >= 0.25 ❌ IMPOSSIBLE

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.23]
- **Threshold**: 0.25
- **Status**: impossible
- **Slack**: feasibility -0.020; always -0.250
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 3.50 | **Required Raw Sum**: 0.88

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.64 | 1.87% |
| Global | raw | 0.03 | 0.33 | 0.40 | 0.00 | 0.82 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.64 | 1.87% |
| In mood regime (no mood constraints) | raw | 0.03 | 0.33 | 0.40 | 0.00 | 0.82 | N/A |
- **Observed max (global, final)**: 0.64
- **Observed max (mood-regime, final)**: 0.64

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| engagement | +1.00 | [0.35, 1.00] | 1.00 | 1.000 | — |
| arousal | -0.50 | [0.35, 0.35] | 0.35 | -0.175 | ⚠️ negative_weight_high_min |
| agency_control | -0.40 | [0.20, 0.10] | 0.20 | -0.080 | ⚠️ negative_weight_high_min |
| threat | -0.45 | [0.30, 0.35] | 0.30 | -0.135 | ⚠️ negative_weight_high_min |
| valence | +0.20 | [0.20, -0.25] | -0.25 | -0.050 | ⚠️ positive_weight_low_max |
| future_expectancy | +0.05 | [0.15, -0.20] | -0.20 | -0.010 | ⚠️ positive_weight_low_max |
| inhibitory_control | +0.40 | [0.20, 0.25] | 0.25 | 0.100 | ⚠️ positive_weight_low_max |
| self_control | +0.20 | [0.20, 1.00] | 1.00 | 0.200 | — |
| uncertainty | -0.30 | [0.15, 0.25] | 0.15 | -0.045 | ⚠️ negative_weight_high_min |

**Gates** ❌:
- ✅ `engagement >= 0.35` - Satisfiable | **Observed Fail Rate**: 66.72%
- ✅ `arousal <= 0.35` - Satisfiable | **Observed Fail Rate**: 32.25%
- ✅ `arousal >= -0.40` - Satisfiable | **Observed Fail Rate**: 30.56%
- ✅ `threat <= 0.35` - Satisfiable | **Observed Fail Rate**: 32.26%
- ✅ `agency_control <= 0.25` - Satisfiable | **Observed Fail Rate**: 37.61%
- ❌ `valence >= -0.10` - Constraint max (-0.25) < gate requirement (-0.1) | **Observed Fail Rate**: 44.88%
- ✅ `uncertainty <= 0.25` - Satisfiable | **Observed Fail Rate**: 36.12%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **arousal**: Has negative weight (-0.50) but constraint requires min 0.35
- ⚠️ **agency_control**: Has negative weight (-0.40) but constraint requires min 0.20
- ⚠️ **threat**: Has negative weight (-0.45) but constraint requires min 0.30
- ⚠️ **valence**: Has positive weight (+0.20) but constraint limits max to -0.25
- ⚠️ **future_expectancy**: Has positive weight (+0.05) but constraint limits max to -0.20
- ⚠️ **inhibitory_control**: Has positive weight (+0.40) but constraint limits max to 0.25
- ⚠️ **uncertainty**: Has negative weight (-0.30) but constraint requires min 0.15

**Analysis**: Threshold 0.25 is NOT achievable (max: 0.230). Binding conflicts: arousal has negative weight (-0.50) but constraint requires min=0.35; agency_control has negative weight (-0.40) but constraint requires min=0.20; threat has negative weight (-0.45) but constraint requires min=0.30; valence has positive weight (+0.20) but constraint limits it to max=-0.25; future_expectancy has positive weight (+0.05) but constraint limits it to max=-0.20; inhibitory_control has positive weight (+0.40) but constraint limits it to max=0.25; uncertainty has negative weight (-0.30) but constraint requires min=0.15. Blocked gates: valence >= -0.10

**Recommendation**: Gates cannot be satisfied with current axis constraints. Consider relaxing the conflicting constraints or adjusting gate thresholds in the prototype.

##### 🧠 interest >= 0.35 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.70]
- **Threshold**: 0.35
- **Status**: sometimes
- **Slack**: feasibility +0.350; always -0.350
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 1.70 | **Required Raw Sum**: 0.59

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.53 | 0.63 | 0.00 | 0.96 | 40.29% |
| Global | raw | 0.03 | 0.53 | 0.63 | 0.00 | 0.96 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.53 | 0.63 | 0.00 | 0.96 | 40.29% |
| In mood regime (no mood constraints) | raw | 0.03 | 0.53 | 0.63 | 0.00 | 0.96 | N/A |
- **Observed max (global, final)**: 0.96
- **Observed max (mood-regime, final)**: 0.96

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| engagement | +1.00 | [0.35, 1.00] | 1.00 | 1.000 | — |
| arousal | +0.40 | [0.35, 0.35] | 0.35 | 0.140 | ⚠️ positive_weight_low_max |
| valence | +0.20 | [0.20, -0.25] | -0.25 | -0.050 | ⚠️ positive_weight_low_max |
| self_control | +0.10 | [0.20, 1.00] | 1.00 | 0.100 | — |

**Gates** ✅:
- ✅ `engagement >= 0.20` - Satisfiable | **Observed Fail Rate**: 59.71%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **arousal**: Has positive weight (+0.40) but constraint limits max to 0.35
- ⚠️ **valence**: Has positive weight (+0.20) but constraint limits max to -0.25

**Analysis**: Threshold 0.35 is achievable (max: 0.700). Binding conflicts: arousal has positive weight (+0.40) but constraint limits it to max=0.35; valence has positive weight (+0.20) but constraint limits it to max=-0.25



##### 🧠 inspiration >= 0.25 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.38]
- **Threshold**: 0.25
- **Status**: sometimes
- **Slack**: feasibility +0.128; always -0.250
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 3.00 | **Required Raw Sum**: 0.75

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.20 | 0.35 | 0.00 | 0.82 | 18.35% |
| Global | raw | 0.01 | 0.34 | 0.42 | 0.00 | 0.82 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.20 | 0.35 | 0.00 | 0.82 | 18.35% |
| In mood regime (no mood constraints) | raw | 0.01 | 0.34 | 0.42 | 0.00 | 0.82 | N/A |
- **Observed max (global, final)**: 0.82
- **Observed max (mood-regime, final)**: 0.82

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | +0.60 | [0.20, -0.25] | -0.25 | -0.150 | ⚠️ positive_weight_low_max |
| arousal | +0.70 | [0.35, 0.35] | 0.35 | 0.245 | ⚠️ positive_weight_low_max |
| engagement | +0.60 | [0.35, 1.00] | 1.00 | 0.600 | — |
| future_expectancy | +0.40 | [0.15, -0.20] | -0.20 | -0.080 | ⚠️ positive_weight_low_max |
| temporal_orientation | +0.40 | [-1.00, 1.00] | 1.00 | 0.400 | — |
| agency_control | +0.20 | [0.20, 0.10] | 0.10 | 0.020 | ⚠️ positive_weight_low_max |
| self_control | +0.10 | [0.20, 1.00] | 1.00 | 0.100 | — |
| inhibitory_control | +0.00 | [0.20, 0.25] | 0.20 | 0.000 | ⚠️ negative_weight_high_min |

**Gates** ❌:
- ❌ `future_expectancy >= 0.15` - Constraint max (-0.2) < gate requirement (0.15) | **Observed Fail Rate**: 57.50%
- ✅ `engagement >= 0.15` - Satisfiable | **Observed Fail Rate**: 57.20%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **valence**: Has positive weight (+0.60) but constraint limits max to -0.25
- ⚠️ **arousal**: Has positive weight (+0.70) but constraint limits max to 0.35
- ⚠️ **future_expectancy**: Has positive weight (+0.40) but constraint limits max to -0.20
- ⚠️ **agency_control**: Has positive weight (+0.20) but constraint limits max to 0.10
- ⚠️ **inhibitory_control**: Has negative weight (0.00) but constraint requires min 0.20

**Analysis**: Intensity 0.25 is achievable but gates are blocked. Binding conflicts: valence has positive weight (+0.60) but constraint limits it to max=-0.25; arousal has positive weight (+0.70) but constraint limits it to max=0.35; future_expectancy has positive weight (+0.40) but constraint limits it to max=-0.20; agency_control has positive weight (+0.20) but constraint limits it to max=0.10; inhibitory_control has negative weight (0.00) but constraint requires min=0.20. Blocked gates: future_expectancy >= 0.15

**Recommendation**: Gates cannot be satisfied with current axis constraints. Consider relaxing the conflicting constraints or adjusting gate thresholds in the prototype.

##### 🧠 envy <= 0.30 ✅ ALWAYS

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.23]
- **Threshold**: 0.30
- **Status**: always
- **Slack**: feasibility +0.300; always +0.068
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 2.50 | **Required Raw Sum**: 0.75

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.15 | 0.26 | 0.00 | 0.62 | 22.69% |
| Global | raw | 0.00 | 0.21 | 0.28 | 0.00 | 0.62 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.15 | 0.26 | 0.00 | 0.62 | 22.69% |
| In mood regime (no mood constraints) | raw | 0.00 | 0.21 | 0.28 | 0.00 | 0.62 | N/A |
- **Observed max (global, final)**: 0.62
- **Observed max (mood-regime, final)**: 0.62

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.50 | [0.20, -0.25] | 0.20 | -0.100 | ⚠️ negative_weight_high_min |
| arousal | +0.40 | [0.35, 0.35] | 0.35 | 0.140 | ⚠️ positive_weight_low_max |
| agency_control | -0.20 | [0.20, 0.10] | 0.20 | -0.040 | ⚠️ negative_weight_high_min |
| self_evaluation | -0.40 | [-1.00, -0.25] | -1.00 | 0.400 | — |
| engagement | +0.30 | [0.35, 1.00] | 1.00 | 0.300 | — |
| affiliation | -0.20 | [0.10, 0.35] | 0.10 | -0.020 | ⚠️ negative_weight_high_min |
| self_control | -0.30 | [0.20, 1.00] | 0.20 | -0.060 | ⚠️ negative_weight_high_min |
| inhibitory_control | -0.20 | [0.20, 0.25] | 0.20 | -0.040 | ⚠️ negative_weight_high_min |

**Gates** ❌:
- ✅ `self_evaluation <= -0.05` - Satisfiable | **Observed Fail Rate**: 52.33%
- ❌ `valence <= -0.05` - Constraint min (0.2) > gate requirement (-0.05) | **Observed Fail Rate**: 51.91%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **valence**: Has negative weight (-0.50) but constraint requires min 0.20
- ⚠️ **arousal**: Has positive weight (+0.40) but constraint limits max to 0.35
- ⚠️ **agency_control**: Has negative weight (-0.20) but constraint requires min 0.20
- ⚠️ **affiliation**: Has negative weight (-0.20) but constraint requires min 0.10
- ⚠️ **self_control**: Has negative weight (-0.30) but constraint requires min 0.20
- ⚠️ **inhibitory_control**: Has negative weight (-0.20) but constraint requires min 0.20

**Analysis**: Condition always satisfied by axis bounds but gates are blocked. Binding conflicts: valence has negative weight (-0.50) but constraint requires min=0.20; arousal has positive weight (+0.40) but constraint limits it to max=0.35; agency_control has negative weight (-0.20) but constraint requires min=0.20; affiliation has negative weight (-0.20) but constraint requires min=0.10; self_control has negative weight (-0.30) but constraint requires min=0.20; inhibitory_control has negative weight (-0.20) but constraint requires min=0.20. Blocked gates: valence <= -0.05

**Recommendation**: Always satisfies threshold within constraints.

##### 🧠 jealousy <= 0.25 ✅ ALWAYS

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.23]
- **Threshold**: 0.25
- **Status**: always
- **Slack**: feasibility +0.250; always +0.021
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 3.95 | **Required Raw Sum**: 0.99

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.64 | 3.76% |
| Global | raw | 0.00 | 0.21 | 0.28 | 0.00 | 0.64 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.64 | 3.76% |
| In mood regime (no mood constraints) | raw | 0.00 | 0.21 | 0.28 | 0.00 | 0.64 | N/A |
- **Observed max (global, final)**: 0.64
- **Observed max (mood-regime, final)**: 0.64

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| threat | +0.60 | [0.30, 0.35] | 0.35 | 0.210 | ⚠️ positive_weight_low_max |
| arousal | +0.60 | [0.35, 0.35] | 0.35 | 0.210 | ⚠️ positive_weight_low_max |
| valence | -0.60 | [0.20, -0.25] | 0.20 | -0.120 | ⚠️ negative_weight_high_min |
| agency_control | -0.20 | [0.20, 0.10] | 0.20 | -0.040 | ⚠️ negative_weight_high_min |
| engagement | +0.40 | [0.35, 1.00] | 1.00 | 0.400 | — |
| self_evaluation | -0.25 | [-1.00, -0.25] | -1.00 | 0.250 | — |
| affiliation | -0.30 | [0.10, 0.35] | 0.10 | -0.030 | ⚠️ negative_weight_high_min |
| self_control | -0.30 | [0.20, 1.00] | 0.20 | -0.060 | ⚠️ negative_weight_high_min |
| inhibitory_control | -0.20 | [0.20, 0.25] | 0.20 | -0.040 | ⚠️ negative_weight_high_min |
| uncertainty | +0.50 | [0.15, 0.25] | 0.25 | 0.125 | ⚠️ positive_weight_low_max |

**Gates** ❌:
- ✅ `threat >= 0.20` - Satisfiable | **Observed Fail Rate**: 59.92%
- ❌ `valence <= -0.05` - Constraint min (0.2) > gate requirement (-0.05) | **Observed Fail Rate**: 51.91%
- ✅ `engagement >= 0.15` - Satisfiable | **Observed Fail Rate**: 57.20%
- ✅ `uncertainty >= 0.10` - Satisfiable | **Observed Fail Rate**: 55.78%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **threat**: Has positive weight (+0.60) but constraint limits max to 0.35
- ⚠️ **arousal**: Has positive weight (+0.60) but constraint limits max to 0.35
- ⚠️ **valence**: Has negative weight (-0.60) but constraint requires min 0.20
- ⚠️ **agency_control**: Has negative weight (-0.20) but constraint requires min 0.20
- ⚠️ **affiliation**: Has negative weight (-0.30) but constraint requires min 0.10
- ⚠️ **self_control**: Has negative weight (-0.30) but constraint requires min 0.20
- ⚠️ **inhibitory_control**: Has negative weight (-0.20) but constraint requires min 0.20
- ⚠️ **uncertainty**: Has positive weight (+0.50) but constraint limits max to 0.25

**Analysis**: Condition always satisfied by axis bounds but gates are blocked. Binding conflicts: threat has positive weight (+0.60) but constraint limits it to max=0.35; arousal has positive weight (+0.60) but constraint limits it to max=0.35; valence has negative weight (-0.60) but constraint requires min=0.20; agency_control has negative weight (-0.20) but constraint requires min=0.20; affiliation has negative weight (-0.30) but constraint requires min=0.10; self_control has negative weight (-0.30) but constraint requires min=0.20; inhibitory_control has negative weight (-0.20) but constraint requires min=0.20; uncertainty has positive weight (+0.50) but constraint limits it to max=0.25. Blocked gates: valence <= -0.05

**Recommendation**: Always satisfies threshold within constraints.

##### 🧠 resentment <= 0.30 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.61]
- **Threshold**: 0.30
- **Status**: sometimes
- **Slack**: feasibility +0.300; always -0.305
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 4.85 | **Required Raw Sum**: 1.46

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.63 | 1.88% |
| Global | raw | 0.09 | 0.33 | 0.40 | 0.00 | 0.69 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.63 | 1.88% |
| In mood regime (no mood constraints) | raw | 0.09 | 0.33 | 0.40 | 0.00 | 0.69 | N/A |
- **Observed max (global, final)**: 0.63
- **Observed max (mood-regime, final)**: 0.63

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.75 | [0.20, -0.25] | 0.20 | -0.150 | ⚠️ negative_weight_high_min |
| arousal | +0.20 | [0.35, 0.35] | 0.35 | 0.070 | ⚠️ positive_weight_low_max |
| agency_control | -0.55 | [0.20, 0.10] | 0.20 | -0.110 | ⚠️ negative_weight_high_min |
| temporal_orientation | -0.60 | [-1.00, 1.00] | -1.00 | 0.600 | — |
| self_evaluation | -0.20 | [-1.00, -0.25] | -1.00 | 0.200 | — |
| engagement | +0.55 | [0.35, 1.00] | 1.00 | 0.550 | — |
| rumination | +0.80 | [0.20, 1.00] | 1.00 | 0.800 | — |
| ruminative_tendency | +0.50 | [-1.00, 1.00] | 1.00 | 0.500 | — |
| inhibitory_control | +0.30 | [0.20, 0.25] | 0.25 | 0.075 | ⚠️ positive_weight_low_max |
| self_control | +0.40 | [0.20, 1.00] | 1.00 | 0.400 | — |

**Gates** ❌:
- ❌ `valence <= -0.15` - Constraint min (0.2) > gate requirement (-0.15) | **Observed Fail Rate**: 57.27%
- ❌ `agency_control <= 0.10` - Constraint min (0.2) > gate requirement (0.1) | **Observed Fail Rate**: 45.37%
- ✅ `engagement >= 0.15` - Satisfiable | **Observed Fail Rate**: 57.20%
- ✅ `arousal <= 0.60` - Satisfiable | **Observed Fail Rate**: 19.37%
- ✅ `future_expectancy <= 0.20` - Satisfiable | **Observed Fail Rate**: 39.51%
- ✅ `rumination >= 0.20` - Satisfiable | **Observed Fail Rate**: 60.16%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **valence**: Has negative weight (-0.75) but constraint requires min 0.20
- ⚠️ **arousal**: Has positive weight (+0.20) but constraint limits max to 0.35
- ⚠️ **agency_control**: Has negative weight (-0.55) but constraint requires min 0.20
- ⚠️ **inhibitory_control**: Has positive weight (+0.30) but constraint limits max to 0.25

**Analysis**: Threshold 0.3 is achievable but gates are blocked. Binding conflicts: valence has negative weight (-0.75) but constraint requires min=0.20; arousal has positive weight (+0.20) but constraint limits it to max=0.35; agency_control has negative weight (-0.55) but constraint requires min=0.20; inhibitory_control has positive weight (+0.30) but constraint limits it to max=0.25. Blocked gates: valence <= -0.15, agency_control <= 0.10

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 cynicism <= 0.40 ✅ ALWAYS

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.00]
- **Threshold**: 0.40
- **Status**: always
- **Slack**: feasibility +0.400; always +0.400
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 1.90 | **Required Raw Sum**: 0.76

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.26 | 0.37 | 0.00 | 0.72 | 16.90% |
| Global | raw | 0.00 | 0.29 | 0.38 | 0.00 | 0.72 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.26 | 0.37 | 0.00 | 0.72 | 16.90% |
| In mood regime (no mood constraints) | raw | 0.00 | 0.29 | 0.38 | 0.00 | 0.72 | N/A |
- **Observed max (global, final)**: 0.72
- **Observed max (mood-regime, final)**: 0.72

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.50 | [0.20, -0.25] | 0.20 | -0.100 | ⚠️ negative_weight_high_min |
| future_expectancy | -0.70 | [0.15, -0.20] | 0.15 | -0.105 | ⚠️ negative_weight_high_min |
| threat | -0.10 | [0.30, 0.35] | 0.30 | -0.030 | ⚠️ negative_weight_high_min |
| engagement | -0.20 | [0.35, 1.00] | 0.35 | -0.070 | ⚠️ negative_weight_high_min |
| self_evaluation | +0.10 | [-1.00, -0.25] | -0.25 | -0.025 | ⚠️ positive_weight_low_max |
| self_control | -0.30 | [0.20, 1.00] | 0.20 | -0.060 | ⚠️ negative_weight_high_min |
| inhibitory_control | +0.00 | [0.20, 0.25] | 0.20 | 0.000 | ⚠️ negative_weight_high_min |

**Gates** ❌:
- ❌ `future_expectancy <= -0.2` - Constraint min (0.15) > gate requirement (-0.2) | **Observed Fail Rate**: 59.37%
- ❌ `valence <= -0.2` - Constraint min (0.2) > gate requirement (-0.2) | **Observed Fail Rate**: 59.88%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **valence**: Has negative weight (-0.50) but constraint requires min 0.20
- ⚠️ **future_expectancy**: Has negative weight (-0.70) but constraint requires min 0.15
- ⚠️ **threat**: Has negative weight (-0.10) but constraint requires min 0.30
- ⚠️ **engagement**: Has negative weight (-0.20) but constraint requires min 0.35
- ⚠️ **self_evaluation**: Has positive weight (+0.10) but constraint limits max to -0.25
- ⚠️ **self_control**: Has negative weight (-0.30) but constraint requires min 0.20
- ⚠️ **inhibitory_control**: Has negative weight (0.00) but constraint requires min 0.20

**Analysis**: Condition always satisfied by axis bounds but gates are blocked. Binding conflicts: valence has negative weight (-0.50) but constraint requires min=0.20; future_expectancy has negative weight (-0.70) but constraint requires min=0.15; threat has negative weight (-0.10) but constraint requires min=0.30; engagement has negative weight (-0.20) but constraint requires min=0.35; self_evaluation has positive weight (+0.10) but constraint limits it to max=-0.25; self_control has negative weight (-0.30) but constraint requires min=0.20; inhibitory_control has negative weight (0.00) but constraint requires min=0.20. Blocked gates: future_expectancy <= -0.2, valence <= -0.2

**Recommendation**: Always satisfies threshold within constraints.

##### 🧠 contempt <= 0.20 ✅ ALWAYS

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.00]
- **Threshold**: 0.20
- **Status**: always
- **Slack**: feasibility +0.200; always +0.200
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 3.00 | **Required Raw Sum**: 0.60

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.19 | 0.30 | 0.00 | 0.67 | 18.62% |
| Global | raw | 0.00 | 0.24 | 0.32 | 0.00 | 0.67 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.19 | 0.30 | 0.00 | 0.67 | 18.62% |
| In mood regime (no mood constraints) | raw | 0.00 | 0.24 | 0.32 | 0.00 | 0.67 | N/A |
- **Observed max (global, final)**: 0.67
- **Observed max (mood-regime, final)**: 0.67

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.60 | [0.20, -0.25] | 0.20 | -0.120 | ⚠️ negative_weight_high_min |
| agency_control | +0.80 | [0.20, 0.10] | 0.10 | 0.080 | ⚠️ positive_weight_low_max |
| engagement | -0.20 | [0.35, 1.00] | 0.35 | -0.070 | ⚠️ negative_weight_high_min |
| self_evaluation | +0.20 | [-1.00, -0.25] | -0.25 | -0.050 | ⚠️ positive_weight_low_max |
| affiliation | -0.50 | [0.10, 0.35] | 0.10 | -0.050 | ⚠️ negative_weight_high_min |
| inhibitory_control | -0.30 | [0.20, 0.25] | 0.20 | -0.060 | ⚠️ negative_weight_high_min |
| self_control | -0.40 | [0.20, 1.00] | 0.20 | -0.080 | ⚠️ negative_weight_high_min |

**Gates** ❌:
- ❌ `valence <= -0.10` - Constraint min (0.2) > gate requirement (-0.1) | **Observed Fail Rate**: 54.55%
- ❌ `agency_control >= 0.20` - Constraint max (0.1) < gate requirement (0.2) | **Observed Fail Rate**: 59.21%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **valence**: Has negative weight (-0.60) but constraint requires min 0.20
- ⚠️ **agency_control**: Has positive weight (+0.80) but constraint limits max to 0.10
- ⚠️ **engagement**: Has negative weight (-0.20) but constraint requires min 0.35
- ⚠️ **self_evaluation**: Has positive weight (+0.20) but constraint limits max to -0.25
- ⚠️ **affiliation**: Has negative weight (-0.50) but constraint requires min 0.10
- ⚠️ **inhibitory_control**: Has negative weight (-0.30) but constraint requires min 0.20
- ⚠️ **self_control**: Has negative weight (-0.40) but constraint requires min 0.20

**Analysis**: Condition always satisfied by axis bounds but gates are blocked. Binding conflicts: valence has negative weight (-0.60) but constraint requires min=0.20; agency_control has positive weight (+0.80) but constraint limits it to max=0.10; engagement has negative weight (-0.20) but constraint requires min=0.35; self_evaluation has positive weight (+0.20) but constraint limits it to max=-0.25; affiliation has negative weight (-0.50) but constraint requires min=0.10; inhibitory_control has negative weight (-0.30) but constraint requires min=0.20; self_control has negative weight (-0.40) but constraint requires min=0.20. Blocked gates: valence <= -0.10, agency_control >= 0.20

**Recommendation**: Always satisfies threshold within constraints.

##### 🧠 disgust <= 0.20 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.35]
- **Threshold**: 0.20
- **Status**: sometimes
- **Slack**: feasibility +0.200; always -0.149
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 3.60 | **Required Raw Sum**: 0.72

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.29 | 0.41 | 0.00 | 0.73 | 14.47% |
| Global | raw | 0.03 | 0.34 | 0.42 | 0.00 | 0.73 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.29 | 0.41 | 0.00 | 0.73 | 14.47% |
| In mood regime (no mood constraints) | raw | 0.03 | 0.34 | 0.42 | 0.00 | 0.73 | N/A |
- **Observed max (global, final)**: 0.73
- **Observed max (mood-regime, final)**: 0.73

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.90 | [0.20, -0.25] | 0.20 | -0.180 | ⚠️ negative_weight_high_min |
| arousal | +0.40 | [0.35, 0.35] | 0.35 | 0.140 | ⚠️ positive_weight_low_max |
| engagement | -0.30 | [0.35, 1.00] | 0.35 | -0.105 | ⚠️ negative_weight_high_min |
| contamination_salience | +1.00 | [0.20, 1.00] | 1.00 | 1.000 | — |
| disgust_sensitivity | +0.50 | [0.10, 1.00] | 1.00 | 0.500 | — |
| inhibitory_control | -0.20 | [0.20, 0.25] | 0.20 | -0.040 | ⚠️ negative_weight_high_min |
| self_control | -0.30 | [0.20, 1.00] | 0.20 | -0.060 | ⚠️ negative_weight_high_min |

**Gates** ❌:
- ❌ `valence <= -0.25` - Constraint min (0.2) > gate requirement (-0.25) | **Observed Fail Rate**: 62.12%
- ✅ `contamination_salience >= 0.20` - Satisfiable | **Observed Fail Rate**: 58.94%
- ✅ `disgust_sensitivity >= 0.10` - Satisfiable | **Observed Fail Rate**: 9.22%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **valence**: Has negative weight (-0.90) but constraint requires min 0.20
- ⚠️ **arousal**: Has positive weight (+0.40) but constraint limits max to 0.35
- ⚠️ **engagement**: Has negative weight (-0.30) but constraint requires min 0.35
- ⚠️ **inhibitory_control**: Has negative weight (-0.20) but constraint requires min 0.20
- ⚠️ **self_control**: Has negative weight (-0.30) but constraint requires min 0.20

**Analysis**: Threshold 0.2 is achievable but gates are blocked. Binding conflicts: valence has negative weight (-0.90) but constraint requires min=0.20; arousal has positive weight (+0.40) but constraint limits it to max=0.35; engagement has negative weight (-0.30) but constraint requires min=0.35; inhibitory_control has negative weight (-0.20) but constraint requires min=0.20; self_control has negative weight (-0.30) but constraint requires min=0.20. Blocked gates: valence <= -0.25

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 shame <= 0.50 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.63]
- **Threshold**: 0.50
- **Status**: sometimes
- **Slack**: feasibility +0.500; always -0.128
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 2.90 | **Required Raw Sum**: 1.45

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.44 | 0.53 | 0.00 | 0.88 | 37.87% |
| Global | raw | 0.12 | 0.45 | 0.53 | 0.00 | 0.88 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.44 | 0.53 | 0.00 | 0.88 | 37.87% |
| In mood regime (no mood constraints) | raw | 0.12 | 0.45 | 0.53 | 0.00 | 0.88 | N/A |
- **Observed max (global, final)**: 0.88
- **Observed max (mood-regime, final)**: 0.88

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| self_evaluation | -1.00 | [-1.00, -0.25] | -1.00 | 1.000 | — |
| agency_control | -0.50 | [0.20, 0.10] | 0.20 | -0.100 | ⚠️ negative_weight_high_min |
| valence | -0.40 | [0.20, -0.25] | 0.20 | -0.080 | ⚠️ negative_weight_high_min |
| evaluation_pressure | +0.30 | [0.30, 1.00] | 1.00 | 0.300 | — |
| evaluation_sensitivity | +0.40 | [0.10, 1.00] | 1.00 | 0.400 | — |
| self_control | +0.30 | [0.20, 1.00] | 1.00 | 0.300 | — |
| inhibitory_control | +0.00 | [0.20, 0.25] | 0.20 | 0.000 | ⚠️ negative_weight_high_min |

**Gates** ✅:
- ✅ `self_evaluation <= -0.25` - Satisfiable | **Observed Fail Rate**: 62.13%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **agency_control**: Has negative weight (-0.50) but constraint requires min 0.20
- ⚠️ **valence**: Has negative weight (-0.40) but constraint requires min 0.20
- ⚠️ **inhibitory_control**: Has negative weight (0.00) but constraint requires min 0.20

**Analysis**: Threshold 0.5 is achievable (min: 0.000). Binding conflicts: agency_control has negative weight (-0.50) but constraint requires min=0.20; valence has negative weight (-0.40) but constraint requires min=0.20; inhibitory_control has negative weight (0.00) but constraint requires min=0.20

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 humiliation <= 0.25 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.66]
- **Threshold**: 0.25
- **Status**: sometimes
- **Slack**: feasibility +0.250; always -0.409
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 4.50 | **Required Raw Sum**: 1.13

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.26 | 0.42 | 0.00 | 0.79 | 12.38% |
| Global | raw | 0.10 | 0.40 | 0.47 | 0.00 | 0.79 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.26 | 0.42 | 0.00 | 0.79 | 12.38% |
| In mood regime (no mood constraints) | raw | 0.10 | 0.40 | 0.47 | 0.00 | 0.79 | N/A |
- **Observed max (global, final)**: 0.79
- **Observed max (mood-regime, final)**: 0.79

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| self_evaluation | -1.00 | [-1.00, -0.25] | -1.00 | 1.000 | — |
| arousal | +0.70 | [0.35, 0.35] | 0.35 | 0.245 | ⚠️ positive_weight_low_max |
| valence | -0.50 | [0.20, -0.25] | 0.20 | -0.100 | ⚠️ negative_weight_high_min |
| agency_control | -0.40 | [0.20, 0.10] | 0.20 | -0.080 | ⚠️ negative_weight_high_min |
| evaluation_pressure | +1.00 | [0.30, 1.00] | 1.00 | 1.000 | — |
| evaluation_sensitivity | +0.50 | [0.10, 1.00] | 1.00 | 0.500 | — |
| self_control | +0.40 | [0.20, 1.00] | 1.00 | 0.400 | — |
| inhibitory_control | +0.00 | [0.20, 0.25] | 0.20 | 0.000 | ⚠️ negative_weight_high_min |

**Gates** ✅:
- ✅ `self_evaluation <= -0.25` - Satisfiable | **Observed Fail Rate**: 62.13%
- ✅ `evaluation_pressure >= 0.30` - Satisfiable | **Observed Fail Rate**: 63.63%
- ✅ `evaluation_sensitivity >= 0.10` - Satisfiable | **Observed Fail Rate**: 10.04%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **arousal**: Has positive weight (+0.70) but constraint limits max to 0.35
- ⚠️ **valence**: Has negative weight (-0.50) but constraint requires min 0.20
- ⚠️ **agency_control**: Has negative weight (-0.40) but constraint requires min 0.20
- ⚠️ **inhibitory_control**: Has negative weight (0.00) but constraint requires min 0.20

**Analysis**: Threshold 0.25 is achievable (min: 0.000). Binding conflicts: arousal has positive weight (+0.70) but constraint limits it to max=0.35; valence has negative weight (-0.50) but constraint requires min=0.20; agency_control has negative weight (-0.40) but constraint requires min=0.20; inhibitory_control has negative weight (0.00) but constraint requires min=0.20

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 fear <= 0.25 ✅ ALWAYS

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.07]
- **Threshold**: 0.25
- **Status**: always
- **Slack**: feasibility +0.250; always +0.182
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 3.70 | **Required Raw Sum**: 0.92

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.25 | 0.35 | 0.00 | 0.84 | 35.33% |
| Global | raw | 0.00 | 0.28 | 0.36 | 0.00 | 0.84 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.25 | 0.35 | 0.00 | 0.84 | 35.33% |
| In mood regime (no mood constraints) | raw | 0.00 | 0.28 | 0.36 | 0.00 | 0.84 | N/A |
- **Observed max (global, final)**: 0.84
- **Observed max (mood-regime, final)**: 0.84

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| threat | +1.00 | [0.30, 0.35] | 0.35 | 0.350 | ⚠️ positive_weight_low_max |
| arousal | +0.80 | [0.35, 0.35] | 0.35 | 0.280 | ⚠️ positive_weight_low_max |
| agency_control | -0.70 | [0.20, 0.10] | 0.20 | -0.140 | ⚠️ negative_weight_high_min |
| valence | -0.60 | [0.20, -0.25] | 0.20 | -0.120 | ⚠️ negative_weight_high_min |
| inhibitory_control | -0.30 | [0.20, 0.25] | 0.20 | -0.060 | ⚠️ negative_weight_high_min |
| self_control | -0.30 | [0.20, 1.00] | 0.20 | -0.060 | ⚠️ negative_weight_high_min |

**Gates** ✅:
- ✅ `threat >= 0.30` - Satisfiable | **Observed Fail Rate**: 64.67%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **threat**: Has positive weight (+1.00) but constraint limits max to 0.35
- ⚠️ **arousal**: Has positive weight (+0.80) but constraint limits max to 0.35
- ⚠️ **agency_control**: Has negative weight (-0.70) but constraint requires min 0.20
- ⚠️ **valence**: Has negative weight (-0.60) but constraint requires min 0.20
- ⚠️ **inhibitory_control**: Has negative weight (-0.30) but constraint requires min 0.20
- ⚠️ **self_control**: Has negative weight (-0.30) but constraint requires min 0.20

**Analysis**: Condition always satisfied (max: 0.068 <= 0.250). Binding conflicts: threat has positive weight (+1.00) but constraint limits it to max=0.35; arousal has positive weight (+0.80) but constraint limits it to max=0.35; agency_control has negative weight (-0.70) but constraint requires min=0.20; valence has negative weight (-0.60) but constraint requires min=0.20; inhibitory_control has negative weight (-0.30) but constraint requires min=0.20; self_control has negative weight (-0.30) but constraint requires min=0.20

**Recommendation**: Always satisfies threshold within constraints.

##### 🧠 anxiety <= 0.30 ✅ ALWAYS

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.15]
- **Threshold**: 0.30
- **Status**: always
- **Slack**: feasibility +0.300; always +0.149
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 4.70 | **Required Raw Sum**: 1.41

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.00 | 0.22 | 0.00 | 0.68 | 10.32% |
| Global | raw | 0.00 | 0.22 | 0.29 | 0.00 | 0.68 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.00 | 0.22 | 0.00 | 0.68 | 10.32% |
| In mood regime (no mood constraints) | raw | 0.00 | 0.22 | 0.29 | 0.00 | 0.68 | N/A |
- **Observed max (global, final)**: 0.68
- **Observed max (mood-regime, final)**: 0.68

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| threat | +0.80 | [0.30, 0.35] | 0.35 | 0.280 | ⚠️ positive_weight_low_max |
| future_expectancy | -0.60 | [0.15, -0.20] | 0.15 | -0.090 | ⚠️ negative_weight_high_min |
| temporal_orientation | +0.50 | [-1.00, 1.00] | 1.00 | 0.500 | — |
| agency_control | -0.60 | [0.20, 0.10] | 0.20 | -0.120 | ⚠️ negative_weight_high_min |
| arousal | +0.40 | [0.35, 0.35] | 0.35 | 0.140 | ⚠️ positive_weight_low_max |
| valence | -0.40 | [0.20, -0.25] | 0.20 | -0.080 | ⚠️ negative_weight_high_min |
| inhibitory_control | -0.30 | [0.20, 0.25] | 0.20 | -0.060 | ⚠️ negative_weight_high_min |
| self_control | -0.30 | [0.20, 1.00] | 0.20 | -0.060 | ⚠️ negative_weight_high_min |
| uncertainty | +0.80 | [0.15, 0.25] | 0.25 | 0.200 | ⚠️ positive_weight_low_max |

**Gates** ✅:
- ✅ `threat >= 0.20` - Satisfiable | **Observed Fail Rate**: 59.92%
- ✅ `agency_control <= 0.20` - Satisfiable | **Observed Fail Rate**: 40.30%
- ✅ `uncertainty >= 0.15` - Satisfiable | **Observed Fail Rate**: 58.32%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **threat**: Has positive weight (+0.80) but constraint limits max to 0.35
- ⚠️ **future_expectancy**: Has negative weight (-0.60) but constraint requires min 0.15
- ⚠️ **agency_control**: Has negative weight (-0.60) but constraint requires min 0.20
- ⚠️ **arousal**: Has positive weight (+0.40) but constraint limits max to 0.35
- ⚠️ **valence**: Has negative weight (-0.40) but constraint requires min 0.20
- ⚠️ **inhibitory_control**: Has negative weight (-0.30) but constraint requires min 0.20
- ⚠️ **self_control**: Has negative weight (-0.30) but constraint requires min 0.20
- ⚠️ **uncertainty**: Has positive weight (+0.80) but constraint limits max to 0.25

**Analysis**: Condition always satisfied (max: 0.151 <= 0.300). Binding conflicts: threat has positive weight (+0.80) but constraint limits it to max=0.35; future_expectancy has negative weight (-0.60) but constraint requires min=0.15; agency_control has negative weight (-0.60) but constraint requires min=0.20; arousal has positive weight (+0.40) but constraint limits it to max=0.35; valence has negative weight (-0.40) but constraint requires min=0.20; inhibitory_control has negative weight (-0.30) but constraint requires min=0.20; self_control has negative weight (-0.30) but constraint requires min=0.20; uncertainty has positive weight (+0.80) but constraint limits it to max=0.25

**Recommendation**: Always satisfies threshold within constraints.

##### 🧠 hypervigilance <= 0.25 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.42]
- **Threshold**: 0.25
- **Status**: sometimes
- **Slack**: feasibility +0.250; always -0.170
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 3.30 | **Required Raw Sum**: 0.83

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.28 | 0.41 | 0.00 | 0.76 | 14.49% |
| Global | raw | 0.03 | 0.35 | 0.44 | 0.00 | 0.76 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.28 | 0.41 | 0.00 | 0.76 | 14.49% |
| In mood regime (no mood constraints) | raw | 0.03 | 0.35 | 0.44 | 0.00 | 0.76 | N/A |
- **Observed max (global, final)**: 0.76
- **Observed max (mood-regime, final)**: 0.76

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| threat | +0.90 | [0.30, 0.35] | 0.35 | 0.315 | ⚠️ positive_weight_low_max |
| arousal | +0.80 | [0.35, 0.35] | 0.35 | 0.280 | ⚠️ positive_weight_low_max |
| engagement | +0.50 | [0.35, 1.00] | 1.00 | 0.500 | — |
| valence | -0.30 | [0.20, -0.25] | 0.20 | -0.060 | ⚠️ negative_weight_high_min |
| inhibitory_control | +0.20 | [0.20, 0.25] | 0.25 | 0.050 | ⚠️ positive_weight_low_max |
| self_control | +0.20 | [0.20, 1.00] | 1.00 | 0.200 | — |
| uncertainty | +0.40 | [0.15, 0.25] | 0.25 | 0.100 | ⚠️ positive_weight_low_max |

**Gates** ✅:
- ✅ `threat >= 0.30` - Satisfiable | **Observed Fail Rate**: 64.67%
- ✅ `arousal >= 0.20` - Satisfiable | **Observed Fail Rate**: 59.76%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **threat**: Has positive weight (+0.90) but constraint limits max to 0.35
- ⚠️ **arousal**: Has positive weight (+0.80) but constraint limits max to 0.35
- ⚠️ **valence**: Has negative weight (-0.30) but constraint requires min 0.20
- ⚠️ **inhibitory_control**: Has positive weight (+0.20) but constraint limits max to 0.25
- ⚠️ **uncertainty**: Has positive weight (+0.40) but constraint limits max to 0.25

**Analysis**: Threshold 0.25 is achievable (min: 0.000). Binding conflicts: threat has positive weight (+0.90) but constraint limits it to max=0.35; arousal has positive weight (+0.80) but constraint limits it to max=0.35; valence has negative weight (-0.30) but constraint requires min=0.20; inhibitory_control has positive weight (+0.20) but constraint limits it to max=0.25; uncertainty has positive weight (+0.40) but constraint limits it to max=0.25

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 rage <= 0.25 ✅ ALWAYS

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.01]
- **Threshold**: 0.25
- **Status**: always
- **Slack**: feasibility +0.250; always +0.240
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 4.65 | **Required Raw Sum**: 1.16

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.12 | 0.25 | 0.00 | 0.66 | 16.25% |
| Global | raw | 0.00 | 0.22 | 0.29 | 0.00 | 0.66 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.12 | 0.25 | 0.00 | 0.66 | 16.25% |
| In mood regime (no mood constraints) | raw | 0.00 | 0.22 | 0.29 | 0.00 | 0.66 | N/A |
- **Observed max (global, final)**: 0.66
- **Observed max (mood-regime, final)**: 0.66

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.85 | [0.20, -0.25] | 0.20 | -0.170 | ⚠️ negative_weight_high_min |
| arousal | +0.95 | [0.35, 0.35] | 0.35 | 0.332 | ⚠️ positive_weight_low_max |
| agency_control | +0.75 | [0.20, 0.10] | 0.10 | 0.075 | ⚠️ positive_weight_low_max |
| threat | +0.35 | [0.30, 0.35] | 0.35 | 0.122 | ⚠️ positive_weight_low_max |
| affiliation | -0.35 | [0.10, 0.35] | 0.10 | -0.035 | ⚠️ negative_weight_high_min |
| inhibitory_control | -0.75 | [0.20, 0.25] | 0.20 | -0.150 | ⚠️ negative_weight_high_min |
| self_control | -0.65 | [0.20, 1.00] | 0.20 | -0.130 | ⚠️ negative_weight_high_min |

**Gates** ❌:
- ❌ `valence <= -0.20` - Constraint min (0.2) > gate requirement (-0.2) | **Observed Fail Rate**: 59.88%
- ✅ `arousal >= 0.20` - Satisfiable | **Observed Fail Rate**: 59.76%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **valence**: Has negative weight (-0.85) but constraint requires min 0.20
- ⚠️ **arousal**: Has positive weight (+0.95) but constraint limits max to 0.35
- ⚠️ **agency_control**: Has positive weight (+0.75) but constraint limits max to 0.10
- ⚠️ **threat**: Has positive weight (+0.35) but constraint limits max to 0.35
- ⚠️ **affiliation**: Has negative weight (-0.35) but constraint requires min 0.10
- ⚠️ **inhibitory_control**: Has negative weight (-0.75) but constraint requires min 0.20
- ⚠️ **self_control**: Has negative weight (-0.65) but constraint requires min 0.20

**Analysis**: Condition always satisfied by axis bounds but gates are blocked. Binding conflicts: valence has negative weight (-0.85) but constraint requires min=0.20; arousal has positive weight (+0.95) but constraint limits it to max=0.35; agency_control has positive weight (+0.75) but constraint limits it to max=0.10; threat has positive weight (+0.35) but constraint limits it to max=0.35; affiliation has negative weight (-0.35) but constraint requires min=0.10; inhibitory_control has negative weight (-0.75) but constraint requires min=0.20; self_control has negative weight (-0.65) but constraint requires min=0.20. Blocked gates: valence <= -0.20

**Recommendation**: Always satisfies threshold within constraints.

##### 🧠 wrath <= 0.25 ✅ ALWAYS

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.04]
- **Threshold**: 0.25
- **Status**: always
- **Slack**: feasibility +0.250; always +0.209
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 4.25 | **Required Raw Sum**: 1.06

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.59 | 1.49% |
| Global | raw | 0.00 | 0.22 | 0.30 | 0.00 | 0.63 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.59 | 1.49% |
| In mood regime (no mood constraints) | raw | 0.00 | 0.22 | 0.30 | 0.00 | 0.63 | N/A |
- **Observed max (global, final)**: 0.59
- **Observed max (mood-regime, final)**: 0.59

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.75 | [0.20, -0.25] | 0.20 | -0.150 | ⚠️ negative_weight_high_min |
| arousal | +1.00 | [0.35, 0.35] | 0.35 | 0.350 | ⚠️ positive_weight_low_max |
| inhibitory_control | -0.90 | [0.20, 0.25] | 0.20 | -0.180 | ⚠️ negative_weight_high_min |
| self_control | -0.60 | [0.20, 1.00] | 0.20 | -0.120 | ⚠️ negative_weight_high_min |
| agency_control | +0.35 | [0.20, 0.10] | 0.10 | 0.035 | ⚠️ positive_weight_low_max |
| threat | +0.10 | [0.30, 0.35] | 0.35 | 0.035 | ⚠️ positive_weight_low_max |
| affiliation | -0.20 | [0.10, 0.35] | 0.10 | -0.020 | ⚠️ negative_weight_high_min |
| engagement | +0.25 | [0.35, 1.00] | 1.00 | 0.250 | — |
| self_evaluation | +0.10 | [-1.00, -0.25] | -0.25 | -0.025 | ⚠️ positive_weight_low_max |

**Gates** ❌:
- ❌ `valence <= -0.15` - Constraint min (0.2) > gate requirement (-0.15) | **Observed Fail Rate**: 57.27%
- ✅ `arousal >= 0.35` - Satisfiable | **Observed Fail Rate**: 67.18%
- ✅ `inhibitory_control <= 0.25` - Satisfiable | **Observed Fail Rate**: 37.11%
- ✅ `threat <= 0.70` - Satisfiable | **Observed Fail Rate**: 14.20%
- ✅ `agency_control >= -0.20` - Satisfiable | **Observed Fail Rate**: 38.82%
- ✅ `engagement >= 0.05` - Satisfiable | **Observed Fail Rate**: 52.15%
- ✅ `affiliation <= 0.35` - Satisfiable | **Observed Fail Rate**: 32.04%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **valence**: Has negative weight (-0.75) but constraint requires min 0.20
- ⚠️ **arousal**: Has positive weight (+1.00) but constraint limits max to 0.35
- ⚠️ **inhibitory_control**: Has negative weight (-0.90) but constraint requires min 0.20
- ⚠️ **self_control**: Has negative weight (-0.60) but constraint requires min 0.20
- ⚠️ **agency_control**: Has positive weight (+0.35) but constraint limits max to 0.10
- ⚠️ **threat**: Has positive weight (+0.10) but constraint limits max to 0.35
- ⚠️ **affiliation**: Has negative weight (-0.20) but constraint requires min 0.10
- ⚠️ **self_evaluation**: Has positive weight (+0.10) but constraint limits max to -0.25

**Analysis**: Condition always satisfied by axis bounds but gates are blocked. Binding conflicts: valence has negative weight (-0.75) but constraint requires min=0.20; arousal has positive weight (+1.00) but constraint limits it to max=0.35; inhibitory_control has negative weight (-0.90) but constraint requires min=0.20; self_control has negative weight (-0.60) but constraint requires min=0.20; agency_control has positive weight (+0.35) but constraint limits it to max=0.10; threat has positive weight (+0.10) but constraint limits it to max=0.35; affiliation has negative weight (-0.20) but constraint requires min=0.10; self_evaluation has positive weight (+0.10) but constraint limits it to max=-0.25. Blocked gates: valence <= -0.15

**Recommendation**: Always satisfies threshold within constraints.

##### 🧠 protest_anger <= 0.35 ✅ ALWAYS

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.32]
- **Threshold**: 0.35
- **Status**: always
- **Slack**: feasibility +0.350; always +0.028
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 3.90 | **Required Raw Sum**: 1.36

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.68 | 0.85% |
| Global | raw | 0.00 | 0.27 | 0.34 | 0.00 | 0.68 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.68 | 0.85% |
| In mood regime (no mood constraints) | raw | 0.00 | 0.27 | 0.34 | 0.00 | 0.68 | N/A |
- **Observed max (global, final)**: 0.68
- **Observed max (mood-regime, final)**: 0.68

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.60 | [0.20, -0.25] | 0.20 | -0.120 | ⚠️ negative_weight_high_min |
| threat | +0.55 | [0.30, 0.35] | 0.35 | 0.193 | ⚠️ positive_weight_low_max |
| engagement | +0.80 | [0.35, 1.00] | 1.00 | 0.800 | — |
| affiliation | +0.70 | [0.10, 0.35] | 0.35 | 0.245 | ⚠️ positive_weight_low_max |
| agency_control | +0.30 | [0.20, 0.10] | 0.10 | 0.030 | ⚠️ positive_weight_low_max |
| arousal | +0.55 | [0.35, 0.35] | 0.35 | 0.193 | ⚠️ positive_weight_low_max |
| self_evaluation | +0.05 | [-1.00, -0.25] | -0.25 | -0.013 | ⚠️ positive_weight_low_max |
| future_expectancy | +0.05 | [0.15, -0.20] | -0.20 | -0.010 | ⚠️ positive_weight_low_max |
| inhibitory_control | -0.15 | [0.20, 0.25] | 0.20 | -0.030 | ⚠️ negative_weight_high_min |
| self_control | -0.15 | [0.20, 1.00] | 0.20 | -0.030 | ⚠️ negative_weight_high_min |

**Gates** ❌:
- ❌ `valence <= -0.10` - Constraint min (0.2) > gate requirement (-0.1) | **Observed Fail Rate**: 54.55%
- ✅ `engagement >= 0.20` - Satisfiable | **Observed Fail Rate**: 59.71%
- ✅ `threat >= 0.10` - Satisfiable | **Observed Fail Rate**: 54.90%
- ✅ `affiliation >= 0.10` - Satisfiable | **Observed Fail Rate**: 54.38%
- ✅ `arousal >= 0.10` - Satisfiable | **Observed Fail Rate**: 54.94%
- ✅ `agency_control >= 0.05` - Satisfiable | **Observed Fail Rate**: 51.34%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **valence**: Has negative weight (-0.60) but constraint requires min 0.20
- ⚠️ **threat**: Has positive weight (+0.55) but constraint limits max to 0.35
- ⚠️ **affiliation**: Has positive weight (+0.70) but constraint limits max to 0.35
- ⚠️ **agency_control**: Has positive weight (+0.30) but constraint limits max to 0.10
- ⚠️ **arousal**: Has positive weight (+0.55) but constraint limits max to 0.35
- ⚠️ **self_evaluation**: Has positive weight (+0.05) but constraint limits max to -0.25
- ⚠️ **future_expectancy**: Has positive weight (+0.05) but constraint limits max to -0.20
- ⚠️ **inhibitory_control**: Has negative weight (-0.15) but constraint requires min 0.20
- ⚠️ **self_control**: Has negative weight (-0.15) but constraint requires min 0.20

**Analysis**: Condition always satisfied by axis bounds but gates are blocked. Binding conflicts: valence has negative weight (-0.60) but constraint requires min=0.20; threat has positive weight (+0.55) but constraint limits it to max=0.35; affiliation has positive weight (+0.70) but constraint limits it to max=0.35; agency_control has positive weight (+0.30) but constraint limits it to max=0.10; arousal has positive weight (+0.55) but constraint limits it to max=0.35; self_evaluation has positive weight (+0.05) but constraint limits it to max=-0.25; future_expectancy has positive weight (+0.05) but constraint limits it to max=-0.20; inhibitory_control has negative weight (-0.15) but constraint requires min=0.20; self_control has negative weight (-0.15) but constraint requires min=0.20. Blocked gates: valence <= -0.10

**Recommendation**: Always satisfies threshold within constraints.

##### 🧠 moral_outrage <= 0.35 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.48]
- **Threshold**: 0.35
- **Status**: sometimes
- **Slack**: feasibility +0.350; always -0.133
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 4.75 | **Required Raw Sum**: 1.66

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.67 | 0.45% |
| Global | raw | 0.11 | 0.34 | 0.40 | 0.00 | 0.67 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.67 | 0.45% |
| In mood regime (no mood constraints) | raw | 0.11 | 0.34 | 0.40 | 0.00 | 0.67 | N/A |
- **Observed max (global, final)**: 0.67
- **Observed max (mood-regime, final)**: 0.67

**Gate Compatibility (mood regime)**: ✅ compatible

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.55 | [0.20, -0.25] | 0.20 | -0.110 | ⚠️ negative_weight_high_min |
| threat | +0.35 | [0.30, 0.35] | 0.35 | 0.122 | ⚠️ positive_weight_low_max |
| engagement | +0.85 | [0.35, 1.00] | 1.00 | 0.850 | — |
| affiliation | +0.55 | [0.10, 0.35] | 0.35 | 0.193 | ⚠️ positive_weight_low_max |
| agency_control | +0.45 | [0.20, 0.10] | 0.10 | 0.045 | ⚠️ positive_weight_low_max |
| arousal | +0.25 | [0.35, 0.35] | 0.35 | 0.087 | ⚠️ positive_weight_low_max |
| future_expectancy | +0.15 | [0.15, -0.20] | -0.20 | -0.030 | ⚠️ positive_weight_low_max |
| self_evaluation | +0.10 | [-1.00, -0.25] | -0.25 | -0.025 | ⚠️ positive_weight_low_max |
| harm_aversion | +0.30 | [0.10, 1.00] | 1.00 | 0.300 | — |
| affective_empathy | +0.20 | [-1.00, 1.00] | 1.00 | 0.200 | — |
| cognitive_empathy | +0.10 | [-1.00, 1.00] | 1.00 | 0.100 | — |
| inhibitory_control | +0.45 | [0.20, 0.25] | 0.25 | 0.113 | ⚠️ positive_weight_low_max |
| self_control | +0.45 | [0.20, 1.00] | 1.00 | 0.450 | — |

**Gates** ❌:
- ❌ `valence <= -0.05` - Constraint min (0.2) > gate requirement (-0.05) | **Observed Fail Rate**: 51.91%
- ✅ `engagement >= 0.25` - Satisfiable | **Observed Fail Rate**: 62.23%
- ✅ `threat >= 0.10` - Satisfiable | **Observed Fail Rate**: 54.90%
- ✅ `affiliation >= 0.10` - Satisfiable | **Observed Fail Rate**: 54.38%
- ❌ `agency_control >= 0.15` - Constraint max (0.1) < gate requirement (0.15) | **Observed Fail Rate**: 56.74%
- ✅ `inhibitory_control >= 0.20` - Satisfiable | **Observed Fail Rate**: 59.66%
- ✅ `self_control >= 0.20` - Satisfiable | **Observed Fail Rate**: 19.55%
- ✅ `harm_aversion >= 0.10` - Satisfiable | **Observed Fail Rate**: 10.10%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **valence**: Has negative weight (-0.55) but constraint requires min 0.20
- ⚠️ **threat**: Has positive weight (+0.35) but constraint limits max to 0.35
- ⚠️ **affiliation**: Has positive weight (+0.55) but constraint limits max to 0.35
- ⚠️ **agency_control**: Has positive weight (+0.45) but constraint limits max to 0.10
- ⚠️ **arousal**: Has positive weight (+0.25) but constraint limits max to 0.35
- ⚠️ **future_expectancy**: Has positive weight (+0.15) but constraint limits max to -0.20
- ⚠️ **self_evaluation**: Has positive weight (+0.10) but constraint limits max to -0.25
- ⚠️ **inhibitory_control**: Has positive weight (+0.45) but constraint limits max to 0.25

**Analysis**: Threshold 0.35 is achievable but gates are blocked. Binding conflicts: valence has negative weight (-0.55) but constraint requires min=0.20; threat has positive weight (+0.35) but constraint limits it to max=0.35; affiliation has positive weight (+0.55) but constraint limits it to max=0.35; agency_control has positive weight (+0.45) but constraint limits it to max=0.10; arousal has positive weight (+0.25) but constraint limits it to max=0.35; future_expectancy has positive weight (+0.15) but constraint limits it to max=-0.20; self_evaluation has positive weight (+0.10) but constraint limits it to max=-0.25; inhibitory_control has positive weight (+0.45) but constraint limits it to max=0.25. Blocked gates: valence <= -0.05, agency_control >= 0.15

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

#### Distribution Analysis
- **Compound Node**: Aggregated from 25 leaf conditions (18 top-level conditions; 25 when OR blocks expanded)
- **Highest Avg Violation**: 0.54 (from `emotions.admiration >= 0.6`)
- **Highest P90 Violation**: 0.65
- **Highest P95 Violation**: 0.74
- **Highest P99 Violation**: 0.90
- **Interpretation**: Worst violator: emotions.admiration >= 0.6

#### Ceiling Analysis
- **Compound Node**: Contains multiple conditions
- **Status**: No ceiling effects detected in leaf conditions
- **Insight**: All thresholds appear achievable based on observed values

#### Near-Miss Analysis
- **Compound Node**: Contains 25 leaf conditions
- **Most Tunable Condition**: `emotions.inspiration >= 0.25`
- **Near-Miss Rate**: 3.46% (epsilon: 0.05)
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

## Recommendations

### Recommendation 1: Prototype axis sign conflict

- **Type**: axis_sign_conflict
- **Severity**: high
- **Confidence**: high
- **Clause Pass-Rate Impact**: +12.25 pp
- **Why**: Prototype-linked clause is a top-3 impact choke. Axis sign conflicts indicate regime constraints oppose prototype weights. Conflicts: valence (positive_weight_low_max), self_evaluation (positive_weight_low_max), arousal (positive_weight_low_max), affiliation (positive_weight_low_max).
- **Evidence**:
  - Axis conflict (positive_weight_low_max): valence weight +0.60, regime [0.20, -0.25], lostRawSum 0.75, lostIntensity 0.39: 0.75/1 (0.39) | Population: mood-regime (N=10.000)
  - Axis conflict (positive_weight_low_max): self_evaluation weight +0.30, regime [-1.00, -0.25], lostRawSum 0.38, lostIntensity 0.20: 0.38/1 (0.20) | Population: mood-regime (N=10.000)
  - Axis conflict (positive_weight_low_max): arousal weight +0.20, regime [0.35, 0.35], lostRawSum 0.13, lostIntensity 0.07: 0.13/1 (0.07) | Population: mood-regime (N=10.000)
  - Pass | gate: 139/2046 (6.79%) | Population: gate-pass (mood-regime) (N=2046)
  - Mean value | gate: 0.32/1 (0.32) | Population: gate-pass (mood-regime) (N=2046)
  - Clause threshold: 0.60/1 (0.60) | Population: mood-regime (N=10.000)
- **Actions**:
  - CONFLICT: Expression requires low Valence (<= -5), but admiration weight opposes the constraint (weight: 0.60). Expression requires low Self Evaluation (<= -25), but admiration weight opposes the constraint (weight: 0.30).
  - 
  - == OPTION A: Keep emotion, adjust regime ==
  -   - Remove or relax: moodAxes.valence <= -5, moodAxes.valence <= -5, moodAxes.valence <= -15, moodAxes.valence <= -20, moodAxes.valence <= -10, moodAxes.valence <= -25, moodAxes.valence <= -20, moodAxes.valence <= -15, moodAxes.valence <= -10, moodAxes.valence <= -5, moodAxes.valence >= 20, moodAxes.self_evaluation <= -25, moodAxes.arousal >= -30, moodAxes.arousal >= -40, moodAxes.arousal >= 20, moodAxes.arousal >= 20, moodAxes.arousal >= 35, moodAxes.arousal >= 10, moodAxes.arousal <= 35, moodAxes.affiliation >= 10, moodAxes.affiliation >= 10, moodAxes.affiliation <= 35
  -   - Trade-off: Expression may trigger in wider range of mood states
  - 
  - == OPTION B: Keep regime, change emotion ==
  -   - Or: Adjust admiration's Valence/Self Evaluation weight toward 0 or compatible sign
  -   - Trade-off: Expression will use different emotional signature
- **Predicted Effect**: Choose Option A or B based on your design intent.
- **Related Clauses**: [var:emotions.admiration:>=:0.6](#clause-var-emotions-admiration-0-6)

### Recommendation 2: Threshold too high for observed distribution

- **Type**: prototype_mismatch
- **Severity**: medium
- **Confidence**: high
- **Clause Pass-Rate Impact**: +12.25 pp
- **Why**: Prototype-linked clause is a top-3 impact choke. Pass|gate and mean value trail the clause threshold.
- **Evidence**:
  - Pass | gate: 139/2046 (6.79%) | Population: gate-pass (mood-regime) (N=2046)
  - Mean value | gate: 0.32/1 (0.32) | Population: gate-pass (mood-regime) (N=2046)
  - Clause threshold: 0.60/1 (0.60) | Population: mood-regime (N=10.000)
- **Actions**:
  - Lower the prototype threshold or rebalance weights to raise values.
- **Predicted Effect**: Reduce mismatch to improve trigger rate and stability.
- **Related Clauses**: [var:emotions.admiration:>=:0.6](#clause-var-emotions-admiration-0-6)

### Recommendation 3: Prototype gate suppresses emotion in this regime

- **Type**: prototype_mismatch
- **Severity**: low
- **Confidence**: high
- **Clause Pass-Rate Impact**: +0.04 pp
- **Why**: Prototype-linked clause is a top-3 impact choke. Lost-pass rate exceeds 25%.
- **Evidence**:
  - Gate fail rate: 9674/10000 (96.74%) | Population: mood-regime (N=10.000)
  - Lost passes | raw >= threshold: 1587/1871 (84.82%) | Population: mood-regime (N=1871)
  - Most failed gate: engagement >= 0.25: 6223/9674 (64.33%) | Population: mood-regime (N=9674)
- **Actions**:
  - Tighten mood-regime axis constraints that allow gate-clamped states.
  - Loosen prototype gate thresholds or swap the prototype.
- **Predicted Effect**: Reduce mismatch to improve trigger rate and stability.
- **Related Clauses**: [var:emotions.aesthetic_appreciation:>=:0.25](#clause-var-emotions-aesthetic-appreciation-0-25)


---

## Global Expression Sensitivity Analysis

This section shows how adjusting thresholds affects the **entire expression trigger rate**, not just individual clause pass rates.
This is the key metric for tuning—it answers "What actually happens to the expression if I change this?"
**Baseline (full sample)**: 1.03% | **Baseline (stored contexts)**: 1.03%
**Population**: full (N=10.000; predicate: all; hash: 1a309bea).
### 🎯 Global Expression Sensitivity: emotions.admiration >= [threshold]


> **Note**: This shows how the threshold change affects the WHOLE EXPRESSION trigger rate, not just the clause.

| Threshold | Trigger Rate | Change | Samples |
|-----------|--------------|--------|---------|
| 0.40 | 4.62% | +3.59 pp (×4.5) | 10.000 |
| 0.45 | 3.50% | +2.47 pp (×3.4) | 10.000 |
| 0.50 | 2.46% | +1.43 pp (×2.4) | 10.000 |
| 0.55 | 1.59% | +0.56 pp (×1.5) | 10.000 |
| **0.60** | **1.03%** | **baseline (stored contexts)** | 10.000 |
| 0.65 | 0.62% | -0.41 pp (×0.6) | 10.000 |
| 0.70 | 0.27% | -0.76 pp (×0.3) | 10.000 |
| 0.75 | 0.12% | -0.91 pp (×0.1) | 10.000 |
| 0.80 | 0.05% | -0.98 pp (×0.0) | 10.000 |

#### Threshold Suggestions for Higher Trigger Rates

| Target Rate | Suggested Threshold | Achieved Rate | Δ Threshold |
|-------------|---------------------|---------------|-------------|
| 1.00% | 0.60 | 1.03% | +0.000 |

**Interpretation**: To achieve ~1.00% pass rate, adjust threshold by +0.000 to 0.60.

### 🎯 Global Expression Sensitivity: emotions.quiet_absorption >= [threshold]


> **Note**: This shows how the threshold change affects the WHOLE EXPRESSION trigger rate, not just the clause.

| Threshold | Trigger Rate | Change | Samples |
|-----------|--------------|--------|---------|
| 0.05 | 1.03% | +0.00 pp | 10.000 |
| 0.10 | 1.03% | +0.00 pp | 10.000 |
| 0.15 | 1.03% | +0.00 pp | 10.000 |
| 0.20 | 1.03% | +0.00 pp | 10.000 |
| **0.25** | **1.03%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 1.03% | +0.00 pp | 10.000 |
| 0.35 | 1.03% | +0.00 pp | 10.000 |
| 0.40 | 1.03% | +0.00 pp | 10.000 |
| 0.45 | 1.03% | +0.00 pp | 10.000 |

#### Threshold Suggestions for Higher Trigger Rates

| Target Rate | Suggested Threshold | Achieved Rate | Δ Threshold |
|-------------|---------------------|---------------|-------------|
| 1.00% | 0.25 | 1.03% | +0.000 |

**Interpretation**: To achieve ~1.00% pass rate, adjust threshold by +0.000 to 0.25.

### 🎯 Global Expression Sensitivity: emotions.aesthetic_appreciation >= [threshold]


> **Note**: This shows how the threshold change affects the WHOLE EXPRESSION trigger rate, not just the clause.

| Threshold | Trigger Rate | Change | Samples |
|-----------|--------------|--------|---------|
| 0.05 | 1.03% | +0.00 pp | 10.000 |
| 0.10 | 1.03% | +0.00 pp | 10.000 |
| 0.15 | 1.03% | +0.00 pp | 10.000 |
| 0.20 | 1.03% | +0.00 pp | 10.000 |
| **0.25** | **1.03%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 1.03% | +0.00 pp | 10.000 |
| 0.35 | 1.03% | +0.00 pp | 10.000 |
| 0.40 | 1.03% | +0.00 pp | 10.000 |
| 0.45 | 1.02% | -0.01 pp | 10.000 |

#### Threshold Suggestions for Higher Trigger Rates

| Target Rate | Suggested Threshold | Achieved Rate | Δ Threshold |
|-------------|---------------------|---------------|-------------|
| 1.00% | 0.25 | 1.03% | +0.000 |

**Interpretation**: To achieve ~1.00% pass rate, adjust threshold by +0.000 to 0.25.
## Marginal Clause Pass-Rate Sweep

This sweep shows how adjusting thresholds changes marginal clause pass rates across stored contexts.
It does **not** estimate overall expression trigger rate.
**Population**: full (N=10.000; predicate: all; hash: 1a309bea).
### Marginal Clause Pass-Rate Sweep: emotions.admiration >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.40 | 7.01% | +5.62 pp (×5.0) | 10.000 |
| 0.45 | 5.09% | +3.70 pp (×3.7) | 10.000 |
| 0.50 | 3.43% | +2.04 pp (×2.5) | 10.000 |
| 0.55 | 2.24% | +0.85 pp (×1.6) | 10.000 |
| **0.60** | **1.39%** | **baseline (stored contexts)** | 10.000 |
| 0.65 | 0.85% | -0.54 pp (×0.6) | 10.000 |
| 0.70 | 0.36% | -1.03 pp (×0.3) | 10.000 |
| 0.75 | 0.16% | -1.23 pp (×0.1) | 10.000 |
| 0.80 | 0.06% | -1.33 pp (×0.0) | 10.000 |

#### Threshold Suggestions for Higher Pass Rates

| Target Rate | Suggested Threshold | Achieved Rate | Δ Threshold |
|-------------|---------------------|---------------|-------------|
| 1.00% | 0.60 | 1.39% | +0.000 |
| 5.00% | 0.45 | 5.09% | -0.150 |

**Interpretation**: To achieve ~1.00% pass rate, adjust threshold by +0.000 to 0.60.

### Marginal Clause Pass-Rate Sweep: emotions.aesthetic_appreciation >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 3.26% | +0.42 pp | 10.000 |
| 0.10 | 3.25% | +0.41 pp | 10.000 |
| 0.15 | 3.21% | +0.37 pp | 10.000 |
| 0.20 | 3.11% | +0.27 pp | 10.000 |
| **0.25** | **2.84%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 2.47% | -0.37 pp | 10.000 |
| 0.35 | 2.02% | -0.82 pp | 10.000 |
| 0.40 | 1.45% | -1.39 pp (×0.5) | 10.000 |
| 0.45 | 0.96% | -1.88 pp (×0.3) | 10.000 |

#### Threshold Suggestions for Higher Pass Rates

| Target Rate | Suggested Threshold | Achieved Rate | Δ Threshold |
|-------------|---------------------|---------------|-------------|
| 1.00% | 0.25 | 2.84% | +0.000 |

**Interpretation**: To achieve ~1.00% pass rate, adjust threshold by +0.000 to 0.25.

### Marginal Clause Pass-Rate Sweep: emotions.quiet_absorption >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 1.87% | +0.37 pp | 10.000 |
| 0.10 | 1.84% | +0.34 pp | 10.000 |
| 0.15 | 1.80% | +0.30 pp | 10.000 |
| 0.20 | 1.68% | +0.18 pp | 10.000 |
| **0.25** | **1.50%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 1.28% | -0.22 pp | 10.000 |
| 0.35 | 0.93% | -0.57 pp (×0.6) | 10.000 |
| 0.40 | 0.57% | -0.93 pp (×0.4) | 10.000 |
| 0.45 | 0.36% | -1.14 pp (×0.2) | 10.000 |

#### Threshold Suggestions for Higher Pass Rates

| Target Rate | Suggested Threshold | Achieved Rate | Δ Threshold |
|-------------|---------------------|---------------|-------------|
| 1.00% | 0.25 | 1.50% | +0.000 |

**Interpretation**: To achieve ~1.00% pass rate, adjust threshold by +0.000 to 0.25.

### Marginal Clause Pass-Rate Sweep: emotions.interest >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.15 | 34.92% | +12.10 pp (×1.5) | 10.000 |
| 0.20 | 32.29% | +9.47 pp | 10.000 |
| 0.25 | 29.61% | +6.79 pp | 10.000 |
| 0.30 | 26.22% | +3.40 pp | 10.000 |
| **0.35** | **22.82%** | **baseline (stored contexts)** | 10.000 |
| 0.40 | 18.89% | -3.93 pp | 10.000 |
| 0.45 | 15.07% | -7.75 pp (×0.7) | 10.000 |
| 0.50 | 11.74% | -11.08 pp (×0.5) | 10.000 |
| 0.55 | 8.88% | -13.94 pp (×0.4) | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.inspiration >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 14.09% | +5.95 pp (×1.7) | 10.000 |
| 0.10 | 12.80% | +4.66 pp (×1.6) | 10.000 |
| 0.15 | 11.32% | +3.18 pp | 10.000 |
| 0.20 | 9.94% | +1.80 pp | 10.000 |
| **0.25** | **8.14%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 6.49% | -1.65 pp | 10.000 |
| 0.35 | 4.88% | -3.26 pp (×0.6) | 10.000 |
| 0.40 | 3.64% | -4.50 pp (×0.4) | 10.000 |
| 0.45 | 2.65% | -5.49 pp (×0.3) | 10.000 |

#### Threshold Suggestions for Higher Pass Rates

| Target Rate | Suggested Threshold | Achieved Rate | Δ Threshold |
|-------------|---------------------|---------------|-------------|
| 1.00% | 0.25 | 8.14% | +0.000 |
| 5.00% | 0.25 | 8.14% | +0.000 |
| 10.00% | 0.15 | 11.32% | -0.100 |

**Interpretation**: To achieve ~1.00% pass rate, adjust threshold by +0.000 to 0.25.

### Marginal Clause Pass-Rate Sweep: emotions.envy <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.10 | 87.06% | -9.70 pp | 10.000 |
| 0.15 | 89.91% | -6.85 pp | 10.000 |
| 0.20 | 92.16% | -4.60 pp | 10.000 |
| 0.25 | 94.70% | -2.06 pp | 10.000 |
| **0.30** | **96.76%** | **baseline (stored contexts)** | 10.000 |
| 0.35 | 98.17% | +1.41 pp | 10.000 |
| 0.40 | 99.08% | +2.32 pp | 10.000 |
| 0.45 | 99.57% | +2.81 pp | 10.000 |
| 0.50 | 99.84% | +3.08 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.jealousy <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 96.58% | -1.42 pp | 10.000 |
| 0.10 | 96.87% | -1.13 pp | 10.000 |
| 0.15 | 97.21% | -0.79 pp | 10.000 |
| 0.20 | 97.62% | -0.38 pp | 10.000 |
| **0.25** | **98.00%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 98.57% | +0.57 pp | 10.000 |
| 0.35 | 99.07% | +1.07 pp | 10.000 |
| 0.40 | 99.47% | +1.47 pp | 10.000 |
| 0.45 | 99.68% | +1.68 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.resentment <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.10 | 98.12% | -0.40 pp | 10.000 |
| 0.15 | 98.17% | -0.35 pp | 10.000 |
| 0.20 | 98.25% | -0.27 pp | 10.000 |
| 0.25 | 98.38% | -0.14 pp | 10.000 |
| **0.30** | **98.52%** | **baseline (stored contexts)** | 10.000 |
| 0.35 | 98.73% | +0.21 pp | 10.000 |
| 0.40 | 98.99% | +0.47 pp | 10.000 |
| 0.45 | 99.35% | +0.83 pp | 10.000 |
| 0.50 | 99.68% | +1.16 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.cynicism <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.20 | 87.61% | -8.61 pp | 10.000 |
| 0.25 | 89.39% | -6.83 pp | 10.000 |
| 0.30 | 91.67% | -4.55 pp | 10.000 |
| 0.35 | 94.02% | -2.20 pp | 10.000 |
| **0.40** | **96.22%** | **baseline (stored contexts)** | 10.000 |
| 0.45 | 97.85% | +1.63 pp | 10.000 |
| 0.50 | 98.84% | +2.62 pp | 10.000 |
| 0.55 | 99.49% | +3.27 pp | 10.000 |
| 0.60 | 99.79% | +3.57 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.contempt <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.00 | 82.96% | -7.35 pp | 10.000 |
| 0.05 | 84.53% | -5.78 pp | 10.000 |
| 0.10 | 86.16% | -4.15 pp | 10.000 |
| 0.15 | 88.08% | -2.23 pp | 10.000 |
| **0.20** | **90.31%** | **baseline (stored contexts)** | 10.000 |
| 0.25 | 92.60% | +2.29 pp | 10.000 |
| 0.30 | 95.01% | +4.70 pp | 10.000 |
| 0.35 | 96.76% | +6.45 pp | 10.000 |
| 0.40 | 98.12% | +7.81 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.disgust <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.00 | 85.59% | -1.60 pp | 10.000 |
| 0.05 | 85.63% | -1.56 pp | 10.000 |
| 0.10 | 85.87% | -1.32 pp | 10.000 |
| 0.15 | 86.31% | -0.88 pp | 10.000 |
| **0.20** | **87.19%** | **baseline (stored contexts)** | 10.000 |
| 0.25 | 88.52% | +1.33 pp | 10.000 |
| 0.30 | 90.39% | +3.20 pp | 10.000 |
| 0.35 | 92.41% | +5.22 pp | 10.000 |
| 0.40 | 94.70% | +7.51 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.shame <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.30 | 78.67% | -15.09 pp | 10.000 |
| 0.35 | 82.58% | -11.18 pp | 10.000 |
| 0.40 | 86.41% | -7.35 pp | 10.000 |
| 0.45 | 90.41% | -3.35 pp | 10.000 |
| **0.50** | **93.76%** | **baseline (stored contexts)** | 10.000 |
| 0.55 | 96.07% | +2.31 pp | 10.000 |
| 0.60 | 97.69% | +3.93 pp | 10.000 |
| 0.65 | 98.93% | +5.17 pp | 10.000 |
| 0.70 | 99.55% | +5.79 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.humiliation <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 87.68% | -2.07 pp | 10.000 |
| 0.10 | 87.76% | -1.99 pp | 10.000 |
| 0.15 | 88.10% | -1.65 pp | 10.000 |
| 0.20 | 88.78% | -0.97 pp | 10.000 |
| **0.25** | **89.75%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 91.20% | +1.45 pp | 10.000 |
| 0.35 | 92.77% | +3.02 pp | 10.000 |
| 0.40 | 94.36% | +4.61 pp | 10.000 |
| 0.45 | 96.06% | +6.31 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.fear <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 77.08% | -12.88 pp | 10.000 |
| 0.10 | 80.43% | -9.53 pp | 10.000 |
| 0.15 | 83.68% | -6.28 pp | 10.000 |
| 0.20 | 87.03% | -2.93 pp | 10.000 |
| **0.25** | **89.96%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 92.38% | +2.42 pp | 10.000 |
| 0.35 | 94.83% | +4.87 pp | 10.000 |
| 0.40 | 96.62% | +6.66 pp | 10.000 |
| 0.45 | 97.94% | +7.98 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.anxiety <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.10 | 91.97% | -5.35 pp | 10.000 |
| 0.15 | 93.12% | -4.20 pp | 10.000 |
| 0.20 | 94.46% | -2.86 pp | 10.000 |
| 0.25 | 95.97% | -1.35 pp | 10.000 |
| **0.30** | **97.32%** | **baseline (stored contexts)** | 10.000 |
| 0.35 | 98.34% | +1.02 pp | 10.000 |
| 0.40 | 98.99% | +1.67 pp | 10.000 |
| 0.45 | 99.48% | +2.16 pp | 10.000 |
| 0.50 | 99.74% | +2.42 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.hypervigilance <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 85.90% | -3.35 pp | 10.000 |
| 0.10 | 86.34% | -2.91 pp | 10.000 |
| 0.15 | 86.82% | -2.43 pp | 10.000 |
| 0.20 | 87.93% | -1.32 pp | 10.000 |
| **0.25** | **89.25%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 90.92% | +1.67 pp | 10.000 |
| 0.35 | 92.79% | +3.54 pp | 10.000 |
| 0.40 | 94.50% | +5.25 pp | 10.000 |
| 0.45 | 96.14% | +6.89 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.rage <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 87.91% | -7.10 pp | 10.000 |
| 0.10 | 89.35% | -5.66 pp | 10.000 |
| 0.15 | 91.32% | -3.69 pp | 10.000 |
| 0.20 | 93.22% | -1.79 pp | 10.000 |
| **0.25** | **95.01%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 96.72% | +1.71 pp | 10.000 |
| 0.35 | 97.90% | +2.89 pp | 10.000 |
| 0.40 | 98.81% | +3.80 pp | 10.000 |
| 0.45 | 99.47% | +4.46 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.wrath <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 98.51% | -0.40 pp | 10.000 |
| 0.10 | 98.52% | -0.39 pp | 10.000 |
| 0.15 | 98.57% | -0.34 pp | 10.000 |
| 0.20 | 98.68% | -0.23 pp | 10.000 |
| **0.25** | **98.91%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 99.16% | +0.25 pp | 10.000 |
| 0.35 | 99.40% | +0.49 pp | 10.000 |
| 0.40 | 99.59% | +0.68 pp | 10.000 |
| 0.45 | 99.76% | +0.85 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.protest_anger <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.15 | 99.15% | -0.12 pp | 10.000 |
| 0.20 | 99.15% | -0.12 pp | 10.000 |
| 0.25 | 99.16% | -0.11 pp | 10.000 |
| 0.30 | 99.21% | -0.06 pp | 10.000 |
| **0.35** | **99.27%** | **baseline (stored contexts)** | 10.000 |
| 0.40 | 99.35% | +0.08 pp | 10.000 |
| 0.45 | 99.48% | +0.21 pp | 10.000 |
| 0.50 | 99.66% | +0.39 pp | 10.000 |
| 0.55 | 99.76% | +0.49 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.moral_outrage <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.15 | 99.55% | -0.03 pp | 10.000 |
| 0.20 | 99.55% | -0.03 pp | 10.000 |
| 0.25 | 99.55% | -0.03 pp | 10.000 |
| 0.30 | 99.55% | -0.03 pp | 10.000 |
| **0.35** | **99.58%** | **baseline (stored contexts)** | 10.000 |
| 0.40 | 99.63% | +0.05 pp | 10.000 |
| 0.45 | 99.70% | +0.12 pp | 10.000 |
| 0.50 | 99.78% | +0.20 pp | 10.000 |
| 0.55 | 99.87% | +0.29 pp | 10.000 |

## 🎯 Prototype Fit Analysis

Ranking of emotion prototypes by how well they fit this expression's mood regime.

> **[AXIS-ONLY FIT]** **[IN-REGIME]**
> *Computed from mood-regime axis constraints only (emotion clauses not enforced).*

**Population**: full (N=10.000; predicate: all; hash: 1a309bea).
| Rank | Prototype | Gate Pass | P(I≥t) | Conflict | Composite |
|------|-----------|-----------|--------|----------|-----------|
| 1 | **hypervigilance** | 0.00% | 0.00% | 0.00% | 0.35 |
| 2 | **embarrassment** | 0.00% | 0.00% | 0.00% | 0.35 |
| 3 | **guilt** | 0.00% | 0.00% | 0.00% | 0.35 |
| 4 | **regret** | 0.00% | 0.00% | 0.00% | 0.35 |
| 5 | **interest** | 0.00% | 0.00% | 5.88% | 0.34 |
| 6 | **unease** | 0.00% | 0.00% | 5.88% | 0.34 |
| 7 | **apprehension** | 0.00% | 0.00% | 5.88% | 0.34 |
| 8 | **courage** | 0.00% | 0.00% | 5.88% | 0.34 |
| 9 | **alarm** | 0.00% | 0.00% | 5.88% | 0.34 |
| 10 | **suspicion** | 0.00% | 0.00% | 5.88% | 0.34 |

### Top 3 Prototype Details

#### 1. hypervigilance

- **Intensity Distribution**: P50=0.00, P90=0.00, P95=0.00
- **Conflicting Axes**: None

#### 2. embarrassment

- **Intensity Distribution**: P50=0.00, P90=0.00, P95=0.00
- **Conflicting Axes**: None

#### 3. guilt

- **Intensity Distribution**: P50=0.00, P90=0.00, P95=0.00
- **Conflicting Axes**: None

---

## Non-Axis Clause Feasibility

> **[NON-AXIS ONLY]** **[IN-REGIME]**
> *Evaluates emotion/sexual/delta clauses within mood-regime using final values.*

**Population**: 10.000 in-regime samples analyzed

| Variable | Clause | Pass Rate | Max Value | Classification |
|----------|--------|-----------|-----------|----------------|
| `emotions.admiration` | >= 0.600 | 1.4% | 0.884 | ✅ OK |
| `emotions.aesthetic_appreciation` | >= 0.250 | 2.8% | 0.786 | ✅ OK |
| `emotions.quiet_absorption` | >= 0.250 | 1.5% | 0.640 | ✅ OK |
| `emotions.interest` | >= 0.350 | 22.8% | 0.959 | ✅ OK |
| `emotions.inspiration` | >= 0.250 | 8.1% | 0.817 | ✅ OK |
| `emotions.envy` | <= 0.300 | 96.8% | 0.618 | ✅ OK |
| `emotions.jealousy` | <= 0.250 | 98.0% | 0.644 | ✅ OK |
| `emotions.resentment` | <= 0.300 | 98.5% | 0.631 | ✅ OK |
| `emotions.cynicism` | <= 0.400 | 96.2% | 0.721 | ✅ OK |
| `emotions.contempt` | <= 0.200 | 90.3% | 0.673 | ✅ OK |
| `emotions.disgust` | <= 0.200 | 87.2% | 0.734 | ✅ OK |
| `emotions.shame` | <= 0.500 | 93.8% | 0.880 | ✅ OK |
| `emotions.humiliation` | <= 0.250 | 89.8% | 0.787 | ✅ OK |
| `emotions.fear` | <= 0.250 | 90.0% | 0.840 | ✅ OK |
| `emotions.anxiety` | <= 0.300 | 97.3% | 0.676 | ✅ OK |
| `emotions.hypervigilance` | <= 0.250 | 89.3% | 0.762 | ✅ OK |
| `emotions.rage` | <= 0.250 | 95.0% | 0.664 | ✅ OK |
| `emotions.wrath` | <= 0.250 | 98.9% | 0.589 | ✅ OK |
| `emotions.protest_anger` | <= 0.350 | 99.3% | 0.679 | ✅ OK |
| `emotions.moral_outrage` | <= 0.350 | 99.6% | 0.670 | ✅ OK |
| `emotions.admiration` | (emotions.admiration - previousEmotions.admiration) >= 0.120 | 15.5% | 0.884 | ✅ OK |
| `emotions.inspiration` | (emotions.inspiration - previousEmotions.inspiration) >= 0.100 | 11.8% | 0.813 | ✅ OK |
| `emotions.aesthetic_appreciation` | (emotions.aesthetic_appreciation - previousEmotions.aesthetic_appreciation) >= 0.100 | 3.2% | 0.786 | ✅ OK |
| `emotions.quiet_absorption` | (emotions.quiet_absorption - previousEmotions.quiet_absorption) >= 0.100 | 1.8% | 0.640 | ✅ OK |
| `emotions.interest` | (emotions.interest - previousEmotions.interest) >= 0.150 | 26.7% | 0.959 | ✅ OK |

## 🧭 Implied Prototype from Prerequisites

Analysis of which prototypes best match the expression's constraint pattern.

**Population**: full (N=10.000; predicate: all; hash: 1a309bea).

### Target Signature

| Axis | Direction | Importance |
|------|-----------|------------|
| arousal | ↑ High | 0.75 |
| valence | — Neutral | 0.86 |
| threat | ↑ High | 0.74 |
| uncertainty | ↑ High | 0.72 |
| future_expectancy | — Neutral | 0.84 |
| agency_control | ↑ High | 0.78 |
| affiliation | ↑ High | 0.69 |
| inhibitory_control | ↑ High | 0.74 |
| engagement | ↑ High | 0.59 |
| self_evaluation | ↓ Low | 0.56 |
| rumination | ↑ High | 0.55 |
| contamination_salience | ↑ High | 0.55 |
| disgust_sensitivity | ↑ High | 0.53 |
| evaluation_pressure | ↑ High | 0.57 |
| evaluation_sensitivity | ↑ High | 0.53 |
| self_control | ↑ High | 0.55 |
| harm_aversion | ↑ High | 0.53 |

### Top 5 by Cosine Similarity

| Rank | Prototype | Similarity | Gate Pass | Combined |
|------|-----------|------------|-----------|----------|
| 1 | **moral_outrage** | 0.64 | 0.00% | 0.38 |
| 2 | **courage** | 0.63 | 0.00% | 0.38 |
| 3 | **hypervigilance** | 0.60 | 0.00% | 0.36 |
| 4 | **embarrassment** | 0.50 | 0.00% | 0.30 |
| 5 | **protest_anger** | 0.49 | 0.00% | 0.29 |

### Top 5 by Gate Pass Rate

| Rank | Prototype | Gate Pass | Similarity | Combined |
|------|-----------|-----------|------------|----------|
| 1 | **calm** | 0.00% | -0.39 | -0.23 |
| 2 | **contentment** | 0.00% | -0.28 | -0.17 |
| 3 | **relief** | 0.00% | -0.40 | -0.24 |
| 4 | **release** | 0.00% | -0.27 | -0.16 |
| 5 | **confidence** | 0.00% | -0.04 | -0.02 |

### Top 5 by Combined Score

| Rank | Prototype | Combined | Similarity | Gate Pass |
|------|-----------|----------|------------|----------|
| 1 | **moral_outrage** | 0.38 | 0.64 | 0.00% |
| 2 | **courage** | 0.38 | 0.63 | 0.00% |
| 3 | **hypervigilance** | 0.36 | 0.60 | 0.00% |
| 4 | **embarrassment** | 0.30 | 0.50 | 0.00% |
| 5 | **protest_anger** | 0.29 | 0.49 | 0.00% |

---

## 🔍 Prototype Gap Detection

Analysis of prototype coverage in "prototype space".

**Population**: full (N=10.000; predicate: all; hash: 1a309bea).

### ✅ Good Coverage

**Nearest Distance**: 0.33 - within acceptable range.

**Distance Context**: Distance 0.33 is farther than 100% of prototype nearest-neighbor distances (z=3.59).

### k-Nearest Prototypes

| Rank | Prototype | Distance | Weight Dist | Gate Dist |
|------|-----------|----------|-------------|----------|
| 1 | **hypervigilance** | 0.33 | 0.47 | 0.00 |
| 2 | **moral_outrage** | 0.34 | 0.43 | 0.12 |
| 3 | **courage** | 0.34 | 0.46 | 0.06 |
| 4 | **embarrassment** | 0.36 | 0.51 | 0.00 |
| 5 | **apprehension** | 0.36 | 0.51 | 0.00 |

---

## Report Integrity Warnings
- I4_OBSERVED_EXCEEDS_THEORETICAL: Observed max final exceeds theoretical max for mood-regime population. [population=1a309bea; prototype=admiration; signal=final] examples: index 7, 14, 16, 27, 32
- I4_OBSERVED_EXCEEDS_THEORETICAL: Observed max final exceeds theoretical max for mood-regime population. [population=1a309bea; prototype=aesthetic_appreciation; signal=final] examples: index 76, 79, 146, 151, 197
- I4_OBSERVED_EXCEEDS_THEORETICAL: Observed max final exceeds theoretical max for mood-regime population. [population=1a309bea; prototype=quiet_absorption; signal=final] examples: index 16, 146, 191, 275, 354
- I4_OBSERVED_EXCEEDS_THEORETICAL: Observed max final exceeds theoretical max for mood-regime population. [population=1a309bea; prototype=interest; signal=final] examples: index 11, 14, 52, 56, 70
- I4_OBSERVED_EXCEEDS_THEORETICAL: Observed max final exceeds theoretical max for mood-regime population. [population=1a309bea; prototype=inspiration; signal=final] examples: index 11, 14, 27, 30, 52
- I4_OBSERVED_EXCEEDS_THEORETICAL: Observed max final exceeds theoretical max for mood-regime population. [population=1a309bea; prototype=envy; signal=final] examples: index 17, 57, 77, 80, 161
- I4_OBSERVED_EXCEEDS_THEORETICAL: Observed max final exceeds theoretical max for mood-regime population. [population=1a309bea; prototype=jealousy; signal=final] examples: index 11, 91, 154, 166, 206
- I4_OBSERVED_EXCEEDS_THEORETICAL: Observed max final exceeds theoretical max for mood-regime population. [population=1a309bea; prototype=resentment; signal=final] examples: index 4284, 4954, 5381, 9503
- I4_OBSERVED_EXCEEDS_THEORETICAL: Observed max final exceeds theoretical max for mood-regime population. [population=1a309bea; prototype=cynicism; signal=final] examples: index 1, 18, 24, 28, 35
- I4_OBSERVED_EXCEEDS_THEORETICAL: Observed max final exceeds theoretical max for mood-regime population. [population=1a309bea; prototype=contempt; signal=final] examples: index 1, 11, 18, 28, 38
- I4_OBSERVED_EXCEEDS_THEORETICAL: Observed max final exceeds theoretical max for mood-regime population. [population=1a309bea; prototype=disgust; signal=final] examples: index 8, 17, 48, 50, 57
- I4_OBSERVED_EXCEEDS_THEORETICAL: Observed max final exceeds theoretical max for mood-regime population. [population=1a309bea; prototype=shame; signal=final] examples: index 34, 128, 135, 250, 278
- I4_OBSERVED_EXCEEDS_THEORETICAL: Observed max final exceeds theoretical max for mood-regime population. [population=1a309bea; prototype=humiliation; signal=final] examples: index 250, 660, 725, 1090, 1601
- I4_OBSERVED_EXCEEDS_THEORETICAL: Observed max final exceeds theoretical max for mood-regime population. [population=1a309bea; prototype=fear; signal=final] examples: index 0, 11, 12, 17, 20
- I4_OBSERVED_EXCEEDS_THEORETICAL: Observed max final exceeds theoretical max for mood-regime population. [population=1a309bea; prototype=anxiety; signal=final] examples: index 0, 24, 35, 45, 52
- I4_OBSERVED_EXCEEDS_THEORETICAL: Observed max final exceeds theoretical max for mood-regime population. [population=1a309bea; prototype=hypervigilance; signal=final] examples: index 5, 11, 35, 52, 73
- I4_OBSERVED_EXCEEDS_THEORETICAL: Observed max final exceeds theoretical max for mood-regime population. [population=1a309bea; prototype=rage; signal=final] examples: index 4, 8, 18, 20, 24
- I4_OBSERVED_EXCEEDS_THEORETICAL: Observed max final exceeds theoretical max for mood-regime population. [population=1a309bea; prototype=wrath; signal=final] examples: index 4, 111, 217, 422, 437
- I4_OBSERVED_EXCEEDS_THEORETICAL: Observed max final exceeds theoretical max for mood-regime population. [population=1a309bea; prototype=protest_anger; signal=final] examples: index 11, 12, 64, 234, 328
- I4_OBSERVED_EXCEEDS_THEORETICAL: Observed max final exceeds theoretical max for mood-regime population. [population=1a309bea; prototype=moral_outrage; signal=final] examples: index 11, 28, 185, 739, 893

> **Impact (full sample)**: Gate/final mismatches can invalidate pass-rate and blocker metrics; treat threshold feasibility as provisional until resolved.

## Legend

### Global Metrics
- **Trigger Rate**: Probability (0-100%) that the expression evaluates to true across random samples
- **Confidence Interval**: 95% Wilson score interval indicating statistical certainty of the trigger rate
- **Sample Size**: Number of random state pairs generated for simulation
- **Rarity Categories**: impossible (0%), extremely_rare (<0.001%), rare (<0.05%), normal (<2%), frequent (>=2%)

### Per-Clause Metrics
- **Fail% global**: Percentage of samples where this specific clause evaluated to false (unconditional)
- **Fail% | mood-pass**: Percentage of samples where this clause evaluated to false within the mood regime
- **Gate pass (mood)**: Percentage of mood-regime samples where gates passed (emotion-threshold clauses only)
- **Gate clamp (mood)**: Percentage of mood-regime samples where gates failed and the final intensity was clamped to 0 (emotion-threshold clauses only)
- **Pass | gate (mood)**: Percentage of gate-pass samples that passed the threshold within the mood regime (emotion-threshold clauses only)
- **Pass | mood (mood)**: Percentage of mood-regime samples that passed the threshold (emotion-threshold clauses only)
- **Support**: Number of samples evaluated for this clause (evaluation count)
- **Clamp-trivial (regime)**: Clause is trivially satisfied because gates always clamp intensity to 0 in regime (<= or < thresholds only)
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
