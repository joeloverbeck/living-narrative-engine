# Gothic & Dramatic Clothing Collection Specification

> ✅ **IMPLEMENTATION READY**: This specification defines twelve gothic, dramatic, and regal clothing items to expand the clothing catalog with high-fashion, dramatic, and ceremonial garments.
> The document captures component requirements, material enum updates, descriptor extensions, and implementation guidance for new apparel and accessory entities.

## Implementation Status

### Current State (As of 2025-11-04)

**REQUIRES COMPONENT EXTENSIONS** – Implementation will need additional entries in multiple components before new entities can be created.

#### What Currently Exists

- Mature clothing entity architecture with `clothing:wearable`, `core:material`, and descriptor components
- Material component (`core:material`) supporting textiles like leather, silk, wool, cotton, satin, but **lacking velvet, brocade, and diamond**
- Descriptor components covering basic colors and textures, but **missing several specialized descriptors for dramatic/gothic styling**
- Existing boot entities (ankle boots, chukka boots) but **no thigh-high or knee-high combat boots**
- Existing jacket entities but **no floor-length coats or capes**
- Existing jewelry but **no crowns or dramatic spike-embellished items**

#### What This Document Defines

- Addition of **12** new clothing/accessory entity files in `data/mods/clothing/entities/definitions/`
- Extension of the material component with three new enum values
- Extension of multiple descriptor components with new values
- Potential creation of two new descriptor components for better modeling
- Detailed component payloads for each item including layering, slot usage, descriptors, and narrative copy notes

### Prerequisites for Implementation

**Component updates required prior to entity creation:**

1. **`data/mods/core/components/material.component.json`**
   - Extend the `material` enum with:
     - `"velvet"` (for gown and cape)
     - `"brocade"` (for coat embellishment)
     - `"diamond"` (for collar and crown)

2. **`data/mods/descriptors/components/color_extended.component.json`**
   - Extend the `color` enum with:
     - `"deep-crimson"` (for bodice)
     - `"midnight-blue"` (for military coat)
     - `"blood-red"` (for cape and crown gemstones)

3. **`data/mods/descriptors/components/pattern.component.json`**
   - Extend the `pattern` enum with:
     - `"serpentine"` (for brocade patterns)
     - `"embroidered"` (for silk robe)

4. **`data/mods/descriptors/components/embellishment.component.json`**
   - Extend the `embellishment` enum with:
     - `"spike"` (for collar)
     - `"epaulette"` (for military coat)
     - `"gold-thread"` (for embroidery)

5. **`data/mods/descriptors/components/texture.component.json`**
   - Extend the `texture` enum with:
     - `"supple"` (for leather trousers)
     - `"battle-scarred"` (for military coat leather)
     - `"twisted"` (for crown metal)
     - `"structured"` (for bodice and gown)
     - `"flowing"` (for cape)

**New descriptor components to create:**

6. **`data/mods/descriptors/components/garment_style.component.json`** (NEW)
   ```json
   {
     "$schema": "schema://living-narrative-engine/component.schema.json",
     "id": "descriptors:garment_style",
     "description": "Style classification for garments with distinctive design characteristics",
     "dataSchema": {
       "type": "object",
       "properties": {
         "style": {
           "type": "string",
           "description": "The garment style classification",
           "enum": [
             "military",
             "kimono",
             "combat",
             "gothic",
             "regal",
             "ceremonial",
             "dramatic"
           ]
         }
       },
       "required": ["style"],
       "additionalProperties": false
     }
   }
   ```

7. **`data/mods/descriptors/components/garment_length.component.json`** (NEW)
   ```json
   {
     "$schema": "schema://living-narrative-engine/component.schema.json",
     "id": "descriptors:garment_length",
     "description": "Length classification for garments and footwear",
     "dataSchema": {
       "type": "object",
       "properties": {
         "length": {
           "type": "string",
           "description": "The garment length classification",
           "enum": [
             "floor-length",
             "full-length",
             "ankle-length",
             "knee-high",
             "thigh-high",
             "cropped",
             "short"
           ]
         }
       },
       "required": ["length"],
       "additionalProperties": false
     }
   }
   ```

**New entity definition files to add:**

