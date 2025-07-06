name: "JsonLogic Custom Operators Refactoring PRP"
description: |

## Goal

Refactor the `src/logic/jsonLogicCustomOperators.js` module to eliminate code duplication, improve maintainability, and align with SOLID principles and DRY. Transform the current monolithic implementation with ~270 lines of inline operator code into a modular, testable architecture following the established operation handler patterns in the codebase.

## Why

- **Eliminate ~150 lines of duplicated code** across three operators (entity resolution, body component access, root ID extraction)
- **Improve testability** - current inline functions are difficult to unit test in isolation
- **Enable easier operator addition** - new operators can follow the established pattern
- **Reduce maintenance burden** - changes to common logic only need to be made in one place
- **Align with codebase patterns** - follow existing BaseOperationHandler pattern for consistency
- **Improve code readability** - separate concerns make the code easier to understand and modify

## What

Create a modular operator system that:
- Extracts each inline operator implementation into its own focused class
- Creates shared utilities for duplicated logic (entity path resolution, body component access)
- Follows the existing BaseOperationHandler pattern from the codebase
- Maintains all existing functionality and behavior
- Improves error handling and logging consistency
- Enables individual operator testing

### Success Criteria

- [ ] All existing unit and integration tests pass without modification
- [ ] Each operator is in its own testable class file
- [ ] Common logic exists in shared utility modules
- [ ] Main service only handles registration, not implementation
- [ ] Code coverage maintained or improved
- [ ] No runtime errors or behavior changes
- [ ] File adheres to 500-line limit per REFACTORING_PRINCIPLES.md

## All Needed Context

### Documentation & References

```yaml
# MUST READ - Include these in your context window
- file: src/logic/jsonLogicCustomOperators.js
  why: Current implementation to refactor, understand all three operators

- file: REFACTORING_PRINCIPLES.md
  why: SOLID principles and DRY guidelines to follow

- file: tests/unit/logic/jsonLogicCustomOperators.test.js
  why: Unit tests showing expected behavior - must all pass

- file: tests/integration/logic/jsonLogicCustomOperators.test.js
  why: Integration tests including bug reproduction case - critical

- file: src/logic/operationHandlers/BaseOperationHandler.js
  why: Base class pattern to follow for operator implementations

- file: src/logic/operationHandlers/createEntityOperationHandler.js
  why: Example of proper operation handler implementation

- file: src/logic/JsonLogicEvaluationService.js
  why: Shows how custom operators are registered via addOperation

- file: src/services/BodyGraphService.js
  why: Service interface that operators depend on

- url: https://github.com/jwadhams/json-logic-js
  why: JsonLogic library documentation for custom operator patterns
```

### Current Codebase tree

```bash
src/
├── logic/
│   ├── operationHandlers/
│   │   ├── BaseOperationHandler.js
│   │   ├── createEntityOperationHandler.js
│   │   ├── destroyEntityOperationHandler.js
│   │   └── ... (20+ other handlers)
│   ├── JsonLogicEvaluationService.js
│   └── jsonLogicCustomOperators.js (to be refactored)
├── services/
│   ├── BodyGraphService.js
│   └── ... (other services)
└── tests/
    ├── unit/
    │   └── logic/
    │       └── jsonLogicCustomOperators.test.js
    └── integration/
        └── logic/
            └── jsonLogicCustomOperators.test.js
```

### Desired Codebase tree with files to be added

```bash
src/
├── logic/
│   ├── operators/
│   │   ├── base/
│   │   │   └── BaseBodyPartOperator.js (NEW - base class for body part operators)
│   │   ├── hasPartWithComponentValueOperator.js (NEW - first operator)
│   │   ├── hasPartOfTypeOperator.js (NEW - second operator)
│   │   └── hasPartOfTypeWithComponentValueOperator.js (NEW - third operator)
│   ├── utils/
│   │   ├── entityPathResolver.js (NEW - shared entity path resolution)
│   │   └── bodyComponentUtils.js (NEW - shared body component access)
│   ├── operationHandlers/
│   │   └── ... (existing handlers)
│   ├── JsonLogicEvaluationService.js
│   └── jsonLogicCustomOperators.js (MODIFIED - simplified to registration only)
└── tests/
    ├── unit/
    │   └── logic/
    │       ├── operators/
    │       │   ├── hasPartWithComponentValueOperator.test.js (NEW)
    │       │   ├── hasPartOfTypeOperator.test.js (NEW)
    │       │   └── hasPartOfTypeWithComponentValueOperator.test.js (NEW)
    │       ├── utils/
    │       │   ├── entityPathResolver.test.js (NEW)
    │       │   └── bodyComponentUtils.test.js (NEW)
    │       └── jsonLogicCustomOperators.test.js (existing - should still pass)
    └── integration/
        └── logic/
            └── jsonLogicCustomOperators.test.js (existing - must pass)
```

