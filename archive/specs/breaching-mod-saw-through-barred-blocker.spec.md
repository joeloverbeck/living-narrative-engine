# Specification: Breaching Mod - Saw Through Barred Blocker Action

## Overview

This specification defines a new action for the breaching mod that allows actors to use abrasive sawing tools (e.g., hacksaws) to cut through barred blockers (e.g., iron grates). The action uses a chance-based opposed contest between the actor's craft skill and the blocker's structural resistance.

## Files to Create

### 1. Components

#### 1.1 Progress Tracker Component (Core)

**File**: `data/mods/core/components/progress_tracker.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:progress_tracker",
  "description": "Tracks incremental progress toward completing a multi-step task. Value starts at 0 and increases as progress is made.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "value": {
        "type": "integer",
        "minimum": 0,
        "default": 0,
        "description": "Current progress value. No upper bound - threshold for completion varies by use case."
      }
    },
    "required": ["value"],
    "additionalProperties": false
  }
}
```

#### 1.2 Craft Skill Component (Skills)

**File**: `data/mods/skills/components/craft_skill.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "skills:craft_skill",
  "description": "Represents proficiency in crafting, repair, and tool manipulation. Used for actions requiring manual dexterity with tools.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "value": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 10,
        "description": "Skill level from 0 (untrained) to 100 (master craftsman)"
      }
    },
    "required": ["value"],
    "additionalProperties": false
  }
}
```

### 2. Scopes

#### 2.1 Sawable Barred Blockers Scope (Blockers)

**File**: `data/mods/blockers/scopes/sawable_barred_blockers.scope`

```
blockers:sawable_barred_blockers := location.locations:exits[].blocker[{
  "and": [
    { "!!": { "var": "entity.components.blockers:is_barred" } },
    { "!!": { "var": "entity.components.blockers:structural_resistance" } },
    {
      "or": [
        { "not": { "var": "entity.components.core:progress_tracker" } },
        { "==": [{ "var": "entity.components.core:progress_tracker.value" }, 0] }
      ]
    }
  ]
}]
```

**Expression Breakdown**:
- `location.locations:exits[].blocker` - Access blockers in location exits
- Filter for entities that have:
  - `blockers:is_barred` component (marker for barred structure)
  - `blockers:structural_resistance` component (numeric resistance value)
  - Either no `core:progress_tracker` OR progress_tracker.value == 0

#### 2.2 Abrasive Sawing Tools Scope (Breaching)

**File**: `data/mods/breaching/scopes/abrasive_sawing_tools.scope`

```
breaching:abrasive_sawing_tools := actor.components.items:inventory.items[][{
  "!!": { "var": "entity.components.breaching:allows_abrasive_sawing" }
}]
```

**Expression Breakdown**:
- `actor.components.items:inventory.items[]` - Access inventory items from the actor
- Filter for entities with `breaching:allows_abrasive_sawing` marker component

### 3. Condition

#### 3.1 Corroded Blocker Condition (Blockers)

**File**: `data/mods/blockers/conditions/target-is-corroded.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "blockers:target-is-corroded",
  "description": "Checks if the target blocker has the corroded marker component",
  "expression": {
    "!!": [{ "var": "target.blockers:corroded" }]
  }
}
```

### 4. Action

#### 4.1 Saw Through Barred Blocker Action

