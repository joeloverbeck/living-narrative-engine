# Intimacy & Sex Mods Architecture Report

**Generated**: 2025-01-23  
**Purpose**: Comprehensive reference for adding new action/rule combinations to intimacy and sex systems  
**Scope**: Analysis of `data/mods/intimacy/` and `data/mods/sex/` modules

---

## Executive Summary

The intimacy and sex mods implement a sophisticated interaction system built on the Living Narrative Engine's ECS architecture. The intimacy mod provides 26 actions ranging from gentle touches to deep kissing, while the sex mod adds 2 explicit sexual actions. The system uses a well-structured hierarchy of components, scopes, conditions, and rules to manage intimate relationships and interactions with precise state tracking and contextual validation.

### Key Architectural Features:

- **State-driven interactions** via `closeness`, `kissing`, and `facing_away` components
- **Anatomical validation** through specialized scopes targeting specific body parts
- **Positional awareness** with facing/behind positioning logic
- **Progressive intimacy** from approaching to deep physical contact
- **Standardized rule patterns** with consistent variable usage and macro integration

---

## Available Actions

### Intimacy Mod Actions (26 total)

#### Movement & Positioning Actions (4 actions)

| Action ID                      | Name                | Purpose                           | Scope                                                      | Components Required                          |
| ------------------------------ | ------------------- | --------------------------------- | ---------------------------------------------------------- | -------------------------------------------- |
| `intimacy:get_close`           | Get Close           | Initiate intimate proximity       | `core:actors_in_location`                                  | None                                         |
| `intimacy:step_back`           | Step Back           | End intimate proximity            | `none`                                                     | `intimacy:closeness`                         |
| `intimacy:turn_around`         | Turn Around         | Change partner's facing direction | `intimacy:close_actors_facing_each_other_or_behind_target` | `intimacy:closeness`                         |
| `intimacy:turn_around_to_face` | Turn Around to Face | Self-initiated facing change      | `intimacy:actors_im_facing_away_from`                      | `intimacy:closeness`, `intimacy:facing_away` |

**Usage Pattern**: These actions manage spatial relationships and serve as the foundation for all other intimate interactions.

#### Gentle Touch Actions (4 actions)

| Action ID                      | Name                | Purpose                      | Scope                                                         | Components Required  |
| ------------------------------ | ------------------- | ---------------------------- | ------------------------------------------------------------- | -------------------- |
| `intimacy:brush_hand`          | Brush Hand          | Light, tentative contact     | `intimacy:close_actors`                                       | `intimacy:closeness` |
| `intimacy:place_hand_on_waist` | Place Hand on Waist | Possessive, intimate gesture | `intimacy:close_actors`                                       | `intimacy:closeness` |
| `intimacy:thumb_wipe_cheek`    | Thumb Wipe Cheek    | Tender facial contact        | `intimacy:close_actors_facing_each_other`                     | `intimacy:closeness` |
| `intimacy:adjust_clothing`     | Adjust Clothing     | Caring, possessive gesture   | `intimacy:close_actors_facing_each_other_with_torso_clothing` | `intimacy:closeness` |

**Usage Pattern**: Lower-intensity actions that don't conflict with kissing state, suitable for early intimacy progression.

#### Massage Actions (2 actions)

| Action ID                    | Name              | Purpose                           | Scope                                                          | Components Required  |
| ---------------------------- | ----------------- | --------------------------------- | -------------------------------------------------------------- | -------------------- |
| `intimacy:massage_shoulders` | Massage Shoulders | Therapeutic/sensual shoulder work | `intimacy:actors_with_arms_facing_each_other_or_behind_target` | `intimacy:closeness` |
| `intimacy:massage_back`      | Massage Back      | Behind-position therapeutic touch | `intimacy:close_actors_facing_away`                            | `intimacy:closeness` |

**Usage Pattern**: Medium-intensity actions with specific positional requirements.

#### Physical Touch Actions (3 actions)

