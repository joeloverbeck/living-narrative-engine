# Badger-Folk Male Recipe Implementation Spec

## Overview

Create the anatomy infrastructure and recipe for Pitch, a badger-folk male character in the dredgers mod. Badgers are mustelids (same family as ermines/weasels), so we leverage existing `mustelid_core.part.json`.

## Character Requirements (from pitch.character.json)

- **Species**: Badger-folk
- **Gender**: Male
- **Age**: Mid-forties
- **Build**: "Built low and dense with broad shoulders"
- **Hands**: "Scarred hands from years of demolition work"
- **Profession**: Ex-military sapper, civilian demolitionist
- **Recipe ID required**: `dredgers:badger_folk_male_standard`

---

## Implementation Plan

### Phase 1: Create Blueprint

**File**: `data/mods/anatomy-creatures/blueprints/badger_folk_male.blueprint.json`

Pattern follows `ermine_folk_female.blueprint.json`:
- Compose from `anatomy-creatures:mustelid_core` (NOT rodent_core - badgers are mustelids)
- Root torso: `anatomy-creatures:badger_folk_male_torso`
- Override slots for male anatomy (penis, testicles)
- Add tail slot at `lower_back` socket
- Include clothing slot mappings for back/tail accessories

### Phase 2: Create Badger-Folk Torso Entity

**File**: `data/mods/anatomy-creatures/entities/definitions/badger_folk_male_torso.entity.json`

Pattern follows `beaver_folk_male_torso.entity.json`:
- subType: "torso", hit_probability_weight: 45, health_calculation_weight: 10
- Health: 50/50
- Sockets (14): neck, left/right_shoulder, left/right_hip, penis, left/right_testicle, asshole, left/right_ass, heart_socket, spine_socket, lower_back (for tail)
- Damage propagation rules for heart and spine
- Descriptors: build "stocky", texture "fuzzy"
- Weight: 35kg
- Visibility rules: clothingSlotId "torso_upper", nonBlockingLayers ["underwear", "accessories"]

### Phase 3: Create Badger-Specific Body Parts

All in `data/mods/anatomy-creatures/entities/definitions/`:

#### 3a. Badger Ear
**File**: `badger_ear.entity.json`
- subType: "ear", hit_probability_weight: 0.5, health_calculation_weight: 1
- Health: 8/8
- Descriptors: texture "fuzzy", shape "round"
- Weight: 0.012kg
- Name: "badger ear"

#### 3b. Badger Tail
**File**: `badger_tail.entity.json`
- subType: "tail", hit_probability_weight: 1.5, health_calculation_weight: 1
- Health: 6/6 (short tail = less health)
- Descriptors: texture "fuzzy", length "short", flexibility "flexible"
- Weight: 0.08kg
- Name: "badger tail"

#### 3c. Badger Hand (Demolition Scarred)
**File**: `badger_hand_demolition_scarred.entity.json`
- subType: "hand", hit_probability_weight: 3, health_calculation_weight: 2
- Health: 15/15
- anatomy:can_grab component (gripStrength: 1)
- Descriptors: texture "scarred", skin_condition ["callused", "work-worn"], nail_condition (length: "blunt", condition: "chipped"), professional_markers (profession: "demolitionist", markers: ["demolition-calluses", "explosive-residue-stains"])
- Weight: 0.45kg
- Name: "hand"

### Phase 4: Create Recipe

**File**: `data/mods/dredgers/recipes/badger_folk_male_standard.recipe.json`

Key elements:
- blueprintId: `anatomy-creatures:badger_folk_male`
- bodyDescriptors: height "short", build "stocky", composition "dense", skinColor "brown", hairDensity "furred"
- Slots for: torso, head, heart, spine, brain, left/right_ear, tail, left/right_hand, penis
- Patterns for: eyes (brown), arms (muscular), legs, feet, testicles, ass_cheeks
- clothingEntities: [] (empty - Pitch has no predefined outfit)

### Phase 5: Update Mod Manifests

#### 5a. anatomy-creatures/mod-manifest.json
Add to `content.entities.definitions` (maintain alphabetical order):
- `badger_ear.entity.json`
- `badger_folk_male_torso.entity.json`
- `badger_hand_demolition_scarred.entity.json`
- `badger_tail.entity.json`

Add to `content.blueprints`:
- `badger_folk_male.blueprint.json`

#### 5b. dredgers/mod-manifest.json
Add to `content.recipes`:
- `badger_folk_male_standard.recipe.json`

Add to `content.entities.definitions` (Pitch character):
- `grit_wheathook.character.json` (already tracked in git status)
- `pitch.character.json`

---

## Files Summary

### New Files (6):
1. `data/mods/anatomy-creatures/blueprints/badger_folk_male.blueprint.json`
2. `data/mods/anatomy-creatures/entities/definitions/badger_folk_male_torso.entity.json`
3. `data/mods/anatomy-creatures/entities/definitions/badger_ear.entity.json`
4. `data/mods/anatomy-creatures/entities/definitions/badger_tail.entity.json`
5. `data/mods/anatomy-creatures/entities/definitions/badger_hand_demolition_scarred.entity.json`
6. `data/mods/dredgers/recipes/badger_folk_male_standard.recipe.json`

### Modified Files (2):
1. `data/mods/anatomy-creatures/mod-manifest.json`
2. `data/mods/dredgers/mod-manifest.json`

---

## Validation Strategy

After each file creation, run:
```bash
npm run validate:recipe data/mods/dredgers/recipes/badger_folk_male_standard.recipe.json
```

### Success Criteria
Recipe passes validation with ONLY these 3 warnings:
- spine: missing description
- heart: missing description
- brain: missing description

---

## Template References

| Component | Template File |
|-----------|---------------|
| Blueprint | `ermine_folk_female.blueprint.json` |
| Male Torso | `beaver_folk_male_torso.entity.json` |
| Ear | `ermine_ear.entity.json` |
| Tail | `ermine_tail.entity.json` |
| Hand | `humanoid_hand_diver.entity.json` |
| Recipe | `beaver_folk_male.recipe.json` |

---

## Key Decisions

1. **Core part**: Use `mustelid_core` (badgers are mustelids, NOT rodents like beavers)
2. **Eyes**: Use existing `anatomy:human_eye_brown` (badgers have small dark eyes)
3. **Ears**: Create badger-specific (slightly different from ermine - rounder, more prominent)
4. **Tail**: Badgers have notably short tails - shorter than ermine
5. **Nose/Teeth**: Use humanoid defaults (like beaver recipe does for some parts)
6. **Hands**: Character-specific scarred demolition hands for Pitch's profession
7. **No clothing**: Recipe has empty clothingEntities (unlike Saffi with diving gear)
