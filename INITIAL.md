## FEATURE:

We have recently removed "humanoid_leg.entity.json" from the anatomy mod. It defined an invalid socket for a "lower leg". The issue is that now five test suites fail because they imported that leg file. We need to do the following:

1) check out the currently single existing leg entity: "human_leg_shapely.entity.json". We need to add a socket to it for a "foot" partType, and also created a "foot" body part entity at data/mods/anatomy/entities/definitions/ .
2) Given that "human_leg_shapely.entity.json" is too specific (it specifies descriptors for the legs to be "long" and "shapely"), we need to create a generic "human_leg.entity.json". All the failing tests will need to import that leg instead of the previous "humanoid_leg.entity.json", that no longer exists. This new "human_leg.entity.json" also needs to declare the same socket for a "foot" partType as the "human_leg_shapely.entity.json"

Note: you shouldn't make any code modifications at this point. The goal is to create the PRP that we will execute at a later moment.

## EXAMPLES:

You have lots of integration suits for the anatomy system in tests/integration/anatomy/
Many other body parts declare sockets, so you can check out how they do it. For example, data/mods/anatomy/entities/definitions/humanoid_arm.entity.json

## DOCUMENTATION:

Analyze the schemas for blueprints and recipes. They're data/schemas/anatomy.blueprint.schema.json and data/schemas/anatomy.recipe.schema.json . The code for the anatomy system is mainly in src/anatomy/ and subdirectories. Also analyze the sockets component definition at data/mods/anatomy/components/sockets.component.json

## OTHER CONSIDERATIONS:

Once you've performed your changes, run 'npm run test' and ensure all tests pass.
