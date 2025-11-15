# BASCHACUICONREF-004: Build ErrorHandlingStrategy Service

**Status:** Not Started
**Priority:** High
**Estimated Effort:** 4 days
**Phase:** 1 - Service Extraction
**Reference:** `reports/base-character-builder-controller-refactoring.md` (Section 1.4)

## Objective

Centralize the error creation, categorization, logging, and recovery logic that currently lives inside `src/characterBuilder/controllers/BaseCharacterBuilderController.js` (there is no service file yet). The end goal remains the same as outlined in BASCHACUICONREF-000: carve responsibilities out of the 3,600+ line base controller so UI feedback and recovery flows are coordinated by a dedicated service instead of the controller internals.

### Current Implementation Snapshot

- `BaseCharacterBuilderController` defines `ERROR_CATEGORIES` (validation, network, system, user, permission, not_found) and `ERROR_SEVERITY`, then wires error reporting directly to the injected `logger`, `eventBus`, and lazily created `UIStateManager`.
- `_handleError` orchestrates `_buildErrorDetails`, `_logError`, `_showErrorToUser`, `_dispatchErrorEvent`, `_determineRecoverability`, `_isRecoverableError`, `_attemptErrorRecovery`, and tracks `#lastError`.
- `_executeWithErrorHandling` already implements retry logic through `_isRetryableError`, while `_handleServiceError` is the protected hook used by controller subclasses. `_createError` and `_wrapError` provide standardized error objects.
- UI feedback runs through `_showError`, which delegates to `_showState(UI_STATES.ERROR, ...)` → `UIStateManager.showState`.
- `_dispatchErrorEvent` emits `SYSTEM_ERROR_OCCURRED` on the shared event bus with structured payloads (`{ error, context, category, severity, controller, timestamp, stack, metadata }`).

All workflow steps below reference these integration points to avoid inventing functionality that does not exist yet.

## Implementation Tasks

1. **Service API Implementation**
   - Constructor dependencies still come from the base controller: `{ logger, eventBus, uiStateManager }`. Logger/event bus instances are already injected; the UI state manager is accessed via `_showState`, so either pass the service a `showState`/`showError` callback or the `UIStateManager` instance that the controller holds.
   - Implement a service exposing the same capabilities currently embedded in the controller: `handleError`, `handleServiceError`, `executeWithErrorHandling`, `categorizeError`, `generateUserMessage`, `determineRecoverability`, `isRetryableError`, `createError`, `wrapError`, `attemptErrorRecovery`, plus a `lastError` getter.
   - Preserve the `errorDetails` structure created by `_buildErrorDetails` (timestamp, controller, category, severity, metadata including `url` + `userAgent`, `isRecoverable`, etc.).
   - Keep the retry semantics from `_executeWithErrorHandling` (logger debug/info output per attempt, `_isRetryableError` keyword heuristics, `setTimeout(resolve, retryDelay * attempt)` backoff) so existing behavior remains unchanged.

2. **UI/State + Event Integration**
   - Mirror the `_showError` + `_showState(UI_STATES.ERROR, ...)` flow rather than calling `uiStateManager.showState` directly. Accept a hook from the controller or the `UIStateManager` instance it constructs.
   - Reuse the `SYSTEM_ERROR_OCCURRED` emission format from `_dispatchErrorEvent` so downstream observers continue to receive `{ error, context, category, severity, controller, timestamp, stack, metadata }`.
   - Provide a way for controllers to register fallback UI states/retry hooks per category. Until BASCHACUICONREF-010 eliminates the legacy methods, wrap existing controller callbacks such as `_retryLastOperation` and `_reinitialize` when orchestrating recovery.

3. **Unit Tests**
   - Add `tests/unit/characterBuilder/services/errorHandlingStrategy.test.js` covering: categorization heuristics from `_categorizeError`, user message derivation from `_generateUserMessage`, retry logic inside `_executeWithErrorHandling`, recoverability evaluation from `_determineRecoverability`/`_isRecoverableError`, and UI notifications via `_showError`.
   - Mock `logger`, `eventBus`, and the UI-state hook to assert the same behaviors exercised in `_logError`, `_dispatchErrorEvent`, and `_showErrorToUser` today.
   - Validate that `lastError` matches controller behavior (tracks the most recent error and is cleared between successful operations) and that retry metadata is propagated to log/event payloads.

4. **Controller Refactor Hooks**
   - In `BaseCharacterBuilderController.js`, replace the bodies of `_handleError`, `_handleServiceError`, `_executeWithErrorHandling`, `_isRetryableError`, `_determineRecoverability`, `_isRecoverableError`, `_attemptErrorRecovery`, `_createError`, `_wrapError`, and the `lastError` getter with delegations to the new service while keeping the existing method signatures for subclasses.
   - Keep `_showError`, `_showState`, `_dispatchErrorEvent`, and `_retryLastOperation` intact for now; wire them to the service via callbacks where practical.
   - Add TODO comments pointing to BASCHACUICONREF-010 for the final removal once controllers consume only the service façade.

5. **Documentation + Error Taxonomy**
   - Document the categories codified in `BaseCharacterBuilderController` (`ERROR_CATEGORIES`). Clarify how dependency or lifecycle failures map into that taxonomy (typically `system`) instead of inventing new labels.
   - Provide usage snippets showing how current controllers call `_handleServiceError`/`_executeWithErrorHandling` and how those calls migrate to the service façade. Include guidance for emitting `SYSTEM_ERROR_OCCURRED` for observers.

## Acceptance Criteria

- Error handling logic removed from `BaseCharacterBuilderController` except for simple delegations.
- Service emits consistent log structure and UI updates verified through unit tests.
- Retry/Recovery flows behave as before (validated by integration tests triggered in BASCHACUICONREF-012).
- Documentation outlines taxonomy + integration instructions.
