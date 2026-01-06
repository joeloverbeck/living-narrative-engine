# Expressions System - Brainstorming Document

## Executive Summary

This document explores the design for a new **Expressions System** - a modular content category that automatically generates narrative perception log entries when an actor's emotional or sexual state changes. Expressions will be moddable JSON files loaded at game startup, evaluated after LLM responses that modify mood/sexual state, and dispatched through the existing sense-aware perception system.

---

## 1. System Context Analysis

### 1.1 Prerequisites System (Reference Implementation)

The action prerequisites system provides the architectural foundation for expression evaluation:

**Key Components:**
- `PrerequisiteEvaluationService` (`src/actions/validation/prerequisiteEvaluationService.js`)
- `ActionValidationContextBuilder` (`src/actions/validation/actionValidationContextBuilder.js`)
- `JsonLogicEvaluationService` (`src/logic/jsonLogicEvaluationService.js`)
- `conditionRefResolver` (`src/utils/conditionRefResolver.js`)

**Pattern Flow:**
```
Prerequisites Array → Condition Reference Resolution → Context Building → JSON Logic Evaluation → Boolean Result
```

**Context Structure Available:**
```javascript
{
  actor: {
    id: "entity_id",
    components: Proxy {
      // Lazy-loaded component access
      // Access: actor.components["namespace:component_name"]
    }
  }
}
```

**Supported JSON Logic:**
- Standard operators: `!!`, `==`, `>`, `<`, `>=`, `<=`, `and`, `or`, `not`
- Variable access: `{"var": "actor.components.core:mood.valence"}`
- Custom operators: `hasFreeGrabbingAppendages`, `hasComponent`, `isRemovalBlocked`, etc.
- Condition references: `{"condition_ref": "anatomy:actor-has-two-free-grabbing-appendages"}`

### 1.2 Emotional State Calculation System

**Core Service:** `EmotionCalculatorService` (`src/emotions/emotionCalculatorService.js`)

**Input Data:**
- Mood component (`core:mood`) - 7 axes ranging -100 to +100:
  - valence, arousal, agency_control, threat, engagement, future_expectancy, self_evaluation
- Sexual state component (`core:sexual_state`) - 3 values:
  - sex_excitation (0-100), sex_inhibition (0-100), baseline_libido (-50 to +50)

**Calculation Flow:**
```
Raw Mood Axes → Normalize to [-1, 1] → Prototype Gate Evaluation → Weighted Sum → Intensity [0, 1]
```

**Calculated Outputs:**
- `emotionalStateText`: "joy: strong, curiosity: moderate, anxiety: mild"
- `sexualStateText`: "sexual_lust: strong, romantic_yearning: moderate"
- `sexual_arousal`: Calculated as `(excitation - inhibition + baseline) / 100`, clamped to [0, 1]

**Intensity Levels (10-scale):**
- absent (0-0.05), faint, slight, mild, noticeable, moderate (0.45-0.55), strong, intense, powerful, overwhelming, extreme (0.95-1.0)

### 1.3 Lookup System Structure

**Files:**
- `data/mods/core/lookups/emotion_prototypes.lookup.json` - 40 emotions with weights/gates
- `data/mods/core/lookups/sexual_prototypes.lookup.json` - 13 sexual states with weights/gates

**Prototype Structure:**
```json
{
  "joy": {
    "weights": { "valence": 1.0, "arousal": 0.5, "future_expectancy": 0.3 },
    "gates": ["valence >= 0.35"]
  }
}
```

### 1.4 Mod Loading System

**Single Source of Truth:** `src/loaders/loaderMeta.js`

**Required Steps for New Content Category:**
1. Add entry to `loaderMeta.js`
2. Create schema in `data/schemas/`
3. Create loader class extending `BaseManifestItemLoader`
4. Register DI token and factory
5. Update manifest scanner in `scripts/updateManifest.js`

**Existing Pattern Example:**
```javascript
// In loaderMeta.js
anatomyFormatting: {
  contentKey: 'anatomyFormatting',
  diskFolder: 'anatomy-formatting',
  phase: 'definitions',
  registryKey: 'anatomyFormatting',
}
```

### 1.5 Sense-Aware Perception System

**Key Operation:** `DISPATCH_PERCEPTIBLE_EVENT`

**Handler:** `src/logic/operationHandlers/dispatchPerceptibleEventHandler.js`

**Parameters Supporting Expressions:**
```json
{
  "type": "DISPATCH_PERCEPTIBLE_EVENT",
  "parameters": {
    "location_id": "{locationId}",
    "description_text": "Third-person for observers",
    "actor_description": "First-person for actor (I feel...)",
    "perception_type": "emotion.expression",
    "actor_id": "{actorId}",
    "alternate_descriptions": {
      "auditory": "You hear a sharp intake of breath nearby."
    }
  }
}
```

