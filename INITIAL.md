## FEATURE:

I think there is a nasty bug in the anatomy system that makes recipe options fail silently. For example, look at .private/data/mods/p_erotica/recipes/amaia_castillo.recipe.json . In the "slots" parameter, it declares an override for "scalps", to specify one very specific hair entity: one that has "blonde", "long" and "wavy" descriptors. However, in the anatomy visualizer we're seeing regularly that for the "hair" part type we're getting random hair entities during creation. I suspect that the recipe matching code that uses the entries in the "slots" actually overrides keys in the "slots" parameter in the corresponding blueprints, while the amaia_castillo.recipe.json assumes that the recipe-processing code will override the "scalp" socket in the blueprint. Likely this is an error on the part of the designer of amaia_castillo.recipe.json, but the problem is that the incorrectly-set, non-operative override in amaia_castillo.recipe.json is *failing silently*. The code that processes recipes should likely be modified so that it tracks if an override defined in the "slots" property of a recipe will override anything in the corresponding blueprint, and if not, an error must be thrown, along with a dispatch of the event SYSTEM_ERROR_OCCURRED_ID. An integration suite must be created to prove this new behavior.

Note: you shouldn't make any code modifications at this point. The goal is to create the PRP that we will execute at a later moment.

## EXAMPLES:

You have lots of integration suits for the anatomy system in tests/integration/anatomy/

## DOCUMENTATION:

Analyze the schemas for blueprints and recipes. They're data/schemas/anatomy.blueprint.schema.json and data/schemas/anatomy.recipe.schema.json . The code for the anatomy system is mainly in src/anatomy/ and subdirectories.

## OTHER CONSIDERATIONS:

Once you've performed your changes, run 'npm run test' and ensure all tests pass.
