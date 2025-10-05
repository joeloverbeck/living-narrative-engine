# STRWAISYS-006: Dismount from Straddling Action Implementation

**Status:** Ready for Implementation
**Priority:** High
**Estimated Effort:** 3-4 hours
**Dependencies:** STRWAISYS-001, STRWAISYS-002, STRWAISYS-003, STRWAISYS-004, STRWAISYS-005
**Blocks:** STRWAISYS-007

## Objective

Implement the "Dismount from Straddling" action, allowing actors to stop straddling and return to standing position. This single action handles both facing and facing-away orientations through conditional component removal.

## Background

This action completes the straddling system by providing the exit mechanism. It must handle cleanup for both straddling orientations, conditionally removing the `facing_away` component only when `facing_away=true`.

## Implementation Tasks

### 1. Create Action Definition

**File:** `data/mods/positioning/actions/dismount_from_straddling.action.json`

**Implementation:**
```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:dismount_from_straddling",
  "name": "Dismount",
  "description": "Stop straddling and return to standing position",
  "targets": {
    "primary": {
      "scope": "positioning:actor_im_straddling",
      "placeholder": "target",
      "description": "Actor you're straddling"
    }
  },
  "required_components": {
    "actor": ["positioning:straddling_waist"]
  },
  "forbidden_components": {
    "actor": []
  },
  "template": "dismount from straddling {target}",
  "prerequisites": [
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
- Requires actor to have `straddling_waist` component
- Target identified via `actor_im_straddling` scope (reads `target_id` from component)
- Simpler prerequisites than straddling actions (only mouth availability)
- No movement requirement (dismounting always allowed)
- Single action handles both orientations

### 2. Create Rule Implementation

**File:** `data/mods/positioning/rules/dismount_from_straddling.rule.json`

**Implementation:**
```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_dismount_from_straddling",
  "comment": "Handles the 'positioning:dismount_from_straddling' action. Removes straddling_waist component, removes facing_away if present, unlocks movement.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "positioning:event-is-action-dismount-from-straddling"
  },
  "actions": [
    {
      "type": "QUERY_COMPONENT",
      "comment": "Get straddling_waist data to check orientation",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:straddling_waist",
        "result_variable": "straddlingData"
      }
    },
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
      "type": "REMOVE_COMPONENT",
      "comment": "Remove straddling_waist component",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:straddling_waist"
      }
    },
    {
      "type": "IF",
      "comment": "Remove facing_away component if actor was facing away",
      "parameters": {
        "condition": {
          "var": "context.straddlingData.facing_away"
        },
        "then_actions": [
          {
            "type": "REMOVE_COMPONENT",
            "parameters": {
              "entity_ref": "actor",
              "component_type": "positioning:facing_away"
            }
          }
        ]
      }
    },
    {
      "type": "UNLOCK_MOVEMENT",
      "comment": "Unlock movement after dismounting",
      "parameters": {
        "actor_id": "{event.payload.actorId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} dismounts from straddling {context.targetName}."
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
- Queries `straddling_waist` component first to check `facing_away` boolean
- Always removes `straddling_waist` component
- Conditionally removes `facing_away` component using IF operation
- Unlocks movement to return actor to normal state
- Single rule handles both orientations cleanly
- Follows `get_up_from_furniture` cleanup pattern

### 3. Create Action Discovery Tests

**File:** `tests/integration/mods/positioning/dismount_from_straddling_action_discovery.test.js`

**Test Structure:**
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Dismount from Straddling - Action Discovery', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  it('should appear when actor has straddling_waist component (facing)', () => {
    const actor = testBed.createActor('actor_1', {
      components: {
        'positioning:straddling_waist': {
          target_id: 'actor_2',
          facing_away: false
        }
      }
    });

    const target = testBed.createActor('actor_2', {
      components: {
        'positioning:sitting_on': {
          furniture_id: 'furniture:chair_1',
          seat_index: 0
        }
      }
    });

    const actions = testBed.discoverActions(actor);

    expect(actions).toContainAction('positioning:dismount_from_straddling');
  });

  it('should appear when actor has straddling_waist component (facing away)', () => {
    const actor = testBed.createActor('actor_1', {
      components: {
        'positioning:straddling_waist': {
          target_id: 'actor_2',
          facing_away: true
        },
        'positioning:facing_away': {
          facing_away_from: ['actor_2']
        }
      }
    });

    const target = testBed.createActor('actor_2', {
      components: {
        'positioning:sitting_on': {
          furniture_id: 'furniture:chair_1',
          seat_index: 0
        }
      }
    });

    const actions = testBed.discoverActions(actor);

    expect(actions).toContainAction('positioning:dismount_from_straddling');
  });

  it('should not appear when actor is not straddling', () => {
    const actor = testBed.createActor('actor_1', {
      components: {}
    });

    const actions = testBed.discoverActions(actor);

    expect(actions).not.toContainAction('positioning:dismount_from_straddling');
  });

  it('should correctly identify target from straddling_waist.target_id', () => {
    const actor = testBed.createActor('actor_1', {
      components: {
        'positioning:straddling_waist': {
          target_id: 'actor_2',
          facing_away: false
        }
      }
    });

    const target = testBed.createActor('actor_2', {
      components: {}
    });

    const otherActor = testBed.createActor('actor_3', {
      components: {}
    });

    const actions = testBed.discoverActions(actor);
    const dismountAction = actions.find(
      a => a.id === 'positioning:dismount_from_straddling'
    );

    expect(dismountAction).toBeDefined();
    expect(dismountAction.targets.primary).toBe(target.id);
  });

  it('should appear even when mouth is engaged (will fail at execution)', () => {
    const actor = testBed.createActor('actor_1', {
      components: {
        'positioning:straddling_waist': {
          target_id: 'actor_2',
          facing_away: false
        },
        'core:mouth_engaged': {
          engaged_with: 'actor_3'
        }
      }
    });

    const target = testBed.createActor('actor_2', {
      components: {}
    });

    const actions = testBed.discoverActions(actor);

    // Action appears during discovery (prerequisites checked at execution)
    expect(actions).toContainAction('positioning:dismount_from_straddling');
  });
});
```

### 4. Create Action Execution Tests

**File:** `tests/integration/mods/positioning/dismount_from_straddling_action.test.js`

**Test Structure:**
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { createTestBed } from '../../../common/testBed.js';

describe('Dismount from Straddling - Action Execution', () => {
  let testBed;

  beforeEach(() => {
    testBed = createTestBed();
  });

  describe('Facing orientation', () => {
    it('should remove straddling_waist component', () => {
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:straddling_waist': {
            target_id: 'actor_2',
            facing_away: false
          }
        }
      });

      const target = testBed.createActor('actor_2', {
        components: {
          'positioning:sitting_on': {
            furniture_id: 'furniture:chair_1',
            seat_index: 0
          }
        }
      });

      testBed.executeAction(
        'positioning:dismount_from_straddling',
        actor,
        { target: target.id }
      );

      const straddlingComponent = testBed.getComponent(
        actor,
        'positioning:straddling_waist'
      );

      expect(straddlingComponent).toBeUndefined();
    });

    it('should not remove facing_away component when facing_away=false', () => {
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:straddling_waist': {
            target_id: 'actor_2',
            facing_away: false
          }
        }
      });

      const target = testBed.createActor('actor_2', {
        components: {}
      });

      testBed.executeAction(
        'positioning:dismount_from_straddling',
        actor,
        { target: target.id }
      );

      const facingAwayComponent = testBed.getComponent(
        actor,
        'positioning:facing_away'
      );

      // Should remain undefined (never was added)
      expect(facingAwayComponent).toBeUndefined();
    });

    it('should unlock actor movement', () => {
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:straddling_waist': {
            target_id: 'actor_2',
            facing_away: false
          },
          'movement:movement_locked': {}
        }
      });

      const target = testBed.createActor('actor_2', {
        components: {}
      });

      testBed.executeAction(
        'positioning:dismount_from_straddling',
        actor,
        { target: target.id }
      );

      const movementLocked = testBed.getComponent(
        actor,
        'movement:movement_locked'
      );

      expect(movementLocked).toBeUndefined();
    });
  });

  describe('Facing away orientation', () => {
    it('should remove both straddling_waist and facing_away components', () => {
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:straddling_waist': {
            target_id: 'actor_2',
            facing_away: true
          },
          'positioning:facing_away': {
            facing_away_from: ['actor_2']
          }
        }
      });

      const target = testBed.createActor('actor_2', {
        components: {}
      });

      testBed.executeAction(
        'positioning:dismount_from_straddling',
        actor,
        { target: target.id }
      );

      const straddlingComponent = testBed.getComponent(
        actor,
        'positioning:straddling_waist'
      );
      const facingAwayComponent = testBed.getComponent(
        actor,
        'positioning:facing_away'
      );

      expect(straddlingComponent).toBeUndefined();
      expect(facingAwayComponent).toBeUndefined();
    });

    it('should unlock actor movement', () => {
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:straddling_waist': {
            target_id: 'actor_2',
            facing_away: true
          },
          'positioning:facing_away': {
            facing_away_from: ['actor_2']
          },
          'movement:movement_locked': {}
        }
      });

      const target = testBed.createActor('actor_2', {
        components: {}
      });

      testBed.executeAction(
        'positioning:dismount_from_straddling',
        actor,
        { target: target.id }
      );

      const movementLocked = testBed.getComponent(
        actor,
        'movement:movement_locked'
      );

      expect(movementLocked).toBeUndefined();
    });
  });

  describe('Common behavior', () => {
    it('should keep target sitting with movement locked', () => {
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:straddling_waist': {
            target_id: 'actor_2',
            facing_away: false
          }
        }
      });

      const target = testBed.createActor('actor_2', {
        components: {
          'positioning:sitting_on': {
            furniture_id: 'furniture:chair_1',
            seat_index: 0
          },
          'movement:movement_locked': {}
        }
      });

      testBed.executeAction(
        'positioning:dismount_from_straddling',
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
          'positioning:straddling_waist': {
            target_id: 'actor_2',
            facing_away: false
          }
        }
      });

      const target = testBed.createActor('actor_2', {
        components: {}
      });

      const result = testBed.executeAction(
        'positioning:dismount_from_straddling',
        actor,
        { target: target.id }
      );

      expect(result.logMessage).toContain('dismounts');
      expect(result.logMessage).toContain('straddling');
    });

    it('should keep both actors in closeness circle', () => {
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:straddling_waist': {
            target_id: 'actor_2',
            facing_away: false
          },
          'positioning:closeness': {
            partners: ['actor_2']
          }
        }
      });

      const target = testBed.createActor('actor_2', {
        components: {
          'positioning:closeness': {
            partners: ['actor_1']
          }
        }
      });

      testBed.executeAction(
        'positioning:dismount_from_straddling',
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

    it('should dispatch perceptible event', () => {
      const actor = testBed.createActor('actor_1', {
        components: {
          'positioning:straddling_waist': {
            target_id: 'actor_2',
            facing_away: false
          }
        }
      });

      const target = testBed.createActor('actor_2', {
        components: {}
      });

      testBed.executeAction(
        'positioning:dismount_from_straddling',
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
  });

  describe('Conditional cleanup validation', () => {
    it('should handle facing_away component presence correctly', () => {
      // Test that conditional IF logic works
      const testCases = [
        {
          name: 'facing (no facing_away component)',
          facing_away: false,
          hasFacingAwayComponent: false,
          shouldRemoveFacingAway: false
        },
        {
          name: 'facing away (has facing_away component)',
          facing_away: true,
          hasFacingAwayComponent: true,
          shouldRemoveFacingAway: true
        }
      ];

      testCases.forEach(testCase => {
        const actor = testBed.createActor('actor_1', {
          components: {
            'positioning:straddling_waist': {
              target_id: 'actor_2',
              facing_away: testCase.facing_away
            },
            ...(testCase.hasFacingAwayComponent && {
              'positioning:facing_away': {
                facing_away_from: ['actor_2']
              }
            })
          }
        });

        const target = testBed.createActor('actor_2', {
          components: {}
        });

        testBed.executeAction(
          'positioning:dismount_from_straddling',
          actor,
          { target: target.id }
        );

        const facingAwayComponent = testBed.getComponent(
          actor,
          'positioning:facing_away'
        );

        if (testCase.shouldRemoveFacingAway) {
          expect(facingAwayComponent).toBeUndefined();
        } else {
          expect(facingAwayComponent).toBeUndefined();
        }
      });
    });
  });
});
```

