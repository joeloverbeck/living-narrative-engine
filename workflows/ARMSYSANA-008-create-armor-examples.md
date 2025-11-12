# ARMSYSANA-008: Create Example Armor Entities

**Phase**: Phase 3 - Documentation and Examples
**Priority**: Medium
**Risk Level**: None (Example entities only)
**Estimated Effort**: 45 minutes

## Context

With armor support fully implemented and documented, practical examples are needed to demonstrate how to create armor entities. These examples serve as:
1. Reference implementations for mod developers
2. Test cases for armor functionality
3. Validation of the armor system design

## Objective

Create a collection of example armor entities covering various armor types, materials, and use cases. These examples should be complete, well-documented, and ready to use in mods.

## Example Armor Entities to Create

### 1. Steel Cuirass (Heavy Armor)

**File**: `data/mods/armor/entities/definitions/steel_cuirass.json` OR
          `data/mods/clothing/entities/definitions/armor/steel_cuirass.json`

**Description**: Polished steel chest armor - classic heavy armor piece

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "armor:steel_cuirass",
  "description": "Polished steel chest armor",
  "components": {
    "clothing:wearable": {
      "layer": "armor",
      "equipmentSlots": {
        "primary": "torso_upper"
      },
      "allowedLayers": ["underwear", "base", "armor", "outer"]
    },
    "core:material": {
      "material": "steel",
      "durability": 85,
      "properties": ["rigid", "reflective"]
    },
    "core:name": {
      "text": "steel cuirass"
    },
    "core:description": {
      "text": "A finely crafted steel cuirass that protects the torso. The polished metal gleams in the light, and articulated plates allow for reasonable mobility while providing substantial protection against bladed weapons."
    },
    "descriptors:texture": {
      "texture": "smooth"
    },
    "clothing:coverage_mapping": {
      "covers": ["torso_upper"],
      "coveragePriority": "armor"
    },
    "items:item": {},
    "items:portable": {},
    "items:weight": {
      "weight": 8.5
    }
  }
}
```

### 2. Leather Bracers (Light Armor)

**File**: `data/mods/armor/entities/definitions/leather_bracers.json`

**Description**: Hardened leather arm protection - light armor for mobility

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "armor:leather_bracers",
  "description": "Hardened leather arm protection",
  "components": {
    "clothing:wearable": {
      "layer": "armor",
      "equipmentSlots": {
        "primary": "left_arm_clothing",
        "secondary": ["right_arm_clothing"]
      },
      "allowedLayers": ["base", "armor", "outer"]
    },
    "core:material": {
      "material": "leather",
      "durability": 60,
      "properties": ["flexible"],
      "careInstructions": ["requires_oiling"]
    },
    "core:name": {
      "text": "leather bracers"
    },
    "core:description": {
      "text": "Sturdy leather bracers that protect the forearms. The hardened leather is reinforced with metal studs and provides protection without restricting arm movement. Worn leather shows signs of use and battle."
    },
    "descriptors:color_basic": {
      "color": "brown"
    },
    "descriptors:texture": {
      "texture": "rugged"
    },
    "descriptors:condition": {
      "condition": "worn"
    },
    "clothing:coverage_mapping": {
      "covers": ["left_arm_clothing", "right_arm_clothing"],
      "coveragePriority": "armor"
    },
    "items:item": {},
    "items:portable": {},
    "items:weight": {
      "weight": 1.2
    }
  }
}
```

### 3. Chainmail Hauberk (Medium Armor)

**File**: `data/mods/armor/entities/definitions/chainmail_hauberk.json`

**Description**: Full-length chainmail shirt - classic medium armor

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "armor:chainmail_hauberk",
  "description": "Full-length chainmail shirt",
  "components": {
    "clothing:wearable": {
      "layer": "armor",
      "equipmentSlots": {
        "primary": "torso_upper",
        "secondary": ["left_arm_clothing", "right_arm_clothing"]
      },
      "allowedLayers": ["underwear", "base", "armor", "outer"]
    },
    "core:material": {
      "material": "iron",
      "durability": 75,
      "properties": ["flexible"]
    },
    "core:name": {
      "text": "chainmail hauberk"
    },
    "core:description": {
      "text": "A knee-length shirt of interlocking iron rings. The chainmail provides excellent protection against slashing attacks while remaining flexible enough for combat movement. The weight is distributed across the shoulders and the metal rings create a distinctive sound with every movement."
    },
    "descriptors:texture": {
      "texture": "metallic"
    },
    "clothing:coverage_mapping": {
      "covers": ["torso_upper", "torso_lower", "left_arm_clothing", "right_arm_clothing"],
      "coveragePriority": "armor"
    },
    "items:item": {},
    "items:portable": {},
    "items:weight": {
      "weight": 12.0
    }
  }
}
```

### 4. Iron Helmet (Head Armor)

**File**: `data/mods/armor/entities/definitions/iron_helmet.json`

**Description**: Simple iron helmet - basic head protection

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "armor:iron_helmet",
  "description": "Simple iron helmet",
  "components": {
    "clothing:wearable": {
      "layer": "armor",
      "equipmentSlots": {
        "primary": "head_gear"
      },
      "allowedLayers": ["base", "armor"]
    },
    "core:material": {
      "material": "iron",
      "durability": 70,
      "properties": ["rigid"]
    },
    "core:name": {
      "text": "iron helmet"
    },
    "core:description": {
      "text": "A simple but effective iron helmet that protects the head. The metal is thick enough to deflect most blows while maintaining a reasonable weight. A padded interior provides comfort during extended wear."
    },
    "descriptors:color_basic": {
      "color": "gray"
    },
    "descriptors:texture": {
      "texture": "metallic"
    },
    "clothing:coverage_mapping": {
      "covers": ["head_gear"],
      "coveragePriority": "armor"
    },
    "items:item": {},
    "items:portable": {},
    "items:weight": {
      "weight": 2.5
    }
  }
}
```