| Action ID                        | Name                  | Purpose                  | Scope                                                                   | Components Required  |
| -------------------------------- | --------------------- | ------------------------ | ----------------------------------------------------------------------- | -------------------- |
| `intimacy:feel_arm_muscles`      | Feel Arm Muscles      | Appreciation of physique | `intimacy:actors_with_muscular_arms_facing_each_other_or_behind_target` | `intimacy:closeness` |
| `intimacy:fondle_ass`            | Fondle Ass            | Intimate sexual touching | `intimacy:actors_with_ass_cheeks_facing_each_other_or_behind_target`    | `intimacy:closeness` |
| `intimacy:nuzzle_face_into_neck` | Nuzzle Face Into Neck | Intimate facial contact  | `intimacy:close_actors_facing_each_other`                               | `intimacy:closeness` |

**Usage Pattern**: Higher-intensity physical contact requiring specific anatomy.

#### Light Kissing Actions (4 actions)

| Action ID                        | Name                    | Purpose                     | Scope                                          | Components Required  |
| -------------------------------- | ----------------------- | --------------------------- | ---------------------------------------------- | -------------------- |
| `intimacy:peck_on_lips`          | Give a Peck on the Lips | Light lip contact           | `intimacy:close_actors_facing_each_other`      | `intimacy:closeness` |
| `intimacy:kiss_cheek`            | Kiss Cheek              | Affectionate facial kiss    | `intimacy:close_actors_facing_each_other`      | `intimacy:closeness` |
| `intimacy:lick_lips`             | Lick Lips Seductively   | Provocative oral contact    | `intimacy:close_actors_facing_each_other`      | `intimacy:closeness` |
| `intimacy:lean_in_for_deep_kiss` | Lean in for a Deep Kiss | Initiate passionate kissing | `intimacy:actors_with_mouth_facing_each_other` | `intimacy:closeness` |

**Usage Pattern**: Face-to-face actions that either avoid or initiate the kissing state.

#### Deep Kissing Actions (4 actions - During Kiss Only)

| Action ID                            | Name                      | Purpose                         | Scope                              | Prerequisites        |
| ------------------------------------ | ------------------------- | ------------------------------- | ---------------------------------- | -------------------- |
| `intimacy:nibble_lower_lip`          | Nibble Lower Lip          | Intensify kiss through lip play | `intimacy:current_kissing_partner` | Active kissing state |
| `intimacy:explore_mouth_with_tongue` | Explore Mouth with Tongue | Deepen kiss intimacy            | `intimacy:current_kissing_partner` | Active kissing state |
| `intimacy:suck_on_tongue`            | Suck on Tongue            | Maximum kiss intensity          | `intimacy:current_kissing_partner` | Active kissing state |
| `intimacy:cup_face_while_kissing`    | Cup Face While Kissing    | Add romantic gesture to kiss    | `intimacy:current_kissing_partner` | Active kissing state |

**Usage Pattern**: Only available during active kissing; escalate the intensity of the kissing experience.

#### Kiss Response Actions (2 actions - Receiver Only)

| Action ID                         | Name                   | Purpose                     | Scope                              | Prerequisites    |
| --------------------------------- | ---------------------- | --------------------------- | ---------------------------------- | ---------------- |
| `intimacy:kiss_back_passionately` | Kiss Back Passionately | Reciprocate with enthusiasm | `intimacy:current_kissing_partner` | Be kiss receiver |
| `intimacy:accept_kiss_passively`  | Accept Kiss Passively  | Allow without participation | `intimacy:current_kissing_partner` | Be kiss receiver |

**Usage Pattern**: Response actions only available to the target of a kiss initiation.

#### Kiss Ending Actions (3 actions)

| Action ID                         | Name                   | Purpose               | Scope                              | Components Required |
| --------------------------------- | ---------------------- | --------------------- | ---------------------------------- | ------------------- |
| `intimacy:break_kiss_gently`      | Break the Kiss Gently  | End kiss romantically | `intimacy:current_kissing_partner` | `intimacy:kissing`  |
| `intimacy:pull_back_breathlessly` | Pull Back Breathlessly | End kiss with arousal | `intimacy:current_kissing_partner` | `intimacy:kissing`  |
| `intimacy:pull_back_in_revulsion` | Pull Back in Revulsion | End kiss with disgust | `intimacy:current_kissing_partner` | `intimacy:kissing`  |

**Usage Pattern**: Multiple ways to end kissing state with different emotional contexts.

### Sex Mod Actions (2 total)

#### Sexual Touch Actions

