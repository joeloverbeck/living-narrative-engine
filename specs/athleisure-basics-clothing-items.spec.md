# Athleisure Basics Clothing & Accessory Specification

> ✅ **IMPLEMENTATION READY**: This specification defines seven athleisure and everyday basics to expand the clothing catalog.
> The document captures component requirements, material enum updates, and implementation guidance for new apparel and accessory entities.

## Implementation Status

### Current State (As of 2025-02-14)

**REQUIRES COMPONENT EXTENSIONS** – Implementation will need additional entries in the material component before new entities can be created.

#### What Currently Exists

- Mature clothing entity architecture with `clothing:wearable`, `core:material`, and descriptor components
- Material component (`core:material`) supporting textiles like cotton, nylon, microfiber, power-mesh, etc., but **lacking foam and Lycra options**
- Descriptor components already covering required appearances:
  - `descriptors:color_basic` → includes `red`, `black`, `white`
  - `descriptors:color_extended` → includes `nude`, `silver`
  - `descriptors:texture` → includes `rib-knit` and `matte`
- Existing garments that overlap partially but differ in fabric or cut and should remain unique:
  - `clothing:red_compression_racerback_tank` (synthetic compression, racerback)
  - `clothing:nylon_sports_bra` (standard length, navy)
  - `clothing:nude_thong` (silk construction)

#### What This Document Defines

- Addition of **7** new clothing/accessory entity files in `data/mods/clothing/entities/definitions/`
- Extension of the material component with two new enum values
- Detailed component payloads for each item including layering, slot usage, descriptors, and narrative copy notes

### Prerequisites for Implementation

**Component updates required prior to entity creation:**

- `data/mods/core/components/material.component.json`
  - Extend the `material` enum with `lycra` (for the bike shorts) and `foam` (for the slide sandals).

_No descriptor component changes are needed; existing enums already support the requested colors and textures._

**New entity definition files to add:**

1. `data/mods/clothing/entities/definitions/ribbed_cotton_tank_slim_red.entity.json`
2. `data/mods/clothing/entities/definitions/black_longline_sports_bra_medium_support.entity.json`
3. `data/mods/clothing/entities/definitions/red_matte_lycra_high_waist_bike_shorts.entity.json`
4. `data/mods/clothing/entities/definitions/nude_microfiber_seamless_thong.entity.json`
5. `data/mods/clothing/entities/definitions/white_midcrew_cotton_athletic_socks.entity.json`
6. `data/mods/clothing/entities/definitions/black_foam_slide_sandals.entity.json`
7. `data/mods/clothing/entities/definitions/small_steel_huggie_hoops.entity.json`

---

## 1. Overview

### 1.1 Feature Summary

Introduce a cohesive capsule of athleisure essentials and a minimalist accessory:

1. **Ribbed cotton tank (slim fit, red)** – breathable layer-friendly top
2. **Longline sports bra (medium support, black)** – extended hem, supportive activewear base layer
3. **High-waist bike shorts (matte Lycra, red)** – streamlined performance bottoms
4. **Seamless thong (nude)** – invisible microfiber underwear distinct from existing silk thong
5. **Mid-crew cotton athletic socks (white)** – training-oriented socks with rib support
6. **Foam slide sandals (black)** – recovery footwear with cushioning foam construction
7. **Small steel huggie hoops** – understated jewelry accessory for daily wear

### 1.2 Goals & Value

- Expand athleisure outfitting options with coordinated colorways (red/black/white neutrals)
- Provide layering flexibility with matching base and underwear pieces
- Diversify footwear materials and introduce lightweight foam slides
- Add a minimalist accessory that complements casual outfits

### 1.3 Non-Goals

- No modifications to existing clothing entities
- No new descriptor components or schema changes beyond material enum additions
- No gameplay logic changes; focus solely on content additions

---

## 2. Functional Requirements

### FR-1: New Clothing Entities

Create seven new entity definition JSON files following existing schema conventions. Each entity must include `clothing:wearable`, `core:material`, `core:name`, `core:description`, and appropriate descriptor components.

