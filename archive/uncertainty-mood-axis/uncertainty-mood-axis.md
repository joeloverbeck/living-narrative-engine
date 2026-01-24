# Uncertainty Mood Axis Implementation

## Goal

Add a 10th mood axis called `uncertainty` to represent epistemic states (confusion, doubt, perplexity, cognitive dissonance) that cannot be adequately captured by the existing affective/motivational/regulatory axes.

## Motivation

The current 9 mood axes are excellent for representing:
- **Hedonics**: valence
- **Energy/activation**: arousal
- **Power/efficacy**: agency_control
- **Safety appraisal**: threat
- **Attentional capture**: engagement
- **Outlook**: future_expectancy
- **Self-worth**: self_evaluation
- **Social orientation**: affiliation
- **Response braking**: inhibitory_control

However, they cannot adequately represent the epistemic state of confusion, which is primarily:
> "My internal model doesn't fit what I'm perceiving / I can't integrate this / I don't know what's going on."

Without a dedicated epistemic axis, "confusion" collapses into the same basin as frustration, anxiety, and helpless sadness due to its reliance on `agency_control↓` and `valence↓`.

### What the New Axis Enables

With `uncertainty`, we can distinctly separate:

| Emotion | Uncertainty | Other Key Axes |
|---------|-------------|----------------|
| **confusion** | ↑ high | threat low-mid, valence ~0, inhibitory_control often ↑ |
| **frustration** | not necessarily high | agency_control↓, valence↓, engagement↑ |
| **curiosity** | ↑ high | engagement↑, threat low, valence slightly + |
| **suspicion** | ↑ high | threat↑, affiliation↓ |
| **awe** | ↑ high (novelty) | engagement↑, agency_control↓ (sometimes), valence mixed |

This is high ROI for an immersive sim/RPG because NPCs constantly face incomplete information, ambiguous signals, and planning uncertainty.

## Current Implementation Reference

### Key Files

| File | Purpose |
|------|---------|
| `data/mods/core/components/mood.component.json` | Mood component schema with 9 axes |
| `src/constants/moodAffectConstants.js` | Centralized MOOD_AXES array and utilities |
| `data/mods/core/lookups/emotion_prototypes.lookup.json` | 85+ emotion prototypes with weights/gates |
| `src/expressionDiagnostics/services/RandomStateGenerator.js` | Monte Carlo random state generation |
| `src/expressionDiagnostics/services/simulatorCore/ContextBuilder.js` | Context building for simulations |
| `src/expressionDiagnostics/services/simulatorCore/GateEvaluator.js` | Gate evaluation logic |
| `src/expressions/expressionContextBuilder.js` | Expression context assembly |
| `src/validation/expressionPrerequisiteValidator.js` | Prerequisite validation |
| `expression-diagnostics.html` | Diagnostic UI |

### Current Mood Axes

```javascript
// src/constants/moodAffectConstants.js
export const MOOD_AXES = Object.freeze([
  'valence',
  'arousal',
  'agency_control',
  'threat',
  'engagement',
  'future_expectancy',
  'self_evaluation',
  'affiliation',
  'inhibitory_control',
]);
```

### Current Confusion Prototype

```json
// data/mods/core/lookups/emotion_prototypes.lookup.json
"confusion": {
  "weights": {
    "engagement": 0.3,
    "arousal": 0.2,
    "agency_control": -0.5,
    "valence": -0.2,
    "self_control": -0.3,
    "inhibitory_control": -0.2
  },
  "gates": [
    "agency_control <= 0.20"
  ]
}
```

**Problem**: This prototype relies heavily on `agency_control↓`, causing it to overlap with frustration and helplessness states.

## Proposed Changes

### 1. Mood Component Schema

**File**: `data/mods/core/components/mood.component.json`

Add the `uncertainty` property:

```json
"uncertainty": {
  "type": "integer",
  "minimum": -100,
  "maximum": 100,
  "default": 0,
  "description": "Model fit / cognitive clarity. +100 = highly uncertain / cannot integrate; -100 = highly certain / coherent model."
}
```

Update the `required` array:

```json
"required": [
  "valence",
  "arousal",
  "agency_control",
  "threat",
  "engagement",
  "future_expectancy",
  "self_evaluation",
  "affiliation",
  "inhibitory_control",
  "uncertainty"
]
```

### 2. Constants Update

**File**: `src/constants/moodAffectConstants.js`

```javascript
export const MOOD_AXES = Object.freeze([
  'valence',
  'arousal',
  'agency_control',
  'threat',
  'engagement',
  'future_expectancy',
  'self_evaluation',
  'affiliation',
  'inhibitory_control',
  'uncertainty',  // NEW
]);
```

### 3. Emotion Prototype Updates

**File**: `data/mods/core/lookups/emotion_prototypes.lookup.json`

#### Emotion Prototype Schema Update

Add `uncertainty` to the weights schema:

```json
"uncertainty": {
  "type": "number",
  "minimum": -1,
  "maximum": 1
}
```

#### Updated Emotion Prototypes

The following prototypes need `uncertainty` weights added:

| Prototype | Uncertainty Weight | Rationale |
|-----------|-------------------|-----------|
| **confusion** | 1.0 | Core epistemic state |
| **curiosity** | 0.7 | Engagement with unknown |
| **perplexity** | 0.9 | Strong uncertainty focus |
| **suspicion** | 0.6 | Uncertainty about others' intentions |
| **awe** | 0.5 | Overwhelming novelty/scale |
| **wonder** | 0.6 | Positive uncertainty |
| **doubt** | 0.8 | Self-directed uncertainty |
| **bewilderment** | 0.95 | Intense confusion |
| **disorientation** | 0.9 | Situational uncertainty |

**Confusion Prototype (Revised)**:

```json
"confusion": {
  "weights": {
    "uncertainty": 1.0,
    "engagement": 0.4,
    "arousal": 0.2,
    "agency_control": -0.2,
    "valence": -0.1,
    "inhibitory_control": 0.2
  },
  "gates": [
    "uncertainty >= 0.30"
  ]
}
```

**Curiosity Prototype (Revised)**:

```json
"curiosity": {
  "weights": {
    "uncertainty": 0.7,
    "engagement": 0.9,
    "valence": 0.3,
    "arousal": 0.4,
    "threat": -0.3
  },
  "gates": [
    "engagement >= 0.20",
    "threat <= 0.30"
  ]
}
```

**Suspicion Prototype (Revised)**:

```json
"suspicion": {
  "weights": {
    "uncertainty": 0.6,
    "threat": 0.5,
    "engagement": 0.4,
    "affiliation": -0.4,
    "valence": -0.2
  },
  "gates": [
    "threat >= 0.15",
    "uncertainty >= 0.20"
  ]
}
```

### 4. Affected Systems Checklist

Based on codebase grep for `MOOD_AXES` and `moodAxes`:

#### Source Files (29 files with MOOD_AXES)

| File | Change Required |
|------|-----------------|
| `src/constants/moodAffectConstants.js` | Add uncertainty to MOOD_AXES |
| `src/expressions/expressionContextBuilder.js` | Automatically handles via MOOD_AXES |
| `src/validation/expressionPrerequisiteValidator.js` | Automatically handles via MOOD_AXES |
| `src/expressionDiagnostics/services/RandomStateGenerator.js` | Automatically handles via MOOD_AXES |
| `src/expressionDiagnostics/services/simulatorCore/ContextBuilder.js` | Automatically handles via MOOD_AXES |
| `src/expressionDiagnostics/services/simulatorCore/GateEvaluator.js` | Automatically handles via MOOD_AXES |
| `src/expressionDiagnostics/services/prototypeOverlap/BehavioralOverlapEvaluator.js` | Verify handling |
| `cli/validation/modValidationOrchestrator.js` | Verify handling |

#### Test Files

