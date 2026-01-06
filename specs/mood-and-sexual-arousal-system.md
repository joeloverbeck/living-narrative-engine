# Mood and Sexual Arousal System Specification

## Context

**Location in Codebase**:
- `data/mods/core/components/` - New mood and sexual_state components
- `data/mods/emotions/` - New mod containing emotion and sexual prototypes lookups
- `src/emotions/` - New service directory for EmotionCalculatorService
- `src/turns/services/actorDataExtractor.js` - Extract emotional/sexual state for prompts
- `src/prompting/characterDataXmlBuilder.js` - Build XML sections for LLM prompt
- `src/turns/schemas/llmOutputSchemas.js` - Extended response schema
- `src/turns/services/LLMResponseProcessor.js` - Process emotional updates
- `src/domUI/` - New UI panels for emotional and sexual state
- `src/dependencyInjection/registrations/` - Service and panel registration

**What These Modules Do**:

### Existing Infrastructure to Extend

**ActorDataExtractor.js**: Service responsible for processing raw actorState and component data to populate the ActorPromptDataDTO. Currently extracts name, description, personality, health state, etc. Will need extension to extract mood and sexual state.

**CharacterDataXmlBuilder.js**: Main orchestrator for building character XML from ActorPromptDataDTO. Transforms character data into LLM-optimized XML format with semantic sections. Section 6 "Current State" already contains physical_condition. Emotional and sexual state sections will be added here.

**LLMResponseProcessor.js**: Processes raw LLM JSON responses into structured action data. Validates against schema and extracts action/thoughts/notes. Will need extension to extract emotional updates.

**llmOutputSchemas.js**: Defines LLM_TURN_ACTION_RESPONSE_SCHEMA with chosenIndex, speech, thoughts, notes. Will need extension for 7 mood axes + 2 sexual values.

---

## Problem/Requirements

### What We're Solving

1. LLM-based characters react logically without spontaneous emotional changes
2. No mechanism to track character mood across 7 emotional axes
3. No mechanism to track sexual arousal states
4. LLM prompts lack emotional context for roleplay
5. No UI visibility into character emotional/sexual state

### Success Criteria

1. Characters have persistent mood state (7 axes, each [-100..100])
2. Characters have persistent sexual state (excitation/inhibition [0..100], baseline_libido [-50..50])
3. Emotions are calculated from mood axes using weighted prototype matching
4. Sexual states are calculated similarly with sexual_arousal factor
5. LLM receives emotional/sexual state in prompt as human-readable text
6. LLM returns updated mood axes and sexual values in response
7. Response processing updates character components
8. UI panels display current emotional and sexual state

---

## Technical Specifications

### 1. Component Definitions

#### 1.1 Mood Component

**File**: `data/mods/core/components/mood.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:mood",
  "description": "Tracks the 7 emotional axes that define a character's current mood state. Each axis ranges from -100 to +100.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "valence": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Pleasant (+) to unpleasant (-). Overall hedonic tone."
      },
      "arousal": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Energized (+) to depleted (-). Activation level."
      },
      "agency_control": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Dominant/in-control (+) to helpless (-). Felt power."
      },
      "threat": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Endangered (+) to safe (-). Perceived danger."
      },
      "engagement": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Absorbed (+) to indifferent (-). Attentional capture."
      },
      "future_expectancy": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Hopeful (+) to hopeless (-). Belief in positive outcomes."
      },
      "self_evaluation": {
        "type": "integer",
        "minimum": -100,
        "maximum": 100,
        "default": 0,
        "description": "Pride (+) to shame (-). Momentary self-worth."
      }
    },
    "required": ["valence", "arousal", "agency_control", "threat", "engagement", "future_expectancy", "self_evaluation"],
    "additionalProperties": false
  }
}
```

#### 1.2 Sexual State Component

**File**: `data/mods/core/components/sexual_state.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:sexual_state",
  "description": "Tracks sexual arousal-related values using the dual-control model (excitation/inhibition).",
  "dataSchema": {
    "type": "object",
    "properties": {
      "sex_excitation": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 0,
        "description": "Sexual response activation (accelerator). 0=none, 100=fully activated."
      },
      "sex_inhibition": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 0,
        "description": "Sexual response suppression (brake). 0=no brakes, 100=fully suppressed."
      },
      "baseline_libido": {
        "type": "integer",
        "minimum": -50,
        "maximum": 50,
        "default": 0,
        "description": "Trait-level sexual drive modifier. Negative=low drive, positive=high drive."
      }
    },
    "required": ["sex_excitation", "sex_inhibition", "baseline_libido"],
    "additionalProperties": false
  }
}
```

#### 1.3 Component ID Constants

**File**: `src/constants/componentIds.js` (additions)

```javascript
// Emotional system components
export const MOOD_COMPONENT_ID = 'core:mood';
export const SEXUAL_STATE_COMPONENT_ID = 'core:sexual_state';
```

---

### 2. Lookup Definitions

#### 2.1 Create New Mod: emotions

**File**: `data/mods/emotions/mod-manifest.json`

```json
{
  "id": "emotions",
  "version": "1.0.0",
  "name": "Emotions System",
  "description": "Emotion and sexual state prototype definitions for calculating emotional intensities from mood axes.",
  "dependencies": ["core"]
}
```

