# Specification: New Clothing Entity Definitions - Pastel Loungewear Collection

**Document Version:** 1.0
**Date:** 2025-11-03
**Status:** Draft - Awaiting Approval

---

## Executive Summary

### Purpose

This specification defines 13 new clothing entity definitions for the Living Narrative Engine, forming a cohesive "pastel loungewear" collection. These items represent comfortable, cozy, feminine loungewear and sleepwear with a soft color palette.

### Design Philosophy

Each item is designed to be unique, even when similar item types exist in the system. The collection emphasizes:
- **Comfort-focused materials**: Cotton, fleece, soft synthetics
- **Pastel color palette**: Pale pink, lavender, mint green, peach, baby blue, blush pink, white
- **Cozy aesthetic**: Fuzzy textures, soft fabrics, decorative details (bows, hearts, lace)
- **Loungewear versatility**: Suitable for home wear, sleep, and casual comfort

### Collection Overview

- **13 new items** spanning multiple clothing categories
- **2 new clothing categories**: Nightgowns, sweatpants (currently non-existent)
- **Existing categories expanded**: Hoodies, shorts, socks, slippers, camisoles, robes, tanks
- **No duplicates**: Each item justified as unique despite similar types existing

---

## Descriptor Component Additions Required

### New Texture Enum Values

**Component:** `descriptors:texture`
**File:** `data/mods/descriptors/components/texture.component.json`

**Values to add:**

1. **`"soft"`**
   - **Description**: "Gentle to touch, yielding and comfortable"
   - **Use cases**: Sweatpants, comfortable base layer clothing, plush items
   - **Rationale**: Current enum lacks a descriptor for general soft/comfortable fabrics. Existing alternatives (`smooth`, `silky`, `velvety`) don't capture the tactile quality of cotton sweatpants or similar items.

2. **`"fuzzy"`**
   - **Description**: "Covered with fine fibers or fuzz, creating a plush texture"
   - **Use cases**: Fuzzy slippers, fuzzy socks, sherpa-lined items
   - **Rationale**: Distinct from `velvety` (smooth pile) - fuzzy implies longer, looser fibers creating a plush, almost furry texture.

3. **`"fleece"`**
   - **Description**: "Soft insulating synthetic fabric with deep pile"
   - **Use cases**: Fleece hoodies, fleece-lined garments, athletic wear
   - **Rationale**: Fleece is a specific fabric texture commonly used in loungewear and athletic wear, distinct from wool or terry cloth.

### New Material Enum Value

**Component:** `core:material`
**File:** `data/mods/descriptors/components/material.component.json`

**Value to add:**

1. **`"fleece"`**
   - **Description**: "Synthetic insulating fabric, typically polyester-based"
   - **Properties**: `["breathable", "flexible", "insulating"]`
   - **Use cases**: Hoodies, jackets, athletic wear
   - **Rationale**: Fleece is a standard loungewear/athletic material distinct from natural wool or cotton, commonly used for comfort and warmth.

---

## Item Specifications

### Item 1: Oversized Pale Pink Hoodie with White Heart Patches

**Entity ID:** `clothing:pale_pink_fleece_hoodie_heart_patches`
**File Name:** `pale_pink_fleece_hoodie_heart_patches.entity.json`

**Justification for Creation:**
Existing hoodie (`charcoal_heather_zip_up_hoodie`) is gray and lacks decorative elements. This item introduces pale pink color and heart pattern decoration, creating a distinct feminine loungewear aesthetic.

**Component Specifications:**

- **`clothing:wearable`**
  - `layer`: `"outer"`
  - `equipmentSlots.primary`: `"torso_upper"`
  - `equipmentSlots.secondary`: `["left_arm_clothing", "right_arm_clothing"]`
  - `allowedLayers`: `["underwear", "base", "outer"]`

- **`core:material`**
  - `material`: `"fleece"` (NEW ENUM VALUE)
  - `properties`: `["breathable", "flexible", "insulating"]`

- **`descriptors:color_extended`**
  - `color`: `"pale-pink"`

- **`descriptors:texture`**
  - `texture`: `"fleece"` (NEW ENUM VALUE)

