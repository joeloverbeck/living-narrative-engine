# Clothing Coverage Mapping Component

## Overview

The `clothing:coverage_mapping` component defines which body regions clothing items cover when equipped, enabling intelligent clothing resolution for action text generation.

## Component Schema

```json
{
  "clothing:coverage_mapping": {
    "covers": ["torso_lower"],
    "coveragePriority": "base"
  }
}
```

## Properties

### covers

- **Type**: Array of strings
- **Required**: Yes
- **Description**: Body regions this item covers when worn
- **Valid Values**: `torso_upper`, `torso_lower`, `legs`, `feet`, `head_gear`, `hands`, `left_arm_clothing`, `right_arm_clothing`

### coveragePriority

- **Type**: String
- **Required**: Yes
- **Description**: Priority level for coverage resolution
- **Valid Values**:
  - `outer`: Outer layer coverage (coats, jackets)
  - `base`: Base layer coverage (pants, shirts)
  - `underwear`: Underwear layer coverage (bras, panties)
  - `accessories`: Accessory items (belts, gloves, etc.)

## Usage Examples

### Basic Pants Coverage

```json
{
  "id": "clothing:denim_jeans",
  "components": {
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

### Multi-Region Coverage (Winter Coat)

```json
{
  "clothing:coverage_mapping": {
    "covers": ["torso_upper", "torso_lower", "legs"],
    "coveragePriority": "outer"
  }
}
```

### Underwear Coverage (Thigh-High Socks)

```json
{
  "clothing:coverage_mapping": {
    "covers": ["torso_lower"],
    "coveragePriority": "underwear"
  }
}
```

## Priority System

Coverage resolution uses a two-tier priority system:

1. **Coverage Priority** (Primary): `outer` < `base` < `underwear` < `accessories` < `direct`
2. **Layer Priority** (Secondary): `outer` < `base` < `underwear` < `accessories`

### Resolution Examples

| Scenario        | Items                                         | Result  | Reasoning              |
| --------------- | --------------------------------------------- | ------- | ---------------------- |
| Jeans + Panties | Jeans (base coverage) + Panties (direct)      | Jeans   | Base coverage > Direct |
| Coat + Jeans    | Coat (outer coverage) + Jeans (base coverage) | Coat    | Outer > Base           |
| Only Panties    | Panties (direct)                              | Panties | Direct fallback        |

## Best Practices

1. **Logical Coverage**: Only cover regions that make real-world sense
2. **Appropriate Priority**: Match priority to item's typical usage layer
3. **Consistent Patterns**: Follow established patterns for similar items
4. **Performance**: Avoid unnecessary coverage mappings for items that don't need them

## Troubleshooting

### Common Issues

**Coverage Not Working**:

- Verify component schema is correct
- Check that `covers` array includes target slot
- Ensure `coveragePriority` is valid

**Wrong Item Selected**:

- Review priority system rules
- Check for conflicting coverage mappings
- Verify layer assignments match expectations

**Performance Issues**:

- Limit coverage mappings to items that need them
- Use appropriate priority levels
- Consider caching implications for frequently accessed items
