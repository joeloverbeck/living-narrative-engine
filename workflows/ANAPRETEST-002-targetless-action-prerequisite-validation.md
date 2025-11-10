# ANAPRETEST-002: Add Validation for Targetless Action Prerequisites

**Phase:** 1 (Core Infrastructure)
**Priority:** P1 (High)
**Effort:** Medium (2-3 days)
**Impact:** High - Prevents regressions in targetless action handling
**Status:** Not Started

## Context

The test environment didn't properly validate that targetless actions (actions with `targets: "none"`) can still evaluate actor-based prerequisites. The `buildPrerequisiteContextOverride` function returned `null` when no targets were present, preventing prerequisite evaluation for actions like `squeeze_breasts_draw_attention`.

**Root Cause:** No explicit test coverage or assertions validating that targetless actions can evaluate prerequisites that reference the actor (e.g., `hasPartOfType: ["actor", "breast"]`).

**Impact:** Edge case behavior not validated, leading to regressions when test utilities change.

**Reference:** Report lines 136-162

## Solution Overview

Add comprehensive validation for targetless action prerequisites:

1. **Explicit Test Cases**
   - Create test suite specifically for targetless actions with prerequisites
   - Cover all prerequisite types that reference actor context
   - Validate both success and failure scenarios

2. **Enhanced Test Utilities**
   - Add assertions in `buildPrerequisiteContextOverride` to validate actor context
   - Document expected behavior for targetless actions
   - Add diagnostic logging for prerequisite context creation

3. **Documentation**
   - Document targetless action patterns in test guide
   - Provide example test patterns
   - Update anatomy testing guide

## File Structure

```
tests/unit/anatomy/
└── targetlessActionPrerequisites.test.js   # NEW: Targetless action tests

tests/integration/anatomy/
└── targetlessActionWorkflow.test.js        # NEW: Integration tests

tests/common/engine/
└── systemLogicTestEnv.js                   # Enhanced assertions

docs/testing/
├── anatomy-testing-guide.md                # Updated with patterns
└── targetless-action-patterns.md           # NEW: Pattern guide

tests/common/mods/
└── targetlessActionExamples.js             # NEW: Example fixtures
```

## Detailed Implementation Steps

### Step 1: Create Unit Test Suite

**File:** `tests/unit/anatomy/targetlessActionPrerequisites.test.js`