| File | Change Required |
|------|-----------------|
| `tests/unit/constants/moodAffectConstants.test.js` | Update expected axis count (9→10) |
| `tests/unit/mods/core/components/mood.component.test.js` | Add uncertainty axis tests |
| `tests/unit/expressionDiagnostics/services/randomStateGenerator.test.js` | Verify axis coverage |
| `tests/unit/expressionDiagnostics/services/randomStateGenerator.completeness.test.js` | Verify completeness |
| `tests/unit/expressionDiagnostics/axisRegistryAudit.test.js` | Update axis audit expectations |
| `tests/integration/expression-diagnostics/monteCarloNewAxis.integration.test.js` | Verify new axis integration |

#### UI Files

| File | Change Required |
|------|-----------------|
| `expression-diagnostics.html` | UI automatically reads from MOOD_AXES |

### 5. Expression Files Audit

Many expression files reference `moodAxes.*` in prerequisites. These will automatically gain access to `moodAxes.uncertainty` once the axis is added. No changes required unless expressions want to use the new axis in prerequisites.

Expressions that might benefit from uncertainty constraints:
- `emotions-*/expressions/` - Various emotion expressions

### 6. Refactoring Opportunities

Before implementing, audit for code that could be refactored to prevent duplication when handling mood axes:

#### Pattern 1: Hardcoded Axis Lists

Search for hardcoded axis names that should reference `MOOD_AXES`:

```bash
grep -r "valence.*arousal.*agency_control" src/
```

#### Pattern 2: Manual Axis Iteration

Search for manual iteration that should use `MOOD_AXES.forEach()`:

```bash
grep -rn "valence\|arousal\|agency_control\|threat\|engagement" src/ | grep -v "import\|const\|MOOD_AXES"
```

#### Recommended Refactoring

If duplication is found, create helper utilities:

```javascript
// src/utils/moodAxisUtils.js
import { MOOD_AXES, MOOD_AXIS_RANGE, DEFAULT_MOOD_AXIS_VALUE } from '../constants/moodAffectConstants.js';

export function createDefaultMoodAxes() {
  return Object.fromEntries(
    MOOD_AXES.map(axis => [axis, DEFAULT_MOOD_AXIS_VALUE])
  );
}

export function validateMoodAxes(moodAxes) {
  return MOOD_AXES.every(axis =>
    typeof moodAxes[axis] === 'number' &&
    moodAxes[axis] >= MOOD_AXIS_RANGE.min &&
    moodAxes[axis] <= MOOD_AXIS_RANGE.max
  );
}
```

## Implementation Plan

### Phase 1: Test Coverage Audit (BEFORE any changes)

1. **Run existing tests**: `npm run test:unit && npm run test:integration`
2. **Document current test coverage** for mood-related code
3. **Identify gaps** in integration test coverage
4. **Create missing integration tests** for mood axis handling

### Phase 2: Core Changes

1. Update `mood.component.json` schema
2. Update `moodAffectConstants.js` constants
3. Update `emotion_prototypes.lookup.json` schema and entries

### Phase 3: Refactoring (if needed)

1. Audit for duplicated axis handling code
2. Extract reusable utilities
3. Update all callers to use utilities

### Phase 4: Test Updates

1. Update unit tests for new axis count
2. Add specific uncertainty axis tests
3. Run full test suite
4. Add integration tests for uncertainty in expressions

### Phase 5: Validation

1. Run `npm run validate` for schema validation
2. Run Monte Carlo simulation to verify uncertainty axis sampling
3. Test expression diagnostics UI with new axis
4. Verify prototype overlap analysis handles new axis

## Testing Strategy

### Unit Tests

```javascript
// tests/unit/constants/moodAffectConstants.test.js
describe('MOOD_AXES', () => {
  it('should include uncertainty axis', () => {
    expect(MOOD_AXES).toContain('uncertainty');
  });

  it('should have 10 axes total', () => {
    expect(MOOD_AXES).toHaveLength(10);
  });
});

// tests/unit/mods/core/components/mood.component.test.js
describe('mood.component.json', () => {
  it('should validate uncertainty axis in range [-100, 100]', () => {
    // Test valid values
    expect(validate({ ...validMood, uncertainty: 0 })).toBe(true);
    expect(validate({ ...validMood, uncertainty: -100 })).toBe(true);
    expect(validate({ ...validMood, uncertainty: 100 })).toBe(true);

    // Test invalid values
    expect(validate({ ...validMood, uncertainty: -101 })).toBe(false);
    expect(validate({ ...validMood, uncertainty: 101 })).toBe(false);
  });
});
```

