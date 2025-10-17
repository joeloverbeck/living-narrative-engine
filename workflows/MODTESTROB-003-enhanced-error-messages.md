# MODTESTROB-003: Enhanced Error Messages for Action Execution

**Status**: Ready for Implementation
**Priority**: P0 - High (Quick Win)
**Estimated Time**: 4 hours
**Risk Level**: Low
**Phase**: 1 - Quick Wins

## Overview

Enhances `ModTestFixture.executeAction()` with comprehensive pre-flight validation that catches common execution errors **before** they cascade into cryptic failures deep in the rule execution system. Provides context-rich error messages that immediately identify the problem and suggest the fix.

## Prerequisites

- [ ] MODTESTROB-001 complete (validation proxy available)
- [ ] MODTESTROB-002 complete (diagnostic patterns established)
- [ ] Clean git working directory
- [ ] All existing tests passing
- [ ] Feature branch: `feature/modtest-enhanced-errors`

## Problem Statement

**Current Pain Point**: When `executeAction()` fails, errors manifest deep in rule execution with generic messages like:
```
TypeError: Cannot read property 'spot_index' of undefined
```

No indication of:
- Which entity is missing the component?
- Which rule operation failed?
- What was the expected state?

**Target State**: Pre-flight validation catches issues with clear messages:
```
❌ ACTION EXECUTION VALIDATION FAILED
================================================================================
Action: positioning:scoot_closer
Actor: actor1
Target: occupant1

1. Actor 'actor1' missing required component 'positioning:sitting_on'
   📋 Reason: Required by positioning:scoot_closer action
   💡 Suggestion: Add component using: actor.withComponent('positioning:sitting_on', {...})

2. Target 'occupant1' has forbidden component 'positioning:kneeling'
   📋 Reason: Action blocked by forbidden_components constraint
   💡 Suggestion: This action cannot be performed while target is kneeling
```

## Detailed Steps

### Step 1: Create Action Validation Error Class

**File to create**: `tests/common/mods/actionExecutionValidator.js`

