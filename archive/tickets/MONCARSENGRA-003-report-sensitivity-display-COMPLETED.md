# MONCARSENGRA-003: Report Output for Integer-Effective Thresholds

## Summary

Update the Monte Carlo report sensitivity tables to include effective-threshold clarity for integer domains and remove misleading decimal formatting.

## Status

Completed

## Priority: High | Effort: Medium

## Rationale

Report tables currently show decimal thresholds that imply precision beyond integer-valued inputs. The report should mirror the effective threshold behavior designers see in the UI.

## Dependencies

- **MONCARSENGRA-002** (effectiveThreshold metadata available - already integrated)

## Assumptions (Updated)

- `MonteCarloReportGenerator` already renders integer-domain effective thresholds, integer formatting, and the explanatory note.
- Unit tests in `tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js` already cover integer-domain columns and notes.

## Files to Touch

None (verification only)

## Out of Scope

- **DO NOT** modify Monte Carlo simulator logic or sensitivity grid generation
- **DO NOT** change UI tables (handled in a separate ticket)
- **DO NOT** change non-sensitivity report sections
- **DO NOT** alter report layout beyond the sensitivity table columns and notes

## Implementation Details

1. Verify sensitivity table formatting already shows:
   - An **Effective Threshold** column for integer-domain results.
   - Integer formatting for raw thresholds in integer-domain tables.
2. Verify the short note under integer-domain tables:
   - “Thresholds are integer-effective; decimals collapse to integer boundaries.”
3. Ensure floating-point domains retain the current columns and formatting.
4. Confirm unit tests assert:
   - Integer tables include the Effective Threshold column and note.
   - Float tables do not include that column or note.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- tests/unit/expressionDiagnostics/services/monteCarloReportGenerator.test.js --coverage=false
```

### Invariants That Must Remain True

- Non-sensitivity report sections render unchanged.
- Sensitivity tables still include the baseline marker for original thresholds.
- Floating-point domain tables remain at 0.05 resolution formatting.

## Outcome

- Actual: No code changes required; report formatting and tests already covered the integer-domain effective threshold display. Verified by running the unit suite.
- Planned: Add effective-threshold column/note and update tests to cover integer-domain formatting.
