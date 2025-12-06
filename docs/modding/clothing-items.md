# Clothing Items Modding Guide

## Overview

This guide covers creating custom clothing items for the Living Narrative Engine, including basic wearable items and advanced coverage mapping for intelligent clothing resolution.

## Basic Clothing Item Structure

Every clothing item requires these core components:

```json
{
  "id": "my_mod:item_name",
  "components": {
    "core:name": { "text": "Display Name" },
    "core:description": { "text": "Item description" },
    "clothing:wearable": {
      "layer": "base",
      "equipmentSlots": { "primary": "legs" }
    }
  }
}
```

## Required Components

### core:name

- **Purpose**: Display name for the item
- **Required**: Yes
- **Example**: `{ "text": "Blue Jeans" }`

### core:description

- **Purpose**: Detailed description of the item
- **Required**: Yes
- **Example**: `{ "text": "Classic denim jeans with a comfortable fit." }`

### clothing:wearable

- **Purpose**: Defines how and where the item can be worn
- **Required**: Yes
- **Properties**:
  - `layer`: Equipment layer (`outer`, `armor`, `base`, `underwear`, `accessories`)
  - `equipmentSlots`: Slot configuration (`{ "primary": "slot_name" }`)

## Equipment Slots

Available clothing slots:

- `torso_upper`: Upper body clothing (shirts, jackets)
- `torso_lower`: Lower torso clothing (underwear, belts)
- `legs`: Leg clothing (pants, skirts)
- `feet`: Footwear (shoes, boots, socks)
- `head_gear`: Head accessories (hats, helmets)
- `hands`: Hand clothing (gloves)
- `left_arm_clothing`: Left arm specific clothing
- `right_arm_clothing`: Right arm specific clothing

## Armor Layer

The armor layer is a special clothing layer for protective equipment. Armor has priority between outer garments and base clothing.

**Layer Priority Order** (innermost to outermost):

1. `underwear` - Undergarments
2. `base` - Regular clothing (shirts, pants, boots)
3. `armor` - Protective equipment (cuirasses, chainmail, plate armor)
4. `outer` - Outerwear (cloaks, robes, long coats)
5. `accessories` - Accessories (jewelry, belts, gloves)

**Coverage Priority Scoring** (lower = higher visibility):

- `outer`: 100 (highest visibility)
- `armor`: 150
- `base`: 200
- `underwear`: 300
- `direct`: 400 (fallback, including accessories)

**When to Use Armor Layer**:

- Protective equipment (cuirasses, chainmail, plate armor)
- Combat gear (leather armor, bracers, greaves)
- Defensive items worn for protection rather than fashion

**Armor vs. Outer Layer**:

- Use `armor` for protective equipment
- Use `outer` for non-protective outerwear (cloaks, robes)
- Armor can be worn under or over other layers depending on coverage priority

**Example**:

```json
{
  "clothing:wearable": {
    "layer": "armor",
    "equipmentSlots": {
      "primary": "torso_upper"
    }
  }
}
```

## Coverage Mapping (Advanced)

For clothing items that should cover additional body regions beyond their primary equipment slot, add the `clothing:coverage_mapping` component.

### When to Use Coverage Mapping

- **Pants/Jeans**: Cover `torso_lower` in addition to `legs` slot
- **Long Coats**: Cover multiple regions (`torso_upper`, `torso_lower`, `legs`)
- **Thigh-High Socks**: Cover `torso_lower` from `legs` slot
- **Jackets**: May cover `torso_lower` depending on length

### Example: Adding Coverage to Jeans

```json
{
  "id": "my_mod:stylish_jeans",
  "components": {
    "core:name": { "text": "Stylish Jeans" },
    "core:description": { "text": "Premium denim jeans with excellent fit." },
    "clothing:wearable": {
      "layer": "base",
      "equipmentSlots": { "primary": "legs" }
    },
    "clothing:coverage_mapping": {
      "covers": ["torso_lower"],
      "coveragePriority": "base"
    }
  }
}
```

### Coverage Priority Guidelines

