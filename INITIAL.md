## FEATURE:

We have recently implemented an anatomy system that generated body graphs out of recipes and blueprints. The system works for the most part, but there are two issues I want you to fix.

1) Currently we have two single blueprints: data/mods/anatomy/blueprints/human_female.blueprint.json and data/mods/anatomy/blueprints/human_male.blueprint.json. Both have a socket named "public_hair". However, the part type is "hair". That causes problems, like random hair parts clearly meant for the head (like long, wavy) showing up for the public_hair socket, which is ridiculous. Therefore, the "public_hair" socket should use instead of "hair" a new partType "public_hair", and an entity definition should be created in data/mods/anatomy/entities/definitions/ : human_public_hair.entity.json, that only has one descriptor component (whichever is fitting) that has the "curly" text. If no fitting descriptor component exists (the descriptor components being in data/mods/descriptors/components/ ), then either add that "curly" text to a fitting descriptor component, or create a new one.

2) Regarding recipes, I suspect that the slot overriding isn't working entirely as intended. For example: .private/data/mods/p_erotica/recipes/amaia_castillo.recipe.json declares an override for the "scalp" socket, with three descriptor components. However, I've found that sometimes, the entity that gets picked only has one of those descriptor components (for example, the one that says "long"), while the intention was that if a recipe overrides any socket properties, then *all* defined properties must apply when finding a fitting entity definition to slot into that socket. For example, in the case of amaia_castillo.recipe.json, a fitting entity definition for the "scalp" socket should be "blonde", "long", and "wavy", not just one of those.

Your goal is to create a comprehensive PRP that will implement this change. Do not modify any code yet; we will implement the PRP at a later date.

## EXAMPLES:

You have plenty of integration suites that prove the behavior of the anatomy system. They're in tests/integration/anatomy/ . 


## DOCUMENTATION:

Analyze the schemas for blueprints, recipes, and entity definitions. data/schemas/anatomy.blueprint.schema.json . data/schemas/anatomy.recipe.schema.json . data/schemas/entity-definition.schema.json

## OTHER CONSIDERATIONS:

Once you've performed your changes, run 'npm run test' and ensure all tests pass.