- **`descriptors:pattern`**
  - `pattern`: `"heart"`

- **`clothing:coverage_mapping`**
  - `covers`: `["torso_upper", "left_arm_clothing", "right_arm_clothing"]`
  - `coveragePriority`: `"outer"`

- **`items:weight`**
  - `weight`: `0.65` (based on existing hoodie weight)

- **`core:name`**
  - `text`: `"Pale Pink Fleece Hoodie with Heart Patches"`

- **`core:description`**
  - `text`: `"An oversized hoodie in the softest pale pink fleece, adorned with white heart-shaped patches scattered across the chest and sleeves. The plush material provides warmth without weight, while the relaxed fit drapes comfortably over the body. A cozy hood frames the face, and deep kangaroo pockets offer a place to warm cold hands or stash small treasures."`

---

### Item 2: Pink Cotton Shorts with White Piping

**Entity ID:** `clothing:pink_cotton_shorts_white_piping`
**File Name:** `pink_cotton_shorts_white_piping.entity.json`

**Justification for Creation:**
Existing shorts include black/red, orange, and red lycra variants. This item introduces pink cotton with white piping trim, a distinct color/material/detail combination suitable for loungewear.

**Component Specifications:**

- **`clothing:wearable`**
  - `layer`: `"base"`
  - `equipmentSlots.primary`: `"legs"`
  - `allowedLayers`: `["underwear", "base"]`

- **`core:material`**
  - `material`: `"cotton"`
  - `properties`: `["breathable", "flexible"]`

- **`descriptors:color_basic`**
  - `color`: `"pink"`

- **`descriptors:texture`**
  - `texture`: `"smooth"`

- **`clothing:coverage_mapping`**
  - `covers`: `["legs"]`
  - `coveragePriority`: `"base"`

- **`items:weight`**
  - `weight`: `0.16` (based on existing running shorts weight)

- **`core:name`**
  - `text`: `"Pink Cotton Shorts with White Piping"`

- **`core:description`**
  - `text`: `"Casual cotton shorts in a soft pink hue, trimmed with crisp white piping along the leg openings and waistband. The lightweight fabric breathes easily against the skin, making them ideal for warm days or lounging indoors. An elastic waistband with a drawstring ensures a comfortable, adjustable fit."`

**Special Notes:**
White piping is a trim detail, not a pattern - described in narrative only, not as a pattern component.

---

### Item 3: White Knee-High Socks with Pink Bows

**Entity ID:** `clothing:white_knee_high_socks_pink_bows`
**File Name:** `white_knee_high_socks_pink_bows.entity.json`

**Justification for Creation:**
Existing sock (`white_thigh_high_socks_pink_hearts`) has pink hearts and goes to thigh height. This item is knee-high (shorter) with bow decorations instead of hearts, creating a distinct variant.

**Component Specifications:**

- **`clothing:wearable`**
  - `layer`: `"underwear"`
  - `equipmentSlots.primary`: `"feet"`
  - `allowedLayers`: `["underwear"]`

- **`core:material`**
  - `material`: `"cotton"`
  - `properties`: `["breathable"]`

- **`descriptors:color_basic`**
  - `color`: `"white"`

- **`descriptors:texture`**
  - `texture`: `"smooth"`

- **`descriptors:length_category`**
  - `length`: `"long"` (knee-high)

- **`clothing:coverage_mapping`**
  - `covers`: `["feet"]`
  - `coveragePriority`: `"underwear"`

- **`items:weight`**
  - `weight`: `0.09` (based on existing sock weights)

- **`core:name`**
  - `text`: `"White Knee-High Socks with Pink Bows"`

- **`core:description`**
  - `text`: `"Pristine white cotton socks that reach just below the knee, finished with delicate pink satin bows at the top of each cuff. The soft knit fabric hugs the leg gently without binding, while the decorative bows add a sweet, feminine touch to an otherwise simple design."`

---

### Item 4: Fuzzy Pink Slippers

**Entity ID:** `clothing:fuzzy_pink_slippers`
**File Name:** `fuzzy_pink_slippers.entity.json`