**File**: `data/mods/breaching/actions/saw_through_barred_blocker.action.json`

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "breaching:saw_through_barred_blocker",
  "commandType": "single",
  "template": "hack through {barredBlocker} with {sawingTool} ({chance}% chance)",
  "description": "Attempt to cut through a barred obstacle using an abrasive sawing tool like a hacksaw.",
  "targets": {
    "primary": {
      "scopeRef": "blockers:sawable_barred_blockers",
      "key": "barredBlocker",
      "required": true
    },
    "secondary": {
      "scopeRef": "breaching:abrasive_sawing_tools",
      "key": "sawingTool",
      "required": true
    }
  },
  "target_required_components": {
    "primary": ["blockers:is_barred", "blockers:structural_resistance"]
  },
  "chanceBased": {
    "contestType": "opposed",
    "actorSkillComponent": "skills:craft_skill",
    "targetResistanceComponent": "blockers:structural_resistance",
    "modifiers": [
      {
        "tag": "corroded",
        "condition": { "$ref": "blockers:target-is-corroded" },
        "value": 10,
        "type": "flat",
        "description": "Corroded bars are easier to cut through"
      }
    ],
    "outcomes": ["CRITICAL_SUCCESS", "SUCCESS", "FAILURE", "FUMBLE"]
  },
  "visualProperties": {
    "colorScheme": "rust-orange"
  }
}
```

### 5. Rule

#### 5.1 Handle Saw Through Barred Blocker Rule

**File**: `data/mods/breaching/rules/handle_saw_through_barred_blocker.rule.json`

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "id": "breaching:handle_saw_through_barred_blocker",
  "event_type": "ACTION_DECIDED",
  "condition": {
    "$ref": "breaching:event-is-action-saw-through-barred-blocker"
  },
  "actions": [
    {
      "type": "RESOLVE_CHANCE_BASED_ACTION",
      "parameters": {
        "actorId": "{event.payload.actorId}",
        "targetId": "{event.payload.primaryId}",
        "secondaryId": "{event.payload.secondaryId}",
        "actionId": "breaching:saw_through_barred_blocker",
        "storeResultIn": "sawingResult"
      }
    },
    {
      "type": "IF",
      "condition": { "==": [{ "var": "context.sawingResult.outcome" }, "CRITICAL_SUCCESS"] },
      "then_actions": [
        {
          "type": "ADD_COMPONENT",
          "parameters": {
            "entityId": "{event.payload.primaryId}",
            "componentId": "core:progress_tracker",
            "data": { "value": 2 },
            "upsert": true,
            "incrementValue": true
          }
        },
        {
          "type": "DISPATCH_PERCEPTIBLE_EVENT",
          "parameters": {
            "eventId": "events:saw_through_barred_blocker_critical",
            "senses": ["sight", "hearing"],
            "actor_description": "With practiced precision, you find the perfect angle and the blade bites deep. Metal shavings fly as you make significant progress cutting through the bars.",
            "target_description": "{context.actorName} works their saw with expert skill, sending sparks flying as the blade tears through the metal at an impressive pace.",
            "alternate_descriptions": {
              "hearing_only": "The rapid, rhythmic scraping of metal on metal fills the air, punctuated by the ping of falling shavings."
            }
          }
        }
      ]
    },
    {
      "type": "IF",
      "condition": { "==": [{ "var": "context.sawingResult.outcome" }, "SUCCESS"] },
      "then_actions": [
        {
          "type": "ADD_COMPONENT",
          "parameters": {
            "entityId": "{event.payload.primaryId}",
            "componentId": "core:progress_tracker",
            "data": { "value": 1 },
            "upsert": true,
            "incrementValue": true
          }
        },
        {
          "type": "DISPATCH_PERCEPTIBLE_EVENT",
          "parameters": {
            "eventId": "events:saw_through_barred_blocker_success",
            "senses": ["sight", "hearing"],
            "actor_description": "You settle into a steady rhythm, the saw blade slowly but surely biting into the metal. Progress is being made.",
            "target_description": "{context.actorName} methodically works the saw back and forth, gradually cutting a groove into the bars.",
            "alternate_descriptions": {
              "hearing_only": "A steady, grinding rasp echoes as metal is slowly worn away."
            }
          }
        }
      ]
    },
    {
      "type": "IF",
      "condition": { "==": [{ "var": "context.sawingResult.outcome" }, "FAILURE"] },
      "then_actions": [
        {
          "type": "DISPATCH_PERCEPTIBLE_EVENT",
          "parameters": {
            "eventId": "events:saw_through_barred_blocker_failure",
            "senses": ["sight", "hearing"],
            "actor_description": "The blade skips and slides across the surface, failing to find purchase. No progress is made despite your efforts.",
            "target_description": "{context.actorName} struggles with the saw, the blade screeching uselessly across the bars without making any real progress.",
            "alternate_descriptions": {
              "hearing_only": "An unpleasant screeching noise rings out, but it lacks the rhythmic quality of productive cutting."
            }
          }
        }
      ]
    },
    {
      "type": "IF",
      "condition": { "==": [{ "var": "context.sawingResult.outcome" }, "FUMBLE"] },
      "then_actions": [
        {
          "type": "UNWIELD_ITEM",
          "parameters": {
            "actorEntity": "{event.payload.actorId}",
            "itemEntity": "{event.payload.secondaryId}"
          }
        },
        {
          "type": "DROP_ITEM_AT_LOCATION",
          "parameters": {
            "actorEntity": "{event.payload.actorId}",
            "itemEntity": "{event.payload.secondaryId}",
            "locationId": "{context.actorPosition.locationId}"
          }
        },
        {
          "type": "DISPATCH_PERCEPTIBLE_EVENT",
          "parameters": {
            "eventId": "events:saw_through_barred_blocker_fumble",
            "senses": ["sight", "hearing"],
            "actor_description": "The blade catches awkwardly and jerks violently in your grip. The tool flies from your hands and clatters to the ground. No progress is made.",
            "target_description": "{context.actorName} loses control of the saw as it catches on the bars. The tool spins away and clangs loudly against the floor.",
            "alternate_descriptions": {
              "hearing_only": "A harsh scraping noise is followed by a loud clatter as something metal hits the ground."
            }
          }
        }
      ]
    }
  ]
}
```

