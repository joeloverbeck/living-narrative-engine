# EXPDIAPATSENANA-007: Integration Test for flow_absorption Fix

## Status: COMPLETED

## Summary

Create the integration test that validates the original bug fix: `flow_absorption.expression.json` should correctly report that `flow >= 0.85` IS reachable via interest/fascination branches, NOT incorrectly flag it as unreachable.

## Priority: High | Effort: Small

## Rationale

This ticket validates the core value proposition of path-sensitive analysis. The `flow_absorption` expression was the originating issue that revealed the false-positive problem. The integration test serves as:
1. Regression prevention for the specific bug
2. Documentation of expected behavior
3. Validation that the full analysis pipeline works correctly

## Dependencies

- **EXPDIAPATSENANA-006** (Complete PathSensitiveAnalyzer with constraint analysis)
- Existing expression loading infrastructure
- Existing emotion prototype definitions in data/mods/

## Files Created

| File | Description |
|------|-------------|
| `tests/integration/expression-diagnostics/flowAbsorptionAnalysis.integration.test.js` | Main integration test (547 lines) |
| `tests/fixtures/expressionDiagnostics/pathSensitive/flowAbsorptionOriginal.expression.json` | Primary fixture recreating original bug scenario |
| `tests/fixtures/expressionDiagnostics/pathSensitive/orBranchAllReachable.expression.json` | Fixture: all branches reachable |
| `tests/fixtures/expressionDiagnostics/pathSensitive/orBranchMixedReachable.expression.json` | Fixture: mixed reachability |
| `tests/fixtures/expressionDiagnostics/pathSensitive/nestedOrBranches.expression.json` | Fixture: nested ORs |

## Outcome

### Implementation Notes

**Critical Discovery**: The actual `flow_absorption.expression.json` in `data/mods/emotions-attention/expressions/` has drifted from the original bug scenario. The current expression only has interest/fascination branches (2 OR options), whereas the original bug involved 3 OR branches including entrancement.

**Solution**: Per user guidance, the integration tests use custom fixtures that recreate the **original bug scenario** as documented in the ticket assumptions. The primary fixture `flowAbsorptionOriginal.expression.json` contains:
- `flow >= 0.70` (always)
- OR block with `interest >= 0.45 | fascination >= 0.45 | entrancement >= 0.40`
- Second prerequisite with `flow >= 0.85` in an OR block

This ensures the tests validate the path-sensitive analysis behavior for the exact scenario that revealed the bug.

### Test Strategy

The integration test uses direct fixture loading rather than mod loading because:
1. The actual mod expression has drifted from the original bug state
2. Test fixtures allow controlled validation of specific scenarios
3. The `IDataRegistry` is wrapped to provide mock emotion prototypes with realistic gate constraints

Key mock data includes entrancement with `agency_control <= 0.10` gate, which creates the knife-edge constraint when combined with flow's `agency_control >= 0.10` gate.

### Test Coverage

16 tests implemented across 4 test suites:

**Originating issue validation (3 tests)**:
- Validates `hasFullyReachableBranch` returns true
- Validates entrancement branch has agency_control knife-edge
- Validates interest/fascination branches have NO knife-edges

**Branch enumeration validation (3 tests)**:
- Validates at least 3 branches enumerated
- Validates meaningful branch descriptions
- Validates unique branch IDs

**Fixture tests (9 tests)**:
- `orBranchAllReachable`: all branches reachable, no knife-edges
- `orBranchMixedReachable`: mixed reachability with entrancement knife-edge
- `nestedOrBranches`: nested OR block handling

**Service resolution test (1 test)**:
- Validates `IPathSensitiveAnalyzer` resolves from DI container

### Verification

```bash
# All 16 tests pass
npm run test:integration -- tests/integration/expression-diagnostics/flowAbsorptionAnalysis.integration.test.js --verbose

# Fixtures directory exists with 4 JSON files
ls tests/fixtures/expressionDiagnostics/pathSensitive/
```

### Definition of Done Checklist

- [x] Integration test file created
- [x] Test fixtures created in pathSensitive/ directory
- [x] Tests use fixtures to recreate original bug scenario
- [x] Tests validate hasFullyReachableBranch = true
- [x] Tests validate entrancement branch has knife-edge on agency_control
- [x] Tests verify branch enumeration >= 3 branches
- [x] All 16 integration tests pass
- [x] Fixtures have valid JSON schema references
