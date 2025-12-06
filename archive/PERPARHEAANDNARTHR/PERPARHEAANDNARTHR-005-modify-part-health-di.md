# PERPARHEAANDNARTHR-005: MODIFY_PART_HEALTH DI Registration

**Status:** Completed
**Priority:** Critical (Phase 2)
**Estimated Effort:** 0.5 days
**Dependencies:**

- PERPARHEAANDNARTHR-003 (MODIFY_PART_HEALTH Schema)
- PERPARHEAANDNARTHR-004 (MODIFY_PART_HEALTH Handler)

---

## Objective

Complete the DI registration for the `MODIFY_PART_HEALTH` operation following the project's standard operation registration pattern. This includes token definition, factory registration, operation mapping, and pre-validation whitelist update.

---

## Files to Touch

### New Files

- None

### Modified Files

- `src/dependencyInjection/tokens/tokens-core.js` (add token)
- `src/dependencyInjection/registrations/operationHandlerRegistrations.js` (add factory)
- `src/dependencyInjection/registrations/interpreterRegistrations.js` (add mapping)
- `src/utils/preValidationUtils.js` (add to `KNOWN_OPERATION_TYPES`)

---

## Out of Scope

**DO NOT modify:**

- The handler implementation (covered in PERPARHEAANDNARTHR-004)
- The schema (covered in PERPARHEAANDNARTHR-003)
- Any other operation registrations
- Any component files
- Any event files
- Any test files for DI (existing DI tests should continue to pass)

---

## Implementation Details

### 1. Token Definition

In `src/dependencyInjection/tokens/tokens-core.js`, add to the tokens object (maintain alphabetical order within operation handlers section):

```javascript
ModifyPartHealthHandler: 'ModifyPartHealthHandler',
```

### 2. Handler Factory Registration

In `src/dependencyInjection/registrations/operationHandlerRegistrations.js`:

**Add import** at the top with other handler imports:

```javascript
import ModifyPartHealthHandler from '../../logic/operationHandlers/modifyPartHealthHandler.js';
```

**Add factory** to the `handlerFactories` array (maintain alphabetical order):

```javascript
[
  tokens.ModifyPartHealthHandler,
  ModifyPartHealthHandler,
  (c, Handler) =>
    new Handler({
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      jsonLogicService: c.resolve(tokens.JsonLogicEvaluationService),
    }),
],
```

### 3. Operation Mapping

In `src/dependencyInjection/registrations/interpreterRegistrations.js`:

**Add mapping** in the operation registry section (maintain alphabetical order):

```javascript
registry.register('MODIFY_PART_HEALTH', bind(tokens.ModifyPartHealthHandler));
```

### 4. Pre-Validation Whitelist

In `src/utils/preValidationUtils.js`:

**Add to `KNOWN_OPERATION_TYPES` array** (maintain alphabetical order):

```javascript
'MODIFY_PART_HEALTH',
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Type checking:**

   ```bash
   npm run typecheck
   ```

2. **Full validation (including pre-validation):**

   ```bash
   npm run validate
   ```

3. **Unit tests (DI should resolve correctly):**

   ```bash
   npm run test:unit
   ```

4. **Full test suite:**
   ```bash
   npm run test:ci
   ```

### Invariants That Must Remain True

1. All existing operation registrations remain unchanged
2. Token follows naming convention: `ModifyPartHealthHandler` (PascalCase, no "I" prefix)
3. Operation type string matches schema exactly: `MODIFY_PART_HEALTH`
4. Handler can be resolved from DI container
5. No circular dependency issues
6. Pre-validation accepts rules using `MODIFY_PART_HEALTH`

---

## Verification Steps

```bash
# 1. Type check
npm run typecheck

# 2. Validate (checks pre-validation whitelist)
npm run validate

# 3. Run unit tests
npm run test:unit

# 4. Run full test suite
npm run test:ci

# 5. Verify handler resolves (optional manual check)
node -e "
  // This would need proper bootstrap context
  console.log('Check that MODIFY_PART_HEALTH appears in operation registry');
"

# 6. Lint modified files
npx eslint src/dependencyInjection/tokens/tokens-core.js src/dependencyInjection/registrations/operationHandlerRegistrations.js src/dependencyInjection/registrations/interpreterRegistrations.js src/utils/preValidationUtils.js
```

---

## Reference Files

- Token pattern: `src/dependencyInjection/tokens/tokens-core.js` (see existing operation handler tokens)
- Factory pattern: `src/dependencyInjection/registrations/operationHandlerRegistrations.js` (see existing factories)
- Mapping pattern: `src/dependencyInjection/registrations/interpreterRegistrations.js` (see existing mappings)
- Whitelist: `src/utils/preValidationUtils.js` (see `KNOWN_OPERATION_TYPES`)

---

## Checklist

Per CLAUDE.md "Adding New Operations" section:

- [x] Schema created (PERPARHEAANDNARTHR-003)
- [x] Schema $ref added to operation.schema.json (PERPARHEAANDNARTHR-003)
- [x] Handler implemented (PERPARHEAANDNARTHR-004)
- [x] Token defined in tokens-core.js (this ticket)
- [x] Factory registered in operationHandlerRegistrations.js (this ticket)
- [x] Operation mapped in interpreterRegistrations.js (this ticket)
- [x] **CRITICAL**: Added to KNOWN_OPERATION_TYPES in preValidationUtils.js (this ticket)

---

## Outcome

**Completion Date:** 2025-11-28

### What Was Changed vs Originally Planned

The implementation was already complete when this ticket was reviewed. The actual implementation matched the planned changes with one minor correction:

**Originally proposed in ticket:**

```javascript
{
  token: tokens.ModifyPartHealthHandler,
  factory: (container) => new ModifyPartHealthHandler({
    entityManager: container.resolve(tokens.IEntityManager),
    eventDispatcher: container.resolve(tokens.ISafeEventDispatcher),
    jsonLogicService: container.resolve(tokens.IJsonLogicEvaluationService),
    logger: container.resolve(tokens.ILogger)
  })
},
```

**Actual implementation:**

```javascript
[
  tokens.ModifyPartHealthHandler,
  ModifyPartHealthHandler,
  (c, Handler) =>
    new Handler({
      entityManager: c.resolve(tokens.IEntityManager),
      logger: c.resolve(tokens.ILogger),
      safeEventDispatcher: c.resolve(tokens.ISafeEventDispatcher),
      jsonLogicService: c.resolve(tokens.JsonLogicEvaluationService),
    }),
],
```

**Key differences:**

1. Factory uses array pattern `[token, Handler, factoryFn]` matching project's current style
2. Dependency name is `safeEventDispatcher` (not `eventDispatcher`) matching handler constructor
3. Uses `tokens.JsonLogicEvaluationService` (not `tokens.IJsonLogicEvaluationService`) matching project's token naming

### Verification Results

All verifications passed:

- ✅ Token defined at line 204 in `tokens-core.js`
- ✅ Factory registered at line 187-195 in `operationHandlerRegistrations.js`
- ✅ Operation mapped at line 93-95 in `interpreterRegistrations.js`
- ✅ Added to `KNOWN_OPERATION_TYPES` at line 71 in `preValidationUtils.js`
- ✅ DI tests pass (394 tests in 43 test suites)
- ✅ Handler tests pass (45 tests)
- ✅ Lint passes with no errors (only pre-existing warnings)
