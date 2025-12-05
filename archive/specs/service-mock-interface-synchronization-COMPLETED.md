# Service Mock Interface Synchronization - Robustness Specification

**Version**: 1.0
**Date**: 2025-12-05
**Status**: Active
**Related Fix**: Missing `evaluateDeathConditions` method in deathCheckService mock

---

## Table of Contents

1. [Context](#context)
2. [Problem](#problem)
3. [Truth Sources](#truth-sources)
4. [Desired Behavior](#desired-behavior)
5. [Testing Plan](#testing-plan)
6. [Implementation Guidelines](#implementation-guidelines)

---

## Context

### Location in Codebase

The service mock synchronization issue spans test infrastructure and production service implementations:

| Module | File Path | Purpose |
|--------|-----------|---------|
| **Mock Factory** | `tests/common/mods/ModTestHandlerFactory.js` | Creates mock services for DI container in integration tests |
| **Test Fixture** | `tests/common/mods/ModTestFixture.js` | Wires mocks into test execution environment |
| **Production Service** | `src/anatomy/services/deathCheckService.js` | Actual implementation with 4 public methods |
| **Handler Consumer** | `src/logic/operationHandlers/applyDamageHandler.js` | Calls service methods via DI |
| **DI Registration** | `src/dependencyInjection/registrations/` | Defines service interfaces via tokens |

### What the Module Does

The test infrastructure creates **mock services** to isolate integration tests from complex dependencies. When production service interfaces evolve (new methods added), mocks must be updated to match:

```
┌───────────────────────────────────────────────────────────────┐
│ Production Service (deathCheckService.js)                     │
│ ├─ checkDeathConditions(entityId, attackerId) → DeathResult   │
│ ├─ evaluateDeathConditions(entityId, attackerId) → Evaluation │ ← NEW METHOD
│ ├─ finalizeDeathFromEvaluation(entityId, evaluation) → void   │ ← NEW METHOD
│ └─ processDyingTurn(entityId) → TurnResult                    │
├───────────────────────────────────────────────────────────────┤
│ Mock Service (ModTestHandlerFactory.js:1268-1278)             │
│ ├─ checkDeathConditions: jest.fn(() => defaultResult)         │
│ ├─ evaluateDeathConditions: jest.fn(() => defaultEval)        │ ← WAS MISSING
│ ├─ finalizeDeathFromEvaluation: jest.fn()                     │ ← WAS MISSING
│ └─ processDyingTurn: jest.fn(() => defaultTurn)               │ ← STILL MISSING?
└───────────────────────────────────────────────────────────────┘
                              ↓
              Handler calls mock.evaluateDeathConditions()
                              ↓
                    TypeError: not a function
```

### Architecture Overview

```
Service Interface Change
    │
    ├─→ Production Implementation Updated
    │   └─ New method added (evaluateDeathConditions)
    │
    ├─→ Handler Updated to Use New Method
    │   └─ applyDamageHandler.js calls evaluateDeathConditions()
    │
    ├─→ ⚠️ GAP: Mock NOT Updated
    │   └─ ModTestHandlerFactory.js mock missing method
    │
    └─→ Runtime Failure in Integration Tests
        └─ TypeError: this[#deathCheckService].evaluateDeathConditions is not a function
```

**Key Responsibilities:**

1. **Interface Definition**: JSDoc typedefs define method signatures
2. **Production Implementation**: Service classes implement the interface
3. **Mock Creation**: Test factory creates Jest mock objects matching interface
4. **DI Wiring**: Container injects either production or mock service
5. **Consumer Usage**: Handlers call methods expecting interface contract

---

## Problem

### What Failed

**Issue**: Integration tests for `applyDamageRecipeBasedAnatomy.integration.test.js` failed with TypeError because the `deathCheckService` mock was missing the `evaluateDeathConditions` method.

**Affected Tests**:
- `tests/integration/mods/weapons/applyDamageRecipeBasedAnatomy.integration.test.js`
  - "should resolve target part when hit_probability_weight is undefined (defaults to 1.0)"
  - "should select target part when hit_probability_weight is explicitly 0"

**Error Message**:
```
TypeError: this[#deathCheckService].evaluateDeathConditions is not a function
    at ApplyDamageHandler.execute (src/logic/operationHandlers/applyDamageHandler.js:725:53)
```

### How It Failed

**Execution Flow**:

1. **Test Setup**: `ModTestFixture.forAction('weapons', 'weapons:swing_at_target')` creates test fixture
2. **Mock Creation**: `ModTestHandlerFactory` creates `deathCheckService` mock with only `checkDeathConditions`
3. **Action Execution**: `fixture.executeAction('attacker', 'sword', {...})` runs the swing action
4. **Rule Processing**: Rule triggers `APPLY_DAMAGE` operation
5. **Handler Execution**: `ApplyDamageHandler.execute()` runs
6. **Method Call**: Handler calls `this.#deathCheckService.evaluateDeathConditions(entityId, attackerId)`
7. **Failure**: Mock doesn't have `evaluateDeathConditions` → TypeError

**Stack Trace**:
```
ApplyDamageHandler.execute (src/logic/operationHandlers/applyDamageHandler.js:725:53)
└─ calls deathCheckService.evaluateDeathConditions()
   └─ Mock object has no such method
      └─ TypeError thrown
```

### Why It Failed

**Root Cause**: No synchronization mechanism between production service interfaces and test mock definitions.

**Contributing Factors**:

1. **Interface Evolution**: `deathCheckService` gained new methods (`evaluateDeathConditions`, `finalizeDeathFromEvaluation`) to support session-based damage accumulation pattern
2. **Mock Staleness**: `ModTestHandlerFactory.js` mock was created when service only had `checkDeathConditions`
3. **No Automated Check**: No test verifies mock completeness against production interface
4. **Late Detection**: Error only surfaces when specific code path is exercised

**Comparison**:

| Aspect | Production Service | Mock Service |
|--------|-------------------|--------------|
| `checkDeathConditions` | ✅ Implemented | ✅ Mocked |
| `evaluateDeathConditions` | ✅ Implemented | ❌ Missing → **FIXED** |
| `finalizeDeathFromEvaluation` | ✅ Implemented | ❌ Missing → **FIXED** |
| `processDyingTurn` | ✅ Implemented | ⚠️ Not verified |

### Test Links

**Primary Failing Tests**:
- `tests/integration/mods/weapons/applyDamageRecipeBasedAnatomy.integration.test.js:43-123`

**Related Test Infrastructure**:
- `tests/common/mods/ModTestHandlerFactory.js:1268-1278` (mock definition)
- `tests/common/mods/ModTestFixture.js` (fixture wiring)

---

## Truth Sources

### 1. Production Service Implementation (Authoritative)

**Source**: `src/anatomy/services/deathCheckService.js`

**Public Interface** (4 methods):

```javascript
/**
 * @typedef {Object} DeathCheckResult
 * @property {boolean} isDead - Whether entity is dead
 * @property {boolean} isDying - Whether entity is in dying state
 * @property {Object|null} deathInfo - Additional death information
 */

/**
 * @typedef {Object} DeathEvaluation
 * @property {boolean} isDead
 * @property {boolean} isDying
 * @property {boolean} shouldFinalize - Whether to dispatch death events
 * @property {Object|null} finalizationParams - Parameters for finalization
 * @property {Object|null} deathInfo
 */

class DeathCheckService {
  /**
   * Checks if entity meets death conditions
   * @param {string} entityId
   * @param {string} attackerId
   * @returns {DeathCheckResult}
   */
  checkDeathConditions(entityId, attackerId) { ... }

  /**
   * Evaluates death conditions WITHOUT dispatching events
   * Used for session-based damage accumulation
   * @param {string} entityId
   * @param {string} attackerId
   * @returns {DeathEvaluation}
   */
  evaluateDeathConditions(entityId, attackerId) { ... }

  /**
   * Finalizes death from a previous evaluation
   * Dispatches death events if shouldFinalize is true
   * @param {string} entityId
   * @param {DeathEvaluation} evaluation
   * @returns {void}
   */
  finalizeDeathFromEvaluation(entityId, evaluation) { ... }

  /**
   * Processes a dying entity's turn
   * @param {string} entityId
   * @returns {TurnResult}
   */
  processDyingTurn(entityId) { ... }
}
```

### 2. JSDoc Typedef Comments

**Source**: Service file JSDoc comments defining type contracts

**Key Types**:

```javascript
// DeathCheckResult - returned by checkDeathConditions
{
  isDead: boolean,
  isDying: boolean,
  deathInfo: Object | null
}

// DeathEvaluation - returned by evaluateDeathConditions
{
  isDead: boolean,
  isDying: boolean,
  shouldFinalize: boolean,
  finalizationParams: Object | null,
  deathInfo: Object | null
}
```

### 3. DI Token Definitions

**Source**: `src/dependencyInjection/tokens/`

**Relevant Tokens**:
- `IDeathCheckService` - Interface token for death check service

### 4. Handler Consumer Code

**Source**: `src/logic/operationHandlers/applyDamageHandler.js:717-740`

**Usage Pattern**:
```javascript
// Step 1: EVALUATE death conditions (no events dispatched yet)
let deathEvaluation;
try {
  deathEvaluation = this.#deathCheckService.evaluateDeathConditions(
    deathCheckOwnerEntityId,
    this.#extractActorId(executionContext)
  );
} catch (deathCheckError) {
  log.warn(`APPLY_DAMAGE: evaluateDeathConditions failed...`);
  deathEvaluation = {
    isDead: false,
    isDying: false,
    shouldFinalize: false,
    finalizationParams: null,
    deathInfo: null
  };
}
```

---

## Desired Behavior

### Normal Cases

#### 1. All Mock Methods Mirror Production Interface

**Requirement**: Every public method on the production service MUST have a corresponding mock method.

**Expected Mock Definition** (ModTestHandlerFactory.js):
```javascript
const deathCheckService = {
  checkDeathConditions: jest.fn(() => ({
    isDead: false,
    isDying: false,
    deathInfo: null
  })),
  evaluateDeathConditions: jest.fn(() => ({
    isDead: false,
    isDying: false,
    shouldFinalize: false,
    finalizationParams: null,
    deathInfo: null
  })),
  finalizeDeathFromEvaluation: jest.fn(),
  processDyingTurn: jest.fn(() => ({
    actionTaken: 'none',
    stillDying: false
  }))
};
```

#### 2. Mock Return Values Match Type Contracts

**Requirement**: Default mock return values must conform to JSDoc typedef shapes.

**Verification**:
```javascript
// checkDeathConditions returns DeathCheckResult
expect(mockService.checkDeathConditions()).toMatchObject({
  isDead: expect.any(Boolean),
  isDying: expect.any(Boolean)
});

// evaluateDeathConditions returns DeathEvaluation
expect(mockService.evaluateDeathConditions()).toMatchObject({
  isDead: expect.any(Boolean),
  isDying: expect.any(Boolean),
  shouldFinalize: expect.any(Boolean)
});
```

#### 3. Mock Injection Works Transparently

**Requirement**: Handler should not be able to distinguish mock from production service.

**Pattern**:
```javascript
// Production
const handler = new ApplyDamageHandler({ deathCheckService: realService });

// Test
const handler = new ApplyDamageHandler({ deathCheckService: mockService });

// Both should execute without TypeError
await handler.execute(context);
```

### Edge Cases

#### 1. Optional Methods with Default Implementations

**Scenario**: Service method has default behavior, consumer may or may not call it.

**Handling**:
```javascript
// Always mock all public methods, even optional ones
const mockService = {
  requiredMethod: jest.fn(),
  optionalMethod: jest.fn(() => defaultValue) // Still mock it
};
```

#### 2. Methods with Complex Return Types

**Scenario**: Method returns deeply nested objects.

**Handling**:
```javascript
// Provide complete default structure
evaluateDeathConditions: jest.fn(() => ({
  isDead: false,
  isDying: false,
  shouldFinalize: false,
  finalizationParams: null,
  deathInfo: {
    causeOfDeath: null,
    killerEntityId: null,
    timestamp: null
  }
}))
```

#### 3. Methods Added in Patch Releases

**Scenario**: Service gains new method between minor versions.

**Handling**:
- Add method to mock in same PR that adds production method
- Create test that verifies mock completeness
- Document in PR description that mock was updated

### Failure Modes

#### 1. Clear Error When Mock Is Incomplete

**Current Behavior** (problematic):
```
TypeError: this[#deathCheckService].evaluateDeathConditions is not a function
```

**Desired Behavior** (proposed enhancement):
```
MockIncompleteError: Service 'deathCheckService' mock is missing method 'evaluateDeathConditions'
  Expected methods (from IDeathCheckService):
    - checkDeathConditions
    - evaluateDeathConditions  ← MISSING
    - finalizeDeathFromEvaluation  ← MISSING
    - processDyingTurn
  Defined on mock:
    - checkDeathConditions

  Fix: Update ModTestHandlerFactory.js mock definition
```

#### 2. Runtime Validation That Mock Implements Expected Interface

**Proposed Enhancement**:
```javascript
// In ModTestHandlerFactory.js
function createMock(interfaceId, mockDefinition) {
  const expectedMethods = getExpectedMethods(interfaceId);
  const actualMethods = Object.keys(mockDefinition);

  const missing = expectedMethods.filter(m => !actualMethods.includes(m));
  if (missing.length > 0) {
    throw new MockIncompleteError(
      `Mock for ${interfaceId} missing methods: ${missing.join(', ')}`
    );
  }

  return mockDefinition;
}
```

### Invariants

Properties that must ALWAYS hold:

#### 1. Method Count Invariant

```
∀ service S, mock M:
  |methods(M)| >= |publicMethods(S)|
```

**Meaning**: Mock must have AT LEAST as many methods as production service's public interface.

#### 2. Return Type Shape Invariant

```
∀ method m ∈ service:
  shape(mock.m()) ⊇ requiredShape(typedef(m))
```

**Meaning**: Mock return value must include all required properties from JSDoc typedef.

#### 3. Mock-Production Substitutability

```
∀ handler H using service S:
  H.execute(mockS) succeeds ⟺ H.execute(realS) succeeds (structurally)
```

**Meaning**: If handler works with real service, it must work with mock (no TypeError).

### API Contracts

#### What Stays Stable

**1. Service Public Method Signatures**

```javascript
// STABLE - signature must not change without deprecation
checkDeathConditions(entityId: string, attackerId: string): DeathCheckResult
evaluateDeathConditions(entityId: string, attackerId: string): DeathEvaluation
finalizeDeathFromEvaluation(entityId: string, evaluation: DeathEvaluation): void
processDyingTurn(entityId: string): TurnResult
```

**2. Return Type Required Properties**

```javascript
// STABLE - these properties must always be present
DeathCheckResult: { isDead, isDying }
DeathEvaluation: { isDead, isDying, shouldFinalize }
```

**3. Mock Factory Method Signatures**

```javascript
// STABLE - test infrastructure API
ModTestHandlerFactory.getHandlerFactoryForCategory(category): HandlerFactory
ModTestFixture.forAction(modId, actionId): ModTestFixture
```

#### What Can Change

**1. Additional Return Properties**

```javascript
// ALLOWED - adding new properties doesn't break existing code
DeathEvaluation: {
  ...existingProperties,
  newProperty: value  // Can be added
}
```

**2. New Service Methods**

```javascript
// ALLOWED - but requires mock update
class DeathCheckService {
  ...existingMethods,
  newMethod() { ... }  // Can be added, mock must follow
}
```

**3. Mock Default Return Values**

```javascript
// ALLOWED - defaults can be tuned
evaluateDeathConditions: jest.fn(() => ({
  isDead: true,  // Changed from false
  ...
}))
```

---

## Testing Plan

### Tests to Add

#### 1. Mock Interface Completeness Test

**File**: `tests/unit/common/mods/ModTestHandlerFactory.mockCompleteness.test.js` (NEW)

**Purpose**: Verify all service mocks have complete interfaces.

```javascript
import { describe, it, expect } from '@jest/globals';
import { DeathCheckService } from '../../../../src/anatomy/services/deathCheckService.js';

describe('ModTestHandlerFactory Mock Completeness', () => {
  describe('deathCheckService mock', () => {
    it('should have all public methods from DeathCheckService', () => {
      // Get production class public methods
      const productionMethods = Object.getOwnPropertyNames(DeathCheckService.prototype)
        .filter(name => !name.startsWith('#') && name !== 'constructor');

      // Get mock methods from factory
      const mockService = createDeathCheckServiceMock();
      const mockMethods = Object.keys(mockService);

      // Every production method should be in mock
      productionMethods.forEach(method => {
        expect(mockMethods).toContain(method);
      });
    });

    it('should return correct shape for checkDeathConditions', () => {
      const mockService = createDeathCheckServiceMock();
      const result = mockService.checkDeathConditions('entity', 'attacker');

      expect(result).toMatchObject({
        isDead: expect.any(Boolean),
        isDying: expect.any(Boolean)
      });
    });

    it('should return correct shape for evaluateDeathConditions', () => {
      const mockService = createDeathCheckServiceMock();
      const result = mockService.evaluateDeathConditions('entity', 'attacker');

      expect(result).toMatchObject({
        isDead: expect.any(Boolean),
        isDying: expect.any(Boolean),
        shouldFinalize: expect.any(Boolean),
        finalizationParams: expect.anything(),
        deathInfo: expect.anything()
      });
    });
  });
});
```

#### 2. Cross-Service Mock Validation Test

**File**: `tests/unit/common/mods/ModTestHandlerFactory.allMocks.test.js` (NEW)

**Purpose**: Validate all mocked services have complete interfaces.

```javascript
describe('All Service Mocks - Interface Completeness', () => {
  const serviceInterfaceMap = [
    { mockName: 'deathCheckService', serviceClass: DeathCheckService },
    { mockName: 'bodyGraphService', serviceClass: BodyGraphService },
    // Add all mocked services here
  ];

  serviceInterfaceMap.forEach(({ mockName, serviceClass }) => {
    describe(`${mockName} mock`, () => {
      it(`should implement all methods from ${serviceClass.name}`, () => {
        const productionMethods = getPublicMethods(serviceClass);
        const mockService = getMockFromFactory(mockName);
        const mockMethods = Object.keys(mockService);

        const missing = productionMethods.filter(m => !mockMethods.includes(m));

        expect(missing).toHaveLength(0);
      });
    });
  });
});
```

#### 3. Regression Test for evaluateDeathConditions

**File**: `tests/integration/mods/weapons/applyDamageDeathCheckIntegration.test.js` (NEW)

**Purpose**: Ensure APPLY_DAMAGE can call all deathCheckService methods.

```javascript
describe('APPLY_DAMAGE - DeathCheckService Integration', () => {
  it('should call evaluateDeathConditions without TypeError', async () => {
    const fixture = await ModTestFixture.forAction(
      'weapons',
      'weapons:swing_at_target'
    );

    // Setup entities for damage application
    const { actor, target } = fixture.createStandardActorTarget();
    const weapon = fixture.createWeapon('sword', { damage: 10 });

    // This should NOT throw TypeError
    await expect(
      fixture.executeAction(actor.id, weapon.id, {
        additionalPayload: { secondaryId: target.id }
      })
    ).resolves.not.toThrow(TypeError);

    fixture.cleanup();
  });

  it('should use mock evaluateDeathConditions return value', async () => {
    const fixture = await ModTestFixture.forAction(
      'weapons',
      'weapons:swing_at_target'
    );

    // Configure mock to return death evaluation
    fixture.getMock('deathCheckService').evaluateDeathConditions.mockReturnValue({
      isDead: true,
      isDying: false,
      shouldFinalize: true,
      finalizationParams: { cause: 'damage' },
      deathInfo: { killerEntityId: 'attacker' }
    });

    const { actor, target } = fixture.createStandardActorTarget();
    const weapon = fixture.createWeapon('sword', { damage: 100 });

    await fixture.executeAction(actor.id, weapon.id, {
      additionalPayload: { secondaryId: target.id }
    });

    // Verify mock was called
    expect(fixture.getMock('deathCheckService').evaluateDeathConditions)
      .toHaveBeenCalledWith(expect.any(String), expect.any(String));

    fixture.cleanup();
  });
});
```

### Tests to Update

#### 1. Update ModTestHandlerFactory Tests

**File**: `tests/unit/common/mods/ModTestHandlerFactory.test.js`

**Changes**:
```javascript
// ADD: Test for mock method completeness
describe('Service Mock Definitions', () => {
  it('should define all deathCheckService methods', () => {
    const handlerSet = ModTestHandlerFactory.getHandlerFactoryForCategory('weapons');
    const deathCheckMock = handlerSet.services.deathCheckService;

    expect(deathCheckMock.checkDeathConditions).toBeDefined();
    expect(deathCheckMock.evaluateDeathConditions).toBeDefined();
    expect(deathCheckMock.finalizeDeathFromEvaluation).toBeDefined();
    expect(deathCheckMock.processDyingTurn).toBeDefined();
  });
});
```

### Regression Tests

#### 1. All Weapon Integration Tests Still Pass

**Test**: Run all weapon integration tests to verify fix doesn't break anything.

```bash
npm run test:integration -- tests/integration/mods/weapons/ --no-coverage
```

**Expected**: All 496 weapon tests pass.

#### 2. APPLY_DAMAGE Handler Coverage

**Test**: Verify handler can execute all code paths.

```javascript
describe('APPLY_DAMAGE Handler - All Code Paths', () => {
  it('should handle death evaluation returning isDead=true', async () => { ... });
  it('should handle death evaluation returning isDying=true', async () => { ... });
  it('should handle death evaluation returning shouldFinalize=true', async () => { ... });
  it('should handle evaluateDeathConditions throwing error', async () => { ... });
});
```

### Property Tests

#### Property 1: Mock Substitutability

```javascript
// For all handlers that use a service,
// if the handler works with mock, it should not throw TypeError

fc.assert(
  fc.property(
    fc.constantFrom(...handlersUsingDeathCheckService),
    async (handlerClass) => {
      const mockService = createDeathCheckServiceMock();
      const handler = new handlerClass({ deathCheckService: mockService });

      // Should not throw TypeError when methods called
      await expect(handler.execute(minimalContext)).not.toThrow(TypeError);
    }
  )
);
```

#### Property 2: Return Type Conformance

```javascript
// All mock return values should conform to expected shape

fc.assert(
  fc.property(
    fc.record({
      entityId: fc.string(),
      attackerId: fc.string()
    }),
    (params) => {
      const mockService = createDeathCheckServiceMock();
      const result = mockService.evaluateDeathConditions(params.entityId, params.attackerId);

      // Must have required properties
      expect(result).toHaveProperty('isDead');
      expect(result).toHaveProperty('isDying');
      expect(result).toHaveProperty('shouldFinalize');
    }
  )
);
```

---

## Implementation Guidelines

### Mock Creation Principles

#### 1. Mirror All Public Methods

**Rule**: When creating a mock, list ALL public methods from the production class.

**Pattern**:
```javascript
// ✅ CORRECT: All methods defined
const deathCheckService = {
  checkDeathConditions: jest.fn(() => defaultResult),
  evaluateDeathConditions: jest.fn(() => defaultEval),
  finalizeDeathFromEvaluation: jest.fn(),
  processDyingTurn: jest.fn(() => defaultTurn)
};

// ❌ WRONG: Missing methods
const deathCheckService = {
  checkDeathConditions: jest.fn(() => defaultResult)
  // Missing other methods!
};
```

#### 2. Provide Sensible Default Return Values

**Rule**: Mock return values should match JSDoc typedef shapes with safe defaults.

**Pattern**:
```javascript
// ✅ CORRECT: Returns complete shape with safe defaults
evaluateDeathConditions: jest.fn(() => ({
  isDead: false,        // Safe default: not dead
  isDying: false,       // Safe default: not dying
  shouldFinalize: false,// Safe default: don't finalize
  finalizationParams: null,
  deathInfo: null
}))

// ❌ WRONG: Returns incomplete or dangerous defaults
evaluateDeathConditions: jest.fn(() => ({
  isDead: true  // Dangerous: entities will die unexpectedly
}))
```

#### 3. Update Mocks in Same PR as Interface Changes

**Rule**: When adding/changing service methods, update mocks atomically.

**Git Workflow**:
```bash
# Single commit for interface change
git add src/anatomy/services/deathCheckService.js  # New method
git add tests/common/mods/ModTestHandlerFactory.js # Mock update
git add tests/unit/.../mockCompleteness.test.js    # New test
git commit -m "Add evaluateDeathConditions to deathCheckService with mock"
```

**PR Checklist**:
- [ ] New/changed method in production service
- [ ] Mock updated in ModTestHandlerFactory.js
- [ ] Mock return value matches typedef
- [ ] Mock completeness test added/updated
- [ ] Integration test verifies method callable

### Mock Factory Enhancement

#### 1. Consider Interface Validation Helper

**Proposed Enhancement** (optional):
```javascript
// In ModTestHandlerFactory.js
function validateMockCompleteness(mockName, mock, interfaceSpec) {
  const missing = interfaceSpec.methods.filter(
    method => typeof mock[method] !== 'function'
  );

  if (missing.length > 0) {
    console.warn(
      `[ModTestHandlerFactory] Mock '${mockName}' missing methods: ${missing.join(', ')}`
    );
  }
}

// Usage
const deathCheckService = { ... };
validateMockCompleteness('deathCheckService', deathCheckService, {
  methods: ['checkDeathConditions', 'evaluateDeathConditions', 'finalizeDeathFromEvaluation', 'processDyingTurn']
});
```

#### 2. Document Required Mock Methods

**Pattern**: Add comments indicating required methods.

```javascript
/**
 * DeathCheckService mock
 * Required methods (from src/anatomy/services/deathCheckService.js):
 * - checkDeathConditions(entityId, attackerId) → DeathCheckResult
 * - evaluateDeathConditions(entityId, attackerId) → DeathEvaluation
 * - finalizeDeathFromEvaluation(entityId, evaluation) → void
 * - processDyingTurn(entityId) → TurnResult
 */
const deathCheckService = {
  checkDeathConditions: jest.fn(() => ({ isDead: false, isDying: false })),
  evaluateDeathConditions: jest.fn(() => ({
    isDead: false,
    isDying: false,
    shouldFinalize: false,
    finalizationParams: null,
    deathInfo: null
  })),
  finalizeDeathFromEvaluation: jest.fn(),
  processDyingTurn: jest.fn(() => ({ actionTaken: 'none', stillDying: false }))
};
```

### Service Evolution Guidelines

#### 1. Deprecation Before Removal

**Rule**: Don't remove service methods without deprecation period.

**Pattern**:
```javascript
/**
 * @deprecated Use evaluateDeathConditions + finalizeDeathFromEvaluation instead
 * Will be removed in v3.0
 */
checkDeathConditions(entityId, attackerId) {
  console.warn('checkDeathConditions is deprecated');
  return this.#legacyCheck(entityId, attackerId);
}
```

#### 2. New Methods Should Have Default Mock Values

**Rule**: When adding new methods, provide mock defaults that don't break existing tests.

**Pattern**:
```javascript
// New method with safe default
newMethod: jest.fn(() => ({
  success: true,
  data: null  // Safe: doesn't trigger side effects
}))
```

---

## Conclusion

This specification establishes guidelines for maintaining synchronization between production service interfaces and test mocks. By following these principles:

1. **No Runtime TypeErrors**: All mock methods exist before they're called
2. **Safe Defaults**: Mock return values don't cause unexpected test failures
3. **Atomic Updates**: Interface changes and mock updates happen together
4. **Automated Validation**: Tests catch mock staleness before runtime failures
5. **Clear Documentation**: Mock requirements are documented inline

**Fix Applied**:
- Added `evaluateDeathConditions` and `finalizeDeathFromEvaluation` to deathCheckService mock
- All 4 failing tests now pass
- All 496 weapons integration tests pass

**Next Steps**:
1. Add mock completeness test for deathCheckService
2. Verify `processDyingTurn` is also mocked
3. Consider implementing mock validation helper
4. Document mock update process in CLAUDE.md

---

**Document History**:
- 2025-12-05: Initial version (1.0) - Created after deathCheckService mock fix
