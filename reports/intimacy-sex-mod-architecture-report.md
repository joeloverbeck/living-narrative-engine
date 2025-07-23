# Intimacy and Sex Mods Architecture Report

## Executive Summary

This report provides a comprehensive analysis of the intimacy and sex mods in the Living Narrative Engine. These mods demonstrate the engine's modding architecture for creating complex interpersonal interactions through a component-based system. The report serves as a reference for creating additional actions and rules for both mods.

## 1. Actions Catalog

### 1.1 Intimacy Mod Actions (25 total)

#### Closeness Management
- **get_close**: Move closer to target, entering personal space
  - Scope: `core:actors_in_location`
  - Prerequisites: Can move (functioning legs)
  - Creates/merges closeness circles
  
- **step_back**: Move away from closeness
  - Scope: `intimacy:close_actors`
  - Removes from closeness circle

#### Position/Orientation Actions
- **turn_around**: Turn to face away from someone
  - Scope: `intimacy:close_actors`
  - Adds `facing_away` component
  
- **turn_around_to_face**: Turn to face someone you were facing away from
  - Scope: `intimacy:actors_im_facing_away_from`
  - Removes from `facing_away` list

#### Simple Touch Actions
- **thumb_wipe_cheek**: Gentle cheek touch
  - Scope: `intimacy:close_actors_facing_forward`
  - Requires: closeness, both facing each other
  
- **place_hand_on_waist**: Intimate waist touch
  - Scope: `intimacy:close_actors_facing_forward`
  - Requires: closeness
  
- **brush_hand**: Light hand contact
  - Scope: `intimacy:close_actors`
  - Requires: closeness

#### Kissing Actions (Non-Deep)
- **peck_on_lips**: Quick, light kiss
  - Scope: `intimacy:close_actors_facing_forward`
  - Requires: closeness
  - Forbidden: already kissing
  
- **kiss_cheek**: Cheek kiss
  - Scope: `intimacy:close_actors_facing_forward`
  - Requires: closeness

#### Deep Kissing Actions
- **lean_in_for_deep_kiss**: Initiate deep kiss
  - Scope: `intimacy:close_actors_facing_forward`
  - Requires: closeness
  - Creates: kissing component for both parties
  
- **kiss_back_passionately**: Reciprocate kiss
  - Scope: `intimacy:current_kissing_partner`
  - Requires: being kissed (non-initiator)
  
- **accept_kiss_passively**: Passive kiss response
  - Scope: `intimacy:current_kissing_partner`
  - Requires: being kissed
  
- **explore_mouth_with_tongue**: Deepen kiss
  - Scope: `intimacy:current_kissing_partner`
  - Requires: active kissing
  
- **nibble_lower_lip**: Playful kiss variation
  - Scope: `intimacy:current_kissing_partner`
  - Requires: active kissing
  
- **suck_on_tongue**: Intense kiss variation
  - Scope: `intimacy:current_kissing_partner`
  - Requires: active kissing
  
- **cup_face_while_kissing**: Add touch to kiss
  - Scope: `intimacy:current_kissing_partner`
  - Requires: active kissing

#### Kiss Ending Actions
- **break_kiss_gently**: End kiss softly
  - Scope: `intimacy:current_kissing_partner`
  - Removes: kissing components
  
- **pull_back_breathlessly**: End kiss with passion
  - Scope: `intimacy:current_kissing_partner`
  - Removes: kissing components
  
- **pull_back_in_revulsion**: End kiss negatively
  - Scope: `intimacy:current_kissing_partner`
  - Removes: kissing components

#### Other Intimate Actions
- **lick_lips**: Suggestive gesture
  - Scope: `intimacy:actors_with_mouth_facing_forward`
  - Requires: mouth anatomy, facing each other
  
- **nuzzle_face_into_neck**: Neck intimacy
  - Scope: `intimacy:close_actors_facing_forward_or_behind_target`
  - Can work face-to-face or from behind
  
- **massage_shoulders**: Upper body touch
  - Scope: `intimacy:actors_with_arms_facing_forward_or_behind_target`
  - Requires: arms, can work from front or behind
  
- **massage_back**: Back massage
  - Scope: `intimacy:close_actors_facing_away`
  - Requires: target facing away
  
- **fondle_ass**: Bottom touch
  - Scope: `intimacy:actors_with_ass_cheeks_facing_forward_or_behind_target`
  - Works from front or behind
  
- **adjust_clothing**: Clothing interaction
  - Scope: `intimacy:close_actors_facing_forward_with_torso_clothing`
  - Requires: target has torso clothing

### 1.2 Sex Mod Actions (2 total)