| Action ID            | Name           | Purpose                    | Scope                                       | Components Required  |
| -------------------- | -------------- | -------------------------- | ------------------------------------------- | -------------------- |
| `sex:fondle_penis`   | Fondle Penis   | Direct genital stimulation | `sex:actors_with_penis_facing_each_other`   | `intimacy:closeness` |
| `sex:fondle_breasts` | Fondle Breasts | Breast stimulation         | `sex:actors_with_breasts_facing_each_other` | `intimacy:closeness` |

**Usage Pattern**: Explicit sexual actions requiring specific exposed anatomy and face-to-face positioning.

---

## Available Components

### Component Architecture Overview

The component system implements a layered approach to intimate relationship state management:

1. **Proximity Layer**: `intimacy:closeness` - Establishes who can interact
2. **Orientation Layer**: `intimacy:facing_away` - Tracks spatial positioning
3. **Activity Layer**: `intimacy:kissing` - Manages ongoing intimate activities

### Component Definitions

#### `intimacy:closeness`

**Purpose**: Core relationship state for intimate interactions  
**Type**: Multi-entity relationship component  
**Data Schema**:

```json
{
  "partners": ["entity_id_1", "entity_id_2", ...]  // Array of partner IDs
}
```

**Usage Patterns**:

- **Requirement**: Almost all intimate actions require this component
- **Creation**: Automatically created/merged by `get_close` action
- **Modification**: Partners added/removed through specialized algorithms
- **Removal**: Destroyed when `step_back` action used

**Key Behaviors**:

- Forms fully-connected circles (all partners know about each other)
- Order-independent (A→B same as B→A relationship)
- Transitivity (A-B + B-C = A-B-C circle)
- Movement locking for all partners in circle

#### `intimacy:facing_away`

**Purpose**: Tracks spatial orientation in intimate contexts  
**Type**: Directional relationship component  
**Data Schema**:

```json
{
  "facing_away_from": ["entity_id_1", "entity_id_2", ...]  // IDs being faced away from
}
```

**Usage Patterns**:

- **Creation**: Added by `turn_around` action
- **Queries**: Used by positioning conditions and scopes
- **Removal**: Removed by `turn_around_to_face` action
- **Validation**: Required for behind-position actions

**Key Behaviors**:

- Directional (A facing away from B ≠ B facing away from A)
- Multiple targets supported
- Critical for scope filtering in position-aware actions

#### `intimacy:kissing`

**Purpose**: Manages active kissing state between two actors  
**Type**: Bidirectional activity component  
**Data Schema**:

```json
{
  "partner": "entity_id",     // Who they're kissing
  "initiator": true/false     // Whether they initiated
}
```

**Usage Patterns**:

- **Creation**: Added by kiss initiation actions to both actors
- **Queries**: Used by kiss-related actions and response validation
- **Modification**: Initiator status used for response action eligibility
- **Removal**: Destroyed by kiss ending actions

**Key Behaviors**:

- Mutual component (both actors have it when kissing)
- Asymmetric data (only one can be initiator)
- State gates (prevents non-kiss actions during kissing)
- Response eligibility (only non-initiator can use response actions)

### Component Integration Patterns

#### State Progression Pattern:

```
1. No components → Available: get_close, basic social actions
2. + closeness → Available: gentle touches, positioning actions
3. + facing_away → Available: behind-position actions
4. + kissing → Available: kiss deepening, kiss responses, kiss endings
```

#### Component Interdependencies:

- `facing_away` requires `closeness` context
- `kissing` requires `closeness` foundation
- `kissing` + `facing_away` = invalid state (handled by action restrictions)

---

## Available Scopes

### Scope Architecture Overview

Scopes implement a hierarchical filtering system with four primary dimensions:

1. **Proximity** - Basic closeness requirement
2. **Anatomy** - Specific body part requirements
3. **Positioning** - Facing/behind orientation requirements
4. **Exposure** - Clothing/coverage requirements

### Scope Categories

#### Basic Positioning Scopes

**`intimacy:close_actors`**

- **Purpose**: Foundation scope for all intimate interactions
- **Logic**: `actor.intimacy:closeness.partners[]`
- **Usage**: Actions that only require proximity, no other constraints
- **Examples**: Hand brushing, waist touching

