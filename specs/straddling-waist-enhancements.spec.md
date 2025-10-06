# Straddling Waist System Enhancements Specification

**Created:** 2025-01-XX
**Status:** Design
**Mod:** positioning
**Base Spec:** [straddling-waist-system.spec.md](./straddling-waist-system.spec.md)

## Table of Contents

1. [System Overview](#system-overview)
2. [Enhancement Categories](#enhancement-categories)
3. [High Priority: Turn Around Verification](#high-priority-turn-around-verification)
4. [Medium Priority: Auto-Dismount Scenarios](#medium-priority-auto-dismount-scenarios)
5. [Low Priority: Additional Features](#low-priority-additional-features)
6. [Very Low Priority: System Integrations](#very-low-priority-system-integrations)
7. [Testing Strategy](#testing-strategy)
8. [Implementation Roadmap](#implementation-roadmap)
9. [References](#references)

---

## System Overview

### Purpose

This specification defines enhancements to the existing straddling waist system to handle edge cases, improve robustness, and expand functionality. All enhancements are **additive** and maintain backward compatibility with the current implementation.

### Current Implementation Status

The base straddling waist system is **fully implemented** with:
- ✅ Component: `positioning:straddling_waist`
- ✅ Actions: `straddle_waist_facing`, `straddle_waist_facing_away`, `dismount_from_straddling`
- ✅ Rules: Complete rule implementations for all three actions
- ✅ Scopes: `actors_sitting_close`, `actor_im_straddling`
- ✅ Tests: Integration tests for action discovery and execution

### Enhancement Philosophy

Following Living Narrative Engine principles:
- **Non-breaking changes** - All enhancements are additive
- **Progressive enhancement** - Implement by priority tier
- **Edge case handling** - Address invalid state scenarios
- **Testing rigor** - Comprehensive coverage for new scenarios

---

## Enhancement Categories

### Priority Tiers

#### 🔴 High Priority (Immediate Consideration)
- **Turn Around While Straddling** - Verification of existing compatibility

#### 🟡 Medium Priority (Next Iteration)
- **Auto-Dismount Scenarios** - Critical edge case handling
  - Target stands up
  - Closeness broken
  - Location change

#### 🟢 Low Priority (Future Enhancement)
- **Additional Actions** - Narrative/cosmetic improvements
- **Performance Optimizations** - Caching and indexing
- **Testing Gaps** - Comprehensive edge case coverage

#### ⚪ Very Low Priority (Long-term Roadmap)
- **System Integrations** - Anatomy, clothing, weight/size
- **Multiple Actor Straddling** - Complex multi-actor scenarios

---

## High Priority: Turn Around Verification

### Status: NEEDS VERIFICATION

The existing `positioning:turn_around` action already handles the `facing_away` component for close actors. This enhancement focuses on **verification** rather than new implementation.

### Verification Requirements

#### Test Coverage Needed

**File:** `tests/integration/mods/positioning/turn_around_while_straddling.test.js`

Test scenarios:
1. ✅ Actor with `straddling_waist` (facing) can execute `turn_around`
2. ✅ `turn_around` correctly adds `facing_away` component
3. ✅ `straddling_waist.facing_away` field is updated to `true`
4. ✅ No conflicts with straddling-specific state
5. ✅ Actor with `straddling_waist` (facing away) can execute `turn_around`
6. ✅ `turn_around` correctly removes `facing_away` component
7. ✅ `straddling_waist.facing_away` field is updated to `false`
8. ✅ Both straddling and target components remain intact

#### Expected Behavior

**Scenario 1: Turn Around While Facing**
```
Initial State:
- Actor: straddling_waist(target_id, facing_away=false) + closeness

Action: turn_around (targeting straddled actor)
↓
Expected Result:
- Actor: straddling_waist(target_id, facing_away=true) + facing_away + closeness
```

**Scenario 2: Turn Around While Facing Away**
```
Initial State:
- Actor: straddling_waist(target_id, facing_away=true) + facing_away + closeness

Action: turn_around (targeting straddled actor)
↓
Expected Result:
- Actor: straddling_waist(target_id, facing_away=false) + closeness
```

### Implementation Paths

#### Path A: Existing Action Works (Preferred)

If `positioning:turn_around` already handles this correctly:
- ✅ **No code changes needed**
- ✅ Add comprehensive integration tests
- ✅ Document compatibility in system docs

#### Path B: Modification Required

If `positioning:turn_around` doesn't update `straddling_waist.facing_away`:

**Option 1: Extend Existing Rule**

Modify `data/mods/positioning/rules/turn_around.rule.json`:

```json
{
  "type": "IF",
  "comment": "Update straddling_waist.facing_away field if actor is straddling",
  "parameters": {
    "condition": {
      "!!": { "var": "actor.components.positioning:straddling_waist" }
    },
    "then_actions": [
      {
        "type": "QUERY_COMPONENT",
        "parameters": {
          "entity_ref": "actor",
          "component_type": "positioning:straddling_waist",
          "result_variable": "straddlingData"
        }
      },
      {
        "type": "ADD_COMPONENT",
        "comment": "Update straddling_waist with new facing_away value",
        "parameters": {
          "entity_ref": "actor",
          "component_type": "positioning:straddling_waist",
          "value": {
            "target_id": "{context.straddlingData.target_id}",
            "facing_away": {
              "!": { "var": "context.straddlingData.facing_away" }
            }
          }
        }
      }
    ]
  }
}
```

**Option 2: Create Specialized Action**

If existing action can't be extended cleanly:

**Action:** `data/mods/positioning/actions/turn_around_while_straddling.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:turn_around_while_straddling",
  "name": "Turn Around",
  "description": "Turn around to face the opposite direction while straddling",
  "targets": {
    "primary": {
      "scope": "positioning:actor_im_straddling",
      "placeholder": "target",
      "description": "Actor you're straddling"
    }
  },
  "required_components": {
    "actor": ["positioning:straddling_waist", "positioning:closeness"]
  },
  "template": "turn around while straddling {target}",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#bf360c",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#8d2c08",
    "hoverTextColor": "#ffffff"
  }
}
```

**Rule:** `data/mods/positioning/rules/turn_around_while_straddling.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_turn_around_while_straddling",
  "comment": "Handles turning around while straddling by toggling facing_away state",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "positioning:event-is-action-turn-around-while-straddling"
  },
  "actions": [
    {
      "type": "QUERY_COMPONENT",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:straddling_waist",
        "result_variable": "straddlingData"
      }
    },
    {
      "type": "ADD_COMPONENT",
      "comment": "Update straddling_waist with toggled facing_away",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "positioning:straddling_waist",
        "value": {
          "target_id": "{context.straddlingData.target_id}",
          "facing_away": {
            "!": { "var": "context.straddlingData.facing_away" }
          }
        }
      }
    },
    {
      "type": "IF",
      "comment": "Add or remove facing_away component based on new state",
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
        ],
        "else_actions": [
          {
            "type": "ADD_COMPONENT",
            "parameters": {
              "entity_ref": "actor",
              "component_type": "positioning:facing_away",
              "value": {
                "facing_away_from": ["{event.payload.targetId}"]
              }
            }
          }
        ]
      }
    },
    {
      "macro": "core:logSuccessAndEndTurn"
    }
  ]
}
```

### Decision Criteria

**Verification Steps:**
1. Create comprehensive integration tests
2. Run tests against existing `turn_around` action
3. Document results

**If tests pass:**
- Implement **Path A** (no code changes)
- Document compatibility

**If tests fail:**
- Assess modification complexity
- Choose **Option 1** (extend existing) or **Option 2** (new action)
- Implement chosen path

### Testing Strategy

**File:** `tests/integration/mods/positioning/turn_around_while_straddling.test.js`

```javascript
describe('Turn Around While Straddling Integration', () => {
  describe('Facing → Facing Away', () => {
    it('should add facing_away component when turning around while facing', () => {
      // Setup: Actor straddling target (facing)
      // Execute: turn_around action
      // Assert: facing_away component added, straddling_waist.facing_away = true
    });

    it('should dispatch actor_turned_back event', () => {
      // Verify event dispatched
    });

    it('should maintain straddling_waist component', () => {
      // Verify component intact with updated facing_away field
    });
  });

  describe('Facing Away → Facing', () => {
    it('should remove facing_away component when turning back while facing away', () => {
      // Setup: Actor straddling target (facing away)
      // Execute: turn_around action
      // Assert: facing_away component removed, straddling_waist.facing_away = false
    });

    it('should maintain straddling_waist component', () => {
      // Verify component intact with updated facing_away field
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple turn_around actions in sequence', () => {
      // Test: facing → away → facing → away
    });

    it('should not conflict with movement lock', () => {
      // Verify turning doesn't unlock movement
    });
  });
});
```

---

## Medium Priority: Auto-Dismount Scenarios

### Overview

Handle edge cases where straddling state becomes invalid due to external state changes. These scenarios require **reactive rules** that listen to component changes and trigger automatic cleanup.

### Design Pattern: Reactive Auto-Dismount

**Architecture:**
```
State Change Event → Reactive Rule → Validation → Auto-Dismount
```

**Core Principles:**
- Listen to component removal/change events
- Validate straddling state validity
- Trigger automatic dismount if invalid
- Clean up all related components

---

### Scenario 1: Target Stands Up

#### Problem

Actor A straddles Actor B (sitting). Actor B executes `get_up_from_furniture`. Current behavior: Invalid state (Actor A still has `straddling_waist` targeting standing Actor B).

#### Solution Design

**Approach:** Extend `get_up_from_furniture` rule to check for straddlers and auto-dismount them.

**Modified Rule:** `data/mods/positioning/rules/get_up_from_furniture.rule.json`

Add actions before removing `sitting_on` component:

```json
{
  "type": "QUERY_ALL_ENTITIES",
  "comment": "Find all actors straddling this actor",
  "parameters": {
    "entity_type": "core:actor",
    "filter": {
      "==": [
        { "var": "entity.components.positioning:straddling_waist.target_id" },
        { "var": "event.payload.actorId" }
      ]
    },
    "result_variable": "straddlingActors"
  }
},
{
  "type": "FOR_EACH",
  "comment": "Auto-dismount each straddling actor",
  "parameters": {
    "collection": { "var": "context.straddlingActors" },
    "item_variable": "straddler",
    "actions": [
      {
        "type": "QUERY_COMPONENT",
        "parameters": {
          "entity_ref": "straddler",
          "component_type": "positioning:straddling_waist",
          "result_variable": "straddlingData"
        }
      },
      {
        "type": "REMOVE_COMPONENT",
        "comment": "Remove straddling_waist component",
        "parameters": {
          "entity_ref": "straddler",
          "component_type": "positioning:straddling_waist"
        }
      },
      {
        "type": "IF",
        "comment": "Remove facing_away if present",
        "parameters": {
          "condition": {
            "var": "context.straddlingData.facing_away"
          },
          "then_actions": [
            {
              "type": "REMOVE_COMPONENT",
              "parameters": {
                "entity_ref": "straddler",
                "component_type": "positioning:facing_away"
              }
            }
          ]
        }
      },
      {
        "type": "UNLOCK_MOVEMENT",
        "parameters": {
          "actor_id": { "var": "context.straddler.id" }
        }
      },
      {
        "type": "DISPATCH_EVENT",
        "comment": "Notify straddler was auto-dismounted",
        "parameters": {
          "eventType": "positioning:auto_dismounted",
          "payload": {
            "actor_id": { "var": "context.straddler.id" },
            "target_id": { "var": "event.payload.actorId" },
            "reason": "target_stood_up"
          }
        }
      }
    ]
  }
}
```

#### New Event Definition

**Event:** `data/mods/positioning/events/auto_dismounted.event.json`

```json
{
  "$schema": "schema://living-narrative-engine/event.schema.json",
  "id": "positioning:auto_dismounted",
  "description": "Dispatched when an actor is automatically dismounted from straddling",
  "payloadSchema": {
    "type": "object",
    "required": ["actor_id", "target_id", "reason"],
    "properties": {
      "actor_id": {
        "type": "string",
        "description": "ID of the actor who was dismounted"
      },
      "target_id": {
        "type": "string",
        "description": "ID of the actor who was being straddled"
      },
      "reason": {
        "type": "string",
        "enum": ["target_stood_up", "closeness_broken", "location_changed"],
        "description": "Reason for auto-dismount"
      }
    }
  }
}
```

#### Testing

**File:** `tests/integration/mods/positioning/auto_dismount_target_stands.test.js`

```javascript
describe('Auto-Dismount When Target Stands', () => {
  it('should auto-dismount actor when target stands up (facing variant)', () => {
    // Setup: Actor A straddling Actor B (facing)
    // Execute: Actor B stands up
    // Assert: Actor A dismounted, components removed, movement unlocked
  });

  it('should auto-dismount actor when target stands up (facing away variant)', () => {
    // Setup: Actor A straddling Actor B (facing away)
    // Execute: Actor B stands up
    // Assert: Actor A dismounted, both components removed
  });

  it('should dispatch auto_dismounted event', () => {
    // Verify event with reason: "target_stood_up"
  });

  it('should handle multiple actors straddling same target', () => {
    // Future enhancement test (when multiple straddling implemented)
  });
});
```

---

### Scenario 2: Closeness Broken

#### Problem

Actor A straddles Actor B. Either actor executes `step_back` or closeness is broken another way. Current behavior: Invalid state (straddling without closeness).

#### Solution Design

**Approach:** Create reactive rule listening to `closeness` component removal.

**New Rule:** `data/mods/positioning/rules/auto_dismount_on_closeness_broken.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "auto_dismount_on_closeness_broken",
  "comment": "Auto-dismounts straddling actors when closeness is broken",
  "event_type": "core:component_removed",
  "condition": {
    "and": [
      {
        "==": [
          { "var": "event.payload.componentType" },
          "positioning:closeness"
        ]
      },
      {
        "!!": { "var": "event.payload.entity.components.positioning:straddling_waist" }
      }
    ]
  },
  "actions": [
    {
      "type": "QUERY_COMPONENT",
      "parameters": {
        "entity_ref": "event.payload.entity",
        "component_type": "positioning:straddling_waist",
        "result_variable": "straddlingData"
      }
    },
    {
      "type": "REMOVE_COMPONENT",
      "comment": "Remove straddling_waist component",
      "parameters": {
        "entity_ref": "event.payload.entity",
        "component_type": "positioning:straddling_waist"
      }
    },
    {
      "type": "IF",
      "comment": "Remove facing_away if present",
      "parameters": {
        "condition": {
          "var": "context.straddlingData.facing_away"
        },
        "then_actions": [
          {
            "type": "REMOVE_COMPONENT",
            "parameters": {
              "entity_ref": "event.payload.entity",
              "component_type": "positioning:facing_away"
            }
          }
        ]
      }
    },
    {
      "type": "UNLOCK_MOVEMENT",
      "parameters": {
        "actor_id": { "var": "event.payload.entity.id" }
      }
    },
    {
      "type": "DISPATCH_EVENT",
      "parameters": {
        "eventType": "positioning:auto_dismounted",
        "payload": {
          "actor_id": { "var": "event.payload.entity.id" },
          "target_id": { "var": "context.straddlingData.target_id" },
          "reason": "closeness_broken"
        }
      }
    }
  ]
}
```

#### Alternative: Check Straddled Partner

The rule could also check if the removed closeness partner matches the straddled target:

```json
{
  "condition": {
    "and": [
      {
        "==": [
          { "var": "event.payload.componentType" },
          "positioning:closeness"
        ]
      },
      {
        "!!": { "var": "event.payload.entity.components.positioning:straddling_waist" }
      },
      {
        "in": [
          { "var": "event.payload.entity.components.positioning:straddling_waist.target_id" },
          { "var": "event.payload.removedData.partners" }
        ]
      }
    ]
  }
}
```

This ensures auto-dismount only happens if closeness was broken with the **specific actor being straddled**.

#### Testing

**File:** `tests/integration/mods/positioning/auto_dismount_closeness_broken.test.js`

```javascript
describe('Auto-Dismount When Closeness Broken', () => {
  it('should auto-dismount when actor steps back from target', () => {
    // Setup: Actor A straddling Actor B, both close
    // Execute: Actor A steps back
    // Assert: Auto-dismounted, components cleaned up
  });

  it('should auto-dismount when target steps back from actor', () => {
    // Setup: Actor A straddling Actor B, both close
    // Execute: Actor B steps back
    // Assert: Auto-dismounted, components cleaned up
  });

  it('should not dismount when breaking closeness with other actors', () => {
    // Setup: Actor A straddling Actor B, Actor C also close to both
    // Execute: Actor A steps back from Actor C
    // Assert: Still straddling Actor B
  });

  it('should dispatch auto_dismounted event with reason closeness_broken', () => {
    // Verify event payload
  });
});
```

---

### Scenario 3: Location Change

#### Problem

Actor A straddles Actor B. Actor B attempts to change location. Movement lock should prevent this, but validation is needed.

#### Solution Design

**Design Decision Required:**
- **Option 1:** Prevent location change entirely (recommended)
- **Option 2:** Auto-dismount and allow location change

**Approach:** Event handler for location change events.

**Option 1 Implementation (Prevent):**

**New Rule:** `data/mods/positioning/rules/prevent_location_change_while_straddled.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "prevent_location_change_while_straddled",
  "comment": "Prevents location change if actor is being straddled",
  "event_type": "core:before_position_change",
  "condition": {
    "and": [
      {
        "!!": { "var": "event.payload.actorId" }
      },
      {
        "!!": {
          "var": "actorIsBeingStraddled"
        }
      }
    ]
  },
  "actions": [
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "actorIsBeingStraddled",
        "value": {
          "some": [
            { "var": "allActors" },
            {
              "==": [
                { "var": "actor.components.positioning:straddling_waist.target_id" },
                { "var": "event.payload.actorId" }
              ]
            }
          ]
        }
      }
    },
    {
      "type": "PREVENT_ACTION",
      "parameters": {
        "reason": "Cannot change location while being straddled."
      }
    }
  ]
}
```

**Option 2 Implementation (Auto-Dismount):**

Similar to closeness broken scenario, but listens to `core:position_changed` event:

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "auto_dismount_on_location_change",
  "comment": "Auto-dismounts straddlers when target changes location",
  "event_type": "core:position_changed",
  "condition": {
    "!!": {
      "var": "straddlingActors"
    }
  },
  "actions": [
    {
      "type": "QUERY_ALL_ENTITIES",
      "parameters": {
        "entity_type": "core:actor",
        "filter": {
          "==": [
            { "var": "entity.components.positioning:straddling_waist.target_id" },
            { "var": "event.payload.actorId" }
          ]
        },
        "result_variable": "straddlingActors"
      }
    },
    {
      "type": "FOR_EACH",
      "parameters": {
        "collection": { "var": "context.straddlingActors" },
        "item_variable": "straddler",
        "actions": [
          "... (same cleanup as target stands up)"
        ]
      }
    }
  ]
}
```

#### Testing

**File:** `tests/integration/mods/positioning/location_change_while_straddled.test.js`

```javascript
describe('Location Change While Straddled', () => {
  describe('Option 1: Prevent', () => {
    it('should prevent target from changing location while straddled', () => {
      // Setup: Actor A straddling Actor B
      // Execute: Actor B attempts teleport/location change
      // Assert: Action prevented, both actors remain
    });

    it('should allow location change after dismounting', () => {
      // Setup: Actor A straddling Actor B
      // Execute: Actor A dismounts, then Actor B changes location
      // Assert: Location change succeeds
    });
  });

  describe('Option 2: Auto-Dismount', () => {
    it('should auto-dismount and allow location change', () => {
      // Setup: Actor A straddling Actor B
      // Execute: Actor B changes location
      // Assert: Actor A auto-dismounted, Actor B moved
    });

    it('should dispatch auto_dismounted event with reason location_changed', () => {
      // Verify event
    });
  });
});
```

---

## Low Priority: Additional Features

### Feature 1: Shift Position on Lap

#### Purpose

Cosmetic/narrative action for positional adjustment without state changes.

#### Implementation

**Action:** `data/mods/positioning/actions/shift_position_on_lap.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "positioning:shift_position_on_lap",
  "name": "Shift Position",
  "description": "Adjust your position slightly while straddling",
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
  "template": "shift position on {target}'s lap",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#bf360c",
    "textColor": "#ffffff",
    "hoverBackgroundColor": "#8d2c08",
    "hoverTextColor": "#ffffff"
  }
}
```

**Rule:** `data/mods/positioning/rules/shift_position_on_lap.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_shift_position_on_lap",
  "comment": "Pure narrative action with no state changes",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "positioning:event-is-action-shift-position-on-lap"
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
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} shifts position slightly on {context.targetName}'s lap."
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
      "macro": "core:logSuccessAndEndTurn"
    }
  ]
}
```

**Design Notes:**
- No component modifications
- Pure narrative/flavor action
- Provides variety for AI-driven descriptions
- Minimal performance impact

---

### Feature 2: Testing Gaps

#### Concurrent Action Handling

**File:** `tests/integration/mods/positioning/straddling_concurrent_actions.test.js`

```javascript
describe('Concurrent Straddling Actions', () => {
  it('should handle two actors attempting to straddle same target simultaneously', () => {
    // Test race condition handling
    // Expected: Only one succeeds (component mutual exclusion)
  });

  it('should prevent multiple straddling attempts in same turn', () => {
    // Validate turn-based constraints
  });
});
```

#### Component Desync Scenarios

**File:** `tests/integration/mods/positioning/straddling_component_desync.test.js`

```javascript
describe('Component Desync Recovery', () => {
  it('should handle manual straddling_waist component addition', () => {
    // Test invalid manual manipulation
    // Expected: Error or graceful handling
  });

  it('should recover from orphaned facing_away component', () => {
    // Scenario: facing_away without straddling_waist
    // Expected: Cleanup or validation error
  });

  it('should handle straddling_waist with invalid target_id', () => {
    // Target doesn't exist
    // Expected: Validation error or auto-cleanup
  });
});
```

#### Cross-Mod Interaction

**File:** `tests/integration/mods/positioning/straddling_cross_mod.test.js`

```javascript
describe('Cross-Mod Straddling Interaction', () => {
  it('should work with intimacy mod actions', () => {
    // Test: Straddling + kiss, caress, etc.
  });

  it('should work with sex mod actions', () => {
    // Test: Straddling + sex-related actions
  });

  it('should maintain state across multiple mod interactions', () => {
    // Complex workflow test
  });
});
```

---

## Very Low Priority: System Integrations

### Integration 1: Anatomy System

#### Purpose

Validate leg functionality before allowing straddling.

#### Implementation Sketch

**New Prerequisite:** Add to straddling actions

```json
{
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "anatomy:actor-has-functional-legs"
      },
      "failure_message": "You need functional legs to straddle."
    }
  ]
}
```

**Condition:** `data/mods/anatomy/conditions/actor-has-functional-legs.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "anatomy:actor-has-functional-legs",
  "description": "Checks if actor has two functional legs",
  "logic": {
    "and": [
      {
        ">=": [
          { "var": "actor.components.anatomy:legs.count" },
          2
        ]
      },
      {
        ">=": [
          { "var": "actor.components.anatomy:legs.functional_count" },
          2
        ]
      }
    ]
  }
}
```

**Edge Cases to Handle:**
- Injured legs
- Prosthetic legs (count as functional?)
- Single leg (prevent straddling?)
- Non-humanoid anatomy

---

### Integration 2: Clothing System

#### Purpose

Restrict straddling based on clothing (e.g., tight skirts).

#### Implementation Sketch

**New Prerequisite:** Add to straddling actions

```json
{
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "clothing:actor-can-straddle"
      },
      "failure_message": "Your current clothing restricts movement."
    }
  ]
}
```

**Condition:** `data/mods/clothing/conditions/actor-can-straddle.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "clothing:actor-can-straddle",
  "description": "Checks if actor's clothing allows straddling movement",
  "logic": {
    "!": {
      "some": [
        { "var": "actor.components.clothing:worn_items.items" },
        {
          "and": [
            {
              "in": [
                { "var": "item.slot" },
                ["lower_body", "dress", "full_body"]
              ]
            },
            {
              "==": [
                { "var": "item.restricts_straddling" },
                true
              ]
            }
          ]
        }
      ]
    }
  }
}
```

**Clothing Item Enhancement:**

Add property to restrictive clothing items:

```json
{
  "id": "clothing:tight_pencil_skirt",
  "properties": {
    "restricts_straddling": true,
    "restriction_reason": "Too tight for wide leg positioning"
  }
}
```

---

### Integration 3: Weight/Size System

#### Purpose

Validate physical compatibility for straddling.

#### Implementation Sketch

**New Prerequisite:** Add to straddling actions

```json
{
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "physics:size-compatible-for-straddling"
      },
      "failure_message": "Physical size difference too great for straddling."
    }
  ]
}
```

**Condition:** `data/mods/physics/conditions/size-compatible-for-straddling.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "physics:size-compatible-for-straddling",
  "description": "Validates size compatibility for straddling",
  "logic": {
    "and": [
      {
        "<=": [
          {
            "/": [
              { "var": "actor.components.physics:size.value" },
              { "var": "target.components.physics:size.value" }
            ]
          },
          1.5
        ]
      },
      {
        "<=": [
          { "var": "actor.components.physics:weight.value" },
          {
            "*": [
              { "var": "target.components.physics:weight.max_supported" },
              0.8
            ]
          }
        ]
      }
    ]
  }
}
```

**Design Considerations:**
- Size ratio validation (actor shouldn't be >1.5x target size)
- Weight capacity (target can support actor's weight)
- Balance and stability factors
- Species-specific rules (humanoid vs non-humanoid)

---

### Integration 4: Multiple Actor Straddling

#### Complexity

**High** - Requires significant architectural changes.

#### Design Considerations

**Component Modification:**

Instead of single `target_id`, use array:

```json
{
  "straddlers": [
    {
      "actor_id": "actor_1",
      "facing_away": false,
      "position": "front"
    },
    {
      "actor_id": "actor_2",
      "facing_away": true,
      "position": "back"
    }
  ]
}
```

**Challenges:**
- Physical positioning logic (who can straddle where?)
- Scope query modifications (multiple straddlers)
- Cleanup complexity (when any straddler dismounts)
- Validation (max straddlers per target)
- Position tracking (front vs back)

**Recommendation:** Defer until proven gameplay need.

---

## Testing Strategy

### Testing Pyramid

```
E2E Tests (10%)
├─ Complete workflows with auto-dismount chains
└─ Cross-mod integration scenarios