**Justification for Creation:**
Existing slippers include leather (brown) and foam slide sandals (black). This item introduces pink fuzzy material with a cozy, plush aesthetic distinct from existing options.

**Component Specifications:**

- **`clothing:wearable`**
  - `layer`: `"base"`
  - `equipmentSlots.primary`: `"feet"`
  - `allowedLayers`: `["underwear", "base"]`

- **`core:material`**
  - `material`: `"synthetic"`
  - `properties`: `["flexible"]`

- **`descriptors:color_basic`**
  - `color`: `"pink"`

- **`descriptors:texture`**
  - `texture`: `"fuzzy"` (NEW ENUM VALUE)

- **`clothing:coverage_mapping`**
  - `covers`: `["feet"]`
  - `coveragePriority`: `"base"`

- **`items:weight`**
  - `weight`: `0.52` (based on existing slipper weight)

- **`core:name`**
  - `text`: `"Fuzzy Pink Slippers"`

- **`core:description`**
  - `text`: `"Cloud-soft slippers covered in plush pink faux fur that feels like a gentle hug for tired feet. The fuzzy exterior extends over the entire upper, while a cushioned insole and flexible sole provide comfort for padding around the house. Each step feels like walking on a soft pillow."`

---

### Item 5: Fitted Lavender Camisole with Delicate Lace Trim

**Entity ID:** `clothing:lavender_fitted_camisole_lace_trim`
**File Name:** `lavender_fitted_camisole_lace_trim.entity.json`

**Justification for Creation:**
Existing camisole (`satin_cowl_neck_camisole`) is nude-colored satin with cowl neck. This item introduces lavender color, fitted silhouette, and lace trim detail, creating a distinct sleepwear/loungewear option.

**Component Specifications:**

- **`clothing:wearable`**
  - `layer`: `"underwear"`
  - `equipmentSlots.primary`: `"torso_upper"`
  - `allowedLayers`: `["underwear"]`

- **`core:material`**
  - `material`: `"cotton"`
  - `properties`: `["breathable", "flexible"]`

- **`descriptors:color_extended`**
  - `color`: `"violet"` (closest to lavender in extended palette)

- **`descriptors:texture`**
  - `texture`: `"smooth"`

- **`descriptors:embellishment`**
  - `embellishment`: `"lace"` (via material reference, described in narrative)

- **`clothing:coverage_mapping`**
  - `covers`: `["torso_upper"]`
  - `coveragePriority`: `"underwear"`

- **`items:weight`**
  - `weight`: `0.20` (based on existing camisole weight)

- **`core:name`**
  - `text`: `"Fitted Lavender Camisole with Lace Trim"`

- **`core:description`**
  - `text`: `"A form-fitting camisole in soft lavender cotton that contours smoothly to the body. Delicate lace trim edges the neckline and straps, adding a touch of feminine elegance to the simple silhouette. The lightweight fabric breathes easily, making it perfect for layering or wearing on its own during warm nights."`

**Special Notes:**
Lace is referenced in `core:material` dataSchema via the `lace` material type, and described in narrative. Not using `descriptors:embellishment` component as that's for external decorations like crystals/pearls.

---

### Item 6: Fuzzy Peach-Colored Socks

**Entity ID:** `clothing:fuzzy_peach_socks`
**File Name:** `fuzzy_peach_socks.entity.json`

**Justification for Creation:**
Existing socks are gray, white athletic styles, or white with patterns. This item introduces peach color with fuzzy texture, creating a distinct cozy sock variant.

**Component Specifications:**

- **`clothing:wearable`**
  - `layer`: `"underwear"`
  - `equipmentSlots.primary`: `"feet"`
  - `allowedLayers`: `["underwear"]`

- **`core:material`**
  - `material`: `"synthetic"`
  - `properties`: `["flexible"]`

- **`descriptors:color_extended`**
  - `color`: `"cream"` (closest to peach in available palette, or use basic `"orange"` if warmer tone desired)

- **`descriptors:texture`**
  - `texture`: `"fuzzy"` (NEW ENUM VALUE)