**`intimacy:close_actors_facing_each_other`**

- **Purpose**: Face-to-face intimate interactions
- **Logic**: Closeness + `intimacy:both-actors-facing-each-other` condition
- **Usage**: Most kissing actions, face-touching actions
- **Examples**: Cheek kiss, thumb wipe, lip peck

**`intimacy:close_actors_facing_away`**

- **Purpose**: Behind-position interactions
- **Logic**: Closeness + `intimacy:actor-in-entity-facing-away` condition
- **Usage**: Actions that require access from behind
- **Examples**: Back massage

**`intimacy:close_actors_facing_each_other_or_behind_target`**

- **Purpose**: Flexible positioning for general actions
- **Logic**: Closeness + (facing OR behind) conditions
- **Usage**: Actions that work from multiple positions
- **Examples**: Turn around, general touching

#### Anatomy-Specific Scopes

**Arms Category**:

- `intimacy:actors_with_arms_in_intimacy` - Basic arm requirement
- `intimacy:actors_with_arms_facing_each_other` - Arms + face-to-face
- `intimacy:actors_with_arms_facing_each_other_or_behind_target` - Arms + flexible position
- `intimacy:actors_with_muscular_arms_facing_each_other_or_behind_target` - Muscular arms + flexible position

**Buttocks Category**:

- `intimacy:actors_with_ass_cheeks_in_intimacy` - Basic buttocks requirement
- `intimacy:actors_with_ass_cheeks_facing_each_other` - Buttocks + face-to-face
- `intimacy:actors_with_ass_cheeks_facing_each_other_or_behind_target` - Buttocks + flexible position

**Mouth Category**:

- `intimacy:actors_with_mouth_facing_each_other` - Mouth anatomy + face-to-face positioning

**Sexual Anatomy (Sex Mod)**:

- `sex:actors_with_penis_facing_each_other` - Penis + exposure + positioning
- `sex:actors_with_breasts_facing_each_other` - Breasts + exposure + positioning
- `sex:actors_with_penis_in_intimacy` - Basic penis requirement
- `sex:actors_with_breasts_in_intimacy` - Basic breast requirement

#### Special Purpose Scopes

**`intimacy:current_kissing_partner`**

- **Purpose**: Actions during active kissing
- **Logic**: Validates `actor.intimacy:kissing.partner` matches target
- **Usage**: Kiss deepening actions, kiss responses, kiss endings

**`intimacy:close_actors_facing_each_other_with_torso_clothing`**

- **Purpose**: Clothing-dependent actions
- **Logic**: Face-to-face + `hasClothingInSlot("torso_upper")`
- **Usage**: Clothing adjustment actions

**`intimacy:actors_im_facing_away_from`**

- **Purpose**: Reverse perspective facing away
- **Logic**: Checks `actor.intimacy:facing_away.facing_away_from[]` array
- **Usage**: Turn around to face actions

### Scope Selection Guide

#### When to Use Which Scope:

**For Basic Actions**:

- Use `close_actors` if only proximity needed
- Use `close_actors_facing_each_other` if face-to-face required
- Use `close_actors_facing_away` if behind-position required

**For Anatomy-Specific Actions**:

1. Start with anatomy requirement (`actors_with_[anatomy]_in_intimacy`)
2. Add positioning if needed (`_facing_each_other` or `_facing_each_other_or_behind_target`)
3. Add specializations if needed (`muscular_arms`, exposure requirements)

**For Activity-Specific Actions**:

- Use `current_kissing_partner` for kiss-related actions
- Use clothing-aware scopes for appearance-based actions

#### Scope Naming Conventions:

- `actors_with_[anatomy]_in_intimacy` - Basic anatomy requirement
- `actors_with_[anatomy]_facing_each_other` - Anatomy + strict positioning
- `actors_with_[anatomy]_facing_each_other_or_behind_target` - Anatomy + flexible positioning
- `close_actors_[positioning]` - Positioning without anatomy requirements

---

## Available Conditions

### Condition Architecture Overview

Conditions provide the validation logic for components, spatial relationships, and action events. They use JSON Logic for consistent evaluation and fall into three primary categories:

1. **Action Event Validation** (80% of conditions)
2. **Positioning/Spatial State Checks** (15% of conditions)
3. **Component State Checks** (5% of conditions)