#### 2.2 Emotion Prototypes Lookup

**File**: `data/mods/emotions/lookups/emotion_prototypes.lookup.json`

```json
{
  "$schema": "schema://living-narrative-engine/lookup.schema.json",
  "id": "emotions:emotion_prototypes",
  "description": "Defines emotion prototypes with weights and gates for calculating emotional intensities from mood axes.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "weights": {
        "type": "object",
        "description": "Weight coefficients for each mood axis. Keys: valence, arousal, agency_control, threat, engagement, future_expectancy, self_evaluation, SA (sexual_arousal)",
        "additionalProperties": {
          "type": "number",
          "minimum": -1.0,
          "maximum": 1.0
        }
      },
      "gates": {
        "type": "array",
        "description": "Prerequisite conditions. Format: 'axis_name operator value' (e.g., 'valence >= 0.20'). Emotion intensity is 0 if any gate fails.",
        "items": {
          "type": "string",
          "pattern": "^(valence|arousal|agency_control|threat|engagement|future_expectancy|self_evaluation|sexual_arousal)\\s*(>=|<=|>|<|==)\\s*-?[0-9]+(\\.[0-9]+)?$"
        }
      }
    },
    "required": ["weights"],
    "additionalProperties": false
  },
  "entries": {
    "calm": {
      "weights": {"valence": 0.2, "arousal": -1.0, "threat": -1.0},
      "gates": ["threat <= 0.20"]
    },
    "contentment": {
      "weights": {"valence": 0.9, "arousal": -0.6, "threat": -0.6, "agency_control": 0.2},
      "gates": ["valence >= 0.20", "threat <= 0.20"]
    },
    "relief": {
      "weights": {"valence": 0.8, "arousal": -0.4, "threat": -0.9},
      "gates": ["threat <= 0.20"]
    },
    "safety_confidence": {
      "weights": {"valence": 0.4, "threat": -0.8, "agency_control": 0.8, "arousal": 0.2},
      "gates": ["threat <= 0.20", "agency_control >= 0.10"]
    },
    "joy": {
      "weights": {"valence": 1.0, "arousal": 0.5, "future_expectancy": 0.3},
      "gates": ["valence >= 0.35"]
    },
    "enthusiasm": {
      "weights": {"valence": 0.6, "arousal": 0.9, "engagement": 0.7, "future_expectancy": 0.3},
      "gates": ["valence >= 0.15", "arousal >= 0.20", "engagement >= 0.10"]
    },
    "amusement": {
      "weights": {"valence": 0.8, "arousal": 0.4, "threat": -0.2, "engagement": 0.3},
      "gates": ["valence >= 0.20"]
    },
    "awe": {
      "weights": {"valence": 0.4, "arousal": 0.9, "agency_control": -0.5, "engagement": 0.6},
      "gates": ["arousal >= 0.30", "engagement >= 0.20"]
    },
    "inspiration": {
      "weights": {"valence": 0.6, "arousal": 0.7, "engagement": 0.6, "future_expectancy": 0.6, "agency_control": 0.2},
      "gates": ["future_expectancy >= 0.15", "engagement >= 0.15"]
    },
    "interest": {
      "weights": {"engagement": 1.0, "arousal": 0.4, "valence": 0.2},
      "gates": ["engagement >= 0.20"]
    },
    "curiosity": {
      "weights": {"engagement": 1.0, "arousal": 0.6, "threat": -0.2, "valence": 0.2},
      "gates": ["engagement >= 0.20", "threat <= 0.40"]
    },
    "fascination": {
      "weights": {"engagement": 1.0, "arousal": 0.8, "valence": 0.3},
      "gates": ["engagement >= 0.35", "arousal >= 0.25"]
    },
    "flow": {
      "weights": {"engagement": 1.0, "arousal": 0.5, "valence": 0.5, "agency_control": 0.4},
      "gates": ["engagement >= 0.40", "agency_control >= 0.10"]
    },
    "hope": {
      "weights": {"future_expectancy": 1.0, "agency_control": 0.6, "valence": 0.3},
      "gates": ["future_expectancy >= 0.20"]
    },
    "optimism": {
      "weights": {"future_expectancy": 0.9, "valence": 0.7, "arousal": 0.2},
      "gates": ["future_expectancy >= 0.20", "valence >= 0.15"]
    },
    "determination": {
      "weights": {"agency_control": 1.0, "future_expectancy": 0.6, "arousal": 0.6, "valence": 0.1},
      "gates": ["agency_control >= 0.25", "arousal >= 0.10"]
    },
    "anticipation": {
      "weights": {"future_expectancy": 0.6, "arousal": 0.5, "engagement": 0.4, "valence": 0.2},
      "gates": ["engagement >= 0.10", "arousal >= 0.05"]
    },
    "sadness": {
      "weights": {"valence": -1.0, "arousal": -0.5, "agency_control": -0.3},
      "gates": ["valence <= -0.20", "arousal <= 0.20"]
    },
    "grief": {
      "weights": {"valence": -1.0, "arousal": -0.3, "engagement": 0.6, "agency_control": -0.4},
      "gates": ["valence <= -0.25", "engagement >= 0.10"]
    },
    "disappointment": {
      "weights": {"valence": -0.7, "future_expectancy": -0.6, "arousal": -0.1, "agency_control": -0.2},
      "gates": ["valence <= -0.10", "future_expectancy <= -0.10"]
    },
    "despair": {
      "weights": {"future_expectancy": -1.0, "agency_control": -0.7, "valence": -0.6, "arousal": -0.3},
      "gates": ["future_expectancy <= -0.25"]
    },
    "numbness": {
      "weights": {"valence": -0.2, "arousal": -1.0, "engagement": -0.6, "future_expectancy": -0.2},
      "gates": ["arousal <= -0.40", "engagement <= -0.15"]
    },
    "fatigue": {
      "weights": {"arousal": -1.0, "agency_control": -0.4, "valence": -0.3, "engagement": -0.2},
      "gates": ["arousal <= -0.35"]
    },
    "loneliness": {
      "weights": {"valence": -0.8, "engagement": -0.5, "future_expectancy": -0.3, "arousal": -0.2},
      "gates": ["valence <= -0.15", "engagement <= -0.10"]
    },
    "boredom": {
      "weights": {"engagement": -1.0, "arousal": -0.6, "valence": -0.2},
      "gates": ["engagement <= -0.25"]
    },
    "apathy": {
      "weights": {"engagement": -0.9, "arousal": -0.8, "valence": -0.4, "future_expectancy": -0.3},
      "gates": ["engagement <= -0.20", "arousal <= -0.20"]
    },
    "unease": {
      "weights": {"threat": 0.5, "arousal": 0.2, "valence": -0.3, "agency_control": -0.2},
      "gates": ["threat >= 0.10"]
    },
    "anxiety": {
      "weights": {"threat": 0.8, "future_expectancy": -0.6, "agency_control": -0.6, "arousal": 0.4, "valence": -0.4},
      "gates": ["threat >= 0.20", "agency_control <= 0.20"]
    },
    "fear": {
      "weights": {"threat": 1.0, "arousal": 0.8, "agency_control": -0.7, "valence": -0.6},
      "gates": ["threat >= 0.30"]
    },
    "terror": {
      "weights": {"threat": 1.0, "arousal": 1.0, "agency_control": -0.8, "valence": -0.6},
      "gates": ["threat >= 0.50", "arousal >= 0.30"]
    },
    "dread": {
      "weights": {"future_expectancy": -0.8, "threat": 0.7, "arousal": 0.3, "valence": -0.5, "agency_control": -0.2},
      "gates": ["future_expectancy <= -0.10", "threat >= 0.15"]
    },
    "hypervigilance": {
      "weights": {"threat": 0.9, "arousal": 0.8, "engagement": 0.5, "valence": -0.3},
      "gates": ["threat >= 0.30", "arousal >= 0.20"]
    },
    "irritation": {
      "weights": {"valence": -0.6, "arousal": 0.4, "agency_control": 0.2, "threat": 0.2},
      "gates": ["valence <= -0.10"]
    },
    "frustration": {
      "weights": {"engagement": 0.7, "agency_control": -0.7, "valence": -0.5, "arousal": 0.3},
      "gates": ["engagement >= 0.10", "agency_control <= 0.10", "valence <= -0.10"]
    },
    "anger": {
      "weights": {"valence": -0.8, "arousal": 0.8, "agency_control": 0.7, "threat": 0.3},
      "gates": ["valence <= -0.15", "arousal >= 0.10"]
    },
    "rage": {
      "weights": {"valence": -0.9, "arousal": 1.0, "agency_control": 0.8, "threat": 0.4},
      "gates": ["valence <= -0.25", "arousal >= 0.25"]
    },
    "resentment": {
      "weights": {"valence": -0.7, "arousal": 0.2, "agency_control": 0.5, "future_expectancy": -0.3, "self_evaluation": -0.2},
      "gates": ["valence <= -0.10", "agency_control >= 0.10"]
    },
    "contempt": {
      "weights": {"valence": -0.6, "agency_control": 0.8, "engagement": -0.2, "self_evaluation": 0.2},
      "gates": ["valence <= -0.10", "agency_control >= 0.20"]
    },
    "disgust": {
      "weights": {"valence": -0.9, "arousal": 0.4, "engagement": -0.3, "threat": 0.2},
      "gates": ["valence <= -0.25"]
    },
    "pride": {
      "weights": {"self_evaluation": 1.0, "agency_control": 0.4, "valence": 0.3},
      "gates": ["self_evaluation >= 0.25"]
    },
    "shame": {
      "weights": {"self_evaluation": -1.0, "agency_control": -0.5, "valence": -0.4, "threat": 0.2},
      "gates": ["self_evaluation <= -0.25"]
    },
    "embarrassment": {
      "weights": {"self_evaluation": -0.7, "arousal": 0.5, "threat": 0.6, "valence": -0.3},
      "gates": ["self_evaluation <= -0.10", "threat >= 0.20"]
    },
    "guilt": {
      "weights": {"self_evaluation": -0.7, "valence": -0.4, "agency_control": 0.2, "engagement": 0.2},
      "gates": ["self_evaluation <= -0.10", "valence <= -0.10"]
    },
    "humiliation": {
      "weights": {"self_evaluation": -1.0, "arousal": 0.7, "threat": 0.6, "agency_control": -0.4, "valence": -0.5},
      "gates": ["self_evaluation <= -0.25", "threat >= 0.30"]
    },
    "envy": {
      "weights": {"valence": -0.5, "arousal": 0.4, "agency_control": -0.2, "self_evaluation": -0.4, "engagement": 0.3},
      "gates": ["self_evaluation <= -0.05", "valence <= -0.05"]
    },
    "jealousy": {
      "weights": {"threat": 0.6, "arousal": 0.6, "valence": -0.6, "agency_control": -0.2, "engagement": 0.4},
      "gates": ["threat >= 0.20", "valence <= -0.05"]
    },
    "trust": {
      "weights": {"valence": 0.4, "threat": -0.5, "agency_control": 0.2, "engagement": 0.2},
      "gates": ["threat <= 0.40"]
    },
    "admiration": {
      "weights": {"valence": 0.6, "engagement": 0.5, "self_evaluation": 0.3, "arousal": 0.2},
      "gates": ["engagement >= 0.10", "valence >= 0.10"]
    },
    "gratitude": {
      "weights": {"valence": 0.8, "threat": -0.3, "self_evaluation": 0.2, "agency_control": 0.1},
      "gates": ["valence >= 0.20"]
    },
    "affection": {
      "weights": {"valence": 0.7, "arousal": 0.2, "threat": -0.4, "engagement": 0.3, "sexual_arousal": 0.15},
      "gates": ["valence >= 0.10", "threat <= 0.40"]
    },
    "love_attachment": {
      "weights": {"valence": 0.6, "engagement": 0.6, "future_expectancy": 0.4, "threat": -0.2, "sexual_arousal": 0.10},
      "gates": ["engagement >= 0.10", "threat <= 0.50"]
    },
    "hatred": {
      "weights": {"valence": -0.9, "arousal": 0.6, "agency_control": 0.6, "engagement": 0.3, "threat": 0.3},
      "gates": ["valence <= -0.25", "arousal >= 0.10"]
    },
    "surprise_startle": {
      "weights": {"arousal": 0.9, "threat": 0.3, "agency_control": -0.2, "engagement": 0.2},
      "gates": ["arousal >= 0.10"]
    },
    "confusion": {
      "weights": {"engagement": 0.3, "arousal": 0.2, "agency_control": -0.5, "valence": -0.2},
      "gates": ["agency_control <= 0.20"]
    },
    "alarm": {
      "weights": {"threat": 0.8, "arousal": 0.9, "agency_control": -0.4, "valence": -0.4},
      "gates": ["threat >= 0.30", "arousal >= 0.20"]
    }
  }
}
```

