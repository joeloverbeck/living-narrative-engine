# STRWAISYS-002: Scope Queries Implementation

**Status:** Ready for Implementation
**Priority:** High
**Estimated Effort:** 2-3 hours
**Dependencies:** STRWAISYS-001
**Blocks:** STRWAISYS-004, STRWAISYS-005, STRWAISYS-006

## Objective

Create two scope queries for the straddling waist system:
1. `actors_sitting_close` - Find sitting actors in closeness circle
2. `actor_im_straddling` - Find the actor currently being straddled

## Background

Scope queries use the Scope DSL to filter entities for action targeting. These queries enable:
- Action discovery (which actions are available)
- Target selection (which entities can be targeted)
- Component querying (accessing related entities)

## Implementation Tasks

### 1. Create `actors_sitting_close` Scope

**File:** `data/mods/positioning/scopes/actors_sitting_close.scope`

**Purpose:** Find actors in the closeness circle who are currently sitting

**Implementation:**
```
positioning:actors_sitting_close := actor.components.positioning:closeness.partners[][{
  "and": [
    {
      "!!": {
        "var": "entity.components.positioning:sitting_on"
      }
    }
  ]
}]
```

**Scope DSL Breakdown:**
- `actor.components.positioning:closeness.partners[]` - Array of actors in closeness circle
- `[{...}]` - JSON Logic filter on array elements
- `{"!!": {"var": "entity.components.positioning:sitting_on"}}` - Check if entity has `sitting_on` component
- Result: Array of sitting actors in closeness circle

**Design Notes:**
- Requires actor to have `closeness` component
- Filters partners for `sitting_on` component presence
- Returns empty array if no closeness or no sitting partners
- Used by both straddling actions for target selection

### 2. Create `actor_im_straddling` Scope

**File:** `data/mods/positioning/scopes/actor_im_straddling.scope`

**Purpose:** Find the actor currently being straddled by the acting entity

**Implementation:**
```
positioning:actor_im_straddling := entities(core:actor)[][{
  "==": [
    {"var": "entity.id"},
    {"var": "actor.components.positioning:straddling_waist.target_id"}
  ]
}]
```

**Scope DSL Breakdown:**
- `entities(core:actor)[]` - Query all actors in the game
- `[{...}]` - JSON Logic filter on entities
- `{"==": [...]}` - Match entity ID to straddling target
- `{"var": "actor.components.positioning:straddling_waist.target_id"}` - Get target from component
- Result: Single-element array containing the straddled actor

**Design Notes:**
- Requires actor to have `straddling_waist` component
- Matches entity ID against component's `target_id`
- Returns single entity (the straddled actor)
- Used by `dismount_from_straddling` action

### 3. Create Unit Tests for `actors_sitting_close`

**File:** `tests/unit/mods/positioning/scopes/actors_sitting_close.test.js`

**Test Structure:**
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../../common/testBed.js';

