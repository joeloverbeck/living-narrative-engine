# VALCORCON-008: Implement Error Message Format Reconciliation

**Priority**: 3 (Medium - Quality)  
**Phase**: Deprecation Phase 3  
**Estimated Effort**: 4 hours  
**Parent Ticket**: CONSREC-001  
**Dependencies**: VALCORCON-004, VALCORCON-005, VALCORCON-007

---

## Objective

Reconcile and standardize error message formats between existing validation implementations and new validationCore.js implementations to ensure consistent error reporting across the entire codebase.

**Success Criteria:**
- Consistent error message formats across all validation functions
- No breaking changes in error message structure for existing code
- Clear, actionable error messages following project standards
- Comprehensive error format documentation

---

## Background

From CONSREC-001, error message format reconciliation is needed because:
- Multiple validation implementations have different error message patterns
- New validationCore.js implementations need consistency with existing patterns
- Error messages must remain actionable and informative for developers
- Existing error handling code depends on specific message formats

**Current Error Message Variations:**
```javascript
// From dependencyUtils.js:
"InvalidArgumentError: ${context}: ${interfaceName} is required but was null/undefined"

// From stringValidation.js:  
"${message} - value was ${typeof value}"

// From existing validationCore.js:
"${context}: ${paramName} ${validationRule}. ${additionalInfo}"

// From various files:
"Entity validation failed: ${details}"
"Invalid dependency: ${reason}"
```

---

## Scope

### Analysis Targets:
- All validation error messages in validationCore.js implementations
- Existing error messages in legacy validation files
- Error handling patterns across the codebase
- Consumer code that depends on specific error message formats

### Standardization Areas:
1. **Message structure and formatting**
2. **Context information inclusion**
3. **Parameter name and value reporting**
4. **Actionable guidance in error messages**

---

## Implementation Steps

### Step 1: Error Message Pattern Analysis (90 minutes)

1. **Catalog current error message patterns**
   ```bash
   # Search for validation error messages across codebase
   rg "InvalidArgumentError|ValidationError|throw.*Error" src/
   rg "Error.*:" src/ -A 2
   ```

2. **Analyze error message structures**
   ```javascript
   // Pattern 1: Context-first (most common):
   "${context}: ${paramName} ${requirement}. ${details}"
   // Example: "EntityManager.create: entity must be non-null. Received: undefined"
   
   // Pattern 2: Message-first:
   "${requirement} - ${details}"
   // Example: "Value must be non-blank - received empty string"
   
   // Pattern 3: Formal error format:
   "InvalidArgumentError: ${context}: ${details}"
   // Example: "InvalidArgumentError: UserService.validate: user ID is required but was null"
   ```

3. **Identify dependencies on specific error formats**
   - Error handling code that parses error messages
   - Test assertions that expect specific message formats
   - Logging systems that depend on error message structure
   - User-facing error reporting that reformats messages

### Step 2: Define Standard Error Message Format (60 minutes)

1. **Establish unified error message pattern**
   ```javascript
   /**
    * Standard Error Message Format:
    * 
    * For validation errors: "${context}: ${paramName} ${requirement}. ${details}"
    * 
    * Components:
    * - context: Where the validation occurred (e.g., "EntityManager.create")
    * - paramName: Name of the parameter being validated (e.g., "entity")  
    * - requirement: What the validation rule requires (e.g., "must be non-blank")
    * - details: Additional information (e.g., "Received: null")
    * 
    * Examples:
    * ✅ "EntityManager.create: entity must be non-null. Received: undefined"
    * ✅ "UserService.validate: username must be non-blank. Received: ''"
    * ✅ "GameEngine.loadComponent: componentId must be valid ID format. Received: 'invalid-id'"
    */
   
   // Standard format function:
   function formatValidationError(context, paramName, requirement, receivedValue) {
     const details = receivedValue !== undefined 
       ? `Received: ${typeof receivedValue === 'string' ? `'${receivedValue}'` : receivedValue}`
       : 'No value provided';
     
     return `${context}: ${paramName} ${requirement}. ${details}`;
   }
   ```

