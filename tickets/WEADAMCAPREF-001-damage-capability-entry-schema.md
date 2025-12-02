# WEADAMCAPREF-001: Create damage-capability-entry schema

## Summary

Create the JSON Schema that defines the structure of a single damage capability entry. This schema will be used by the `damage_capabilities` component to validate weapon damage configurations.

## Dependencies

- None (this is the foundational ticket)

## Files to Touch

| File | Action | Description |
|------|--------|-------------|
| `data/schemas/damage-capability-entry.schema.json` | CREATE | New schema file |

## Out of Scope

- Component definitions (WEADAMCAPREF-002)
- Service modifications
- Any JavaScript/TypeScript code changes
- Weapon entity migrations
- Operator implementation

## Implementation Details

Create `data/schemas/damage-capability-entry.schema.json` with the following structure:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/damage-capability-entry.schema.json",
  "title": "DamageCapabilityEntry",
  "description": "A single damage type entry with amount and effect configuration",
  "type": "object",
  "properties": {
    "name": { "type": "string", "minLength": 1 },
    "amount": { "type": "number", "minimum": 0 },
    "penetration": { "type": "number", "minimum": 0, "maximum": 1, "default": 0 },
    "bleed": { ... },
    "fracture": { ... },
    "burn": { ... },
    "poison": { ... },
    "dismember": { ... },
    "flags": { "type": "array", "items": { "type": "string" }, "default": [] }
  },
  "required": ["name", "amount"],
  "additionalProperties": false
}
```

Refer to `specs/weapon-damage-capabilities-refactoring.md` lines 214-331 for the complete schema definition.

## Acceptance Criteria

### Tests That Must Pass

1. `npm run validate` - Schema validation passes
2. Create unit test `tests/unit/schemas/damageCapabilityEntry.schema.test.js`:
   - Valid entry with only required fields (name, amount) validates
   - Valid entry with all optional fields validates
   - Entry with missing `name` fails validation
   - Entry with missing `amount` fails validation
   - Entry with `penetration` > 1 fails validation
   - Entry with invalid `bleed.severity` enum value fails validation

### Invariants That Must Remain True

1. Schema follows JSON Schema draft-07 specification
2. Schema $id matches the living-narrative-engine pattern
3. All effect sub-schemas (bleed, fracture, burn, poison, dismember) have `additionalProperties: false`
4. Only `name` and `amount` are required fields
5. All effect objects default to `enabled: false`

## Estimated Size

- 1 new schema file (~120 lines)
- 1 new test file (~80 lines)
