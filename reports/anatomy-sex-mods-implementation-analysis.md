# Anatomy and Sex Mods Implementation Analysis

**Living Narrative Engine Technical Reference**

---

**Document Status**: In Progress  
**Created**: July 11, 2025  
**Author**: Claude Code Analysis  
**Purpose**: Comprehensive analysis of anatomy and sex mod implementations for future development reference

---

## Document Structure

This analysis is organized into six main sections:

1. **Introduction & Executive Summary** - Overview and key findings
2. **Anatomy Mod Deep Dive** - Foundation components and entity system
3. **Intimacy Mod - Components & Actions** - Action implementations and component design
4. **Intimacy Mod - Rules & Scopes** - Rule patterns and scope definitions
5. **Sex Mod Complete Analysis** - Sexual interaction implementations
6. **Integration Patterns & Development Guidelines** - Technical patterns for future development

---

## 1. Introduction & Executive Summary

### Project Context

The Living Narrative Engine implements intimate character interactions through a modular system of three interconnected mods:

- **`anatomy`** - Foundation mod providing body part definitions and assembly systems
- **`intimacy`** - Non-sexual intimate actions and closeness mechanics
- **`sex`** - Sexual interactions building on intimacy's closeness system

### Dependency Hierarchy

```
anatomy (v1.0.0)
├── descriptors (v1.0.0) - Required dependency
│
intimacy (v1.0.0)
├── anatomy (^1.0.0) - Required dependency
│
sex (v1.0.0)
├── anatomy (^1.0.0) - Required dependency
├── intimacy (^1.0.0) - Required dependency
```

### Key Architectural Findings

#### Anatomy Mod (Foundation Layer)

- **Pure Data Provider**: No actions or rules, only components and entities
- **25 Body Part Entities**: Comprehensive humanoid anatomy definitions
- **4 Core Components**: `body`, `part`, `sockets`, `joint` for anatomy graph construction
- **Blueprint System**: Templates for male/female human body generation
- **Recipe System**: Specific character anatomy configurations

#### Intimacy Mod (Interaction Layer)

- **8 Implemented Actions**: From basic closeness to complex positioning
- **2 Core Components**: `closeness` (partner circles) and `facing_away` (directional positioning)
- **3 Specialized Scopes**: Anatomy-aware filtering for action targeting
- **Complex State Management**: Sophisticated algorithms for closeness circle merging/splitting
- **Event System Integration**: Custom events for position and relationship changes

#### Sex Mod (Extension Layer)

- **2 Sexual Actions**: `fondle_breasts`, `fondle_penis`
- **Anatomy-Based Targeting**: Uses `hasPartOfType` for appropriate target filtering
- **Closeness Prerequisite**: All actions require existing intimacy closeness
- **Simple Rule Pattern**: Both actions follow identical logging-focused implementation

### Technical Implementation Patterns

1. **Action-Rule Symmetry**: Each action has exactly one corresponding rule
2. **Condition-Based Triggering**: Rules use condition references for event filtering
3. **Scope-Driven Targeting**: Actions use ScopeDSL for dynamic target selection
4. **Component Dependency Model**: Actions specify required components for actor/target
5. **Event-Driven Architecture**: All state changes propagate through the event system

### Integration Points for Future Development

- **Anatomy Integration**: All new actions should leverage `hasPartOfType` filtering
- **Closeness Requirement**: Sexual actions require `intimacy:closeness` component
- **Event Propagation**: Actions should dispatch appropriate perception events
- **State Management**: Complex state changes use specialized operation types
- **Simple Actions**: Basic actions follow GET_NAME → SET_VARIABLE → MACRO pattern

### Current Implementation Scope

**Total Implementation Count:**

- 25 anatomy entity definitions
- 4 anatomy components
- 2 intimacy components
- 8 intimacy actions with corresponding rules
- 2 sex actions with corresponding rules
- 6 specialized scopes across both mods
- Custom event types for state transitions

This analysis provides the technical foundation for extending the intimacy and sex systems by documenting exact implementation patterns, component schemas, scope syntax, and integration requirements.

---

## 2. Anatomy Mod Deep Dive

### Mod Manifest Overview

```json
{
  "id": "anatomy",
  "version": "1.0.0",
  "name": "Anatomy System",
  "description": "Provides entity anatomy system with body parts, blueprints, and recipes for humanoid characters.",
  "dependencies": [{ "id": "descriptors", "version": "^1.0.0" }]
}
```

### Core Component Architecture

The anatomy mod defines four fundamental components that work together to create hierarchical body structures:

#### `anatomy:body` Component

- **Purpose**: Links entity to anatomy recipe and stores generated body structure
- **Key Properties**:
  - `recipeId`: Namespaced recipe identifier (e.g., `anatomy:human_male`)
  - `body.root`: Entity instance ID of root body part
  - `body.parts`: Map of part identifiers to entity instance IDs
- **State Management**: Body starts as null until generated by anatomy system

#### `anatomy:part` Component

