# EXPSYSBRA-010: Core Expression Content - Joy/Arousal Category

## Summary

Create core expression content files for joy and arousal-related emotional states (joy, excitement, contentment, desire).

## Status

Completed.

## Background

This ticket adds expression content files covering positive emotions and arousal states. These expressions differentiate between high-energy joy (excitement), calm satisfaction (contentment), affectionate warmth, playful fun, and intense desire using mood axes like `arousal`, `valence`, and `engagement`.

## Assumptions Rechecked

- Emotion prototypes include `joy`, `contentment`, `amusement`, `enthusiasm`, `euphoria`, `affection`, and `love_attachment`.
- Emotion prototypes do NOT include `tenderness`, `playfulness`, or `attraction`.
- Sexual state prototypes include `sexual_lust` (and others like `passionate_love`, `romantic_yearning`). There is no `sexualStates.desire` entry.
- Expression JSON files should include the `$schema` field, consistent with existing core expressions.
- There is no existing `joy-arousal.expression.test.js`; a new integration test must be added following the anger/sadness test pattern.

## File List (Expected to Touch)

### New Files
- `data/mods/core/expressions/euphoric_excitement.expression.json`
- `data/mods/core/expressions/quiet_contentment.expression.json`
- `data/mods/core/expressions/warm_affection.expression.json`
- `data/mods/core/expressions/playful_mischief.expression.json`
- `data/mods/core/expressions/intense_desire.expression.json`
- `tests/integration/mods/core/expressions/joy-arousal.expression.test.js`

### Files to Verify (NOT modify)
- `data/schemas/expression.schema.json` - Validate against schema
- `data/mods/core/lookups/emotion_prototypes.lookup.json` - Reference emotion names
- `data/mods/core/lookups/sexual_prototypes.lookup.json` - Reference sexual state names

## Out of Scope (MUST NOT Change)

- `data/schemas/expression.schema.json` - Schema already complete
- `data/mods/core/lookups/emotion_prototypes.lookup.json` - Reference only
- `data/mods/core/lookups/sexual_prototypes.lookup.json` - Reference only
- Any existing mod files
- Expression services (separate tickets)
- Anger expressions (EXPSYSBRA-008)
- Sadness expressions (EXPSYSBRA-009)

## Implementation Details

### 1. `euphoric_excitement.expression.json`

```json
{
  "$schema": "schema://living-narrative-engine/expression.schema.json",
  "id": "core:euphoric_excitement",
  "description": "High-energy joy with elevated arousal and positive valence.",
  "priority": 70,
  "prerequisites": [
    {
      "logic": {
        "and": [
          {">=": [{"var": "emotions.euphoria"}, 0.55]},
          {">=": [{"var": "moodAxes.arousal"}, 45]},
          {">=": [{"var": "moodAxes.valence"}, 40]}
        ]
      }
    }
  ],
  "actor_description": "Energy surges through me. I feel alive, electric, ready for anything.",
  "description_text": "{actor}'s eyes shine with barely contained excitement, their movements quick and animated.",
  "alternate_descriptions": {
    "auditory": "You hear an infectious, energetic laugh bubbling up nearby."
  },
  "tags": ["joy", "excitement", "energy", "positive"]
}
```

### 2. `quiet_contentment.expression.json`

```json
{
  "$schema": "schema://living-narrative-engine/expression.schema.json",
  "id": "core:quiet_contentment",
  "description": "Calm satisfaction and peaceful happiness - low arousal positive state.",
  "priority": 45,
  "prerequisites": [
    {
      "logic": {
        "and": [
          {">=": [{"var": "emotions.contentment"}, 0.50]},
          {"<=": [{"var": "moodAxes.arousal"}, 30]},
          {">=": [{"var": "moodAxes.valence"}, 25]}
        ]
      }
    }
  ],
  "actor_description": "A gentle warmth settles in my chest. Everything feels right, somehow.",
  "description_text": "{actor} radiates a quiet calm, their posture relaxed and their expression softened with gentle satisfaction.",
  "alternate_descriptions": {
    "auditory": "You hear a soft, contented sigh from nearby."
  },
  "tags": ["contentment", "peace", "satisfaction", "calm"]
}
```

### 3. `warm_affection.expression.json`

```json
{
  "$schema": "schema://living-narrative-engine/expression.schema.json",
  "id": "core:warm_affection",
  "description": "Tender feelings of love and care toward others.",
  "priority": 55,
  "prerequisites": [
    {
      "logic": {
        "and": [
          {">=": [{"var": "emotions.affection"}, 0.50]},
          {">=": [{"var": "emotions.love_attachment"}, 0.35]},
          {">=": [{"var": "moodAxes.engagement"}, 20]}
        ]
      }
    }
  ],
  "actor_description": "My heart swells with warmth. I want to reach out, to connect, to show them they matter.",
  "description_text": "{actor}'s gaze softens noticeably, their body language open and inviting, radiating gentle warmth.",
  "alternate_descriptions": {
    "auditory": "You hear a voice nearby, soft and tender in its tone.",
    "tactile": "You sense a gentle, welcoming presence moving closer."
  },
  "tags": ["affection", "love", "warmth", "connection"]
}
```