- **`clothing:coverage_mapping`**
  - `covers`: `["feet"]`
  - `coveragePriority`: `"underwear"`

- **`items:weight`**
  - `weight`: `0.09`

- **`core:name`**
  - `text`: `"Fuzzy Peach-Colored Socks"`

- **`core:description`**
  - `text`: `"Ultra-soft socks in a warm peach hue, with a plush fuzzy texture that feels luxurious against bare skin. The synthetic blend creates a cloud-like cushion around the feet while maintaining just enough stretch for a comfortable fit. Perfect for keeping toes cozy on chilly evenings."`

**Special Notes:**
Color choice: Use `descriptors:color_extended` with `"cream"` for a softer peach tone, or `descriptors:color_basic` with `"orange"` for a more vibrant peach.

---

### Item 7: Soft Cotton Nightgown in Mint Green with Small White Daisies

**Entity ID:** `clothing:mint_green_cotton_nightgown_daisies`
**File Name:** `mint_green_cotton_nightgown_daisies.entity.json`

**Justification for Creation:**
**NEW CATEGORY** - No nightgowns currently exist in the system. This introduces a new sleepwear category following dress/robe patterns.

**Component Specifications:**

- **`clothing:wearable`**
  - `layer`: `"base"`
  - `equipmentSlots.primary`: `"torso_upper"`
  - `equipmentSlots.secondary`: `["torso_lower"]` (nightgown extends to mid-thigh)
  - `allowedLayers`: `["underwear", "base"]`

- **`core:material`**
  - `material`: `"cotton"`
  - `properties`: `["breathable", "flexible"]`

- **`descriptors:color_basic`**
  - `color`: `"green"`

- **`descriptors:texture`**
  - `texture`: `"soft"` (NEW ENUM VALUE)

- **`descriptors:pattern`**
  - `pattern`: `"floral"` (for daisies)

- **`descriptors:length_category`**
  - `length`: `"short"` (hits mid-thigh)

- **`clothing:coverage_mapping`**
  - `covers`: `["torso_upper", "torso_lower"]`
  - `coveragePriority`: `"base"`

- **`items:weight`**
  - `weight`: `0.35` (estimated based on dress/robe weights)

- **`core:name`**
  - `text`: `"Mint Green Cotton Nightgown with Daisies"`

- **`core:description`**
  - `text`: `"A charming nightgown in soft mint green cotton, scattered with small white daisy prints that evoke spring meadows. Flutter sleeves create gentle movement with every step, while the loose-fitting bodice and mid-thigh hem allow for unrestricted comfort during sleep. The breathable fabric keeps the body cool through warm nights, making this an ideal choice for restful slumber."`

**Special Notes:**
This establishes the nightgown pattern: `base` layer, primary `torso_upper` with optional `torso_lower` coverage, follows dress/robe conventions.

---

### Item 8: Blush Pink Cotton Robe

**Entity ID:** `clothing:blush_pink_cotton_robe`
**File Name:** `blush_pink_cotton_robe.entity.json`

**Justification for Creation:**
Existing robes include red satin and pink silk variants. This item introduces blush pink cotton with a different material (cotton vs. satin/silk), creating a more casual, breathable option.

**Component Specifications:**

- **`clothing:wearable`**
  - `layer`: `"base"`
  - `equipmentSlots.primary`: `"torso_upper"`
  - `equipmentSlots.secondary`: `["left_arm_clothing", "right_arm_clothing"]`
  - `allowedLayers`: `["underwear", "base"]`

- **`core:material`**
  - `material`: `"cotton"`
  - `properties`: `["breathable", "flexible"]`

- **`descriptors:color_extended`**
  - `color`: `"blush-pink"`

- **`descriptors:texture`**
  - `texture`: `"soft"` (NEW ENUM VALUE)

- **`clothing:coverage_mapping`**
  - `covers`: `["torso_upper", "left_arm_clothing", "right_arm_clothing"]`
  - `coveragePriority`: `"base"`

- **`items:weight`**
  - `weight`: `0.55` (based on existing robe weights)

- **`core:name`**
  - `text`: `"Blush Pink Cotton Robe"`

