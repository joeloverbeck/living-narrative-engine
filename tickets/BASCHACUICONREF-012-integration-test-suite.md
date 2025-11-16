# BASCHACUICONREF-012: Expand Character Builder Integration + E2E Tests

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 3 days
**Phase:** 2 - Validation
**Reference:** `reports/base-character-builder-controller-refactoring.md` (Testing Strategy & Benefits sections)

## Objective

Increase confidence in the existing 2,200+ line `BaseCharacterBuilderController` (still acting as the coordination layer until the refactor described in BASCHACUICONREF-000 lands) by tightening integration + E2E coverage around the real services it orchestrates today: `DOMElementManager`, `EventListenerRegistry`, `ControllerLifecycleOrchestrator`, `AsyncUtilitiesToolkit`, `ValidationService`, and the UI state manager.

## Implementation Tasks

1. **Integration Tests (Base Controller focus)**
   - Build on the existing suites in `tests/integration/characterBuilder/controllers/` (DI, utilities, recovery) instead of introducing a new root-level `baseController.integration.test.js` file.
   - Add scenarios that exercise the current DOM caching map, listener registration/cleanup, lifecycle reinitialize/destroy phases, async toolkit registration/unregistration, validation error propagation, and memory/performance helper teardown flows surfaced by `BaseCharacterBuilderController`.
   - Use the `BaseCharacterBuilderControllerIntegrationTestBase` helpers already present to inject mocked services rather than inventing a new DI harness.

2. **Controller-Specific Scenarios**
   - Extend the existing controller specs (`TraitsGeneratorController`, `SpeechPatternsGeneratorController`, `TraitsRewriterController`) under `tests/integration/characterBuilder/` to cover UI state transitions, DOM element caching, event-driven interactions with their real services, and `destroy()` cleanup of timers, DOM references, async utilities, and event listeners.
   - Validate interactions with `UIStateManager` constants and exported helper methods (e.g., state transitions between loading/results/error) to mirror how the production controllers are wired today.

3. **E2E Smoke Flow**
   - Use the current Jest-based E2E harness under `tests/e2e/traitsGenerator*.e2e.test.js` (jsdom-driven, not Playwright/Puppeteer) as the entry point for character builder user journeys.
   - Add end-to-end coverage that opens the builder flow, drives the forms, triggers async generators, and recovers from validation errors, reusing the existing fixtures/mocks in those suites.

4. **Regression Harness + CI wiring**
   - Prefer snapshot/fixture data that captures generated UI states or controller lifecycle metrics already exposed by the integration suites.
   - Keep CI wiring unchanged: integration suites run via `npm run test:integration -- tests/integration/characterBuilder/...` and E2E suites via `npm run test:e2e -- tests/e2e/traitsGenerator*.e2e.test.js`, both already included in `npm run test:ci`.

5. **Documentation**
   - Document the new/extended test entry points and the exact commands above rather than placeholders like `npm run test:integration characterBuilder`.
   - Include a table mapping each controller responsibility (DOM caching, lifecycle orchestration, async utilities, validation, error recovery) to at least one integration or E2E test that now covers it.

## Acceptance Criteria

- Integration + E2E suites exist alongside the current controller-focused tests and run green locally/CI using the documented commands.
- Failures provide actionable error messages referencing the BASCHACUICONREF migration context and the current controller/service touchpoints.
- Coverage demonstrates that the existing controller/services composition behaves correctly end-to-end, providing a baseline for the future refactor described in BASCHACUICONREF-000.
- Documentation updated with commands + scope of each suite.
