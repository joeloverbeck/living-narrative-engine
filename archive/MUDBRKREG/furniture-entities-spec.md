# Furniture Addition Specification: Mudbrook Municipal Aid Registry

## Document Metadata

- **Created**: 2025-11-23
- **Target Mod**: `fantasy`
- **Implementation Mod**: `furniture`
- **Status**: Design Specification

## Executive Summary

This specification defines the addition of three rustic civic furniture entities to support the Mudbrook Municipal Aid Registry location in the fantasy mod. The furniture will be implemented in the `furniture` mod for reusability across multiple fantasy scenarios.

## Context Analysis

### Location: Mudbrook Municipal Aid Registry

**File**: `data/mods/fantasy/entities/definitions/mudbrook_municipal_aid_registry.location.json`

**Setting & Theme**:

- Converted grain warehouse serving as civic office and public waiting area
- Architecture: Timber-built with thick vertical posts, wide plank flooring
- Function: Public service office with bulletin board, service counter, communal gathering space
- Atmosphere: Working-class civic space, functional rather than decorative
- Current Furnishings (described in text): "Rough tables and stools" with "thick, plain, slightly uneven" legs showing "years of use", plus benches and stools clustered together
- Mood: Permanent yet improvised, worn and lived-in

**Thematic Requirements**:

- Rustic, utilitarian aesthetic
- Working-class construction quality
- Worn from years of public use
- Functional over decorative
- Medieval/low-fantasy setting appropriate

## Architecture Review

### Existing Furniture Mod Patterns

**Entity Structure** (based on analysis of existing furniture):

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "furniture:[item_name]",
  "description": "Brief description",
  "components": {
    "core:name": { "text": "display name" },
    "core:description": { "text": "detailed description" },
    "core:portrait": {
      "imagePath": "portraits/[item].png",
      "altText": "accessibility description"
    },
    "sitting:allows_sitting": {
      "spots": [null, null, ...]  // Optional, array length = seating capacity
    },
    "items:item": {}  // Optional, marks as portable item
  }
}
```

**Key Components**:

- `core:name`: Display name for UI
- `core:description`: Narrative description text
- `core:portrait`: Placeholder only (system doesn't support item portraits yet)
- `sitting:allows_sitting`: Required for seating furniture, with array length determining capacity
- `items:item`: Optional component marking furniture as an item entity (affects portability)

**Existing Furniture Inventory**:

- **Seating**: throne (1), swivel_chair (1), luxury_armchair (1), bar_stools (3), park_bench (2), night_park_stone_bench (3), various sofas
- **Beds**: single_bed, four_poster_bed, upholstered_king_bed, working_class_king_bed, metal_framed_patient_bed
- **Tables**: **NONE FOUND** ← Critical gap

### Furniture-Location Integration

**Current System Behavior**:

- Location definitions contain only descriptive text and exits
- Location instances are simple pointers to definitions
- **Integration method unclear** from current codebase analysis
- Possible approaches:
  - Runtime spawning based on location rules/actions
  - World initialization associations
  - Future inventory/container system for locations

**Note**: Implementation will need to clarify the furniture-location association mechanism.

## Design Decisions

### Decision 1: Furniture Mod vs Fantasy Mod

**Chosen**: Implement in `furniture` mod

**Rationale**:

- ✅ Maintains existing architectural pattern (all current furniture is in furniture mod)
- ✅ Enables reuse across different fantasy scenarios
- ✅ Follows separation of concerns principle
- ✅ Generic rustic/civic furniture fits multiple contexts
- ✅ Avoids mod dependency complexity

**Alternative Considered**: Fantasy mod

- ❌ Less reusable
- ❌ Breaks from existing furniture organization pattern
- ⚠️ Would create mod dependency complexity

### Decision 2: Furniture Types

**Chosen**: Three entity types

1. **Rustic Wooden Table** - Large communal table (no seating component)
2. **Plain Wooden Stool** - Simple individual seating (1 spot)
3. **Rough Wooden Bench** - Communal seating (3 spots)

**Rationale**:

- Matches location's described furniture ("rough tables and stools", "benches")
- Fills critical gap (no tables in existing furniture mod)
- Existing park_bench unsuitable (outdoor/decorative aesthetic)
- Existing bar_stools could work but these are more generic/versatile

### Decision 3: Seating Capacity

- **Table**: 0 spots (tables don't have sitting component)
- **Stool**: 1 spot (individual seating)
- **Bench**: 3 spots (communal seating, matches civic/public use context)

### Decision 4: Items Component

**Tentative**:

- **Table**: Include `items:item` (TBD based on portability requirements)
- **Stool**: Include `items:item` (likely portable)
- **Bench**: Include `items:item` (TBD - less likely portable due to size)

**To Clarify**: System behavior when furniture has vs doesn't have items:item component

## Entity Specifications

### 1. Rustic Wooden Table

**File**: `data/mods/furniture/entities/definitions/rustic_wooden_table.entity.json`

**Purpose**: Large communal table for municipal office and public spaces

**JSON Structure**:

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "furniture:rustic_wooden_table",
  "description": "A sturdy rustic wooden table with thick legs and worn surface, suitable for civic and working-class settings",
  "components": {
    "core:name": {
      "text": "rustic wooden table"
    },
    "core:description": {
      "text": "A large table of rough-hewn timber, its surface worn smooth by years of use. The thick legs are slightly uneven, giving it a solid, functional appearance rather than any decorative refinement. Papers, ledgers, and the occasional abandoned cup have left their marks on the wood, adding to its well-used character."
    },
    "core:portrait": {
      "imagePath": "portraits/rustic_wooden_table.png",
      "altText": "A sturdy wooden table with thick plain legs and a worn surface"
    },
    "items:item": {}
  }
}
```

