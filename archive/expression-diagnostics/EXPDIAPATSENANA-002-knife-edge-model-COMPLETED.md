# EXPDIAPATSENANA-002: Create KnifeEdge Model - COMPLETED

## Summary

Create the `KnifeEdge` data model representing a brittle constraint where the feasible interval for an axis is very narrow (technically satisfiable but likely to cause issues in practice).

## Priority: High | Effort: Small

## Rationale

When OR branches create extremely narrow feasible intervals (e.g., `agency_control` forced to exactly 0.10), the expression is technically possible but extremely unlikely to trigger naturally. The `KnifeEdge` model captures these warnings so content authors can understand why their expression rarely fires.

## Dependencies

- **None** - This is a foundational model with no dependencies on other EXPDIAPATSENANA tickets

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/models/KnifeEdge.js` | **Create** |
| `src/expressionDiagnostics/models/index.js` | **Modify** (add export) |
| `tests/unit/expressionDiagnostics/models/KnifeEdge.test.js` | **Create** |

## Out of Scope

- **DO NOT** implement PathSensitiveAnalyzer service - that's EXPDIAPATSENANA-005
- **DO NOT** implement knife-edge detection logic - that's EXPDIAPATSENANA-006
- **DO NOT** create AnalysisBranch model - that's EXPDIAPATSENANA-001
- **DO NOT** create UI components for knife-edge display - that's EXPDIAPATSENANA-008
- **DO NOT** add DI registration - models don't need DI tokens

## Definition of Done

- [x] `KnifeEdge.js` created with all methods implemented
- [x] `models/index.js` updated with export
- [x] Unit tests cover all public methods
- [x] Tests cover validation edge cases
- [x] Tests verify severity categorization
- [x] Tests verify formatting methods
- [x] Tests verify JSON roundtrip
- [x] JSDoc documentation complete
- [x] All tests pass
- [x] DEFAULT_THRESHOLD constant exported

## Outcome

### What Was Actually Changed vs Originally Planned

**Fully Implemented as Planned:**
- Created `KnifeEdge.js` model with all specified methods and properties
- Added export to `models/index.js`
- Created comprehensive test suite with 64 tests achieving 100% coverage

**Minor Deviation:**
- Enhanced JSDoc type annotation for `fromJSON()` static method to fix TypeScript type checking (used inline type `{axis: string, min: number, max: number, contributingPrototypes?: string[], contributingGates?: string[]}` instead of generic `Object`)

**Test Coverage:**
- 64 tests covering all constructor validation, getters, immutability, isPoint property, isBelowThreshold(), severity property, formatInterval(), formatContributors(), toJSON(), fromJSON(), toWarningMessage(), toDisplayObject(), and static DEFAULT_THRESHOLD
- 100% statement, branch, function, and line coverage on KnifeEdge.js

**Verification Results:**
- All unit tests pass
- No TypeScript errors related to KnifeEdge
- Export verified working from models/index.js
- ESLint shows only pre-existing JSDoc style warnings (consistent with other models in the codebase)

### Files Modified/Created
1. `src/expressionDiagnostics/models/KnifeEdge.js` - **Created** (206 lines)
2. `src/expressionDiagnostics/models/index.js` - **Modified** (added 1 export line)
3. `tests/unit/expressionDiagnostics/models/KnifeEdge.test.js` - **Created** (64 tests, ~650 lines)
