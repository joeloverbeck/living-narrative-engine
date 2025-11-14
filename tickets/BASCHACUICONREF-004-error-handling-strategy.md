# BASCHACUICONREF-004: Build ErrorHandlingStrategy Service

**Status:** Not Started  
**Priority:** High  
**Estimated Effort:** 4 days  
**Phase:** 1 - Service Extraction  
**Reference:** `reports/base-character-builder-controller-refactoring.md` (Section 1.4)

## Objective

Centralize error creation, categorization, logging, and recovery logic into `src/characterBuilder/services/errorHandlingStrategy.js`, decoupling UI feedback from controller internals.

## Implementation Tasks

1. **Service API Implementation**  
   - Constructor dependencies: `{ logger, eventBus, uiStateManager }`.  
   - Methods to implement: `handleError`, `handleServiceError`, `executeWithErrorHandling`, `categorizeError`, `generateUserMessage`, `determineRecoverability`, `isRetryableError`, `createError`, `wrapError`, `attemptErrorRecovery`, `lastError` getter.  
   - Provide typed error detail object (include metadata, user message, recoverability flags).  
   - Ensure `executeWithErrorHandling` wraps async operations, logs metrics, and optionally retries when `options.retryStrategy` present.

2. **UI/State Integration**  
   - When recoverable, delegate to `uiStateManager.showState('error', { message })`; otherwise escalate.  
   - Emit structured events on `eventBus` (e.g., `characterBuilder:error`) for observers.  
   - Provide hook for controllers to register fallback UI states for specific categories.

3. **Unit Tests**  
   - `tests/unit/characterBuilder/services/errorHandlingStrategy.test.js`.  
   - Cover error categorization heuristics, user message derivation, service error pipeline, retry logic, and UI notifications.  
   - Mock `logger`, `eventBus`, `uiStateManager` to assert interactions.  
   - Validate `lastError` resets on successful operations.

4. **Controller Refactor Hooks**  
   - Replace direct `_handleServiceError`, `_showError`, `_retryLastOperation` implementations in base controller with delegations to the service while keeping method names for subclasses temporarily.  
   - Add TODO pointing to BASCHACUICONREF-010 for final removal.

5. **Documentation + Error Taxonomy**  
   - Document supported categories (validation, network, dependency, lifecycle, unknown) and mapping rules.  
   - Provide recommended usage snippet for subclass authors.

## Acceptance Criteria

- Error handling logic removed from `BaseCharacterBuilderController` except for simple delegations.  
- Service emits consistent log structure and UI updates verified through unit tests.  
- Retry/Recovery flows behave as before (validated by integration tests triggered in BASCHACUICONREF-012).  
- Documentation outlines taxonomy + integration instructions.
