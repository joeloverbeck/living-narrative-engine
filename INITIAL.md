## FEATURE:

Important: your current goal is to create a PRP document. No code modifications should be made at this stage.

We currently have two unused conditions:

- data/mods/core/conditions/actor-has-muscular-legs.condition.json
- data/mods/core/conditions/actor-has-shapely-legs.condition.json

However, we can see in the code of the module jsonLogicCustomOperators.js that the conditions above would just check if any body part entity would have the "muscular" or the "shapely" parameter values. It doesn't check that the part type where these component values need to be are in body parts that are legs.

Please analyze the code of the anatomy system in src/anatomy/ and subdirectories, as well as the specific BodyGraphService, which is directly involved in these custom JsonLogic operators. Perhaps we need a new custom operator.

## EXAMPLES:

We have lots of integration tests that use the current condition code in tests/integration/rules/ . We have tests for the anatomy system in tests/integration/anatomy/

## DOCUMENTATION:

We have the documentation for the json-logic in docs/json-logic/json-logic for modders.ms

## OTHER CONSIDERATIONS:

No particular other considerations.
