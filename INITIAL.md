## FEATURE:

Important: your current goal is to create a PRP document. No code modifications should be made at this stage.

We have just created the "sex" mod, in data/mods/sex/ , and we want to create the first action and corresponding rule for an action. In the process, likely a new scope definition file as well as conditions will need to be created.

The new action should be about fondling breasts. The action's template should be like "fondle {target}'s breasts". As required components, the acting actor should have the "intimacy:closeness" component. For the scope definition, the targets should be in the acting actor's "intimacy:closeness" component array, and also have the body part type "breast". You likely need to use one or more custom JsonLogic operators. You can check the implemented ones in jsonLogicCustomOperators.js

You also need to create a corresponding rule that listens to "core:attempt_action", that checks that the specific action is the new you created. It should dispatch perceptible events with appropriate text, as well as an action successful event with appropriate text.

## EXAMPLES:

To create this new action and also the new rules, you can inspire yourself by the actions and rules in data/mods/intimacy/actions/ and the data/mods/intimacy/rules/
We have lots of integration tests that use the current condition code in tests/integration/rules/ .
We have tests for the anatomy system in tests/integration/anatomy/

## DOCUMENTATION:

We have the documentation for the json-logic in docs/json-logic/json-logic for modders.md
The documentation for the scopeDSL is in docs/scope-dsl.md as well as in docs/mods/creating-scopes.md

## OTHER CONSIDERATIONS:

No particular other considerations.
