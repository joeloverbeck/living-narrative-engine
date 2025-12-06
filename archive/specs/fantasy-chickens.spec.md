# Fantasy Chickens Specification

## Overview

This specification defines five unique chicken characters for a fantasy scenario. Each chicken is based on the existing base recipes (`anatomy:hen` and `anatomy:rooster`) in `data/mods/anatomy/recipes/`. All five chickens share the distinctive smell of "burnt clay."

## Base Recipe Reference

- **Hen base** (`data/mods/anatomy/recipes/hen.recipe.json`): Uses `blueprintId: anatomy:hen`
- **Rooster base** (`data/mods/anatomy/recipes/rooster.recipe.json`): Uses `blueprintId: anatomy:rooster` (includes spurs)

## Descriptor Updates Required

The following descriptor modifications have been made to support these chickens:

### New Component Created

**`data/mods/descriptors/components/plumage_sheen.component.json`**

- ID: `descriptors:plumage_sheen`
- Enum values: `matte`, `glossy`, `iridescent`, `metallic`, `oily-sheen`
- Registered in `data/mods/anatomy/anatomy-formatting/default.json`

### Extended Existing Components

**`pattern.component.json`** - Added:

- `speckled` - Salt-and-pepper or spotted patterns
- `mottled` - Irregular blotchy patterns

**`color_extended.component.json`** - Added:

- `buff` - Warm tan/cream color (like buff Orpington chickens)
- `chalky-white` - Dull, powdery white
- `copper` - Metallic copper coloring
- `glossy-black` - Deep black with shine
- `rust-red` - Oxidized red-brown
- `slate-blue` - Blue-gray slate coloring

**`size_category.component.json`** - Added:

- `bantam` - Miniature chicken size

---

## The Five Chickens

### 1. Large Speckled Hen

**Recipe ID**: `fantasy:large_speckled_hen`

**Physical Description**: A big-bodied hen with salt-and-pepper mottling across the body. Thick comb. Swollen wattles.

**Recipe Path**: `data/mods/fantasy/recipes/large_speckled_hen.recipe.json`

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.recipe.schema.json",
  "recipeId": "fantasy:large_speckled_hen",
  "blueprintId": "anatomy:hen",
  "bodyDescriptors": {
    "build": "stocky",
    "height": "short",
    "hairDensity": "furred",
    "composition": "average",
    "skinColor": "salt-and-pepper mottled",
    "smell": "burnt clay"
  },
  "slots": {
    "head": {
      "partType": "chicken_head",
      "preferId": "anatomy:chicken_head"
    },
    "beak": {
      "partType": "chicken_beak",
      "preferId": "anatomy:chicken_beak"
    },
    "comb": {
      "partType": "chicken_comb",
      "preferId": "anatomy:chicken_comb",
      "properties": {
        "descriptors:size_category": { "size": "large" },
        "descriptors:texture": { "texture": "coarse" }
      }
    },
    "wattle": {
      "partType": "chicken_wattle",
      "preferId": "anatomy:chicken_wattle",
      "properties": {
        "descriptors:size_category": { "size": "large" }
      }
    },
    "tail": {
      "partType": "chicken_tail",
      "preferId": "anatomy:chicken_tail"
    }
  },
  "patterns": [
    {
      "matches": ["left_wing", "right_wing"],
      "partType": "chicken_wing",
      "preferId": "anatomy:chicken_wing",
      "properties": {
        "descriptors:pattern": { "pattern": "speckled" }
      }
    },
    {
      "matches": ["left_leg", "right_leg"],
      "partType": "chicken_leg",
      "preferId": "anatomy:chicken_leg"
    },
    {
      "matches": ["left_foot", "right_foot"],
      "partType": "chicken_foot",
      "preferId": "anatomy:chicken_foot"
    },
    {
      "matches": ["left_eye", "right_eye"],
      "partType": "eye",
      "preferId": "anatomy:feline_eye_amber_slit"
    }
  ]
}
```

---

### 2. Kink-Necked Black Pullet

**Recipe ID**: `fantasy:kink_necked_black_pullet`

**Physical Description**: A young hen with glossy black feathers showing a green sheen. Notable deformity: kinked neck.

**Recipe Path**: `data/mods/fantasy/recipes/kink_necked_black_pullet.recipe.json`

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.recipe.schema.json",
  "recipeId": "fantasy:kink_necked_black_pullet",
  "blueprintId": "anatomy:hen",
  "bodyDescriptors": {
    "build": "slim",
    "height": "petite",
    "hairDensity": "furred",
    "composition": "lean",
    "skinColor": "glossy-black with green sheen",
    "smell": "burnt clay"
  },
  "slots": {
    "head": {
      "partType": "chicken_head",
      "preferId": "anatomy:chicken_head"
    },
    "beak": {
      "partType": "chicken_beak",
      "preferId": "anatomy:chicken_beak"
    },
    "comb": {
      "partType": "chicken_comb",
      "preferId": "anatomy:chicken_comb"
    },
    "wattle": {
      "partType": "chicken_wattle",
      "preferId": "anatomy:chicken_wattle"
    },
    "neck": {
      "partType": "neck",
      "preferId": "anatomy:neck",
      "properties": {
        "descriptors:deformity": { "deformity": "twisted-joints" }
      }
    },
    "tail": {
      "partType": "chicken_tail",
      "preferId": "anatomy:chicken_tail"
    }
  },
  "patterns": [
    {
      "matches": ["left_wing", "right_wing"],
      "partType": "chicken_wing",
      "preferId": "anatomy:chicken_wing",
      "properties": {
        "descriptors:color_extended": { "color": "glossy-black" },
        "descriptors:plumage_sheen": { "sheen": "iridescent" }
      }
    },
    {
      "matches": ["left_leg", "right_leg"],
      "partType": "chicken_leg",
      "preferId": "anatomy:chicken_leg"
    },
    {
      "matches": ["left_foot", "right_foot"],
      "partType": "chicken_foot",
      "preferId": "anatomy:chicken_foot"
    },
    {
      "matches": ["left_eye", "right_eye"],
      "partType": "eye",
      "preferId": "anatomy:feline_eye_amber_slit"
    }
  ]
}
```

