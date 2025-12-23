# RISTOSURACT-004: Create event-is-action-rise-to-surface condition [COMPLETED]

## Summary

Create the condition file that checks if an event is for the `rise_to_surface` action. This condition is used by the rule to trigger on the correct action.

## Files to Touch

- `data/mods/liquids/conditions/event-is-action-rise-to-surface.condition.json` (NEW FILE)

## Out of Scope

- **DO NOT** modify mod-manifest.json (handled in RISTOSURACT-006)
- **DO NOT** create the action file (handled in RISTOSURACT-003)
- **DO NOT** create the rule file (handled in RISTOSURACT-005)
- **DO NOT** modify any existing condition files
- **DO NOT** modify any other files

## Implementation Details

### Complete File Content

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "liquids:event-is-action-rise-to-surface",
  "description": "Checks if the event is for the rise_to_surface action.",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "liquids:rise_to_surface"
    ]
  }
}
```

### Pattern Reference

This follows the exact pattern of existing condition files:
- `event-is-action-enter-liquid-body.condition.json`
- `event-is-action-climb-out-of-liquid-body.condition.json`
- `event-is-action-swim-to-connected-liquid-body.condition.json`

## Acceptance Criteria

### Tests That Must Pass

- [x] `npm run validate:mod:liquids` passes after RISTOSURACT-006 (manifest update)
- [x] Condition JSON is valid (parseable)
- [x] Condition follows schema `schema://living-narrative-engine/condition.schema.json`

### Schema Validation Checks

- [x] Condition ID is `liquids:event-is-action-rise-to-surface`
- [x] Logic checks `event.payload.actionId == "liquids:rise_to_surface"`
- [x] Description is present and descriptive

### Invariants That Must Remain True

- [x] No existing files are modified
- [x] File naming follows kebab-case pattern: `event-is-action-<action-name>.condition.json`
- [x] Condition ID follows pattern: `<mod>:event-is-action-<action-name>`

## Verification Commands

```bash
# Verify JSON is valid
node -e "console.log(JSON.parse(require('fs').readFileSync('data/mods/liquids/conditions/event-is-action-rise-to-surface.condition.json')))"

# Check condition ID
grep '"id": "liquids:event-is-action-rise-to-surface"' data/mods/liquids/conditions/event-is-action-rise-to-surface.condition.json

# Check it references correct action
grep '"liquids:rise_to_surface"' data/mods/liquids/conditions/event-is-action-rise-to-surface.condition.json
```

## Dependencies

- None (can be created in parallel with RISTOSURACT-003)

## Blocks

- RISTOSURACT-005 (rule references this condition)
- RISTOSURACT-006 (manifest needs to include this file)
- RISTOSURACT-008 (rule execution tests verify condition)

## Reference

See `specs/rise-to-surface-action.md` Section 4 for condition specification.

---

## Outcome

### What was actually changed vs originally planned

**Planned:**
- Create `data/mods/liquids/conditions/event-is-action-rise-to-surface.condition.json`

**Actually Changed:**
- Created `data/mods/liquids/conditions/event-is-action-rise-to-surface.condition.json` - exactly as specified

### Verification Results

All verification commands passed:
1. JSON is valid and parseable ✓
2. Condition ID matches expected pattern ✓
3. References correct action ID `liquids:rise_to_surface` ✓

### Notes

No discrepancies found between the ticket assumptions and the actual codebase. The existing condition files follow the exact pattern specified in the ticket, so the implementation was straightforward.

### New/Modified Tests

None required for this ticket. The condition file is a data file that will be tested via:
- RISTOSURACT-008 (rule execution tests) - verifies condition triggers correctly
- `npm run validate:mod:liquids` - verifies schema compliance (after RISTOSURACT-006 manifest update)