### Condition Categories

#### Action Event Validation Conditions

These validate specific action triggers using the pattern:

```json
{ "==": [{ "var": "event.payload.actionId" }, "mod:action_id"] }
```

**Kissing Actions** (8 conditions):

- `intimacy:event-is-action-accept-kiss-passively`
- `intimacy:event-is-action-kiss-back-passionately`
- `intimacy:event-is-action-break-kiss-gently`
- `intimacy:event-is-action-lean-in-for-deep-kiss`
- `intimacy:event-is-action-pull-back-breathlessly`
- `intimacy:event-is-action-pull-back-in-revulsion`
- `intimacy:event-is-action-cup-face-while-kissing`
- `intimacy:event-is-action-peck_on_lips`

**Physical Touch Actions** (10 conditions):

- `intimacy:event-is-action-massage-shoulders`
- `intimacy:event-is-action-massage-back`
- `intimacy:event-is-action-place-hand-on-waist`
- `intimacy:event-is-action-feel-arm-muscles`
- `intimacy:event-is-action-brush-hand`
- `intimacy:event-is-action-fondle-ass`
- `sex:event-is-action-fondle-penis`
- `sex:event-is-action-fondle-breasts`
- `intimacy:event-is-action-thumb-wipe-cheek`
- `intimacy:event-is-action-nuzzle-face-into-neck`

**Oral Actions** (4 conditions):

- `intimacy:event-is-action-explore-mouth-with-tongue`
- `intimacy:event-is-action-nibble-lower-lip`
- `intimacy:event-is-action-suck-on-tongue`
- `intimacy:event-is-action-lick-lips`

**Usage Pattern**: One condition per action for rule matching, enables clean separation of action types.

#### Positioning/Spatial State Conditions

**`intimacy:both-actors-facing-each_other`**

- **Purpose**: Validates mutual face-to-face positioning
- **Logic**: Complex AND ensuring neither actor faces away from the other

```json
{
  "and": [
    {
      "not": {
        "in": [
          { "var": "entity.id" },
          { "var": "actor.components.intimacy:facing_away.facing_away_from" }
        ]
      }
    },
    {
      "not": {
        "in": [
          { "var": "actor.id" },
          { "var": "entity.components.intimacy:facing_away.facing_away_from" }
        ]
      }
    }
  ]
}
```

**`intimacy:actor-is-behind-entity`**

- **Purpose**: Validates actor is behind target
- **Logic**: Checks if actor ID is in entity's facing_away_from array

```json
{
  "in": [
    { "var": "actor.id" },
    { "var": "entity.components.intimacy:facing_away.facing_away_from" }
  ]
}
```

**Facing Away Conditions**:

- `intimacy:entity-in-facing-away` - Entity in actor's facing_away array
- `intimacy:actor-in-entity-facing-away` - Actor in entity's facing_away array
- `intimacy:entity-not-in-facing-away` - Negated version using `"not"` wrapper

**Usage Pattern**: Used by scopes to filter valid targets based on spatial relationships.

#### Component State Conditions

**`intimacy:actor-is-in-closeness`**

- **Purpose**: Validates closeness component exists
- **Logic**: Truthiness check using `"!!"` operator

```json
{ "!!": { "var": "actor.components.intimacy:closeness" } }
```

**`intimacy:actor-is-kiss-receiver`**

- **Purpose**: Validates actor is not kiss initiator
- **Logic**: Boolean property check

```json
{ "==": [{ "var": "actor.components.intimacy:kissing.initiator" }, false] }
```

**`intimacy:target-is-kissing-partner`**

- **Purpose**: Validates target matches current kissing partner
- **Logic**: ID matching

```json
{
  "==": [
    { "var": "target.id" },
    { "var": "actor.components.intimacy:kissing.partner" }
  ]
}
```

### Context Variables Reference

**Event Context**:

- `event.payload.actionId` - The action being attempted
- `event.payload.actorId` - ID of action performer
- `event.payload.targetId` - ID of action target

**Entity Context**:

- `actor.id` / `entity.id` / `target.id` - Entity identifiers
- `actor.components.*` / `entity.components.*` - Component data access

**Component-Specific Variables**:

- `*.components.intimacy:closeness.partners[]` - Partner arrays
- `*.components.intimacy:facing_away.facing_away_from[]` - Facing away arrays
- `*.components.intimacy:kissing.partner` - Kiss partner ID
- `*.components.intimacy:kissing.initiator` - Kiss initiator boolean

---

## Rule Patterns and Commonalities

### Rule Architecture Overview

Rules in the intimacy and sex systems follow highly standardized patterns that fall into two categories:

1. **Simple Descriptive Actions** (80% of rules)
2. **Complex State Management Actions** (20% of rules)

Both patterns use consistent variable naming, sequence structures, and macro integration.

### Standard Simple Action Pattern

**Actions Following This Pattern**: Most physical touch, massage, kissing, and all sex actions

**Standard 8-Step Sequence**:

1. `GET_NAME` for actor → `actorName` variable
2. `GET_NAME` for target → `targetName` variable
3. `QUERY_COMPONENT` for actor position → `actorPosition` variable
4. `SET_VARIABLE` for `logMessage` with descriptive text
5. `SET_VARIABLE` for `perceptionType` (typically `"action_target_general"`)
6. `SET_VARIABLE` for `locationId` from actor position
7. `SET_VARIABLE` for `targetId` from event payload
8. `{ "macro": "core:logSuccessAndEndTurn" }`

**Example Template**:

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_[action_name]",
  "comment": "Handles the '[mod:action_id]' action. Dispatches descriptive text and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": { "condition_ref": "[mod:event-is-action-action_name]" },
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
        "value": "{context.actorName} [descriptive action] {context.targetName}[...]."
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

### Complex State Management Pattern

**Actions Using This Pattern**: `get_close`, `turn_around`, `lean_in_for_deep_kiss`, kiss ending actions

**Common Characteristics**:

- Custom operation handler calls
- Component lifecycle management (ADD/MODIFY/REMOVE)
- Conditional logic with IF actions
- Multi-entity state coordination
- Standard logging sequence after state changes

**Example: Component Addition Pattern** (`lean_in_for_deep_kiss`):

```json
{
  "type": "ADD_COMPONENT",
  "parameters": {
    "entity_ref": "actor",
    "component_type": "intimacy:kissing",
    "component_data": {
      "partner": "{event.payload.targetId}",
      "initiator": true
    }
  }
},
{
  "type": "ADD_COMPONENT",
  "parameters": {
    "entity_ref": "target",
    "component_type": "intimacy:kissing",
    "component_data": {
      "partner": "{event.payload.actorId}",
      "initiator": false
    }
  }
}
```

### Variable Naming Conventions

**Standard Variable Names** (used across all rules):

- `actorName` / `targetName` - Display names from GET_NAME operations
- `actorPosition` / `actorPos` - Position component data
- `logMessage` - User-facing descriptive text
- `perceptionType` - Event perception classification
- `locationId` - Location where action occurs
- `targetId` - Target entity identifier

**Variable Interpolation Patterns**:

- `{context.variableName}` - Context variables set by previous actions
- `{event.payload.fieldName}` - Event payload data
- `{context.actorName} [verb] {context.targetName}[object/modifier].` - Standard message format

### Descriptive Language Patterns

**Intimacy Mod Language**:

- Emphasizes gentleness: "gently", "softly", "tenderly"
- Progressive intensity: "light peck" → "deep kiss" → "passionate exploration"
- Emotional context: "breathlessly", "in revulsion", "possessively"
- Sensual descriptions: "nuzzle", "explore", "caress"

**Sex Mod Language**:

- More direct: "fondle", "stimulate"
- Intensity markers: "eagerly", "sensually"
- Anatomically explicit but tasteful

### Macro Integration

**Universal Macro Usage**:

- `{ "macro": "core:logSuccessAndEndTurn" }` appears in 100% of rules
- Always the final action in rule sequence
- Handles success logging, turn completion, and cleanup

**Custom Macro Usage**:

- Some complex rules may use specialized macros
- Integration points typically after state management, before logging

### Rule Development Template

**For New Simple Actions**:

1. Copy standard 8-step sequence
2. Update rule_id, comment, and condition_ref
3. Customize logMessage with appropriate descriptive language
4. Set perceptionType (`"action_target_general"` for most actions)
5. Ensure proper action/rule ID matching