#### 2.3 Sexual Prototypes Lookup

**File**: `data/mods/emotions/lookups/sexual_prototypes.lookup.json`

```json
{
  "$schema": "schema://living-narrative-engine/lookup.schema.json",
  "id": "emotions:sexual_prototypes",
  "description": "Defines sexual state prototypes with weights and gates for calculating sexual state intensities.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "weights": {
        "type": "object",
        "description": "Weight coefficients. Keys include mood axes plus 'sexual_arousal'.",
        "additionalProperties": {
          "type": "number",
          "minimum": -1.0,
          "maximum": 1.0
        }
      },
      "gates": {
        "type": "array",
        "description": "Prerequisite conditions.",
        "items": {
          "type": "string"
        }
      }
    },
    "required": ["weights"],
    "additionalProperties": false
  },
  "entries": {
    "sexual_lust": {
      "weights": {"sexual_arousal": 1.0, "valence": 0.3, "arousal": 0.3, "threat": -0.6, "self_evaluation": 0.2, "engagement": 0.2},
      "gates": ["sexual_arousal >= 0.35", "threat <= 0.30", "self_evaluation >= -0.40"]
    },
    "sexual_sensual_pleasure": {
      "weights": {"sexual_arousal": 1.0, "valence": 0.6, "arousal": 0.1, "threat": -0.6, "self_evaluation": 0.2},
      "gates": ["sexual_arousal >= 0.35", "threat <= 0.20"]
    },
    "sexual_playfulness": {
      "weights": {"sexual_arousal": 0.9, "valence": 0.5, "arousal": 0.5, "engagement": 0.4, "threat": -0.4, "self_evaluation": 0.2},
      "gates": ["sexual_arousal >= 0.40", "threat <= 0.20", "self_evaluation >= -0.20"]
    },
    "romantic_yearning": {
      "weights": {"sexual_arousal": 0.6, "engagement": 0.6, "future_expectancy": 0.5, "valence": 0.1, "arousal": 0.2, "threat": -0.2},
      "gates": ["engagement >= 0.10", "future_expectancy >= 0.10"]
    },
    "sexual_confident": {
      "weights": {"sexual_arousal": 0.8, "agency_control": 0.6, "valence": 0.2, "threat": -0.4, "self_evaluation": 0.2},
      "gates": ["sexual_arousal >= 0.35", "agency_control >= 0.10", "threat <= 0.30"]
    },
    "aroused_but_ashamed": {
      "weights": {"sexual_arousal": 1.0, "self_evaluation": -0.9, "valence": -0.3, "threat": 0.2, "agency_control": -0.2, "arousal": 0.2},
      "gates": ["sexual_arousal >= 0.35", "self_evaluation <= -0.20"]
    },
    "aroused_but_threatened": {
      "weights": {"sexual_arousal": 0.8, "threat": 0.9, "arousal": 0.6, "valence": -0.4, "agency_control": -0.3},
      "gates": ["sexual_arousal >= 0.35", "threat >= 0.30"]
    },
    "sexual_performance_anxiety": {
      "weights": {"sexual_arousal": 0.8, "threat": 0.6, "self_evaluation": -0.5, "agency_control": -0.5, "arousal": 0.5, "valence": -0.3},
      "gates": ["sexual_arousal >= 0.35", "threat >= 0.20", "agency_control <= 0.10"]
    },
    "sexual_frustration": {
      "weights": {"sexual_arousal": 0.7, "valence": -0.5, "arousal": 0.4, "engagement": 0.4, "agency_control": -0.4, "threat": 0.2},
      "gates": ["sexual_arousal >= 0.30", "valence <= -0.10"]
    },
    "afterglow": {
      "weights": {"sexual_arousal": 0.3, "valence": 0.7, "arousal": -0.3, "threat": -0.6, "self_evaluation": 0.2, "engagement": 0.2},
      "gates": ["valence >= 0.20", "threat <= 0.20"]
    },
    "sexual_disgust_conflict": {
      "weights": {"sexual_arousal": 0.7, "valence": -0.8, "self_evaluation": -0.3, "threat": 0.2, "arousal": 0.3},
      "gates": ["sexual_arousal >= 0.30", "valence <= -0.40"]
    }
  }
}
```

