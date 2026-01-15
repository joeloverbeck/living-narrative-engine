# Specification: Inhibitory Control Mood Axis and Self-Control Affect Trait

## Problem Statement

The current emotion and expression system lacks a **regulation dimension** that can independently represent impulse control states. The Monte Carlo diagnostic system has identified "rarity cliffs" when attempting to model states like "anger high but expression inhibited" (suppressed rage) because the system must fake this using agency/threat/arousal combinations.

### Core Issue

Without an explicit inhibitory control signal, we cannot cleanly represent:
- **Suppressed rage**: High anger + high inhibition/restraint
- **Explosive rage**: High anger + low inhibition
- **White-knuckling**: Tightly restrained impulses regardless of underlying emotion
- **Disinhibited states**: Impulsive behavior without emotional collapse

The missing signal is **inhibitory control/effortful control** - not to be confused with BIS (Behavioral Inhibition System) or sexual inhibition variables already in the system.

### Psychological Foundation

This change implements a clean two-level model that matches psychological research:
- **Trait (self_control)**: Baseline temperament / regulatory capacity (stable, enduring)
- **State axis (inhibitory_control)**: Situational restraint right now (transient, moment-to-moment)

---

## Current Architecture

### Mood Component (8 axes)

**File**: `data/mods/core/components/mood.component.json`

Current axes (all integer, range -100 to +100):
1. `valence` - Pleasant (+) to unpleasant (-)
2. `arousal` - Energized (+) to depleted (-)
3. `agency_control` - Dominant (+) to helpless (-)
4. `threat` - Endangered (+) to safe (-)
5. `engagement` - Absorbed (+) to indifferent (-)
6. `future_expectancy` - Hopeful (+) to hopeless (-)
7. `self_evaluation` - Pride (+) to shame (-)
8. `affiliation` - Warm/connected (+) to cold/hostile (-)

### Affect Traits Component (3 traits)

**File**: `data/mods/core/components/affect_traits.component.json`

Current traits (all integer, range 0 to 100, default 50):
1. `affective_empathy` - Capacity to feel what others feel
2. `cognitive_empathy` - Ability to understand others' perspectives
3. `harm_aversion` - Aversion to causing harm to others

### Hardcoded Axis/Trait References

The following files contain hardcoded references to mood axes or affect traits:

| File | Type | Description |
|------|------|-------------|
| `src/expressionDiagnostics/services/RandomStateGenerator.js` | Array constants | `MOOD_AXES` and `AFFECT_TRAITS` arrays |
| `src/expressionDiagnostics/utils/axisNormalizationUtils.js` | Default values | `DEFAULT_AFFECT_TRAITS` object |
| `src/domUI/emotionalStatePanel.js` | UI constants | `AXIS_COLORS`, `AXIS_LABELS`, `AXIS_ORDER` |
| `data/prompts/corePromptText.json` | LLM prompts | `moodUpdateOnlyInstructionText` field |

---

## Implementation Design

### Phase 1: Schema Updates

#### 1.1 Update mood.component.json

Add `inhibitory_control` axis:

```json
{
  "inhibitory_control": {
    "type": "integer",
    "minimum": -100,
    "maximum": 100,
    "default": 0,
    "description": "Momentary restraint/response inhibition. +100=tightly restrained/white-knuckling; 0=baseline; -100=disinhibited/impulsive."
  }
}
```

Update `required` array to include `"inhibitory_control"`.

Update component description from "8 emotional axes" to "9 mood axes that define a character's current affective/regulatory state".

#### 1.2 Update affect_traits.component.json

Add `self_control` trait:

```json
{
  "self_control": {
    "type": "integer",
    "minimum": 0,
    "maximum": 100,
    "default": 50,
    "description": "Baseline impulse control / self-regulation capacity. Biases inhibitory_control and dampens disinhibition under arousal/threat. (0=highly impulsive, 50=average, 100=highly self-controlled)"
  }
}
```

Update `required` array to include `"self_control"`.

Update component description to mention "regulatory capacity".

---

### Phase 2: Code Updates - Monte Carlo / Expression Diagnostics

#### 2.1 RandomStateGenerator.js

**File**: `src/expressionDiagnostics/services/RandomStateGenerator.js`

Update `MOOD_AXES` constant (line ~13):
```javascript
const MOOD_AXES = [
  'valence',
  'arousal',
  'agency_control',
  'threat',
  'engagement',
  'future_expectancy',
  'self_evaluation',
  'affiliation',
  'inhibitory_control',  // NEW
];
```