**Perception Types (existing relevant):**
- `communication.speech` - auditory primary
- `physical.self_action` - visual primary with auditory fallback
- `intimacy.sensual` - tactile primary

---

## 2. Requirements Analysis

### 2.1 Core Requirements

1. **Modular Expression Files**: One expression per `.expression.json` file in `data/mods/*/expressions/`
2. **Schema Validation**: JSON Schema for validation and IDE support
3. **Prerequisites Support**: Full JSON Logic evaluation with condition references
4. **Priority System**: Priority [0-100] for conflict resolution (highest wins)
5. **Perception Integration**: Dispatch via existing sense-aware perception system
6. **Trigger Timing**: Evaluate after LLM response when mood/sexual state changes

### 2.2 Expression Content Requirements

**Per Actor's Perspective:**
- `actor_description`: First-person internal monologue
  - Example: "Heat floods my face. I want to do something right now—break the stalemate, make the world stop pushing back."

**For Other Observers:**
- `description_text`: Third-person observable behavior
  - Example: "{actor}'s jaw locks and their movements get sharp and purposeful, like they're done asking and started acting."

**Alternate Sensory Fallbacks:**
- `auditory`: Sound-based perception
- `tactile`: Touch/vibration based
- `olfactory`: Smell based (rare but possible for stress sweat, etc.)

### 2.3 Evaluation Requirements

**Prerequisites Access:**
- All calculated emotions with intensities (from `EmotionCalculatorService`)
- All calculated sexual states with intensities
- Raw mood axes (valence, arousal, etc.)
- Sexual arousal value
- Existing component access (anatomy, position, clothing, etc.)

**Example Prerequisite:**
```json
{
  "logic": {
    "and": [
      {">=": [{"var": "emotions.sadness"}, 0.60]},
      {">=": [{"var": "emotions.despair"}, 0.70]}
    ]
  }
}
```

---

## 3. Proposed Expression Schema

### 3.1 Schema Definition

**File:** `data/schemas/expression.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "schema://living-narrative-engine/expression.schema.json",
  "title": "Expression Definition",
  "description": "Defines an emotional/sexual state expression with prerequisites and perception messages",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "pattern": "^[a-z0-9_-]+:[a-z0-9_-]+$",
      "description": "Unique identifier in format 'modId:expressionId'"
    },
    "description": {
      "type": "string",
      "description": "Human-readable description of when this expression triggers"
    },
    "priority": {
      "type": "integer",
      "minimum": 0,
      "maximum": 100,
      "default": 50,
      "description": "Higher priority expressions take precedence when multiple match"
    },
    "prerequisites": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "logic": {
            "type": "object",
            "description": "JSON Logic expression (supports condition_ref)"
          }
        },
        "required": ["logic"]
      },
      "description": "All prerequisites must pass for expression to activate"
    },
    "actor_description": {
      "type": "string",
      "description": "First-person internal monologue for the actor experiencing this state"
    },
    "description_text": {
      "type": "string",
      "description": "Third-person description of observable behavior for other actors"
    },
    "alternate_descriptions": {
      "type": "object",
      "properties": {
        "auditory": { "type": "string" },
        "tactile": { "type": "string" },
        "olfactory": { "type": "string" },
        "limited": { "type": "string" }
      },
      "additionalProperties": false,
      "description": "Fallback descriptions for different sensory modes"
    },
    "perception_type": {
      "type": "string",
      "default": "emotion.expression",
      "description": "Perception type for sense-aware filtering"
    },
    "tags": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Optional tags for categorization (e.g., 'anger', 'sadness', 'arousal')"
    }
  },
  "required": ["id", "priority", "prerequisites", "actor_description", "description_text"],
  "additionalProperties": false
}
```

### 3.2 Example Expression Files

**File:** `data/mods/core/expressions/suppressed_rage.expression.json`
```json
{
  "id": "core:suppressed_rage",
  "description": "Activated when actor feels intense anger with suppressed agency",
  "priority": 75,
  "prerequisites": [
    {
      "logic": {
        "and": [
          {">=": [{"var": "emotions.anger"}, 0.65]},
          {"<=": [{"var": "moodAxes.agency_control"}, -30]}
        ]
      }
    }
  ],
  "actor_description": "Heat floods my face. I want to do something right now—break the stalemate, make the world stop pushing back.",
  "description_text": "{actor}'s jaw locks and their movements get sharp and purposeful, like they're done asking and started acting.",
  "alternate_descriptions": {
    "auditory": "You hear a sharp intake of breath and the creak of tension nearby."
  },
  "tags": ["anger", "frustration", "suppression"]
}
```