**Design Notes**:

- No `sitting:allows_sitting` component (tables don't provide seating)
- Description emphasizes functionality, wear, civic use
- `items:item` included (TBD if needed)

### 2. Plain Wooden Stool

**File**: `data/mods/furniture/entities/definitions/plain_wooden_stool.entity.json`

**Purpose**: Simple seating around tables and throughout public spaces

**JSON Structure**:

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "furniture:plain_wooden_stool",
  "description": "A simple wooden stool with uneven legs, typical of working-class civic furnishings",
  "components": {
    "core:name": {
      "text": "plain wooden stool"
    },
    "core:description": {
      "text": "A straightforward stool of plain wood, its seat worn smooth from countless hours of use. The legs are slightly uneven, betraying its rough-hewn construction, but it serves its purpose well enough. The kind of practical seating found in taverns, workshops, and public offices throughout the realm."
    },
    "core:portrait": {
      "imagePath": "portraits/plain_wooden_stool.png",
      "altText": "A simple wooden stool with uneven legs and a worn seat"
    },
    "sitting:allows_sitting": {
      "spots": [null]
    },
    "items:item": {}
  }
}
```

**Design Notes**:

- `sitting:allows_sitting` with 1 spot (individual seating)
- Description emphasizes simplicity, wear, utility
- `items:item` included (likely portable due to size)

### 3. Rough Wooden Bench

**File**: `data/mods/furniture/entities/definitions/rough_wooden_bench.entity.json`

**Purpose**: Communal seating for waiting areas and public gathering spaces

**JSON Structure**:

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "furniture:rough_wooden_bench",
  "description": "A long wooden bench with wide plank seating, built for durability in public civic spaces",
  "components": {
    "core:name": {
      "text": "rough wooden bench"
    },
    "core:description": {
      "text": "A sturdy bench fashioned from wide planks, the kind of utilitarian seating found in warehouses converted to civic use. The wood has been worn smooth by years of waiting townsfolk, its surface bearing the marks of countless hours spent in patient attendance. Simple construction, built to last rather than to impress."
    },
    "core:portrait": {
      "imagePath": "portraits/rough_wooden_bench.png",
      "altText": "A long wooden bench with wide plank seating and sturdy construction"
    },
    "sitting:allows_sitting": {
      "spots": [null, null, null]
    },
    "items:item": {}
  }
}
```

**Design Notes**:

- `sitting:allows_sitting` with 3 spots (communal seating)
- Description emphasizes warehouse origin, public use, durability
- `items:item` included (TBD - may not be portable due to size)

## Implementation Checklist

### Phase 1: Entity Definition Creation

- [ ] Create `data/mods/furniture/entities/definitions/rustic_wooden_table.entity.json`
- [ ] Create `data/mods/furniture/entities/definitions/plain_wooden_stool.entity.json`
- [ ] Create `data/mods/furniture/entities/definitions/rough_wooden_bench.entity.json`

