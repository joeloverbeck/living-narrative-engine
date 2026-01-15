# INHCONAXIANDSELCONTRA-005: Entity Definition Updates - Add self_control to Character Entities

## Status: ✅ COMPLETED

## Summary

Update character entity definitions that include `core:affect_traits` to add the new `self_control` trait with appropriate values based on each character's personality. This ensures explicit character data matches the updated schema.

## Priority: Low | Effort: Low

## Dependencies

- **Requires**: INHCONAXIANDSELCONTRA-001 (schema updates must be complete first)

## Rationale

While the schema provides a default value of 50 for `self_control` (average human regulatory capacity), character entities that explicitly define `core:affect_traits` should include the new trait with a value appropriate to their personality:
- High `self_control` (70-100): Disciplined, composed, measured characters
- Average `self_control` (40-60): Typical human variability
- Low `self_control` (0-40): Impulsive, reactive, hot-headed characters

## Files to Touch

| File | Change Type |
|------|-------------|
| `data/mods/alicia/entities/definitions/alicia_western.character.json` | **Modify** - Add `self_control` to `core:affect_traits` |

**Note**: Only `alicia_western.character.json` currently defines `core:affect_traits`. If additional entity files are found with this component, they should also be updated.

## Out of Scope

- **DO NOT** modify component schemas - that's INHCONAXIANDSELCONTRA-001
- **DO NOT** modify Monte Carlo code - that's INHCONAXIANDSELCONTRA-002
- **DO NOT** modify UI components - that's INHCONAXIANDSELCONTRA-003
- **DO NOT** modify LLM prompts - that's INHCONAXIANDSELCONTRA-004
- **DO NOT** add `self_control` to entities that don't already have `core:affect_traits` (schema default will apply)
- **DO NOT** modify `core:mood` component (inhibitory_control uses schema default of 0)

## Implementation Details

### Modify: data/mods/alicia/entities/definitions/alicia_western.character.json

Locate the `core:affect_traits` component (approximately line 522) and add `self_control`:

**Current:**
```json
"core:affect_traits": {
    "affective_empathy": 60,
    "cognitive_empathy": 88,
    "harm_aversion": 85
}
```

**Updated:**
```json
"core:affect_traits": {
    "affective_empathy": 60,
    "cognitive_empathy": 88,
    "harm_aversion": 85,
    "self_control": 72
}
```

**Value Rationale for Alicia (72 - High Self-Control):**
- Mathematical mind with high discipline for extended focus
- Profile mentions "high resolve_skill: 92" indicating strong willpower
- Capable of maintaining composure during clinical evaluations
- Can "perform charm as a tactic" demonstrating emotional regulation
- Though volatile internally, exhibits high external control ("razor wit as perimeter defense")
- Not maximum (100) because she acknowledges "losing temper/exploding" as a failure mode

### Verification: Search for Other Entities

Before completing, run search to ensure no other entities need updating:

```bash
grep -r "core:affect_traits" data/mods --include="*.json" | grep -v ".component.json"
```

Expected: Only `alicia_western.character.json` should have explicit affect_traits definition.

## Acceptance Criteria

### Specific Tests That Must Pass

1. **Schema validation passes:**
   ```bash
   npm run validate
   ```

2. **Entity loads correctly:**
   ```bash
   npm run test:unit -- --testPathPattern="entityLoader" --verbose
   ```

3. **All unit tests pass:**
   ```bash
   npm run test:unit
   ```

### Invariants That Must Remain True

1. **JSON Validity**: Entity file must remain valid JSON
2. **Schema Compliance**: Entity must validate against entity-definition.schema.json
3. **Value Range**: `self_control` must be integer in [0, 100]
4. **Character Consistency**: Value should match character's established personality
5. **No Other Changes**: Only `core:affect_traits` component modified, all other components unchanged

## Verification Commands

```bash
# Validate all schemas and entities
npm run validate

# Validate strict mode
npm run validate:strict

# Search for other entities with affect_traits
grep -r "core:affect_traits" data/mods --include="*.json" | grep -v ".component.json"

# Run entity loading tests
npm run test:unit -- --testPathPattern="entityLoader" --verbose

# Run all tests
npm run test:unit
```

## Character Value Guidelines (For Future Entities)

If other characters need `self_control` values, use these guidelines:

| Value Range | Character Type | Examples |
|-------------|---------------|----------|
| 90-100 | Extreme discipline/stoicism | Monks, special forces, ice-cold professionals |
| 70-89 | High self-control | Mathematicians, surgeons, diplomats |
| 50-69 | Average/variable | Most typical characters |
| 30-49 | Low self-control | Hot-headed, impulsive, reactive |
| 0-29 | Very low control | Berserkers, addicts, highly reactive |

## Definition of Done

- [x] `alicia_western.character.json` has `self_control: 72` in `core:affect_traits`
- [x] `npm run validate` passes
- [x] Verified no other entities need updating (search completed)
- [x] All existing tests pass
- [x] JSON file remains valid and well-formatted

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned:**
- Add `self_control: 72` to the `core:affect_traits` component in `alicia_western.character.json`

**Actually Changed:**
- Exactly as planned: Added `self_control: 72` to `alicia_western.character.json` at line 526

### Verification Results

1. **Entity Search**: Confirmed only `alicia_western.character.json` has explicit `core:affect_traits` - no other entities needed updating
2. **Schema Validation**: `npm run validate` passes with 0 violations across 181 mods
3. **Entity Loader Tests**: 5/5 tests passed
4. **Schema Tests**: 162/162 tests passed (including affect_traits schema tests)
5. **Axis Normalization Tests**: 4/4 tests passed (includes self_control normalization)

### No New Tests Required

This ticket involved a minimal data change (adding one property to a JSON entity file). The existing test coverage is adequate:
- Schema validation tests already verify `core:affect_traits` with `self_control` validates correctly
- Entity loader tests verify entities load without error
- Axis normalization tests verify `self_control` is properly handled

### Assumptions Validated

The ticket's assumptions were accurate:
- INHCONAXIANDSELCONTRA-001 (schema updates) was already complete - `self_control` exists in the schema with default 50
- Only `alicia_western.character.json` has explicit `core:affect_traits` (confirmed via grep)
- The value 72 is appropriate for Alicia's personality profile

**Completed**: 2026-01-15
