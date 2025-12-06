# LLMSUGACTROB-002 Ensure TurnContext wiring includes PlayerPromptService

Status: Completed

Reassessed: `ConcreteTurnContextFactory` already requires `promptCoordinator` and adds it to the services bag, and DI registration wires `IPromptCoordinator` into the factory. The remaining gap is DI coverage to prove the prompt service flows through the container into a created `TurnContext`.

## File list

- src/turns/factories/concreteTurnContextFactory.js (reference only; already injects promptCoordinator)
- src/dependencyInjection/registrations/turnLifecycleRegistrations.js (reference only; already registers IPromptCoordinator)
- tests/unit/turns/factories/concreteTurnContextFactory.test.js (asserts services bag contents)
- tests/integration/registerTurnLifecycle.test.js (add DI bootstrap coverage for promptCoordinator / PlayerPromptService)

## Out of scope

- No changes to ActionDecisionWorkflow logic beyond wiring consumption.
- No UI or renderer updates.
- No refactors to unrelated services in the TurnContext bag.

## Acceptance criteria

### Tests

- `npm run test -- tests/unit/turns/factories/concreteTurnContextFactory.test.js` keeps verifying the services bag contains `promptCoordinator`.
- Integration test under `tests/integration/registerTurnLifecycle.test.js` exercises DI bootstrap and confirms `getPlayerPromptService()` resolves to the registered `IPromptCoordinator`.

### Invariants

- TurnContext services bag continues to include existing entries (`safeEventDispatcher`, `turnEndPort`, `entityManager`, etc.).
- Factory fails fast when promptCoordinator is absent (current behavior preserved); test doubles should provide it explicitly.
- DI registration stays compatible with existing lifecycle bootstrapping (no breaking constructor signature changes).

## Outcome

- Confirmed existing wiring already injects `promptCoordinator` in both the factory and DI registration; no changes required to production code.
- Added DI integration coverage so `getPlayerPromptService()` is exercised through container bootstrapping; left existing unit assertions intact.