Update `AFFECT_TRAITS` constant (line ~23):
```javascript
const AFFECT_TRAITS = [
  'affective_empathy',
  'cognitive_empathy',
  'harm_aversion',
  'self_control',  // NEW
];
```

#### 2.2 axisNormalizationUtils.js

**File**: `src/expressionDiagnostics/utils/axisNormalizationUtils.js`

Update `DEFAULT_AFFECT_TRAITS` constant (line ~5):
```javascript
const DEFAULT_AFFECT_TRAITS = Object.freeze({
  affective_empathy: 50,
  cognitive_empathy: 50,
  harm_aversion: 50,
  self_control: 50,  // NEW
});
```

---

### Phase 3: UI Updates

#### 3.1 emotionalStatePanel.js

**File**: `src/domUI/emotionalStatePanel.js`

Update `AXIS_COLORS` constant to include `inhibitory_control`:
```javascript
const AXIS_COLORS = {
  valence: { positive: '#4CAF50', negative: '#f44336' },
  arousal: { positive: '#FF9800', negative: '#2196F3' },
  agency_control: { positive: '#9C27B0', negative: '#607D8B' },
  threat: { positive: '#E91E63', negative: '#00BCD4' },
  engagement: { positive: '#FFEB3B', negative: '#9E9E9E' },
  future_expectancy: { positive: '#8BC34A', negative: '#795548' },
  self_evaluation: { positive: '#00E676', negative: '#FF5722' },
  affiliation: { positive: '#03A9F4', negative: '#880E4F' },
  inhibitory_control: { positive: '#7E57C2', negative: '#FF7043' },  // NEW: Purple for restrained, orange for impulsive
};
```

Update `AXIS_LABELS` constant:
```javascript
const AXIS_LABELS = {
  valence: 'Valence',
  arousal: 'Arousal',
  agency_control: 'Agency',
  threat: 'Threat',
  engagement: 'Engagement',
  future_expectancy: 'Future',
  self_evaluation: 'Self-Eval',
  affiliation: 'Affiliation',
  inhibitory_control: 'Inhib. Control',  // NEW
};
```

Update `AXIS_ORDER` array to include `'inhibitory_control'` at the end.

#### 3.2 ExpressionsSimulatorController.js

**File**: `src/domUI/expressions-simulator/ExpressionsSimulatorController.js`

This file reads axes/traits dynamically from component schemas via `#getComponentSchema()` and `#renderComponentInputs()`. The new axis and trait should be automatically included without code changes, provided the component schemas are updated correctly.

**Verification needed**: Confirm that `#renderComponentInputs()` iterates over all schema properties dynamically.

---

### Phase 4: LLM Prompt Updates

#### 4.1 corePromptText.json

**File**: `data/prompts/corePromptText.json`

Update `moodUpdateOnlyInstructionText` field to include `inhibitory_control`:

Add to RANGES section:
```
- Mood axes (valence, arousal, agency_control, threat, engagement, future_expectancy, self_evaluation, affiliation, inhibitory_control): integers [-100..100]
```

Add to AXIS DEFINITIONS section:
```
Inhibitory Control: + = tightly restrained/white-knuckling, - = disinhibited/impulsive
```

Add to OUTPUT FORMAT section:
```json
{
  "moodUpdate": { "valence": ..., "arousal": ..., "agency_control": ..., "threat": ..., "engagement": ..., "future_expectancy": ..., "self_evaluation": ..., "affiliation": ..., "inhibitory_control": ... },
  "sexualUpdate": { "sex_excitation": ..., "sex_inhibition": ... }
}
```

Add to DEFAULT UPDATE HEURISTICS section:
```
- Losing temper/exploding: Inhibitory Control down, Arousal up
- Deliberately holding back reaction: Inhibitory Control up
- Under stress but maintaining composure: Inhibitory Control up, Threat may be up
- Release of suppressed emotion: Inhibitory Control down sharply
```

---

### Phase 5: Entity Definition Updates

#### 5.1 Update existing character entities

Any character entity definitions that include `core:affect_traits` must add the `self_control` field.

**File**: `data/mods/alicia/entities/definitions/alicia_western.character.json`

Update the `core:affect_traits` component:
```json
"core:affect_traits": {
    "affective_empathy": 60,
    "cognitive_empathy": 88,
    "harm_aversion": 85,
    "self_control": 72  // NEW - Alicia has high self-control due to her disciplined mathematical mind
}
```

**Note**: Search for all entity definitions that include `core:affect_traits` and add appropriate `self_control` values based on character personality.

