# Anatomy Formatting System

The anatomy formatting system allows mods to customize how body part descriptions are generated and formatted in the Living Narrative Engine.

## Overview

By default, the anatomy system uses hardcoded rules for formatting body descriptions. The anatomy formatting system makes these rules fully moddable, allowing you to:

- Control the order body parts appear in descriptions
- Define which parts are grouped together
- Specify custom pluralization rules
- Control article usage (a/an/none)
- Define descriptor ordering and formatting
- Add custom descriptor types

## Creating Anatomy Formatting Rules

### 1. File Structure

Anatomy formatting files should be placed in your mod's `anatomy-formatting/` directory:

```
data/mods/your-mod/
├── mod-manifest.json
└── anatomy-formatting/
    └── your-rules.json
```

### 2. Basic Configuration

Create a JSON file following the anatomy-formatting schema:

```json
{
  "$schema": "../../../schemas/anatomy-formatting.schema.json",
  "id": "my_custom_rules",
  "descriptionOrder": ["build", "hair", "eye", "face", ...],
  "groupedParts": ["eye", "ear", "arm", "leg", ...],
  "pairedParts": ["eye", "ear", "arm", "leg", ...],
  "irregularPlurals": {
    "foot": "feet",
    "tooth": "teeth"
  },
  "noArticleParts": ["hair"],
  "descriptorOrder": [
    "descriptors:size_category",
    "descriptors:color_basic",
    ...
  ],
  "commaSeparatedDescriptors": [
    "descriptors:shape_eye",
    "descriptors:size_specific"
  ],
  "descriptorValueKeys": [
    "value", "color", "size", "shape", ...
  ]
}
```

### 3. Register in Mod Manifest

Add your formatting files to your mod's manifest:

```json
{
  "id": "your-mod",
  "content": {
    "anatomyFormatting": ["anatomy-formatting/your-rules.json"]
  }
}
```

## Configuration Options

### descriptionOrder

Array of body part types in the order they should appear in descriptions.

```json
"descriptionOrder": [
  "build",    // Overall build first
  "hair",     // Head features
  "eye",
  "torso",    // Body
  "arm",      // Limbs
  "leg"
]
```

### groupedParts

Body parts that should be described together (e.g., "a pair of blue eyes" instead of listing each eye separately).

```json
"groupedParts": ["eye", "ear", "arm", "leg", "hand", "foot", "breast", "wing"]
```

### pairedParts

Parts that use "a pair of" when there are exactly two matching parts.

```json
"pairedParts": ["eye", "ear", "arm", "leg", "hand", "foot", "breast", "wing"]
```

### irregularPlurals

Custom plural forms for body parts.

```json
"irregularPlurals": {
  "foot": "feet",
  "tooth": "teeth",
  "antenna": "antennae"
}
```

### noArticleParts

Parts that don't use articles (a/an) in descriptions.

```json
"noArticleParts": ["hair", "fur", "skin"]
```

### descriptorOrder

Order in which descriptor components appear in descriptions.

```json
"descriptorOrder": [
  "descriptors:length_category",
  "descriptors:size_category",
  "descriptors:color_basic",
  "descriptors:shape_general"
]
```

### commaSeparatedDescriptors

Descriptor types that use commas for separation instead of hyphens.

```json
"commaSeparatedDescriptors": [
  "descriptors:shape_eye",
  "descriptors:size_specific",
  "descriptors:weight_feel"
]
```

### descriptorValueKeys

Keys to search for when extracting values from descriptor components.

```json
"descriptorValueKeys": [
  "value", "color", "size", "shape", "length",
  "style", "texture", "firmness", "build", "weight"
]
```

## Merge Strategy

When multiple mods define anatomy formatting:

1. Rules are loaded in mod load order (as defined in `game.json`)
2. Later mods can override or extend earlier rules
3. Arrays append unique values by default
4. Objects (like irregularPlurals) merge with later values overriding

### Merge Control

Use the optional `mergeStrategy` to control merging behavior:

```json
{
  "id": "override_all",
  "mergeStrategy": {
    "replaceArrays": true,    // Replace arrays entirely
    "replaceObjects": true    // Replace objects entirely
  },
  "descriptionOrder": [...] // This will replace, not extend
}
```

## Example: Alien Species

Here's a complete example for alien creatures:

```json
{
  "$schema": "../../../schemas/anatomy-formatting.schema.json",
  "id": "alien_species",
  "descriptionOrder": [
    "build",
    "carapace", // Alien-specific parts first
    "tentacle",
    "eyestalk",
    "pseudopod",
    "core",
    "hair", // Then standard parts
    "eye",
    "face"
  ],
  "groupedParts": ["tentacle", "eyestalk", "pseudopod"],
  "pairedParts": ["eyestalk", "pseudopod"],
  "irregularPlurals": {
    "pseudopod": "pseudopodia",
    "nucleus": "nuclei",
    "antenna": "antennae"
  },
  "noArticleParts": ["carapace", "core", "ectoplasm"],
  "descriptorOrder": [
    "descriptors:alien_type", // Custom descriptor first
    "descriptors:bio_luminescence",
    "descriptors:size_category",
    "descriptors:color_basic"
  ],
  "commaSeparatedDescriptors": ["descriptors:bio_luminescence"],
  "descriptorValueKeys": ["value", "luminescence", "alienType"]
}
```

## Default Configuration

The anatomy mod includes a default configuration (`data/mods/anatomy/anatomy-formatting/default.json`) that matches the original hardcoded behavior. You can reference this file to understand the default values.

## Best Practices

1. **Use unique IDs** for your formatting rules
2. **Test descriptions** with various body configurations
3. **Consider pluralization** for all custom body parts
4. **Order descriptors** logically (size before color, etc.)
5. **Document custom descriptors** that your mod adds
