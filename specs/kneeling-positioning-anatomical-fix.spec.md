# Specification: Fix Anatomical Positioning Issue with Kneeling and Sexual Actions

## 1. Problem Statement

### Current Behavior

When an actor (Actor A) uses the `positioning:kneel_before` action to kneel before another actor (Actor B), the game correctly adds the `positioning:kneeling_before` component to Actor A. However, sexual/caressing actions like `sex:fondle_penis` and `caressing:fondle_ass` are incorrectly available for Actor B (the standing actor) to perform on Actor A (the kneeling actor), even though these actions are anatomically impossible from this positioning configuration.

### Why This is a Problem

**Anatomical Reality:**
- When Actor A kneels before Actor B:
  - Actor A is in a lowered position (on knees)
  - Actor B is standing upright
  - Actor B's hands are at standing height
  - Actor A's genitals/posterior are at kneeling height (below Actor B's standing hand reach)

**Impossible Actions:**
- Actor B (standing) **cannot** fondle Actor A's (kneeling) penis - it's too low to reach comfortably
- Actor B (standing) **cannot** fondle Actor A's (kneeling) ass - it's too low and behind

### Root Cause Analysis

The scopes used by these sexual/caressing actions:
- `sex:actors_with_penis_facing_each_other` - Only checks facing direction via `entity-not-in-facing-away` condition
- `caressing:actors_with_ass_cheeks_facing_each_other_or_behind_target` - Only checks facing direction or behind positioning

**Missing Validation:**
- Neither scope checks for vertical positioning differences created by kneeling
- The `positioning:kneeling_before` component exists but is not considered by these scopes

### Components Involved

- **Actions:**
  - `positioning:kneel_before` - Establishes kneeling position
  - `sex:fondle_penis` - Affected sexual action
  - `caressing:fondle_ass` - Affected caressing action

- **Components:**
  - `positioning:kneeling_before` - Tracks which entity the actor is kneeling before
  - `positioning:closeness` - Required for intimacy actions

- **Scopes:**
  - `sex:actors_with_penis_facing_each_other` - Needs kneeling awareness
  - `caressing:actors_with_ass_cheeks_facing_each_other_or_behind_target` - Needs kneeling awareness

- **Existing Conditions:**
  - `positioning:entity-not-in-facing-away` - Checks if entity is not facing away from actor
  - `positioning:both-actors-facing-each-other` - Checks if neither actor is facing away

## 2. Proposed Solution

### Solution Architecture

Create new conditions that detect incompatible kneeling states, then integrate them into the existing sexual/caressing action scopes to exclude anatomically impossible target selections.

### New Conditions Required

#### Condition 1: `positioning:entity-kneeling-before-actor`

**Purpose:** Checks if the target entity is currently kneeling before the current actor

**Logic:**
```json
{
  "in": [
    { "var": "actor.id" },
    { "var": "entity.components.positioning:kneeling_before.entityId" }
  ]
}
```

**Semantic Meaning:** "Is the target (entity) kneeling before me (actor)?"

#### Condition 2: `positioning:actor-kneeling-before-entity`

**Purpose:** Checks if the current actor is kneeling before the target entity

**Logic:**
```json
{
  "in": [
    { "var": "entity.id" },
    { "var": "actor.components.positioning:kneeling_before.entityId" }
  ]
}
```

**Semantic Meaning:** "Am I (actor) kneeling before the target (entity)?"

### Scope Updates

#### Update 1: `sex:actors_with_penis_facing_each_other.scope`

**Current Logic:**
```
sex:actors_with_penis_facing_each_other := actor.components.positioning:closeness.partners[][{
  "and": [
    {"hasPartOfType": [".", "penis"]},
    {"condition_ref": "positioning:entity-not-in-facing-away"},
    {"not": {"isSocketCovered": [".", "penis"]}}
  ]
}]
```

**Updated Logic:**
```
sex:actors_with_penis_facing_each_other := actor.components.positioning:closeness.partners[][{
  "and": [
    {"hasPartOfType": [".", "penis"]},
    {"condition_ref": "positioning:entity-not-in-facing-away"},
    {"not": {"isSocketCovered": [".", "penis"]}},
    {"!": {"condition_ref": "positioning:entity-kneeling-before-actor"}},
    {"!": {"condition_ref": "positioning:actor-kneeling-before-entity"}}
  ]
}]
```