- **Purpose**: Marks entity as body part with specific subtype
- **Key Properties**:
  - `subType`: Part classification (e.g., "breast", "penis", "arm", "head")
- **Usage**: Critical for `hasPartOfType` scope filtering

#### `anatomy:sockets` Component

- **Purpose**: Defines attachment points where other parts can connect
- **Key Properties**:
  - `sockets[]`: Array of socket definitions
  - `id`: Unique socket identifier within parent part
  - `orientation`: Spatial orientation (left, right, mid, upper, lower, front, back)
  - `allowedTypes[]`: Whitelist of part types that can attach
  - `nameTpl`: Template for auto-naming attached parts

#### `anatomy:joint` Component

- **Purpose**: Represents connection between child part and parent via socket
- **Key Properties**:
  - `parentId`: Runtime instance ID of parent body part entity
  - `socketId`: ID of socket on parent where this part attaches

### Entity Definition System

#### Body Part Categories

**Sexual/Intimate Parts (5 entities):**

- `human_breast`, `human_breast_d_cup`, `human_breast_g_cup`
- `human_penis`, `human_testicle`, `human_vagina`, `human_asshole`

**Head/Face Parts (7 entities):**

- `humanoid_head`, `humanoid_mouth`, `humanoid_nose`, `humanoid_ear`, `humanoid_teeth`
- `human_eye_*` (5 color variants: amber, blue, brown, cobalt, green)

**Body Structure (8 entities):**

- `human_female_torso`, `human_male_torso`, `human_male_torso_muscular`
- `humanoid_arm`, `humanoid_arm_muscular`
- `human_leg`, `human_leg_muscular`, `human_leg_shapely`

**Extremities (5 entities):**

- `human_hand`, `human_foot`
- `human_hair`, `human_hair_blonde`, `human_hair_raven`, `human_pubic_hair`

#### Entity Definition Pattern

Each entity follows consistent structure:

```json
{
  "$schema": "http://example.com/schemas/entity-definition.schema.json",
  "id": "anatomy:entity_name",
  "description": "Human-readable description",
  "components": {
    "anatomy:part": { "subType": "part_type" },
    "descriptors:*": { "property": "value" },
    "core:name": { "text": "display_name" }
  }
}
```

#### Socket Configuration Examples

**Complex Socket Structure (humanoid_arm):**

```json
"anatomy:sockets": {
  "sockets": [{
    "id": "wrist",
    "allowedTypes": ["hand"],
    "nameTpl": "{{parent.name}} {{type}}"
  }]
}
```

**Descriptor Integration:**
All parts integrate with `descriptors` mod for physical properties:

- `size_specific`, `size_category` - Size information
- `firmness` - Physical texture properties
- `shape_general`, `shape_eye` - Shape descriptors
- `color_basic`, `color_extended` - Color properties

### Blueprint and Recipe System

#### Blueprints

- **`human_female.blueprint.json`** - Female body template
- **`human_male.blueprint.json`** - Male body template
- Define overall body structure and assembly rules

#### Recipes

- **`human_female.recipe.json`** - Standard female configuration
- **`human_male.recipe.json`** - Standard male configuration
- **`gorgeous_milf.recipe.json`** - Specialized character variant
- Specify exact parts and descriptors for character generation

### Anatomy System Integration Points

#### No Actions or Rules

- **Design Philosophy**: Anatomy mod is pure data provider
- **No Behavioral Logic**: Other mods implement interactions with anatomy
- **Dependency Pattern**: Other mods depend on anatomy, not vice versa

#### ScopeDSL Integration

Anatomy enables powerful scope filtering through `hasPartOfType`:

```
// Example from sex mod
actor.intimacy:closeness.partners[][{"hasPartOfType": [".", "breast"]}]
```

#### Component Query Support

Rules can query anatomy components for interaction logic:

```json
{
  "type": "QUERY_COMPONENT",
  "parameters": {
    "entity_ref": "target",
    "component_type": "anatomy:part",
    "result_variable": "targetPart"
  }
}
```

### Technical Implementation Notes

#### Namespace Convention

- All anatomy content uses `anatomy:` prefix
- Entity IDs follow pattern: `anatomy:human_partname` or `anatomy:humanoid_partname`
- Component IDs: `anatomy:component_name`

#### Descriptor Dependency

- Required dependency on `descriptors` mod enables rich physical descriptions
- Anatomy entities heavily utilize descriptor components for variety
- Size, shape, color, texture properties all come from descriptors

#### Entity Instance Management

- Blueprint system generates entity instances at runtime
- `body` component maps part names to runtime instance IDs
- Joint system creates parent-child relationships between parts

This anatomy foundation enables all intimacy and sex mod functionality by providing the body part detection and physical structure necessary for realistic intimate interactions.

---

## 3. Intimacy Mod - Components & Actions

### Mod Manifest Overview

```json
{
  "id": "intimacy",
  "version": "1.0.0",
  "name": "intimacy",
  "description": "This module allows intimacy between characters. Sex is not included.",
  "dependencies": [{ "id": "anatomy", "version": "^1.0.0" }]
}
```

