# OXYDROSYS-011: Create DEPLETE_OXYGEN operation schema

## Description

Define the JSON schema for the DEPLETE_OXYGEN operation.

## Files to Create

- `data/schemas/operations/deplete-oxygen.schema.json`

## Files to Modify

- `data/schemas/operation.schema.json` - Add `$ref` to anyOf array

## Out of Scope

- JavaScript handler implementation
- DI registration
- Rules using this operation

## Acceptance Criteria

1. **Schema valid**: Passes JSON Schema draft-07 validation
2. **Inherits base**: Uses `allOf` with `../base-operation.schema.json`
3. **Type const**: `"type": { "const": "DEPLETE_OXYGEN" }`
4. **Parameters**: `entityId` (entityReference), `amount` (integer, optional - defaults to depletionRate)
5. **Operation.schema.json updated**: Reference added alphabetically

## Tests That Must Pass

- `npm run validate` - Schema validation
- Schema self-validates against JSON Schema draft-07

## Invariants

- Alphabetical ordering in operation.schema.json anyOf array
- Follows existing operation schema patterns exactly
