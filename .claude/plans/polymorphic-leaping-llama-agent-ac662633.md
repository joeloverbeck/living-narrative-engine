# Personal-Space Mod Migration Plan

## Overview

This plan details the migration of 4 positioning actions to a new `personal-space` mod. The migration involves creating a new mod structure, updating namespaces, migrating test files, and updating documentation.

## Summary of Changes

### Files Being Created: 18 total
- 1 mod manifest
- 4 action files
- 4 condition files  
- 4 rule files
- 5 scope files

### Files Being Modified: ~20+ total
- `data/game.json` - Add personal-space mod
- `data/mods/positioning/mod-manifest.json` - Remove migrated content
- `docs/mods/mod-color-schemes.md` - Update Molten Copper entry
- ~14 test files being moved/updated
- ~4 test helper files with scope references

---

## Phase 1: Create New Mod Structure

### Step 1.1: Create mod-manifest.json

**File to create:** `data/mods/personal-space/mod-manifest.json`

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "personal-space",
  "version": "1.0.0",
  "name": "Personal Space",
  "description": "Actions for managing interpersonal distance and spatial intimacy - getting close, maintaining distance, and adjusting seating positions relative to others.",
  "actionPurpose": "Manage personal space and physical proximity to other characters.",
  "actionConsiderWhen": "Wanting to get closer to or maintain distance from someone, adjusting seating position relative to others on shared furniture.",
  "author": "Living Narrative Engine",
  "gameVersion": ">=0.0.1",
  "dependencies": [
    {
      "id": "core",
      "version": "^1.0.0"
    },
    {
      "id": "positioning",
      "version": "^1.0.0"
    }
  ],
  "content": {
    "actions": [
      "get_close.action.json",
      "scoot_closer.action.json",
      "scoot_closer_right.action.json",
      "sit_down_at_distance.action.json"
    ],
    "conditions": [
      "event-is-action-get-close.condition.json",
      "event-is-action-scoot-closer.condition.json",
      "event-is-action-scoot-closer-right.condition.json",
      "event-is-action-sit-down-at-distance.condition.json"
    ],
    "rules": [
      "get_close.rule.json",
      "handle_scoot_closer.rule.json",
      "handle_scoot_closer_right.rule.json",
      "handle_sit_down_at_distance.rule.json"
    ],
    "scopes": [
      "actors_in_location_not_wielding.scope",
      "actors_sitting_with_space_to_right.scope",
      "closest_leftmost_occupant.scope",
      "closest_rightmost_occupant.scope",
      "furniture_actor_sitting_on.scope"
    ]
  }
}
```

---

## Phase 2: Create/Migrate Action Files

### Step 2.1: Create get_close.action.json

**File to create:** `data/mods/personal-space/actions/get_close.action.json`

**Changes from original:**
- `id`: `positioning:get_close` → `personal-space:get_close`
- `targets.primary.scope`: `positioning:actors_in_location_not_wielding` → `personal-space:actors_in_location_not_wielding`
- `visual`: Update to Molten Copper color scheme

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "personal-space:get_close",
  "name": "Get Close",
  "description": "Move closer to the target, entering their personal space.",
  "targets": {
    "primary": {
      "scope": "personal-space:actors_in_location_not_wielding",
      "placeholder": "target",
      "description": "Actor to get close to"
    }
  },
  "required_components": {},
  "forbidden_components": {
    "actor": [
      "positioning:closeness",
      "positioning:doing_complex_performance",
      "positioning:wielding",
      "positioning:being_restrained",
      "positioning:restraining",
      "positioning:fallen"
    ]
  },
  "template": "get close to {target}",
  "prerequisites": [
    {
      "logic": {
        "condition_ref": "positioning:actor-can-move"
      },
      "failure_message": "You cannot move without functioning legs."
    }
  ],
  "visual": {
    "backgroundColor": "#7c2d12",
    "textColor": "#fef3c7",
    "hoverBackgroundColor": "#9a3412",
    "hoverTextColor": "#fffbeb"
  }
}
```

