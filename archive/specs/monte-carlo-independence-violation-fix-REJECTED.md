# Monte Carlo Independence Violation Fix

Status: Rejected (documentation/wording update only; no new sampling mode required)

## Problem Statement

The Monte Carlo simulation claims to use "uniform independent sampling" to test logical feasibility of expressions. However, the implementation violates independence because **emotions are calculated from mood axes using prototype gates**, not sampled independently. This creates hidden correlations that dramatically reduce the observed mood regime hit rate.

### Evidence

For the `hurt_anger` expression:
- **Expected mood regime hits** (uniform independent): ~1090/100000 = 1.09%
- **Observed mood regime hits**: 29/100000 = 0.029%
- **Discrepancy**: 37x fewer samples than expected

### Root Cause

1. `RandomStateGenerator.generate()` samples mood axes uniformly over [-100, 100] ✓
2. `MonteCarloSimulator.#buildContext()` calls `emotionCalculatorAdapter.calculateEmotionsFiltered()`
3. `EmotionCalculatorService` applies **prototype gates** before calculating intensity
4. If gates fail → emotion intensity = 0 → expression fails even if mood regime passes

### Data Flow Showing Coupling

```
Random Mood Sample (uniform [-100, 100])
        ↓
EmotionCalculatorAdapter.calculateEmotionsFiltered()
        ↓
EmotionCalculatorService.#calculatePrototypeIntensity()
        ↓
Gate Check: if (!#checkGates(prototype.gates, normalizedAxes)) return 0;
        ↓
Expression Evaluation (uses gated emotions, many are 0)
```

## Solution: Add True Independent Sampling Mode

### Approach

Add a new sampling mode `'independent'` that samples emotions directly, bypassing prototype calculation. This provides true "logical feasibility" testing as originally intended.

### Mode Comparison

| Aspect | `static` (current) | `independent` (new) |
|--------|-------------------|---------------------|
| Mood sampling | Uniform [-100, 100] | Uniform [-100, 100] |
| Emotion values | Calculated via prototypes | Sampled directly [0, 1] |
| Gate effects | Applied (causes coupling) | None (true independence) |
| Purpose | Realistic triggering rates | Logical feasibility testing |

## Implementation

### 1. Update RandomStateGenerator

**File**: `src/expressionDiagnostics/services/RandomStateGenerator.js`

Add new method and update `generate()`:

```javascript
// Add to constants
const EMOTION_NAMES = [
  'joy', 'sadness', 'anger', 'fear', 'disgust', 'surprise',
  'contempt', 'shame', 'guilt', 'embarrassment', 'pride',
  'love', 'hatred', 'jealousy', 'envy', 'hope', 'despair',
  // ... all emotion names from prototypes
];

/**
 * Generate a random state with optional independent emotion sampling.
 * @param {'uniform'|'gaussian'} distribution - Distribution type
 * @param {'static'|'dynamic'|'independent'} samplingMode - Sampling mode
 * @param {Set<string>|null} [referencedEmotions] - Emotions to sample (for independent mode)
 * @returns {{current: {...}, previous: {...}, affectTraits: object, sampledEmotions?: object, sampledPreviousEmotions?: object}}
 */
generate(distribution = 'uniform', samplingMode = 'static', referencedEmotions = null) {
  // ... existing mood/sexual/trait sampling ...

  if (samplingMode === 'independent' && referencedEmotions) {
    const sampledEmotions = {};
    const sampledPreviousEmotions = {};

    for (const emotion of referencedEmotions) {
      // Sample emotions uniformly in [0, 1]
      sampledEmotions[emotion] = this.#sampleValue(distribution, 0, 1);
      sampledPreviousEmotions[emotion] = this.#sampleValue(distribution, 0, 1);
    }

    return {
      current: { mood: currentMood, sexual: currentSexual },
      previous: { mood: previousMood, sexual: previousSexual },
      affectTraits,
      sampledEmotions,
      sampledPreviousEmotions,
    };
  }

  return {
    current: { mood: currentMood, sexual: currentSexual },
    previous: { mood: previousMood, sexual: previousSexual },
    affectTraits,
  };
}
```

### 2. Update MonteCarloSimulator

**File**: `src/expressionDiagnostics/services/MonteCarloSimulator.js`

Update `#buildContext()` to use sampled emotions when available:

```javascript
#buildContext(
  currentState,
  previousState,
  affectTraits = null,
  emotionFilter,
  sampledEmotions = null,      // NEW
  sampledPreviousEmotions = null // NEW
) {
  let emotions, previousEmotions;

  if (sampledEmotions && sampledPreviousEmotions) {
    // Independent mode: use directly sampled emotions
    emotions = { ...sampledEmotions };
    previousEmotions = { ...sampledPreviousEmotions };
  } else {
    // Static/dynamic mode: calculate via prototypes (existing behavior)
    emotions = this.#emotionCalculatorAdapter.calculateEmotionsFiltered(
      currentState.mood,
      currentState.sexual,
      affectTraits,
      emotionFilter
    );
    previousEmotions = this.#emotionCalculatorAdapter.calculateEmotionsFiltered(
      previousState.mood,
      previousState.sexual,
      affectTraits,
      emotionFilter
    );
  }

  // ... rest unchanged ...
}
```

Update simulation loop to pass sampled emotions:

```javascript
for (let i = processed; i < chunkEnd; i++) {
  const generated = this.#randomStateGenerator.generate(
    distribution,
    samplingMode,
    samplingMode === 'independent' ? referencedEmotions : null
  );

  const context = this.#buildContext(
    generated.current,
    generated.previous,
    generated.affectTraits,
    referencedEmotions,
    generated.sampledEmotions,        // NEW
    generated.sampledPreviousEmotions // NEW
  );
  // ... rest unchanged ...
}
```

