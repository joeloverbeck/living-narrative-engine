# High-Fashion Luxury Wardrobe Expansion Specification

> ✅ **IMPLEMENTATION READY WITH PREREQUISITES**: This specification defines fifteen new luxury clothing and accessory entities for the Living Narrative Engine and documents the descriptor updates required to support them.

## Implementation Status

### Current State (As of 2025-02-14)

- Existing wardrobe content skews toward everyday apparel with limited couture, jewelry, or eveningwear coverage (e.g., only one dress variant at `data/mods/clothing/entities/definitions/white_cotton_shift_dress.entity.json`).
- Footwear catalog lacks iconic designer heels and embellished evening sandals; crystal details are not presently represented anywhere in the footwear files.
- Current accessories include a single `platinum_necklace` entity without pearl- or multi-chain options (`data/mods/clothing/entities/definitions/platinum_necklace.entity.json`).
- Descriptor component inventories reveal missing enums necessary for gold metals, pearl materials, nuanced pink shades, glossy patent finishes, and ornate patterns (`data/mods/core/components/material.component.json`, `data/mods/descriptors/components/color_extended.component.json`, `data/mods/descriptors/components/texture.component.json`, `data/mods/descriptors/components/pattern.component.json`).

### Prerequisites for Implementation

The following updates MUST be completed before or alongside the new entity files:

1. Extend `data/mods/core/components/material.component.json` with the enum values `gold` and `pearl` to accurately capture jewelry construction.
2. Extend `data/mods/descriptors/components/color_extended.component.json` with nuanced luxury tones `powder-pink`, `pale-pink`, and `blush-pink` needed for the Zimmermann dress, Aubade bra, and Hangisi flats respectively.
3. Extend `data/mods/descriptors/components/texture.component.json` with `glossy` (or `patent-gloss`) to represent high-shine patent leather surfaces featured on the Anja 105 pumps.
4. Extend `data/mods/descriptors/components/pattern.component.json` with `baroque-scroll` to model Versace's Barocco motif.
5. **Suggested (New Component):** Add `data/mods/descriptors/components/embellishment.component.json` describing adornments such as `crystal`, `pearl`, and `metal-chain`. While optional for first pass, it will prevent overloading the `pattern` component and support future jeweled items. If deferred, embed embellishment details within descriptions but plan for follow-up implementation.

### New Entity Files to Create

Create the following entity definition files under `data/mods/clothing/entities/definitions/`:

1. `sand_silk_wrap_dress.entity.json`
2. `spanx_high_waisted_control_briefs.entity.json`
3. `nude_leather_ankle_tie_sandals.entity.json`
4. `south_sea_pearl_necklace_16mm.entity.json`
5. `ysl_black_tuxedo_trousers.entity.json`
6. `saint_laurent_anja_105_pumps_black_patent.entity.json`
7. `layered_pearl_choker.entity.json`
8. `zimmermann_powder_pink_linen_midi_dress.entity.json`
9. `aubade_bahia_balconette_bra_pale_pink.entity.json`
10. `manolo_blahnik_hangisi_flats_blush_satin.entity.json`
11. `mikimoto_delicate_pearl_strand.entity.json`
12. `versace_barocco_black_gold_slip_dress.entity.json`
13. `la_perla_black_silk_triangle_bra.entity.json`
14. `giuseppe_zanotti_harmony_115_sandals_black_crystal.entity.json`
15. `layered_gold_chain_necklaces.entity.json`

Each file MUST follow the entity schema (`schema://living-narrative-engine/entity-definition.schema.json`).

---

## 1. Feature Overview

### 1.1 Summary of Additions

This expansion introduces a coordinated capsule of luxury apparel, lingerie, footwear, and jewelry to support high-end narrative scenarios:

