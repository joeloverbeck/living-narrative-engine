# Large Mod Granularity Splitting Analysis

**Date**: 2026-01-02
**Scope**: Architecture analysis for splitting large mods into thematically-coherent sub-mods
**Target**: Largest mods by action count in `data/mods/`

---

## Executive Summary

This report analyzes the mod structure of the Living Narrative Engine to identify opportunities for splitting large mods into smaller, more maintainable units. The analysis found:

- **113 distinct mods** exist in `data/mods/`
- **sex-penile-oral** has the most actions (24), followed by **affection** (20)
- The codebase has a mature **paired mod pattern** (`[interaction]` + `[interaction]-states`)
- Recommended action count per mod: **2-16 actions** for maintainability

---

## Mod Action Count Rankings (Top 25)

| Rank | Mod | Action Count | Candidate for Split? |
|------|-----|--------------|----------------------|
| 1 | sex-penile-oral | 24 | ✅ Yes - Exceeds 20 threshold |
| 2 | affection | 20 | ⚠️ At threshold |
| 3 | music | 17 | ⚠️ Consider |
| 4 | kissing | 16 | ✅ Well-organized |
| 5 | caressing | 12 | ✅ Well-organized |
| 6 | sex-breastplay | 10 | ✅ Appropriate size |
| 7 | ballet | 10 | ✅ Appropriate size |
| 8 | seduction | 8 | ✅ Appropriate size |
| 9 | physical-control | 8 | ✅ Appropriate size |
| 10 | straddling | 7 | ✅ Appropriate size |

---

## Detailed Analysis: sex-penile-oral (24 Actions)

### Current Structure

```
data/mods/sex-penile-oral/
├── actions/         (24 files)
├── conditions/      (24 files)
├── rules/           (24 files)
└── scopes/          (2 files)
```

### Action Inventory by Thematic Category

#### Category 1: Teasing & Pre-Oral (5 actions)
| Action | Position | Description |
|--------|----------|-------------|
| `breathe_teasingly_on_penis` | Kneeling | Anticipation-building breath play |
| `breathe_teasingly_on_penis_lying_close` | Lying | Same, lying position |
| `breathe_teasingly_on_penis_sitting_close` | Sitting | Same, sitting position |
| `nuzzle_penis_through_clothing` | Kneeling | Clothed teasing |
| `nuzzle_penis_through_clothing_sitting_close` | Sitting | Same, sitting position |

#### Category 2: Glans Stimulation (4 actions)
| Action | Position | Description |
|--------|----------|-------------|
| `lick_glans` | Kneeling | Sensitive tip stimulation |
| `lick_glans_lying_close` | Lying | Same, lying position |
| `lick_glans_sitting_close` | Sitting | Same, sitting position |

#### Category 3: Testicle Play (6 actions)
| Action | Position | Description |
|--------|----------|-------------|
| `lick_testicles_sensually` | Kneeling | Licking technique |
| `lick_testicles_lying_close` | Lying | Same, lying position |
| `lick_testicles_sitting_close` | Sitting | Same, sitting position |
| `suckle_testicle` | Kneeling | Suckling technique |
| `suckle_testicle_lying_close` | Lying | Same, lying position |
| `suckle_testicle_sitting_close` | Sitting | Same, sitting position |

#### Category 4: Blowjob Core (5 actions)
| Action | Position | Description |
|--------|----------|-------------|
| `take_penis_in_mouth` | Sitting | Blowjob initiation |
| `take_penis_in_mouth_kneeling` | Kneeling | Same, kneeling position |
| `take_penis_in_mouth_lying_close` | Lying | Same, lying position |
| `suck_penis_slowly` | Any | Slow technique |
| `suck_penis_hard` | Any | Intense technique |

