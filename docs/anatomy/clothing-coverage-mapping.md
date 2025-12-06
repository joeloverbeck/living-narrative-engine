# Clothing Coverage Mapping Component

## Purpose

`clothing:coverage_mapping` extends a clothing entity with the extra body regions it covers when equipped. The component is defined in [`data/mods/clothing/components/coverage_mapping.component.json`](../../data/mods/clothing/components/coverage_mapping.component.json) and is consumed by coverage-aware systems such as the slot access resolver and coverage analyzer.

## Data shape

```json
{
  "clothing:coverage_mapping": {
    "covers": ["torso_lower"],
    "coveragePriority": "base"
  }
}
```

### covers

- Required array of unique strings.
- Values must be chosen from `torso_upper`, `torso_lower`, `legs`, `feet`, `head_gear`, `hands`, `left_arm_clothing`, or `right_arm_clothing`. The schema enforces at least one region.

### coveragePriority

- Required string describing the intended coverage tier.
- The schema accepts `outer`, `armor`, `base`, `underwear`, and `accessories`.
- Runtime priority logic recognises `outer`, `armor`, `base`, `underwear`, and `direct`. Any other value—including `accessories`—is treated as `direct`, the lowest priority tier, before sorting coverage candidates.

**Coverage Priority Values** (lower = higher visibility):

- `outer`: 100 (highest visibility)
- `armor`: 150 (protective equipment)
- `base`: 200 (regular clothing)
- `underwear`: 300 (undergarments)
- `direct`: 400 (fallback, including accessories)

## Runtime behaviour

- `slotAccessResolver` pulls every equipped item's `coverage_mapping`, tags each candidate with its layer, and scores it via the priority calculator, which orders coverage priority as `outer` → `armor` → `base` → `underwear` → fallback `direct` and resolves ties with the layer order `outer` → `armor` → `base` → `underwear` → `accessories`.
- `coverageAnalyzer` uses the same priority constants; if a value is missing it falls back to the item's layer, and if the value is unrecognised the item neither blocks nor is blocked because no priority score is assigned.
- Because of the mismatch between the schema and runtime constants, items authored with `coveragePriority: "accessories"` (for example, the layered pearl choker) are effectively evaluated as `direct` during resolution.

## Example

Dark indigo denim jeans cover the wearer's lower torso and are treated as base-layer coverage:

```jsonc
{
  "id": "clothing:dark_indigo_denim_jeans",
  "components": {
    "clothing:coverage_mapping": {
      "covers": ["torso_lower"],
      "coveragePriority": "base",
    },
  },
}
```

## Armor Coverage Examples

**Example 1: Steel Cuirass**

```json
{
  "clothing:wearable": {
    "layer": "armor",
    "equipmentSlots": {
      "primary": "torso_upper"
    }
  },
  "clothing:coverage_mapping": {
    "covers": ["torso_upper"],
    "coveragePriority": "armor"
  }
}
```

**Example 2: Chainmail Hauberk (Multi-slot)**

```json
{
  "clothing:wearable": {
    "layer": "armor",
    "equipmentSlots": {
      "primary": "torso_upper",
      "secondary": ["left_arm_clothing", "right_arm_clothing"]
    }
  },
  "clothing:coverage_mapping": {
    "covers": [
      "torso_upper",
      "torso_lower",
      "left_arm_clothing",
      "right_arm_clothing"
    ],
    "coveragePriority": "armor"
  }
}
```

**Example 3: Leather Leg Armor**

```json
{
  "clothing:wearable": {
    "layer": "armor",
    "equipmentSlots": {
      "primary": "legs"
    }
  },
  "clothing:coverage_mapping": {
    "covers": ["legs"],
    "coveragePriority": "armor"
  }
}
```

## Authoring tips

- Match `coveragePriority` to `outer`, `armor`, `base`, or `underwear` whenever possible to avoid the automatic downgrade to `direct`.
- Only include regions in `covers` that the item truly obscures; redundant mappings slow the priority calculation without changing outcomes.
- When debugging unexpected access, confirm both the coverage priority and the item's equip layer, since the analyzer falls back to the layer when coverage data is missing.
