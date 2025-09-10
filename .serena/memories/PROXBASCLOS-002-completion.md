# PROXBASCLOS-002: Create Operation Schemas for Closeness Operations - COMPLETED

## Summary

Successfully created JSON schemas for `ESTABLISH_SITTING_CLOSENESS` and `REMOVE_SITTING_CLOSENESS` operations to handle proximity-based closeness relationships when actors sit on furniture.

## Files Created/Modified

### Created

1. `data/schemas/operations/establishSittingCloseness.schema.json`
   - Validates ESTABLISH_SITTING_CLOSENESS operations
   - Parameters: furniture_id, actor_id, spot_index (required), result_variable (optional)
   - Spot index constrained to 0-9 range

2. `data/schemas/operations/removeSittingCloseness.schema.json`
   - Validates REMOVE_SITTING_CLOSENESS operations
   - Same parameter structure as establish operation
   - Maintains consistency with existing closeness operations

3. `tests/unit/schemas/operations/proximityClosenessSchemas.test.js`
   - Comprehensive test suite with 33 test cases
   - Tests valid operations, invalid parameters, edge cases
   - Validates schema consistency between both operations

### Modified

1. `src/configuration/staticConfiguration.js`
   - Added 'establishSittingCloseness.schema.json' to OPERATION_SCHEMA_FILES
   - Added 'removeSittingCloseness.schema.json' to OPERATION_SCHEMA_FILES
   - Maintained alphabetical ordering

## Validation Results

- All tests passing (33 passed, 0 failed)
- Schemas load successfully during application startup
- JSON syntax valid
- Operation type constants match schema expectations
- AJV validation working correctly with base-operation.schema.json references

## Technical Implementation

- Followed existing operation schema patterns using `allOf` with base-operation.schema.json
- Used JSON Schema Draft 07
- String validation with minLength: 1 (not namespacedId pattern)
- Integer validation for spot_index with min: 0, max: 9
- additionalProperties: false for strict validation
- Optional result_variable parameter for rule context storage

## Next Steps

These schemas are now ready to be used by the operation handlers that will be implemented in subsequent tickets.
