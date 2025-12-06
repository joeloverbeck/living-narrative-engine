# APPDAMREFFLEX-030 APPLY_DAMAGE schema extensions

## Status

Completed

## Reality check

- The current `applyDamage` schema only allows `entity_ref`, `part_ref`, `damage_entry`, `damage_multiplier`, `exclude_damage_types`, and legacy `amount`/`damage_type`. `additionalProperties: false` blocks `metadata`, `damage_tags`, `hit_strategy`, and `rng_ref`.
- `ApplyDamageHandler`/`DamageResolutionService` ignore the above new fields; RNG is sourced solely from `executionContext.rng`/`rngProvider`, and hit-location reuse is always on for top-level calls with no way to disable or hint a part.
- There is no schema-level validation test for APPLY_DAMAGE; existing unit tests cover handler logic with legacy parameters only.

## Updated goal

Extend APPLY_DAMAGE to accept optional metadata/damage tags/hit strategy/rng reference while keeping legacy payloads and runtime behavior unchanged when the new fields are absent.

## Scope / file list

- data/schemas/operations/applyDamage.schema.json — allow `metadata`, `damage_tags`, `hit_strategy`, and `rng_ref` with defaults/backward compatibility.
- src/logic/operationHandlers/applyDamageHandler.js — parse the new params (JSON Logic allowed), allow hit-location hinting/opt-out of cache reuse, and select a named RNG when `rng_ref` points to `executionContext.rngRegistry|rngRefs|rngMap`; default to existing RNG flow otherwise.
- src/logic/services/damageResolutionService.js — thread metadata/tags into recorded damage and event payloads without altering calculations.
- tests/unit/schemas/operations/applyDamage.schema.test.js — new schema validation coverage for legacy and extended payloads.
- tests/unit/logic/operationHandlers/applyDamageHandler.test.js — add cases for metadata/tags threading, hit_strategy reuse/hint behavior, and rng_ref selection while keeping legacy coverage intact.

## Out of scope

- Adding mitigation/armor/clothing toggles or related fields.
- Changing runtime behavior for existing macros/rules beyond parsing/recording the new optional fields.
- Removing or deprecating legacy fields beyond emitting warnings noted in code comments/tests.

## Acceptance criteria

- Legacy payloads that only specify `amount`/`damage_type` continue to validate and execute unchanged; new fields default to no-op when omitted.
- Schema validation covers both legacy and extended payloads; handler unit tests cover new params and remain green with existing assertions.
- Relevant test targets (schema + handler) run and pass (e.g., scoped `npm run test:unit -- applyDamage`).

## Outcome

- Updated schema accepts `metadata`, `damage_tags`, `hit_strategy`, and `rng_ref` (with relaxed anyOf for JSON Logic) while remaining compatible with legacy parameters.
- ApplyDamage handler now threads metadata/tags into resolution, supports hit_strategy hint/opt-out caching, and resolves named RNG providers; damage resolution records the new fields in damage entries and events.
- Added schema validation coverage at `tests/unit/schemas/operations/applyDamage.schema.test.js` and extended handler tests for the new parameters; targeted unit suites executed via `npx jest --config jest.config.unit.js --runInBand --silent=false tests/unit/logic/operationHandlers/applyDamageHandler.test.js tests/unit/schemas/operations/applyDamage.schema.test.js --coverage=false`.
