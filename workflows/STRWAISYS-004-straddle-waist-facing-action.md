# STRWAISYS-004: Straddle Waist Facing Action Implementation

**Status:** Ready for Implementation
**Priority:** High
**Estimated Effort:** 3-4 hours
**Dependencies:** STRWAISYS-001, STRWAISYS-002, STRWAISYS-003
**Blocks:** STRWAISYS-007

## Objective

Implement the "Straddle Waist (Facing)" action, allowing actors to straddle a sitting target's waist while facing them. Includes action definition, rule implementation, and comprehensive integration tests.

## Background

This is the first of two straddling action variants. It establishes the core straddling mechanics with facing orientation, serving as the foundation for the facing-away variant.

## Implementation Tasks

### 1. Create Action Definition

**File:** `data/mods/positioning/actions/straddle_waist_facing.action.json`

**Implementation:**
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:straddle_waist_facing",
  "name": "Straddle Waist (Facing)",
  "description": "Straddle the waist of a sitting actor while facing them",
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
      "positioning:straddling_waist"
    ]
  },
  "template": "straddle {target}'s waist while facing them",
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
- Uses modern target format with `primary` object
- Scope `positioning:actors_sitting_close` filters sitting actors in closeness
- Requires closeness on both actor and target
- Target must be sitting (`sitting_on` component)
- Forbids other positioning states on actor
- Standard prerequisites (movement, mouth availability)
- Uses positioning mod color scheme

### 2. Create Rule Implementation

**File:** `data/mods/positioning/rules/straddle_waist_facing.rule.json`

**Implementation:**
```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_straddle_waist_facing",
  "comment": "Handles the 'positioning:straddle_waist_facing' action. Adds straddling_waist component with facing_away=false, locks movement.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "positioning:event-is-action-straddle-waist-facing"
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
      "comment": "Add straddling_waist component with facing orientation",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:straddling_waist",
        "value": {
          "target_id": "{event.payload.targetId}",
          "facing_away": false
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
        "value": "{context.actorName} straddles {context.targetName}'s waist while facing them."
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
      "macro": "core:logSuccessAndEndTurn"
    }
  ]
}
```

**Design Notes:**
- Follows `kneel_before` pattern closely
- Sets `facing_away: false` in component
- Locks movement after straddling
- No closeness modification (already required)
- Uses standard macro for logging and turn end
- Dispatches perceptible event through macro

### 3. Create Action Discovery Tests

**File:** `tests/integration/mods/positioning/straddle_waist_facing_action_discovery.test.js`

