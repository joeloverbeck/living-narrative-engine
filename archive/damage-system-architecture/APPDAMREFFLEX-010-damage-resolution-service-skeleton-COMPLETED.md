# APPDAMREFFLEX-010 Damage Resolution Service skeleton

**Status: Completed**

## Goal

Extract the existing `APPLY_DAMAGE` resolution pipeline into a new `DamageResolutionService` that can be invoked by `applyDamageHandler` without changing the handler’s public surface. Behavior must stay identical (no mitigation yet), but the orchestration currently inside the handler should live in the service to unblock future armor/mitigation work described in `specs/apply-damage-refactor-flexibility.md`.

## Current state check (assumptions corrected)

- There is no `DamageResolutionService` today; `applyDamageHandler` owns session creation, propagation recursion, death checks, event dispatch, and narrative composition end-to-end (see `src/logic/operationHandlers/applyDamageHandler.js`).
- Hit-location reuse is stored on `executionContext.hitLocationCache`, and the shared damage session is carried via `executionContext.damageSession` for propagation calls—this contract must be preserved.
- Part selection randomness is hardwired to `Math.random()` inside the handler; any refactor must keep the same RNG behavior (defaulting to `Math.random`, optional injection is fine but not required by current tests).
- `DamagePropagationService.propagateDamage(parentPartId, damageAmount, damageTypeId, ownerEntityId, propagationRules)` is the existing signature; no changes are expected while delegating propagation calls.
- Existing coverage exercises the handler directly (e.g., `tests/unit/logic/operationHandlers/applyDamageHandler.test.js`, multiple e2e flows including `swingAtTargetFullFlow.e2e.test.js`). There is no service-level test coverage yet.

## Scope

- Add `src/logic/services/damageResolutionService.js` that encapsulates the current resolution pipeline (session lifecycle, health mutation, effects, propagation callbacks, death/narrative ordering) with behavior parity.
- Refactor `applyDamageHandler` to resolve inputs/params and delegate the resolution work to the new service while keeping the handler API unchanged.
- Wire DI only as needed for the new service dependency; avoid altering existing component/service interfaces beyond the delegation touchpoints.
- Add focused unit coverage for the service that asserts parity on critical behaviors (session reuse for propagation, propagation calls made, event ordering/narrative dispatch).
- Keep event payloads, narrative text, and state transitions byte-for-byte identical for existing scenarios.

## File list

- src/logic/services/damageResolutionService.js (new)
- src/logic/operationHandlers/applyDamageHandler.js (delegate to service; keep public API)
- src/dependencyInjection/ (tokens/registrations) only if required to supply the new service
- tests/unit/logic/services/damageResolutionService.test.js (new coverage)
- tests/e2e/actions/swingAtTargetFullFlow.e2e.test.js (parity guard)

## Out of scope

- Armor/mitigation logic beyond parity with current handler behavior.
- Schema changes (`applyDamage.schema.json`) or new request fields.
- Reordering narratives/events beyond what is necessary to route through the service.

## Acceptance criteria

- Tests: `npm run test:unit -- damageResolutionService` (service unit) and `npm run test:e2e -- swingAtTargetFullFlow.e2e.test.js` pass; existing handler unit tests must continue to pass.
- Invariants: Health, part state, and death resolution outputs match pre-refactor behavior; emitted events and narratives remain byte-for-byte identical for existing scenarios.

## Outcome

- Implemented `DamageResolutionService` encapsulating the prior APPLY_DAMAGE orchestration (session lifecycle, health mutation, propagation, narrative/death ordering) and wired it into `applyDamageHandler` delegation without changing the handler’s public API.
- Added DI token/registration so the service is injectable alongside the existing damage services.
- Added focused unit coverage for the service and reran the critical swing-at-target e2e plus the existing handler unit suite to confirm parity with pre-refactor behavior.
