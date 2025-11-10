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

**Note**: This focuses on testing the prerequisite evaluation logic in isolation, not full action discovery which requires integration tests.

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';

describe('Targetless Actions - Prerequisite Evaluation', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'seduction',
      'seduction:squeeze_breasts_draw_attention'
    );
  });

  afterEach(() => {
    fixture.cleanup();
  });

  describe('Actor-based Prerequisites', () => {
    it('should discover action when actor has required anatomy (targets: "none")', () => {
      // Arrange - Create actor with breast anatomy using separate entities
      const actorId = 'actor-with-breasts';
      const torsoId = `${actorId}_torso`;
      const leftBreastId = `${actorId}_left_breast`;
      const rightBreastId = `${actorId}_right_breast`;

      const actor = new ModEntityBuilder(actorId)
        .withName('Test Actor')
        .asActor()
        .atLocation('test-room')
        .withLocationComponent('test-room')
        .withBody(torsoId) // anatomy:body references root part
        .build();

      // Body parts are separate entities with anatomy:part component
      const torso = new ModEntityBuilder(torsoId)
        .asBodyPart({
          parent: null, // Root part
          children: [leftBreastId, rightBreastId],
          subType: 'torso'
        })
        .build();

      const leftBreast = new ModEntityBuilder(leftBreastId)
        .asBodyPart({
          parent: torsoId,
          children: [],
          subType: 'breast' // hasPartOfType checks subType
        })
        .build();

      const rightBreast = new ModEntityBuilder(rightBreastId)
        .asBodyPart({
          parent: torsoId,
          children: [],
          subType: 'breast'
        })
        .build();

      // Create another actor at same location (required for hasOtherActorsAtLocation)
      const otherActor = new ModEntityBuilder('other-actor')
        .withName('Other Person')
        .asActor()
        .atLocation('test-room')
        .withLocationComponent('test-room')
        .build();

      fixture.reset([actor, torso, leftBreast, rightBreast, otherActor]);

      // Act
      const actions = fixture.discoverActions(actorId);

      // Assert
      expect(actions).toContainEqual(
        expect.objectContaining({
          id: 'seduction:squeeze_breasts_draw_attention'
        })
      );
    });

    it('should NOT discover action when actor lacks required anatomy', () => {
      // Arrange - Actor with torso but no breasts
      const actorId = 'actor-no-breasts';
      const torsoId = `${actorId}_torso`;

      const actor = new ModEntityBuilder(actorId)
        .withName('Test Actor')
        .asActor()
        .atLocation('test-room')
        .withLocationComponent('test-room')
        .withBody(torsoId)
        .build();

      const torso = new ModEntityBuilder(torsoId)
        .asBodyPart({
          parent: null,
          children: [], // No breast parts
          subType: 'torso'
        })
        .build();

      const otherActor = new ModEntityBuilder('other-actor')
        .withName('Other Person')
        .asActor()
        .atLocation('test-room')
        .withLocationComponent('test-room')
        .build();

      fixture.reset([actor, torso, otherActor]);

      // Act
      const actions = fixture.discoverActions(actorId);

      // Assert - Action should not be discovered (missing breast anatomy)
      expect(actions).not.toContainEqual(
        expect.objectContaining({
          id: 'seduction:squeeze_breasts_draw_attention'
        })
      );
    });

    it('should respect clothing coverage prerequisites (isSocketCovered)', () => {
      // Arrange - Actor with breasts but both covered
      const actorId = 'actor-covered';
      const torsoId = `${actorId}_torso`;
      const leftBreastId = `${actorId}_left_breast`;
      const rightBreastId = `${actorId}_right_breast`;
      const shirtId = 'covering-shirt';

      const actor = new ModEntityBuilder(actorId)
        .withName('Covered Actor')
        .asActor()
        .atLocation('test-room')
        .withLocationComponent('test-room')
        .withBody(torsoId)
        .withComponent('clothing:equipment', {
          equipped: {
            torso_upper: { base: [shirtId] }
          }
        })
        .withComponent('clothing:slot_metadata', {
          slotMappings: {
            torso_upper: {
              coveredSockets: ['left_chest', 'right_chest'], // Both breasts covered
              allowedLayers: ['base', 'outer']
            }
          }
        })
        .build();

      const torso = new ModEntityBuilder(torsoId)
        .asBodyPart({ parent: null, children: [leftBreastId, rightBreastId], subType: 'torso' })
        .build();

      const leftBreast = new ModEntityBuilder(leftBreastId)
        .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
        .build();

      const rightBreast = new ModEntityBuilder(rightBreastId)
        .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
        .build();

      const shirt = new ModEntityBuilder(shirtId)
        .withName('Covering Shirt')
        .build();

      const otherActor = new ModEntityBuilder('other-actor')
        .withName('Other Person')
        .asActor()
        .atLocation('test-room')
        .withLocationComponent('test-room')
        .build();

      fixture.reset([actor, torso, leftBreast, rightBreast, shirt, otherActor]);

      // Act
      const actions = fixture.discoverActions(actorId);

      // Assert - Action requires at least one breast uncovered
      expect(actions).not.toContainEqual(
        expect.objectContaining({
          id: 'seduction:squeeze_breasts_draw_attention'
        })
      );
    });
  });

  describe('Forbidden Components', () => {
    it('should respect forbidden_components for targetless actions', () => {
      // Arrange - Actor with breasts but in forbidden state (hugging)
      const actorId = 'actor-forbidden';
      const torsoId = `${actorId}_torso`;
      const leftBreastId = `${actorId}_left_breast`;
      const rightBreastId = `${actorId}_right_breast`;

      const actor = new ModEntityBuilder(actorId)
        .withName('Hugging Actor')
        .asActor()
        .atLocation('test-room')
        .withLocationComponent('test-room')
        .withBody(torsoId)
        .withComponent('positioning:hugging', {
          embraced_entity_id: 'target-id',
          initiated: true
        })
        .build();

      const torso = new ModEntityBuilder(torsoId)
        .asBodyPart({ parent: null, children: [leftBreastId, rightBreastId], subType: 'torso' })
        .build();

      const leftBreast = new ModEntityBuilder(leftBreastId)
        .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
        .build();

      const rightBreast = new ModEntityBuilder(rightBreastId)
        .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
        .build();

      const otherActor = new ModEntityBuilder('other-actor')
        .withName('Other Person')
        .asActor()
        .atLocation('test-room')
        .withLocationComponent('test-room')
        .build();

      fixture.reset([actor, torso, leftBreast, rightBreast, otherActor]);

      // Act
      const actions = fixture.discoverActions(actorId);

      // Assert - Action forbidden when hugging (forbidden_components check)
      expect(actions).not.toContainEqual(
        expect.objectContaining({
          id: 'seduction:squeeze_breasts_draw_attention'
        })
      );
    });
  });
});
```

### Step 2: Create Integration Test Suite

**File:** `tests/integration/anatomy/targetlessActionWorkflow.test.js`

**Note**: Integration tests focus on end-to-end workflows including discovery, execution, and event verification.

```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';
import '../../common/mods/domainMatchers.js';