**Test Structure:**
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Straddle Waist Facing - Action Discovery', () => {
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

    expect(actions).toContainAction('positioning:straddle_waist_facing');
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

    expect(actions).not.toContainAction('positioning:straddle_waist_facing');
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

    expect(actions).not.toContainAction('positioning:straddle_waist_facing');
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

    expect(actions).not.toContainAction('positioning:straddle_waist_facing');
  });

  it('should not appear when actor is sitting', () => {
    const actor = testBed.createActor('actor_1', {
      components: {
        'positioning:closeness': {
          partners: ['actor_2']
        },
        'positioning:sitting_on': {
          furniture_id: 'furniture:chair_1',
          seat_index: 0
        }
      }
    });

    const sittingTarget = testBed.createActor('actor_2', {
      components: {
        'positioning:sitting_on': {
          furniture_id: 'furniture:chair_1',
          seat_index: 1
        },
        'positioning:closeness': {
          partners: ['actor_1']
        }
      }
    });

    const actions = testBed.discoverActions(actor);

    expect(actions).not.toContainAction('positioning:straddle_waist_facing');
  });

  it('should not appear when actor is kneeling', () => {
    const actor = testBed.createActor('actor_1', {
      components: {
        'positioning:closeness': {
          partners: ['actor_2']
        },
        'positioning:kneeling_before': {
          target_id: 'actor_2'
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

    expect(actions).not.toContainAction('positioning:straddle_waist_facing');
  });

  it('should not appear when actor is bending over', () => {
    const actor = testBed.createActor('actor_1', {
      components: {
        'positioning:closeness': {
          partners: ['actor_2']
        },
        'positioning:bending_over': {
          target_id: 'actor_2'
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

    expect(actions).not.toContainAction('positioning:straddle_waist_facing');
  });

  it('should not appear when actor is lying down', () => {
    const actor = testBed.createActor('actor_1', {
      components: {
        'positioning:closeness': {
          partners: ['actor_2']
        },
        'positioning:lying_down': {
          surface_id: 'furniture:bed_1'
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

    expect(actions).not.toContainAction('positioning:straddle_waist_facing');
  });
});
```

### 4. Create Action Execution Tests

**File:** `tests/integration/mods/positioning/straddle_waist_facing_action.test.js`

**Test Structure:**
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Straddle Waist Facing - Action Execution', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  it('should add straddling_waist component with facing_away=false', () => {
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
      'positioning:straddle_waist_facing',
      actor,
      { target: target.id }
    );

    const straddlingComponent = testBed.getComponent(
      actor,
      'positioning:straddling_waist'
    );

    expect(straddlingComponent).toBeDefined();
    expect(straddlingComponent.target_id).toBe(target.id);
    expect(straddlingComponent.facing_away).toBe(false);
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
      'positioning:straddle_waist_facing',
      actor,
      { target: target.id }
    );

    const movementLocked = testBed.getComponent(
      actor,
      'movement:movement_locked'
    );

    expect(movementLocked).toBeDefined();
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
      'positioning:straddle_waist_facing',
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
      'positioning:straddle_waist_facing',
      actor,
      { target: target.id }
    );

    expect(result.logMessage).toContain('straddles');
    expect(result.logMessage).toContain('waist');
    expect(result.logMessage).toContain('facing them');
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
      'positioning:straddle_waist_facing',
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
      'positioning:straddle_waist_facing',
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

  it('should not add facing_away component', () => {
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
      'positioning:straddle_waist_facing',
      actor,
      { target: target.id }
    );

    const facingAwayComponent = testBed.getComponent(
      actor,
      'positioning:facing_away'
    );

    expect(facingAwayComponent).toBeUndefined();
  });
});
```

## Design Decisions

### Component Data

**Decision:** Set `facing_away: false` in component
**Rationale:**
- Explicit orientation tracking
- Primary source of truth
- Simplifies queries
- No need for separate component check

### Movement Locking

**Decision:** Lock movement after straddling
**Rationale:**
- Prevents invalid state transitions
- Consistent with other positioning actions
- Actor must dismount before moving
- Enforces physical constraint

### Closeness Handling

**Decision:** Don't modify closeness
**Rationale:**
- Already required by action
- No need to add/remove
- Simplifies state management
- Follows existing pattern

## Testing Strategy

### Action Discovery Tests
- Action appears with correct conditions
- Action doesn't appear with missing requirements
- Action doesn't appear with forbidden components
- All positioning states tested

### Action Execution Tests
- Component added correctly
- Movement locked correctly
- Target state preserved
- Log message generated
- Perceptible event dispatched
- Closeness preserved
- No facing_away component added

### Manual Testing
```bash
# Run discovery tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/positioning/straddle_waist_facing_action_discovery.test.js --verbose

# Run execution tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/positioning/straddle_waist_facing_action.test.js --verbose
```

## Acceptance Criteria

- [ ] Action file created with correct schema
- [ ] Action uses modern target format
- [ ] Action has all required components
- [ ] Action has all forbidden components
- [ ] Rule file created with correct operations
- [ ] Rule sets facing_away to false
- [ ] Rule locks movement
- [ ] Action discovery tests created and pass
- [ ] Action execution tests created and pass
- [ ] All integration tests pass
- [ ] No eslint errors

## Verification Commands

```bash
# Run action discovery tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/positioning/straddle_waist_facing_action_discovery.test.js --verbose

# Run action execution tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/positioning/straddle_waist_facing_action.test.js --verbose

# Run all straddling tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/positioning/straddle_waist* --silent

# Lint modified files
npx eslint data/mods/positioning/actions/straddle_waist_facing.action.json data/mods/positioning/rules/straddle_waist_facing.rule.json
```

## References

### Similar Actions
- `positioning:kneel_before` - Target tracking with movement lock
- `positioning:bend_over` - Component-based state with movement lock
- `positioning:sit_down` - Movement locking pattern

### Operation Handlers
- `ADD_COMPONENT` - Add straddling_waist component
- `LOCK_MOVEMENT` - Lock actor movement
- `GET_NAME` - Get entity names for logging
- `QUERY_COMPONENT` - Get position data
- `SET_VARIABLE` - Set logging variables
- `core:logSuccessAndEndTurn` macro

### Specification Reference
- Spec: `specs/straddling-waist-system.spec.md` (Sections: Action 1, Rule 1)

## Notes

- This action serves as foundation for STRWAISYS-005 (facing away variant)
- Component structure established here is reused by facing away action
- Movement locking pattern is consistent across both actions
- Integration tests establish baseline behavior for edge case testing