### Step 2.2: Create scoot_closer.action.json

**File to create:** `data/mods/personal-space/actions/scoot_closer.action.json`

**Changes from original:**
- `id`: `positioning:scoot_closer` → `personal-space:scoot_closer`
- `targets.primary.scope`: `positioning:furniture_actor_sitting_on` → `personal-space:furniture_actor_sitting_on`
- `targets.secondary.scope`: `positioning:closest_leftmost_occupant` → `personal-space:closest_leftmost_occupant`
- `visual`: Update to Molten Copper

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "personal-space:scoot_closer",
  "name": "Scoot Closer",
  "description": "Move one seat closer to an adjacent occupant on the same furniture",
  "targets": {
    "primary": {
      "scope": "personal-space:furniture_actor_sitting_on",
      "placeholder": "seat",
      "description": "Furniture where the actor is currently sitting"
    },
    "secondary": {
      "scope": "personal-space:closest_leftmost_occupant",
      "placeholder": "occupant",
      "contextFrom": "primary",
      "description": "The closest occupant to the actor's left"
    }
  },
  "required_components": {
    "actor": ["positioning:sitting_on"]
  },
  "forbidden_components": {
    "actor": []
  },
  "template": "scoot closer to {occupant} on {seat}",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#7c2d12",
    "textColor": "#fef3c7",
    "hoverBackgroundColor": "#9a3412",
    "hoverTextColor": "#fffbeb"
  }
}
```

### Step 2.3: Create scoot_closer_right.action.json

**File to create:** `data/mods/personal-space/actions/scoot_closer_right.action.json`

**Changes from original:**
- `id`: `positioning:scoot_closer_right` → `personal-space:scoot_closer_right`
- `targets.primary.scope`: → `personal-space:furniture_actor_sitting_on`
- `targets.secondary.scope`: → `personal-space:closest_rightmost_occupant`
- `visual`: Update to Molten Copper

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "personal-space:scoot_closer_right",
  "name": "Scoot Closer Right",
  "description": "Slide one seat to the right toward an adjacent occupant on the same furniture",
  "targets": {
    "primary": {
      "scope": "personal-space:furniture_actor_sitting_on",
      "placeholder": "seat",
      "description": "Furniture where the actor is currently sitting"
    },
    "secondary": {
      "scope": "personal-space:closest_rightmost_occupant",
      "placeholder": "occupant",
      "contextFrom": "primary",
      "description": "The closest occupant to the actor's right"
    }
  },
  "required_components": {
    "actor": ["positioning:sitting_on"]
  },
  "forbidden_components": {
    "actor": []
  },
  "template": "scoot right toward {occupant} on {seat}",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#7c2d12",
    "textColor": "#fef3c7",
    "hoverBackgroundColor": "#9a3412",
    "hoverTextColor": "#fffbeb"
  }
}
```

### Step 2.4: Create sit_down_at_distance.action.json

**File to create:** `data/mods/personal-space/actions/sit_down_at_distance.action.json`