describe('Targetless Action Workflow - Anatomy Prerequisites', () => {
  let fixture;

  beforeEach(async () => {
    fixture = await ModTestFixture.forAction(
      'seduction',
      'seduction:squeeze_breasts_draw_attention'
    );
  });

  afterEach(() => {
    fixture.cleanup();
  });

  it('should complete full workflow: discovery → execution → effects', async () => {
    // Arrange - Actor with required anatomy (breasts uncovered)
    const actorId = 'seductive-actor';
    const torsoId = `${actorId}_torso`;
    const leftBreastId = `${actorId}_left_breast`;
    const rightBreastId = `${actorId}_right_breast`;

    const actor = new ModEntityBuilder(actorId)
      .withName('Seductive Actor')
      .asActor()
      .atLocation('test-room')
      .withLocationComponent('test-room')
      .withBody(torsoId)
      .build();

    const torso = new ModEntityBuilder(torsoId)
      .asBodyPart({ parent: null, children: [leftBreastId, rightBreastId], subType: 'torso' })
      .build();

    const leftBreast = new ModEntityBuilder(leftBreastId)
      .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
      .build();

    const rightBreast = new ModEntityBuilder(rightBreastId)
      .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
      .build();

    // Other actor required for hasOtherActorsAtLocation prerequisite
    const otherActor = new ModEntityBuilder('audience-member')
      .withName('Audience Member')
      .asActor()
      .atLocation('test-room')
      .withLocationComponent('test-room')
      .build();

    fixture.reset([actor, torso, leftBreast, rightBreast, otherActor]);

    // Act - Discover actions
    const discovered = fixture.discoverActions(actorId);

    // Assert - Action is discovered
    expect(discovered).toContainEqual(
      expect.objectContaining({
        id: 'seduction:squeeze_breasts_draw_attention'
      })
    );

    // Act - Execute action (targetless - no target ID)
    await fixture.executeAction(actorId);

    // Assert - Action succeeded
    expect(fixture.events).toHaveActionSuccess();
  });

  it('should NOT discover when other actors prerequisite fails', () => {
    // Arrange - Actor with breasts but alone (no other actors at location)
    const actorId = 'lonely-actor';
    const torsoId = `${actorId}_torso`;
    const leftBreastId = `${actorId}_left_breast`;
    const rightBreastId = `${actorId}_right_breast`;

    const actor = new ModEntityBuilder(actorId)
      .withName('Lonely Actor')
      .asActor()
      .atLocation('empty-room')
      .withLocationComponent('empty-room')
      .withBody(torsoId)
      .build();

    const torso = new ModEntityBuilder(torsoId)
      .asBodyPart({ parent: null, children: [leftBreastId, rightBreastId], subType: 'torso' })
      .build();

    const leftBreast = new ModEntityBuilder(leftBreastId)
      .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
      .build();

    const rightBreast = new ModEntityBuilder(rightBreastId)
      .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
      .build();

    fixture.reset([actor, torso, leftBreast, rightBreast]);

    // Act
    const discovered = fixture.discoverActions(actorId);

    // Assert - Action requires other actors present (hasOtherActorsAtLocation fails)
    expect(discovered).not.toContainEqual(
      expect.objectContaining({
        id: 'seduction:squeeze_breasts_draw_attention'
      })
    );
  });
});
```

### Step 3: Create Pattern Documentation

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
it('should evaluate anatomy prerequisites for targetless actions', () => {
  // Anatomy is modeled as separate entities with anatomy:part components
  const actorId = 'actor-1';
  const torsoId = `${actorId}_torso`;
  const leftBreastId = `${actorId}_left_breast`;
  const rightBreastId = `${actorId}_right_breast`;

  const actor = new ModEntityBuilder(actorId)
    .asActor()
    .atLocation('test-room')
    .withLocationComponent('test-room')
    .withBody(torsoId) // Links to root anatomy part
    .build();

  const torso = new ModEntityBuilder(torsoId)
    .asBodyPart({ parent: null, children: [leftBreastId, rightBreastId], subType: 'torso' })
    .build();

  const leftBreast = new ModEntityBuilder(leftBreastId)
    .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
    .build();

  const rightBreast = new ModEntityBuilder(rightBreastId)
    .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
    .build();

  // Other actors required for hasOtherActorsAtLocation prerequisite
  const otherActor = new ModEntityBuilder('other-actor')
    .asActor()
    .atLocation('test-room')
    .withLocationComponent('test-room')
    .build();

  fixture.reset([actor, torso, leftBreast, rightBreast, otherActor]);

  const actions = fixture.discoverActions(actorId);
  expect(actions).toContainEqual(
    expect.objectContaining({ id: 'seduction:squeeze_breasts_draw_attention' })
  );
});
```