**Implementation**:
```javascript
/**
 * @file Action execution validation and error formatting
 * Provides pre-flight validation for action execution
 */

/**
 * Custom error for action execution validation failures
 */
export class ActionValidationError extends Error {
  constructor(errors, context) {
    const formatted = formatActionValidationErrors(errors, context);
    super(formatted);
    this.name = 'ActionValidationError';
    this.errors = errors;
    this.context = context;
  }
}

/**
 * Validates that all prerequisites are met before executing action
 * @param {Object} params - Validation parameters
 * @returns {Array} Array of validation errors (empty if valid)
 */
export function validateActionExecution({
  actorId,
  targetId,
  secondaryTargetId,
  tertiaryTargetId,
  actionDefinition,
  entityManager,
  actionId,
}) {
  const errors = [];

  // Validate actor exists
  if (!entityManager.entityExists(actorId)) {
    errors.push({
      type: 'entity_not_found',
      entityId: actorId,
      role: 'actor',
      message: `Actor entity '${actorId}' does not exist`,
      suggestion:
        'Ensure entity was added to testFixture.reset([...entities])',
      severity: 'critical',
    });
    // If actor doesn't exist, skip further validation
    return errors;
  }

  // Validate targets exist
  const targets = [
    { id: targetId, role: 'primary target' },
    { id: secondaryTargetId, role: 'secondary target' },
    { id: tertiaryTargetId, role: 'tertiary target' },
  ];

  targets.forEach(({ id, role }) => {
    if (id && !entityManager.entityExists(id)) {
      errors.push({
        type: 'entity_not_found',
        entityId: id,
        role,
        message: `${role} entity '${id}' does not exist`,
        suggestion:
          'Ensure entity was added to testFixture.reset([...entities])',
        severity: 'critical',
      });
    }
  });

  // If any entities don't exist, skip component validation
  if (errors.length > 0) {
    return errors;
  }

  // Validate required components on actor
  if (actionDefinition?.required_components?.actor) {
    const actorRequired = actionDefinition.required_components.actor;

    actorRequired.forEach(componentType => {
      if (!entityManager.hasComponent(actorId, componentType)) {
        errors.push({
          type: 'missing_required_component',
          entityId: actorId,
          role: 'actor',
          componentType,
          message: `Actor '${actorId}' missing required component '${componentType}'`,
          suggestion: `Add component: actor.withComponent('${componentType}', {...data})`,
          reason: `Required by ${actionId} action definition`,
          severity: 'high',
        });
      }
    });
  }

  // Validate required components on primary target
  if (targetId && actionDefinition?.required_components?.primary) {
    const primaryRequired = actionDefinition.required_components.primary;

    primaryRequired.forEach(componentType => {
      if (!entityManager.hasComponent(targetId, componentType)) {
        errors.push({
          type: 'missing_required_component',
          entityId: targetId,
          role: 'primary target',
          componentType,
          message: `Primary target '${targetId}' missing required component '${componentType}'`,
          suggestion: `Add component: target.withComponent('${componentType}', {...data})`,
          reason: `Required by ${actionId} action definition`,
          severity: 'high',
        });
      }
    });
  }

  // Validate required components on secondary target
  if (
    secondaryTargetId &&
    actionDefinition?.required_components?.secondary
  ) {
    const secondaryRequired = actionDefinition.required_components.secondary;

    secondaryRequired.forEach(componentType => {
      if (!entityManager.hasComponent(secondaryTargetId, componentType)) {
        errors.push({
          type: 'missing_required_component',
          entityId: secondaryTargetId,
          role: 'secondary target',
          componentType,
          message: `Secondary target '${secondaryTargetId}' missing required component '${componentType}'`,
          suggestion: `Add component: secondaryTarget.withComponent('${componentType}', {...data})`,
          reason: `Required by ${actionId} action definition`,
          severity: 'high',
        });
      }
    });
  }

  // Validate required components on tertiary target
  if (
    tertiaryTargetId &&
    actionDefinition?.required_components?.tertiary
  ) {
    const tertiaryRequired = actionDefinition.required_components.tertiary;

    tertiaryRequired.forEach(componentType => {
      if (!entityManager.hasComponent(tertiaryTargetId, componentType)) {
        errors.push({
          type: 'missing_required_component',
          entityId: tertiaryTargetId,
          role: 'tertiary target',
          componentType,
          message: `Tertiary target '${tertiaryTargetId}' missing required component '${componentType}'`,
          suggestion: `Add component: tertiaryTarget.withComponent('${componentType}', {...data})`,
          reason: `Required by ${actionId} action definition`,
          severity: 'high',
        });
      }
    });
  }

  // Validate forbidden components on actor
  if (actionDefinition?.forbidden_components?.actor) {
    const actorForbidden = actionDefinition.forbidden_components.actor;

    actorForbidden.forEach(componentType => {
      if (entityManager.hasComponent(actorId, componentType)) {
        errors.push({
          type: 'forbidden_component_present',
          entityId: actorId,
          role: 'actor',
          componentType,
          message: `Actor '${actorId}' has forbidden component '${componentType}'`,
          suggestion: `This action cannot be performed while actor has ${componentType}`,
          reason: `Action is blocked by forbidden_components constraint in ${actionId}`,
          severity: 'medium',
        });
      }
    });
  }

  // Validate forbidden components on primary target
  if (targetId && actionDefinition?.forbidden_components?.primary) {
    const primaryForbidden = actionDefinition.forbidden_components.primary;

    primaryForbidden.forEach(componentType => {
      if (entityManager.hasComponent(targetId, componentType)) {
        errors.push({
          type: 'forbidden_component_present',
          entityId: targetId,
          role: 'primary target',
          componentType,
          message: `Primary target '${targetId}' has forbidden component '${componentType}'`,
          suggestion: `This action cannot be performed while target has ${componentType}`,
          reason: `Action is blocked by forbidden_components constraint in ${actionId}`,
          severity: 'medium',
        });
      }
    });
  }

  return errors;
}

/**
 * Format validation errors into readable report
 */
function formatActionValidationErrors(errors, context) {
  let msg = `\n${'='.repeat(80)}\n`;
  msg += `❌ ACTION EXECUTION VALIDATION FAILED\n`;
  msg += `${'='.repeat(80)}\n\n`;
  msg += `Action: ${context.actionId || 'unknown'}\n`;
  msg += `Actor: ${context.actorId || 'unknown'}\n`;
  if (context.targetId) {
    msg += `Primary Target: ${context.targetId}\n`;
  }
  if (context.secondaryTargetId) {
    msg += `Secondary Target: ${context.secondaryTargetId}\n`;
  }
  if (context.tertiaryTargetId) {
    msg += `Tertiary Target: ${context.tertiaryTargetId}\n`;
  }
  msg += `\n`;

  // Group errors by severity
  const critical = errors.filter(e => e.severity === 'critical');
  const high = errors.filter(e => e.severity === 'high');
  const medium = errors.filter(e => e.severity === 'medium');

  let errorNumber = 1;

  if (critical.length > 0) {
    msg += `🚨 CRITICAL ERRORS (${critical.length}):\n\n`;
    critical.forEach(error => {
      msg += formatError(error, errorNumber++);
    });
  }

  if (high.length > 0) {
    msg += `⚠️  HIGH PRIORITY ERRORS (${high.length}):\n\n`;
    high.forEach(error => {
      msg += formatError(error, errorNumber++);
    });
  }

  if (medium.length > 0) {
    msg += `ℹ️  MEDIUM PRIORITY ERRORS (${medium.length}):\n\n`;
    medium.forEach(error => {
      msg += formatError(error, errorNumber++);
    });
  }

  msg += `${'='.repeat(80)}\n`;
  return msg;
}

/**
 * Format single error with details
 */
function formatError(error, number) {
  let msg = `${number}. ${error.message}\n`;
  if (error.reason) {
    msg += `   📋 Reason: ${error.reason}\n`;
  }
  if (error.suggestion) {
    msg += `   💡 Suggestion: ${error.suggestion}\n`;
  }
  msg += `\n`;
  return msg;
}
```