- **fondle_breasts**: Breast touch
  - Scope: `sex:actors_with_breasts_facing_forward`
  - Requires: closeness, target has breasts
  
- **fondle_penis**: Genital touch
  - Scope: `sex:actors_with_penis_facing_forward`
  - Requires: closeness, target has penis

## 2. Components Analysis

### 2.1 Intimacy Components

#### closeness
- **Purpose**: Tracks "closeness circles" - groups of actors in intimate proximity
- **Structure**: Array of partner IDs forming a fully-connected graph
- **Usage**: Required for almost all intimate actions
- **Created by**: `get_close` action via `MERGE_CLOSENESS_CIRCLE` operation
- **Removed by**: `step_back` action

#### kissing
- **Purpose**: Tracks active kissing between two characters
- **Structure**: 
  - `partner`: ID of kissing partner
  - `initiator`: Boolean indicating who started the kiss
- **Usage**: Gates kissing-specific actions
- **Created by**: `lean_in_for_deep_kiss`
- **Removed by**: All kiss-ending actions

#### facing_away
- **Purpose**: Tracks positional orientation in intimate contexts
- **Structure**: Array of entity IDs the actor is facing away from
- **Usage**: Enables position-aware actions (from behind)
- **Modified by**: `turn_around`, `turn_around_to_face`

### 2.2 Component Involvement Patterns

1. **Gating Access**: Components act as prerequisites
   - Most actions require `closeness`
   - Kissing actions require `kissing` component
   
2. **State Tracking**: Components maintain interaction state
   - `kissing` tracks active kiss with role info
   - `facing_away` tracks spatial relationships
   
3. **Forbidden States**: Components can block actions
   - Can't `peck_on_lips` if already `kissing`

## 3. Conditions Catalog

### 3.1 Component State Conditions

#### Presence Checks
- **actor-is-in-closeness**: Has closeness component
- **entity-in-facing-away**: Has facing_away component
- **entity-not-in-facing-away**: Lacks facing_away component

#### Relationship Checks
- **actor-is-kiss-receiver**: Is being kissed (initiator = false)
- **target-is-kissing-partner**: Target matches kissing.partner
- **actor-in-entity-facing-away**: Actor ID in entity's facing_away array
- **actor-is-behind-entity**: Actor is behind entity (positional)
- **both-actors-facing-each-other**: Neither facing away from other

### 3.2 Event Conditions

All actions have corresponding event conditions following pattern:
- **event-is-action-[action-name]**: Checks if event.payload.actionId matches

Examples:
- `event-is-action-get-close`
- `event-is-action-lean-in-for-deep-kiss`
- `event-is-action-fondle-breasts`

### 3.3 Condition Usage Patterns

1. **Rule Triggers**: Event conditions determine which rule handles an action
2. **Scope Filters**: Conditions filter entities in scopes
3. **Complex Logic**: Conditions combine with AND/OR for sophisticated checks

## 4. Scopes Documentation

### 4.1 Basic Intimacy Scopes

#### Simple Partner Access
- **close_actors**: Direct access to closeness partners
  ```
  actor.components.intimacy:closeness.partners[]
  ```

- **current_kissing_partner**: Access to active kissing partner
  ```
  [actor.components.intimacy:kissing.partner]
  ```

### 4.2 Position-Aware Scopes

#### Facing Requirements
- **close_actors_facing_forward**: Partners where both face each other
  - Uses condition: `both-actors-facing-each-other`
  
- **close_actors_facing_away**: Partners actor is facing away from
  - Uses facing_away component

- **actors_im_facing_away_from**: Entities in facing_away list
  ```
  actor.components.intimacy:facing_away.facing_away_from[]
  ```

### 4.3 Anatomy-Filtered Scopes

#### With Position Requirements
- **actors_with_arms_facing_forward**: Has arms + facing each other
- **actors_with_arms_facing_forward_or_behind_target**: Arms + facing OR behind
- **actors_with_ass_cheeks_facing_forward**: Has buttocks + facing
- **actors_with_mouth_facing_forward**: Has mouth + facing

#### Sex Mod Anatomy Scopes
- **actors_with_breasts_facing_forward**: Breasts + facing + closeness
- **actors_with_penis_facing_forward**: Penis + facing + closeness

### 4.4 Scope Usage Guidelines

1. **Action Availability**: Scopes determine valid targets
2. **Anatomy Requirements**: Filter by required body parts
3. **Position Requirements**: Ensure proper orientation
4. **Component Requirements**: Check necessary states

## 5. Rule Processing Patterns

### 5.1 Common Rule Structure

All rules follow this pattern:

