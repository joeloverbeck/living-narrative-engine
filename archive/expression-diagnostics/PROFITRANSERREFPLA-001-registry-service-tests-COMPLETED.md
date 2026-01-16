# PROFITRANSERREFPLA-001: Tests for PrototypeRegistryService

**Status**: Completed
**Priority**: HIGH
**Estimated Effort**: S (0.5-1 day)
**Dependencies**: None
**Blocks**: PROFITRANSERREFPLA-002

## Problem Statement

Before extracting `PrototypeRegistryService` from `PrototypeFitRankingService`, we need tests that lock down the current registry access behavior. The registry lookup logic is currently private (`#getPrototypesByType`, `#getAllPrototypes`) and only observable through public APIs like `analyzeAllPrototypeFit` and `getPrototypeDefinitions`. Tests should validate the observable behavior and data shapes so the extraction preserves existing semantics.

## Objective

Create unit and integration tests that validate:
1. Emotion prototype retrieval behavior (IDs, weights, gates, type tagging)
2. Sexual prototype retrieval behavior (IDs, weights, gates, type tagging)
3. Mixed prototype retrieval (both types present when referenced)
4. Prototype definitions lookup returns qualified keys with weights/gates
5. Edge cases (empty registry, missing refs, non-array input)

## Scope

### In Scope
- Unit tests in `tests/unit/expressionDiagnostics/services/` covering registry behavior via `PrototypeFitRankingService`
- Integration tests in `tests/integration/expression-diagnostics/` using `InMemoryDataRegistry`
- Test fixtures for emotion and sexual prototypes
- Mock setup for `IDataRegistry`

### Out of Scope
- Implementing `PrototypeRegistryService` (ticket 002)
- Modifying `PrototypeFitRankingService`
- Modifying DI registrations
- Other service extractions

## Acceptance Criteria

- [x] Unit test file created: `tests/unit/expressionDiagnostics/services/prototypeRegistryService.test.js`
- [x] Integration test file created: `tests/integration/expression-diagnostics/prototypeRegistryService.integration.test.js`
- [x] Tests cover `getPrototypeDefinitions` returning qualified keys (`emotions:*`, `sexualStates:*`) with weights and gates
- [x] Tests cover mixed prototype retrieval via `analyzeAllPrototypeFit` when prerequisites reference both types
- [x] Tests cover sexual-only retrieval via `analyzeAllPrototypeFit` when prerequisites reference sexual states only
- [x] Edge case: Empty registry returns empty definitions and no prototypes
- [x] Edge case: Missing prototype refs are ignored in definitions
- [x] Edge case: Non-array input to `getPrototypeDefinitions` returns empty object
- [x] Tests document the expected interface contract for the extracted service

## Tasks

### 1. Create Unit Test File
```javascript
// tests/unit/expressionDiagnostics/services/prototypeRegistryService.test.js

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PrototypeFitRankingService from '../../../../src/expressionDiagnostics/services/PrototypeFitRankingService.js';

// Tests validate current registry behavior via public APIs
```

### 2. Create Integration Test File
```javascript
// tests/integration/expression-diagnostics/prototypeRegistryService.integration.test.js

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import PrototypeFitRankingService from '../../../src/expressionDiagnostics/services/PrototypeFitRankingService.js';

// Tests validate registry behavior with real registry implementation
```

### 3. Document Interface Contract

The tests should document the expected interface for the extracted service:

```typescript
interface IPrototypeRegistryService {
  /**
   * Get all prototypes of a specific type.
   * @param type - 'emotion' | 'sexual'
   * @returns Array of prototype objects with id, type, weights, gates
   */
  getPrototypesByType(type: string): Prototype[];

  /**
   * Get prototypes from multiple types.
   * @param typesToFetch - { hasEmotions: boolean, hasSexualStates: boolean }
   * @returns Merged array of prototypes
   */
  getAllPrototypes(typesToFetch?: PrototypeTypeDetection): Prototype[];

  /**
   * Resolve prototype references to definitions.
   * @param refs - Array of {type, id} references
   * @returns Record keyed by qualified ID (emotions:*, sexualStates:*)
   */
  getPrototypeDefinitions(refs: PrototypeRef[]): Record<string, {weights: object, gates: string[]}>;
}
```

## Test Data Requirements

### Emotion Prototype Structure
```javascript
{
  id: 'joy',
  type: 'emotion',
  weights: {
    valence: 0.8,
    arousal: 0.6,
    dominance: 0.5
  },
  gates: ['valence >= 0.5']
}
```

### Sexual Prototype Structure
```javascript
{
  id: 'aroused',
  type: 'sexual',
  weights: {
    sexual_arousal: 0.9,
    desire: 0.7
  },
  gates: ['sexual_arousal >= 0.6']
}
```

## Verification

```bash
npm run test:unit -- --testPathPatterns="prototypeRegistryService" --coverage=false --verbose
npm run test:integration -- --testPathPatterns="prototypeRegistryService" --coverage=false --verbose
```

## Success Metrics

- Unit and integration tests pass and describe the existing registry access behavior
- Interface contract documented for extraction phase
- Tests align with the current data registry lookup shapes

## Notes

- These tests validate current behavior through `PrototypeFitRankingService` until `PrototypeRegistryService` exists
- Follow existing test patterns from `prototypeFitWithSexualStates.integration.test.js`

## Related Files

**Source Methods (to be extracted):**
- `PrototypeFitRankingService.js:915-929` - `#getPrototypesByType`
- `PrototypeFitRankingService.js:937-953` - `#getAllPrototypes`
- `PrototypeFitRankingService.js:807-828` - `getPrototypeDefinitions`

**Reference Tests:**
- `tests/integration/expression-diagnostics/prototypeFitWithSexualStates.integration.test.js`

## Outcome

- Updated assumptions to reflect current observable registry behavior and `getPrototypeDefinitions` return shape.
- Implemented active unit/integration tests against `PrototypeFitRankingService` instead of skipped placeholders.
- Documented the extracted service interface and verification commands with correct `--testPathPatterns` usage.
