# TREWOUACT-004: Create Rule Handler for Treat Wounded Part Action

**Status**: ✅ COMPLETED

## Summary
Create the rule file that handles the `treat_wounded_part` action with four outcome branches (CRITICAL_SUCCESS, SUCCESS, FAILURE, FUMBLE).

## Files to Touch
- `data/mods/first-aid/rules/handle_treat_wounded_part.rule.json` (CREATE)

## Out of Scope
- DO NOT modify any existing rule files
- DO NOT modify the scope file (that's TREWOUACT-001)
- DO NOT modify the condition file (that's TREWOUACT-002)
- DO NOT modify the action file (that's TREWOUACT-003)
- DO NOT create any test files in this ticket
- DO NOT modify any operation handlers
- DO NOT modify any schema files
- DO NOT create macros - use inline operations

## Implementation Details

### IMPORTANT: Assumption Corrections (validated against codebase)

The original spec had incorrect patterns. The following corrections were applied:

1. **Outcome resolution pattern**: The spec assumed `context.outcomeType` exists automatically. In reality, rules MUST call `RESOLVE_OUTCOME` operation to calculate and store the outcome in a result variable (e.g., `context.treatmentResult.outcome`).

2. **Entity refs for treat action**:
   - `actor` = the healer
   - `primary` = the patient (target actor)
   - `secondary` = the wounded body part

3. **Logging macros**: Use `core:logSuccessOutcomeAndEndTurn` for success outcomes and `core:logFailureOutcomeAndEndTurn` for failure/fumble outcomes (per warding rules pattern).

### Key Implementation Notes
1. **Outcome resolution**: Uses `RESOLVE_OUTCOME` with `result_variable: "treatmentResult"` to calculate outcomes
2. **Outcome access**: Uses `context.treatmentResult.outcome` (not `context.outcomeType`)
3. **Outcome values**: Uses `FUMBLE` not `CRITICAL_FAILURE` (matching codebase pattern)
4. **Healing**: Uses `MODIFY_PART_HEALTH` with positive delta
5. **Damage**: Uses `APPLY_DAMAGE` for fumble
6. **Logging**: Uses `core:logSuccessOutcomeAndEndTurn` / `core:logFailureOutcomeAndEndTurn` macros
7. **Description regeneration**: Only on outcomes that modify health

## Acceptance Criteria

### Specific Tests That Must Pass
- `npm run validate` must pass with no schema validation errors ✅
- JSON must be valid and parseable ✅
- Rule schema validation must pass ✅

### Invariants That Must Remain True
- Existing rule files remain unchanged ✅
- No modifications to rule.schema.json ✅
- `MODIFY_PART_HEALTH` operation behavior unchanged ✅
- `APPLY_DAMAGE` operation behavior unchanged ✅
- `core:logSuccessOutcomeAndEndTurn` macro behavior unchanged ✅
- `core:logFailureOutcomeAndEndTurn` macro behavior unchanged ✅

## Dependencies
- TREWOUACT-002 (condition file must exist for rule to reference) ✅

## Estimated Complexity
Medium - complex branching logic with four outcome paths

---

## Outcome

### What Was Originally Planned
- Create a rule file using `context.outcomeType` for outcome branching
- Use `core:logSuccessAndEndTurn` macro for all outcomes

### What Was Actually Changed
1. **Assumption correction**: Discovered that the ticket's assumption about `context.outcomeType` was incorrect. The codebase requires using `RESOLVE_OUTCOME` operation to calculate outcomes and store them in a result variable.

2. **Pattern alignment**: Updated rule to use:
   - `RESOLVE_OUTCOME` with `result_variable: "treatmentResult"`
   - `context.treatmentResult.outcome` for branching
   - `core:logSuccessOutcomeAndEndTurn` for success/critical success
   - `core:logFailureOutcomeAndEndTurn` for failure/fumble

3. **Files created**:
   - `data/mods/first-aid/rules/handle_treat_wounded_part.rule.json`

4. **Files modified**:
   - `data/mods/first-aid/mod-manifest.json` - Added the new rule file, action, condition, and scope to the content arrays
   - `tickets/TREWOUACT-004-rule-file.md` - Updated with corrected assumptions before implementation

### Verification Results
- JSON parsing: ✅ Valid
- Schema validation: ✅ Passes
- Scope lint: ✅ 136 scope files valid
- First-aid integration tests: ✅ 60 tests passing
- MODIFY_PART_HEALTH handler tests: ✅ 46 tests passing
- RESOLVE_OUTCOME handler tests: ✅ 41 tests passing

### Key Learning
The spec document `specs/treat-wound-action.md` contained incorrect assumptions about how chance-based outcomes work. The pattern used in weapons and warding mods was the correct reference for implementing outcome-based rules:
- Always call `RESOLVE_OUTCOME` operation first
- Store result in a named variable
- Access outcome via `context.[resultVariable].outcome`