### Known Gotchas & Library Quirks

```javascript
// CRITICAL: JsonLogic operators receive (params, data) where data is the context object
// The first parameter is the operator's arguments, second is the full evaluation context

// CRITICAL: Entity paths like "event.target.id" must be resolved dynamically
// The path can be arbitrary depth and the entity might be null at any level

// CRITICAL: Body component structure varies - can be either:
// { root: 'entity123' } OR { body: { root: 'entity123' } }
// Both formats must be supported for backward compatibility

// CRITICAL: All operators must return false for invalid inputs, never throw
// This is expected behavior per the integration tests

// CRITICAL: The "Iker Aguirre issue" test case must pass - it's a bug reproduction
// This test validates complex context resolution with recipe-generated entities

// CRITICAL: Maintain exact log messages for debugging - tests may depend on them
// Logger.debug/info/warn patterns are part of the expected behavior
```

## Implementation Blueprint

### Data models and structure

```javascript
// Base operator structure that all body part operators will extend
class BaseBodyPartOperator {
  constructor(dependencies) {
    this.entityManager = dependencies.entityManager;
    this.bodyGraphService = dependencies.bodyGraphService;
    this.logger = dependencies.logger;
  }
  
  // Template method for operator evaluation
  evaluate(params, context) {
    // Common validation and error handling
  }
  
  // Abstract method for operator-specific logic
  evaluateInternal(entity, params) {
    throw new Error('Must be implemented by subclass');
  }
}

// Utility structure for entity resolution
const entityPathResolver = {
  resolve(context, pathString) {
    // Navigate nested path like "event.target.id"
    // Return { entity: resolvedValue, isValid: boolean }
  }
};

// Utility structure for body component access
const bodyComponentUtils = {
  getBodyComponent(entityManager, entityId) {
    // Get anatomy:body component with validation
  },
  
  extractRootId(bodyComponent) {
    // Handle both { root } and { body: { root } } formats
  }
};
```

### list of tasks to be completed to fulfill the PRP in the order they should be completed

```yaml
Task 1 - Create Entity Path Resolver Utility:
CREATE src/logic/utils/entityPathResolver.js:
  - EXTRACT path resolution logic from jsonLogicCustomOperators.js (lines 78-92, 144-158, 229-244)
  - CREATE resolve(context, pathString) function
  - HANDLE null/undefined at any path level
  - RETURN { entity: resolvedValue, isValid: boolean }
  - ADD comprehensive JSDoc documentation

Task 2 - Create Body Component Utilities:
CREATE src/logic/utils/bodyComponentUtils.js:
  - EXTRACT body component logic from jsonLogicCustomOperators.js
  - CREATE getBodyComponent(entityManager, entityId) function
  - CREATE extractRootId(bodyComponent) function
  - HANDLE both { root } and { body: { root } } formats
  - VALIDATE component exists and has expected structure
  - ADD error handling for missing components

Task 3 - Create Base Body Part Operator:
CREATE src/logic/operators/base/BaseBodyPartOperator.js:
  - CREATE abstract base class for body part operators
  - IMPLEMENT evaluate(params, context) with common validation
  - DEFINE abstract evaluateInternal(entity, params) method
  - ADD common error handling and logging patterns
  - VALIDATE dependencies in constructor

Task 4 - Create HasPartWithComponentValue Operator:
CREATE src/logic/operators/hasPartWithComponentValueOperator.js:
  - EXTEND BaseBodyPartOperator
  - EXTRACT implementation from jsonLogicCustomOperators.js (lines 71-128)
  - USE entityPathResolver and bodyComponentUtils
  - IMPLEMENT evaluateInternal method
  - PRESERVE exact behavior and logging

Task 5 - Create HasPartOfType Operator:
CREATE src/logic/operators/hasPartOfTypeOperator.js:
  - EXTEND BaseBodyPartOperator
  - EXTRACT implementation from jsonLogicCustomOperators.js (lines 137-220)
  - USE shared utilities for common logic
  - IMPLEMENT evaluateInternal method
  - MAINTAIN backward compatibility

Task 6 - Create HasPartOfTypeWithComponentValue Operator:
CREATE src/logic/operators/hasPartOfTypeWithComponentValueOperator.js:
  - EXTEND BaseBodyPartOperator
  - EXTRACT implementation from jsonLogicCustomOperators.js (lines 223-344)
  - USE all shared utilities
  - IMPLEMENT evaluateInternal method
  - PRESERVE complex evaluation logic

Task 7 - Refactor Main Service:
MODIFY src/logic/jsonLogicCustomOperators.js:
  - REMOVE all inline operator implementations
  - IMPORT new operator classes
  - SIMPLIFY registerOperators to just instantiate and register
  - MAINTAIN same public interface
  - REDUCE file to under 100 lines

Task 8 - Create Unit Tests for Utilities:
CREATE tests/unit/logic/utils/entityPathResolver.test.js:
  - TEST successful path resolution
  - TEST null/undefined handling at each level
  - TEST invalid path formats
  - TEST edge cases

CREATE tests/unit/logic/utils/bodyComponentUtils.test.js:
  - TEST body component retrieval
  - TEST both body formats
  - TEST error cases
  - TEST root ID extraction

Task 9 - Create Unit Tests for Operators:
CREATE tests/unit/logic/operators/hasPartWithComponentValueOperator.test.js:
  - TEST operator in isolation
  - MOCK dependencies
  - TEST success and failure cases
  - VERIFY logging behavior

CREATE tests/unit/logic/operators/hasPartOfTypeOperator.test.js:
  - TEST type matching logic
  - TEST empty results handling
  - TEST error scenarios

CREATE tests/unit/logic/operators/hasPartOfTypeWithComponentValueOperator.test.js:
  - TEST combined type and value matching
  - TEST complex scenarios
  - TEST edge cases

Task 10 - Verify All Tests Pass:
RUN npm test:
  - ENSURE all existing tests pass
  - VERIFY new unit tests pass
  - CONFIRM integration tests still work
  - CHECK "Iker Aguirre issue" test passes
```