2. **Define error message guidelines**
   ```javascript
   /**
    * Error Message Guidelines:
    * 
    * 1. Always include context (where validation failed)
    * 2. Always include parameter name being validated  
    * 3. Use active voice ("must be", not "should be")
    * 4. Include received value when helpful for debugging
    * 5. Be specific about requirements ("non-blank string", not "valid")
    * 6. Use consistent terminology across all validation functions
    * 
    * Required Language Patterns:
    * - "must be non-blank" (not "cannot be blank")
    * - "must be valid logger instance" (not "invalid logger")
    * - "must contain only alphanumeric characters" (specific requirements)
    * - "Received: null" (consistent value reporting)
    */
   ```

### Step 3: Update validationCore.js Error Messages (90 minutes)

1. **Standardize string namespace error messages**
   ```javascript
   // string.assertNonBlank:
   // OLD: Various formats
   // NEW: "${context}: ${paramName} must be non-blank string. Received: ${receivedValue}"
   
   export const string = {
     assertNonBlank: (value, paramName, context, logger) => {
       if (!value || typeof value !== 'string' || value.trim() === '') {
         const receivedDisplay = value === null ? 'null' 
           : value === undefined ? 'undefined'
           : typeof value !== 'string' ? `${typeof value}(${value})`
           : `'${value}'`;
         
         throw new InvalidArgumentError(
           `${context}: ${paramName} must be non-blank string. Received: ${receivedDisplay}`
         );
       }
     }
     // ... other functions with standardized messages
   };
   ```

2. **Standardize dependency namespace error messages**
   ```javascript
   export const dependency = {
     validateDependency: (dep, interfaceName, logger, options = {}) => {
       if (dep === null || dep === undefined) {
         throw new InvalidArgumentError(
           `${options.context || 'dependency validation'}: ${interfaceName} must be provided. Received: ${dep}`
         );
       }
       
       if (options.requiredMethods) {
         for (const method of options.requiredMethods) {
           if (typeof dep[method] !== 'function') {
             throw new InvalidArgumentError(
               `${options.context || 'dependency validation'}: ${interfaceName} must have method '${method}'. Method not found or not a function`
             );
           }
         }
       }
     },
     
     assertPresent: (value, message, context, logger) => {
       if (value === null || value === undefined) {
         throw new InvalidArgumentError(
           `${context}: ${message}. Received: ${value}`
         );
       }
     }
     // ... other functions with standardized messages
   };
   ```

3. **Standardize entity namespace error messages**
   ```javascript
   export const entity = {
     assertValidId: (id, context, logger) => {
       if (!id || typeof id !== 'string' || id.trim() === '') {
         throw new InvalidArgumentError(
           `${context}: entity ID must be non-blank string. Received: ${id}`
         );
       }
       
       if (id !== 'none' && id !== 'self' && !id.includes(':')) {
         throw new InvalidArgumentError(
           `${context}: entity ID must be in format 'modId:identifier' or be 'none'/'self'. Received: '${id}'`
         );
       }
       
       // Additional format validation with consistent error messages...
     }
     // ... other functions
   };
   ```

### Step 4: Verify Backward Compatibility (60 minutes)

1. **Test error message compatibility**
   ```javascript
   // Create compatibility verification tests
   
   // Test that error messages maintain essential information
   // Test that error parsing code still works
   // Test that logging systems can process new message formats
   
   // Example verification:
   try {
     validation.string.assertNonBlank('', 'username', 'UserService.create', logger);
   } catch (error) {
     // Verify error message contains expected components:
     assert(error.message.includes('UserService.create'));
     assert(error.message.includes('username'));
     assert(error.message.includes('must be non-blank'));
     assert(error.message.includes('Received:'));
   }
   ```

