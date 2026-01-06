# EXPSYSBRA-009: Core Expression Content - Sadness Category

## Summary

Create core expression content files for sadness-related emotional states (sadness, despair, grief, loneliness, and melancholic disappointment).

## Status

Completed.

## Background

This ticket adds expression content files covering sadness-related emotions. These expressions represent the spectrum from mild disappointment to deep despair, using mood axes like `valence`, `future_expectancy`, and `engagement` to differentiate states.

## File List (Expected to Touch)

### New Files
- `data/mods/core/expressions/deep_despair.expression.json`
- `data/mods/core/expressions/quiet_grief.expression.json`
- `data/mods/core/expressions/melancholic_disappointment.expression.json`
- `data/mods/core/expressions/lonely_isolation.expression.json`
- `data/mods/core/expressions/tearful_sorrow.expression.json`

### Files to Verify (NOT modify)
- `data/schemas/expression.schema.json` - Validate against schema
- `data/mods/core/lookups/emotion_prototypes.lookup.json` - Reference emotion names

## Out of Scope (MUST NOT Change)

- `data/schemas/expression.schema.json` - Schema already complete (note: `priority` and `prerequisites` are optional, but will be provided for each new file)
- `data/mods/core/lookups/emotion_prototypes.lookup.json` - Reference only
- Any existing mod files
- Expression services (separate tickets)
- Anger expressions (EXPSYSBRA-008)

## Implementation Details

### 1. `deep_despair.expression.json`

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

### 2. `quiet_grief.expression.json`

```json
{
  "id": "core:quiet_grief",
  "description": "Deep but contained grief, mourning without dramatic display",
  "priority": 70,
  "prerequisites": [
    {
      "logic": {
        "and": [
          {">=": [{"var": "emotions.grief"}, 0.55]},
          {">=": [{"var": "emotions.sadness"}, 0.50]},
          {"<=": [{"var": "moodAxes.arousal"}, 20]}
        ]
      }
    }
  ],
  "actor_description": "The loss sits heavy in my chest - not screaming, but present. Always present.",
  "description_text": "{actor} moves slowly, almost carefully, as though the world has become fragile around them. Their eyes hold a distant heaviness.",
  "alternate_descriptions": {
    "auditory": "A heavy silence emanates from nearby, punctuated by a single, quiet sigh."
  },
  "tags": ["grief", "sadness", "mourning", "quiet"]
}
```

### 3. `melancholic_disappointment.expression.json`

```json
{
  "id": "core:melancholic_disappointment",
  "description": "Wistful sadness mixed with lingering disappointment over something lost or unrealized",
  "priority": 55,
  "prerequisites": [
    {
      "logic": {
        "and": [
          {">=": [{"var": "emotions.disappointment"}, 0.45]},
          {">=": [{"var": "emotions.sadness"}, 0.35]},
          {"<=": [{"var": "moodAxes.valence"}, -20]}
        ]
      }
    }
  ],
  "actor_description": "The thought lingers - what could have been, what should have been. It aches in a quiet, patient way.",
  "description_text": "{actor}'s gaze drifts toward nothing in particular, a wistful softness and faint regret settling over their features.",
  "alternate_descriptions": {
    "auditory": "You hear a soft, melancholic hum trailing off into silence."
  },
  "tags": ["disappointment", "sadness", "wistful", "nostalgia"]
}
```

### 4. `lonely_isolation.expression.json`

```json
{
  "id": "core:lonely_isolation",
  "description": "Profound sense of isolation and disconnection from others",
  "priority": 60,
  "prerequisites": [
    {
      "logic": {
        "and": [
          {">=": [{"var": "emotions.loneliness"}, 0.55]},
          {"<=": [{"var": "moodAxes.engagement"}, -30]},
          {"<=": [{"var": "moodAxes.valence"}, -25]}
        ]
      }
    }
  ],
  "actor_description": "Even surrounded by people, I feel utterly alone. Like I'm behind glass, watching but never quite touching.",
  "description_text": "{actor} seems to draw inward, their posture closed and their attention turned somewhere far away from the present moment.",
  "alternate_descriptions": {
    "auditory": "The space around {actor} feels strangely quiet, as if sound itself keeps its distance."
  },
  "tags": ["loneliness", "isolation", "disconnection"]
}
```

