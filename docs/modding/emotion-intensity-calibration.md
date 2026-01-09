# Emotion Intensity Calibration Guide

This guide explains how emotion intensities are calculated, why certain emotions may have theoretical maximum ceilings, and when to modify prototypes versus expression prerequisites.

## How Emotion Intensity Is Calculated

The engine calculates emotion intensity using **weighted prototype matching** against normalized mood axes.

### The Formula

```
intensity = clamp01( rawSum / sumAbsWeights )

where:
  rawSum = Σ (axisValue × weight)     for each axis in prototype
  sumAbsWeights = Σ |weight|          for each axis in prototype
  clamp01(x) = max(0, min(1, x))
```

### Step-by-Step Example: Jealousy

From `emotion_prototypes.lookup.json`:

```json
"jealousy": {
  "weights": {
    "threat": 0.6,
    "arousal": 0.6,
    "valence": -0.6,
    "agency_control": -0.2,
    "engagement": 0.4,
    "self_evaluation": -0.25
  },
  "gates": [
    "threat >= 0.20",
    "valence <= -0.05",
    "engagement >= 0.15"
  ]
}
```

**Sum of absolute weights:**
```
|0.6| + |0.6| + |-0.6| + |-0.2| + |0.4| + |-0.25| = 2.65
```

**Maximum possible raw sum** (when all axes are at their optimal extremes):
- `threat = 1.0` → `1.0 × 0.6 = 0.6`
- `arousal = 1.0` → `1.0 × 0.6 = 0.6`
- `valence = -1.0` → `-1.0 × -0.6 = 0.6`
- `agency_control = -1.0` → `-1.0 × -0.2 = 0.2`
- `engagement = 1.0` → `1.0 × 0.4 = 0.4`
- `self_evaluation = -1.0` → `-1.0 × -0.25 = 0.25`

```
maxRawSum = 0.6 + 0.6 + 0.6 + 0.2 + 0.4 + 0.25 = 2.65
```

**Maximum theoretical intensity:**
```
maxIntensity = 2.65 / 2.65 = 1.0
```

In theory, jealousy can reach 1.0—but **only if all axes are at their absolute extremes simultaneously**, which is rare in practice.

### Why Real-World Maximums Are Lower

When gates constrain axis values, the achievable maximum drops. For jealousy with its gates:

- `threat >= 0.20` — Threat must be at least 0.20
- `valence <= -0.05` — Valence must be at most -0.05 (slightly negative)
- `engagement >= 0.15` — Engagement must be at least 0.15

These gates don't severely limit the maximum. However, in realistic gameplay scenarios where mood axes evolve from events and actions, you rarely see perfect alignment of all axes at their extremes.

**Realistic scenario:** If you observe a "max possible 0.48" from the static analyzer, this likely means the gate constraints or current axis intervals mathematically cap the achievable intensity.

## Understanding the Static Analyzer's "Max Possible" Values

The `IntensityBoundsCalculator` calculates theoretical maximum intensity given:

1. **Gate constraints** — Converted to axis intervals (e.g., `threat >= 0.20` means threat ∈ [0.20, 1.0])
2. **Weight optimization** — For each axis with positive weight, use the interval's max; for negative weight, use the interval's min

### Example: Constrained Jealousy

If other expression prerequisites further constrain axes:

| Axis | Weight | Constrained Interval | Optimal Value | Contribution |
|------|--------|---------------------|---------------|--------------|
| threat | +0.6 | [0.20, 0.50] | 0.50 | 0.30 |
| arousal | +0.6 | [-0.30, 0.40] | 0.40 | 0.24 |
| valence | -0.6 | [-0.40, -0.05] | -0.40 | 0.24 |
| agency_control | -0.2 | [-0.30, 0.10] | -0.30 | 0.06 |
| engagement | +0.4 | [0.15, 0.60] | 0.60 | 0.24 |
| self_evaluation | -0.25 | [-0.50, 0.00] | -0.50 | 0.125 |

```
constrainedMaxRaw = 0.30 + 0.24 + 0.24 + 0.06 + 0.24 + 0.125 = 1.265
constrainedMax = 1.265 / 2.65 ≈ 0.48
```

This explains the "max possible 0.48" — it's a **real mathematical ceiling** imposed by the prerequisite gates, not an analyzer artifact.

## When to Modify Prototypes vs. Prerequisites

### Modify Prototypes When:

1. **Global recalibration is needed** — If jealousy (or any emotion) should be capable of reaching higher intensities across your entire system, you need to adjust the prototype weights.

2. **The emotion's fundamental nature should change** — For example, if jealousy should respond more strongly to threat, increase its threat weight.

3. **Relative intensity scaling is off** — If one emotion consistently dominates others inappropriately.

**Prototype changes affect:**
- Every expression using that emotion
- Every character in the game
- The emotion's baseline responsiveness to mood shifts

### Modify Prerequisites When:

1. **A specific expression needs different triggering conditions** — The expression's gates may be too restrictive for its intended use case.

2. **Contextual fine-tuning** — A particular expression should trigger under narrower or broader circumstances.

3. **Correcting unreachable thresholds** — If an expression requires `jealousy >= 0.60` but the gates mathematically cap jealousy at 0.48, you have two options:
   - Lower the threshold to something achievable (e.g., `jealousy >= 0.40`)
   - Relax the gate constraints to allow higher axis values

