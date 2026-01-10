# Specification: Affect Traits Component and Affiliation Mood Axis

## Status: ✅ ARCHIVED - Feature Fully Implemented

This specification has been fully implemented. All tickets in the AFFTRAANDAFFAXI series are complete.

---

## Problem Statement

The current emotion transformation system produces psychologically incorrect results for characters with certain personality profiles. Specifically, a sociopathic character with high engagement and self-evaluation incorrectly triggers "compassion: moderate" because the system lacks stable trait-based modulation of empathy-dependent emotions.

### Example Scenario

A sociopath character starts with:
```json
"core:mood": {
  "valence": 15,
  "arousal": 45,
  "agency_control": 75,
  "threat": 20,
  "engagement": 80,
  "future_expectancy": 10,
  "self_evaluation": 90
}
```

**Current Result**: `compassion: moderate, pride: intense, interest: strong`

**Problem**: The compassion prototype is wired for "engaged prosocial attentiveness" (dominated by `engagement × 0.85 = 0.68`), not "empathic concern capacity." A sociopath can be highly engaged and socially "warm-performing" without genuine compassion.

### Root Cause

The emotion calculation lacks a **trait dimension** that captures stable empathic capacity. The current 7 mood axes are all fast-moving state/appraisal variables that swing with events. Callousness vs empathic concern is a stable personality trait that should modulate specific emotions.

---

## Solution Overview

Implement a two-part solution:

1. **Affect Traits Component** (`core:affect_traits`): Stable personality traits that modulate empathy-dependent emotions
2. **Affiliation Mood Axis**: Add an 8th mood axis for momentary social warmth/connectedness

```
                    STABLE TRAIT (rarely changes)
                    ┌─────────────────────────────┐
                    │   core:affect_traits        │
                    │   - affective_empathy       │───┐
                    │   - cognitive_empathy       │   │
                    │   - harm_aversion           │   │
                    └─────────────────────────────┘   │
                                                      │ modulates
                    MOMENTARY STATE (changes often)   │
                    ┌─────────────────────────────┐   │
                    │   core:mood (8 axes)        │   │
                    │   - valence                 │───┼──► Emotion
                    │   - arousal                 │   │    Calculation
                    │   - engagement              │   │
                    │   - affiliation (NEW)       │───┘
                    │   - ...                     │
                    └─────────────────────────────┘
```

---

## Design Decisions

1. **Affect traits are stable**: Unlike mood axes, traits rarely change (if at all). They represent enduring character attributes, not momentary states.

2. **Three trait axes**: `affective_empathy`, `cognitive_empathy`, `harm_aversion` - psychologically grounded in empathy research (affective vs cognitive empathy distinction).

3. **Selective application**: Only wire traits into empathy-dependent emotions (compassion, empathic_distress, guilt), not all 87 emotions.

4. **Affiliation axis**: Add momentary social connectedness dimension to mood, capturing interpersonal warmth as a state (orthogonal to agency, per interpersonal circumplex models).

5. **Backwards compatibility**: Entities without `core:affect_traits` use defaults (50 = average human). Existing prototypes without trait weights work unchanged.

6. **No new emotions**: Modify existing prototypes only (compassion, empathic_distress, guilt). No new emotion types created.

---

## Component Schema Design

### 1. Affect Traits Component

**File Created**: `data/mods/core/components/affect_traits.component.json`

```json
{
  "$schema": "schema://living-narrative-engine/component.schema.json",
  "id": "core:affect_traits",
  "description": "Stable personality traits affecting empathy and moral emotion capacity. Unlike mood (transient states), these traits rarely change and represent enduring character attributes.",
  "dataSchema": {
    "type": "object",
    "properties": {
      "affective_empathy": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 50,
        "description": "Capacity to feel what others feel. Allows emotional resonance with others' joy, pain, distress. (0=absent, 50=average, 100=hyper-empathic)"
      },
      "cognitive_empathy": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 50,
        "description": "Ability to understand others' perspectives intellectually. Can be high even when affective empathy is low. (0=none, 50=average, 100=exceptional)"
      },
      "harm_aversion": {
        "type": "integer",
        "minimum": 0,
        "maximum": 100,
        "default": 50,
        "description": "Aversion to causing harm to others. Modulates guilt and inhibits cruelty. (0=enjoys harm, 50=normal aversion, 100=extreme aversion)"
      }
    },
    "required": ["affective_empathy", "cognitive_empathy", "harm_aversion"],
    "additionalProperties": false
  }
}
```

