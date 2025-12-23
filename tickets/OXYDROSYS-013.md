# OXYDROSYS-013: Create RESTORE_OXYGEN operation schema

## Description

Define the JSON schema for the RESTORE_OXYGEN operation.

## Files to Create

- `data/schemas/operations/restore-oxygen.schema.json`

## Files to Modify

- `data/schemas/operation.schema.json` - Add `$ref` to anyOf array

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

- Alphabetical ordering in operation.schema.json