1. `data/mods/clothing/entities/definitions/floor_length_black_leather_coat_dramatic_shoulders.entity.json`
2. `data/mods/clothing/entities/definitions/black_diamond_silver_spike_collar.entity.json`
3. `data/mods/clothing/entities/definitions/structured_crimson_bodice_steel_boning.entity.json`
4. `data/mods/clothing/entities/definitions/fitted_supple_black_leather_trousers.entity.json`
5. `data/mods/clothing/entities/definitions/thigh_high_boots_steel_tipped_heels.entity.json`
6. `data/mods/clothing/entities/definitions/midnight_blue_military_coat_gold_epaulettes.entity.json`
7. `data/mods/clothing/entities/definitions/knee_high_black_combat_boots.entity.json`
8. `data/mods/clothing/entities/definitions/flowing_blood_red_velvet_cape.entity.json`
9. `data/mods/clothing/entities/definitions/black_silk_kimono_robe_gold_embroidery.entity.json`
10. `data/mods/clothing/entities/definitions/full_length_black_velvet_gown_structured_bodice.entity.json`
11. `data/mods/clothing/entities/definitions/twisted_black_metal_crown_blood_red_gemstones.entity.json`
12. `data/mods/clothing/entities/definitions/silver_chain_pendant_necklace.entity.json`

---

## 1. Overview

### 1.1 Feature Summary

Introduce a collection of dramatic, gothic, and regal clothing items suitable for high-fashion, ceremonial, or theatrical character expression:

1. **Floor-length black leather coat with dramatic shoulder pieces** – statement outerwear with architectural shoulders and heavy brocade with serpentine patterns
2. **Collar of black diamonds and silver spikes** – edgy luxury neck accessory
3. **Structured bodice in deep crimson with steel boning** – form-fitting corset-style garment
4. **Fitted trousers in supple black leather** – sleek, form-fitting leg wear
5. **Thigh-high boots with steel-tipped heels** – dramatic footwear with metal accents
6. **Military coat in midnight blue with gold epaulettes and chains** – ceremonial military-style outerwear with battle-scarred leather details
7. **Knee-high combat boots** – practical yet dramatic footwear
8. **Flowing cape in blood-red** – dramatic velvet cape for grand entrances
9. **Black silk robe with wide kimono-style sleeves embroidered with gold thread** – elegant loungewear with Eastern-inspired design
10. **Full-length gown in black velvet with a structured bodice** – formal evening wear with regal presence
11. **Crown of twisted black metal and blood-red gemstones** – ceremonial headpiece with dark elegance
12. **Necklace of silver chains and pendants** – layered statement jewelry

### 1.2 Goals & Value

- Expand clothing options for gothic, dramatic, and high-fashion character archetypes
- Provide ceremonial and regal items suitable for leadership or nobility roles
- Introduce architectural and dramatic design elements (shoulder pieces, steel boning, dramatic lengths)
- Add luxury materials and embellishments (diamonds, brocade, velvet, gold thread)
- Create coordinated dark color palette (black, crimson, midnight blue, blood red)

### 1.3 Non-Goals

- No modifications to existing clothing entities
- No gameplay logic changes; focus solely on content additions
- No new component types beyond the two suggested descriptors

---

## 2. Functional Requirements

### FR-1: New Clothing Entities

Create twelve new entity definition JSON files following existing schema conventions. Each entity must include `clothing:wearable`, `core:material`, `core:name`, `core:description`, and appropriate descriptor components.

#### 2.1 Floor-Length Black Leather Coat with Dramatic Shoulders

- **File/ID**: `clothing:floor_length_black_leather_coat_dramatic_shoulders`
- **Layering & Slots**: `layer` → `outer`; `equipmentSlots.primary` → `full_body` or `torso_upper`; `equipmentSlots.secondary` → `["left_arm_clothing", "right_arm_clothing"]`; `allowedLayers` → `["underwear", "base", "outer"]`
- **Material**: `leather` (primary); reference `brocade` with `silver` threading in description for serpentine pattern embellishment
- **Descriptors**:
  - `descriptors:color_basic.color` → `black`
  - `descriptors:texture.texture` → `smooth` (for leather base)
  - `descriptors:pattern.pattern` → `serpentine` (for brocade sections)
  - `descriptors:garment_length.length` → `floor-length`
  - `descriptors:garment_style.style` → `dramatic`
  - `descriptors:size_specific.size` → `"dramatic shoulder pieces that add width and height"`