### Core Components

#### `intimacy:closeness` Component

- **Purpose**: Manages fully-connected, order-independent set of actors in close physical proximity
- **Schema**:
  ```json
  {
    "partners": ["array of entity IDs in same closeness circle"],
    "uniqueItems": true,
    "default": []
  }
  ```
- **Behavior**: All members of closeness circle can interact intimately with each other
- **State Management**: Component presence indicates active participation in intimacy

#### `intimacy:facing_away` Component

- **Purpose**: Tracks directional positioning for position-aware intimate actions
- **Schema**:
  ```json
  {
    "facing_away_from": ["array of entity IDs this actor is facing away from"],
    "uniqueItems": true,
    "default": []
  }
  ```
- **Usage**: Enables actions like `turn_around` that depend on relative positioning
- **Dynamic**: Component added/removed based on positioning changes

### Complete Action Analysis

#### Tier 0: Proximity Actions

##### `intimacy:get_close`

- **Command**: `get-close`
- **Scope**: `core:actors_in_location` (anyone in same location)
- **Prerequisites**: Movement capability (`core:actor-can-move`)
- **Required Components**: None (establishes intimacy)
- **Template**: "get close to {target}"
- **Purpose**: Foundation action that establishes intimacy between characters

##### `intimacy:step_back`

- **Command**: `step-back`
- **Scope**: None specified (uses component requirement)
- **Prerequisites**: Must have `intimacy:closeness` component
- **Required Components**: Actor must have `intimacy:closeness`
- **Template**: Not specified in manifest
- **Purpose**: Exit intimacy, dissolve closeness circle

#### Tier 1: Affectionate Touch

##### `intimacy:kiss_cheek`

- **Command**: `kiss-cheek`
- **Scope**: `intimacy:close_actors`
- **Prerequisites**: None specified
- **Required Components**: Actor must have `intimacy:closeness`
- **Template**: Not specified
- **Purpose**: Light affectionate gesture

##### `intimacy:thumb_wipe_cheek`

- **Command**: `thumb-wipe-cheek`
- **Scope**: `intimacy:close_actors`
- **Prerequisites**: None specified
- **Required Components**: Actor must have `intimacy:closeness`
- **Template**: Not specified
- **Purpose**: Gentle, caring gesture

##### `intimacy:adjust_clothing`

- **Command**: `adjust-clothing`
- **Scope**: `intimacy:close_actors`
- **Prerequisites**: None specified
- **Required Components**: Actor must have `intimacy:closeness`
- **Template**: Not specified
- **Purpose**: Intimate, possessive care gesture

#### Tier 2: Intimate Actions

##### `intimacy:peck_on_lips`

- **Command**: `peck-on-lips`
- **Scope**: `intimacy:close_actors`
- **Prerequisites**: None specified
- **Required Components**: Actor must have `intimacy:closeness`
- **Template**: "give {target} a peck on the lips"
- **Purpose**: Light romantic kiss

##### `intimacy:massage_shoulders`

- **Command**: `massage-shoulders`
- **Scope**: `intimacy:actors_with_arms_in_intimacy` (requires arms)
- **Prerequisites**: None specified
- **Required Components**: Actor must have `intimacy:closeness`
- **Template**: Not specified
- **Purpose**: Physical care requiring anatomy (arms)

#### Tier 3: Positioning Actions

##### `intimacy:turn_around`

- **Command**: `turn-around`
- **Scope**: `intimacy:close_actors_in_front` (only actors facing you)
- **Prerequisites**: None specified
- **Required Components**: Actor must have `intimacy:closeness`
- **Template**: "turn {target} around"
- **Purpose**: Position manipulation for advanced intimacy

### Action Design Patterns

#### Component Requirements Pattern

All intimacy actions except `get_close` require:

```json
"required_components": {
  "actor": ["intimacy:closeness"]
}
```

#### Scope Progression Pattern

- **Basic**: `close_actors` - All partners in closeness circle
- **Anatomy-Aware**: `actors_with_arms_in_intimacy` - Filters by body parts
- **Position-Aware**: `close_actors_in_front` - Considers facing direction

#### Template Specification Pattern

- Some actions have explicit templates (`get_close`, `peck_on_lips`, `turn_around`)
- Others rely on rule-generated descriptions
- Templates use `{target}` placeholder for dynamic names

### Event System Integration

#### Custom Events

- **`intimacy:actor_faced_forward`** - When someone turns to face another
- **`intimacy:actor_turned_around`** - When someone is turned around

#### Event Payload Pattern

```json
{
  "actor": "entity_id",
  "facing": "entity_id", // for faced_forward
  "turned_by": "entity_id" // for turned_around
}
```

### Component State Management

#### Closeness Circle Algorithm

1. **Entry**: `get_close` merges actor and target circles
2. **Active State**: All members can interact with all other members
3. **Exit**: `step_back` removes actor, may split circle
4. **Constraint**: Movement locked while in closeness