---

## Files to Modify

### Component Schemas
1. `data/mods/core/components/mood.component.json` - Add `inhibitory_control` axis
2. `data/mods/core/components/affect_traits.component.json` - Add `self_control` trait

### Monte Carlo / Expression Diagnostics
3. `src/expressionDiagnostics/services/RandomStateGenerator.js` - Update `MOOD_AXES` and `AFFECT_TRAITS` arrays
4. `src/expressionDiagnostics/utils/axisNormalizationUtils.js` - Update `DEFAULT_AFFECT_TRAITS`

### UI Components
5. `src/domUI/emotionalStatePanel.js` - Update `AXIS_COLORS`, `AXIS_LABELS`, `AXIS_ORDER`

### LLM Prompts
6. `data/prompts/corePromptText.json` - Update `moodUpdateOnlyInstructionText`

### Entity Definitions
7. `data/mods/alicia/entities/definitions/alicia_western.character.json` - Add `self_control` value
8. Any other entity definitions with `core:affect_traits` (search required)

---

## Testing Strategy

### Unit Tests

#### Test File: `tests/unit/expressionDiagnostics/services/randomStateGenerator.test.js`

**New tests required**:
1. **Test**: Generated mood states include `inhibitory_control`
   - Verify `generate()` returns mood objects with all 9 axes including `inhibitory_control`
   - Verify `inhibitory_control` values are within [-100, 100] range

2. **Test**: Generated affect traits include `self_control`
   - Verify `generate()` returns affectTraits objects with all 4 traits including `self_control`
   - Verify `self_control` values are within [0, 100] range

3. **Test**: Dynamic sampling includes new axis
   - Verify both 'static' and 'dynamic' sampling modes include `inhibitory_control`
   - Verify temporal correlation works for `inhibitory_control` in dynamic mode

#### Test File: `tests/unit/expressionDiagnostics/utils/axisNormalizationUtils.test.js`

**New tests required**:
1. **Test**: DEFAULT_AFFECT_TRAITS includes self_control
   - Verify `DEFAULT_AFFECT_TRAITS.self_control === 50`

2. **Test**: normalizeAffectTraits handles self_control
   - Verify missing `self_control` gets default value
   - Verify provided `self_control` is correctly normalized to [0, 1] range

#### Test File: `tests/unit/domUI/emotionalStatePanel.test.js`

**New tests required**:
1. **Test**: AXIS_COLORS includes inhibitory_control
   - Verify `AXIS_COLORS.inhibitory_control` has positive and negative colors

2. **Test**: AXIS_LABELS includes inhibitory_control
   - Verify `AXIS_LABELS.inhibitory_control` exists

3. **Test**: AXIS_ORDER includes inhibitory_control
   - Verify `AXIS_ORDER` array contains `'inhibitory_control'`

4. **Test**: Panel renders inhibitory_control slider
   - Mock mood component data with `inhibitory_control`
   - Verify slider element is created with correct colors and label

### Integration Tests

#### Test File: `tests/integration/expressionDiagnostics/monteCarloWithNewAxis.integration.test.js`

**New tests required**:
1. **Test**: Monte Carlo sampler includes inhibitory_control in simulation
   - Run Monte Carlo simulation
   - Verify generated contexts include `moodAxes.inhibitory_control`
   - Verify inhibitory_control participates in prototype matching

2. **Test**: Expression evaluation with inhibitory_control constraint
   - Create expression with `inhibitory_control` prerequisite
   - Verify expression passes/fails based on `inhibitory_control` value

3. **Test**: Affect traits with self_control in simulation
   - Verify generated contexts include `affectTraits.self_control`
   - Verify self_control participates in affect-based prerequisites

#### Test File: `tests/integration/llm/moodUpdateWithInhibitoryControl.integration.test.js`

**New tests required**:
1. **Test**: LLM response schema accepts inhibitory_control
   - Verify moodUpdate response schema validates with `inhibitory_control` field
   - Verify response without `inhibitory_control` fails validation (if required)

2. **Test**: Mood persistence includes inhibitory_control
   - Trigger mood update with `inhibitory_control` value
   - Verify entity's mood component is updated with new value

### Schema Validation Tests

#### Test File: `tests/unit/validation/componentSchemas.test.js`

**New tests required**:
1. **Test**: mood.component.json validates with inhibitory_control
   - Verify schema accepts objects with all 9 axes
   - Verify schema rejects objects missing `inhibitory_control` (required field)
   - Verify schema rejects `inhibitory_control` outside [-100, 100]

