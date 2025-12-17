# JsonLogicCustomOperators Architectural Analysis Report

**Date**: 2024-12-16
**Module**: `src/logic/jsonLogicCustomOperators.js`
**Lines of Code**: 652
**Operator Count**: 26 custom operators
**Status**: Critical Review Required

---

## Executive Summary

The `JsonLogicCustomOperators` module is a central service responsible for registering 26 custom JSON Logic operators with the `JsonLogicEvaluationService`. Recent changes introducing the `LightingStateService` dependency have caused cascading test failures due to dependency injection ordering issues. This report identifies **12 architectural improvement opportunities** ranked by priority, with detailed recommendations for making the module production-ready and maintainable.

### Root Cause of Test Failures

The addition of `IsActorLocationLitOperator` in commit `300925051` introduced a new dependency (`LightingStateService`) that is registered in `infrastructureRegistrations.js`, not `worldAndEntityRegistrations.js`. Unit tests that validate DI registration in isolation fail because `ILightingStateService` is not registered when `registerWorldAndEntity()` is called alone.

---

## Table of Contents

1. [Module Architecture Overview](#1-module-architecture-overview)
2. [Critical Issues (Priority 1)](#2-critical-issues-priority-1)
3. [High-Priority Improvements (Priority 2)](#3-high-priority-improvements-priority-2)
4. [Medium-Priority Improvements (Priority 3)](#4-medium-priority-improvements-priority-3)
5. [Low-Priority Improvements (Priority 4)](#5-low-priority-improvements-priority-4)
6. [Test Suite Analysis](#6-test-suite-analysis)
7. [Implementation Roadmap](#7-implementation-roadmap)

---

## 1. Module Architecture Overview

### Current Structure

```
JsonLogicCustomOperators (extends BaseService)
├── Dependencies (4 services)
│   ├── ILogger
│   ├── BodyGraphService
│   ├── IEntityManager
│   └── LightingStateService [NEW - causes cascading failures]
│
├── Operator Instances (26 operators)
│   ├── Body Part Operators (8) - extend BaseBodyPartOperator
│   ├── Equipment Operators (5) - extend BaseEquipmentOperator
│   ├── Furniture Operators (6) - extend BaseFurnitureOperator
│   └── Standalone Operators (7) - no base class
│
└── Public Methods
    ├── registerOperators(jsonLogicEvaluationService)
    ├── getRegisteredOperators() → Set<string>
    └── clearCaches()
```

### Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                    JsonLogicCustomOperators                      │
└─────────────────────────────────────────────────────────────────┘
              │         │           │              │
              ▼         ▼           ▼              ▼
        ILogger    BodyGraph   IEntityManager  LightingState
                   Service                       Service
              │                       │              │
              ▼                       ▼              ▼
        26 Operator Instances ◄──────────────────────┘
              │
              ▼
    JsonLogicEvaluationService.addOperation()
```

### File Locations

| File | Purpose |
|------|---------|
| `src/logic/jsonLogicCustomOperators.js` | Main module (652 lines) |
| `src/logic/operators/*.js` | 28 operator files (3 base + 25 concrete) |
| `src/dependencyInjection/registrations/worldAndEntityRegistrations.js` | DI registration (line 408-414) |
| `src/dependencyInjection/registrations/infrastructureRegistrations.js` | LightingStateService registration |
| `tests/unit/logic/jsonLogicCustomOperators.test.js` | Unit tests |
| `tests/unit/logic/jsonLogicCustomOperators.whitelistValidation.test.js` | Whitelist validation |

---

## 2. Critical Issues (Priority 1)

### 2.1 Cross-Module Dependency Injection Violation

**Severity**: 🔴 Critical
**Impact**: Test failures, architectural boundary violation
**Location**: `worldAndEntityRegistrations.js:413`

**Problem**: The `JsonLogicCustomOperators` class is registered in `worldAndEntityRegistrations.js` but depends on `LightingStateService` which is registered in `infrastructureRegistrations.js`. This creates an implicit ordering dependency between registration modules.

```javascript
// worldAndEntityRegistrations.js:408-414
registrar.singletonFactory(tokens.JsonLogicCustomOperators, (c) => {
  return new JsonLogicCustomOperators({
    logger: c.resolve(tokens.ILogger),
    bodyGraphService: c.resolve(tokens.BodyGraphService),
    entityManager: c.resolve(tokens.IEntityManager),
    lightingStateService: c.resolve(tokens.ILightingStateService), // ❌ Cross-module dependency
  });
});
```

**Impact on Tests**:
- `worldAndEntityRegistrations.test.js` calls `registerWorldAndEntity()` in isolation
- `ILightingStateService` is not registered, causing `"No service registered for key"` error
- Tests for `JsonLogicCustomOperators` and `JsonLogicEvaluationService` fail

**Recommendations**:

| Option | Approach | Pros | Cons |
|--------|----------|------|------|
| **A** | Move `LightingStateService` to `worldAndEntityRegistrations.js` | Fixes isolation, keeps cohesion | LightingStateService may not logically belong there |
| **B** | Move `JsonLogicCustomOperators` to `infrastructureRegistrations.js` | All dependencies available | Operators are more "world" than "infrastructure" |
| **C** | Create `logicRegistrations.js` module | Clean separation | More files to manage |
| **D** | Make `LightingStateService` optional | Tests pass without dependency | Runtime complexity |

**Recommended Solution**: **Option D with fallback** - Make `lightingStateService` optional with a lazy resolution pattern:

```javascript
// In JsonLogicCustomOperators constructor
lightingStateService: {
  value: lightingStateService,
  requiredMethods: ['isLocationLit'],
  optional: true,  // New BaseService option
}
```

### 2.2 Incomplete Cache Management

**Severity**: 🔴 Critical
**Impact**: Test isolation failures, potential memory leaks
**Location**: `jsonLogicCustomOperators.js:642-649`

**Problem**: The `clearCaches()` method only clears `socketExposureOp` cache, but `IsSocketCoveredOperator` has its own cache that isn't directly cleared:

```javascript
// Current implementation
clearCaches() {
  this.#logger.debug('Clearing custom operator caches');
  if (this.socketExposureOp) {
    this.socketExposureOp.clearCache();  // Only one operator
  }
}
```

**Operators with internal caches**:
- `IsSocketCoveredOperator` - `#socketToSlotCache = new Map()` (line 20)
- `SocketExposureOperator` - delegates to `IsSocketCoveredOperator`

**Impact**:
- Tests running in sequence may see stale cached data
- Socket-to-slot mappings from previous tests persist
- Difficult-to-debug intermittent test failures

**Recommendation**: Implement systematic cache tracking:

```javascript
// Store all operators with caches
#operatorsWithCaches = [];

// In registerOperators, track cacheable operators
this.isSocketCoveredOp = new IsSocketCoveredOperator({...});
this.#operatorsWithCaches.push(this.isSocketCoveredOp);

// Clear all caches
clearCaches() {
  this.#logger.debug('Clearing custom operator caches');
  for (const op of this.#operatorsWithCaches) {
    if (typeof op.clearCache === 'function') {
      op.clearCache();
    }
  }
}
```

---

## 3. High-Priority Improvements (Priority 2)

### 3.1 God Method Anti-Pattern in `registerOperators()`

**Severity**: 🟡 High
**Impact**: Low maintainability, high cognitive load
**Location**: `jsonLogicCustomOperators.js:110-628` (518 lines)

**Problem**: The `registerOperators()` method is 518 lines long, handling:
1. Operator instance creation (26 instances)
2. Operator registration with evaluation service (26 registrations)
3. Whitelist validation
4. Success logging

**Cyclomatic Complexity**: ~30 (very high)

**Current Pattern** (repeated 26 times):
```javascript
const operatorOp = new OperatorClass({
  entityManager: this.#entityManager,
  // ... dependencies
});

this.#registerOperator(
  'operatorName',
  function (param1, param2) {
    return operatorOp.evaluate([param1, param2], this);
  },
  jsonLogicEvaluationService
);
```

**Recommendation**: Extract into operator factory pattern:

```javascript
// New file: src/logic/operatorRegistryFactory.js
export class OperatorRegistryFactory {
  #dependencyMap;

  constructor(dependencies) {
    this.#dependencyMap = {
      body: {
        entityManager: dependencies.entityManager,
        bodyGraphService: dependencies.bodyGraphService,
        logger: dependencies.logger,
      },
      equipment: {
        entityManager: dependencies.entityManager,
        logger: dependencies.logger,
      },
      // ... other categories
    };
  }

  createOperator(operatorClass, category) {
    return new operatorClass(this.#dependencyMap[category]);
  }
}
```

### 3.2 Hardcoded Component IDs

**Severity**: 🟡 High
**Impact**: Violates DRY, coupling to specific mod structure
**Location**: `isActorLocationLitOperator.js:144-147`

**Problem**: Component IDs are hardcoded in operator implementations:

```javascript
// isActorLocationLitOperator.js
const actorPosition = this.#entityManager.getComponentData(
  actorId,
  'core:position'  // ❌ Hardcoded
);
```

**Other hardcoded references found**:
- `'core:position'` - position component
- `'locations:naturally_dark'` - lighting component
- Various anatomy components in body part operators

**Recommendation**: Centralize component ID constants:

```javascript
// src/constants/componentIds.js
export const COMPONENT_IDS = {
  POSITION: 'core:position',
  NATURALLY_DARK: 'locations:naturally_dark',
  BODY: 'anatomy:body',
  // ...
};
```

### 3.3 Context Mutation Side Effects

**Severity**: 🟡 High
**Impact**: Test pollution, unpredictable behavior
**Location**: Multiple base classes and operators

**Problem**: Operators mutate the evaluation context object:

```javascript
// BaseBodyPartOperator.js:70
context._currentPath = entityPath;

// BaseFurnitureOperator.js:63
context._currentPath = entityPath;

// isActorLocationLitOperator.js:70
context._currentPath = entityPath;
```

**Impact**:
- Tests sharing context objects see side effects from previous evaluations
- `_currentPath` property may collide with other operators
- Debugging becomes difficult when context state is non-deterministic

**Recommendation**: Use immutable context pattern or scoped property:

```javascript
// Option A: Clone context for each evaluation
const safeContext = { ...context, _operatorMeta: {} };

// Option B: Use operator-namespaced properties
context._isActorLocationLitOperator = { currentPath: entityPath };
```

---

## 4. Medium-Priority Improvements (Priority 3)

### 4.1 Missing Base Class for Standalone Operators

**Severity**: 🟢 Medium
**Impact**: Code duplication, inconsistent patterns
**Location**: 7 standalone operators

**Problem**: Seven operators don't extend any base class:
- `HasComponentOperator`
- `HasDamageCapabilityOperator`
- `HasFreeGrabbingAppendagesOperator`
- `CanActorGrabItemOperator`
- `IsItemBeingGrabbedOperator`
- `GetSkillValueOperator`
- `IsActorLocationLitOperator`

Each duplicates:
- Entity path resolution logic
- Error handling patterns
- Logging patterns
- Parameter validation

**Recommendation**: Create `BaseOperator` abstract class:

```javascript
// src/logic/operators/base/BaseOperator.js
export class BaseOperator {
  #logger;
  #entityManager;
  #operatorName;

  constructor({ logger, entityManager }, operatorName) {
    this.#logger = logger;
    this.#entityManager = entityManager;
    this.#operatorName = operatorName;
  }

  evaluate(params, context) {
    try {
      return this.evaluateInternal(params, context);
    } catch (error) {
      this.#logger.error(`${this.#operatorName}: Evaluation error`, error);
      return false;
    }
  }

  // Abstract method for subclasses
  evaluateInternal(params, context) {
    throw new Error('Must be implemented by subclass');
  }
}
```

### 4.2 Inconsistent Export Patterns

**Severity**: 🟢 Medium
**Impact**: Import confusion, bundler issues
**Location**: `jsonLogicCustomOperators.js:650-652`

**Problem**: Module uses both named and default exports:

```javascript
export class JsonLogicCustomOperators extends BaseService { ... }
export default JsonLogicCustomOperators;
```

Test files use inconsistent imports:
```javascript
// Unit test (correct)
import JsonLogicCustomOperators from '../../../src/logic/jsonLogicCustomOperators.js';

// Integration test (also correct)
import { JsonLogicCustomOperators } from '../../../src/logic/jsonLogicCustomOperators.js';
```

**Recommendation**: Use only named exports for consistency:

```javascript
export class JsonLogicCustomOperators extends BaseService { ... }
// Remove: export default JsonLogicCustomOperators;
```

### 4.3 Operator Instance Retention Pattern

**Severity**: 🟢 Medium
**Impact**: Memory overhead, testing complexity
**Location**: `jsonLogicCustomOperators.js:163-180`

**Problem**: Some operators are stored as instance properties while others are local variables:

```javascript
// Stored as properties (accessible for cache clearing)
this.isSocketCoveredOp = new IsSocketCoveredOperator({...});
this.socketExposureOp = new SocketExposureOperator({...});

// Local variables (not accessible after registration)
const hasPartWithComponentValueOp = new HasPartWithComponentValueOperator({...});
const hasWoundedPartOp = new HasWoundedPartOperator({...});
```

**Impact**:
- Inconsistent access patterns
- Cannot clear caches on locally-scoped operators
- Memory inefficiency (some operators stored twice via closure + property)

**Recommendation**: Store all operators in a registry Map:

```javascript
#operators = new Map();

// In registerOperators
this.#operators.set('hasPartWithComponentValue', hasPartWithComponentValueOp);
this.#operators.set('isSocketCovered', this.isSocketCoveredOp);
```

### 4.4 Silent Error Swallowing

**Severity**: 🟢 Medium
**Impact**: Debugging difficulty, hidden failures
**Location**: All operator `evaluate()` methods

**Problem**: All operators catch errors and return `false`:

```javascript
// isActorLocationLitOperator.js:89-95
} catch (error) {
  this.#logger.error(`${this.#operatorName}: Error during evaluation`, error);
  return false;  // ❌ Silent failure
}
```

**Impact**:
- Tests may pass with broken operators (false negatives)
- Production issues masked by silent failures
- Difficult to distinguish "condition not met" from "error occurred"

**Recommendation**: Add error reporting mechanism:

```javascript
// Option A: Throw on critical errors
if (error.code === 'CRITICAL') throw error;

// Option B: Return result object
return { success: false, error: error.message };

// Option C: Emit error event
this.#eventBus?.dispatch({ type: 'OPERATOR_ERROR', payload: error });
```

---

## 5. Low-Priority Improvements (Priority 4)

### 5.1 Missing TypeScript Types

**Severity**: 🔵 Low
**Impact**: IDE support, type safety
**Location**: All operator files

**Problem**: Uses JSDoc types but lacks TypeScript definitions:

```javascript
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
```

**Recommendation**: Create TypeScript declaration file:

```typescript
// src/logic/types.d.ts
export interface OperatorResult {
  value: boolean;
  error?: string;
}

export interface OperatorContext {
  actor?: Entity;
  target?: Entity;
  event?: GameEvent;
  _currentPath?: string;
}
```

### 5.2 Verbose Operator Registration Comments

**Severity**: 🔵 Low
**Impact**: Code noise
**Location**: Throughout `registerOperators()`

**Problem**: Redundant comments for every registration:

```javascript
// Register hasPartWithComponentValue operator
// This operator checks if an entity has a body part with a specific component value
// Usage: {"hasPartWithComponentValue": ["actor", "descriptors:build", "build", "muscular"]}
```

**Recommendation**: Document once in JSDoc, remove inline comments:

```javascript
/**
 * Registers all custom operators. See operator classes for usage documentation.
 * @see HasPartWithComponentValueOperator
 * @see HasPartOfTypeOperator
 */
registerOperators(jsonLogicEvaluationService) { ... }
```

### 5.3 Closure Pattern for `self` Reference

**Severity**: 🔵 Low
**Impact**: Code clarity
**Location**: `jsonLogicCustomOperators.js:359`

**Problem**: Uses `self` variable to capture `this` in closures:

```javascript
const self = this;
this.#registerOperator(
  'isSocketCovered',
  function (entityPath, socketId) {
    return self.isSocketCoveredOp.evaluate([entityPath, socketId], this);
  },
  jsonLogicEvaluationService
);
```

**Recommendation**: Use arrow functions where `this` context allows:

```javascript
this.#registerOperator(
  'isSocketCovered',
  (entityPath, socketId, context) => {
    return this.isSocketCoveredOp.evaluate([entityPath, socketId], context);
  },
  jsonLogicEvaluationService
);
```

---

## 6. Test Suite Analysis

### 6.1 Test File Overview

| File | Type | Tests | Coverage |
|------|------|-------|----------|
| `jsonLogicCustomOperators.test.js` | Unit | ~120 | ✅ Comprehensive |
| `jsonLogicCustomOperators.whitelistValidation.test.js` | Unit | ~15 | ✅ Complete |
| `tests/integration/logic/jsonLogicCustomOperators.test.js` | Integration | ~30 | ✅ Good |

### 6.2 Test Infrastructure Issues

**Issue 1: DI Isolation Problem**
- Tests in `worldAndEntityRegistrations.test.js` fail because they don't register infrastructure services
- Need to update test setup to include all required registration modules

**Issue 2: Mock Synchronization**
- Unit tests mock `lightingStateService` correctly
- Integration tests may not include this dependency

**Issue 3: Cache State Between Tests**
- `beforeEach` creates new instances but caches from previous tests may persist
- Need explicit cache clearing in test teardown

### 6.3 Recommended Test Fixes

```javascript
// tests/unit/dependencyInjection/worldAndEntityRegistrations.test.js
beforeEach(() => {
  // Register infrastructure first (required for JsonLogicCustomOperators)
  registerInfrastructure(container);

  // Then register world and entity
  registerWorldAndEntity(container);
});
```

---

## 7. Implementation Roadmap

### Phase 1: Critical Fixes (Week 1)

| Task | Priority | Effort | Files |
|------|----------|--------|-------|
| Fix DI dependency ordering | 🔴 Critical | 2h | `worldAndEntityRegistrations.js`, `infrastructureRegistrations.js` |
| Complete cache management | 🔴 Critical | 1h | `jsonLogicCustomOperators.js` |
| Update failing tests | 🔴 Critical | 2h | `worldAndEntityRegistrations.test.js` |

### Phase 2: High-Priority Refactoring (Week 2)

| Task | Priority | Effort | Files |
|------|----------|--------|-------|
| Extract operator factory | 🟡 High | 4h | New `operatorRegistryFactory.js` |
| Centralize component IDs | 🟡 High | 2h | New `componentIds.js` |
| Fix context mutation | 🟡 High | 2h | All base classes |

### Phase 3: Medium-Priority Improvements (Week 3)

| Task | Priority | Effort | Files |
|------|----------|--------|-------|
| Create BaseOperator class | 🟢 Medium | 3h | New base class, update 7 operators |
| Standardize exports | 🟢 Medium | 1h | `jsonLogicCustomOperators.js` |
| Unify operator storage | 🟢 Medium | 2h | `jsonLogicCustomOperators.js` |

### Phase 4: Polish (Week 4)

| Task | Priority | Effort | Files |
|------|----------|--------|-------|
| Add TypeScript types | 🔵 Low | 4h | New `.d.ts` files |
| Clean up comments | 🔵 Low | 1h | `jsonLogicCustomOperators.js` |
| Modernize closures | 🔵 Low | 1h | `jsonLogicCustomOperators.js` |

---

## Appendix A: Operator Inventory

### Body Part Operators (8)
| Operator | Base Class | Dependencies |
|----------|-----------|--------------|
| `hasPartWithComponentValue` | `BaseBodyPartOperator` | entityManager, bodyGraphService, logger |
| `hasPartOfType` | `BaseBodyPartOperator` | entityManager, bodyGraphService, logger |
| `hasPartOfTypeWithComponentValue` | `BaseBodyPartOperator` | entityManager, bodyGraphService, logger |
| `hasWoundedPart` | `BaseBodyPartOperator` | entityManager, bodyGraphService, logger |
| `isBodyPartWounded` | `BaseBodyPartOperator` | entityManager, bodyGraphService, logger |
| `hasPartWithStatusEffect` | `BaseBodyPartOperator` | entityManager, bodyGraphService, logger |
| `hasPartSubTypeContaining` | `BaseBodyPartOperator` | entityManager, bodyGraphService, logger |
| `isBodyPartAccessible` | `BaseBodyPartOperator` | entityManager, bodyGraphService, logger, isSlotExposedOperator, socketExposureOperator |

### Equipment Operators (5)
| Operator | Base Class | Dependencies |
|----------|-----------|--------------|
| `isSlotExposed` | `BaseEquipmentOperator` | entityManager, logger |
| `isSocketCovered` | `BaseEquipmentOperator` | entityManager, logger |
| `socketExposure` | `BaseEquipmentOperator` | entityManager, logger, isSocketCoveredOperator |
| `isRemovalBlocked` | `BaseEquipmentOperator` | entityManager, logger |
| (isBodyPartAccessible) | - | (cross-listed with body operators) |

### Furniture Operators (6)
| Operator | Base Class | Dependencies |
|----------|-----------|--------------|
| `hasSittingSpaceToRight` | `BaseFurnitureOperator` | entityManager, logger |
| `canScootCloser` | `BaseFurnitureOperator` | entityManager, logger |
| `isClosestLeftOccupant` | `BaseFurnitureOperator` | entityManager, logger |
| `isClosestRightOccupant` | `BaseFurnitureOperator` | entityManager, logger |
| `isNearbyFurniture` | `BaseFurnitureOperator` | entityManager, logger |
| `hasOtherActorsAtLocation` | `BaseFurnitureOperator` | entityManager, logger |

### Standalone Operators (7)
| Operator | Dependencies |
|----------|--------------|
| `has_component` | entityManager, logger |
| `get_component_value` | entityManager (inline function) |
| `hasFreeGrabbingAppendages` | entityManager, logger |
| `canActorGrabItem` | entityManager, logger |
| `isItemBeingGrabbed` | entityManager, logger |
| `getSkillValue` | entityManager, logger |
| `has_damage_capability` | entityManager, logger |
| `isActorLocationLit` | entityManager, lightingStateService, logger |

---

## Appendix B: Quick Reference

### Files to Modify

```
src/logic/jsonLogicCustomOperators.js                      # Main module
src/logic/operators/isActorLocationLitOperator.js          # New operator
src/dependencyInjection/registrations/worldAndEntityRegistrations.js
src/dependencyInjection/registrations/infrastructureRegistrations.js
tests/unit/logic/jsonLogicCustomOperators.test.js
tests/unit/dependencyInjection/worldAndEntityRegistrations.test.js
```

### Key Metrics Before/After

| Metric | Before | Target After |
|--------|--------|--------------|
| `registerOperators()` lines | 518 | <100 |
| Operators with cache management | 1 | All with caches |
| Cross-module dependencies | 1 | 0 |
| Context mutations | 3+ | 0 |
| Hardcoded component IDs | 5+ | 0 |

---

**Report Generated By**: Claude Code Architectural Analysis
**Review Requested**: Team Lead, Senior Developer
**Next Action**: Prioritize fixes based on current sprint capacity