### Per task pseudocode

```javascript
// Task 1 - entityPathResolver.js
export const entityPathResolver = {
  /**
   * Resolves an entity from a nested path in the context
   * @param {Object} context - The evaluation context
   * @param {string} pathString - Dot-separated path like "event.target.id"
   * @returns {{ entity: any, isValid: boolean }}
   */
  resolve(context, pathString) {
    if (!pathString || typeof pathString !== 'string') {
      return { entity: null, isValid: false };
    }
    
    const pathParts = pathString.split('.');
    let current = context;
    
    for (const part of pathParts) {
      if (current == null || typeof current !== 'object') {
        return { entity: null, isValid: false };
      }
      current = current[part];
    }
    
    return { entity: current, isValid: current != null };
  }
};

// Task 2 - bodyComponentUtils.js
export const bodyComponentUtils = {
  getBodyComponent(entityManager, entityId) {
    if (!entityId) return null;
    
    const bodyComponent = entityManager.getComponentData(entityId, 'anatomy:body');
    
    if (!bodyComponent) {
      return null;
    }
    
    // Validate structure
    const hasDirectRoot = bodyComponent.root;
    const hasNestedRoot = bodyComponent.body?.root;
    
    if (!hasDirectRoot && !hasNestedRoot) {
      return null;
    }
    
    return bodyComponent;
  },
  
  extractRootId(bodyComponent) {
    if (!bodyComponent) return null;
    
    // Handle both formats
    return bodyComponent.root || bodyComponent.body?.root || null;
  }
};

// Task 3 - BaseBodyPartOperator.js
export class BaseBodyPartOperator {
  constructor({ entityManager, bodyGraphService, logger }) {
    if (!entityManager || !bodyGraphService || !logger) {
      throw new Error('Missing required dependencies');
    }
    
    this.entityManager = entityManager;
    this.bodyGraphService = bodyGraphService;
    this.logger = logger;
  }
  
  evaluate(params, context) {
    try {
      // Common parameter validation
      if (!params || params.length < 2) {
        this.logger.warn(`${this.operatorName}: Invalid parameters`);
        return false;
      }
      
      const [entityPath, ...operatorParams] = params;
      
      // Resolve entity from path
      const { entity, isValid } = entityPathResolver.resolve(context, entityPath);
      
      if (!isValid) {
        this.logger.debug(`${this.operatorName}: No entity found at path ${entityPath}`);
        return false;
      }
      
      // Delegate to subclass implementation
      return this.evaluateInternal(entity, operatorParams);
      
    } catch (error) {
      this.logger.error(`${this.operatorName}: Error during evaluation`, error);
      return false;
    }
  }
  
  evaluateInternal(entity, params) {
    throw new Error('evaluateInternal must be implemented by subclass');
  }
}

// Task 4 - hasPartWithComponentValueOperator.js
import { BaseBodyPartOperator } from './base/BaseBodyPartOperator.js';
import { bodyComponentUtils } from '../utils/bodyComponentUtils.js';

export class HasPartWithComponentValueOperator extends BaseBodyPartOperator {
  constructor(dependencies) {
    super(dependencies);
    this.operatorName = 'hasPartWithComponentValue';
  }
  
  evaluateInternal(entityId, params) {
    const [componentTypeAndValue] = params;
    const { componentType, value, property } = componentTypeAndValue;
    
    // Get body component
    const bodyComponent = bodyComponentUtils.getBodyComponent(this.entityManager, entityId);
    if (!bodyComponent) {
      this.logger.debug(`${this.operatorName}: No body component for ${entityId}`);
      return false;
    }
    
    // Extract root ID
    const rootId = bodyComponentUtils.extractRootId(bodyComponent);
    if (!rootId) {
      this.logger.warn(`${this.operatorName}: No root ID in body component`);
      return false;
    }
    
    // Check if any part has the component value
    this.logger.info(`Checking if entity ${entityId} has part with ${componentType}:${property} = ${value}`);
    
    return this.bodyGraphService.hasPartWithComponentValue(
      rootId,
      componentType,
      property,
      value
    );
  }
}

// Task 7 - Simplified jsonLogicCustomOperators.js
import { HasPartWithComponentValueOperator } from './operators/hasPartWithComponentValueOperator.js';
import { HasPartOfTypeOperator } from './operators/hasPartOfTypeOperator.js';
import { HasPartOfTypeWithComponentValueOperator } from './operators/hasPartOfTypeWithComponentValueOperator.js';

export default class JsonLogicCustomOperators {
  static PROVIDER = 'JsonLogicCustomOperators';
  
  constructor({ IEntityManager, IBodyGraphService, ILogger, IJsonLogicEvaluationService }) {
    this.dependencies = {
      entityManager: IEntityManager,
      bodyGraphService: IBodyGraphService,
      logger: ILogger
    };
    this.evaluationService = IJsonLogicEvaluationService;
  }
  
  registerOperators() {
    // Create operator instances
    const operators = {
      hasPartWithComponentValue: new HasPartWithComponentValueOperator(this.dependencies),
      hasPartOfType: new HasPartOfTypeOperator(this.dependencies),
      hasPartOfTypeWithComponentValue: new HasPartOfTypeWithComponentValueOperator(this.dependencies)
    };
    
    // Register each operator
    Object.entries(operators).forEach(([name, operator]) => {
      this.evaluationService.addOperation(
        name,
        (params, data) => operator.evaluate(params, data)
      );
    });
  }
}
```