- **Dresses & Eveningwear (4)**: Sand silk wrap dress, Zimmermann powder-pink linen midi dress, Versace Barocco silk slip dress, layered color story for transitional day-to-night looks.
- **Tailoring (1)**: Yves Saint Laurent black tuxedo trousers to anchor suiting ensembles.
- **Lingerie & Shapewear (3)**: Spanx control briefs, Aubade Bahia balconette bra, La Perla silk triangle bra.
- **Footwear (4)**: Nude ankle-tie sandals, Saint Laurent Anja 105 patent pumps, Manolo Blahnik Hangisi flats, Giuseppe Zanotti Harmony 115 sandals.
- **Jewelry (3)**: South Sea pearl necklace (16mm), layered pearl choker, delicate Mikimoto pearl strand.
- **Accessories (1)**: Multiple thin gold chains at staggered lengths.

### 1.2 Goals and Value

- Elevate wardrobe diversity with marquee designer silhouettes and luxury textures.
- Provide accessories that pair naturally with couture outfits, enabling cohesive styled looks.
- Establish descriptor coverage for pearls, gold, ornate patterns, and patent finishes to unlock future catalog growth.

---

## 2. Existing Data Audit Highlights

- Dresses currently limited to casual cotton pieces, leaving formal options unrepresented.
- Underwear catalog lacks sculpting shapewear; adding Spanx-style briefs fills this functional niche.
- High-heel inventory is devoid of brand-specific stilettos or sandals with heel height metadata.
- Jewelry selection requires expansion beyond a single platinum chain to enable pearl-focused story beats.

---

## 3. Functional Requirements

### 3.1 Shared Implementation Guidelines

- **Layers & Slots**:
  - Dresses and suits: `clothing:wearable.layer = "base"`, `equipmentSlots.primary = "full_body"` (dresses) or `"legs"` with `secondary: ["torso_lower"]` (trousers).
  - Lingerie/Shapewear: `layer = "underwear"`, `equipmentSlots.primary = "torso_upper"` (bras) or `"torso_lower"` (briefs).
  - Footwear: `layer = "base"`, `equipmentSlots.primary = "feet"`.
  - Neckwear/Jewelry: `layer = "accessories"`, `equipmentSlots.primary = "head_gear"` consistent with `platinum_necklace`.
- **Allowed Layers**: mirror comparable existing entities—dresses `["underwear", "base", "outer"]`, lingerie `["underwear"]`, footwear `["base"]`, jewelry `["accessories"]`.
- **Coverage Mapping**: include `clothing:coverage_mapping` entries aligning with the garment’s coverage (`full_body`, `torso_upper`, `torso_lower`, `feet`, `head_gear`).
- **Descriptor Usage**:
  - `core:material` and `descriptors:texture` must leverage the new enums noted in Section 4 when applicable.
  - `descriptors:pattern` reserved for garments with overt motifs (Versace slip dress) or set to `solid` otherwise.
  - Consider `descriptors:size_specific` for heel heights ("105mm stiletto", "115mm stiletto") and pearl diameters ("16mm pearls") to retain structured metadata.
- **Descriptions**: follow house style—concise overview sentence followed by evocative details about silhouette, materials, and styling cues. Mention designer names where provided.

### 3.2 Item Specifications

Each subsection lists the minimum component expectations; additional optional descriptors may be included if relevant.

#### 3.2.1 Sand-Colored Silk Wrap Dress
- **File / ID**: `sand_silk_wrap_dress.entity.json` / `clothing:sand_silk_wrap_dress`
- **Components**:
  - `clothing:wearable.layer = "base"`, `equipmentSlots.primary = "full_body"`, `allowedLayers = ["underwear", "base", "outer"]`
  - `core:material.material = "silk"`
  - `descriptors:color_extended.color = "sand-beige"`
  - `descriptors:texture.texture = "silky"`
  - `descriptors:pattern.pattern = "solid"`
  - `clothing:coverage_mapping.covers = ["torso_upper", "torso_lower"]`
  - Optional `descriptors:size_specific.size = "asymmetrical mid-thigh hem"`
- **Description Notes**: Emphasize plunging neckline, asymmetrical hem, and wrap silhouette.