2. **Test**: affect_traits.component.json validates with self_control
   - Verify schema accepts objects with all 4 traits
   - Verify schema rejects objects missing `self_control` (required field)
   - Verify schema rejects `self_control` outside [0, 100]

### Manual Verification

1. **Game UI (game.html)**:
   - Load game with a character
   - Verify EMOTIONAL STATE panel shows 9 sliders including "Inhib. Control"
   - Verify slider colors are purple/orange gradient
   - Verify slider responds to mood changes

2. **Expressions Simulator (expressions-simulator.html)**:
   - Load simulator
   - Verify Mood Axes panel shows 9 sliders including "inhibitory_control"
   - Verify Affect Traits panel shows 4 sliders including "self_control"
   - Verify recording state captures new axis/trait
   - Run expression evaluation and verify new dimensions participate

3. **LLM Integration**:
   - Start game and trigger NPC turn
   - Verify LLM response includes `inhibitory_control` in `moodUpdate`
   - Verify mood persistence updates `inhibitory_control` on entity

---

## Implementation Tickets

### Ticket 1: Schema Updates
- [ ] Update `mood.component.json` with `inhibitory_control`
- [ ] Update `affect_traits.component.json` with `self_control`
- [ ] Run `npm run validate` to verify schema validity

### Ticket 2: Monte Carlo Code Updates
- [ ] Update `RandomStateGenerator.js` arrays
- [ ] Update `axisNormalizationUtils.js` defaults
- [ ] Run unit tests to verify no regressions

### Ticket 3: UI Updates
- [ ] Update `emotionalStatePanel.js` constants
- [ ] Verify expressions-simulator.html works with new dimensions
- [ ] Manual UI verification

### Ticket 4: LLM Prompt Updates
- [ ] Update `corePromptText.json` with new axis documentation
- [ ] Test LLM response format

### Ticket 5: Entity Definition Updates
- [ ] Update `alicia_western.character.json` with `self_control`
- [ ] Search and update any other entities with `core:affect_traits`

### Ticket 6: Comprehensive Testing
- [ ] Write unit tests for RandomStateGenerator
- [ ] Write unit tests for axisNormalizationUtils
- [ ] Write unit tests for emotionalStatePanel
- [ ] Write integration tests for Monte Carlo
- [ ] Write schema validation tests
- [ ] Manual verification of UI components

---

## Design Decisions

### Why "inhibitory_control" naming?

- Avoids collision with "behavioral inhibition" (BIS / Kagan BI) naming
- Avoids confusion with existing `sex_inhibition` variable
- Matches psychological literature on effortful control
- Clear semantic meaning: momentary ability/willingness to clamp impulses

### Why range -100 to +100 for inhibitory_control?

- Consistency with other mood axes
- Allows representation of both extremes:
  - +100: White-knuckling, extreme restraint
  - -100: Completely disinhibited, impulsive
- Zero represents baseline (neither suppressing nor releasing)

### Why range 0 to 100 for self_control trait?

- Consistency with other affect traits
- Traits are capacities, not bipolar states
- Zero means "no self-control capacity" (not "negative self-control")
- Default 50 represents average human regulatory capacity

### Why self_control biases but doesn't dictate inhibitory_control?

- Psychological accuracy: trait sets baseline, state responds to situation
- High self-control trait means easier to reach high inhibitory_control state
- Low self-control trait means more prone to disinhibition under stress
- Allows for situational override (even disciplined people can lose control)

---

## Error Handling

### Backward Compatibility

- Existing entity definitions without `inhibitory_control` in mood will get default value (0)
- Existing entity definitions without `self_control` in affect_traits will get default value (50)
- Expression prerequisites referencing only old axes will continue to work
- Monte Carlo will automatically include new dimensions

### Schema Validation Failures

If validation fails after updates:
1. Check that all required fields are present in component schemas
2. Verify entity definitions include new fields if explicitly setting affect_traits
3. Run `npm run validate` to identify specific validation errors

### LLM Response Handling

If LLM responses don't include `inhibitory_control`:
1. The mood persistence system should handle missing fields gracefully
2. Missing fields should be ignored (not cause errors)
3. Log warning if expected field is missing

---

## References

- Brainstorming document: `brainstorming/new-mood-axis-and-affect-trait.md`
- Monte Carlo specs: `specs/monte-carlo-advanced-metrics.md`
- Expression diagnostics: `src/expressionDiagnostics/`
- Psychological research: Effortful control and self-regulation literature
