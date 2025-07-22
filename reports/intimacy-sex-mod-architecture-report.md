# Intimacy and Sex Mod Architecture Report

This report provides a comprehensive overview of the intimacy and sex mods in Living Narrative Engine, serving as a reference guide for developers who want to add new actions and rules to these mods.

## Table of Contents
1. [Actions Overview](#actions-overview)
2. [Component Usage Analysis](#component-usage-analysis)
3. [Conditions Reference](#conditions-reference)
4. [Scopes Reference](#scopes-reference)
5. [Rule Workflow Patterns](#rule-workflow-patterns)
6. [Development Guidelines](#development-guidelines)

## Actions Overview

### Intimacy Mod Actions

The intimacy mod provides 31 actions that enable romantic and intimate interactions between characters:

#### Basic Physical Contact
- `adjust_clothing` - Adjust target's clothing seductively
- `brush_hand` - Gently brush hands together
- `fondle_ass` - Fondle target's buttocks
- `get_close` - Move closer to someone
- `step_back` - Step away from the current interaction
- `place_hand_on_waist` - Place hand on target's waist
- `thumb_wipe_cheek` - Gently wipe target's cheek with thumb

#### Kissing Actions
- `kiss_cheek` - Softly kiss target's cheek
- `peck_on_lips` - Quick kiss on the lips
- `lean_in_for_deep_kiss` - Initiate a deep, meaningful kiss
- `accept_kiss_passively` - Passively accept ongoing kiss
- `kiss_back_passionately` - Return kiss with passion
- `explore_mouth_with_tongue` - Deepen kiss with tongue
- `nibble_lower_lip` - Gently nibble partner's lower lip
- `suck_on_tongue` - Suck on partner's tongue during kiss
- `cup_face_while_kissing` - Cup partner's face during kiss
- `break_kiss_gently` - Gently end the kiss
- `pull_back_breathlessly` - Pull back from kiss breathlessly
- `pull_back_in_revulsion` - Pull away from kiss in disgust

#### Body Language
- `lick_lips` - Seductively lick own lips
- `turn_around` - Turn to face away from target
- `turn_around_to_face` - Turn to face someone you were facing away from

#### Massage Actions
- `massage_shoulders` - Massage target's shoulders
- `massage_back` - Massage target's back

### Sex Mod Actions

The sex mod currently provides 2 explicit sexual actions:
- `fondle_breasts` - Fondle target's breasts
- `fondle_penis` - Fondle target's penis

## Component Usage Analysis

### Intimacy Components

#### `intimacy:closeness`
- **Purpose**: Tracks mutual closeness between characters
- **Structure**: Contains an array of partner entity IDs
- **Usage**: Required for most intimate actions; represents consent and mutual interest
- **Key Feature**: Fully-connected graph - all partners must have each other in their closeness arrays

#### `intimacy:facing_away`
- **Purpose**: Tracks which entities a character is facing away from
- **Structure**: Contains an array of entity IDs the character has turned away from
- **Usage**: Blocks face-to-face actions; enables back-facing actions like back massage
- **State Management**: Added by turn_around action, removed by turn_around_to_face

#### `intimacy:kissing`
- **Purpose**: Tracks active kissing state between two characters
- **Structure**: Contains partner ID and initiator flag
- **Usage**: Required for kissing continuation actions; prevents multiple simultaneous kisses
- **Key Feature**: Bidirectional - both participants have the component pointing to each other

### How Components Enable Actions

1. **Prerequisite Checking**: Actions use `required_components` to ensure proper state
2. **State Prevention**: Actions use `forbidden_components` to prevent invalid states
3. **Relationship Tracking**: Components maintain relationship state between entities
4. **Action Chaining**: Components enable sequences of related actions

## Conditions Reference

### Event-Based Conditions

Both mods use a consistent pattern for checking action events:
- Pattern: `event-is-action-[action-name]`
- Logic: `{"==": [{"var": "event.payload.actionId"}, "modId:action_name"]}`
- Purpose: Used in rules to handle specific action attempts

#### Intimacy Event Conditions (28 total)
- All action-based conditions follow the naming pattern above
- Examples: `event-is-action-kiss-cheek`, `event-is-action-lean-in-for-deep-kiss`

#### Sex Event Conditions (2 total)
- `event-is-action-fondle-breasts`
- `event-is-action-fondle-penis`

### State-Based Conditions

#### Intimacy State Conditions
- `actor-is-in-closeness` - Checks if actor has closeness component
- `entity-in-facing-away` - Checks if entity is in someone's facing_away list
- `entity-not-in-facing-away` - Inverse of above
- `actor-in-entity-facing-away` - Checks if actor is facing away from entity
- `actor-is-kiss-receiver` - Checks if actor is not the kiss initiator
- `target-is-kissing-partner` - Validates target is current kissing partner

## Scopes Reference

Scopes define the available targets for actions using the custom scope DSL.

### Core Scopes (Referenced)
- `none` - No target required (self-actions)
- `self` - Target is the actor themselves
- `core:actors_in_location` - All actors in the same location

### Intimacy Scopes

#### Basic Interaction Scopes
- **`intimacy:close_actors`**
  - Returns: All partners in actor's closeness circle
  - Usage: Basic intimate actions that don't require specific positioning

- **`intimacy:close_actors_facing_forward`**
  - Returns: Closeness partners not in facing_away list
  - Usage: Face-to-face actions like kissing, eye contact actions

- **`intimacy:close_actors_facing_away`**
  - Returns: Closeness partners in facing_away list
  - Usage: Actions performed from behind like back massage

#### Body-Part Specific Scopes
- **`intimacy:actors_with_mouth_facing_forward`**
  - Returns: Facing-forward closeness partners with mouth body part
  - Usage: Kissing initiation actions

- **`intimacy:actors_with_arms_facing_forward`**
  - Returns: Facing-forward closeness partners with arm body parts
  - Usage: Shoulder massage actions

- **`intimacy:actors_with_ass_cheeks_facing_forward`**
  - Returns: Facing-forward closeness partners with buttocks
  - Usage: Ass fondling actions

#### Special Relationship Scopes
- **`intimacy:current_kissing_partner`**
  - Returns: The entity currently being kissed
  - Usage: Actions during active kissing (nibble lip, break kiss, etc.)

- **`intimacy:actors_im_facing_away_from`**
  - Returns: Entities in actor's facing_away list
  - Usage: Turn around to face actions

#### Clothing-Aware Scopes
- **`intimacy:close_actors_facing_forward_with_torso_clothing`**
  - Returns: Facing-forward partners wearing torso clothing
  - Usage: Clothing adjustment actions

### Sex Scopes

- **`sex:actors_with_breasts_facing_forward`**
  - Returns: Facing-forward closeness partners with exposed breasts
  - Checks: Breast body parts exist AND chest sockets uncovered

- **`sex:actors_with_penis_facing_forward`**
  - Returns: Facing-forward closeness partners with exposed penis
  - Checks: Penis body part exists AND groin socket uncovered

## Rule Workflow Patterns

### Standard Rule Structure

All rules follow a consistent pattern:

1. **Event Trigger**: `core:attempt_action` event
2. **Condition Check**: Verify it's the correct action
3. **Context Building**:
   - Get actor and target names
   - Query actor position for location
   - Build descriptive message
4. **State Modification** (if needed):
   - Add/remove components
   - Update relationships
5. **Event Dispatch**: Log success and end turn

### Rule Action Sequence

```json
{
  "actions": [
    // 1. Get entity names
    { "type": "GET_NAME", "parameters": { "entity_ref": "actor", "result_variable": "actorName" }},
    { "type": "GET_NAME", "parameters": { "entity_ref": "target", "result_variable": "targetName" }},
    
    // 2. Get location context
    { "type": "QUERY_COMPONENT", "parameters": { 
      "entity_ref": "actor", 
      "component_type": "core:position",
      "result_variable": "actorPosition"
    }},
    
    // 3. (Optional) Modify state
    { "type": "ADD_COMPONENT", "parameters": { /* component data */ }},
    { "type": "REMOVE_COMPONENT", "parameters": { /* component ref */ }},
    
    // 4. Set message variables
    { "type": "SET_VARIABLE", "parameters": { 
      "variable_name": "logMessage",
      "value": "Descriptive action text with {context.actorName} and {context.targetName}"
    }},
    
    // 5. Set perception metadata
    { "type": "SET_VARIABLE", "parameters": { 
      "variable_name": "perceptionType",
      "value": "action_target_general"
    }},
    
    // 6. Use macro for standard completion
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

### State Management Patterns

#### Bidirectional State (Kissing)
When initiating kissing, both participants receive the component:
- Actor: `{"partner": targetId, "initiator": true}`
- Target: `{"partner": actorId, "initiator": false}`

#### Unidirectional State (Facing Away)
Only the actor who turns away gets the component:
- Actor adds target to their `facing_away_from` array

#### Mutual State (Closeness)
Both entities must have each other in their partner arrays:
- Validated by action prerequisites
- Managed outside the intimacy/sex mods

## Development Guidelines

### Adding New Actions

1. **Define the Action** (`actions/[name].action.json`):
   - Choose appropriate scope
   - Set required/forbidden components
   - Create descriptive template

2. **Create Event Condition** (`conditions/event-is-action-[name].condition.json`):
   - Follow naming convention
   - Simple equality check for action ID

3. **Implement Rule** (`rules/[name].rule.json`):
   - Follow standard workflow pattern
   - Include all context building steps
   - Add state modifications if needed

4. **Consider State Requirements**:
   - Does this action require new components?
   - Should it modify existing state?
   - What prerequisites make sense?

### Scope Selection Guide

Choose scopes based on:
- **Positioning Requirements**: Face-to-face vs. any position
- **Body Part Requirements**: Specific anatomy needed
- **State Requirements**: Active relationships (kissing partner)
- **Clothing Requirements**: Covered vs. exposed body parts

### Best Practices

1. **Consistency**: Follow existing naming patterns
2. **State Safety**: Always validate prerequisites
3. **Bidirectional Updates**: Keep mutual states synchronized
4. **Descriptive Text**: Write immersive action descriptions
5. **Component Design**: Keep components focused and simple

### Common Patterns to Follow

- **Action Naming**: Use snake_case, be descriptive
- **Condition Naming**: `event-is-action-[exact-action-name]`
- **Rule Naming**: `handle_[action_name]` or just `[action_name]`
- **Component Usage**: Check existing components before creating new ones
- **Scope Usage**: Reuse existing scopes when possible

This architecture provides a flexible foundation for intimate interactions while maintaining clear boundaries and consent through the component system.