---

### 3. Service Architecture

#### 3.1 EmotionCalculatorService

**File**: `src/emotions/emotionCalculatorService.js`

**Responsibilities**:
1. Calculate sexual_arousal from sexual state component
2. Normalize mood axes from [-100..100] to [-1..1]
3. Check gates for prototype eligibility
4. Calculate emotion intensities using weighted sum formula
5. Format emotions/sexual states for prompt text

**Key Formulas**:

**Sexual Arousal Calculation**:
```javascript
sexual_arousal = clamp01((sex_excitation - sex_inhibition + baseline_libido) / 100)
```

**Emotion Intensity Calculation**:
```javascript
// Step 1: Normalize axes to [-1..1]
normalized_axis = axis_value / 100

// Step 2: Check all gates (if any gate fails, intensity = 0)
if (!allGatesPass(prototype.gates, normalizedAxes, sexualArousal)) {
  return 0;
}

// Step 3: Weighted sum
rawSum = sum(normalized_axis[i] * weight[i] for each axis in prototype.weights)

// Step 4: Normalize by max possible
maxPossible = sum(|weight[i]| for each axis in prototype.weights)
normalizedIntensity = rawSum / maxPossible

// Step 5: Clamp negatives to 0
intensity = max(0, normalizedIntensity)
```