#### Facing Management

1. **Default**: Actors face each other (no `facing_away` component)
2. **Turn Around**: Adds actor to target's `facing_away_from` array
3. **Turn Back**: Removes actor from array, deletes component if empty
4. **Dynamic**: Component exists only when needed

### Integration with Anatomy System

#### Body Part Filtering

- `massage_shoulders` requires targets to have arms
- Uses `hasPartOfType` filter in scope definition
- Enables anatomy-appropriate action availability

#### Future Extensibility

- Pattern established for body-part-specific actions
- Scope system enables complex anatomy-based filtering
- Component requirements ensure proper prerequisites

This intimacy action system provides the foundation for the sex mod by establishing closeness mechanics and demonstrating the full range of action complexity from simple logging to complex state management.

---

## 4. Intimacy Mod - Rules & Scopes

### Rule Implementation Patterns

#### Complex State Management Rules

##### `intimacy:get_close` (Rule ID: `intimacy_handle_get_close`)

**Event Trigger**: `core:attempt_action`  
**Condition**: `intimacy:event-is-action-get-close`

**Operation Sequence**:

1. **MERGE_CLOSENESS_CIRCLE**: Implements algorithm §5.1 from spec
   - Merges actor and target closeness circles
   - Creates fully-connected graph structure
   - Locks movement for all circle members
2. **GET_NAME**: Retrieves actor and target names for logging
3. **QUERY_COMPONENT**: Gets actor position for location context
4. **SET_VARIABLE**: Constructs descriptive message
5. **Macro**: `core:logSuccessAndEndTurn`

**Key Features**:

- Uses specialized operation type for complex state management
- References specific algorithm section from documentation
- Handles circle merging and movement locking automatically

##### `intimacy:turn_around` (Rule ID: `handle_turn_around`)

**Event Trigger**: `core:attempt_action`  
**Condition**: `intimacy:event-is-action-turn-around`

**Complex Logic Flow**:

```json
{
  "type": "IF",
  "condition": "target already facing away from actor",
  "then_actions": [
    "Remove actor from facing_away_from array",
    "Check if array is empty",
    "Remove component if empty",
    "Set 'turn to face' message",
    "Dispatch actor_faced_forward event"
  ],
  "else_actions": [
    "Add actor to facing_away_from array OR create component",
    "Set 'turn around' message",
    "Dispatch actor_turned_around event"
  ]
}
```

**Advanced Features**:

- Bidirectional state management (facing ↔ not facing)
- Dynamic component lifecycle (create/destroy based on need)
- Conditional logic with complex nested operations
- Custom event dispatching for state changes

#### Simple Pattern Rules

##### Standard Pattern (6 actions follow this)

**Actions**: `kiss_cheek`, `peck_on_lips`, `massage_shoulders`, `adjust_clothing`, `thumb_wipe_cheek`, `step_back`

**Standard Sequence**:

1. **GET_NAME**: Actor and target names
2. **QUERY_COMPONENT**: Actor position for location
3. **SET_VARIABLE**: Descriptive message
4. **SET_VARIABLE**: Perception type (`action_target_general`)
5. **SET_VARIABLE**: Location and target IDs
6. **Macro**: `core:logSuccessAndEndTurn`

**Message Examples**:

- `peck_on_lips`: "{actorName} gives {targetName} a quick, affectionate peck on the lips."
- `massage_shoulders`: Handled by specialized rule (`handle_massage_shoulders`)

### Scope System Implementation

#### Basic Scopes

##### `intimacy:close_actors`

```
intimacy:close_actors := actor.components.intimacy:closeness.partners[]
```

- **Purpose**: Returns all partners in actor's closeness circle
- **Usage**: Most intimacy actions use this scope
- **Result**: Array of entity IDs that actor can interact with intimately

#### Anatomy-Aware Scopes

##### `intimacy:actors_with_arms_in_intimacy`

```
intimacy:actors_with_arms_in_intimacy := actor.intimacy:closeness.partners[][{"hasPartOfType": [".", "arm"]}]
```

- **Purpose**: Filters close actors who have arms for actions requiring arms
- **Usage**: `massage_shoulders` action
- **Filter Logic**: `hasPartOfType` checks for `anatomy:part` component with `subType: "arm"`

#### Position-Aware Scopes

##### `intimacy:close_actors_in_front`

```
intimacy:close_actors_in_front := actor.intimacy:closeness.partners[][{
  "or": [
    {"not": {"condition_ref": "intimacy:actor-has-facing-away"}},
    {"condition_ref": "intimacy:entity-not-in-facing-away"}
  ]
}]
```

- **Purpose**: Returns actors who are facing the current actor
- **Usage**: `turn_around` action (can only turn actors who are facing you)
- **Logic**: Either actor has no `facing_away` component OR entity is not in actor's facing_away list

### Condition System

#### Event-Based Conditions

Each action has corresponding condition for rule triggering:

```json
{
  "id": "intimacy:event-is-action-{action-name}",
  "logic": {
    "==": [{ "var": "event.payload.actionId" }, "intimacy:{action_id}"]
  }
}
```

#### State-Based Conditions

##### `intimacy:actor-is-in-closeness`

```json
{
  "logic": {
    "!!": { "var": "actor.components.intimacy:closeness" }
  }
}
```

- **Purpose**: Checks if actor has closeness component
- **Usage**: Prerequisites for intimacy actions

##### `intimacy:entity-not-in-facing-away`

```json
{
  "logic": {
    "not": {
      "in": [
        { "var": "entity.id" },
        { "var": "actor.components.intimacy:facing_away.facing_away_from" }
      ]
    }
  }
}
```

- **Purpose**: Checks if entity is not in actor's facing_away array
- **Usage**: Position-aware scope filtering

### Macro Integration

#### `core:logSuccessAndEndTurn`

All simple intimacy rules conclude with this macro, which:

1. Dispatches perceptible event with constructed message
2. Ends the current turn
3. Updates perception logs
4. Triggers any follow-up systems

### Event System Architecture

#### Perception Event Types

- **`action_target_general`**: Standard intimate actions between two characters
- **`state_change_observable`**: Changes in closeness or positioning state

#### Event Payload Structure

```json
{
  "logMessage": "Descriptive text for players",
  "perceptionType": "action_target_general",
  "locationId": "where_it_happened",
  "targetId": "who_was_affected"
}
```

### ScopeDSL Advanced Features

#### Chained Filtering

```
actor.intimacy:closeness.partners[][filter1][filter2]
```

- Multiple filters can be chained for complex selection
- Each filter narrows the result set

#### Condition Reference Integration

```json
{ "condition_ref": "namespace:condition-name" }
```

- Scopes can reference external condition definitions
- Enables reusable logic across scopes

#### Complex Boolean Logic

```json
{
  "or": [condition1, condition2],
  "and": [condition3, condition4],
  "not": condition5
}
```

- Full boolean logic support within scope filters
- Nested conditions for sophisticated selection

### Rule Development Patterns

#### When to Use Complex Rules

- **State Management**: When component data needs modification
- **Conditional Logic**: When behavior depends on current state
- **Event Dispatching**: When custom events need to be fired
- **Multi-Step Operations**: When multiple systems need coordination

#### When to Use Simple Rules

- **Logging Actions**: When action only needs to generate description
- **No State Changes**: When no component modification is required
- **Standard Interactions**: When following established patterns

### Integration with Core Systems

#### Event Bus Integration

- All rules trigger through `core:attempt_action` event
- Rules dispatch results back through event system
- Perception system automatically processes logged events

#### Component System Integration

- Rules query and modify components through operation types
- Component lifecycle managed automatically
- Validation occurs at component schema level

#### Turn Management Integration

- All rules end with turn termination
- Turn system coordinates with rule execution
- Action processing synchronized with game state

This rule and scope system demonstrates the engine's capability for both simple action handling and complex state management, providing clear patterns for implementing new intimate actions with appropriate complexity levels.

---

## 5. Sex Mod Complete Analysis

### Mod Manifest Overview

```json
{
  "id": "sex",
  "version": "1.0.0",
  "name": "sex",
  "description": "This module allows sexual interaction between characters.",
  "dependencies": [
    { "id": "anatomy", "version": "^1.0.0" },
    { "id": "intimacy", "version": "^1.0.0" }
  ]
}
```

### Architectural Design Philosophy

#### Dependency Strategy

- **Anatomy Dependency**: Enables body part detection for appropriate targeting
- **Intimacy Dependency**: Leverages closeness system for consent/proximity model
- **No New Components**: Extends existing intimacy system without additional state
- **Minimal Implementation**: Simple, focused scope for sexual interactions

### Complete Action Analysis

#### `sex:fondle_breasts`

**Action Definition**:

```json
{
  "id": "sex:fondle_breasts",
  "commandVerb": "fondle-breasts",
  "name": "Fondle Breasts",
  "description": "Gently fondle the target's breasts.",
  "scope": "sex:actors_with_breasts_in_intimacy",
  "required_components": { "actor": ["intimacy:closeness"] },
  "template": "fondle {target}'s breasts"
}
```

**Key Features**:

- **Body Part Specific**: Only available for targets with breast anatomy
- **Closeness Required**: Actor must be in intimacy circle
- **Explicit Template**: Direct description template provided
- **No Prerequisites**: Beyond component requirements

#### `sex:fondle_penis`

**Action Definition**:

```json
{
  "id": "sex:fondle_penis",
  "commandVerb": "fondle-penis",
  "name": "Fondle Penis",
  "description": "Gently fondle the target's penis.",
  "scope": "sex:actors_with_penis_in_intimacy",
  "required_components": { "actor": ["intimacy:closeness"] },
  "template": "fondle {target}'s penis"
}
```

**Identical Pattern**: Follows exact same structure as breast fondling action

### Rule Implementation Analysis

Both sex actions follow identical simple rule pattern:

#### Rule Structure Template

```json
{
  "rule_id": "handle_fondle_{body_part}",
  "comment": "Handles the 'sex:fondle_{body_part}' action. Dispatches descriptive text and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": { "condition_ref": "sex:event-is-action-fondle-{body_part}" },
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "actor", "result_variable": "actorName" }
    },
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "target", "result_variable": "targetName" }
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
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{context.actorName} eagerly fondles {context.targetName}'s {body_part}."
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
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

**Rule Characteristics**:

- **Simple Pattern**: Follows standard intimacy rule template
- **No State Changes**: Only logging, no component modifications
- **Eager Descriptor**: Both actions use "eagerly" adverb in descriptions
- **Standard Events**: Uses `action_target_general` perception type

### Scope System Implementation

#### `sex:actors_with_breasts_in_intimacy`

```
sex:actors_with_breasts_in_intimacy := actor.intimacy:closeness.partners[][{"hasPartOfType": [".", "breast"]}]
```

**Analysis**:

- **Base Scope**: `actor.intimacy:closeness.partners[]` (all intimate partners)
- **Anatomy Filter**: `{"hasPartOfType": [".", "breast"]}`
- **Filter Logic**: Checks each partner for `anatomy:part` component with `subType: "breast"`
- **Result**: Only partners with breast anatomy are selectable

#### `sex:actors_with_penis_in_intimacy`

```
sex:actors_with_penis_in_intimacy := actor.intimacy:closeness.partners[][{"hasPartOfType": [".", "penis"]}]
```

**Identical Pattern**: Same structure as breast scope, different body part filter

### Anatomy Integration

#### Body Part Detection Logic

**`hasPartOfType` Operation**:

1. Iterates through target entity's anatomy components
2. Checks for `anatomy:part` component
3. Matches `subType` field against specified part type
4. Returns boolean result for scope filtering

**Supported Part Types** (from anatomy mod):

- `"breast"` - Matches `human_breast`, `human_breast_d_cup`, `human_breast_g_cup`
- `"penis"` - Matches `human_penis`
- Could support: `"arm"`, `"leg"`, `"hand"`, `"foot"`, etc.

#### Extensibility Pattern

New sexual actions can follow same pattern:

```
sex:actors_with_{part_type}_in_intimacy := actor.intimacy:closeness.partners[][{"hasPartOfType": [".", "{part_type}"]}]
```

### Condition System

#### Event-Based Conditions

Standard pattern for both actions:

```json
{
  "id": "sex:event-is-action-fondle-{body_part}",
  "description": "Checks if the triggering event is for the 'sex:fondle_{body_part}' action.",
  "logic": {
    "==": [{ "var": "event.payload.actionId" }, "sex:fondle_{body_part}"]
  }
}
```

### Integration with Intimacy System

#### Closeness Requirement

- **Prerequisite**: All sex actions require `intimacy:closeness` component on actor
- **Access Control**: Only actors already in intimate relationship can perform sexual actions
- **Consent Model**: Closeness represents mutual consent for intimate interactions
- **No Additional Consent**: Sex mod relies entirely on intimacy's consent system

#### No State Extensions

- **Design Decision**: Sex mod adds no new components or state management
- **Simplicity**: Focuses purely on sexual actions within existing intimacy framework
- **Extensibility**: Could be extended with sexual-specific state if needed

### Performance and Scope Evaluation

#### Scope Efficiency

- **Pre-filtering**: Intimacy closeness narrows candidates before anatomy check
- **Anatomy Check**: `hasPartOfType` only runs on intimate partners
- **Caching**: Scope results cached within turn boundaries
- **Scalability**: Efficient even with complex anatomy structures

#### Memory Footprint

- **Minimal**: No additional components stored
- **Event-driven**: Actions only exist during execution
- **No Persistence**: No sexual state persists between actions

### Content Design Considerations

#### Action Descriptions

- **Direct Language**: Uses clinical terms ("fondle", "breasts", "penis")
- **Eager Characterization**: Describes actor as "eagerly" performing action
- **Consistent Tone**: Both actions use identical descriptive pattern
- **Extensible**: Template supports dynamic name insertion

#### Scope Naming Convention

- **Descriptive**: `actors_with_{body_part}_in_intimacy`
- **Consistent**: Same pattern for all anatomy-based scopes
- **Namespace**: `sex:` prefix clearly indicates sexual content

### Development Patterns Demonstrated

#### Simplicity Principle

- **Minimal Implementation**: Only essential components for sexual interaction
- **Reuse Existing**: Leverages intimacy and anatomy systems
- **No Reinvention**: Uses established patterns from intimacy mod

#### Extensibility Pattern

- **Template-Based**: Easy to add new sexual actions following same pattern
- **Anatomy-Driven**: Any body part can be target of sexual action
- **Rule Consistency**: All sexual actions can follow same simple rule pattern

#### Integration Pattern

- **Dependency Clarity**: Clear dependencies on foundation systems
- **No Coupling**: Doesn't modify parent mod functionality
- **Clean Interfaces**: Uses public APIs of dependency mods

### Future Development Implications

#### New Sexual Actions

Pattern for adding new actions:

1. Create action with appropriate scope (`sex:actors_with_{part}_in_intimacy`)
2. Create corresponding rule following template pattern
3. Create event condition for rule triggering
4. Ensure anatomy entities exist for target body parts

#### Advanced Features

Could extend with:

- Position-aware sexual actions
- Multi-target sexual actions
- Sexual state tracking components
- Relationship progression through sexual interaction
- Consent negotiation specific to sexual acts

This sex mod demonstrates a minimal but complete implementation of sexual interactions that builds effectively on the anatomy and intimacy foundation systems while maintaining clean architecture and extensibility.

---

## 6. Integration Patterns & Development Guidelines

### Cross-Mod Integration Architecture

#### Dependency Chain Pattern

```
anatomy (foundation) → intimacy (behavior) → sex (extension)
```

**Design Principles**:

- **Foundation First**: Anatomy provides data structures without behavior
- **Behavior Layer**: Intimacy adds interaction mechanics and state management
- **Extension Layer**: Sex extends existing behavior without modifying foundations
- **Clean Interfaces**: Each mod exposes public APIs for dependent mods

#### Namespace Strategy

- **`anatomy:`** - Body structure and part definitions
- **`intimacy:`** - Relationship and positioning mechanics
- **`sex:`** - Sexual interaction extensions
- **Clear Boundaries**: Each namespace owns specific domain concepts

### Component Design Patterns

#### Foundation Components (Anatomy)

**Purpose**: Data structure definition
**Pattern**: Schema-heavy, behavior-free
**Example**:

```json
{
  "id": "anatomy:part",
  "dataSchema": { "subType": "string" },
  "behavior": "none"
}
```

#### Behavioral Components (Intimacy)

**Purpose**: State management and interaction enablement
**Pattern**: Complex schemas with associated rule systems
**Example**:

```json
{
  "id": "intimacy:closeness",
  "dataSchema": { "partners": "array" },
  "behavior": "complex_state_management"
}
```

#### Extension Pattern (Sex)

**Purpose**: Leverage existing components without new state
**Pattern**: Use existing components, add actions/rules only

### Action Development Templates

#### Simple Action Template

```json
{
  "id": "{namespace}:{action_name}",
  "commandVerb": "{command-verb}",
  "name": "Human Readable Name",
  "description": "Action description",
  "scope": "{namespace}:{target_scope}",
  "required_components": {
    "actor": ["{required_component}"]
  },
  "template": "{action} {target}"
}
```

#### Anatomy-Aware Action Template

```json
{
  "id": "{namespace}:{action_name}",
  "scope": "{namespace}:actors_with_{body_part}_in_intimacy",
  "required_components": {
    "actor": ["intimacy:closeness"]
  }
}
```

### Rule Development Patterns

#### Simple Rule Template

```json
{
  "rule_id": "handle_{action_name}",
  "event_type": "core:attempt_action",
  "condition": { "condition_ref": "{namespace}:event-is-action-{action-name}" },
  "actions": [
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "actor", "result_variable": "actorName" }
    },
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "target", "result_variable": "targetName" }
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
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{description_template}"
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
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

