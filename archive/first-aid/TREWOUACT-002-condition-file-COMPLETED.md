# TREWOUACT-002: Create Event Condition for Treat Wounded Part Action

**Status: ✅ COMPLETED**

## Summary
Create the condition file that checks if an event is a `treat_wounded_part` action attempt.

## Files to Touch
- `data/mods/first-aid/conditions/event-is-action-treat-wounded-part.condition.json` (CREATE)

## Out of Scope
- DO NOT modify any existing condition files
- DO NOT modify the action file (that's TREWOUACT-003)
- DO NOT modify the rule file (that's TREWOUACT-004)
- DO NOT create any test files in this ticket
- DO NOT modify any schema files

## Implementation Details

### File Content
Create `data/mods/first-aid/conditions/event-is-action-treat-wounded-part.condition.json`:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "first-aid:event-is-action-treat-wounded-part",
  "description": "Checks if the triggering event is the treat_wounded_part action.",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "first-aid:treat_wounded_part"
    ]
  }
}
```

### Pattern Reference
Follow the exact pattern of existing condition files:
- `data/mods/first-aid/conditions/event-is-action-disinfect-wounded-part.condition.json`
- `data/mods/first-aid/conditions/event-is-action-rinse-wounded-part.condition.json`

### Assumptions Corrected During Implementation
The original ticket template had several incorrect assumptions about condition file patterns:

| Original Assumption | Actual Pattern | Resolution |
|---------------------|----------------|------------|
| Includes `evaluator: "json-logic"` field | No `evaluator` field present | Removed field |
| Uses `===` strict equality | Uses `==` equality | Changed to `==` |
| Uses `and` with `eventName` + `actionId` checks | Single equality on `event.payload.actionId` | Simplified to match existing pattern |
| Uses `{ "var": "actionId" }` | Uses `{ "var": "event.payload.actionId" }` | Updated var path |

## Acceptance Criteria

### Specific Tests That Must Pass
- `npm run validate` must pass with no schema validation errors
- JSON must be valid (parseable without syntax errors)

### Invariants That Must Remain True
- Existing condition files remain unchanged
- No modifications to condition.schema.json
- The `json-logic` evaluator behavior remains unchanged

## Verification Steps
1. Run `npm run validate` to check schema validity
2. Run `node -e "require('./data/mods/first-aid/conditions/event-is-action-treat-wounded-part.condition.json')"` to verify JSON parsing
3. Visually compare structure with existing condition files in the same directory

## Dependencies
- None (can be created independently of scope file)

## Estimated Complexity
Very Low - simple JSON file creation following established patterns

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Originally Planned:**
The ticket template proposed a condition file with:
- An `evaluator: "json-logic"` field
- An `and` logic block checking both `eventName` and `actionId`
- Using `===` strict equality operator
- Using `{ "var": "actionId" }` and `{ "var": "eventName" }` variable paths

**What Was Actually Implemented:**
After reassessing the existing condition file patterns in the codebase, the implementation followed the actual established pattern:
- No `evaluator` field (the engine infers json-logic from the `logic` property)
- Simple equality check on a single variable
- Using `==` equality operator (standard for this codebase)
- Using `{ "var": "event.payload.actionId" }` which is the actual path used

**Files Created:**
- `data/mods/first-aid/conditions/event-is-action-treat-wounded-part.condition.json`

**Validation Results:**
- ✅ `npm run validate` passed (no schema validation errors for the new file)
- ✅ JSON parsing verification passed
- ✅ Structure matches existing condition files exactly

**No Tests Created:**
Per ticket scope, no test files were created in this ticket. Testing of condition evaluation is handled in TREWOUACT-006 (Rule Execution Test).