**Intensity Labels** (10-level granularity):
```javascript
const INTENSITY_LEVELS = [
  { max: 0.05, label: 'absent' },
  { max: 0.15, label: 'faint' },
  { max: 0.25, label: 'slight' },
  { max: 0.35, label: 'mild' },
  { max: 0.45, label: 'noticeable' },
  { max: 0.55, label: 'moderate' },
  { max: 0.65, label: 'strong' },
  { max: 0.75, label: 'intense' },
  { max: 0.85, label: 'powerful' },
  { max: 0.95, label: 'overwhelming' },
  { max: 1.00, label: 'extreme' }
];
```

#### 3.2 DI Registration

**Token**: `EmotionCalculatorService` in `src/dependencyInjection/tokens/tokens-core.js`

**Registration**: In `src/dependencyInjection/registrations/aiRegistrations.js`
- Inject: `ILogger`, `IDataRegistry`
- Lifecycle: `singletonFactory`

---

### 4. Prompt Integration

#### 4.1 ActorDataExtractor Extension

**Modifications to**: `src/turns/services/actorDataExtractor.js`

1. Add `emotionCalculatorService` to constructor dependencies
2. Add `#extractEmotionalData(actorState)` method
3. Include `emotionalState` in returned DTO

**EmotionalState DTO Structure**:
```javascript
{
  moodAxes: {
    valence: number,
    arousal: number,
    agency_control: number,
    threat: number,
    engagement: number,
    future_expectancy: number,
    self_evaluation: number
  },
  emotionalStateText: string,  // "fear: intense, anger: moderate"
  sexualState: {
    sex_excitation: number,
    sex_inhibition: number,
    baseline_libido: number,
    sexual_arousal: number  // calculated [0..1]
  } | null,
  sexualStateText: string | null  // "lust: high, playfulness: moderate"
}
```

#### 4.2 CharacterDataXmlBuilder Extension

**Modifications to**: `src/prompting/characterDataXmlBuilder.js`

Add `#buildEmotionalStateSection(emotionalState)` method that produces:

```xml
<inner_state>
  <emotional_state>fear: intense, anger: moderate, hope: slight</emotional_state>
  <sexual_state>lust: high, romantic yearning: moderate</sexual_state>
</inner_state>
```

Place after `<physical_condition>` in `<current_state>` section.

---

### 5. Response Schema Extension

**Modifications to**: `src/turns/schemas/llmOutputSchemas.js`

Add to `LLM_TURN_ACTION_RESPONSE_SCHEMA.properties`:

```javascript
moodUpdate: {
  type: 'object',
  additionalProperties: false,
  properties: {
    valence: { type: 'integer', minimum: -100, maximum: 100 },
    arousal: { type: 'integer', minimum: -100, maximum: 100 },
    agency_control: { type: 'integer', minimum: -100, maximum: 100 },
    threat: { type: 'integer', minimum: -100, maximum: 100 },
    engagement: { type: 'integer', minimum: -100, maximum: 100 },
    future_expectancy: { type: 'integer', minimum: -100, maximum: 100 },
    self_evaluation: { type: 'integer', minimum: -100, maximum: 100 }
  },
  required: ['valence', 'arousal', 'agency_control', 'threat', 'engagement', 'future_expectancy', 'self_evaluation']
},
sexualUpdate: {
  type: 'object',
  additionalProperties: false,
  properties: {
    sex_excitation: { type: 'integer', minimum: 0, maximum: 100 },
    sex_inhibition: { type: 'integer', minimum: 0, maximum: 100 }
  },
  required: ['sex_excitation', 'sex_inhibition']
}
```

**Note**: `moodUpdate` and `sexualUpdate` are NOT in the `required` array - they are optional.

---

### 6. Response Processing

#### 6.1 LLMResponseProcessor Extension

**Modifications to**: `src/turns/services/LLMResponseProcessor.js`

Modify `#extractData` to include `moodUpdate` and `sexualUpdate` in `extractedData`.

#### 6.2 MoodUpdateWorkflow

**New File**: `src/turns/states/workflows/moodUpdateWorkflow.js`