#### 2.1 Ribbed Cotton Tank (Slim Fit, Red)

- **File/ID**: `clothing:ribbed_cotton_tank_slim_red`
- **Layering & Slots**: `layer` → `base`; `equipmentSlots.primary` → `torso_upper`; `equipmentSlots.secondary` → `left_arm_clothing`, `right_arm_clothing`; `allowedLayers` → `["underwear", "base"]`
- **Material**: `cotton`; include `properties` `["breathable", "flexible"]` to highlight comfort stretch
- **Descriptors**: `descriptors:color_basic.color` → `red`; `descriptors:texture.texture` → `rib-knit`
- **Coverage Mapping**: include `clothing:coverage_mapping` with `covers` `["torso_upper"]`, `coveragePriority` `base`
- **Narrative Notes**: Emphasize slim fit, ribbed texture, slight stretch, versatile layering; differentiate from compression racerback tank by highlighting scoop neckline and casual styling

#### 2.2 Longline Sports Bra (Medium Support, Black)

- **File/ID**: `clothing:black_longline_sports_bra_medium_support`
- **Layering & Slots**: `layer` → `underwear`; `equipmentSlots.primary` → `torso_upper`; `allowedLayers` → `["underwear"]`
- **Material**: Use existing `nylon` base with `properties` `["breathable", "flexible"]` and reference supportive knit panels; add optional `careInstructions` `"machine_washable"`
- **Descriptors**: `descriptors:color_basic.color` → `black`; `descriptors:texture.texture` → `smooth`
- **Coverage Mapping**: Add `covers` `["torso_upper"]`, `coveragePriority` `underwear`
- **Narrative Notes**: Describe longline band extending below bust, medium support suited for studio workouts, moisture management, and racerback or scoop detail distinct from existing standard-length navy sports bra

#### 2.3 High-Waist Bike Shorts (Matte Lycra, Red)

- **File/ID**: `clothing:red_matte_lycra_high_waist_bike_shorts`
- **Layering & Slots**: `layer` → `base`; `equipmentSlots.primary` → `legs`; `allowedLayers` → `["base", "outer"]`
- **Material**: New `lycra` enum with `properties` `["flexible", "breathable"]`
- **Descriptors**: `descriptors:color_basic.color` → `red`; `descriptors:texture.texture` → `matte`
- **Coverage Mapping**: `covers` `["torso_lower"]`, `coveragePriority` `base` to mirror other shorts/trousers
- **Narrative Notes**: Highlight high waist, sculpting fit, matte finish, side panels, and flat seams to pair with tank/bra

#### 2.4 Seamless Thong (Nude)

- **File/ID**: `clothing:nude_microfiber_seamless_thong`
- **Layering & Slots**: `layer` → `underwear`; `equipmentSlots.primary` → `torso_lower`; `allowedLayers` → `["underwear"]`
- **Material**: `microfiber` with `properties` `["breathable", "flexible"]`
- **Descriptors**: `descriptors:color_extended.color` → `nude`; `descriptors:texture.texture` → `smooth`
- **Narrative Notes**: Stress seamless laser-cut edges, bonded gusset, second-skin feel, invisible under leggings; explicitly contrast with existing silk thong to avoid confusion

#### 2.5 Mid-Crew Cotton Athletic Socks (White)

- **File/ID**: `clothing:white_midcrew_cotton_athletic_socks`
- **Layering & Slots**: `layer` → `underwear`; `equipmentSlots.primary` → `feet`; `allowedLayers` → `["underwear"]`
- **Material**: `cotton` with optional `properties` `["breathable"]`
- **Descriptors**: `descriptors:color_basic.color` → `white`; `descriptors:texture.texture` → `rib-knit`
- **Narrative Notes**: Describe cushioned footbed, arch support, reinforced heel/toe, moisture control for training sessions; specify mid-crew height to differentiate from thigh-highs and grip socks

#### 2.6 Foam Slide Sandals (Black)

