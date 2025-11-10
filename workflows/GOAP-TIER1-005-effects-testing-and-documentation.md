# GOAP-TIER1-005: Effects Testing and Documentation

**Phase:** 1 (Effects Auto-Generation)
**Timeline:** Weeks 7-8
**Status:** Not Started
**Dependencies:** GOAP-TIER1-002, GOAP-TIER1-003, GOAP-TIER1-004

## Overview

Create comprehensive test suites for all effects components and complete documentation for the effects auto-generation system. This ensures high code quality and provides clear guidance for maintainers and future development.

## Objectives

1. Create unit test suites (90%+ coverage)
2. Create integration test suites
3. Create performance tests
4. Create documentation for effects system
5. Document operation mappings
6. Document troubleshooting guide
7. Document abstract preconditions

## Testing Requirements

### Unit Tests

#### 1. EffectsAnalyzer Tests

**File:** `tests/unit/goap/analysis/effectsAnalyzer.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';
import EffectsAnalyzer from '../../../../src/goap/analysis/effectsAnalyzer.js';

describe('EffectsAnalyzer', () => {
  let testBed;
  let effectsAnalyzer;

  beforeEach(() => {
    testBed = createTestBed();
    effectsAnalyzer = testBed.createEffectsAnalyzer();
  });

  describe('analyzeRule', () => {
    it('should extract state-changing effects from simple rule', () => {
      const rule = testBed.createRule({
        id: 'test:simple_rule',
        operations: [
          {
            type: 'ADD_COMPONENT',
            parameters: {
              entity: 'actor',
              component: 'test:marker'
            }
          }
        ]
      });

      const result = effectsAnalyzer.analyzeRule(rule);

      expect(result.effects).toHaveLength(1);
      expect(result.effects[0].operation).toBe('ADD_COMPONENT');
      expect(result.effects[0].component).toBe('test:marker');
    });

    it('should handle conditional operations', () => {
      // Test IF operations
    });

    it('should expand macros before analysis', () => {
      // Test macro expansion
    });

    it('should generate abstract preconditions', () => {
      // Test abstract precondition generation
    });
  });

  describe('isWorldStateChanging', () => {
    it('should identify ADD_COMPONENT as state-changing', () => {
      const op = { type: 'ADD_COMPONENT' };
      expect(effectsAnalyzer.isWorldStateChanging(op)).toBe(true);
    });

    it('should identify DISPATCH_EVENT as non-state-changing', () => {
      const op = { type: 'DISPATCH_EVENT' };
      expect(effectsAnalyzer.isWorldStateChanging(op)).toBe(false);
    });

    // Test all 20+ state-changing operations
  });

  describe('operationToEffect', () => {
    it('should convert ADD_COMPONENT', () => {
      // Test conversion
    });

    it('should convert LOCK_MOVEMENT to ADD_COMPONENT', () => {
      // Test component-based operation conversion
    });

    // Test all operation types
  });
});
```

**File:** `tests/unit/goap/analysis/effectsAnalyzer.edgeCases.test.js`

- Empty operations list
- Operations with missing parameters
- Nested IF operations
- Multiple conditional paths
- Invalid operation types
- Circular macro references

#### 2. EffectsGenerator Tests

**File:** `tests/unit/goap/generation/effectsGenerator.test.js`

- Generate for single action (success)
- Generate for single action (no rule)
- Generate for mod
- Validate effects (valid)
- Validate effects (invalid)
- Inject effects

**File:** `tests/unit/goap/generation/effectsGenerator.validation.test.js`

- Schema validation
- Component reference validation
- Abstract precondition validation
- Multiple validation errors

#### 3. EffectsValidator Tests

**File:** `tests/unit/goap/validation/effectsValidator.test.js`

- Validate single action (valid)
- Validate single action (missing effects)
- Validate single action (effects mismatch)
- Validate mod
- Compare effects
- Generate report

#### 4. Schema Tests

**File:** `tests/unit/goap/schemas/planningEffects.schema.test.js`

- Valid ADD_COMPONENT effect
- Valid REMOVE_COMPONENT effect
- Valid MODIFY_COMPONENT effect
- Valid CONDITIONAL effect
- Invalid effects (missing required fields)
- Abstract preconditions structure

### Integration Tests