#### Category 5: Control & Climax (4 actions)
| Action | Position | Description |
|--------|----------|-------------|
| `guide_blowjob_with_hand` | Any | Receiver guides pace |
| `ejaculate_in_mouth` | Any | Climax event |
| `pull_penis_out_of_mouth` | Any | Sensual withdrawal (giver) |
| `pull_own_penis_out_of_mouth` | Any | Sensual withdrawal (receiver) |
| `pull_penis_out_of_mouth_revulsion` | Any | Disgusted withdrawal (giver) |

### Recommended Split: 3 Sub-Mods

#### Sub-Mod 1: `sex-penile-oral-teasing` (5 actions)
**Purpose**: Pre-oral anticipation and clothed teasing

**Actions**:
- `breathe_teasingly_on_penis` (+ lying/sitting variants)
- `nuzzle_penis_through_clothing` (+ sitting variant)

**Dependencies**: `clothing`, `personal-space-states`, `deference-states`, `sitting-states`, `lying-states`

**Rationale**: Distinct foreplay phase; optionally skippable; minimal state requirements

---

#### Sub-Mod 2: `sex-penile-oral-worship` (10 actions)
**Purpose**: Non-penetrative oral stimulation focused on glans and testicles

**Actions**:
- `lick_glans` (+ lying/sitting variants) - 3 actions
- `lick_testicles_sensually` (+ lying/sitting variants) - 3 actions
- `suckle_testicle` (+ lying/sitting variants) - 4 actions

**Dependencies**: `sex-states`, `deference-states`, `sitting-states`, `lying-states`, `personal-space-states`

**Rationale**: Coherent anatomical focus; manual techniques without penetration

---

#### Sub-Mod 3: `sex-penile-oral-blowjob` (9 actions)
**Purpose**: Complete blowjob sequence including initiation, techniques, and termination

**Actions**:
- `take_penis_in_mouth` (+ kneeling/lying variants) - 3 actions
- `suck_penis_slowly`, `suck_penis_hard` - 2 actions
- `guide_blowjob_with_hand` - 1 action
- `ejaculate_in_mouth` - 1 action
- `pull_penis_out_of_mouth` (sensual/revulsion) - 2 actions

**Scopes to Include**:
- `sex-penile-oral:actor_giving_blowjob_to_me`
- `sex-penile-oral:receiving_blowjob_from_actor`

**Dependencies**: `sex-states`, `deference-states`, `sitting-states`, `lying-states`, `personal-space-states`

**Rationale**: Complete blowjob lifecycle; includes shared scopes for perspective-aware actions

---

### Migration Strategy

```
sex-penile-oral/          → DEPRECATED (meta-mod or remove)
├── sex-penile-oral-teasing/
│   ├── actions/ (5)
│   ├── conditions/ (5)
│   └── rules/ (5)
├── sex-penile-oral-worship/
│   ├── actions/ (10)
│   ├── conditions/ (10)
│   └── rules/ (10)
└── sex-penile-oral-blowjob/
    ├── actions/ (9)
    ├── conditions/ (9)
    ├── rules/ (9)
    └── scopes/ (2)
```

---

## Detailed Analysis: affection (20 Actions)

### Current Structure

```
data/mods/affection/
├── actions/         (20 files)
├── conditions/      (20 files)
├── rules/           (20 files)
├── scopes/          (10 files)
└── components/      (0 files - states delegated)
```

### Action Inventory by Thematic Category

#### Category 1: Gentle Touch (5 actions)
| Action | Description |
|--------|-------------|
| `brush_hand` | Gentle hand-to-hand contact |
| `touch_nose_tenderly` | Tender nose touch |
| `pat_head_affectionately` | Pat on head |
| `tickle_target_playfully` | Playful tickling |
| `push_target_playfully` | Light playful shove |

#### Category 2: Arm & Shoulder Embrace (5 actions)
| Action | Description |
|--------|-------------|
| `sling_arm_around_shoulders` | Friendly arm around shoulders |
| `wrap_arm_around_waist` | Arm around waist |
| `link_arms` | Supportive arm linking |
| `place_hands_on_shoulders` | Hands on shoulders |
| `place_hand_on_waist` | Hand on waist |

