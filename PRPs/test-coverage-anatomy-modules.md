name: "Test Coverage for Anatomy Modules - ValidationRule and GraphBuildingWorkflow"
description: |

## Purpose
Template optimized for AI agents to implement comprehensive test suites for validationRule.js and graphBuildingWorkflow.js with sufficient context and self-validation capabilities to achieve working code through iterative refinement.

## Core Principles
1. **Context is King**: Include ALL necessary documentation, examples, and caveats
2. **Validation Loops**: Provide executable tests/lints the AI can run and fix
3. **Information Dense**: Use keywords and patterns from the codebase
4. **Progressive Success**: Start simple, validate, then enhance
5. **Global rules**: Be sure to follow all rules in CLAUDE.md

---

## Goal
Create comprehensive test suites for `src/anatomy/validation/validationRule.js` and `src/anatomy/workflows/graphBuildingWorkflow.js` to achieve as close to 100% code coverage as possible.

## Why
- **Current state**: validationRule.js has only 42.85% coverage, graphBuildingWorkflow.js has only 34.09% coverage
- **Target state**: Achieve ~100% coverage for both modules
- **Impact**: Ensures the validation infrastructure and graph building workflow are robust and maintainable
- **Problems solved**: Prevents regressions in critical anatomy system components

## What
Create unit test files that comprehensively test all methods, branches, and error cases for both modules.

### Success Criteria
- [ ] validationRule.js coverage ≥ 95%
- [ ] graphBuildingWorkflow.js coverage ≥ 95%
- [ ] All tests pass with `npm run test`
- [ ] No linting errors in test files

## All Needed Context

### Documentation & References
```yaml
# MUST READ - Include these in your context window
- file: src/anatomy/validation/validationRule.js
  why: The module being tested - understand all methods and branches
  
- file: src/anatomy/workflows/graphBuildingWorkflow.js
  why: The module being tested - understand all methods and branches
  
- file: tests/unit/anatomy/validation/rules/socketLimitRule.test.js
  why: Example of testing a validation rule implementation - follow this pattern
  
- file: tests/common/mockFactories/loggerMocks.js
  why: Use createMockLogger() for logger mocks
  
- file: src/utils/serviceBase.js
  why: GraphBuildingWorkflow extends BaseService - understand constructor validation

- file: tests/unit/anatomy/workflows/anatomyGenerationWorkflow.test.js
  why: Example of testing a workflow class - follow this pattern
```

### Current Codebase tree
```bash
tests/
└── unit/
    └── anatomy/
        ├── validation/
        │   ├── rules/
        │   │   ├── cycleDetectionRule.test.js
        │   │   └── socketLimitRule.test.js
        │   ├── validationContext.test.js
        │   └── validationRuleChain.test.js
        └── workflows/
            ├── anatomyGenerationWorkflow.test.js
            └── descriptionGenerationWorkflow.test.js
```

### Desired Codebase tree with files to be added
```bash
tests/
└── unit/
    └── anatomy/
        ├── validation/
        │   ├── rules/
        │   │   ├── cycleDetectionRule.test.js
        │   │   └── socketLimitRule.test.js
        │   ├── validationContext.test.js
        │   ├── validationRule.test.js  # NEW - tests for base ValidationRule class
        │   └── validationRuleChain.test.js
        └── workflows/
            ├── anatomyGenerationWorkflow.test.js
            ├── descriptionGenerationWorkflow.test.js
            └── graphBuildingWorkflow.test.js  # NEW - tests for GraphBuildingWorkflow
```

### Known Gotchas of our codebase & Library Quirks
```javascript
// CRITICAL: ValidationRule is an abstract base class
// - Must test that abstract methods throw errors
// - Create concrete implementation for testing non-abstract methods

// CRITICAL: BaseService requires specific dependency validation
// - Must test constructor throws on missing required dependencies
// - Use _init method pattern from BaseService

// CRITICAL: Mock patterns in this codebase
// - Always use jest.fn() for mock methods
// - Use mockImplementation for complex return values
// - Reset mocks in beforeEach
```

## Implementation Blueprint

### Data models and structure

For ValidationRule tests, create a concrete test implementation:
```javascript
class TestValidationRule extends ValidationRule {
  get ruleId() { return 'test-rule'; }
  get ruleName() { return 'Test Rule'; }
  async validate(context) { return []; }
}
```

### List of tasks to be completed to fulfill the PRP in the order they should be completed