**Responsibilities**:
1. Receive `actorId` and `extractedData` from response processing
2. Get entity instance from EntityManager
3. If `moodUpdate` present and actor has mood component, update component
4. If `sexualUpdate` present and actor has sexual_state component, update (preserving baseline_libido)
5. Log debug information
6. Handle errors gracefully (don't throw - allow turn to continue)

**Integration Point**: Called after LLMResponseProcessor in turn state machine.

---

### 7. UI Implementation

#### 7.1 Emotional State Panel

**New File**: `src/domUI/emotionalStatePanel.js`

**HTML Container** (in game.html, after injury-status-widget):
```html
<div
  id="emotional-state-widget"
  class="widget"
  role="region"
  aria-labelledby="emotional-state-heading"
  aria-live="polite"
  style="display: none;"
>
  <h3 id="emotional-state-heading">Emotional State</h3>
  <div id="emotional-state-content"></div>
</div>
```

**Panel Features**:
- 7 horizontal bars for each mood axis
- Each bar: [-100..100] displayed as 0-100% width with center marker
- Color-coded per axis
- Labels on each end (e.g., "Unpleasant" - "Pleasant" for valence)
- Current numeric value displayed
- Calculated emotions text below bars
- Hidden when actor lacks mood component
- Updates on `core:turn_started` and `core:component_updated` events

**Axis Colors**:
```javascript
const AXIS_CONFIG = [
  { key: 'valence', negLabel: 'Unpleasant', posLabel: 'Pleasant', color: '#4CAF50' },
  { key: 'arousal', negLabel: 'Depleted', posLabel: 'Energized', color: '#FF9800' },
  { key: 'agency_control', negLabel: 'Helpless', posLabel: 'In Control', color: '#2196F3' },
  { key: 'threat', negLabel: 'Safe', posLabel: 'Endangered', color: '#F44336' },
  { key: 'engagement', negLabel: 'Indifferent', posLabel: 'Absorbed', color: '#9C27B0' },
  { key: 'future_expectancy', negLabel: 'Hopeless', posLabel: 'Hopeful', color: '#00BCD4' },
  { key: 'self_evaluation', negLabel: 'Shame', posLabel: 'Pride', color: '#E91E63' }
];
```

#### 7.2 Sexual State Panel

**New File**: `src/domUI/sexualStatePanel.js`

**HTML Container** (in game.html, after emotional-state-widget):
```html
<div
  id="sexual-state-widget"
  class="widget"
  role="region"
  aria-labelledby="sexual-state-heading"
  aria-live="polite"
  style="display: none;"
>
  <h3 id="sexual-state-heading">Sexual State</h3>
  <div id="sexual-state-content"></div>
</div>
```

**Panel Features**:
- 3 horizontal bars:
  - sex_excitation [0..100] - color: warm pink/red
  - sex_inhibition [0..100] - color: cool blue
  - sexual_arousal [0..1] displayed as [0..100] - color: purple
- baseline_libido [-50..50] as numeric display (no bar)
- Calculated sexual states text below
- Hidden when actor lacks sexual_state component

---

### 8. File Organization Summary

```
data/
├── mods/
│   ├── core/
│   │   └── components/
│   │       ├── mood.component.json              # NEW
│   │       └── sexual_state.component.json      # NEW
│   └── emotions/                                # NEW MOD
│       ├── mod-manifest.json
│       └── lookups/
│           ├── emotion_prototypes.lookup.json
│           └── sexual_prototypes.lookup.json

src/
├── constants/
│   └── componentIds.js                          # ADD constants
├── emotions/                                    # NEW DIRECTORY
│   └── emotionCalculatorService.js
├── turns/
│   ├── services/
│   │   ├── actorDataExtractor.js               # MODIFY
│   │   └── LLMResponseProcessor.js             # MODIFY
│   ├── schemas/
│   │   └── llmOutputSchemas.js                 # MODIFY
│   └── states/
│       └── workflows/
│           └── moodUpdateWorkflow.js           # NEW
├── prompting/
│   └── characterDataXmlBuilder.js              # MODIFY
├── domUI/
│   ├── emotionalStatePanel.js                  # NEW
│   ├── sexualStatePanel.js                     # NEW
│   └── index.js                                # MODIFY exports
└── dependencyInjection/
    ├── tokens/
    │   └── tokens-core.js                      # ADD token
    └── registrations/
        ├── aiRegistrations.js                  # ADD registration
        └── uiRegistrations.js                  # ADD panel registrations

game.html                                        # ADD panel containers
```

---

### 9. Prompt Instructions Update

Add to system prompt template for LLM turn processing:

```
EMOTIONAL + SEXUAL STATE UPDATE (NUMERIC, ABSOLUTE VALUES)

You are updating the character's internal state after the latest events.
Output the new absolute numeric values (not deltas) in the moodUpdate and sexualUpdate fields.

RANGES
- Mood axes (valence, arousal, agency_control, threat, engagement, future_expectancy, self_evaluation): integers [-100..100]
- sex_excitation and sex_inhibition: integers [0..100]

AXIS DEFINITIONS
Valence: + = pleasant/rewarding, - = unpleasant/aversive
Arousal: + = energized/amped, - = depleted/slowed
Agency/Control: + = in control/assertive, - = helpless/powerless
Threat: + = endangered/alarmed, - = safe/relaxed
Engagement: + = absorbed/attentive, - = indifferent/checked out
Future Expectancy: + = hopeful/path forward, - = hopeless/future closed
Self-evaluation: + = pride/dignity, - = shame/defect/exposed

SEX VARIABLES
sex_excitation (accelerator): how activated sexual interest/readiness is
sex_inhibition (brake): how much sexual response is suppressed by danger, shame, anxiety

UPDATE HEURISTICS
- Being attacked/threatened: Threat up, Arousal up, Valence down
- Succeeding/gaining leverage: Agency/Control up, Valence up, Threat down
- Loss/grief: Valence down, Arousal often down
- Public humiliation: Self-evaluation down, Valence down, Threat up
- Boredom/waiting: Engagement down, Arousal down

SEX UPDATE HEURISTICS
- Increase sex_inhibition: high Threat, very negative Self-evaluation, disgust/distress
- Decrease sex_inhibition: low Threat, improved Self-evaluation, calm trust
- Increase sex_excitation: attraction/intimacy cues, positive Valence, high Engagement
- Decrease sex_excitation: danger, disgust, shame, exhaustion

TYPICAL CHANGE MAGNITUDES
- Mild event: 5-15 points
- Strong event: 15-35 points
- Extreme event: 35-60 points
```

---

### 10. Testing Strategy

#### 10.1 Unit Tests

**File**: `tests/unit/emotions/emotionCalculatorService.test.js`

Test cases:
- `calculateSexualArousal`: null input, clamping, formula correctness
- `#normalizeMoodAxes`: boundary values, default handling
- `#checkGates`: all operators, invalid format handling
- `calculateEmotions`: empty prototypes, gate filtering, intensity calculation
- `calculateSexualStates`: with/without sexual state
- `getIntensityLabel`: all threshold boundaries
- `formatEmotionsForPrompt`: sorting, maxCount, neutral case
- `formatSexualStatesForPrompt`: underscore replacement

**Example Test**:
```javascript
it('should calculate pride intensity correctly', () => {
  // self_eval=70, agency=20, valence=10
  // Pride weights: SE=1.0, AC=0.4, V=0.3
  // Raw = 0.70*1.0 + 0.20*0.4 + 0.10*0.3 = 0.81
  // Max = 1.0 + 0.4 + 0.3 = 1.7
  // Intensity = 0.81 / 1.7 ≈ 0.476

  const moodData = {
    valence: 10, arousal: 0, agency_control: 20,
    threat: 0, engagement: 0, future_expectancy: 0, self_evaluation: 70
  };

  const emotions = service.calculateEmotions(moodData, null);
  expect(emotions.get('pride')).toBeCloseTo(0.476, 2);
});
```

#### 10.2 Integration Tests

**File**: `tests/integration/emotions/emotionPromptIntegration.test.js`
- Actor with mood component includes emotional_state in prompt
- Actor without mood component excludes emotional_state
- Correct formatting of emotion text

**File**: `tests/integration/emotions/moodResponseProcessing.test.js`
- Mood component updated from LLM response
- Sexual state updated from LLM response
- baseline_libido preserved on update
- Missing moodUpdate handled gracefully

#### 10.3 Schema Validation Tests

**File**: `tests/unit/turns/schemas/llmOutputSchemas.test.js`
- Valid response with moodUpdate
- Valid response without moodUpdate
- Reject out-of-range mood values
- Reject missing required fields in moodUpdate

#### 10.4 UI Component Tests

**File**: `tests/unit/domUI/emotionalStatePanel.test.js`
- Panel hidden when no mood component
- Panel shown and rendered with mood data
- Event subscription and updates
- Correct axis bar widths and colors

---

### 11. Implementation Phases

#### Phase 1: Core Components and Lookups (2-3 hours)
1. Create `core:mood` component definition
2. Create `core:sexual_state` component definition
3. Create `emotions` mod with manifest
4. Create `emotion_prototypes` lookup (all 50 emotions)
5. Create `sexual_prototypes` lookup (all 11 states)
6. Add component ID constants
7. Validate all JSON schemas with `npm run validate`

#### Phase 2: EmotionCalculatorService (3-4 hours)
1. Create `src/emotions/` directory
2. Implement EmotionCalculatorService with all methods
3. Add DI token and registration
4. Write comprehensive unit tests
5. Verify with `npm run test:unit`

#### Phase 3: Prompt Integration (3-4 hours)
1. Modify ActorDataExtractor constructor and add `emotionCalculatorService`
2. Add `#extractEmotionalData` method
3. Modify CharacterDataXmlBuilder to include `<inner_state>` section
4. Update DI registration for ActorDataExtractor
5. Add integration tests
6. Verify with `npm run test:integration`

#### Phase 4: Response Schema and Processing (3-4 hours)
1. Extend `LLM_TURN_ACTION_RESPONSE_SCHEMA` with moodUpdate/sexualUpdate
2. Modify `LLMResponseProcessor.#extractData` to include new fields
3. Create `MoodUpdateWorkflow`
4. Integrate workflow into turn state machine
5. Add unit and integration tests
6. Verify with full test suite

#### Phase 5: UI Panels (4-5 hours)
1. Add HTML containers to game.html
2. Implement EmotionalStatePanel class
3. Implement SexualStatePanel class
4. Add CSS styling in appropriate stylesheet
5. Register panels in DI (uiRegistrations.js)
6. Wire up event subscriptions
7. Add unit tests for panels
8. Visual verification in browser

#### Phase 6: Prompt Instructions Update (2 hours)
1. Locate system prompt template
2. Add mood/sexual update instructions block
3. Add axis definitions
4. Add heuristics guidance
5. Test with actual LLM calls

#### Phase 7: End-to-End Testing (2-3 hours)
1. Create E2E test scenarios
2. Test full loop: prompt → LLM → response → update → UI
3. Test edge cases (missing components, partial updates)
4. Performance testing with many emotions
5. Final validation and cleanup

---

## Critical Implementation Files

| File | Action | Priority |
|------|--------|----------|
| `data/mods/core/components/mood.component.json` | CREATE | Phase 1 |
| `data/mods/core/components/sexual_state.component.json` | CREATE | Phase 1 |
| `data/mods/emotions/mod-manifest.json` | CREATE | Phase 1 |
| `data/mods/emotions/lookups/emotion_prototypes.lookup.json` | CREATE | Phase 1 |
| `data/mods/emotions/lookups/sexual_prototypes.lookup.json` | CREATE | Phase 1 |
| `src/constants/componentIds.js` | MODIFY | Phase 1 |
| `src/emotions/emotionCalculatorService.js` | CREATE | Phase 2 |
| `src/dependencyInjection/tokens/tokens-core.js` | MODIFY | Phase 2 |
| `src/dependencyInjection/registrations/aiRegistrations.js` | MODIFY | Phase 2 |
| `src/turns/services/actorDataExtractor.js` | MODIFY | Phase 3 |
| `src/prompting/characterDataXmlBuilder.js` | MODIFY | Phase 3 |
| `src/turns/schemas/llmOutputSchemas.js` | MODIFY | Phase 4 |
| `src/turns/services/LLMResponseProcessor.js` | MODIFY | Phase 4 |
| `src/turns/states/workflows/moodUpdateWorkflow.js` | CREATE | Phase 4 |
| `game.html` | MODIFY | Phase 5 |
| `src/domUI/emotionalStatePanel.js` | CREATE | Phase 5 |
| `src/domUI/sexualStatePanel.js` | CREATE | Phase 5 |
| `src/dependencyInjection/registrations/uiRegistrations.js` | MODIFY | Phase 5 |

---

## Open Questions

1. **Mod Location**: Should components be in `core` mod or new `emotions` mod? (Spec assumes core for components, emotions for lookups)

2. **Prompt Template Location**: Where is the system prompt template that needs the mood update instructions? Need to verify file path.

3. **Turn State Machine Integration**: What is the exact integration point for MoodUpdateWorkflow in the turn processing flow?

4. **CSS Styling**: Should panel styles go in existing stylesheet or new file?

5. **Game.json Update**: Does `emotions` mod need to be added to game.json mods array?
