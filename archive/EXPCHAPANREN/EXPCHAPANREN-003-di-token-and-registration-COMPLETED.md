# EXPCHAPANREN-003: DI Token and Registration

## Status: COMPLETED

## Summary

Add the DI token for `ExpressionMessageRenderer` and register it in the UI registrations file. This wires up the renderer for instantiation at application startup.

## Files to Modify

- `src/dependencyInjection/tokens/tokens-ui.js` (add token)
- `src/dependencyInjection/registrations/uiRegistrations.js` (add import, registration, and eager instantiation)

## Out of Scope

- **DO NOT** modify `expressionMessageRenderer.js` (handled in EXPCHAPANREN-002)
- **DO NOT** modify `ExpressionDispatcher` or any expression system files
- **DO NOT** modify CSS files
- **DO NOT** modify `game.html`
- **DO NOT** modify any other DI registration files

## Implementation Details

### 1. Modify `src/dependencyInjection/tokens/tokens-ui.js`

Add token after `DamageEventMessageRenderer`:

```javascript
export const uiTokens = freeze({
  // ... existing tokens ...
  DamageEventMessageRenderer: 'DamageEventMessageRenderer',
  ExpressionMessageRenderer: 'ExpressionMessageRenderer',  // ADD THIS
  // ... more tokens ...
});
```

### 2. Modify `src/dependencyInjection/registrations/uiRegistrations.js`

#### 2.1 Add Import

In the import block (after `DamageEventMessageRenderer`):

```javascript
import {
  // ... existing imports ...
  DamageEventMessageRenderer,
  ExpressionMessageRenderer,  // ADD THIS
  PromptPreviewModal,
} from '../../domUI/index.js';
```

#### 2.2 Add Registration

In `registerRenderers()` function, after `DamageEventMessageRenderer` registration:

```javascript
registerWithLog(
  registrar,
  tokens.ExpressionMessageRenderer,
  (c) =>
    new ExpressionMessageRenderer({
      logger: c.resolve(tokens.ILogger),
      documentContext: c.resolve(tokens.IDocumentContext),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      domElementFactory: c.resolve(tokens.DomElementFactory),
    }),
  { lifecycle: 'singletonFactory' },
  logger
);
```

#### 2.3 Add Eager Instantiation

In `registerUI()` function, after `DamageEventMessageRenderer` eager instantiation:

```javascript
container.resolve(tokens.DamageEventMessageRenderer);
logger.debug(
  `UI Registrations: Eagerly instantiated ${tokens.DamageEventMessageRenderer}.`
);

container.resolve(tokens.ExpressionMessageRenderer);  // ADD THESE
logger.debug(                                          // TWO LINES
  `UI Registrations: Eagerly instantiated ${tokens.ExpressionMessageRenderer}.`
);
```

## Acceptance Criteria

### Tests That Must Pass

1. `npm run typecheck` passes without errors
2. `npx eslint src/dependencyInjection/tokens/tokens-ui.js src/dependencyInjection/registrations/uiRegistrations.js` passes
3. Existing unit tests pass: `npm run test:unit -- tests/unit/dependencyInjection/`
4. Application starts without DI resolution errors

### Invariants That Must Remain True

1. All existing token values unchanged
2. All existing registrations unchanged (order may shift slightly)
3. `tokens.ExpressionMessageRenderer` resolves to `'ExpressionMessageRenderer'` string
4. Constructor dependency injection pattern matches `DamageEventMessageRenderer`
5. Lifecycle is `singletonFactory` (not `singleton`)
6. Renderer is eagerly instantiated to attach event listeners on startup

## Dependencies

- **EXPCHAPANREN-002** must be completed (class must exist and be exported)

## Testing Notes

After implementing, verify at runtime:
1. No console errors during application startup
2. `container.resolve(tokens.ExpressionMessageRenderer)` returns instance
3. Expression events trigger (if expression system is active)

## Estimated Diff Size

- `tokens-ui.js`: +1 line
- `uiRegistrations.js`: +20 lines

---

## Outcome

### What Was Discovered

Upon reassessing the ticket assumptions against the actual codebase, it was found that **all implementation work was already complete**:

1. ✅ **Token already defined**: `ExpressionMessageRenderer` token exists in `tokens-ui.js` at line 53
2. ✅ **Import already added**: `ExpressionMessageRenderer` is imported in `uiRegistrations.js` at line 38
3. ✅ **Registration already added**: Registration exists in `registerRenderers()` at lines 401-413
4. ✅ **Eager instantiation already added**: Exists in `registerUI()` at lines 663-666

### What Was Actually Changed

The implementation was complete, but **the DI unit tests were not updated** to reflect the new registration. Two tests were failing:

1. `tests/unit/dependencyInjection/registrations/uiRegistrations.registerRenderers.test.js`
   - **Issue**: Expected 15 registrations, but 16 existed (including `ExpressionMessageRenderer`)
   - **Fix**: Updated count from 15 to 16, added `expect(registeredTokens).toContain(tokens.ExpressionMessageRenderer)`

2. `tests/unit/dependencyInjection/registrations/uiRegistrations.test.js`
   - **Issue**: Missing the `ExpressionMessageRenderer` eager instantiation log message in expected sequence
   - **Fix**: Added the expected log message to the assertions

### Difference from Original Plan

| Planned | Actual |
|---------|--------|
| Add token to `tokens-ui.js` | Already done |
| Add import to `uiRegistrations.js` | Already done |
| Add registration to `registerRenderers()` | Already done |
| Add eager instantiation to `registerUI()` | Already done |
| Do NOT modify test files | **Had to modify** - tests were outdated |

### Files Modified

- `tests/unit/dependencyInjection/registrations/uiRegistrations.registerRenderers.test.js` (+3 lines)
- `tests/unit/dependencyInjection/registrations/uiRegistrations.test.js` (+1 line)

### Verification

All 416 DI unit tests pass after the test updates.
