## FEATURE:

Introduce a new base schema capturing shared operation fields like type, comment, condition, and parameters, allowing other operation schemas to inherit these properties.

Update each operation schema to reference this base schema through an allOf composition, eliminating duplicated property definitions.

Register operation-base.schema.json in the list of schemas loaded by the configuration so validators can resolve references correctly.

Ensure tests that import operation schemas load the new base schema before individual operation schemas, preventing missing-reference errors during validation.

Tasks:

* Create a new file `data/schemas/operation-base.schema.json` defining common properties (`type`, `comment`, `condition`, `parameters` placeholder).
* Update each schema in `data/schemas/operations/` to use `allOf` with the base schema plus their specific `Parameters` definition.
* Adjust `operation.schema.json` to reference the updated schemas.

Your goal is to create a comprehensive PRP that will implement these changes. Do not modify any code yet; we will implement the PRP at a later date.

## EXAMPLES:

We have lots of integration test suites that involve operation handlers: tests/integration/rules/

## DOCUMENTATION:

The schemas for operation handlers are in data/schemas/operations/

## OTHER CONSIDERATIONS:

Once you've performed your changes, run 'npm run test' and ensure all tests pass.
