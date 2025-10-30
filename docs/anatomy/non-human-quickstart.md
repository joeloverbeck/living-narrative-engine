# Non-Human Creature Quick Start Guide

## Overview

This guide walks you through creating your first non-human creature using the Blueprint V2 system with Structure Templates. We'll create a complete spider anatomy from scratch.

**What You'll Learn**:
- Creating a structure template
- Creating a Blueprint V2
- Creating a recipe with pattern matching
- Testing your anatomy

**Prerequisites**:
- Basic understanding of JSON
- Familiarity with mod structure (see [mod documentation](../mods/))
- Text editor with JSON support

**Related Documentation**:
- [Recipe Patterns](./recipe-patterns.md) - Complete pattern matching reference
- [Common Non-Human Patterns](./common-non-human-patterns.md) - Tested creature patterns
- [Property-Based Filtering](./property-based-filtering-examples.md) - Advanced filtering techniques

## The Workflow

```

`structure-templates` must be defined inside the manifest's `content` object using the dashed key so that the loader can register your templates.
1. Structure Template → 2. Blueprint V2 → 3. Recipe → 4. Test Entity
```

## Step 1: Create Structure Template

Structure templates define the body topology. For our spider, we need:
- 8 legs arranged radially
- 1 abdomen

**Create**: `data/mods/your_mod/structure-templates/spider.structure-template.json`

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.structure-template.schema.json",
  "id": "your_mod:structure_spider",
  "description": "Spider body structure with 8 radially arranged legs and posterior abdomen",
  "topology": {
    "rootType": "cephalothorax",
    "limbSets": [
      {
        "type": "leg",
        "count": 8,
        "arrangement": "radial",
        "socketPattern": {
          "idTemplate": "leg_{{index}}",
          "orientationScheme": "indexed",
          "allowedTypes": ["spider_leg"],
          "nameTpl": "leg {{index}}"
        },
        "arrangementHint": "octagonal_radial"
      }
    ],
    "appendages": [
      {
        "type": "abdomen",
        "count": 1,
        "attachment": "posterior",
        "socketPattern": {
          "idTemplate": "abdomen",
          "allowedTypes": ["spider_abdomen"],
          "nameTpl": "abdomen"
        }
      }
    ]
  }
}
```

**What This Does**:
- Creates 8 leg sockets: `leg_1`, `leg_2`, ... `leg_8`
- Creates 1 abdomen socket: `abdomen`
- Each socket knows what part types it accepts

## Step 2: Create Entity Definitions

Before creating the blueprint, we need entity definitions for the body parts.

### Root Part: Cephalothorax

**Create**: `data/mods/your_mod/entities/spider_cephalothorax.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "your_mod:spider_cephalothorax",
  "components": [
    {
      "id": "anatomy:part",
      "data": {
        "partType": "cephalothorax",
        "name": "cephalothorax",
        "description": "The fused head and thorax of a spider"
      }
    }
  ],
  "sockets": {
    "leg_1": { "allowedTypes": ["spider_leg"] },
    "leg_2": { "allowedTypes": ["spider_leg"] },
    "leg_3": { "allowedTypes": ["spider_leg"] },
    "leg_4": { "allowedTypes": ["spider_leg"] },
    "leg_5": { "allowedTypes": ["spider_leg"] },
    "leg_6": { "allowedTypes": ["spider_leg"] },
    "leg_7": { "allowedTypes": ["spider_leg"] },
    "leg_8": { "allowedTypes": ["spider_leg"] },
    "abdomen": { "allowedTypes": ["spider_abdomen"] }
  }
}
```

### Leg Part

**Create**: `data/mods/your_mod/entities/spider_leg.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "your_mod:spider_leg",
  "components": [
    {
      "id": "anatomy:part",
      "data": {
        "partType": "spider_leg",
        "name": "leg",
        "description": "A segmented spider leg"
      }
    },
    {
      "id": "anatomy:segmented",
      "data": {
        "segments": 7,
        "hairDensity": "moderate"
      }
    }
  ]
}
```

### Abdomen Part

**Create**: `data/mods/your_mod/entities/spider_abdomen.entity.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "your_mod:spider_abdomen",
  "components": [
    {
      "id": "anatomy:part",
      "data": {
        "partType": "spider_abdomen",
        "name": "abdomen",
        "description": "The bulbous abdomen of a spider"
      }
    }
  ]
}
```

## Step 3: Create Blueprint V2

The blueprint references the structure template and specifies the root part.

**Create**: `data/mods/your_mod/blueprints/spider.blueprint.json`

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json",
  "id": "your_mod:spider_garden",
  "schemaVersion": "2.0",
  "root": "your_mod:spider_cephalothorax",
  "structureTemplate": "your_mod:structure_spider"
}
```

