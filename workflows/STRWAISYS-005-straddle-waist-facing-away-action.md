# STRWAISYS-005: Straddle Waist Facing Away Action Implementation

**Status:** Ready for Implementation
**Priority:** High
**Estimated Effort:** 3-4 hours
**Dependencies:** STRWAISYS-001, STRWAISYS-002, STRWAISYS-003, STRWAISYS-004
**Blocks:** STRWAISYS-007

## Objective

Implement the "Straddle Waist (Facing Away)" action, allowing actors to straddle a sitting target's waist while facing away from them. This variant adds the `facing_away` component and dispatches an orientation change event.

## Background

This is the second straddling action variant, building on STRWAISYS-004. It introduces orientation tracking via the `facing_away` component and follows the `turn_your_back` pattern for orientation state management.

## Implementation Tasks

### 1. Create Action Definition

**File:** `data/mods/positioning/actions/straddle_waist_facing_away.action.json`

**Implementation:**
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:straddle_waist_facing_away",
  "name": "Straddle Waist (Facing Away)",
  "description": "Straddle the waist of a sitting actor while facing away from them",
  "targets": {
    "primary": {
      "scope": "positioning:actors_sitting_close",
      "placeholder": "target",
      "description": "Sitting actor to straddle"
    }
  },
  "required_components": {
    "actor": ["positioning:closeness"],
    "target": ["positioning:sitting_on", "positioning:closeness"]
  },
  "forbidden_components": {
    "actor": [
      "positioning:sitting_on",
      "positioning:kneeling_before",
      "positioning:bending_over",
      "positioning:lying_down",
      "positioning:straddling_waist",
      "positioning:facing_away"
    ]
  },
  "template": "straddle {target}'s waist while facing away",
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "movement:actor-can-move"
      },
      "failure_message": "You cannot move without functioning legs."
    },
    {
      "logic": {
        "condition_ref": "core:actor-mouth-available"
      },
      "failure_message": "You cannot do that while your mouth is engaged."
    }
  ],
  "visual": {
    "backgroundColor": "#bf360c",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#8d2c08",
    "hoverTextColor": "#ffffff"
  }
}
```

**Design Notes:**
- Identical to facing variant except for two differences:
  1. Adds `positioning:facing_away` to forbidden components
  2. Template says "facing away" instead of "facing them"
- Forbidden `facing_away` component will be added by rule
- Same scope, prerequisites, and requirements

### 2. Create Rule Implementation

**File:** `data/mods/positioning/rules/straddle_waist_facing_away.rule.json`

**Implementation:**
```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_straddle_waist_facing_away",
  "comment": "Handles the 'positioning:straddle_waist_facing_away' action. Adds straddling_waist component with facing_away=true, adds facing_away component, locks movement.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "positioning:event-is-action-straddle-waist-facing-away"
  },
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "actor",
        "result_variable": "actorName"
      }
    },
    {
      "type": "GET_NAME",
      "parameters": {
        "entity_ref": "target",
        "result_variable": "targetName"
      }
    },
    {
      "type": "QUERY_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:position",
        "result_variable": "actorPosition"
      }
    },
    {
      "type": "ADD_COMPONENT",
      "comment": "Add straddling_waist component with facing_away orientation",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:straddling_waist",
        "value": {
          "target_id": "{event.payload.targetId}",
          "facing_away": true
        }
      }
    },
    {
      "type": "ADD_COMPONENT",
      "comment": "Add facing_away component to track orientation",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:facing_away",
        "value": {
          "facing_away_from": ["{event.payload.targetId}"]
        }
      }
    },
    {
      "type": "LOCK_MOVEMENT",
      "comment": "Lock movement while straddling",
      "parameters": {
        "actor_id": "{event.payload.actorId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} straddles {context.targetName}'s waist while facing away."
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "perceptionType",
        "value": "action_target_general"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "locationId",
        "value": "{context.actorPosition.locationId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "targetId",
        "value": "{event.payload.targetId}"
      }
    },
    {
      "type": "DISPATCH_EVENT",
      "comment": "Dispatch event for facing_away state change",
      "parameters": {
        "eventType": "positioning:actor_turned_back",
        "payload": {
          "actor": "{event.payload.actorId}",
          "target": "{event.payload.targetId}"
        }
      }
    },
    {
      "macro": "core:logSuccessAndEndTurn"
    }
  ]
}
```

**Design Notes:**
- Similar to facing variant but adds TWO components
- `straddling_waist` with `facing_away: true`
- `facing_away` component for orientation tracking
- Dispatches `positioning:actor_turned_back` event (like `turn_your_back` action)
- Both components must be cleaned up when dismounting

### 3. Create Action Discovery Tests

**File:** `tests/integration/mods/positioning/straddle_waist_facing_away_action_discovery.test.js`

**Test Structure:**
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Straddle Waist Facing Away - Action Discovery', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  it('should appear when actor is close to sitting target', () => {
    const actor = testBed.createActor('actor_1', {
      components: {
        'positioning:closeness': {
          partners: ['actor_2']
        }
      }
    });

    const sittingTarget = testBed.createActor('actor_2', {
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

    const actions = testBed.discoverActions(actor);

    expect(actions).toContainAction('positioning:straddle_waist_facing_away');
  });

  it('should not appear when actor already has facing_away component', () => {
    const actor = testBed.createActor('actor_1', {
      components: {
        'positioning:closeness': {
          partners: ['actor_2']
        },
        'positioning:facing_away': {
          facing_away_from: ['actor_3']
        }
      }
    });

    const sittingTarget = testBed.createActor('actor_2', {
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

    const actions = testBed.discoverActions(actor);

    expect(actions).not.toContainAction('positioning:straddle_waist_facing_away');
  });

  it('should not appear when not close to target', () => {
    const actor = testBed.createActor('actor_1', {
      components: {}
    });

    const sittingTarget = testBed.createActor('actor_2', {
      components: {
        'positioning:sitting_on': {
          furniture_id: 'furniture:chair_1',
          seat_index: 0
        }
      }
    });

    const actions = testBed.discoverActions(actor);

    expect(actions).not.toContainAction('positioning:straddle_waist_facing_away');
  });

  it('should not appear when target is not sitting', () => {
    const actor = testBed.createActor('actor_1', {
      components: {
        'positioning:closeness': {
          partners: ['actor_2']
        }
      }
    });

    const standingTarget = testBed.createActor('actor_2', {
      components: {
        'positioning:closeness': {
          partners: ['actor_1']
        }
      }
    });

    const actions = testBed.discoverActions(actor);

    expect(actions).not.toContainAction('positioning:straddle_waist_facing_away');
  });

  it('should not appear when actor is already straddling', () => {
    const actor = testBed.createActor('actor_1', {
      components: {
        'positioning:closeness': {
          partners: ['actor_2']
        },
        'positioning:straddling_waist': {
          target_id: 'actor_2',
          facing_away: false
        }
      }
    });

    const sittingTarget = testBed.createActor('actor_2', {
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

    const actions = testBed.discoverActions(actor);

    expect(actions).not.toContainAction('positioning:straddle_waist_facing_away');
  });

  it('should not appear when actor has other forbidden positioning components', () => {
    const testCases = [
      'positioning:sitting_on',
      'positioning:kneeling_before',
      'positioning:bending_over',
      'positioning:lying_down'
    ];

    testCases.forEach(forbiddenComponent => {
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:closeness': {
            partners: ['actor_2']
          },
          [forbiddenComponent]: {} // Component data doesn't matter for discovery
        }
      });

      const sittingTarget = testBed.createActor('actor_2', {
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

      const actions = testBed.discoverActions(actor);

      expect(actions).not.toContainAction('positioning:straddle_waist_facing_away');
    });
  });
});
```

