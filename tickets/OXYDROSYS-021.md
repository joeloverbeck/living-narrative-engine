# OXYDROSYS-021: Add anoxic damage type to schema

## Description

Extend the damage type schema to include "anoxic" as a recognized damage type.

## Files to Create

- None

## Files to Modify

- `data/schemas/damage-capability-entry.schema.json` - Add "anoxic" to damage type enum

## Out of Scope

- Weapons or actions that deal anoxic damage
- Armor resistance to anoxic damage

## Acceptance Criteria

1. **Enum extended**: "anoxic" added to damage type options
2. **Validation passes**: Existing damage definitions remain valid
3. **Flags supported**: "bypasses_armor", "internal_only" flags work with anoxic

## Tests That Must Pass

- `npm run validate` - Schema validation
- Existing damage tests continue to pass

## Invariants

- No changes to existing damage entries
- Anoxic damage bypasses armor by convention
