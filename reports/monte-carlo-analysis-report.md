# Monte Carlo Analysis Report

**Expression**: comforted_vulnerability
**Generated**: 2026-01-25T17:00:09.995Z
**Distribution**: uniform
**Sample Size**: 100000
**Sampling Mode**: static - Prototype-gated sampling (emotions derived from mood axes; not independent)
**Gating model**: HARD (gate fail => final = 0)
**Regime Note**: Report includes global vs in-regime (mood-pass) statistics

> **Note**: Emotions are computed via prototype gates, so emotion variables are not independent of mood axes.

---

## Population Summary

- **Total samples**: 100.000 (in-regime 0; 0.00%)
- **Stored contexts**: 10.000 of 100.000 (in-regime 0; 0.00%; limit 10.000)
- **Mood regime**: Mood axis constraints derived from gates of emotion/sexual prototypes referenced in prerequisites.
> **Note**: Stored contexts are capped at 10.000, so sections labeled "Population: stored-*" may not match full-sample counts.


---

## Integrity Summary

- **Integrity warnings**: 1
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

**Trigger Rate**: 0.22% (95% CI: 0.20% - 0.25%)
**Rarity**: normal

Expression triggers occasionally (0.223%). Consider adjusting thresholds. Focus on "AND of 22 conditions" (99.8% last-mile failure).

---

## Independence Baseline Comparison

This section compares Monte Carlo results against naive probability estimates (assuming clause independence) to identify correlation effects. Deviations indicate clauses are not statistically independent.

| Metric | Value |
|--------|-------|
| Naive probability (product of pass rates) | 2.28e-7 |
| Expected hits per 100.000 samples | 0.02 |
| Actual hits | 223 |
| P(0 hits \| expected=0.02) | 97.75% |

### Interpretation

✅ **Expected Rare**: Expression is inherently rare (expected 0.02 hits). Zero hits is mathematically expected.

### Overconstrained Conjunction Warnings

> **Warning**: 3 emotion thresholds (trust, affection, release) each have <10% pass rate and are ANDed together. Joint probability: 0.0026%. Consider (2-of-3) rule or OR-softening.


> **Note**: 22 clause factors omitted for brevity.

---

## Sampling Coverage

**Sampling Mode**: static

### Summary by Domain

| Domain | Variables | Range Coverage | Bin Coverage | Tail Low | Tail High | Zero Rate Avg | Rating |
|--------|-----------|----------------|--------------|----------|-----------|---------------|--------|
| emotions | 25 | 79.23% | 84.00% | 87.77% | 2.80e-4% | 85.89% | good |
| previousEmotions | 8 | 83.40% | 88.75% | 81.82% | 6.25e-4% | 78.33% | good |

### Lowest Coverage Variables

| Variable | Range Coverage | Bin Coverage | Tail Low | Tail High | Rating |
|----------|----------------|--------------|----------|-----------|--------|
| emotions.hatred | 46.23% | 50.00% | 99.67% | 0.00% | partial |
| emotions.awkwardness | 63.73% | 70.00% | 98.08% | 0.00% | partial |
| emotions.wrath | 67.00% | 70.00% | 98.59% | 0.00% | partial |
| emotions.rage | 68.76% | 70.00% | 89.67% | 0.00% | partial |
| emotions.contempt | 71.80% | 80.00% | 86.52% | 0.00% | partial |

Notes:
- Range coverage is observed span divided by domain span.
- Bin coverage is occupancy across 10 equal-width bins.
- Tail coverage is the share of samples in the bottom/top 10.00% of the domain.
- Variables with unknown domain ranges are excluded from summaries.

### Coverage Conclusions

- emotions: sampling looks skewed/zero-inflated zeroRateAvg=85.89%; zero-heavy or gated distributions can mask threshold behavior.
- emotions: upper tail is effectively untested (top 10% has 0.0003% of samples). High-threshold feasibility results are not trustworthy here.
- previousEmotions: sampling looks skewed/zero-inflated zeroRateAvg=78.33%; zero-heavy or gated distributions can mask threshold behavior.
- previousEmotions: upper tail is effectively untested (top 10% has 0.0006% of samples). High-threshold feasibility results are not trustworthy here.
- emotions: observed range spans only 79% of the domain. This suggests ceilings/floors or gating; feasibility conclusions involving missing ranges are low-confidence.
- Across variables: 33 show near-zero upper-tail coverage; 13 show truncated range. Those regions are effectively unvalidated by current sampling.
- Do not trust feasibility estimates for prerequisites that target the upper end of a domain; the sampler is not generating those states often enough to test them.
- Worst range coverage: min=46%.
- Worst upper-tail coverage: min tailHigh=0.0000%.
- Worst lower-tail coverage: min tailLow=62.5200%.

---

## Ground-Truth Witnesses

These states were verified to trigger the expression during simulation.
Each witness represents a valid combination of mood, sexual state, and affect traits.

### Witness #1

**Computed Emotions (Current)**:
- affection: 0.553
- anxiety: 0.000
- awkwardness: 0.000
- calm: 0.569
- contempt: 0.000
- contentment: 0.527
- disgust: 0.000
- dissociation: 0.000
- embarrassment: 0.000
- fear: 0.000
- freeze: 0.000
- gratitude: 0.561
- hatred: 0.000
- hypervigilance: 0.000
- numbness: 0.000
- panic: 0.000
- rage: 0.000
- release: 0.465
- relief: 0.606
- shame: 0.000
- suspicion: 0.000
- terror: 0.000
- trust: 0.588
- trusting_surrender: 0.000
- wrath: 0.000

**Computed Emotions (Previous)**:
- affection: 0.000
- anxiety: 0.000
- awkwardness: 0.000
- calm: 0.000
- contempt: 0.000
- contentment: 0.000
- disgust: 0.353
- dissociation: 0.000
- embarrassment: 0.000
- fear: 0.168
- freeze: 0.000
- gratitude: 0.000
- hatred: 0.000
- hypervigilance: 0.000
- numbness: 0.000
- panic: 0.000
- rage: 0.000
- release: 0.000
- relief: 0.000
- shame: 0.000
- suspicion: 0.197
- terror: 0.000
- trust: 0.000
- trusting_surrender: 0.000
- wrath: 0.000

**Mood State (Current)**:
- valence: 51
- arousal: -55
- agency_control: -18
- threat: -77
- engagement: 85
- future_expectancy: -92
- self_evaluation: 89
- affiliation: 93

**Mood State (Previous)**:
- valence: -46
- arousal: -23
- agency_control: 9
- threat: 58
- engagement: -14
- future_expectancy: 92
- self_evaluation: -52
- affiliation: 77

**Sexual State (Current)**:
- sex_excitation: 24
- sex_inhibition: 63
- baseline_libido: 38

**Sexual State (Previous)**:
- sex_excitation: 93
- sex_inhibition: 69
- baseline_libido: 30

**Affect Traits**:
- affective_empathy: 70
- cognitive_empathy: 93
- harm_aversion: 0

### Witness #2

**Computed Emotions (Current)**:
- affection: 0.535
- anxiety: 0.000
- awkwardness: 0.000
- calm: 0.331
- contempt: 0.000
- contentment: 0.516
- disgust: 0.000
- dissociation: 0.000
- embarrassment: 0.000
- fear: 0.000
- freeze: 0.000
- gratitude: 0.560
- hatred: 0.000
- hypervigilance: 0.000
- numbness: 0.000
- panic: 0.000
- rage: 0.000
- release: 0.573
- relief: 0.633
- shame: 0.000
- suspicion: 0.000
- terror: 0.000
- trust: 0.604
- trusting_surrender: 0.000
- wrath: 0.000

**Computed Emotions (Previous)**:
- affection: 0.378
- anxiety: 0.000
- awkwardness: 0.000
- calm: 0.418
- contempt: 0.000
- contentment: 0.562
- disgust: 0.000
- dissociation: 0.000
- embarrassment: 0.000
- fear: 0.000
- freeze: 0.000
- gratitude: 0.516
- hatred: 0.000
- hypervigilance: 0.000
- numbness: 0.000
- panic: 0.000
- rage: 0.000
- release: 0.000
- relief: 0.462
- shame: 0.000
- suspicion: 0.000
- terror: 0.000
- trust: 0.453
- trusting_surrender: 0.000
- wrath: 0.000

**Mood State (Current)**:
- valence: 56
- arousal: 13
- agency_control: 81
- threat: -84
- engagement: 69
- future_expectancy: -85
- self_evaluation: -4
- affiliation: 83

**Mood State (Previous)**:
- valence: 78
- arousal: -64
- agency_control: 68
- threat: -23
- engagement: -14
- future_expectancy: -17
- self_evaluation: 56
- affiliation: 60

**Sexual State (Current)**:
- sex_excitation: 80
- sex_inhibition: 83
- baseline_libido: -37

**Sexual State (Previous)**:
- sex_excitation: 3
- sex_inhibition: 50
- baseline_libido: 10

**Affect Traits**:
- affective_empathy: 54
- cognitive_empathy: 68
- harm_aversion: 30

### Witness #3

**Computed Emotions (Current)**:
- affection: 0.476
- anxiety: 0.000
- awkwardness: 0.000
- calm: 0.342
- contempt: 0.000
- contentment: 0.461
- disgust: 0.000
- dissociation: 0.000
- embarrassment: 0.000
- fear: 0.000
- freeze: 0.000
- gratitude: 0.507
- hatred: 0.000
- hypervigilance: 0.000
- numbness: 0.000
- panic: 0.000
- rage: 0.000
- release: 0.450
- relief: 0.470
- shame: 0.000
- suspicion: 0.000
- terror: 0.000
- trust: 0.585
- trusting_surrender: 0.000
- wrath: 0.000

**Computed Emotions (Previous)**:
- affection: 0.472
- anxiety: 0.000
- awkwardness: 0.000
- calm: 0.202
- contempt: 0.000
- contentment: 0.000
- disgust: 0.000
- dissociation: 0.000
- embarrassment: 0.000
- fear: 0.000
- freeze: 0.000
- gratitude: 0.507
- hatred: 0.000
- hypervigilance: 0.000
- numbness: 0.000
- panic: 0.000
- rage: 0.000
- release: 0.040
- relief: 0.000
- shame: 0.000
- suspicion: 0.000
- terror: 0.000
- trust: 0.415
- trusting_surrender: 0.000
- wrath: 0.000

**Mood State (Current)**:
- valence: 57
- arousal: 8
- agency_control: 93
- threat: -76
- engagement: 55
- future_expectancy: 28
- self_evaluation: -34
- affiliation: 28

**Mood State (Previous)**:
- valence: 58
- arousal: -34
- agency_control: 2
- threat: -5
- engagement: 11
- future_expectancy: 43
- self_evaluation: 60
- affiliation: 91

**Sexual State (Current)**:
- sex_excitation: 34
- sex_inhibition: 43
- baseline_libido: -42

**Sexual State (Previous)**:
- sex_excitation: 50
- sex_inhibition: 23
- baseline_libido: 33

**Affect Traits**:
- affective_empathy: 86
- cognitive_empathy: 80
- harm_aversion: 1

### Witness #4

**Computed Emotions (Current)**:
- affection: 0.528
- anxiety: 0.000
- awkwardness: 0.000
- calm: 0.280
- contempt: 0.000
- contentment: 0.408
- disgust: 0.000
- dissociation: 0.000
- embarrassment: 0.000
- fear: 0.000
- freeze: 0.000
- gratitude: 0.482
- hatred: 0.000
- hypervigilance: 0.000
- numbness: 0.000
- panic: 0.000
- rage: 0.000
- release: 0.543
- relief: 0.535
- shame: 0.000
- suspicion: 0.000
- terror: 0.000
- trust: 0.599
- trusting_surrender: 0.000
- wrath: 0.000

**Computed Emotions (Previous)**:
- affection: 0.000
- anxiety: 0.451
- awkwardness: 0.000
- calm: 0.000
- contempt: 0.000
- contentment: 0.000
- disgust: 0.000
- dissociation: 0.000
- embarrassment: 0.000
- fear: 0.334
- freeze: 0.000
- gratitude: 0.000
- hatred: 0.000
- hypervigilance: 0.576
- numbness: 0.000
- panic: 0.000
- rage: 0.000
- release: 0.000
- relief: 0.000
- shame: 0.000
- suspicion: 0.406
- terror: 0.354
- trust: 0.000
- trusting_surrender: 0.000
- wrath: 0.000

**Mood State (Current)**:
- valence: 45
- arousal: 32
- agency_control: 80
- threat: -77
- engagement: 79
- future_expectancy: 64
- self_evaluation: 31
- affiliation: 78

**Mood State (Previous)**:
- valence: 37
- arousal: 59
- agency_control: -21
- threat: 97
- engagement: 72
- future_expectancy: -67
- self_evaluation: 61
- affiliation: 44

**Sexual State (Current)**:
- sex_excitation: 54
- sex_inhibition: 79
- baseline_libido: 9

**Sexual State (Previous)**:
- sex_excitation: 59
- sex_inhibition: 9
- baseline_libido: -4

**Affect Traits**:
- affective_empathy: 81
- cognitive_empathy: 5
- harm_aversion: 47

### Witness #5

**Computed Emotions (Current)**:
- affection: 0.464
- anxiety: 0.000
- awkwardness: 0.000
- calm: 0.692
- contempt: 0.000
- contentment: 0.506
- disgust: 0.000
- dissociation: 0.000
- embarrassment: 0.000
- fear: 0.000
- freeze: 0.000
- gratitude: 0.527
- hatred: 0.000
- hypervigilance: 0.000
- numbness: 0.000
- panic: 0.000
- rage: 0.000
- release: 0.459
- relief: 0.601
- shame: 0.000
- suspicion: 0.000
- terror: 0.000
- trust: 0.569
- trusting_surrender: 0.000
- wrath: 0.000

**Computed Emotions (Previous)**:
- affection: 0.000
- anxiety: 0.042
- awkwardness: 0.000
- calm: 0.000
- contempt: 0.000
- contentment: 0.000
- disgust: 0.000
- dissociation: 0.000
- embarrassment: 0.000
- fear: 0.020
- freeze: 0.000
- gratitude: 0.000
- hatred: 0.000
- hypervigilance: 0.000
- numbness: 0.000
- panic: 0.000
- rage: 0.000
- release: 0.000
- relief: 0.000
- shame: 0.000
- suspicion: 0.000
- terror: 0.000
- trust: 0.000
- trusting_surrender: 0.000
- wrath: 0.000

**Mood State (Current)**:
- valence: 22
- arousal: -71
- agency_control: 7
- threat: -77
- engagement: 66
- future_expectancy: 83
- self_evaluation: -94
- affiliation: 85

**Mood State (Previous)**:
- valence: -9
- arousal: -98
- agency_control: -43
- threat: 87
- engagement: 10
- future_expectancy: -39
- self_evaluation: 64
- affiliation: 33

**Sexual State (Current)**:
- sex_excitation: 25
- sex_inhibition: 15
- baseline_libido: -31

**Sexual State (Previous)**:
- sex_excitation: 8
- sex_inhibition: 25
- baseline_libido: 26

**Affect Traits**:
- affective_empathy: 23
- cognitive_empathy: 82
- harm_aversion: 1

---

## Blocker Analysis
Signal: final (gate-clamped intensity).
> **[FULL PREREQS]** **[GLOBAL]**
> *Computed from ALL prerequisites using post-gate (final) values.*