#### Complex State Management Rule Template

```json
{
  "rule_id": "{state_management_rule}",
  "event_type": "core:attempt_action",
  "condition": { "condition_ref": "{namespace}:event-is-action-{action}" },
  "actions": [
    { "type": "{SPECIALIZED_OPERATION}", "parameters": "{operation_params}" },
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "actor", "result_variable": "actorName" }
    },
    {
      "type": "GET_NAME",
      "parameters": { "entity_ref": "target", "result_variable": "targetName" }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "logMessage",
        "value": "{state_change_message}"
      }
    },
    {
      "type": "SET_VARIABLE",
      "parameters": {
        "variable_name": "perceptionType",
        "value": "state_change_observable"
      }
    },
    { "macro": "core:logSuccessAndEndTurn" }
  ]
}
```

### Scope Development Patterns

#### Basic Partner Scope

```
{namespace}:close_actors := actor.intimacy:closeness.partners[]
```

#### Anatomy-Filtered Scope

```
{namespace}:actors_with_{part}_in_intimacy := actor.intimacy:closeness.partners[][{"hasPartOfType": [".", "{part_type}"]}]
```

#### Position-Aware Scope

```
{namespace}:actors_in_front := actor.intimacy:closeness.partners[][{
  "condition_ref": "{namespace}:entity-not-in-facing-away"
}]
```

#### Complex Conditional Scope

```
{namespace}:complex_targets := actor.intimacy:closeness.partners[][{
  "and": [
    {"hasPartOfType": [".", "{part_type}"]},
    {"condition_ref": "{namespace}:additional-condition"}
  ]
}]
```

### Event System Integration Patterns

#### Standard Event Condition Pattern

