# PERPARHEAANDNARTHR-008: UPDATE_PART_HEALTH_STATE DI Registration

**Status:** Ready
**Priority:** Critical (Phase 3)
**Estimated Effort:** 0.5 days
**Dependencies:**
- PERPARHEAANDNARTHR-006 (UPDATE_PART_HEALTH_STATE Schema)
- PERPARHEAANDNARTHR-007 (UPDATE_PART_HEALTH_STATE Handler)

---

## Objective

Complete the DI registration for the `UPDATE_PART_HEALTH_STATE` operation following the project's standard operation registration pattern. This includes token definition, factory registration, operation mapping, and pre-validation whitelist update.

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
- The handler implementation (covered in PERPARHEAANDNARTHR-007)
- The schema (covered in PERPARHEAANDNARTHR-006)
- Any other operation registrations
- Any component files
- Any event files
- Any test files for DI (existing DI tests should continue to pass)
- MODIFY_PART_HEALTH registrations (covered in PERPARHEAANDNARTHR-005)

---

## Implementation Details

### 1. Token Definition

In `src/dependencyInjection/tokens/tokens-core.js`, add to the tokens object (maintain alphabetical order within operation handlers section):

```javascript
UpdatePartHealthStateHandler: 'UpdatePartHealthStateHandler',
```

### 2. Handler Factory Registration

In `src/dependencyInjection/registrations/operationHandlerRegistrations.js`:

**Add import** at the top with other handler imports:
```javascript
import UpdatePartHealthStateHandler from '../../logic/operationHandlers/updatePartHealthStateHandler.js';
```

**Add factory** to the `handlerFactories` array (maintain alphabetical order):
```javascript
{
  token: tokens.UpdatePartHealthStateHandler,
  factory: (container) => new UpdatePartHealthStateHandler({
    entityManager: container.resolve(tokens.IEntityManager),
    eventDispatcher: container.resolve(tokens.ISafeEventDispatcher),
    jsonLogicService: container.resolve(tokens.IJsonLogicEvaluationService),
    logger: container.resolve(tokens.ILogger)
  })
},
```

### 3. Operation Mapping

In `src/dependencyInjection/registrations/interpreterRegistrations.js`:

**Add mapping** in the operation registry section (maintain alphabetical order):
```javascript
registry.register('UPDATE_PART_HEALTH_STATE', bind(tokens.UpdatePartHealthStateHandler));
```

### 4. Pre-Validation Whitelist

In `src/utils/preValidationUtils.js`:

**Add to `KNOWN_OPERATION_TYPES` array** (maintain alphabetical order):
```javascript
'UPDATE_PART_HEALTH_STATE',
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
2. Token follows naming convention: `UpdatePartHealthStateHandler` (PascalCase, no "I" prefix)
3. Operation type string matches schema exactly: `UPDATE_PART_HEALTH_STATE`
4. Handler can be resolved from DI container
5. No circular dependency issues
6. Pre-validation accepts rules using `UPDATE_PART_HEALTH_STATE`

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

# 5. Lint modified files
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

- [ ] Schema created (PERPARHEAANDNARTHR-006)
- [ ] Schema $ref added to operation.schema.json (PERPARHEAANDNARTHR-006)
- [ ] Handler implemented (PERPARHEAANDNARTHR-007)
- [ ] Token defined in tokens-core.js (this ticket)
- [ ] Factory registered in operationHandlerRegistrations.js (this ticket)
- [ ] Operation mapped in interpreterRegistrations.js (this ticket)
- [ ] **CRITICAL**: Added to KNOWN_OPERATION_TYPES in preValidationUtils.js (this ticket)