### 5. Leather Boots (Light Foot Armor)

**File**: `data/mods/armor/entities/definitions/leather_boots.json`

**Description**: Reinforced leather boots - light foot protection

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "armor:leather_boots",
  "description": "Reinforced leather boots",
  "components": {
    "clothing:wearable": {
      "layer": "armor",
      "equipmentSlots": {
        "primary": "feet"
      },
      "allowedLayers": ["base", "armor"]
    },
    "core:material": {
      "material": "leather",
      "durability": 65,
      "properties": ["flexible"],
      "careInstructions": ["requires_oiling"]
    },
    "core:name": {
      "text": "leather boots"
    },
    "core:description": {
      "text": "Well-crafted leather boots with reinforced soles and metal toe caps. The high tops protect the ankles and lower legs while maintaining flexibility for movement. Sturdy laces ensure a secure fit."
    },
    "descriptors:color_basic": {
      "color": "brown"
    },
    "descriptors:texture": {
      "texture": "rugged"
    },
    "clothing:coverage_mapping": {
      "covers": ["feet"],
      "coveragePriority": "armor"
    },
    "items:item": {},
    "items:portable": {},
    "items:weight": {
      "weight": 1.8
    }
  }
}
```

### 6. Steel Gauntlets (Hand Armor)

**File**: `data/mods/armor/entities/definitions/steel_gauntlets.json`

**Description**: Articulated steel hand protection

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "armor:steel_gauntlets",
  "description": "Articulated steel hand protection",
  "components": {
    "clothing:wearable": {
      "layer": "armor",
      "equipmentSlots": {
        "primary": "hands"
      },
      "allowedLayers": ["base", "armor"]
    },
    "core:material": {
      "material": "steel",
      "durability": 80,
      "properties": ["rigid"]
    },
    "core:name": {
      "text": "steel gauntlets"
    },
    "core:description": {
      "text": "Finely crafted steel gauntlets with articulated fingers. The metal plates are joined with leather straps and rivets, allowing for surprisingly good dexterity while providing excellent protection for the hands and wrists."
    },
    "descriptors:texture": {
      "texture": "smooth"
    },
    "clothing:coverage_mapping": {
      "covers": ["hands"],
      "coveragePriority": "armor"
    },
    "items:item": {},
    "items:portable": {},
    "items:weight": {
      "weight": 1.5
    }
  }
}
```

## Mod Structure Decision

Choose one of these approaches:

### Option A: Create New Armor Mod

Create a dedicated armor mod at `data/mods/armor/`:

```
data/mods/armor/
├── mod-manifest.json
├── entities/
│   └── definitions/
│       ├── steel_cuirass.json
│       ├── leather_bracers.json
│       ├── chainmail_hauberk.json
│       ├── iron_helmet.json
│       ├── leather_boots.json
│       └── steel_gauntlets.json
└── README.md
```

**Manifest** (`mod-manifest.json`):
```json
{
  "id": "armor",
  "version": "1.0.0",
  "name": "Armor Entities",
  "description": "Collection of armor entities for sword & sorcery games",
  "dependencies": ["core", "clothing", "anatomy"]
}
```

### Option B: Add to Existing Clothing Mod

Add armor entities to `data/mods/clothing/entities/definitions/armor/`:

```
data/mods/clothing/
├── entities/
│   └── definitions/
│       ├── armor/              (NEW)
│       │   ├── steel_cuirass.json
│       │   ├── leather_bracers.json
│       │   └── ...
│       └── (existing clothing entities)
```

**Recommendation**: Use **Option A** (new armor mod) because:
- Clear separation of concerns
- Easier to disable/enable armor separately
- Better organization for large armor collections
- Follows modding-first philosophy

## Implementation Steps

### 1. Decide on Mod Structure

Choose Option A or Option B based on project needs.

### 2. Create Directory Structure

