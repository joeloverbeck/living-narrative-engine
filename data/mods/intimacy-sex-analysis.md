# Comprehensive Analysis: Intimacy and Sex Modules

## Overview

This document provides a detailed analysis of the intimacy and sex modules in the Living Narrative Engine. These modules work together to implement romantic and sexual interactions between characters in the game.

## Module Dependencies

```
anatomy (base module)
   ↓
intimacy (requires anatomy)
   ↓
sex (requires both anatomy and intimacy)
```

## Intimacy Module Analysis

### Purpose
The intimacy module allows characters to enter close physical proximity and perform non-sexual intimate actions. It introduces the concept of "closeness circles" - groups of characters who are physically close to each other.

### Core Component: Closeness
```json
{
  "id": "intimacy:closeness",
  "description": "A fully-connected, order-independent set of actors who have explicitly chosen to be 'close'",
  "properties": {
    "partners": ["array of entity IDs in the same closeness circle"]
  }
}
```

### Actions

| Action | Command | Scope | Prerequisites | Description |
|--------|---------|--------|---------------|-------------|
| get_close | get-close | core:actors_in_location | Can move (functioning legs) | Enter someone's personal space, creating/merging closeness circles |
| step_back | step-back | none | Has closeness component | Exit closeness circle, ending intimacy |
| adjust_clothing | adjust-clothing | intimacy:close_actors | Actor is in closeness | Smooth clothing with possessive care |
| kiss_cheek | kiss-cheek | intimacy:close_actors | Has closeness component | Kiss target's cheek |
| massage_shoulders | massage-shoulders | intimacy:actors_with_arms_in_intimacy | Has closeness component | Massage shoulders (target must have arms) |
| thumb_wipe_cheek | thumb-wipe-cheek | intimacy:close_actors | Has closeness component | Wipe cheek with thumb |

### Scopes

1. **intimacy:close_actors**: `actor.components.intimacy:closeness.partners[]`
   - Returns all partners in the actor's closeness circle

2. **intimacy:actors_with_arms_in_intimacy**: `actor.intimacy:closeness.partners[][{"hasPartOfType": [".", "arm"]}]`
   - Filters close actors who have arms (for massage action)

### Rule Patterns

#### Complex Rules

1. **get_close** (Uses MERGE_CLOSENESS_CIRCLE action type)
   - Implements algorithm §5.1 from spec
   - Merges actor and target closeness circles
   - Creates fully-connected graph
   - Locks movement for all members
   - Dispatches state change observable event

2. **step_back** (Uses REMOVE_FROM_CLOSENESS_CIRCLE action type)
   - Implements algorithm §5.2 from spec
   - Removes actor from circle
   - Cleans up components
   - Unlocks partners who are now alone
   - Dispatches state change observable event

#### Simple Rules

All other intimacy actions follow a standard pattern:
1. GET_NAME for actor and target
2. QUERY_COMPONENT for actor position
3. SET_VARIABLE for message construction
4. Dispatch perceptible event (type: action_target_general)
5. Use macro: core:logSuccessAndEndTurn

## Sex Module Analysis

### Purpose
The sex module extends intimacy to allow sexual interactions between characters who are already in a closeness circle. It depends on both anatomy (for body parts) and intimacy (for closeness).

### Actions

| Action | Command | Scope | Prerequisites | Description |
|--------|---------|--------|---------------|-------------|
| fondle_breasts | fondle-breasts | sex:actors_with_breasts_in_intimacy | Has closeness component | Fondle target's breasts |
| fondle_penis | fondle-penis | sex:actors_with_penis_in_intimacy | Has closeness component | Fondle target's penis |

### Scopes

1. **sex:actors_with_breasts_in_intimacy**: `actor.intimacy:closeness.partners[][{"hasPartOfType": [".", "breast"]}]`
   - Filters close actors who have breasts

2. **sex:actors_with_penis_in_intimacy**: `actor.intimacy:closeness.partners[][{"hasPartOfType": [".", "penis"]}]`
   - Filters close actors who have a penis

### Rule Patterns

Both sex actions follow the same simple pattern as most intimacy actions:
1. GET_NAME for actor and target
2. QUERY_COMPONENT for actor position
3. SET_VARIABLE for descriptive message
4. Dispatch perceptible event (type: action_target_general)
5. Use macro: core:logSuccessAndEndTurn

## Key Design Patterns

### 1. Closeness Circle Algorithm
- Fully-connected graph structure where all members know all other members
- Merging circles combines all participants
- Leaving a circle may leave others alone (unlocking their movement)
- Movement is locked while in a closeness circle

### 2. Anatomy-Based Targeting
- Scopes use `hasPartOfType` to filter valid targets
- Ensures actions only appear for anatomically appropriate targets
- Examples: massage requires arms, sexual actions require specific body parts

### 3. Event Dispatching
- **action_target_general**: For observable actions between two characters
- **state_change_observable**: For state changes (entering/leaving closeness)
- All events include location for perception system

### 4. Consistent Naming Conventions
- Actions: module:verb_object (e.g., intimacy:kiss_cheek)
- Rules: handle_verb_object or module_handle_verb_object
- Conditions: event-is-action-{action-name}
- Scopes: descriptive names indicating filtering criteria

### 5. Prerequisite Patterns
- Some actions check conditions (e.g., can move)
- Others rely purely on scope filtering
- adjust_clothing uniquely requires both scope AND prerequisite check

## Architecture Insights

### Modularity
- Clear separation between non-sexual (intimacy) and sexual (sex) interactions
- Sex module builds on intimacy's closeness system
- Both modules depend on anatomy for body part detection

### Extensibility
- New intimate actions can be added following the established patterns
- New body-part-specific actions can use the scope filtering pattern
- The closeness component could be extended with additional properties

### Event System Integration
- All actions generate perceptible events for the game's observation system
- Different perception types allow NPCs to react appropriately
- Location-based events enable spatial awareness

## Potential Improvements

1. **Consent System**: No explicit consent checking beyond scope filtering
2. **Emotional States**: Actions don't consider emotional compatibility
3. **Privacy Awareness**: No consideration of public vs private spaces
4. **Relationship Tracking**: Closeness is temporary; no persistent relationship data
5. **Action Variety**: Limited number of actions, especially in sex module

## Conclusion

The intimacy and sex modules demonstrate a well-structured approach to handling sensitive character interactions. The use of scopes for anatomy-based filtering, the closeness circle algorithm for managing groups, and consistent patterns across actions and rules show thoughtful design. The modular architecture allows for clear boundaries between different types of interactions while enabling code reuse through shared components and patterns.