Integration Tests (60%)
├─ Turn around verification
├─ Auto-dismount scenarios
├─ Edge case handling
└─ Event dispatch validation

Unit Tests (30%)
├─ Component schema validation
├─ Scope query behavior
└─ Condition logic
```

### Test Coverage Goals

- **Unit Tests:** 90%+ coverage
- **Integration Tests:** All scenarios documented in spec
- **Performance Tests:** <10ms action discovery, <50ms execution
- **Edge Case Tests:** All invalid states tested

### Test Execution Strategy

1. **Phase 1:** Verification tests (turn around)
2. **Phase 2:** Auto-dismount scenarios (critical edge cases)
3. **Phase 3:** Additional features (cosmetic actions)
4. **Phase 4:** System integrations (when systems available)

---

## Implementation Roadmap

### Phase 1: Verification (Immediate)

**Goal:** Confirm existing `turn_around` compatibility

**Tasks:**
1. Create comprehensive integration tests
2. Run verification tests
3. Document results
4. If needed, implement Path B modifications

**Success Criteria:**
- ✅ All turn around scenarios tested
- ✅ Compatibility documented
- ✅ Code changes (if needed) implemented

**Estimated Effort:** 1-2 days

---

### Phase 2: Critical Edge Cases (Medium Priority)

**Goal:** Handle auto-dismount scenarios

**Tasks:**
1. Implement target stands up auto-dismount
2. Implement closeness broken auto-dismount
3. Implement location change handling (decision required)
4. Create `positioning:auto_dismounted` event
5. Comprehensive integration tests for all scenarios

**Success Criteria:**
- ✅ No invalid straddling states possible
- ✅ All auto-dismount scenarios tested
- ✅ Event dispatched correctly
- ✅ Cleanup logic verified

**Estimated Effort:** 3-5 days

---

### Phase 3: Additional Features (Low Priority)

**Goal:** Enhance narrative variety and test coverage

**Tasks:**
1. Implement shift position action (if desired)
2. Fill testing gaps:
   - Concurrent action handling
   - Component desync scenarios
   - Cross-mod interaction tests

**Success Criteria:**
- ✅ Cosmetic actions available
- ✅ Edge case coverage complete
- ✅ Cross-mod compatibility verified

**Estimated Effort:** 2-3 days

---

### Phase 4: System Integrations (Very Low Priority)

**Goal:** Deep integration with other game systems

**Prerequisites:**
- Anatomy system implemented
- Clothing system fully developed
- Physics/weight system available

**Tasks:**
1. Implement anatomy prerequisite
2. Implement clothing restriction
3. Implement size/weight validation
4. (Optional) Multiple actor straddling

**Success Criteria:**
- ✅ Prerequisites prevent invalid straddling
- ✅ Realistic physical constraints
- ✅ Integration tests with other systems

**Estimated Effort:** 5-10 days (depends on system availability)

---

## Performance Considerations

### Optimization Opportunities

#### 1. Scope Query Caching

**Problem:** `actor_im_straddling` queries all actors on every action discovery.

**Solution:**

```javascript
// Cache scope results for frequently-accessed data
const scopeCache = new Map();

