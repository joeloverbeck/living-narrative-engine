# Specification: Seduction Actions - Require Other Actors Present

**Status**: Ready for Implementation
**Created**: 2025-11-09
**Priority**: High - Fixes LLM behavior issue

---

## Problem Statement

All actions in the `seduction` mod (`data/mods/seduction/actions/`) are designed to draw attention from other characters. However, they currently have **no validation** that other actors are present in the same location. This causes LLM players to use these actions when alone in a room, which breaks immersion and doesn't make narrative sense.

### Affected Actions

All 8 seduction mod actions are affected:

1. `seduction:brush_hair_back_coyly` - Brush hair to draw attention
2. `seduction:draw_attention_to_ass` - Draw attention to buttocks
3. `seduction:draw_attention_to_breasts` - Draw attention to breasts
4. `seduction:cross_legs_alluringly` - Cross legs to draw attention (requires sitting)
5. `seduction:stroke_penis_to_draw_attention` - Stroke bare penis to draw attention
6. `seduction:squeeze_breasts_draw_attention` - Squeeze bare breasts to draw attention
7. `seduction:stretch_sexily` - Stretch to draw attention
8. `seduction:grab_crotch_draw_attention` - Grab clothed crotch to draw attention

All actions have:
- `"targets": "none"` (self-targeting)
- Descriptions that mention "drawing attention" or similar language
- **No prerequisite checking for other actors**

---

## Solution Overview

Implement a new **custom JSON Logic operator** called `hasOtherActorsAtLocation` that can be used in action prerequisites to validate that other actors are present in the same location as the acting actor.

### Why a New Operator?

**Evaluated Alternatives**:

1. ❌ **Use existing scope in prerequisites**: Prerequisites use JSON Logic, which doesn't directly support scope resolution. Scopes are used in `targets`, not `prerequisites`.

2. ❌ **Check location components directly**: Would be complex and brittle, requiring manual JSON Logic to iterate through all entities and filter by location.

3. ✅ **New custom operator**: Clean, reusable, follows existing patterns (like `hasPartOfType`, `hasClothingInSlot`), and can be easily tested.

### Operator Behavior

```javascript
// Usage in action prerequisites:
{
  "logic": {
    "hasOtherActorsAtLocation": ["actor"]
  },
  "failure_message": "There is nobody here to draw attention from."
}
```

**Returns**:
- `true` if there are other actors (besides the acting actor) at the same location
- `false` if the actor is alone

**Implementation approach**:
- Get actor's `core:position` component to find their location
- Query all entities with `core:position` at that location
- Filter to only actors (entities with `core:actor` component)
- Exclude the acting actor from the results
- Return `true` if any results remain, `false` otherwise

---

## Implementation Requirements

### 1. Create New Operator

**File**: `src/logic/operators/hasOtherActorsAtLocationOperator.js`

**Base Class**: `BaseOperator` (or create a new base class for location-based operators)

**Dependencies**:
- `IEntityManager` - to query entities and components
- `ILogger` - for debugging

**Key Methods**:
- `constructor(dependencies)` - Initialize with entityManager and logger
- `evaluate(params, context)` - Main evaluation logic

**Pseudocode**:
```javascript
evaluate(params, context) {
  // 1. Resolve actor entity from params[0] (usually "actor")
  const actorId = resolveEntityPath(params[0], context);

  // 2. Get actor's location
  const actorPosition = entityManager.getComponentData(actorId, 'core:position');
  if (!actorPosition) return false;

  const locationId = actorPosition.locationId;

  // 3. Get all entities with core:position at that location
  const allEntities = entityManager.getAllEntities();
  const entitiesAtLocation = allEntities.filter(entity => {
    const position = entityManager.getComponentData(entity.id, 'core:position');
    return position && position.locationId === locationId;
  });

  // 4. Filter to actors only (have core:actor component)
  const actorsAtLocation = entitiesAtLocation.filter(entity =>
    entityManager.hasComponent(entity.id, 'core:actor')
  );

  // 5. Exclude the acting actor
  const otherActors = actorsAtLocation.filter(entity => entity.id !== actorId);

  // 6. Return true if any other actors exist
  return otherActors.length > 0;
}
```