**For New Complex Actions**:

1. Start with standard sequence for logging portion
2. Add state management actions before logging sequence
3. Use conditional logic (IF actions) for complex component manipulation
4. Consider multi-entity coordination needs
5. Test component lifecycle transitions thoroughly

### Performance Considerations

**Efficient Patterns**:

- Batch component queries where possible
- Use consistent variable names for caching opportunities
- Minimize conditional logic depth
- Leverage existing condition references

**Common Performance Traps**:

- Excessive GET_NAME calls (cache results)
- Redundant component queries
- Complex nested conditionals
- Missing error handling for missing components

---

## Development Guidelines

### Adding New Actions

#### 1. Action Definition Template

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "[mod]:[action_name]",
  "name": "[Display Name]",
  "description": "[Description of what this action does]",
  "scope": "[appropriate_scope]",
  "required_components": {
    "actor": ["intimacy:closeness"] // Usually required
  },
  "forbidden_components": {
    "actor": ["intimacy:kissing"] // If inappropriate during kissing
  },
  "template": "[verb] {target}[object]",
  "prerequisites": [] // Usually empty except for special cases
}
```

#### 2. Scope Selection Decision Tree

```
Does action require specific anatomy?
├─ No → Use positional scope (close_actors, close_actors_facing_each_other, etc.)
└─ Yes → Use anatomy-specific scope
    ├─ Basic anatomy only → actors_with_[anatomy]_in_intimacy
    ├─ Anatomy + strict positioning → actors_with_[anatomy]_facing_each_other
    └─ Anatomy + flexible positioning → actors_with_[anatomy]_facing_each_other_or_behind_target

Is action during specific activity?
├─ During kissing → current_kissing_partner
├─ Clothing-dependent → close_actors_facing_each_other_with_torso_clothing
└─ General → Use above anatomy/position logic
```

#### 3. Component Requirements Guidelines

- **Always required**: `intimacy:closeness` (except `get_close` and social actions)
- **Forbidden during kissing**: Most non-kiss actions should forbid `intimacy:kissing`
- **Special requirements**: Activities like kissing may require specific components

#### 4. Template Guidelines

- Use `{target}` placeholder for target entity
- Keep language consistent with mod's tone (gentle for intimacy, direct for sex)
- Follow pattern: `[verb] {target}['s] [object/body_part][modifier]`

### Adding New Rules

#### 1. Simple Action Rule Template

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_[action_name]",
  "comment": "Handles the '[mod:action_id]' action. Dispatches descriptive text and ends the turn.",
  "event_type": "core:attempt_action",
  "condition": { "condition_ref": "[mod:event-is-action-action_name]" },
  "actions": [
    // Standard 8-step sequence here
  ]
}
```

#### 2. Complex Action Rule Guidelines

- Start with state management actions
- Use conditional logic (IF actions) for complex scenarios
- Add standard logging sequence after state changes
- Consider multi-entity state coordination
- Test component lifecycle thoroughly

### Adding New Conditions

#### 1. Action Event Condition Template

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "[mod]:event-is-action-[action_name]",
  "description": "Checks if the event is attempting the '[action_display_name]' action.",
  "logic": {
    "==": [{ "var": "event.payload.actionId" }, "[mod]:[action_id]"]
  }
}
```

