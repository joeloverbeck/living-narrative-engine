# Ballet Mod Specification

## Overview

**Mod ID**: `ballet`
**Version**: `1.0.0`
**Name**: Ballet
**Description**: Classical ballet movements and techniques for graceful performers
**Author**: joeloverbeck
**Game Version**: `>=0.0.1`

### Purpose

This mod introduces ten classical ballet actions representing foundational and advanced ballet techniques. Each action requires the performer to have ballet training (via the `is_ballet_dancer` marker component) and cannot be performed while hugging someone, maintaining ballet's requirement for freedom of movement and space.

### Dependencies

- `anatomy` (^1.0.0) - Required for body part references
- `positioning` (^1.0.0) - Required for forbidden component (hugging)

## Visual Identity

**Color Scheme**: Indigo Professional (Section 10.1)

```json
{
  "backgroundColor": "#283593",
  "textColor": "#c5cae9",
  "hoverBackgroundColor": "#3949ab",
  "hoverTextColor": "#e8eaf6"
}
```

- **Contrast Ratios**: Normal 10.58:1 🌟 AAA, Hover 9.89:1 🌟 AAA
- **Theme**: Professional, disciplined, artistic, graceful
- **Rationale**: Conveys the professionalism, precision, and artistry of classical ballet training

## Component Definition

### is_ballet_dancer.component.json

Pure marker component indicating ballet training and capability.

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "ballet:is_ballet_dancer",
  "description": "Marker component indicating the entity has ballet training and can perform classical ballet techniques",
  "dataSchema": {
    "type": "object",
    "properties": {},
    "additionalProperties": false
  }
}
```

## Action Definitions

### Common Action Pattern

All ballet actions share the following structure:

- **Targets**: `"none"` (self-targeted performance actions)
- **Required Components**: `{"actor": ["ballet:is_ballet_dancer"]}`
- **Forbidden Components**: `{"actor": ["positioning:hugging"]}`
- **Prerequisites**: `[]` (no additional prerequisites)
- **Visual**: Indigo Professional color scheme (see above)

### 1. Do Pliés in Fifth

**Action ID**: `ballet:do_plies_in_fifth`
**Name**: "Do Pliés in Fifth"
**Description**: "Perform classical pliés in fifth position, establishing turnout and alignment"

**Template**: `"do pliés in fifth"`

**Complete Action Definition**:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "ballet:do_plies_in_fifth",
  "name": "Do Pliés in Fifth",
  "description": "Perform classical pliés in fifth position, establishing turnout and alignment",
  "targets": "none",
  "required_components": {
    "actor": ["ballet:is_ballet_dancer"]
  },
  "forbidden_components": {
    "actor": ["positioning:hugging"]
  },
  "template": "do pliés in fifth",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#283593",
    "textColor": "#c5cae9",
    "hoverBackgroundColor": "#3949ab",
    "hoverTextColor": "#e8eaf6"
  }
}
```

**Rule Messages**:
- **Perceptible**: `"{actor} bends gracefully in fifth position, demonstrating perfect turnout and alignment"`
- **Successful**: `"{actor} completes a series of controlled pliés in fifth position, establishing the fundamental baseline of turnout and leg geometry"`

### 2. Do Tendus en Croix

**Action ID**: `ballet:do_tendus_en_croix`
**Name**: "Do Tendus en Croix"
**Description**: "Execute pointed foot extensions in cross pattern (front, side, back)"

**Template**: `"do tendus en croix"`

**Complete Action Definition**:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "ballet:do_tendus_en_croix",
  "name": "Do Tendus en Croix",
  "description": "Execute pointed foot extensions in cross pattern (front, side, back)",
  "targets": "none",
  "required_components": {
    "actor": ["ballet:is_ballet_dancer"]
  },
  "forbidden_components": {
    "actor": ["positioning:hugging"]
  },
  "template": "do tendus en croix",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#283593",
    "textColor": "#c5cae9",
    "hoverBackgroundColor": "#3949ab",
    "hoverTextColor": "#e8eaf6"
  }
}
```

**Rule Messages**:
- **Perceptible**: `"{actor} extends their pointed foot with razor precision through front, side, and back positions"`
- **Successful**: `"{actor} performs crisp tendus en croix, articulating the foot through all directions with controlled turnout and precise placement"`

### 3. Do Rond de Jambe à Terre

**Action ID**: `ballet:do_rond_de_jambe_a_terre`
**Name**: "Do Rond de Jambe à Terre"
**Description**: "Trace circular leg movements along the floor with pure hip rotation"

**Template**: `"do rond de jambe à terre"`

**Complete Action Definition**:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "ballet:do_rond_de_jambe_a_terre",
  "name": "Do Rond de Jambe à Terre",
  "description": "Trace circular leg movements along the floor with pure hip rotation",
  "targets": "none",
  "required_components": {
    "actor": ["ballet:is_ballet_dancer"]
  },
  "forbidden_components": {
    "actor": ["positioning:hugging"]
  },
  "template": "do rond de jambe à terre",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#283593",
    "textColor": "#c5cae9",
    "hoverBackgroundColor": "#3949ab",
    "hoverTextColor": "#e8eaf6"
  }
}
```

