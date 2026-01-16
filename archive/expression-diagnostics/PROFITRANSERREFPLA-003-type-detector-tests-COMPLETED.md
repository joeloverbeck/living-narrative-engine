# PROFITRANSERREFPLA-003: Tests for PrototypeTypeDetector

**Status**: Completed
**Priority**: HIGH
**Estimated Effort**: S (0.5-1 day)
**Dependencies**: None
**Blocks**: PROFITRANSERREFPLA-004

## Problem Statement

Before extracting `PrototypeTypeDetector` from `PrototypeFitRankingService`, we need tests that lock in the current detection behavior so refactors preserve it. The existing logic only scans prerequisites-based JSON Logic for `emotions.*` and `sexualStates.*` references and has limited operator coverage, so the tests must reflect that scope.

## Objective

Create unit and integration tests that validate the current detection/extraction behavior as implemented in `PrototypeFitRankingService`, covering:
1. Detection of `emotions.*` references under supported operators
2. Detection of `sexualStates.*` references under supported operators
3. Detection across nested `and`/`or` structures
4. Extraction of the first prototype reference from comparison operators (`>=`, `>`, `<=`, `<`)
5. Caller fallback to emotion prototypes when no supported references are detected

## Scope

### In Scope
- Unit tests that exercise current detection/extraction behavior via `PrototypeFitRankingService`
- Integration test that confirms emotion-only expressions limit prototype selection to emotion prototypes
- Fixtures or inline expressions for supported operator coverage (`var`, comparisons, `and`/`or`)

### Out of Scope
- Implementing `PrototypeTypeDetector` (ticket 004)
- Changing detection semantics or expanding JSON Logic operator coverage
- Other service extractions

## Acceptance Criteria

- [ ] Unit test file created: `tests/unit/expressionDiagnostics/services/prototypeTypeDetector.test.js`
- [ ] Integration test file created: `tests/integration/expression-diagnostics/prototypeTypeDetector.integration.test.js`
- [ ] Unit tests confirm detection of `emotions.*` and `sexualStates.*` references under comparison operators
- [ ] Unit tests confirm detection across nested `and`/`or` structures
- [ ] Unit tests confirm extraction of the first prototype reference from `>=`, `>`, `<=`, `<` comparisons
- [ ] Unit tests confirm equality comparisons (`==`, `!=`) are ignored for extraction
- [ ] Unit tests confirm fallback to emotion prototypes when only unsupported operators are used
- [ ] Integration test confirms emotion-only prerequisites return emotion-only results

## Tasks

### 1. Create Unit Test File

```javascript
// tests/unit/expressionDiagnostics/services/prototypeTypeDetector.test.js

import { describe, it, expect } from '@jest/globals';
import PrototypeFitRankingService from '../../../../src/expressionDiagnostics/services/PrototypeFitRankingService.js';

describe('PrototypeTypeDetector behavior via PrototypeFitRankingService', () => {
  it('detects emotion references under comparison operators', () => {
    // expression.prerequisites with { '>=': [{ var: 'emotions.joy' }, 0.5] }
    // assert getAllPrototypes called with { hasEmotions: true, hasSexualStates: false }
  });

  it('detects sexual references under comparison operators', () => {
    // expression.prerequisites with { '<=': [{ var: 'sexualStates.passion' }, 0.4] }
    // assert getAllPrototypes called with { hasEmotions: false, hasSexualStates: true }
  });

  it('detects mixed types across nested and/or logic', () => {
    // expression.prerequisites with nested and/or on emotions.* and sexualStates.*
    // assert getAllPrototypes called with { hasEmotions: true, hasSexualStates: true }
  });

  it('falls back to emotion prototypes when only unsupported operators are used', () => {
    // expression.prerequisites with { not: { '>=': [{ var: 'sexualStates.passion' }, 0.3] } }
    // assert getAllPrototypes called with { hasEmotions: true, hasSexualStates: false }
  });

  it('extracts the first prototype reference from comparison operators', () => {
    // analyzeAllPrototypeFit should set currentPrototype from first >=/<=/< /> match
  });

  it('does not extract prototypes from equality comparisons', () => {
    // analyzeAllPrototypeFit should leave currentPrototype null for == comparisons
  });
});
```

