# MONCARREPGEN-006: Controller Integration

## Summary

Wire up the "Generate Report" button, modal, and report generator in `ExpressionDiagnosticsController`. Add storage for blockers data and implement the report generation flow.

## Priority: High | Effort: Medium

## Rationale

The controller is the orchestration point that connects:
- User action (button click)
- Data (simulation results + blockers)
- Services (report generator)
- UI (modal display)

This ticket implements the complete user-facing flow for generating and viewing reports.

## Dependencies

- **MONCARREPGEN-001** - MonteCarloReportGenerator class must exist
- **MONCARREPGEN-002** - DI tokens and registrations must exist
- **MONCARREPGEN-003** - HTML elements must exist
- **MONCARREPGEN-005** - MonteCarloReportModal class must exist

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | **Modify** |
| `src/dependencyInjection/tokens/tokens-ui.js` | **Modify** - Add `MonteCarloReportModal` token (missing from MONCARREPGEN-002) |
| `src/dependencyInjection/registrations/uiRegistrations.js` | **Modify** - Add `MonteCarloReportModal` registration (missing from MONCARREPGEN-002) |
| `src/expression-diagnostics.js` | **Modify** - Wire up new dependencies to controller |
| `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js` | **Modify** - Add mock dependencies and test DOM element |

### Assumption Corrections (discovered during implementation)

1. **MonteCarloReportModal DI Token**: MONCARREPGEN-002 only added `MonteCarloReportGenerator` token, not `MonteCarloReportModal`. Adding it here.
2. **MonteCarloReportModal Registration**: MONCARREPGEN-002 only registered `MonteCarloReportGenerator`, not the modal. Adding it here.
3. **Controller Instantiation**: The controller is instantiated manually in `src/expression-diagnostics.js`, not via DI factory. Updating entry point accordingly.

## Out of Scope

- **DO NOT** modify MonteCarloReportGenerator.js - that's MONCARREPGEN-001
- **DO NOT** modify MonteCarloReportModal.js - that's MONCARREPGEN-005
- **DO NOT** modify HTML - that's MONCARREPGEN-003
- **DO NOT** modify CSS - that's MONCARREPGEN-004
- **DO NOT** modify MonteCarloSimulator or FailureExplainer
- **DO NOT** change existing simulation flow or results display

## Implementation Details

### New Private Properties

Add these properties to the class:

```javascript
// After existing properties like #currentResult, #selectedExpression
#generateReportBtn;
#reportModal;
#reportGenerator;
#currentBlockers = [];
```

### Constructor Dependency Injection

Update the constructor to accept new dependencies:

```javascript
constructor({
  // ... existing dependencies ...
  reportGenerator,
  reportModal,
}) {
  // ... existing validation ...

  // Add new dependency assignments
  this.#reportGenerator = reportGenerator;
  this.#reportModal = reportModal;
}
```

### DOM Element Binding

In `#bindDomElements()`, add:

```javascript
#bindDomElements() {
  // ... existing bindings ...
  this.#generateReportBtn = document.querySelector('#generate-report-btn');
}
```

### Event Listener Setup

In `#setupEventListeners()`, add:

```javascript
#setupEventListeners() {
  // ... existing listeners ...

  if (this.#generateReportBtn) {
    this.#generateReportBtn.addEventListener('click', () => this.#handleGenerateReport());
  }
}
```

### Store Blockers in displayMonteCarloResults

In the `#displayMonteCarloResults(result, blockers, summary)` method, add blocker storage:

```javascript
#displayMonteCarloResults(result, blockers, summary) {
  // ... existing code ...

  // Store blockers for report generation
  this.#currentBlockers = blockers;

  // ... rest of existing display logic ...
}
```

### Clear Blockers in resetMonteCarloResults

In the `#resetMonteCarloResults()` method, add:

```javascript
#resetMonteCarloResults() {
  // ... existing reset code ...

  // Clear stored blockers
  this.#currentBlockers = [];
}
```

### Generate Report Handler

Add new method:

```javascript
/**
 * Handle Generate Report button click.
 * Generates markdown report and displays in modal.
 * @private
 */
#handleGenerateReport() {
  if (!this.#currentResult || !this.#selectedExpression) {
    this.#logger.warn('Cannot generate report: no simulation results');
    return;
  }

  if (!this.#reportGenerator || !this.#reportModal) {
    this.#logger.error('Report generator or modal not available');
    return;
  }

  const expressionName = this.#getExpressionName(this.#selectedExpression.id);
  const summary = this.#mcSummary?.textContent || '';

  try {
    const report = this.#reportGenerator.generate({
      expressionName,
      simulationResult: this.#currentResult,
      blockers: this.#currentBlockers,
      summary,
    });

    this.#reportModal.showReport(report);
    this.#logger.debug('Report generated and displayed');
  } catch (err) {
    this.#logger.error('Failed to generate report:', err);
    // Optionally show user-facing error
  }
}
```

### Update DI Resolution

The controller is instantiated in `src/expression-diagnostics.js` entry point. Import the `uiTokens` and resolve the new dependencies:

```javascript
// In src/expression-diagnostics.js postInitHook
import { uiTokens } from './dependencyInjection/tokens/tokens-ui.js';

// After registering expression diagnostics services, resolve UI services
const reportGenerator = container.resolve(uiTokens.MonteCarloReportGenerator);
const reportModal = container.resolve(uiTokens.MonteCarloReportModal);

// Pass to controller constructor
controller = new ExpressionDiagnosticsController({
  // ... existing dependencies ...
  reportGenerator,
  reportModal,
});
```