2. **Update deprecated functions to use new formats**
   ```javascript
   // In legacy validation files, ensure forwarded functions
   // produce error messages in new standardized format
   
   // This ensures migration to new validationCore.js results in
   // consistent error messages immediately
   ```

---

## Deliverables

1. **Standardized Error Message Format**
   ```javascript
   // Standard format specification:
   "${context}: ${paramName} ${requirement}. ${details}"
   
   // Helper function for consistent formatting:
   function formatValidationError(context, paramName, requirement, receivedValue) {
     // Implementation...
   }
   ```

2. **Updated validationCore.js**
   - All validation functions use standardized error message format
   - Consistent terminology and language patterns
   - Helpful debugging information in all error messages
   - Backward compatibility maintained for essential information

3. **Error Message Guidelines Documentation**
   - Standard format specification
   - Language and terminology guidelines
   - Examples of good vs. bad error messages
   - Migration guide for updating existing error messages

4. **Compatibility Verification Report**
   - Test results showing error message compatibility
   - Impact assessment on existing error handling code
   - List of any breaking changes (should be none)
   - Performance impact of error message formatting

---

## Acceptance Criteria

### Message Standardization:
- [ ] All validationCore.js functions use consistent error message format
- [ ] Error messages follow "${context}: ${paramName} ${requirement}. ${details}" pattern
- [ ] Consistent terminology used across all validation functions
- [ ] Received values properly formatted for debugging

### Backward Compatibility:
- [ ] Essential error message information preserved
- [ ] Existing error handling code continues to work
- [ ] Test assertions still pass with new error formats
- [ ] No breaking changes in error message structure

### Quality Standards:
- [ ] Error messages are actionable and informative
- [ ] Consistent language patterns across all functions
- [ ] Proper context information included in all errors
- [ ] Clear indication of what values were received

### Documentation:
- [ ] Error message format guidelines documented
- [ ] Examples provided for all validation error types
- [ ] Migration guidance for updating existing error messages
- [ ] Compatibility notes for existing error handling

---

## Dependencies & Prerequisites

### Prerequisites:
- VALCORCON-004: dependency namespace implementation
- VALCORCON-005: entity namespace implementation  
- VALCORCON-007: deprecation warnings implementation
- Understanding of existing error handling patterns

### Enables:
- Consistent error reporting across entire validation system
- Better developer experience with informative error messages
- Easier debugging with standardized error formats
- Foundation for future error handling improvements

---

## Risk Considerations

### Risk: Breaking Error Message Parsing
**Mitigation Strategy:**
- Preserve essential information structure
- Test existing error handling code
- Gradual rollout with verification
- Backward compatibility verification

### Risk: Inconsistent Error Formats
**Mitigation Strategy:**
- Clear format specification and guidelines
- Helper function for consistent formatting
- Code review requirements for error messages
- Automated testing of error message formats

### Risk: Performance Impact
**Mitigation Strategy:**
- Efficient error message formatting
- Avoid complex string operations in error paths
- Benchmark error handling performance

---

## Testing Strategy

### Error Message Format Testing:
- Verify all validation functions produce consistent error format
- Test error message parsing in existing error handling code
- Validate that debugging information is helpful and accurate

### Compatibility Testing:
- Test existing error handling code with new message formats
- Verify test assertions still work
- Check logging systems process new formats correctly

### Integration Testing:
- Test error propagation through validation chains
- Verify error messages in real usage scenarios
- Test error handling in complex validation workflows

---

## Success Metrics

- **Consistency**: All validation errors follow standardized format
- **Informativeness**: Error messages provide actionable debugging information
- **Compatibility**: Zero breaking changes in essential error information
- **Developer Experience**: Improved error clarity and debugging capability

---

**Created**: 2025-09-03  
**Based on**: CONSREC-001 Step 3.2  
**Ticket Type**: Quality/Standardization  
**Next Ticket**: VALCORCON-009