# REMGAMSAVLOAPER-000: Remove Save/Load Persistence — Ticket Set Overview

**Status**: ✅ Completed
**Priority**: HIGH

## Summary
This ticket set removes the game “Save Game” / “Load Game” persistence feature end-to-end (UI → bootstrap wiring → engine APIs → DI → persistence pipeline → tests), per `specs/remove-game-save-load-persistence.spec.md`.

## File list it expects to touch
- `tickets/REMGAMSAVLOAPER-000-overview.md`
- `tickets/REMGAMSAVLOAPER-001-ui-html-css-purge.md`
- `tickets/REMGAMSAVLOAPER-002-begingame-api-unit-tests.md`
- `tickets/REMGAMSAVLOAPER-003-begingame-integration-tests.md`
- `tickets/REMGAMSAVLOAPER-004-bootstrapper-wiring-save-load.md`
- `tickets/REMGAMSAVLOAPER-005-domui-save-load-removal.md`
- `tickets/REMGAMSAVLOAPER-006-engine-save-load-removal.md`
- `tickets/REMGAMSAVLOAPER-007-adapters-interfaces-tokens.md`
- `tickets/REMGAMSAVLOAPER-008-di-persistence-registrations-migration.md`
- `tickets/REMGAMSAVLOAPER-009-purge-src-persistence-utils-tests.md`

## Out of scope (must NOT change)
- Any code unrelated to *manual* game save/load persistence.
- LLM selection persistence (`src/llms/services/llmSelectionPersistence.js`).
- Anatomy “persistence” services (e.g. `src/anatomy/DescriptionPersistenceService.js`).
- Action tracing storage behavior except where coupled to save/load (keep `IStorageProvider` available).

## Acceptance criteria
### Specific tests that must pass
- This is a meta/overview ticket: no code changes are expected, so no tests are required for this ticket itself.

### Invariants that must remain true
- Implementation tickets remain small and independently reviewable (each should be mergeable without leaving the repo in a broken state).
- All tickets preserve the “out of scope” behavior above.

## Recommended implementation order
1. `REMGAMSAVLOAPER-001` (UI HTML/CSS purge)
2. `REMGAMSAVLOAPER-002` + `REMGAMSAVLOAPER-003` (remove `beginGame(showLoadUI)` and update tests)
3. `REMGAMSAVLOAPER-004` + `REMGAMSAVLOAPER-005` (remove UI bootstrap wiring + DomUI save/load modules)
4. `REMGAMSAVLOAPER-006` + `REMGAMSAVLOAPER-007` (remove engine APIs + adapters/interfaces/tokens)
5. `REMGAMSAVLOAPER-008` + `REMGAMSAVLOAPER-009` (remove DI persistence registrations + purge `src/persistence/` + remaining tests)

## Outcome (2025-12-17)

All 9 implementation tickets (REMGAMSAVLOAPER-001 through 009) have been completed successfully. The save/load persistence feature has been fully removed:

- **UI removed**: game.html no longer has Save/Load buttons or modals; index.html no longer has Load Game button
- **Engine cleaned**: No more `showSaveGameUI`, `showLoadGameUI`, `triggerManualSave`, `loadGame`, `PersistenceCoordinator` methods
- **DI cleaned**: Persistence registrations removed; `IStorageProvider` and `PlaytimeTracker` preserved in infrastructureRegistrations
- **Pipeline purged**: `src/persistence/` directory deleted entirely
- **Tests cleaned**: All save/load specific tests removed; remaining test suite passes

Key preserved items (out of scope):
- LLM selection persistence works correctly
- Action tracing with IStorageProvider works correctly
- SlotModalBase continues to support LLM selection modal

