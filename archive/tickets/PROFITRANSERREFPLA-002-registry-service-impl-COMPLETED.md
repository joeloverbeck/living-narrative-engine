# PROFITRANSERREFPLA-002: Extract PrototypeRegistryService

**Status**: Completed
**Priority**: HIGH
**Estimated Effort**: M (1-2 days)
**Dependencies**: PROFITRANSERREFPLA-001 (tests already present in `tests/` even though the ticket file is missing)
**Blocks**: PROFITRANSERREFPLA-015

## Problem Statement

`PrototypeFitRankingService` contains prototype registry access logic that should be a separate service. This violates SRP and makes the code harder to test and maintain. The registry access methods need extraction into a focused `PrototypeRegistryService`.

## Objective

Extract prototype registry access methods from `PrototypeFitRankingService` into a new `PrototypeRegistryService` that:
1. Centralizes all prototype lookups
2. Provides clean interface for prototype retrieval
3. Can be independently tested and mocked
4. Serves as foundation for other service extractions
5. Preserves existing `PrototypeFitRankingService` construction patterns (avoid breaking call sites)

## Scope

### In Scope
- Create `PrototypeRegistryService.js`
- Add DI token `IPrototypeRegistryService`
- Register service in DI container
- Update `PrototypeFitRankingService` to use new service
- Existing registry tests in `tests/unit/expressionDiagnostics/services/prototypeRegistryService.test.js` and `tests/integration/expression-diagnostics/prototypeRegistryService.integration.test.js` remain green (no `.skip` blocks currently)
- Verify all existing tests pass

### Out of Scope
- Other service extractions
- Modifying public API of `PrototypeFitRankingService`
- Adding new functionality
- Performance optimizations

## Acceptance Criteria

- [x] New file created: `src/expressionDiagnostics/services/PrototypeRegistryService.js`
- [x] DI token added: `IPrototypeRegistryService` in `tokens-diagnostics.js`
- [x] Service registered in `expressionDiagnosticsRegistrations.js`
- [x] `PrototypeFitRankingService` constructor accepts `IPrototypeRegistryService`
- [x] All registry access delegated to new service
- [x] Tests from PROFITRANSERREFPLA-001 pass (they already exist in `tests/` and are not skipped)
- [x] All existing tests remain green (targeted registry tests at minimum)
- [x] `npm run test:unit -- --testPathPatterns=prototypeRegistryService --coverage=false` passes
- [x] `npm run test:integration -- --testPathPatterns=prototypeRegistryService --coverage=false` passes
- [x] `npx eslint src/expressionDiagnostics/services/PrototypeRegistryService.js` passes

## Tasks

### 1. Create PrototypeRegistryService

```javascript
// src/expressionDiagnostics/services/PrototypeRegistryService.js

/**
 * @file Centralized prototype registry access service
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * @typedef {import('../types.js').Prototype} Prototype
 * @typedef {import('../types.js').PrototypeRef} PrototypeRef
 */

class PrototypeRegistryService {
  #dataRegistry;
  #logger;

  /**
   * @param {object} deps
   * @param {object} deps.dataRegistry - IDataRegistry instance (uses getLookupData)
   * @param {object} deps.logger - ILogger instance
   */
  constructor({ dataRegistry, logger }) {
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get', 'getLookupData'],
    });
    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
  }

  /**
   * Get all prototypes of a specific type
   * @param {string} type - 'emotion' | 'sexual'
   * @returns {Prototype[]}
   */
  getPrototypesByType(type) {
    // Extract from PrototypeFitRankingService.js:915-929
  }

  /**
   * Get prototypes from multiple types
   * @param {string[]} types
   * @returns {Prototype[]}
   */
  getAllPrototypes(types) {
    // Extract from PrototypeFitRankingService.js:937-953
  }

  /**
   * Resolve prototype references to definitions
   * @param {PrototypeRef[]} refs
   * @returns {Prototype[]}
   */
  getPrototypeDefinitions(refs) {
    // Extract from PrototypeFitRankingService.js:807-828
  }

  /**
   * Get single prototype by ID and type
   * @param {string} id
   * @param {string} type
   * @returns {Prototype|null}
   */
  getPrototype(id, type) {
    // New convenience method
  }
}

export default PrototypeRegistryService;
```

