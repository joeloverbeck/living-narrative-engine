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