**Rule Messages**:
- **Perceptible**: `"{actor} traces elegant circles with their working leg along the floor"`
- **Successful**: `"{actor} executes smooth rond de jambe à terre movements, drawing classical lines through pure hip turnout and controlled circular pathways"`

### 4. Do Développé à la Seconde

**Action ID**: `ballet:do_developpe_a_la_seconde`
**Name**: "Do Développé à la Seconde"
**Description**: "Unfold the leg slowly to second position with sustained extension"

**Template**: `"do développé à la seconde"`

**Complete Action Definition**:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "ballet:do_developpe_a_la_seconde",
  "name": "Do Développé à la Seconde",
  "description": "Unfold the leg slowly to second position with sustained extension",
  "targets": "none",
  "required_components": {
    "actor": ["ballet:is_ballet_dancer"]
  },
  "forbidden_components": {
    "actor": ["positioning:hugging"]
  },
  "template": "do développé à la seconde",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#283593",
    "textColor": "#c5cae9",
    "hoverBackgroundColor": "#3949ab",
    "hoverTextColor": "#e8eaf6"
  }
}
```

**Rule Messages**:
- **Perceptible**: `"{actor} slowly unfolds their leg to the side with perfect control"`
- **Successful**: `"{actor} performs a sustained développé à la seconde, unfolding the leg with deliberate precision and maintaining impeccable line discipline throughout the extension"`

### 5. Hold Arabesque Penché

**Action ID**: `ballet:hold_arabesque_penche`
**Name**: "Hold Arabesque Penché"
**Description**: "Maintain arabesque position with controlled forward hinge"

**Template**: `"hold arabesque penché"`

**Complete Action Definition**:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "ballet:hold_arabesque_penche",
  "name": "Hold Arabesque Penché",
  "description": "Maintain arabesque position with controlled forward hinge",
  "targets": "none",
  "required_components": {
    "actor": ["ballet:is_ballet_dancer"]
  },
  "forbidden_components": {
    "actor": ["positioning:hugging"]
  },
  "template": "hold arabesque penché",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#283593",
    "textColor": "#c5cae9",
    "hoverBackgroundColor": "#3949ab",
    "hoverTextColor": "#e8eaf6"
  }
}
```

**Rule Messages**:
- **Perceptible**: `"{actor} tilts forward while raising their back leg into a dramatic arabesque"`
- **Successful**: `"{actor} holds a stunning arabesque penché with a long back line and controlled forward hinge, creating the signature silhouette of classical ballet"`

### 6. Do Pirouette en Dehors from Fourth

**Action ID**: `ballet:do_pirouette_en_dehors_from_fourth`
**Name**: "Do Pirouette en Dehors from Fourth"
**Description**: "Execute outward turning pirouette with classical preparation and spotting"

**Template**: `"do pirouette en dehors from fourth"`

**Complete Action Definition**:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "ballet:do_pirouette_en_dehors_from_fourth",
  "name": "Do Pirouette en Dehors from Fourth",
  "description": "Execute outward turning pirouette with classical preparation and spotting",
  "targets": "none",
  "required_components": {
    "actor": ["ballet:is_ballet_dancer"]
  },
  "forbidden_components": {
    "actor": ["positioning:hugging"]
  },
  "template": "do pirouette en dehors from fourth",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#283593",
    "textColor": "#c5cae9",
    "hoverBackgroundColor": "#3949ab",
    "hoverTextColor": "#e8eaf6"
  }
}
```

**Rule Messages**:
- **Perceptible**: `"{actor} prepares in fourth position and executes a clean turning pirouette"`
- **Successful**: `"{actor} performs a precise pirouette en dehors from fourth position, using classical preparation and sharp spotting technique to achieve clean single or double rotations"`

### 7. Do Fouetté Turns

**Action ID**: `ballet:do_fouette_turns`
**Name**: "Do Fouetté Turns"
**Description**: "Perform series of iconic whipping turns (8 or 16 repetitions)"

**Template**: `"do fouetté turns"`

**Complete Action Definition**:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "ballet:do_fouette_turns",
  "name": "Do Fouetté Turns",
  "description": "Perform series of iconic whipping turns (8 or 16 repetitions)",
  "targets": "none",
  "required_components": {
    "actor": ["ballet:is_ballet_dancer"]
  },
  "forbidden_components": {
    "actor": ["positioning:hugging"]
  },
  "template": "do fouetté turns",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#283593",
    "textColor": "#c5cae9",
    "hoverBackgroundColor": "#3949ab",
    "hoverTextColor": "#e8eaf6"
  }
}
```