**Prerequisite changes affect:**
- Only that specific expression
- Can be tested in isolation
- Safer for iterative balancing

## Practical Calibration Workflow

### Step 1: Identify the Issue

Run the expression diagnostics panel or use the `IntensityBoundsCalculator` to find:
- Which expressions have unreachable intensity thresholds
- What the maximum achievable intensity is
- Which axis constraints are limiting

### Step 2: Diagnose the Cause

**Is this a prototype ceiling?**
- Calculate the theoretical max without any constraints
- If the prototype's max is inherently low, consider adjusting weights

**Is this a gate constraint ceiling?**
- Examine the gate conditions
- Calculate max achievable given gates
- Consider if gates are too restrictive

### Step 3: Choose Your Fix

| Problem | Solution | Impact |
|---------|----------|--------|
| Threshold too high for constrained intensity | Lower the threshold | Expression-local |
| Gates too restrictive | Relax gate conditions | Expression-local |
| Emotion fundamentally capped too low | Adjust prototype weights | System-wide |
| Emotion's sensitivity is wrong | Adjust weight distribution | System-wide |

### Step 4: Test and Iterate

1. Make one change at a time
2. Re-run the diagnostics
3. Test in actual gameplay scenarios
4. Monitor for unintended side effects

## Weight Design Principles

### Weight Magnitude Matters

Higher absolute weights = more responsive to that axis.

```json
// High threat sensitivity
"threat": 0.8   // Emotion responds strongly to threat changes

// Low threat sensitivity
"threat": 0.2   // Emotion barely notices threat changes
```

### Weight Sign Determines Direction

- **Positive weight:** High axis value → high intensity contribution
- **Negative weight:** Low axis value → high intensity contribution

```json
// Example: "relief" responds to LOW threat (negative weight)
"relief": {
  "weights": {
    "threat": -0.9  // Relief increases when threat is LOW
  }
}
```

### Total Weight Sum Affects Intensity Range

The formula normalizes by `sumAbsWeights`. More axes with significant weights = each axis has less individual impact.

```json
// Focused emotion (few axes, each matters a lot)
"calm": {
  "weights": {
    "valence": 0.2,
    "arousal": -1.0,
    "threat": -1.0
  }
}
// sumAbsWeights = 2.2

// Diffuse emotion (many axes, each matters less)
"jealousy": {
  "weights": {
    "threat": 0.6,
    "arousal": 0.6,
    "valence": -0.6,
    "agency_control": -0.2,
    "engagement": 0.4,
    "self_evaluation": -0.25
  }
}
// sumAbsWeights = 2.65
```

## Gate Design Best Practices

### Gates as Activation Thresholds

Gates determine **when** an emotion activates, not **how intense** it becomes. Think of gates as "minimum requirements to feel this emotion at all."

```json
"gates": [
  "threat >= 0.20"  // Only feel fear if threat is at least 20%
]
```

### Avoid Overly Restrictive Gates

If gates constrain too many axes to narrow bands, the achievable intensity ceiling drops significantly.

**Problematic:**
```json
"gates": [
  "threat >= 0.30",
  "threat <= 0.50",
  "arousal >= 0.20",
  "arousal <= 0.40",
  "valence >= -0.30",
  "valence <= -0.10"
]
// These band constraints severely limit max intensity
```

**Better:**
```json
"gates": [
  "threat >= 0.30",
  "arousal >= 0.20",
  "valence <= -0.10"
]
// Minimum thresholds only; no upper bounds on contributors
```

### Gate vs. Weight Interaction

If an axis has a positive weight but a ceiling gate, you're capping a contributor:

```json
"weights": {
  "threat": 0.6  // Higher threat = higher intensity
},
"gates": [
  "threat <= 0.50"  // But threat can't exceed 0.50
]
```

This creates a hard ceiling on that axis's contribution. Use ceiling gates sparingly and intentionally.

## Reference: Mood Axis Ranges

| Axis | Range | Description |
|------|-------|-------------|
| `valence` | [-100, 100] → [-1, 1] | Pleasure-displeasure |
| `arousal` | [-100, 100] → [-1, 1] | Activation-deactivation |
| `agency_control` | [-100, 100] → [-1, 1] | Control-powerlessness |
| `threat` | [-100, 100] → [-1, 1] | Safety-danger |
| `engagement` | [-100, 100] → [-1, 1] | Interest-boredom |
| `future_expectancy` | [-100, 100] → [-1, 1] | Hope-dread |
| `self_evaluation` | [-100, 100] → [-1, 1] | Pride-shame |
| `sexual_arousal` | [0, 100] → [0, 1] | Sexual arousal level |

**Note:** Raw mood values are in [-100, 100] but normalized to [-1, 1] for calculations. Sexual axes normalize from [0, 100] to [0, 1].

## Summary

1. **Intensity is calculated via weighted sum normalization** — Each emotion prototype defines weights and gates
2. **Gates can create mathematical ceilings** — If gates constrain axes, max achievable intensity is limited
3. **Modify prototypes for global recalibration** — When an emotion's fundamental responsiveness needs adjustment
4. **Modify prerequisites for expression-specific tuning** — When a particular expression's requirements need adjustment
5. **The analyzer's "max possible" reflects real math** — It's not an artifact; it's what your constraints mathematically allow

When in doubt, start by adjusting expression prerequisites—they're safer, more targeted, and easier to test.