### 4. Create Action Execution Tests

**File:** `tests/integration/mods/positioning/straddle_waist_facing_away_action.test.js`

**Test Structure:**
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Straddle Waist Facing Away - Action Execution', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  it('should add straddling_waist component with facing_away=true', () => {
    const actor = testBed.createActor('actor_1', {
      components: {
        'positioning:closeness': {
          partners: ['actor_2']
        }
      }
    });

    const target = testBed.createActor('actor_2', {
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

    testBed.executeAction(
      'positioning:straddle_waist_facing_away',
      actor,
      { target: target.id }
    );

    const straddlingComponent = testBed.getComponent(
      actor,
      'positioning:straddling_waist'
    );

    expect(straddlingComponent).toBeDefined();
    expect(straddlingComponent.target_id).toBe(target.id);
    expect(straddlingComponent.facing_away).toBe(true);
  });

  it('should add facing_away component with target in array', () => {
    const actor = testBed.createActor('actor_1', {
      components: {
        'positioning:closeness': {
          partners: ['actor_2']
        }
      }
    });

    const target = testBed.createActor('actor_2', {
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

    testBed.executeAction(
      'positioning:straddle_waist_facing_away',
      actor,
      { target: target.id }
    );

    const facingAwayComponent = testBed.getComponent(
      actor,
      'positioning:facing_away'
    );

    expect(facingAwayComponent).toBeDefined();
    expect(facingAwayComponent.facing_away_from).toContain(target.id);
  });

  it('should lock actor movement', () => {
    const actor = testBed.createActor('actor_1', {
      components: {
        'positioning:closeness': {
          partners: ['actor_2']
        }
      }
    });

    const target = testBed.createActor('actor_2', {
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

    testBed.executeAction(
      'positioning:straddle_waist_facing_away',
      actor,
      { target: target.id }
    );

    const movementLocked = testBed.getComponent(
      actor,
      'movement:movement_locked'
    );

    expect(movementLocked).toBeDefined();
  });

  it('should dispatch positioning:actor_turned_back event', () => {
    const actor = testBed.createActor('actor_1', {
      components: {
        'positioning:closeness': {
          partners: ['actor_2']
        }
      }
    });

    const target = testBed.createActor('actor_2', {
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

    testBed.executeAction(
      'positioning:straddle_waist_facing_away',
      actor,
      { target: target.id }
    );

    const events = testBed.getDispatchedEvents();
    const turnedBackEvent = events.find(
      e => e.type === 'positioning:actor_turned_back'
    );

    expect(turnedBackEvent).toBeDefined();
    expect(turnedBackEvent.payload.actor).toBe(actor.id);
    expect(turnedBackEvent.payload.target).toBe(target.id);
  });

  it('should generate correct log message', () => {
    const actor = testBed.createActor('actor_1', {
      components: {
        'positioning:closeness': {
          partners: ['actor_2']
        }
      }
    });

    const target = testBed.createActor('actor_2', {
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

    const result = testBed.executeAction(
      'positioning:straddle_waist_facing_away',
      actor,
      { target: target.id }
    );

    expect(result.logMessage).toContain('straddles');
    expect(result.logMessage).toContain('waist');
    expect(result.logMessage).toContain('facing away');
  });

  it('should keep both actors in closeness circle', () => {
    const actor = testBed.createActor('actor_1', {
      components: {
        'positioning:closeness': {
          partners: ['actor_2']
        }
      }
    });

    const target = testBed.createActor('actor_2', {
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

    testBed.executeAction(
      'positioning:straddle_waist_facing_away',
      actor,
      { target: target.id }
    );

    const actorCloseness = testBed.getComponent(
      actor,
      'positioning:closeness'
    );
    const targetCloseness = testBed.getComponent(
      target,
      'positioning:closeness'
    );

    expect(actorCloseness).toBeDefined();
    expect(actorCloseness.partners).toContain(target.id);
    expect(targetCloseness).toBeDefined();
    expect(targetCloseness.partners).toContain(actor.id);
  });

  it('should keep target sitting with movement locked', () => {
    const actor = testBed.createActor('actor_1', {
      components: {
        'positioning:closeness': {
          partners: ['actor_2']
        }
      }
    });

    const target = testBed.createActor('actor_2', {
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

    testBed.executeAction(
      'positioning:straddle_waist_facing_away',
      actor,
      { target: target.id }
    );

    const sittingComponent = testBed.getComponent(
      target,
      'positioning:sitting_on'
    );
    const targetMovementLocked = testBed.getComponent(
      target,
      'movement:movement_locked'
    );

    expect(sittingComponent).toBeDefined();
    expect(targetMovementLocked).toBeDefined();
  });

  it('should dispatch perceptible event', () => {
    const actor = testBed.createActor('actor_1', {
      components: {
        'positioning:closeness': {
          partners: ['actor_2']
        }
      }
    });

    const target = testBed.createActor('actor_2', {
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

    testBed.executeAction(
      'positioning:straddle_waist_facing_away',
      actor,
      { target: target.id }
    );

    const events = testBed.getDispatchedEvents();
    const perceptionEvent = events.find(
      e => e.type === 'core:perceptible_event'
    );

    expect(perceptionEvent).toBeDefined();
    expect(perceptionEvent.payload.perceptionType).toBe('action_target_general');
  });

  it('should add both components atomically', () => {
    const actor = testBed.createActor('actor_1', {
      components: {
        'positioning:closeness': {
          partners: ['actor_2']
        }
      }
    });

    const target = testBed.createActor('actor_2', {
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

    testBed.executeAction(
      'positioning:straddle_waist_facing_away',
      actor,
      { target: target.id }
    );

    // Both components should be present
    const straddlingComponent = testBed.getComponent(
      actor,
      'positioning:straddling_waist'
    );
    const facingAwayComponent = testBed.getComponent(
      actor,
      'positioning:facing_away'
    );

    expect(straddlingComponent).toBeDefined();
    expect(facingAwayComponent).toBeDefined();

    // Verify consistency
    expect(straddlingComponent.facing_away).toBe(true);
    expect(facingAwayComponent.facing_away_from).toContain(target.id);
  });
});
```

## Design Decisions

### Dual Component System

**Decision:** Add both `straddling_waist` AND `facing_away` components
**Rationale:**
- `straddling_waist.facing_away` is primary source of truth
- `facing_away` component maintains consistency with `turn_your_back` pattern
- Enables queries that filter by orientation
- Both components must be cleaned up together

**Alternative Considered:** Only use `straddling_waist.facing_away` boolean
**Rejected Because:**
- Breaks consistency with existing orientation tracking
- Existing scopes/queries expect `facing_away` component
- Would require special-case handling

### Event Dispatching

**Decision:** Dispatch `positioning:actor_turned_back` event
**Rationale:**
- Consistent with `turn_your_back` action
- Allows reactive rules to respond to orientation change
- Future-proof for additional orientation-based logic
- Matches existing pattern

### Forbidden Component

**Decision:** Forbid `facing_away` component in action
**Rationale:**
- Actor can't already be facing away from someone else
- Rule will add the component
- Prevents duplicate orientation state
- Clear error message if attempted

## Testing Strategy

### Action Discovery Tests
- Same as facing variant
- Additional test for `facing_away` forbidden component
- Verify all positioning states prevent action

### Action Execution Tests
- Component added with `facing_away: true`
- `facing_away` component added correctly
- Movement locked correctly
- Event dispatched correctly
- Both components added atomically
- Log message reflects orientation
- Target state preserved
- Closeness preserved

### Manual Testing
```bash
# Run discovery tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/positioning/straddle_waist_facing_away_action_discovery.test.js --verbose

# Run execution tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/positioning/straddle_waist_facing_away_action.test.js --verbose
```

## Acceptance Criteria

- [ ] Action file created with correct schema
- [ ] Action forbids `facing_away` component
- [ ] Action uses modern target format
- [ ] Rule file created with correct operations
- [ ] Rule sets facing_away to true
- [ ] Rule adds `facing_away` component
- [ ] Rule dispatches `actor_turned_back` event
- [ ] Action discovery tests created and pass
- [ ] Action execution tests created and pass
- [ ] Both components added atomically
- [ ] All integration tests pass
- [ ] No eslint errors

## Verification Commands

```bash
# Run action discovery tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/positioning/straddle_waist_facing_away_action_discovery.test.js --verbose

# Run action execution tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/positioning/straddle_waist_facing_away_action.test.js --verbose

# Run all straddling tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/positioning/straddle_waist* --silent

# Lint modified files
npx eslint data/mods/positioning/actions/straddle_waist_facing_away.action.json data/mods/positioning/rules/straddle_waist_facing_away.rule.json
```

## References

### Similar Actions
- `positioning:turn_your_back` - `facing_away` component pattern
- `positioning:straddle_waist_facing` - Base straddling action
- `positioning:kneel_before` - Target tracking pattern

### Operation Handlers
- `ADD_COMPONENT` - Add both components
- `DISPATCH_EVENT` - Orientation change event
- `LOCK_MOVEMENT` - Lock actor movement
- All standard handlers from STRWAISYS-004

### Specification Reference
- Spec: `specs/straddling-waist-system.spec.md` (Sections: Action 2, Rule 2)

## Notes

- This action builds on STRWAISYS-004 foundation
- Dual component system requires careful cleanup (STRWAISYS-006)
- Event dispatching enables reactive orientation-based rules
- Atomic component addition ensures consistent state
