# OXYDROSYS-013: Create RESTORE_OXYGEN operation schema

## Status: COMPLETED

## Description

Define the JSON schema for the RESTORE_OXYGEN operation.

## Files to Create

- `data/schemas/operations/restoreOxygen.schema.json`

## Files to Modify

- `data/schemas/operation.schema.json` - Add `$ref` to anyOf array
- `src/configuration/staticConfiguration.js` - Register new operation schema in `OPERATION_SCHEMA_FILES`

## Out of Scope

- JavaScript handler implementation
- DI registration

## Acceptance Criteria

1. **Schema valid**: Passes JSON Schema draft-07 validation
2. **Inherits base**: Uses `allOf` with `../base-operation.schema.json`
3. **Type const**: `"type": { "const": "RESTORE_OXYGEN" }`
4. **Parameters**: `entityId` (entityReference), `restoreFull` (boolean), `amount` (integer, optional)

## Tests That Must Pass

- `npm run validate` - Schema validation

## Invariants

- Preserve existing ordering in `data/schemas/operation.schema.json`; keep oxygen operations adjacent.

## Outcome

- Created `data/schemas/operations/restoreOxygen.schema.json` and added it to `data/schemas/operation.schema.json`.
- Registered the new schema in `src/configuration/staticConfiguration.js` so schema loading/validation picks it up.
- Adjusted the ticket to match existing schema naming conventions (camelCase file name) and the non-alphabetical operation ordering.