```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';

describe('Targetless Actions - Prerequisite Evaluation', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'seduction',
      'seduction:squeeze_breasts_draw_attention',
      null, // rule file
      null, // condition file
      { autoRegisterScopes: true, scopeCategories: ['anatomy', 'positioning'] }
    );
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('Actor-based Prerequisites', () => {
    it('should evaluate hasPartOfType prerequisite for actor with targets: "none"', async () => {
      // Arrange
      const actor = fixture.createEntity({
        id: 'actor-with-breasts',
        name: 'Test Actor',
        components: {
          'core:actor': {},
          'anatomy:body': {
            parts: {
              'breast-left': {
                type: 'breast',
                name: 'left breast',
                slot: 'torso',
                can_be_targeted: true
              },
              'breast-right': {
                type: 'breast',
                name: 'right breast',
                slot: 'torso',
                can_be_targeted: true
              }
            }
          }
        }
      });

      fixture.reset([actor]);

      // Act
      const actions = await fixture.discoverActions(actor.id);

      // Assert
      expect(actions).toContainEqual(
        expect.objectContaining({
          id: 'seduction:squeeze_breasts_draw_attention'
        })
      );
    });

    it('should NOT discover action when actor lacks required anatomy', async () => {
      // Arrange
      const actor = fixture.createEntity({
        id: 'actor-no-breasts',
        name: 'Test Actor',
        components: {
          'core:actor': {},
          'anatomy:body': {
            parts: {
              'torso': {
                type: 'torso',
                name: 'torso',
                slot: 'core',
                can_be_targeted: false
              }
            }
          }
        }
      });

      fixture.reset([actor]);

      // Act
      const actions = await fixture.discoverActions(actor.id);

      // Assert
      expect(actions).not.toContainEqual(
        expect.objectContaining({
          id: 'seduction:squeeze_breasts_draw_attention'
        })
      );
    });

    it('should evaluate hasClothingInSlot prerequisite for targetless actions', async () => {
      const actor = fixture.createEntity({
        id: 'actor-clothed',
        name: 'Test Actor',
        components: {
          'core:actor': {},
          'anatomy:body': { parts: { /* anatomy */ } },
          'clothing:worn_items': {
            slots: {
              'chest': { item_id: 'shirt-1', coverage: 'full' }
            }
          }
        }
      });

      fixture.reset([actor]);

      // Create action that requires chest clothing
      const action = {
        id: 'test:targetless_action_with_clothing',
        targets: 'none',
        prerequisites: [
          { logic: { hasClothingInSlot: ['actor', 'chest'] } }
        ]
      };

      // Test prerequisite evaluation
      const result = await fixture.evaluatePrerequisites(
        action.prerequisites,
        actor.id,
        null // no target
      );

      expect(result).toBe(true);
    });
  });

  describe('Composite Prerequisites', () => {
    it('should evaluate AND prerequisites for targetless actions', async () => {
      const actor = fixture.createEntity({
        id: 'actor-composite',
        name: 'Test Actor',
        components: {
          'core:actor': {},
          'anatomy:body': {
            parts: {
              'breast-left': { type: 'breast', name: 'left breast', slot: 'torso', can_be_targeted: true }
            }
          },
          'positioning:standing': {}
        }
      });

      fixture.reset([actor]);

      const prerequisites = [
        { logic: { hasPartOfType: ['actor', 'breast'] } },
        { logic: { component_present: ['actor', 'positioning:standing'] } }
      ];

      const result = await fixture.evaluatePrerequisites(
        prerequisites,
        actor.id,
        null
      );

      expect(result).toBe(true);
    });

    it('should fail when one AND condition fails', async () => {
      const actor = fixture.createEntity({
        id: 'actor-incomplete',
        name: 'Test Actor',
        components: {
          'core:actor': {},
          'anatomy:body': { parts: {} }, // No breasts
          'positioning:standing': {}
        }
      });

      fixture.reset([actor]);

      const prerequisites = [
        { logic: { hasPartOfType: ['actor', 'breast'] } },
        { logic: { component_present: ['actor', 'positioning:standing'] } }
      ];

      const result = await fixture.evaluatePrerequisites(
        prerequisites,
        actor.id,
        null
      );

      expect(result).toBe(false);
    });
  });

  describe('Prerequisite Context Creation', () => {
    it('should create prerequisite context with actor even when targets is "none"', () => {
      const actor = { id: 'actor-1', components: {} };
      const resolvedTargets = {}; // Empty targets

      const context = fixture.testEnv.buildPrerequisiteContextOverride(
        resolvedTargets,
        actor.id
      );

      expect(context).not.toBeNull();
      expect(context.actor).toBeDefined();
      expect(context.actor.id).toBe(actor.id);
      expect(context.targets).toEqual({});
    });

    it('should return null only when no actor AND no targets', () => {
      const resolvedTargets = {};
      const actorId = null;

      const context = fixture.testEnv.buildPrerequisiteContextOverride(
        resolvedTargets,
        actorId
      );

      expect(context).toBeNull();
    });
  });
});
```

### Step 2: Create Integration Test Suite