#### 3.2.2 High-Waisted Spanx Control Briefs
- **File / ID**: `spanx_high_waisted_control_briefs.entity.json` / `clothing:spanx_high_waisted_control_briefs`
- **Components**:
  - `clothing:wearable.layer = "underwear"`, `equipmentSlots.primary = "torso_lower"`, `allowedLayers = ["underwear"]`
  - `core:material.material = "nylon"` (reflecting compression blend)
  - `descriptors:color_basic.color = "nude"` (via extended component; if using `color_extended`, set to `nude`)
  - `descriptors:texture.texture = "smooth"`
  - Optional `descriptors:size_specific.size = "high-waisted control"`
- **Description Notes**: Mention shaping panels and seamless edges.

#### 3.2.3 Nude Leather Ankle-Tie Sandals
- **File / ID**: `nude_leather_ankle_tie_sandals.entity.json` / `clothing:nude_leather_ankle_tie_sandals`
- **Components**:
  - `layer = "base"`, `equipmentSlots.primary = "feet"`, `allowedLayers = ["base"]`
  - `core:material.material = "leather"`
  - `descriptors:color_extended.color = "nude"`
  - `descriptors:texture.texture = "smooth"`
  - Optional `descriptors:size_specific.size = "slim wraparound ankle ties"`
  - `coverage_mapping.covers = ["feet"]`
- **Description Notes**: Highlight delicate ankle ties and minimalist straps.

#### 3.2.4 16mm South Sea Pearl Necklace
- **File / ID**: `south_sea_pearl_necklace_16mm.entity.json` / `clothing:south_sea_pearl_necklace_16mm`
- **Components**:
  - `layer = "accessories"`, `equipmentSlots.primary = "head_gear"`, `allowedLayers = ["accessories"]`
  - `core:material.material = "pearl"` (requires new enum)
  - `descriptors:color_extended.color = "cream"` or new `pearl-white` if added later
  - `descriptors:texture.texture = "smooth"`
  - `descriptors:size_specific.size = "16mm pearls"`
  - Optional `descriptors:embellishment.embellishment = "pearl"` if new component adopted
- **Description Notes**: Stress luminous South Sea character and bold single strand presence.

#### 3.2.5 Yves Saint Laurent Black Tuxedo Trousers
- **File / ID**: `ysl_black_tuxedo_trousers.entity.json` / `clothing:ysl_black_tuxedo_trousers`
- **Components**:
  - `layer = "base"`, `equipmentSlots.primary = "legs"`, `equipmentSlots.secondary = ["torso_lower"]`
  - `core:material.material = "wool"`
  - `descriptors:color_basic.color = "black"`
  - `descriptors:texture.texture = "smooth"`
  - `coverage_mapping.covers = ["torso_lower"]`
- **Description Notes**: Include satin side stripe detail and high waist tailoring.

#### 3.2.6 Saint Laurent Anja 105 Pumps (Black Patent)
- **File / ID**: `saint_laurent_anja_105_pumps_black_patent.entity.json` / `clothing:saint_laurent_anja_105_pumps_black_patent`
- **Components**:
  - `layer = "base"`, `equipmentSlots.primary = "feet"`
  - `core:material.material = "leather"`
  - `descriptors:color_basic.color = "black"`
  - `descriptors:texture.texture = "glossy"` (new enum)
  - `descriptors:size_specific.size = "105mm stiletto heel"`
  - Optional `descriptors:embellishment` omitted (no adornments)
- **Description Notes**: Capture sharp pointed toe and mirrored patent sheen.

#### 3.2.7 Layered Pearl Choker
- **File / ID**: `layered_pearl_choker.entity.json` / `clothing:layered_pearl_choker`
- **Components**:
  - Jewelry layering identical to Section 3.2.4
  - `core:material.material = "pearl"`
  - `descriptors:color_extended.color = "cream"`
  - `descriptors:texture.texture = "smooth"`
  - Optional `descriptors:size_specific.size = "multi-row collar length"`