**Changes from original:**
- `id`: `positioning:sit_down_at_distance` → `personal-space:sit_down_at_distance`
- `targets.primary.scope`: Keep as `positioning:available_furniture` (shared scope stays in positioning)
- `targets.secondary.scope`: → `personal-space:actors_sitting_with_space_to_right`
- `visual`: Update to Molten Copper

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "personal-space:sit_down_at_distance",
  "name": "Sit Down With Space",
  "description": "Sit on available furniture while leaving a one-seat buffer from a selected occupant.",
  "targets": {
    "primary": {
      "scope": "positioning:available_furniture",
      "placeholder": "seat",
      "description": "Furniture with an open seat"
    },
    "secondary": {
      "scope": "personal-space:actors_sitting_with_space_to_right",
      "placeholder": "occupant",
      "contextFrom": "primary",
      "description": "Occupant to keep a one-seat buffer from"
    }
  },
  "required_components": {
    "actor": []
  },
  "forbidden_components": {
    "actor": [
      "positioning:sitting_on",
      "positioning:kneeling_before",
      "positioning:bending_over",
      "positioning:restraining",
      "positioning:fallen"
    ]
  },
  "template": "sit down on {seat} at a distance from {occupant}",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#7c2d12",
    "textColor": "#fef3c7",
    "hoverBackgroundColor": "#9a3412",
    "hoverTextColor": "#fffbeb"
  }
}
```

---

## Phase 3: Create/Migrate Condition Files

### Step 3.1: Create event-is-action-get-close.condition.json

**File to create:** `data/mods/personal-space/conditions/event-is-action-get-close.condition.json`

**Changes:**
- `id`: `positioning:event-is-action-get-close` → `personal-space:event-is-action-get-close`
- Logic `actionId` comparison: `positioning:get_close` → `personal-space:get_close`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "personal-space:event-is-action-get-close",
  "description": "Checks if the triggering event is for the 'personal-space:get_close' action.",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "personal-space:get_close"
    ]
  }
}
```

### Step 3.2: Create event-is-action-scoot-closer.condition.json

**File to create:** `data/mods/personal-space/conditions/event-is-action-scoot-closer.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "personal-space:event-is-action-scoot-closer",
  "description": "Condition that checks if the event is the scoot_closer action",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "personal-space:scoot_closer"
    ]
  }
}
```

### Step 3.3: Create event-is-action-scoot-closer-right.condition.json

**File to create:** `data/mods/personal-space/conditions/event-is-action-scoot-closer-right.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "personal-space:event-is-action-scoot-closer-right",
  "description": "Condition that checks if the event is the scoot_closer_right action",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "personal-space:scoot_closer_right"
    ]
  }
}
```

### Step 3.4: Create event-is-action-sit-down-at-distance.condition.json

**File to create:** `data/mods/personal-space/conditions/event-is-action-sit-down-at-distance.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "personal-space:event-is-action-sit-down-at-distance",
  "description": "Checks if the event is a sit_down_at_distance action attempt",
  "logic": {
    "==": [
      { "var": "event.payload.actionId" },
      "personal-space:sit_down_at_distance"
    ]
  }
}
```

---

## Phase 4: Create/Migrate Rule Files

### Step 4.1: Create get_close.rule.json

**File to create:** `data/mods/personal-space/rules/get_close.rule.json`

**Changes from original:**
- `rule_id`: `positioning_handle_get_close` → `personal_space_handle_get_close`
- `condition.condition_ref`: `positioning:event-is-action-get-close` → `personal-space:event-is-action-get-close`
- `comment`: Update to reference `personal-space:get_close`

