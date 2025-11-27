# OPEHANARCANA-011: ESTABLISH_BIDIRECTIONAL_CLOSENESS DI & Tests

**Status:** Ready
**Priority:** High (Phase 2)
**Estimated Effort:** 1 day
**Dependencies:** OPEHANARCANA-009 (schema), OPEHANARCANA-010 (handler)

---

## Objective

Register the `EstablishBidirectionalClosenessHandler` in the dependency injection system and create comprehensive unit and integration tests with 90%+ branch coverage.

---

## Files to Touch

### Modified Files (DI Registration)
- `src/dependencyInjection/tokens/tokens-core.js` - Add token
- `src/dependencyInjection/registrations/operationHandlerRegistrations.js` - Add factory
- `src/dependencyInjection/registrations/interpreterRegistrations.js` - Add mapping
- `src/utils/preValidationUtils.js` - Add to KNOWN_OPERATION_TYPES

### New Files (Tests)
- `tests/unit/logic/operationHandlers/establishBidirectionalClosenessHandler.test.js`
- `tests/integration/logic/operationHandlers/establishBidirectionalCloseness.integration.test.js`

---

## Out of Scope

**DO NOT modify:**
- The handler implementation file (done in OPEHANARCANA-010)
- Any schema files (done in OPEHANARCANA-009)
- Any rule files (migrations are separate tickets)
- Any other token or registration files beyond those listed
- PREPARE_ACTION_CONTEXT files (Phase 1 complete)

---

## Implementation Details

### 1. Token Definition (`tokens-core.js`)

Add to the tokens object (alphabetically):

```javascript
EstablishBidirectionalClosenessHandler: 'EstablishBidirectionalClosenessHandler',
```

### 2. Handler Factory Registration (`operationHandlerRegistrations.js`)

Add import at top:

```javascript
import EstablishBidirectionalClosenessHandler from '../../logic/operationHandlers/establishBidirectionalClosenessHandler.js';
```

Add factory to `handlerFactories` array (alphabetically):

```javascript
{
  token: tokens.EstablishBidirectionalClosenessHandler,
  factory: (c) => new EstablishBidirectionalClosenessHandler({
    entityManager: c.resolve(tokens.IEntityManager),
    descriptionRegenerator: c.resolve(tokens.IDescriptionRegenerator),
    logger: c.resolve(tokens.ILogger),
  }),
},
```

### 3. Operation Mapping (`interpreterRegistrations.js`)

Add to the registry.register calls (alphabetically):

```javascript
registry.register('ESTABLISH_BIDIRECTIONAL_CLOSENESS', bind(tokens.EstablishBidirectionalClosenessHandler));
```

### 4. Pre-Validation Whitelist (`preValidationUtils.js`)

Add to `KNOWN_OPERATION_TYPES` array (alphabetically):

```javascript
'ESTABLISH_BIDIRECTIONAL_CLOSENESS',
```

---

## Unit Test Structure

```javascript
/**
 * @file Unit tests for EstablishBidirectionalClosenessHandler
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import EstablishBidirectionalClosenessHandler from '../../../../src/logic/operationHandlers/establishBidirectionalClosenessHandler.js';

describe('EstablishBidirectionalClosenessHandler', () => {
  let handler;
  let mockEntityManager;
  let mockDescriptionRegenerator;
  let mockLogger;

  beforeEach(() => {
    mockEntityManager = {
      getEntityById: jest.fn(),
      getComponentData: jest.fn(),
      addComponent: jest.fn(),
      removeComponent: jest.fn(),
    };
    mockDescriptionRegenerator = {
      regenerate: jest.fn().mockResolvedValue(undefined),
    };
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    handler = new EstablishBidirectionalClosenessHandler({
      entityManager: mockEntityManager,
      descriptionRegenerator: mockDescriptionRegenerator,
      logger: mockLogger,
    });
  });

  describe('constructor validation', () => {
    it('should throw if entityManager is missing', () => { /* ... */ });
    it('should throw if descriptionRegenerator is missing', () => { /* ... */ });
    it('should throw if logger is missing', () => { /* ... */ });
    it('should create handler with valid dependencies', () => { /* ... */ });
  });

  describe('execute - basic relationship establishment', () => {
    it('should add components to both actor and target', async () => { /* ... */ });
    it('should use correct component types', async () => { /* ... */ });
    it('should resolve template variables in actor_data', async () => { /* ... */ });
    it('should resolve template variables in target_data', async () => { /* ... */ });
  });

  describe('execute - third-party cleanup', () => {
    it('should clean third-party relationship when clean_existing is true', async () => { /* ... */ });
    it('should not clean when clean_existing is false', async () => { /* ... */ });
    it('should remove reciprocal components from third party', async () => { /* ... */ });
    it('should handle nested reference fields', async () => { /* ... */ });
  });

  describe('execute - component removal', () => {
    it('should remove existing components before adding new ones', async () => { /* ... */ });
    it('should use custom existing_component_types_to_clean', async () => { /* ... */ });
    it('should gracefully handle missing components', async () => { /* ... */ });
  });

  describe('execute - description regeneration', () => {
    it('should regenerate descriptions when regenerate_descriptions is true', async () => { /* ... */ });
    it('should skip regeneration when regenerate_descriptions is false', async () => { /* ... */ });
    it('should regenerate for both actor and target', async () => { /* ... */ });
  });

  describe('execute - edge cases', () => {
    it('should handle actor already in relationship with target', async () => { /* ... */ });
    it('should handle missing third-party entity', async () => { /* ... */ });
    it('should handle empty component data', async () => { /* ... */ });
  });
});
```

---

## Acceptance Criteria

### Tests That Must Pass

1. **DI Registration:**
   ```bash
   npm run typecheck
   npm run validate
   ```

2. **Unit tests pass:**
   ```bash
   npm run test:unit -- tests/unit/logic/operationHandlers/establishBidirectionalClosenessHandler.test.js
   ```

3. **Integration tests pass:**
   ```bash
   npm run test:integration -- tests/integration/logic/operationHandlers/establishBidirectionalCloseness.integration.test.js
   ```

4. **Coverage meets requirements (90%+ branches):**
   ```bash
   npm run test:unit -- --coverage --collectCoverageFrom='src/logic/operationHandlers/establishBidirectionalClosenessHandler.js'
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
# 1. Verify token uniqueness
grep -r "EstablishBidirectionalClosenessHandler" src/dependencyInjection/

# 2. Verify operation type string matches
grep "ESTABLISH_BIDIRECTIONAL_CLOSENESS" src/utils/preValidationUtils.js
grep "ESTABLISH_BIDIRECTIONAL_CLOSENESS" src/dependencyInjection/registrations/interpreterRegistrations.js

# 3. Run validation
npm run validate

# 4. Run unit tests with coverage
npm run test:unit -- tests/unit/logic/operationHandlers/establishBidirectionalClosenessHandler.test.js --coverage

# 5. Run integration tests
npm run test:integration -- tests/integration/logic/operationHandlers/establishBidirectionalCloseness.integration.test.js

# 6. Run full CI
npm run test:ci
```

---

## Reference Files

- Token pattern: `src/dependencyInjection/tokens/tokens-core.js`
- Factory pattern: `src/dependencyInjection/registrations/operationHandlerRegistrations.js`
- Test pattern: `tests/unit/logic/operationHandlers/establishSittingClosenessHandler.test.js`
