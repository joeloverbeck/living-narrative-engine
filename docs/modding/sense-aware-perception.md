# Sense-Aware Perception System

## Overview

The sense-aware perception system allows events to be filtered and adapted based on:
- **Recipient sensory capabilities** (eyes, ears, nose status from anatomy)
- **Environmental conditions** (lighting)
- **Perception type** (visual, auditory, etc.)

This creates more immersive gameplay where characters in darkness or with damaged senses receive appropriate descriptions rather than impossible perceptions.

## Sense Categories

| Category | Requirements | Example Events |
|----------|--------------|----------------|
| `visual` | Light + functioning eyes | Movement, gestures, physical actions |
| `auditory` | Functioning ears | Speech, sounds, music |
| `olfactory` | Functioning nose | Smells, scents |
| `tactile` | Physical contact | Touch, direct interaction |
| `proprioceptive` | Self only | Own actions, internal states |
| `omniscient` | Always delivered | System messages, errors |

## Adding Alternate Descriptions

To make your rules sense-aware, add `alternate_descriptions` to your `DISPATCH_PERCEPTIBLE_EVENT` operations:

### Basic Example

```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.locationId}",
    "description_text": "Bob does a handstand, balancing upside-down.",
    "perception_type": "physical.self_action",
    "actor_id": "{context.actorId}",
    "log_entry": true,
    "alternate_descriptions": {
      "auditory": "You hear sounds of exertion and shuffling nearby."
    }
  }
}
```

### Real-World Example (from bend_over.rule.json)

```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "comment": "Dispatch sense-aware perceptible event for bending over.",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.actorName} bends over {context.surfaceName}.",
    "perception_type": "physical.self_action",
    "actor_id": "{event.payload.actorId}",
    "target_id": "{event.payload.targetId}",
    "log_entry": true,
    "alternate_descriptions": {
      "auditory": "You hear the rustle of clothing and shifting of weight as someone changes position nearby."
    }
  }
}
```

### Available Fallback Keys

- `auditory` - Used when recipient can hear but not see
- `tactile` - Used when recipient can feel but not see/hear
- `olfactory` - Used for smell-based fallback (rare)
- `limited` - Final fallback when specific senses unavailable

### Choosing Appropriate Fallbacks

When deciding which fallback descriptions to include, consider:

1. **Realism**: Would this action actually produce sound/vibration/smell?
   - A sword being drawn: Yes (auditory - metallic scrape)
   - Someone bending over: Yes (auditory - clothing rustle)
   - A silent gesture: No auditory fallback appropriate

2. **Distance**: Would the effect be perceptible at conversation distance?
   - Speech: Yes (auditory)
   - Footsteps: Yes (auditory, possibly tactile for heavy steps)
   - Air movement from gentle motion: Usually no (too subtle)

3. **Don't force it**: If no realistic fallback exists, omit it. The system will simply not deliver the event to recipients who can't perceive it through available senses.

### Filtering Behavior

1. **Primary sense check**: Based on `perception_type`, the system checks if the primary sense is available
2. **Fallback cascade**: If primary unavailable, tries each fallback in array order
3. **Limited fallback**: If no specific fallback works, uses `limited` text
4. **Silent filter**: If no text available, recipient simply doesn't receive the event

## Disabling Sense Filtering

For special cases (debugging, supernatural events, etc.), set `sense_aware: false`:

```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "description_text": "The ground shakes violently.",
    "sense_aware": false
  }
}
```

## Perception Type Mappings

Each perception type has a primary sense and fallback senses:

| Type | Primary | Fallbacks |
|------|---------|-----------|
| `communication.speech` | auditory | tactile |
| `physical.self_action` | visual | auditory, tactile |
| `item.drop` | auditory | visual |
| `intimacy.sensual` | tactile | visual, auditory |
| `error.system_error` | omniscient | (none - always delivered) |

For the complete mapping, see the perception type registry at `src/perception/registries/perceptionTypeRegistry.js`.

## Manual Sensory Override

For entities without anatomy (spirits, constructs), add the `perception:sensory_capability` component:

```json
{
  "perception:sensory_capability": {
    "canSee": true,
    "canHear": true,
    "canSmell": false,
    "canFeel": true,
    "overrideMode": "manual"
  }
}
```

## Migration Guide

Existing rules continue to work unchanged. To enhance them:

1. Identify rules with `DISPATCH_PERCEPTIBLE_EVENT`
2. Consider what the event would sound/feel like realistically
3. Add appropriate `alternate_descriptions` (only those that make sense)
4. Test in dark/blind conditions

### Important Note on Macros

If your rule uses a macro like `core:logSuccessAndEndTurn`, you'll need to replace it with inline operations to support `alternate_descriptions`. The macro uses `DISPATCH_EVENT` internally, which doesn't support sense-aware features.

**Before (macro-based, no sense awareness)**:
```json
{
  "type": "SET_VARIABLE",
  "parameters": { "variable_name": "logMessage", "value": "..." }
},
{ "macro": "core:logSuccessAndEndTurn" }
```

**After (inline, with sense awareness)**:
```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "description_text": "...",
    "alternate_descriptions": { "auditory": "..." },
    ...
  }
},
{
  "type": "DISPATCH_EVENT",
  "parameters": {
    "eventType": "core:display_successful_action_result",
    "payload": { "message": "..." }
  }
},
{
  "type": "DISPATCH_EVENT",
  "parameters": {
    "eventType": "core:action_success",
    "payload": { ... }
  }
},
{
  "type": "END_TURN",
  "parameters": { "entityId": "...", "success": true }
}
```

No changes are required for backward compatibility - rules without `alternate_descriptions` use existing behavior.