#### Category 3: Hair Touch (3 actions)
| Action | Description |
|--------|-------------|
| `brush_hair_behind_ear` | Gentle hair brushing |
| `ruffle_hair_playfully` | Playful hair tousle |
| *(pat_head could also fit here)* | |

#### Category 4: Intimate Comfort (4 actions)
| Action | Description |
|--------|-------------|
| `rest_head_on_shoulder` | Head on shoulder |
| `rest_head_against_chest` | Head on chest (with breasts) |
| `rest_head_against_flat_chest` | Head on chest (without breasts) |
| `place_hands_on_chest` / `place_hands_on_flat_chest` | Chest variants |

#### Category 5: Therapeutic & Playful (3 actions)
| Action | Description |
|--------|-------------|
| `massage_shoulders` | Shoulder massage |
| `massage_back` | Back massage |
| `pat_ass_affectionately` | Gentle pat |

### Recommended Split: 4 Sub-Mods

#### Sub-Mod 1: `affection-gentle-touch` (5 actions)
**Purpose**: Minimal, casual affectionate contact with no intimate anatomy requirements

**Actions**:
- `brush_hand`
- `touch_nose_tenderly`
- `pat_head_affectionately`
- `tickle_target_playfully`
- `push_target_playfully`

**Dependencies**: `personal-space-states` (minimal)

**Rationale**: Lowest intimacy, simplest scope requirements, reusable across contexts

---

#### Sub-Mod 2: `affection-embracing` (5 actions)
**Purpose**: Arm and shoulder-based connection gestures

**Actions**:
- `sling_arm_around_shoulders`
- `wrap_arm_around_waist`
- `link_arms`
- `place_hands_on_shoulders`
- `place_hand_on_waist`

**Dependencies**: `personal-space-states`, `facing-states`, `hugging-states` (conflict detection)

**Rationale**: Coherent physical positioning around upper body

---

#### Sub-Mod 3: `affection-hair-touch` (3 actions)
**Purpose**: Hair and grooming gestures

**Actions**:
- `brush_hair_behind_ear`
- `ruffle_hair_playfully`
- *(Could merge with gentle-touch if too small)*

**Dependencies**: `personal-space-states`, anatomy (hair)

**Rationale**: Specialized anatomy requirements (hair component)

---

#### Sub-Mod 4: `affection-intimate-comfort` (5 actions)
**Purpose**: Head-to-chest intimate comfort positions with anatomy variants

**Actions**:
- `rest_head_on_shoulder`
- `rest_head_against_chest`
- `rest_head_against_flat_chest`
- `place_hands_on_chest`
- `place_hands_on_flat_chest`

**Scopes to Include**: Chest anatomy-specialized scopes (4-5)

**Dependencies**: `personal-space-states`, `facing-states`, `kissing`, `hugging-states`, `sex-states`

**Rationale**: Anatomically-specialized variants requiring complex forbidden states

---

#### Sub-Mod 5: `affection-therapeutic` (3 actions)
**Purpose**: Massage and therapeutic touch

**Actions**:
- `massage_shoulders`
- `massage_back`
- `pat_ass_affectionately`

**Dependencies**: `personal-space-states`, `caressing-states`, `facing-states`

**Rationale**: Distinct therapeutic purpose; different positioning (facing-away)

---

### Alternative: 3-Mod Split

If 5 sub-mods is too granular:

1. **affection-casual** (8): gentle-touch + embracing
2. **affection-intimate** (7): hair-touch + intimate-comfort
3. **affection-therapeutic** (3): massage + playful-touch

---

## Architectural Patterns Reference

### The `-states` Pairing Pattern

The codebase uses a consistent pattern with **24 paired mods**:

```
[interaction] + [interaction]-states
   ↓                    ↓
 ACTIONS            COMPONENTS & SCOPES
 RULES              (No actions/rules)
 CONDITIONS         (No conditions)
 SCOPES
```

### Recommended Action Counts