**File:** `data/mods/core/expressions/deep_despair.expression.json`
```json
{
  "id": "core:deep_despair",
  "description": "Profound hopelessness and grief overwhelming the actor",
  "priority": 80,
  "prerequisites": [
    {
      "logic": {
        "and": [
          {">=": [{"var": "emotions.despair"}, 0.70]},
          {">=": [{"var": "emotions.sadness"}, 0.60]},
          {"<=": [{"var": "moodAxes.future_expectancy"}, -50]}
        ]
      }
    }
  ],
  "actor_description": "Everything feels hollow. The weight in my chest won't lift, and I can't remember the last time anything seemed worth trying.",
  "description_text": "{actor}'s shoulders slump as if carrying an invisible burden, their gaze unfocused and distant.",
  "alternate_descriptions": {
    "auditory": "You hear a shaky, uneven breath from nearby."
  },
  "tags": ["sadness", "despair", "hopelessness"]
}
```

**File:** `data/mods/core/expressions/aroused_anticipation.expression.json`
```json
{
  "id": "core:aroused_anticipation",
  "description": "Sexual arousal combined with positive anticipation",
  "priority": 65,
  "prerequisites": [
    {
      "logic": {
        "and": [
          {">=": [{"var": "sexualStates.sexual_lust"}, 0.50]},
          {">=": [{"var": "emotions.anticipation"}, 0.40]},
          {">=": [{"var": "sexualArousal"}, 0.40]}
        ]
      }
    }
  ],
  "actor_description": "My skin prickles with awareness. Every nerve feels alive, waiting for what comes next.",
  "description_text": "{actor}'s breathing quickens subtly, their posture shifting with restless energy.",
  "alternate_descriptions": {
    "auditory": "You hear someone's breathing grow deeper and more deliberate nearby.",
    "olfactory": "A faint warmth and musk drifts from nearby."
  },
  "tags": ["arousal", "anticipation", "desire"]
}
```

---

## 4. Architecture Design

### 4.1 System Components

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Expression System                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │ ExpressionLoader │───▶│ ExpressionRegistry│───▶│ ExpressionEvaluator│
│  │   (loaders/)     │    │   (registries/)   │    │   (expressions/)  │  │
│  └──────────────────┘    └──────────────────┘    └────────┬─────────┘  │
│                                                            │            │
│                                                            ▼            │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐  │
│  │EmotionCalculator │───▶│ExpressionContext │───▶│DispatchPerceptible│
│  │   Service        │    │    Builder       │    │   EventHandler   │  │
│  └──────────────────┘    └──────────────────┘    └──────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 New Files Required

**Loaders:**
- `src/loaders/expressionLoader.js` - Load expression files from mods

**Services:**
- `src/expressions/expressionRegistry.js` - Store loaded expressions
- `src/expressions/expressionEvaluatorService.js` - Evaluate prerequisites, select highest priority
- `src/expressions/expressionContextBuilder.js` - Build evaluation context with emotions/sexual states
- `src/expressions/expressionDispatcher.js` - Coordinate triggering and dispatch

**Schema:**
- `data/schemas/expression.schema.json` - Validation schema

**DI Registration:**
- Add tokens to `src/dependencyInjection/tokens/tokens-core.js`
- Add registrations to appropriate registration files

**Manifest Support:**
- Update `src/loaders/loaderMeta.js`
- Update `scripts/updateManifest.js`

### 4.3 Expression Context Structure

```javascript
{
  // Actor reference (existing pattern)
  actor: {
    id: "entity_id",
    components: Proxy { /* lazy component access */ }
  },

  // Calculated emotions (NEW - from EmotionCalculatorService)
  emotions: {
    joy: 0.45,           // intensity [0, 1]
    sadness: 0.10,
    anger: 0.72,
    fear: 0.05,
    // ... all 40+ emotions
  },

  // Calculated sexual states (NEW)
  sexualStates: {
    sexual_lust: 0.60,
    romantic_yearning: 0.25,
    // ... all 13 sexual states
  },

  // Raw mood axes (for direct comparisons)
  moodAxes: {
    valence: -25,          // [-100, 100]
    arousal: 45,
    agency_control: -60,
    threat: 20,
    engagement: 30,
    future_expectancy: -40,
    self_evaluation: -15
  },

  // Calculated sexual arousal
  sexualArousal: 0.40,     // [0, 1]

  // Previous state (for comparison)
  previousEmotions: { /* same structure */ },
  previousSexualStates: { /* same structure */ }
}
```

