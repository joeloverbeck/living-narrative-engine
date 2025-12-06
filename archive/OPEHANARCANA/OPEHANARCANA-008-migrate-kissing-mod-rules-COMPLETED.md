# OPEHANARCANA-008: Migrate kissing Mod Rules

**Status:** Completed  
**Priority:** High (Phase 1 Migration Batch 1)  
**Estimated Effort:** 0.5 days  
**Dependencies:** OPEHANARCANA-005 (integration tests pass)

---

## Objective

Bring the `kissing` mod rules onto the shared `PREPARE_ACTION_CONTEXT` operation to deduplicate name/position/perception setup while preserving existing kissing-state mechanics and success messaging.

---

## Current Reality vs. Original Assumptions

- The mod currently has **16** rules, not 15, and none match the placeholder filenames listed previously.
- Six rules dispatch a **separate success message** (distinct from the perceptible log) and cannot use the `core:logSuccessAndEndTurn` macro without losing that behavior.
- Four rules modify kissing state (add/remove components, lock/unlock mouth engagement) and must keep those operations intact.
- No `npm run validate:mod:kissing` script exists; mod validation should call `scripts/validateModReferences.js --mod=kissing`.
- Integration tests live under `tests/integration/mods/kissing/` and must be run with `--runInBand` to avoid known Jest exit issues.

---

## Files to Touch (16 rules)

- `data/mods/kissing/rules/accept_kiss_passively.rule.json`
- `data/mods/kissing/rules/break_kiss_gently.rule.json`
- `data/mods/kissing/rules/cup_face_while_kissing.rule.json`
- `data/mods/kissing/rules/explore_mouth_with_tongue.rule.json`
- `data/mods/kissing/rules/handle_kiss_neck_sensually.rule.json`
- `data/mods/kissing/rules/handle_nibble_earlobe_playfully.rule.json`
- `data/mods/kissing/rules/handle_suck_on_neck_to_leave_hickey.rule.json`
- `data/mods/kissing/rules/kiss_back_passionately.rule.json`
- `data/mods/kissing/rules/kiss_cheek.rule.json`
- `data/mods/kissing/rules/kiss_forehead_gently.rule.json`
- `data/mods/kissing/rules/lean_in_for_deep_kiss.rule.json`
- `data/mods/kissing/rules/nibble_lower_lip.rule.json`
- `data/mods/kissing/rules/peck_on_lips.rule.json`
- `data/mods/kissing/rules/pull_back_breathlessly.rule.json`
- `data/mods/kissing/rules/pull_back_in_revulsion.rule.json`
- `data/mods/kissing/rules/suck_on_tongue.rule.json`

---

## Migration Pattern

### Common change

- Replace the repeated setup (`GET_NAME` x2, `QUERY_COMPONENT core:position`, `SET_VARIABLE perceptionType/locationId/targetId`) with a single `PREPARE_ACTION_CONTEXT` call.
- Retain each rule's unique `logMessage`/`successMessage` content, mouth locking/unlocking, component adds/removes, and description regeneration.

### Pattern A: Macro-driven logs (uses `core:logSuccessAndEndTurn`)

- Keep `logMessage` `SET_VARIABLE`.
- Ensure `PREPARE_ACTION_CONTEXT` runs before any stateful operations that depend on context vars.

### Pattern B: Custom dispatch + distinct success message

- Keep `logMessage`, `successMessage`, `GET_TIMESTAMP`, explicit `DISPATCH_EVENT` calls, and `END_TURN`.
- Only replace the shared context setup with `PREPARE_ACTION_CONTEXT`.

---

## Migration Checklist Per Rule

- [ ] Swap shared setup for `PREPARE_ACTION_CONTEXT`.
- [ ] Keep rule-specific state changes and success messaging unchanged.
- [ ] Preserve `condition`, `event`, and all other metadata.
- [ ] Validate JSON syntax.
- [ ] Run kissing integration tests in-band.

---

## Acceptance Criteria

### Tests That Must Pass

1. Kissing mod integration tests (in-band):  
   `npm run test:integration -- tests/integration/mods/kissing --runInBand`
2. Kissing mod validation:  
   `node scripts/validateModReferences.js --mod=kissing`

### Invariants That Must Remain True

1. All 16 rules keep identical runtime behavior (state changes, log vs. success messages, events dispatched).
2. `core:logSuccessAndEndTurn` users still emit the same perceptible and display events.
3. `successMessage` rules continue to emit the distinct display payload.
4. No changes to action discovery or conditions.

---

## Verification Steps

```bash
# 1. Validate JSON syntax for kissing rules
for file in data/mods/kissing/rules/*.rule.json; do
  node -e "JSON.parse(require('fs').readFileSync('$file'))" && echo \"OK: $file\"
done

# 2. Run mod validation
node scripts/validateModReferences.js --mod=kissing

# 3. Run kissing-specific integration tests (in-band)
npm run test:integration -- tests/integration/mods/kissing --runInBand --verbose
```

---

## Rollback Plan

1. Restore `data/mods/kissing/rules/` from the previous commit.
2. Re-run kissing integration tests to confirm baseline behavior.

---

## Outcome

- Updated all 16 kissing rules to call `PREPARE_ACTION_CONTEXT` with explicit empty parameters to satisfy the rule schema while retaining each rule’s unique log/success messaging, mouth locking, component mutations, and description refresh steps.
- Preserved distinct success message dispatch for six rules; kept macro-driven logging for the remaining ten without altering event payloads.
- Validation (`node scripts/validateModReferences.js --mod=kissing`) and targeted integration coverage (`npm run test:integration -- tests/integration/mods/kissing --runInBand --verbose`) both pass.

---

## Reference Files

- Handler: `src/logic/operationHandlers/prepareActionContextHandler.js`
- Macro: `data/mods/core/macros/logSuccessAndEndTurn.macro.json`
