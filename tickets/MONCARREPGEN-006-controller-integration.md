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

  const expressionName = this.#getExpressionName(this.#selectedExpression);
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

Where the controller is instantiated (likely in a registration or bootstrap file), ensure the new dependencies are passed:

```javascript
// In the factory that creates ExpressionDiagnosticsController
new ExpressionDiagnosticsController({
  // ... existing dependencies ...
  reportGenerator: c.resolve(tokens.MonteCarloReportGenerator),
  reportModal: c.resolve(tokens.MonteCarloReportModal),
});
```

**Note**: Check `src/expressionDiagnostics/bootstrapExpressionDiagnostics.js` or similar bootstrap file for where the controller is constructed.

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

- [ ] `#generateReportBtn` property added
- [ ] `#reportModal` property added
- [ ] `#reportGenerator` property added
- [ ] `#currentBlockers` property initialized as empty array
- [ ] Constructor accepts `reportGenerator` dependency
- [ ] Constructor accepts `reportModal` dependency
- [ ] `#bindDomElements()` queries `#generate-report-btn`
- [ ] `#setupEventListeners()` adds click handler for generate button
- [ ] `#displayMonteCarloResults()` stores blockers in `#currentBlockers`
- [ ] `#resetMonteCarloResults()` clears `#currentBlockers`
- [ ] `#handleGenerateReport()` method implemented
- [ ] Handler validates required data before generating
- [ ] Handler calls `#reportGenerator.generate()` with correct params
- [ ] Handler calls `#reportModal.showReport()` with generated content
- [ ] Error handling prevents report failures from breaking UI
- [ ] Existing simulation tests still pass
- [ ] File passes ESLint
- [ ] File passes typecheck
- [ ] Manual E2E flow works correctly
