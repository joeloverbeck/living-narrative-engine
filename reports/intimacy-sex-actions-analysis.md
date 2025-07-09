# Comprehensive Analysis: Intimacy and Sex Modules Action System

## Executive Summary

This report provides a detailed analysis of how actions, rules, conditions, and scopes work together in the intimacy and sex modules of the Living Narrative Engine. The analysis reveals a sophisticated, consent-based system leveraging the ScopeDSL for dynamic targeting and the closeness component for relationship management.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [ScopeDSL Implementation](#scopedsl-implementation)
3. [Action System Analysis](#action-system-analysis)
4. [Rule System Analysis](#rule-system-analysis)
5. [Component and State Management](#component-and-state-management)
6. [Design Patterns and Principles](#design-patterns-and-principles)
7. [Key Findings](#key-findings)
8. [Recommendations for New Actions](#recommendations-for-new-actions)

## Architecture Overview

### System Components

The intimacy and sex modules implement a four-layer architecture:

1. **Actions Layer** - Defines available commands and targeting
2. **Scopes Layer** - Implements dynamic entity filtering using ScopeDSL
3. **Rules Layer** - Handles action execution and state changes
4. **Components Layer** - Manages persistent state (closeness relationships)

### Module Structure

```
data/mods/
├── intimacy/
│   ├── actions/ (6 files)
│   ├── rules/ (6 files)
│   ├── scopes/ (2 scopes)
│   ├── conditions/ (event conditions)
│   └── components/ (closeness component)
└── sex/
    ├── actions/ (2 files)
    ├── rules/ (2 files)
    └── scopes/ (2 scopes)
```

## ScopeDSL Implementation

### Scope Definitions

#### Intimacy Module Scopes

1. **`intimacy:close_actors`**

   ```
   actor.components.intimacy:closeness.partners[]
   ```

   - Returns all entities in the actor's closeness circle
   - Simple array iteration over the partners list

2. **`intimacy:actors_with_arms_in_intimacy`**

   ```
   actor.intimacy:closeness.partners[][{"hasPartOfType": [".", "arm"]}]
   ```

   - Filters close actors by anatomical requirements
   - Uses custom JSON Logic operator `hasPartOfType`

#### Sex Module Scopes

1. **`sex:actors_with_breasts_in_intimacy`**
   - Filters close actors who have breasts anatomy

2. **`sex:actors_with_penis_in_intimacy`**
   - Filters close actors who have penis anatomy

### Key ScopeDSL Patterns Used

1. **Component Access Pattern**

   ```
   actor.components.<component_id>.<property>[]
   ```

2. **Anatomical Filtering Pattern**

   ```
   <source>[][{"hasPartOfType": [".", "<body_part>"]}]
   ```

3. **Relationship-Based Filtering**
   - All intimate/sexual actions scope from the actor's closeness partners
   - Ensures consent through the closeness component requirement

## Action System Analysis

### Action Structure

All actions follow a consistent JSON structure:

```json
{
  "id": "<mod>:<action_name>",
  "commandVerb": "<kebab-case-verb>",
  "scope": "<scope_reference>",
  "required_components": {
    "actor": ["<component_ids>"]
  },
  "prerequisites": [...]
}
```

### Action Categories

#### 1. Relationship Initiation

- **`intimacy:get_close`**
  - Entry point to intimacy system
  - Uses `core:actors_in_location` scope (broader targeting)
  - No closeness component required
  - Creates bidirectional closeness relationship

#### 2. Simple Intimate Actions

- **`intimacy:kiss_cheek`**
- **`intimacy:thumb_wipe_cheek`**
- Basic intimate gestures requiring closeness
- No anatomical requirements

#### 3. Anatomy-Aware Actions

- **`intimacy:massage_shoulders`** - Requires target has arms
- **`sex:fondle_breasts`** - Requires target has breasts
- **`sex:fondle_penis`** - Requires target has penis

#### 4. Relationship Termination

- **`intimacy:step_back`**
  - Removes actor from closeness circle
  - Scope: `none` (self-targeted action)
  - Cleans up relationship state

### Prerequisites Analysis

Only 2 of 8 actions use prerequisites:

- `adjust_clothing`: Requires `intimacy:actor-is-in-closeness`
- `get_close`: Requires `core:actor-can-move`

Most actions rely on scope filtering and required components instead of prerequisites.

## Rule System Analysis

### Rule Execution Pattern

All rules follow a standard execution sequence:

1. Event trigger: `core:attempt_action`
2. Condition check: `<mod>:event-is-action-<action_name>`
3. Action sequence:
   - GET_NAME (actor and target)
   - QUERY_COMPONENT (position)
   - SET_VARIABLE (multiple context variables)
   - Action-specific operations
   - End turn

### Specialized Action Types

#### Closeness Management Actions

1. **`MERGE_CLOSENESS_CIRCLE`** (used by get_close)
   - Merges two entities into a single closeness circle
   - Creates bidirectional relationships
   - Locks movement for all members
   - Implements algorithm §5.1

2. **`REMOVE_FROM_CLOSENESS_CIRCLE`** (used by step_back)
   - Removes entity from closeness circle
   - Cleans up components
   - Unlocks movement for isolated entities
   - Implements algorithm §5.2

### Perception Types

- **`action_target_general`**: Used for targeted intimate actions
- **`state_change_observable`**: Used for relationship state changes

## Component and State Management

### Closeness Component

```json
{
  "partners": ["entity_id_1", "entity_id_2", ...]
}
```

Key properties:

- **Bidirectional**: All partners reference each other
- **Transitive**: All members form a fully-connected graph
- **Movement Locking**: Prevents movement while in closeness
- **Consent Model**: Acts as explicit permission for intimate actions

### State Transitions

```
No Closeness → [get_close] → In Closeness Circle → [intimate actions] → [step_back] → No Closeness
```

## Design Patterns and Principles

### 1. Consent-Based Architecture

- Closeness component acts as explicit consent mechanism
- All intimate actions require mutual closeness relationship
- Clear entry (get_close) and exit (step_back) points

### 2. Anatomical Awareness

- Scopes filter based on body part availability
- Prevents impossible actions through targeting restrictions
- Uses custom `hasPartOfType` operator for anatomy checks

### 3. Separation of Concerns

- **Actions**: Define UI and targeting
- **Scopes**: Handle dynamic filtering
- **Rules**: Manage execution and state changes
- **Components**: Store persistent state

### 4. Modular Extension

- Sex mod extends intimacy patterns without modification
- Consistent naming conventions across modules
- Reusable scope patterns

### 5. Declarative Design

- ScopeDSL enables data-driven targeting
- JSON Logic for flexible filtering
- Minimal hardcoded logic

## Key Findings

### Strengths

1. **Robust Consent System**: The closeness component ensures all intimate interactions are consensual
2. **Anatomical Realism**: Actions respect body part requirements
3. **Clean State Management**: Clear algorithms for relationship management
4. **Extensibility**: Easy to add new actions following established patterns
5. **Data-Driven Design**: Minimal code required for new content

### Observations

1. **Simple Narrative Style**: Current actions use basic descriptions
2. **Limited State Effects**: Most actions only log and end turn
3. **No Emotion/Mood Integration**: Actions don't check or modify emotional states
4. **No Progression System**: All intimate actions are equally available

### Technical Insights

1. **Efficient Scope Resolution**: Direct array access for partner lists
2. **Atomic Operations**: Rules complete action and end turn immediately
3. **Clean Error Handling**: Invalid targets filtered at scope level
4. **Performance Optimization**: Scope caching per turn

## Recommendations for New Actions

### 1. Follow Established Patterns

**Action Definition**:

```json
{
  "id": "<mod>:<action_name>",
  "commandVerb": "<kebab-case>",
  "scope": "<appropriate_scope>",
  "required_components": {
    "actor": ["intimacy:closeness"]
  },
  "template": "<verb> {target}",
  "prerequisites": []
}
```

**Rule Structure**:

- Use standard action sequence
- Set appropriate perception type
- Include descriptive log messages
- Call `core:logSuccessAndEndTurn` macro

### 2. Create Appropriate Scopes

For anatomy-specific actions:

```
intimacy:actors_with_<body_part>_in_intimacy :=
  actor.intimacy:closeness.partners[][{"hasPartOfType": [".", "<body_part>"]}]
```

### 3. Consider State Management

- Use existing closeness component for consent
- Add new components for additional state (arousal, mood, etc.)
- Implement proper state transitions in rules

### 4. Maintain Consistency

- Use `<mod>:` namespace prefix
- Follow kebab-case for command verbs
- Use underscore_case for action IDs
- Create corresponding event conditions

### 5. Test Edge Cases

- Entity without required anatomy
- Solo actors (no partners)
- Multiple partners in circle
- Component missing scenarios

## Conclusion

The intimacy and sex modules demonstrate a well-architected system for handling interpersonal interactions in the Living Narrative Engine. The use of ScopeDSL for dynamic targeting, combined with the closeness component for consent management, creates a flexible and respectful framework for intimate content.

The modular design and clear patterns make it straightforward to extend the system with new actions while maintaining consistency and safety. Future development should focus on enriching the emotional and relational aspects while preserving the strong architectural foundations already in place.