The rule body itself does not need changes since it only uses `positioning:` components which remain in the positioning mod.

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "personal_space_handle_get_close",
  "comment": "Handles the 'personal-space:get_close' action. Implements algorithm §5.1 from the spec. It merges actor, target, and their existing partners into a new, single, fully-connected closeness circle, then locks movement for all members.",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "personal-space:event-is-action-get-close"
  },
  "actions": [
    {
      "type": "MERGE_CLOSENESS_CIRCLE",
      "comment": "Steps 1-6: Merge actor and target closeness circles and lock movement.",
      "parameters": {
        "actor_id": "{event.payload.actorId}",
        "target_id": "{event.payload.targetId}"
      }
    },
    {
      "type": "GET_NAME",
      "comment": "Step 7: Get names for the UI message.",
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
      "comment": "Get location for perceptible event.",
      "parameters": {
        "entity_ref": "actor",
        "component_type": "core:position",
        "result_variable": "actorPos"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} and {context.targetName} are now close."
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "locationId",
        "value": "{context.actorPos.locationId}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "perceptionType",
        "value": "state_change_observable"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "targetId",
        "value": "{event.payload.targetId}"
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

### Step 4.2: Create handle_scoot_closer.rule.json

**File to create:** `data/mods/personal-space/rules/handle_scoot_closer.rule.json`

**Changes:**
- `rule_id`: `handle_scoot_closer` → `personal_space_handle_scoot_closer`
- `condition.condition_ref`: → `personal-space:event-is-action-scoot-closer`
- `comment`: Update to reference `personal-space:scoot_closer`

The rule body uses `positioning:` components which stay in positioning mod - no changes needed there.

(Full JSON content same as original but with updated rule_id, condition_ref, and comment)

### Step 4.3: Create handle_scoot_closer_right.rule.json

**File to create:** `data/mods/personal-space/rules/handle_scoot_closer_right.rule.json`

**Changes:**
- `rule_id`: `handle_scoot_closer_right` → `personal_space_handle_scoot_closer_right`
- `condition.condition_ref`: → `personal-space:event-is-action-scoot-closer-right`
- `comment`: Update to reference `personal-space:scoot_closer_right`

### Step 4.4: Create handle_sit_down_at_distance.rule.json

**File to create:** `data/mods/personal-space/rules/handle_sit_down_at_distance.rule.json`

**Changes:**
- `rule_id`: `handle_sit_down_at_distance` → `personal_space_handle_sit_down_at_distance`
- `condition.condition_ref`: → `personal-space:event-is-action-sit-down-at-distance`
- `comment`: Update to reference `personal-space:sit_down_at_distance`

---

## Phase 5: Create/Migrate Scope Files

### Step 5.1: Create actors_in_location_not_wielding.scope

**File to create:** `data/mods/personal-space/scopes/actors_in_location_not_wielding.scope`

**Changes:**
- Scope name: `positioning:actors_in_location_not_wielding` → `personal-space:actors_in_location_not_wielding`
- Condition refs remain as `positioning:` since those conditions stay in positioning mod

```
personal-space:actors_in_location_not_wielding := entities(core:position)[][
  {
    "and": [
      { "condition_ref": "core:entity-at-location" },
      { "condition_ref": "core:entity-is-not-current-actor" },
      { "condition_ref": "core:entity-has-actor-component" },
      { "condition_ref": "positioning:entity-is-not-wielding" }
    ]
  }
]
```

### Step 5.2: Create actors_sitting_with_space_to_right.scope

**File to create:** `data/mods/personal-space/scopes/actors_sitting_with_space_to_right.scope`

```
// Scope for occupants on the target furniture who have two empty spots to their right
// and are the rightmost occupant (no one sitting further right than them)
personal-space:actors_sitting_with_space_to_right := entities(core:actor)[{
  "hasSittingSpaceToRight": ["entity", "target", 2]
}]
```

### Step 5.3: Create closest_leftmost_occupant.scope

**File to create:** `data/mods/personal-space/scopes/closest_leftmost_occupant.scope`

```
// Scope returns the actor who is the closest occupant to the left of the acting actor
// Uses the custom isClosestLeftOccupant operator to filter actors
// Receives furniture entity from primary target via contextFrom
personal-space:closest_leftmost_occupant := entities(core:actor)[{
  "isClosestLeftOccupant": ["entity", "target", "actor"]
}]
```

### Step 5.4: Create closest_rightmost_occupant.scope

**File to create:** `data/mods/personal-space/scopes/closest_rightmost_occupant.scope`

```
// Scope returns the actor who is the closest occupant to the right of the acting actor
// Uses the custom isClosestRightOccupant operator to filter actors
// Receives furniture entity from primary target via contextFrom
personal-space:closest_rightmost_occupant := entities(core:actor)[{
  "isClosestRightOccupant": ["entity", "target", "actor"]
}]
```

### Step 5.5: Create furniture_actor_sitting_on.scope

**File to create:** `data/mods/personal-space/scopes/furniture_actor_sitting_on.scope`

```
personal-space:furniture_actor_sitting_on := entities(positioning:allows_sitting)[][{
  "==": [
    {"var": "entity.id"},
    {"var": "actor.components.positioning:sitting_on.furniture_id"}
  ]
}]
```

---

## Phase 6: Update Positioning Mod

### Step 6.1: Update positioning/mod-manifest.json

**File to modify:** `data/mods/positioning/mod-manifest.json`

**Changes:**
Remove from `content.actions`:
- `"get_close.action.json"`
- `"scoot_closer.action.json"`
- `"scoot_closer_right.action.json"`
- `"sit_down_at_distance.action.json"`

Remove from `content.conditions`:
- `"event-is-action-get-close.condition.json"`
- `"event-is-action-scoot-closer.condition.json"`
- `"event-is-action-scoot-closer-right.condition.json"`
- `"event-is-action-sit-down-at-distance.condition.json"`

Remove from `content.rules`:
- `"get_close.rule.json"`
- `"handle_scoot_closer.rule.json"`
- `"handle_scoot_closer_right.rule.json"`
- `"handle_sit_down_at_distance.rule.json"`

Remove from `content.scopes`:
- `"actors_in_location_not_wielding.scope"`
- `"actors_sitting_with_space_to_right.scope"`
- `"closest_leftmost_occupant.scope"`
- `"closest_rightmost_occupant.scope"`
- `"furniture_actor_sitting_on.scope"`

**Keep in positioning** (used by sit_down action):
- `"available_furniture.scope"` - stays

### Step 6.2: Delete Original Files from Positioning

**Files to delete from `data/mods/positioning/`:**

Actions:
- `actions/get_close.action.json`
- `actions/scoot_closer.action.json`
- `actions/scoot_closer_right.action.json`
- `actions/sit_down_at_distance.action.json`

Conditions:
- `conditions/event-is-action-get-close.condition.json`
- `conditions/event-is-action-scoot-closer.condition.json`
- `conditions/event-is-action-scoot-closer-right.condition.json`
- `conditions/event-is-action-sit-down-at-distance.condition.json`

Rules:
- `rules/get_close.rule.json`
- `rules/handle_scoot_closer.rule.json`
- `rules/handle_scoot_closer_right.rule.json`
- `rules/handle_sit_down_at_distance.rule.json`

Scopes:
- `scopes/actors_in_location_not_wielding.scope`
- `scopes/actors_sitting_with_space_to_right.scope`
- `scopes/closest_leftmost_occupant.scope`
- `scopes/closest_rightmost_occupant.scope`
- `scopes/furniture_actor_sitting_on.scope`

---

## Phase 7: Update Configuration Files

### Step 7.1: Update game.json

**File to modify:** `data/game.json`

**Change:** Add `"personal-space"` to the mods array, positioned after `"positioning"` (since it depends on positioning)

```json
{
  "mods": [
    ...
    "positioning",
    "personal-space",
    ...
  ]
}
```

### Step 7.2: Update mod-color-schemes.md

**File to modify:** `docs/mods/mod-color-schemes.md`

**Change 1:** Update Quick Reference table (around line 22) - add entry for personal-space:

```markdown
| Personal-Space           | Molten Copper      | 11.6    | `#7c2d12`        | Active   |
```

**Change 2:** Update Section 11.6 Molten Copper entry (around line 660):

Change from:
```markdown
#### 11.6 Molten Copper 🟢 AVAILABLE
```

To:
```markdown
#### 11.6 Molten Copper ✅ IN USE: Personal-Space
```

And update use cases:
```markdown
- **Use Cases**: Personal space actions, proximity management, seating adjustments, intimate distance
```

---

## Phase 8: Migrate Test Files

### Step 8.1: Create test directory structure

**Directory to create:** `tests/integration/mods/personal-space/`
**Directory to create:** `tests/integration/mods/personal-space/rules/`

### Step 8.2: Move and Update Test Files

The following test files need to be moved from `tests/integration/mods/positioning/` to `tests/integration/mods/personal-space/`:

| Original File | New Location |
|---------------|--------------|
| `sit_down_at_distance_action.test.js` | `personal-space/sit_down_at_distance_action.test.js` |
| `sit_down_at_distance_action_discovery.test.js` | `personal-space/sit_down_at_distance_action_discovery.test.js` |
| `sitDownAtDistanceSecondaryTarget.integration.test.js` | `personal-space/sitDownAtDistanceSecondaryTarget.integration.test.js` |
| `scoot_closer_action.test.js` | `personal-space/scoot_closer_action.test.js` |
| `scoot_closer_action_discovery.test.js` | `personal-space/scoot_closer_action_discovery.test.js` |
| `scoot_closer_marla_scenario.test.js` | `personal-space/scoot_closer_marla_scenario.test.js` |
| `scoot_closer_right_action.test.js` | `personal-space/scoot_closer_right_action.test.js` |
| `scoot_closer_right_action_discovery.test.js` | `personal-space/scoot_closer_right_action_discovery.test.js` |
| `scoot_closer_right_marla_scenario.test.js` | `personal-space/scoot_closer_right_marla_scenario.test.js` |
| `actorsSittingWithSpaceToRight.integration.test.js` | `personal-space/actorsSittingWithSpaceToRight.integration.test.js` |
| `get_close_forbidden_components.test.js` | `personal-space/get_close_forbidden_components.test.js` |
| `rules/getCloseRule.integration.test.js` | `personal-space/rules/getCloseRule.integration.test.js` |

**Changes required in each test file:**

1. **Action ID references:**
   - `positioning:sit_down_at_distance` → `personal-space:sit_down_at_distance`
   - `positioning:scoot_closer` → `personal-space:scoot_closer`
   - `positioning:scoot_closer_right` → `personal-space:scoot_closer_right`
   - `positioning:get_close` → `personal-space:get_close`

2. **Scope references:**
   - `positioning:actors_sitting_with_space_to_right` → `personal-space:actors_sitting_with_space_to_right`
   - `positioning:furniture_actor_sitting_on` → `personal-space:furniture_actor_sitting_on`
   - `positioning:closest_leftmost_occupant` → `personal-space:closest_leftmost_occupant`
   - `positioning:closest_rightmost_occupant` → `personal-space:closest_rightmost_occupant`
   - `positioning:actors_in_location_not_wielding` → `personal-space:actors_in_location_not_wielding`

3. **Condition references:**
   - `positioning:event-is-action-get-close` → `personal-space:event-is-action-get-close`
   - `positioning:event-is-action-scoot-closer` → `personal-space:event-is-action-scoot-closer`
   - `positioning:event-is-action-scoot-closer-right` → `personal-space:event-is-action-scoot-closer-right`
   - `positioning:event-is-action-sit-down-at-distance` → `personal-space:event-is-action-sit-down-at-distance`

4. **ModTestFixture calls:**
   - `ModTestFixture.forAction('positioning', 'positioning:scoot_closer')` → `ModTestFixture.forAction('personal-space', 'personal-space:scoot_closer')`
   - Similar for all other actions

5. **Describe block strings:**
   - Update test suite names to reflect personal-space mod

### Step 8.3: Update Test Helper Files

**Files to update with namespace changes:**

1. **`tests/common/mods/ModTestFixture.js`**
   - Update any hardcoded scope references from `positioning:` to `personal-space:` for the migrated scopes

2. **`tests/common/mods/scopeResolverHelpers.js`**
   - Update scope ID references for migrated scopes

3. **`tests/common/engine/systemLogicTestEnv.js`**
   - Update any references to the migrated scopes

4. **`tests/unit/common/mods/scopeResolverHelpers.test.js`**
   - Update test expectations for migrated scope IDs

5. **`tests/integration/common/mods/scopeResolverHelpersIntegration.test.js`**
   - Update scope ID references

---

## Phase 9: Delete Original Test Files

After confirming the migrated tests pass, delete the original test files from `tests/integration/mods/positioning/`:

- `sit_down_at_distance_action.test.js`
- `sit_down_at_distance_action_discovery.test.js`
- `sitDownAtDistanceSecondaryTarget.integration.test.js`
- `scoot_closer_action.test.js`
- `scoot_closer_action_discovery.test.js`
- `scoot_closer_marla_scenario.test.js`
- `scoot_closer_right_action.test.js`
- `scoot_closer_right_action_discovery.test.js`
- `scoot_closer_right_marla_scenario.test.js`
- `actorsSittingWithSpaceToRight.integration.test.js`
- `get_close_forbidden_components.test.js`
- `rules/getCloseRule.integration.test.js`

---

## Phase 10: Validation

### Step 10.1: Run Schema Validation
```bash
npm run validate
```

### Step 10.2: Run Type Check
```bash
npm run typecheck
```

### Step 10.3: Run Unit Tests
```bash
npm run test:unit
```

### Step 10.4: Run Integration Tests
```bash
npm run test:integration
```

### Step 10.5: Run Scope Linting
```bash
npm run scope:lint
```

### Step 10.6: Run ESLint on Modified Files
```bash
npx eslint tests/integration/mods/personal-space/
npx eslint tests/common/mods/ModTestFixture.js
npx eslint tests/common/mods/scopeResolverHelpers.js
```

---

## Complete File Inventory

### Files to CREATE (18 total):

| Path | Type |
|------|------|
| `data/mods/personal-space/mod-manifest.json` | Manifest |
| `data/mods/personal-space/actions/get_close.action.json` | Action |
| `data/mods/personal-space/actions/scoot_closer.action.json` | Action |
| `data/mods/personal-space/actions/scoot_closer_right.action.json` | Action |
| `data/mods/personal-space/actions/sit_down_at_distance.action.json` | Action |
| `data/mods/personal-space/conditions/event-is-action-get-close.condition.json` | Condition |
| `data/mods/personal-space/conditions/event-is-action-scoot-closer.condition.json` | Condition |
| `data/mods/personal-space/conditions/event-is-action-scoot-closer-right.condition.json` | Condition |
| `data/mods/personal-space/conditions/event-is-action-sit-down-at-distance.condition.json` | Condition |
| `data/mods/personal-space/rules/get_close.rule.json` | Rule |
| `data/mods/personal-space/rules/handle_scoot_closer.rule.json` | Rule |
| `data/mods/personal-space/rules/handle_scoot_closer_right.rule.json` | Rule |
| `data/mods/personal-space/rules/handle_sit_down_at_distance.rule.json` | Rule |
| `data/mods/personal-space/scopes/actors_in_location_not_wielding.scope` | Scope |
| `data/mods/personal-space/scopes/actors_sitting_with_space_to_right.scope` | Scope |
| `data/mods/personal-space/scopes/closest_leftmost_occupant.scope` | Scope |
| `data/mods/personal-space/scopes/closest_rightmost_occupant.scope` | Scope |
| `data/mods/personal-space/scopes/furniture_actor_sitting_on.scope` | Scope |

### Files to MODIFY (3 total):

| Path | Changes |
|------|---------|
| `data/game.json` | Add "personal-space" to mods array |
| `data/mods/positioning/mod-manifest.json` | Remove migrated content references |
| `docs/mods/mod-color-schemes.md` | Mark Molten Copper as used by Personal-Space |

### Files to DELETE from positioning (17 total):

| Path |
|------|
| `data/mods/positioning/actions/get_close.action.json` |
| `data/mods/positioning/actions/scoot_closer.action.json` |
| `data/mods/positioning/actions/scoot_closer_right.action.json` |
| `data/mods/positioning/actions/sit_down_at_distance.action.json` |
| `data/mods/positioning/conditions/event-is-action-get-close.condition.json` |
| `data/mods/positioning/conditions/event-is-action-scoot-closer.condition.json` |
| `data/mods/positioning/conditions/event-is-action-scoot-closer-right.condition.json` |
| `data/mods/positioning/conditions/event-is-action-sit-down-at-distance.condition.json` |
| `data/mods/positioning/rules/get_close.rule.json` |
| `data/mods/positioning/rules/handle_scoot_closer.rule.json` |
| `data/mods/positioning/rules/handle_scoot_closer_right.rule.json` |
| `data/mods/positioning/rules/handle_sit_down_at_distance.rule.json` |
| `data/mods/positioning/scopes/actors_in_location_not_wielding.scope` |
| `data/mods/positioning/scopes/actors_sitting_with_space_to_right.scope` |
| `data/mods/positioning/scopes/closest_leftmost_occupant.scope` |
| `data/mods/positioning/scopes/closest_rightmost_occupant.scope` |
| `data/mods/positioning/scopes/furniture_actor_sitting_on.scope` |

### Test Files to MOVE (12 total):

| From | To |
|------|-----|
| `tests/integration/mods/positioning/sit_down_at_distance_action.test.js` | `tests/integration/mods/personal-space/` |
| `tests/integration/mods/positioning/sit_down_at_distance_action_discovery.test.js` | `tests/integration/mods/personal-space/` |
| `tests/integration/mods/positioning/sitDownAtDistanceSecondaryTarget.integration.test.js` | `tests/integration/mods/personal-space/` |
| `tests/integration/mods/positioning/scoot_closer_action.test.js` | `tests/integration/mods/personal-space/` |
| `tests/integration/mods/positioning/scoot_closer_action_discovery.test.js` | `tests/integration/mods/personal-space/` |
| `tests/integration/mods/positioning/scoot_closer_marla_scenario.test.js` | `tests/integration/mods/personal-space/` |
| `tests/integration/mods/positioning/scoot_closer_right_action.test.js` | `tests/integration/mods/personal-space/` |
| `tests/integration/mods/positioning/scoot_closer_right_action_discovery.test.js` | `tests/integration/mods/personal-space/` |
| `tests/integration/mods/positioning/scoot_closer_right_marla_scenario.test.js` | `tests/integration/mods/personal-space/` |
| `tests/integration/mods/positioning/actorsSittingWithSpaceToRight.integration.test.js` | `tests/integration/mods/personal-space/` |
| `tests/integration/mods/positioning/get_close_forbidden_components.test.js` | `tests/integration/mods/personal-space/` |
| `tests/integration/mods/positioning/rules/getCloseRule.integration.test.js` | `tests/integration/mods/personal-space/rules/` |

### Test Helper Files to UPDATE:

| Path | Changes |
|------|---------|
| `tests/common/mods/ModTestFixture.js` | Update scope references |
| `tests/common/mods/scopeResolverHelpers.js` | Update scope references |
| `tests/common/engine/systemLogicTestEnv.js` | Update scope references if needed |
| `tests/unit/common/mods/scopeResolverHelpers.test.js` | Update test expectations |
| `tests/integration/common/mods/scopeResolverHelpersIntegration.test.js` | Update scope references |

---

## Critical Files for Implementation

1. **`data/mods/personal-space/mod-manifest.json`** - Core mod definition, must be created first
2. **`data/mods/positioning/mod-manifest.json`** - Must be updated to remove migrated content
3. **`data/game.json`** - Must add personal-space mod to enable loading
4. **`data/mods/personal-space/actions/get_close.action.json`** - Most complex action with prerequisites
5. **`tests/common/mods/scopeResolverHelpers.js`** - Shared test helper with scope ID mappings

---

## Execution Order

1. **Create directory structure** for personal-space mod
2. **Create manifest** file
3. **Create all action files** with updated namespaces and colors
4. **Create all condition files** with updated IDs
5. **Create all rule files** with updated condition refs
6. **Create all scope files** with updated names
7. **Update game.json** to include personal-space
8. **Update positioning manifest** to remove migrated content
9. **Update mod-color-schemes.md** documentation
10. **Create test directory structure**
11. **Move and update test files** with new namespaces
12. **Update test helper files** with new scope references
13. **Delete original files** from positioning mod
14. **Run validation** (npm run validate, typecheck, tests)
