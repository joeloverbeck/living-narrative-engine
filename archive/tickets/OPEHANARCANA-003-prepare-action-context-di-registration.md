# OPEHANARCANA-003: PREPARE_ACTION_CONTEXT DI Registration

**Status:** Completed
**Priority:** Critical (Phase 1)
**Estimated Effort:** 0.5 days
**Dependencies:** OPEHANARCANA-001 (schema), OPEHANARCANA-002 (handler)

---

## Objective

Register the `PrepareActionContextHandler` in the dependency injection system:

1. Define DI token
2. Register handler factory
3. Map operation type to handler
4. Add to pre-validation whitelist

---

## Files to Touch

### Modified Files

- `src/dependencyInjection/tokens/tokens-core.js` - Add token
- `src/dependencyInjection/registrations/operationHandlerRegistrations.js` - Add factory
- `src/dependencyInjection/registrations/interpreterRegistrations.js` - Add mapping
- `src/utils/preValidationUtils.js` - Add to KNOWN_OPERATION_TYPES

---

## Out of Scope

**DO NOT modify:**

- The handler implementation file (done in OPEHANARCANA-002)
- Any schema files (done in OPEHANARCANA-001)
- Any test files (covered in OPEHANARCANA-004)
- Any rule files (migrations are separate tickets)
- Any other token or registration files beyond those listed

---

## Implementation Details

### 1. Token Definition (`tokens-core.js`)

Add to the tokens object (alphabetically):

```javascript
PrepareActionContextHandler: 'PrepareActionContextHandler',
```

### 2. Handler Factory Registration (`operationHandlerRegistrations.js`)

Add import at top:

```javascript
import PrepareActionContextHandler from '../../logic/operationHandlers/prepareActionContextHandler.js';
```

Add factory to `handlerFactories` array (alphabetically by token name):

```javascript
{
  token: tokens.PrepareActionContextHandler,
  factory: (c) => new PrepareActionContextHandler({
    entityManager: c.resolve(tokens.IEntityManager),
    logger: c.resolve(tokens.ILogger),
  }),
},
```

### 3. Operation Mapping (`interpreterRegistrations.js`)

Add to the registry.register calls (keep alphabetical):

```javascript
registry.register(
  'PREPARE_ACTION_CONTEXT',
  bind(tokens.PrepareActionContextHandler)
);
```

### 4. Pre-Validation Whitelist (`preValidationUtils.js`)

Add to `KNOWN_OPERATION_TYPES` array (alphabetically):

```javascript
'PREPARE_ACTION_CONTEXT',
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **Type checking:**

   ```bash
   npm run typecheck
   ```

2. **Validation passes:**

   ```bash
   npm run validate
   ```

3. **Unit test suite passes:**

   ```bash
   npm run test:unit
   ```

4. **Integration test suite passes:**

   ```bash
   npm run test:integration
   ```

5. **Full CI suite:**
   ```bash
   npm run test:ci
   ```

### Invariants That Must Remain True

1. All existing tokens remain unchanged
2. All existing handler registrations remain unchanged
3. All existing operation mappings remain unchanged
4. `KNOWN_OPERATION_TYPES` array remains alphabetically sorted
5. No regressions in existing tests

---

## Verification Steps

```bash
# 1. Verify token uniqueness (no duplicates)
grep -r "PrepareActionContextHandler" src/dependencyInjection/

# 2. Verify operation type string matches schema exactly
grep "PREPARE_ACTION_CONTEXT" src/utils/preValidationUtils.js
grep "PREPARE_ACTION_CONTEXT" src/dependencyInjection/registrations/interpreterRegistrations.js

# 3. Run full validation
npm run validate

# 4. Run type checking
npm run typecheck

# 5. Run test suite
npm run test:ci

# 6. Verify ESLint passes on modified files
npx eslint src/dependencyInjection/tokens/tokens-core.js
npx eslint src/dependencyInjection/registrations/operationHandlerRegistrations.js
npx eslint src/dependencyInjection/registrations/interpreterRegistrations.js
npx eslint src/utils/preValidationUtils.js
```

---

## Common Pitfalls

❌ **Forgetting pre-validation whitelist**

- Symptom: "Unknown operation type" error during mod loading
- Fix: Add to `KNOWN_OPERATION_TYPES` in `preValidationUtils.js`

❌ **Type string mismatch**

- Symptom: "No handler registered" error at runtime
- Fix: Ensure `'PREPARE_ACTION_CONTEXT'` matches exactly in schema, registry, and whitelist

❌ **Missing import statement**

- Symptom: Runtime error "PrepareActionContextHandler is not defined"
- Fix: Add import at top of `operationHandlerRegistrations.js`

---

## Reference Files

- Token pattern: `src/dependencyInjection/tokens/tokens-core.js`
- Factory pattern: `src/dependencyInjection/registrations/operationHandlerRegistrations.js`
- Mapping pattern: `src/dependencyInjection/registrations/interpreterRegistrations.js`
- Whitelist: `src/utils/preValidationUtils.js`

---

## Outcome

- Registered `PrepareActionContextHandler` token in `tokens-core.js`.
- Registered `PrepareActionContextHandler` factory in `operationHandlerRegistrations.js`.
- Mapped `PREPARE_ACTION_CONTEXT` in `interpreterRegistrations.js`.
- Added `PREPARE_ACTION_CONTEXT` to whitelist in `preValidationUtils.js`.
- Verified with new integration test `tests/integration/dependencyInjection/operationHandlerRegistrations.test.js` and `npm run validate`.
