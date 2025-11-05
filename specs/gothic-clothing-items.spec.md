# Gothic Clothing Items Specification

> ✅ **IMPLEMENTATION READY**: This specification defines 14 gothic-themed clothing items and accessories to expand the clothing catalog with dramatic, dark aesthetic pieces.
> The document captures component requirements, material/descriptor enum updates, and implementation guidance for new apparel entities.

## Implementation Status

### Current State (As of 2025-11-05)

**REQUIRES COMPONENT EXTENSIONS** – Implementation will need additional entries in material, color, pattern, and embellishment components before new entities can be created.

#### What Currently Exists

- Mature clothing entity architecture with `clothing:wearable`, `core:material`, and descriptor components
- Material component (`core:material`) supporting textiles like leather, silk, cotton, but **lacking brocade, velvet**
- Descriptor components with partial coverage:
  - `descriptors:color_basic` → includes `black`, `red`, `blue`
  - `descriptors:color_extended` → includes `gold`, `silver`, but lacks specific gothic shades
  - `descriptors:texture` → includes `scarred`, `velvety`, `silky`, `smooth`
  - `descriptors:pattern` → includes `baroque-scroll`, `solid`, but lacks `serpentine`
  - `descriptors:embellishment` → includes `gemstone`, `metal-chain`, `crystal`, `pearl`
- Existing similar items to differentiate from:
  - Various robes (blush pink, red satin) - need black silk variant
  - Leather items (codpiece, belt) - need leather coat, trousers, boots
  - Necklaces (gold chains, pearls) - need gothic silver variant

#### What This Document Defines

- Addition of **14** new clothing/accessory entity files in `data/mods/clothing/entities/definitions/`
- Extension of material component with new enum values (brocade, velvet)
- Extension of color_extended component with gothic color palette (deep-crimson, midnight-blue, blood-red)
- Extension of pattern component with serpentine pattern
- Extension of embellishment component with spike embellishment
- Detailed component payloads for each item including layering, slot usage, descriptors, and narrative copy

### Prerequisites for Implementation

**Component updates required prior to entity creation:**

1. `data/mods/core/components/material.component.json`
   - Add `"brocade"` (for heavy brocade fabric)
   - Add `"velvet"` (for velvet gown)

2. `data/mods/descriptors/components/color_extended.component.json`
   - Add `"deep-crimson"` (for structured bodice)
   - Add `"midnight-blue"` (for military coat)
   - Add `"blood-red"` (for cape)

3. `data/mods/descriptors/components/pattern.component.json`
   - Add `"serpentine"` (for serpentine patterns in brocade)

4. `data/mods/descriptors/components/embellishment.component.json`
   - Add `"spike"` (for spiked collar)

**New entity definition files to add:**

1. `data/mods/clothing/entities/definitions/floor_length_black_leather_coat.entity.json`
2. `data/mods/clothing/entities/definitions/heavy_brocade_fabric_silver_serpentine.entity.json`
3. `data/mods/clothing/entities/definitions/black_diamond_silver_spike_collar.entity.json`
4. `data/mods/clothing/entities/definitions/structured_bodice_deep_crimson_steel_boning.entity.json`
5. `data/mods/clothing/entities/definitions/fitted_black_leather_trousers.entity.json`
6. `data/mods/clothing/entities/definitions/thigh_high_steel_tipped_boots.entity.json`
7. `data/mods/clothing/entities/definitions/military_coat_midnight_blue_gold_epaulettes.entity.json`
8. `data/mods/clothing/entities/definitions/battle_scarred_leather_jacket.entity.json`
9. `data/mods/clothing/entities/definitions/knee_high_combat_boots.entity.json`
10. `data/mods/clothing/entities/definitions/flowing_cape_blood_red.entity.json`
11. `data/mods/clothing/entities/definitions/black_silk_robe_kimono_sleeves.entity.json`
12. `data/mods/clothing/entities/definitions/full_length_black_velvet_gown.entity.json`
13. `data/mods/clothing/entities/definitions/twisted_black_metal_crown_blood_red_gems.entity.json`
14. `data/mods/clothing/entities/definitions/silver_chain_pendant_necklace.entity.json`

