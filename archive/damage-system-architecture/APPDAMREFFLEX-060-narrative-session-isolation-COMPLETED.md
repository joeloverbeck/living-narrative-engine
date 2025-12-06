# APPDAMREFFLEX-060 Narrative and session isolation

## Status

Completed — assumptions corrected and scope narrowed to session cleanup.

## Goal

Ensure the damage session lifecycle stays isolated even when resolution bails out early (e.g., effect application throws) so follow-on APPLY_DAMAGE calls are not contaminated by a stale `executionContext.damageSession`. Preserve the existing narrative/event ordering that already lives inside `DamageResolutionService` (per `specs/apply-damage-refactor-flexibility.md`).

## Reality check (assumptions corrected)

- `DamageResolutionService` already owns session creation/finalization, narrative composition, and event dispatch; the handler only resolves inputs and delegates.
- There is no `DamageResult` payload surface; narrative/events are dispatched directly from the service using `DamageAccumulator` entries.
- Sessions are shared via `executionContext.damageSession` (not tokens). Tests (`tests/integration/anatomy/damageMessageAccumulation.integration.test.js`, `tests/unit/logic/services/damageResolutionService.test.js`) already assert narrative-before-damage_applied ordering and session cleanup on the happy path.
- `DeathCheckService` consumes entity state directly; no handler-owned damage totals exist.

## Scope

- Harden top-level session cleanup in `DamageResolutionService` so `executionContext.damageSession` is removed even when resolution exits via error handling before narrative/event dispatch.
- Add/adjust unit coverage to exercise the error path cleanup without changing narratives, payloads, or event order.

## File list

- src/logic/services/damageResolutionService.js (session lifecycle cleanup)
- tests/unit/logic/services/damageResolutionService.test.js (error-path session cleanup)

## Out of scope

- Changing textual narrative content or introducing/removing events.
- Mitigation/propagation math changes (covered elsewhere).
- Schema or handler API changes; no DamageResult surface added in this ticket.

## Acceptance criteria

- Relevant unit coverage for error-path session cleanup passes alongside existing damage resolution tests.
- Invariants: Event ordering stays narrative → queued damage events → death finalization; narrative text for existing scenarios remains byte-identical to current output.

## Outcome

- Hardened `DamageResolutionService` with a top-level try/finally cleanup so `executionContext.damageSession` is cleared even when resolution exits early (e.g., effect application throws), keeping subsequent APPLY_DAMAGE calls isolated.
- Added a targeted unit test covering the error-path cleanup; no schema or API changes and narrative/event ordering remain unchanged.