## Design Decisions

### Conditional Component Removal

**Decision:** Use IF operation to conditionally remove `facing_away` component
**Rationale:**
- Single rule handles both orientations
- Clean conditional logic
- No duplicate code
- Follows DRY principle
- Query component data to determine orientation

**Alternative Considered:** Separate rules for each orientation
**Rejected Because:**
- Code duplication
- Two rules for one action
- Unnecessary complexity
- Harder to maintain

### Target Identification

**Decision:** Use `actor_im_straddling` scope to identify target
**Rationale:**
- Target ID stored in `straddling_waist` component
- Scope query handles ID lookup
- Consistent with other dismount actions
- No need for actor to remember target

### Movement Unlocking

**Decision:** Always unlock movement on dismount
**Rationale:**
- Actor should be able to move after dismounting
- Return to normal state
- Consistent with other positioning actions
- No dependencies on orientation

### No Closeness Modification

**Decision:** Don't modify closeness on dismount
**Rationale:**
- Actors remain close after dismounting
- Closeness is separate from straddling
- Actor can step back if desired
- Follows existing pattern

## Testing Strategy

### Action Discovery Tests
- Action appears with `straddling_waist` component (both orientations)
- Action doesn't appear without component
- Target correctly identified from component

### Action Execution Tests
- `straddling_waist` component removed (both orientations)
- `facing_away` component removed only when `facing_away=true`
- Movement unlocked (both orientations)
- Target state preserved (sitting, movement locked)
- Log message generated
- Perceptible event dispatched
- Closeness preserved
- Conditional cleanup validated

