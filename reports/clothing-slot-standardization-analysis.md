# Clothing Slot Standardization Analysis

**Date**: 2025-07-16  
**Author**: Claude Code  
**Purpose**: Analyze and standardize clothing slot mappings in the Living Narrative Engine anatomy system

## Executive Summary

This report analyzes the current state of clothing slot mappings in the Living Narrative Engine, identifies discrepancies and contradictions, and provides recommendations for standardization. Key findings include inconsistent slot naming conventions, gender-specific slots that prevent cross-gender clothing compatibility, and the absence of a backpack slot.

## Current State Analysis

### 1. Anatomy Blueprint Structure

The anatomy system uses a hierarchical approach:

- **Blueprints**: Define complete anatomy structures (`human_male`, `human_female`)
- **Blueprint Parts**: Reusable components (`humanoid_core`)
- **Slot Libraries**: Standardized slot definitions (`humanoid_slots`)
- **Clothing Slot Mappings**: Map clothing slots to anatomy attachment points

### 2. Current Clothing Slot Mappings

#### Male Blueprint (`anatomy:human_male`)

```json
{
  "torso_lower": [
    "left_hip",
    "right_hip",
    "pubic_hair",
    "penis",
    "left_testicle",
    "right_testicle"
  ],
  "full_body": ["head", "left_arm", "right_arm", "left_leg", "right_leg"],
  "genital_covering": ["penis", "left_testicle", "right_testicle"],
  "torso_upper": ["torso"],
  "legs": ["left_leg", "right_leg"],
  "left_arm_clothing": ["left_arm"],
  "right_arm_clothing": ["right_arm"],
  "feet": ["left_foot", "right_foot"]
}
```

#### Female Blueprint (`anatomy:human_female`)

```json
{
  "bra": ["left_breast", "right_breast"],
  "torso_lower": ["left_hip", "right_hip", "pubic_hair", "vagina"],
  "full_body": [
    "head",
    "left_arm",
    "right_arm",
    "left_leg",
    "right_leg",
    "left_breast",
    "right_breast"
  ],
  "panties": ["vagina", "pubic_hair"],
  "torso_upper": [
    "left_shoulder",
    "right_shoulder",
    "left_chest",
    "right_chest"
  ],
  "legs": ["left_leg", "right_leg"],
  "left_arm_clothing": ["left_arm"],
  "right_arm_clothing": ["right_arm"],
  "feet": ["left_foot", "right_foot"]
}
```

### 3. Clothing Entity Slot Usage

Analysis of clothing entity definitions reveals the following slot usage patterns:

| Clothing Item          | Primary Slot           | Secondary Slots                           |
| ---------------------- | ---------------------- | ----------------------------------------- |
| panties                | `lower_torso_clothing` | -                                         |
| boxers                 | `lower_torso_clothing` | -                                         |
| nude_thong             | `panties`              | -                                         |
| bra                    | `torso_clothing`       | -                                         |
| underwired_plunge_bra  | `bra`                  | -                                         |
| t_shirt                | `torso_clothing`       | -                                         |
| dress_shirt            | `torso_clothing`       | `[left_arm_clothing, right_arm_clothing]` |
| jacket                 | `torso_clothing`       | `[left_arm_clothing, right_arm_clothing]` |
| jeans                  | `lower_torso_clothing` | `[left_leg_clothing, right_leg_clothing]` |
| shorts                 | `lower_torso_clothing` | -                                         |
| sneakers               | `feet_clothing`        | -                                         |
| leather_stiletto_pumps | `feet`                 | -                                         |
| belt                   | `torso_lower`          | -                                         |
| blazer                 | `torso_upper`          | `[left_arm_clothing, right_arm_clothing]` |
| bodysuit               | `full_body`            | -                                         |
| trousers               | `legs`                 | `[torso_lower]`                           |

## Identified Issues and Discrepancies

### 1. Inconsistent Slot Naming Conventions

**Issue**: Multiple naming patterns for similar slots

- Lower body underwear: `lower_torso_clothing` vs `panties` vs `genital_covering`
- Feet: `feet` vs `feet_clothing`
- Torso: `torso_clothing` vs `torso_upper` vs `torso_lower`
- Arms: `left_arm_clothing`/`right_arm_clothing` (consistent)

**Impact**: Confusing for modders, potential for errors, difficult to maintain

### 2. Gender-Specific Underwear Slots

**Issue**: Separate slots for male and female underwear

- Male: `genital_covering` maps to male-specific anatomy
- Female: `panties` maps to female-specific anatomy
- Clothing uses `lower_torso_clothing` but some use gender-specific slots

**Impact**: Cannot have universal underwear items that work for both genders

### 3. Missing Backpack/Accessory Slots

**Issue**: No defined slot for backpacks or back-mounted accessories

- No `back` or `back_accessory` slot in any blueprint
- No attachment point for bags, backpacks, capes, wings, etc.

**Impact**: Cannot implement backpack items without modifying blueprints

### 4. Mapping Mismatches

**Issue**: Clothing expects slots that don't match blueprint definitions

- Clothing uses `_clothing` suffix inconsistently
- Some items use blueprint slot names, others use different conventions
- `torso_lower` used as both anatomy socket list and clothing slot

**Impact**: Potential runtime errors, unclear which slots are valid

## Recommendations

### 1. Standardize Slot Naming Convention

Adopt a consistent naming pattern for all clothing slots:

```
<body_region>_<clothing_type>
```

**Proposed Standard Slots:**