**Note**: Since MonteCarloReportModal requires `documentContext` and `validatedEventDispatcher`, we need to ensure the UI registrations are called or create the modal directly.

### Button Visibility

The button is inside `#mc-results` which has a `hidden` attribute when no results. This means:
- Button automatically hides when results are hidden
- No need for explicit enable/disable logic
- Button is only visible when simulation results exist

## Acceptance Criteria

### Tests That Must Pass

```bash
# Existing controller tests should still pass
npm run test:unit -- tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js --verbose

# Integration test (after MONCARREPGEN-009)
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReport.integration.test.js --verbose
```

### Invariants That Must Remain True

1. **Existing flow unchanged**: Monte Carlo simulation runs exactly as before
2. **Results display unchanged**: `#displayMonteCarloResults` continues to display all existing UI
3. **Blockers stored**: `#currentBlockers` is populated when results are displayed
4. **Blockers cleared**: `#currentBlockers` is cleared when results are reset
5. **Null safety**: Button click handler checks for required data before generating
6. **Error isolation**: Report generation errors don't break simulation flow

## Verification Commands

```bash
# Type check
npm run typecheck

# Lint the modified file
npx eslint src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js

# Run existing controller tests
npm run test:unit -- tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js

# Manual E2E verification
npm run dev
# 1. Open expression-diagnostics.html
# 2. Select an expression
# 3. Run Monte Carlo simulation
# 4. Click "Generate Report" button
# 5. Verify modal opens with report content
# 6. Click "Copy to Clipboard"
# 7. Verify clipboard contains report
# 8. Close modal
```

## Definition of Done

- [x] `#generateReportBtn` property added
- [x] `#reportModal` property added
- [x] `#reportGenerator` property added
- [x] `#currentBlockers` property initialized as empty array
- [x] Constructor accepts `reportGenerator` dependency
- [x] Constructor accepts `reportModal` dependency
- [x] `#bindDomElements()` queries `#generate-report-btn`
- [x] `#setupEventListeners()` adds click handler for generate button
- [x] `#displayMonteCarloResults()` stores blockers in `#currentBlockers`
- [x] `#resetMonteCarloResults()` clears `#currentBlockers`
- [x] `#handleGenerateReport()` method implemented
- [x] Handler validates required data before generating
- [x] Handler calls `#reportGenerator.generate()` with correct params
- [x] Handler calls `#reportModal.showReport()` with generated content
- [x] Error handling prevents report failures from breaking UI
- [x] Existing simulation tests still pass
- [x] File passes ESLint (pre-existing warnings and 1 pre-existing error remain)
- [x] File passes typecheck (pre-existing errors in other files remain)
- [ ] Manual E2E flow works correctly (requires manual verification)

## Outcome

**Status: COMPLETED**

### Implementation Summary

Successfully integrated the Monte Carlo report generation functionality into `ExpressionDiagnosticsController`. The implementation wires up:

1. **DI Integration**:
   - Added `MonteCarloReportModal` token to `tokens-ui.js` (line 66)
   - Added `MonteCarloReportModal` registration to `uiRegistrations.js` (lines 614-629)
   - Updated `expression-diagnostics.js` to manually instantiate dependencies (since controller is not DI-created)

2. **Controller Changes**:
   - Added private properties: `#reportGenerator`, `#reportModal`, `#generateReportBtn`, `#currentBlockers`
   - Added constructor validation for new dependencies (`IMonteCarloReportGenerator`, `IMonteCarloReportModal`)
   - Added DOM binding for `#generate-report-btn` in `#bindDomElements()`
   - Added click event listener in `#setupEventListeners()`
   - Added blocker storage in `#displayMonteCarloResults()`
   - Added blocker clearing in `#resetMonteCarloResults()`
   - Added `#handleGenerateReport()` method with proper null safety and error handling

3. **Test Updates**:
   - Added mock dependencies `mockReportGenerator` and `mockReportModal`
   - Added `#generate-report-btn` to test DOM
   - Updated all 191+ controller instantiations to include new dependencies
   - Added 6 new tests for report generation functionality

### Bug Fix During Implementation

Fixed a bug in `#handleGenerateReport()` where `this.#selectedExpression` (an object) was passed directly to `#getExpressionName()` instead of `this.#selectedExpression.id` (a string). This caused `expressionName` to be empty.

### Test Results

- All 201 unit tests pass
- Pre-existing ESLint warnings remain (not introduced by this change)
- Pre-existing ESLint error (`#currentPathSensitiveResult` unused) remains (not introduced by this change)

### Files Modified

| File | Changes |
|------|---------|
| `src/dependencyInjection/tokens/tokens-ui.js` | Added `MonteCarloReportModal` token |
| `src/dependencyInjection/registrations/uiRegistrations.js` | Added import and registration for `MonteCarloReportModal` |
| `src/expression-diagnostics.js` | Added manual instantiation of `MonteCarloReportGenerator` and `MonteCarloReportModal`, passed to controller |
| `src/domUI/expression-diagnostics/ExpressionDiagnosticsController.js` | Added report integration (properties, validation, DOM binding, event handling, blocker storage) |
| `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js` | Added mocks, test DOM element, updated instantiations, added 6 new tests |

### Notes for Future Tickets

- The controller's entry point (`expression-diagnostics.js`) manually instantiates dependencies rather than using DI, due to the need for `documentContext` and a noop event dispatcher
- MonteCarloReportModal was created with a noop `validatedEventDispatcher` since VED subscription management is not needed for this use case