- **`core:description`**
  - `text`: `"A lightweight cotton robe in a delicate blush pink, perfect for lazy mornings or winding down in the evening. The breathable fabric drapes loosely over the body, secured with a matching fabric belt at the waist. Roomy pockets and full-length sleeves provide both functionality and comfort, while the soft cotton feels gentle against bare skin."`

---

### Item 9: White Ankle Socks with Ruffled Edges

**Entity ID:** `clothing:white_ankle_socks_ruffled_edges`
**File Name:** `white_ankle_socks_ruffled_edges.entity.json`

**Justification for Creation:**
Existing white socks include plain athletic styles and mid-crew variants. This item introduces ankle length with decorative ruffled edges, creating a distinct feminine casual sock option.

**Component Specifications:**

- **`clothing:wearable`**
  - `layer`: `"underwear"`
  - `equipmentSlots.primary`: `"feet"`
  - `allowedLayers`: `["underwear"]`

- **`core:material`**
  - `material`: `"cotton"`
  - `properties`: `["breathable"]`

- **`descriptors:color_basic`**
  - `color`: `"white"`

- **`descriptors:texture`**
  - `texture`: `"smooth"`

- **`descriptors:length_category`**
  - `length`: `"very-short"` (ankle height)

- **`clothing:coverage_mapping`**
  - `covers`: `["feet"]`
  - `coveragePriority`: `"underwear"`

- **`items:weight`**
  - `weight`: `0.09`

- **`core:name`**
  - `text`: `"White Ankle Socks with Ruffled Edges"`

- **`core:description`**
  - `text`: `"Simple white cotton ankle socks elevated by delicate ruffles edging the cuff. The cotton blend wicks moisture while remaining soft against the skin, and the ruffled detail adds a playful, feminine touch to an everyday essential. Perfect for wearing with sneakers or around the house."`

---

### Item 10: Baby Blue Crop Tank

**Entity ID:** `clothing:baby_blue_crop_tank`
**File Name:** `baby_blue_crop_tank.entity.json`

**Justification for Creation:**
Existing tanks include navy, red slim, and red compression variants. This item introduces baby blue color with a cropped silhouette, creating a distinct casual/loungewear tank option.

**Component Specifications:**

- **`clothing:wearable`**
  - `layer`: `"base"`
  - `equipmentSlots.primary`: `"torso_upper"`
  - `equipmentSlots.secondary`: `["left_arm_clothing", "right_arm_clothing"]`
  - `allowedLayers`: `["underwear", "base"]`

- **`core:material`**
  - `material`: `"cotton"`
  - `properties`: `["breathable", "flexible"]`

- **`descriptors:color_extended`**
  - `color`: `"pale-blue"`

- **`descriptors:texture`**
  - `texture`: `"smooth"`

- **`descriptors:length_category`**
  - `length`: `"short"` (cropped)

- **`clothing:coverage_mapping`**
  - `covers`: `["torso_upper"]`
  - `coveragePriority`: `"base"`

- **`items:weight`**
  - `weight`: `0.20` (based on existing tank weights)

- **`core:name`**
  - `text`: `"Baby Blue Crop Tank"`

- **`core:description`**
  - `text`: `"A cropped tank top in a soft baby blue that hits just above the navel. The relaxed fit drapes comfortably over the torso without clinging, while the cotton fabric provides breathability for active days or casual lounging. Thin straps and a simple scoop neckline keep the design minimal and versatile."`

---

### Item 11: Soft Gray Sweatpants

**Entity ID:** `clothing:soft_gray_sweatpants`
**File Name:** `soft_gray_sweatpants.entity.json`

**Justification for Creation:**
**NEW CATEGORY** - No sweatpants currently exist (only cargo joggers). This introduces a new loungewear category following pants/joggers patterns.

**Component Specifications:**

- **`clothing:wearable`**
  - `layer`: `"base"`
  - `equipmentSlots.primary`: `"legs"`
  - `allowedLayers`: `["underwear", "base"]`

- **`core:material`**
  - `material`: `"cotton"`
  - `properties`: `["breathable", "flexible"]`