- **Description Notes**: Mention stacked strands and snug collar fit.

#### 3.2.8 Zimmermann Powder Pink Linen Midi Dress
- **File / ID**: `zimmermann_powder_pink_linen_midi_dress.entity.json` / `clothing:zimmermann_powder_pink_linen_midi_dress`
- **Components**:
  - Dress layering as in Section 3.2.1
  - `core:material.material = "linen"`
  - `descriptors:color_extended.color = "powder-pink"` (new enum)
  - `descriptors:texture.texture = "smooth"`
  - Optional `descriptors:pattern.pattern = "solid"`
  - Coverage mapping for torso upper/lower
- **Description Notes**: Include romantic puffed sleeves, tiered flowing skirt, midi length.

#### 3.2.9 Aubade Bahia Balconette Bra (Pale Pink)
- **File / ID**: `aubade_bahia_balconette_bra_pale_pink.entity.json` / `clothing:aubade_bahia_balconette_bra_pale_pink`
- **Components**:
  - Lingerie layering as Section 3.2.2
  - `core:material.material = "lace"`
  - `descriptors:color_extended.color = "pale-pink"` (new enum)
  - `descriptors:texture.texture = "silky"`
- **Description Notes**: Celebrate embroidered Bahia motif and supportive balconette cut.

#### 3.2.10 Manolo Blahnik Hangisi Flats (Blush Satin)
- **File / ID**: `manolo_blahnik_hangisi_flats_blush_satin.entity.json` / `clothing:manolo_blahnik_hangisi_flats_blush_satin`
- **Components**:
  - Footwear layering as Section 3.2.3
  - `core:material.material = "satin"`
  - `descriptors:color_extended.color = "blush-pink"` (new enum)
  - `descriptors:texture.texture = "silky"`
  - Optional `descriptors:embellishment.embellishment = "crystal"` for signature buckle if new component adopted; otherwise describe in text.
- **Description Notes**: Mention sparkling crystal buckle, flat profile, and iconic status.

#### 3.2.11 Delicate Mikimoto Pearl Strand
- **File / ID**: `mikimoto_delicate_pearl_strand.entity.json` / `clothing:mikimoto_delicate_pearl_strand`
- **Components**: Mirror Section 3.2.4 with slightly smaller `descriptors:size_specific.size = "graduated fine pearls"`.
- **Description Notes**: Highlight Mikimoto craftsmanship and subtle luster.

#### 3.2.12 Versace Barocco Silk Slip Dress (Black & Gold)
- **File / ID**: `versace_barocco_black_gold_slip_dress.entity.json` / `clothing:versace_barocco_black_gold_slip_dress`
- **Components**:
  - Dress layering as Section 3.2.1
  - `core:material.material = "silk"`
  - `descriptors:color_basic.color = "black"`
  - `descriptors:pattern.pattern = "baroque-scroll"` (new enum)
  - `descriptors:texture.texture = "silky"`
  - Optional `descriptors:size_specific.size = "draped cowl neckline"`
- **Description Notes**: Emphasize Barocco print interplay of black and gold, cowl neckline, slip silhouette.

#### 3.2.13 La Perla Black Silk Triangle Bra
- **File / ID**: `la_perla_black_silk_triangle_bra.entity.json` / `clothing:la_perla_black_silk_triangle_bra`
- **Components**: Same structure as Section 3.2.9 with `core:material.material = "silk"`, `descriptors:color_basic.color = "black"`, `descriptors:texture.texture = "silky"`.
- **Description Notes**: Mention whisper-thin silk cups and delicate elastic banding.

#### 3.2.14 Giuseppe Zanotti Harmony 115 Sandals (Black with Crystals)
- **File / ID**: `giuseppe_zanotti_harmony_115_sandals_black_crystal.entity.json` / `clothing:giuseppe_zanotti_harmony_115_sandals_black_crystal`
- **Components**:
  - Footwear layering as Section 3.2.3
  - `core:material.material = "leather"` (upper) with optional `properties = ["flexible"]`
  - `descriptors:color_basic.color = "black"`
  - `descriptors:texture.texture = "glossy"`
  - `descriptors:size_specific.size = "115mm heel"`
  - `descriptors:embellishment.embellishment = "crystal"` if new component adopted