### Probability Funnel
- **Full sample**: 100.000
- **Mood-regime pass**: 0.00% (0 / 100000)
- **Prototype gate pass (`release`)**: N/A
- **Threshold pass | gate (`emotions.release >= 0.4`)**: N/A
- **Prototype gate pass (`trust`)**: N/A
- **Threshold pass | gate (`emotions.trust >= 0.55`)**: N/A
- **OR union pass | mood-pass (OR Block #1)**: 18.95% (18945 / 100000)
- **OR union pass | mood-pass (OR Block #2)**: 22.75% (22753 / 100000)
- **OR union pass | mood-pass (OR Block #3)**: 43.67% (43673 / 100000)
- **Final trigger**: 0.22% (223 / 100000)

### Blocker #1: `AND of 22 conditions`


**Condition**: Compound AND block
**Fail% global**: 99.78% (99777 / 100000)
**Fail% | mood-pass**: N/A
**Severity**: critical
**Redundant in regime**: N/A
**Clamp-trivial in regime**: N/A

#### Flags
[DECISIVE] [UPSTREAM]

#### Condition Breakdown

**Required Conditions (ALL must pass)**

| # | Condition | Fail% global | Fail% \| mood-pass | Support | Bound | Threshold | Gap | Tunable | Redundant (regime) | Clamp-trivial (regime) | Sole-Blocker Rate | Headroom (10%) | Gate pass (mood) | Gate clamp (mood) | Pass \| gate (mood) | Pass \| mood (mood) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `emotions.trust >= 0.55` | 98.80% | N/A | 100000 | 0.87 | 0.55 | -0.32 | low | N/A | N/A | 48.50% (N=433) | N/A | N/A | N/A | N/A | N/A |
| 2 | `emotions.affection >= 0.45` | 96.25% | N/A | 100000 | 0.82 | 0.45 | -0.37 | moderate | N/A | N/A | 12.89% (N=256) | N/A | N/A | N/A | N/A | N/A |
| 3 | `emotions.release >= 0.4` | 94.30% | N/A | 100000 | 0.84 | 0.40 | -0.44 | moderate | N/A | N/A | 64.88% (N=635) | N/A | N/A | N/A | N/A | N/A |
| 4 | `emotions.numbness <= 0.25` | 13.78% | N/A | 100000 | 0.00 | 0.25 | -0.25 | low | N/A | N/A | 0.00% (N=223) | N/A | N/A | N/A | N/A | N/A |
| 5 | `emotions.dissociation <= 0.2` | 2.07% | N/A | 100000 | 0.00 | 0.20 | -0.20 | low | N/A | N/A | 0.00% (N=223) | N/A | N/A | N/A | N/A | N/A |
| 6 | `emotions.panic <= 0.2` | 0.49% | N/A | 100000 | 0.00 | 0.20 | -0.20 | low | N/A | N/A | 0.00% (N=223) | N/A | N/A | N/A | N/A | N/A |
| 7 | `emotions.terror <= 0.25` | 5.71% | N/A | 100000 | 0.00 | 0.25 | -0.25 | moderate | N/A | N/A | 0.00% (N=223) | N/A | N/A | N/A | N/A | N/A |
| 8 | `emotions.fear <= 0.35` | 5.42% | N/A | 100000 | 0.00 | 0.35 | -0.35 | moderate | N/A | N/A | 0.00% (N=223) | N/A | N/A | N/A | N/A | N/A |
| 9 | `emotions.hypervigilance <= 0.3` | 9.09% | N/A | 100000 | 0.00 | 0.30 | -0.30 | moderate | N/A | N/A | 0.00% (N=223) | N/A | N/A | N/A | N/A | N/A |
| 10 | `emotions.freeze <= 0.25` | 0.67% | N/A | 100000 | 0.00 | 0.25 | -0.25 | low | N/A | N/A | 0.00% (N=223) | N/A | N/A | N/A | N/A | N/A |
| 11 | `emotions.suspicion <= 0.25` | 10.53% | N/A | 100000 | 0.00 | 0.25 | -0.25 | moderate | N/A | N/A | 0.00% (N=223) | N/A | N/A | N/A | N/A | N/A |
| 12 | `emotions.contempt <= 0.25` | 7.00% | N/A | 100000 | 0.00 | 0.25 | -0.25 | moderate | N/A | N/A | 0.00% (N=223) | N/A | N/A | N/A | N/A | N/A |
| 13 | `emotions.hatred <= 0.15` | 0.25% | N/A | 100000 | 0.00 | 0.15 | -0.15 | low | N/A | N/A | 0.00% (N=223) | N/A | N/A | N/A | N/A | N/A |
| 14 | `emotions.disgust <= 0.25` | 10.75% | N/A | 100000 | 0.00 | 0.25 | -0.25 | moderate | N/A | N/A | 0.00% (N=223) | N/A | N/A | N/A | N/A | N/A |
| 15 | `emotions.rage <= 0.25` | 4.80% | N/A | 100000 | 0.00 | 0.25 | -0.25 | moderate | N/A | N/A | 0.00% (N=223) | N/A | N/A | N/A | N/A | N/A |
| 16 | `emotions.wrath <= 0.25` | 1.11% | N/A | 100000 | 0.00 | 0.25 | -0.25 | low | N/A | N/A | 0.00% (N=223) | N/A | N/A | N/A | N/A | N/A |
| 17 | `emotions.shame <= 0.65` | 0.13% | N/A | 100000 | 0.00 | 0.65 | -0.65 | low | N/A | N/A | 0.00% (N=223) | N/A | N/A | N/A | N/A | N/A |
| 18 | `emotions.embarrassment <= 0.65` | 0.31% | N/A | 100000 | 0.00 | 0.65 | -0.65 | low | N/A | N/A | 0.00% (N=223) | N/A | N/A | N/A | N/A | N/A |
| 19 | `emotions.awkwardness <= 0.6` | 0.0010% | N/A | 100000 | 0.00 | 0.60 | -0.60 | low | N/A | N/A | 0.00% (N=223) | N/A | N/A | N/A | N/A | N/A |

**OR Block #1 (ANY ONE must pass)**

| # | Condition | Fail% global | Fail% \| mood-pass | Support | Bound | Threshold | Gap | Tunable | Redundant (regime) | Clamp-trivial (regime) | Sole-Blocker Rate | Headroom (10%) | Gate pass (mood) | Gate clamp (mood) | Pass \| gate (mood) | Pass \| mood (mood) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 20 | `emotions.gratitude >= 0.4` | 88.88% | N/A | 100000 | 0.89 | 0.40 | -0.49 | moderate | N/A | N/A | N/A (OR alt) | N/A | N/A | N/A | N/A | N/A |
| 21 | `emotions.relief >= 0.25` | 87.11% | N/A | 100000 | 0.93 | 0.25 | -0.68 | moderate | N/A | N/A | N/A (OR alt) | N/A | N/A | N/A | N/A | N/A |

**Combined OR Block**: 18.95% pass rate (Fail% global: 81.05% | Fail% \| mood-pass: N/A)

**OR Block #1 OR Alternative Coverage** (18945 total successes):

| Alternative | P(alt passes \| OR pass) | P(alt exclusively passes \| OR pass) | First-pass share (order-dependent) |
|------------|---------------------------|------------------------------------|------------------------------------|
| `emotions.relief >= 0.25` | 68.03% (12889/18945) | 41.32% (7828/18945) | 41.32% (7828/18945) |
| `emotions.gratitude >= 0.4` | 58.68% (11117/18945) | 31.97% (6056/18945) | 58.68% (11117/18945) |
*First-pass share is order-dependent; use pass/exclusive rates for order-independent attribution.*

**OR Block #1 OR Overlap (absolute rates)**:

| Population | Union (any pass) | Exclusive (exactly one) | Overlap (2+ pass) | Top overlap pair |
|------------|------------------|------------------------|-------------------|------------------|
| Global | 18.95% (18.945/100.000) | 13.88% (13.884/100.000) | 5.06% (5061/100.000) | `emotions.gratitude >= 0.4` + `emotions.relief >= 0.25` 5.06% (5061/100.000) |

**OR Block #2 (ANY ONE must pass)**

| # | Condition | Fail% global | Fail% \| mood-pass | Support | Bound | Threshold | Gap | Tunable | Redundant (regime) | Clamp-trivial (regime) | Sole-Blocker Rate | Headroom (10%) | Gate pass (mood) | Gate clamp (mood) | Pass \| gate (mood) | Pass \| mood (mood) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 22 | `emotions.calm >= 0.2` | 81.45% | N/A | 100000 | 0.88 | 0.20 | -0.68 | moderate | N/A | N/A | N/A (OR alt) | N/A | N/A | N/A | N/A | N/A |
| 23 | `emotions.contentment >= 0.2` | 88.85% | N/A | 100000 | 0.90 | 0.20 | -0.70 | moderate | N/A | N/A | N/A (OR alt) | N/A | N/A | N/A | N/A | N/A |
| 24 | `emotions.trusting_surrender >= 0.25` | 98.14% | N/A | 100000 | 0.73 | 0.25 | -0.48 | low | N/A | N/A | N/A (OR alt) | N/A | N/A | N/A | N/A | N/A |

**Combined OR Block**: 22.75% pass rate (Fail% global: 77.25% | Fail% \| mood-pass: N/A)

**OR Block #2 OR Alternative Coverage** (22753 total successes):

| Alternative | P(alt passes \| OR pass) | P(alt exclusively passes \| OR pass) | First-pass share (order-dependent) |
|------------|---------------------------|------------------------------------|------------------------------------|
| `emotions.calm >= 0.2` | 81.51% (18547/22753) | 46.56% (10594/22753) | 81.51% (18547/22753) |
| `emotions.contentment >= 0.2` | 49.00% (11150/22753) | 13.37% (3041/22753) | 14.20% (3230/22753) |
| `emotions.trusting_surrender >= 0.25` | 8.17% (1859/22753) | 4.29% (976/22753) | 4.29% (976/22753) |
*First-pass share is order-dependent; use pass/exclusive rates for order-independent attribution.*

**OR Block #2 OR Overlap (absolute rates)**:

| Population | Union (any pass) | Exclusive (exactly one) | Overlap (2+ pass) | Top overlap pair |
|------------|------------------|------------------------|-------------------|------------------|
| Global | 22.75% (22.753/100.000) | 14.61% (14.611/100.000) | 8.14% (8142/100.000) | `emotions.calm >= 0.2` + `emotions.contentment >= 0.2` 7.92% (7920/100.000) |

**OR Block #3 (ANY ONE must pass)**

| # | Condition | Fail% global | Fail% \| mood-pass | Support | Bound | Threshold | Gap | Tunable | Redundant (regime) | Clamp-trivial (regime) | Sole-Blocker Rate | Headroom (10%) | Gate pass (mood) | Gate clamp (mood) | Pass \| gate (mood) | Pass \| mood (mood) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
|  | **AND Group (2 conditions: 2 emotion thresholds)** |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 25 | `└─ previousEmotions.trust < 0.55` | 1.24% | N/A | 100000 | 0.00 | 0.55 | -0.55 | low | N/A | N/A | N/A (OR alt) | N/A | N/A | N/A | N/A | N/A |
| 26 | `└─ emotions.trust >= 0.55` | 98.80% | N/A | 100000 | 0.87 | 0.55 | -0.32 | low | N/A | N/A | N/A (OR alt) | N/A | N/A | N/A | N/A | N/A |
|  | **AND Group (2 conditions: 2 emotion thresholds)** |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 27 | `└─ previousEmotions.release < 0.4` | 5.66% | N/A | 100000 | 0.00 | 0.40 | -0.40 | moderate | N/A | N/A | N/A (OR alt) | N/A | N/A | N/A | N/A | N/A |
| 28 | `└─ emotions.release >= 0.4` | 94.30% | N/A | 100000 | 0.84 | 0.40 | -0.44 | moderate | N/A | N/A | N/A (OR alt) | N/A | N/A | N/A | N/A | N/A |
| 29 | `(emotions.relief - previousEmotions.relief) >= 0.1` | 85.45% | N/A | 100000 | - | - | - | low | N/A | N/A | N/A (OR alt) | N/A | N/A | N/A | N/A | N/A |
| 30 | `(emotions.gratitude - previousEmotions.gratitude) >= 0.1` | 76.53% | N/A | 100000 | - | - | - | low | N/A | N/A | N/A (OR alt) | N/A | N/A | N/A | N/A | N/A |
| 31 | `(previousEmotions.fear - emotions.fear) >= 0.15` | 86.09% | N/A | 100000 | - | - | - | low | N/A | N/A | N/A (OR alt) | N/A | N/A | N/A | N/A | N/A |
| 32 | `(previousEmotions.anxiety - emotions.anxiety) >= 0.15` | 93.56% | N/A | 100000 | - | - | - | low | N/A | N/A | N/A (OR alt) | N/A | N/A | N/A | N/A | N/A |
| 33 | `(previousEmotions.hypervigilance - emotions.hypervigilance) >= 0.15` | 88.50% | N/A | 100000 | - | - | - | low | N/A | N/A | N/A (OR alt) | N/A | N/A | N/A | N/A | N/A |
| 34 | `(emotions.trusting_surrender - previousEmotions.trusting_surrender) >= 0.1` | 97.53% | N/A | 100000 | - | - | - | low | N/A | N/A | N/A (OR alt) | N/A | N/A | N/A | N/A | N/A |

**Combined OR Block**: 43.67% pass rate (Fail% global: 56.33% | Fail% \| mood-pass: N/A)

**OR Block #3 OR Alternative Coverage** (43673 total successes):

| Alternative | P(alt passes \| OR pass) | P(alt exclusively passes \| OR pass) | First-pass share (order-dependent) |
|------------|---------------------------|------------------------------------|------------------------------------|
| `(emotions.gratitude - previousEmotions.gratitude) >= 0.1` | 53.74% (23471/43673) | 20.31% (8870/43673) | 28.53% (12461/43673) |
| `(emotions.relief - previousEmotions.relief) >= 0.1` | 33.31% (14548/43673) | 7.51% (3281/43673) | 28.87% (12608/43673) |
| `(previousEmotions.fear - emotions.fear) >= 0.15` | 31.85% (13910/43673) | 5.60% (2445/43673) | 18.52% (8088/43673) |
| `(previousEmotions.hypervigilance - emotions.hypervigilance) >= 0.15` | 26.34% (11505/43673) | 5.20% (2272/43673) | 5.21% (2277/43673) |
| `(previousEmotions.anxiety - emotions.anxiety) >= 0.15` | 14.76% (6444/43673) | 3.49% (1525/43673) | 3.99% (1742/43673) |
| `(AND: previousEmotions.release < 0.4 & emotions.release >= 0.4)` | 12.36% (5396/43673) | 5.23% (2284/43673) | 11.45% (5002/43673) |
| `(emotions.trusting_surrender - previousEmotions.trusting_surrender) >= 0.1` | 5.66% (2472/43673) | 0.70% (306/43673) | 0.70% (306/43673) |
| `(AND: previousEmotions.trust < 0.55 & emotions.trust >= 0.55)` | 2.72% (1189/43673) | 0.09% (38/43673) | 2.72% (1189/43673) |
*First-pass share is order-dependent; use pass/exclusive rates for order-independent attribution.*

**OR Block #3 OR Overlap (absolute rates)**:

| Population | Union (any pass) | Exclusive (exactly one) | Overlap (2+ pass) | Top overlap pair |
|------------|------------------|------------------------|-------------------|------------------|
| Global | 43.67% (43.673/100.000) | 21.02% (21.021/100.000) | 22.65% (22.652/100.000) | `(emotions.relief - previousEmotions.relief) >= 0.1` + `(emotions.gratitude - previousEmotions.gratitude) >= 0.1` 9.76% (9763/100.000) |

#### Worst Offender Analysis

**#1: `emotions.trust >= 0.55`** (Fail% global: 98.80% | Fail% \| mood-pass: N/A, 48.50% last-mile)
- Values are far from threshold (low near-miss rate)
- Recommendation: **adjust_upstream** - Review prototypes/generation rules

**#2: `emotions.affection >= 0.45`** (Fail% global: 96.25% | Fail% \| mood-pass: N/A, 12.89% last-mile)
- Near-miss rate: 3.65% (moderate tunability)
- Recommendation: **tune_threshold** or **adjust_upstream** - Consider both options

**#3: `emotions.trusting_surrender >= 0.25`** ⚠️ OR-alternative (Fail% global: 98.14% | Fail% \| mood-pass: N/A, 91.65% last-mile)
- ℹ️ This is an alternative within an OR block; other alternatives may cover this case
- Values are far from threshold (low near-miss rate)
- Recommendation: **adjust_upstream** - Review prototypes/generation rules

**#4: `(emotions.trusting_surrender - previousEmotions.trusting_surrender) >= 0.1`** ⚠️ OR-alternative (Fail% global: 97.53% | Fail% \| mood-pass: N/A, 83.33% last-mile)
- ℹ️ This is an alternative within an OR block; other alternatives may cover this case
- Values are far from threshold (low near-miss rate)
- Recommendation: **adjust_upstream** - Review prototypes/generation rules

#### Prototype Math Analysis

**Population**: full (N=10.000; predicate: all; hash: 1a309bea).
##### 🧠 trust >= 0.55 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.75]
- **Threshold**: 0.55
- **Status**: sometimes
- **Slack**: feasibility +0.198; always -0.550
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 2.10 | **Required Raw Sum**: 1.16

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.35 | 0.42 | 0.00 | 0.80 | 69.34% |
| Global | raw | 0.05 | 0.35 | 0.43 | 0.00 | 0.80 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.35 | 0.42 | 0.00 | 0.80 | 69.34% |
| In mood regime (no mood constraints) | raw | 0.05 | 0.35 | 0.43 | 0.00 | 0.80 | N/A |
- **Observed max (global, final)**: 0.80
- **Observed max (mood-regime, final)**: 0.80

**Gate Compatibility (mood regime)**: ❌ incompatible - gate "threat <= 0.40" conflicts with mood regime threat in [0.5, 0.2]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | +0.40 | [0.25, -0.25] | 1.00 | 0.400 | — |
| threat | -0.50 | [0.50, 0.20] | -1.00 | 0.500 | — |
| agency_control | +0.20 | [0.20, -0.30] | 1.00 | 0.200 | — |
| engagement | +0.20 | [0.15, -0.20] | 1.00 | 0.200 | — |
| affiliation | +0.40 | [-1.00, 0.05] | 0.05 | 0.020 | ⚠️ positive_weight_low_max |
| self_control | +0.20 | [-1.00, 1.00] | 1.00 | 0.200 | — |
| inhibitory_control | +0.20 | [0.05, 0.25] | 0.25 | 0.050 | ⚠️ positive_weight_low_max |

**Gates** ❌:
- ❌ `threat <= 0.40` - Constraint min (0.5) > gate requirement (0.4) | **Observed Fail Rate**: 30.66%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **affiliation**: Has positive weight (+0.40) but constraint limits max to 0.05
- ⚠️ **inhibitory_control**: Has positive weight (+0.20) but constraint limits max to 0.25

**Analysis**: Intensity 0.55 is achievable but gates are blocked. Binding conflicts: affiliation has positive weight (+0.40) but constraint limits it to max=0.05; inhibitory_control has positive weight (+0.20) but constraint limits it to max=0.25. Blocked gates: threat <= 0.40

**Recommendation**: Gates cannot be satisfied with current axis constraints. Consider relaxing the conflicting constraints or adjusting gate thresholds in the prototype.

##### 🧠 affection >= 0.45 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.75]
- **Threshold**: 0.45
- **Status**: sometimes
- **Slack**: feasibility +0.297; always -0.450
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 2.85 | **Required Raw Sum**: 1.28

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.33 | 0.42 | 0.00 | 0.79 | 31.71% |
| Global | raw | 0.06 | 0.36 | 0.43 | 0.00 | 0.79 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.33 | 0.42 | 0.00 | 0.79 | 31.71% |
| In mood regime (no mood constraints) | raw | 0.06 | 0.36 | 0.43 | 0.00 | 0.79 | N/A |
- **Observed max (global, final)**: 0.79
- **Observed max (mood-regime, final)**: 0.79

**Gate Compatibility (mood regime)**: ❌ incompatible - gate "valence >= 0.10" conflicts with mood regime valence in [0.25, -0.25]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | +0.70 | [0.25, -0.25] | 1.00 | 0.700 | — |
| arousal | +0.20 | [0.55, -0.30] | 1.00 | 0.200 | — |
| threat | -0.40 | [0.50, 0.20] | -1.00 | 0.400 | — |
| engagement | +0.30 | [0.15, -0.20] | 1.00 | 0.300 | — |
| sexual_arousal | +0.15 | [0.00, 1.00] | 1.00 | 0.150 | — |
| affiliation | +0.60 | [-1.00, 0.05] | 0.05 | 0.030 | ⚠️ positive_weight_low_max |
| self_control | +0.30 | [-1.00, 1.00] | 1.00 | 0.300 | — |
| inhibitory_control | +0.20 | [0.05, 0.25] | 0.25 | 0.050 | ⚠️ positive_weight_low_max |

**Gates** ❌:
- ❌ `valence >= 0.10` - Constraint max (-0.25) < gate requirement (0.1) | **Observed Fail Rate**: 53.88%
- ❌ `threat <= 0.40` - Constraint min (0.5) > gate requirement (0.4) | **Observed Fail Rate**: 30.66%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **affiliation**: Has positive weight (+0.60) but constraint limits max to 0.05
- ⚠️ **inhibitory_control**: Has positive weight (+0.20) but constraint limits max to 0.25

**Analysis**: Intensity 0.45 is achievable but gates are blocked. Binding conflicts: affiliation has positive weight (+0.60) but constraint limits it to max=0.05; inhibitory_control has positive weight (+0.20) but constraint limits it to max=0.25. Blocked gates: valence >= 0.10, threat <= 0.40

**Recommendation**: Gates cannot be satisfied with current axis constraints. Consider relaxing the conflicting constraints or adjusting gate thresholds in the prototype.

##### 🧠 release >= 0.40 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.87]
- **Threshold**: 0.40
- **Status**: sometimes
- **Slack**: feasibility +0.466; always -0.400
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 2.35 | **Required Raw Sum**: 0.94

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.28 | 0.41 | 0.00 | 0.84 | 23.32% |
| Global | raw | 0.00 | 0.35 | 0.44 | 0.00 | 0.84 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.28 | 0.41 | 0.00 | 0.84 | 23.32% |
| In mood regime (no mood constraints) | raw | 0.00 | 0.35 | 0.44 | 0.00 | 0.84 | N/A |
- **Observed max (global, final)**: 0.84
- **Observed max (mood-regime, final)**: 0.84

**Gate Compatibility (mood regime)**: ❌ incompatible - gate "threat <= 0.30" conflicts with mood regime threat in [0.5, 0.2]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| threat | -1.00 | [0.50, 0.20] | -1.00 | 1.000 | — |
| arousal | -0.20 | [0.55, -0.30] | -1.00 | 0.200 | — |
| engagement | +0.45 | [0.15, -0.20] | 1.00 | 0.450 | — |
| agency_control | +0.15 | [0.20, -0.30] | 1.00 | 0.150 | — |
| future_expectancy | +0.10 | [-1.00, 1.00] | 1.00 | 0.100 | — |
| valence | +0.05 | [0.25, -0.25] | 1.00 | 0.050 | — |
| inhibitory_control | -0.30 | [0.05, 0.25] | 0.05 | -0.015 | ⚠️ negative_weight_high_min |
| self_control | -0.10 | [-1.00, 1.00] | -1.00 | 0.100 | — |

**Gates** ❌:
- ❌ `threat <= 0.30` - Constraint min (0.5) > gate requirement (0.3) | **Observed Fail Rate**: 35.56%
- ❌ `engagement >= 0.10` - Constraint max (-0.2) < gate requirement (0.1) | **Observed Fail Rate**: 54.81%
- ✅ `arousal <= 0.60` - Satisfiable | **Observed Fail Rate**: 18.81%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **inhibitory_control**: Has negative weight (-0.30) but constraint requires min 0.05

**Analysis**: Intensity 0.4 is achievable but gates are blocked. Binding conflicts: inhibitory_control has negative weight (-0.30) but constraint requires min=0.05. Blocked gates: threat <= 0.30, engagement >= 0.10

**Recommendation**: Gates cannot be satisfied with current axis constraints. Consider relaxing the conflicting constraints or adjusting gate thresholds in the prototype.

##### 🧠 gratitude >= 0.40 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.73]
- **Threshold**: 0.40
- **Status**: sometimes
- **Slack**: feasibility +0.330; always -0.400
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 2.10 | **Required Raw Sum**: 0.84

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.42 | 0.51 | 0.00 | 0.87 | 34.73% |
| Global | raw | 0.05 | 0.43 | 0.52 | 0.00 | 0.87 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.42 | 0.51 | 0.00 | 0.87 | 34.73% |
| In mood regime (no mood constraints) | raw | 0.05 | 0.43 | 0.52 | 0.00 | 0.87 | N/A |
- **Observed max (global, final)**: 0.87
- **Observed max (mood-regime, final)**: 0.87

**Gate Compatibility (mood regime)**: ❌ incompatible - gate "valence >= 0.15" conflicts with mood regime valence in [0.25, -0.25]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | +0.85 | [0.25, -0.25] | 1.00 | 0.850 | — |
| affiliation | +0.45 | [-1.00, 0.05] | 0.05 | 0.023 | ⚠️ positive_weight_low_max |
| threat | -0.35 | [0.50, 0.20] | -1.00 | 0.350 | — |
| self_evaluation | -0.10 | [-0.35, -0.20] | -0.35 | 0.035 | ⚠️ negative_weight_high_min |
| agency_control | -0.05 | [0.20, -0.30] | -1.00 | 0.050 | — |
| self_control | +0.20 | [-1.00, 1.00] | 1.00 | 0.200 | — |
| inhibitory_control | +0.10 | [0.05, 0.25] | 0.25 | 0.025 | ⚠️ positive_weight_low_max |

**Gates** ❌:
- ❌ `valence >= 0.15` - Constraint max (-0.25) < gate requirement (0.15) | **Observed Fail Rate**: 56.41%
- ✅ `threat <= 0.60` - Satisfiable | **Observed Fail Rate**: 20.21%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **affiliation**: Has positive weight (+0.45) but constraint limits max to 0.05
- ⚠️ **self_evaluation**: Has negative weight (-0.10) but constraint requires min -0.35
- ⚠️ **inhibitory_control**: Has positive weight (+0.10) but constraint limits max to 0.25

**Analysis**: Intensity 0.4 is achievable but gates are blocked. Binding conflicts: affiliation has positive weight (+0.45) but constraint limits it to max=0.05; self_evaluation has negative weight (-0.10) but constraint requires min=-0.35; inhibitory_control has positive weight (+0.10) but constraint limits it to max=0.25. Blocked gates: valence >= 0.15

**Recommendation**: Gates cannot be satisfied with current axis constraints. Consider relaxing the conflicting constraints or adjusting gate thresholds in the prototype.

##### 🧠 relief >= 0.25 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 1.00]
- **Threshold**: 0.25
- **Status**: sometimes
- **Slack**: feasibility +0.750; always -0.250
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 2.60 | **Required Raw Sum**: 0.65

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.33 | 0.48 | 0.00 | 0.87 | 17.76% |
| Global | raw | 0.00 | 0.40 | 0.51 | 0.00 | 0.87 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.33 | 0.48 | 0.00 | 0.87 | 17.76% |
| In mood regime (no mood constraints) | raw | 0.00 | 0.40 | 0.51 | 0.00 | 0.87 | N/A |
- **Observed max (global, final)**: 0.87
- **Observed max (mood-regime, final)**: 0.87

**Gate Compatibility (mood regime)**: ❌ incompatible - gate "threat <= 0.20" conflicts with mood regime threat in [0.5, 0.2]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | +0.80 | [0.25, -0.25] | 1.00 | 0.800 | — |
| arousal | -0.40 | [0.55, -0.30] | -1.00 | 0.400 | — |
| threat | -0.90 | [0.50, 0.20] | -1.00 | 0.900 | — |
| uncertainty | -0.50 | [0.20, 0.10] | -1.00 | 0.500 | — |

**Gates** ❌:
- ❌ `threat <= 0.20` - Constraint min (0.5) > gate requirement (0.2) | **Observed Fail Rate**: 40.48%
- ❌ `valence >= -0.05` - Constraint max (-0.25) < gate requirement (-0.05) | **Observed Fail Rate**: 46.23%
- ❌ `uncertainty <= 0.10` - Constraint min (0.2) > gate requirement (0.1) | **Observed Fail Rate**: 45.26%

**Binding Axes**: None (all axes can reach optimal values)

**Analysis**: Intensity 0.25 is achievable but gates are blocked. Blocked gates: threat <= 0.20, valence >= -0.05, uncertainty <= 0.10

**Recommendation**: Gates cannot be satisfied with current axis constraints. Consider relaxing the conflicting constraints or adjusting gate thresholds in the prototype.

##### 🧠 calm >= 0.20 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.92]
- **Threshold**: 0.20
- **Status**: sometimes
- **Slack**: feasibility +0.722; always -0.200
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 2.90 | **Required Raw Sum**: 0.58

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.35 | 0.48 | 0.00 | 0.82 | 36.94% |
| Global | raw | 0.02 | 0.40 | 0.51 | 0.00 | 0.82 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.35 | 0.48 | 0.00 | 0.82 | 36.94% |
| In mood regime (no mood constraints) | raw | 0.02 | 0.40 | 0.51 | 0.00 | 0.82 | N/A |
- **Observed max (global, final)**: 0.82
- **Observed max (mood-regime, final)**: 0.82

**Gate Compatibility (mood regime)**: ❌ incompatible - gate "threat <= 0.20" conflicts with mood regime threat in [0.5, 0.2]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | +0.20 | [0.25, -0.25] | 1.00 | 0.200 | — |
| arousal | -1.00 | [0.55, -0.30] | -1.00 | 1.000 | — |
| threat | -1.00 | [0.50, 0.20] | -1.00 | 1.000 | — |
| inhibitory_control | +0.30 | [0.05, 0.25] | 0.25 | 0.075 | ⚠️ positive_weight_low_max |
| self_control | +0.10 | [-1.00, 1.00] | 1.00 | 0.100 | — |
| uncertainty | -0.30 | [0.20, 0.10] | -1.00 | 0.300 | — |

**Gates** ❌:
- ❌ `threat <= 0.20` - Constraint min (0.5) > gate requirement (0.2) | **Observed Fail Rate**: 40.48%
- ✅ `uncertainty <= 0.25` - Satisfiable | **Observed Fail Rate**: 37.46%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **inhibitory_control**: Has positive weight (+0.30) but constraint limits max to 0.25

**Analysis**: Intensity 0.2 is achievable but gates are blocked. Binding conflicts: inhibitory_control has positive weight (+0.30) but constraint limits it to max=0.25. Blocked gates: threat <= 0.20

**Recommendation**: Gates cannot be satisfied with current axis constraints. Consider relaxing the conflicting constraints or adjusting gate thresholds in the prototype.

##### 🧠 contentment >= 0.20 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 1.00]
- **Threshold**: 0.20
- **Status**: sometimes
- **Slack**: feasibility +0.800; always -0.200
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 2.50 | **Required Raw Sum**: 0.50

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.25 | 0.42 | 0.00 | 0.84 | 15.10% |
| Global | raw | 0.00 | 0.38 | 0.49 | 0.00 | 0.84 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.25 | 0.42 | 0.00 | 0.84 | 15.10% |
| In mood regime (no mood constraints) | raw | 0.00 | 0.38 | 0.49 | 0.00 | 0.84 | N/A |
- **Observed max (global, final)**: 0.84
- **Observed max (mood-regime, final)**: 0.84

**Gate Compatibility (mood regime)**: ❌ incompatible - gate "valence >= 0.20" conflicts with mood regime valence in [0.25, -0.25]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | +0.90 | [0.25, -0.25] | 1.00 | 0.900 | — |
| arousal | -0.60 | [0.55, -0.30] | -1.00 | 0.600 | — |
| threat | -0.60 | [0.50, 0.20] | -1.00 | 0.600 | — |
| agency_control | +0.20 | [0.20, -0.30] | 1.00 | 0.200 | — |
| uncertainty | -0.20 | [0.20, 0.10] | -1.00 | 0.200 | — |

**Gates** ❌:
- ❌ `valence >= 0.20` - Constraint max (-0.25) < gate requirement (0.2) | **Observed Fail Rate**: 58.95%
- ❌ `threat <= 0.20` - Constraint min (0.5) > gate requirement (0.2) | **Observed Fail Rate**: 40.48%
- ✅ `uncertainty <= 0.20` - Satisfiable | **Observed Fail Rate**: 39.88%

**Binding Axes**: None (all axes can reach optimal values)

**Analysis**: Intensity 0.2 is achievable but gates are blocked. Blocked gates: valence >= 0.20, threat <= 0.20

**Recommendation**: Gates cannot be satisfied with current axis constraints. Consider relaxing the conflicting constraints or adjusting gate thresholds in the prototype.

##### 🧠 trusting_surrender >= 0.25 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.86]
- **Threshold**: 0.25
- **Status**: sometimes
- **Slack**: feasibility +0.606; always -0.250
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 4.05 | **Required Raw Sum**: 1.01

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.67 | 2.64% |
| Global | raw | 0.00 | 0.24 | 0.32 | 0.00 | 0.67 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.67 | 2.64% |
| In mood regime (no mood constraints) | raw | 0.00 | 0.24 | 0.32 | 0.00 | 0.67 | N/A |
- **Observed max (global, final)**: 0.67
- **Observed max (mood-regime, final)**: 0.67

**Gate Compatibility (mood regime)**: ❌ incompatible - gate "valence >= 0.25" conflicts with mood regime valence in [0.25, -0.25]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | +0.70 | [0.25, -0.25] | 1.00 | 0.700 | — |
| threat | -0.90 | [0.50, 0.20] | -1.00 | 0.900 | — |
| agency_control | -0.75 | [0.20, -0.30] | -1.00 | 0.750 | — |
| engagement | +0.45 | [0.15, -0.20] | 1.00 | 0.450 | — |
| arousal | -0.10 | [0.55, -0.30] | -1.00 | 0.100 | — |
| future_expectancy | +0.20 | [-1.00, 1.00] | 1.00 | 0.200 | — |
| self_evaluation | +0.05 | [-0.35, -0.20] | -0.20 | -0.010 | ⚠️ positive_weight_low_max |
| self_control | -0.40 | [-1.00, 1.00] | -1.00 | 0.400 | — |
| inhibitory_control | -0.50 | [0.05, 0.25] | 0.05 | -0.025 | ⚠️ negative_weight_high_min |

**Gates** ❌:
- ❌ `valence >= 0.25` - Constraint max (-0.25) < gate requirement (0.25) | **Observed Fail Rate**: 61.49%
- ❌ `threat <= 0.25` - Constraint min (0.5) > gate requirement (0.25) | **Observed Fail Rate**: 37.98%
- ❌ `agency_control <= -0.25` - Constraint min (0.2) > gate requirement (-0.25) | **Observed Fail Rate**: 62.03%
- ❌ `engagement >= 0.15` - Constraint max (-0.2) < gate requirement (0.15) | **Observed Fail Rate**: 57.45%
- ✅ `self_evaluation >= -0.35` - Satisfiable | **Observed Fail Rate**: 32.62%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **self_evaluation**: Has positive weight (+0.05) but constraint limits max to -0.20
- ⚠️ **inhibitory_control**: Has negative weight (-0.50) but constraint requires min 0.05

**Analysis**: Intensity 0.25 is achievable but gates are blocked. Binding conflicts: self_evaluation has positive weight (+0.05) but constraint limits it to max=-0.20; inhibitory_control has negative weight (-0.50) but constraint requires min=0.05. Blocked gates: valence >= 0.25, threat <= 0.25, agency_control <= -0.25, engagement >= 0.15

**Recommendation**: Gates cannot be satisfied with current axis constraints. Consider relaxing the conflicting constraints or adjusting gate thresholds in the prototype.

##### 🧠 numbness <= 0.25 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.91]
- **Threshold**: 0.25
- **Status**: sometimes
- **Slack**: feasibility +0.250; always -0.660
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 2.50 | **Required Raw Sum**: 0.63

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.38 | 0.50 | 0.00 | 0.82 | 15.26% |
| Global | raw | 0.04 | 0.42 | 0.51 | 0.00 | 0.82 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.38 | 0.50 | 0.00 | 0.82 | 15.26% |
| In mood regime (no mood constraints) | raw | 0.04 | 0.42 | 0.51 | 0.00 | 0.82 | N/A |
- **Observed max (global, final)**: 0.82
- **Observed max (mood-regime, final)**: 0.82

**Gate Compatibility (mood regime)**: ⚠️ incompatible (benign for <=/< clauses) - gate "arousal <= -0.30" conflicts with mood regime arousal in [0.55, -0.3]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.20 | [0.25, -0.25] | -1.00 | 0.200 | — |
| arousal | -1.00 | [0.55, -0.30] | -1.00 | 1.000 | — |
| engagement | -0.60 | [0.15, -0.20] | -1.00 | 0.600 | — |
| future_expectancy | -0.20 | [-1.00, 1.00] | -1.00 | 0.200 | — |
| inhibitory_control | +0.30 | [0.05, 0.25] | 0.25 | 0.075 | ⚠️ positive_weight_low_max |
| self_control | +0.20 | [-1.00, 1.00] | 1.00 | 0.200 | — |

**Gates** ❌:
- ❌ `arousal <= -0.30` - Constraint min (0.55) > gate requirement (-0.3) | **Observed Fail Rate**: 64.48%
- ❌ `engagement <= -0.15` - Constraint min (0.15) > gate requirement (-0.15) | **Observed Fail Rate**: 56.95%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **inhibitory_control**: Has positive weight (+0.30) but constraint limits max to 0.25

**Analysis**: Threshold 0.25 is achievable but gates are blocked. Binding conflicts: inhibitory_control has positive weight (+0.30) but constraint limits it to max=0.25. Blocked gates: arousal <= -0.30, engagement <= -0.15

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 dissociation <= 0.20 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.90]
- **Threshold**: 0.20
- **Status**: sometimes
- **Slack**: feasibility +0.200; always -0.704
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 3.95 | **Required Raw Sum**: 0.79

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.75 | 2.25% |
| Global | raw | 0.00 | 0.29 | 0.37 | 0.00 | 0.75 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.75 | 2.25% |
| In mood regime (no mood constraints) | raw | 0.00 | 0.29 | 0.37 | 0.00 | 0.75 | N/A |
- **Observed max (global, final)**: 0.75
- **Observed max (mood-regime, final)**: 0.75

**Gate Compatibility (mood regime)**: ⚠️ incompatible (benign for <=/< clauses) - gate "threat >= 0.35" conflicts with mood regime threat in [0.5, 0.2]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| threat | +0.75 | [0.50, 0.20] | 1.00 | 0.750 | — |
| agency_control | -0.85 | [0.20, -0.30] | -1.00 | 0.850 | — |
| engagement | -1.00 | [0.15, -0.20] | -1.00 | 1.000 | — |
| arousal | -0.35 | [0.55, -0.30] | -1.00 | 0.350 | — |
| valence | -0.15 | [0.25, -0.25] | -1.00 | 0.150 | — |
| future_expectancy | -0.25 | [-1.00, 1.00] | -1.00 | 0.250 | — |
| self_evaluation | -0.10 | [-0.35, -0.20] | -0.35 | 0.035 | ⚠️ negative_weight_high_min |
| inhibitory_control | -0.30 | [0.05, 0.25] | 0.05 | -0.015 | ⚠️ negative_weight_high_min |
| self_control | -0.20 | [-1.00, 1.00] | -1.00 | 0.200 | — |

**Gates** ❌:
- ❌ `threat >= 0.35` - Constraint max (0.2) < gate requirement (0.35) | **Observed Fail Rate**: 66.57%
- ❌ `agency_control <= -0.20` - Constraint min (0.2) > gate requirement (-0.2) | **Observed Fail Rate**: 59.65%
- ❌ `engagement <= -0.20` - Constraint min (0.15) > gate requirement (-0.2) | **Observed Fail Rate**: 59.46%
- ❌ `arousal <= 0.35` - Constraint min (0.55) > gate requirement (0.35) | **Observed Fail Rate**: 31.49%
- ❌ `valence <= 0.10` - Constraint min (0.25) > gate requirement (0.1) | **Observed Fail Rate**: 45.59%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **self_evaluation**: Has negative weight (-0.10) but constraint requires min -0.35
- ⚠️ **inhibitory_control**: Has negative weight (-0.30) but constraint requires min 0.05

**Analysis**: Threshold 0.2 is achievable but gates are blocked. Binding conflicts: self_evaluation has negative weight (-0.10) but constraint requires min=-0.35; inhibitory_control has negative weight (-0.30) but constraint requires min=0.05. Blocked gates: threat >= 0.35, agency_control <= -0.20, engagement <= -0.20, arousal <= 0.35, valence <= 0.10

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 panic <= 0.20 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.92]
- **Threshold**: 0.20
- **Status**: sometimes
- **Slack**: feasibility +0.200; always -0.722
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 5.40 | **Required Raw Sum**: 1.08

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.63 | 0.41% |
| Global | raw | 0.00 | 0.24 | 0.32 | 0.00 | 0.64 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.63 | 0.41% |
| In mood regime (no mood constraints) | raw | 0.00 | 0.24 | 0.32 | 0.00 | 0.64 | N/A |
- **Observed max (global, final)**: 0.63
- **Observed max (mood-regime, final)**: 0.63

**Gate Compatibility (mood regime)**: ⚠️ incompatible (benign for <=/< clauses) - gate "threat >= 0.50" conflicts with mood regime threat in [0.5, 0.2]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| threat | +1.00 | [0.50, 0.20] | 1.00 | 1.000 | — |
| arousal | +1.00 | [0.55, -0.30] | 1.00 | 1.000 | — |
| agency_control | -1.00 | [0.20, -0.30] | -1.00 | 1.000 | — |
| valence | -0.70 | [0.25, -0.25] | -1.00 | 0.700 | — |
| engagement | +0.55 | [0.15, -0.20] | 1.00 | 0.550 | — |
| future_expectancy | -0.35 | [-1.00, 1.00] | -1.00 | 0.350 | — |
| inhibitory_control | -0.40 | [0.05, 0.25] | 0.05 | -0.020 | ⚠️ negative_weight_high_min |
| self_control | -0.40 | [-1.00, 1.00] | -1.00 | 0.400 | — |

**Gates** ❌:
- ❌ `threat >= 0.50` - Constraint max (0.2) < gate requirement (0.5) | **Observed Fail Rate**: 74.02%
- ❌ `arousal >= 0.55` - Constraint max (-0.3) < gate requirement (0.55) | **Observed Fail Rate**: 77.92%
- ❌ `agency_control <= -0.10` - Constraint min (0.2) > gate requirement (-0.1) | **Observed Fail Rate**: 54.84%
- ❌ `valence <= -0.15` - Constraint min (0.25) > gate requirement (-0.15) | **Observed Fail Rate**: 58.29%
- ❌ `engagement >= 0.10` - Constraint max (-0.2) < gate requirement (0.1) | **Observed Fail Rate**: 54.81%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **inhibitory_control**: Has negative weight (-0.40) but constraint requires min 0.05

**Analysis**: Threshold 0.2 is achievable but gates are blocked. Binding conflicts: inhibitory_control has negative weight (-0.40) but constraint requires min=0.05. Blocked gates: threat >= 0.50, arousal >= 0.55, agency_control <= -0.10, valence <= -0.15, engagement >= 0.10

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 terror <= 0.25 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.90]
- **Threshold**: 0.25
- **Status**: sometimes
- **Slack**: feasibility +0.250; always -0.645
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 4.00 | **Required Raw Sum**: 1.00

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.00 | 0.27 | 0.00 | 0.67 | 8.91% |
| Global | raw | 0.00 | 0.26 | 0.34 | 0.00 | 0.67 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.00 | 0.27 | 0.00 | 0.67 | 8.91% |
| In mood regime (no mood constraints) | raw | 0.00 | 0.26 | 0.34 | 0.00 | 0.67 | N/A |
- **Observed max (global, final)**: 0.67
- **Observed max (mood-regime, final)**: 0.67

