# OPEHANARCANA-016: Migrate hand-holding Mod Rules

**Status:** Completed (scope corrected 2025-03-08)
**Priority:** High (Phase 2 Migration)
**Estimated Effort:** 0.5 days
**Dependencies:** OPEHANARCANA-011 (ESTABLISH DI), OPEHANARCANA-014 (BREAK DI)

---

## Objective

Reduce duplication in the hand-holding mod by adopting the new `ESTABLISH_BIDIRECTIONAL_CLOSENESS` operation where behaviorally safe, without changing validated behaviors that rely on bespoke guards and failure handling.

---

## Current Reality Check

- Only five rules exist: `handle_hold_hand`, `handle_let_go_of_hand`, `handle_squeeze_hand_reassuringly`, `handle_warm_hands_between_yours`, `handle_withdraw_hand_from_grasp`.
- All rules use `event_type: core:attempt_action`; there is no `ACTION_DECIDED` or `PREPARE_ACTION_CONTEXT` usage in this mod.
- `handle_let_go_of_hand` and `handle_withdraw_hand_from_grasp` include target-matching guards and custom failure paths that `BREAK_BIDIRECTIONAL_CLOSENESS` cannot express today.
- The closeness operation schemas currently disallow hyphenated component IDs (`^[a-z_]+:[a-z_]+$`), so hand-holding component types must be unblocked at the schema level to validate.
- The migration target is therefore limited to `handle_hold_hand`; the other rules must stay bespoke until the break handler supports pair validation and failure messaging.

---

## Files to Touch

- `data/mods/hand-holding/rules/handle_hold_hand.rule.json` (migrate to `ESTABLISH_BIDIRECTIONAL_CLOSENESS`)
- Hand-holding release/withdraw/squeeze/warm rules: **no change** (guarded behaviors not supported by the generic break handler)

---

## Out of Scope

**DO NOT modify:**

- Any action files (only rules)
- Any condition files
- Any component files
- Any entity files
- Rules in other mods
- The bidirectional closeness handlers themselves
- DI files
- Additional schema changes beyond widening the closeness operation schema to accept hyphenated component IDs
- `handle_let_go_of_hand.rule.json` or `handle_withdraw_hand_from_grasp.rule.json` (bespoke validation/failure handling)

---

## Migration Pattern

### Before (handle_hold_hand.rule.json – ~200 lines)
- Manual queries for existing `holding_hand`/`hand_held` components on both entities
- IF blocks to clean third-party links
- Explicit REMOVE/ADD component operations
- Description regeneration after component changes

### After (handle_hold_hand.rule.json – condensed)
- Keep `core:attempt_action` event and existing GET_NAME/position lookups
- Replace manual component removal/addition with `ESTABLISH_BIDIRECTIONAL_CLOSENESS` using `hand-holding:holding_hand` and `hand-holding:hand_held` with existing payload templates
- Preserve log/perception variables and macro

### Release/Withdraw Rules
- Stay on bespoke logic until `BREAK_BIDIRECTIONAL_CLOSENESS` supports target-matching guards and failure messaging without removing unrelated hand-holding pairs.

---

## Migration Checklist

- [x] Migrate `handle_hold_hand.rule.json` to `ESTABLISH_BIDIRECTIONAL_CLOSENESS`
- [x] Update the `ESTABLISH_BIDIRECTIONAL_CLOSENESS` schema component-type pattern to allow hyphenated IDs
- [x] Leave let-go/withdraw rules unchanged (documented rationale)
- [x] Validate JSON syntax for modified rule
- [x] Run hand-holding integration tests that exercise `hold_hand`

---

## Acceptance Criteria

### Tests That Must Pass

1. `npm run validate:mod -- hand-holding` (reference validation for the modified rule)
2. `npm run test:integration -- tests/integration/mods/hand-holding/hold_hand_action.test.js`
3. `npm run test:integration -- tests/integration/mods/hand-holding/hold_hand_first_time.integration.test.js`
4. `npm run test:integration -- tests/integration/mods/hand-holding/hold_hand_bug_reproduction.test.js`

### Invariants That Must Remain True

1. `handle_hold_hand` cleans third-party links and re-establishes mutual components identically to the prior logic.
2. Log/perception payloads remain unchanged (`action_target_general`, location/target IDs intact).
3. Descriptions regenerate for both entities after the hold is established.
4. Rules with bespoke validation/failure handling (let-go/withdraw) keep their behavior.

---

## Verification Steps

```bash
# Validate modified rule syntax
node -e "JSON.parse(require('fs').readFileSync('data/mods/hand-holding/rules/handle_hold_hand.rule.json'))"

# Mod validation
npm run validate:mod -- hand-holding

# Targeted integration tests
npm run test:integration -- tests/integration/mods/hand-holding/hold_hand_action.test.js
npm run test:integration -- tests/integration/mods/hand-holding/hold_hand_first_time.integration.test.js
npm run test:integration -- tests/integration/mods/hand-holding/hold_hand_bug_reproduction.test.js
```

---

## Notes
- Third-party cleanup is handled by `ESTABLISH_BIDIRECTIONAL_CLOSENESS` when provided both hand-holding component types.
- Release/withdraw flows must retain their explicit guards; migrating them would currently remove unrelated hand-holding pairs when invoked out of band.

---

## Outcome

- Planned to migrate all hand-holding rules to closeness handlers; actual migration is limited to `handle_hold_hand` because let-go/withdraw flows depend on guarded failure handling not covered by the break handler.
- `handle_hold_hand` now uses `ESTABLISH_BIDIRECTIONAL_CLOSENESS`, and the establish schema accepts hyphenated component IDs. Release/withdraw/squeeze/warm rules remain bespoke.
- Validation (`npm run validate:mod -- hand-holding`) and targeted integration suites for `hold_hand` (action, first-time, bug reproduction) are passing.

---

## Reference Files

- Original rules: `data/mods/hand-holding/rules/*.rule.json`
- Component definitions: `data/mods/hand-holding/components/*.component.json`
- Handler: `src/logic/operationHandlers/establishBidirectionalClosenessHandler.js`
