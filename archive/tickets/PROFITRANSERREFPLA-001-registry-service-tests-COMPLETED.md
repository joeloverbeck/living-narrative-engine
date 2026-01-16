# PROFITRANSERREFPLA-001: Tests for PrototypeRegistryService

**Status**: Archived (Implemented)
**Priority**: HIGH
**Estimated Effort**: S (half day)
**Dependencies**: None
**Blocks**: PROFITRANSERREFPLA-002

## Problem Statement

Before extracting `PrototypeRegistryService` from `PrototypeFitRankingService`, we need comprehensive tests that validate the prototype lookup behavior through the current public API. These tests will ensure the extraction maintains backward compatibility.

## Objective

Create unit and integration tests that validate prototype registry functionality by testing through `PrototypeFitRankingService`'s public methods. These tests will serve as regression tests during the extraction.

## Scope

### In Scope
- Unit tests for prototype lookup via `getPrototypeDefinitions()` method
- Integration tests for prototype retrieval from data registry
- Test fixtures for various prototype scenarios
- Edge case handling validation

### Out of Scope
- Creating `PrototypeRegistryService` (ticket 002)
- Modifying `PrototypeFitRankingService`
- Other service extractions

## Acceptance Criteria

- [x] Unit test file created: `tests/unit/expressionDiagnostics/services/prototypeRegistryService.test.js`
- [x] Integration test file created: `tests/integration/expression-diagnostics/prototypeRegistryService.integration.test.js`
- [ ] Tests cover `getPrototypeDefinitions()` returning all prototypes
- [ ] Tests cover filtering prototypes by type
- [ ] Tests cover prototype structure validation
- [x] Edge case: No prototypes in registry
- [ ] Edge case: Invalid prototype type requested
- [ ] All tests are skipped initially (to pass CI until implementation)

## Tasks

### 1. Create Unit Test File

```javascript
// tests/unit/expressionDiagnostics/services/prototypeRegistryService.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';

describe('PrototypeRegistryService', () => {
  describe.skip('getPrototypesByType', () => {
    it('should return prototypes matching specified type', () => {
      // Test prototype filtering by type
    });

    it('should return empty array when no prototypes match type', () => {
      // Test empty result handling
    });

    it('should handle case-insensitive type matching', () => {
      // Test case handling
    });
  });

  describe.skip('getAllPrototypes', () => {
    it('should return all registered prototypes', () => {
      // Test full prototype list retrieval
    });

    it('should return empty array when registry is empty', () => {
      // Test empty registry
    });

    it('should return prototypes with correct structure', () => {
      // Validate prototype shape: { id, weights, gates, type }
    });
  });

  describe.skip('prototype structure validation', () => {
    it('should include required fields in each prototype', () => {
      // Verify: id, weights, gates
    });

    it('should include optional type field when present', () => {
      // Verify type field handling
    });
  });
});
```

### 2. Create Integration Test File

```javascript
// tests/integration/expression-diagnostics/prototypeRegistryService.integration.test.js

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

describe.skip('PrototypeRegistryService Integration', () => {
  describe('with data registry', () => {
    it('should load prototypes from data registry', () => {
      // Test data registry integration
    });

    it('should handle missing prototype data gracefully', () => {
      // Test error handling
    });
  });

  describe('prototype filtering', () => {
    it('should filter emotion prototypes correctly', () => {
      // Test with real emotion prototype data
    });

    it('should filter mood prototypes correctly', () => {
      // Test with real mood prototype data
    });
  });
});
```

### 3. Document Interface Contract

```typescript
interface IPrototypeRegistryService {
  /**
   * Get all prototypes matching the specified type
   */
  getPrototypesByType(type: string): Prototype[];

  /**
   * Get all registered prototypes
   */
  getAllPrototypes(): Prototype[];
}

interface Prototype {
  id: string;
  weights: Record<string, number>;
  gates?: Gate[];
  type?: string;
}
```

## Verification

```bash
npm run test:unit -- --testPathPattern="prototypeRegistryService" --verbose
npm run test:integration -- --testPathPattern="prototypeRegistryService" --verbose
```

## Success Metrics

- All test scenarios documented
- Interface contract clearly defined
- Tests ready to validate extraction

## Notes

- Tests are implemented and enabled (not skipped)
- Focus on behavior, not implementation details
- Test through public API where possible

## Related Files

**Source Methods (to be extracted):**
- `PrototypeFitRankingService.js:156-168` - `#getPrototypesByType`
- `PrototypeFitRankingService.js:175-185` - `#getAllPrototypes`

**Test Files to Create:**
- `tests/unit/expressionDiagnostics/services/prototypeRegistryService.test.js`
- `tests/integration/expression-diagnostics/prototypeRegistryService.integration.test.js`
