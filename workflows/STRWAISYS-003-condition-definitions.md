# STRWAISYS-003: Condition Definitions

**Status:** Ready for Implementation
**Priority:** High
**Estimated Effort:** 1-2 hours
**Dependencies:** None
**Blocks:** STRWAISYS-004, STRWAISYS-005, STRWAISYS-006

## Objective

Create three condition files that identify when specific straddling waist actions are being attempted. These conditions are used by rules to trigger action-specific handlers.

## Background

Conditions use JSON Logic to evaluate event payloads and determine if specific actions are being attempted. Each action needs a corresponding condition for rule-based event handling.

## Implementation Tasks

### 1. Create Straddle Waist Facing Condition

**File:** `data/mods/positioning/conditions/event-is-action-straddle-waist-facing.condition.json`

**Purpose:** Identify when `positioning:straddle_waist_facing` action is being attempted

**Implementation:**
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:event-is-action-straddle-waist-facing",
  "description": "Checks if event is attempting the straddle_waist_facing action",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "positioning:straddle_waist_facing"
    ]
  }
}
```

**Design Notes:**
- Simple equality check on `event.payload.actionId`
- Used by `handle_straddle_waist_facing` rule
- Standard pattern for action identification
- Returns boolean: true if action matches, false otherwise

### 2. Create Straddle Waist Facing Away Condition

**File:** `data/mods/positioning/conditions/event-is-action-straddle-waist-facing-away.condition.json`

**Purpose:** Identify when `positioning:straddle_waist_facing_away` action is being attempted

**Implementation:**
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:event-is-action-straddle-waist-facing-away",
  "description": "Checks if event is attempting the straddle_waist_facing_away action",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "positioning:straddle_waist_facing_away"
    ]
  }
}
```

**Design Notes:**
- Identical structure to facing condition
- Different action ID match
- Used by `handle_straddle_waist_facing_away` rule
- Ensures correct rule triggers for facing away variant

### 3. Create Dismount from Straddling Condition

**File:** `data/mods/positioning/conditions/event-is-action-dismount-from-straddling.condition.json`

**Purpose:** Identify when `positioning:dismount_from_straddling` action is being attempted

**Implementation:**
```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "positioning:event-is-action-dismount-from-straddling",
  "description": "Checks if event is attempting the dismount_from_straddling action",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "positioning:dismount_from_straddling"
    ]
  }
}
```

**Design Notes:**
- Standard dismount action identification
- Used by `handle_dismount_from_straddling` rule
- Single condition handles both orientations
- Rule will query component for orientation handling

### 4. Create Unit Tests

**File:** `tests/unit/mods/positioning/conditions/straddling-conditions.test.js`

**Test Structure:**
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../../common/testBed.js';

