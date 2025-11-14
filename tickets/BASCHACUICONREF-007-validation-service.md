# BASCHACUICONREF-007: Extract ValidationService

**Status:** Not Started  
**Priority:** Medium  
**Estimated Effort:** 2 days  
**Phase:** 1 - Service Extraction  
**Reference:** `reports/base-character-builder-controller-refactoring.md` (Section 1.7)

## Objective

Move schema validation helpers from the base controller into `src/characterBuilder/services/validationService.js`, ensuring consistent error formatting and reusable validation flows.

## Implementation Tasks

1. **Service Implementation**  
   - Constructor accepts `{ schemaValidator, logger }`.  
   - Implement methods `validateData(data, schemaId, context = {})`, `formatValidationErrors(errors)`, `buildValidationErrorMessage(errors)`.  
   - Ensure `validateData` throws/returns structured results matching current behavior (e.g., { valid, errors, formattedMessage }).  
   - Allow context metadata (controller name, payload type) to be logged with validation failures.

2. **Unit Tests**  
   - File: `tests/unit/characterBuilder/services/validationService.test.js`.  
   - Mock `schemaValidator` to return valid/invalid responses; ensure formatted errors contain field paths and user-readable strings.  
   - Validate logging occurs once per invalid payload.

3. **Controller Delegation**  
   - Replace `_validateData`, `_formatValidationErrors`, `_buildValidationErrorMessage` inside base controller with service calls.  
   - Provide getter `validator` returning the service; update dependent methods to call `this.validator.validateData(...)`.

4. **Docs**  
   - Document standard validation result contract and how controllers should handle invalid data (tie into ErrorHandlingStrategy).

## Acceptance Criteria

- Base controller free of schema-specific logic, relying solely on the ValidationService.  
- Unit tests reach ≥90% coverage.  
- Validation result interface documented and referenced in ErrorHandlingStrategy docs.  
- Integration tests updated (see BASCHACUICONREF-012) to confirm invalid payloads still surface user-friendly errors.