---

### 3. Copper-Backed Rooster

**Recipe ID**: `fantasy:copper_backed_rooster`

**Physical Description**: A rooster with rust-red hackles, broad chest, and impressive tail sickle feathers. The copper coloring has an unnatural metallic sheen.

**Recipe Path**: `data/mods/fantasy/recipes/copper_backed_rooster.recipe.json`

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.recipe.schema.json",
  "recipeId": "fantasy:copper_backed_rooster",
  "blueprintId": "anatomy:rooster",
  "bodyDescriptors": {
    "build": "barrel-chested",
    "height": "short",
    "hairDensity": "furred",
    "composition": "lean",
    "skinColor": "copper with rust-red hackles",
    "smell": "burnt clay"
  },
  "slots": {
    "head": {
      "partType": "chicken_head",
      "preferId": "anatomy:chicken_head",
      "properties": {
        "descriptors:color_extended": { "color": "rust-red" }
      }
    },
    "beak": {
      "partType": "chicken_beak",
      "preferId": "anatomy:chicken_beak"
    },
    "comb": {
      "partType": "chicken_comb",
      "preferId": "anatomy:chicken_comb"
    },
    "wattle": {
      "partType": "chicken_wattle",
      "preferId": "anatomy:chicken_wattle"
    },
    "tail": {
      "partType": "chicken_tail",
      "preferId": "anatomy:chicken_tail",
      "properties": {
        "descriptors:size_category": { "size": "large" },
        "descriptors:length_category": { "length": "very-long" }
      }
    },
    "left_spur": {
      "partType": "chicken_spur",
      "preferId": "anatomy:chicken_spur"
    },
    "right_spur": {
      "partType": "chicken_spur",
      "preferId": "anatomy:chicken_spur"
    }
  },
  "patterns": [
    {
      "matches": ["left_wing", "right_wing"],
      "partType": "chicken_wing",
      "preferId": "anatomy:chicken_wing",
      "properties": {
        "descriptors:color_extended": { "color": "copper" },
        "descriptors:plumage_sheen": { "sheen": "metallic" }
      }
    },
    {
      "matches": ["left_leg", "right_leg"],
      "partType": "chicken_leg",
      "preferId": "anatomy:chicken_leg"
    },
    {
      "matches": ["left_foot", "right_foot"],
      "partType": "chicken_foot",
      "preferId": "anatomy:chicken_foot"
    },
    {
      "matches": ["left_eye", "right_eye"],
      "partType": "eye",
      "preferId": "anatomy:feline_eye_amber_slit"
    }
  ]
}
```

---

### 4. White-Faced Buff Hen

**Recipe ID**: `fantasy:white_faced_buff_hen`

**Physical Description**: A hen with a warm buff-colored body and a distinctive chalky white face.

**Recipe Path**: `data/mods/fantasy/recipes/white_faced_buff_hen.recipe.json`

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.recipe.schema.json",
  "recipeId": "fantasy:white_faced_buff_hen",
  "blueprintId": "anatomy:hen",
  "bodyDescriptors": {
    "build": "stocky",
    "height": "petite",
    "hairDensity": "furred",
    "composition": "average",
    "skinColor": "buff",
    "smell": "burnt clay"
  },
  "slots": {
    "head": {
      "partType": "chicken_head",
      "preferId": "anatomy:chicken_head",
      "properties": {
        "descriptors:color_extended": { "color": "chalky-white" }
      }
    },
    "beak": {
      "partType": "chicken_beak",
      "preferId": "anatomy:chicken_beak"
    },
    "comb": {
      "partType": "chicken_comb",
      "preferId": "anatomy:chicken_comb"
    },
    "wattle": {
      "partType": "chicken_wattle",
      "preferId": "anatomy:chicken_wattle"
    },
    "tail": {
      "partType": "chicken_tail",
      "preferId": "anatomy:chicken_tail"
    }
  },
  "patterns": [
    {
      "matches": ["left_wing", "right_wing"],
      "partType": "chicken_wing",
      "preferId": "anatomy:chicken_wing",
      "properties": {
        "descriptors:color_extended": { "color": "buff" }
      }
    },
    {
      "matches": ["left_leg", "right_leg"],
      "partType": "chicken_leg",
      "preferId": "anatomy:chicken_leg"
    },
    {
      "matches": ["left_foot", "right_foot"],
      "partType": "chicken_foot",
      "preferId": "anatomy:chicken_foot"
    },
    {
      "matches": ["left_eye", "right_eye"],
      "partType": "eye",
      "preferId": "anatomy:feline_eye_amber_slit"
    }
  ]
}
```

