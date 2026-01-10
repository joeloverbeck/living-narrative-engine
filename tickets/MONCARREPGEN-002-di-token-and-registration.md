# MONCARREPGEN-002: DI Token and Registration

## Summary

Add DI tokens and container registrations for `MonteCarloReportGenerator` and `MonteCarloReportModal` so they can be injected into the `ExpressionDiagnosticsController`.

## Priority: High | Effort: Small

## Rationale

The dependency injection system requires tokens and registrations for all services. This ticket prepares the DI infrastructure so the controller integration (MONCARREPGEN-006) can resolve the new services.

## Dependencies

- **MONCARREPGEN-001** - MonteCarloReportGenerator class must exist

## Files to Touch

| File | Change Type |
|------|-------------|
| `src/dependencyInjection/tokens/tokens-ui.js` | **Modify** |
| `src/dependencyInjection/registrations/uiRegistrations.js` | **Modify** |

## Out of Scope

- **DO NOT** create MonteCarloReportGenerator.js - that's MONCARREPGEN-001
- **DO NOT** create MonteCarloReportModal.js - that's MONCARREPGEN-005
- **DO NOT** modify ExpressionDiagnosticsController - that's MONCARREPGEN-006
- **DO NOT** modify any other registration files
- **DO NOT** add tokens for other services

## Implementation Details

### Token Addition (tokens-ui.js)

Add two new tokens to the `uiTokens` object:

```javascript
// In src/dependencyInjection/tokens/tokens-ui.js

export const uiTokens = freeze({
  // ... existing tokens ...
  PromptPreviewModal: 'PromptPreviewModal',
  // ADD THESE TWO:
  MonteCarloReportGenerator: 'MonteCarloReportGenerator',
  MonteCarloReportModal: 'MonteCarloReportModal',
});
```

### Registration Addition (uiRegistrations.js)

Add registrations for both services. Follow the existing modal registration pattern:

```javascript
// In src/dependencyInjection/registrations/uiRegistrations.js

// Add import at top
import MonteCarloReportGenerator from '../../expressionDiagnostics/services/MonteCarloReportGenerator.js';
import MonteCarloReportModal from '../../domUI/expression-diagnostics/MonteCarloReportModal.js';

// Add registrations in the appropriate section (near other modal registrations)

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

registerWithLog(
  registrar,
  tokens.MonteCarloReportModal,
  (c) =>
    new MonteCarloReportModal({
      logger: c.resolve(tokens.ILogger),
      documentContext: c.resolve(tokens.IDocumentContext),
      validatedEventDispatcher: c.resolve(tokens.IValidatedEventDispatcher),
    }),
  { lifecycle: 'singletonFactory' },
  logger
);
```

### Import Statement Placement

The imports should be added alongside other modal imports. Look for the section with `LlmSelectionModal`, `PromptPreviewModal`, or `PortraitModalRenderer` imports.

### Registration Placement

Add registrations near other modal registrations. The order within the file should follow the pattern of grouping related services together.

## Acceptance Criteria

### Tests That Must Pass

```bash
# Type check must pass
npm run typecheck

# App should start without DI resolution errors
npm run dev
# (Check console for "Cannot resolve token" errors)

# Lint must pass
npx eslint src/dependencyInjection/tokens/tokens-ui.js
npx eslint src/dependencyInjection/registrations/uiRegistrations.js
```

### Invariants That Must Remain True

1. **Token uniqueness**: No duplicate token values in `uiTokens`
2. **Token naming**: Token key matches token string value exactly
3. **Frozen object**: `uiTokens` remains frozen (using `freeze()`)
4. **Singleton lifecycle**: Both services use `'singletonFactory'` lifecycle
5. **Dependency resolution**: All resolved tokens (ILogger, IDocumentContext, IValidatedEventDispatcher) exist

## Verification Commands

```bash
# Verify tokens are exported
node -e "
  import('./src/dependencyInjection/tokens/tokens-ui.js')
    .then(m => {
      console.log('MonteCarloReportGenerator:', m.uiTokens.MonteCarloReportGenerator);
      console.log('MonteCarloReportModal:', m.uiTokens.MonteCarloReportModal);
    });
"

# Type check
npm run typecheck

# Lint both files
npx eslint src/dependencyInjection/tokens/tokens-ui.js src/dependencyInjection/registrations/uiRegistrations.js
```

## Definition of Done

- [ ] `MonteCarloReportGenerator` token added to `tokens-ui.js`
- [ ] `MonteCarloReportModal` token added to `tokens-ui.js`
- [ ] Token values match token keys exactly (string equality)
- [ ] `MonteCarloReportGenerator` import added to `uiRegistrations.js`
- [ ] `MonteCarloReportModal` import added to `uiRegistrations.js`
- [ ] `MonteCarloReportGenerator` registration added with `singletonFactory` lifecycle
- [ ] `MonteCarloReportModal` registration added with `singletonFactory` lifecycle
- [ ] Both registrations resolve correct dependencies
- [ ] Files pass ESLint
- [ ] Files pass typecheck
- [ ] No runtime DI resolution errors