function getCachedScope(actorId, scopeName) {
  const cacheKey = `${actorId}:${scopeName}`;
  if (scopeCache.has(cacheKey)) {
    return scopeCache.get(cacheKey);
  }
  const result = evaluateScope(actorId, scopeName);
  scopeCache.set(cacheKey, result);
  return result;
}

// Invalidate cache on component changes
eventBus.on('core:component_added', ({ entityId, componentType }) => {
  if (componentType === 'positioning:straddling_waist') {
    scopeCache.clear();
  }
});
```

**Benefits:**
- Reduced computation for repeated queries
- Minimal memory overhead
- Automatic invalidation on state changes

**Complexity:** Medium

---

#### 2. Component Indexing

**Problem:** Finding all straddlers requires iterating all actors.

**Solution:**

```javascript
// Index actors by component type
class ComponentIndex {
  constructor() {
    this.indexes = new Map();
  }

  addEntity(entityId, componentType) {
    if (!this.indexes.has(componentType)) {
      this.indexes.set(componentType, new Set());
    }
    this.indexes.get(componentType).add(entityId);
  }

  removeEntity(entityId, componentType) {
    this.indexes.get(componentType)?.delete(entityId);
  }

  getEntitiesWithComponent(componentType) {
    return Array.from(this.indexes.get(componentType) || []);
  }
}