### 4.4 Evaluation Flow

```
1. LLM Response Received
   └─▶ Parse mood/sexual state updates from response

2. State Change Detection
   └─▶ Compare new state vs previous state
   └─▶ If no meaningful change → skip expression evaluation

3. Calculate Current Emotional State
   └─▶ EmotionCalculatorService.calculateEmotions(moodData, sexualArousal)
   └─▶ EmotionCalculatorService.calculateSexualStates(moodData, sexualArousal)

4. Build Expression Evaluation Context
   └─▶ ExpressionContextBuilder.buildContext(actor, emotions, sexualStates, moodAxes)

5. Evaluate All Expressions
   └─▶ For each loaded expression:
       └─▶ Resolve condition references
       └─▶ Evaluate prerequisites with JSON Logic
       └─▶ If passes → add to candidates with priority

6. Select Highest Priority Expression
   └─▶ Sort candidates by priority (descending)
   └─▶ Return first (highest priority)

7. Dispatch Perception Event
   └─▶ Use DISPATCH_PERCEPTIBLE_EVENT pattern
   └─▶ Parameters: actor_description, description_text, alternate_descriptions
   └─▶ Location: actor's current location
   └─▶ Perception type: emotion.expression
```

---

## 5. Integration Points

### 5.1 LLM Response Processing

**Current Location:** `src/turns/services/LLMResponseProcessor.js`

**Integration Point:**
After processing the LLM response and before ending the turn, check if mood/sexual state changed and evaluate expressions.

```javascript
// In LLMResponseProcessor or new orchestrator
async processResponse(response, actor) {
  // ... existing processing ...

  // Check for mood/sexual state changes
  const previousState = this.#getPreviousState(actor);
  const newState = this.#extractNewState(response);

  if (this.#hasSignificantChange(previousState, newState)) {
    await this.#expressionDispatcher.evaluateAndDispatch(actor, newState, previousState);
  }

  // ... continue processing ...
}
```

### 5.2 Perception Type Registration

**File:** `src/perception/registries/perceptionTypeRegistry.js`

Add new perception type:
```javascript
'emotion.expression': {
  primarySense: 'visual',
  fallbackSenses: ['auditory', 'tactile'],
  description: 'Observable emotional expression'
}
```

### 5.3 Event Dispatch Integration

Reuse existing `DISPATCH_PERCEPTIBLE_EVENT` pattern:

```javascript
// In ExpressionDispatcher
async dispatchExpression(actor, expression, context) {
  const locationId = this.#getActorLocationId(actor);
  const actorName = this.#getActorName(actor);

  // Replace {actor} placeholder
  const descriptionText = expression.description_text.replace('{actor}', actorName);

  await this.#eventBus.dispatch({
    type: 'core:perceptible_event',
    payload: {
      locationId,
      descriptionText,
      actorDescription: expression.actor_description,
      perceptionType: expression.perception_type || 'emotion.expression',
      actorId: actor.id,
      alternateDescriptions: expression.alternate_descriptions,
      senseAware: true
    }
  });
}
```

---

## 6. Design Decisions (Confirmed)

### 6.1 State Change Detection
**Decision:** Any change to mood axes or sexual state values triggers expression evaluation.
- Maximizes expressiveness and responsiveness
- Rate limiting handles spam prevention (see 6.3)

### 6.2 Multiple Expression Matching
**Decision:** First loaded (deterministic by mod order, then file order)
- Matches existing mod override patterns
- Deterministic behavior aids debugging

### 6.3 Expression Frequency
**Decision:** One expression per turn maximum (global cooldown)
- Prevents perception log spam
- Simple to implement and understand
- Future enhancement: per-expression cooldown if needed

### 6.4 Previous State Access
**Decision:** Yes - include previous emotional/sexual state in evaluation context
- Enables nuanced expressions like "sudden rage" vs "simmering anger"
- Context includes: `previousEmotions`, `previousSexualStates`, `previousMoodAxes`

### 6.5 Perception Type
**Decision:** Single unified `emotion.expression` perception type
- Expressions naturally blend emotional and sexual states (e.g., "sad but aroused")
- No artificial distinction - modders define the conditions that matter to them
- Content filtering can use tags if needed, not separate perception types

---

## 7. Implementation Phases

### Phase 1: Foundation
1. ✅ Create `expression.schema.json` - COMPLETED
   - File: `data/schemas/expression.schema.json`
   - Added `emotion.expression` to `common.schema.json` perception types
2. ✅ Update `loaderMeta.js` with expressions entry - COMPLETED
   - File: `src/loaders/loaderMeta.js`