**Rule Messages**:
- **Perceptible**: `"{actor} begins a series of rapid whipping turns with unwavering focus"`
- **Successful**: `"{actor} executes a demanding series of fouetté turns, performing the iconic whip turns with remarkable stamina and precise placement throughout the entire sequence"`

### 8. Do Bourrée Couru on Pointe

**Action ID**: `ballet:do_bourree_couru_on_pointe`
**Name**: "Do Bourrée Couru on Pointe"
**Description**: "Perform gliding travel on pointe with rapid tiny steps"

**Template**: `"do bourrée couru on pointe"`

**Complete Action Definition**:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "ballet:do_bourree_couru_on_pointe",
  "name": "Do Bourrée Couru on Pointe",
  "description": "Perform gliding travel on pointe with rapid tiny steps",
  "targets": "none",
  "required_components": {
    "actor": ["ballet:is_ballet_dancer"]
  },
  "forbidden_components": {
    "actor": ["positioning:hugging"]
  },
  "template": "do bourrée couru on pointe",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#283593",
    "textColor": "#c5cae9",
    "hoverBackgroundColor": "#3949ab",
    "hoverTextColor": "#e8eaf6"
  }
}
```

**Rule Messages**:
- **Perceptible**: `"{actor} rises onto pointe and glides across the floor with rapid micro-steps"`
- **Successful**: `"{actor} performs ethereal bourrée couru on pointe, creating the illusion of floating through uniquely pointe-driven micro-steps that produce seamless gliding travel"`

### 9. Do Entrechat Six

**Action ID**: `ballet:do_entrechat_six`
**Name**: "Do Entrechat Six"
**Description**: "Execute vertical jump with six leg beats (batterie)"

**Template**: `"do entrechat six"`

**Complete Action Definition**:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "ballet:do_entrechat_six",
  "name": "Do Entrechat Six",
  "description": "Execute vertical jump with six leg beats (batterie)",
  "targets": "none",
  "required_components": {
    "actor": ["ballet:is_ballet_dancer"]
  },
  "forbidden_components": {
    "actor": ["positioning:hugging"]
  },
  "template": "do entrechat six",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#283593",
    "textColor": "#c5cae9",
    "hoverBackgroundColor": "#3949ab",
    "hoverTextColor": "#e8eaf6"
  }
}
```

**Rule Messages**:
- **Perceptible**: `"{actor} springs into the air with legs beating rapidly in precise crossing patterns"`
- **Successful**: `"{actor} performs a virtuosic entrechat six, executing the beaten jump with rapid batterie footwork that exemplifies unmistakably classical ballet technique"`

### 10. Do Grand Jeté

**Action ID**: `ballet:do_grand_jete`
**Name**: "Do Grand Jeté"
**Description**: "Execute heroic split leap with classical ballet preparation"

**Template**: `"do grand jeté"`

**Complete Action Definition**:

```json
{
  "$schema": "schema://living-narrative-engine/action.schema.json",
  "id": "ballet:do_grand_jete",
  "name": "Do Grand Jeté",
  "description": "Execute heroic split leap with classical ballet preparation",
  "targets": "none",
  "required_components": {
    "actor": ["ballet:is_ballet_dancer"]
  },
  "forbidden_components": {
    "actor": ["positioning:hugging"]
  },
  "template": "do grand jeté",
  "prerequisites": [],
  "visual": {
    "backgroundColor": "#283593",
    "textColor": "#c5cae9",
    "hoverBackgroundColor": "#3949ab",
    "hoverTextColor": "#e8eaf6"
  }
}
```

**Rule Messages**:
- **Perceptible**: `"{actor} executes a running preparation and launches into a soaring split leap"`
- **Successful**: `"{actor} performs a magnificent grand jeté, using tombé-pas de bourrée-glissade preparation to launch into a heroic split leap that showcases full extension and classical ballet artistry"`