---

## 1. Overview

### 1.1 Feature Summary

Introduce a comprehensive gothic wardrobe collection spanning dramatic outerwear, structured garments, combat-ready pieces, and regal accessories:

**Outerwear:**
1. **Floor-length black leather coat** – dramatic silhouette with shoulder embellishments
2. **Military coat (midnight blue with gold epaulettes)** – structured military styling
3. **Battle-scarred leather jacket** – weathered combat aesthetic
4. **Flowing cape (blood-red)** – dramatic flowing outer layer

**Bodywear:**
5. **Heavy brocade fabric (silver serpentine patterns)** – can be used as material reference or garment
6. **Structured bodice (deep crimson with steel boning)** – corseted torso piece
7. **Fitted black leather trousers** – sleek leather bottoms
8. **Full-length black velvet gown** – elegant structured evening wear

**Footwear:**
9. **Thigh-high boots with steel-tipped heels** – dramatic tall boots
10. **Knee-high combat boots** – practical military-style boots

**Robes:**
11. **Black silk robe with kimono sleeves** – flowing Asian-inspired robe

**Accessories:**
12. **Black diamond and silver spike collar** – statement necklace with gothic edge
13. **Crown of twisted black metal and blood-red gemstones** – regal headpiece
14. **Silver chain pendant necklace** – layerable gothic jewelry

### 1.2 Goals & Value

- Establish comprehensive gothic aesthetic clothing category
- Provide dramatic, dark wardrobe options for characters with gothic, military, or regal themes
- Enable gothic outfit coordination with matching color palette (black, crimson, midnight blue, blood-red)
- Introduce new materials (brocade, velvet) for future textile variety
- Add regal and combat accessories for character customization

### 1.3 Non-Goals

- No modifications to existing clothing entities
- No new equipment slot types (use existing slots)
- No gameplay logic changes; focus solely on content additions
- No removal or replacement of existing items

---

## 2. Functional Requirements

### FR-1: New Clothing Entities

Create fourteen new entity definition JSON files following existing schema conventions. Each entity must include `clothing:wearable`, `core:material`, `core:name`, `core:description`, and appropriate descriptor components.

#### 2.1 Floor-Length Black Leather Coat

- **File/ID**: `clothing:floor_length_black_leather_coat`
- **Layering & Slots**: `layer` → `outer`; `equipmentSlots.primary` → `torso_upper`; `equipmentSlots.secondary` → `["left_arm_clothing", "right_arm_clothing"]`; `allowedLayers` → `["underwear", "base", "outer"]`
- **Material**: `leather` with optional `properties` → `["flexible"]`; optional `careInstructions` → `["requires_oiling"]`
- **Descriptors**:
  - `descriptors:color_basic.color` → `black`
  - `descriptors:texture.texture` → `smooth`
  - `descriptors:length_category.length` → `very-long`
- **Coverage Mapping**: `covers` → `["torso_upper"]`, `coveragePriority` → `outer`
- **Weight**: Approximately 2.5-3.0 kg (heavy leather coat)
- **Narrative Notes**: Emphasize floor-length dramatic silhouette, structured shoulder pieces adding width and height, commanding presence, high collar, flowing lines, statement outerwear piece

#### 2.2 Heavy Brocade Fabric (Silver Serpentine Patterns)

**Note**: This can be implemented either as a fabric material component reference or as a standalone garment piece (e.g., brocade jacket or vest). Recommending implementation as a **brocade vest** for wearability.

- **File/ID**: `clothing:heavy_brocade_vest_silver_serpentine`
- **Layering & Slots**: `layer` → `base`; `equipmentSlots.primary` → `torso_upper`; `allowedLayers` → `["underwear", "base", "outer"]`
- **Material**: New `brocade` enum
- **Descriptors**:
  - `descriptors:color_extended.color` → `silver`
  - `descriptors:pattern.pattern` → New `serpentine` enum
  - `descriptors:texture.texture` → `glossy`