describe('Straddling Waist System - Condition Tests', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  describe('event-is-action-straddle-waist-facing', () => {
    it('should return true when actionId matches straddle_waist_facing', () => {
      const event = {
        type: 'core:attempt_action',
        payload: {
          actionId: 'positioning:straddle_waist_facing',
          actorId: 'actor_1',
          targetId: 'actor_2'
        }
      };

      const result = testBed.evaluateCondition(
        'positioning:event-is-action-straddle-waist-facing',
        { event }
      );

      expect(result).toBe(true);
    });

    it('should return false when actionId does not match', () => {
      const event = {
        type: 'core:attempt_action',
        payload: {
          actionId: 'positioning:straddle_waist_facing_away',
          actorId: 'actor_1',
          targetId: 'actor_2'
        }
      };

      const result = testBed.evaluateCondition(
        'positioning:event-is-action-straddle-waist-facing',
        { event }
      );

      expect(result).toBe(false);
    });

    it('should return false when actionId is missing', () => {
      const event = {
        type: 'core:attempt_action',
        payload: {
          actorId: 'actor_1',
          targetId: 'actor_2'
        }
      };

      const result = testBed.evaluateCondition(
        'positioning:event-is-action-straddle-waist-facing',
        { event }
      );

      expect(result).toBe(false);
    });

    it('should return false for other action IDs', () => {
      const event = {
        type: 'core:attempt_action',
        payload: {
          actionId: 'positioning:kneel_before',
          actorId: 'actor_1',
          targetId: 'actor_2'
        }
      };

      const result = testBed.evaluateCondition(
        'positioning:event-is-action-straddle-waist-facing',
        { event }
      );

      expect(result).toBe(false);
    });
  });

  describe('event-is-action-straddle-waist-facing-away', () => {
    it('should return true when actionId matches straddle_waist_facing_away', () => {
      const event = {
        type: 'core:attempt_action',
        payload: {
          actionId: 'positioning:straddle_waist_facing_away',
          actorId: 'actor_1',
          targetId: 'actor_2'
        }
      };

      const result = testBed.evaluateCondition(
        'positioning:event-is-action-straddle-waist-facing-away',
        { event }
      );

      expect(result).toBe(true);
    });

    it('should return false when actionId does not match', () => {
      const event = {
        type: 'core:attempt_action',
        payload: {
          actionId: 'positioning:straddle_waist_facing',
          actorId: 'actor_1',
          targetId: 'actor_2'
        }
      };

      const result = testBed.evaluateCondition(
        'positioning:event-is-action-straddle-waist-facing-away',
        { event }
      );

      expect(result).toBe(false);
    });

    it('should return false when actionId is missing', () => {
      const event = {
        type: 'core:attempt_action',
        payload: {
          actorId: 'actor_1',
          targetId: 'actor_2'
        }
      };

      const result = testBed.evaluateCondition(
        'positioning:event-is-action-straddle-waist-facing-away',
        { event }
      );

      expect(result).toBe(false);
    });
  });

  describe('event-is-action-dismount-from-straddling', () => {
    it('should return true when actionId matches dismount_from_straddling', () => {
      const event = {
        type: 'core:attempt_action',
        payload: {
          actionId: 'positioning:dismount_from_straddling',
          actorId: 'actor_1',
          targetId: 'actor_2'
        }
      };

      const result = testBed.evaluateCondition(
        'positioning:event-is-action-dismount-from-straddling',
        { event }
      );

      expect(result).toBe(true);
    });

    it('should return false when actionId does not match', () => {
      const event = {
        type: 'core:attempt_action',
        payload: {
          actionId: 'positioning:straddle_waist_facing',
          actorId: 'actor_1',
          targetId: 'actor_2'
        }
      };

      const result = testBed.evaluateCondition(
        'positioning:event-is-action-dismount-from-straddling',
        { event }
      );

      expect(result).toBe(false);
    });

    it('should return false when actionId is missing', () => {
      const event = {
        type: 'core:attempt_action',
        payload: {
          actorId: 'actor_1',
          targetId: 'actor_2'
        }
      };

      const result = testBed.evaluateCondition(
        'positioning:event-is-action-dismount-from-straddling',
        { event }
      );

      expect(result).toBe(false);
    });
  });

  describe('Condition isolation', () => {
    it('should not have cross-condition false positives', () => {
      const events = [
        {
          type: 'core:attempt_action',
          payload: { actionId: 'positioning:straddle_waist_facing' }
        },
        {
          type: 'core:attempt_action',
          payload: { actionId: 'positioning:straddle_waist_facing_away' }
        },
        {
          type: 'core:attempt_action',
          payload: { actionId: 'positioning:dismount_from_straddling' }
        }
      ];

      const conditions = [
        'positioning:event-is-action-straddle-waist-facing',
        'positioning:event-is-action-straddle-waist-facing-away',
        'positioning:event-is-action-dismount-from-straddling'
      ];

      // Each event should match exactly one condition
      events.forEach((event, eventIndex) => {
        conditions.forEach((condition, conditionIndex) => {
          const result = testBed.evaluateCondition(condition, { event });
          if (eventIndex === conditionIndex) {
            expect(result).toBe(true);
          } else {
            expect(result).toBe(false);
          }
        });
      });
    });
  });
});
```

**Test Coverage Requirements:**
- Each condition correctly identifies its action
- Each condition rejects other action IDs
- Each condition handles missing action ID
- No cross-condition false positives
- All edge cases covered

### 5. Validate JSON Schemas

**Command:**
```bash
npm run scope:lint
```

**Expected:** No schema validation errors

## Design Decisions

### Simple Equality Pattern

**Decision:** Use direct `==` comparison for action ID
**Rationale:**
- Simple and performant
- Standard pattern across all action conditions
- Easy to understand and maintain
- No complex logic needed

**Alternative Considered:** Use regex pattern matching
**Rejected Because:**
- Unnecessary complexity
- Performance overhead
- Exact match is sufficient

### Separate Conditions for Each Action

**Decision:** Three separate condition files
**Rationale:**
- Clear separation of concerns
- Each rule has single responsibility
- Easy to test independently
- Follows existing mod pattern

**Alternative Considered:** Single condition with OR logic
**Rejected Because:**
- Less clear which action triggered
- Harder to test
- Breaks single responsibility principle
- Different rules need different conditions

### Condition ID Naming

**Pattern:** `event-is-action-{action-name}`
**Rationale:**
- Descriptive and clear
- Follows existing naming convention
- Easy to search and find
- Indicates purpose immediately

## Testing Strategy

### Unit Test Coverage
- Positive cases (action matches)
- Negative cases (action doesn't match)
- Missing action ID cases
- Cross-condition isolation
- Edge cases

### Manual Testing
```bash
# Run condition unit tests
NODE_ENV=test npm run test:unit -- tests/unit/mods/positioning/conditions/straddling-conditions.test.js --verbose

# Validate JSON schemas
npm run scope:lint
```

## Acceptance Criteria

- [ ] All three condition files created
- [ ] Each condition has correct `$schema` property
- [ ] Each condition uses correct namespaced ID
- [ ] Each condition has descriptive `description`
- [ ] JSON Logic syntax is correct
- [ ] Unit tests created with full coverage
- [ ] All unit tests pass
- [ ] No cross-condition false positives
- [ ] Schema validation passes

## Verification Commands

```bash
# Run condition unit tests
NODE_ENV=test npm run test:unit -- tests/unit/mods/positioning/conditions/straddling-conditions.test.js --verbose

# Validate JSON schemas
npm run scope:lint

# Check all positioning condition tests
NODE_ENV=test npm run test:unit -- tests/unit/mods/positioning/conditions/ --silent

# Verify condition files exist
ls -la data/mods/positioning/conditions/event-is-action-straddle-waist-*.condition.json
ls -la data/mods/positioning/conditions/event-is-action-dismount-from-straddling.condition.json
```

## References

### JSON Logic Documentation
- Operators: `==`, `var`
- Event structure: `event.payload.actionId`
- CLAUDE.md - Validation section

### Similar Conditions
- `positioning:event-is-action-kneel-before`
- `positioning:event-is-action-bend-over`
- `positioning:event-is-action-sit-down`
- `positioning:event-is-action-get-up-from-furniture`

### Specification Reference
- Spec: `specs/straddling-waist-system.spec.md` (Section: Conditions)

## Notes

- Conditions are evaluated by the rule system
- Each condition maps 1:1 with a rule
- Conditions don't modify state, only evaluate
- Event structure must include `payload.actionId`
- These conditions enable rule triggering in STRWAISYS-004, STRWAISYS-005, STRWAISYS-006
