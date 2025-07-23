# Intimacy and Sex Mod Immersion Enhancement Specification

## Executive Summary

This specification outlines comprehensive enhancements to the intimacy and sex mods in Living Narrative Engine to create a more immersive, realistic, and emotionally engaging simulation. The proposed changes introduce emotional state tracking, progressive intimacy systems, enhanced physical interactions, and sophisticated consent mechanics while maintaining the modular architecture and data-driven design philosophy of the engine.

## Table of Contents

1. [Gap Analysis](#gap-analysis)
2. [New Component Proposals](#new-component-proposals)
3. [New System Proposals](#new-system-proposals)
4. [Enhanced Action Catalog](#enhanced-action-catalog)
5. [Enhanced Scopes](#enhanced-scopes)
6. [Integration Architecture](#integration-architecture)
7. [Implementation Considerations](#implementation-considerations)

## Gap Analysis

### Current State Assessment

The existing intimacy and sex mods provide a foundation for romantic and sexual interactions but lack several key elements that would create a truly immersive simulation:

#### Missing Emotional Depth

- No arousal or desire tracking system
- No mood or emotional state components
- No attraction or chemistry mechanics
- No comfort level or trust tracking
- No tension or anticipation building

#### Limited Physical Interactions

- Missing foreplay actions (neck kissing, ear nibbling, gentle touches)
- No progressive undressing mechanics
- Limited body exploration actions
- No position-aware interactions
- Missing non-sexual intimate touches (hair stroking, hand holding, embracing)

#### Absent Progression Systems

- No escalation or de-escalation mechanics
- No consent negotiation system
- No relationship progression tracking
- No memory of past intimate encounters
- No preference learning system

#### Missing Environmental Context

- No privacy awareness
- No location appropriateness checks
- No time-of-day influences
- No interruption handling
- No ambient mood factors

#### Limited Communication

- No verbal consent actions
- No dirty talk or sweet nothings
- No non-verbal cues (blushing, breathing changes)
- No rejection handling beyond pulling away
- No aftercare actions

### Critical Gaps for Immersion

1. **Emotional State Management**: The absence of arousal, mood, and attraction tracking means interactions feel mechanical rather than driven by desire and emotion.

2. **Progressive Intimacy**: Current system jumps from kissing to explicit acts without the gradual build-up that creates tension and anticipation.

3. **Consent Dynamics**: While closeness component provides basic consent, there's no nuanced consent negotiation or enthusiasm tracking.

4. **Physical Realism**: Missing many common intimate actions that would occur in realistic romantic encounters.

5. **Contextual Awareness**: No consideration of environment, privacy, or appropriateness of actions.

## New Component Proposals

### 1. Arousal Component

```json
{
  "id": "intimacy:arousal",
  "description": "Tracks character's current arousal level and contributing factors",
  "dataSchema": {
    "type": "object",
    "properties": {
      "level": {
        "type": "number",
        "minimum": 0,
        "maximum": 100,
        "description": "Current arousal level (0-100)"
      },
      "sources": {
        "type": "object",
        "additionalProperties": {
          "type": "number",
          "description": "Arousal contribution from specific source"
        }
      },
      "decay_rate": {
        "type": "number",
        "default": 0.5,
        "description": "How quickly arousal decreases per turn"
      }
    },
    "required": ["level", "sources"]
  }
}
```

### 2. Attraction Component

```json
{
  "id": "intimacy:attraction",
  "description": "Tracks attraction levels toward other entities",
  "dataSchema": {
    "type": "object",
    "properties": {
      "attractions": {
        "type": "object",
        "additionalProperties": {
          "type": "object",
          "properties": {
            "physical": { "type": "number", "minimum": 0, "maximum": 100 },
            "emotional": { "type": "number", "minimum": 0, "maximum": 100 },
            "intellectual": { "type": "number", "minimum": 0, "maximum": 100 },
            "overall": { "type": "number", "minimum": 0, "maximum": 100 }
          }
        }
      }
    }
  }
}
```

### 3. Comfort Level Component

```json
{
  "id": "intimacy:comfort_level",
  "description": "Tracks comfort and trust levels with other entities",
  "dataSchema": {
    "type": "object",
    "properties": {
      "levels": {
        "type": "object",
        "additionalProperties": {
          "type": "object",
          "properties": {
            "physical_comfort": {
              "type": "number",
              "minimum": 0,
              "maximum": 100
            },
            "emotional_trust": {
              "type": "number",
              "minimum": 0,
              "maximum": 100
            },
            "boundaries": {
              "type": "array",
              "items": { "type": "string" },
              "description": "Actions this entity is not comfortable with"
            }
          }
        }
      }
    }
  }
}
```

### 4. Intimate Mood Component

```json
{
  "id": "intimacy:mood",
  "description": "Current intimate/romantic mood state",
  "dataSchema": {
    "type": "object",
    "properties": {
      "state": {
        "type": "string",
        "enum": [
          "neutral",
          "flirty",
          "romantic",
          "passionate",
          "tender",
          "playful",
          "nervous",
          "reluctant"
        ]
      },
      "intensity": {
        "type": "number",
        "minimum": 0,
        "maximum": 100
      },
      "modifiers": {
        "type": "array",
        "items": { "type": "string" }
      }
    }
  }
}
```

### 5. Sexual Tension Component

```json
{
  "id": "intimacy:sexual_tension",
  "description": "Unresolved sexual tension with other entities",
  "dataSchema": {
    "type": "object",
    "properties": {
      "tensions": {
        "type": "object",
        "additionalProperties": {
          "type": "number",
          "minimum": 0,
          "maximum": 100
        }
      }
    }
  }
}
```

### 6. Physical State Component

```json
{
  "id": "sex:physical_state",
  "description": "Physical arousal manifestations",
  "dataSchema": {
    "type": "object",
    "properties": {
      "breathing": {
        "type": "string",
        "enum": ["normal", "quickened", "heavy", "panting"]
      },
      "flushed": {
        "type": "boolean",
        "default": false
      },
      "trembling": {
        "type": "boolean",
        "default": false
      },
      "heart_rate": {
        "type": "string",
        "enum": ["normal", "elevated", "racing"]
      }
    }
  }
}
```

### 7. Intimacy History Component

```json
{
  "id": "intimacy:history",
  "description": "Tracks intimate interaction history",
  "dataSchema": {
    "type": "object",
    "properties": {
      "encounters": {
        "type": "object",
        "additionalProperties": {
          "type": "object",
          "properties": {
            "last_intimate_action": { "type": "string" },
            "highest_intimacy_level": { "type": "string" },
            "favorite_actions": {
              "type": "array",
              "items": { "type": "string" }
            },
            "boundaries_discovered": {
              "type": "array",
              "items": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```

## New System Proposals

### 1. Progressive Intimacy System

**Purpose**: Manage the natural progression of intimate encounters, ensuring realistic escalation and de-escalation.

**Key Features**:

- Intimacy level tracking (casual touch → kissing → heavy petting → sexual acts)
- Action gating based on current intimacy level
- Natural progression requirements (can't skip levels)
- De-escalation handling for comfort maintenance

**Rules**:

- Each action has an intimacy level requirement
- Successful actions can increase intimacy level
- Rejected actions decrease intimacy level
- Time decay brings intimacy back to baseline

### 2. Dynamic Consent System

**Purpose**: Create nuanced consent mechanics beyond binary yes/no.

**Key Features**:

- Enthusiasm levels (reluctant → willing → eager → enthusiastic)
- Non-verbal consent cues
- Boundary communication
- Consent withdrawal mechanics
- Aftercare and check-ins

**Implementation**:

- New consent-related actions (ask permission, express boundaries)
- Consent state tracking in relationships
- AI decision-making based on character personality and current state

### 3. Arousal Management System

**Purpose**: Track and manage arousal states dynamically.

**Key Features**:

- Multi-source arousal tracking
- Different arousal types (visual, physical, emotional)
- Build-up and release mechanics
- Frustration tracking
- Refractory periods

**Mechanics**:

- Actions contribute to arousal based on character preferences
- High arousal unlocks certain actions
- Unresolved arousal creates tension
- Environmental factors affect arousal

### 4. Environmental Context System

**Purpose**: Make intimate interactions context-aware.

**Key Features**:

- Privacy detection (public/private spaces)
- Interruption possibilities
- Time-of-day influences
- Location appropriateness
- Ambient mood factors (lighting, temperature, comfort)

**Implementation**:

- New location properties for privacy levels
- Interruption events and handling
- Mood modifiers based on environment

### 5. Communication Enhancement System

**Purpose**: Enable verbal and non-verbal intimate communication.

**Key Features**:

- Dirty talk actions with personality-based generation
- Sweet nothing whispers
- Non-verbal cues (moaning, sighing, gasping)
- Consent verbalization
- Preference communication

## Enhanced Action Catalog

### New Intimacy Actions

#### Gentle Touches

- `caress_face` - Gently caress partner's face
- `stroke_hair` - Run fingers through partner's hair
- `hold_hands` - Intertwine fingers intimately
- `embrace_tenderly` - Pull into a warm, full-body embrace
- `nuzzle_neck` - Nuzzle face into partner's neck
- `trail_fingers_along_arm` - Light sensual touch along arm
- `rest_head_on_shoulder` - Intimate, comfortable closeness

#### Neck and Ear Actions

- `kiss_neck_softly` - Gentle kisses on neck
- `nibble_earlobe` - Playfully nibble on ear
- `whisper_in_ear` - Whisper sweet/sexy words
- `breathe_on_neck` - Deliberate sensual breathing
- `suck_on_neck` - Leave a hickey (with consent)

#### Progressive Kissing

- `kiss_forehead` - Tender forehead kiss
- `kiss_jawline` - Trail kisses along jaw
- `kiss_collarbone` - Sensual collarbone kisses
- `bite_lip_gently` - Gentle lip bite during kiss
- `kiss_with_tongue_teasing` - Teasing tongue play

#### Undressing Actions

- `unbutton_slowly` - Slowly unbutton clothing
- `slide_off_clothing` - Sensually remove garment
- `help_undress` - Assist partner in undressing
- `reveal_partially` - Tease by partial reveal
- `strip_seductively` - Performative undressing

#### Body Exploration

- `trace_muscles` - Admire and touch muscle definition
- `kiss_chest` - Kiss chest/breasts area
- `caress_thighs` - Sensual thigh touching
- `explore_curves` - Appreciate body curves
- `worship_body` - Reverent full-body attention

#### Communication Actions

- `ask_what_feels_good` - Verbal consent and preference check
- `express_desire` - Verbalize what you want
- `moan_softly` - Non-verbal pleasure expression
- `gasp_with_pleasure` - Sudden pleasure response
- `whisper_sweet_nothings` - Romantic verbal intimacy
- `talk_dirty` - Explicit verbal arousal
- `ask_to_continue` - Check-in during intimacy
- `express_boundaries` - Communicate limits

#### Environmental Actions

- `dim_lights` - Set romantic lighting
- `lock_door` - Ensure privacy
- `lay_on_bed` - Move to comfortable surface
- `put_on_music` - Set romantic ambiance
- `light_candles` - Create intimate atmosphere

### New Sex Actions

#### Foreplay

- `stimulate_clitoris` - Focused clitoral stimulation
- `finger_vagina` - Digital penetration
- `stroke_penis` - Manual stimulation
- `tease_entrance` - Build anticipation
- `use_lubricant` - Apply lubrication
- `explore_erogenous_zones` - Find sensitive spots

#### Oral Actions

- `kiss_inner_thighs` - Teasing approach
- `lick_genitals` - Oral stimulation
- `suck_gently` - Gentle suction
- `use_tongue_creatively` - Varied techniques
- `maintain_eye_contact` - Intimate connection

#### Position Changes

- `straddle_partner` - Mount partner
- `flip_positions` - Change who's on top
- `adjust_angle` - Optimize for pleasure
- `wrap_legs_around` - Deepen connection
- `press_against_wall` - Standing position

#### During Sex

- `move_rhythmically` - Establish rhythm
- `change_pace` - Vary speed/intensity
- `grind_together` - Grinding motion
- `hold_tightly` - Emotional connection
- `synchronize_breathing` - Intimate connection

#### Aftercare

- `cuddle_afterwards` - Post-sex intimacyP
- `kiss_gently_after` - Tender aftercare
- `check_in_emotionally` - Ensure partner is okay
- `get_water` - Care for partner's needs
- `clean_up_together` - Intimate cleanup

## Enhanced Scopes

### Emotion-Based Scopes

#### `intimacy:attracted_actors`

Returns actors that this entity has attraction toward (>50 overall attraction).

#### `intimacy:aroused_actors`

Returns actors in location with arousal level >40.

#### `intimacy:comfortable_partners`

Returns actors with high comfort level (>70) with this entity.

#### `intimacy:actors_with_sexual_tension`

Returns actors with whom this entity has unresolved sexual tension.

### State-Based Scopes

#### `intimacy:actors_ready_for_more`

Returns partners whose arousal and comfort levels indicate readiness for escalation.

#### `intimacy:actors_showing_reluctance`

Returns partners showing signs of discomfort or reluctance.

#### `sex:actors_physically_aroused`

Returns actors with physical arousal manifestations.

### Context-Aware Scopes

#### `intimacy:actors_in_private`

Returns potential partners when in a private location.

#### `intimacy:discreet_partners`

Returns partners who would be discreet about intimacy.

### History-Based Scopes

#### `intimacy:previous_partners`

Returns actors with whom entity has intimate history.

#### `intimacy:actors_with_favorite_actions`

Returns actors whose favorite actions match what entity wants to do.

## Integration Architecture

### Component Interactions

```
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│    Arousal      │────▶│   Attraction    │────▶│  Comfort Level   │
└─────────────────┘     └─────────────────┘     └──────────────────┘
         │                       │                        │
         ▼                       ▼                        ▼
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ Physical State  │     │ Sexual Tension  │     │ Intimacy History │
└─────────────────┘     └─────────────────┘     └──────────────────┘
         │                       │                        │
         └───────────────────────┴────────────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ Action Decision │
                        └─────────────────┘
```

### System Integration Points

1. **AI Decision Making**: Components feed into AI prompts for realistic character behavior
2. **Event System**: New events for arousal changes, consent given/withdrawn, intimacy milestones
3. **Memory System**: Integration with notes system to remember preferences and experiences
4. **Perception System**: How intimate actions are perceived by others
5. **Rule Priorities**: Consent and comfort checks before action execution

### Data Flow Example

1. Player attempts intimate action
2. System checks:
   - Consent (closeness + comfort level)
   - Arousal levels
   - Environmental context
   - Intimacy progression level
3. If approved:
   - Execute action
   - Update arousal states
   - Modify relationship components
   - Trigger appropriate events
   - Update character memories

## Implementation Considerations

### Performance

- Component updates should be batched
- Arousal decay processed periodically, not every turn
- Scope queries optimized with caching
- AI prompts carefully sized to avoid token bloat

### Content Ratings

- Clear separation between intimacy and sex mods
- Configurable content filters
- Age-gating for explicit content
- Cultural sensitivity options

### AI Integration

- Expanded prompts for personality-based intimate behavior
- Consent logic in AI decision-making
- Preference learning from player actions
- Dynamic dirty talk generation based on personality

### Testing Strategy

- Consent system edge cases
- Arousal calculation balance
- Performance with many simultaneous intimate encounters
- AI behavior consistency

### Backwards Compatibility

- Existing saves continue to work
- Components optional until actively used
- Gradual migration path for existing content

## Conclusion

These enhancements would transform the intimacy and sex mods from basic action systems into sophisticated simulations of human romantic and sexual interaction. By adding emotional depth, progressive mechanics, and contextual awareness, the system would create emergent narratives that feel authentic and engaging while respecting player agency and character consent.

The modular design ensures that mod developers can adopt these systems incrementally, using only the components and features that fit their vision while maintaining compatibility with the existing ecosystem.