**Gate Compatibility (mood regime)**: ⚠️ incompatible (benign for <=/< clauses) - gate "threat >= 0.50" conflicts with mood regime threat in [0.5, 0.2]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| threat | +1.00 | [0.50, 0.20] | 1.00 | 1.000 | — |
| arousal | +1.00 | [0.55, -0.30] | 1.00 | 1.000 | — |
| valence | -0.60 | [0.25, -0.25] | -1.00 | 0.600 | — |
| agency_control | -0.35 | [0.20, -0.30] | -1.00 | 0.350 | — |
| engagement | +0.25 | [0.15, -0.20] | 1.00 | 0.250 | — |
| inhibitory_control | -0.40 | [0.05, 0.25] | 0.05 | -0.020 | ⚠️ negative_weight_high_min |
| self_control | -0.40 | [-1.00, 1.00] | -1.00 | 0.400 | — |

**Gates** ❌:
- ❌ `threat >= 0.50` - Constraint max (0.2) < gate requirement (0.5) | **Observed Fail Rate**: 74.02%
- ❌ `arousal >= 0.30` - Constraint max (-0.3) < gate requirement (0.3) | **Observed Fail Rate**: 65.43%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **inhibitory_control**: Has negative weight (-0.40) but constraint requires min 0.05

**Analysis**: Threshold 0.25 is achievable but gates are blocked. Binding conflicts: inhibitory_control has negative weight (-0.40) but constraint requires min=0.05. Blocked gates: threat >= 0.50, arousal >= 0.30

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 fear <= 0.35 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.91]
- **Threshold**: 0.35
- **Status**: sometimes
- **Slack**: feasibility +0.350; always -0.565
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 3.70 | **Required Raw Sum**: 1.29

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.25 | 0.35 | 0.00 | 0.74 | 36.03% |
| Global | raw | 0.00 | 0.28 | 0.37 | 0.00 | 0.74 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.25 | 0.35 | 0.00 | 0.74 | 36.03% |
| In mood regime (no mood constraints) | raw | 0.00 | 0.28 | 0.37 | 0.00 | 0.74 | N/A |
- **Observed max (global, final)**: 0.74
- **Observed max (mood-regime, final)**: 0.74