- **Coverage Mapping**: `covers` → `["torso_upper"]`, `coveragePriority` → `base`
- **Weight**: Approximately 0.8 kg (heavy fabric)
- **Narrative Notes**: Describe heavy luxurious brocade weave, silver thread forming serpentine snake patterns, ornate formal piece, rich texture, structured drape

#### 2.3 Black Diamond and Silver Spike Collar

- **File/ID**: `clothing:black_diamond_silver_spike_collar`
- **Layering & Slots**: `layer` → `accessories`; `equipmentSlots.primary` → `head_gear`; `allowedLayers` → `["accessories"]`
- **Material**: `steel` (for spike base) with optional `properties` → `["reflective"]`
- **Descriptors**:
  - `descriptors:color_basic.color` → `black`
  - `descriptors:embellishment` → New `spike` enum (primary), also reference `gemstone` in description
  - `descriptors:texture.texture` → `smooth`
- **Coverage Mapping**: `covers` → `["head_gear"]`, `coveragePriority` → `accessories`
- **Weight**: Approximately 0.3 kg
- **Narrative Notes**: Emphasize statement collar necklace, black diamonds set in silver, sharp decorative spikes, gothic elegance meets edge, choker style, dramatic accessory

#### 2.4 Structured Bodice (Deep Crimson, Steel Boning)

- **File/ID**: `clothing:structured_bodice_deep_crimson_steel_boning`
- **Layering & Slots**: `layer` → `base`; `equipmentSlots.primary` → `torso_upper`; `allowedLayers` → `["underwear", "base"]`
- **Material**: `fabric` (structured fabric blend) with reference to steel boning in description
- **Descriptors**:
  - `descriptors:color_extended` → New `deep-crimson` enum
  - `descriptors:texture.texture` → `smooth`
  - `descriptors:shape_general.shape` → `structured` (if available, otherwise describe in text)
- **Coverage Mapping**: `covers` → `["torso_upper"]`, `coveragePriority` → `base`
- **Weight**: Approximately 0.5 kg
- **Narrative Notes**: Describe corseted structure with steel boning providing support and silhouette definition, deep crimson rich color, lace-up or clasp closure, dramatic waist cinching, historical romantic gothic aesthetic

#### 2.5 Fitted Black Leather Trousers

- **File/ID**: `clothing:fitted_black_leather_trousers`
- **Layering & Slots**: `layer` → `base`; `equipmentSlots.primary` → `legs`; `equipmentSlots.secondary` → `["torso_lower"]`; `allowedLayers` → `["underwear", "base", "outer"]`
- **Material**: `leather` with `properties` → `["flexible"]`
- **Descriptors**:
  - `descriptors:color_basic.color` → `black`
  - `descriptors:texture.texture` → `smooth`
- **Coverage Mapping**: `covers` → `["torso_lower"]`, `coveragePriority` → `base`
- **Weight**: Approximately 0.9 kg
- **Narrative Notes**: Emphasize supple black leather, fitted silhouette, sleek second-skin feel, matte or slight sheen finish, ankle-length, versatile gothic staple

#### 2.6 Thigh-High Boots with Steel-Tipped Heels

- **File/ID**: `clothing:thigh_high_steel_tipped_boots`
- **Layering & Slots**: `layer` → `base`; `equipmentSlots.primary` → `feet`; `allowedLayers` → `["base", "outer"]`
- **Material**: `leather` with reference to steel heel tips in description
- **Descriptors**:
  - `descriptors:color_basic.color` → `black`
  - `descriptors:texture.texture` → `smooth`
  - `descriptors:length_category.length` → `very-long`
- **Weight**: Approximately 1.8 kg (tall boots are heavier)
- **Narrative Notes**: Describe thigh-high silhouette, steel-tipped heels providing sharp click and durability, commanding height, fitted leg, side zipper, statement footwear combining elegance and edge

#### 2.7 Military Coat (Midnight Blue, Gold Epaulettes)