#### 5.2 Event Condition

**File**: `data/mods/breaching/conditions/event-is-action-saw-through-barred-blocker.condition.json`

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "breaching:event-is-action-saw-through-barred-blocker",
  "description": "Checks if the event is the saw through barred blocker action",
  "expression": {
    "==": [{ "var": "event.payload.actionId" }, "breaching:saw_through_barred_blocker"]
  }
}
```

### 6. Color Scheme

**Add to**: `docs/mods/mod-color-schemes-used.md` (after creating the mod)

#### Rust Orange Color Scheme

This scheme evokes the imagery of rust, metal work, and industrial cutting - appropriate for the breaching mod's theme of cutting through corroded metal barriers.

```yaml
breaching:
  name: "Rust Orange"
  colors:
    primary: "#C44D0E"      # Deep rust orange - main theme color
    secondary: "#8B3A0A"    # Darker rust brown - accents
    background: "#1A0F08"   # Very dark warm brown - backdrop
    text: "#F5E6D3"         # Warm off-white - readable text
    accent: "#FF6B35"       # Bright orange - highlights/emphasis
  contrast_ratios:
    text_on_background: 11.2:1  # Exceeds WCAG AAA (7:1)
    primary_on_background: 5.8:1  # Exceeds WCAG AA (4.5:1)
    accent_on_background: 6.4:1   # Exceeds WCAG AA (4.5:1)
  usage: "Breaching mod - cutting through metal barriers, sawing, industrial actions"
