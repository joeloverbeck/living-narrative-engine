# RMTAGS-016: Validate Schema Breaking Change Handling

**Priority**: High  
**Phase**: 5 - Testing & Validation (Quality Assurance)  
**Estimated Effort**: 2.5 hours  
**Risk Level**: Medium (Schema compatibility validation)  

## Overview

Validate that the schema breaking changes from tag removal are handled gracefully, ensuring existing save data loads properly and the system maintains backwards compatibility while rejecting new tag data appropriately.

## Problem Statement

The removal of tags from the component schema creates a breaking change that needs careful validation. The system should gracefully ignore tags in existing save data while preventing new tag data from being validated or stored. This requires comprehensive testing of schema validation, data loading, and error handling scenarios.

## Acceptance Criteria

- [ ] Validate that existing save data with tags loads gracefully
- [ ] Confirm new data without tags validates successfully
- [ ] Ensure new data with tags is rejected appropriately
- [ ] Verify error messages are clear and helpful for schema violations
- [ ] Test edge cases and malformed data scenarios
- [ ] Confirm no functional gameplay impact from schema changes

## Technical Implementation

### Schema Validation Test Areas

1. **Component Schema Validation**
   - Test updated notes component schema rejects tag fields
   - Verify schema validation provides clear error messages
   - Ensure other fields continue to validate correctly

2. **Data Loading Backwards Compatibility**
   - Test loading save data containing tagged notes
   - Verify tags are ignored without causing errors
   - Confirm functional data loads and processes normally

3. **LLM Output Schema Validation**
   - Test LLM responses with tags are rejected
   - Verify LLM responses without tags validate successfully
   - Ensure error handling for malformed LLM responses

4. **Error Handling Scenarios**
   - Test various invalid data scenarios
   - Verify error messages are clear and actionable
   - Ensure system robustness with malformed input

### Implementation Steps

1. **Create Schema Validation Tests**
   ```javascript
   // Test notes component schema rejects tags
   describe('Notes Component Schema - Tag Removal', () => {
     it('should reject note data containing tags field', () => {
       const noteWithTags = {
         text: "Test note",
         subject: "character",
         subjectType: "character",
         tags: ["combat", "dialogue"]
       };
       expect(() => validateNoteSchema(noteWithTags)).toThrow();
     });
     
     it('should accept note data without tags field', () => {
       const noteWithoutTags = {
         text: "Test note", 
         subject: "character",
         subjectType: "character"
       };
       expect(() => validateNoteSchema(noteWithoutTags)).not.toThrow();
     });
   });
   ```

2. **Create Backwards Compatibility Tests**
   ```javascript
   describe('Save Data Backwards Compatibility', () => {
     it('should load save data containing tagged notes', () => {
       const saveDataWithTags = {
         notes: [{
           text: "Legacy note",
           subject: "character", 
           subjectType: "character",
           tags: ["legacy", "tagged"]
         }]
       };
       expect(() => loadSaveData(saveDataWithTags)).not.toThrow();
     });
   });
   ```

3. **Create LLM Schema Validation Tests**
   ```javascript
   describe('LLM Output Schema Validation', () => {
     it('should reject LLM responses containing tags', () => {
       const llmResponseWithTags = {
         notes: [{
           text: "AI generated note",
           subject: "character",
           subjectType: "character", 
           tags: ["ai", "generated"]
         }]
       };
       expect(() => validateLLMResponse(llmResponseWithTags)).toThrow();
     });
   });
   ```

4. **Create Error Handling Tests**
   - Test various malformed data scenarios
   - Verify error message quality and clarity
   - Ensure system stability with invalid input

### Test Scenarios

#### Valid Data Scenarios
- [ ] Notes without tags validate successfully
- [ ] Complete note objects with all required fields pass validation  
- [ ] LLM responses without tags process correctly
- [ ] Save data without tags loads and saves properly

#### Invalid Data Scenarios (Should be Rejected)
- [ ] Notes containing tags field
- [ ] LLM responses with tags field
- [ ] Malformed data with invalid tag structures
- [ ] Mixed data with some tagged and some untagged notes

