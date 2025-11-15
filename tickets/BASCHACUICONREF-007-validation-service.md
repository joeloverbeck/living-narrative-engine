# BASCHACUICONREF-007: Extract ValidationService

**Status:** Not Started  
**Priority:** Medium  
**Estimated Effort:** 2 days  
**Phase:** 1 - Service Extraction  
**Reference:** `reports/base-character-builder-controller-refactoring.md` (Section 1.7)

## Objective

Move schema validation helpers from the base controller into `src/characterBuilder/services/validationService.js`, ensuring consistent error formatting and reusable validation flows.

## Current State Reference

- `_validateData`, `_formatValidationErrors`, and `_buildValidationErrorMessage` currently live directly in `src/characterBuilder/controllers/BaseCharacterBuilderController.js`. They wrap the injected `schemaValidator` dependency and are synchronous helpers (`schemaValidator.validate(schemaId, data)` returns `{ isValid, errors }`).
- Successful validations return `{ isValid: true }`. Failures return `{ isValid: false, errors: formattedErrors, errorMessage: <string>, failureMessage: <string> }` where `failureMessage` is also logged via `logger.warn` together with `{ operation, schemaId }` metadata.
- If the schema validator throws (e.g., schema missing), the controller calls `_handleError` with `ERROR_CATEGORIES.SYSTEM`, `userMessage: 'Validation failed. Please check your input.'`, and metadata `{ schemaId, dataKeys }` before returning `{ isValid: false, errors: ['Validation error: <message>'], errorMessage: 'Unable to validate data. Please try again.' }`.
- `_formatValidationErrors` accepts AJV-style error objects (string or `{ instancePath, message }`) and normalizes them into user-facing strings; `_buildValidationErrorMessage` collapses a single error into one string and prefixes multi-error payloads with `"Please fix the following errors"` plus a bullet list.

## Implementation Tasks

1. **Service Implementation**
   - Create `src/characterBuilder/services/validationService.js` with a constructor that accepts `{ schemaValidator, logger, handleError, errorCategories }`. `handleError` should be wired to `BaseCharacterBuilderController._handleError` (or the shared `ErrorHandlingStrategy`) so thrown validator errors still go through the centralized pathway.
   - Implement `validateData(data, schemaId, context = {})`, `formatValidationErrors(errors)`, and `buildValidationErrorMessage(errors)` with the exact behavior described in **Current State Reference**. Successful validations return `{ isValid: true }`; invalid payloads return `{ isValid: false, errors, errorMessage, failureMessage }` and log `failureMessage` via `logger.warn`, merging `context` metadata (operation, payload type, etc.) with `{ schemaId }`.
   - When `schemaValidator.validate` throws, call `handleError(error, { operation: context.operation || 'validateData', category: errorCategories.SYSTEM, userMessage: 'Validation failed. Please check your input.', metadata: { schemaId, dataKeys: Object.keys(data || {}) } })` before returning the fallback `{ isValid: false, errors: [
     `Validation error: ${error.message}`
   ], errorMessage: 'Unable to validate data. Please try again.' }` response.

2. **Unit Tests**
   - File: `tests/unit/characterBuilder/services/validationService.test.js`.
   - Mock `schemaValidator` to return valid/invalid responses; ensure formatted errors contain field paths and user-readable strings exactly like the BaseCharacterBuilderController coverage suite currently asserts.
   - Validate that `logger.warn` receives the failure message plus merged context metadata, and that thrown validator errors trigger the injected `handleError` with `ERROR_CATEGORIES.SYSTEM` before returning the fallback response payload.

3. **Controller Delegation**
   - Keep the existing protected API surface (`_validateData`, `_formatValidationErrors`, `_buildValidationErrorMessage`) so downstream controllers and unit tests stay untouched; internally, delegate those helpers to a lazily created `ValidationService` instance (pattern it after `#getErrorHandlingStrategy`).
   - Pass `{ schemaValidator, logger, handleError: this._handleError.bind(this), errorCategories: ERROR_CATEGORIES }` into the service so `schemaValidator.validate(schemaId, data)` remains the single validation entry point and centralized error handling still works.

4. **Docs**
   - Document the `{ isValid, errors, errorMessage, failureMessage }` contract and how controllers should handle invalid data next to the ErrorHandlingStrategy guidance so the BASCHACUICONREF-000 program plan stays accurate for downstream teams.

## Acceptance Criteria

- Base controller free of schema-specific logic, relying solely on the ValidationService.  
- Unit tests reach ≥90% coverage for the new service and the updated controller delegation logic.  
- Validation result interface documented and referenced in ErrorHandlingStrategy docs.  
- Integration tests updated (see BASCHACUICONREF-012) to confirm invalid payloads still surface user-friendly errors.
