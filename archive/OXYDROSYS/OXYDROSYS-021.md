# OXYDROSYS-021: Add anoxic damage type to schema [COMPLETED]

## Description

~~Extend the damage type schema to include "anoxic" as a recognized damage type.~~

**CORRECTED**: The damage type schema (`damage-capability-entry.schema.json`) uses free-form strings for the `name` field, not an enum. The schema already supports "anoxic" as a valid damage type name without any modification.

**Actual scope**: Document that "anoxic" is a supported damage type by adding test coverage.

## Schema Reality vs Original Assumption

| Original Assumption | Actual Implementation |
|---------------------|----------------------|
| "Add 'anoxic' to damage type enum" | `name` field is `type: string` with `minLength: 1` - NO enum exists |
| Schema modification required | Schema already accepts any damage type name |

**Evidence** (`data/schemas/damage-capability-entry.schema.json:8-12`):
```json
"name": {
  "type": "string",
  "description": "Damage type identifier (e.g., 'slashing', 'piercing', 'fire')",
  "minLength": 1
}
```

## Files to Create

- None

## Files to Modify

- ~~`data/schemas/damage-capability-entry.schema.json` - Add "anoxic" to damage type enum~~ **NOT NEEDED**
- `tests/unit/schemas/damageCapabilityEntry.schema.test.js` - Add test documenting anoxic support

## Out of Scope

- Weapons or actions that deal anoxic damage
- Armor resistance to anoxic damage

## Acceptance Criteria

1. ~~**Enum extended**: "anoxic" added to damage type options~~ **N/A - No enum exists**
2. **Validation passes**: Existing damage definitions remain valid ✓
3. **Flags supported**: "bypasses_armor", "internal_only" flags work with anoxic ✓ (flags array accepts any strings)
4. **Test coverage**: Added test verifying anoxic damage type acceptance ✓

## Tests That Must Pass

- `npm run validate` - Schema validation ✓
- Existing damage tests continue to pass ✓
- New anoxic damage type test passes ✓

## Invariants

- No changes to existing damage entries ✓
- Anoxic damage bypasses armor by convention (implemented via flags)

## Completion Status

**COMPLETED** - 2025-12-26

---

## Outcome

### Originally Planned
- Modify `data/schemas/damage-capability-entry.schema.json` to add "anoxic" to a damage type enum

### Actual Implementation
- **No schema changes required** - The schema already uses free-form strings for damage type names
- Added test coverage in `tests/unit/schemas/damageCapabilityEntry.schema.test.js` to document the anoxic damage type support

### Test Added
| Test File | Test Name | Rationale |
|-----------|-----------|-----------|
| `tests/unit/schemas/damageCapabilityEntry.schema.test.js` | `Anoxic damage type (oxygen deprivation) > should accept anoxic damage with bypass flags` | Documents design intent from `brainstorming/oxygen-drowning-system.md`; serves as regression guard for the OXYDROSYS breathing system |

### Key Learning
The original ticket was based on an incorrect assumption about the schema structure. The damage type system is intentionally flexible, using free-form strings rather than a restrictive enum. This allows for extensibility without requiring schema modifications for new damage types.