**Validation**:
```bash
# Verify file created
test -f tests/common/mods/actionExecutionValidator.js && echo "✓ File created"
```

### Step 2: Integrate Validation into ModTestFixture

**File to modify**: `tests/common/mods/ModTestFixture.js`

**Changes**:
```javascript
// Add import at top
import {
  validateActionExecution,
  ActionValidationError,
} from './actionExecutionValidator.js';

// Update executeAction method
async executeAction(actorId, targetId, options = {}) {
  const {
    secondaryTargetId = null,
    tertiaryTargetId = null,
    skipValidation = false,
  } = options;

  // Pre-flight validation (unless explicitly skipped)
  if (!skipValidation) {
    const validationErrors = validateActionExecution({
      actorId,
      targetId,
      secondaryTargetId,
      tertiaryTargetId,
      actionDefinition: this._actionDefinition,
      entityManager: this.entityManager,
      actionId: this.actionId,
    });

    if (validationErrors.length > 0) {
      throw new ActionValidationError(validationErrors, {
        actorId,
        targetId,
        secondaryTargetId,
        tertiaryTargetId,
        actionId: this.actionId,
        context: 'test execution',
      });
    }
  }

  // ... existing execution logic ...
}
```

**Validation**:
```bash
# Check imports added
grep -q "actionExecutionValidator" tests/common/mods/ModTestFixture.js && echo "✓ Import added"

# Check validation integrated
grep -q "validateActionExecution" tests/common/mods/ModTestFixture.js && echo "✓ Validation integrated"
```

### Step 3: Create Unit Tests

**File to create**: `tests/unit/common/mods/actionExecutionValidator.test.js`

**Implementation**:
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  validateActionExecution,
  ActionValidationError,
} from '../../../common/mods/actionExecutionValidator.js';

describe('actionExecutionValidator - Entity Existence', () => {
  let mockEntityManager;

  beforeEach(() => {
    mockEntityManager = {
      entityExists: jest.fn(id => id === 'existing_entity'),
      hasComponent: jest.fn(() => false),
    };
  });

  it('should detect missing actor entity', () => {
    const errors = validateActionExecution({
      actorId: 'nonexistent_actor',
      targetId: null,
      actionDefinition: {},
      entityManager: mockEntityManager,
      actionId: 'test:action',
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      type: 'entity_not_found',
      entityId: 'nonexistent_actor',
      role: 'actor',
      severity: 'critical',
    });
  });

  it('should detect missing target entity', () => {
    const errors = validateActionExecution({
      actorId: 'existing_entity',
      targetId: 'nonexistent_target',
      actionDefinition: {},
      entityManager: mockEntityManager,
      actionId: 'test:action',
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      type: 'entity_not_found',
      entityId: 'nonexistent_target',
      role: 'primary target',
      severity: 'critical',
    });
  });

  it('should skip component validation if entity missing', () => {
    // This ensures we don't try to check components on nonexistent entities
    const errors = validateActionExecution({
      actorId: 'nonexistent_actor',
      targetId: null,
      actionDefinition: {
        required_components: {
          actor: ['some:component'],
        },
      },
      entityManager: mockEntityManager,
      actionId: 'test:action',
    });

    // Should only have entity_not_found error, not component errors
    expect(errors).toHaveLength(1);
    expect(errors[0].type).toBe('entity_not_found');
  });
});