**File:** `tests/integration/anatomy/targetlessActionWorkflow.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import '../../common/mods/domainMatchers.js';

describe('Targetless Action Workflow - Anatomy Prerequisites', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'seduction',
      'seduction:grab_crotch_draw_attention',
      null,
      null,
      { autoRegisterScopes: true, scopeCategories: ['anatomy'] }
    );
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('should complete full workflow: discovery → execution → effects', async () => {
    // Arrange - Actor with required anatomy
    const actor = fixture.createEntity({
      id: 'actor-1',
      name: 'Seductive Actor',
      components: {
        'core:actor': {},
        'anatomy:body': {
          parts: {
            'groin': {
              type: 'groin',
              name: 'groin',
              slot: 'lower_body',
              can_be_targeted: true
            }
          }
        }
      }
    });

    fixture.reset([actor]);

    // Act - Discover actions
    const discovered = await fixture.discoverActions(actor.id);

    // Assert - Action is discovered
    expect(discovered).toContainEqual(
      expect.objectContaining({
        id: 'seduction:grab_crotch_draw_attention'
      })
    );

    // Act - Execute action
    await fixture.executeAction(actor.id, null); // No target

    // Assert - Action succeeded
    expect(fixture.events).toHaveActionSuccess();
  });

  it('should respect forbidden components for targetless actions', async () => {
    const actor = fixture.createEntity({
      id: 'actor-forbidden',
      name: 'Actor Receiving Blowjob',
      components: {
        'core:actor': {},
        'anatomy:body': {
          parts: {
            'groin': { type: 'groin', name: 'groin', slot: 'lower_body', can_be_targeted: true }
          }
        },
        'sex-penile-oral:receiving_blowjob': {} // Forbidden component
      }
    });

    fixture.reset([actor]);

    // Should NOT discover action due to forbidden component
    const discovered = await fixture.discoverActions(actor.id);

    expect(discovered).not.toContainEqual(
      expect.objectContaining({
        id: 'seduction:grab_crotch_draw_attention'
      })
    );
  });

  it('should handle complex anatomy prerequisites for targetless actions', async () => {
    const actor = fixture.createEntity({
      id: 'actor-complex',
      name: 'Complex Actor',
      components: {
        'core:actor': {},
        'anatomy:body': {
          parts: {
            'penis': { type: 'penis', name: 'penis', slot: 'groin', can_be_targeted: true, state: 'exposed' }
          }
        },
        'positioning:standing': {}
      }
    });

    fixture.reset([actor]);

    const action = {
      id: 'test:complex_targetless',
      targets: 'none',
      prerequisites: [
        { logic: { hasPartOfType: ['actor', 'penis'] } },
        { logic: { hasPartWithState: ['actor', 'penis', 'exposed'] } }
      ]
    };

    const result = await fixture.evaluatePrerequisites(
      action.prerequisites,
      actor.id,
      null
    );

    expect(result).toBe(true);
  });
});
```

### Step 3: Enhance Test Utilities with Assertions

**File:** `tests/common/engine/systemLogicTestEnv.js` (modify)

Add validation assertions in `buildPrerequisiteContextOverride`:

```javascript
const buildPrerequisiteContextOverride = (resolvedTargets, actorId) => {
  const hasTargets = resolvedTargets && Object.keys(resolvedTargets).length > 0;

  const override = { targets: {} };

  if (hasTargets) {
    // ... existing target handling ...
  }

  // Always add actor context if actorId is provided
  if (actorId) {
    const actorOverride = createResolvedTarget(actorId);
    if (actorOverride) {
      override.actor = actorOverride;

      // ASSERTION: Validate actor context structure
      if (!override.actor.id) {
        logger.warn(
          'buildPrerequisiteContextOverride: Actor context missing ID',
          { actorId, actorOverride }
        );
      }

      if (!override.actor.entity) {
        logger.debug(
          'buildPrerequisiteContextOverride: Actor context missing entity instance',
          { actorId, note: 'This may be expected for lightweight contexts' }
        );
      }
    } else {
      logger.warn(
        'buildPrerequisiteContextOverride: Failed to create actor context',
        { actorId, note: 'Actor may not exist in entity manager' }
      );
    }
  }

  // Return override if we have actor context, even if no targets
  if (override.actor || hasTargets) {
    // ASSERTION: Log context creation for targetless actions
    if (!hasTargets && override.actor) {
      logger.debug(
        'buildPrerequisiteContextOverride: Created context for targetless action',
        {
          actorId,
          hasActor: !!override.actor,
          hasTargets: false,
          note: 'This is expected for actions with targets: "none"'
        }
      );
    }

    return override;
  }

  return null;
};
```

### Step 4: Create Pattern Documentation

**File:** `docs/testing/targetless-action-patterns.md`

