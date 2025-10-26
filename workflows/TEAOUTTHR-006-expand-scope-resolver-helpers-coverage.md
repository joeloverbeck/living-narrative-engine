# TEAOUTTHR-006: Expand ScopeResolverHelpers Coverage

## Overview
**Priority**: P1 (Medium-term)
**Effort**: 6 hours
**Impact**: Medium
**Dependencies**: TEAOUTTHR-001 (Documentation for usage patterns)

## Problem Statement
ScopeResolverHelpers library (`tests/common/mods/scopeResolverHelpers.js`) provides valuable scope resolvers, but analysis revealed gaps:

**Currently Registered Scopes**:
- `positioning:furniture_actor_sitting_on`
- `positioning:actors_sitting_on_same_furniture`
- `positioning:closest_leftmost_occupant`
- `positioning:closest_rightmost_occupant`
- `positioning:furniture_allowing_sitting_at_location`
- `positioning:standing_actors_at_location`
- `positioning:sitting_actors`
- `positioning:kneeling_actors`
- `positioning:furniture_actor_behind`

**Missing Common Scopes** (discovered from test analysis):
- ❌ `positioning:actor_being_bitten_by_me` (used in tear_out_throat)
- ❌ `positioning:close_actors_facing_each_other_or_behind_target` (used in grab_neck)
- ❌ Potentially others from vampirism, intimacy, and other mods

**Impact**: Developers still need to manually implement these common scopes with 5-10 lines of factory method calls.

## Goals
1. Add `positioning:actor_being_bitten_by_me` resolver to standard library
2. Add `positioning:close_actors_facing_each_other_or_behind_target` resolver
3. Survey positioning mod scope definitions for other common scopes
4. Achieve 90%+ coverage of positioning mod scopes
5. Create unit tests for new resolvers
6. Update documentation with new resolver availability

## Implementation Steps

### Step 1: Survey Positioning Mod Scopes

**Action**: Analyze all scope definitions in positioning mod

```bash
# List all positioning scopes
ls data/mods/positioning/scopes/*.scope

# Review scope definitions
cat data/mods/positioning/scopes/*.scope
```

**Deliverable**: List of all positioning scopes and their patterns

**Document** in implementation notes:
- Scope name
- Pattern type (component lookup, array filter, location match, etc.)
- Usage frequency (check test files)
- Priority (high for frequently used scopes)

---

### Step 2: Add positioning:actor_being_bitten_by_me Resolver

**File**: `tests/common/mods/scopeResolverHelpers.js`

**Location**: In `registerPositioningScopes()` method, add to resolvers object

**Implementation**:
```javascript
static registerPositioningScopes(testEnv) {
  const { entityManager } = testEnv;

  const resolvers = {
    // ... existing resolvers ...

    'positioning:actor_being_bitten_by_me': this.createComponentLookupResolver(
      'positioning:actor_being_bitten_by_me',
      {
        componentType: 'positioning:biting_neck',
        sourceField: 'bitten_entity_id',
        contextSource: 'actor',
        validateReciprocal: true,
        reciprocalComponent: 'positioning:being_bitten_in_neck',
        reciprocalField: 'biting_entity_id',
      }
    ),
  };

  this._registerResolvers(testEnv, entityManager, resolvers);
}
```

**Note**: May require extending `createComponentLookupResolver` to support reciprocal validation.

---

### Step 3: Add positioning:close_actors_facing_each_other_or_behind_target Resolver

**File**: `tests/common/mods/scopeResolverHelpers.js`

**Location**: In `registerPositioningScopes()` method

**Implementation**:
```javascript
'positioning:close_actors_facing_each_other_or_behind_target': this.createArrayFilterResolver(
  'positioning:close_actors_facing_each_other_or_behind_target',
  {
    getArray: (actor, context, em) => {
      const closeness = em.getComponentData(actor.id, 'positioning:closeness');
      return closeness?.partners || [];
    },
    filterFn: (partnerId, actor, context, em) => {
      // Get actor's facing_away component
      const actorFacingAway = em.getComponentData(
        actor.id,
        'positioning:facing_away'
      )?.facing_away_from || [];

      // Get partner entity
      const partner = em.getEntityInstance(partnerId);
      if (!partner) return false;

      // Get partner's facing_away component
      const partnerFacingAway = em.getComponentData(
        partnerId,
        'positioning:facing_away'
      )?.facing_away_from || [];

      // Check if facing each other (neither facing away from the other)
      const facingEachOther =
        !actorFacingAway.includes(partnerId) &&
        !partnerFacingAway.includes(actor.id);

      // Check if actor is behind target (target facing away from actor)
      const actorBehind = partnerFacingAway.includes(actor.id);

      return facingEachOther || actorBehind;
    },
  }
),
```