3. ✅ Create `ExpressionLoader` extending `SimpleItemLoader` - COMPLETED
   - File: `src/loaders/expressionLoader.js`
4. Create `ExpressionRegistry` for storage - PENDING (requires separate ticket)
5. ✅ Update `scripts/updateManifest.js` for `.expression.json` files - COMPLETED
   - Added `scanExpressionDirectoryRecursively` function
   - Added handler in `processContentType`
6. ✅ Register DI tokens - COMPLETED
   - Added `ExpressionLoader` token to `tokens-core.js`
   - Added service tokens: `IExpressionContextBuilder`, `IExpressionEvaluatorService`, `IExpressionDispatcher`, `IExpressionOrchestrator`
   - Registered loader in `loadersRegistrations.js`
   - Added to `createDefaultContentLoadersConfig` in `defaultLoaderConfig.js`

### Phase 2: Context Building
1. Create `ExpressionContextBuilder`
2. Integrate with `EmotionCalculatorService` for emotion/sexual state values
3. Build context with emotions, sexualStates, moodAxes, sexualArousal
4. Add support for `previousEmotions` and `previousSexualStates`

### Phase 3: Evaluation Engine
1. Create `ExpressionEvaluatorService`
2. Reuse `JsonLogicEvaluationService` for prerequisite evaluation
3. Reuse `conditionRefResolver` for condition references
4. Implement priority-based selection

### Phase 4: Dispatch Integration
1. Create `ExpressionDispatcher`
2. Register `emotion.expression` perception type
3. Integrate with `DISPATCH_PERCEPTIBLE_EVENT` pattern
4. Handle placeholder replacement ({actor}, etc.)

### Phase 5: LLM Integration
1. Identify hook point in `LLMResponseProcessor` or related
2. Implement state change detection
3. Call expression evaluation on state change
4. Add cooldown/rate limiting

### Phase 6: Content & Testing
1. Create 20-30 core expressions covering major emotional states
2. Unit tests for each new service
3. Integration tests for full flow
4. Performance tests with hundreds of expressions

---

## 8. Scalability Considerations

### 8.1 Performance with Hundreds of Expressions

**Concern:** Evaluating hundreds of expressions every state change could be slow.

**Mitigations:**
1. **Tag-based pre-filtering**: Only evaluate expressions tagged with currently intense emotions
2. **Gate pre-evaluation**: Quick-fail expressions whose gates don't match current state
3. **Caching**: Cache prerequisite compilation (JSON Logic parsing)
4. **Lazy loading**: Only resolve condition references when needed

### 8.2 Memory Usage

**Concern:** Storing hundreds of expression objects in memory.

**Mitigations:**
1. **Shared structures**: Reuse condition definitions across expressions
2. **Lazy context building**: Only build full context when evaluating
3. **Expression indexing**: Index by tags for quick filtering

### 8.3 Mod Conflicts

**Concern:** Multiple mods defining conflicting expressions.

**Mitigations:**
1. **Unique IDs**: Namespace requirement (modId:expressionId)
2. **Priority system**: Higher priority wins, ties resolved by mod order
3. **Override capability**: Later mods can override earlier expressions by ID

---

## 9. Future Enhancements

### 9.1 Dynamic Expression Generation
- LLM-generated expressions based on character personality
- Procedural expression variations

### 9.2 Expression Chains
- Expressions that trigger other expressions
- Emotional escalation patterns

### 9.3 Social Expressions
- Expressions that depend on nearby actors
- Group emotional dynamics

### 9.4 Memory Integration
- Expressions that reference actor memories
- Trauma-triggered expressions

### 9.5 Visual Feedback
- Expression icons in UI
- Animated visual cues

---

## 10. Summary

The Expressions System extends the existing mood/sexual state calculation system with modular, sense-aware perception outputs. By leveraging established patterns (JSON Logic prerequisites, condition references, DISPATCH_PERCEPTIBLE_EVENT), the implementation maintains architectural consistency while adding significant narrative depth.

**Key Design Decisions:**
- One expression per file for moddability
- Full JSON Logic support for complex prerequisites
- Priority-based conflict resolution
- Reuse of existing perception dispatch infrastructure
- Separation of actor/observer perspectives

**Estimated Complexity:** Medium-High
- Leverages many existing systems
- New evaluation context required
- LLM response processing integration needed
- Potential performance considerations with scale

**Next Steps:**
1. ✅ Confirm answers to open questions (Section 6) - COMPLETED
2. Create tickets for remaining phases from this brainstorm
3. ✅ Phase 1 Foundation (loader infrastructure) - COMPLETED
4. Phase 2-6 require separate implementation tickets
