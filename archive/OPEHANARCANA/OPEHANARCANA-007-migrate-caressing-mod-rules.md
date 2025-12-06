# OPEHANARCANA-007: Migrate caressing Mod Rules

**Status:** Completed
**Priority:** High (Phase 1 Migration Batch 1)
**Estimated Effort:** 0.5 days
**Dependencies:** OPEHANARCANA-005 (integration tests in place)

---

## Objective (updated)

Migrate the caressing mod rules to use `PREPARE_ACTION_CONTEXT` while preserving existing behavior. The mod currently has **12** rules (not 11) with two patterns:

- **Single-target rules (actor + target):**
  - `cup_chin`, `handle_caress_cheek_softly`, `handle_feel_arm_muscles`, `handle_run_fingers_through_hair`, `lick_lips`, `nuzzle_face_into_neck`, `run_thumb_across_lips`, `thumb_wipe_cheek`
- **Multi-target rules (primary/secondary, sometimes custom macros):**
  - `caress_abdomen`, `caress_bare_back`, `handle_fondle_ass`, `adjust_clothing`

None of the caressing rules currently use `PREPARE_ACTION_CONTEXT`; they manually call `GET_NAME`/`QUERY_COMPONENT` and set IDs. `PREPARE_ACTION_CONTEXT` already supports secondary targets via `include_secondary` and `secondary_name_variable`, so we can reuse it for the multi-target cases without changing the handler.

---

## Scope

- Replace the manual name/position/ID setup in all 12 caressing rules with `PREPARE_ACTION_CONTEXT`.
- Use `include_secondary` + `secondary_name_variable` where a secondary target name is needed.
- Keep existing macros (`core:logSuccessAndEndTurn`, `core:displaySuccessAndEndTurn`) and message text/behavior identical.
- Preserve rule metadata (ids, conditions, comments) and action discovery semantics.

## Out of Scope

- No changes to actions, conditions, schemas, or the `PREPARE_ACTION_CONTEXT` handler itself.
- No non-caresing mods.

---

## Migration Pattern

### Single-target rules (example: `handle_caress_cheek_softly.rule.json`)

```json
{
  "actions": [
    { "type": "PREPARE_ACTION_CONTEXT", "parameters": {} },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} softly caresses {context.targetName}'s cheek."
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

### Multi-target rules (example: `caress_abdomen.rule.json`)

```json
{
  "actions": [
    {
      "type": "PREPARE_ACTION_CONTEXT",
      "parameters": { "include_secondary": true }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} wraps their arms around {context.targetName}, and sensually caresses {context.targetName}'s abdomen over the {context.secondaryName}."
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

---

## Checklist

- [x] Confirm each rule uses the correct target placeholders (target vs primary/secondary).
- [x] Swap the manual GET/QUERY/SET sequence for `PREPARE_ACTION_CONTEXT`.
- [x] Keep existing log/success messages and macros intact.
- [x] Ensure multi-target rules pass `include_secondary` (and `secondary_name_variable` when a custom variable is needed).
- [x] Validate JSON syntax.
- [x] Re-run caressing integration + mod validation.

---

## Tests to Run

1. `node scripts/validateModReferences.js --mod=caressing --format=console`
2. `npm run test:integration -- tests/integration/mods/caressing/ --runInBand`

---

## Reference Files

- Current rules: `data/mods/caressing/rules/*.rule.json`
- Handler: `src/logic/operationHandlers/prepareActionContextHandler.js`
- Macros: `data/mods/core/macros/logSuccessAndEndTurn.macro.json`, `data/mods/core/macros/displaySuccessAndEndTurn.macro.json`

---

## Outcome

- Migrated all 12 caressing rules to `PREPARE_ACTION_CONTEXT`, using `include_secondary`/`secondary_name_variable` for multi-target rules and keeping existing macros/log messages.
- Confirmed validation via `npm run validate:ecosystem` (single-mod shortcut without dependencies fails due to expected cross-mod requirements) and ran `npm run test:integration -- tests/integration/mods/caressing/ --runInBand` successfully.