---

### 5. Slate-Blue Bantam Hen

**Recipe ID**: `fantasy:slate_blue_bantam`

**Physical Description**: A tiny hen with slate-blue feathers and dark, bright eyes.

**Recipe Path**: `data/mods/fantasy/recipes/slate_blue_bantam.recipe.json`

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.recipe.schema.json",
  "recipeId": "fantasy:slate_blue_bantam",
  "blueprintId": "anatomy:hen",
  "bodyDescriptors": {
    "build": "frail",
    "height": "tiny",
    "hairDensity": "furred",
    "composition": "lean",
    "skinColor": "slate-blue",
    "smell": "burnt clay"
  },
  "slots": {
    "head": {
      "partType": "chicken_head",
      "preferId": "anatomy:chicken_head"
    },
    "beak": {
      "partType": "chicken_beak",
      "preferId": "anatomy:chicken_beak"
    },
    "comb": {
      "partType": "chicken_comb",
      "preferId": "anatomy:chicken_comb",
      "properties": {
        "descriptors:size_category": { "size": "bantam" }
      }
    },
    "wattle": {
      "partType": "chicken_wattle",
      "preferId": "anatomy:chicken_wattle",
      "properties": {
        "descriptors:size_category": { "size": "bantam" }
      }
    },
    "tail": {
      "partType": "chicken_tail",
      "preferId": "anatomy:chicken_tail"
    }
  },
  "patterns": [
    {
      "matches": ["left_wing", "right_wing"],
      "partType": "chicken_wing",
      "preferId": "anatomy:chicken_wing",
      "properties": {
        "descriptors:color_extended": { "color": "slate-blue" }
      }
    },
    {
      "matches": ["left_leg", "right_leg"],
      "partType": "chicken_leg",
      "preferId": "anatomy:chicken_leg"
    },
    {
      "matches": ["left_foot", "right_foot"],
      "partType": "chicken_foot",
      "preferId": "anatomy:chicken_foot"
    },
    {
      "matches": ["left_eye", "right_eye"],
      "partType": "eye",
      "preferId": "anatomy:feline_eye_amber_slit",
      "properties": {
        "descriptors:color_extended": { "color": "abyssal-black" },
        "descriptors:luminosity": { "luminosity": "faint-glow" }
      }
    }
  ]
}
```

---

## Validation

After creating the recipe files, run:

```bash
npm run validate:recipe
npm run validate:body-descriptors
```

## Summary Table

| Chicken                  | Recipe ID                          | Blueprint         | Build          | Height | Key Features                                                    |
| ------------------------ | ---------------------------------- | ----------------- | -------------- | ------ | --------------------------------------------------------------- |
| Large Speckled Hen       | `fantasy:large_speckled_hen`       | `anatomy:hen`     | stocky         | short  | Salt-and-pepper speckled, thick comb, swollen wattles           |
| Kink-Necked Black Pullet | `fantasy:kink_necked_black_pullet` | `anatomy:hen`     | slim           | petite | Glossy black with green iridescence, kinked neck                |
| Copper-Backed Rooster    | `fantasy:copper_backed_rooster`    | `anatomy:rooster` | barrel-chested | short  | Metallic copper sheen, rust-red hackles, impressive sickle tail |
| White-Faced Buff Hen     | `fantasy:white_faced_buff_hen`     | `anatomy:hen`     | stocky         | petite | Buff body, chalky white face                                    |
| Slate-Blue Bantam        | `fantasy:slate_blue_bantam`        | `anatomy:hen`     | frail          | tiny   | Slate-blue feathers, dark bright eyes, bantam sized             |

## Common Traits

- **Smell**: All five chickens smell of "burnt clay"
- **Hair Density**: All use `furred` (standard for feathered creatures)
- **Eye Type**: All use `anatomy:feline_eye_amber_slit` as the default eye part

## Notes

- Recipe inheritance is not supported in this system; each recipe is standalone
- The `hairDensity: furred` descriptor is the existing convention for feathered creatures
- Slot properties allow per-part customization without creating new part entities
- The copper-backed rooster's metallic appearance is intentional (fantasy element)