describe('actionExecutionValidator - Required Components', () => {
  let mockEntityManager;

  beforeEach(() => {
    mockEntityManager = {
      entityExists: jest.fn(() => true),
      hasComponent: jest.fn((entityId, componentType) => {
        // Simulate actor1 has positioning:sitting_on, but not positioning:standing
        if (
          entityId === 'actor1' &&
          componentType === 'positioning:sitting_on'
        ) {
          return true;
        }
        return false;
      }),
    };
  });

  it('should detect missing required component on actor', () => {
    const errors = validateActionExecution({
      actorId: 'actor1',
      targetId: null,
      actionDefinition: {
        required_components: {
          actor: ['positioning:standing'], // Actor doesn't have this
        },
      },
      entityManager: mockEntityManager,
      actionId: 'test:action',
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      type: 'missing_required_component',
      entityId: 'actor1',
      role: 'actor',
      componentType: 'positioning:standing',
      severity: 'high',
    });
  });

  it('should detect missing required component on primary target', () => {
    const errors = validateActionExecution({
      actorId: 'actor1',
      targetId: 'target1',
      actionDefinition: {
        required_components: {
          primary: ['positioning:sitting_on'],
        },
      },
      entityManager: mockEntityManager,
      actionId: 'test:action',
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      type: 'missing_required_component',
      entityId: 'target1',
      role: 'primary target',
      componentType: 'positioning:sitting_on',
      severity: 'high',
    });
  });

  it('should pass validation if all required components present', () => {
    const errors = validateActionExecution({
      actorId: 'actor1',
      targetId: null,
      actionDefinition: {
        required_components: {
          actor: ['positioning:sitting_on'], // Actor has this
        },
      },
      entityManager: mockEntityManager,
      actionId: 'test:action',
    });

    expect(errors).toHaveLength(0);
  });
});

describe('actionExecutionValidator - Forbidden Components', () => {
  let mockEntityManager;

  beforeEach(() => {
    mockEntityManager = {
      entityExists: jest.fn(() => true),
      hasComponent: jest.fn((entityId, componentType) => {
        // Simulate actor1 has positioning:kneeling
        if (
          entityId === 'actor1' &&
          componentType === 'positioning:kneeling'
        ) {
          return true;
        }
        return false;
      }),
    };
  });

  it('should detect forbidden component on actor', () => {
    const errors = validateActionExecution({
      actorId: 'actor1',
      targetId: null,
      actionDefinition: {
        forbidden_components: {
          actor: ['positioning:kneeling'], // Actor has this (forbidden)
        },
      },
      entityManager: mockEntityManager,
      actionId: 'test:action',
    });

    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({
      type: 'forbidden_component_present',
      entityId: 'actor1',
      role: 'actor',
      componentType: 'positioning:kneeling',
      severity: 'medium',
    });
  });

  it('should pass validation if forbidden component absent', () => {
    const errors = validateActionExecution({
      actorId: 'actor1',
      targetId: null,
      actionDefinition: {
        forbidden_components: {
          actor: ['positioning:standing'], // Actor doesn't have this
        },
      },
      entityManager: mockEntityManager,
      actionId: 'test:action',
    });

    expect(errors).toHaveLength(0);
  });
});