## Validation Loop

### Level 1: Syntax & Style

```bash
# Run these FIRST - fix any errors in modified files before proceeding
npm run lint

# Expected: No errors in any new or modified files
# Common issues: Import order, unused variables, missing semicolons
# If issues: Fix each file based on eslint output
```

### Level 2: Unit Tests

```bash
# First ensure existing tests still pass
npm test -- tests/unit/logic/jsonLogicCustomOperators.test.js
npm test -- tests/integration/logic/jsonLogicCustomOperators.test.js

# The integration test MUST pass - it includes the "Iker Aguirre issue" reproduction

# Run all new unit tests
npm test -- tests/unit/logic/operators/
npm test -- tests/unit/logic/utils/

# If any test fails:
# 1. Check if behavior changed unintentionally
# 2. Verify operator logic matches original
# 3. Ensure all edge cases are handled
# 4. Never mock to make tests pass - fix the actual issue
```

### Level 3: Integration Verification

```bash
# Run the full test suite to ensure no regressions
npm test

# Specifically verify the critical integration test
npm test -- --testNamePattern="Iker Aguirre issue"

# This test is a real bug reproduction and MUST pass
```

## Final Validation Checklist

- [ ] All tests pass: `npm test`
- [ ] No linting errors: `npm run lint`
- [ ] jsonLogicCustomOperators.js is under 100 lines
- [ ] Each operator is in its own file and testable
- [ ] Common logic is extracted to utilities
- [ ] No behavior changes - operators work exactly as before
- [ ] "Iker Aguirre issue" test passes
- [ ] Each new file has appropriate unit tests
- [ ] Code follows SOLID principles from REFACTORING_PRINCIPLES.md
- [ ] DRY principle applied - no duplicated logic

## Anti-Patterns to Avoid

- ❌ Don't change operator behavior - only refactor structure
- ❌ Don't modify the public API of JsonLogicCustomOperators
- ❌ Don't skip the integration tests - they catch subtle issues
- ❌ Don't change how operators are registered with JsonLogic
- ❌ Don't throw exceptions in operators - always return false for errors
- ❌ Don't change log messages - tests may depend on them
- ❌ Don't ignore the two body component formats - both must work
- ❌ Don't create circular dependencies between modules
- ❌ Don't over-abstract - keep it simple and maintainable

---

## Implementation Confidence Score: 9/10

High confidence due to:
- Clear duplication patterns identified
- Comprehensive test coverage available
- Established operation handler patterns to follow
- Well-defined refactoring principles
- Specific test case ("Iker Aguirre issue") ensures correctness

Minor risk area:
- Preserving exact operator behavior during extraction
- Ensuring all edge cases are maintained