- `head_gear` - Hats, helmets, headbands
- `face_gear` - Masks, glasses, face accessories
- `torso_upper` - Shirts, jackets, chest armor
- `torso_lower` - Belts, waist accessories
- `underwear_upper` - Bras, chest wraps (universal)
- `underwear_lower` - Panties, boxers, briefs (universal)
- `arms` - Sleeves, arm guards (covers both arms)
- `hands` - Gloves, gauntlets
- `legs` - Pants, skirts, leg armor
- `feet` - Shoes, boots, socks
- `full_body` - Dresses, robes, bodysuits
- `back_accessory` - Backpacks, capes, wings

### 2. Implement Universal Underwear Slots

Replace gender-specific underwear slots with universal ones:

```json
// In humanoid_core blueprint part
"clothingSlotMappings": {
  "underwear_lower": {
    "anatomySockets": ["pubic_hair", "genital_socket"],
    "allowedLayers": ["underwear"]
  },
  "underwear_upper": {
    "anatomySockets": ["chest_socket"],
    "allowedLayers": ["underwear"]
  }
}
```

**Implementation Notes:**

- Use generic `genital_socket` that maps to appropriate anatomy
- Use generic `chest_socket` that maps to breasts or chest
- Allow clothing to specify fit variations via properties

### 3. Add Backpack Slot

Add new slot to humanoid_core:

```json
"back_accessory": {
  "anatomySockets": ["upper_back", "lower_back"],
  "allowedLayers": ["accessory", "armor"]
}
```

**Attachment Points:**

- Add `upper_back` and `lower_back` sockets to torso definitions
- Allow for different mounting positions (high/low)

### 4. Migration Strategy

To maintain backward compatibility:

1. **Phase 1**: Add new standardized slots alongside existing ones
2. **Phase 2**: Update clothing definitions to use new slots
3. **Phase 3**: Deprecate old slots with warnings
4. **Phase 4**: Remove deprecated slots in major version

**Compatibility Mapping:**

```json
{
  "legacy_mappings": {
    "lower_torso_clothing": "underwear_lower",
    "panties": "underwear_lower",
    "genital_covering": "underwear_lower",
    "torso_clothing": "torso_upper",
    "bra": "underwear_upper",
    "feet_clothing": "feet"
  }
}
```

## Implementation Plan

### Step 1: Update Slot Library

Create standardized slot definitions in `humanoid_slots` library with clear documentation.

### Step 2: Update Blueprint Parts

Modify `humanoid_core` to include:

- Universal underwear slots
- Back accessory slot
- Standardized naming

### Step 3: Update Gender-Specific Blueprints

- Remove gender-specific clothing slots
- Ensure anatomy sockets support universal slots
- Add back sockets to torso definitions

### Step 4: Create Migration Utilities

- Slot name migration function
- Validation tools to check clothing compatibility
- Documentation for modders

### Step 5: Update Clothing Definitions

- Systematically update all clothing to use new slots
- Add metadata for fit variations where needed

## Testing Considerations

1. **Compatibility Testing**: Ensure old mods still work
2. **Coverage Testing**: Verify all body parts can be clothed
3. **Gender Testing**: Confirm universal underwear works correctly
4. **Layering Testing**: Validate layer restrictions work as intended

## Conclusion

The current clothing slot system has evolved organically, resulting in inconsistencies that make it difficult to create universal clothing items and accessories like backpacks. By standardizing slot names, implementing universal underwear slots, and adding a backpack slot, the system will be more intuitive, maintainable, and extensible.

The proposed changes maintain the flexibility of the current system while providing clearer conventions and better cross-gender compatibility. With careful migration planning, these improvements can be implemented without breaking existing content.

## Appendix: Complete Proposed Slot Mapping

```json
{
  "clothingSlotMappings": {
    "head_gear": {
      "blueprintSlots": ["head"],
      "allowedLayers": ["base", "outer", "armor"]
    },
    "face_gear": {
      "blueprintSlots": ["head"],
      "allowedLayers": ["accessory"]
    },
    "torso_upper": {
      "anatomySockets": ["left_shoulder", "right_shoulder", "chest_center"],
      "allowedLayers": ["underwear", "base", "outer", "armor"]
    },
    "torso_lower": {
      "anatomySockets": ["waist_front", "waist_back", "left_hip", "right_hip"],
      "allowedLayers": ["accessory", "armor"]
    },
    "underwear_upper": {
      "anatomySockets": ["chest_center", "chest_support"],
      "allowedLayers": ["underwear"]
    },
    "underwear_lower": {
      "anatomySockets": ["pelvis_front", "pelvis_back", "genital_area"],
      "allowedLayers": ["underwear"]
    },
    "arms": {
      "blueprintSlots": ["left_arm", "right_arm"],
      "allowedLayers": ["base", "outer", "armor"]
    },
    "hands": {
      "blueprintSlots": ["left_hand", "right_hand"],
      "allowedLayers": ["base", "armor"]
    },
    "legs": {
      "blueprintSlots": ["left_leg", "right_leg"],
      "allowedLayers": ["underwear", "base", "outer", "armor"]
    },
    "feet": {
      "blueprintSlots": ["left_foot", "right_foot"],
      "allowedLayers": ["base", "armor"]
    },
    "full_body": {
      "blueprintSlots": [
        "head",
        "torso",
        "left_arm",
        "right_arm",
        "left_leg",
        "right_leg"
      ],
      "allowedLayers": ["outer"]
    },
    "back_accessory": {
      "anatomySockets": ["upper_back", "lower_back"],
      "allowedLayers": ["accessory", "armor"]
    }
  }
}
```
