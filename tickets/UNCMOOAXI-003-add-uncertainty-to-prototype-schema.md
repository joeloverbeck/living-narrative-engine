# UNCMOOAXI-003: Add Uncertainty to Prototype Schema

## Summary

Add `uncertainty` as a valid weight property in the emotion prototypes lookup schema. This enables emotion prototypes to include uncertainty weights without schema validation errors.

## Priority: High | Effort: Low

## Rationale

The `emotion_prototypes.lookup.json` file has an internal schema that defines valid weight properties. Currently it lists 15 properties (9 mood axes + 6 auxiliary traits). Adding `uncertainty` to this schema:
- Allows prototypes to specify uncertainty weights
- Maintains schema validation for all prototype entries
- Is required before updating any individual prototypes

## Dependencies

- **UNCMOOAXI-001** must be complete first (constants define the axis name)

## Files to Touch

| File | Change Type |
|------|-------------|
| `data/mods/core/lookups/emotion_prototypes.lookup.json` | **Modify** - Add uncertainty to weights schema (dataSchema section only) |

## Out of Scope

- **DO NOT** modify individual emotion prototype entries - that's UNCMOOAXI-004/005
- **DO NOT** modify `moodAffectConstants.js` - that's UNCMOOAXI-001
- **DO NOT** modify `mood.component.json` - that's UNCMOOAXI-002
- **DO NOT** update any test files - that's UNCMOOAXI-006

## Implementation Details

### File: data/mods/core/lookups/emotion_prototypes.lookup.json

**Add new property** to the `weights` object schema (around line 87, before `"additionalProperties": false`):

```json
"uncertainty": {
  "type": "number",
  "minimum": -1,
  "maximum": 1
}
```

### Current Schema Structure (lines 8-88)

```json
"dataSchema": {
  "type": "object",
  "properties": {
    "weights": {
      "type": "object",
      "description": "Weight coefficients for each mood axis, in range [-1.0, 1.0]",
      "properties": {
        "valence": { "type": "number", "minimum": -1, "maximum": 1 },
        "arousal": { "type": "number", "minimum": -1, "maximum": 1 },
        "agency_control": { "type": "number", "minimum": -1, "maximum": 1 },
        "threat": { "type": "number", "minimum": -1, "maximum": 1 },
        "engagement": { "type": "number", "minimum": -1, "maximum": 1 },
        "future_expectancy": { "type": "number", "minimum": -1, "maximum": 1 },
        "self_evaluation": { "type": "number", "minimum": -1, "maximum": 1 },
        "sexual_arousal": { "type": "number", "minimum": -1, "maximum": 1 },
        "sex_excitation": { "type": "number", "minimum": -1, "maximum": 1 },
        "sex_inhibition": { "type": "number", "minimum": -1, "maximum": 1 },
        "sexual_inhibition": { "type": "number", "minimum": -1, "maximum": 1 },
        "affective_empathy": { "type": "number", "minimum": -1, "maximum": 1 },
        "cognitive_empathy": { "type": "number", "minimum": -1, "maximum": 1 },
        "affiliation": { "type": "number", "minimum": -1, "maximum": 1 },
        "harm_aversion": { "type": "number", "minimum": -1, "maximum": 1 }
      },
      "additionalProperties": false
    },
    ...
  }
}
```

### After Modification

Add `uncertainty` property inside the `weights.properties` object, before `additionalProperties`:

```json
"harm_aversion": {
  "type": "number",
  "minimum": -1,
  "maximum": 1
},
"uncertainty": {
  "type": "number",
  "minimum": -1,
  "maximum": 1
}
```

## Acceptance Criteria

### Tests That Must Pass

```bash
# Schema validation should pass
npm run validate

# Existing prototypes should still validate (they don't use uncertainty yet)
npm run validate:strict
```

### Invariants That Must Remain True

1. **JSON Valid**: File must be valid JSON
2. **Schema Reference**: `$schema` reference unchanged
3. **Existing Properties**: All 15 existing weight properties unchanged
4. **Weight Range**: uncertainty uses same range (-1 to 1) as other weights
5. **No Entry Changes**: No individual prototype entries modified
6. **additionalProperties**: Remains `false` to catch typos

## Verification Commands

```bash
# Validate JSON syntax
node -e "JSON.parse(require('fs').readFileSync('data/mods/core/lookups/emotion_prototypes.lookup.json', 'utf8')); console.log('Valid JSON')"

# Run schema validation
npm run validate

# Verify schema property count
node -e "
  const data = JSON.parse(require('fs').readFileSync('data/mods/core/lookups/emotion_prototypes.lookup.json', 'utf8'));
  const weightProps = Object.keys(data.dataSchema.properties.weights.properties);
  console.log('Weight properties:', weightProps.length);
  console.log('Has uncertainty:', weightProps.includes('uncertainty'));
"
```

## Definition of Done

- [ ] `uncertainty` property added to `weights.properties` schema
- [ ] Property has correct type (`number`), range (`-1` to `1`)
- [ ] File remains valid JSON
- [ ] No individual prototype entries modified
- [ ] `npm run validate` passes
- [ ] `npm run validate:strict` passes
