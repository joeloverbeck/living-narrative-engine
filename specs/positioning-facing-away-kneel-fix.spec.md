# Specification: Fix Positioning Action Availability When Facing Away

## 1. Problem Statement

### Current Behavior

When an actor has turned around (their back is facing another entity), the `positioning:kneel_before` action is still available for targets that are behind the actor. This creates an illogical situation where an actor can kneel before someone they have their back turned to.

### Root Cause Analysis

The `positioning:kneel_before` action uses the scope `core:actors_in_location`, which includes all actors in the same location without considering facing direction. The scope doesn't filter out entities that the actor is currently facing away from.

### Components Involved

- **Actions**: `physical-control:turn_around`, `positioning:kneel_before`
- **Components**: `positioning:facing_away` (tracks entity IDs the actor is facing away from)
- **Scopes**: `core:actors_in_location` (used by kneel_before)
- **Existing Conditions**:
  - `positioning:entity-in-facing-away` (checks if entity is in actor's facing_away_from array)
  - `positioning:entity-not-in-facing-away` (checks if actor is not in entity's facing_away_from array)
  - `positioning:actor-is-behind-entity`
  - `positioning:both-actors-facing-each-other`

## 2. Proposed Solution

### Solution Architecture

Use the existing `positioning:entity-in-facing-away` condition to create a new scope that filters actors based on facing direction.

### Recommended Approach: New Scope

Create a new scope that extends `core:actors_in_location` with facing awareness:

```
positioning:actors_in_location_facing := core:actors_in_location[{
  "!": {
    "condition_ref": "positioning:entity-in-facing-away"
  }
}]
```

This scope will filter out any actors that the current actor is facing away from, ensuring that actions requiring face-to-face interaction are only available for appropriate targets.

## 3. Implementation Details

### 3.1 New Scope Definition

Create `data/mods/positioning/scopes/actors_in_location_facing.scope`:

```
// Scope for actors in the same location that the actor is not facing away from
// Used by actions that require the actor to be facing or at least not have their back turned
positioning:actors_in_location_facing := core:actors_in_location[{
  "!": {
    "condition_ref": "positioning:entity-in-facing-away"
  }
}]
```

### 3.2 Action Update

Update `data/mods/positioning/actions/kneel_before.action.json`:

```json
{
  "targets": {
    "primary": {
      "scope": "positioning:actors_in_location_facing",
      "placeholder": "actor",
      "description": "The actor to kneel before"
    }
  }
}
```

## 4. Testing Strategy

### 4.1 Integration Tests

#### Test: Scope Resolution with Facing Awareness

File: `tests/integration/mods/positioning/actors_in_location_facing_scope.test.js`

```javascript
describe('positioning:actors_in_location_facing scope', () => {
  it('should exclude actors that the current actor is facing away from', () => {
    // Setup actors in same location
    const actor1 = createActor('test:actor1', { location: 'test:location1' });
    const actor2 = createActor('test:actor2', { location: 'test:location1' });
    const actor3 = createActor('test:actor3', { location: 'test:location1' });

    // Actor1 is facing away from actor2
    actor1.components['positioning:facing_away'] = {
      facing_away_from: ['test:actor2'],
    };

    // Resolve scope for actor1
    const results = resolveScope('positioning:actors_in_location_facing', {
      actor: actor1,
    });

    // Should include actor3 but not actor2
    expect(results).toContain('test:actor3');
    expect(results).not.toContain('test:actor2');
  });

  it('should include all actors when no facing_away component exists', () => {
    const actor1 = createActor('test:actor1', { location: 'test:location1' });
    const actor2 = createActor('test:actor2', { location: 'test:location1' });

    const results = resolveScope('positioning:actors_in_location_facing', {
      actor: actor1,
    });

    expect(results).toContain('test:actor2');
  });
});
```

#### Test: Turn Around and Kneel Interaction

File: `tests/integration/mods/positioning/turnAroundKneelInteraction.test.js`

```javascript
describe('Turn around and kneel before interaction', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
    // Setup two actors in same location
    testBed.createActor('test:actor1', { location: 'test:location1' });
    testBed.createActor('test:actor2', { location: 'test:location1' });
  });

  it('should not allow kneeling before an actor when facing away', async () => {
    // 1. Actor1 turns actor2 around
    await testBed.performAction('physical-control:turn_around', {
      actor: 'test:actor1',
      target: 'test:actor2',
    });

    // 2. Verify actor2 has facing_away component
    const actor2 = testBed.getEntity('test:actor2');
    expect(actor2.components['positioning:facing_away']).toEqual({
      facing_away_from: ['test:actor1'],
    });

    // 3. Query available actions for actor2
    const availableActions = await testBed.getAvailableActions('test:actor2');

    // 4. Verify kneel_before is NOT available for actor1
    const kneelAction = availableActions.find(
      (a) => a.id === 'positioning:kneel_before' && a.target === 'test:actor1'
    );
    expect(kneelAction).toBeUndefined();
  });

  it('should allow kneeling after turning back to face', async () => {
    // 1. Actor1 turns actor2 around
    await testBed.performAction('physical-control:turn_around', {
      actor: 'test:actor1',
      target: 'test:actor2',
    });

    // 2. Actor1 turns actor2 back to face them
    await testBed.performAction('physical-control:turn_around', {
      actor: 'test:actor1',
      target: 'test:actor2',
    });

    // 3. Verify actor2 no longer has facing_away component
    const actor2 = testBed.getEntity('test:actor2');
    expect(actor2.components['positioning:facing_away']).toBeUndefined();

    // 4. Query available actions for actor2
    const availableActions = await testBed.getAvailableActions('test:actor2');

    // 5. Verify kneel_before IS available for actor1
    const kneelAction = availableActions.find(
      (a) => a.id === 'positioning:kneel_before' && a.target === 'test:actor1'
    );
    expect(kneelAction).toBeDefined();
  });
});
```

### 4.2 End-to-End Tests

#### Test: Complete User Flow

File: `tests/e2e/mods/positioning/facingAwareActions.e2e.test.js`

```javascript
describe('Facing-aware action availability E2E', () => {
  it('should respect facing direction for position-dependent actions', async () => {
    // Setup game with two actors
    const game = await setupGame({
      actors: ['test:player', 'test:npc'],
      location: 'test:throne_room',
    });

    // Player turns NPC around
    await game.performPlayerAction('physical-control:turn_around', 'test:npc');

    // Get available actions for NPC
    const npcActions = await game.getActorActions('test:npc');

    // Verify positioning actions respect facing
    expect(npcActions).toMatchObject({
      'positioning:kneel_before': {
        availableTargets: expect.not.arrayContaining(['test:player']),
      },
      'physical-control:turn_around': {
        availableTargets: expect.arrayContaining(['test:player']),
      },
    });

    // Player turns NPC back
    await game.performPlayerAction('physical-control:turn_around', 'test:npc');

    // Re-check available actions
    const updatedActions = await game.getActorActions('test:npc');

    // Now kneeling should be available
    expect(updatedActions).toMatchObject({
      'positioning:kneel_before': {
        availableTargets: expect.arrayContaining(['test:player']),
      },
    });
  });
});
```

## 5. Migration Considerations

### Backward Compatibility

- The change is **non-breaking** for existing saves as it only restricts action availability
- No data migration required as the facing_away component already exists
- Existing mods that don't use positioning components won't be affected

### Performance Impact

- Minimal: One additional condition check during action discovery
- The condition uses simple array inclusion check which is O(n) where n is typically 1-2

## 6. Documentation Updates

### Component Documentation

Update `positioning:facing_away` component documentation to clarify its impact on action availability:

```markdown
## positioning:facing_away Component

Tracks which actors this entity is facing away from. This component affects action availability:

- Actions requiring face-to-face interaction will be unavailable for entities in the `facing_away_from` array
- Currently affects: `kneel_before`, and potentially other positioning-aware actions
```

### Action Documentation

Update action descriptions to clarify facing requirements:

```json
{
  "id": "positioning:kneel_before",
  "description": "Kneel before another actor as a sign of respect. Requires you to be facing the target."
}
```

## 7. Implementation Checklist

- [ ] Create `actors_in_location_facing.scope` file
- [ ] Update `kneel_before.action.json` to use new scope
- [ ] Add integration tests for scope resolution
- [ ] Add integration tests for turn_around/kneel_before interaction
- [ ] Add E2E tests for complete user flow
- [ ] Update component documentation
- [ ] Update action descriptions
- [ ] Update mod manifest with new files
- [ ] Run full test suite to verify no regressions

## 8. Alternative Considerations

### Alternative 1: Component-Based Restriction

Instead of scope-based filtering, add `forbidden_components` to the action:

```json
"forbidden_components": {
  "actor": ["positioning:facing_away"]
}
```

**Pros**: Simpler, no new scope needed
**Cons**: Would prevent actor from kneeling if facing away from ANYONE, not just the target

### Alternative 2: Rule-Based Validation

Keep current scope but add validation in the rule handler:

```json
{
  "type": "IF",
  "parameters": {
    "condition": {
      "in": [
        { "var": "event.payload.targetId" },
        { "var": "actor.components.positioning:facing_away.facing_away_from" }
      ]
    },
    "then_actions": [
      {
        "type": "FAIL_ACTION",
        "parameters": {
          "reason": "Cannot kneel to someone you're facing away from"
        }
      }
    ]
  }
}
```

**Pros**: Clear error messaging
**Cons**: Action still appears available in UI, poor UX

## 9. Acceptance Criteria

1. ✓ Actor cannot select kneel_before action for entities they are facing away from
2. ✓ Turning around properly updates available actions
3. ✓ Turning back to face re-enables appropriate actions
4. ✓ All existing tests continue to pass
5. ✓ New tests provide >90% coverage of the new logic
6. ✓ No performance degradation in action discovery
7. ✓ Clear documentation of facing-aware behavior

## 10. Risk Assessment

### Low Risk

- Isolated change to specific action availability
- No data structure modifications
- Reversible through configuration change

### Mitigation

- Comprehensive test coverage before deployment
- Feature flag option if needed for gradual rollout
- Clear logging of action filtering for debugging

---

**Status**: Ready for Implementation
**Priority**: Medium (Gameplay Logic Issue)
**Estimated Effort**: 4-6 hours
**Dependencies**: None