describe('positioning:actors_sitting_close Scope Query', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  it('should return sitting actors in closeness circle', () => {
    const actor = testBed.createActor('actor_1', {
      components: {
        'positioning:closeness': {
          partners: ['actor_2', 'actor_3']
        }
      }
    });

    const sittingActor = testBed.createActor('actor_2', {
      components: {
        'positioning:sitting_on': {
          furniture_id: 'furniture:chair_1',
          seat_index: 0
        },
        'positioning:closeness': {
          partners: ['actor_1']
        }
      }
    });

    const standingActor = testBed.createActor('actor_3', {
      components: {
        'positioning:closeness': {
          partners: ['actor_1']
        }
      }
    });

    const result = testBed.evaluateScope(
      'positioning:actors_sitting_close',
      { actor: actor }
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('actor_2');
  });

  it('should filter out non-sitting actors', () => {
    const actor = testBed.createActor('actor_1', {
      components: {
        'positioning:closeness': {
          partners: ['actor_2', 'actor_3', 'actor_4']
        }
      }
    });

    const standingActor1 = testBed.createActor('actor_2', {
      components: {
        'positioning:closeness': {
          partners: ['actor_1']
        }
      }
    });

    const standingActor2 = testBed.createActor('actor_3', {
      components: {
        'positioning:closeness': {
          partners: ['actor_1']
        }
      }
    });

    const standingActor3 = testBed.createActor('actor_4', {
      components: {
        'positioning:closeness': {
          partners: ['actor_1']
        }
      }
    });

    const result = testBed.evaluateScope(
      'positioning:actors_sitting_close',
      { actor: actor }
    );

    expect(result).toHaveLength(0);
  });

  it('should return empty array when actor has no closeness', () => {
    const actor = testBed.createActor('actor_1', {
      components: {}
    });

    const result = testBed.evaluateScope(
      'positioning:actors_sitting_close',
      { actor: actor }
    );

    expect(result).toEqual([]);
  });

  it('should return empty array when no partners are sitting', () => {
    const actor = testBed.createActor('actor_1', {
      components: {
        'positioning:closeness': {
          partners: []
        }
      }
    });

    const result = testBed.evaluateScope(
      'positioning:actors_sitting_close',
      { actor: actor }
    );

    expect(result).toEqual([]);
  });

  it('should return multiple sitting actors', () => {
    const actor = testBed.createActor('actor_1', {
      components: {
        'positioning:closeness': {
          partners: ['actor_2', 'actor_3', 'actor_4']
        }
      }
    });

    const sittingActor1 = testBed.createActor('actor_2', {
      components: {
        'positioning:sitting_on': {
          furniture_id: 'furniture:chair_1',
          seat_index: 0
        }
      }
    });

    const standingActor = testBed.createActor('actor_3', {
      components: {}
    });

    const sittingActor2 = testBed.createActor('actor_4', {
      components: {
        'positioning:sitting_on': {
          furniture_id: 'furniture:chair_2',
          seat_index: 0
        }
      }
    });

    const result = testBed.evaluateScope(
      'positioning:actors_sitting_close',
      { actor: actor }
    );

    expect(result).toHaveLength(2);
    expect(result.map(r => r.id)).toContain('actor_2');
    expect(result.map(r => r.id)).toContain('actor_4');
  });
});
```

### 4. Create Unit Tests for `actor_im_straddling`

**File:** `tests/unit/mods/positioning/scopes/actor_im_straddling.test.js`

**Test Structure:**
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../../common/testBed.js';

describe('positioning:actor_im_straddling Scope Query', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  it('should return straddled actor from straddling_waist.target_id', () => {
    const straddlingActor = testBed.createActor('actor_1', {
      components: {
        'positioning:straddling_waist': {
          target_id: 'actor_2',
          facing_away: false
        }
      }
    });

    const straddledActor = testBed.createActor('actor_2', {
      components: {
        'positioning:sitting_on': {
          furniture_id: 'furniture:chair_1',
          seat_index: 0
        }
      }
    });

    const result = testBed.evaluateScope(
      'positioning:actor_im_straddling',
      { actor: straddlingActor }
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('actor_2');
  });

  it('should return empty array when not straddling', () => {
    const actor = testBed.createActor('actor_1', {
      components: {}
    });

    const result = testBed.evaluateScope(
      'positioning:actor_im_straddling',
      { actor: actor }
    );

    expect(result).toEqual([]);
  });

  it('should return correct actor when multiple actors exist', () => {
    const straddlingActor = testBed.createActor('actor_1', {
      components: {
        'positioning:straddling_waist': {
          target_id: 'actor_3',
          facing_away: true
        }
      }
    });

    const otherActor1 = testBed.createActor('actor_2', {
      components: {}
    });

    const straddledActor = testBed.createActor('actor_3', {
      components: {
        'positioning:sitting_on': {
          furniture_id: 'furniture:chair_1',
          seat_index: 0
        }
      }
    });

    const otherActor2 = testBed.createActor('actor_4', {
      components: {}
    });

    const result = testBed.evaluateScope(
      'positioning:actor_im_straddling',
      { actor: straddlingActor }
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('actor_3');
  });

  it('should work with facing_away=false', () => {
    const straddlingActor = testBed.createActor('actor_1', {
      components: {
        'positioning:straddling_waist': {
          target_id: 'actor_2',
          facing_away: false
        }
      }
    });

    const straddledActor = testBed.createActor('actor_2', {
      components: {}
    });

    const result = testBed.evaluateScope(
      'positioning:actor_im_straddling',
      { actor: straddlingActor }
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('actor_2');
  });

  it('should work with facing_away=true', () => {
    const straddlingActor = testBed.createActor('actor_1', {
      components: {
        'positioning:straddling_waist': {
          target_id: 'actor_2',
          facing_away: true
        }
      }
    });

    const straddledActor = testBed.createActor('actor_2', {
      components: {}
    });

    const result = testBed.evaluateScope(
      'positioning:actor_im_straddling',
      { actor: straddlingActor }
    );

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('actor_2');
  });
});
```