- **Coverage Mapping**: `clothing:coverage_mapping` with `covers` → `["torso_upper", "torso_lower", "left_arm_clothing", "right_arm_clothing"]`, `coveragePriority` → `outer`
- **Weight**: `items:weight.weight` → `3.5` (heavy leather coat with architectural elements)
- **Narrative Notes**: Emphasize floor-sweeping length, architectural shoulder construction that adds imposing silhouette, heavy brocade panels with serpentine silver thread patterns, luxurious weight and presence, suitable for commanding attention

#### 2.2 Collar of Black Diamonds and Silver Spikes

- **File/ID**: `clothing:black_diamond_silver_spike_collar`
- **Layering & Slots**: `layer` → `accessories`; `equipmentSlots.primary` → `head_gear` (neck jewelry); `allowedLayers` → `["accessories"]`
- **Material**: `diamond` (for stones), reference `silver` metal in description
- **Descriptors**:
  - `descriptors:color_basic.color` → `black`
  - `descriptors:embellishment.embellishment` → `spike`
  - `descriptors:texture.texture` → `smooth` (for polished diamond)
  - `descriptors:garment_style.style` → `gothic`
- **Coverage Mapping**: `clothing:coverage_mapping` with `covers` → `["head_gear"]`, `coveragePriority` → `accessories`
- **Weight**: `items:weight.weight` → `0.35` (substantial jewelry piece)
- **Narrative Notes**: Statement collar with black diamonds set in silver framework, sharp silver spikes extending outward for edgy luxury aesthetic, adjustable fit, combines precious materials with aggressive styling

#### 2.3 Structured Bodice in Deep Crimson with Steel Boning

- **File/ID**: `clothing:structured_crimson_bodice_steel_boning`
- **Layering & Slots**: `layer` → `base`; `equipmentSlots.primary` → `torso_upper`; `allowedLayers` → `["underwear", "base"]`
- **Material**: Primary fabric should be `silk` or `satin`, with `steel` boning referenced in description
- **Descriptors**:
  - `descriptors:color_extended.color` → `deep-crimson`
  - `descriptors:texture.texture` → `structured`
  - `descriptors:garment_style.style` → `dramatic`
  - `descriptors:size_specific.size` → `"steel boning for support and shaping"`
- **Coverage Mapping**: `clothing:coverage_mapping` with `covers` → `["torso_upper"]`, `coveragePriority` → `base`
- **Weight**: `items:weight.weight` → `0.65` (structured garment with metal boning)
- **Narrative Notes**: Corset-inspired bodice in rich crimson, internal steel boning for structure and silhouette definition, form-fitting design that accentuates figure, can be worn as base layer or exposed as statement piece, lacing or hook closure

#### 2.4 Fitted Trousers in Supple Black Leather

- **File/ID**: `clothing:fitted_supple_black_leather_trousers`
- **Layering & Slots**: `layer` → `base`; `equipmentSlots.primary` → `legs`; `equipmentSlots.secondary` → `["torso_lower"]`; `allowedLayers` → `["base", "outer"]`
- **Material**: `leather`
- **Descriptors**:
  - `descriptors:color_basic.color` → `black`
  - `descriptors:texture.texture` → `supple`
  - `descriptors:size_specific.size` → `"fitted cut that follows body contours"`
- **Coverage Mapping**: `clothing:coverage_mapping` with `covers` → `["legs", "torso_lower"]`, `coveragePriority` → `base`
- **Weight**: `items:weight.weight` → `0.85` (leather trousers)
- **Narrative Notes**: Sleek black leather trousers with buttery-soft supple texture, fitted through legs and hips for streamlined silhouette, comfortable flexibility despite structure, classic front closure

#### 2.5 Thigh-High Boots with Steel-Tipped Heels