- **Description Notes**: Highlight triple-strap silhouette and sparkling crystal embellishments.

#### 3.2.15 Multiple Thin Gold Chains (Layered Accessory)
- **File / ID**: `layered_gold_chain_necklaces.entity.json` / `clothing:layered_gold_chain_necklaces`
- **Components**:
  - Jewelry layering as Section 3.2.4
  - `core:material.material = "gold"` (new enum)
  - `descriptors:color_extended.color = "gold"` (if gold added to extended palette; otherwise treat via material only—consider adding `gold` to `color_extended` for consistency)
  - `descriptors:texture.texture = "smooth"`
  - `descriptors:size_specific.size = "tiered lengths"`
- **Description Notes**: Describe staggered chain lengths and delicate movement.

---

## 4. Descriptor & Component Updates

| Component Path | Action | Rationale |
| --- | --- | --- |
| `data/mods/core/components/material.component.json` | Add `gold`, `pearl` enums | Required to represent jewelry metals and pearl strands without resorting to generic `organic` or `fabric` labels.
| `data/mods/descriptors/components/color_extended.component.json` | Add `powder-pink`, `pale-pink`, `blush-pink`, (optionally `gold`, `pearl-white`) | Supports nuanced designer colorways; optional entries enable metallic hues if desired for layered gold chains.
| `data/mods/descriptors/components/texture.component.json` | Add `glossy`/`patent-gloss` | Captures patent leather sheen on Anja pumps and Harmony sandals.
| `data/mods/descriptors/components/pattern.component.json` | Add `baroque-scroll` | Encodes Versace’s Barocco print distinctly from generic `floral` or `geometric`.
| `data/mods/descriptors/components/embellishment.component.json` (new) | Introduce optional component with enum suggestions (`crystal`, `pearl`, `gemstone`, `metal-chain`) | Provides structured metadata for jeweled or embellished items (Hangisi flats, Harmony sandals, pearl necklaces). If implementation is deferred, ensure descriptions note embellishments clearly.
| `data/mods/descriptors/components/color_basic.component.json` | *No change required* | Existing palette already covers black and white fundamentals; nuanced shades handled via `color_extended`.

When adding new enums, maintain alphabetical ordering and update any relevant schema documentation.

---

## 5. Implementation Steps

1. **Descriptor Updates**: Extend enumerations and introduce the optional embellishment component. Validate schema integrity after modifications.
2. **Entity Authoring**: Create each JSON definition using existing garments as structural references. Ensure IDs follow `clothing:{descriptive_name}` convention and descriptions mention designer branding.
3. **Validation**: Run `npm run validate` to confirm all new descriptors and entities load successfully.
4. **Documentation**: Update any catalog or content index that references available luxury items if required by project docs.

---

## 6. Testing & Acceptance Criteria

- [ ] Schema validation passes for all modified descriptor components and new entity files.
- [ ] Each new entity equips to the appropriate slot/layer combination without conflict.
- [ ] Descriptions render without exceeding established length/style conventions.
- [ ] Optional embellishment component (if created) interoperates with existing systems and gracefully omits when absent.
- [ ] Visual/style QA confirms color, pattern, and material metadata align with source garments.

---

## 7. Future Enhancements

- Expand color descriptors with additional metallic and gemstone-inspired tones (rose-gold, gunmetal) as more jewelry is introduced.
- Consider a dual-tone color component to encode secondary accent colors (e.g., gold detailing on black base) beyond pattern metadata.
- Explore heel height normalization to numerical fields for footwear analytics once more data points exist.

---

**Document Version**: 1.0.0  
**Author**: Content Architecture  
**Date**: 2025-02-14  
**Status**: Implementation Ready (Descriptor Extensions Required)
