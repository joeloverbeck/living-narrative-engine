# OXYDROSYS-022: Register hypoxia in status effects registry

## Description

Add hypoxia and anoxic unconsciousness to the status effects registry.

## Files to Create

- None

## Files to Modify

- `data/mods/anatomy/status-effects/status-effects.registry.json` - Add hypoxia entries

## Out of Scope

- UI display of status effects
- Status effect icons

## Acceptance Criteria

1. **Hypoxia registered**: Entry for `breathing:hypoxic`
2. **Unconscious registered**: Entry for `breathing:unconscious_anoxia`
3. **Properties**: severity levels, descriptions, etc.

## Tests That Must Pass

- `npm run validate` - Schema validation

## Invariants

- Existing status effects unchanged
- Follows registry format exactly