### Phase 2: Validation

- [ ] Validate all entity definitions against `entity-definition.schema.json`
- [ ] Run `npm run validate` to ensure schema compliance
- [ ] Verify furniture IDs follow `furniture:[name]` pattern
- [ ] Confirm all required components present

### Phase 3: Integration (TBD)

- [ ] Clarify furniture-location association mechanism
- [ ] Create entity instances (if required by system)
- [ ] Add furniture to mudbrook_municipal_aid_registry location (method TBD)
- [ ] Update world file if necessary

### Phase 4: Testing

- [ ] Load fantasy mod with new furniture entities
- [ ] Verify entities load without errors
- [ ] Test seating mechanics on stool and bench
- [ ] Verify table loads correctly (no seating component)
- [ ] Test portability if `items:item` component matters

## Validation Requirements

### Schema Validation

All entities must validate against:

- `schema://living-narrative-engine/entity-definition.schema.json`
- Component schemas for `core:name`, `core:description`, `core:portrait`, `sitting:allows_sitting`, `items:item`

### Naming Conventions

- Entity IDs: `furniture:[lowercase_with_underscores]`
- File names: `[entity_name].entity.json`
- Display names: lowercase (e.g., "rustic wooden table")

### Component Requirements

- **Required**: `core:name`, `core:description`, `core:portrait`
- **Conditional**: `sitting:allows_sitting` (only for seating furniture)
- **Optional**: `items:item` (affects item/entity behavior)

## Open Questions

### 1. Furniture-Location Association

**Question**: How should furniture instances be associated with locations?
**Impact**: Affects implementation approach for adding furniture to mudbrook_municipal_aid_registry
**Investigation Needed**:

- Check world initialization code
- Review location loading system
- Examine existing location-entity relationships
  **Possible Answers**:
- Runtime spawning via rules/actions
- World file entity instance listings
- Future inventory/container system for locations

### 2. Items Component Behavior

**Question**: What is the behavioral difference when furniture has vs doesn't have `items:item` component?
**Impact**: Affects whether to include component on table and bench
**Investigation Needed**:

- Review items system documentation
- Compare existing furniture with/without component
- Test portability mechanics

### 3. Portrait Paths

**Question**: Should portrait paths be included even though system doesn't support them?
**Answer**: Yes, include as placeholders following existing pattern
**Rationale**:

- Maintains consistency with existing furniture entities
- Prepares for future feature support
- No harm in including placeholder paths

## Success Criteria

1. ✅ Three new furniture entities created in furniture mod
2. ✅ All entities validate against schemas without errors
3. ✅ Furniture aesthetic matches Mudbrook Municipal Aid Registry theme
4. ✅ Entities are generic enough for reuse in other fantasy scenarios
5. ✅ Seating capacities are appropriate (stool=1, bench=3, table=0)
6. ✅ No existing furniture duplicated unnecessarily
7. ✅ Integration path defined (even if implementation deferred)

## References

### Key Files

- `data/mods/fantasy/entities/definitions/mudbrook_municipal_aid_registry.location.json` - Target location
- `data/mods/furniture/entities/definitions/*.entity.json` - Existing furniture patterns
- `data/schemas/entity-definition.schema.json` - Entity validation schema
- `data/schemas/components/*.component.json` - Component schemas

### Related Documentation

- Project architecture: `CLAUDE.md`
- Entity Component System: Section in `CLAUDE.md`
- Mod system: `data/mods/` structure

## Appendix: Existing Furniture Analysis

### Suitable Existing Furniture

- **bar_stools.entity.json**: Could work for service counter but new stool is more generic
- None of the existing seating matches the rustic civic aesthetic

### Unsuitable Existing Furniture

- **park_bench**: Too outdoorsy/decorative (mentions canopy, wrought-iron, rust)
- **throne**: Too regal for municipal office
- **luxury_armchair**: Too fancy for working-class setting
- **swivel_chair**: Modern aesthetic doesn't match medieval/rustic setting
- **Beds**: Wrong furniture type entirely

### Critical Gaps Filled

- **Tables**: No existing tables in furniture mod (critical gap addressed by this spec)
- **Rustic benches**: park_bench exists but wrong aesthetic
- **Simple stools**: bar_stools exist but counter-height implied

---

**End of Specification**