## Rule Structure Pattern

Each action follows the same rule structure pattern. Here's the template:

### Rule Template

```json
{
  "$schema": "schema://living-narrative-engine/rule.schema.json",
  "rule_id": "handle_[action_name]",
  "comment": "Handle [Action Name] action - [brief description]",
  "event_type": "core:attempt_action",
  "condition": {
    "condition_ref": "ballet:event-is-action-[action_name]"
  },
  "actions": [
    {
      "operation": "GET_NAME",
      "entity_id_variable": "actorId",
      "result_variable": "actorName"
    },
    {
      "operation": "SET_VARIABLE",
      "variable": "perceptibleMessage",
      "value": "{actor} [perceptible action message]"
    },
    {
      "operation": "SET_VARIABLE",
      "variable": "successfulMessage",
      "value": "{actor} [successful action message]"
    },
    {
      "macro": "core:logSuccessAndEndTurn"
    }
  ]
}
```

### Condition Files

Each action requires a corresponding condition file:

```json
{
  "$schema": "schema://living-narrative-engine/condition.schema.json",
  "id": "ballet:event-is-action-[action_name]",
  "description": "Evaluates to true if the event is attempting the [Action Name] action",
  "logic": {
    "and": [
      {
        "==": [
          {
            "var": "actionId"
          },
          "ballet:[action_name]"
        ]
      }
    ]
  }
}
```

## Mod Manifest

### mod-manifest.json

```json
{
  "$schema": "http://example.com/schemas/mod-manifest.schema.json",
  "id": "ballet",
  "version": "1.0.0",
  "name": "Ballet",
  "description": "Classical ballet movements and techniques for graceful performers",
  "author": "joeloverbeck",
  "gameVersion": ">=0.0.1",
  "dependencies": [
    {
      "id": "anatomy",
      "version": "^1.0.0"
    },
    {
      "id": "positioning",
      "version": "^1.0.0"
    }
  ],
  "content": {
    "actions": [
      "do_plies_in_fifth.action.json",
      "do_tendus_en_croix.action.json",
      "do_rond_de_jambe_a_terre.action.json",
      "do_developpe_a_la_seconde.action.json",
      "hold_arabesque_penche.action.json",
      "do_pirouette_en_dehors_from_fourth.action.json",
      "do_fouette_turns.action.json",
      "do_bourree_couru_on_pointe.action.json",
      "do_entrechat_six.action.json",
      "do_grand_jete.action.json"
    ],
    "rules": [
      "handle_do_plies_in_fifth.rule.json",
      "handle_do_tendus_en_croix.rule.json",
      "handle_do_rond_de_jambe_a_terre.rule.json",
      "handle_do_developpe_a_la_seconde.rule.json",
      "handle_hold_arabesque_penche.rule.json",
      "handle_do_pirouette_en_dehors_from_fourth.rule.json",
      "handle_do_fouette_turns.rule.json",
      "handle_do_bourree_couru_on_pointe.rule.json",
      "handle_do_entrechat_six.rule.json",
      "handle_do_grand_jete.rule.json"
    ],
    "conditions": [
      "event-is-action-do-plies-in-fifth.condition.json",
      "event-is-action-do-tendus-en-croix.condition.json",
      "event-is-action-do-rond-de-jambe-a-terre.condition.json",
      "event-is-action-do-developpe-a-la-seconde.condition.json",
      "event-is-action-hold-arabesque-penche.condition.json",
      "event-is-action-do-pirouette-en-dehors-from-fourth.condition.json",
      "event-is-action-do-fouette-turns.condition.json",
      "event-is-action-do-bourree-couru-on-pointe.condition.json",
      "event-is-action-do-entrechat-six.condition.json",
      "event-is-action-do-grand-jete.condition.json"
    ],
    "components": [
      "is_ballet_dancer.component.json"
    ]
  }
}
```

## Directory Structure