**Reference Patterns**:
- `src/logic/operators/hasPartOfTypeOperator.js` - Similar operator structure
- `src/logic/operators/hasClothingInSlotOperator.js` - Parameter handling

---

### 2. Register Operator in DI System

**File**: `src/logic/jsonLogicCustomOperators.js`

**Changes Required**:

1. **Import the new operator**:
```javascript
import { HasOtherActorsAtLocationOperator } from './operators/hasOtherActorsAtLocationOperator.js';
```

2. **Instantiate in constructor** (around line 76-130):
```javascript
const hasOtherActorsAtLocationOp = new HasOtherActorsAtLocationOperator({
  entityManager: this.#entityManager,
  logger: this.#logger,
});
```

3. **Register the operation** (around line 131-243):
```javascript
// Register hasOtherActorsAtLocation operator
jsonLogicEvaluationService.addOperation(
  'hasOtherActorsAtLocation',
  function (entityPath) {
    // 'this' is the evaluation context
    return hasOtherActorsAtLocationOp.evaluate([entityPath], this);
  }
);
```

**Reference**: Lines 69-246 of `src/logic/jsonLogicCustomOperators.js`

---

### 3. Update All Seduction Actions

All 8 seduction actions need to add the new prerequisite.

**Pattern to Add**:
```json
{
  "logic": {
    "hasOtherActorsAtLocation": ["actor"]
  },
  "failure_message": "There is nobody here to draw attention from."
}
```

**Files to Update**:

1. `data/mods/seduction/actions/brush_hair_back_coyly.action.json`
   - Current prerequisites: `hasPartOfType` for hair
   - **Add**: `hasOtherActorsAtLocation` check

2. `data/mods/seduction/actions/draw_attention_to_ass.action.json`
   - Current prerequisites: `hasPartOfType` for ass_cheek, `hasClothingInSlot` for torso_lower
   - **Add**: `hasOtherActorsAtLocation` check

3. `data/mods/seduction/actions/draw_attention_to_breasts.action.json`
   - Current prerequisites: `hasPartOfType` for breast, `hasClothingInSlot` for torso_upper
   - **Add**: `hasOtherActorsAtLocation` check

4. `data/mods/seduction/actions/cross_legs_alluringly.action.json`
   - Current prerequisites: `hasPartOfType` for leg
   - **Add**: `hasOtherActorsAtLocation` check

5. `data/mods/seduction/actions/stroke_penis_to_draw_attention.action.json`
   - Current prerequisites: `hasPartOfType` for penis, `not isSocketCovered`
   - **Add**: `hasOtherActorsAtLocation` check

6. `data/mods/seduction/actions/squeeze_breasts_draw_attention.action.json`
   - Current prerequisites: `hasPartOfType` for breast, `or/not isSocketCovered`
   - **Add**: `hasOtherActorsAtLocation` check

7. `data/mods/seduction/actions/stretch_sexily.action.json`
   - Current prerequisites: **NONE** (empty array)
   - **Add**: `hasOtherActorsAtLocation` check (first prerequisite)

8. `data/mods/seduction/actions/grab_crotch_draw_attention.action.json`
   - Current prerequisites: `hasPartOfType` for penis, `hasClothingInSlot` for torso_lower
   - **Add**: `hasOtherActorsAtLocation` check

**Example Update** (for `brush_hair_back_coyly.action.json`):

**Before**:
```json
{
  "prerequisites": [
    {
      "logic": {
        "hasPartOfType": ["actor", "hair"]
      },
      "failure_message": "You need hair to perform this action."
    }
  ]
}
```

**After**:
```json
{
  "prerequisites": [
    {
      "logic": {
        "hasPartOfType": ["actor", "hair"]
      },
      "failure_message": "You need hair to perform this action."
    },
    {
      "logic": {
        "hasOtherActorsAtLocation": ["actor"]
      },
      "failure_message": "There is nobody here to draw attention from."
    }
  ]
}
```

---

## Testing Requirements

### Unit Tests

**File**: `tests/unit/logic/operators/hasOtherActorsAtLocationOperator.test.js`

**Test Coverage**:

1. **Basic Functionality**
   - Returns `true` when other actors are present
   - Returns `false` when actor is alone
   - Returns `false` when actor has no position component

2. **Edge Cases**
   - Multiple actors at location (should return `true`)
   - Only non-actor entities at location (should return `false`)
   - Actor in different location (should not count as "other")
   - No location entity exists (should return `false`)

3. **Dependency Validation**
   - Validates entityManager is provided
   - Validates logger is provided

**Example Test Structure**:
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { HasOtherActorsAtLocationOperator } from '../../../../src/logic/operators/hasOtherActorsAtLocationOperator.js';

describe('HasOtherActorsAtLocationOperator', () => {
  let operator;
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    mockEntityManager = {
      getComponentData: jest.fn(),
      getAllEntities: jest.fn(),
      hasComponent: jest.fn(),
    };

    mockLogger = {
      debug: jest.fn(),
      error: jest.fn(),
    };

    operator = new HasOtherActorsAtLocationOperator({
      entityManager: mockEntityManager,
      logger: mockLogger,
    });
  });

  describe('Basic Functionality', () => {
    it('should return true when other actors are at the same location', () => {
      // Setup: actor1 and actor2 both at location1
      // Assert: evaluate returns true
    });

    it('should return false when actor is alone at location', () => {
      // Setup: only actor1 at location1
      // Assert: evaluate returns false
    });
  });

  describe('Edge Cases', () => {
    it('should return false when only non-actor entities are present', () => {
      // Setup: actor1 and furniture1 at location1
      // Assert: evaluate returns false (furniture doesn't count)
    });

    it('should not count actors at different locations', () => {
      // Setup: actor1 at location1, actor2 at location2
      // Assert: evaluate returns false
    });
  });
});
```

**Reference**: `tests/unit/logic/operators/hasPartOfTypeOperator.test.js`

---

### Integration Tests - Operator Registration

**File**: `tests/integration/logic/customOperatorRegistration.test.js`

**Add Test**:
```javascript
it('should register hasOtherActorsAtLocation operator', () => {
  const result = jsonLogic.apply(
    { "hasOtherActorsAtLocation": ["actor"] },
    context
  );
  expect(typeof result).toBe('boolean');
});
```

**Reference**: Existing tests in `tests/integration/logic/customOperatorRegistration.test.js`

---

### Integration Tests - Seduction Actions

Update all existing seduction action tests to include scenarios for the new prerequisite.

**Files to Update**:

1. `tests/integration/mods/seduction/brush_hair_back_coyly_action_discovery.test.js`
2. `tests/integration/mods/seduction/draw_attention_to_ass_action_discovery.test.js`
3. `tests/integration/mods/seduction/draw_attention_to_breasts_action.test.js` (no discovery test exists)
4. `tests/integration/mods/seduction/cross_legs_alluringly_action_discovery.test.js`
5. `tests/integration/mods/seduction/stroke_penis_to_draw_attention_action_discovery.test.js`
6. `tests/integration/mods/seduction/squeeze_breasts_draw_attention_action_discovery.test.js`
7. `tests/integration/mods/seduction/stretch_sexily_action_discovery.test.js`
8. `tests/integration/mods/seduction/grab_crotch_draw_attention_action_discovery.test.js`

**Test Pattern to Add**:

```javascript
describe('Other actors prerequisite', () => {
  it('should be executable when other actors are present', async () => {
    const scenario = testFixture.createStandardActorTarget(['Alice', 'Bob']);

    await testFixture.executeAction(scenario.actor.id, null);

    testFixture.assertActionSuccess('Alice [performs action].');
  });

  it('should reject execution when actor is alone in the room', async () => {
    // Create a solo actor (no target)
    const scenario = testFixture.createStandardActorTarget(['Alice'], {
      includeTarget: false,
    });

    await expect(
      testFixture.executeAction(scenario.actor.id, null)
    ).rejects.toThrow(/nobody here to draw attention/i);
  });

  it('should reject execution when only non-actor entities are present', async () => {
    const scenario = testFixture.createStandardActorTarget(['Alice'], {
      includeTarget: false,
    });

    // Add furniture but no other actors
    const furniture = ModEntityScenarios.createFurniture('furniture1', 'Couch');
    testFixture.reset([scenario.room, scenario.actor, furniture]);

    await expect(
      testFixture.executeAction(scenario.actor.id, null)
    ).rejects.toThrow(/nobody here to draw attention/i);
  });
});
```

**Reference**: Existing test structure in seduction action test files

---

### New Integration Test Suite

**File**: `tests/integration/mods/seduction/seduction_actions_other_actors_validation.test.js`

**Purpose**: Comprehensive test suite validating that all seduction actions now require other actors.

**Structure**:
```javascript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';

