# MONCARSENGRA-004: UI Sensitivity Tables Show Effective Thresholds

## Summary

Align the Expression Diagnostics UI tests with the already-implemented effective-threshold display for integer-domain sensitivity tables, and add missing coverage for integer formatting and float-table column behavior.

## Status

Completed

## Priority: High | Effort: Medium

## Rationale

Designers rely on the in-browser diagnostics table. It must communicate the same effective threshold clarity as the report output.

## Dependencies

- **MONCARSENGRA-002** (effectiveThreshold metadata available, already wired into SensitivityAnalyzer)
- **MONCARSENGRA-003** (report formatting finalized for parity)

## Assumptions (Updated)

- `ExpressionDiagnosticsController` already renders the Effective column, integer-domain note, and integer formatting in sensitivity tables.
- Existing unit tests already cover the presence of the Effective column for integer domains, but lack coverage for float-domain column absence and integer formatting.

## Files to Touch

| File | Change Type |
|------|-------------|
| `tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js` | **Update** |

## Out of Scope

- **DO NOT** change Monte Carlo sampling or evaluation behavior
- **DO NOT** alter report rendering logic
- **DO NOT** change non-sensitivity UI sections
- **DO NOT** add new UI controls or filters

## Implementation Details

1. Confirm the UI already renders the **Effective** column when `isIntegerDomain` is true and `effectiveThreshold` values are present.
2. Verify integer-domain thresholds are formatted without trailing decimals for integer values (no behavioral changes expected).
3. Add unit-test coverage for:
   - Presence of the Effective column for integer-domain results.
   - Absence of the Effective column for float-domain results.
   - Integer formatting for integer-domain thresholds.
   - No regressions for floating-point table formatting.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/domUI/expression-diagnostics/ExpressionDiagnosticsController.test.js --coverage=false
```

### Invariants That Must Remain True

- Existing sensitivity table rendering continues to work for float domains.
- UI report download behavior remains unchanged.
- No changes to expression diagnostics state flow or data fetching.

## Outcome

UI rendering already met the spec; only tests were added to verify integer formatting and float-domain column structure.