**That's It!** This 6-line blueprint generates all 9 sockets automatically.

## Step 4: Create Recipe

The recipe specifies what body parts to use for each slot.

**Create**: `data/mods/your_mod/recipes/spider.recipe.json`

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.recipe.schema.json",
  "recipeId": "your_mod:spider_garden_recipe",
  "blueprintId": "your_mod:spider_garden",
  "slots": {},
  "patterns": [
    {
      "matchesGroup": "limbSet:leg",
      "partType": "spider_leg",
      "tags": ["anatomy:part", "anatomy:segmented"]
    },
    {
      "matchesGroup": "appendage:abdomen",
      "partType": "spider_abdomen",
      "tags": ["anatomy:part"]
    }
  ],
  "bodyDescriptors": {
    "build": "slim",
    "skinColor": "brown"
  }
}
```

**What This Does**:
- `matchesGroup: "limbSet:leg"` matches all 8 leg slots → uses `spider_leg` entity
- `matchesGroup: "appendage:abdomen"` matches abdomen slot → uses `spider_abdomen` entity

## Step 5: Update Mod Manifest

Add your new files to the mod manifest.

**Edit**: `data/mods/your_mod/mod-manifest.json`

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "your_mod",
  "version": "1.0.0",
  "name": "Your Mod Name",
  "content": {
    "entities": [
      "entities/spider_cephalothorax.entity.json",
      "entities/spider_leg.entity.json",
      "entities/spider_abdomen.entity.json"
    ],
    "blueprints": [
      "blueprints/spider.blueprint.json"
    ],
    "recipes": [
      "recipes/spider.recipe.json"
    ],
    "structure-templates": [
      "structure-templates/spider.structure-template.json"
    ]
  }
}
```

`structure-templates` must stay under the manifest's `content` object with the dashed key so the loader can register your templates.

## Step 6: Test Your Anatomy

### Option A: Create Test Entity Instance

**Create**: `data/mods/your_mod/entities/test_spider.instance.json`

```json
{
  "$schema": "schema://living-narrative-engine/entity-instance.schema.json",
  "id": "test_spider_1",
  "definitionId": "your_mod:spider_cephalothorax",
  "components": [
    {
      "id": "core:actor",
      "data": {
        "name": "Test Spider"
      }
    },
    {
      "id": "anatomy:body",
      "data": {
        "blueprintId": "your_mod:spider_garden",
        "recipeId": "your_mod:spider_garden_recipe"
      }
    }
  ]
}
```

### Option B: Use Character Builder

1. Open Character Builder in the game
2. Select your blueprint: `your_mod:spider_garden`
3. Select your recipe: `your_mod:spider_garden_recipe`
4. Generate and inspect the anatomy

### Verification Checklist

✅ **Blueprint loads** without validation errors
✅ **Recipe loads** without validation errors
✅ **8 leg slots** are populated with `spider_leg` entities
✅ **1 abdomen slot** is populated with `spider_abdomen` entity
✅ **Entity instantiates** successfully
✅ **Anatomy graph** is complete and connected

## Common Pitfalls

### Pitfall 1: Mismatched Socket Names

**Problem**: Sockets in entity definition don't match template-generated sockets.

