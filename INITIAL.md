## FEATURE:

I want to create an anatomy recipe for the character .private/data/mods/p_erotica/iker_aguirre.character.json . The new recipe definition should be stored in .private/data/mods/p_erotica/recipes/ . It should be somewhat similar to the existing recipe for Amaia Castillo: .private/data/mods/p_erotica/recipes/amaia_castillo.recipe.json
The recipe for Iker Aguirre should override the slots for the torso, legs, and arms, to specify that those parts should have a descriptor component that says "muscular". I suspect that no such descriptor component value exists in data/mods/anatomy/components/ , so determine if that "muscular" text fits into any descriptor component, and if not, create a new descriptor component and use it. Given that no human male torso nor arm nor legs entity definitions exist with a corresponding "muscular" descriptor component value exists, then you'll need to create those entity definitions in data/mods/anatomy/entities/definitions/

Note: do not modify any code during this stage. Your goal is to create a comprehensive PRP to implement these changes.

## EXAMPLES:

You have lots of integration suits for the anatomy system in tests/integration/anatomy/

## DOCUMENTATION:

The schemas for the recipes, blueprints, and components are in data/schemas/:
data/schemas/anatomy.blueprint.schema.json
data/schemas/anatomy.recipe.schema.json
data/schemas/component.schema.json
data/schemas/entity-definition.schema.json

## OTHER CONSIDERATIONS:

Once you've performed your changes, run 'npm run test' and ensure all tests pass.