- **File/ID**: `clothing:military_coat_midnight_blue_gold_epaulettes`
- **Layering & Slots**: `layer` → `outer`; `equipmentSlots.primary` → `torso_upper`; `equipmentSlots.secondary` → `["left_arm_clothing", "right_arm_clothing"]`; `allowedLayers` → `["underwear", "base", "outer"]`
- **Material**: `wool` (military-grade wool) with optional `properties` → `["insulating"]`
- **Descriptors**:
  - `descriptors:color_extended` → New `midnight-blue` enum
  - `descriptors:embellishment` → `metal-chain` (for chains detail)
  - `descriptors:texture.texture` → `smooth`
- **Coverage Mapping**: `covers` → `["torso_upper"]`, `coveragePriority` → `outer`
- **Weight**: Approximately 2.0 kg
- **Narrative Notes**: Emphasize military tailoring, structured shoulders with gold epaulettes, decorative chains, brass buttons, double-breasted style, midnight blue rich dark color, formal commanding presence

#### 2.8 Battle-Scarred Leather Jacket

- **File/ID**: `clothing:battle_scarred_leather_jacket`
- **Layering & Slots**: `layer` → `outer`; `equipmentSlots.primary` → `torso_upper`; `equipmentSlots.secondary` → `["left_arm_clothing", "right_arm_clothing"]`; `allowedLayers` → `["underwear", "base", "outer"]`
- **Material**: `leather` with `properties` → `["flexible"]`
- **Descriptors**:
  - `descriptors:color_basic.color` → `black`
  - `descriptors:texture.texture` → `scarred` ✅ (already exists!)
- **Coverage Mapping**: `covers` → `["torso_upper"]`, `coveragePriority` → `outer`
- **Weight**: Approximately 1.5 kg
- **Narrative Notes**: Emphasize weathered appearance, battle scars and scratches telling stories, worn-in supple leather, rugged aesthetic, asymmetric closures, combat-ready yet stylish

#### 2.9 Knee-High Combat Boots

- **File/ID**: `clothing:knee_high_combat_boots`
- **Layering & Slots**: `layer` → `base`; `equipmentSlots.primary` → `feet`; `allowedLayers` → `["base", "outer"]`
- **Material**: `leather` with `properties` → `["flexible"]`
- **Descriptors**:
  - `descriptors:color_basic.color` → `black`
  - `descriptors:texture.texture` → `rugged`
- **Weight**: Approximately 1.4 kg
- **Narrative Notes**: Describe military-style combat boots, knee-high height, heavy-duty soles, lace-up front, reinforced toe and heel, practical durability meets gothic aesthetic

#### 2.10 Flowing Cape (Blood-Red)

- **File/ID**: `clothing:flowing_cape_blood_red`
- **Layering & Slots**: `layer` → `outer`; `equipmentSlots.primary` → `torso_upper`; `allowedLayers` → `["outer"]`
- **Material**: `fabric` (flowing fabric like heavy cotton or light wool)
- **Descriptors**:
  - `descriptors:color_extended` → New `blood-red` enum
  - `descriptors:texture.texture` → `soft`
  - `descriptors:length_category.length` → `very-long`
- **Coverage Mapping**: `covers` → `["torso_upper"]`, `coveragePriority` → `outer`
- **Weight**: Approximately 1.0 kg
- **Narrative Notes**: Emphasize dramatic flowing silhouette, blood-red intense color, sweeping floor-length design, clasp or tie closure at neck, theatrical presence, billowing movement

#### 2.11 Black Silk Robe with Kimono Sleeves

- **File/ID**: `clothing:black_silk_robe_kimono_sleeves`
- **Layering & Slots**: `layer` → `base`; `equipmentSlots.primary` → `torso_upper`; `equipmentSlots.secondary` → `["left_arm_clothing", "right_arm_clothing"]`; `allowedLayers` → `["underwear", "base", "outer"]`
- **Material**: `silk`
- **Descriptors**:
  - `descriptors:color_basic.color` → `black`
  - `descriptors:texture.texture` → `silky`
  - `descriptors:embellishment` → Mention gold thread embroidery in description (not as component, or use pattern if added)