---

### Step 4: Enhance Factory Methods for Reciprocal Validation

**File**: `tests/common/mods/scopeResolverHelpers.js`

**Method**: `createComponentLookupResolver`

**Current Signature**:
```javascript
static createComponentLookupResolver(scopeName, config) {
  const { componentType, sourceField, contextSource } = config;
  // ...
}
```

**Enhanced Signature**:
```javascript
static createComponentLookupResolver(scopeName, config) {
  const {
    componentType,
    sourceField,
    contextSource,
    validateReciprocal = false,
    reciprocalComponent = null,
    reciprocalField = null,
  } = config;

  return (context) => {
    const sourceEntity = context[contextSource];
    if (!sourceEntity) {
      return { success: true, value: new Set() };
    }

    const component = sourceEntity.components?.[componentType];
    if (!component) {
      return { success: true, value: new Set() };
    }

    const targetId = component[sourceField];
    if (!targetId) {
      return { success: true, value: new Set() };
    }

    // Reciprocal validation if enabled
    if (validateReciprocal && reciprocalComponent && reciprocalField) {
      const { entityManager } = this._testEnv;
      const targetEntity = entityManager.getEntityInstance(targetId);
      if (!targetEntity) {
        return { success: true, value: new Set() };
      }

      const reciprocal = targetEntity.components?.[reciprocalComponent];
      if (!reciprocal || reciprocal[reciprocalField] !== sourceEntity.id) {
        return { success: true, value: new Set() };
      }
    }

    return { success: true, value: new Set([targetId]) };
  };
}
```

---

### Step 5: Create Unit Tests for New Resolvers

