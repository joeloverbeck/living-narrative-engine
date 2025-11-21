# HUNMETSYS-010: Sample Food Entities

**Status:** Not Started  
**Phase:** 2 - Mod Structure  
**Priority:** Medium  
**Estimated Effort:** 3 hours  
**Dependencies:** HUNMETSYS-001 (Fuel Source component)

## Objective

Create sample food entity definitions demonstrating different fuel source properties and serving as templates for modders creating custom consumables.

## Context

With the fuel_source component schema created in HUNMETSYS-001, we need concrete example entities that demonstrate:
- High volume, low calories (lettuce)
- Low volume, high calories (butter)
- Balanced food (steak)
- Liquid fuel (water)

These entities serve both as working examples for gameplay and as templates for modders.

## Files to Touch

### New Files (3)
1. **`data/mods/metabolism/entities/definitions/bread.entity.json`**
   - Balanced food example
   - Medium energy, medium bulk
   - Cooked organic food

2. **`data/mods/metabolism/entities/definitions/water.entity.json`**
   - Liquid fuel example
   - Very low energy, low bulk
   - Fast digestion, liquid tag

3. **`data/mods/metabolism/entities/definitions/steak.entity.json`**
   - High-quality protein example
   - High energy, medium bulk
   - Slow digestion, meat tag

### Modified Files (1)
1. **`data/mods/metabolism/mod-manifest.json`**
   - Add all three entities to `content.entities` array
   - Keep paths correct: `definitions/bread.entity.json` etc.

## Implementation Details

### bread.entity.json (Balanced Food)
```json
{
  "$schema": "schema://living-narrative-engine/entity.schema.json",
  "id": "metabolism:bread",
  "components": {
    "core:name": {
      "text": "bread"
    },
    "core:description": {
      "text": "A loaf of freshly baked bread. Filling and nutritious."
    },
    "items:item": {
      "weight": 0.5,
      "stackable": false
    },
    "metabolism:fuel_source": {
      "energy_density": 200,
      "bulk": 30,
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
- **Tags:** Organic (edible by humans), cooked (processed), grain (carbs)
- **Medium Digestion:** Standard processing speed
- **Spoilage 15 turns:** Goes stale/moldy after ~15 turns

### water.entity.json (Liquid Fuel)
```json
{
  "$schema": "schema://living-narrative-engine/entity.schema.json",
  "id": "metabolism:water",
  "components": {
    "core:name": {
      "text": "water"
    },
    "core:description": {
      "text": "Clean drinking water. Essential for hydration."
    },
    "items:item": {
      "weight": 0.5,
      "stackable": false
    },
    "metabolism:fuel_source": {
      "energy_density": 0,
      "bulk": 10,
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
- **Tags:** Liquid (for thirst system future), water (pure hydration)
- **Fast Digestion:** Quickly absorbed
- **No Spoilage:** Water doesn't spoil
- **Note:** Currently provides no gameplay benefit until thirst system (future)

### steak.entity.json (High-Quality Protein)
```json
{
  "$schema": "schema://living-narrative-engine/entity.schema.json",
  "id": "metabolism:steak",
  "components": {
    "core:name": {
      "text": "steak"
    },
    "core:description": {
      "text": "A thick, juicy steak. High in protein and calories."
    },
    "items:item": {
      "weight": 0.8,
      "stackable": false
    },
    "metabolism:fuel_source": {
      "energy_density": 300,
      "bulk": 40,
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
- **Tags:** Meat (animal protein), cooked (processed), protein (nutrient tag)
- **Slow Digestion:** Meat takes longer to digest
- **Spoilage 20 turns:** Raw/cooked meat spoils eventually

## Out of Scope

**Not Included:**
- ❌ Complex recipes or cooking system (future extension)
- ❌ Spoilage mechanic implementation (tracked but not enforced yet)
- ❌ Nutritional variety system (vitamins, minerals, etc.)
- ❌ Food quality tiers (standard/luxury/survival)
- ❌ Temperature effects on spoilage
- ❌ Inventory weight calculations (assumed exists in items mod)

**Future Extensions:**
- Raw vs. cooked variants (raw steak vs. cooked steak)
- Multiple bread types (white, wheat, rye)
- Flavor/variety system
- Cooking actions that transform entities

## Acceptance Criteria

**Must Have:**
- ✅ All three entity files created and validate against entity schema
- ✅ Entities added to mod manifest
- ✅ Each entity has core:name and core:description components
- ✅ Each entity has items:item component (for inventory)
- ✅ Each entity has metabolism:fuel_source with all required fields
- ✅ Bread: balanced (energy 200, bulk 30, medium digestion)
- ✅ Water: minimal (energy 0, bulk 10, fast digestion)
- ✅ Steak: high-quality (energy 300, bulk 40, slow digestion)
- ✅ No schema validation errors
- ✅ Mod loads successfully with all entities

**Nice to Have:**
- Consider: Raw steak variant with higher spoilage rate
- Consider: Different bread types (whole wheat, sourdough)
- Consider: Additional liquid types (milk, juice)

## Testing Strategy

### Manual Validation
1. **Schema Validation:**
   ```bash
   npm run validate
   ```

2. **Mod Loading:**
   ```bash
   npm run start
   # Verify metabolism mod loads without errors
   # Verify entities appear in game
   ```

3. **Entity Instantiation (Manual):**
   - Spawn bread entity → verify components
   - Spawn water entity → verify components
   - Spawn steak entity → verify components
   - Verify all fuel_source fields present

### Verification Commands
```bash
# Validate all entity schemas
npm run validate

# Check mod manifest includes all entities
cat data/mods/metabolism/mod-manifest.json | grep -A 5 "entities"

# Verify entity files exist
ls -la data/mods/metabolism/entities/definitions/*.entity.json
```

## Invariants

**Entity Structure:**
1. All entities must have core:name
2. All entities must have core:description
3. All entities must have items:item (for inventory)
4. All entities must have metabolism:fuel_source

**Fuel Source Values:**
1. energy_density >= 0
2. bulk: 0-100 range
3. fuel_tags: non-empty array
4. digestion_speed: valid enum value
5. spoilage_rate >= 0

**Gameplay Balance:**
```
Low Bulk (0-20):     Water (10)
Medium Bulk (20-40): Bread (30)
High Bulk (40-60):   Steak (40)

Low Energy (0-100):  Water (0)
Medium Energy (100-250): Bread (200)
High Energy (250+):  Steak (300)
```

## Edge Cases

1. **Water with Zero Energy:**
   - Valid entity but provides no gameplay benefit currently
   - Will be useful when thirst system added
   - Won't remove hunger state, only fills minimal buffer

2. **Spoilage Rate Not Enforced:**
   - Currently tracked but not decremented per turn
   - Future work will implement spoilage system
   - Doesn't affect current gameplay

3. **Fuel Tag Matching:**
   - All tagged "organic" so work with human fuel_converter
   - Water also tagged "liquid" for future thirst system
   - Steak tagged "meat" and "protein" for future nutrition

4. **Slow Digestion Impact:**
   - Steak stays in buffer longer
   - Creates strategic choice: quick energy vs. long satiety
   - Requires activity_multiplier support in DIGEST_FOOD

## References

- **Spec:** Section "Food Properties System" (p. 24-26)
- **Spec:** Section "Mod Structure" (p. 11-12)
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
- Fuel tags allow custom converters (vampire, robot, etc.)
- Digestion speed creates strategic variety

**Future Work:**
- Raw vs. cooked cooking system
- Food quality tiers (fresh, stale, spoiled)
- Nutritional variety (vitamins, minerals)
- Recipe combinations (bread + meat = sandwich)