const SEDUCTION_ACTIONS = [
  {
    id: 'seduction:brush_hair_back_coyly',
    name: 'brush_hair_back_coyly',
    requiresPrerequisites: ['hair']
  },
  {
    id: 'seduction:draw_attention_to_ass',
    name: 'draw_attention_to_ass',
    requiresPrerequisites: ['ass_cheek', 'torso_lower_clothing']
  },
  {
    id: 'seduction:draw_attention_to_breasts',
    name: 'draw_attention_to_breasts',
    requiresPrerequisites: ['breast', 'torso_upper_clothing']
  },
  {
    id: 'seduction:cross_legs_alluringly',
    name: 'cross_legs_alluringly',
    requiresPrerequisites: ['leg', 'sitting']
  },
  {
    id: 'seduction:stroke_penis_to_draw_attention',
    name: 'stroke_penis_to_draw_attention',
    requiresPrerequisites: ['penis', 'uncovered_penis']
  },
  {
    id: 'seduction:squeeze_breasts_draw_attention',
    name: 'squeeze_breasts_draw_attention',
    requiresPrerequisites: ['breast', 'uncovered_breast']
  },
  {
    id: 'seduction:stretch_sexily',
    name: 'stretch_sexily',
    requiresPrerequisites: []
  },
  {
    id: 'seduction:grab_crotch_draw_attention',
    name: 'grab_crotch_draw_attention',
    requiresPrerequisites: ['penis', 'torso_lower_clothing']
  },
];