**Gate Compatibility (mood regime)**: ⚠️ incompatible (benign for <=/< clauses) - gate "threat >= 0.30" conflicts with mood regime threat in [0.5, 0.2]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| threat | +1.00 | [0.50, 0.20] | 1.00 | 1.000 | — |
| arousal | +0.80 | [0.55, -0.30] | 1.00 | 0.800 | — |
| agency_control | -0.70 | [0.20, -0.30] | -1.00 | 0.700 | — |
| valence | -0.60 | [0.25, -0.25] | -1.00 | 0.600 | — |
| inhibitory_control | -0.30 | [0.05, 0.25] | 0.05 | -0.015 | ⚠️ negative_weight_high_min |
| self_control | -0.30 | [-1.00, 1.00] | -1.00 | 0.300 | — |

**Gates** ❌:
- ❌ `threat >= 0.30` - Constraint max (0.2) < gate requirement (0.3) | **Observed Fail Rate**: 63.97%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **inhibitory_control**: Has negative weight (-0.30) but constraint requires min 0.05

**Analysis**: Threshold 0.35 is achievable but gates are blocked. Binding conflicts: inhibitory_control has negative weight (-0.30) but constraint requires min=0.05. Blocked gates: threat >= 0.30

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 hypervigilance <= 0.30 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.95]
- **Threshold**: 0.30
- **Status**: sometimes
- **Slack**: feasibility +0.300; always -0.655
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 3.30 | **Required Raw Sum**: 0.99

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.27 | 0.41 | 0.00 | 0.78 | 14.46% |
| Global | raw | 0.03 | 0.36 | 0.44 | 0.00 | 0.78 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.27 | 0.41 | 0.00 | 0.78 | 14.46% |
| In mood regime (no mood constraints) | raw | 0.03 | 0.36 | 0.44 | 0.00 | 0.78 | N/A |
- **Observed max (global, final)**: 0.78
- **Observed max (mood-regime, final)**: 0.78

**Gate Compatibility (mood regime)**: ⚠️ incompatible (benign for <=/< clauses) - gate "threat >= 0.30" conflicts with mood regime threat in [0.5, 0.2]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| threat | +0.90 | [0.50, 0.20] | 1.00 | 0.900 | — |
| arousal | +0.80 | [0.55, -0.30] | 1.00 | 0.800 | — |
| engagement | +0.50 | [0.15, -0.20] | 1.00 | 0.500 | — |
| valence | -0.30 | [0.25, -0.25] | -1.00 | 0.300 | — |
| inhibitory_control | +0.20 | [0.05, 0.25] | 0.25 | 0.050 | ⚠️ positive_weight_low_max |
| self_control | +0.20 | [-1.00, 1.00] | 1.00 | 0.200 | — |
| uncertainty | +0.40 | [0.20, 0.10] | 1.00 | 0.400 | — |

**Gates** ❌:
- ❌ `threat >= 0.30` - Constraint max (0.2) < gate requirement (0.3) | **Observed Fail Rate**: 63.97%
- ❌ `arousal >= 0.20` - Constraint max (-0.3) < gate requirement (0.2) | **Observed Fail Rate**: 60.09%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **inhibitory_control**: Has positive weight (+0.20) but constraint limits max to 0.25

**Analysis**: Threshold 0.3 is achievable but gates are blocked. Binding conflicts: inhibitory_control has positive weight (+0.20) but constraint limits it to max=0.25. Blocked gates: threat >= 0.30, arousal >= 0.20

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 freeze <= 0.25 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.91]
- **Threshold**: 0.25
- **Status**: sometimes
- **Slack**: feasibility +0.250; always -0.663
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 3.45 | **Required Raw Sum**: 0.86

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.74 | 0.75% |
| Global | raw | 0.05 | 0.39 | 0.46 | 0.00 | 0.78 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.74 | 0.75% |
| In mood regime (no mood constraints) | raw | 0.05 | 0.39 | 0.46 | 0.00 | 0.78 | N/A |
- **Observed max (global, final)**: 0.74
- **Observed max (mood-regime, final)**: 0.74

**Gate Compatibility (mood regime)**: ⚠️ incompatible (benign for <=/< clauses) - gate "threat >= 0.35" conflicts with mood regime threat in [0.5, 0.2]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| threat | +1.00 | [0.50, 0.20] | 1.00 | 1.000 | — |
| agency_control | -1.00 | [0.20, -0.30] | -1.00 | 1.000 | — |
| valence | -0.35 | [0.25, -0.25] | -1.00 | 0.350 | — |
| arousal | -0.15 | [0.55, -0.30] | -1.00 | 0.150 | — |
| engagement | +0.25 | [0.15, -0.20] | 1.00 | 0.250 | — |
| inhibitory_control | +0.40 | [0.05, 0.25] | 0.25 | 0.100 | ⚠️ positive_weight_low_max |
| self_control | +0.30 | [-1.00, 1.00] | 1.00 | 0.300 | — |

**Gates** ❌:
- ❌ `threat >= 0.35` - Constraint max (0.2) < gate requirement (0.35) | **Observed Fail Rate**: 66.57%
- ❌ `agency_control <= -0.30` - Constraint min (0.2) > gate requirement (-0.3) | **Observed Fail Rate**: 64.79%
- ❌ `valence <= -0.05` - Constraint min (0.25) > gate requirement (-0.05) | **Observed Fail Rate**: 53.25%
- ❌ `arousal >= -0.10` - Constraint max (-0.3) < gate requirement (-0.1) | **Observed Fail Rate**: 45.50%
- ❌ `arousal <= 0.40` - Constraint min (0.55) > gate requirement (0.4) | **Observed Fail Rate**: 28.93%
- ❌ `engagement >= 0.05` - Constraint max (-0.2) < gate requirement (0.05) | **Observed Fail Rate**: 52.37%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **inhibitory_control**: Has positive weight (+0.40) but constraint limits max to 0.25

**Analysis**: Threshold 0.25 is achievable but gates are blocked. Binding conflicts: inhibitory_control has positive weight (+0.40) but constraint limits it to max=0.25. Blocked gates: threat >= 0.35, agency_control <= -0.30, valence <= -0.05, arousal >= -0.10, arousal <= 0.40, engagement >= 0.05

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 suspicion <= 0.25 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 1.00]
- **Threshold**: 0.25
- **Status**: sometimes
- **Slack**: feasibility +0.250; always -0.750
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 2.10 | **Required Raw Sum**: 0.53

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.27 | 0.42 | 0.00 | 0.81 | 17.36% |
| Global | raw | 0.01 | 0.36 | 0.45 | 0.00 | 0.81 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.27 | 0.42 | 0.00 | 0.81 | 17.36% |
| In mood regime (no mood constraints) | raw | 0.01 | 0.36 | 0.45 | 0.00 | 0.81 | N/A |
- **Observed max (global, final)**: 0.81
- **Observed max (mood-regime, final)**: 0.81

**Gate Compatibility (mood regime)**: ⚠️ incompatible (benign for <=/< clauses) - gate "threat >= 0.15" conflicts with mood regime threat in [0.5, 0.2]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| uncertainty | +0.60 | [0.20, 0.10] | 1.00 | 0.600 | — |
| threat | +0.50 | [0.50, 0.20] | 1.00 | 0.500 | — |
| engagement | +0.40 | [0.15, -0.20] | 1.00 | 0.400 | — |
| affiliation | -0.40 | [-1.00, 0.05] | -1.00 | 0.400 | — |
| valence | -0.20 | [0.25, -0.25] | -1.00 | 0.200 | — |

**Gates** ❌:
- ✅ `threat >= 0.15` - Satisfiable | **Observed Fail Rate**: 56.45%
- ❌ `uncertainty >= 0.20` - Constraint max (0.1) < gate requirement (0.2) | **Observed Fail Rate**: 59.60%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes**: None (all axes can reach optimal values)