### Manual Testing
```bash
# Run discovery tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/positioning/dismount_from_straddling_action_discovery.test.js --verbose

# Run execution tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/positioning/dismount_from_straddling_action.test.js --verbose
```

## Acceptance Criteria

- [ ] Action file created with correct schema
- [ ] Action requires `straddling_waist` component
- [ ] Action uses `actor_im_straddling` scope
- [ ] Rule file created with correct operations
- [ ] Rule queries component for orientation
- [ ] Rule uses IF operation for conditional removal
- [ ] Rule always removes `straddling_waist`
- [ ] Rule conditionally removes `facing_away`
- [ ] Rule unlocks movement
- [ ] Action discovery tests created and pass
- [ ] Action execution tests created and pass
- [ ] Conditional cleanup validated
- [ ] All integration tests pass
- [ ] No eslint errors

## Verification Commands

```bash
# Run action discovery tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/positioning/dismount_from_straddling_action_discovery.test.js --verbose

# Run action execution tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/positioning/dismount_from_straddling_action.test.js --verbose

# Run all dismount tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/positioning/dismount_from_straddling* --silent

# Run all straddling tests
NODE_ENV=test npm run test:integration -- tests/integration/mods/positioning/straddle* tests/integration/mods/positioning/dismount* --silent

# Lint modified files
npx eslint data/mods/positioning/actions/dismount_from_straddling.action.json data/mods/positioning/rules/dismount_from_straddling.rule.json
```

## References

### Similar Actions
- `positioning:get_up_from_furniture` - Cleanup pattern with component removal
- `positioning:stand_up_from_kneeling` - Movement unlocking pattern
- `positioning:turn_around_from_facing_away` - Orientation state cleanup

### Operation Handlers
- `QUERY_COMPONENT` - Get straddling data for orientation check
- `REMOVE_COMPONENT` - Remove components
- `IF` - Conditional component removal
- `UNLOCK_MOVEMENT` - Unlock actor movement
- All standard handlers from STRWAISYS-004, STRWAISYS-005

### Specification Reference
- Spec: `specs/straddling-waist-system.spec.md` (Sections: Action 3, Rule 3)

## Notes

- This action completes the straddling system
- Conditional cleanup is critical for correct state management
- Single action handles both orientations elegantly
- Movement unlocking returns actor to normal state
- Closeness preserved allows actors to remain close
- Target state unchanged (still sitting and locked)
