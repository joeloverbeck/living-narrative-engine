# MONCARREPGEN-002: DI Token and Registration

## Summary

Add DI tokens and container registrations for `MonteCarloReportGenerator` so it can be injected into the `ExpressionDiagnosticsController`.

> **Scope Correction**: Original ticket included `MonteCarloReportModal`, but that class doesn't exist yet (MONCARREPGEN-005 not complete). The modal's token and registration will be added when the class is created in MONCARREPGEN-005.

## Priority: High | Effort: Small

## Rationale

The dependency injection system requires tokens and registrations for all services. This ticket prepares the DI infrastructure so the controller integration (MONCARREPGEN-006) can resolve the report generator service.

## Dependencies

- **MONCARREPGEN-001** - MonteCarloReportGenerator class must exist ✅ (Complete)

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/dependencyInjection/tokens/tokens-ui.js` | **Modify** |
| `src/dependencyInjection/registrations/uiRegistrations.js` | **Modify** |

## Out of Scope

- **DO NOT** create MonteCarloReportGenerator.js - that's MONCARREPGEN-001 ✅
- **DO NOT** create MonteCarloReportModal.js - that's MONCARREPGEN-005
- **DO NOT** modify ExpressionDiagnosticsController - that's MONCARREPGEN-006
- **DO NOT** modify any other registration files
- **DO NOT** add tokens for other services
- **DO NOT** add MonteCarloReportModal token/registration - deferred to MONCARREPGEN-005

## Implementation Details

### Token Addition (tokens-ui.js)

Add one new token to the `uiTokens` object:

```javascript
// In src/dependencyInjection/tokens/tokens-ui.js

export const uiTokens = freeze({
  // ... existing tokens ...
  PromptPreviewModal: 'PromptPreviewModal',
  // ADD THIS:
  MonteCarloReportGenerator: 'MonteCarloReportGenerator',
});
```

### Registration Addition (uiRegistrations.js)

Add registration for `MonteCarloReportGenerator`. Follow the existing service registration pattern:

```javascript
// In src/dependencyInjection/registrations/uiRegistrations.js

// Add import at top (with other imports)
import MonteCarloReportGenerator from '../../expressionDiagnostics/services/MonteCarloReportGenerator.js';

// Add registration in registerRenderers function (after PromptPreviewModal)
registerWithLog(
  registrar,
  tokens.MonteCarloReportGenerator,
  (c) =>
    new MonteCarloReportGenerator({
      logger: c.resolve(tokens.ILogger),
    }),
  { lifecycle: 'singletonFactory' },
  logger
);
```

### Import Statement Placement

The import should be added alongside other service imports, after the existing modal imports around line 39-40.

### Registration Placement

Add registration after `PromptPreviewModal` registration in the `registerRenderers` function.

## Acceptance Criteria

### Tests That Must Pass

```bash
# Type check must pass
npm run typecheck

# Lint must pass
npx eslint src/dependencyInjection/tokens/tokens-ui.js
npx eslint src/dependencyInjection/registrations/uiRegistrations.js
```

### Invariants That Must Remain True

1. **Token uniqueness**: No duplicate token values in `uiTokens`
2. **Token naming**: Token key matches token string value exactly
3. **Frozen object**: `uiTokens` remains frozen (using `freeze()`)
4. **Singleton lifecycle**: Service uses `'singletonFactory'` lifecycle
5. **Dependency resolution**: All resolved tokens (ILogger) exist

## Verification Commands

```bash
# Verify token is exported
node -e "
  import('./src/dependencyInjection/tokens/tokens-ui.js')
    .then(m => {
      console.log('MonteCarloReportGenerator:', m.uiTokens.MonteCarloReportGenerator);
    });
"

# Type check
npm run typecheck

# Lint both files
npx eslint src/dependencyInjection/tokens/tokens-ui.js src/dependencyInjection/registrations/uiRegistrations.js
```

## Definition of Done

- [x] `MonteCarloReportGenerator` token added to `tokens-ui.js`
- [x] Token value matches token key exactly (string equality)
- [x] `MonteCarloReportGenerator` import added to `uiRegistrations.js`
- [x] `MonteCarloReportGenerator` registration added with `singletonFactory` lifecycle
- [x] Registration resolves correct dependencies (ILogger)
- [x] Files pass ESLint (0 errors, pre-existing warnings only)
- [x] Files pass typecheck (pre-existing errors in other files only)

> **Note**: `MonteCarloReportModal` token and registration deferred to MONCARREPGEN-005

---

## Outcome

**Status**: ✅ COMPLETED

**Date**: 2026-01-10

### Scope Adjustment

**Originally planned**:
- Add token and registration for `MonteCarloReportGenerator`
- Add token and registration for `MonteCarloReportModal`

**Actually implemented**:
- Add token and registration for `MonteCarloReportGenerator` only

**Reason**: `MonteCarloReportModal` class does not exist yet (MONCARREPGEN-005 not complete). The modal's DI registration will be added when the class is created.

### Files Modified

| File | Change |
|------|--------|
| `src/dependencyInjection/tokens/tokens-ui.js` | Added `MonteCarloReportGenerator` token |
| `src/dependencyInjection/registrations/uiRegistrations.js` | Added import and `singletonFactory` registration |

### Verification Results

- **ESLint**: 0 errors (11 pre-existing warnings)
- **Token export verification**: `MonteCarloReportGenerator: MonteCarloReportGenerator` ✅
- **Registration placement**: After `PromptPreviewModal` in `registerRenderers()` function
