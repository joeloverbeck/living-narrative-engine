## FEATURE:

Important: your current goal is to create a PRP document. No code modifications should be made at this stage.

We're working on the "sex" mod for our app. We have already a "fondle breasts" action and corresponding rule created, and now we want to implement a "fondle penis" action and corresponding rule.

- The action's template will be "fondle {target}'s penis". The required component for the acting actor requires the actor to have the "anatomy:closeness" component.
- We will need a new scope definition, one that checks for targets in the acting actor's "anatomy:closeness" array, and filters the targets for those that have a "penis" body part type.
- The rule needs to dispatch a perceptible event that says that the acting actor has fondled eagerly the target's penis. The rule should also dispatch an action success message indicating that the acting actor fondles the target's penis.

Your task is to create a comprehensive PRP document to implement these changes.

## EXAMPLES:

The existing actions data/mods/sex/actions/fondle_breasts.action.json and data/mods/intimacy/action/massage_shoulders.action.json should be valid basis for the new action.
The existing scopes data/mods/sex/scopes/actors_with_breasts_in_intimacy.scope and data/mods/intimacy/scopes/actors_with_arms_in_intimacy.scope should be valid basis for the new scope.
The existing rules data/mods/sex/rules/handle_fondle_breasts.rule.json and data/mods/intimacy/rules/handle_massage_shoulders.rule.json should be valid basis for the new rule.

## DOCUMENTATION:

Check out the documentation for JsonLogic and the scopeDSL in our app. docs/scope-dsl.md , docs/mods/creating-scopes.md , and docs/json-logic/json-logic for modders.md

## OTHER CONSIDERATIONS:

None in particular.