```markdown
# Targetless Action Testing Patterns

## Overview

Targetless actions are actions with `targets: "none"` that operate only on the actor without requiring a target entity. Despite having no targets, these actions can still evaluate prerequisites that reference the actor's anatomy, components, or state.

## Common Patterns

### Pattern 1: Anatomy-Based Targetless Actions

Actions that require the actor to have specific anatomy:

**Example Action:**
```json
{
  "id": "seduction:squeeze_breasts_draw_attention",
  "targets": "none",
  "prerequisites": [
    { "logic": { "hasPartOfType": ["actor", "breast"] } }
  ]
}
```

**Test Pattern:**
```javascript
it('should evaluate anatomy prerequisites for targetless actions', async () => {
  const actor = fixture.createEntity({
    id: 'actor-1',
    components: {
      'core:actor': {},
      'anatomy:body': {
        parts: {
          'breast-left': { type: 'breast', ... },
          'breast-right': { type: 'breast', ... }
        }
      }
    }
  });

  fixture.reset([actor]);

  const actions = await fixture.discoverActions(actor.id);
  expect(actions).toContainEqual(
    expect.objectContaining({ id: 'seduction:squeeze_breasts_draw_attention' })
  );
});
```

### Pattern 2: Component-Based Targetless Actions

Actions that check for forbidden or required components:

**Example Action:**
```json
{
  "id": "seduction:grab_crotch_draw_attention",
  "targets": "none",
  "forbidden_components": [
    { "type": "sex-penile-oral:receiving_blowjob" }
  ]
}
```

**Test Pattern:**
```javascript
it('should respect forbidden components for targetless actions', async () => {
  const actorWithForbidden = fixture.createEntity({
    id: 'actor-forbidden',
    components: {
      'core:actor': {},
      'sex-penile-oral:receiving_blowjob': {}
    }
  });

  fixture.reset([actorWithForbidden]);

  const actions = await fixture.discoverActions(actorWithForbidden.id);
  expect(actions).not.toContainEqual(
    expect.objectContaining({ id: 'seduction:grab_crotch_draw_attention' })
  );
});
```

### Pattern 3: Composite Prerequisites

Targetless actions with multiple AND/OR prerequisites:

**Test Pattern:**
```javascript
it('should evaluate composite prerequisites for targetless actions', async () => {
  const actor = fixture.createEntity({
    id: 'actor-composite',
    components: {
      'core:actor': {},
      'anatomy:body': { parts: { 'breast': { type: 'breast', ... } } },
      'positioning:standing': {}
    }
  });

  const prerequisites = [
    { logic: { hasPartOfType: ['actor', 'breast'] } },
    { logic: { component_present: ['actor', 'positioning:standing'] } }
  ];

  const result = await fixture.evaluatePrerequisites(
    prerequisites,
    actor.id,
    null // No target
  );

  expect(result).toBe(true);
});
```

## Test Utilities

### Prerequisite Context Validation

The test environment automatically creates actor context even when `targets: "none"`:

```javascript
// Internal behavior (systemLogicTestEnv.js)
const buildPrerequisiteContextOverride = (resolvedTargets, actorId) => {
  const override = { targets: {} };

  // Always add actor context if actorId is provided
  if (actorId) {
    override.actor = createResolvedTarget(actorId);
  }

  // Return override if we have actor context, even if no targets
  if (override.actor || hasTargets) {
    return override;
  }

  return null;
};
```

### Discovery and Execution

Execute targetless actions with `null` or omitted target:

```javascript
// Discovery
const actions = await fixture.discoverActions(actor.id);

// Execution
await fixture.executeAction(actor.id, null); // Explicit null
// OR
await fixture.executeAction(actor.id);       // Omitted
```

## Common Mistakes

### ❌ Assuming Targetless Actions Can't Have Prerequisites

**Wrong:**
```javascript
// Assuming no prerequisites can be evaluated
const action = {
  targets: 'none',
  prerequisites: [] // ❌ Empty because "no targets"
};
```

**Correct:**
```javascript
// Prerequisites can reference actor
const action = {
  targets: 'none',
  prerequisites: [
    { logic: { hasPartOfType: ['actor', 'breast'] } }
  ]
};
```

### ❌ Not Providing Actor ID to executeAction

**Wrong:**
```javascript
await fixture.executeAction(null, null); // ❌ No actor
```

**Correct:**
```javascript
await fixture.executeAction(actor.id, null); // ✅ Actor provided
```

### ❌ Testing Only With Targets

**Wrong:**
```javascript
// Only testing actions with targets
it('should test action', async () => {
  await fixture.executeAction(actor.id, target.id);
});
```

**Correct:**
```javascript
// Test both targeted and targetless variants
describe('Action behavior', () => {
  it('should work with targets', async () => {
    await fixture.executeAction(actor.id, target.id);
  });

  it('should work without targets (targetless)', async () => {
    await fixture.executeAction(actor.id, null);
  });
});
```

## References

- **Test Examples:**
  - `tests/unit/anatomy/targetlessActionPrerequisites.test.js`
  - `tests/integration/anatomy/targetlessActionWorkflow.test.js`
- **Real-World Actions:**
  - `data/mods/seduction/actions/squeeze_breasts_draw_attention.action.json`
  - `data/mods/seduction/actions/grab_crotch_draw_attention.action.json`
- **Report:** `reports/anatomy-prerequisite-test-fixes-2025-01.md` (lines 136-162)
```