**Design Rationale**:
- Range `[0, 100]` matches `core:sexual_state` pattern (all positive, no bipolar)
- Integer values match existing component conventions
- Default of 50 = "average human" ensures backwards compatibility
- Three distinct traits capture different facets of empathy/moral capacity

### 2. Mood Component Update - Affiliation Axis

**File Modified**: `data/mods/core/components/mood.component.json`

Added new property to `dataSchema.properties`:

```json
"affiliation": {
  "type": "integer",
  "minimum": -100,
  "maximum": 100,
  "default": 0,
  "description": "Social warmth and connectedness. Captures momentary interpersonal orientation. (-100=cold/detached/hostile, 0=neutral, +100=warm/connected/affiliative)"
}
```

**Design Rationale**:
- Bipolar axis `[-100, +100]` matches other mood axes
- Represents the "communion" dimension from interpersonal circumplex theory (orthogonal to agency)
- Captures momentary social warmth, not stable empathic capacity (that's what traits are for)
- A sociopath can have high affiliation (performing warmth) with low affective_empathy (not feeling it)

---

## Emotion Prototype Updates

**File Modified**: `data/mods/core/lookups/emotion_prototypes.lookup.json`

### Emotions Updated with Trait Integration

| Emotion | Trait Integration |
|---------|-------------------|
| `compassion` | `affective_empathy` weight 0.80, gate >= 0.25 |
| `empathic_distress` | `affective_empathy` weight 0.90, gate >= 0.30 |
| `guilt` | `affective_empathy` weight 0.45, `harm_aversion` weight 0.55, gate >= 0.15 |

---

## Implementation Status

### Completed Tickets

- AFFTRAANDAFFAXI-001: Core component definition ✅
- AFFTRAANDAFFAXI-002: Mood affiliation axis ✅
- AFFTRAANDAFFAXI-003: Compassion prototype update ✅
- AFFTRAANDAFFAXI-004: Empathic distress prototype update ✅
- AFFTRAANDAFFAXI-005: Guilt prototype update ✅
- AFFTRAANDAFFAXI-006: EmotionCalculatorService update ✅
- AFFTRAANDAFFAXI-007: Expression diagnostics model (WitnessState) ✅
- AFFTRAANDAFFAXI-008: Unit tests ✅
- AFFTRAANDAFFAXI-009: WitnessState model ✅
- AFFTRAANDAFFAXI-010: MonteCarloSimulator ✅
- AFFTRAANDAFFAXI-011: WitnessStateFinder ✅
- AFFTRAANDAFFAXI-012: Expressions Simulator UI ✅
- AFFTRAANDAFFAXI-013: Expression Diagnostics UI ✅
- AFFTRAANDAFFAXI-014: Integration tests ✅

---

## Verification - Sociopath Scenario

**Input**:
```json
{
  "core:mood": {
    "valence": 15,
    "arousal": 45,
    "agency_control": 75,
    "threat": 20,
    "engagement": 80,
    "future_expectancy": 10,
    "self_evaluation": 90,
    "affiliation": 60
  },
  "core:affect_traits": {
    "affective_empathy": 5,
    "cognitive_empathy": 70,
    "harm_aversion": 10
  }
}
```

**Expected Result** (now working correctly):
- `compassion`: absent or faint (gate `affective_empathy >= 0.25` fails since 0.05 < 0.25) ✅
- `empathic_distress`: absent (gate `affective_empathy >= 0.30` fails) ✅
- `guilt`: absent (gate `affective_empathy >= 0.15` fails) ✅
- `pride`: intense (unaffected by affect traits) ✅
- `interest`: strong (unaffected by affect traits) ✅

---

## Psychological Foundation

This design is grounded in empathy research:

- **Affective vs Cognitive Empathy**: Well-established distinction in psychology. Sociopaths often have normal/high cognitive empathy (understanding others) with low affective empathy (feeling with others).

- **Callous-Unemotional (CU) Traits**: Research on psychopathy specifically identifies CU traits as stable personality factors that predict lack of guilt, remorse, and empathy regardless of situational context.

- **Interpersonal Circumplex**: The affiliation/communion axis is the horizontal dimension in interpersonal models (with agency/dominance as vertical), capturing social warmth as distinct from power/control.

The separation of stable traits from momentary mood states ensures psychologically realistic emotion modeling where personality fundamentally shapes emotional capacity.