- **Coverage Mapping**: `covers` → `["torso_lower"]`, `coveragePriority` → `base`
- **Weight**: Approximately 0.6 kg
- **Narrative Notes**: Describe wide kimono-style sleeves, black silk base, gold thread embroidery creating elegant patterns, wrap-style closure with tie, Asian-inspired gothic fusion, luxurious drape

#### 2.12 Full-Length Black Velvet Gown

- **File/ID**: `clothing:full_length_black_velvet_gown`
- **Layering & Slots**: `layer` → `base`; `equipmentSlots.primary` → `full_body`; `allowedLayers` → `["underwear", "base", "outer"]`
- **Material**: New `velvet` enum
- **Descriptors**:
  - `descriptors:color_basic.color` → `black`
  - `descriptors:texture.texture` → `velvety`
  - `descriptors:length_category.length` → `very-long`
- **Coverage Mapping**: `covers` → `["torso_upper", "torso_lower"]`, `coveragePriority` → `base`
- **Weight**: Approximately 1.2 kg
- **Narrative Notes**: Emphasize full-length elegant silhouette, black velvet rich luxurious texture, structured bodice (can reference boning), sweeping skirt, formal gothic evening wear, dramatic neckline options

#### 2.13 Crown of Twisted Black Metal and Blood-Red Gemstones

- **File/ID**: `clothing:twisted_black_metal_crown_blood_red_gems`
- **Layering & Slots**: `layer` → `accessories`; `equipmentSlots.primary` → `head_gear`; `allowedLayers` → `["accessories"]`
- **Material**: `iron` or `steel` (for twisted metal base)
- **Descriptors**:
  - `descriptors:color_basic.color` → `black`
  - `descriptors:embellishment` → `gemstone`
  - `descriptors:color_extended` → Mention `blood-red` gemstones in description
  - `descriptors:texture.texture` → `rough` or `ridged`
- **Coverage Mapping**: `covers` → `["head_gear"]`, `coveragePriority` → `accessories`
- **Weight**: Approximately 0.7 kg
- **Narrative Notes**: Describe twisted black metal forming crown structure, blood-red gemstones set throughout, gothic royalty aesthetic, sharp angular design, commanding regal presence, dark majesty

#### 2.14 Silver Chain Pendant Necklace

- **File/ID**: `clothing:silver_chain_pendant_necklace`
- **Layering & Slots**: `layer` → `accessories`; `equipmentSlots.primary` → `head_gear`; `allowedLayers` → `["accessories"]`
- **Material**: `silver`
- **Descriptors**:
  - `descriptors:color_extended.color` → `silver`
  - `descriptors:embellishment` → `metal-chain`
  - `descriptors:texture.texture` → `smooth`
- **Coverage Mapping**: `covers` → `["head_gear"]`, `coveragePriority` → `accessories`
- **Weight**: Approximately 0.2 kg
- **Narrative Notes**: Describe silver chain links, decorative pendants (symbols, crosses, or gothic motifs), layerable accessory, gothic jewelry staple, versatile length, oxidized or polished silver finish

### FR-2: Narrative Consistency

- Each `core:description` should be 3–5 sentences, highlighting tactile qualities, fit, usage scenarios, and gothic aesthetic.
- Ensure descriptions mention complementary items where relevant (e.g., bodice with trousers, coat with boots) to encourage outfit cohesion.
- Emphasize dramatic, commanding, dark, elegant themes consistent with gothic aesthetic.
- Avoid duplicating language from existing entity descriptions to maintain distinct voice.

### FR-3: Validation Compliance

- All new JSON files must validate against `entity-definition.schema.json` and respective component schemas.
- Run `npm run validate` after additions to confirm mod data integrity.
- Ensure all new enum values are properly added before entity creation.

---

## 3. Component Enhancement Proposals

### 3.1 Material Component Enhancement

