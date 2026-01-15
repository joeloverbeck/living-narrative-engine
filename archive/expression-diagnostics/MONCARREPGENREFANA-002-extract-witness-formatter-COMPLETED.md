# MONCARREPGENREFANA-002: Extract WitnessFormatter

## Status: COMPLETED

## Summary

Extract 6 witness/context state formatting methods from MonteCarloReportGenerator into a dedicated WitnessFormatter service. These methods format witness state data for display in the report.

## Priority: High | Effort: Low | Risk: LOW

## Rationale

These methods form a cohesive group for formatting witness/context state data:
- Clear domain boundary (witness formatting)
- Depends only on ReportFormattingService (already extracted)
- Pure functions with no internal state dependencies

**Note**: `#formatBindingAxes` is called from prototype analysis context, not witness formatting. It's grouped here for extraction convenience but may be relocated to PrototypeFormatter during MONCARREPGENREFANA-008.

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/WitnessFormatter.js` | **Create** - New service (~150 lines) |
| `tests/unit/expressionDiagnostics/services/witnessFormatter.test.js` | **Create** - Unit tests |
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | **Modify** - Remove methods, add service usage |
| `src/expressionDiagnostics/services/index.js` | **Modify** - Export new service |

**Note**: `MonteCarloReportWorker.js` does NOT need modification - it uses the default fallback pattern in MonteCarloReportGenerator's constructor.

## Out of Scope

- **DO NOT** change ReportFormattingService (already complete)
- **DO NOT** change section generators
- **DO NOT** change statistical calculations
- **DO NOT** change integrity analysis methods
- **DO NOT** change any DI registrations
- **DO NOT** change MonteCarloReportWorker.js

## Methods to Extract

```javascript
#formatWitness(witness, index)      // ~52 lines - orchestrates witness formatting
#formatMoodState(mood, label)       // ~20 lines - formats 8 mood axes
#formatSexualState(sexual, label)   // ~12 lines - formats 3 sexual state fields
#formatAffectTraits(traits)         // ~12 lines - formats 3 affect traits
#formatComputedEmotions(emotions, label) // ~10 lines - formats emotions (3-decimal precision)
#formatBindingAxes(bindingAxes)     // ~22 lines - formats binding axes with conflict detection
```

Total: ~128 lines to extract

## Implementation Details

### Service Structure

```javascript
/**
 * @file WitnessFormatter - Formats witness/context state data for reports
 */
import ReportFormattingService from './ReportFormattingService.js';

class WitnessFormatter {
  #formattingService;

  constructor({ formattingService }) {
    if (!formattingService) {
      throw new Error('WitnessFormatter requires formattingService');
    }
    this.#formattingService = formattingService;
  }

  formatWitness(witness, index) { /* ... */ }
  formatMoodState(mood, label) { /* ... */ }
  formatSexualState(sexual, label) { /* ... */ }
  formatAffectTraits(traits) { /* ... */ }
  formatComputedEmotions(emotions, label) { /* ... */ }
  formatBindingAxes(bindingAxes) { /* ... */ }
}

export default WitnessFormatter;
```

### Integration Pattern

In MonteCarloReportGenerator:
```javascript
constructor(deps) {
  // ... existing
  this.#formattingService = deps.formattingService ?? new ReportFormattingService();
  this.#witnessFormatter = deps.witnessFormatter ?? new WitnessFormatter({
    formattingService: this.#formattingService
  });
}
```

## Acceptance Criteria

### Tests That Must Pass

1. **New WitnessFormatter unit tests:**
   ```bash
   npm run test:unit -- tests/unit/expressionDiagnostics/services/witnessFormatter.test.js --verbose
   ```

2. **Snapshot test unchanged:**
   ```bash
   npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --verbose
   ```

3. **All existing MonteCarloReportGenerator tests pass:**
   ```bash
   npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator --verbose
   ```

### Invariants That Must Remain True

1. **Report output identical**: Snapshot test must pass unchanged
2. **Dependency injection**: Service receives formattingService via constructor
3. **Backwards compatible**: MonteCarloReportGenerator creates services internally if not provided
4. **No circular dependencies**: WitnessFormatter → ReportFormattingService only

## Verification Commands

```bash
# Run new unit tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/witnessFormatter.test.js --verbose

# Verify snapshot unchanged
npm run test:integration -- tests/integration/expression-diagnostics/monteCarloReportSnapshot.integration.test.js --verbose

# Run all related tests
npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator --verbose

# Lint new files
npx eslint src/expressionDiagnostics/services/WitnessFormatter.js
```

## Definition of Done

- [x] WitnessFormatter.js created with all 6 methods
- [x] Unit tests cover all methods including edge cases
- [x] MonteCarloReportGenerator.js updated to use service
- [x] index.js exports new service
- [x] Snapshot test passes unchanged
- [x] All existing tests pass
- [x] ~130 lines removed from MonteCarloReportGenerator.js

## Dependencies

- **Requires**: MONCARREPGENREFANA-001 (ReportFormattingService must exist)
- **Blocks**: MONCARREPGENREFANA-011 (CoreSectionGenerator uses this)

---

## Outcome

### What Was Actually Changed vs Originally Planned

**Planned:**
- Extract 6 methods from MonteCarloReportGenerator to WitnessFormatter service
- Create unit tests for the new service
- Update MonteCarloReportGenerator to use the service via dependency injection

**Actual:**
- All planned changes completed as specified
- ~168 lines removed from MonteCarloReportGenerator.js (slightly more than estimated ~130 due to JSDoc comments)
- WitnessFormatter.js created (~233 lines including JSDoc documentation)
- witnessFormatter.test.js created (46 tests across all 6 methods + constructor)

### Discrepancies Found and Corrected

1. **No existing witness tests**: The original ticket mentioned "existing witness section tests" but grep confirmed no witness-specific tests exist in monteCarloReportGenerator.test.js
2. **MonteCarloReportWorker.js**: Confirmed it does NOT need modification - uses fallback pattern
3. **Pure functions**: Confirmed all 6 methods are pure functions that don't actually call `#formattingService` methods - the dependency is stored for architectural consistency

### Test Results

- **WitnessFormatter unit tests**: 46 tests passed
- **Snapshot integration tests**: 8 tests passed, 8 snapshots matched
- **MonteCarloReportGenerator unit tests**: 195 tests passed

### Files Modified/Created

| File | Action | Lines |
|------|--------|-------|
| `src/expressionDiagnostics/services/WitnessFormatter.js` | Created | 233 |
| `tests/unit/expressionDiagnostics/services/witnessFormatter.test.js` | Created | ~370 |
| `src/expressionDiagnostics/services/MonteCarloReportGenerator.js` | Modified | -168 lines |
| `src/expressionDiagnostics/services/index.js` | Modified | +1 line |
| `tickets/MONCARREPGENREFANA-002-extract-witness-formatter.md` | Updated | Corrected assumptions |