#### 1. Full Generation Workflow

**File:** `tests/integration/goap/effectsGeneration.integration.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('Effects Generation Integration', () => {
  let testBed;

  beforeEach(async () => {
    testBed = createTestBed();
    await testBed.loadMods(['positioning', 'items']);
  });

  afterEach(() => {
    testBed.cleanup();
  });

  it('should generate effects for positioning:sit_down', async () => {
    const effectsGenerator = testBed.resolve('IEffectsGenerator');
    const effects = await effectsGenerator.generateForAction('positioning:sit_down');

    expect(effects).toBeDefined();
    expect(effects.effects.length).toBeGreaterThan(0);
    expect(effects.effects).toContainEqual(
      expect.objectContaining({
        operation: 'ADD_COMPONENT',
        component: 'positioning:sitting_on'
      })
    );
  });

  it('should generate effects for items:pick_up_item', async () => {
    const effectsGenerator = testBed.resolve('IEffectsGenerator');
    const effects = await effectsGenerator.generateForAction('items:pick_up_item');

    expect(effects).toBeDefined();
    expect(effects.effects).toContainEqual(
      expect.objectContaining({
        operation: 'ADD_COMPONENT',
        entity: 'actor',
        component: 'items:inventory_item'
      })
    );

    // Should have abstract precondition for capacity check
    expect(effects.abstractPreconditions).toBeDefined();
    expect(effects.abstractPreconditions.hasInventoryCapacity).toBeDefined();
  });

  it('should validate generated effects match rules', async () => {
    const effectsGenerator = testBed.resolve('IEffectsGenerator');
    const effectsValidator = testBed.resolve('IEffectsValidator');

    // Generate effects
    const effects = await effectsGenerator.generateForAction('positioning:sit_down');

    // Inject into action
    await effectsGenerator.injectEffects(
      new Map([['positioning:sit_down', effects]])
    );

    // Validate
    const result = await effectsValidator.validateAction('positioning:sit_down');

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
```

#### 2. Schema Integration

**File:** `tests/integration/goap/schemaIntegration.test.js`

- Action schema accepts planningEffects
- Schema validation in action loader
- Backward compatibility

#### 3. Validation Integration

**File:** `tests/integration/goap/effectsValidation.integration.test.js`

- Validate positioning mod
- Validate items mod
- Detect desyncs
- Generate reports

### Performance Tests

**File:** `tests/performance/goap/effectsGeneration.performance.test.js`

```javascript
import { describe, it, expect } from '@jest/globals';
import { createTestBed } from '../../common/testBed.js';

describe('Effects Generation Performance', () => {
  it('should generate effects for 200 actions in under 5 seconds', async () => {
    const testBed = createTestBed();
    await testBed.loadAllMods();

    const effectsGenerator = testBed.resolve('IEffectsGenerator');

    const startTime = Date.now();
    const effectsMap = await effectsGenerator.generateForAllMods();
    const duration = Date.now() - startTime;

    expect(effectsMap.size).toBeGreaterThan(100);
    expect(duration).toBeLessThan(5000); // < 5 seconds
  });

  it('should analyze complex rule in under 100ms', async () => {
    // Test single complex rule analysis
  });
});
```

## Documentation Requirements

### 1. Effects Auto-Generation Guide

**File:** `docs/goap/effects-auto-generation.md`

Content:
- Overview of effects auto-generation
- How effects are generated from rules
- Operation mapping table (all 30+ operations)
- Data flow analysis algorithm
- Path tracing for conditionals
- Macro resolution process
- Abstract preconditions
- Hypothetical data handling
- Running the generator
- Validation tool usage
- Troubleshooting common issues
- Manual overrides (for complex cases)

### 2. Operation Mapping Reference

**File:** `docs/goap/operation-mapping.md`

Content:
- Complete mapping table
- State-changing operations (20+ operations)
- Context-producing operations (12+ operations)
- Control flow operations (4 operations)
- Excluded operations (15+ operations)
- Examples for each operation type
- Edge cases and special handling

### 3. Abstract Preconditions Catalog

**File:** `docs/goap/abstract-preconditions.md`

Content:
- What are abstract preconditions?
- Why they're needed
- Catalog of all abstract functions:
  - `hasInventoryCapacity(actorId, itemId)`
  - `hasContainerCapacity(containerId, itemId)`
  - `hasComponent(entityId, componentId)`
  - etc.