**Analysis**: Threshold 0.25 is achievable but gates are blocked. Blocked gates: uncertainty >= 0.20

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 contempt <= 0.25 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.81]
- **Threshold**: 0.25
- **Status**: sometimes
- **Slack**: feasibility +0.250; always -0.565
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 3.00 | **Required Raw Sum**: 0.75

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.18 | 0.29 | 0.00 | 0.65 | 17.87% |
| Global | raw | 0.00 | 0.24 | 0.32 | 0.00 | 0.65 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.18 | 0.29 | 0.00 | 0.65 | 17.87% |
| In mood regime (no mood constraints) | raw | 0.00 | 0.24 | 0.32 | 0.00 | 0.65 | N/A |
- **Observed max (global, final)**: 0.65
- **Observed max (mood-regime, final)**: 0.65

**Gate Compatibility (mood regime)**: ⚠️ incompatible (benign for <=/< clauses) - gate "valence <= -0.10" conflicts with mood regime valence in [0.25, -0.25]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.60 | [0.25, -0.25] | -1.00 | 0.600 | — |
| agency_control | +0.80 | [0.20, -0.30] | 1.00 | 0.800 | — |
| engagement | -0.20 | [0.15, -0.20] | -1.00 | 0.200 | — |
| self_evaluation | +0.20 | [-0.35, -0.20] | -0.20 | -0.040 | ⚠️ positive_weight_low_max |
| affiliation | -0.50 | [-1.00, 0.05] | -1.00 | 0.500 | — |
| inhibitory_control | -0.30 | [0.05, 0.25] | 0.05 | -0.015 | ⚠️ negative_weight_high_min |
| self_control | -0.40 | [-1.00, 1.00] | -1.00 | 0.400 | — |

**Gates** ❌:
- ❌ `valence <= -0.10` - Constraint min (0.25) > gate requirement (-0.1) | **Observed Fail Rate**: 55.82%
- ❌ `agency_control >= 0.20` - Constraint max (-0.3) < gate requirement (0.2) | **Observed Fail Rate**: 59.52%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **self_evaluation**: Has positive weight (+0.20) but constraint limits max to -0.20
- ⚠️ **inhibitory_control**: Has negative weight (-0.30) but constraint requires min 0.05

**Analysis**: Threshold 0.25 is achievable but gates are blocked. Binding conflicts: self_evaluation has positive weight (+0.20) but constraint limits it to max=-0.20; inhibitory_control has negative weight (-0.30) but constraint requires min=0.05. Blocked gates: valence <= -0.10, agency_control >= 0.20

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 hatred <= 0.15 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.94]
- **Threshold**: 0.15
- **Status**: sometimes
- **Slack**: feasibility +0.150; always -0.792
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 5.45 | **Required Raw Sum**: 0.82

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.37 | 0.44% |
| Global | raw | 0.00 | 0.06 | 0.12 | 0.00 | 0.37 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.37 | 0.44% |
| In mood regime (no mood constraints) | raw | 0.00 | 0.06 | 0.12 | 0.00 | 0.37 | N/A |
- **Observed max (global, final)**: 0.37
- **Observed max (mood-regime, final)**: 0.37

**Gate Compatibility (mood regime)**: ⚠️ incompatible (benign for <=/< clauses) - gate "valence <= -0.25" conflicts with mood regime valence in [0.25, -0.25]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.95 | [0.25, -0.25] | -1.00 | 0.950 | — |
| engagement | +0.55 | [0.15, -0.20] | 1.00 | 0.550 | — |
| agency_control | +0.55 | [0.20, -0.30] | 1.00 | 0.550 | — |
| threat | +0.25 | [0.50, 0.20] | 1.00 | 0.250 | — |
| arousal | +0.20 | [0.55, -0.30] | 1.00 | 0.200 | — |
| affiliation | -0.85 | [-1.00, 0.05] | -1.00 | 0.850 | — |
| harm_aversion | -0.65 | [-1.00, 0.20] | -1.00 | 0.650 | — |
| affective_empathy | -0.55 | [-1.00, 0.25] | -1.00 | 0.550 | — |
| cognitive_empathy | -0.20 | [-1.00, 1.00] | -1.00 | 0.200 | — |
| self_control | -0.40 | [-1.00, 1.00] | -1.00 | 0.400 | — |
| inhibitory_control | -0.30 | [0.05, 0.25] | 0.05 | -0.015 | ⚠️ negative_weight_high_min |

**Gates** ❌:
- ❌ `valence <= -0.25` - Constraint min (0.25) > gate requirement (-0.25) | **Observed Fail Rate**: 63.34%
- ❌ `engagement >= 0.10` - Constraint max (-0.2) < gate requirement (0.1) | **Observed Fail Rate**: 54.81%
- ✅ `affiliation <= 0.05` - Satisfiable | **Observed Fail Rate**: 47.42%
- ✅ `harm_aversion <= 0.20` - Satisfiable | **Observed Fail Rate**: 79.61%
- ✅ `affective_empathy <= 0.25` - Satisfiable | **Observed Fail Rate**: 74.47%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **inhibitory_control**: Has negative weight (-0.30) but constraint requires min 0.05

**Analysis**: Threshold 0.15 is achievable but gates are blocked. Binding conflicts: inhibitory_control has negative weight (-0.30) but constraint requires min=0.05. Blocked gates: valence <= -0.25, engagement >= 0.10

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 disgust <= 0.25 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.94]
- **Threshold**: 0.25
- **Status**: sometimes
- **Slack**: feasibility +0.250; always -0.692
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 3.60 | **Required Raw Sum**: 0.90

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.25 | 0.39 | 0.00 | 0.73 | 13.12% |
| Global | raw | 0.02 | 0.34 | 0.41 | 0.00 | 0.73 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.25 | 0.39 | 0.00 | 0.73 | 13.12% |
| In mood regime (no mood constraints) | raw | 0.02 | 0.34 | 0.41 | 0.00 | 0.73 | N/A |
- **Observed max (global, final)**: 0.73
- **Observed max (mood-regime, final)**: 0.73

**Gate Compatibility (mood regime)**: ⚠️ incompatible (benign for <=/< clauses) - gate "valence <= -0.25" conflicts with mood regime valence in [0.25, -0.25]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.90 | [0.25, -0.25] | -1.00 | 0.900 | — |
| arousal | +0.40 | [0.55, -0.30] | 1.00 | 0.400 | — |
| engagement | -0.30 | [0.15, -0.20] | -1.00 | 0.300 | — |
| contamination_salience | +1.00 | [0.20, 1.00] | 1.00 | 1.000 | — |
| disgust_sensitivity | +0.50 | [0.10, 1.00] | 1.00 | 0.500 | — |
| inhibitory_control | -0.20 | [0.05, 0.25] | 0.05 | -0.010 | ⚠️ negative_weight_high_min |
| self_control | -0.30 | [-1.00, 1.00] | -1.00 | 0.300 | — |

**Gates** ❌:
- ❌ `valence <= -0.25` - Constraint min (0.25) > gate requirement (-0.25) | **Observed Fail Rate**: 63.34%
- ✅ `contamination_salience >= 0.20` - Satisfiable | **Observed Fail Rate**: 59.77%
- ✅ `disgust_sensitivity >= 0.10` - Satisfiable | **Observed Fail Rate**: 9.36%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **inhibitory_control**: Has negative weight (-0.20) but constraint requires min 0.05

**Analysis**: Threshold 0.25 is achievable but gates are blocked. Binding conflicts: inhibitory_control has negative weight (-0.20) but constraint requires min=0.05. Blocked gates: valence <= -0.25

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 rage <= 0.25 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.83]
- **Threshold**: 0.25
- **Status**: sometimes
- **Slack**: feasibility +0.250; always -0.581
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 4.65 | **Required Raw Sum**: 1.16

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.09 | 0.23 | 0.00 | 0.62 | 15.29% |
| Global | raw | 0.00 | 0.21 | 0.29 | 0.00 | 0.62 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.09 | 0.23 | 0.00 | 0.62 | 15.29% |
| In mood regime (no mood constraints) | raw | 0.00 | 0.21 | 0.29 | 0.00 | 0.62 | N/A |
- **Observed max (global, final)**: 0.62
- **Observed max (mood-regime, final)**: 0.62

**Gate Compatibility (mood regime)**: ⚠️ incompatible (benign for <=/< clauses) - gate "valence <= -0.20" conflicts with mood regime valence in [0.25, -0.25]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.85 | [0.25, -0.25] | -1.00 | 0.850 | — |
| arousal | +0.95 | [0.55, -0.30] | 1.00 | 0.950 | — |
| agency_control | +0.75 | [0.20, -0.30] | 1.00 | 0.750 | — |
| threat | +0.35 | [0.50, 0.20] | 1.00 | 0.350 | — |
| affiliation | -0.35 | [-1.00, 0.05] | -1.00 | 0.350 | — |
| inhibitory_control | -0.75 | [0.05, 0.25] | 0.05 | -0.038 | ⚠️ negative_weight_high_min |
| self_control | -0.65 | [-1.00, 1.00] | -1.00 | 0.650 | — |

**Gates** ❌:
- ❌ `valence <= -0.20` - Constraint min (0.25) > gate requirement (-0.2) | **Observed Fail Rate**: 60.84%
- ❌ `arousal >= 0.20` - Constraint max (-0.3) < gate requirement (0.2) | **Observed Fail Rate**: 60.09%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **inhibitory_control**: Has negative weight (-0.75) but constraint requires min 0.05

**Analysis**: Threshold 0.25 is achievable but gates are blocked. Binding conflicts: inhibitory_control has negative weight (-0.75) but constraint requires min=0.05. Blocked gates: valence <= -0.20, arousal >= 0.20

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 wrath <= 0.25 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.75]
- **Threshold**: 0.25
- **Status**: sometimes
- **Slack**: feasibility +0.250; always -0.499
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 4.25 | **Required Raw Sum**: 1.06

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.58 | 1.52% |
| Global | raw | 0.00 | 0.22 | 0.30 | 0.00 | 0.60 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.58 | 1.52% |
| In mood regime (no mood constraints) | raw | 0.00 | 0.22 | 0.30 | 0.00 | 0.60 | N/A |
- **Observed max (global, final)**: 0.58
- **Observed max (mood-regime, final)**: 0.58

**Gate Compatibility (mood regime)**: ⚠️ incompatible (benign for <=/< clauses) - gate "valence <= -0.15" conflicts with mood regime valence in [0.25, -0.25]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.75 | [0.25, -0.25] | -1.00 | 0.750 | — |
| arousal | +1.00 | [0.55, -0.30] | 1.00 | 1.000 | — |
| inhibitory_control | -0.90 | [0.05, 0.25] | 0.05 | -0.045 | ⚠️ negative_weight_high_min |
| self_control | -0.60 | [-1.00, 1.00] | -1.00 | 0.600 | — |
| agency_control | +0.35 | [0.20, -0.30] | 1.00 | 0.350 | — |
| threat | +0.10 | [0.50, 0.20] | 1.00 | 0.100 | — |
| affiliation | -0.20 | [-1.00, 0.05] | -1.00 | 0.200 | — |
| engagement | +0.25 | [0.15, -0.20] | 1.00 | 0.250 | — |
| self_evaluation | +0.10 | [-0.35, -0.20] | -0.20 | -0.020 | ⚠️ positive_weight_low_max |

**Gates** ❌:
- ❌ `valence <= -0.15` - Constraint min (0.25) > gate requirement (-0.15) | **Observed Fail Rate**: 58.29%
- ❌ `arousal >= 0.35` - Constraint max (-0.3) < gate requirement (0.35) | **Observed Fail Rate**: 68.06%
- ✅ `inhibitory_control <= 0.25` - Satisfiable | **Observed Fail Rate**: 37.60%
- ✅ `threat <= 0.70` - Satisfiable | **Observed Fail Rate**: 15.21%
- ❌ `agency_control >= -0.20` - Constraint max (-0.3) < gate requirement (-0.2) | **Observed Fail Rate**: 39.90%
- ❌ `engagement >= 0.05` - Constraint max (-0.2) < gate requirement (0.05) | **Observed Fail Rate**: 52.37%
- ✅ `affiliation <= 0.35` - Satisfiable | **Observed Fail Rate**: 32.61%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **inhibitory_control**: Has negative weight (-0.90) but constraint requires min 0.05
- ⚠️ **self_evaluation**: Has positive weight (+0.10) but constraint limits max to -0.20

**Analysis**: Threshold 0.25 is achievable but gates are blocked. Binding conflicts: inhibitory_control has negative weight (-0.90) but constraint requires min=0.05; self_evaluation has positive weight (+0.10) but constraint limits it to max=-0.20. Blocked gates: valence <= -0.15, arousal >= 0.35, agency_control >= -0.20, engagement >= 0.05

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 shame <= 0.65 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.77]
- **Threshold**: 0.65
- **Status**: sometimes
- **Slack**: feasibility +0.650; always -0.123
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 3.45 | **Required Raw Sum**: 2.24

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.00 | 0.36 | 0.00 | 0.74 | 8.48% |
| Global | raw | 0.13 | 0.38 | 0.45 | 0.00 | 0.74 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.00 | 0.36 | 0.00 | 0.74 | 8.48% |
| In mood regime (no mood constraints) | raw | 0.13 | 0.38 | 0.45 | 0.00 | 0.74 | N/A |
- **Observed max (global, final)**: 0.74
- **Observed max (mood-regime, final)**: 0.74

**Gate Compatibility (mood regime)**: ⚠️ incompatible (benign for <=/< clauses) - gate "valence <= -0.10" conflicts with mood regime valence in [0.25, -0.25]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| self_evaluation | -0.80 | [-0.35, -0.20] | -0.35 | 0.280 | ⚠️ negative_weight_high_min |
| valence | -0.45 | [0.25, -0.25] | -1.00 | 0.450 | — |
| agency_control | -0.35 | [0.20, -0.30] | -1.00 | 0.350 | — |
| evaluation_sensitivity | +0.45 | [0.10, 1.00] | 1.00 | 0.450 | — |
| evaluation_pressure | +0.15 | [0.20, 1.00] | 1.00 | 0.150 | — |
| inhibitory_control | +0.35 | [0.05, 0.25] | 0.25 | 0.087 | ⚠️ positive_weight_low_max |
| self_control | +0.25 | [-1.00, 1.00] | 1.00 | 0.250 | — |
| rumination | +0.35 | [-1.00, 1.00] | 1.00 | 0.350 | — |
| ruminative_tendency | +0.20 | [-1.00, 1.00] | 1.00 | 0.200 | — |
| arousal | +0.10 | [0.55, -0.30] | 1.00 | 0.100 | — |

**Gates** ❌:
- ✅ `self_evaluation <= -0.20` - Satisfiable | **Observed Fail Rate**: 59.17%
- ❌ `valence <= -0.10` - Constraint min (0.25) > gate requirement (-0.1) | **Observed Fail Rate**: 55.82%
- ✅ `inhibitory_control >= 0.05` - Satisfiable | **Observed Fail Rate**: 51.89%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **self_evaluation**: Has negative weight (-0.80) but constraint requires min -0.35
- ⚠️ **inhibitory_control**: Has positive weight (+0.35) but constraint limits max to 0.25

**Analysis**: Threshold 0.65 is achievable but gates are blocked. Binding conflicts: self_evaluation has negative weight (-0.80) but constraint requires min=-0.35; inhibitory_control has positive weight (+0.35) but constraint limits it to max=0.25. Blocked gates: valence <= -0.10

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 embarrassment <= 0.65 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.85]
- **Threshold**: 0.65
- **Status**: sometimes
- **Slack**: feasibility +0.650; always -0.197
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 2.90 | **Required Raw Sum**: 1.89

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.00 | 0.41 | 0.00 | 0.77 | 8.48% |
| Global | raw | 0.13 | 0.40 | 0.47 | 0.00 | 0.77 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.00 | 0.41 | 0.00 | 0.77 | 8.48% |
| In mood regime (no mood constraints) | raw | 0.13 | 0.40 | 0.47 | 0.00 | 0.77 | N/A |
- **Observed max (global, final)**: 0.77
- **Observed max (mood-regime, final)**: 0.77

**Gate Compatibility (mood regime)**: ⚠️ incompatible (benign for <=/< clauses) - gate "arousal >= 0.05" conflicts with mood regime arousal in [0.55, -0.3]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| evaluation_pressure | +0.75 | [0.20, 1.00] | 1.00 | 0.750 | — |
| evaluation_sensitivity | +0.55 | [0.10, 1.00] | 1.00 | 0.550 | — |
| self_evaluation | -0.45 | [-0.35, -0.20] | -0.35 | 0.158 | ⚠️ negative_weight_high_min |
| valence | -0.25 | [0.25, -0.25] | -1.00 | 0.250 | — |
| arousal | +0.35 | [0.55, -0.30] | 1.00 | 0.350 | — |
| inhibitory_control | +0.20 | [0.05, 0.25] | 0.25 | 0.050 | ⚠️ positive_weight_low_max |
| self_control | +0.20 | [-1.00, 1.00] | 1.00 | 0.200 | — |
| agency_control | -0.10 | [0.20, -0.30] | -1.00 | 0.100 | — |
| affiliation | -0.05 | [-1.00, 0.05] | -1.00 | 0.050 | — |

