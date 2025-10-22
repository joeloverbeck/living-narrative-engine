# Intimacy & Sex System Architecture Report

## Executive Summary

This report provides a comprehensive architectural analysis of the intimacy and sex mod systems in the Living Narrative Engine. The analysis covers 31 actions (27 intimacy, 4 sex), their corresponding rules, component dependencies, and implementation patterns. This document serves as a reference guide for creating additional intimacy and sex mods.

## System Overview

### Mod Structure

**Intimacy Mod** (`data/mods/intimacy/`)

- 27 actions covering kissing, touching, and intimate interactions
- 22 rules for action handling and state management
- 1 component: `intimacy:kissing` for tracking kiss state
- 24 conditions for event filtering
- 3 scope definitions for target selection

**Sex Module Family** (modular replacement for the legacy `data/mods/sex/` package)

- `sex-core` – shared components and scopes consumed by the other sex modules
- `sex-breastplay` – 3 actions, 3 rules, 3 conditions, and 3 scopes covering breast intimacy
- `sex-penile-manual` – 4 actions, 4 rules, 4 conditions, and 1 scope for manual penis play
- `sex-penile-oral` – oral-teasing and stimulation flows with matching rules/conditions
- `sex-vaginal-penetration` – vaginal penetration actions plus supporting rules/conditions/scopes
- `sex-dry-intimacy` – clothed grinding and frottage interactions
- `sex-anal-penetration` – anal-teasing and penetration entries

## Action System Architecture

### Action Structure