**Key Points:**
- Anatomy is NOT nested in `anatomy:body.parts` - parts are separate entities
- Use `ModEntityBuilder.asBodyPart({ subType: 'breast' })` to create body parts
- `hasPartOfType` operator checks the `subType` field in `anatomy:part` component
- `anatomy:body` component only contains `{ body: { root: 'torso-id' } }`

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
it('should respect forbidden components for targetless actions', () => {
  const actorId = 'actor-forbidden';
  const torsoId = `${actorId}_torso`;
  const breastId = `${actorId}_breast`;

  const actor = new ModEntityBuilder(actorId)
    .asActor()
    .atLocation('test-room')
    .withLocationComponent('test-room')
    .withBody(torsoId)
    .withComponent('positioning:hugging', { // Forbidden component
      embraced_entity_id: 'someone',
      initiated: true
    })
    .build();

  const torso = new ModEntityBuilder(torsoId)
    .asBodyPart({ parent: null, children: [breastId], subType: 'torso' })
    .build();

  const breast = new ModEntityBuilder(breastId)
    .asBodyPart({ parent: torsoId, children: [], subType: 'breast' })
    .build();

  const otherActor = new ModEntityBuilder('other-actor')
    .asActor()
    .atLocation('test-room')
    .withLocationComponent('test-room')
    .build();

  fixture.reset([actor, torso, breast, otherActor]);

  const actions = fixture.discoverActions(actorId);
  // Action should NOT be discovered due to forbidden positioning:hugging component
  expect(actions).not.toContainEqual(
    expect.objectContaining({ id: 'seduction:squeeze_breasts_draw_attention' })
  );
});
```

**Key Points:**
- `forbidden_components` is checked during action discovery
- Components are added using `ModEntityBuilder.withComponent(componentId, data)`
- Discovery pipeline automatically filters out actions with forbidden components present

## Test Utilities

### ModTestFixture

The `ModTestFixture` provides test helpers for action discovery and execution:

```javascript
// Create fixture for specific action
const fixture = await ModTestFixture.forAction('modId', 'modId:actionId');

