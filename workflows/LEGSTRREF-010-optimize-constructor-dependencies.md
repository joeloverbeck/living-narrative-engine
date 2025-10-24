# LEGSTRREF-010: Optimize Constructor Dependencies

## Metadata
- **Ticket ID**: LEGSTRREF-010
- **Phase**: 4 - Dependency Optimization
- **Priority**: Medium
- **Effort**: 1 day
- **Status**: Not Started
- **Dependencies**: LEGSTRREF-009
- **Blocks**: LEGSTRREF-011

## Problem Statement

The `LegacyStrategy` constructor currently has 9 dependencies. By leveraging the utility classes created in Phase 1 and making some dependencies optional, we can reduce this to 6-7.

### Current Dependencies (9)
1. `commandFormatter`
2. `entityManager`
3. `safeEventDispatcher`
4. `getEntityDisplayNameFn`
5. `logger`
6. `fallbackFormatter`
7. `createError`
8. `targetNormalizationService`
9. `validateVisualProperties`

### Target Dependencies (6-7)
1. `commandFormatter`
2. `entityManager`
3. `getEntityDisplayNameFn`
4. `logger`
5. `fallbackFormatter`
6. `targetNormalizationService`
7. `safeEventDispatcher` (optional)

## Implementation

### Step 1: Replace Function Dependencies with Static Utilities

**Before**:
```javascript
constructor({
  commandFormatter,
  entityManager,
  safeEventDispatcher,
  getEntityDisplayNameFn,
  logger,
  fallbackFormatter,
  createError,
  targetNormalizationService,
  validateVisualProperties,
}) {
  this.#createError = createError;
  this.#validateVisualProperties = validateVisualProperties;
  // ...
}
```

**After**:
```javascript
constructor({
  commandFormatter,
  entityManager,
  getEntityDisplayNameFn,
  logger,
  fallbackFormatter,
  targetNormalizationService,
  safeEventDispatcher = null,
}) {
  // Use static utilities instead
  // FormattingUtils.createError()
  // FormattingUtils.validateVisualProperties()

  this.#safeEventDispatcher = safeEventDispatcher; // Now optional
  // ...
}
```

### Step 2: Make safeEventDispatcher Optional

Since it's only used for passthrough in some cases, make it optional with null checks.

### Step 3: Create FormattingErrorHandler in Constructor

```javascript
constructor({ logger, ...otherDeps }) {
  // ...
  this.#errorHandler = new FormattingErrorHandler(
    logger,
    FormattingUtils.createError
  );
}
```

### Step 4: Update All Call Sites

Update where `LegacyStrategy` is instantiated (dependency injection registrations).

### Step 5: Update Tests

Update all test mocks to match new constructor signature.

## Acceptance Criteria

- ✅ Constructor dependencies reduced to 6-7
- ✅ Static utilities used instead of injected functions
- ✅ `safeEventDispatcher` is optional
- ✅ All call sites updated
- ✅ All tests updated and passing
- ✅ No behavioral changes

## Validation Steps

```bash
npm run test:unit -- tests/unit/actions/pipeline/stages/actionFormatting/legacy/
npm run test:integration -- tests/integration/actions/
npm run test:ci
```

## Files Affected

### Modified Files
- `src/actions/pipeline/stages/actionFormatting/legacy/LegacyStrategy.js`
- `src/dependencyInjection/registrations/*.js` (registration files)
- All test files that mock LegacyStrategy

## Related Tickets
- **Depends on**: LEGSTRREF-009
- **Blocks**: LEGSTRREF-011
- **Part of**: Phase 4 - Dependency Optimization