- **File/ID**: `clothing:black_foam_slide_sandals`
- **Layering & Slots**: `layer` → `base`; `equipmentSlots.primary` → `feet`; `allowedLayers` → `["base"]`
- **Material**: New `foam` enum with `properties` `["waterproof", "flexible"]`
- **Descriptors**: `descriptors:color_basic.color` → `black`; `descriptors:texture.texture` → `matte`
- **Coverage Mapping**: Optional for footwear; if added, use `covers` `["feet"]` with `coveragePriority` `base`
- **Narrative Notes**: Emphasize single-piece molded foam, contoured footbed, slip-on convenience post-workout

#### 2.7 Small Steel Huggie Hoops

- **File/ID**: `clothing:small_steel_huggie_hoops`
- **Layering & Slots**: `layer` → `accessories`; `equipmentSlots.primary` → `head_gear`; `allowedLayers` → `["accessories"]`
- **Material**: `steel`; optionally include `properties` `["reflective"]`
- **Descriptors**: `descriptors:color_extended.color` → `silver`; `descriptors:texture.texture` → `smooth`
- **Coverage Mapping**: Use `clothing:coverage_mapping` with `covers` `["head_gear"]`, `coveragePriority` `accessories` to mirror existing jewelry handling
- **Narrative Notes**: Convey snug hinged design, polished finish, everyday versatility; ensure description differentiates from necklaces or other accessories

### FR-2: Narrative Consistency

- Each `core:description` should be 3–5 sentences, highlighting tactile qualities, fit, and usage scenarios.
- Ensure descriptions mention complementary items within the new capsule where relevant (e.g., tank with bike shorts) to encourage outfit cohesion.
- Avoid duplicating language from existing entity descriptions to maintain distinct voice.

### FR-3: Validation Compliance

- All new JSON files must validate against `entity-definition.schema.json` and respective component schemas.
- Run `npm run validate` after additions to confirm mod data integrity.

---

## 3. Non-Functional Requirements

- Maintain consistent indentation (two spaces) and property ordering used in existing entity files.
- Use snake_case filenames and entity IDs matching the filename stem.
- Provide `core:name.text` values that match common apparel terminology (e.g., "tank", "sports bra", "bike shorts").

---

## 4. Implementation Plan

1. **Extend Materials** – Update `core:material` component enum with `lycra` and `foam`, including brief descriptive comments if the file maintains ordering/alphabetization.
2. **Author Entity JSON** – For each item, duplicate a comparable existing file (e.g., tank, sports bra, socks) and adjust components per Section 2.
3. **Add Descriptions** – Craft bespoke narrative text ensuring readability and differentiation from current catalog entries.
4. **Cross-Verify Duplication** – Confirm no conflicting IDs or overlapping concepts with `red_compression_racerback_tank`, `nylon_sports_bra`, or `nude_thong` before committing.
5. **Run Validation** – Execute `npm run validate` to ensure schema compliance across mods.
6. **Documentation Update (Optional)** – If there is centralized outfit documentation, append references to the new capsule pieces.

---

## 5. Testing Strategy

- ✅ `npm run validate` – Required to ensure schema validation success for new descriptors and entities.
- ✅ `npm run test:unit` (optional) – Sanity check to ensure no inadvertent regressions if clothing data is consumed in tests.
- Manual spot check: load clothing catalog in development tools (if available) to confirm visual descriptors align.

---

## 6. Acceptance Criteria

- Material enum extended with `lycra` and `foam`.
- Seven new entity files exist with correctly configured components and unique IDs.
- Descriptions clearly differentiate each item and reference relevant functional qualities (support level, fit, material feel).
- Validation command passes without warnings or errors.

---

## 7. Future Considerations

- Consider adding a dedicated `support_level` descriptor for bras in future iterations if more nuanced support tracking becomes necessary.
- If earrings proliferate, evaluate introducing a specific `ears` equipment slot to avoid overloading `head_gear`.
- Monitor demand for additional foam-based footwear colors to reuse the new material enum entry.

---

**Document Version**: 1.0.0  
**Date**: 2025-02-14  
**Status**: Specification Complete – Awaiting material enum extension and entity implementation.  
**Author**: Content Systems Team
