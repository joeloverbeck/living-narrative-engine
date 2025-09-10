# Entity Instance Loader Test Fix

## Issue

The integration test `tests/integration/loaders/entityInstanceLoader.test.js` was failing because it expected error messages in raw AJV format, but the production code had been enhanced to provide more user-friendly error messages.

## Root Cause

The production code uses `formatAjvErrorsEnhanced` from `ajvAnyOfErrorFormatter.js` which transforms AJV errors:

- "must have required property" → "Missing required property"
- "must NOT have additional properties" → "Unexpected property"

## Solution

Updated test expectations to match the enhanced error format:

1. Changed `"must have required property 'instanceId'"` to `"Missing required property 'instanceId'"`
2. Changed `"must have required property 'definitionId'"` to `"Missing required property 'definitionId'"`
3. Changed `"must NOT have additional properties"` to `"Unexpected property"`

## Files Modified

- `tests/integration/loaders/entityInstanceLoader.test.js`: Updated error message expectations in 3 test cases

## Result

All tests now pass successfully, maintaining validation coverage while aligning with the improved user-friendly error messages.