| Size | Actions | Example | Notes |
|------|---------|---------|-------|
| Small | 2-5 | sitting (2), hand-holding (5) | Usually has paired `-states` |
| Medium | 5-12 | caressing (12), hugging (4) | Always has paired `-states` |
| Large | 12-20 | kissing (16), affection (20) | At or near threshold |
| Too Large | 20+ | sex-penile-oral (24) | **Should be split** |

### Gold-Standard Examples

1. **sitting + sitting-states**: Minimal complexity, 2 actions, clean separation
2. **hugging + hugging-states**: Bidirectional states (`hugging` + `being_hugged`)
3. **kissing**: Self-contained thematic mod (16 actions), includes own component

---

## Implementation Recommendations

### Priority 1: Split sex-penile-oral (24 → 3 mods)
- **Effort**: Medium
- **Impact**: High (largest mod)
- **Risk**: Low (clear thematic boundaries)

### Priority 2: Review affection (20 actions)
- **Effort**: Medium-High
- **Impact**: Medium (at threshold, not exceeding)
- **Risk**: Medium (shared scopes need careful management)

### Priority 3: Create `-states` mods where missing
- Identify large mods without state separation
- Extract shared state components

---

## Complete Mod Inventory (113 mods)

### Organized by Domain

**Core & Infrastructure**:
- core, items-core, containers-core, base-clothing

**Positioning & Movement**:
- sitting, sitting-states, lying, lying-states, bending, bending-states
- straddling, straddling-states, movement, facing, facing-states

**Physical Interaction**:
- hugging, hugging-states, grabbing, grabbing-states
- hand-holding, hand-holding-states, physical-control, physical-control-states

**Affection & Intimacy**:
- affection, caressing, caressing-states, kissing
- seduction, personal-space, personal-space-states

**Sexual Content**:
- sex-core, sex-states, sex-dry-intimacy, sex-breastplay
- sex-penile-oral, sex-penile-manual, sex-physical-control
- sex-vaginal-penetration, sex-anal-penetration

**Combat & Violence**:
- weapons, striking, attack-states, lethal-violence, creature-attacks
- aiming, aiming-states, ranged, strangling-states

**Body & Anatomy**:
- anatomy, anatomy-creatures, breathing, breathing-states
- biting-states, damage-types

**Clothing & Items**:
- clothing, underwear, base-clothing, outer-clothing, accessories, armor
- inventory, item-handling, item-handling-states, item-transfer, item-placement
- containers, valuables, cosmetics

**Skills & Activities**:
- music, ballet, gymnastics, reading, writing, skills
- drinking, drinking-states, smoking, exercise, recovery, recovery-states

**Environment & World**:
- locations, furniture, lighting, locks, mechanisms
- dimensional-travel, patrol, observation, perception

**Fantasy & Special**:
- fantasy, vampirism, hexing, warding
- intoxicants, liquids, liquids-states

**Emotional States**:
- deference, deference-states, distress, comfort, companionship

**Performance & Events**:
- performances-states, breaching, breaching-states, first-aid

**Scenario-Specific**:
- archive-scenario, p_erotica, p_erotica_kern, p_erotica_gymnast
- p_erotica_duchess, p_erotica_irun, p_erotica_swiss, dredgers

**Utility**:
- blockers, descriptors

---

## Conclusion

The Living Narrative Engine has achieved excellent architectural discipline through consistent application of the paired mod pattern. The primary recommendation is to split `sex-penile-oral` (24 actions) into 3 thematically-coherent sub-mods:

1. **sex-penile-oral-teasing** (5 actions) - Foreplay phase
2. **sex-penile-oral-worship** (10 actions) - Non-penetrative stimulation
3. **sex-penile-oral-blowjob** (9 actions) - Complete sequence

The `affection` mod (20 actions) is at the threshold and could optionally be split into 3-5 sub-mods based on intimacy level and anatomy requirements.

---

*Report generated by architectural analysis workflow*
