# Non-Human Creature Quick Start Guide

## Overview

This quick start shows how to author a Blueprint V2 creature by mirroring the shipped giant spider assets. You will:

1. Author a structure template that describes the creature's topology.
2. Define entity parts for the root body and its attachments.
3. Reference the template from a Blueprint V2 file (plus any extra sockets the template cannot create).
4. Create a recipe that fills every generated slot through pattern matching.
5. Register the files in your mod manifest and spin up a test entity instance.

The runtime merges template-generated sockets into the root entity before attaching parts, so V2 blueprints stay concise while still honouring your existing entity definitions.【F:src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js†L200-L235】

### Prerequisites

- Comfort editing JSON.
- Familiarity with the mod folder layout (see [../mods/](../mods/)).
- A text editor that validates JSON against schemas.

### Files You'll Create

```
data/mods/your_mod/
├── structure-templates/spider.structure-template.json
├── entities/definitions/spider_cephalothorax.entity.json
├── entities/definitions/spider_leg.entity.json
├── entities/definitions/spider_pedipalp.entity.json
├── entities/definitions/spider_abdomen.entity.json
├── entities/definitions/spider_spinneret.entity.json
├── blueprints/spider.blueprint.json
├── recipes/spider.recipe.json
└── entities/test_spider.instance.json
```

The paths mirror those used by the core anatomy mod so that your content slots directly into the loader's expectations.【F:data/mods/anatomy/mod-manifest.json†L158-L205】

## Step 1: Create the Structure Template

Structure templates describe the procedural socket layout for Blueprint V2. Create `data/mods/your_mod/structure-templates/spider.structure-template.json`:

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.structure-template.schema.json",
  "id": "your_mod:structure_spider",
  "description": "Eight-legged arachnid body plan with pedipalps and posterior abdomen",
  "topology": {
    "rootType": "cephalothorax",
    "limbSets": [
      {
        "type": "leg",
        "count": 8,
        "arrangement": "radial",
        "arrangementHint": "four_pairs_bilateral",
        "socketPattern": {
          "idTemplate": "leg_{{index}}",
          "orientationScheme": "indexed",
          "allowedTypes": ["spider_leg"],
          "nameTpl": "leg {{index}}"
        }
      }
    ],
    "appendages": [
      {
        "type": "pedipalp",
        "count": 2,
        "attachment": "anterior",
        "socketPattern": {
          "idTemplate": "pedipalp_{{orientation}}",
          "orientationScheme": "bilateral",
          "allowedTypes": ["spider_pedipalp"],
          "nameTpl": "pedipalp ({{orientation}})"
        }
      },
      {
        "type": "torso",
        "count": 1,
        "attachment": "posterior",
        "socketPattern": {
          "idTemplate": "posterior_torso",
          "allowedTypes": ["spider_abdomen"],
          "nameTpl": "abdomen"
        }
      }
    ]
  }
}
```

This configuration matches the production arachnid template, except that the pedipalp pattern now relies on the bilateral orientation scheme and an orientation-based ID template so the generated sockets (`pedipalp_left`, `pedipalp_right`) align with current entity data.【F:data/mods/anatomy/structure-templates/structure_arachnid_8leg.structure-template.json†L1-L42】【F:data/mods/anatomy/entities/definitions/spider_cephalothorax.entity.json†L29-L64】

## Step 2: Define the Parts

Create entity definitions for the root body and each attachment.

### Cephalothorax (root)

`data/mods/your_mod/entities/definitions/spider_cephalothorax.entity.json`:

```json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "your_mod:spider_cephalothorax",
  "description": "Root cephalothorax for an eight-legged spider",
  "components": {
    "anatomy:part": {
      "subType": "spider_cephalothorax"
    },
    "anatomy:sockets": {
      "sockets": [
        {
          "id": "pedipalp_left",
          "allowedTypes": ["spider_pedipalp"],
          "nameTpl": "left pedipalp"
        },
        {
          "id": "pedipalp_right",
          "allowedTypes": ["spider_pedipalp"],
          "nameTpl": "right pedipalp"
        },
        {
          "id": "spinnerets",
          "allowedTypes": ["spinneret"],
          "nameTpl": "spinnerets"
        }
      ]
    },
    "core:name": {
      "text": "spider cephalothorax"
    }
  }
}
```

Only the sockets that the template cannot create (spinnerets) are required. The bilateral pedipalp sockets above reflect the shipped anatomy data; the Blueprint V2 loader replaces them with the template-generated `pedipalp_left` and `pedipalp_right` definitions at runtime to keep everything in sync.【F:data/mods/anatomy/entities/definitions/spider_cephalothorax.entity.json†L29-L70】【F:src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js†L200-L235】

### Legs, Pedipalps, Abdomen, Spinnerets

```
data/mods/your_mod/entities/definitions/spider_leg.entity.json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "your_mod:spider_leg",
  "description": "A segmented spider leg",
  "components": {
    "anatomy:part": { "subType": "spider_leg" },
    "core:name": { "text": "spider leg" }
  }
}

data/mods/your_mod/entities/definitions/spider_pedipalp.entity.json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "your_mod:spider_pedipalp",
  "description": "A spider pedipalp for sensory input",
  "components": {
    "anatomy:part": { "subType": "spider_pedipalp" },
    "core:name": { "text": "spider pedipalp" }
  }
}

data/mods/your_mod/entities/definitions/spider_abdomen.entity.json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "your_mod:spider_abdomen",
  "description": "The bulbous abdomen of a spider",
  "components": {
    "anatomy:part": { "subType": "spider_abdomen" },
    "core:name": { "text": "spider abdomen" }
  }
}