- **File/ID**: `clothing:thigh_high_boots_steel_tipped_heels`
- **Layering & Slots**: `layer` → `base`; `equipmentSlots.primary` → `feet`; `allowedLayers` → `["base", "outer"]`
- **Material**: `leather`
- **Descriptors**:
  - `descriptors:color_basic.color` → `black`
  - `descriptors:texture.texture` → `smooth`
  - `descriptors:garment_length.length` → `thigh-high`
  - `descriptors:embellishment.embellishment` → `"steel tips"` (may need to reference in size_specific if embellishment doesn't fit)
  - `descriptors:size_specific.size` → `"steel-tipped heels for dramatic sound and presence"`
- **Coverage Mapping**: `clothing:coverage_mapping` with `covers` → `["feet"]`, `coveragePriority` → `base`
- **Weight**: `items:weight.weight` → `1.85` (tall boots with metal accents)
- **Narrative Notes**: Dramatic thigh-high black leather boots reaching well above the knee, pointed steel tips on heels create distinctive sound when walking, fitted shaft with side zipper, substantial height adds to imposing presence

#### 2.6 Military Coat in Midnight Blue with Gold Epaulettes and Chains

- **File/ID**: `clothing:midnight_blue_military_coat_gold_epaulettes`
- **Layering & Slots**: `layer` → `outer`; `equipmentSlots.primary` → `torso_upper`; `equipmentSlots.secondary` → `["left_arm_clothing", "right_arm_clothing"]`; `allowedLayers` → `["underwear", "base", "outer"]`
- **Material**: Primary should be `wool` with `leather` (battle-scarred) details, gold metal for epaulettes and chains referenced in description
- **Descriptors**:
  - `descriptors:color_extended.color` → `midnight-blue`
  - `descriptors:texture.texture` → `battle-scarred` (for leather sections)
  - `descriptors:embellishment.embellishment` → `epaulette`
  - `descriptors:garment_style.style` → `military`
  - `descriptors:size_specific.size` → `"gold epaulettes and decorative chains"`
- **Coverage Mapping**: `clothing:coverage_mapping` with `covers` → `["torso_upper", "left_arm_clothing", "right_arm_clothing"]`, `coveragePriority` → `outer`
- **Weight**: `items:weight.weight` → `2.8` (heavy military coat with metal embellishments)
- **Narrative Notes**: Ceremonial military-style coat in deep midnight blue, gold epaulettes on shoulders with decorative chain details, battle-scarred leather trim showing history and character, structured tailoring with brass buttons, combines formal military elegance with weathered authenticity

#### 2.7 Knee-High Combat Boots

- **File/ID**: `clothing:knee_high_black_combat_boots`
- **Layering & Slots**: `layer` → `base`; `equipmentSlots.primary` → `feet`; `allowedLayers` → `["base", "outer"]`
- **Material**: `leather`
- **Descriptors**:
  - `descriptors:color_basic.color` → `black`
  - `descriptors:texture.texture` → `rugged`
  - `descriptors:garment_length.length` → `knee-high`
  - `descriptors:garment_style.style` → `combat`
- **Coverage Mapping**: `clothing:coverage_mapping` with `covers` → `["feet"]`, `coveragePriority` → `base`
- **Weight**: `items:weight.weight` → `1.45` (sturdy combat boots)
- **Narrative Notes**: Practical yet striking knee-high combat boots in black leather, rugged construction with thick lug soles, lace-up front with speed hooks, reinforced toe and heel, suitable for both function and fashion

#### 2.8 Flowing Cape in Blood-Red

- **File/ID**: `clothing:flowing_blood_red_velvet_cape`
- **Layering & Slots**: `layer` → `outer`; `equipmentSlots.primary` → `torso_upper`; `allowedLayers` → `["underwear", "base", "outer"]`
- **Material**: `velvet`
- **Descriptors**:
  - `descriptors:color_extended.color` → `blood-red`
  - `descriptors:texture.texture` → `velvety`
  - `descriptors:garment_style.style` → `dramatic`
  - `descriptors:size_specific.size` → `"flowing full-length cape"`
- **Coverage Mapping**: `clothing:coverage_mapping` with `covers` → `["torso_upper"]`, `coveragePriority` → `outer`
- **Weight**: `items:weight.weight` → `1.2` (velvet cape)
- **Narrative Notes**: Dramatic full-length cape in rich blood-red velvet, flows behind wearer with movement creating dramatic silhouette, fastens at neck with ornate clasp, suitable for grand entrances and theatrical presence

#### 2.9 Black Silk Robe with Wide Kimono-Style Sleeves Embroidered with Gold Thread

- **File/ID**: `clothing:black_silk_kimono_robe_gold_embroidery`
- **Layering & Slots**: `layer` → `base`; `equipmentSlots.primary` → `torso_upper`; `equipmentSlots.secondary` → `["left_arm_clothing", "right_arm_clothing"]`; `allowedLayers` → `["underwear", "base", "outer"]`
- **Material**: `silk`
- **Descriptors**:
  - `descriptors:color_basic.color` → `black`
  - `descriptors:texture.texture` → `silky`
  - `descriptors:pattern.pattern` → `embroidered`
  - `descriptors:embellishment.embellishment` → `gold-thread`
  - `descriptors:garment_style.style` → `kimono`
  - `descriptors:size_specific.size` → `"wide kimono-style sleeves with gold embroidery"`
- **Coverage Mapping**: `clothing:coverage_mapping` with `covers` → `["torso_upper", "left_arm_clothing", "right_arm_clothing"]`, `coveragePriority` → `base`
- **Weight**: `items:weight.weight` → `0.55` (silk robe)
- **Narrative Notes**: Elegant black silk robe with traditional kimono-style construction, wide dramatic sleeves that drape gracefully, intricate gold thread embroidery creating patterns across fabric, self-tie belt at waist, combines Eastern aesthetic with luxurious materials

#### 2.10 Full-Length Gown in Black Velvet with Structured Bodice

- **File/ID**: `clothing:full_length_black_velvet_gown_structured_bodice`
- **Layering & Slots**: `layer` → `base`; `equipmentSlots.primary` → `full_body` or `torso_upper`; `allowedLayers` → `["underwear", "base", "outer"]`
- **Material**: `velvet`
- **Descriptors**:
  - `descriptors:color_basic.color` → `black`
  - `descriptors:texture.texture` → `velvety`
  - `descriptors:garment_length.length` → `full-length`
  - `descriptors:garment_style.style` → `regal`
  - `descriptors:size_specific.size` → `"structured bodice with flowing skirt"`
- **Coverage Mapping**: `clothing:coverage_mapping` with `covers` → `["torso_upper", "torso_lower"]`, `coveragePriority` → `base`
- **Weight**: `items:weight.weight` → `1.8` (substantial formal gown)
- **Narrative Notes**: Regal full-length evening gown in sumptuous black velvet, structured bodice provides form-fitting support transitioning to flowing skirt that pools at floor, suitable for formal occasions and royal settings, combines elegant silhouette with rich texture

#### 2.11 Crown of Twisted Black Metal and Blood-Red Gemstones

- **File/ID**: `clothing:twisted_black_metal_crown_blood_red_gemstones`
- **Layering & Slots**: `layer` → `accessories`; `equipmentSlots.primary` → `head_gear`; `allowedLayers` → `["accessories"]`
- **Material**: `steel` (for twisted metal), `gemstone` (for blood-red stones) - may need to use `steel` as primary and reference gemstones in description
- **Descriptors**:
  - `descriptors:color_basic.color` → `black`
  - `descriptors:color_extended.color` → `blood-red` (for gemstones)
  - `descriptors:texture.texture` → `twisted`
  - `descriptors:embellishment.embellishment` → `gemstone`
  - `descriptors:garment_style.style` → `ceremonial`
  - `descriptors:size_specific.size` → `"twisted black metal with blood-red gemstone settings"`
- **Coverage Mapping**: `clothing:coverage_mapping` with `covers` → `["head_gear"]`, `coveragePriority` → `accessories`
- **Weight**: `items:weight.weight` → `0.85` (metal crown with stones)
- **Narrative Notes**: Ceremonial crown fashioned from twisted black metal creating organic yet deliberate forms, blood-red gemstones set throughout catch light dramatically, adjustable sizing, combines dark elegance with regal authority, suitable for leadership or ceremonial roles

#### 2.12 Necklace of Silver Chains and Pendants

- **File/ID**: `clothing:silver_chain_pendant_necklace`
- **Layering & Slots**: `layer` → `accessories`; `equipmentSlots.primary` → `head_gear` (neck jewelry); `allowedLayers` → `["accessories"]`
- **Material**: `silver` or `steel` (if silver not available as material)
- **Descriptors**:
  - `descriptors:color_extended.color` → `silver`
  - `descriptors:texture.texture` → `smooth`
  - `descriptors:embellishment.embellishment` → `metal-chain`
  - `descriptors:size_specific.size` → `"layered chains with multiple pendants"`
- **Coverage Mapping**: `clothing:coverage_mapping` with `covers` → `["head_gear"]`, `coveragePriority` → `accessories`
- **Weight**: `items:weight.weight` → `0.25` (layered necklace)
- **Narrative Notes**: Statement necklace featuring multiple silver chains at varying lengths, each adorned with decorative pendants of different sizes and shapes, creates layered dimensional look, complements both dramatic outfits and simpler ensembles

---

## 3. Technical Requirements

### TR-1: Component Schema Extensions

All component extensions must follow existing schema patterns and maintain backward compatibility.

#### Material Component Extensions

Location: `data/mods/core/components/material.component.json`

Add to the `material` enum (alphabetically):
- `"brocade"` - Heavy decorative fabric with raised patterns
- `"diamond"` - Precious gemstone material
- `"velvet"` - Soft pile fabric with luxurious texture

#### Color Extended Component Extensions

Location: `data/mods/descriptors/components/color_extended.component.json`

Add to the `color` enum (alphabetically):
- `"blood-red"` - Deep rich red with dark undertones
- `"deep-crimson"` - Rich saturated crimson shade
- `"midnight-blue"` - Very dark blue, almost black

#### Pattern Component Extensions

Location: `data/mods/descriptors/components/pattern.component.json`

Add to the `pattern` enum:
- `"embroidered"` - Decorative needlework patterns
- `"serpentine"` - Snake-like winding patterns

#### Embellishment Component Extensions

Location: `data/mods/descriptors/components/embellishment.component.json`

Add to the `embellishment` enum:
- `"epaulette"` - Ornamental shoulder pieces
- `"gold-thread"` - Gold thread embroidery
- `"spike"` - Sharp pointed metal embellishments

#### Texture Component Extensions

Location: `data/mods/descriptors/components/texture.component.json`

Add to the `texture` enum (alphabetically):
- `"battle-scarred"` - Worn leather showing damage and history
- `"flowing"` - Fabric that moves fluidly
- `"structured"` - Firm, shape-holding fabric
- `"supple"` - Soft, flexible leather
- `"twisted"` - Metal worked into twisted forms

### TR-2: New Descriptor Components

Create two new descriptor component files to support garment classification:

#### Garment Style Component

Location: `data/mods/descriptors/components/garment_style.component.json`

This component categorizes garments by their design aesthetic and cultural influences (military, gothic, kimono, etc.)

#### Garment Length Component

Location: `data/mods/descriptors/components/garment_length.component.json`

This component specifies the length classification of garments and footwear (floor-length, thigh-high, knee-high, etc.)

### TR-3: Entity Definition Standards

All new entity definitions must:
- Include all required components: `clothing:wearable`, `core:material`, `core:name`, `core:description`, `items:item`, `items:portable`, `items:weight`
- Include appropriate descriptor components from the extended sets
- Follow existing naming conventions for file and entity IDs
- Provide rich narrative descriptions that emphasize tactile qualities, visual impact, and styling context
- Include `clothing:coverage_mapping` with appropriate coverage areas
- Set realistic weight values based on material and size

### TR-4: Testing Requirements

After implementation, verify:
- All new entities load without schema validation errors
- Material and descriptor components accept new enum values
- Equipment slot assignments work correctly
- Layering rules function as intended (e.g., cape can go over other outer layers)
- Weight values feel appropriate compared to similar existing items
- Color and texture descriptors render correctly in UI

---

## 4. Implementation Sequence

### Phase 1: Component Extensions (Prerequisites)
1. Update `material.component.json` with three new materials
2. Update `color_extended.component.json` with three new colors
3. Update `pattern.component.json` with two new patterns
4. Update `embellishment.component.json` with three new embellishments
5. Update `texture.component.json` with five new textures
6. Create `garment_style.component.json` with style classifications
7. Create `garment_length.component.json` with length classifications
8. Run schema validation tests to ensure component updates are valid

### Phase 2: Entity Creation (Implementation)
Create all twelve entity definition files in order:
1. Simpler accessories first (necklace, collar)
2. Footwear (boots)
3. Base garments (trousers, bodice)
4. Intermediate pieces (robe, gown)
5. Complex outerwear (coats, cape)
6. Crown last (most complex with multiple materials)

### Phase 3: Validation & Testing
1. Load all entities in development environment
2. Verify schema compliance
3. Test equipment slot assignments
4. Verify layering compatibility
5. Check descriptor rendering in UI
6. Validate weights and portability

### Phase 4: Documentation
1. Update mod manifest if necessary
2. Document new descriptor components in relevant documentation
3. Add examples to clothing catalog if such documentation exists

---

## 5. Design Rationale

### 5.1 Why These Items?

This collection focuses on dramatic, gothic, and regal clothing suitable for:
- Leadership or nobility characters requiring ceremonial attire
- Gothic or dark aesthetic character concepts
- High-fashion or theatrical character expression
- Dramatic entrances and power-projection through clothing

### 5.2 Material & Descriptor Choices

**New Materials:**
- `velvet` - Essential for gothic and regal aesthetics; distinct tactile quality
- `brocade` - Heavy ornamental fabric unavailable in current materials
- `diamond` - Necessary for luxury jewelry pieces with precious stones

**New Descriptors:**
- Style classification needed to distinguish military, gothic, kimono designs
- Length classification improves specificity for dramatic floor-length and thigh-high items
- New colors fill gaps in dark/dramatic palette (blood-red, deep-crimson, midnight-blue)
- New textures support leather varieties (supple vs. battle-scarred) and structural properties

### 5.3 Equipment Slot Decisions

- **Capes and floor-length coats**: Use `torso_upper` as primary since they drape from shoulders, not `full_body` which would be too restrictive
- **Thigh-high boots**: Remain `feet` as primary slot despite height; leg coverage implied through description
- **Crowns and collars**: Both use `head_gear` slot (neckwear and headwear share this slot in current system)
- **Full-length gown**: Could use `full_body` but `torso_upper` with appropriate coverage mapping may be more flexible

### 5.4 Layering Considerations

- Outerwear pieces (coats, cape) allow all three layer types underneath for maximum styling flexibility
- Structured bodice can function as underwear/base or be exposed as statement piece
- Combat boots and thigh-high boots use `base` layer to work with most outfit combinations
- Accessories layer doesn't conflict with other layers

---

## 6. Edge Cases & Considerations

### 6.1 Material Combinations

Several items reference multiple materials:
- Floor-length coat: Primary `leather` with `brocade` embellishment described in text
- Military coat: Primary `wool` with `leather` details and `gold` metal
- Crown: Primary `steel` (twisted metal) with `gemstone` inlays

**Resolution**: Use primary material in `core:material` component, reference secondary materials in descriptive text and `size_specific` descriptors.

### 6.2 Color Handling

Items with multiple colors (e.g., coat with silver brocade, crown with blood-red gems):
- Use primary garment color in `color_basic` or `color_extended`
- Reference secondary colors in description text
- Crown may warrant both `color_basic` (black metal) and `color_extended` (blood-red gems) components if system supports multiple color descriptors

### 6.3 New Descriptor Components

Creating `garment_style` and `garment_length` components:
- **Alternative**: Could use `size_specific` for everything, but that conflates different concerns
- **Recommendation**: Create new components for better semantic clarity and queryability
- **Fallback**: If new components not approved, use `size_specific` for style and length details

### 6.4 Equipment Slot Limitations

Current system may not have perfect slot for every item:
- **Neck jewelry** (collar, necklace): Uses `head_gear` slot which may be semantically odd
- **Floor-length garments**: May need `full_body` slot if available
- **Recommendation**: Verify available equipment slots before finalizing slot assignments

---

## 7. Future Enhancements

### 7.1 Potential Follow-up Work

- Additional gothic/dramatic items (gloves with metal details, more elaborate headpieces)
- Color coordination sets (matching sets in blood-red, midnight-blue, crimson)
- More military-style pieces to expand on the military coat theme
- Eastern-inspired items to complement kimono robe (hakama, obi, etc.)

### 7.2 System Improvements

- **Neck jewelry slot**: Consider adding dedicated slot separate from `head_gear`
- **Multi-material support**: Allow entities to specify multiple materials with percentages
- **Multi-color support**: Enable multiple color descriptors per item
- **Style tags**: Beyond single style descriptor, allow multiple style tags (e.g., both "gothic" and "regal")

---

## 8. Open Questions

1. **Equipment slots**: Confirm complete list of available equipment slots. Is `full_body` available? Is there a dedicated neck jewelry slot?

2. **Multi-material handling**: What's the preferred pattern for items with multiple significant materials (e.g., coat with leather and brocade)?

3. **New component approval**: Are the new `garment_style` and `garment_length` components acceptable, or should this information be encoded differently?

4. **Color descriptor stacking**: Can items have both `color_basic` and `color_extended` components simultaneously for multi-color items?

5. **Embellishment specificity**: Should very specific embellishments like "steel-tipped heels" be in embellishment enum, or should embellishment stay broad and details go in `size_specific`?

6. **Material enum growth**: Is there concern about material enum growing too large? Should some materials be generalized (e.g., `gemstone` instead of `diamond`, `ruby`, `emerald` separately)?

---

## 9. Acceptance Criteria

Implementation is complete when:

- ✅ All component extensions (materials, colors, textures, patterns, embellishments) are added and validated
- ✅ Both new descriptor components (`garment_style`, `garment_length`) are created and validated
- ✅ All 12 entity definition files are created following schema
- ✅ All entities load without validation errors
- ✅ All entities appear in appropriate equipment slot menus
- ✅ Layering rules work correctly (outer items can be worn over base items, etc.)
- ✅ Descriptions are narrative-rich and emphasize tactile and visual qualities
- ✅ Weight values are realistic and consistent with similar items
- ✅ All color and texture descriptors render correctly in game UI

---

## Appendix A: Quick Reference - Component Extensions Needed

### Materials to Add
- `brocade`
- `diamond`
- `velvet`

### Colors (Extended) to Add
- `blood-red`
- `deep-crimson`
- `midnight-blue`

### Patterns to Add
- `embroidered`
- `serpentine`

### Embellishments to Add
- `epaulette`
- `gold-thread`
- `spike`

### Textures to Add
- `battle-scarred`
- `flowing`
- `structured`
- `supple`
- `twisted`

### New Components to Create
- `descriptors:garment_style` (with enum: military, kimono, combat, gothic, regal, ceremonial, dramatic)
- `descriptors:garment_length` (with enum: floor-length, full-length, ankle-length, knee-high, thigh-high, cropped, short)

---

## Appendix B: Entity Summary Table

| # | Entity ID | Type | Primary Material | Primary Slot | Layer | Key Features |
|---|-----------|------|------------------|--------------|-------|--------------|
| 1 | floor_length_black_leather_coat_dramatic_shoulders | Coat | leather | torso_upper | outer | Floor-length, dramatic shoulders, brocade serpentine |
| 2 | black_diamond_silver_spike_collar | Collar | diamond | head_gear | accessories | Black diamonds, silver spikes |
| 3 | structured_crimson_bodice_steel_boning | Bodice | satin/silk | torso_upper | base | Deep crimson, steel boning |
| 4 | fitted_supple_black_leather_trousers | Trousers | leather | legs | base | Supple leather, fitted cut |
| 5 | thigh_high_boots_steel_tipped_heels | Boots | leather | feet | base | Thigh-high, steel-tipped heels |
| 6 | midnight_blue_military_coat_gold_epaulettes | Coat | wool | torso_upper | outer | Midnight blue, gold epaulettes, battle-scarred leather |
| 7 | knee_high_black_combat_boots | Boots | leather | feet | base | Knee-high, combat style |
| 8 | flowing_blood_red_velvet_cape | Cape | velvet | torso_upper | outer | Blood-red, flowing, dramatic |
| 9 | black_silk_kimono_robe_gold_embroidery | Robe | silk | torso_upper | base | Kimono style, gold embroidery |
| 10 | full_length_black_velvet_gown_structured_bodice | Gown | velvet | torso_upper/full_body | base | Full-length, structured bodice |
| 11 | twisted_black_metal_crown_blood_red_gemstones | Crown | steel | head_gear | accessories | Twisted metal, blood-red gemstones |
| 12 | silver_chain_pendant_necklace | Necklace | silver/steel | head_gear | accessories | Layered chains, multiple pendants |

---

_This specification is ready for review and implementation. All requirements are clearly defined, and the phased approach ensures systematic implementation with proper validation at each stage._