### 2. Add DI Token

```javascript
// In src/dependencyInjection/tokens/tokens-diagnostics.js
// Add to diagnosticsTokens object:

IPrototypeRegistryService: 'IPrototypeRegistryService',
```

### 3. Register Service

```javascript
// In src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js

import PrototypeRegistryService from '../../expressionDiagnostics/services/PrototypeRegistryService.js';

// Add registration:
registrar.singletonFactory(
  diagnosticsTokens.IPrototypeRegistryService,
  (c) =>
    new PrototypeRegistryService({
      dataRegistry: c.resolve(tokens.IDataRegistry),
      logger: c.resolve(tokens.ILogger),
    })
);
```

### 4. Update PrototypeFitRankingService

```javascript
// Update constructor to accept new dependency (optional to preserve existing call sites)
constructor({ dataRegistry, logger, prototypeConstraintAnalyzer, prototypeRegistryService = null }) {
  // ... existing validation ...
  this.#prototypeRegistryService = prototypeRegistryService;
}

// Replace direct calls:
// Before: this.#getPrototypesByType(type)
// After:  this.#prototypeRegistryService.getPrototypesByType(type)
```

### 5. Update DI Registration for PrototypeFitRankingService

```javascript
// In expressionDiagnosticsRegistrations.js, update PrototypeFitRankingService:

registrar.singletonFactory(
  diagnosticsTokens.IPrototypeFitRankingService,
  (c) =>
    new PrototypeFitRankingService({
      dataRegistry: c.resolve(tokens.IDataRegistry),
      logger: c.resolve(tokens.ILogger),
      prototypeConstraintAnalyzer: c.resolve(
        diagnosticsTokens.IPrototypeConstraintAnalyzer
      ),
      prototypeRegistryService: c.resolve(
        diagnosticsTokens.IPrototypeRegistryService  // NEW
      ),
    })
);
```

### 6. Confirm Tests

- Registry tests already exist and are enabled; keep them passing
- Update tests only if constructor changes require it

## Methods to Extract

| Method | Lines | Destination |
|--------|-------|-------------|
| `#getPrototypesByType` | 915-929 | `getPrototypesByType` |
| `#getAllPrototypes` | 937-953 | `getAllPrototypes` |
| `getPrototypeDefinitions` | 807-828 | `getPrototypeDefinitions` |

## Verification

```bash
# Run registry tests
npm run test:unit -- --testPathPatterns=prototypeRegistryService --coverage=false
npm run test:integration -- --testPathPatterns=prototypeRegistryService --coverage=false

# Lint new file
npx eslint src/expressionDiagnostics/services/PrototypeRegistryService.js
```

## Success Metrics

- New service file < 150 lines
- All unit tests pass
- All integration tests pass
- All existing `PrototypeFitRankingService` tests pass
- No changes to public API
- Clean ESLint output

## Notes

- Keep method signatures identical to original private methods
- Preserve all edge case handling from original implementation
- Log deprecation warnings if needed for future cleanup
- This service becomes a dependency for other extractions

## Related Files

**Source:**
- `src/expressionDiagnostics/services/PrototypeFitRankingService.js`

**To Create:**
- `src/expressionDiagnostics/services/PrototypeRegistryService.js`

**To Modify:**
- `src/dependencyInjection/tokens/tokens-diagnostics.js`
- `src/dependencyInjection/registrations/expressionDiagnosticsRegistrations.js`

**Tests:**
- `tests/unit/expressionDiagnostics/services/prototypeRegistryService.test.js`
- `tests/integration/expression-diagnostics/prototypeRegistryService.integration.test.js`

## Outcome

- Implemented `PrototypeRegistryService` and wired it into DI.
- `PrototypeFitRankingService` now delegates registry lookups but keeps the new dependency optional to avoid breaking existing call sites.
- Updated DI registration tests for the new service count and registration.