**File**: `data/mods/core/components/material.component.json`

**Current Enum** includes: leather, silk, cotton, wool, satin, linen, etc.

**Proposed Additions**:

```json
"enum": [
  "brocade",    // Heavy ornamental fabric with raised patterns
  "calfskin",
  "canvas",
  // ... existing materials ...
  "velvet",     // Soft fabric with dense pile
  "wood",
  "wool"
]
```

**Justification**:
- **brocade**: Distinct ornamental fabric with woven raised patterns, essential for formal gothic pieces
- **velvet**: Luxurious pile fabric with distinct texture and appearance, fundamental gothic material

### 3.2 Color Extended Component Enhancement

**File**: `data/mods/descriptors/components/color_extended.component.json`

**Current Enum** includes: amber, auburn, blonde, cream, gold, navy, silver, etc.

**Proposed Additions**:

```json
"enum": [
  "abyssal-black",
  "amber",
  // ... existing colors ...
  "blood-red",      // Deep vivid red with dark undertones
  // ... more colors ...
  "deep-crimson",   // Rich deep red
  // ... more colors ...
  "midnight-blue",  // Very dark blue, almost black
  "murky-green",
  // ... rest of colors ...
]
```

**Justification**:
- **deep-crimson**: Specific rich red shade for gothic formal wear, distinct from basic red
- **midnight-blue**: Very dark blue essential for military and gothic pieces, distinct from navy
- **blood-red**: Dramatic vivid dark red for gothic dramatic pieces like capes

### 3.3 Pattern Component Enhancement

**File**: `data/mods/descriptors/components/pattern.component.json`

**Current Enum** includes: baroque-scroll, checked, floral, geometric, heart, plaid, polka-dot, solid, striped

**Proposed Addition**:

```json
"enum": [
  "baroque-scroll",
  "checked",
  "floral",
  "geometric",
  "heart",
  "plaid",
  "polka-dot",
  "serpentine",    // Snake-like winding patterns
  "solid",
  "striped"
]
```

**Justification**:
- **serpentine**: Specific snake-like winding pattern essential for gothic brocade designs, distinct from geometric

### 3.4 Embellishment Component Enhancement

**File**: `data/mods/descriptors/components/embellishment.component.json`

**Current Enum** includes: crystal, gemstone, metal-chain, pearl

**Proposed Addition**:

```json
"enum": [
  "crystal",
  "gemstone",
  "metal-chain",
  "pearl",
  "spike"          // Sharp pointed embellishments
]
```

**Justification**:
- **spike**: Sharp decorative elements essential for gothic edgy accessories, distinct from other embellishments

---

## 4. Implementation Plan

### Phase 1: Component Extensions

1. **Extend Materials** – Update `core:material` component enum with `brocade` and `velvet`
2. **Extend Colors** – Update `descriptors:color_extended` component enum with `deep-crimson`, `midnight-blue`, and `blood-red`
3. **Extend Patterns** – Update `descriptors:pattern` component enum with `serpentine`
4. **Extend Embellishments** – Update `descriptors:embellishment` component enum with `spike`
5. **Validate Components** – Run `npm run validate` to ensure schema changes don't break existing items

### Phase 2: Entity Creation

**Outerwear Group** (Items 1, 7, 8, 10):
1. Create `floor_length_black_leather_coat.entity.json`
2. Create `military_coat_midnight_blue_gold_epaulettes.entity.json`
3. Create `battle_scarred_leather_jacket.entity.json`
4. Create `flowing_cape_blood_red.entity.json`

**Bodywear Group** (Items 2, 4, 5, 12):
5. Create `heavy_brocade_vest_silver_serpentine.entity.json`
6. Create `structured_bodice_deep_crimson_steel_boning.entity.json`
7. Create `fitted_black_leather_trousers.entity.json`
8. Create `full_length_black_velvet_gown.entity.json`

**Footwear Group** (Items 6, 9):
9. Create `thigh_high_steel_tipped_boots.entity.json`
10. Create `knee_high_combat_boots.entity.json`

