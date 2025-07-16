# Clothing Slot Analysis Report

## Executive Summary

This report analyzes the clothing slot system in the Living Narrative Engine, examining definitions across anatomy blueprints, parts, and libraries, as well as their usage in clothing entity definitions and recipes.

### Key Findings

- **🚨 Critical Slot Mismatches**: 9 clothing entities reference undefined slots
- **📋 Unused Defined Slots**: 8 defined slots have no corresponding clothing entities
- **🧥 Unused Clothing Entities**: 9 out of 16 clothing entities are not used in any recipe
- **⚠️ Inconsistent Naming**: Mixed naming conventions between definitions and usage

---

## 1. Defined Clothing Slots

### From Anatomy Blueprints and Libraries

The clothing slot system is defined across multiple files:

#### Human Male Blueprint (`human_male.blueprint.json`)
- `underwear_upper` - covers chest/breast area
- `underwear_lower` - covers genital area
- `back_accessory` - covers back area
- `torso_lower` - covers hip/lower torso area
- `full_body` - covers entire body
- `genital_covering` - covers male genitals specifically
- `torso_upper` - covers upper torso
- `legs` - covers both legs
- `left_arm_clothing` - covers left arm
- `right_arm_clothing` - covers right arm
- `feet` - covers both feet

#### Human Female Blueprint (`human_female.blueprint.json`)
Additional slots specific to female anatomy:
- `bra` - covers breast area specifically
- `panties` - covers female genital area

#### Humanoid Slot Library (`humanoid.slot-library.json`)
Standard definitions referenced by humanoid_core:
- `standard_head_gear` → `head_gear`
- `standard_face_gear` → `face_gear`
- `standard_torso_upper` → `torso_upper` (redefined)
- `standard_hands` → `hands`
- `standard_legs` → `legs` (redefined)
- `standard_feet` → `feet` (redefined)
- `standard_underwear_upper` → `underwear_upper` (redefined)
- `standard_underwear_lower` → `underwear_lower` (redefined)
- `standard_torso_lower` → `torso_lower` (redefined)
- `standard_back_accessory` → `back_accessory` (redefined)

#### Complete Defined Slots List
1. `underwear_upper`
2. `underwear_lower`
3. `back_accessory`
4. `torso_lower`
5. `full_body`
6. `genital_covering` (male-specific)
7. `torso_upper`
8. `legs`
9. `left_arm_clothing`
10. `right_arm_clothing`
11. `feet`
12. `bra` (female-specific)
13. `panties` (female-specific)
14. `head_gear`
15. `face_gear`
16. `hands`

**Total: 16 defined clothing slots**

---

## 2. Clothing Entity Slot Usage

### Slot Mapping by Entity

| Entity | Primary Slot | Secondary Slots | Status |
|--------|-------------|----------------|--------|
| `underwired_plunge_bra_nude_silk` | `bra` | - | ✅ Valid |
| `nude_thong` | `underwear_lower` | - | ✅ Valid |
| `black_stretch_silk_bodysuit` | `full_body` | - | ✅ Valid |
| `white_structured_linen_blazer` | `torso_upper` | `left_arm_clothing`, `right_arm_clothing` | ✅ Valid |
| `graphite_wool_wide_leg_trousers` | `legs` | `torso_lower` | ✅ Valid |
| `black_calfskin_belt` | `torso_lower` | - | ✅ Valid |
| `leather_stiletto_pumps` | `feet` | - | ✅ Valid |
| `bra` | `underwear_upper` | - | ✅ Valid |
| `panties` | `underwear_lower` | - | ✅ Valid |
| `boxers` | `underwear_lower` | - | ✅ Valid |
| `t_shirt` | `torso_clothing` | - | ❌ **UNDEFINED SLOT** |
| `sneakers` | `feet_clothing` | - | ❌ **UNDEFINED SLOT** |
| `shorts` | `lower_torso_clothing` | - | ❌ **UNDEFINED SLOT** |
| `jeans` | `lower_torso_clothing` | `left_leg_clothing`, `right_leg_clothing` | ❌ **UNDEFINED SLOTS** |
| `jacket` | `torso_clothing` | `left_arm_clothing`, `right_arm_clothing` | ❌ **UNDEFINED SLOT** |
| `dress_shirt` | `torso_clothing` | `left_arm_clothing`, `right_arm_clothing` | ❌ **UNDEFINED SLOT** |
| `basic_shirt` | `torso_clothing` | `left_arm_clothing`, `right_arm_clothing` | ❌ **UNDEFINED SLOT** |

---

## 3. Critical Issues Found

### 🚨 Slot Mismatches (Entities Using Undefined Slots)

The following clothing entities reference slots that are **not defined** in any blueprint:

#### Undefined Slots Referenced:
1. **`torso_clothing`** - Used by:
   - `t_shirt`
   - `jacket`
   - `dress_shirt`
   - `basic_shirt`

2. **`feet_clothing`** - Used by:
   - `sneakers`

3. **`lower_torso_clothing`** - Used by:
   - `shorts`
   - `jeans`

4. **`left_leg_clothing`** - Used by:
   - `jeans`

5. **`right_leg_clothing`** - Used by:
   - `jeans`

**Total: 5 undefined slots referenced by 9 entities**

### 📋 Unused Defined Slots