**Wrong**:
```json
// Template generates: leg_1, leg_2, ...
// But entity has:
"sockets": {
  "left_leg": { /* ... */ },  // ❌ Doesn't match
  "right_leg": { /* ... */ }
}
```

**Fix**: Match socket names exactly to template output:
```json
"sockets": {
  "leg_1": { /* ... */ },  // ✅ Matches template
  "leg_2": { /* ... */ }
}
```

### Pitfall 2: Wrong Part Type

**Problem**: Recipe specifies part type that doesn't exist.

**Wrong**:
```json
"patterns": [
  {
    "matchesGroup": "limbSet:leg",
    "partType": "leg"  // ❌ Entity has partType: "spider_leg"
  }
]
```

**Fix**: Match entity's `partType` exactly:
```json
"patterns": [
  {
    "matchesGroup": "limbSet:leg",
    "partType": "spider_leg"  // ✅ Matches entity
  }
]
```

### Pitfall 3: Missing Schema Version

**Problem**: Using V2 features without declaring `schemaVersion: "2.0"`.

**Wrong**:
```json
{
  "id": "your_mod:spider",
  "root": "your_mod:spider_cephalothorax",
  "structureTemplate": "your_mod:structure_spider"  // ❌ Missing schemaVersion
}
```

**Fix**: Always declare V2:
```json
{
  "id": "your_mod:spider",
  "schemaVersion": "2.0",  // ✅ Required
  "root": "your_mod:spider_cephalothorax",
  "structureTemplate": "your_mod:structure_spider"
}
```

### Pitfall 4: Pattern Doesn't Match

**Problem**: Pattern matcher doesn't align with template output.

**Wrong**:
```json
// Template generates: leg_1, leg_2, ...
"patterns": [
  {
    "matchesPattern": "limb_*",  // ❌ No sockets named "limb_"
    "partType": "spider_leg"
  }
]
```

**Fix**: Use correct pattern or `matchesGroup`:
```json
"patterns": [
  {
    "matchesGroup": "limbSet:leg",  // ✅ Matches all legs from template
    "partType": "spider_leg"
  }
]
```

### Pitfall 5: Forgotten Components

**Problem**: Recipe requires components that entity doesn't have.

**Wrong**:
```json
// Entity doesn't have anatomy:segmented component
"patterns": [
  {
    "matchesGroup": "limbSet:leg",
    "partType": "spider_leg",
    "tags": ["anatomy:part", "anatomy:segmented"]  // ❌ Entity missing this
  }
]
```

**Fix**: Add component to entity or remove from recipe:
```json
// Option 1: Add to entity
{
  "id": "your_mod:spider_leg",
  "components": [
    { "id": "anatomy:part", "data": { /* ... */ } },
    { "id": "anatomy:segmented", "data": { /* ... */ } }  // ✅ Added
  ]
}

// Option 2: Remove from recipe
"patterns": [
  {
    "matchesGroup": "limbSet:leg",
    "partType": "spider_leg",
    "tags": ["anatomy:part"]  // ✅ Only required tags
  }
]
```

## Troubleshooting

### Blueprint Validation Error

**Symptom**: Error loading blueprint file.

**Check**:
1. `schemaVersion: "2.0"` is present
2. `structureTemplate` references existing template ID
3. No forbidden V1 properties (`slots`, `parts`, `compose`)
4. Blueprint has required fields: `id`, `root`, `schemaVersion`, `structureTemplate`

### Recipe Validation Error

**Symptom**: Error loading recipe file.

**Check**:
1. `blueprintId` matches your blueprint's `id`
2. Pattern uses exactly one of `matches`, `matchesGroup`, `matchesPattern`, or `matchesAll`
3. `partType` values match entity `partType` values
4. Required fields present: `recipeId`, `blueprintId`, `slots` (can be empty)

### No Slots Generated

**Symptom**: Blueprint loads but anatomy has no limbs.

**Check**:
1. Structure template is loaded before blueprint
2. Template `id` matches blueprint's `structureTemplate` reference
3. Template has `limbSets` or `appendages` defined
4. Mod manifest includes structure template file

