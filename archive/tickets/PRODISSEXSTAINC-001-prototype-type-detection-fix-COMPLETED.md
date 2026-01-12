# PRODISSEXSTAINC-001: Fix Prototype Type Detection for Prerequisites Arrays

## Summary

Update PrototypeFitRankingService to detect referenced prototype types when callers pass a prerequisites array (not just full expressions), so sexual state prototypes are included when referenced.

## Priority: High | Effort: Small

## Status

Completed

## Rationale

Prototype Fit Analysis, Implied Prototype Analysis, and Gap Detection currently default to emotion prototypes only when callers pass prerequisites arrays. This hides sexual state prototypes referenced by expressions.

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/expressionDiagnostics/services/PrototypeFitRankingService.js` | Modify |

## Out of Scope

- **DO NOT** change any prototype intensity calculations
- **DO NOT** change prototype loading or registry code
- **DO NOT** modify UI rendering or controller behavior
- **DO NOT** change public method signatures

## Implementation Notes

- Update `#detectReferencedPrototypeTypes` to accept either a prerequisites array or an expression object.
- Update `analyzeAllPrototypeFit`, `computeImpliedPrototype`, and `detectPrototypeGaps` to pass the original input into `#detectReferencedPrototypeTypes` (arrays, maps, or expressions).
- Keep existing expression extraction logic required by `#extractExpressionPrototype`.

## Acceptance Criteria

### Tests That Must Pass

```bash
npm run test:unit -- --testPathPattern=prototypeFitRankingService
```

### Tests To Add/Update

- Add unit coverage for prerequisites-array inputs so sexual prototype detection is exercised without full expression objects.

### Invariants That Must Remain True

- Public method signatures of PrototypeFitRankingService remain unchanged.
- If no emotion or sexual state references are detected, the fallback remains emotion-only.
- Behavior for callers that pass full expression objects remains unchanged.

## Outcome

- Updated prototype type detection to accept prerequisites arrays (not just expression objects) and routed public methods to pass original inputs.
- Added unit coverage for prerequisites-array inputs to verify sexual prototype inclusion and fallback behavior; no UI or registry changes were made.
