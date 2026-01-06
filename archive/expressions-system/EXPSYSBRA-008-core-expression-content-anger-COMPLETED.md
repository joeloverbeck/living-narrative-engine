# EXPSYSBRA-008: Core Expression Content - Anger Category

## Summary

Create core expression content files for anger-related emotional states (anger, rage, frustration, irritation, suppressed anger).

## Status

Completed

## Background

This ticket adds the first batch of expression content files covering anger-related emotions. Each expression file defines:
- Prerequisites based on calculated emotion intensities and mood axes
- First-person actor description (internal monologue)
- Third-person observer description (observable behavior)
- Alternate sensory descriptions for non-visual perception

## Assumptions + Scope Updates (Post-Review)

- The `data/mods/core/expressions/` directory does not exist yet and will be created.
- `data/schemas/expression.schema.json` exists and requires BaseDefinition fields (`id`, `description`) plus `actor_description` and `description_text`.
- `data/schemas/mod-manifest.schema.json` does **not** define an `expressions` content key, so core `mod-manifest.json` will not be updated in this ticket (schema change is out of scope). Expressions are added as content files only.
- No existing anger expression integration tests are present; this ticket will add them.

## File List (Expected to Touch)

### New Files
- `data/mods/core/expressions/suppressed_rage.expression.json`
- `data/mods/core/expressions/explosive_anger.expression.json`
- `data/mods/core/expressions/cold_fury.expression.json`
- `data/mods/core/expressions/mild_irritation.expression.json`
- `data/mods/core/expressions/frustrated_helplessness.expression.json`
- `tests/integration/mods/core/expressions/anger.expression.test.js`

### Files to Verify (NOT modify)
- `data/schemas/expression.schema.json` - Validate against schema
- `data/mods/core/lookups/emotion_prototypes.lookup.json` - Reference emotion names
- `data/schemas/mod-manifest.schema.json` - Confirms `expressions` key is not yet available

## Out of Scope (MUST NOT Change)

- `data/schemas/expression.schema.json` - Schema already complete
- `data/mods/core/lookups/emotion_prototypes.lookup.json` - Reference only
- `data/mods/core/mod-manifest.json` - Defer to schema update ticket for `expressions`
- Any existing mod files
- Expression services (separate tickets)

## Implementation Details

### 1. `suppressed_rage.expression.json`

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

### 2. `explosive_anger.expression.json`

```json
{
  "id": "core:explosive_anger",
  "description": "Intense anger combined with high arousal - ready to explode",
  "priority": 85,
  "prerequisites": [
    {
      "logic": {
        "and": [
          {">=": [{"var": "emotions.anger"}, 0.75]},
          {">=": [{"var": "moodAxes.arousal"}, 50]}
        ]
      }
    }
  ],
  "actor_description": "Something snaps inside. The pressure is unbearable—every muscle coiled, ready to strike.",
  "description_text": "{actor}'s face flushes red, fists clenching and unclenching as their whole body trembles with barely contained rage.",
  "alternate_descriptions": {
    "auditory": "You hear ragged, heavy breathing and the sound of someone's fist slamming into something.",
    "tactile": "You feel the vibration of someone's heavy footsteps nearby."
  },
  "tags": ["anger", "rage", "explosive"]
}
```

### 3. `cold_fury.expression.json`

```json
{
  "id": "core:cold_fury",
  "description": "Calculated anger - high anger but low arousal, controlled and dangerous",
  "priority": 80,
  "prerequisites": [
    {
      "logic": {
        "and": [
          {">=": [{"var": "emotions.anger"}, 0.60]},
          {"<=": [{"var": "moodAxes.arousal"}, 20]},
          {">=": [{"var": "moodAxes.agency_control"}, 10]}
        ]
      }
    }
  ],
  "actor_description": "The anger settles into something cold and certain. I know exactly what I'm going to do, and nothing will stop me.",
  "description_text": "{actor}'s expression hardens into something unnervingly calm, their movements becoming deliberate and precise.",
  "alternate_descriptions": {
    "auditory": "The silence around {actor} feels heavy and intentional."
  },
  "tags": ["anger", "cold", "controlled"]
}
```

