## FEATURE:

Important: you shouldn't modify any code at this stage. The goal is to create a comprehensive PRP.

We have created a comprehensive anatomy system that builds body part graphs for entities. We're migrating the abilities/resources to be associated to body parts, not the entity itself. We have migrated "core:movement" ( data/mods/core/components/movement.component.json ) to be now in leg body part entities, not in the entity itself. For example, human_leg_muscular.entity.json has the "core:movement" component now.

We have four failing tests because they need to adjust to this change: the changes and queries for whether the "core:movement" is locked in an entity need to rely on the anatomy system code to navigate the graph and determine if any body part entity has the "core:movement", what value it has, what value set in it, etc. Code is in src/anatomy/ and subdirectories.

The failing test suites that need to adapt are:

tests/integration/rules/logPerceptibleEventsRule.integration.test.js
tests/integration/rules/closenessActionAvailability.integration.test.js
tests/integration/rules/getCloseRule.integration.test.js
tests/integration/rules/stepBackRule.integration.test.js

## EXAMPLES:

You have integration tests for the json-based rules in tests/integration/rules/ 
You also have integration tests for the anatomy system in tests/integration/anatomy/

## DOCUMENTATION:

Analyze data/schemas/action.schema.json , data/schemas/component.schema.json

## OTHER CONSIDERATIONS:

Once you've performed your changes, run 'npm run test' and ensure all tests pass.
