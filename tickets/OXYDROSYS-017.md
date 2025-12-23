# OXYDROSYS-017: Create oxygen restoration rule

## Description

Create the rule that restores oxygen when breathing is possible.

## Files to Create

- `data/mods/breathing/rules/handle_oxygen_restoration.rule.json`

## Files to Modify

- `data/mods/breathing/mod-manifest.json` - Add rule to `content.rules` array

## Out of Scope

- Depletion rule
- Status effect removal (may be separate actions in rule)

## Acceptance Criteria

1. **Triggers on**: `core:turn_ended` event
2. **Condition**: Entity does NOT have submerged AND does NOT have being_strangled AND has respiratory organs
3. **Actions**:
   - Calls `RESTORE_OXYGEN` with `restoreFull: true`
   - Removes `breathing:hypoxic` component if present
   - Removes `breathing:unconscious_anoxia` component if present

## Tests That Must Pass

- `npm run validate` - Schema validation
- Integration test: Oxygen restores when not submerged

## Invariants

- Instant restoration (Design Decision 5)
- Removes all breathing status effects
