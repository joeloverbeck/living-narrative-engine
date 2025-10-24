# LEGSTRREF-009: Remove Deprecated Methods

## Metadata
- **Ticket ID**: LEGSTRREF-009
- **Phase**: 3 - Duplication Elimination
- **Priority**: High
- **Effort**: 0.5 days
- **Status**: Not Started
- **Dependencies**: LEGSTRREF-008
- **Blocks**: LEGSTRREF-010

## Problem Statement

After unified formatting is implemented and verified, remove the deprecated `#formatTraced` and `#formatStandard` methods to complete duplication elimination.

## Implementation

### Step 1: Verify Unified Method is Working

Run full test suite to ensure `#formatActions` handles all cases.

### Step 2: Remove Deprecated Methods

Delete from `LegacyStrategy.js`:
- `#formatTraced` method (247 lines)
- `#formatStandard` method (206 lines)
- Any helper methods only used by these

### Step 3: Clean Up Tests

Remove or update tests that directly tested the old methods.

### Step 4: Update Documentation

Update JSDoc and inline comments to reflect the unified approach.

## Acceptance Criteria

- ✅ `#formatTraced` method removed
- ✅ `#formatStandard` method removed
- ✅ All tests updated
- ✅ All tests passing
- ✅ Documentation updated
- ✅ Code review approved

## Validation Steps

```bash
npm run test:ci
npm run lint
npm run typecheck
```

## Files Affected

### Modified Files
- `src/actions/pipeline/stages/actionFormatting/legacy/LegacyStrategy.js`
- Test files (cleanup)

## Related Tickets
- **Depends on**: LEGSTRREF-008
- **Blocks**: LEGSTRREF-010
- **Part of**: Phase 3 - Duplication Elimination