- **`descriptors:color_basic`**
  - `color`: `"gray"`

- **`descriptors:texture`**
  - `texture`: `"soft"` (NEW ENUM VALUE)

- **`clothing:coverage_mapping`**
  - `covers`: `["legs"]`
  - `coveragePriority`: `"base"`

- **`items:weight`**
  - `weight`: `0.45` (estimated: heavier than shorts, lighter than jeans)

- **`core:name`**
  - `text`: `"Soft Gray Sweatpants"`

- **`core:description`**
  - `text`: `"Classic gray sweatpants crafted from a soft cotton blend that feels like a warm embrace. An elastic waistband with drawstring ensures a secure, customizable fit, while roomy pockets provide convenient storage. The relaxed leg tapers slightly at the ankle, creating a modern silhouette perfect for lounging at home or casual outings."`

**Special Notes:**
This establishes the sweatpants pattern: `base` layer, primary `legs` slot, follows pants/joggers conventions.

---

### Item 12: Pink Fuzzy Socks

**Entity ID:** `clothing:pink_fuzzy_socks`
**File Name:** `pink_fuzzy_socks.entity.json`

**Justification for Creation:**
While similar to Item 6 (fuzzy peach socks), this item uses a brighter pink color and may have slightly different styling details, creating a distinct cozy sock variant in the collection.

**Component Specifications:**

- **`clothing:wearable`**
  - `layer`: `"underwear"`
  - `equipmentSlots.primary`: `"feet"`
  - `allowedLayers`: `["underwear"]`

- **`core:material`**
  - `material`: `"synthetic"`
  - `properties`: `["flexible"]`

- **`descriptors:color_basic`**
  - `color`: `"pink"`

- **`descriptors:texture`**
  - `texture`: `"fuzzy"` (NEW ENUM VALUE)

- **`clothing:coverage_mapping`**
  - `covers`: `["feet"]`
  - `coveragePriority`: `"underwear"`

- **`items:weight`**
  - `weight`: `0.09`

- **`core:name`**
  - `text`: `"Pink Fuzzy Socks"`

- **`core:description`**
  - `text`: `"Plush pink socks with a fuzzy texture that transforms cold feet into cozy companions. The synthetic fibers create a soft, almost velvety feel while maintaining enough structure to stay in place throughout the day. These socks are a cheerful addition to any loungewear ensemble, adding both warmth and a pop of color."`

---

### Item 13: White Slippers with Small Bow Detail

**Entity ID:** `clothing:white_slippers_bow_detail`
**File Name:** `white_slippers_bow_detail.entity.json`

**Justification for Creation:**
While similar to Item 4 (fuzzy pink slippers), this item uses white color with a bow decoration instead of all-over fuzzy texture, creating a distinct elegant slipper variant.

**Component Specifications:**

- **`clothing:wearable`**
  - `layer`: `"base"`
  - `equipmentSlots.primary`: `"feet"`
  - `allowedLayers`: `["underwear", "base"]`

- **`core:material`**
  - `material`: `"synthetic"`
  - `properties`: `["flexible"]`

- **`descriptors:color_basic`**
  - `color`: `"white"`

- **`descriptors:texture`**
  - `texture`: `"smooth"`

- **`clothing:coverage_mapping`**
  - `covers`: `["feet"]`
  - `coveragePriority`: `"base"`

- **`items:weight`**
  - `weight`: `0.52` (based on existing slipper weight)

- **`core:name`**
  - `text`: `"White Slippers with Bow Detail"`

- **`core:description`**
  - `text`: `"Elegant white slippers with a small decorative bow adorning each toe. The smooth synthetic upper provides a clean, refined appearance, while a cushioned footbed and flexible sole ensure comfort for all-day wear around the house. These slippers strike a balance between style and function, elevating even the simplest loungewear outfit."`

**Special Notes:**
Bow is a decorative detail described in narrative, not a pattern component.

---

## Implementation Guidance

### Order of Operations

1. **Review and approve this specification document**
   - Confirm all 13 items meet requirements
   - Approve descriptor component enum additions
   - Validate entity IDs and file naming conventions