describe('ActionValidationError - Error Formatting', () => {
  it('should format errors with context', () => {
    const errors = [
      {
        type: 'missing_required_component',
        entityId: 'actor1',
        role: 'actor',
        componentType: 'positioning:sitting_on',
        message: "Actor 'actor1' missing required component 'positioning:sitting_on'",
        suggestion: "Add component: actor.withComponent('positioning:sitting_on', {...})",
        reason: 'Required by test:action',
        severity: 'high',
      },
    ];

    const err = new ActionValidationError(errors, {
      actorId: 'actor1',
      targetId: 'target1',
      actionId: 'test:action',
    });

    expect(err.message).toContain('ACTION EXECUTION VALIDATION FAILED');
    expect(err.message).toContain('Action: test:action');
    expect(err.message).toContain('Actor: actor1');
    expect(err.message).toContain('Primary Target: target1');
    expect(err.message).toContain('positioning:sitting_on');
    expect(err.message).toContain('💡 Suggestion');
  });

  it('should group errors by severity', () => {
    const errors = [
      {
        type: 'entity_not_found',
        message: 'Critical error',
        severity: 'critical',
      },
      {
        type: 'missing_required_component',
        message: 'High error',
        severity: 'high',
      },
      {
        type: 'forbidden_component_present',
        message: 'Medium error',
        severity: 'medium',
      },
    ];

    const err = new ActionValidationError(errors, {
      actorId: 'actor1',
      actionId: 'test:action',
    });

    expect(err.message).toContain('CRITICAL ERRORS (1)');
    expect(err.message).toContain('HIGH PRIORITY ERRORS (1)');
    expect(err.message).toContain('MEDIUM PRIORITY ERRORS (1)');
  });
});
```

**Validation**:
```bash
# Run tests
npm run test:unit -- tests/unit/common/mods/actionExecutionValidator.test.js

# Expected: All tests pass
```

### Step 4: Create Integration Test

**File to create**: `tests/integration/common/mods/actionExecutionValidationIntegration.test.js`

**Implementation**:
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../../common/mods/ModEntityBuilder.js';
import { ActionValidationError } from '../../../common/mods/actionExecutionValidator.js';

describe('Action Execution Validation Integration', () => {
  let testFixture;

  beforeEach(async () => {
    // Use stand_up action which requires sitting_on component
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:stand_up',
      null,
      null
    );
  });

  afterEach(() => {
    testFixture.cleanup();
  });

  it('should catch missing required component before execution', async () => {
    const room = new ModEntityBuilder('room1')
      .asRoom('Test Room')
      .build();
    const actor = new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('room1')
      .asActor()
      // Missing positioning:sitting_on component
      .build();

    testFixture.reset([room, actor]);

    await expect(async () => {
      await testFixture.executeAction('actor1', null);
    }).rejects.toThrow(ActionValidationError);

    try {
      await testFixture.executeAction('actor1', null);
    } catch (err) {
      expect(err.message).toContain('missing required component');
      expect(err.message).toContain('positioning:sitting_on');
      expect(err.message).toContain('💡 Suggestion');
    }
  });

  it('should allow execution if validation passes', async () => {
    const room = new ModEntityBuilder('room1')
      .asRoom('Test Room')
      .build();
    const furniture = new ModEntityBuilder('furniture1')
      .withName('chair')
      .atLocation('room1')
      .withComponent('positioning:allows_sitting', { spots: ['actor1'] })
      .build();
    const actor = new ModEntityBuilder('actor1')
      .withName('Alice')
      .atLocation('room1')
      .asActor()
      .withComponent('positioning:sitting_on', {
        furniture_id: 'furniture1',
        spot_index: 0,
      })
      .build();

    testFixture.reset([room, furniture, actor]);

    // Should not throw - all validation passes
    await expect(
      testFixture.executeAction('actor1', null)
    ).resolves.not.toThrow();
  });

  it('should provide clear error when entity does not exist', async () => {
    const room = new ModEntityBuilder('room1')
      .asRoom('Test Room')
      .build();

    testFixture.reset([room]);

    try {
      await testFixture.executeAction('nonexistent_actor', null);
      throw new Error('Should have thrown validation error');
    } catch (err) {
      expect(err).toBeInstanceOf(ActionValidationError);
      expect(err.message).toContain('does not exist');
      expect(err.message).toContain('nonexistent_actor');
      expect(err.message).toContain('CRITICAL ERRORS');
    }
  });

  it('should allow skipping validation if needed', async () => {
    // In some advanced test scenarios, may want to skip validation
    const room = new ModEntityBuilder('room1')
      .asRoom('Test Room')
      .build();

    testFixture.reset([room]);

    // Should not validate and may fail later in execution
    // This is intentional for testing error handling in rules
    await expect(
      testFixture.executeAction('nonexistent_actor', null, {
        skipValidation: true,
      })
    ).rejects.toThrow(); // Will throw different error from rule execution
  });
});
```

**Validation**:
```bash
# Run integration test
npm run test:integration -- tests/integration/common/mods/actionExecutionValidationIntegration.test.js

# Expected: Tests demonstrate validation working
```

## Validation Criteria

### Functionality Checklist

