# Actor vs Observer Perception Messaging

## Status: Draft
## Created: 2025-12-17
## Author: Claude (AI-assisted specification)

---

## 1. Problem Statement

### Current Behavior

When an actor performs an action, they receive the same third-person, sense-filtered message as all other observers in the location. This creates an immersion-breaking experience where actors appear unaware of their own actions.

**Example scenario:**

- **Action**: Alice does a handstand
- **Environment**: Room is in darkness
- **Current result for Alice**: "You hear sounds of exertion and shuffling nearby" (auditory fallback)
- **Current result for observers**: "You hear sounds of exertion and shuffling nearby" (same message)

Alice receives a message suggesting she doesn't know she's performing a handstand. This is logically incorrect - Alice knows she's performing the action regardless of environmental lighting.

### Expected Behavior

- **Alice (actor)**: "I do a handstand, balancing upside-down." (first-person, no sensory filtering)
- **Bob (observer, can see)**: "Alice does a handstand." (third-person, visual)
- **Carol (observer, can't see)**: "I hear sounds of exertion nearby." (first-person, auditory fallback)

### Existing Workaround

Some mod rules currently work around this limitation by dispatching two separate events:

```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "comment": "Message for observers (excludes actor)",
  "parameters": {
    "description_text": "Alice drinks from the flask.",
    "contextual_data": {
      "excludedActorIds": ["{event.payload.actorId}"]
    }
  }
},
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "comment": "Message for actor only (first-person)",
  "parameters": {
    "description_text": "I drink from the flask. The liquid tastes bitter.",
    "contextual_data": {
      "recipientIds": ["{event.payload.actorId}"]
    }
  }
}
```

**Problems with this workaround:**

1. **Verbose**: Requires two operations for every action
2. **Error-prone**: Easy to misconfigure `excludedActorIds`/`recipientIds`
3. **Inconsistent**: Most rules don't implement it, leading to mixed experiences
4. **No target perspective**: Cannot easily provide target-specific messages

### Existing Examples Using Workaround

| Rule File | Pattern Used |
|-----------|--------------|
| `data/mods/items/rules/handle_drink_from.rule.json` | Public (excludes actor) + Private (actor only with flavor) |
| `data/mods/hexing/rules/handle_corrupting_gaze.rule.json` | Observer message + Target first-person sensation |

---

## 2. Proposed Solution

### Overview

Add two new optional parameters to `DISPATCH_PERCEPTIBLE_EVENT`:

| Parameter | Purpose | Sensory Filtering |
|-----------|---------|-------------------|
| `actor_description` | First-person message for the actor | **No** (actor knows what they're doing) |
| `target_description` | Second-person message for the target | Yes (target may not see who's acting) |

When these parameters are provided:
- **Actor** receives `actor_description` without sensory filtering
- **Target** receives `target_description` with sensory filtering applied
- **All other observers** receive `description_text` with sensory filtering applied

### Schema Definition

**File**: `data/schemas/operations/dispatchPerceptibleEvent.schema.json`

```json
{
  "actor_description": {
    "type": "string",
    "minLength": 1,
    "description": "First-person description delivered to the actor (e.g., 'I do a handstand'). When provided, the actor receives this message without sensory filtering - they always know what they're doing."
  },
  "target_description": {
    "type": "string",
    "minLength": 1,
    "description": "First-person description delivered to the target (e.g., 'Someone caresses my cheek gently.'). When provided, the target receives this message. Sensory filtering still applies. Note: Only provide if target is an entity with a perception log component - a warning is emitted if target lacks this component."
  }
}
```

### Message Routing Logic

```
For each recipient in location:
  IF recipient == actor AND actor_description provided:
    → Deliver actor_description (no filtering)
    → Set perceivedVia = "self"

  ELSE IF recipient == target AND target_description provided:
    → Apply sensory filtering to target_description
    → Deliver filtered result (or silent filter if can't perceive)

  ELSE:
    → Apply sensory filtering to description_text
    → Deliver filtered result (or silent filter if can't perceive)
```

### Handler Modifications Required

**File**: `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js`

1. Extract new parameters: `actor_description`, `target_description`
2. Pass them to `addPerceptionLogEntryHandler.execute()`

**File**: `src/logic/operationHandlers/addPerceptionLogEntryHandler.js`

1. Accept new parameters: `actor_description`, `target_description`, `target_id`
2. In recipient loop, check if recipient matches actor or target
3. Route appropriate description based on match
4. Skip sensory filtering for actor's description
5. Set `perceivedVia: "self"` for actor entries

---

## 3. JSON Examples for Mod Authors

### Basic Self-Action

```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.actorName} does a handstand.",
    "actor_description": "I do a handstand, balancing upside-down.",
    "perception_type": "physical.self_action",
    "actor_id": "{event.payload.actorId}",
    "log_entry": true,
    "alternate_descriptions": {
      "auditory": "I hear sounds of exertion and shuffling nearby."
    }
  }
}
```

**Results:**
- Actor: "I do a handstand, balancing upside-down."
- Sighted observers: "Alice does a handstand."
- Blind observers: "I hear sounds of exertion and shuffling nearby."

### Action with Target

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
    "log_entry": true,
    "alternate_descriptions": {
      "auditory": "I hear a soft rustling sound nearby.",
      "tactile": "I sense gentle movement nearby."
    }
  }
}
```

**Results:**
- Actor: "I caress Bob's cheek gently."
- Target: "Alice caresses my cheek gently." (or "I sense gentle movement nearby." if blind)
- Other observers: "Alice caresses Bob's cheek." (or "I hear a soft rustling sound nearby." if blind)

### Drinking with Flavor (Replaces Dual-Dispatch)

**Before (current workaround):**
```json
[
  {
    "type": "DISPATCH_PERCEPTIBLE_EVENT",
    "parameters": {
      "description_text": "{context.actorName} drinks from {context.containerName}.",
      "contextual_data": { "excludedActorIds": ["{event.payload.actorId}"] }
    }
  },
  {
    "type": "DISPATCH_PERCEPTIBLE_EVENT",
    "parameters": {
      "description_text": "I drink from {context.containerName}. {context.drinkResult.flavorText}",
      "contextual_data": { "recipientIds": ["{event.payload.actorId}"] }
    }
  }
]
```

**After (single dispatch):**
```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.actorName} drinks from {context.containerName}.",
    "actor_description": "I drink from {context.containerName}. {context.drinkResult.flavorText}",
    "perception_type": "consumption.consume",
    "actor_id": "{event.payload.actorId}",
    "target_id": "{event.payload.targetId}",
    "log_entry": true,
    "alternate_descriptions": {
      "auditory": "I hear gulping sounds nearby."
    }
  }
}
```

### Magic Spell on Target

```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{context.actorPosition.locationId}",
    "description_text": "{context.actorName} looks deeply into {context.targetName}'s eyes, casting a corrupting gaze. {context.targetName} shudders as darkness seeps into them.",
    "actor_description": "I cast a corrupting gaze upon {context.targetName}. Power flows through me.",
    "target_description": "{context.actorName} looks deeply into my eyes. Darkness floods through me as a sickly warmth fills my body.",
    "perception_type": "magic.spell",
    "actor_id": "{event.payload.actorId}",
    "target_id": "{event.payload.primaryId}",
    "log_entry": true,
    "alternate_descriptions": {
      "auditory": "I hear a faint humming and feel a chill in the air.",
      "tactile": "I feel a wave of supernatural cold pass through the area."
    }
  }
}
```

---

## 4. Edge Cases

### 4.1 Actor is Also the Target

**Scenario**: Self-examination action where `actor_id === target_id`

**Resolution**: `actor_description` takes precedence over `target_description`

```json
{
  "description_text": "{context.actorName} examines their own hands.",
  "actor_description": "I examine my hands carefully.",
  "target_description": "{context.actorName} examines my hands."  // Ignored when actor == target
}
```

### 4.2 Actor Description in Darkness

**Scenario**: Actor performs action in complete darkness

**Resolution**: Actor still receives `actor_description` unchanged. Sensory filtering is intentionally bypassed because the actor knows what they're doing regardless of lighting.

### 4.3 Target Description in Darkness

**Scenario**: Target is in darkness and cannot see who is touching them

**Resolution**: Sensory filtering IS applied to `target_description`. If no fallback matches, target may receive "limited" fallback or be silently filtered.

**Example**:
- Primary message: "Alice caresses my cheek."
- In darkness with auditory fallback: "Someone caresses my cheek." (if tactile fallback defined)
- Without fallback: Silent filter (target doesn't perceive)

### 4.4 Missing Parameters (Backward Compatibility)

| Scenario | Behavior |
|----------|----------|
| No `actor_description` | Actor receives `description_text` with sensory filtering (current behavior) |
| No `target_description` | Target receives `description_text` with sensory filtering (current behavior) |
| Both missing | Exact current behavior preserved |

### 4.5 Actor Not in Location

**Scenario**: Actor performs action but is not in the specified `location_id`

**Resolution**: Actor won't be in recipient list, so `actor_description` is not delivered. This is expected behavior - the dispatch location determines recipients.

### 4.6 `log_entry: false`

**Scenario**: Event dispatched without logging

**Resolution**:
- `actor_description` included in event payload
- UI components can use it for immediate display
- Perception log not modified

### 4.7 Target Without Perception Log Component

**Scenario**: Modder provides `target_description` but target is an object (tool, item, furniture) without a perception log component.

**Resolution**: Handler emits a warning to help modders catch potential configuration errors.

**Warning example**:
```
[WARN] target_description provided for entity 'items:rusty_sword' but entity lacks perception log component.
       The target_description will be ignored. If this target should receive messages, ensure it has
       the 'core:perception_log' component. If the target is intentionally an object, consider removing
       the target_description parameter.