2. **Update descriptor component schemas**
   - Add `"soft"`, `"fuzzy"`, `"fleece"` to `descriptors:texture` component
   - Add `"fleece"` to `core:material` component
   - Validate schema changes against JSON Schema specification

3. **Create entity definition JSON files**
   - Create 13 files in `data/mods/clothing/entities/definitions/`
   - Follow structure pattern from existing clothing items
   - Include all required components as specified above

4. **Validate JSON files**
   - Run schema validation on all new entity definitions
   - Verify all enum values are valid (including newly added values)
   - Check for JSON syntax errors

5. **Update mod manifest**
   - Add new entity IDs to `data/mods/clothing/mod-manifest.json`
   - Verify dependency chain is correct

6. **Create integration tests**
   - Test wearability of all items
   - Test layer and equipment slot interactions
   - Test coverage mapping system
   - Test that descriptor components resolve correctly

7. **Documentation updates**
   - Update clothing system documentation with new categories (nightgowns, sweatpants)
   - Document new descriptor enum values with use case examples

---

## Validation Checklist

### Entity ID Validation
- [ ] All entity IDs follow format: `clothing:<identifier>`
- [ ] All identifiers use snake_case convention
- [ ] No duplicate entity IDs
- [ ] IDs are descriptive and include key distinguishing features

### File Naming Validation
- [ ] All file names follow format: `<color>_<material>_<type>.entity.json`
- [ ] File names match entity ID patterns
- [ ] No file name collisions with existing items

### Component Validation
- [ ] All required components present in each item:
  - `clothing:wearable`
  - `core:material`
  - `core:name`
  - `core:description`
  - Color component (`color_basic` or `color_extended`)
  - `descriptors:texture`
  - `clothing:coverage_mapping`
  - `items:item`
  - `items:portable`
  - `items:weight`
- [ ] Optional components used appropriately:
  - `descriptors:pattern` (only for items with patterns)
  - `descriptors:length_category` (for items where length matters)
  - `descriptors:embellishment` (for decorated items)

### Enum Value Validation
- [ ] All color values exist in `color_basic` or `color_extended` enums
- [ ] All material values exist in `core:material` enum (including new `fleece`)
- [ ] All texture values exist in `descriptors:texture` enum (including new values)
- [ ] All pattern values exist in `descriptors:pattern` enum
- [ ] All layer values are valid: `underwear`, `base`, `outer`, `accessories`

### Equipment Slot Validation
- [ ] Primary equipment slots are appropriate for item type
- [ ] Secondary slots used correctly for multi-area coverage
- [ ] Coverage mapping matches equipment slots
- [ ] Coverage priority matches layer assignment

### Weight Validation
- [ ] Weights are reasonable for item type
- [ ] Weights follow reference patterns:
  - Socks: ~0.09 kg
  - Shorts: ~0.16 kg
  - Tanks/camisoles: ~0.20 kg
  - Nightgown: ~0.35 kg
  - Sweatpants: ~0.45 kg
  - Slippers: ~0.52 kg
  - Robe: ~0.55 kg
  - Hoodie: ~0.65 kg

### Narrative Description Validation
- [ ] Descriptions are 2-4 sentences
- [ ] Language is evocative and sensory
- [ ] Focus on visual, tactile, and comfort qualities
- [ ] Style matches existing clothing item descriptions
- [ ] Grammar and spelling are correct

---

## Special Considerations

### New Categories: Nightgowns

**Pattern established:**
- **Layer:** `base` (sleepwear, not undergarment)
- **Primary slot:** `torso_upper`
- **Secondary slot:** `torso_lower` (if nightgown extends below waist)
- **Coverage:** Reflects slots (both `torso_upper` and `torso_lower` if applicable)
- **Weight range:** 0.30-0.40 kg (lighter than dresses, similar to light robes)

**Design notes:**
- Nightgowns are distinct from dresses (sleepwear-specific)
- Can have patterns (floral, polka-dot, etc.)
- Materials: Cotton, silk, satin typical
- Textures: Soft, silky, smooth appropriate

### New Categories: Sweatpants