All actions follow a consistent JSON structure:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "modId:action_name",
  "name": "Display Name",
  "description": "What the action does",
  "targets": "scope:definition" OR { "primary": {...} },
  "required_components": { "actor": [...] },
  "forbidden_components": { "actor": [...] },
  "prerequisites": [...],
  "template": "action template with {target}",
  "visual": { /* styling */ }
}
```

### Intimacy Actions Catalog

#### Kissing Actions (Core Group)

| Action ID                            | File                                    | Target Scope                          | Requirements                                                     | Effects                 |
| ------------------------------------ | --------------------------------------- | ------------------------------------- | ---------------------------------------------------------------- | ----------------------- |
| `intimacy:lean_in_for_deep_kiss`     | `lean_in_for_deep_kiss.action.json`     | `actors_with_mouth_facing_each_other` | Requires: `positioning:closeness`<br>Forbids: `intimacy:kissing` | Initiates kissing state |
| `intimacy:peck_on_lips`              | `peck_on_lips.action.json`              | `actors_with_mouth_facing_each_other` | Requires: `positioning:closeness`<br>Forbids: `intimacy:kissing` | Simple kiss             |
| `intimacy:kiss_back_passionately`    | `kiss_back_passionately.action.json`    | `current_kissing_partner`             | Requires: `intimacy:kissing`<br>Must be receiver                 | Returns kiss            |
| `intimacy:accept_kiss_passively`     | `accept_kiss_passively.action.json`     | `current_kissing_partner`             | Requires: `intimacy:kissing`<br>Must be receiver                 | Passive response        |
| `intimacy:explore_mouth_with_tongue` | `explore_mouth_with_tongue.action.json` | `current_kissing_partner`             | Requires: `intimacy:kissing`                                     | Deepens kiss            |
| `intimacy:suck_on_tongue`            | `suck_on_tongue.action.json`            | `current_kissing_partner`             | Requires: `intimacy:kissing`                                     | Intimate kiss action    |
| `intimacy:nibble_lower_lip`          | `nibble_lower_lip.action.json`          | `current_kissing_partner`             | Requires: `intimacy:kissing`                                     | Playful kiss variation  |
| `intimacy:cup_face_while_kissing`    | `cup_face_while_kissing.action.json`    | `current_kissing_partner`             | Requires: `intimacy:kissing`                                     | Tender gesture          |
| `intimacy:break_kiss_gently`         | `break_kiss_gently.action.json`         | `current_kissing_partner`             | Requires: `intimacy:kissing`                                     | Removes kissing state   |
| `intimacy:pull_back_breathlessly`    | `pull_back_breathlessly.action.json`    | `current_kissing_partner`             | Requires: `intimacy:kissing`                                     | Passionate break        |
| `intimacy:pull_back_in_revulsion`    | `pull_back_in_revulsion.action.json`    | `current_kissing_partner`             | Requires: `intimacy:kissing`                                     | Negative break          |

#### Neck & Face Actions

| Action ID                               | File                                       | Target Scope                                          | Requirements                                                     | Effects             |
| --------------------------------------- | ------------------------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------- | ------------------- |
| `intimacy:kiss_cheek`                   | `kiss_cheek.action.json`                   | Various                                               | Requires: `positioning:closeness`                                | Simple affection    |
| `intimacy:kiss_neck_sensually`          | `kiss_neck_sensually.action.json`          | `actors_with_arms_facing_each_other_or_behind_target` | Requires: `positioning:closeness`<br>Forbids: `intimacy:kissing` | Sensual interaction |
| `intimacy:nuzzle_face_into_neck`        | `nuzzle_face_into_neck.action.json`        | Various                                               | Requires: `positioning:closeness`                                | Intimate nuzzling   |
| `intimacy:nibble_earlobe_playfully`     | `nibble_earlobe_playfully.action.json`     | Various                                               | Requires: `positioning:closeness`                                | Playful interaction |
| `intimacy:suck_on_neck_to_leave_hickey` | `suck_on_neck_to_leave_hickey.action.json` | Various                                               | Requires: `positioning:closeness`                                | Marks partner       |
| `intimacy:lick_lips`                    | `lick_lips.action.json`                    | Various                                               | Requires: `positioning:closeness`                                | Suggestive gesture  |

#### Touch & Physical Contact Actions

| Action ID                      | File                              | Target Scope                                          | Requirements                      | Effects              |
| ------------------------------ | --------------------------------- | ----------------------------------------------------- | --------------------------------- | -------------------- |
| `intimacy:brush_hand`          | `brush_hand.action.json`          | Various                                               | Requires: `positioning:closeness` | Light touch          |
| `intimacy:thumb_wipe_cheek`    | `thumb_wipe_cheek.action.json`    | Various                                               | Requires: `positioning:closeness` | Tender gesture       |
| `intimacy:place_hand_on_waist` | `place_hand_on_waist.action.json` | Various                                               | Requires: `positioning:closeness` | Intimate positioning |
| `intimacy:massage_shoulders`   | `massage_shoulders.action.json`   | `actors_with_arms_facing_each_other_or_behind_target` | Requires: `positioning:closeness` | Relaxing touch       |
| `intimacy:massage_back`        | `massage_back.action.json`        | Various                                               | Requires: `positioning:closeness` | Relaxing touch       |
| `intimacy:feel_arm_muscles`    | `feel_arm_muscles.action.json`    | Various                                               | Requires: `positioning:closeness` | Appreciative touch   |
| `intimacy:fondle_ass`          | `fondle_ass.action.json`          | Various                                               | Requires: `positioning:closeness` | Sexual touch         |
| `intimacy:adjust_clothing`     | `adjust_clothing.action.json`     | Various                                               | Requires: `positioning:closeness` | Preparation/recovery |

### Sex Actions Catalog

| Action ID                                  | File                                  | Target Scope                                                    | Requirements                                                          | Effects             |
| ------------------------------------------ | ------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------- |
| `sex-breastplay:fondle_breasts`                       | `sex-breastplay/actions/fondle_breasts.action.json`          | `sex-breastplay:actors_with_breasts_facing_each_other`                         | Requires: `positioning:closeness`<br>Target must have exposed breasts | Sexual interaction  |
| `sex-penile-manual:fondle_penis`           | `sex-penile-manual/actions/fondle_penis.action.json`            | `sex-core:actors_with_penis_facing_each_other`                  | Requires: `positioning:closeness`                                     | Sexual interaction  |
| `sex-penile-manual:rub_penis_over_clothes` | `sex-penile-manual/actions/rub_penis_over_clothes.action.json`  | `sex-penile-manual:actors_with_penis_facing_each_other_covered` | Requires: `positioning:closeness`<br>Target must have covered penis   | Clothed interaction |
| `sex-dry-intimacy:rub_vagina_over_clothes`              | `sex-dry-intimacy/actions/rub_vagina_over_clothes.action.json` | `sex-dry-intimacy:actors_with_vagina_facing_each_other_covered`                  | Requires: `positioning:closeness`<br>Target must have covered vagina  | Clothed interaction |

## Rule System Architecture

### Rule Structure Pattern

All rules follow this structure:

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_action_name",
  "comment": "Description of what the rule does",
  "event_type": "core:attempt_action",
  "condition": { "condition_ref": "modId:event-is-action-name" },
  "actions": [
    // Series of operation handler actions
  ]
}
```

### Common Rule Actions

1. **Name Retrieval**:

   ```json
   {
     "type": "GET_NAME",
     "parameters": { "entity_ref": "actor", "result_variable": "actorName" }
   }
   ```

2. **Component Management**:
   - `ADD_COMPONENT`: Add state (e.g., kissing)
   - `REMOVE_COMPONENT`: Remove state
   - `QUERY_COMPONENT`: Read component data