**Robes Group** (Item 11):
11. Create `black_silk_robe_kimono_sleeves.entity.json`

**Accessories Group** (Items 3, 13, 14):
12. Create `black_diamond_silver_spike_collar.entity.json`
13. Create `twisted_black_metal_crown_blood_red_gems.entity.json`
14. Create `silver_chain_pendant_necklace.entity.json`

### Phase 3: Validation & Testing

1. **Schema Validation** – Run `npm run validate` for all new entities
2. **Cross-Verify Duplication** – Confirm no conflicting IDs with existing clothing items
3. **Weight Verification** – Ensure weight values are realistic for item types
4. **Component Validation** – Verify all component combinations are valid
5. **Coverage Validation** – Ensure coverage mappings align with equipment slots

### Phase 4: Documentation

1. Update any centralized clothing documentation with new gothic collection
2. Document new enum values in component files
3. Create outfit combination examples featuring gothic pieces

---

## 5. Non-Functional Requirements

- Maintain consistent indentation (two spaces) and property ordering used in existing entity files
- Use snake_case filenames and entity IDs matching the filename stem
- Provide `core:name.text` values that match common apparel terminology
- Ensure `core:description` text is 3-5 sentences with rich descriptive language
- Use appropriate weight values based on material and garment type
- Order component properties consistently across all entities

---

## 6. Testing Strategy

### Validation Testing
- ✅ `npm run validate` – Required to ensure schema validation success for new descriptors and entities
- ✅ Verify no duplicate entity IDs across all mods
- ✅ Confirm all component references use valid enum values

### Integration Testing
- ✅ Test entity loading in development environment
- ✅ Verify equipment slot assignments work correctly
- ✅ Test layer combinations and conflicts
- ✅ Validate coverage mapping behavior

### Content Testing
- Manual review of descriptions for consistency and quality
- Verify color/texture/pattern combinations make visual sense
- Test outfit combinations for thematic cohesion

---

## 7. Acceptance Criteria

### Component Updates Complete
- ✅ Material enum extended with `brocade` and `velvet`
- ✅ Color_extended enum extended with `deep-crimson`, `midnight-blue`, and `blood-red`
- ✅ Pattern enum extended with `serpentine`
- ✅ Embellishment enum extended with `spike`

### Entity Files Complete
- ✅ Fourteen new entity files exist with correctly configured components and unique IDs
- ✅ All entities use appropriate equipment slots and layers
- ✅ Coverage mappings are correct for each item type
- ✅ Weight values are realistic

### Quality Standards Met
- ✅ Descriptions clearly differentiate each item and reference relevant functional/aesthetic qualities
- ✅ Gothic aesthetic theme is consistent across all items
- ✅ Narrative voice is distinct from existing clothing descriptions
- ✅ Validation command passes without warnings or errors

### Outfit Cohesion
- ✅ Items can be combined into complete gothic outfits
- ✅ Color palette is coordinated (black, crimson, midnight-blue, blood-red, silver)
- ✅ Layering system works correctly for outfit combinations

---

## 8. Future Considerations

### Additional Gothic Items
- Consider expanding gothic collection with:
  - Gothic boots variants (platform boots, buckled boots)
  - Additional accessory options (rings, belts, chokers)
  - Gothic headpieces (veils, tiaras)
  - Alternative gothic colors (deep purple, dark green)

### Material Properties
- Add durability values specific to brocade and velvet
- Define care instructions for new materials
- Consider breathability and flexibility properties for materials

### Pattern Variants
- Expand pattern options with additional gothic motifs (skull, cross, thorn)
- Consider damascene patterns for metalwork
- Add filigree pattern option

### Equipment Slots
- Consider dedicated `neck` equipment slot for collars/chokers vs. necklaces
- Evaluate dedicated `crown` or `headwear` slot separate from general `head_gear`
- Consider `cape` slot separate from jackets/coats if capes proliferate

### Outfit Sets
- Create named outfit sets/ensembles
- Add outfit recommendation metadata
- Consider "gothic formal" vs "gothic combat" categorization

