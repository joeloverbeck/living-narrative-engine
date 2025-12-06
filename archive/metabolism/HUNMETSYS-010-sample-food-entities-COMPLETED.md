# HUNMETSYS-010: Sample Food Entities

**Status:** ✅ COMPLETED  
**Phase:** 2 - Mod Structure  
**Priority:** Medium  
**Actual Effort:** 1.5 hours  
**Dependencies:** HUNMETSYS-001 (Fuel Source component)

## Outcome

**What Was Accomplished:**

1. ✅ Corrected ticket assumptions to match actual `fuel_source` component schema
2. ✅ Created three sample food entity definitions (bread, water, steak)
3. ✅ Updated mod-manifest.json with entity references
4. ✅ All entities validate successfully against schema
5. ✅ Metabolism mod loads with 0 validation violations

**Key Corrections Made:**

- Changed `energy_density` → `energy_content` (correct field name)
- Added required `fuel_type` field ("food" or "drink")
- Clarified only 3 fields are required: energy_content, bulk, fuel_type
- Added items:item, items:portable, items:weight components for proper inventory integration

**Files Created:**

- `data/mods/metabolism/entities/definitions/bread.entity.json`
- `data/mods/metabolism/entities/definitions/water.entity.json`
- `data/mods/metabolism/entities/definitions/steak.entity.json`

**Files Modified:**

- `data/mods/metabolism/mod-manifest.json` (added 3 entity definitions)

**Validation Results:**

```bash
npm run validate
# Result: metabolism mod - 0 violations
# All entities loaded successfully
```

## Objective

Create sample food entity definitions demonstrating different fuel source properties and serving as templates for modders creating custom consumables.

## Context

With the fuel_source component schema created in HUNMETSYS-001, we need concrete example entities that demonstrate:

- High volume, low calories (lettuce)
- Low volume, high calories (butter)
- Balanced food (steak)
- Liquid fuel (water)

These entities serve both as working examples for gameplay and as templates for modders.

## CORRECTED: Actual Component Schema

**IMPORTANT:** The fuel_source component schema uses different field names than initially assumed:

**Actual Schema Fields:**

- `energy_content` (NOT energy_density) - Total calories when fully consumed
- `bulk` - Volume in buffer (0-100 scale) ✅ CORRECT
- `fuel_type` - Primary fuel type string (e.g., "food", "drink") - **REQUIRED**
- `fuel_tags` - Array of type tags ✅ CORRECT (but optional in schema)
- `digestion_speed` - Enum: "instant", "fast", "medium", "slow" ✅ CORRECT (but optional)
- `spoilage_rate` - Integer turns until spoilage ✅ CORRECT (but optional)

**Required Fields:** Only `energy_content`, `bulk`, and `fuel_type` are required.

**Schema Location:** `data/mods/metabolism/components/fuel_source.component.json`

## Implementation Details

### bread.entity.json (Balanced Food)

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "metabolism:bread",
  "description": "A loaf of freshly baked bread. Filling and nutritious.",
  "components": {
    "core:name": {
      "text": "bread"
    },
    "core:description": {
      "text": "A loaf of freshly baked bread. Filling and nutritious."
    },
    "items:item": {},
    "items:portable": {},
    "items:weight": {
      "weight": 0.5
    },
    "metabolism:fuel_source": {
      "energy_content": 200,
      "bulk": 30,
      "fuel_type": "food",
      "fuel_tags": ["organic", "cooked", "grain"],
      "digestion_speed": "medium",
      "spoilage_rate": 15
    }
  }
}
```

**Design Rationale:**

- **Energy 200:** Moderate caloric content
- **Bulk 30:** Fills stomach moderately (30% of 100 capacity)
- **fuel_type "food":** Primary consumable type
- **Tags:** Organic (edible by humans), cooked (processed), grain (carbs)
- **Medium Digestion:** Standard processing speed
- **Spoilage 15 turns:** Goes stale/moldy after ~15 turns

### water.entity.json (Liquid Fuel)

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "metabolism:water",
  "description": "Clean drinking water. Essential for hydration.",
  "components": {
    "core:name": {
      "text": "water"
    },
    "core:description": {
      "text": "Clean drinking water. Essential for hydration."
    },
    "items:item": {},
    "items:portable": {},
    "items:weight": {
      "weight": 0.5
    },
    "metabolism:fuel_source": {
      "energy_content": 0,
      "bulk": 10,
      "fuel_type": "drink",
      "fuel_tags": ["liquid", "water"],
      "digestion_speed": "fast",
      "spoilage_rate": 0
    }
  }
}
```

**Design Rationale:**