```json
{
  "rule_id": "handle_[action_name]",
  "event_type": "core:attempt_action",
  "condition": { "condition_ref": "[mod]:event-is-action-[name]" },
  "actions": [
    // 1. Get actor/target names
    // 2. Get actor position
    // 3. Perform state changes (if any)
    // 4. Set variables for logging
    // 5. Call logSuccessAndEndTurn macro
  ]
}
```

### 5.2 Rule Action Patterns

#### Standard Actions (GET_NAME, QUERY_COMPONENT)
Every rule retrieves:
1. Actor name via GET_NAME
2. Target name via GET_NAME
3. Actor position via QUERY_COMPONENT

#### State Modification Patterns

**Component Addition**:
```json
{
  "type": "ADD_COMPONENT",
  "parameters": {
    "entity_ref": "actor/target",
    "component_type": "intimacy:kissing",
    "value": { /* component data */ }
  }
}
```

**Component Removal**:
```json
{
  "type": "REMOVE_COMPONENT",
  "parameters": {
    "entity_ref": "actor/target",
    "component_type": "intimacy:kissing"
  }
}
```

**Special Operations**:
- `MERGE_CLOSENESS_CIRCLE`: Complex closeness management
- `BREAK_CLOSENESS`: Remove from closeness circle

### 5.3 Logging Pattern

All rules set these variables:
1. **logMessage**: Descriptive text of action
2. **locationId**: Where action occurred
3. **perceptionType**: How others perceive it
   - `action_target_general`: Most actions
   - `state_change_observable`: State changes
4. **targetId**: Who was affected

Then call macro: `core:logSuccessAndEndTurn`

## 6. Architectural Guidelines

### 6.1 Creating New Actions

1. **Define Action File**:
   ```json
   {
     "id": "mod:action_name",
     "name": "Human Readable Name",
     "description": "What it does",
     "scope": "appropriate_scope",
     "required_components": {
       "actor": ["required_components"]
     },
     "forbidden_components": {
       "actor": ["incompatible_states"]
     },
     "template": "verb {target} phrase"
   }
   ```

2. **Choose Appropriate Scope**:
   - Basic proximity: Use `close_actors` variants
   - Anatomy-specific: Create filtered scopes
   - Position-aware: Consider facing requirements
   - State-specific: Use component-filtered scopes

3. **Set Component Requirements**:
   - Most intimate actions need `closeness`
   - State-specific actions need relevant components
   - Use forbidden_components to prevent conflicts

### 6.2 Creating New Rules

1. **Create Event Condition**:
   ```json
   {
     "id": "mod:event-is-action-name",
     "logic": {
       "==": [
         { "var": "event.payload.actionId" },
         "mod:action_name"
       ]
     }
   }
   ```

2. **Implement Rule**:
   - Follow standard structure
   - Always get names and position
   - Modify state if needed
   - Provide descriptive logging
   - Use appropriate perception type

### 6.3 Creating New Components

1. **Design Component Schema**:
   - Minimize data stored
   - Use arrays for multi-relationships
   - Include role/state information

2. **Consider Lifecycle**:
   - How is it created?
   - When is it removed?
   - What conflicts with it?

### 6.4 Creating New Scopes

1. **Anatomy-Based**: Use `hasPartOfType` filter
2. **Component-Based**: Access component arrays
3. **Condition-Based**: Apply condition_ref filters
4. **Composite**: Combine multiple requirements with AND/OR

### 6.5 Best Practices

1. **Consistency**: Follow naming patterns exactly
2. **Modularity**: Sex mod builds on intimacy mod
3. **State Management**: Clean up components properly
4. **Descriptive Text**: Make actions feel natural
5. **Anatomy Awareness**: Check for required body parts
6. **Position Awareness**: Consider spatial relationships
7. **Permission Model**: Use closeness as consent proxy

## 7. Extension Recommendations

### 7.1 Potential Intimacy Actions
- Caress face/hair
- Hold hands
- Embrace/hug variations
- Whisper in ear
- Rest head on shoulder
- Intertwine fingers

### 7.2 Potential Sex Actions
- Remove clothing items
- Kiss body parts
- Various intimate touches
- Position changes
- Climax mechanics

### 7.3 New Components to Consider
- arousal (track excitement level)
- comfort (track comfort with partner)
- intimacy_history (track past interactions)
- clothing_state (track what's worn/removed)

### 7.4 New Conditions to Consider
- Arousal thresholds
- Comfort levels
- Privacy checks
- Consent verification
- Relationship status

## Conclusion

The intimacy and sex mods demonstrate a well-architected component-based system for modeling complex interpersonal interactions. The pattern of components → scopes → actions → rules provides a flexible framework that can be extended with new content while maintaining consistency and modularity. Following the patterns documented here will ensure new content integrates seamlessly with the existing system.