3. **Variable Setting**:

   ```json
   {
     "type": "SET_VARIABLE",
     "parameters": {
       "variable_name": "logMessage",
       "value": "Narrative text with {context.actorName}"
     }
   }
   ```

4. **Event Dispatching**:
   - `core:perceptible_event`: For visibility to other actors
   - `core:display_successful_action_result`: For UI feedback

5. **Turn Management**:
   - `END_TURN`: Complete the action
   - Macro: `core:logSuccessAndEndTurn`

### Rule Categories

#### State Management Rules

Rules that add/remove components to track interaction states:

- `lean_in_for_deep_kiss.rule.json`: Adds `intimacy:kissing` to both participants
- `break_kiss_gently.rule.json`: Removes `intimacy:kissing` from both participants

#### Simple Action Rules

Rules that only generate narrative without state changes:

- `kiss_neck_sensually.rule.json`
- `handle_fondle_breasts.rule.json`
- Most touch and physical contact actions

#### Complex Interaction Rules

Rules with prerequisites and complex logic:

- `kiss_back_passionately.rule.json`: Requires being kiss receiver
- Actions within kissing state requiring partner validation

## Component System

### Core Components

#### `intimacy:kissing` Component

- **File**: `data/mods/intimacy/components/kissing.component.json`
- **Purpose**: Tracks active kissing interaction between two characters
- **Schema**:
  ```json
  {
    "partner": "entityId",  // The kissing partner
    "initiator": boolean    // Who started the kiss
  }
  ```

#### `positioning:closeness` Component (Required Dependency)

- **Purpose**: Prerequisite for all intimate actions
- **Used By**: All intimacy and sex actions
- **Provides**: List of partners in close proximity

## Target Selection System

### Scope DSL Patterns

The system uses a custom Scope DSL for defining valid targets:

#### Basic Scope Structure

```
modId:scope_name := actor.components.positioning:closeness.partners[][{filter}]
```

#### Example Scopes

1. **Mouth-to-Mouth Contact**:

   ```
   intimacy:actors_with_mouth_facing_each_other :=
     actor.components.positioning:closeness.partners[][{
       "and": [
         {"hasPartOfType": [".", "mouth"]},
         {"condition_ref": "positioning:both-actors-facing-each-other"}
       ]
     }]
   ```

2. **Exposed Anatomy**:

   ```
   sex:actors_with_breasts_facing_each_other :=
     actor.components.positioning:closeness.partners[][{
       "and": [
         {"hasPartOfType": [".", "breast"]},
         {"condition_ref": "positioning:entity-not-in-facing-away"},
         {
           "or": [
             {"not": {"isSocketCovered": [".", "left_chest"]}},
             {"not": {"isSocketCovered": [".", "right_chest"]}}
           ]
         }
       ]
     }]
   ```

3. **Current Partner Selection**:
   ```
   intimacy:current_kissing_partner :=
     actor.components.intimacy:kissing.partner
   ```

### Anatomy & Clothing Checks

The system validates:

- **Anatomy Presence**: `hasPartOfType` checks for body parts
- **Clothing Coverage**: `isSocketCovered` checks if body parts are covered
- **Positioning**: Face-to-face, behind, or side positioning
- **Component States**: Active interactions like kissing

## Visual Design Patterns

### Color Schemes

**Intimacy Actions** (Pink/Rose theme):

```json
{
  "backgroundColor": "#ad1457",
  "textColor": "#ffffff",
  "hoverBackgroundColor": "#c2185b",
  "hoverTextColor": "#fce4ec"
}
```

**Sex Actions** (Purple theme):

```json
{
  "backgroundColor": "#4a148c",
  "textColor": "#e1bee7",
  "hoverBackgroundColor": "#6a1b9a",
  "hoverTextColor": "#f3e5f5"
}
```

## Implementation Guidelines

### Creating New Intimacy/Sex Actions

1. **Define the Action** (`actions/action_name.action.json`):
   - Choose appropriate target scope
   - Set required components (usually `positioning:closeness`)
   - Add forbidden components if needed
   - Create action template
   - Apply appropriate visual theme

2. **Create Condition** (`conditions/event-is-action-name.condition.json`):

   ```json
   {
     "$schema": "schema://living-narrative-engine/condition.schema.json",
     "id": "modId:event-is-action-action-name",
     "condition": {
       "==": [{ "var": "event.payload.actionId" }, "modId:action_name"]
     }
   }
   ```