---

## 9. Related Files & References

### Component Schemas
- `data/mods/core/components/material.component.json` - Material enum definition
- `data/mods/descriptors/components/color_basic.component.json` - Basic colors
- `data/mods/descriptors/components/color_extended.component.json` - Extended colors
- `data/mods/descriptors/components/texture.component.json` - Texture properties
- `data/mods/descriptors/components/pattern.component.json` - Pattern types
- `data/mods/descriptors/components/embellishment.component.json` - Embellishment types
- `data/mods/descriptors/components/length_category.component.json` - Length categories
- `data/mods/clothing/components/wearable.component.json` - Wearable component schema
- `data/mods/clothing/components/coverage_mapping.component.json` - Coverage mapping schema

### Reference Entity Examples
- `data/mods/clothing/entities/definitions/dark_olive_cotton_twill_chore_jacket.entity.json` - Jacket structure reference
- `data/mods/clothing/entities/definitions/indigo_denim_trucker_jacket.entity.json` - Outer layer jacket
- `data/mods/clothing/entities/definitions/red_satin_shawl_robe.entity.json` - Robe structure
- `data/mods/clothing/entities/definitions/croc_embossed_ankle_boots.entity.json` - Boot structure
- `data/mods/clothing/entities/definitions/fitted_navy_cotton_boxer_briefs.entity.json` - Fitted garment
- `data/mods/clothing/entities/definitions/layered_gold_chain_necklaces.entity.json` - Necklace accessory
- `data/mods/clothing/entities/definitions/versace_barocco_black_gold_slip_dress.entity.json` - Full-body garment
- `data/mods/clothing/entities/definitions/high_waisted_pencil_skirt_black.entity.json` - Structured garment

### Existing Gothic/Dark Items
- `data/mods/clothing/entities/definitions/black_leather_codpiece.entity.json` - Leather item
- `data/mods/clothing/entities/definitions/black_calfskin_belt.entity.json` - Leather accessory
- Multiple black clothing items for differentiation reference

---

## 10. Implementation Notes

### Recommended Item Order

Implement in groups for efficiency and coherent testing:

**Group A - Foundation Pieces** (outerwear and bottoms):
1. Floor-length black leather coat
2. Fitted black leather trousers
3. Battle-scarred leather jacket
4. Military coat midnight blue

**Group B - Statement Pieces** (bodywear and formal):
5. Structured bodice deep crimson
6. Full-length black velvet gown
7. Heavy brocade vest silver serpentine
8. Black silk robe kimono sleeves

**Group C - Footwear**:
9. Thigh-high steel-tipped boots
10. Knee-high combat boots

**Group D - Dramatic Accessories**:
11. Flowing cape blood-red
12. Twisted black metal crown
13. Black diamond silver spike collar
14. Silver chain pendant necklace

### Outfit Combinations

**Example Gothic Formal Ensemble**:
- Full-length black velvet gown
- Silver chain pendant necklace
- Twisted black metal crown
- Thigh-high steel-tipped boots

**Example Gothic Military**:
- Military coat midnight blue
- Structured bodice deep crimson
- Fitted black leather trousers
- Knee-high combat boots
- Black diamond silver spike collar

**Example Gothic Regal**:
- Floor-length black leather coat
- Heavy brocade vest silver serpentine
- Fitted black leather trousers
- Thigh-high steel-tipped boots
- Twisted black metal crown
- Silver chain pendant necklace

**Example Gothic Warrior**:
- Battle-scarred leather jacket
- Fitted black leather trousers
- Knee-high combat boots
- Black diamond silver spike collar

**Example Gothic Dramatic**:
- Flowing cape blood-red
- Black silk robe kimono sleeves
- Full-length black velvet gown
- Silver chain pendant necklace
- Twisted black metal crown

---

**Document Version**: 1.0.0
**Date**: 2025-11-05
**Status**: Specification Complete – Awaiting component enum extensions and entity implementation
**Author**: Gothic Wardrobe Expansion Team
