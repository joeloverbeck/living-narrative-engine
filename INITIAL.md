## FEATURE:

Important: your current goal is to create a PRP document. No code modifications should be made at this stage.

I want you to create a new action, and corresponding rule, conditions, etc., for the "intimacy" mod.

The new action should be about massaging the target's shoulders. The template should be "massage {target}'s shoulders".
The required components for the actor should be having the "intimacy:closeness" component.
A new scopeDSL definition needs to be created, similar to the actors_with_breasts_in_intimacy.scope . This new scope should ensure that the target is in the acting actor's "intimacy:closeness" array, and that the target has at least one "arm" body part type.
A corresponding rule needs to be created, that listens to "core:attempt_action", that ensures that the action identifier is the action created for massaging the target's shoulders. The rule should dispatch a perceptible event with a text saying that the actor kneads the target's shoulders. An action successful event should be dispatched, and the text should say that the acting actor massages the target's shoulders.

Your task is to create a comprehensive PRP document to implement these changes.

## EXAMPLES:

Check out the action in data/mods/sex/actions/ . It will be the main inspiration for this new action and its rule, as the new action does something very similar and its scope will also need to check a body part. Ensure that you understand the scope actors_with_breasts_in_intimacy.scope for inspiration for the new scope.

## DOCUMENTATION:

You have documents for the scopeDSL in docs/scope-dsl.md and docs/mods/creating-scopes.md
You have a document for the JsonLogic system in docs/json-logic/json-logic for modders.md

## OTHER CONSIDERATIONS:

A comprehensive test suite like the ones in tests/integration/rules/ and tests/integration/mods/sex/ should be created to ensure this new action and its rule works properly.