### 5. `tearful_sorrow.expression.json`

```json
{
  "id": "core:tearful_sorrow",
  "description": "Active crying or near-crying state from overwhelming sadness",
  "priority": 75,
  "prerequisites": [
    {
      "logic": {
        "and": [
          {">=": [{"var": "emotions.sadness"}, 0.65]},
          {">=": [{"var": "moodAxes.arousal"}, 25]},
          {"<=": [{"var": "moodAxes.valence"}, -40]}
        ]
      }
    }
  ],
  "actor_description": "The tears come whether I want them to or not. Everything feels too much, too raw.",
  "description_text": "{actor}'s eyes glisten with unshed tears, their breath catching as they struggle to maintain composure.",
  "alternate_descriptions": {
    "auditory": "You hear a stifled sob and the sound of someone trying to steady their breathing.",
    "tactile": "You feel a slight tremor nearby, someone's body shaking with suppressed emotion."
  },
  "tags": ["sadness", "crying", "sorrow", "tears"]
}
```

### Priority Guidelines (Sadness Spectrum)

- **80**: Deep despair (most severe)
- **75**: Tearful sorrow (actively crying)
- **70**: Quiet grief (significant but controlled)
- **60**: Lonely isolation
- **55**: Melancholic disappointment (milder, more wistful)

### Differentiation Strategy

| State | Key Differentiators |
|-------|---------------------|
| Deep despair | High despair + very low future_expectancy |
| Quiet grief | Grief + low arousal (controlled) |
| Melancholic disappointment | Disappointment + sadness + negative valence |
| Lonely isolation | Loneliness + low engagement |
| Tearful sorrow | Sadness + HIGH arousal (active tears) |

## Acceptance Criteria

### Tests That Must Pass

1. **Schema Validation**
   - All expression files pass JSON schema validation
   - Run: `npm run validate`

2. **Content Tests: `tests/integration/mods/core/expressions/sadness.expression.test.js`** (new file)
   - `deep_despair requires high despair AND very low future_expectancy`
   - `tearful_sorrow requires sadness with HIGH arousal (differentiates from quiet grief)`
   - `quiet_grief requires grief with LOW arousal`
   - `lonely_isolation considers engagement axis`
   - `melancholic_disappointment requires disappointment with negative valence`
   - `all sadness expressions have valid {actor} placeholder`

### Invariants That Must Remain True

1. **Valid JSON** - All files parse correctly
2. **Schema compliant** - All files validate against expression.schema.json (requires `id`, `description`, `actor_description`, `description_text`)
3. **Unique IDs** - No duplicate expression IDs (including across anger)
4. **Valid emotion references** - Only reference emotions from prototypes (sadness, grief, despair, loneliness, disappointment)
5. **Proper placeholder usage** - `{actor}` in description_text
6. **Priority ordering** - More severe states have higher priority
7. **Differentiated prerequisites** - Each expression has distinct trigger conditions

## Estimated Size

- 5 new JSON files
- ~30-50 lines each
- No code changes

## Dependencies

- No code dependencies for content/schema tests
- Can run in parallel with: EXPSYSBRA-008 (anger expressions)

## Notes

- Emotion prototypes include: sadness, grief, despair, loneliness, disappointment
- Use arousal to differentiate active vs passive sadness
- Use future_expectancy for hopelessness/despair
- Use engagement for isolation/disconnection
- Use disappointment + sadness + negative valence for the melancholic slot (no melancholy/longing prototypes exist)
- Descriptions should be emotionally evocative without being melodramatic

## Outcome

Created five sadness expressions, substituting melancholic_disappointment for the originally planned melancholic_longing due to missing prototypes, and added a dedicated sadness expression integration test file aligned with the updated prerequisites.