- **`outer`**: Coats, jackets, outer garments (100)
- **`armor`**: Protective equipment like cuirasses, chainmail (150)
- **`base`**: Regular clothing like pants, shirts (200)
- **`underwear`**: Undergarments, intimate clothing (300)
- **`accessories`**: Accessory items like belts, gloves (falls back to `direct`: 400)

### Testing Your Coverage

Test coverage resolution with various equipment combinations:

```javascript
// Test character with your item + underwear
const character = createTestCharacter({
  legs: { base: 'my_mod:stylish_jeans' },
  torso_lower: { underwear: 'core:panties' },
});

// Should resolve to your jeans, not panties
const result = resolveScope(
  'clothing:target_topmost_torso_lower_clothing',
  character
);
```

## Optional Components

### Descriptive Components

Add visual and material properties:

```json
{
  "core:material": { "material": "denim" },
  "descriptors:color_extended": { "color": "blue" },
  "descriptors:texture": { "texture": "rough" }
}
```

Available descriptors:

- `descriptors:color_extended`: Color properties
- `descriptors:texture`: Texture properties
- `descriptors:size`: Size information
- `descriptors:condition`: Item condition

## Complete Example

Here's a complete example of a winter coat with multi-region coverage:

```json
{
  "id": "my_mod:winter_parka",
  "components": {
    "core:name": { "text": "Winter Parka" },
    "core:description": {
      "text": "Heavy-duty winter parka with insulated lining and waterproof exterior."
    },
    "clothing:wearable": {
      "layer": "outer",
      "equipmentSlots": { "primary": "torso_upper" }
    },
    "clothing:coverage_mapping": {
      "covers": ["torso_lower", "legs"],
      "coveragePriority": "outer"
    },
    "core:material": { "material": "synthetic" },
    "descriptors:color_extended": { "color": "black" },
    "descriptors:texture": { "texture": "smooth" }
  }
}
```

## Removal Blocking

The clothing system includes a blocking mechanism to enforce realistic removal order. Items can declare which other items or layers they block from removal while equipped.

### Overview

**Purpose**: Prevent unrealistic clothing removal scenarios (e.g., removing pants while belt is fastened).

**How It Works**:

1. Items with `clothing:blocks_removal` component declare blocking rules
2. Scope resolution filters out blocked items from `topmost_clothing`
3. Condition validation prevents blocked removal at action execution

### Component

Add `clothing:blocks_removal` to items that block other items:

```json
{
  "clothing:blocks_removal": {
    "blockedSlots": [
      {
        "slot": "legs",
        "layers": ["base", "outer"],
        "blockType": "must_remove_first",
        "reason": "Belt secures pants at waist"
      }
    ]
  }
}
```

### Examples

**Belt Blocking Pants**:

```json
{
  "id": "clothing:belt",
  "components": {
    "clothing:wearable": {
      "layer": "accessories",
      "equipmentSlots": { "primary": "torso_lower" }
    },
    "clothing:blocks_removal": {
      "blockedSlots": [
        { "slot": "legs", "layers": ["base"], "blockType": "must_remove_first" }
      ]
    }
  }
}
```

For detailed documentation, see [Clothing Blocking System](clothing-blocking-system.md).

## Best Practices

1. **Logical Coverage**: Only add coverage that makes real-world sense
2. **Appropriate Priority**: Match priority to the item's typical usage layer
3. **Consistent Naming**: Use descriptive, consistent naming patterns
4. **Test Thoroughly**: Verify coverage works with various equipment combinations
5. **Performance**: Avoid unnecessary coverage mappings for simple items

## Troubleshooting

### Coverage Not Working

- Check that `covers` array includes the target slot
- Verify `coveragePriority` is spelled correctly
- Ensure the component schema is valid

### Wrong Item Selected in Actions

- Review the priority system rules
- Use tracing to debug resolution logic
- Check for conflicting coverage mappings

### Item Not Appearing

- Verify the mod is loaded in `game.json`
- Check entity ID follows `modId:itemName` format
- Ensure all required components are present
