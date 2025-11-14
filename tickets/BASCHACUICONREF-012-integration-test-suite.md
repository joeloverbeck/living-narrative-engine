# BASCHACUICONREF-012: Expand Character Builder Integration + E2E Tests

**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 3 days  
**Phase:** 2 - Validation  
**Reference:** `reports/base-character-builder-controller-refactoring.md` (Testing Strategy & Benefits sections)

## Objective

Ensure parity between the legacy god object and the refactored architecture by introducing targeted integration + E2E tests that exercise DOM caching, event handling, lifecycle, async utilities, validation, and error flows end-to-end.

## Implementation Tasks

1. **Integration Tests**  
   - Add `tests/integration/characterBuilder/baseController.integration.test.js` covering: initialization success/failure, lifecycle reinitialize, DOM manager interactions, event registry cleanup, timer teardown, validation errors.  
   - Use dependency injection to plug mocked services when verifying orchestration logic.

2. **Controller-Specific Scenarios**  
   - Extend/introduce integration specs for `TraitsGeneratorController`, `SpeechPatternsGeneratorController`, `TraitsRewriterController` verifying UI state transitions and event-driven interactions with new services.  
   - Validate that `destroy()` tears down timers, DOM references, and event listeners.

3. **E2E Smoke Flow**  
   - Update existing E2E test suites (if located under `tests/e2e/characterBuilder/`) or create new ones ensuring a user can open the builder, interact with forms, trigger async generators, and recover from validation errors.  
   - Use Playwright/Puppeteer harness already defined for repo (see docs) to run scenario.

4. **Regression Harness**  
   - Provide snapshot or fixture data to detect regressions in generated UI states/performance metrics.  
   - Hook tests into CI by updating `package.json` scripts or workflow definitions.

5. **Documentation**  
   - Document new test entry points and how to run them (`npm run test:integration characterBuilder`, `npm run test:e2e characterBuilder`).  
   - Include table mapping major responsibilities to at least one test.

## Acceptance Criteria

- Integration + E2E suites exist and run green locally/CI.  
- Failures provide actionable error messages referencing BASCHACUICONREF migration context.  
- Test coverage demonstrates that new services behave correctly when composed through controllers.  
- Documentation updated with commands + scope of each suite.