### 2. Create Integration Test File

```javascript
// tests/integration/expression-diagnostics/prototypeTypeDetector.integration.test.js

import { describe, it, expect } from '@jest/globals';
import InMemoryDataRegistry from '../../../src/data/inMemoryDataRegistry.js';
import PrototypeFitRankingService from '../../../src/expressionDiagnostics/services/PrototypeFitRankingService.js';

describe('PrototypeTypeDetector Integration', () => {
  it('limits results to emotion prototypes when prerequisites reference emotions only', () => {
    // Build registry with emotion + sexual prototypes
    // Provide emotion-only prerequisites
    // Expect leaderboard/implied/gap types to be emotion only
  });
});
```

### 3. Document Interface Contract (Updated)

```typescript
interface IPrototypeTypeDetector {
  /**
   * Detect which prototype types are referenced in prerequisites.
   * @param expressionOrPrerequisites - Expression with prerequisites or prerequisites array
   * @returns Flags indicating detected types.
   */
  detectReferencedTypes(expressionOrPrerequisites: object | object[]): {
    hasEmotions: boolean;
    hasSexualStates: boolean;
  };

  /**
   * Extract the first prototype reference from comparison expressions.
   * @param expression - Expression with prerequisites
   * @returns Prototype reference or null
   */
  extractCurrentPrototype(expression: object): PrototypeRef | null;
}
```

## Test Data Requirements

### Simple Expressions
```javascript
// Emotion reference (supported comparison)
{ '>=': [{ var: 'emotions.joy' }, 0.5] }

// Sexual reference (supported comparison)
{ '<=': [{ var: 'sexualStates.passion' }, 0.4] }
```

### Complex Expressions
```javascript
// Nested AND/OR
{
  and: [
    { '>=': [{ var: 'emotions.joy' }, 0.5] },
    { or: [{ '>=': [{ var: 'sexualStates.passion' }, 0.3] }] }
  ]
}

// Unsupported operator (current behavior falls back to emotion prototypes)
{
  not: { '>=': [{ var: 'sexualStates.passion' }, 0.3] }
}
```

## Verification

```bash
# Targeted tests (disable coverage for partial runs)
npm run test:unit -- --testPathPatterns="prototypeTypeDetector" --coverage=false --verbose
npm run test:integration -- --testPathPatterns="prototypeTypeDetector" --coverage=false --verbose
```

## Success Metrics

- Unit test file covers current detection/extraction behavior and known operator limits
- Integration test file validates emotion-only detection against the registry
- Interface contract matches current detection outputs

## Notes

- Current detection traverses `var`, comparison operators (`>=`, `>`, `<=`, `<`, `==`, `!=`), and nested `and`/`or`
- Operators like `not`, `if`, `in` are not traversed by current logic
- Prototype extraction only inspects `>=`, `>`, `<=`, `<` comparisons (equality is ignored)

## Related Files

**Source Methods (to be extracted):**
- `PrototypeFitRankingService.js:855-870` - `#detectReferencedPrototypeTypes`
- `PrototypeFitRankingService.js:878-907` - `#scanLogicForPrototypeTypes`
- `PrototypeFitRankingService.js:962-972` - `#extractExpressionPrototype`
- `PrototypeFitRankingService.js:981-1010` - `#findPrototypeRefInLogic`

**Reference:**
- JSON Logic documentation for operator coverage

## Outcome

- Updated assumptions to match current operator coverage and extraction behavior.
- Added unit and integration tests validating the current detection/extraction path.
- No production code changes were required.