// Use in auto-dismount scenarios
const straddlers = componentIndex.getEntitiesWithComponent('positioning:straddling_waist');
const straddlingTarget = straddlers.filter(id =>
  getComponent(id, 'positioning:straddling_waist').target_id === targetId
);
```

**Benefits:**
- O(1) component lookup instead of O(n) iteration
- Faster auto-dismount scenarios
- Scalable to large actor counts

**Complexity:** High (requires architectural change)

**Recommendation:** Implement only if performance issues observed (>100 actors).

---

## References

### Base Specification

This enhancement spec builds upon:
- [straddling-waist-system.spec.md](./straddling-waist-system.spec.md)

### Related Systems

Pattern references:
1. **Reactive Rules** - `auto_stand_up_on_furniture_removed`
2. **Event Listeners** - `component_added`, `component_removed`
3. **Cascading Cleanup** - `get_up_from_furniture` straddler cleanup
4. **Movement Locking** - Existing `movement:movement_locked` integration
5. **Closeness Integration** - `step_back` closeness removal

### Operation Handlers

No new operation handlers needed. Existing handlers cover all requirements:
- `QUERY_ALL_ENTITIES` - Find straddlers
- `FOR_EACH` - Iterate straddlers for cleanup
- `PREVENT_ACTION` - Block invalid actions
- `DISPATCH_EVENT` - Auto-dismount notifications

### Files to Create/Modify

#### New Files

**Events (1):**
- `data/mods/positioning/events/auto_dismounted.event.json`

**Rules (3):**
- `data/mods/positioning/rules/auto_dismount_on_closeness_broken.rule.json`
- `data/mods/positioning/rules/prevent_location_change_while_straddled.rule.json` OR
- `data/mods/positioning/rules/auto_dismount_on_location_change.rule.json`

**Actions (1, optional):**
- `data/mods/positioning/actions/shift_position_on_lap.action.json`

**Tests (8+):**
- `tests/integration/mods/positioning/turn_around_while_straddling.test.js`
- `tests/integration/mods/positioning/auto_dismount_target_stands.test.js`
- `tests/integration/mods/positioning/auto_dismount_closeness_broken.test.js`
- `tests/integration/mods/positioning/location_change_while_straddled.test.js`
- `tests/integration/mods/positioning/straddling_concurrent_actions.test.js`
- `tests/integration/mods/positioning/straddling_component_desync.test.js`
- `tests/integration/mods/positioning/straddling_cross_mod.test.js`
- `tests/performance/mods/positioning/straddling_performance_extended.test.js`

#### Modified Files

**Rules (1):**
- `data/mods/positioning/rules/get_up_from_furniture.rule.json` (add auto-dismount logic)

**Possibly:**
- `data/mods/positioning/rules/turn_around.rule.json` (if Path B, Option 1)

---

## Conclusion

This specification provides a comprehensive roadmap for enhancing the straddling waist system. The enhancements are prioritized by:

1. **Verification** - Confirm existing functionality works
2. **Critical Edge Cases** - Prevent invalid states
3. **Nice-to-Have Features** - Narrative variety and test coverage
4. **Future Integrations** - Deep system integration when ready

**Implementation Approach:**
- ✅ **Non-breaking** - All changes are additive
- ✅ **Incremental** - Implement by priority tier
- ✅ **Well-tested** - Comprehensive test coverage
- ✅ **Maintainable** - Clean reactive patterns
- ✅ **Performant** - Optimization strategies documented

**Total Scope (All Phases):**
- **Files to Create:** 12+ (events, rules, actions, tests)
- **Files to Modify:** 1-2 (existing rules)
- **Estimated Effort:** 11-20 days total (across all phases)

**Recommended First Steps:**
1. Phase 1: Verification (1-2 days)
2. Phase 2: Auto-Dismount (3-5 days)
3. Pause and evaluate need for Phase 3 and 4

---

**End of Specification**