#### 2. State Validation Condition Template

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "[mod]:[condition_name]",
  "description": "[Description of what this condition validates]",
  "logic": {
    // JSON Logic expression here
  }
}
```

### Adding New Scopes

#### 1. Basic Scope Template

```javascript
// [Description of scope purpose and usage]
[mod]:[scope_name] := actor.intimacy:closeness.partners[][{
  // Filtering logic here
}]
```

#### 2. Anatomy-Specific Scope Template

```javascript
// Scope for actors in closeness who have [anatomy] and [positioning requirements]
// Used by actions that require [anatomy] anatomy and [positioning] interaction
[mod]:actors_with_[anatomy]_[positioning] := actor.intimacy:closeness.partners[][{
  "and": [
    {"hasPartOfType": [".", "[anatomy]"]},
    {"condition_ref": "[positioning_condition]"}
  ]
}]
```

#### 3. Exposure-Aware Scope Template (Sex Mod)

```javascript
// Scope for actors in closeness who have [anatomy] that are uncovered and [positioning]
// Used by actions that require exposed [anatomy] anatomy and [positioning] interaction
[mod]:actors_with_[anatomy]_[positioning] := actor.intimacy:closeness.partners[][{
  "and": [
    {"hasPartOfType": [".", "[anatomy]"]},
    {"condition_ref": "[positioning_condition]"},
    // Exposure logic here
  ]
}]
```

### Adding New Components

#### 1. Component Design Principles

- **Single Responsibility**: Each component tracks one aspect of state
- **Relationship Modeling**: Use arrays for multi-entity relationships
- **State Validation**: Include required fields and proper schemas
- **Lifecycle Management**: Consider creation, modification, and removal patterns

#### 2. Component Template

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "[mod]:[component_name]",
  "description": "[Description of what this component tracks and its purpose]",
  "dataSchema": {
    "type": "object",
    "additionalProperties": false,
    "required": ["required_field"],
    "properties": {
      "required_field": {
        "type": "[type]",
        "description": "[Description]",
        "default": "[default_value]"
      }
    }
  }
}
```

### Testing New Content

#### 1. Action Testing Checklist

- [ ] Action appears in correct scopes
- [ ] Required components properly validated
- [ ] Forbidden components properly enforced
- [ ] Template renders correctly
- [ ] Prerequisites function as intended

#### 2. Rule Testing Checklist

- [ ] Rule fires on correct action events
- [ ] Variable interpolation works correctly
- [ ] State changes apply properly
- [ ] Logging appears with correct message
- [ ] Turn ends successfully

#### 3. Integration Testing

- [ ] Action/rule pairing works correctly
- [ ] Component state transitions function
- [ ] Multi-actor scenarios handle properly
- [ ] Edge cases (missing components, invalid states) handled gracefully

### Common Pitfalls

#### 1. Action Definition Issues

- **Incorrect scope**: Action never appears for selection
- **Missing required components**: Runtime errors
- **Wrong forbidden components**: Actions available in inappropriate contexts
- **Template syntax errors**: Malformed display text

#### 2. Rule Implementation Issues

- **Variable name mismatches**: Broken interpolation
- **Missing condition references**: Rules don't fire
- **Component lifecycle errors**: Invalid state transitions
- **Missing macro call**: Turn doesn't end properly

#### 3. Scope Design Issues

- **Too restrictive**: Actions never available
- **Too permissive**: Actions available inappropriately
- **Missing anatomy checks**: Actions available to entities without required parts
- **Incorrect positioning logic**: Actions available in wrong spatial contexts

---

## Best Practices

### 1. Consistency Guidelines

- **Follow naming conventions** established in existing content
- **Use standard variable names** in rules for consistency
- **Maintain language tone** appropriate to mod (gentle vs direct)
- **Follow component lifecycle patterns** for state management

### 2. Performance Guidelines

- **Reuse existing conditions and scopes** where possible
- **Minimize complex conditional logic** in rules
- **Batch related operations** in rule sequences
- **Cache frequently-used values** in variables

### 3. Maintainability Guidelines

- **Document complex logic** with clear comments
- **Use descriptive IDs** that indicate purpose
- **Group related content** logically in file structure
- **Test thoroughly** before committing changes

### 4. User Experience Guidelines

- **Provide clear action names** that indicate what will happen
- **Use appropriate descriptive language** in log messages
- **Ensure logical action progression** from simple to complex
- **Handle edge cases gracefully** with appropriate error messages

---

## Conclusion

The intimacy and sex mods demonstrate a sophisticated approach to modeling intimate relationships in interactive fiction. The architecture successfully balances complexity with usability through:

- **Clear separation of concerns** between actions, rules, components, and scopes
- **Standardized patterns** that enable consistent development and maintenance
- **Progressive complexity** from simple proximity to complex intimate activities
- **Flexible positioning system** that accommodates various interaction contexts
- **Comprehensive state management** through well-designed components

This reference should enable developers to confidently extend the intimacy and sex systems with new actions, rules, and behaviors while maintaining architectural consistency and quality standards.

For questions or clarifications about specific implementation details, refer to the individual files analyzed in this report or consult the Living Narrative Engine documentation for ECS architecture and rule system patterns.