describe('Seduction Actions - Other Actors Validation', () => {
  describe.each(SEDUCTION_ACTIONS)(
    '$name - Other Actors Prerequisite',
    ({ id, name }) => {
      let testFixture;

      beforeEach(async () => {
        const ruleFile = await import(`../../../../data/mods/seduction/rules/${name}.rule.json`);
        const conditionFile = await import(`../../../../data/mods/seduction/conditions/event-is-action-${name.replace(/_/g, '-')}.condition.json`);

        testFixture = await ModTestFixture.forAction(
          'seduction',
          id,
          ruleFile.default,
          conditionFile.default
        );
      });

      afterEach(() => {
        testFixture?.cleanup();
      });

      it('should succeed when other actors are present', async () => {
        const scenario = testFixture.createStandardActorTarget(['Actor', 'Observer']);

        // Note: Some actions have additional prerequisites that would need setup
        // This test assumes the default scenario satisfies them

        await testFixture.executeAction(scenario.actor.id, null);

        // Verify action executed successfully
        expect(testFixture.events.some(e => e.type === 'action/success')).toBe(true);
      });

      it('should fail when actor is alone', async () => {
        const scenario = testFixture.createStandardActorTarget(['Actor'], {
          includeTarget: false,
        });

        await expect(
          testFixture.executeAction(scenario.actor.id, null)
        ).rejects.toThrow(/nobody here to draw attention/i);
      });
    }
  );
});
```

**Purpose**: Single comprehensive test that validates all 8 seduction actions have the prerequisite working correctly.

---

## Performance Considerations

### Operator Efficiency

**Current Approach** (filter all entities):
- Time complexity: O(n) where n = total entities
- Acceptable for typical game scenarios (< 1000 entities)

**Potential Optimizations** (if needed):
1. **Index by location**: Maintain a location → entities map in EntityManager
2. **Cache results**: Cache the result for a given actor/location pair (with invalidation on entity movement)
3. **Early exit**: Return as soon as first other actor is found (don't count all)

**Recommendation**: Start with simple O(n) approach. Optimize only if performance testing shows issues.

### Test Performance

- Unit tests should run in < 10ms per test
- Integration tests should run in < 100ms per test
- Full seduction mod test suite should run in < 5 seconds

---

## Migration Strategy

### Backward Compatibility

**Impact**: This change makes seduction actions **more restrictive**.

**Migration Concerns**:
1. **Existing saved games**: Characters who could previously perform these actions alone will now be blocked
2. **LLM behavior**: LLMs will need to adapt to the new constraint

**Risk Assessment**:
- ✅ **Low Risk**: This is a bug fix, not a breaking change. The previous behavior was incorrect.
- ✅ **No data migration needed**: Only action prerequisites change; no entity data affected
- ✅ **Clear failure messages**: Users will understand why actions are blocked

### Rollout Plan

1. **Phase 1**: Implement operator and tests
2. **Phase 2**: Update one seduction action as proof-of-concept
3. **Phase 3**: Update remaining seduction actions
4. **Phase 4**: Run full test suite and validate
5. **Phase 5**: Test in-game with LLM players
6. **Phase 6**: Deploy to production

---

## Alternative Approaches Considered

### Alternative 1: Scope-Based Approach

**Idea**: Create a new scope `seduction:has_audience` that resolves to non-empty if other actors present, and check it in prerequisites.

**Pros**:
- Reuses existing scope system
- No new operator needed

**Cons**:
- ❌ Prerequisites can't directly check scope results (they use JSON Logic)
- ❌ Would still need an operator to check "scope returns non-empty"
- ❌ More complex than direct operator

**Verdict**: Rejected - operator is simpler and more direct

---

### Alternative 2: Required Components Approach

**Idea**: Add a `required_components.location` check for presence of other actors.

**Pros**:
- Uses existing component validation system

**Cons**:
- ❌ `required_components` checks are static (on actor/target only)
- ❌ Can't express "location must have other actors" with current system
- ❌ Would require significant refactoring of component validation

**Verdict**: Rejected - not feasible with current architecture

---

### Alternative 3: Hybrid Scope + Operator

**Idea**: Use the existing `core:actors_in_location` scope with a new `scopeHasResults` operator.

**Pros**:
- Reuses existing scope logic
- More generic operator (works with any scope)

**Cons**:
- More complex implementation (need to bridge scopes into prerequisites)
- Scope resolution happens at a different stage than prerequisite evaluation
- Still needs a new operator, so not avoiding the core work

**Verdict**: Rejected - adds complexity without clear benefit

---

## Documentation Updates

### Files to Update

1. **CLAUDE.md**:
   - Add `hasOtherActorsAtLocation` to list of custom operators
   - Update example showing prerequisite usage

2. **docs/scopeDsl/README.md**:
   - Add operator to operator reference table
   - Include example usage

3. **Seduction Mod README** (if exists):
   - Document that actions require audience
   - Explain failure message

### New Documentation

Consider adding:
- `docs/operators/hasOtherActorsAtLocation.md` - Detailed operator documentation
- Update mod testing guide with this pattern as example

---

## Implementation Checklist

### Operator Implementation

- [ ] Create `src/logic/operators/hasOtherActorsAtLocationOperator.js`
- [ ] Implement operator with proper dependency validation
- [ ] Add operator import to `src/logic/jsonLogicCustomOperators.js`
- [ ] Instantiate operator in constructor
- [ ] Register operation with `jsonLogicEvaluationService`
- [ ] Run `npm run typecheck` to verify no type errors

### Action Updates

- [ ] Update `brush_hair_back_coyly.action.json`
- [ ] Update `draw_attention_to_ass.action.json`
- [ ] Update `draw_attention_to_breasts.action.json`
- [ ] Update `cross_legs_alluringly.action.json`
- [ ] Update `stroke_penis_to_draw_attention.action.json`
- [ ] Update `squeeze_breasts_draw_attention.action.json`
- [ ] Update `stretch_sexily.action.json`
- [ ] Update `grab_crotch_draw_attention.action.json`
- [ ] Verify all JSON files are valid with `npm run validate`

### Testing - Unit Tests

- [ ] Create `tests/unit/logic/operators/hasOtherActorsAtLocationOperator.test.js`
- [ ] Test: Returns true when other actors present
- [ ] Test: Returns false when actor alone
- [ ] Test: Returns false with no position component
- [ ] Test: Edge case - multiple actors
- [ ] Test: Edge case - only non-actor entities
- [ ] Test: Edge case - actors in different locations
- [ ] Test: Dependency validation
- [ ] Run tests: `npm run test:unit -- tests/unit/logic/operators/hasOtherActorsAtLocationOperator.test.js`
- [ ] Verify 100% coverage for operator

### Testing - Integration Tests

- [ ] Update `tests/integration/logic/customOperatorRegistration.test.js`
- [ ] Create `tests/integration/mods/seduction/seduction_actions_other_actors_validation.test.js`
- [ ] Update all 8 seduction action discovery tests with new scenarios
- [ ] Run seduction tests: `npm run test:integration -- tests/integration/mods/seduction/`
- [ ] Verify all tests pass

### Code Quality

- [ ] Run `npx eslint src/logic/operators/hasOtherActorsAtLocationOperator.js`
- [ ] Run `npx eslint src/logic/jsonLogicCustomOperators.js`
- [ ] Run `npx eslint tests/unit/logic/operators/hasOtherActorsAtLocationOperator.test.js`
- [ ] Run `npx eslint tests/integration/mods/seduction/seduction_actions_other_actors_validation.test.js`
- [ ] Fix all linting issues
- [ ] Run full test suite: `npm run test:ci`
- [ ] Verify 80%+ test coverage maintained

### Documentation

- [ ] Update `CLAUDE.md` with new operator
- [ ] Update `docs/scopeDsl/README.md` with operator reference
- [ ] Add inline code comments to operator
- [ ] Update this spec with "Status: Implemented" when complete

### Validation

- [ ] Manually test one seduction action with other actors present (should succeed)
- [ ] Manually test one seduction action when alone (should fail with message)
- [ ] Test with LLM player to verify behavior change
- [ ] Verify failure message is clear and helpful

---

## Completion Criteria

The implementation is complete when:

1. ✅ Operator implemented and tested with 100% coverage
2. ✅ All 8 seduction actions updated with new prerequisite
3. ✅ All existing tests still pass
4. ✅ New integration test suite passes
5. ✅ ESLint passes on all modified files
6. ✅ Full test suite passes (`npm run test:ci`)
7. ✅ Documentation updated
8. ✅ Manual testing confirms expected behavior
9. ✅ LLM testing shows improved behavior (no longer uses actions when alone)

---

## Open Questions

1. **Should the operator be named differently?**
   - Current: `hasOtherActorsAtLocation`
   - Alternative: `hasAudience`, `hasObservers`, `hasCompany`
   - **Recommendation**: Keep `hasOtherActorsAtLocation` - most explicit and clear

2. **Should we make the operator more generic?**
   - Current: Specifically checks for actors
   - Alternative: `hasOtherEntitiesAtLocation` with component type parameter
   - **Recommendation**: Start specific, generalize later if needed

3. **Should we cache the operator results?**
   - **Recommendation**: No caching in initial implementation. Add if performance issues arise.

4. **Should we add a count parameter?**
   - E.g., `hasOtherActorsAtLocation: ["actor", 2]` - requires at least 2 other actors
   - **Recommendation**: Not needed for current use case. Can add later if needed.

---

## Related Issues & References

### Related Mods
- `data/mods/seduction/` - All actions in this mod are affected

### Related Systems
- `src/logic/jsonLogicCustomOperators.js` - Operator registration
- `src/logic/operators/` - Operator implementations
- `tests/integration/logic/customOperatorRegistration.test.js` - Operator tests
- `docs/testing/mod-testing-guide.md` - Testing patterns

### Similar Operators
- `hasPartOfType` - Checks for body parts
- `hasClothingInSlot` - Checks for clothing
- `hasPartWithComponentValue` - Checks component values

### Testing Patterns
- `tests/integration/mods/seduction/brush_hair_back_coyly_action_discovery.test.js`
- `tests/unit/logic/operators/hasPartOfTypeOperator.test.js`

---

**End of Specification**
