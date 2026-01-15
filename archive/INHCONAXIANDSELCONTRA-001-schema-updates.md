# INHCONAXIANDSELCONTRA-001: Schema Updates - Add inhibitory_control and self_control

## Summary

Add the `inhibitory_control` mood axis to `mood.component.json` and the `self_control` affect trait to `affect_traits.component.json`. This establishes the data foundation for the entire inhibitory control feature.

## Priority: High | Effort: Low

## Rationale

The Monte Carlo diagnostic system has identified "rarity cliffs" when attempting to model states like "suppressed rage" (high anger + high inhibition). Without an explicit inhibitory control signal, we cannot cleanly represent:
- Suppressed rage: High anger + high inhibition/restraint
- Explosive rage: High anger + low inhibition
- White-knuckling: Tightly restrained impulses regardless of underlying emotion
- Disinhibited states: Impulsive behavior without emotional collapse

This implements a clean two-level psychological model:
- **Trait (self_control)**: Baseline temperament / regulatory capacity (stable, enduring)
- **State axis (inhibitory_control)**: Situational restraint right now (transient, moment-to-moment)

## Files to Touch

| File | Change Type |
|------|-------------|
| `data/mods/core/components/mood.component.json` | **Modify** - Add `inhibitory_control` axis |
| `data/mods/core/components/affect_traits.component.json` | **Modify** - Add `self_control` trait |
| `tests/unit/mods/core/components/mood.component.test.js` | **Modify** - Update test data to include `inhibitory_control` (required by schema) |
| `tests/unit/schemas/core-and-anatomy.allComponents.schema.test.js` | **Modify** - Update test data to include new fields |
| `tests/unit/prompting/moodUpdateInstructions.affiliationAxis.test.js` | **Modify** - Update test data to include `inhibitory_control` |

## Out of Scope

- **DO NOT** modify any JavaScript/TypeScript source files - that's INHCONAXIANDSELCONTRA-002, 003
- **DO NOT** modify UI components - that's INHCONAXIANDSELCONTRA-003
- **DO NOT** modify LLM prompts - that's INHCONAXIANDSELCONTRA-004
- **DO NOT** modify entity definitions - that's INHCONAXIANDSELCONTRA-005
- **DO NOT** write new tests - that's INHCONAXIANDSELCONTRA-006, 007, 008

**EXCEPTION**: Existing tests that validate the mood/affect_traits schema structure must be updated to include the new fields, as they will fail due to missing required fields. This is a necessary consequence of schema changes, not new test development.

## Implementation Details

### Modify: data/mods/core/components/mood.component.json

Add `inhibitory_control` as the 9th mood axis in the `properties` object:

```json
"inhibitory_control": {
  "type": "integer",
  "minimum": -100,
  "maximum": 100,
  "default": 0,
  "description": "Momentary restraint/response inhibition. +100=tightly restrained/white-knuckling; 0=baseline; -100=disinhibited/impulsive."
}
```

**Also update:**
1. Add `"inhibitory_control"` to the `required` array
2. Update the component `description` from "8 emotional axes" to "9 mood axes that define a character's current affective/regulatory state"

### Modify: data/mods/core/components/affect_traits.component.json

Add `self_control` as the 4th affect trait in the `properties` object:

```json
"self_control": {
  "type": "integer",
  "minimum": 0,
  "maximum": 100,
  "default": 50,
  "description": "Baseline impulse control / self-regulation capacity. Biases inhibitory_control and dampens disinhibition under arousal/threat. (0=highly impulsive, 50=average, 100=highly self-controlled)"
}
```

**Also update:**
1. Add `"self_control"` to the `required` array
2. Update component `description` to mention "regulatory capacity": "Stable personality traits affecting empathy, moral emotion capacity, and regulatory capacity. Unlike mood (transient states), these traits rarely change and represent enduring character attributes."

## Acceptance Criteria

### Specific Tests That Must Pass

1. **Schema validation passes:**
   ```bash
   npm run validate
   ```

2. **Schema validates correctly formed data:**
   - Mood object with all 9 axes including `inhibitory_control` should be valid
   - Mood object missing `inhibitory_control` should be invalid (required field)
   - `inhibitory_control` value of -101 or 101 should be invalid (range check)
   - Affect traits object with all 4 traits including `self_control` should be valid
   - Affect traits object missing `self_control` should be invalid (required field)
   - `self_control` value of -1 or 101 should be invalid (range check)

3. **Existing tests still pass:**
   ```bash
   npm run test:unit -- --testPathPattern="validation" --verbose
   ```

### Invariants That Must Remain True

1. **Schema Structure**: `additionalProperties: false` must remain for both schemas
2. **Range Consistency**: `inhibitory_control` follows bipolar [-100, 100] like other mood axes
3. **Range Consistency**: `self_control` follows unipolar [0, 100] like other affect traits
4. **Default Values**: `inhibitory_control` defaults to 0 (baseline); `self_control` defaults to 50 (average)
5. **Backward Compatibility**: Existing entity definitions without these fields will use defaults

## Verification Commands

```bash
# Validate all schemas
npm run validate

# Validate strict mode
npm run validate:strict

# Run validation-related unit tests
npm run test:unit -- --testPathPattern="validation" --verbose

# Run all unit tests to check for regressions
npm run test:unit
```

## Definition of Done

- [x] `mood.component.json` has `inhibitory_control` property with correct schema
- [x] `mood.component.json` `required` array includes `"inhibitory_control"`
- [x] `mood.component.json` description updated to "9 mood axes"
- [x] `affect_traits.component.json` has `self_control` property with correct schema
- [x] `affect_traits.component.json` `required` array includes `"self_control"`
- [x] `affect_traits.component.json` description mentions "regulatory capacity"
- [x] `npm run validate` passes
- [x] No existing tests broken by schema changes (tests updated to include new required fields)

## Status: ✅ COMPLETED

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned (2 files):**
- `data/mods/core/components/mood.component.json` - Add `inhibitory_control` axis
- `data/mods/core/components/affect_traits.component.json` - Add `self_control` trait

**Actually Changed (5 files):**
1. `data/mods/core/components/mood.component.json` - Added `inhibitory_control` axis as planned
2. `data/mods/core/components/affect_traits.component.json` - Added `self_control` trait as planned
3. `tests/unit/mods/core/components/mood.component.test.js` - Updated test fixtures to include `inhibitory_control` (schema requires it)
4. `tests/unit/schemas/core-and-anatomy.allComponents.schema.test.js` - Updated test fixtures for both `core:mood` and `core:affect_traits`
5. `tests/unit/prompting/moodUpdateInstructions.affiliationAxis.test.js` - Updated axis count from 8 to 9

### Key Discovery

The original ticket contained conflicting requirements:
- "Out of Scope: DO NOT write any tests"
- "Acceptance Criteria: No existing tests broken by schema changes"

These are mutually exclusive when schema changes add **required fields**. The ticket was corrected to add an exception: existing tests that validate schema structure must be updated as a direct consequence of schema changes (not new test development).

### Verification Results

- ✅ `npm run validate` - All 181 mods validated, 0 violations
- ✅ `npm run test:unit` - 47,109 tests passed (2,483 test suites)