#### Backwards Compatibility Scenarios
- [ ] Save data containing tagged notes loads without errors
- [ ] Tagged notes in save data are ignored during processing
- [ ] Gameplay functions normally with legacy tagged data
- [ ] System handles mixed legacy and new data gracefully

#### Error Handling Scenarios
- [ ] Clear error messages for schema violations
- [ ] Graceful handling of malformed input data
- [ ] System stability maintained during validation errors
- [ ] Appropriate logging of validation failures

### Testing Requirements

#### Schema Validation Tests
- [ ] Component schema validation works correctly
- [ ] LLM output schema validation functions properly
- [ ] Error messages are clear and helpful
- [ ] Validation performance is acceptable

#### Data Loading Tests  
- [ ] Legacy save data loads without errors
- [ ] New save data processes correctly
- [ ] Mixed data scenarios handled appropriately
- [ ] No gameplay functionality lost

#### Integration Tests
- [ ] End-to-end data flow validates correctly
- [ ] Schema changes integrate properly with system components
- [ ] Performance impact of validation changes is minimal
- [ ] Error handling integrates well with user interface

## Dependencies

**Requires**:
- RMTAGS-001 (Component schema changes) - Schema modifications completed
- RMTAGS-002 (LLM output schema changes) - LLM schema modifications completed
- RMTAGS-014 and RMTAGS-015 - Test infrastructure updated

**Blocks**:
- RMTAGS-017 (Performance validation) - Schema performance baseline needed
- System deployment readiness - Schema compatibility confirmed

## Testing Commands

### Schema Validation Testing
```bash
# Test component schema validation
npm run test:unit -- --testPathPattern=".*schema.*validation"

# Test data loading and backwards compatibility
npm run test:integration -- --testPathPattern=".*save.*load.*"

# Test LLM schema validation
npm run test:unit -- --testPathPattern=".*llm.*schema"
```

### Error Handling Testing
```bash
# Test error handling scenarios
npm run test:unit -- --testPathPattern=".*error.*handling"

# Test validation with various data scenarios
npm run test:integration -- --testPathPattern=".*validation.*"
```

### Complete Validation Testing
```bash
# Run all schema-related tests
npm run test:ci | grep -E "(schema|validation)"

# Test with sample legacy data
npm run test:integration -- --testPathPattern=".*legacy.*"
```

## Success Metrics

- [ ] All schema validation tests pass
- [ ] Legacy save data loads without errors
- [ ] New data without tags validates successfully
- [ ] New data with tags is appropriately rejected
- [ ] Error messages are clear and actionable
- [ ] No functional gameplay regressions
- [ ] Schema validation performance acceptable

## Implementation Notes

**Backwards Compatibility Priority**: Ensure that existing users can continue playing with their saved games without any disruption. Tags should be silently ignored rather than causing errors.

**Clear Error Messages**: When new data with tags is rejected, provide clear error messages that help developers understand the schema change and how to correct their data.

**Performance Consideration**: Schema validation should not significantly impact system performance. Monitor validation speed and optimize if necessary.

**Comprehensive Testing**: Test various edge cases and malformed data scenarios to ensure system robustness and stability.

## Quality Assurance

**Schema Validation Quality**:
- [ ] Validation logic correctly implements new schema requirements
- [ ] Error messages are helpful and specific
- [ ] Validation performance is acceptable
- [ ] Edge cases and malformed data handled gracefully

**Backwards Compatibility Quality**:
- [ ] Legacy data loads without any errors or warnings
- [ ] Functionality remains intact with legacy data
- [ ] Mixed scenarios (legacy and new data) work properly
- [ ] No user experience disruption for existing players

**Error Handling Quality**:
- [ ] System remains stable during validation errors
- [ ] Error logging provides useful debugging information
- [ ] User-facing error messages are clear and actionable
- [ ] Recovery mechanisms work properly

## Rollback Procedure

1. **Git Revert**: Restore previous schema versions
2. **Schema Validation**: Confirm tags validate properly again
3. **Legacy Testing**: Verify tagged data validates and processes correctly
4. **System Integration**: Ensure complete system functions with tag schemas restored

This ticket ensures that the schema breaking changes are implemented safely and that the system maintains backwards compatibility while properly enforcing the new tag-free schema for new data.