// Build and reset entity state
const entities = [actor, ...bodyParts, ...otherActors];
fixture.reset(entities);

// Discovery (synchronous)
const actions = fixture.discoverActions(actorId);

// Execution (async) - for targetless actions, omit or pass null as target
await fixture.executeAction(actorId);        // Targetless (no target)
await fixture.executeAction(actorId, null);  // Explicit null
await fixture.executeAction(actorId, targetId); // With target
```

### ModEntityBuilder

The `ModEntityBuilder` provides fluent API for entity creation:

```javascript
// Create actor with anatomy
const actor = new ModEntityBuilder('actor-id')
  .withName('Actor Name')
  .asActor()
  .atLocation('location-id')
  .withLocationComponent('location-id')
  .withBody('torso-id') // Links to anatomy root
  .withComponent('component:id', { data })
  .build();

// Create body part
const part = new ModEntityBuilder('part-id')
  .asBodyPart({
    parent: 'parent-id',  // null for root
    children: ['child1-id', 'child2-id'],
    subType: 'breast'     // Type used by hasPartOfType
  })
  .build();
```

### Internal Prerequisite Handling

Prerequisites are evaluated internally during discovery. The `buildPrerequisiteContextOverride` function in `systemLogicTestEnv.js` creates context for prerequisite evaluation:

```javascript
// Internal function (systemLogicTestEnv.js:1288-1348)
// Always creates actor context if actorId provided, even for targetless actions
buildPrerequisiteContextOverride(resolvedTargets, actorId)
// Returns: { actor: {...}, targets: {...} } or null
```

**Key behaviors:**
- Actor context created even when `targets: "none"`
- Context includes actor entity and components for prerequisite evaluation
- Returns `null` only when both actorId and resolvedTargets are empty

## Common Mistakes

### ❌ Incorrect Anatomy Structure

**Wrong:**
```javascript
// Anatomy parts nested in anatomy:body component
const actor = new ModEntityBuilder('actor')
  .withComponent('anatomy:body', {
    parts: {
      'breast': { type: 'breast', name: 'left breast' } // ❌ Wrong structure
    }
  })
  .build();
```

**Correct:**
```javascript
// Anatomy parts are separate entities
const actor = new ModEntityBuilder('actor')
  .withBody('torso-id') // ✅ References root part entity
  .build();

const breast = new ModEntityBuilder('breast-id')
  .asBodyPart({ // ✅ Separate entity with anatomy:part component
    parent: 'torso-id',
    children: [],
    subType: 'breast' // ✅ Used by hasPartOfType operator
  })
  .build();
```

### ❌ Using Wrong Property Names

**Wrong:**
```javascript
.asBodyPart({
  parent: 'torso',
  children: [],
  type: 'breast' // ❌ Should be 'subType'
})
```

**Correct:**
```javascript
.asBodyPart({
  parent: 'torso',
  children: [],
  subType: 'breast' // ✅ Correct property name
})
```

### ❌ Forgetting Required Prerequisites

**Wrong:**
```javascript
// Testing action but missing hasOtherActorsAtLocation prerequisite
fixture.reset([actor, ...bodyParts]); // ❌ No other actors
const actions = fixture.discoverActions(actorId);
// Action won't be discovered - prerequisite fails silently
```

**Correct:**
```javascript
// Include entities needed to satisfy all prerequisites
const otherActor = new ModEntityBuilder('other')
  .asActor()
  .atLocation('same-room')
  .withLocationComponent('same-room')
  .build();

fixture.reset([actor, ...bodyParts, otherActor]); // ✅ Other actor present
const actions = fixture.discoverActions(actorId);
```

### ❌ Async/Await Confusion

**Wrong:**
```javascript
// discoverActions is synchronous, not async
const actions = await fixture.discoverActions(actor.id); // ❌ Unnecessary await
```

**Correct:**
```javascript
// Discovery is synchronous
const actions = fixture.discoverActions(actor.id); // ✅ No await