### 4. `playful_mischief.expression.json`

```json
{
  "$schema": "schema://living-narrative-engine/expression.schema.json",
  "id": "core:playful_mischief",
  "description": "Lighthearted playfulness with a hint of mischief.",
  "priority": 50,
  "prerequisites": [
    {
      "logic": {
        "and": [
          {">=": [{"var": "emotions.amusement"}, 0.45]},
          {">=": [{"var": "moodAxes.engagement"}, 10]},
          {">=": [{"var": "moodAxes.arousal"}, 20]},
          {">=": [{"var": "moodAxes.valence"}, 15]}
        ]
      }
    }
  ],
  "actor_description": "A spark of mischief lights up inside me. This could be fun...",
  "description_text": "{actor}'s lips curl into an impish grin, a mischievous glint dancing in their eyes.",
  "alternate_descriptions": {
    "auditory": "You hear a playful chuckle, barely suppressed."
  },
  "tags": ["playful", "mischief", "amusement", "fun"]
}
```

### 5. `intense_desire.expression.json`

```json
{
  "$schema": "schema://living-narrative-engine/expression.schema.json",
  "id": "core:intense_desire",
  "description": "Strong romantic or sexual desire - high arousal wanting state.",
  "priority": 75,
  "prerequisites": [
    {
      "logic": {
        "and": [
          {">=": [{"var": "sexualStates.sexual_lust"}, 0.60]},
          {">=": [{"var": "sexualArousal"}, 0.50]},
          {">=": [{"var": "moodAxes.arousal"}, 50]}
        ]
      }
    }
  ],
  "actor_description": "Heat rises through me. I'm acutely aware of them - every movement, every breath.",
  "description_text": "{actor}'s gaze becomes intent and focused, their breathing slightly quickened, an unmistakable intensity in their presence.",
  "alternate_descriptions": {
    "auditory": "You hear someone's breathing grow heavier, more deliberate.",
    "tactile": "You sense a charged tension in the air, a palpable warmth radiating nearby."
  },
  "tags": ["desire", "arousal", "intense", "sexual"]
}
```

### Priority Guidelines (Joy/Arousal Spectrum)

- **75**: Intense desire (strong sexual/romantic state)
- **70**: Euphoric excitement (high-energy joy)
- **55**: Warm affection (tender emotional connection)
- **50**: Playful mischief (lighthearted fun)
- **45**: Quiet contentment (calm satisfaction)

### Differentiation Strategy

| State | Key Differentiators |
| --- | --- |
| Euphoric excitement | Euphoria + high arousal + high valence |
| Quiet contentment | Contentment + LOW arousal |
| Warm affection | Affection + love attachment + engagement |
| Playful mischief | Amusement + engagement + moderate arousal |
| Intense desire | Sexual lust + high sexual arousal + high mood arousal |

## Acceptance Criteria

### Tests That Must Pass

1. **Schema Validation**
   - All expression files pass JSON schema validation
   - Run: `npm run validate`

2. **Content Tests: `tests/integration/mods/core/expressions/joy-arousal.expression.test.js`**
   - `euphoric_excitement requires high arousal`
   - `quiet_contentment requires LOW arousal`
   - `intense_desire uses sexualStates.sexual_lust and sexualArousal`
   - `warm_affection considers engagement axis`
   - `all joy/arousal expressions have valid {actor} placeholder`

### Invariants That Must Remain True

1. **Valid JSON** - All files parse correctly
2. **Schema compliant** - All files validate against expression.schema.json
3. **Unique IDs** - No duplicate expression IDs (including across anger/sadness)
4. **Valid emotion references** - Only reference emotions from prototypes
5. **Proper placeholder usage** - `{actor}` in description_text
6. **Priority ordering** - More intense states have higher priority
7. **Differentiated prerequisites** - Each expression has distinct trigger conditions
8. **Sexual state usage** - `sexualStates.sexual_lust` and `sexualArousal` used correctly for desire expression

## Estimated Size

- 5 new JSON files
- 1 new integration test file
- ~30-50 lines each
- No code changes

## Dependencies

- Depends on: EXPSYSBRA-006 (DI registration must be complete to test)
- Can run in parallel with: EXPSYSBRA-008, EXPSYSBRA-009 (other content tickets)

## Notes

- Emotion prototypes include: joy, contentment, amusement, enthusiasm, euphoria, affection, love_attachment
- Sexual states include: sexual_lust, romantic_yearning, passionate_love (accessed via `sexualStates` in context)
- Use arousal axis to differentiate high-energy vs calm positive states
- Use engagement for social/connection-based emotions
- Descriptions should feel genuine and evocative without being overwrought

## Outcome

Created five joy/arousal expressions and a new joy/arousal integration test file, adjusting prerequisites to use available prototypes (euphoria, love_attachment, sexual_lust, sexualArousal) instead of the originally assumed tenderness/playfulness/attraction/desire fields.