**Gates** ❌:
- ✅ `evaluation_pressure >= 0.20` - Satisfiable | **Observed Fail Rate**: 59.73%
- ✅ `evaluation_sensitivity >= 0.10` - Satisfiable | **Observed Fail Rate**: 9.63%
- ✅ `self_evaluation <= -0.05` - Satisfiable | **Observed Fail Rate**: 51.81%
- ❌ `arousal >= 0.05` - Constraint max (-0.3) < gate requirement (0.05) | **Observed Fail Rate**: 52.69%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **self_evaluation**: Has negative weight (-0.45) but constraint requires min -0.35
- ⚠️ **inhibitory_control**: Has positive weight (+0.20) but constraint limits max to 0.25

**Analysis**: Threshold 0.65 is achievable but gates are blocked. Binding conflicts: self_evaluation has negative weight (-0.45) but constraint requires min=-0.35; inhibitory_control has positive weight (+0.20) but constraint limits it to max=0.25. Blocked gates: arousal >= 0.05

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 awkwardness <= 0.60 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.97]
- **Threshold**: 0.60
- **Status**: sometimes
- **Slack**: feasibility +0.600; always -0.371
- **Tuning direction**: loosen -> threshold up, tighten -> threshold down
**Sum|Weights|**: 2.25 | **Required Raw Sum**: 1.35

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.53 | 2.04% |
| Global | raw | 0.06 | 0.32 | 0.39 | 0.00 | 0.67 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.00 | 0.00 | 0.00 | 0.53 | 2.04% |
| In mood regime (no mood constraints) | raw | 0.06 | 0.32 | 0.39 | 0.00 | 0.67 | N/A |
- **Observed max (global, final)**: 0.53
- **Observed max (mood-regime, final)**: 0.53

**Gate Compatibility (mood regime)**: ⚠️ incompatible (benign for <=/< clauses) - gate "arousal >= 0.05" conflicts with mood regime arousal in [0.55, -0.3]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | -0.25 | [0.25, -0.25] | -1.00 | 0.250 | — |
| arousal | +0.35 | [0.55, -0.30] | 1.00 | 0.350 | — |
| evaluation_pressure | +0.50 | [0.20, 1.00] | 1.00 | 0.500 | — |
| evaluation_sensitivity | +0.50 | [0.10, 1.00] | 1.00 | 0.500 | — |
| agency_control | -0.25 | [0.20, -0.30] | -1.00 | 0.250 | — |
| engagement | +0.10 | [0.15, -0.20] | 1.00 | 0.100 | — |
| self_evaluation | -0.10 | [-0.35, -0.20] | -0.35 | 0.035 | ⚠️ negative_weight_high_min |
| self_control | -0.20 | [-1.00, 1.00] | -1.00 | 0.200 | — |
| inhibitory_control | +0.00 | [0.05, 0.25] | 0.05 | 0.000 | ⚠️ negative_weight_high_min |

**Gates** ❌:
- ✅ `evaluation_pressure >= 0.20` - Satisfiable | **Observed Fail Rate**: 59.73%
- ❌ `arousal >= 0.05` - Constraint max (-0.3) < gate requirement (0.05) | **Observed Fail Rate**: 52.69%
- ✅ `arousal <= 0.60` - Satisfiable | **Observed Fail Rate**: 18.81%
- ✅ `self_evaluation >= -0.35` - Satisfiable | **Observed Fail Rate**: 32.62%
- ✅ `valence >= -0.50` - Satisfiable | **Observed Fail Rate**: 24.32%
- ❌ `valence <= 0.10` - Constraint min (0.25) > gate requirement (0.1) | **Observed Fail Rate**: 45.59%
- ✅ `evaluation_sensitivity >= 0.10` - Satisfiable | **Observed Fail Rate**: 9.63%
- ℹ️ Gate failure clamps intensity to 0, which helps <= conditions; gate conflicts do not block satisfaction.

**Binding Axes (Structural Conflicts)**:
- ⚠️ **self_evaluation**: Has negative weight (-0.10) but constraint requires min -0.35
- ⚠️ **inhibitory_control**: Has negative weight (0.00) but constraint requires min 0.05

**Analysis**: Threshold 0.6 is achievable but gates are blocked. Binding conflicts: self_evaluation has negative weight (-0.10) but constraint requires min=-0.35; inhibitory_control has negative weight (0.00) but constraint requires min=0.05. Blocked gates: arousal >= 0.05, valence <= 0.10

**Recommendation**: Threshold can be violated; consider raising threshold or adjusting prototypes to reduce peaks.

##### 🧠 trust >= 0.55 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.75]
- **Threshold**: 0.55
- **Status**: sometimes
- **Slack**: feasibility +0.198; always -0.550
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 2.10 | **Required Raw Sum**: 1.16

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.35 | 0.42 | 0.00 | 0.80 | 69.34% |
| Global | raw | 0.05 | 0.35 | 0.43 | 0.00 | 0.80 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.35 | 0.42 | 0.00 | 0.80 | 69.34% |
| In mood regime (no mood constraints) | raw | 0.05 | 0.35 | 0.43 | 0.00 | 0.80 | N/A |
- **Observed max (global, final)**: 0.80
- **Observed max (mood-regime, final)**: 0.80

**Gate Compatibility (mood regime)**: ❌ incompatible - gate "threat <= 0.40" conflicts with mood regime threat in [0.5, 0.2]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| valence | +0.40 | [0.25, -0.25] | 1.00 | 0.400 | — |
| threat | -0.50 | [0.50, 0.20] | -1.00 | 0.500 | — |
| agency_control | +0.20 | [0.20, -0.30] | 1.00 | 0.200 | — |
| engagement | +0.20 | [0.15, -0.20] | 1.00 | 0.200 | — |
| affiliation | +0.40 | [-1.00, 0.05] | 0.05 | 0.020 | ⚠️ positive_weight_low_max |
| self_control | +0.20 | [-1.00, 1.00] | 1.00 | 0.200 | — |
| inhibitory_control | +0.20 | [0.05, 0.25] | 0.25 | 0.050 | ⚠️ positive_weight_low_max |

**Gates** ❌:
- ❌ `threat <= 0.40` - Constraint min (0.5) > gate requirement (0.4) | **Observed Fail Rate**: 30.66%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **affiliation**: Has positive weight (+0.40) but constraint limits max to 0.05
- ⚠️ **inhibitory_control**: Has positive weight (+0.20) but constraint limits max to 0.25

**Analysis**: Intensity 0.55 is achievable but gates are blocked. Binding conflicts: affiliation has positive weight (+0.40) but constraint limits it to max=0.05; inhibitory_control has positive weight (+0.20) but constraint limits it to max=0.25. Blocked gates: threat <= 0.40

**Recommendation**: Gates cannot be satisfied with current axis constraints. Consider relaxing the conflicting constraints or adjusting gate thresholds in the prototype.

##### 🧠 release >= 0.40 ⚠️ SOMETIMES

**Feasibility (gated)**
- **Theoretical range (mood constraints, AND-only)**: [0.00, 0.87]
- **Threshold**: 0.40
- **Status**: sometimes
- **Slack**: feasibility +0.466; always -0.400
- **Tuning direction**: loosen -> threshold down, tighten -> threshold up
**Sum|Weights|**: 2.35 | **Required Raw Sum**: 0.94

**Regime Stats**:
| Regime | Signal | P50 | P90 | P95 | Min | Max | Gate Pass |
|--------|--------|-----|-----|-----|-----|-----|----------|
| Global | final | 0.00 | 0.28 | 0.41 | 0.00 | 0.84 | 23.32% |
| Global | raw | 0.00 | 0.35 | 0.44 | 0.00 | 0.84 | N/A |
| In mood regime (no mood constraints) | final | 0.00 | 0.28 | 0.41 | 0.00 | 0.84 | 23.32% |
| In mood regime (no mood constraints) | raw | 0.00 | 0.35 | 0.44 | 0.00 | 0.84 | N/A |
- **Observed max (global, final)**: 0.84
- **Observed max (mood-regime, final)**: 0.84

**Gate Compatibility (mood regime)**: ❌ incompatible - gate "threat <= 0.30" conflicts with mood regime threat in [0.5, 0.2]

**Prototype Weights**:
| Axis | Weight | Constraint | Optimal | Contribution | Binding |
|------|--------|------------|---------|--------------|---------|
| threat | -1.00 | [0.50, 0.20] | -1.00 | 1.000 | — |
| arousal | -0.20 | [0.55, -0.30] | -1.00 | 0.200 | — |
| engagement | +0.45 | [0.15, -0.20] | 1.00 | 0.450 | — |
| agency_control | +0.15 | [0.20, -0.30] | 1.00 | 0.150 | — |
| future_expectancy | +0.10 | [-1.00, 1.00] | 1.00 | 0.100 | — |
| valence | +0.05 | [0.25, -0.25] | 1.00 | 0.050 | — |
| inhibitory_control | -0.30 | [0.05, 0.25] | 0.05 | -0.015 | ⚠️ negative_weight_high_min |
| self_control | -0.10 | [-1.00, 1.00] | -1.00 | 0.100 | — |

**Gates** ❌:
- ❌ `threat <= 0.30` - Constraint min (0.5) > gate requirement (0.3) | **Observed Fail Rate**: 35.56%
- ❌ `engagement >= 0.10` - Constraint max (-0.2) < gate requirement (0.1) | **Observed Fail Rate**: 54.81%
- ✅ `arousal <= 0.60` - Satisfiable | **Observed Fail Rate**: 18.81%

**Binding Axes (Structural Conflicts)**:
- ⚠️ **inhibitory_control**: Has negative weight (-0.30) but constraint requires min 0.05

**Analysis**: Intensity 0.4 is achievable but gates are blocked. Binding conflicts: inhibitory_control has negative weight (-0.30) but constraint requires min=0.05. Blocked gates: threat <= 0.30, engagement >= 0.10

**Recommendation**: Gates cannot be satisfied with current axis constraints. Consider relaxing the conflicting constraints or adjusting gate thresholds in the prototype.

#### Distribution Analysis
- **Compound Node**: Aggregated from 34 leaf conditions (22 top-level conditions; 34 when OR blocks expanded)
- **Highest Avg Violation**: 0.45 (from `emotions.trust >= 0.55`)
- **Highest P90 Violation**: 0.55
- **Highest P95 Violation**: 0.60
- **Highest P99 Violation**: 0.74
- **Interpretation**: Worst violator: emotions.trust >= 0.55

#### Ceiling Analysis
- **Compound Node**: Contains multiple conditions
- **Status**: No ceiling effects detected in leaf conditions
- **Insight**: All thresholds appear achievable based on observed values

#### Near-Miss Analysis
- **Compound Node**: Contains 34 leaf conditions
- **Most Tunable Condition**: `emotions.gratitude >= 0.4`
- **Near-Miss Rate**: 6.38% (epsilon: 0.05)
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
- **Confidence**: low
- **Clause Pass-Rate Impact**: +0.41 pp
- **Why**: Prototype-linked clause is a top-3 impact choke. Axis sign conflicts indicate regime constraints oppose prototype weights. Conflicts: inhibitory_control (negative_weight_high_min). Low confidence due to limited mood samples (N=0).
- **Evidence**:
  - Axis conflict (negative_weight_high_min): inhibitory_control weight -0.30, regime [0.05, 0.25], lostRawSum 0.32, lostIntensity 0.13: 0.32/1 (0.13) | Population: mood-regime (N=0)
  - Pass | gate: 0/0 (0.00%) | Population: gate-pass (mood-regime) (N=0)
  - Mean value | gate: 0/1 (0.00) | Population: gate-pass (mood-regime) (N=0)
  - Clause threshold: 0.40/1 (0.40) | Population: mood-regime (N=0)
- **Actions**:
  - CONFLICT: Expression requires low Inhibitory Control (<= 25), but release treats it as a suppressor (weight: -0.30).
  - 
  - == OPTION A: Keep emotion, adjust regime ==
  -   - Remove or relax: moodAxes.inhibitory_control <= 25, moodAxes.inhibitory_control >= 5
  -   - Trade-off: Expression may trigger in wider range of mood states
  - 
  - == OPTION B: Keep regime, change emotion ==
  -   - Or: Adjust release's Inhibitory Control weight toward 0 or compatible sign
  -   - Trade-off: Expression will use different emotional signature