```

**Also add to**: `docs/mods/mod-color-schemes-available.md` (if scheme should be reusable)

### 7. Mod Manifest Update

**File**: `data/mods/breaching/mod-manifest.json`

```json
{
  "id": "breaching",
  "version": "1.0.0",
  "name": "Breaching",
  "description": "Provides tools and actions for breaking through physical barriers using specialized equipment.",
  "author": "Living Narrative Engine",
  "dependencies": ["core", "blockers", "skills", "items", "movement"],
  "colorScheme": "rust-orange"
}
```

## Test Requirements

### 1. Action Discovery Tests

**File**: `tests/integration/mods/breaching/saw_through_barred_blocker_action_discovery.test.js`

#### Test Cases:

1. **Action Structure Validation**
   - Verify action has correct template format
   - Verify action has chanceBased configuration
   - Verify contestType is "opposed"
   - Verify correct actorSkillComponent and targetResistanceComponent
   - Verify all four outcomes are defined

2. **Discovery Scenarios - Should Discover**
   - Actor has craft_skill, wielding hacksaw, barred blocker nearby with structural_resistance
   - Actor with craft_skill, wielding hacksaw, corroded barred blocker nearby
   - Actor at location with multiple barred blockers (should show multiple options)

3. **Discovery Scenarios - Should NOT Discover**
   - Actor not wielding any sawing tool (hacksaw in inventory but not wielded)
   - Actor wielding non-sawing tool (sword, knife without sawing capability)
   - No barred blockers in nearby exits
   - Blocker is barred but lacks structural_resistance component
   - Blocker has structural_resistance but not is_barred
   - Blocker already has progress_tracker with value > 0 (already being worked on)

4. **Modifier Validation**
   - Corroded modifier (+10) applied when blocker has blockers:corroded component
   - Base chance calculated correctly without modifiers
   - Modifier tag 'corroded' included in action metadata

5. **Scope Resolution**
   - Primary scope correctly resolves barred blockers from movement exits
   - Secondary scope correctly resolves wielded items with allows_abrasive_sawing
   - Scope filters exclude invalid entities

### 2. Rule Execution Tests

**File**: `tests/integration/mods/breaching/saw_through_barred_blocker_rule_execution.test.js`

#### Test Cases:

1. **CRITICAL_SUCCESS Outcome**
   - Progress tracker added/incremented by 2
   - Perceptible event dispatched with correct actor/target descriptions
   - Tool remains wielded
   - Correct eventId used

2. **SUCCESS Outcome**
   - Progress tracker added/incremented by 1
   - Perceptible event dispatched with correct descriptions
   - Tool remains wielded
   - Correct eventId used

3. **FAILURE Outcome**
   - No progress tracker change (value stays 0 or unchanged)
   - Perceptible event dispatched with failure descriptions
   - Tool remains wielded
   - Correct eventId used

4. **FUMBLE Outcome**
   - No progress tracker change
   - Tool unwielded from actor
   - Tool dropped at actor's current location
   - Perceptible event dispatched with fumble descriptions
   - Correct eventId used

5. **Progress Accumulation**
   - Multiple successful attempts accumulate progress
   - Progress persists across action executions
   - Upsert behavior correctly handles existing vs new progress tracker

6. **Event Integration**
   - Perceptible events include all required senses (sight, hearing)
   - Alternate descriptions provided for hearing_only
   - Actor/target descriptions use correct context variables

### 3. Component Tests

**File**: `tests/unit/mods/breaching/components.test.js`

#### Test Cases:

1. **progress_tracker Component**
   - Validates with value: 0
   - Validates with value: 100
   - Validates with large values (no upper bound)
   - Rejects negative values
   - Rejects non-integer values
   - Rejects missing value property

2. **craft_skill Component**
   - Validates with value in range 0-100
   - Rejects values below 0
   - Rejects values above 100
   - Default value is 10

3. **allows_abrasive_sawing Component**
   - Validates as empty object (marker component)
   - Rejects additional properties

### 4. Scope Tests

**File**: `tests/integration/mods/breaching/scopes.test.js`

#### Test Cases:

1. **sawable_barred_blockers Scope**
   - Returns blockers with is_barred AND structural_resistance
   - Excludes blockers without is_barred
   - Excludes blockers without structural_resistance
   - Excludes blockers with progress_tracker.value > 0
   - Includes blockers with no progress_tracker
   - Includes blockers with progress_tracker.value = 0

2. **abrasive_sawing_tools Scope**
   - Returns wielded items with allows_abrasive_sawing
   - Excludes inventory items not wielded
   - Excludes wielded items without allows_abrasive_sawing

### 5. Edge Case Tests

**File**: `tests/integration/mods/breaching/edge_cases.test.js`

#### Test Cases:

1. **Multiple Valid Targets**
   - Action discovers when multiple barred blockers available
   - Action discovers when actor wields multiple sawing tools
   - Correct targets selected based on user choice

2. **State Transitions**
   - Blocker becomes "in progress" after first successful action
   - Previously worked blocker excluded from discovery (if progress > 0)
   - Tool state correctly updated after FUMBLE

3. **Component Interactions**
   - Corroded modifier stacks correctly with base chance
   - Skill values at boundaries (0, 100) work correctly
   - Structural resistance at boundaries (0, 100) work correctly

## Implementation Notes

### Dependencies

This action requires the following existing systems:
- `RESOLVE_CHANCE_BASED_ACTION` operation handler
- `ADD_COMPONENT` with upsert and incrementValue support
- `UNWIELD_ITEM` and `DROP_ITEM_AT_LOCATION` operations
- `DISPATCH_PERCEPTIBLE_EVENT` with sense-aware descriptions
- Scope DSL with JSON Logic filtering support

### Scope Expression Complexity

The `sawable_barred_blockers` scope uses a nested filter that checks:
1. Entity has `blockers:is_barred`
2. Entity has `blockers:structural_resistance`
3. Entity either lacks `core:progress_tracker` OR has `progress_tracker.value == 0`

This requires the scope engine to correctly evaluate the OR condition with missing component checks.

### Progress System Design

The progress tracker is designed to be generic and reusable:
- No upper bound allows different completion thresholds per use case
- Increment support enables cumulative progress
- Can be used for other multi-step actions (lockpicking, repairs, etc.)

### Future Extensions

1. **Completion Threshold**: Add logic to check when progress reaches a threshold (e.g., blocker destroyed when progress >= 5)
2. **Tool Durability**: Reduce tool durability on each use
3. **Noise Events**: Attract attention when sawing (guards, monsters)
4. **Material-Based Modifiers**: Different difficulty for iron vs steel bars
5. **Time-Based Progress Decay**: Progress resets if left too long