For Option A:
```bash
mkdir -p data/mods/armor/entities/definitions
```

For Option B:
```bash
mkdir -p data/mods/clothing/entities/definitions/armor
```

### 3. Create Mod Manifest (if Option A)

```bash
# Create manifest file
touch data/mods/armor/mod-manifest.json

# Add manifest content (see above)
```

### 4. Create Armor Entity Files

Create each armor entity file with the JSON content provided above.

### 5. Add README (Optional but Recommended)

Create `data/mods/armor/README.md` OR `data/mods/clothing/entities/definitions/armor/README.md`:

```markdown
# Armor Entities

Collection of example armor entities demonstrating the armor layer system.

## Armor Types

- **Steel Cuirass**: Heavy chest armor
- **Leather Bracers**: Light arm protection
- **Chainmail Hauberk**: Medium full-body armor
- **Iron Helmet**: Basic head protection
- **Leather Boots**: Light foot armor
- **Steel Gauntlets**: Hand protection

## Usage

These armor entities use the `armor` layer and demonstrate proper coverage mapping, material properties, and equipment slot usage.

## Customization

Feel free to modify these entities for your specific game needs. Common modifications:
- Change materials (steel → iron, leather → canvas)
- Adjust durability values
- Modify coverage areas
- Add custom properties
- Update descriptions
```

### 6. Add to Game Configuration (if Option A)

Update `game.json` to include the armor mod:

```json
{
  "mods": ["core", "clothing", "anatomy", "armor"]
}
```

## Validation Steps

### 1. Validate JSON Syntax

```bash
# Validate each armor entity
for file in data/mods/armor/entities/definitions/*.json; do
  node -e "JSON.parse(require('fs').readFileSync('$file'))"
done
```

### 2. Run Schema Validation

```bash
npm run validate
```

Expected: No validation errors for armor entities

### 3. Test Entity Loading

```bash
# Start the application and verify armor entities load
npm run start

# Check console for entity loading messages
# Should see: "Loaded entity: armor:steel_cuirass" etc.
```

### 4. Test Equipment in Game

1. Start a game session
2. Create a character
3. Use console commands to equip armor:
   ```javascript
   // Add armor to inventory
   giveItem('player', 'armor:steel_cuirass');

   // Equip armor
   equipItem('player', 'armor:steel_cuirass');
   ```
4. Verify armor appears in character description
5. Test layering with other clothing

## Success Criteria

- [ ] All 6 armor entity files created
- [ ] All JSON files are syntactically valid
- [ ] `npm run validate` passes without errors
- [ ] Armor entities load successfully in the application
- [ ] Each armor entity has:
  - [ ] Proper `clothing:wearable` with `layer: "armor"`
  - [ ] Appropriate `core:material` component
  - [ ] Descriptive `core:name` and `core:description`
  - [ ] Correct `clothing:coverage_mapping` with `coveragePriority: "armor"`
  - [ ] Proper `items:item`, `items:portable`, `items:weight` components
  - [ ] Appropriate equipment slots
- [ ] README.md created (if applicable)
- [ ] Mod manifest created (if Option A)
- [ ] Examples cover various armor types (light, medium, heavy)
- [ ] Examples cover various body slots (head, torso, arms, hands, legs, feet)

## Additional Example Ideas

Consider adding these additional examples:

### 7. Padded Gambeson (Very Light Armor)

```json
{
  "layer": "armor",
  "material": "canvas",
  "description": "Quilted cloth armor worn under heavier armor or alone"
}
```

### 8. Plate Leggings (Heavy Leg Armor)

```json
{
  "layer": "armor",
  "material": "steel",
  "equipmentSlots": {"primary": "legs"},
  "description": "Steel plate leg protection"
}
```

### 9. Buckler Shield (Wearable Armor)

```json
{
  "layer": "armor",
  "equipmentSlots": {"primary": "left_arm_clothing"},
  "description": "Small round shield strapped to forearm"
}
```

## Related Tickets

- **Previous**: ARMSYSANA-007 (Update Documentation)
- **Next**: ARMSYSANA-009 (Test Armor Scenarios)
- **Depends On**: ARMSYSANA-001 through ARMSYSANA-006

## Notes

These example armor entities serve multiple purposes:
1. **Documentation**: Living examples of how to create armor
2. **Testing**: Validation that armor system works correctly
3. **Reference**: Starting point for mod developers
4. **Content**: Ready-to-use armor for games

The examples are intentionally diverse, covering:
- **Materials**: Steel, iron, leather, canvas
- **Weights**: Light (1.2 kg) to heavy (12.0 kg)
- **Slots**: All major body slots
- **Durability**: Range from 60 to 85
- **Properties**: Rigid, flexible, reflective

Mod developers can copy and modify these examples for their specific needs.

## Reference

Example entities are based on the original report's examples (lines 381-516), with adjustments for completeness and consistency.