**Explanation:**
- Adds two exclusion checks
- Excludes targets who are kneeling before the actor (can't reach them)
- Excludes targets if the actor is kneeling before them (can't reach them)

#### Update 2: `caressing:actors_with_ass_cheeks_facing_each_other_or_behind_target.scope`

**Current Logic:**
```
caressing:actors_with_ass_cheeks_facing_each_other_or_behind_target := actor.components.positioning:closeness.partners[][{
  "and": [
    {"hasPartOfType": [".", "ass_cheek"]},
    {
      "or": [
        {"condition_ref": "positioning:both-actors-facing-each-other"},
        {"condition_ref": "positioning:actor-is-behind-entity"}
      ]
    }
  ]
}]
```

**Updated Logic:**
```
caressing:actors_with_ass_cheeks_facing_each_other_or_behind_target := actor.components.positioning:closeness.partners[][{
  "and": [
    {"hasPartOfType": [".", "ass_cheek"]},
    {
      "or": [
        {"condition_ref": "positioning:both-actors-facing-each-other"},
        {"condition_ref": "positioning:actor-is-behind-entity"}
      ]
    },
    {"!": {"condition_ref": "positioning:entity-kneeling-before-actor"}},
    {"!": {"condition_ref": "positioning:actor-kneeling-before-entity"}}
  ]
}]
```

**Explanation:**
- Same exclusion logic as penis scope
- Prevents fondling ass when incompatible kneeling positions exist

## 3. Implementation Details

### 3.1 Create Condition: `entity-kneeling-before-actor.condition.json`

**File:** `data/mods/positioning/conditions/entity-kneeling-before-actor.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:entity-kneeling-before-actor",
  "description": "Checks if the entity is currently kneeling before the actor (i.e., actor's ID is in entity's kneeling_before.entityId).",
  "logic": {
    "==": [
      {
        "var": "entity.components.positioning:kneeling_before.entityId"
      },
      {
        "var": "actor.id"
      }
    ]
  }
}
```

### 3.2 Create Condition: `actor-kneeling-before-entity.condition.json`

**File:** `data/mods/positioning/conditions/actor-kneeling-before-entity.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:actor-kneeling-before-entity",
  "description": "Checks if the actor is currently kneeling before the entity (i.e., entity's ID is in actor's kneeling_before.entityId).",
  "logic": {
    "==": [
      {
        "var": "actor.components.positioning:kneeling_before.entityId"
      },
      {
        "var": "entity.id"
      }
    ]
  }
}
```

### 3.3 Update Scope: `actors_with_penis_facing_each_other.scope`

**File:** `data/mods/sex/scopes/actors_with_penis_facing_each_other.scope`

```
// Scope for actors in closeness who have an uncovered penis, are facing each other, and don't have incompatible kneeling positions
// Used by actions that require exposed penis anatomy, face-to-face interaction, and compatible vertical positioning
sex:actors_with_penis_facing_each_other := actor.components.positioning:closeness.partners[][{
  "and": [
    {"hasPartOfType": [".", "penis"]},
    {"condition_ref": "positioning:entity-not-in-facing-away"},
    {"not": {"isSocketCovered": [".", "penis"]}},
    {"!": {"condition_ref": "positioning:entity-kneeling-before-actor"}},
    {"!": {"condition_ref": "positioning:actor-kneeling-before-entity"}}
  ]
}]
```

### 3.4 Update Scope: `actors_with_ass_cheeks_facing_each_other_or_behind_target.scope`

**File:** `data/mods/caressing/scopes/actors_with_ass_cheeks_facing_each_other_or_behind_target.scope`

```
// Scope for actors in closeness who have ass cheeks, are either facing each other OR actor is behind the target, and don't have incompatible kneeling positions
// Used by actions that require ass anatomy, can work from either face-to-face or behind positions, and need compatible vertical positioning
caressing:actors_with_ass_cheeks_facing_each_other_or_behind_target := actor.components.positioning:closeness.partners[][{
  "and": [
    {"hasPartOfType": [".", "ass_cheek"]},
    {
      "or": [
        {"condition_ref": "positioning:both-actors-facing-each-other"},
        {"condition_ref": "positioning:actor-is-behind-entity"}
      ]
    },
    {"!": {"condition_ref": "positioning:entity-kneeling-before-actor"}},
    {"!": {"condition_ref": "positioning:actor-kneeling-before-entity"}}
  ]
}]
```

## 4. Testing Strategy

### 4.1 Integration Test Structure

**File:** `tests/integration/mods/positioning/kneeling_position_sexual_action_restrictions.integration.test.js`

**Test Suite Organization:**

```javascript
describe('Kneeling Position Sexual Action Restrictions', () => {
  describe('Fondle Penis Action Restrictions', () => {
    it('should NOT be available when target is kneeling before actor', () => {
      // Setup: Actor1 and Actor2 in closeness, both have penis anatomy
      // Action: Actor2 kneels before Actor1
      // Verify: Actor1 cannot fondle Actor2's penis
    });

    it('should NOT be available when actor is kneeling before target', () => {
      // Setup: Actor1 and Actor2 in closeness, both have penis anatomy
      // Action: Actor1 kneels before Actor2
      // Verify: Actor1 cannot fondle Actor2's penis
    });

    it('should BE available when neither is kneeling', () => {
      // Setup: Actor1 and Actor2 in closeness, both have penis anatomy
      // Verify: Both actors can fondle each other's penis (control test)
    });

    it('should BE available again after standing up', () => {
      // Setup: Actor1 kneels before Actor2, then stands up
      // Verify: Actions become available again after standing
    });
  });

  describe('Fondle Ass Action Restrictions', () => {
    it('should NOT be available when target is kneeling before actor', () => {
      // Setup: Actor1 and Actor2 in closeness, both have ass anatomy
      // Action: Actor2 kneels before Actor1
      // Verify: Actor1 cannot fondle Actor2's ass
    });

    it('should NOT be available when actor is kneeling before target', () => {
      // Setup: Actor1 and Actor2 in closeness, both have ass anatomy
      // Action: Actor1 kneels before Actor2
      // Verify: Actor1 cannot fondle Actor2's ass
    });

    it('should BE available when neither is kneeling', () => {
      // Setup: Actor1 and Actor2 in closeness, both have ass anatomy
      // Verify: Both actors can fondle each other's ass (control test)
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple actors with mixed kneeling states', () => {
      // Setup: Actor1, Actor2, Actor3 all in closeness
      // Action: Actor2 kneels before Actor1
      // Verify: Actor1 can fondle Actor3 but not Actor2
      // Verify: Actor3 can fondle both Actor1 and Actor2
    });
  });
});
```

### 4.2 Test Implementation Requirements

Each test should:
1. Set up actors with appropriate anatomy components (penis, ass_cheek)
2. Ensure actors have `positioning:closeness` with each other
3. Use `ActionDiscoveryService.getValidActions()` to query available actions
4. Verify presence or absence of specific action-target combinations
5. Clean up components and entity state after each test

### 4.3 Reproduction Test Pattern

```javascript
it('should reproduce the original issue and validate the fix', async () => {
  // ARRANGE: Set up two actors in closeness with penis anatomy
  const actor1 = createActorWithPenis('test:actor1', location);
  const actor2 = createActorWithPenis('test:actor2', location);
  establishCloseness(actor1, actor2);

  // ACT: Actor2 kneels before Actor1
  await performAction('positioning:kneel_before', {
    actor: actor2.id,
    target: actor1.id,
  });

  // ASSERT: Verify kneeling component exists
  expect(actor2.components['positioning:kneeling_before']).toEqual({
    entityId: 'test:actor1',
  });

  // ACT: Query available actions for Actor1 (standing)
  const actor1Actions = await actionDiscovery.getValidActions(actor1);

  // ASSERT: Verify fondle_penis is NOT available for Actor2 (kneeling)
  const fondlePenisActions = actor1Actions.actions.filter(
    (a) =>
      a.id === 'sex:fondle_penis' && a.params?.targetId === 'test:actor2'
  );

  expect(fondlePenisActions).toHaveLength(0);

  // ASSERT: Verify fondle_ass is NOT available for Actor2 (kneeling)
  const fondleAssActions = actor1Actions.actions.filter(
    (a) =>
      a.id === 'caressing:fondle_ass' && a.params?.targetId === 'test:actor2'
  );

  expect(fondleAssActions).toHaveLength(0);
});
```

## 5. Migration Considerations

### Backward Compatibility

- **Non-Breaking Change:** Only restricts action availability, doesn't modify data structures
- **No Data Migration Required:** `positioning:kneeling_before` component already exists
- **Existing Saves:** Will immediately benefit from more realistic action restrictions
- **Existing Mods:** Unaffected unless they depend on the buggy behavior

### Performance Impact

- **Minimal:** Two additional condition checks during action discovery
- **Scope Resolution:** Each condition is a simple property equality check (O(1))
- **Action Discovery:** Negligible overhead as conditions are evaluated lazily

## 6. Documentation Updates

### Condition Documentation

Add to positioning mod documentation:

```markdown
## Kneeling Position Conditions

### positioning:entity-kneeling-before-actor

Checks if the target entity is currently kneeling before the current actor. This condition is used to prevent actions that would be anatomically impossible when the target is in a lowered kneeling position.

**Use Case:** Excluding sexual/caressing actions when target is kneeling before actor.

### positioning:actor-kneeling-before-entity

Checks if the current actor is kneeling before the target entity. This condition prevents actions that would be anatomically impossible when the actor is in a lowered kneeling position.

**Use Case:** Excluding sexual/caressing actions when actor is kneeling before target.
```

### Scope Documentation

Update scope comments to clarify positioning requirements:

```markdown
## sex:actors_with_penis_facing_each_other

Filters actors in closeness who:
- Have an uncovered penis
- Are facing each other (not facing away)
- Have compatible vertical positioning (neither kneeling before the other)

Used by actions requiring face-to-face penis interaction at compatible heights.

## caressing:actors_with_ass_cheeks_facing_each_other_or_behind_target

Filters actors in closeness who:
- Have ass cheeks
- Are either facing each other OR actor is behind target
- Have compatible vertical positioning (neither kneeling before the other)

Used by actions requiring ass interaction at compatible heights.
```

## 7. Implementation Checklist

- [ ] Create `positioning:entity-kneeling-before-actor` condition file
- [ ] Create `positioning:actor-kneeling-before-entity` condition file
- [ ] Update `sex:actors_with_penis_facing_each_other.scope`
- [ ] Update `caressing:actors_with_ass_cheeks_facing_each_other_or_behind_target.scope`
- [ ] Create integration test file with comprehensive test coverage
- [ ] Add reproduction test for original issue
- [ ] Add positive control tests (actions available when not kneeling)
- [ ] Add edge case tests (multiple actors, mixed kneeling states)
- [ ] Run full test suite to verify no regressions
- [ ] Update positioning mod documentation
- [ ] Update scope documentation with positioning requirements
- [ ] Verify all tests pass

## 8. Alternative Considerations

### Alternative 1: Add Forbidden Components to Actions

**Approach:** Add `positioning:kneeling_before` to `forbidden_components` for both actions.

**Problem:** This would prevent actors from performing these actions on ANY target when they're kneeling, which is too restrictive. The issue is specifically about the relationship between two actors, not the absolute state of one.

### Alternative 2: Create New Scopes

**Approach:** Create entirely new scopes like `actors_with_penis_compatible_positioning`.

**Rejected Because:**
- Duplication of existing scope logic
- Less maintainable (two places to update for changes)
- Scope system supports composition via conditions (current approach)

### Alternative 3: Rule-Based Validation

**Approach:** Keep scopes as-is but add validation in rule handlers.

**Problem:**
- Actions would appear available in UI but fail when attempted
- Poor user experience
- Doesn't follow the pattern of using scopes for action availability

## 9. Acceptance Criteria

1. ✓ When Actor A kneels before Actor B, Actor B cannot select `sex:fondle_penis` targeting Actor A
2. ✓ When Actor A kneels before Actor B, Actor B cannot select `caressing:fondle_ass` targeting Actor A
3. ✓ When Actor A kneels before Actor B, Actor A cannot select these actions targeting Actor B
4. ✓ When neither actor is kneeling, actions are available normally (regression test)
5. ✓ When Actor A stands up after kneeling, actions become available again
6. ✓ All existing tests continue to pass
7. ✓ Integration test provides >90% coverage of new logic paths
8. ✓ Clear documentation of kneeling position restrictions
9. ✓ No performance degradation in action discovery benchmarks

## 10. Risk Assessment

### Low Risk

- **Isolated Change:** Only affects two specific action scopes
- **No Data Modification:** No changes to component schemas or saved data
- **Reversible:** Can revert scope changes easily if issues arise
- **Well-Tested:** Comprehensive test coverage before deployment

### Mitigation Strategies

- **Comprehensive Testing:** Full integration test suite covering all scenarios
- **Regression Testing:** Run entire test suite to catch unintended effects
- **Incremental Rollout:** Test changes in development environment first
- **Clear Documentation:** Document exact behavior for future maintenance
- **Version Control:** Easy rollback via git if unexpected issues occur

---

**Status:** Ready for Implementation
**Priority:** Medium (Gameplay Realism Issue)
**Estimated Effort:** 3-4 hours
**Dependencies:** None (uses existing conditions and component)
**Impact:** Improves anatomical realism and gameplay consistency