**File**: `tests/unit/common/mods/scopeResolverHelpers.test.js` (create if doesn't exist)

**Test Structure**:
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { ScopeResolverHelpers } from '../../../common/mods/scopeResolverHelpers.js';
import { createTestBed } from '../../../common/testBed.js';

describe('ScopeResolverHelpers - Positioning Scopes', () => {
  let testBed;
  let testEnv;

  beforeEach(() => {
    testBed = createTestBed();
    testEnv = {
      entityManager: testBed.createMockEntityManager(),
      unifiedScopeResolver: testBed.createMockScopeResolver(),
    };
  });

  describe('positioning:actor_being_bitten_by_me', () => {
    it('should resolve to entity being bitten by actor', () => {
      // Arrange
      const actor = {
        id: 'alice',
        components: {
          'positioning:biting_neck': {
            bitten_entity_id: 'bob',
          },
        },
      };

      const target = {
        id: 'bob',
        components: {
          'positioning:being_bitten_in_neck': {
            biting_entity_id: 'alice',
          },
        },
      };

      testEnv.entityManager.getEntityInstance
        .mockReturnValueOnce(actor)
        .mockReturnValueOnce(target);

      ScopeResolverHelpers.registerPositioningScopes(testEnv);

      // Act
      const result = testEnv.unifiedScopeResolver.resolveSync(
        'positioning:actor_being_bitten_by_me',
        { actor }
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.value).toEqual(new Set(['bob']));
    });

    it('should return empty set when reciprocal relationship invalid', () => {
      // Test reciprocal validation...
    });

    it('should return empty set when actor not biting anyone', () => {
      // Test empty component...
    });
  });

  describe('positioning:close_actors_facing_each_other_or_behind_target', () => {
    it('should include close actors facing each other', () => {
      // Test facing each other scenario...
    });

    it('should include close actors when actor is behind target', () => {
      // Test behind scenario...
    });

    it('should exclude actors facing away from each other', () => {
      // Test exclusion...
    });
  });
});
```

---

### Step 6: Update Documentation

**File**: `docs/testing/mod-testing-guide.md`

**Location**: "Testing Actions with Custom Scopes" section

**Update**: Add new scopes to registered scope list

```markdown
**Registered Positioning Scopes** (updated 2025-10-26):
- `positioning:furniture_actor_sitting_on`
- `positioning:actors_sitting_on_same_furniture`
- `positioning:closest_leftmost_occupant`
- `positioning:closest_rightmost_occupant`
- `positioning:furniture_allowing_sitting_at_location`
- `positioning:standing_actors_at_location`
- `positioning:sitting_actors`
- `positioning:kneeling_actors`
- `positioning:furniture_actor_behind`
- **NEW**: `positioning:actor_being_bitten_by_me` (validates reciprocal biting relationship)
- **NEW**: `positioning:close_actors_facing_each_other_or_behind_target` (complex facing logic)

**Coverage**: Now covers 90%+ of common positioning mod scopes.
```

---

### Step 7: Survey and Prioritize Additional Scopes

**Action**: Review positioning mod for remaining scopes

**Candidates** (identify from `data/mods/positioning/scopes/`):
1. Scopes used in multiple mods (high priority)
2. Scopes with complex logic (medium priority)
3. Mod-specific scopes (low priority - use custom resolvers)

**Decision Criteria**:
- Add to library if used in 2+ mods
- Add if logic is complex (10+ lines of implementation)
- Skip if simple pattern (developers can use factory methods)

**Deliverable**: Prioritized list for future expansion

---

### Step 8: Integration Testing

**File**: Create integration test to verify all registered scopes work

**Path**: `tests/integration/common/mods/scopeResolverHelpersIntegration.test.js`

**Purpose**: Ensure all registered scopes resolve correctly with real entity manager

```javascript
describe('ScopeResolverHelpers Integration', () => {
  describe('registerPositioningScopes', () => {
    it('should register all positioning scopes successfully', async () => {
      const testFixture = await ModTestFixture.forAction('positioning', 'sit_down');

      // Should not throw
      expect(() => {
        ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);
      }).not.toThrow();

      // Verify scopes are registered
      const scopeNames = [
        'positioning:furniture_actor_sitting_on',
        'positioning:actor_being_bitten_by_me',
        'positioning:close_actors_facing_each_other_or_behind_target',
        // ... all registered scopes
      ];

      scopeNames.forEach(scopeName => {
        const result = testFixture.testEnv.unifiedScopeResolver.resolveSync(
          scopeName,
          { actor: { id: 'test' } }
        );
        expect(result.success).toBe(true);
      });
    });
  });
});
```

---

## Files to Modify
- `tests/common/mods/scopeResolverHelpers.js`
- `tests/unit/common/mods/scopeResolverHelpers.test.js` (create)
- `tests/integration/common/mods/scopeResolverHelpersIntegration.test.js` (create)
- `docs/testing/mod-testing-guide.md`

## Acceptance Criteria
✅ `positioning:actor_being_bitten_by_me` resolver added
✅ `positioning:close_actors_facing_each_other_or_behind_target` resolver added
✅ `createComponentLookupResolver` supports reciprocal validation
✅ Unit tests created for new resolvers (80%+ coverage)
✅ Integration tests verify all registered scopes work
✅ Documentation updated with new scope availability
✅ Survey of positioning mod scopes completed
✅ 90%+ coverage of common positioning scopes achieved

## Testing Strategy

### Unit Testing
```bash
# Test new resolver implementations
NODE_ENV=test npx jest tests/unit/common/mods/scopeResolverHelpers.test.js --no-coverage --verbose
```

### Integration Testing
```bash
# Test scope registration with real entity manager
NODE_ENV=test npx jest tests/integration/common/mods/scopeResolverHelpersIntegration.test.js --no-coverage --verbose
```

### Regression Testing
```bash
# Ensure violence and vampirism tests still pass
NODE_ENV=test npx jest tests/integration/mods/violence/ tests/integration/mods/vampirism/ --no-coverage --silent
```

### Full Test Suite
```bash
# Run complete test suite
NODE_ENV=test npm run test:unit
NODE_ENV=test npm run test:integration
```

## Rollback Plan
If new resolvers cause issues:
1. Remove new resolver entries from `registerPositioningScopes()`
2. Revert factory method enhancements
3. Keep unit tests as regression prevention
4. Review scope definition logic for discrepancies

## Related Tickets
- TEAOUTTHR-001: Documentation will be updated with new resolver availability
- TEAOUTTHR-004: Violence tests will benefit from expanded coverage
- TEAOUTTHR-005: Vampirism tests may need additional scopes
- TEAOUTTHR-007: Registry documentation will include new scopes

## Success Metrics
- New resolvers added: 2+ (actor_being_bitten_by_me, close_actors_facing_*)
- Coverage increase: From ~50% to 90%+ of positioning scopes
- Manual implementation reduction: 5-10 lines → 0 lines for common scopes
- Test code simplified: Tests using new scopes require no custom resolvers
- Unit test coverage: 80%+ for new resolver implementations