```json
{
  "id": "{namespace}:event-is-action-{action-name}",
  "description": "Checks if the triggering event is for the '{namespace}:{action_id}' action.",
  "logic": {
    "==": [{ "var": "event.payload.actionId" }, "{namespace}:{action_id}"]
  }
}
```

#### Custom Event Dispatching Pattern

```json
{
  "type": "DISPATCH_EVENT",
  "parameters": {
    "eventType": "{namespace}:{custom_event}",
    "payload": {
      "actor": "{event.payload.actorId}",
      "target": "{event.payload.targetId}",
      "context": "{additional_data}"
    }
  }
}
```

### Content Development Guidelines

#### Action Naming Conventions

- **Commands**: Use hyphenated format (`get-close`, `fondle-breasts`)
- **IDs**: Use underscore format (`intimacy:get_close`, `sex:fondle_breasts`)
- **Rules**: Prefix with `handle_` (`handle_get_close`, `handle_fondle_breasts`)
- **Scopes**: Descriptive names (`close_actors`, `actors_with_breasts_in_intimacy`)

#### Component Naming Conventions

- **Data Components**: Noun-based (`closeness`, `facing_away`, `body`)
- **Behavioral Components**: Action-oriented when needed
- **Schemas**: Mirror component purpose and scope

#### File Organization Patterns

```
data/mods/{mod_name}/
├── mod-manifest.json
├── actions/
│   ├── {action_name}.action.json
├── components/
│   ├── {component_name}.component.json
├── conditions/
│   ├── {condition_name}.condition.json
├── rules/
│   ├── {rule_name}.rule.json
├── scopes/
│   ├── {scope_name}.scope
└── ui/
    ├── icons.json
    └── labels.json
```

### Implementation Checklist for New Actions

#### Phase 1: Action Definition

- [ ] Define action with appropriate scope
- [ ] Specify required components for actor/target
- [ ] Create descriptive template if needed
- [ ] Add to mod manifest

#### Phase 2: Rule Implementation

- [ ] Create corresponding rule file
- [ ] Choose appropriate pattern (simple vs complex)
- [ ] Implement operation sequence
- [ ] Test rule execution

#### Phase 3: Scope Definition

- [ ] Create scope file with appropriate filtering
- [ ] Test scope returns correct targets
- [ ] Verify anatomy/position filtering works
- [ ] Optimize scope performance

#### Phase 4: Condition Creation

- [ ] Create event condition for rule triggering
- [ ] Create any additional state conditions needed
- [ ] Test condition logic

#### Phase 5: Integration Testing

- [ ] Test action appears in available actions
- [ ] Test rule executes correctly
- [ ] Test event dispatching and perception
- [ ] Test cross-mod integration

### Performance Optimization Guidelines

#### Scope Optimization

- **Pre-filter**: Use closeness to narrow candidates before expensive checks
- **Cache Results**: Leverage turn-boundary caching for repeated evaluations
- **Limit Depth**: Avoid deeply nested scope logic
- **Batch Operations**: Group related anatomy checks

#### Component Efficiency

- **Minimal State**: Only store necessary data in components
- **Dynamic Lifecycle**: Create/destroy components based on need
- **Schema Validation**: Use efficient validation patterns
- **Memory Management**: Clean up orphaned relationships

#### Rule Performance

- **Early Exit**: Structure conditional logic for early exits
- **Batch Queries**: Group related component queries
- **Minimize Operations**: Use fewest operations necessary
- **Avoid Recursion**: Prevent infinite rule triggering

### Extension Architecture

#### Adding New Body Parts

1. **Anatomy Entities**: Create new entity definitions with appropriate components
2. **Descriptor Integration**: Use existing descriptor components for variety
3. **Blueprint Updates**: Add to relevant blueprints for automatic generation
4. **Scope Extensions**: Create scopes targeting new body parts

#### Adding New Intimacy States

1. **Component Definition**: Create component for new state type
2. **State Management**: Implement rules for state transitions
3. **Integration Points**: Connect with existing closeness system
4. **Action Extensions**: Create actions utilizing new state

#### Adding New Sexual Actions

1. **Anatomy Requirements**: Identify required body parts for action
2. **Scope Creation**: Filter targets with appropriate anatomy
3. **Rule Implementation**: Follow simple pattern for basic actions
4. **Content Guidelines**: Maintain consistent tone and style

### Security and Safety Considerations

#### Content Boundaries

- **Age Verification**: Integrate with age verification where required
- **Content Warnings**: Provide appropriate warnings for sexual content
- **Opt-in Systems**: Make sexual content explicitly opt-in
- **Boundary Respect**: Enforce personal boundary systems

#### System Safety

- **Input Validation**: Validate all action parameters
- **Component Integrity**: Prevent component corruption
- **State Consistency**: Maintain relationship state consistency
- **Error Handling**: Graceful degradation on errors

This comprehensive analysis provides the technical foundation and development patterns necessary for extending the anatomy, intimacy, and sex mod systems while maintaining architectural consistency and code quality.