```yaml
Task 1:
CREATE tests/unit/anatomy/validation/validationRule.test.js:
  - MIRROR pattern from: tests/unit/anatomy/validation/rules/socketLimitRule.test.js
  - CREATE concrete TestValidationRule class for testing
  - TEST abstract method enforcement (ruleId, ruleName throw errors)
  - TEST shouldApply method (default returns true)
  - TEST createError, createWarning, createInfo helper methods
  - VERIFY each helper creates correct structure with severity and ruleId

Task 2:
CREATE tests/unit/anatomy/workflows/graphBuildingWorkflow.test.js:
  - MIRROR pattern from: tests/unit/anatomy/workflows/anatomyGenerationWorkflow.test.js
  - IMPORT createMockLogger from tests/common/mockFactories/loggerMocks.js
  - TEST constructor validation (missing dependencies throw errors)
  - TEST buildCache method (success, missing rootId, invalid root entity, build errors)
  - TEST rebuildCache method (calls clearCache if exists, then buildCache)
  - TEST hasCacheForRoot method (with/without rootId, with/without hasCache method)
  - TEST validateCache method (valid cache, missing root entity, validation errors)
  - TEST private validateRootEntity through buildCache calls
```

### Per task pseudocode as needed

#### Task 1: ValidationRule tests
```javascript
// Test abstract method enforcement
it('should throw error when accessing abstract ruleId', () => {
  const rule = new ValidationRule();
  expect(() => rule.ruleId).toThrow('ruleId must be implemented by subclass');
});

// Test helper methods with concrete implementation
describe('with concrete implementation', () => {
  let rule;
  beforeEach(() => {
    rule = new TestValidationRule();
  });
  
  it('should create error with correct structure', () => {
    const error = rule.createError('Test error', { entityId: '123' });
    expect(error).toEqual({
      severity: 'error',
      message: 'Test error',
      ruleId: 'test-rule',
      context: { entityId: '123' }
    });
  });
});
```

#### Task 2: GraphBuildingWorkflow tests
```javascript
// Test constructor validation
it('should throw when missing required dependencies', () => {
  expect(() => new GraphBuildingWorkflow({}))
    .toThrow(InvalidArgumentError);
});

// Test buildCache with mocked dependencies
it('should build cache successfully', async () => {
  const mockEntity = { hasComponent: jest.fn().mockReturnValue(true) };
  mockEntityManager.getEntityInstance.mockReturnValue(mockEntity);
  
  await workflow.buildCache('root-123');
  
  expect(mockBodyGraphService.buildAdjacencyCache).toHaveBeenCalledWith('root-123');
  expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('Successfully built'));
});

// Test error propagation
it('should throw GraphBuildingError when build fails', async () => {
  const error = new Error('Build failed');
  mockBodyGraphService.buildAdjacencyCache.mockImplementation(() => {
    throw error;
  });
  
  await expect(workflow.buildCache('root-123'))
    .rejects.toThrow(GraphBuildingError);
});
```

## Validation Loop

### Level 1: Syntax & Style
```bash
# Run these FIRST - fix any errors in the files you've modified before proceeding
npm run lint # Auto-fix what's possible

# Expected: No errors in the files you've modified. If errors, READ the error and fix.
```

### Level 2: Unit Tests
```bash
# Run and iterate until passing:
npm run test tests/unit/anatomy/validation/validationRule.test.js
npm run test tests/unit/anatomy/workflows/graphBuildingWorkflow.test.js

# Check coverage increased:
npm run test -- --coverage --collectCoverageFrom='src/anatomy/validation/validationRule.js'
npm run test -- --coverage --collectCoverageFrom='src/anatomy/workflows/graphBuildingWorkflow.js'

# Run all tests to ensure no regressions:
npm run test

# If failing: Read error, understand root cause, fix code, re-run (never mock to pass)
```

## Final validation Checklist
- [ ] All tests pass: `npm run test`
- [ ] No linting errors: `npm run lint`
- [ ] Coverage for validationRule.js ≥ 95%
- [ ] Coverage for graphBuildingWorkflow.js ≥ 95%
- [ ] All methods have at least one test
- [ ] All error cases are tested
- [ ] Mock calls are verified with correct parameters

---

## Anti-Patterns to Avoid
- ❌ Don't test implementation details - test behavior
- ❌ Don't create tests that always pass
- ❌ Don't ignore failing tests - fix them
- ❌ Don't forget to test error cases
- ❌ Don't use real dependencies - mock everything
- ❌ Don't write tests without assertions