```

**Rationale**: In most cases, if a modder sets `target_description`, they expect the target to receive it. Objects like tools or items cannot "perceive" messages, so this is likely an oversight in the rule configuration.

---

## 5. Alternative Approaches Considered

### 5.1 Auto-Transform Third-Person to First-Person

**Approach**: Automatically convert "Alice does X" to "I do X" for actors.

**Rejected because**:
- English grammar transformations are complex (I/me/my, verb conjugation)
- Would not work for internationalization
- Cannot add actor-specific details (like flavor text)
- Mod authors lose control over wording

### 5.2 New Perception Type: `proprioceptive.self_action`

**Approach**: Create a new perception type that inherits proprioceptive behavior (actor-only delivery) but has visual-style CSS.

**Rejected because**:
- Requires changing `perception_type` per-rule
- Conflates two concerns (audience vs sensory channel)
- CSS styling would be inconsistent
- Does not solve target perspective problem

### 5.3 Separate Operation Type

**Approach**: Create `DISPATCH_MULTI_PERSPECTIVE_EVENT` operation.

**Rejected because**:
- Duplicates functionality with existing operation
- Requires mod authors to learn new operation
- Not backward compatible
- More complex schema to maintain

### 5.4 Perspective Templates

**Approach**: Define `{perspective.actor}` and `{perspective.observer}` placeholders in templates.

**Rejected because**:
- Requires significant template system changes
- Less explicit than separate parameters
- Harder to validate at schema level
- Complex placeholder resolution

### 5.5 Keep Dual-Dispatch Pattern

**Approach**: Document current workaround as the standard pattern.

**Rejected because**:
- Verbose (two operations per action)
- Error-prone (easy to misconfigure)
- Most rules don't implement it
- Does not solve the problem, just works around it

---

## 6. Implementation Checklist

### Schema Changes

- [ ] Update `data/schemas/operations/dispatchPerceptibleEvent.schema.json`
  - Add `actor_description` parameter
  - Add `target_description` parameter
- [ ] Update `data/schemas/operations/addPerceptionLogEntry.schema.json`
  - Add pass-through parameters

### Handler Changes

- [ ] Modify `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js`
  - Extract new parameters
  - Pass to log handler
- [ ] Modify `src/logic/operationHandlers/addPerceptionLogEntryHandler.js`
  - Accept new parameters
  - Implement actor/target routing logic
  - Bypass filtering for actor description
  - Set `perceivedVia: "self"` metadata

### Documentation

- [ ] Update `docs/modding/sense-aware-perception.md`
  - Document new parameters
  - Add examples
  - Migration section

### Testing

- [ ] Unit tests for `addPerceptionLogEntryHandler` routing logic
- [ ] Unit tests for edge cases (actor=target, missing params)
- [ ] Integration tests for full dispatch flow
- [ ] Backward compatibility tests

### Migration (Optional)

- [ ] Update `data/mods/items/rules/handle_drink_from.rule.json` to use new pattern
- [ ] Update `data/mods/hexing/rules/handle_corrupting_gaze.rule.json` to use new pattern

---

## 7. Files to Modify (Implementation Reference)

| File | Change Type | Description |
|------|-------------|-------------|
| `data/schemas/operations/dispatchPerceptibleEvent.schema.json` | Schema | Add `actor_description`, `target_description` |
| `data/schemas/operations/addPerceptionLogEntry.schema.json` | Schema | Add pass-through parameters |
| `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js` | Logic | Pass new params to log handler |
| `src/logic/operationHandlers/addPerceptionLogEntryHandler.js` | Logic | Routing based on recipient role |
| `docs/modding/sense-aware-perception.md` | Docs | Document new parameters |
| `src/utils/preValidationUtils.js` | Validation | May need whitelist updates |

---

## 8. Acceptance Criteria

1. **Actor receives first-person message**: When `actor_description` is provided, actor sees that message without sensory filtering
2. **Target receives first-person message**: When `target_description` is provided, target sees that message (first-person, as the recipient experiencing the action) with appropriate sensory filtering
3. **Observers receive third-person message**: All other recipients see `description_text` with sensory filtering (but auditory/tactile fallbacks are first-person, e.g., "I hear...")
4. **Backward compatible**: Rules without new parameters work identically to current behavior
5. **Metadata tracking**: Actor perception entries include `perceivedVia: "self"` for debugging
6. **Warning for invalid targets**: When `target_description` is provided but target entity lacks perception log component, emit a helpful warning
7. **Documentation complete**: Mod authors have clear examples and migration guide