### Integration Tests

```javascript
// tests/integration/expression-diagnostics/uncertaintyAxis.integration.test.js
describe('Uncertainty Axis Integration', () => {
  it('should include uncertainty in Monte Carlo random states', async () => {
    const generator = container.resolve(tokens.IRandomStateGenerator);
    const state = generator.generateState();

    expect(state.moodAxes).toHaveProperty('uncertainty');
    expect(state.moodAxes.uncertainty).toBeGreaterThanOrEqual(-100);
    expect(state.moodAxes.uncertainty).toBeLessThanOrEqual(100);
  });

  it('should evaluate uncertainty gates in expressions', async () => {
    const evaluator = container.resolve(tokens.IExpressionEvaluator);
    const expression = {
      prerequisites: [
        { ">=": [{ "var": "moodAxes.uncertainty" }, 30] }
      ]
    };

    // Low uncertainty - should fail
    const lowUncertaintyContext = { moodAxes: { uncertainty: 10 } };
    expect(evaluator.evaluate(expression, lowUncertaintyContext)).toBe(false);

    // High uncertainty - should pass
    const highUncertaintyContext = { moodAxes: { uncertainty: 50 } };
    expect(evaluator.evaluate(expression, highUncertaintyContext)).toBe(true);
  });

  it('should correctly calculate confusion with uncertainty axis', async () => {
    const calculator = container.resolve(tokens.IPrototypeIntensityCalculator);

    // High uncertainty, moderate engagement - confusion should be high
    const confusedState = {
      moodAxes: {
        uncertainty: 80,
        engagement: 40,
        arousal: 20,
        agency_control: -10,
        valence: -5,
        inhibitory_control: 20,
        // ... other axes at 0
      }
    };

    const intensity = calculator.calculate('confusion', confusedState);
    expect(intensity).toBeGreaterThan(0.5);
  });
});
```

## Edge Cases

### Backward Compatibility

- Existing expressions without uncertainty constraints will continue to work
- Emotion prototypes without uncertainty weights will treat it as 0 contribution
- Saved game states without uncertainty will need migration (default to 0)

### Save Game Migration

If save games persist mood state, add migration logic:

```javascript
function migrateMoodState(savedMood) {
  if (savedMood.uncertainty === undefined) {
    savedMood.uncertainty = 0; // Default: neutral certainty
  }
  return savedMood;
}
```

### Prototype Weight Normalization

When adding uncertainty to prototypes, ensure weight normalization is consistent with existing prototypes to avoid inflation/deflation of emotion intensities.

## Success Criteria

1. **Functional**: Uncertainty axis works in all mood-related systems
2. **Distinct**: Confusion is measurably distinct from frustration in prototype analysis
3. **Complete**: All 10 axes appear in:
   - Component schema
   - Constants array
   - Random state generator
   - Expression context builder
   - Diagnostic tools
4. **Tested**: All existing tests pass + new uncertainty-specific tests pass
5. **Backward Compatible**: Existing expressions and save games continue to work

## Open Questions

1. **Default Value**: Should uncertainty default to 0 (neutral) or a slight negative (-10 = slight certainty)?
   - **Recommendation**: 0 (neutral), consistent with other axes

2. **Polarity**: The document suggests `uncertainty: -100 = certain, +100 = uncertain`. Should we use `cognitive_clarity` instead with inverted polarity?
   - **Recommendation**: Keep `uncertainty` with positive = uncertain. This matches threat (positive = endangered) pattern.

3. **Affect Trait Interaction**: Should there be a new affect trait like `uncertainty_tolerance` that modulates how beings respond to uncertainty?
   - **Recommendation**: Defer to future spec. Focus on the mood axis first.

## Related Documentation

- `docs/modding/mood-system.md` - Mood system documentation (update needed)
- `brainstorming/uncertainty-axis.md` - Original design discussion
- `archive/inhibitory-control-axis-and-self-control-trait.md` - Previous axis addition for reference