// Execution is async
await fixture.executeAction(actor.id); // ✅ Await needed
```

## References

- **Test Examples:**
  - `tests/integration/mods/seduction/squeeze_breasts_draw_attention_action_discovery.test.js` - Real implementation
- **Real-World Actions:**
  - `data/mods/seduction/actions/squeeze_breasts_draw_attention.action.json` (lines 12-34: prerequisites)
  - `data/mods/seduction/actions/grab_crotch_draw_attention.action.json`
  - `data/mods/seduction/actions/stroke_penis_to_draw_attention.action.json`
- **Production Code:**
  - `tests/common/mods/ModTestFixture.js` - Test fixture factory (lines 0-99: structure)
  - `tests/common/mods/ModEntityBuilder.js` - Entity builder (lines 375-406: anatomy methods)
  - `tests/common/engine/systemLogicTestEnv.js` - Test environment (lines 1288-1348: prerequisite context)
  - `src/logic/operators/hasPartOfTypeOperator.js` - Anatomy prerequisite operator
- **Documentation:**
  - `docs/anatomy/anatomy-system-guide.md` - Anatomy system architecture
  - `docs/anatomy/body-descriptors-complete.md` - Body descriptor registry (lines 1-14: anatomy:body schema)
  - `docs/testing/mod-testing-guide.md` - Mod testing patterns
- **Component Schema:**
  - `data/mods/anatomy/components/body.component.json` - anatomy:body structure (lines 13-104)
- **Report:** `reports/anatomy-prerequisite-test-fixes-2025-01.md` (lines 136-162)
```

### Step 4: Update Anatomy Testing Guide

**File:** `docs/testing/anatomy-testing-guide.md` (add section if it exists)

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

- [ ] Unit test suite created for targetless action prerequisites (`tests/unit/anatomy/targetlessActionPrerequisites.test.js`)
- [ ] Integration test suite created for full workflows (`tests/integration/anatomy/targetlessActionWorkflow.test.js`)
- [ ] Tests cover:
  - Actor-based anatomy prerequisites (hasPartOfType with anatomy:part entities)
  - Clothing coverage prerequisites (isSocketCovered)
  - Forbidden component filtering (forbidden_components check)
  - Multiple prerequisite evaluation (hasOtherActorsAtLocation)
- [ ] Tests use correct anatomy structure:
  - Body parts as separate entities with anatomy:part component
  - anatomy:body only references root part via `body.root`
  - hasPartOfType checks `subType` field in anatomy:part
  - ModEntityBuilder.asBodyPart() for part creation
- [ ] Pattern documentation created at `docs/testing/targetless-action-patterns.md`
- [ ] Pattern documentation includes correct anatomy entity structure examples
- [ ] All tests pass (100% pass rate)
- [ ] Test coverage for targetless action patterns ≥ 80%

## Implementation Notes

**Key Design Decisions:**

1. **Anatomy Structure**: Use separate entities for body parts, not nested objects in anatomy:body
2. **Test Coverage**: Focus on anatomy-based prerequisites using real action examples (squeeze_breasts_draw_attention)
3. **Documentation Focus**: Provide clear patterns with correct anatomy entity structure to prevent future regressions
4. **Test Utilities**: Leverage existing ModTestFixture and ModEntityBuilder without modifications

**Testing Strategy:**

1. Unit tests validate prerequisite-driven action discovery
2. Integration tests validate full discovery → execution → event workflow
3. Use real-world action definitions for authentic testing

**Anatomy System Architecture:**

- **anatomy:body** component: Contains `{ body: { root: 'entity-id' } }` - reference to root part
- **anatomy:part** component: Each body part is a separate entity with `{ parent, children, subType }`
- **hasPartOfType** operator: Queries `subType` field via BodyGraphService
- **Entity hierarchy**: Actor → anatomy:body → root part entity → child part entities

**Common Edge Cases:**

1. Actor with required anatomy (breasts) → Action discovered ✅
2. Actor missing required anatomy → Action not discovered ✅
3. Actor with forbidden component (hugging) → Action not discovered ✅
4. Actor with covered sockets → Action not discovered (isSocketCovered) ✅
5. Actor alone (no other actors) → Action not discovered (hasOtherActorsAtLocation) ✅

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