### 3. Update Report Generator

**File**: `src/expressionDiagnostics/services/MonteCarloReportGenerator.js`

Update executive summary and descriptions:

```javascript
#generateExecutiveSummary(stats, expressionId, samplingMode) {
  const modeDescription = samplingMode === 'independent'
    ? 'independent - Emotions sampled directly (tests logical feasibility)'
    : 'static - Emotions via prototypes (tests realistic triggering)';

  return `**Sampling Mode**: ${modeDescription}\n\n` +
    // ... existing summary ...
}
```

Add mode-specific probability notes:

```javascript
#generateConditionalPassRatesSection(prerequisites, blockers, storedContexts, samplingMode) {
  // ... existing extraction ...

  if (samplingMode === 'independent') {
    notes.push(
      '**Note**: Independent mode - probabilities should match ' +
      'product of individual pass rates (true independence).'
    );
  } else {
    notes.push(
      '**Note**: Static mode - emotion values depend on mood via prototype gates. ' +
      'Observed rates may differ from theoretical independent probabilities.'
    );
  }

  // ... rest unchanged ...
}
```

### 4. Update Configuration

**File**: `src/expressionDiagnostics/config/advancedMetricsConfig.js`

Add independent mode option:

```javascript
export const SAMPLING_MODES = {
  static: {
    label: 'Static (Realistic)',
    description: 'Emotions calculated via prototypes with gate filtering'
  },
  dynamic: {
    label: 'Dynamic (Temporal)',
    description: 'Current state derived from previous via small deltas'
  },
  independent: {
    label: 'Independent (Logical)',
    description: 'All variables sampled independently for feasibility testing'
  }
};

export const DEFAULT_SAMPLING_MODE = 'static';
```

### 5. Update UI (Optional)

**File**: `expression-diagnostics.html`

Add sampling mode dropdown:

```html
<div class="config-item">
  <label>Sampling Mode</label>
  <select id="sampling-mode">
    <option value="static">Static (Realistic)</option>
    <option value="independent">Independent (Logical)</option>
  </select>
</div>
```

## Testing

### Unit Tests

**File**: `tests/unit/expressionDiagnostics/services/randomStateGenerator.test.js`

```javascript
describe('independent mode', () => {
  it('should sample emotions directly when mode is independent', () => {
    const generator = new RandomStateGenerator({ logger: mockLogger });
    const emotions = new Set(['anger', 'joy']);

    const result = generator.generate('uniform', 'independent', emotions);

    expect(result.sampledEmotions).toBeDefined();
    expect(result.sampledEmotions.anger).toBeGreaterThanOrEqual(0);
    expect(result.sampledEmotions.anger).toBeLessThanOrEqual(1);
    expect(result.sampledEmotions.joy).toBeGreaterThanOrEqual(0);
    expect(result.sampledEmotions.joy).toBeLessThanOrEqual(1);
  });

  it('should sample previous emotions independently', () => {
    const generator = new RandomStateGenerator({ logger: mockLogger });
    const emotions = new Set(['anger']);

    const result = generator.generate('uniform', 'independent', emotions);

    expect(result.sampledPreviousEmotions.anger).not.toBe(result.sampledEmotions.anger);
  });
});
```

### Integration Tests

**File**: `tests/integration/expression-diagnostics/independentSampling.integration.test.js`

```javascript
describe('Monte Carlo independent sampling mode', () => {
  it('should produce mood regime hits matching theoretical probability', async () => {
    // For a simple expression with only mood constraints
    // Expected: product of individual probabilities
    const simulator = container.resolve(tokens.IMonteCarloSimulator);

    const result = await simulator.simulate(
      testExpression,
      10000,
      'uniform',
      'independent'
    );

    // With independent sampling, observed rate should be within
    // statistical bounds of theoretical rate
    const theoreticalRate = 0.0109; // example
    const observedRate = result.triggerRate;
    const tolerance = 3 * Math.sqrt(theoreticalRate * (1 - theoreticalRate) / 10000);

    expect(Math.abs(observedRate - theoreticalRate)).toBeLessThan(tolerance);
  });
});
```

## Verification Criteria

1. **Independence Test**: With `independent` mode, P(mood regime) ≈ product of individual axis pass rates
2. **Consistency Test**: Running same expression in both modes shows expected difference
3. **No Regression**: `static` mode behavior unchanged from current implementation
4. **Documentation**: Report clearly indicates which mode was used

## Rollout Plan

1. Implement `independent` mode as new option (non-breaking)
2. Default remains `static` for backwards compatibility
3. Update documentation to explain mode differences
4. Consider deprecation warning if removing misleading "uniform independent" claim from static mode

## Files Modified

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/RandomStateGenerator.js` | Add independent emotion sampling |
| `src/expressionDiagnostics/services/MonteCarloSimulator.js` | Pass sampled emotions through |
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | Mode-aware descriptions |
| `src/expressionDiagnostics/config/advancedMetricsConfig.js` | Add mode configuration |
| `expression-diagnostics.html` | Add UI toggle (optional) |
| `tests/unit/expressionDiagnostics/services/randomStateGenerator.test.js` | Unit tests |
| `tests/integration/expression-diagnostics/independentSampling.integration.test.js` | Integration tests |

## Alternative: Documentation-Only Fix

If full implementation is not desired, minimum viable fix:

1. Rename sampling mode description from "Independent sampling (tests logical feasibility)" to "Prototype-gated sampling (tests realistic triggering)"
2. Add note to report: "Emotion constraints are coupled to mood axes via prototype gates"
3. Remove claim of "uniform independent" sampling from documentation