- Implementation requirements
- Simulation function guide
- Adding new abstract preconditions

### 4. Operation Result Structures

**File:** `docs/goap/operation-result-structures.md`

Content:
- Document result_variable structures
- `VALIDATE_INVENTORY_CAPACITY` → `{ valid: boolean, reason: string }`
- `VALIDATE_CONTAINER_CAPACITY` → `{ valid: boolean, reason: string }`
- `OPEN_CONTAINER` → `{ success: boolean, error: string }`
- `ATOMIC_MODIFY_COMPONENT` → boolean success/failure
- etc.

### 5. Macro Resolution Guide

**File:** `docs/goap/macro-resolution.md`

Content:
- How macros work in rules
- Common macros (e.g., `core:logSuccessAndEndTurn`)
- Macro expansion process
- Impact on effects generation
- Troubleshooting macro-related issues

### 6. Troubleshooting Guide

**File:** `docs/goap/troubleshooting.md`

Content:
- Common errors and solutions
- Effects don't match rules
- Missing operations
- Validation failures
- Schema errors
- Performance issues
- Debugging tips

### 7. Main GOAP Documentation

**File:** `docs/goap/README.md`

Content:
- Overview of GOAP Tier 1
- Architecture diagram
- Component overview
- Quick start guide
- Links to detailed docs
- FAQ

## Files to Create

### Tests
- [ ] `tests/unit/goap/analysis/effectsAnalyzer.test.js`
- [ ] `tests/unit/goap/analysis/effectsAnalyzer.edgeCases.test.js`
- [ ] `tests/unit/goap/generation/effectsGenerator.test.js`
- [ ] `tests/unit/goap/generation/effectsGenerator.validation.test.js`
- [ ] `tests/unit/goap/validation/effectsValidator.test.js`
- [ ] `tests/unit/goap/schemas/planningEffects.schema.test.js`
- [ ] `tests/integration/goap/effectsGeneration.integration.test.js`
- [ ] `tests/integration/goap/schemaIntegration.test.js`
- [ ] `tests/integration/goap/effectsValidation.integration.test.js`
- [ ] `tests/performance/goap/effectsGeneration.performance.test.js`

### Documentation
- [ ] `docs/goap/README.md`
- [ ] `docs/goap/effects-auto-generation.md`
- [ ] `docs/goap/operation-mapping.md`
- [ ] `docs/goap/abstract-preconditions.md`
- [ ] `docs/goap/operation-result-structures.md`
- [ ] `docs/goap/macro-resolution.md`
- [ ] `docs/goap/troubleshooting.md`

## Acceptance Criteria

### Testing
- [ ] All unit tests pass with 90%+ branch coverage
- [ ] All integration tests pass
- [ ] Performance tests pass (<5s for 200 actions)
- [ ] Edge cases covered
- [ ] No regression in existing tests
- [ ] ESLint passes on all test files
- [ ] TypeScript types valid in tests

### Documentation
- [ ] All doc files created and complete
- [ ] Code examples tested and working
- [ ] Diagrams included where helpful
- [ ] Cross-references between docs
- [ ] Table of contents in main README
- [ ] Clear troubleshooting guide
- [ ] FAQ section addresses common questions

### Code Quality
- [ ] All code has JSDoc comments
- [ ] No TODO or FIXME comments in production code
- [ ] No console.log statements
- [ ] Error handling tested
- [ ] Edge cases handled gracefully

## Success Metrics

- ✅ 90%+ branch coverage, 95%+ function/line coverage
- ✅ All tests green
- ✅ Performance targets met (<5s generation)
- ✅ Documentation complete and clear
- ✅ Zero critical issues from manual review
- ✅ Team can understand and maintain code

## Notes

- **Test First:** Write tests alongside implementation
- **Real Data:** Use real action/rule data in integration tests
- **Performance Baseline:** Establish baseline before optimization
- **Documentation Examples:** Test all code examples in docs

## Related Tickets

- Depends on: GOAP-TIER1-002, GOAP-TIER1-003, GOAP-TIER1-004
- Completes Phase 1 (Effects Auto-Generation)
- Enables: GOAP-TIER1-007 (Goal System)