The following slots are defined in blueprints but have **no corresponding clothing entities**:

1. **`head_gear`** - Defined in slot library
2. **`face_gear`** - Defined in slot library  
3. **`hands`** - Defined in slot library
4. **`back_accessory`** - Defined in blueprints
5. **`genital_covering`** - Defined in male blueprint
6. **`panties`** - Defined in female blueprint (but has entity `panties` using `underwear_lower`)
7. **`left_arm_clothing`** - Only used as secondary slot
8. **`right_arm_clothing`** - Only used as secondary slot

**Total: 8 unused defined slots**

### 🧥 Unused Clothing Entities

The following clothing entities are **not referenced** in the `amaia_castillo.recipe.json`:

1. `t_shirt`
2. `sneakers`
3. `shorts`
4. `jeans`
5. `jacket`
6. `dress_shirt`
7. `basic_shirt`
8. `bra`
9. `panties`
10. `boxers`

**Total: 9 out of 16 clothing entities are unused**

### ✅ Entities Used in Recipe

Only **7 entities** are used in the `amaia_castillo.recipe.json`:

1. `underwired_plunge_bra_nude_silk`
2. `nude_thong`
3. `black_stretch_silk_bodysuit`
4. `white_structured_linen_blazer`
5. `graphite_wool_wide_leg_trousers`
6. `black_calfskin_belt`
7. `leather_stiletto_pumps`

---

## 4. Recommendations

### 🔧 Immediate Actions Required

1. **Standardize Slot Names**: Add missing slot definitions to blueprints:
   - Add `torso_clothing` (or map to existing `torso_upper`)
   - Add `feet_clothing` (or map to existing `feet`)
   - Add `lower_torso_clothing` (or map to existing `legs`)
   - Add `left_leg_clothing` and `right_leg_clothing` (or map to existing `legs`)

2. **Fix Entity Definitions**: Update entities to use correct slot names:
   - Map `torso_clothing` → `torso_upper`
   - Map `feet_clothing` → `feet`
   - Map `lower_torso_clothing` → `legs`
   - Map `left_leg_clothing` → `legs`
   - Map `right_leg_clothing` → `legs`

3. **Resolve Panties Slot**: Entity `panties` uses `underwear_lower` but female blueprint defines `panties` slot - determine intended usage

### 📊 Long-term Improvements

1. **Create Clothing for Unused Slots**: Develop entities for:
   - `head_gear` (hats, caps, helmets)
   - `face_gear` (glasses, masks)
   - `hands` (gloves, mittens)
   - `back_accessory` (backpacks, cloaks)
   - `genital_covering` (specialized undergarments)

2. **Recipe Expansion**: Create additional recipes using the unused entities to provide variety

3. **Slot System Documentation**: Create clear documentation for:
   - Slot naming conventions
   - Blueprint hierarchy and inheritance
   - Layer system interaction

---

## 5. Summary Tables

### Slot Usage Summary
| Category | Count | Percentage |
|----------|-------|------------|
| Defined Slots | 16 | 100% |
| Slots Used by Entities | 8 | 50% |
| Unused Defined Slots | 8 | 50% |
| Undefined Slots Referenced | 5 | - |
| Entities with Slot Mismatches | 9 | 56% |

### Entity Usage Summary
| Category | Count | Percentage |
|----------|-------|------------|
| Total Clothing Entities | 16 | 100% |
| Entities Used in Recipe | 7 | 44% |
| Unused Entities | 9 | 56% |
| Entities with Valid Slots | 7 | 44% |
| Entities with Invalid Slots | 9 | 56% |

---

## 6. Reference Data

### All Defined Slots with Sources
```
underwear_upper (human_male, human_female, humanoid_core)
underwear_lower (human_male, human_female, humanoid_core)
back_accessory (human_male, human_female, humanoid_core)
torso_lower (human_male, human_female, humanoid_core)
full_body (human_male, human_female)
genital_covering (human_male only)
torso_upper (human_male, human_female, humanoid_core)
legs (human_male, human_female, humanoid_core)
left_arm_clothing (human_male, human_female)
right_arm_clothing (human_male, human_female)
feet (human_male, human_female, humanoid_core)
bra (human_female only)
panties (human_female only)
head_gear (humanoid_core)
face_gear (humanoid_core)
hands (humanoid_core)
```

### All Clothing Entities with Slots
```
underwired_plunge_bra_nude_silk → bra
nude_thong → underwear_lower
black_stretch_silk_bodysuit → full_body
white_structured_linen_blazer → torso_upper + arms
graphite_wool_wide_leg_trousers → legs + torso_lower
black_calfskin_belt → torso_lower
leather_stiletto_pumps → feet
bra → underwear_upper
panties → underwear_lower
boxers → underwear_lower
t_shirt → torso_clothing (UNDEFINED)
sneakers → feet_clothing (UNDEFINED)
shorts → lower_torso_clothing (UNDEFINED)
jeans → lower_torso_clothing + leg_clothing (UNDEFINED)
jacket → torso_clothing + arms (UNDEFINED)
dress_shirt → torso_clothing + arms (UNDEFINED)
basic_shirt → torso_clothing + arms (UNDEFINED)
```

---

*Report generated on: 2024-07-16*
*Analysis scope: Anatomy blueprints, parts, libraries, and clothing entity definitions*