### Step 5: Update Anatomy Testing Guide

**File:** `docs/testing/anatomy-testing-guide.md` (add section)

```markdown
## Testing Targetless Actions with Anatomy Prerequisites

Actions with `targets: "none"` can still evaluate prerequisites that reference the actor's anatomy or components. The test environment automatically creates actor context for prerequisite evaluation even when no targets are present.

### Quick Example

```javascript
it('should evaluate anatomy prerequisites for targetless action', async () => {
  const actor = fixture.createEntity({
    id: 'actor-1',
    components: {
      'anatomy:body': {
        parts: { 'breast': { type: 'breast', ... } }
      }
    }
  });

  const actions = await fixture.discoverActions(actor.id);
  expect(actions).toContainEqual(
    expect.objectContaining({ id: 'seduction:squeeze_breasts_draw_attention' })
  );
});
```

For complete patterns, see [Targetless Action Patterns](./targetless-action-patterns.md).
```

## Acceptance Criteria

- [ ] Unit test suite created for targetless action prerequisites (`targetlessActionPrerequisites.test.js`)
- [ ] Integration test suite created for full workflows (`targetlessActionWorkflow.test.js`)
- [ ] Tests cover:
  - Actor-based anatomy prerequisites (hasPartOfType)
  - Component-based prerequisites (forbidden_components, required_components)
  - Composite prerequisites (AND/OR logic)
  - Prerequisite context creation validation
- [ ] Enhanced assertions added to `buildPrerequisiteContextOverride` with diagnostic logging
- [ ] Pattern documentation created at `docs/testing/targetless-action-patterns.md`
- [ ] Anatomy testing guide updated with targetless action section
- [ ] All tests pass (100% pass rate)
- [ ] Test coverage for targetless actions ≥ 80%

## Implementation Notes

**Key Design Decisions:**

1. **Assertion Placement**: Add diagnostic assertions in `buildPrerequisiteContextOverride` rather than throwing errors to avoid breaking existing tests
2. **Test Coverage**: Focus on anatomy-based prerequisites since those were the failing cases
3. **Documentation Focus**: Provide clear patterns to prevent future regressions

**Testing Strategy:**

1. Unit tests validate prerequisite evaluation logic in isolation
2. Integration tests validate full discovery → execution workflow
3. Assertions in test utilities provide runtime validation

**Common Edge Cases:**

1. Actor with required anatomy → Action discovered ✅
2. Actor missing required anatomy → Action not discovered ✅
3. Actor with forbidden component → Action not discovered ✅
4. Composite prerequisites (AND/OR) → Correct evaluation ✅
5. Null actor ID → No context created (null returned) ✅

## Dependencies

**Requires:**
- Anatomy prerequisite test fixes (completed)
- ModTestFixture anatomy scope registration (completed)

**Blocks:**
- None (standalone improvement)

## References

- **Report Section:** Suggestion #2 - Add Validation for Targetless Action Prerequisites
- **Report Lines:** 136-162
- **Fixed Issue:** `systemLogicTestEnv.js:1377-1402` - buildPrerequisiteContextOverride returning null
- **Example Actions:**
  - `seduction:squeeze_breasts_draw_attention`
  - `seduction:grab_crotch_draw_attention`
  - `seduction:stroke_penis_to_draw_attention`