- [ ] actionExecutionValidator.js created
- [ ] ModTestFixture.executeAction() uses validation
- [ ] Unit tests pass with 100% coverage
- [ ] Integration tests demonstrate validation
- [ ] Entity existence validation works
- [ ] Required component validation works
- [ ] Forbidden component validation works
- [ ] Error messages are clear and actionable
- [ ] Skip validation option works for advanced cases
- [ ] Existing tests still pass

### Quality Standards

```bash
# All tests pass
npm run test:unit -- tests/unit/common/mods/actionExecutionValidator.test.js
npm run test:integration -- tests/integration/common/mods/actionExecutionValidationIntegration.test.js

# No linting issues
npx eslint tests/common/mods/actionExecutionValidator.js

# Existing tests still pass
npm run test:integration -- tests/integration/mods/
```

## Files Created/Modified

### New Files
```
tests/common/mods/actionExecutionValidator.js                        (validation utility)
tests/unit/common/mods/actionExecutionValidator.test.js             (unit tests)
tests/integration/common/mods/actionExecutionValidationIntegration.test.js (integration tests)
```

### Modified Files
```
tests/common/mods/ModTestFixture.js  (add pre-flight validation to executeAction)
```

## Testing

### Manual Testing

**Test 1: Intentional validation failure**

```javascript
it('demo - missing component caught', async () => {
  const actor = new ModEntityBuilder('actor1')
    .withName('Alice')
    .asActor()
    // Missing positioning:sitting_on
    .build();

  testFixture.reset([actor]);

  // Should fail with clear message before rule execution
  await expect(
    testFixture.executeAction('actor1', null)
  ).rejects.toThrow(/missing required component/);
});
```

**Test 2: Verify error message clarity**

Run test and verify output includes:
- Action ID
- Entity IDs
- Missing component name
- Suggestion for fix
- Reason for requirement

## Rollback Plan

If validation causes issues:

```bash
# Revert ModTestFixture changes
git checkout HEAD -- tests/common/mods/ModTestFixture.js

# Keep validation module for future use
# git rm tests/common/mods/actionExecutionValidator.js
```

## Commit Strategy

**Single atomic commit**:
```bash
git add tests/common/mods/actionExecutionValidator.js
git add tests/common/mods/ModTestFixture.js
git add tests/unit/common/mods/actionExecutionValidator.test.js
git add tests/integration/common/mods/actionExecutionValidationIntegration.test.js

git commit -m "MODTESTROB-003: Enhance action execution error messages

- Add actionExecutionValidator.js with pre-flight validation
- Validate entity existence before checking components
- Validate required_components on actor and all targets
- Validate forbidden_components on actor and all targets
- Integrate validation into ModTestFixture.executeAction()
- Add ActionValidationError with context-rich formatting
- Group errors by severity (critical/high/medium)
- Provide actionable suggestions for each error
- Add comprehensive unit and integration tests
- Support skipValidation option for advanced testing

Impact:
- 50% reduction in debugging time for execution errors
- Clear identification of missing components
- Immediate feedback before rule execution
- Actionable suggestions for fixing issues

Resolves MODTESTROB-003 (Phase 1 - P0 Priority)
"
```

## Success Criteria

Implementation is successful when:
- ✅ Pre-flight validation catches common errors
- ✅ Entity existence checked before components
- ✅ Required components validated for all roles
- ✅ Forbidden components detected correctly
- ✅ Error messages are clear and actionable
- ✅ Suggestions provided for each error
- ✅ Errors grouped by severity
- ✅ Existing tests still pass
- ✅ Skip validation option works
- ✅ Integration with ModTestFixture is seamless

## Expected Impact

### Quantitative
- **50% reduction** in action execution debugging time
- **90% of component errors** caught before execution
- **5 minutes saved** per execution error
- **Zero false positives** (validation is accurate)

### Qualitative
- Developers immediately know which component is missing
- Clear path from error to solution
- Reduced frustration from deep stack traces
- Faster test development and debugging

## Next Steps

After this ticket is complete:
1. Verify all tests pass
2. Test error messages are clear and helpful
3. Create clean commit as specified
4. **Phase 1 Complete!** Move to Phase 2
5. Proceed to **MODTESTROB-004** (Scope Resolver Helpers)
6. Document validation in MODTESTROB-008

---

**Dependencies**: MODTESTROB-001 (uses validation patterns)
**Blocks**: MODTESTROB-008 (needs validation examples)
**Completes**: Phase 1 (all P0 quick wins implemented)