### 5. Validate Scope DSL Syntax

**Command:**
```bash
npm run scope:lint
```

**Expected Output:** No syntax errors in scope files

## Design Decisions

### Closeness Circle Filtering

**Decision:** Filter closeness partners for `sitting_on` component
**Rationale:**
- Leverages existing closeness system
- Natural filtering via component presence
- Efficient: only checks close actors
- Consistent with action requirements

**Alternative Considered:** Query all actors, filter by location and sitting
**Rejected Because:**
- Less efficient (checks all actors)
- Duplicates closeness logic
- Action already requires closeness

### Target ID Matching

**Decision:** Use `entities(core:actor)` with ID equality filter
**Rationale:**
- Simple and direct ID matching
- Works with any actor ID format
- Single-element result array
- Follows existing scope patterns

**Alternative Considered:** Scope query via `actor.components.positioning:straddling_waist.target_id` directly
**Rejected Because:**
- Scope DSL doesn't support direct entity lookup by ID
- Need to filter entity collection

### JSON Logic Operators

**Scope 1 Uses:** `!!` (double negation for truthiness check)
- Checks if component exists and is truthy
- Standard JSON Logic pattern for existence check

**Scope 2 Uses:** `==` (equality comparison)
- Matches entity ID to target ID
- Standard comparison operator

## Testing Strategy

### Unit Test Coverage
- Scope returns expected entities
- Scope handles missing components
- Scope handles empty arrays
- Scope handles multiple matches
- Both boolean values for `facing_away` work

### Validation Testing
```bash
# Validate scope DSL syntax
npm run scope:lint

# Run scope unit tests
NODE_ENV=test npm run test:unit -- tests/unit/mods/positioning/scopes/ --verbose
```

## Acceptance Criteria

- [ ] `actors_sitting_close.scope` created with correct syntax
- [ ] `actor_im_straddling.scope` created with correct syntax
- [ ] Both scopes use correct Scope DSL operators
- [ ] Unit tests for `actors_sitting_close` created
- [ ] Unit tests for `actor_im_straddling` created
- [ ] All unit tests pass
- [ ] Scope DSL validation passes
- [ ] Scopes handle edge cases (no closeness, not straddling, etc.)

## Verification Commands

```bash
# Validate scope DSL syntax
npm run scope:lint

# Run scope unit tests
NODE_ENV=test npm run test:unit -- tests/unit/mods/positioning/scopes/actors_sitting_close.test.js --verbose
NODE_ENV=test npm run test:unit -- tests/unit/mods/positioning/scopes/actor_im_straddling.test.js --verbose

# Run all positioning scope tests
NODE_ENV=test npm run test:unit -- tests/unit/mods/positioning/scopes/ --silent
```

## References

### Scope DSL Documentation
- Scope DSL syntax: `.`, `[]`, `[{...}]`, `+`, `|`
- JSON Logic operators: `!!`, `==`, `var`, `and`
- CLAUDE.md - Scope DSL section

### Similar Scopes
- `positioning:actors_in_closeness` - Closeness partner filtering
- `positioning:actor_kneeling_before_me` - Target ID matching pattern
- `positioning:sitting_actors` - Component existence filtering

### Specification Reference
- Spec: `specs/straddling-waist-system.spec.md` (Section: Scope Queries)

## Notes

- Scope queries are evaluated at action discovery time
- Empty arrays are valid results (no matching entities)
- Scopes depend on component schema from STRWAISYS-001
- These scopes enable action targeting in STRWAISYS-004, STRWAISYS-005, STRWAISYS-006
