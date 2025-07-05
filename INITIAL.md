## FEATURE:

Checking out the results of generating the body graph for the recipe .private/data/mods/p_erotica/recipes/amaia_castillo.recipe.json has shown me that there are some improvements to be made. The "pubic_hair" body part has the "curly" descriptor, yet it doesn't appear in the automatic description for the entity, so likely it needs to be set in the configuration file in data/mods/anatomy/anatomy-formatting/default.json . Regarding order, the description for the pubic hair should appear before the vagina, penis and testicles entries, if they exist. Check out also the definition for the pubic hair entity, which is human_pubic_hair.entity.json, and ensure in the anatomy-formatting default.json that the descriptor component that contains "curly" will also be properly processed.
In addition, the humanoid_mouth.entity.json should include a socket for teeth, which means that a teeth entity definition will need to be created in data/mods/anatomy/entities/definitions/ . The new teeth entity definition shouldn't have any descriptor components; we want to make those teeth generic.

## EXAMPLES:

You have lots of integration suits for the anatomy system in tests/integration/anatomy/
Many other body parts declare sockets, so you can check out how they do it. For example, data/mods/anatomy/entities/definitions/humanoid_arm.entity.json

## DOCUMENTATION:

Analyze the schemas for blueprints and recipes. They're data/schemas/anatomy.blueprint.schema.json and data/schemas/anatomy.recipe.schema.json . The code for the anatomy system is mainly in src/anatomy/ and subdirectories. Also analyze the sockets component definition at data/mods/anatomy/components/sockets.component.json

## OTHER CONSIDERATIONS:

Once you've performed your changes, run 'npm run test' and ensure all tests pass.