data/mods/your_mod/entities/definitions/spider_spinneret.entity.json
{
  "$schema": "schema://living-narrative-engine/entity-definition.schema.json",
  "id": "your_mod:spider_spinneret",
  "description": "Silk-producing spinnerets",
  "components": {
    "anatomy:part": { "subType": "spinneret" },
    "core:name": { "text": "spinnerets" }
  }
}
```

These definitions mirror the production anatomy entities so that the recipe can reuse their `subType` values directly.【F:data/mods/anatomy/entities/definitions/spider_leg.entity.json†L1-L12】【F:data/mods/anatomy/entities/definitions/spider_pedipalp.entity.json†L1-L12】【F:data/mods/anatomy/entities/definitions/spider_abdomen.entity.json†L1-L12】【F:data/mods/anatomy/entities/definitions/spider_spinneret.entity.json†L1-L12】

## Step 3: Create the Blueprint V2

`data/mods/your_mod/blueprints/spider.blueprint.json`:

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.blueprint.schema.json",
  "id": "your_mod:spider_garden",
  "schemaVersion": "2.0",
  "root": "your_mod:spider_cephalothorax",
  "structureTemplate": "your_mod:structure_spider",
  "additionalSlots": {
    "spinnerets": {
      "socket": "spinnerets",
      "requirements": {
        "partType": "spinneret",
        "components": ["anatomy:part"]
      }
    }
  }
}
```

The template generates sockets and slot definitions for the legs, pedipalps, and abdomen. The explicit `spinnerets` slot demonstrates how to wire in sockets that live only on the entity definition (the shipped blueprint does the same).【F:data/mods/anatomy/blueprints/giant_spider.blueprint.json†L1-L20】

## Step 4: Author the Recipe

`data/mods/your_mod/recipes/spider.recipe.json`:

```json
{
  "$schema": "schema://living-narrative-engine/anatomy.recipe.schema.json",
  "recipeId": "your_mod:spider_garden_recipe",
  "blueprintId": "your_mod:spider_garden",
  "slots": {
    "spinnerets": {
      "partType": "spinneret",
      "tags": ["anatomy:part"]
    }
  },
  "patterns": [
    {
      "matchesGroup": "limbSet:leg",
      "partType": "spider_leg",
      "tags": ["anatomy:part"]
    },
    {
      "matchesGroup": "appendage:pedipalp",
      "partType": "spider_pedipalp",
      "tags": ["anatomy:part"]
    },
    {
      "matchesGroup": "appendage:torso",
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

`matchesGroup` uses the limb-set metadata generated from the structure template, so one pattern can fill every related slot. This is the same mechanism used by the shipped spider recipe (which additionally sets cosmetic properties per part).【F:data/mods/anatomy/recipes/giant_forest_spider.recipe.json†L1-L67】

## Step 5: Update the Mod Manifest

Add the new files under the manifest's `content` object in `data/mods/your_mod/mod-manifest.json`:

```json
{
  "$schema": "schema://living-narrative-engine/mod-manifest.schema.json",
  "id": "your_mod",
  "version": "1.0.0",
  "name": "Your Mod Name",
  "content": {
    "entities": {
      "definitions": [
        "entities/definitions/spider_cephalothorax.entity.json",
        "entities/definitions/spider_leg.entity.json",
        "entities/definitions/spider_pedipalp.entity.json",
        "entities/definitions/spider_abdomen.entity.json",
        "entities/definitions/spider_spinneret.entity.json"
      ],
      "instances": [
        "entities/test_spider.instance.json"
      ]
    },
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

The loader reads the dashed `structure-templates` key under `content`, matching both the schema and the shipping anatomy mod.【F:data/schemas/mod-manifest.schema.json†L130-L177】【F:data/mods/anatomy/mod-manifest.json†L158-L205】

## Step 6: Create a Test Instance

`data/mods/your_mod/entities/test_spider.instance.json`:

```json
{
  "$schema": "schema://living-narrative-engine/entity-instance.schema.json",
  "instanceId": "test_spider_1",
  "definitionId": "your_mod:spider_cephalothorax",
  "componentOverrides": {
    "core:actor": {
      "name": "Test Spider"
    },
    "anatomy:body": {
      "blueprintId": "your_mod:spider_garden",
      "recipeId": "your_mod:spider_garden_recipe"
    }
  }
}
```

Load the mod and instantiate this entity (or run the anatomy integration tests) to confirm that the generated body graph contains eight legs, two pedipalps, a spinneret assembly, and the abdomen.【F:tests/integration/anatomy/validation/socketSlotCompatibility.integration.test.js†L135-L156】

## Common Pitfalls

- **Manifest key mismatch** – Ensure the manifest uses `"structure-templates"` inside `content`; the loader ignores the camelCase variant.【F:src/loaders/loaderMeta.js†L112-L115】
- **Socket ID drift** – Keep entity-defined socket IDs aligned with the template output so the runtime merge replaces older data instead of duplicating sockets.【F:src/anatomy/bodyBlueprintFactory/bodyBlueprintFactory.js†L200-L235】
- **Recipe type typos** – `partType` values in patterns must match the `anatomy:part.subType` of your entities. The shipped spider recipe is a reliable reference point.【F:data/mods/anatomy/recipes/giant_forest_spider.recipe.json†L24-L67】

## Further Reading

- [Blueprints and Recipes Guide](./blueprints-and-recipes.md) – Complete guide to blueprints, structure templates, and recipe patterns.
- [Anatomy Development Guide](../development/anatomy-development-guide.md) – Broader workflow coverage for anatomy authoring.