**Pattern established:**
- **Layer:** `base` (primary clothing)
- **Primary slot:** `legs`
- **Coverage:** `legs` only
- **Weight range:** 0.40-0.50 kg (heavier than shorts, lighter than jeans)

**Design notes:**
- Sweatpants are distinct from joggers (more casual, less athletic)
- Typically cotton or cotton-blend material
- Textures: Soft, smooth, fleece appropriate
- Common features: Elastic waistband with drawstring, pockets

### Pattern Usage Guidelines

**When to use `descriptors:pattern` component:**
- Items with printed/woven patterns: floral, hearts, polka-dots, stripes
- Patterns that are integral to the fabric/design

**When NOT to use `descriptors:pattern`:**
- Trim details (piping, ruffles, lace edging) - describe in narrative only
- Decorative elements added on top (bows, appliqués) - describe in narrative only
- Texture variations (ribbed, cable-knit) - use texture component instead

### Material Properties Usage

**When to add `properties` array to `core:material`:**
- Cotton items → `["breathable"]` or `["breathable", "flexible"]`
- Fleece items → `["breathable", "flexible", "insulating"]`
- Synthetic fuzzy items → `["flexible"]`
- Satin/silk items → `["flexible"]`

**Common properties for loungewear:**
- `"breathable"` - For natural fibers (cotton, linen)
- `"flexible"` - For stretch fabrics or garments that drape/move
- `"insulating"` - For warmth-providing materials (fleece, wool)

---

## Color Mapping Reference

### Items Using `descriptors:color_basic`

- **Item 2:** Pink shorts → `"pink"`
- **Item 4:** Pink slippers → `"pink"`
- **Item 7:** Mint green nightgown → `"green"`
- **Item 9:** White ankle socks → `"white"`
- **Item 11:** Gray sweatpants → `"gray"`
- **Item 12:** Pink fuzzy socks → `"pink"`
- **Item 13:** White slippers → `"white"`

### Items Using `descriptors:color_extended`

- **Item 1:** Pale pink hoodie → `"pale-pink"`
- **Item 3:** White knee-high socks → use basic `"white"` instead
- **Item 5:** Lavender camisole → `"violet"` (closest match)
- **Item 6:** Peach socks → `"cream"` (for soft peach) or basic `"orange"` (for brighter peach)
- **Item 8:** Blush pink robe → `"blush-pink"`
- **Item 10:** Baby blue tank → `"pale-blue"`

---

## Summary Statistics

### Collection Overview

- **Total items:** 13
- **New categories:** 2 (nightgowns, sweatpants)
- **New enum values required:** 4 total
  - Textures: 3 (`soft`, `fuzzy`, `fleece`)
  - Materials: 1 (`fleece`)

### Items by Layer

- **Underwear layer:** 6 items (socks, camisole)
- **Base layer:** 7 items (shorts, slippers, nightgown, robe, tank, sweatpants, slippers)
- **Outer layer:** 1 item (hoodie)
- **Accessories layer:** 0 items

### Items by Category

- **Upper body:** 4 items (hoodie, camisole, robe, tank)
- **Lower body:** 2 items (shorts, sweatpants)
- **Full body:** 1 item (nightgown)
- **Feet:** 6 items (3 socks, 2 slippers)

### Materials Used

- **Cotton:** 8 items
- **Fleece:** 1 item (NEW)
- **Synthetic:** 4 items

### Color Palette

- **Pink variants:** 5 items (pale pink, pink, blush pink, peach)
- **White:** 3 items
- **Lavender/violet:** 1 item
- **Mint green:** 1 item
- **Baby blue:** 1 item
- **Gray:** 1 item

---

## Approval Sign-Off

### Required Approvals

- [ ] **Technical Review:** Schema changes approved (texture/material enum additions)
- [ ] **Design Review:** All 13 items meet design requirements and aesthetic goals
- [ ] **Implementation Review:** Entity IDs and file names follow conventions
- [ ] **Content Review:** Narrative descriptions meet quality standards

### Approval Signatures

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Technical Lead | | | |
| Design Lead | | | |
| Content Lead | | | |
| Project Manager | | | |

---

**End of Specification Document**