### 4. `mild_irritation.expression.json`

```json
{
  "id": "core:mild_irritation",
  "description": "Low-level annoyance and frustration",
  "priority": 30,
  "prerequisites": [
    {
      "logic": {
        "and": [
          {">=": [{"var": "emotions.irritation"}, 0.35]},
          {"<": [{"var": "emotions.anger"}, 0.50]}
        ]
      }
    }
  ],
  "actor_description": "A prickle of annoyance crawls under my skin. It's nothing major, but it's there.",
  "description_text": "{actor} shifts their weight impatiently, a slight furrow appearing between their brows.",
  "alternate_descriptions": {
    "auditory": "You hear a soft, exasperated sigh."
  },
  "tags": ["irritation", "annoyance", "mild"]
}
```

### 5. `frustrated_helplessness.expression.json`

```json
{
  "id": "core:frustrated_helplessness",
  "description": "Anger combined with feelings of powerlessness",
  "priority": 70,
  "prerequisites": [
    {
      "logic": {
        "and": [
          {">=": [{"var": "emotions.frustration"}, 0.55]},
          {"<=": [{"var": "moodAxes.agency_control"}, -40]},
          {"<=": [{"var": "moodAxes.future_expectancy"}, -20]}
        ]
      }
    }
  ],
  "actor_description": "The walls are closing in and there's nothing I can do about it. Every option leads nowhere.",
  "description_text": "{actor}'s hands clench and unclench uselessly, their gaze darting around as if searching for an exit that doesn't exist.",
  "alternate_descriptions": {
    "auditory": "You hear the frustrated tap of someone's fingers against a surface."
  },
  "tags": ["frustration", "helplessness", "trapped"]
}
```

### Priority Guidelines

- **85+**: Extreme/dangerous states (explosive anger)
- **70-84**: Strong/significant expressions (suppressed rage, cold fury)
- **50-69**: Moderate expressions
- **30-49**: Mild expressions (mild irritation)
- **0-29**: Subtle/background expressions

## Acceptance Criteria

### Tests That Must Pass

1. **Schema Validation**
   - All expression files pass JSON schema validation
   - Run via new integration test using Ajv (see below)

2. **Content Tests: `tests/integration/mods/core/expressions/anger.expression.test.js` (new)**
   - `suppressed_rage prerequisites evaluate correctly`
   - `explosive_anger requires high anger AND high arousal`
   - `cold_fury requires high anger with LOW arousal`
   - `mild_irritation does not trigger when anger is high`
   - `all anger expressions have valid {actor} placeholder`
   - `all anger expressions validate against expression schema`

### Invariants That Must Remain True

1. **Valid JSON** - All files parse correctly
2. **Schema compliant** - All files validate against expression.schema.json
3. **Unique IDs** - No duplicate expression IDs
4. **Valid emotion references** - Only reference emotions from prototypes
5. **Proper placeholder usage** - `{actor}` in description_text
6. **Priority ordering** - More intense states have higher priority

## Estimated Size

- 5 new JSON files
- ~30-50 lines each
- No code changes

## Dependencies

- Depends on: EXPSYSBRA-006 (DI registration must be complete to test)
- Or can be created independently and validated via schema

## Notes

- Reference `emotion_prototypes.lookup.json` for valid emotion names
- Mood axes range: [-100, 100]
- Emotion intensities range: [0, 1]
- Higher priority expressions should have stricter/more specific prerequisites
- Descriptions should be evocative but not overly long

## Outcome

- Added five core anger expression files under `data/mods/core/expressions/`.
- Added integration tests for schema validation, prerequisite evaluation, and placeholder coverage.
- Updated `expression.schema.json` to accept BaseDefinition properties without conflicting `additionalProperties` constraints.
- Registered `expression.schema.json` in the schema preload list so validation can resolve it.