- **Predicted Effect**: Choose Option A or B based on your design intent.
- **Related Clauses**: [var:emotions.release:>=:0.4](#clause-var-emotions-release-0-4)

### Recommendation 2: Prototype axis sign conflict

- **Type**: axis_sign_conflict
- **Severity**: high
- **Confidence**: low
- **Clause Pass-Rate Impact**: +0.21 pp
- **Why**: Prototype-linked clause is a top-3 impact choke. Axis sign conflicts indicate regime constraints oppose prototype weights. Conflicts: affiliation (positive_weight_low_max), inhibitory_control (positive_weight_low_max). Low confidence due to limited mood samples (N=0).
- **Evidence**:
  - Axis conflict (positive_weight_low_max): affiliation weight +0.40, regime [-1.00, 0.05], lostRawSum 0.38, lostIntensity 0.18: 0.38/1 (0.18) | Population: mood-regime (N=0)
  - Axis conflict (positive_weight_low_max): inhibitory_control weight +0.20, regime [0.05, 0.25], lostRawSum 0.15, lostIntensity 0.07: 0.15/1 (0.07) | Population: mood-regime (N=0)
  - Pass | gate: 0/0 (0.00%) | Population: gate-pass (mood-regime) (N=0)
  - Mean value | gate: 0/1 (0.00) | Population: gate-pass (mood-regime) (N=0)
  - Clause threshold: 0.55/1 (0.55) | Population: mood-regime (N=0)
- **Actions**:
  - CONFLICT: Expression requires low Affiliation (<= 5), but trust weight opposes the constraint (weight: 0.40). Expression requires low Inhibitory Control (<= 25), but trust weight opposes the constraint (weight: 0.20).
  - 
  - == OPTION A: Keep emotion, adjust regime ==
  -   - Remove or relax: moodAxes.affiliation <= 5, moodAxes.inhibitory_control <= 25, moodAxes.inhibitory_control >= 5
  -   - Trade-off: Expression may trigger in wider range of mood states
  - 
  - == OPTION B: Keep regime, change emotion ==
  -   - Or: Adjust trust's Affiliation/Inhibitory Control weight toward 0 or compatible sign
  -   - Trade-off: Expression will use different emotional signature
- **Predicted Effect**: Choose Option A or B based on your design intent.
- **Related Clauses**: [var:emotions.trust:>=:0.55](#clause-var-emotions-trust-0-55)

### Recommendation 3: Prototype axis sign conflict

- **Type**: axis_sign_conflict
- **Severity**: high
- **Confidence**: low
- **Clause Pass-Rate Impact**: +0.13 pp
- **Why**: Prototype-linked clause is a top-3 impact choke. Axis sign conflicts indicate regime constraints oppose prototype weights. Conflicts: inhibitory_control (positive_weight_low_max). Low confidence due to limited mood samples (N=0).
- **Evidence**:
  - Axis conflict (positive_weight_low_max): inhibitory_control weight +0.30, regime [0.05, 0.25], lostRawSum 0.22, lostIntensity 0.08: 0.22/1 (0.08) | Population: mood-regime (N=0)
  - Pass | gate: 0/0 (0.00%) | Population: gate-pass (mood-regime) (N=0)
  - Mean value | gate: 0/1 (0.00) | Population: gate-pass (mood-regime) (N=0)
  - Clause threshold: 0.20/1 (0.20) | Population: mood-regime (N=0)
- **Actions**:
  - CONFLICT: Expression requires low Inhibitory Control (<= 25), but calm weight opposes the constraint (weight: 0.30).
  - 
  - == OPTION A: Keep emotion, adjust regime ==
  -   - Remove or relax: moodAxes.inhibitory_control <= 25, moodAxes.inhibitory_control >= 5
  -   - Trade-off: Expression may trigger in wider range of mood states
  - 
  - == OPTION B: Keep regime, change emotion ==
  -   - Or: Adjust calm's Inhibitory Control weight toward 0 or compatible sign
  -   - Trade-off: Expression will use different emotional signature
- **Predicted Effect**: Choose Option A or B based on your design intent.
- **Related Clauses**: [var:emotions.calm:>=:0.2](#clause-var-emotions-calm-0-2)

### Recommendation 4: Overconstrained Conjunction Detected

- **Type**: overconstrained_conjunction
- **Severity**: high
- **Confidence**: high
- **Clause Pass-Rate Impact**: +0.21 pp
- **Why**: 3 emotion thresholds are ANDed together, each with <10% pass rate. Joint probability: 0.0026%
- **Evidence**:
  - pass rate: 1.2%: ?/? (1.21%)
  - pass rate: 3.8%: ?/? (3.75%)
  - pass rate: 5.7%: ?/? (5.70%)
- **Actions**:
  - Consider a (2-of-3) rule: require any 2 of the 3 conditions instead of all 3.
- **Predicted Effect**: Switching to (2-of-N) or OR-softening can dramatically improve trigger probability.
- **Related Clauses**: [var:emotions.trust:>=:0.55](#clause-var-emotions-trust-0-55), [var:emotions.affection:>=:0.45](#clause-var-emotions-affection-0-45), [var:emotions.release:>=:0.4](#clause-var-emotions-release-0-4)

### Recommendation 5: Prototype gate incompatible with regime

- **Type**: gate_incompatibility
- **Severity**: low
- **Confidence**: low
- **Clause Pass-Rate Impact**: +0.41 pp
- **Why**: Prototype-linked clause is a top-3 impact choke. Gate compatibility indicates the regime blocks this prototype. Prototype values are always clamped to 0 in the regime. Low confidence due to limited mood samples (N=0).
- **Evidence**:
  - Gate fail rate: 0/0 (0.00%) | Population: mood-regime (N=0)
  - Gate compatibility: -1/1 (-1.00) | Population: mood-regime (N=0)
- **Actions**:
  - Regime makes the gate impossible; adjust gate inputs or swap prototype.
- **Predicted Effect**: Align gate constraints to allow the prototype to activate.
- **Related Clauses**: [var:emotions.release:>=:0.4](#clause-var-emotions-release-0-4)

### Recommendation 6: Threshold too high for observed distribution

- **Type**: prototype_mismatch
- **Severity**: low
- **Confidence**: low
- **Clause Pass-Rate Impact**: +0.41 pp
- **Why**: Prototype-linked clause is a top-3 impact choke. Pass|gate and mean value trail the clause threshold. Low confidence due to limited mood samples (N=0).
- **Evidence**:
  - Pass | gate: 0/0 (0.00%) | Population: gate-pass (mood-regime) (N=0)
  - Mean value | gate: 0/1 (0.00) | Population: gate-pass (mood-regime) (N=0)
  - Clause threshold: 0.40/1 (0.40) | Population: mood-regime (N=0)
- **Actions**:
  - Lower the prototype threshold or rebalance weights to raise values.
- **Predicted Effect**: Reduce mismatch to improve trigger rate and stability.
- **Related Clauses**: [var:emotions.release:>=:0.4](#clause-var-emotions-release-0-4)

### Recommendation 7: Prototype gate incompatible with regime

- **Type**: gate_incompatibility
- **Severity**: low
- **Confidence**: low
- **Clause Pass-Rate Impact**: +0.21 pp
- **Why**: Prototype-linked clause is a top-3 impact choke. Gate compatibility indicates the regime blocks this prototype. Prototype values are always clamped to 0 in the regime. Low confidence due to limited mood samples (N=0).
- **Evidence**:
  - Gate fail rate: 0/0 (0.00%) | Population: mood-regime (N=0)
  - Gate compatibility: -1/1 (-1.00) | Population: mood-regime (N=0)
- **Actions**:
  - Regime makes the gate impossible; adjust gate inputs or swap prototype.
- **Predicted Effect**: Align gate constraints to allow the prototype to activate.
- **Related Clauses**: [var:emotions.trust:>=:0.55](#clause-var-emotions-trust-0-55)

### Recommendation 8: Threshold too high for observed distribution

- **Type**: prototype_mismatch
- **Severity**: low
- **Confidence**: low
- **Clause Pass-Rate Impact**: +0.21 pp
- **Why**: Prototype-linked clause is a top-3 impact choke. Pass|gate and mean value trail the clause threshold. Low confidence due to limited mood samples (N=0).
- **Evidence**:
  - Pass | gate: 0/0 (0.00%) | Population: gate-pass (mood-regime) (N=0)
  - Mean value | gate: 0/1 (0.00) | Population: gate-pass (mood-regime) (N=0)
  - Clause threshold: 0.55/1 (0.55) | Population: mood-regime (N=0)
- **Actions**:
  - Lower the prototype threshold or rebalance weights to raise values.
- **Predicted Effect**: Reduce mismatch to improve trigger rate and stability.
- **Related Clauses**: [var:emotions.trust:>=:0.55](#clause-var-emotions-trust-0-55)

### Recommendation 9: Prototype gate incompatible with regime

- **Type**: gate_incompatibility
- **Severity**: low
- **Confidence**: low
- **Clause Pass-Rate Impact**: +0.13 pp
- **Why**: Prototype-linked clause is a top-3 impact choke. Gate compatibility indicates the regime blocks this prototype. Prototype values are always clamped to 0 in the regime. Low confidence due to limited mood samples (N=0).
- **Evidence**:
  - Gate fail rate: 0/0 (0.00%) | Population: mood-regime (N=0)
  - Gate compatibility: -1/1 (-1.00) | Population: mood-regime (N=0)
- **Actions**:
  - Regime makes the gate impossible; adjust gate inputs or swap prototype.
- **Predicted Effect**: Align gate constraints to allow the prototype to activate.
- **Related Clauses**: [var:emotions.calm:>=:0.2](#clause-var-emotions-calm-0-2)

### Recommendation 10: Threshold too high for observed distribution

- **Type**: prototype_mismatch
- **Severity**: low
- **Confidence**: low
- **Clause Pass-Rate Impact**: +0.13 pp
- **Why**: Prototype-linked clause is a top-3 impact choke. Pass|gate and mean value trail the clause threshold. Low confidence due to limited mood samples (N=0).
- **Evidence**:
  - Pass | gate: 0/0 (0.00%) | Population: gate-pass (mood-regime) (N=0)
  - Mean value | gate: 0/1 (0.00) | Population: gate-pass (mood-regime) (N=0)
  - Clause threshold: 0.20/1 (0.20) | Population: mood-regime (N=0)
- **Actions**:
  - Lower the prototype threshold or rebalance weights to raise values.
- **Predicted Effect**: Reduce mismatch to improve trigger rate and stability.
- **Related Clauses**: [var:emotions.calm:>=:0.2](#clause-var-emotions-calm-0-2)


---

## Global Expression Sensitivity Analysis

This section shows how adjusting thresholds affects the **entire expression trigger rate**, not just individual clause pass rates.
This is the key metric for tuning—it answers "What actually happens to the expression if I change this?"
**Baseline (full sample)**: 0.22% | **Baseline (stored contexts)**: 0.18%
**Population**: full (N=10.000; predicate: all; hash: 1a309bea).
### 🎯 Global Expression Sensitivity: emotions.trust >= [threshold]


> **Note**: This shows how the threshold change affects the WHOLE EXPRESSION trigger rate, not just the clause.

| Threshold | Trigger Rate | Change | Samples |
|-----------|--------------|--------|---------|
| 0.35 | 0.37% | +0.19 pp (×2.1) | 10.000 |
| 0.40 | 0.35% | +0.17 pp (×1.9) | 10.000 |
| 0.45 | 0.29% | +0.11 pp (×1.6) | 10.000 |
| 0.50 | 0.22% | +0.04 pp | 10.000 |
| **0.55** | **0.18%** | **baseline (stored contexts)** | 10.000 |
| 0.60 | 0.11% | -0.07 pp (×0.6) | 10.000 |
| 0.65 | 0.06% | -0.12 pp (×0.3) | 10.000 |
| 0.70 | 0.03% | -0.15 pp (×0.2) | 10.000 |
| 0.75 | 0.03% | -0.15 pp (×0.2) | 10.000 |

### 🎯 Global Expression Sensitivity: emotions.trusting_surrender >= [threshold]


> **Note**: This shows how the threshold change affects the WHOLE EXPRESSION trigger rate, not just the clause.

| Threshold | Trigger Rate | Change | Samples |
|-----------|--------------|--------|---------|
| 0.05 | 0.18% | +0.00 pp | 10.000 |
| 0.10 | 0.18% | +0.00 pp | 10.000 |
| 0.15 | 0.18% | +0.00 pp | 10.000 |
| 0.20 | 0.18% | +0.00 pp | 10.000 |
| **0.25** | **0.18%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 0.18% | +0.00 pp | 10.000 |
| 0.35 | 0.18% | +0.00 pp | 10.000 |
| 0.40 | 0.18% | +0.00 pp | 10.000 |
| 0.45 | 0.17% | -0.01 pp | 10.000 |

### 🎯 Global Expression Sensitivity: emotions.affection >= [threshold]


> **Note**: This shows how the threshold change affects the WHOLE EXPRESSION trigger rate, not just the clause.

| Threshold | Trigger Rate | Change | Samples |
|-----------|--------------|--------|---------|
| 0.25 | 0.19% | +0.01 pp | 10.000 |
| 0.30 | 0.19% | +0.01 pp | 10.000 |
| 0.35 | 0.19% | +0.01 pp | 10.000 |
| 0.40 | 0.19% | +0.01 pp | 10.000 |
| **0.45** | **0.18%** | **baseline (stored contexts)** | 10.000 |
| 0.50 | 0.12% | -0.06 pp (×0.7) | 10.000 |
| 0.55 | 0.05% | -0.13 pp (×0.3) | 10.000 |
| 0.60 | 0.03% | -0.15 pp (×0.2) | 10.000 |
| 0.65 | 0.02% | -0.16 pp (×0.1) | 10.000 |
## Marginal Clause Pass-Rate Sweep

This sweep shows how adjusting thresholds changes marginal clause pass rates across stored contexts.
It does **not** estimate overall expression trigger rate.
**Population**: full (N=10.000; predicate: all; hash: 1a309bea).
### Marginal Clause Pass-Rate Sweep: emotions.trust >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.35 | 9.70% | +8.45 pp (×7.8) | 10.000 |
| 0.40 | 6.42% | +5.17 pp (×5.1) | 10.000 |
| 0.45 | 3.76% | +2.51 pp (×3.0) | 10.000 |
| 0.50 | 2.27% | +1.02 pp (×1.8) | 10.000 |
| **0.55** | **1.25%** | **baseline (stored contexts)** | 10.000 |
| 0.60 | 0.65% | -0.60 pp (×0.5) | 10.000 |
| 0.65 | 0.36% | -0.89 pp (×0.3) | 10.000 |
| 0.70 | 0.13% | -1.12 pp (×0.1) | 10.000 |
| 0.75 | 0.05% | -1.20 pp (×0.0) | 10.000 |

#### Threshold Suggestions for Higher Pass Rates

| Target Rate | Suggested Threshold | Achieved Rate | Δ Threshold |
|-------------|---------------------|---------------|-------------|
| 1.00% | 0.55 | 1.25% | +0.000 |
| 5.00% | 0.40 | 6.42% | -0.150 |

**Interpretation**: To achieve ~1.00% pass rate, adjust threshold by +0.000 to 0.55.

### Marginal Clause Pass-Rate Sweep: emotions.affection >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.25 | 15.38% | +11.44 pp (×3.9) | 10.000 |
| 0.30 | 12.17% | +8.23 pp (×3.1) | 10.000 |
| 0.35 | 8.69% | +4.75 pp (×2.2) | 10.000 |
| 0.40 | 5.88% | +1.94 pp | 10.000 |
| **0.45** | **3.94%** | **baseline (stored contexts)** | 10.000 |
| 0.50 | 2.18% | -1.76 pp (×0.6) | 10.000 |
| 0.55 | 1.17% | -2.77 pp (×0.3) | 10.000 |
| 0.60 | 0.54% | -3.40 pp (×0.1) | 10.000 |
| 0.65 | 0.22% | -3.72 pp (×0.1) | 10.000 |

#### Threshold Suggestions for Higher Pass Rates

| Target Rate | Suggested Threshold | Achieved Rate | Δ Threshold |
|-------------|---------------------|---------------|-------------|
| 1.00% | 0.45 | 3.94% | +0.000 |
| 5.00% | 0.40 | 5.88% | -0.050 |
| 10.00% | 0.30 | 12.17% | -0.150 |

**Interpretation**: To achieve ~1.00% pass rate, adjust threshold by +0.000 to 0.45.

### Marginal Clause Pass-Rate Sweep: emotions.release >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.20 | 13.52% | +8.21 pp (×2.5) | 10.000 |
| 0.25 | 11.30% | +5.99 pp (×2.1) | 10.000 |
| 0.30 | 9.23% | +3.92 pp (×1.7) | 10.000 |
| 0.35 | 7.36% | +2.05 pp | 10.000 |
| **0.40** | **5.31%** | **baseline (stored contexts)** | 10.000 |
| 0.45 | 3.61% | -1.70 pp | 10.000 |
| 0.50 | 2.40% | -2.91 pp (×0.5) | 10.000 |
| 0.55 | 1.34% | -3.97 pp (×0.3) | 10.000 |
| 0.60 | 0.64% | -4.67 pp (×0.1) | 10.000 |

#### Threshold Suggestions for Higher Pass Rates

| Target Rate | Suggested Threshold | Achieved Rate | Δ Threshold |
|-------------|---------------------|---------------|-------------|
| 1.00% | 0.40 | 5.31% | +0.000 |
| 5.00% | 0.40 | 5.31% | +0.000 |
| 10.00% | 0.25 | 11.30% | -0.150 |

**Interpretation**: To achieve ~1.00% pass rate, adjust threshold by +0.000 to 0.40.

### Marginal Clause Pass-Rate Sweep: emotions.gratitude >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.20 | 24.88% | +13.35 pp (×2.2) | 10.000 |
| 0.25 | 21.49% | +9.96 pp (×1.9) | 10.000 |
| 0.30 | 18.29% | +6.76 pp (×1.6) | 10.000 |
| 0.35 | 14.78% | +3.25 pp | 10.000 |
| **0.40** | **11.53%** | **baseline (stored contexts)** | 10.000 |
| 0.45 | 8.23% | -3.30 pp | 10.000 |
| 0.50 | 5.75% | -5.78 pp (×0.5) | 10.000 |
| 0.55 | 3.53% | -8.00 pp (×0.3) | 10.000 |
| 0.60 | 1.94% | -9.59 pp (×0.2) | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.relief >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 17.04% | +4.02 pp | 10.000 |
| 0.10 | 16.46% | +3.44 pp | 10.000 |
| 0.15 | 15.55% | +2.53 pp | 10.000 |
| 0.20 | 14.44% | +1.42 pp | 10.000 |
| **0.25** | **13.02%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 11.44% | -1.58 pp | 10.000 |
| 0.35 | 9.30% | -3.72 pp | 10.000 |
| 0.40 | 7.68% | -5.34 pp (×0.6) | 10.000 |
| 0.45 | 5.94% | -7.08 pp (×0.5) | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.calm >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.00 | 100.00% | +82.15 pp (×5.6) | 10.000 |
| 0.05 | 26.18% | +8.33 pp | 10.000 |
| 0.10 | 23.39% | +5.54 pp | 10.000 |
| 0.15 | 20.51% | +2.66 pp | 10.000 |
| **0.20** | **17.85%** | **baseline (stored contexts)** | 10.000 |
| 0.25 | 15.06% | -2.79 pp | 10.000 |
| 0.30 | 12.67% | -5.18 pp | 10.000 |
| 0.35 | 10.16% | -7.69 pp (×0.6) | 10.000 |
| 0.40 | 7.67% | -10.18 pp (×0.4) | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.contentment >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.00 | 100.00% | +88.60 pp (×8.8) | 10.000 |
| 0.05 | 14.20% | +2.80 pp | 10.000 |
| 0.10 | 13.60% | +2.20 pp | 10.000 |
| 0.15 | 12.61% | +1.21 pp | 10.000 |
| **0.20** | **11.40%** | **baseline (stored contexts)** | 10.000 |
| 0.25 | 10.08% | -1.32 pp | 10.000 |
| 0.30 | 8.51% | -2.89 pp | 10.000 |
| 0.35 | 7.06% | -4.34 pp (×0.6) | 10.000 |
| 0.40 | 5.56% | -5.84 pp (×0.5) | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.trusting_surrender >= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 2.59% | +0.62 pp | 10.000 |
| 0.10 | 2.53% | +0.56 pp | 10.000 |
| 0.15 | 2.40% | +0.43 pp | 10.000 |
| 0.20 | 2.24% | +0.27 pp | 10.000 |
| **0.25** | **1.97%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 1.63% | -0.34 pp | 10.000 |
| 0.35 | 1.18% | -0.79 pp (×0.6) | 10.000 |
| 0.40 | 0.74% | -1.23 pp (×0.4) | 10.000 |
| 0.45 | 0.47% | -1.50 pp (×0.2) | 10.000 |

#### Threshold Suggestions for Higher Pass Rates

| Target Rate | Suggested Threshold | Achieved Rate | Δ Threshold |
|-------------|---------------------|---------------|-------------|
| 1.00% | 0.25 | 1.97% | +0.000 |

**Interpretation**: To achieve ~1.00% pass rate, adjust threshold by +0.000 to 0.25.

### Marginal Clause Pass-Rate Sweep: emotions.numbness <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 84.79% | -1.38 pp | 10.000 |
| 0.10 | 84.85% | -1.32 pp | 10.000 |
| 0.15 | 85.03% | -1.14 pp | 10.000 |
| 0.20 | 85.40% | -0.77 pp | 10.000 |
| **0.25** | **86.17%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 87.38% | +1.21 pp | 10.000 |
| 0.35 | 89.03% | +2.86 pp | 10.000 |
| 0.40 | 90.98% | +4.81 pp | 10.000 |
| 0.45 | 93.01% | +6.84 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.dissociation <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.00 | 97.75% | -0.06 pp | 10.000 |
| 0.05 | 97.75% | -0.06 pp | 10.000 |
| 0.10 | 97.75% | -0.06 pp | 10.000 |
| 0.15 | 97.77% | -0.04 pp | 10.000 |
| **0.20** | **97.81%** | **baseline (stored contexts)** | 10.000 |
| 0.25 | 97.90% | +0.09 pp | 10.000 |
| 0.30 | 98.07% | +0.26 pp | 10.000 |
| 0.35 | 98.33% | +0.52 pp | 10.000 |
| 0.40 | 98.77% | +0.96 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.panic <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.00 | 99.59% | +0.00 pp | 10.000 |
| 0.05 | 99.59% | +0.00 pp | 10.000 |
| 0.10 | 99.59% | +0.00 pp | 10.000 |
| 0.15 | 99.59% | +0.00 pp | 10.000 |
| **0.20** | **99.59%** | **baseline (stored contexts)** | 10.000 |
| 0.25 | 99.59% | +0.00 pp | 10.000 |
| 0.30 | 99.60% | +0.01 pp | 10.000 |
| 0.35 | 99.62% | +0.03 pp | 10.000 |
| 0.40 | 99.72% | +0.13 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.terror <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 91.42% | -3.02 pp | 10.000 |
| 0.10 | 91.98% | -2.46 pp | 10.000 |
| 0.15 | 92.56% | -1.88 pp | 10.000 |
| 0.20 | 93.44% | -1.00 pp | 10.000 |
| **0.25** | **94.44%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 95.69% | +1.25 pp | 10.000 |
| 0.35 | 97.08% | +2.64 pp | 10.000 |
| 0.40 | 98.00% | +3.56 pp | 10.000 |
| 0.45 | 98.74% | +4.30 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.fear <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.15 | 83.49% | -11.38 pp | 10.000 |
| 0.20 | 86.73% | -8.14 pp | 10.000 |
| 0.25 | 89.85% | -5.02 pp | 10.000 |
| 0.30 | 92.69% | -2.18 pp | 10.000 |
| **0.35** | **94.87%** | **baseline (stored contexts)** | 10.000 |
| 0.40 | 96.52% | +1.65 pp | 10.000 |
| 0.45 | 97.76% | +2.89 pp | 10.000 |
| 0.50 | 98.76% | +3.89 pp | 10.000 |
| 0.55 | 99.46% | +4.59 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.hypervigilance <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.10 | 86.39% | -4.50 pp | 10.000 |
| 0.15 | 86.98% | -3.91 pp | 10.000 |
| 0.20 | 87.94% | -2.95 pp | 10.000 |
| 0.25 | 89.44% | -1.45 pp | 10.000 |
| **0.30** | **90.89%** | **baseline (stored contexts)** | 10.000 |
| 0.35 | 92.72% | +1.83 pp | 10.000 |
| 0.40 | 94.54% | +3.65 pp | 10.000 |
| 0.45 | 96.19% | +5.30 pp | 10.000 |
| 0.50 | 97.56% | +6.67 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.freeze <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 99.25% | -0.01 pp | 10.000 |
| 0.10 | 99.25% | -0.01 pp | 10.000 |
| 0.15 | 99.25% | -0.01 pp | 10.000 |
| 0.20 | 99.25% | -0.01 pp | 10.000 |
| **0.25** | **99.26%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 99.29% | +0.03 pp | 10.000 |
| 0.35 | 99.32% | +0.06 pp | 10.000 |
| 0.40 | 99.37% | +0.11 pp | 10.000 |
| 0.45 | 99.50% | +0.24 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.suspicion <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 84.18% | -5.01 pp | 10.000 |
| 0.10 | 85.11% | -4.08 pp | 10.000 |
| 0.15 | 86.14% | -3.05 pp | 10.000 |
| 0.20 | 87.62% | -1.57 pp | 10.000 |
| **0.25** | **89.19%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 90.97% | +1.78 pp | 10.000 |
| 0.35 | 92.76% | +3.57 pp | 10.000 |
| 0.40 | 94.53% | +5.34 pp | 10.000 |
| 0.45 | 96.04% | +6.85 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.contempt <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 85.19% | -8.30 pp | 10.000 |
| 0.10 | 87.01% | -6.48 pp | 10.000 |
| 0.15 | 88.90% | -4.59 pp | 10.000 |
| 0.20 | 91.23% | -2.26 pp | 10.000 |
| **0.25** | **93.49%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 95.36% | +1.87 pp | 10.000 |
| 0.35 | 97.04% | +3.55 pp | 10.000 |
| 0.40 | 98.37% | +4.88 pp | 10.000 |
| 0.45 | 99.21% | +5.72 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.hatred <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| -0.05 | 0.00% | -99.78 pp (→ 0) | 10.000 |
| -0.00 | 0.00% | -99.78 pp (→ 0) | 10.000 |
| 0.05 | 99.60% | -0.18 pp | 10.000 |
| 0.10 | 99.66% | -0.12 pp | 10.000 |
| **0.15** | **99.78%** | **baseline (stored contexts)** | 10.000 |
| 0.20 | 99.89% | +0.11 pp | 10.000 |
| 0.25 | 99.92% | +0.14 pp | 10.000 |
| 0.30 | 99.95% | +0.17 pp | 10.000 |
| 0.35 | 99.99% | +0.21 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.disgust <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 87.02% | -2.89 pp | 10.000 |
| 0.10 | 87.28% | -2.63 pp | 10.000 |
| 0.15 | 87.73% | -2.18 pp | 10.000 |
| 0.20 | 88.58% | -1.33 pp | 10.000 |
| **0.25** | **89.91%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 91.44% | +1.53 pp | 10.000 |
| 0.35 | 93.34% | +3.43 pp | 10.000 |
| 0.40 | 95.16% | +5.25 pp | 10.000 |
| 0.45 | 96.89% | +6.98 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.rage <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 88.59% | -6.87 pp | 10.000 |
| 0.10 | 90.25% | -5.21 pp | 10.000 |
| 0.15 | 92.02% | -3.44 pp | 10.000 |
| 0.20 | 93.84% | -1.62 pp | 10.000 |
| **0.25** | **95.46%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 96.72% | +1.26 pp | 10.000 |
| 0.35 | 97.85% | +2.39 pp | 10.000 |
| 0.40 | 98.88% | +3.42 pp | 10.000 |
| 0.45 | 99.45% | +3.99 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.wrath <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.05 | 98.49% | -0.35 pp | 10.000 |
| 0.10 | 98.52% | -0.32 pp | 10.000 |
| 0.15 | 98.57% | -0.27 pp | 10.000 |
| 0.20 | 98.65% | -0.19 pp | 10.000 |
| **0.25** | **98.84%** | **baseline (stored contexts)** | 10.000 |
| 0.30 | 99.04% | +0.20 pp | 10.000 |
| 0.35 | 99.30% | +0.46 pp | 10.000 |
| 0.40 | 99.55% | +0.71 pp | 10.000 |
| 0.45 | 99.74% | +0.90 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.shame <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.45 | 97.26% | -2.61 pp | 10.000 |
| 0.50 | 98.29% | -1.58 pp | 10.000 |
| 0.55 | 99.14% | -0.73 pp | 10.000 |
| 0.60 | 99.61% | -0.26 pp | 10.000 |
| **0.65** | **99.87%** | **baseline (stored contexts)** | 10.000 |
| 0.70 | 99.98% | +0.11 pp | 10.000 |
| 0.75 | 100.00% | +0.13 pp | 10.000 |
| 0.80 | 100.00% | +0.13 pp | 10.000 |
| 0.85 | 100.00% | +0.13 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.embarrassment <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.45 | 96.22% | -3.50 pp | 10.000 |
| 0.50 | 97.58% | -2.14 pp | 10.000 |
| 0.55 | 98.65% | -1.07 pp | 10.000 |
| 0.60 | 99.29% | -0.43 pp | 10.000 |
| **0.65** | **99.72%** | **baseline (stored contexts)** | 10.000 |
| 0.70 | 99.88% | +0.16 pp | 10.000 |
| 0.75 | 99.98% | +0.26 pp | 10.000 |
| 0.80 | 100.00% | +0.28 pp | 10.000 |
| 0.85 | 100.00% | +0.28 pp | 10.000 |

### Marginal Clause Pass-Rate Sweep: emotions.awkwardness <= [threshold]


| Threshold | Pass Rate | Change | Samples |
|-----------|-----------|--------|---------|
| 0.40 | 99.73% | -0.27 pp | 10.000 |
| 0.45 | 99.91% | -0.09 pp | 10.000 |
| 0.50 | 99.99% | -0.01 pp | 10.000 |
| 0.55 | 100.00% | +0.00 pp | 10.000 |
| **0.60** | **100.00%** | **baseline (stored contexts)** | 10.000 |
| 0.65 | 100.00% | +0.00 pp | 10.000 |
| 0.70 | 100.00% | +0.00 pp | 10.000 |
| 0.75 | 100.00% | +0.00 pp | 10.000 |
| 0.80 | 100.00% | +0.00 pp | 10.000 |

## 🎯 Prototype Fit Analysis

Ranking of emotion prototypes by how well they fit this expression's mood regime.

> **[AXIS-ONLY FIT]** **[IN-REGIME]**
> *Computed from mood-regime axis constraints only (emotion clauses not enforced).*

**Population**: full (N=10.000; predicate: all; hash: 1a309bea).
| Rank | Prototype | Gate Pass | P(I≥t) | Conflict | Composite |
|------|-----------|-----------|--------|----------|-----------|
| 1 | **optimism** | 0.00% | 0.00% | 0.00% | 0.35 |
| 2 | **joy** | 0.00% | 0.00% | 6.67% | 0.34 |
| 3 | **interest** | 0.00% | 0.00% | 6.67% | 0.34 |
| 4 | **determination** | 0.00% | 0.00% | 6.67% | 0.34 |
| 5 | **anticipation** | 0.00% | 0.00% | 6.67% | 0.34 |
| 6 | **unease** | 0.00% | 0.00% | 6.67% | 0.34 |
| 7 | **thrill** | 0.00% | 0.00% | 6.67% | 0.34 |
| 8 | **courage** | 0.00% | 0.00% | 6.67% | 0.34 |
| 9 | **alarm** | 0.00% | 0.00% | 6.67% | 0.34 |
| 10 | **shame** | 0.00% | 0.00% | 6.67% | 0.34 |

### Top 3 Prototype Details

#### 1. optimism

- **Intensity Distribution**: P50=0.00, P90=0.00, P95=0.00
- **Conflicting Axes**: None

#### 2. joy

- **Intensity Distribution**: P50=0.00, P90=0.00, P95=0.00
- **Conflicting Axes**: inhibitory_control (weight=-0.20, wants negative)
- **Conflict Magnitude**: 0.20

#### 3. interest

- **Intensity Distribution**: P50=0.00, P90=0.00, P95=0.00
- **Conflicting Axes**: engagement (weight=1.00, wants positive)
- **Conflict Magnitude**: 1.00

---

## Non-Axis Clause Feasibility

> **[NON-AXIS ONLY]** **[IN-REGIME]**
> *Evaluates emotion/sexual/delta clauses within mood-regime using final values.*

**Population**: 0 in-regime samples analyzed

| Variable | Clause | Pass Rate | Max Value | Classification |
|----------|--------|-----------|-----------|----------------|
| `emotions.trust` | >= 0.550 | 1.3% | 0.802 | ✅ OK |
| `emotions.affection` | >= 0.450 | 3.9% | 0.788 | ✅ OK |
| `emotions.release` | >= 0.400 | 5.3% | 0.837 | ✅ OK |
| `emotions.gratitude` | >= 0.400 | 11.5% | 0.870 | ✅ OK |
| `emotions.relief` | >= 0.250 | 13.0% | 0.872 | ✅ OK |
| `emotions.calm` | >= 0.200 | 17.8% | 0.818 | ✅ OK |
| `emotions.contentment` | >= 0.200 | 11.4% | 0.838 | ✅ OK |
| `emotions.trusting_surrender` | >= 0.250 | 2.0% | 0.674 | ✅ OK |
| `emotions.numbness` | <= 0.250 | 86.2% | 0.824 | ✅ OK |
| `emotions.dissociation` | <= 0.200 | 97.8% | 0.745 | ✅ OK |
| `emotions.panic` | <= 0.200 | 99.6% | 0.625 | ✅ OK |
| `emotions.terror` | <= 0.250 | 94.4% | 0.674 | ✅ OK |
| `emotions.fear` | <= 0.350 | 94.9% | 0.737 | ✅ OK |
| `emotions.hypervigilance` | <= 0.300 | 90.9% | 0.780 | ✅ OK |
| `emotions.freeze` | <= 0.250 | 99.3% | 0.740 | ✅ OK |
| `emotions.suspicion` | <= 0.250 | 89.2% | 0.813 | ✅ OK |
| `emotions.contempt` | <= 0.250 | 93.5% | 0.653 | ✅ OK |
| `emotions.hatred` | <= 0.150 | 99.8% | 0.367 | ✅ OK |
| `emotions.disgust` | <= 0.250 | 89.9% | 0.734 | ✅ OK |
| `emotions.rage` | <= 0.250 | 95.5% | 0.623 | ✅ OK |
| `emotions.wrath` | <= 0.250 | 98.8% | 0.579 | ✅ OK |
| `emotions.shame` | <= 0.650 | 99.9% | 0.736 | ✅ OK |
| `emotions.embarrassment` | <= 0.650 | 99.7% | 0.772 | ✅ OK |
| `emotions.awkwardness` | <= 0.600 | 100.0% | 0.534 | ✅ OK |
| `previousEmotions.trust` | < 0.550 | 98.9% | 0.821 | ✅ OK |
| `emotions.trust` | >= 0.550 | 1.3% | 0.802 | ✅ OK |
| `previousEmotions.release` | < 0.400 | 94.4% | 0.800 | ✅ OK |
| `emotions.release` | >= 0.400 | 5.3% | 0.837 | ✅ OK |
| `emotions.relief` | (emotions.relief - previousEmotions.relief) >= 0.100 | 14.9% | 0.872 | ✅ OK |
| `emotions.gratitude` | (emotions.gratitude - previousEmotions.gratitude) >= 0.100 | 24.0% | 0.850 | ✅ OK |
| `previousEmotions.fear` | (previousEmotions.fear - previousPreviousEmotions.fear) >= 0.150 | N/A | N/A | ❓ UNKNOWN |
| `previousEmotions.anxiety` | (previousEmotions.anxiety - previousPreviousEmotions.anxiety) >= 0.150 | N/A | N/A | ❓ UNKNOWN |
| `previousEmotions.hypervigilance` | (previousEmotions.hypervigilance - previousPreviousEmotions.hypervigilance) >= 0.150 | N/A | N/A | ❓ UNKNOWN |
| `emotions.trusting_surrender` | (emotions.trusting_surrender - previousEmotions.trusting_surrender) >= 0.100 | 2.5% | 0.674 | ✅ OK |

## 🧭 Implied Prototype from Prerequisites

Analysis of which prototypes best match the expression's constraint pattern.

**Population**: full (N=10.000; predicate: all; hash: 1a309bea).

### Target Signature

| Axis | Direction | Importance |
|------|-----------|------------|
| affective_empathy | ↓ Low | 0.44 |
| affiliation | ↓ Low | 0.49 |
| agency_control | — Neutral | 0.88 |
| arousal | ↑ High | 0.96 |
| contamination_salience | ↑ High | 0.55 |
| disgust_sensitivity | ↑ High | 0.53 |
| engagement | — Neutral | 0.84 |
| evaluation_pressure | ↑ High | 0.55 |
| evaluation_sensitivity | ↑ High | 0.53 |
| harm_aversion | ↓ Low | 0.45 |
| inhibitory_control | ↑ High | 0.70 |
| self_evaluation | ↓ Low | 0.71 |
| threat | ↑ High | 0.82 |
| uncertainty | ↑ High | 0.78 |
| valence | — Neutral | 0.88 |

### Top 5 by Cosine Similarity

| Rank | Prototype | Similarity | Gate Pass | Combined |
|------|-----------|------------|-----------|----------|
| 1 | **humiliation** | 0.67 | 0.00% | 0.40 |
| 2 | **hypervigilance** | 0.62 | 0.00% | 0.37 |
| 3 | **embarrassment** | 0.59 | 0.00% | 0.35 |
| 4 | **alarm** | 0.55 | 0.00% | 0.33 |
| 5 | **jealousy** | 0.55 | 0.00% | 0.33 |

### Top 5 by Gate Pass Rate

| Rank | Prototype | Gate Pass | Similarity | Combined |
|------|-----------|-----------|------------|----------|
| 1 | **calm** | 0.00% | -0.54 | -0.33 |
| 2 | **contentment** | 0.00% | -0.43 | -0.26 |
| 3 | **relief** | 0.00% | -0.50 | -0.30 |
| 4 | **acceptance_settling** | 0.00% | -0.37 | -0.22 |
| 5 | **release** | 0.00% | -0.47 | -0.28 |

### Top 5 by Combined Score

| Rank | Prototype | Combined | Similarity | Gate Pass |
|------|-----------|----------|------------|----------|
| 1 | **humiliation** | 0.40 | 0.67 | 0.00% |
| 2 | **hypervigilance** | 0.37 | 0.62 | 0.00% |
| 3 | **embarrassment** | 0.35 | 0.59 | 0.00% |
| 4 | **alarm** | 0.33 | 0.55 | 0.00% |
| 5 | **jealousy** | 0.33 | 0.55 | 0.00% |

---

## 🔍 Prototype Gap Detection

Analysis of prototype coverage in "prototype space".

**Population**: full (N=10.000; predicate: all; hash: 1a309bea).

### ✅ Good Coverage

**Nearest Distance**: 0.32 - within acceptable range.

**Distance Context**: Distance 0.32 is farther than 100% of prototype nearest-neighbor distances (z=3.21).

### k-Nearest Prototypes

| Rank | Prototype | Distance | Weight Dist | Gate Dist |
|------|-----------|----------|-------------|----------|
| 1 | **humiliation** | 0.32 | 0.41 | 0.13 |
| 2 | **embarrassment** | 0.34 | 0.45 | 0.07 |
| 3 | **unease** | 0.34 | 0.49 | 0.00 |
| 4 | **hypervigilance** | 0.35 | 0.44 | 0.13 |
| 5 | **shame** | 0.35 | 0.48 | 0.07 |

---

## Report Integrity Warnings
- I5_MOOD_REGIME_HASH_MISMATCH: Mood-regime population hash differs between report and simulation metadata. [population=1a309bea]

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