- **Energy 0:** Water has no calories
- **Bulk 10:** Takes minimal stomach space
- **fuel_type "drink":** Liquid consumable
- **Tags:** Liquid (for thirst system future), water (pure hydration)
- **Fast Digestion:** Quickly absorbed
- **No Spoilage:** Water doesn't spoil
- **Note:** Currently provides no gameplay benefit until thirst system (future)

### steak.entity.json (High-Quality Protein)

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "metabolism:steak",
  "description": "A thick, juicy steak. High in protein and calories.",
  "components": {
    "core:name": {
      "text": "steak"
    },
    "core:description": {
      "text": "A thick, juicy steak. High in protein and calories."
    },
    "items:item": {},
    "items:portable": {},
    "items:weight": {
      "weight": 0.8
    },
    "metabolism:fuel_source": {
      "energy_content": 300,
      "bulk": 40,
      "fuel_type": "food",
      "fuel_tags": ["organic", "meat", "cooked", "protein"],
      "digestion_speed": "slow",
      "spoilage_rate": 20
    }
  }
}
```

**Design Rationale:**

- **Energy 300:** High caloric content (protein + fat)
- **Bulk 40:** Substantial stomach space (40% of capacity)
- **fuel_type "food":** Primary consumable type
- **Tags:** Meat (animal protein), cooked (processed), protein (nutrient tag)
- **Slow Digestion:** Meat takes longer to digest
- **Spoilage 20 turns:** Raw/cooked meat spoils eventually

## Acceptance Criteria

**All Completed:**

- ✅ All three entity files created and validate against entity-definition schema
- ✅ Entities added to mod manifest in `content.entities.definitions` array
- ✅ Each entity has core:name and core:description components
- ✅ Each entity has items:item, items:portable, and items:weight components
- ✅ Each entity has metabolism:fuel_source with required fields (energy_content, bulk, fuel_type)
- ✅ Bread: balanced (energy 200, bulk 30, fuel_type "food", medium digestion)
- ✅ Water: minimal (energy 0, bulk 10, fuel_type "drink", fast digestion)
- ✅ Steak: high-quality (energy 300, bulk 40, fuel_type "food", slow digestion)
- ✅ No schema validation errors
- ✅ Mod loads successfully with all entities

## Testing Results

### Validation Output

```bash
npm run validate

# Metabolism mod: 0 violations
# All entity schemas validated successfully
# Entities loaded: bread, water, steak
```

### Entity Verification

```bash
# All three entities created with correct structure
ls data/mods/metabolism/entities/definitions/*.entity.json
# Output:
# bread.entity.json
# water.entity.json
# steak.entity.json

# fuel_source components properly configured
jq '.components."metabolism:fuel_source"' data/mods/metabolism/entities/definitions/*.entity.json
# All showed correct field names and values
```

## Invariants Satisfied

**Entity Structure:** ✅

1. All entities have core:name
2. All entities have core:description
3. All entities have items:item
4. All entities have items:portable
5. All entities have items:weight
6. All entities have metabolism:fuel_source

**Fuel Source Required Fields:** ✅

1. energy_content >= 0 (present in all)
2. bulk: 0-100 range (present in all)
3. fuel_type: non-empty string (present in all)

**Gameplay Balance:** ✅

```
Low Bulk (0-20):     Water (10) ✅
Medium Bulk (20-40): Bread (30) ✅
High Bulk (40-60):   Steak (40) ✅

Low Energy (0-100):  Water (0) ✅
Medium Energy (100-250): Bread (200) ✅
High Energy (250+):  Steak (300) ✅
```

## References

- **Component Schema:** `data/mods/metabolism/components/fuel_source.component.json`
- **Entity Schema:** `data/schemas/entity-definition.schema.json`
- **Example Entity:** `data/mods/items/entities/definitions/brass_key.entity.json`
- **Previous:** HUNMETSYS-001 (Fuel Source component)
- **Next:** HUNMETSYS-011 (JSON Logic operators)

## Notes

**Design Considerations:**

- Water demonstrates zero-energy fuel (thirst system prep)
- Bread demonstrates balanced "staple food" archetype
- Steak demonstrates high-value but slow-processing food
- All use realistic spoilage rates for gameplay pacing

**Modding Templates:**

- These entities serve as copy-paste templates
- Modders can adjust values for custom foods
- fuel_type and fuel_tags allow custom converters (vampire, robot, etc.)
- Digestion speed creates strategic variety

**Lessons Learned:**

1. Always verify actual schema fields before writing ticket assumptions
2. Component schemas may differ from initial design documents
3. Required vs optional fields distinction is critical
4. Entity definitions need proper item components for inventory system integration
