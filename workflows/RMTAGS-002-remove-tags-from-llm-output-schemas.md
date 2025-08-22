# RMTAGS-002: Remove Tags from LLM Output Schemas

**Priority**: High  
**Phase**: 1 - Schema & LLM Integration (Foundation)  
**Estimated Effort**: 1.5 hours  
**Risk Level**: Medium (LLM validation changes)  

## Overview

Remove the `tags` property from LLM output schema validation. This prevents LLMs from successfully generating tags in their responses and ensures the validation pipeline rejects any tag data from LLM outputs.

## Problem Statement

The `tags` field in `src/turns/schemas/llmOutputSchemas.js` (lines 80-83) instructs the validation system to accept tags from LLM responses. This enables the token-wasting cycle where LLMs generate tags that are then included in future prompts without providing functional value.

## Acceptance Criteria

- [ ] Remove `tags` property from LLM output validation schema
- [ ] LLM responses containing tags will fail validation appropriately
- [ ] LLM responses without tags validate successfully
- [ ] Error handling gracefully manages validation failures with tag fields
- [ ] Integration tests confirm LLM pipeline works without tags

## Technical Implementation

### Files to Modify

1. **`src/turns/schemas/llmOutputSchemas.js`** (lines 80-83)
   - Remove tags property from note schema validation:
   ```javascript
   tags: {
     type: 'array',
     items: { type: 'string' },
     description: 'Additional categorization tags (optional)',
   }
   ```

### Implementation Steps

1. **Locate LLM Output Schema**
   - Open `src/turns/schemas/llmOutputSchemas.js`
   - Find the note schema definition around lines 80-83
   - Identify the complete tags property definition

2. **Remove Tags from Schema**
   - Delete the entire tags property and its configuration
   - Ensure no trailing comma issues in JavaScript object
   - Verify schema remains syntactically valid

3. **Validate Schema Structure**
   - Confirm other note properties remain intact
   - Check that required fields are unchanged
   - Ensure overall LLM output schema structure is maintained

### LLM Validation Impact

**Expected Behavior Changes**:
- LLM responses with tags field will fail validation
- Validation errors will be logged for debugging
- LLM responses without tags will validate successfully
- System will continue processing valid response data

**Error Handling**: The existing validation error handling should gracefully manage cases where LLMs still attempt to generate tags, providing clear error messages for debugging.

### Testing Requirements

#### Unit Tests
- [ ] Verify LLM output validation rejects responses with tags
- [ ] Confirm LLM outputs without tags validate successfully
- [ ] Test error handling for validation failures
- [ ] Validate schema compilation and structure

#### Integration Tests  
- [ ] Test complete LLM response processing pipeline
- [ ] Verify error handling for tag-containing responses
- [ ] Confirm normal LLM workflow continues without tags
- [ ] Test validation error logging and reporting

#### LLM Pipeline Tests
- [ ] Mock LLM responses with tags are rejected
- [ ] Mock LLM responses without tags process normally
- [ ] Error recovery mechanisms work properly

## Dependencies

**Requires**: 
- RMTAGS-001 (Remove tags from component schema) - Should be completed first for consistency

**Blocks**:
- RMTAGS-003 (Remove tag instructions from prompts) - Natural follow-up
- RMTAGS-005 (Remove tags from prompt data formatter)

## Rollback Procedure

1. **Git Revert**: Restore previous schema version
2. **Validation Tests**: Confirm tags validation restored
3. **LLM Integration**: Verify LLM responses with tags validate properly

## Testing Validation

Before marking complete:

1. **Schema Validation Test**:
   ```bash
   # Test LLM output schema validation
   npm run test:unit -- --testPathPattern="llmOutputSchemas"
   ```

2. **LLM Pipeline Test**:
   ```bash
   # Test LLM response processing
   npm run test:integration -- --testPathPattern=".*llm.*processing"
   ```

3. **Validation Error Test**:
   ```bash
   # Test error handling for invalid responses
   npm run test:unit -- --testPathPattern=".*validation.*"
   ```

## Success Metrics

- [ ] LLM output schema compilation successful
- [ ] Responses with tags fail validation with clear error messages  
- [ ] Responses without tags validate and process normally
- [ ] No breaking changes to other LLM output validation
- [ ] Error handling provides useful debugging information
- [ ] All existing LLM tests pass (except those explicitly testing tags)

## Implementation Notes

**Validation Strategy**: This change will cause LLM responses to fail validation if they include tags. The system should handle these failures gracefully and continue processing other valid data from the response.

**Debugging Support**: Ensure validation error messages clearly indicate that tags are no longer supported, helping developers understand the change.

**LLM Behavior**: Initially, LLMs may still attempt to generate tags based on cached training patterns, but validation failures will prevent tag data from entering the system.

## Coordination Notes

This ticket should be completed in close sequence with RMTAGS-003 (removing prompt instructions) to prevent a temporary state where LLMs are instructed to generate tags that will then fail validation, potentially causing unnecessary error logging.