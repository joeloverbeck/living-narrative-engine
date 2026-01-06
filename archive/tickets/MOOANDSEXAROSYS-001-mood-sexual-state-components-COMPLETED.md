# MOOANDSEXAROSYS-001: Mood and Sexual State Component Definitions

## Status: ✅ COMPLETED

## Summary

Create the two core data components (`core:mood` and `core:sexual_state`) that store character emotional and sexual state, along with their constant IDs.

## Files to Touch

### CREATE

- `data/mods/core/components/mood.component.json`
- `data/mods/core/components/sexual_state.component.json`

### MODIFY

- `src/constants/componentIds.js` - Add 2 new constant exports

## Out of Scope

- Lookup definitions (emotion_prototypes, sexual_prototypes) - see MOOANDSEXAROSYS-002
- EmotionCalculatorService implementation - see MOOANDSEXAROSYS-003
- ActorDataExtractor integration - see MOOANDSEXAROSYS-004
- UI panels - see MOOANDSEXAROSYS-009, MOOANDSEXAROSYS-010
- DI registration of services
- Prompt instructions
- LLM response schema changes

## Technical Specification

### mood.component.json Schema

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:mood",
  "description": "Tracks the 7 emotional axes that define a character's current mood state. Each axis ranges from -100 to +100.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "valence": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Pleasant (+) to unpleasant (-). Overall hedonic tone."
      },
      "arousal": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Energized (+) to depleted (-). Activation level."
      },
      "agency_control": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Dominant/in-control (+) to helpless (-). Felt power."
      },
      "threat": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Endangered (+) to safe (-). Perceived danger."
      },
      "engagement": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Absorbed (+) to indifferent (-). Attentional capture."
      },
      "future_expectancy": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Hopeful (+) to hopeless (-). Belief in positive outcomes."
      },
      "self_evaluation": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Pride (+) to shame (-). Momentary self-worth."
      }
    },
    "required": ["valence", "arousal", "agency_control", "threat", "engagement", "future_expectancy", "self_evaluation"],
    "additionalProperties": false
  }
}
```

### sexual_state.component.json Schema

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:sexual_state",
  "description": "Tracks sexual arousal-related values using the dual-control model (excitation/inhibition).",
  "dataSchema": {
    "type": "object",
    "properties": {
      "sex_excitation": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 0,
        "description": "Sexual response activation (accelerator). 0=none, 100=fully activated."
      },
      "sex_inhibition": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 0,
        "description": "Sexual response suppression (brake). 0=no brakes, 100=fully suppressed."
      },
      "baseline_libido": {
        "type": "integer",
        "minimum": -50,
        "maximum": 50,
        "default": 0,
        "description": "Trait-level sexual drive modifier. Negative=low drive, positive=high drive."
      }
    },
    "required": ["sex_excitation", "sex_inhibition", "baseline_libido"],
    "additionalProperties": false
  }
}
```

### componentIds.js Additions

```javascript
// Emotional system components
export const MOOD_COMPONENT_ID = 'core:mood';
export const SEXUAL_STATE_COMPONENT_ID = 'core:sexual_state';
```

## Acceptance Criteria

### Validation

- [x] `npm run validate` passes with no errors
- [x] Both component JSON files are valid against `component.schema.json`
- [x] `additionalProperties: false` enforced on both component dataSchemas

### Constants

- [x] `MOOD_COMPONENT_ID` constant exported from `src/constants/componentIds.js`
- [x] `SEXUAL_STATE_COMPONENT_ID` constant exported from `src/constants/componentIds.js`
- [x] Constants use correct namespaced format: `core:mood`, `core:sexual_state`

### Mood Component Invariants

- [x] All 7 axes defined: `valence`, `arousal`, `agency_control`, `threat`, `engagement`, `future_expectancy`, `self_evaluation`
- [x] Each axis is type `integer` with range `[-100, 100]`
- [x] Each axis has `default: 0`
- [x] All 7 axes are in `required` array

### Sexual State Component Invariants

- [x] 3 properties defined: `sex_excitation`, `sex_inhibition`, `baseline_libido`
- [x] `sex_excitation` and `sex_inhibition` are type `integer` with range `[0, 100]`
- [x] `baseline_libido` is type `integer` with range `[-50, 50]`
- [x] All 3 properties have appropriate defaults (0)
- [x] All 3 properties are in `required` array

### Test Commands

```bash
# Validate mod structure
npm run validate

# Verify constants are exported (using ESM import)
node --input-type=module -e "import * as c from './src/constants/componentIds.js'; console.log(c.MOOD_COMPONENT_ID, c.SEXUAL_STATE_COMPONENT_ID)"

# Run unit tests for component validation
npm run test:unit -- --testPathPattern="componentIds|mood|sexual_state" --passWithNoTests
```

## Dependencies

- None (this is a foundational ticket)

## Dependent Tickets

- MOOANDSEXAROSYS-002 (lookups reference these component structures)
- MOOANDSEXAROSYS-003 (EmotionCalculatorService reads these components)
- MOOANDSEXAROSYS-004 (ActorDataExtractor extracts from these components)
- MOOANDSEXAROSYS-007 (MoodUpdateWorkflow updates these components)
- MOOANDSEXAROSYS-009 (EmotionalStatePanel displays mood component)
- MOOANDSEXAROSYS-010 (SexualStatePanel displays sexual_state component)

---

## Outcome

### Implementation Date: 2026-01-05

### What Was Changed vs. Originally Planned

**Planned Changes - All Implemented:**

1. ✅ Created `data/mods/core/components/mood.component.json` - Exact schema as specified
2. ✅ Created `data/mods/core/components/sexual_state.component.json` - Exact schema as specified
3. ✅ Added `MOOD_COMPONENT_ID` and `SEXUAL_STATE_COMPONENT_ID` constants to `src/constants/componentIds.js`

**Additional Changes Required (Not Originally Specified):**

4. ✅ Updated `data/mods/core/mod-manifest.json` to register the new component files
   - Reason: Components must be registered in the mod manifest to be loaded

**Ticket Corrections:**

5. ✅ Fixed Test Commands section: Changed CommonJS `require()` syntax to ESM-compatible `import` syntax
   - Original: `node -e "const c = require('./src/constants/componentIds.js')..."`
   - Fixed: `node --input-type=module -e "import * as c from './src/constants/componentIds.js'..."`
   - Reason: Project uses ES modules exclusively

### Tests Created

| Test File | Test Count | Rationale |
|-----------|------------|-----------|
| `tests/unit/mods/core/components/mood.component.test.js` | 32 tests | Validates all 7 axes for range limits, type enforcement, required fields, and additionalProperties rejection |
| `tests/unit/mods/core/components/sexualState.component.test.js` | 29 tests | Validates sex_excitation [0-100], sex_inhibition [0-100], baseline_libido [-50,50] ranges, type enforcement, required fields |

**Test Coverage:**
- Valid data acceptance (all combinations of boundary values)
- Required field validation (each field tested for absence)
- Range validation (minimum -1, maximum +1 rejection)
- Type validation (float, string, null rejection)
- additionalProperties rejection
- Edge cases (empty object, boundary values)

### Validation Results

```
✅ npm run validate: 0 violations, 0 unregistered files
✅ Constants export verification: core:mood core:sexual_state
✅ All 61 tests pass
```