### Pattern Doesn't Match Any Slots

**Symptom**: Recipe loads but some slots remain unfilled.

**Check**:
1. Pattern matcher aligns with template output (use debugging)
2. `partType` in pattern matches entity `partType`
3. Try using explicit `slots` temporarily to verify slot keys
4. Check for typos in pattern syntax

## Next Steps

### Add More Features

1. **Add Eyes**: Create entity, add to cephalothorax sockets, update recipe
2. **Add Venom Glands**: Use `additionalSlots` in blueprint
3. **Variations**: Create multiple recipes for different spider species
4. **Visual Properties**: Add anatomy formatting components

### Explore Advanced Features

- **Pattern Exclusions**: Filter pattern matches
- **Clothing Slot Mappings**: Define where clothing attaches
- **Body Descriptors**: Customize appearance
- **Constraints**: Add co-presence or mutual exclusion rules

### Create More Creatures

Use the same workflow for:
- **Dragons**: Wings, quadrupedal legs, tail
- **Centaurs**: Humanoid upper body, horse lower body
- **Octopi**: Tentacles, mantle, head
- **Insects**: 6 legs, wings, segmented body

## Reference Documentation

- **Structure Templates**: [structure-templates.md](./structure-templates.md) - Detailed template documentation
- **Blueprint V2**: [blueprints-v2.md](./blueprints-v2.md) - Blueprint features and migration
- **Recipe Patterns**: [recipe-patterns.md](./recipe-patterns.md) - Pattern matching guide
- **Anatomy Formatting**: [../mods/anatomy-formatting.md](../mods/anatomy-formatting.md) - Description generation

## Example: Humanoid Reference

For comparison, here's how humanoid anatomy works in V1:

**Humanoid Blueprint V1** (excerpt from `data/mods/anatomy/blueprints/human_male.blueprint.json`):
```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json",
  "id": "anatomy:human_male",
  "root": "anatomy:human_male_torso",
  "compose": [
    {
      "part": "anatomy:humanoid_core",
      "include": ["slots", "clothingSlotMappings"]
    }
  ],
  "slots": {
    "penis": {
      "socket": "penis",
      "requirements": {
        "partType": "penis",
        "components": ["anatomy:part"]
      }
    }
    // ... many more manual slots
  }
}
```

Humanoids use V1 because:
- Asymmetric designs (different hands, unique features)
- Historical compatibility
- No repeating limbs that benefit from templates

## Complete File Structure

Your mod should look like this:

```
data/mods/your_mod/
├── mod-manifest.json
├── structure-templates/
│   └── spider.structure-template.json
├── blueprints/
│   └── spider.blueprint.json
├── recipes/
│   └── spider.recipe.json
└── entities/
    ├── spider_cephalothorax.entity.json
    ├── spider_leg.entity.json
    └── spider_abdomen.entity.json
```

## Tips for Success

1. **Start Simple**: Get basic anatomy working before adding complexity
2. **Test Incrementally**: Test after each step (template → blueprint → recipe)
3. **Use Debugging**: Create test entities to verify slot generation
4. **Follow Naming Conventions**: Use consistent, descriptive names
5. **Read Error Messages**: Validation errors are specific and helpful
6. **Reference Examples**: Study existing humanoid blueprints for patterns
7. **Ask for Help**: Check documentation when stuck

## What You've Learned

✅ Structure templates generate sockets automatically
✅ Blueprint V2 is concise for non-human creatures
✅ Recipes use patterns to populate slots efficiently
✅ Template → Blueprint → Recipe workflow
✅ Common pitfalls and how to avoid them

## Next Tutorial

Ready for more advanced features? Try:
- **Multi-Limb Set Creatures**: Dragons with legs AND wings
- **Hybrid Creatures**: Centaurs with humanoid and quadruped parts
- **Clothing Integration**: Define clothing slot mappings
- **Recipe Variations**: Multiple recipes for one blueprint

Happy creature creation! 🕷️
