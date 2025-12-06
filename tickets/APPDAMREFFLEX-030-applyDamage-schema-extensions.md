# APPDAMREFFLEX-030 APPLY_DAMAGE schema extensions

## Goal
Extend `applyDamage` operation schema to support metadata, damage tags, hit strategy, and rng references while remaining backward compatible with legacy `amount`/`damage_type` payloads. Mitigation toggles/armor fields are intentionally excluded in this refactor.

## File list
- data/schemas/operations/applyDamage.schema.json (add fields, defaults, docs)
- src/logic/operationHandlers/applyDamageHandler.js (accept new params but preserve legacy input)
- tests/contracts/operations/applyDamage.schema.test.js (or equivalent schema validation) with new cases
- tests/validation (add fixtures ensuring new fields validate and legacy payloads still pass)

## Out of scope
- Adding mitigation/armor/clothing toggles or related fields.
- Changing runtime behavior for existing macros/rules beyond parsing new optional fields.
- Removing or deprecating legacy fields beyond emitting warnings noted in code comments/tests.

## Acceptance criteria
- Tests: schema/validation suites covering `applyDamage` pass (e.g., `npm run validate:quick` plus contract test for applyDamage schema) and existing operation tests remain green.
- Invariants: Legacy payloads that only specify `amount`/`damage_type` continue to validate and execute unchanged; new fields default to no-op when omitted.
