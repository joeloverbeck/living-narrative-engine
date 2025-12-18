# Sense-Aware Perception System

## Overview

The sense-aware perception system allows events to be filtered and adapted based on:
- **Recipient sensory capabilities** (eyes, ears, nose status from anatomy)
- **Environmental conditions** (lighting)
- **Perception type** (visual, auditory, etc.)

This creates more immersive gameplay where characters in darkness or with damaged senses receive appropriate descriptions rather than impossible perceptions.

## Sensory Affordance Components

Sensory capability is determined by the presence of affordance marker components on functioning anatomy parts (not by `anatomy:part.subType` naming).

Body parts that provide sensory capabilities must include the appropriate marker component:

- `anatomy:provides_sight` - Enables visual perception
- `anatomy:provides_hearing` - Enables auditory perception
- `anatomy:provides_smell` - Enables olfactory perception

### Adding Sensory Affordances to Custom Body Parts

When creating custom sensory organs, add the appropriate affordance component to the part definition:

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "my-mod:crystal_eye",
  "description": "A crystalline eye that grants vision",
  "components": {
    "anatomy:part": {
      "subType": "crystal_eye",
      "hit_probability_weight": 0.5,
      "health_calculation_weight": 2
    },
    "anatomy:part_health": {
      "currentHealth": 10,
      "maxHealth": 10,
      "state": "healthy"
    },
    "anatomy:provides_sight": {}
  }
}
```

### Multi-Sensory Organs

Multiple affordances can be added to a single part for multi-sensory organs:

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "my-mod:sensory_tentacle",
  "description": "A tentacle covered in sensory nodules",
  "components": {
    "anatomy:part": {
      "subType": "tentacle",
      "hit_probability_weight": 0.3,
      "health_calculation_weight": 2
    },
    "anatomy:part_health": {
      "currentHealth": 10,
      "maxHealth": 10,
      "state": "healthy"
    },
    "anatomy:provides_sight": {},
    "anatomy:provides_smell": {}
  }
}
```

### Important Notes

- The `subType` value in `anatomy:part` can be any descriptive string
- Sensory capability is determined by the presence of affordance components, not by `subType` name
- A body part is considered functioning if it is not destroyed (`anatomy:part_health.state !== 'destroyed'`) and not dismembered (`anatomy:dismembered` absent)
- Manual override via `perception:sensory_capability` takes precedence (see “Manual Sensory Override” below)

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
    "actor_description": "I bend over {context.surfaceName}, lowering my upper body.",
    "perception_type": "physical.self_action",
    "actor_id": "{event.payload.actorId}",
    "target_id": "{event.payload.targetId}",
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

## Perspective-Aware Descriptions (Actor & Target)

### Problem

When an actor performs an action, they receive the same third-person, sense-filtered message as all other observers. This creates immersion-breaking experiences:

**Example:**
- Action: Alice does a handstand
- Environment: Room is in darkness
- **Current behavior**: Alice receives "You hear sounds of exertion nearby" (auditory fallback)
- **Expected behavior**: Alice receives "I do a handstand, balancing upside-down." (she knows what she's doing)

### Solution

Two optional parameters allow perspective-aware messaging:

| Parameter | Delivered To | Sensory Filtering | Example |
|-----------|--------------|-------------------|---------|
| `actor_description` | Actor | No (actor knows what they're doing) | "I do a handstand." |
| `target_description` | Target | Yes (target may not see who) | "Someone touches my shoulder." |
| `description_text` | All others | Yes | "Alice does a handstand." |

### Basic Example: Self-Action

```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.actorName} does a handstand.",
    "actor_description": "I do a handstand, balancing upside-down.",
    "perception_type": "physical.self_action",
    "actor_id": "{event.payload.actorId}",
    "alternate_descriptions": {
      "auditory": "I hear sounds of exertion nearby."
    }
  }
}
```

### Example with Target

```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.actorName} caresses {context.targetName}'s cheek.",
    "actor_description": "I caress {context.targetName}'s cheek gently.",
    "target_description": "{context.actorName} caresses my cheek gently.",
    "perception_type": "social.affection",
    "actor_id": "{event.payload.actorId}",
    "target_id": "{event.payload.targetId}",
    "alternate_descriptions": {
      "auditory": "I hear a soft rustling sound nearby.",
      "tactile": "I feel a gentle touch."
    }
  }
}
```

### Edge Cases

- **Actor in darkness**: Still receives `actor_description` (they know what they're doing)
- **Target in darkness**: Receives filtered `target_description` (may fall back to tactile)
- **Actor = Target**: `actor_description` takes precedence
- **Target is an object**: Warning logged, `target_description` ignored

### Migration from Dual-Dispatch

If you previously used two operations to deliver different messages to actors and observers, you can simplify to a single operation.

**Before (verbose, two operations):**
```json
[
  {
    "type": "DISPATCH_PERCEPTIBLE_EVENT",
    "parameters": {
      "location_id": "{context.actorPosition.locationId}",
      "description_text": "{context.actorName} drinks from {context.containerName}.",
      "perception_type": "consumption.consume",
      "actor_id": "{event.payload.actorId}",
      "contextual_data": { "excludedActorIds": ["{event.payload.actorId}"] }
    }
  },
  {
    "type": "DISPATCH_PERCEPTIBLE_EVENT",
    "parameters": {
      "location_id": "{context.actorPosition.locationId}",
      "description_text": "I drink from {context.containerName}. The liquid tastes bitter.",
      "perception_type": "consumption.consume",
      "actor_id": "{event.payload.actorId}",
      "contextual_data": { "recipientIds": ["{event.payload.actorId}"] }
    }
  }
]
```

**After (single operation):**
```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.actorName} drinks from {context.containerName}.",
    "actor_description": "I drink from {context.containerName}. The liquid tastes bitter.",
    "perception_type": "consumption.consume",
    "actor_id": "{event.payload.actorId}"
  }
}
```

### Debugging Tips

- Actor's perception log entries will have `perceivedVia: "self"` for easy identification
- Check browser console for warnings about targets without perception logs

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

## Rule Pattern Quick Reference

When upgrading rules to the perspective-aware system, use the appropriate pattern based on your rule type:

| Rule Type | Pattern | actor_description | target_description | alternate_descriptions |
|-----------|---------|-------------------|--------------------|-----------------------|
| Actor-to-Actor | Full | ✅ Required | ✅ Required | ✅ Required |
| Self-Action | Self | ✅ Required | ❌ N/A | ✅ Required |
| Object Interaction | Object | ✅ Required | ❌ N/A | ✅ Required |

### Pattern A: Actor-to-Actor Action

Use for: physical-control, social actions, first-aid on others, item transfer between actors.

**Real Example (from handle_restrain_target.rule.json):**

```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.actorName} restrains {context.targetName}, preventing them from moving freely.",
    "actor_description": "I restrain {context.targetName}, preventing them from moving freely.",
    "target_description": "{context.actorName} restrains me, preventing me from moving freely.",
    "perception_type": "physical.target_action",
    "actor_id": "{event.payload.actorId}",
    "target_id": "{event.payload.targetId}",
    "alternate_descriptions": {
      "auditory": "I hear the sounds of a struggle nearby.",
      "tactile": "I feel the vibrations of scuffling nearby."
    }
  }
}
```

### Pattern B: Self-Action

Use for: movement, positioning, self-treatment, speech, thought.

**Real Example (from entity_speech.rule.json):**

```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.speakerPositionComponent.locationId}",
    "description_text": "{context.speakerNameComponent.text} says: \"{event.payload.speechContent}\"",
    "actor_description": "I say: \"{event.payload.speechContent}\"",
    "perception_type": "communication.speech",
    "actor_id": "{event.payload.entityId}",
    "target_id": null,
    "alternate_descriptions": {
      "auditory": "{context.speakerNameComponent.text} speaks, but I cannot make out the words.",
      "limited": "I sense someone speaking nearby."
    }
  }
}
```

### Pattern C: Object Interaction

Use for: containers, items, writing, locks, observation.

**Real Example (from handle_drink_entirely.rule.json):**

```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.actorName} drinks entirely from {context.containerName}, emptying it.",
    "actor_description": "I drink entirely from {context.containerName}, draining it completely. {context.drinkResult.flavorText}",
    "perception_type": "consumption.consume",
    "actor_id": "{event.payload.actorId}",
    "target_id": "{event.payload.targetId}",
    "alternate_descriptions": {
      "auditory": "I hear someone drinking nearby, finishing a beverage."
    }
  }
}
```

## Alternate Description Guidelines

When choosing which `alternate_descriptions` to include, consider the sensory reality of the action:

| Fallback Type | When to Use | Example Scenarios |
|---------------|-------------|-------------------|
| `auditory` | Action produces sound | Speech, movement, physical struggle, drinking, opening containers |
| `tactile` | Action produces vibration or can be felt | Heavy footsteps, falling, physical combat, nearby explosions |
| `olfactory` | Action produces smell | Food, drinks, chemicals, fire, decay |
| `limited` | Partial perception fallback | Speech (sensing someone talks but not words), presence detection |
| `telepathic` | Mind-sensing fallback | Thoughts, supernatural communication |

**Guidelines:**
- **auditory** is the most common fallback (most actions make some sound)
- **tactile** is appropriate for physical actions with impact
- **olfactory** is rare but appropriate for food, drinks, chemicals
- **limited** is useful for communication when auditory fails
- Only include fallbacks that realistically apply to the action

## Testing Upgraded Rules

### Event Payload Contract

When writing tests for rules with `DISPATCH_PERCEPTIBLE_EVENT`, all parameters (including perspective-aware and sense-aware ones) are included in the broadcast event payload. The payload contains both the standard fields and the sense-aware/perspective-aware fields.

**Important**: The `DISPATCH_PERCEPTIBLE_EVENT` operation dispatches `core:perceptible_event`, which is then picked up by `log_perceptible_events.rule.json` to add entries to perception logs via `ADD_PERCEPTION_LOG_ENTRY`. All perceptible events are automatically logged - there is no need for any "log_entry" flag.

#### What Appears in Event Payload

| Rule Parameter | Payload Field | Notes |
|----------------|---------------|-------|
| `location_id` | `locationId` | Required |
| `description_text` | `descriptionText` | Third-person for observers |
| `perception_type` | `perceptionType` | Validated against registry |
| `actor_id` | `actorId` | Required |
| `target_id` | `targetId` | Optional, defaults to `null` |
| `involved_entities` | `involvedEntities` | Optional array |
| `contextual_data.*` | `contextualData.*` | Custom data passed through |
| `actor_description` | `actorDescription` | First-person for actor, or `null` |
| `target_description` | `targetDescription` | Second-person for target, or `null` |
| `alternate_descriptions` | `alternateDescriptions` | Fallback descriptions object, or `null` |
| `sense_aware` | `senseAware` | Boolean, defaults to `true` |

#### Correct Test Assertions

```javascript
// ✅ CORRECT - Validate standard payload fields
expect(perceptibleEvent.payload.descriptionText).toBe('Alice reads the letter.');
expect(perceptibleEvent.payload.actorId).toBe('test:actor1');
expect(perceptibleEvent.payload.targetId).toBe('letter-1');
expect(perceptibleEvent.payload.perceptionType).toBe('item.examine');
expect(perceptibleEvent.payload.locationId).toBe('study');

// ✅ CORRECT - Check custom contextual data (if any was passed)
expect(perceptibleEvent.payload.contextualData.readableText).toBe('Secret content');

// ✅ CORRECT - Validate perspective-aware fields
expect(perceptibleEvent.payload.actorDescription).toBe('I read the letter carefully.');
expect(perceptibleEvent.payload.targetDescription).toBeNull(); // Letter is an object, not an actor

// ✅ CORRECT - Validate sense-aware fields
expect(perceptibleEvent.payload.senseAware).toBe(true);
expect(perceptibleEvent.payload.alternateDescriptions).toEqual({
  auditory: 'I hear the rustle of paper nearby.'
});
```

#### What You CAN Test

1. **All payload fields** - Standard fields plus perspective-aware and sense-aware fields
2. **Rule behavior** - Component changes, state updates, turn handling
3. **Event dispatch** - That the event was dispatched with correct type
4. **Custom contextual data** - Any fields you pass in `contextual_data`
5. **Perspective descriptions** - `actorDescription`, `targetDescription` values
6. **Sense-aware configuration** - `senseAware` and `alternateDescriptions` values

#### What Requires Separate Testing

1. **Actual sense-aware filtering behavior** - The filtering logic that determines which description a recipient receives based on their sensory capabilities. This is handled by the perception system after the event is dispatched.
2. **Perception log entry content** - The actual log entries written to each recipient's perception log, which may differ based on sense filtering.