3. **Implement Rule** (`rules/handle_action_name.rule.json`):
   - Handle `core:attempt_action` event
   - Reference the condition
   - Get actor/target names
   - Manage component states if needed
   - Generate narrative text
   - Dispatch perceptible events
   - End turn with success

4. **Define Scopes** (if new targeting needed):
   - Create `.scope` files for complex target selection
   - Use anatomy checks for body-specific actions
   - Consider clothing states for sex actions

### Best Practices

1. **State Management**:
   - Use components to track ongoing interactions
   - Always clean up states properly (remove components)
   - Validate prerequisites before allowing actions

2. **Narrative Generation**:
   - Keep descriptions tasteful and contextual
   - Use character names in narrative text
   - Vary descriptions to avoid repetition

3. **Target Selection**:
   - Use specific scopes for anatomical requirements
   - Check clothing states for exposed body parts
   - Validate positioning (facing, behind, etc.)

4. **Action Flow**:
   - Simple touch → Intimate touch → Kissing → Sexual
   - Provide options to escalate or de-escalate
   - Include consent-respecting options (gentle breaks, passive acceptance)

## Common Patterns & Templates

### Simple Touch Action Template

```json
{
  "id": "intimacy:gentle_caress",
  "targets": "scope:appropriate_targets",
  "required_components": { "actor": ["positioning:closeness"] },
  "template": "gently caress {target}"
}
```

### State-Changing Action Template

```json
// Action that initiates a state
{
  "forbidden_components": { "actor": ["state:component"] },
  // Rule adds the component to both parties
}

// Action within a state
{
  "required_components": { "actor": ["state:component"] },
  // Rule maintains or modifies the state
}

// Action that ends a state
{
  "required_components": { "actor": ["state:component"] },
  // Rule removes the component from both parties
}
```

### Anatomy-Specific Action Template

```json
{
  "targets": {
    "primary": {
      "scope": "modId:actors_with_anatomy_and_position",
      "placeholder": "target",
      "description": "Valid target description"
    }
  }
}
```

## Recommended Expansion Areas

Based on the current architecture, the following areas could be expanded:

1. **Additional States**:
   - Embracing/hugging state
   - Hand-holding state
   - Sexual activity states

2. **Positioning Variations**:
   - Lying down interactions
   - Sitting interactions
   - Standing/against wall

3. **Emotional Context**:
   - Mood-based action variations
   - Relationship-aware descriptions
   - Consent and comfort levels

4. **Progressive Intimacy**:
   - Clothing removal sequences
   - Foreplay progression systems
   - Multiple simultaneous states

5. **Environmental Context**:
   - Privacy-aware actions
   - Location-appropriate behaviors
   - Furniture/prop interactions

## File Reference Summary

### Intimacy Mod Files

- **Actions**: 27 files in `data/mods/intimacy/actions/`
- **Rules**: 22 files in `data/mods/intimacy/rules/`
- **Conditions**: 24 files in `data/mods/intimacy/conditions/`
- **Components**: 1 file in `data/mods/intimacy/components/`
- **Scopes**: 3 files in `data/mods/intimacy/scopes/`

### Sex Module Family Files

- **sex-core**: Shared scopes (`actors_with_penis_*`, `actors_sitting_close_with_uncovered_penis`, etc.) and penetration components used across the family.
- **sex-breastplay**: 3 actions, 3 rules, 3 conditions, and 3 scopes in `data/mods/sex-breastplay/`.
- **sex-penile-manual**: 4 actions, 4 rules, 4 conditions, and 1 scope in `data/mods/sex-penile-manual/`.
- **sex-penile-oral**: Oral-teasing actions plus matching rules and conditions in `data/mods/sex-penile-oral/`.
- **sex-vaginal-penetration**: 5 actions, 5 rules, 5 conditions, and multiple scopes in `data/mods/sex-vaginal-penetration/`.
- **sex-dry-intimacy**: 6 actions, 6 rules, 6 conditions, and 4 scopes in `data/mods/sex-dry-intimacy/`.
- **sex-anal-penetration**: Anal teaser actions, rules, and scopes in `data/mods/sex-anal-penetration/`.

## Conclusion

The intimacy and sex mod systems demonstrate a well-structured, extensible architecture for handling intimate interactions in the Living Narrative Engine. The consistent patterns across actions, rules, and state management make it straightforward to add new intimate behaviors while maintaining narrative coherence and respecting player agency.

Key strengths:

- Clear separation between action definition and rule implementation
- Flexible scope system for target selection
- State management through components
- Consistent visual theming
- Progressive interaction paths

This architecture provides a solid foundation for creating rich, contextual intimate interactions while maintaining the modding-first philosophy of the Living Narrative Engine.