```
data/mods/ballet/
├── mod-manifest.json
├── components/
│   └── is_ballet_dancer.component.json
├── actions/
│   ├── do_plies_in_fifth.action.json
│   ├── do_tendus_en_croix.action.json
│   ├── do_rond_de_jambe_a_terre.action.json
│   ├── do_developpe_a_la_seconde.action.json
│   ├── hold_arabesque_penche.action.json
│   ├── do_pirouette_en_dehors_from_fourth.action.json
│   ├── do_fouette_turns.action.json
│   ├── do_bourree_couru_on_pointe.action.json
│   ├── do_entrechat_six.action.json
│   └── do_grand_jete.action.json
├── rules/
│   ├── handle_do_plies_in_fifth.rule.json
│   ├── handle_do_tendus_en_croix.rule.json
│   ├── handle_do_rond_de_jambe_a_terre.rule.json
│   ├── handle_do_developpe_a_la_seconde.rule.json
│   ├── handle_hold_arabesque_penche.rule.json
│   ├── handle_do_pirouette_en_dehors_from_fourth.rule.json
│   ├── handle_do_fouette_turns.rule.json
│   ├── handle_do_bourree_couru_on_pointe.rule.json
│   ├── handle_do_entrechat_six.rule.json
│   └── handle_do_grand_jete.rule.json
└── conditions/
    ├── event-is-action-do-plies-in-fifth.condition.json
    ├── event-is-action-do-tendus-en-croix.condition.json
    ├── event-is-action-do-rond-de-jambe-a-terre.condition.json
    ├── event-is-action-do-developpe-a-la-seconde.condition.json
    ├── event-is-action-hold-arabesque-penche.condition.json
    ├── event-is-action-do-pirouette-en-dehors-from-fourth.condition.json
    ├── event-is-action-do-fouette-turns.condition.json
    ├── event-is-action-do-bourree-couru-on-pointe.condition.json
    ├── event-is-action-do-entrechat-six.condition.json
    └── event-is-action-do-grand-jete.condition.json
```

## Implementation Notes

### Testing Strategy

As specified in the requirements, comprehensive action discovery and rule execution tests are **not required** for this mod because:

1. All actions follow the same simple pattern
2. No complex logic or prerequisites exist
3. The mod serves as a straightforward demonstration of ballet techniques
4. Testing would be repetitive across all ten actions

### Naming Conventions

- **Action IDs**: Use underscores for multi-word names (e.g., `do_plies_in_fifth`)
- **File Names**: Match action IDs exactly (e.g., `do_plies_in_fifth.action.json`)
- **Rule IDs**: Prefix with `handle_` (e.g., `handle_do_plies_in_fifth`)
- **Condition IDs**: Use pattern `event-is-action-[action-name]` with hyphens

### Content ID Format

All content uses the namespace format `ballet:[identifier]`:
- Actions: `ballet:do_plies_in_fifth`
- Components: `ballet:is_ballet_dancer`
- Conditions: `ballet:event-is-action-do-plies-in-fifth`

### Integration with Game

To enable this mod in a game instance, add it to `game.json`:

```json
{
  "mods": [
    "core",
    "anatomy",
    "positioning",
    "ballet"
  ]
}
```

### Character Creation

To create a ballet dancer character, add the marker component:

```json
{
  "id": "ballet_dancer_001",
  "components": {
    "ballet:is_ballet_dancer": {}
  }
}
```

## Accessibility Compliance

All visual properties meet **WCAG 2.1 AA** standards:

- **Background/Text Contrast**: 10.58:1 (🌟 AAA level)
- **Hover State Contrast**: 9.89:1 (🌟 AAA level)
- **Color Independence**: Actions are distinguishable through text labels, not color alone
- **High Contrast Mode**: Visual scheme provides excellent contrast for visually impaired users

## Ballet Movement Reference

Each action represents authentic classical ballet technique:

1. **Pliés in Fifth** - Foundation exercise for turnout and alignment
2. **Tendus en Croix** - Foot articulation in all directions (front, side, back)
3. **Rond de Jambe à Terre** - Hip rotation exercise tracing circles on floor
4. **Développé à la Seconde** - Controlled leg unfolding to side position
5. **Arabesque Penché** - Iconic pose with back leg raised, torso hinged forward
6. **Pirouette en Dehors** - Outward spinning turn from fourth position
7. **Fouetté Turns** - Series of whipping turns (signature of advanced dancers)
8. **Bourrée Couru on Pointe** - Gliding steps on pointe shoes
9. **Entrechat Six** - Vertical jump with six rapid leg beats
10. **Grand Jeté** - Large split leap with running preparation

## Conclusion

This specification provides a complete design for a ballet mod that:

- Maintains consistency with existing mod patterns
- Provides authentic ballet movement representation
- Ensures WCAG AA accessibility compliance
- Follows Living Narrative Engine architectural standards
- Uses appropriate color psychology (indigo = professional artistry)
- Requires minimal testing due to simple, uniform action structure
