# AJVVALENH-003: Implement Pre-validation Type Checker

## Priority: 2 - High

## Problem Statement
Currently, when a rule file has a structural issue (like an invalid or missing operation type), AJV attempts to validate against all 41 operation schemas in the anyOf array, generating hundreds of misleading errors. A lightweight pre-validation type checker would catch these common issues early and provide immediate, clear feedback before full schema validation occurs.

## Current State
- Validation goes directly to full AJV schema validation
- No preliminary checks for basic structural validity
- Invalid operation types trigger validation against all 41 schemas
- Simple typos or structural issues generate 700+ errors

## Technical Requirements

### 1. Pre-validator Module Structure

Create a new pre-validation module:
```javascript
// src/validation/operationPreValidator.js
class OperationPreValidator {
  constructor({ logger, operationTypes }) {
    this.#logger = logger;
    this.#validOperationTypes = new Set(operationTypes);
  }

  validate(data, context = {}) {
    const issues = [];
    
    // Phase 1: Structure validation
    issues.push(...this.#validateStructure(data));
    
    // Phase 2: Type validation
    issues.push(...this.#validateType(data));
    
    // Phase 3: Basic requirements
    issues.push(...this.#validateBasicRequirements(data));
    
    return {
      valid: issues.length === 0,
      issues,
      hints: this.#generateHints(issues, data)
    };
  }
}
```

### 2. Validation Phases

#### Phase 1: Structure Validation
```javascript
#validateStructure(data) {
  const issues = [];
  
  // Check if data is an object
  if (!data || typeof data !== 'object') {
    issues.push({
      level: 'error',
      message: 'Operation must be an object',
      path: '$'
    });
    return issues;
  }
  
  // Check for required top-level structure
  if (!data.type) {
    issues.push({
      level: 'error',
      message: 'Operation missing required "type" field',
      path: '$.type',
      hint: 'Every operation must have a type field'
    });
  }
  
  // Check for common structural mistakes
  if (data.type === 'IF' && (data.condition || data.then_actions)) {
    issues.push({
      level: 'error',
      message: 'IF operation properties found at wrong level',
      path: '$',
      hint: 'Move "condition" and "then_actions" inside "parameters" object'
    });
  }
  
  return issues;
}
```

#### Phase 2: Type Validation
```javascript
#validateType(data) {
  const issues = [];
  
  if (!data.type) return issues;
  
  // Check if type is a string
  if (typeof data.type !== 'string') {
    issues.push({
      level: 'error',
      message: `Operation type must be a string, got ${typeof data.type}`,
      path: '$.type'
    });
    return issues;
  }
  
  // Check if type is valid
  if (!this.#validOperationTypes.has(data.type)) {
    const suggestions = this.#findSimilarTypes(data.type);
    issues.push({
      level: 'error',
      message: `Unknown operation type: "${data.type}"`,
      path: '$.type',
      validTypes: Array.from(this.#validOperationTypes),
      suggestions
    });
  }
  
  return issues;
}
```

#### Phase 3: Basic Requirements
```javascript
#validateBasicRequirements(data) {
  const issues = [];
  
  if (!data.type || !this.#validOperationTypes.has(data.type)) {
    return issues;
  }
  
  // Check operation-specific requirements
  const requirements = this.#getOperationRequirements(data.type);
  
  // Check for parameters object
  if (requirements.requiresParameters && !data.parameters) {
    issues.push({
      level: 'error',
      message: `${data.type} operation requires a "parameters" object`,
      path: '$.parameters'
    });
  }
  
  // Check for known required fields
  if (requirements.requiredFields) {
    const target = requirements.inParameters ? data.parameters : data;
    requirements.requiredFields.forEach(field => {
      if (!target?.[field]) {
        issues.push({
          level: 'warning',
          message: `${data.type} operation typically requires "${field}"`,
          path: requirements.inParameters ? `$.parameters.${field}` : `$.${field}`
        });
      }
    });
  }
  
  return issues;
}
```

### 3. Operation Type Registry

Create a registry of valid operation types and their basic requirements:
```javascript
// src/validation/operationTypeRegistry.js
export const operationTypeRegistry = {
  'IF': {
    requiresParameters: true,
    requiredFields: ['condition', 'then_actions'],
    inParameters: true
  },
  'QUERY_COMPONENT': {
    requiresParameters: true,
    requiredFields: ['componentId', 'query'],
    inParameters: true
  },
  'SET_COMPONENT': {
    requiresParameters: true,
    requiredFields: ['componentId', 'data'],
    inParameters: true
  },
  // ... all 41 operation types
};

export const validOperationTypes = Object.keys(operationTypeRegistry);
```

### 4. Intelligent Hints System

#### Type Suggestion Algorithm
```javascript
#findSimilarTypes(inputType) {
  const suggestions = [];
  const input = inputType.toUpperCase();
  
  // Exact match with different case
  for (const validType of this.#validOperationTypes) {
    if (validType.toUpperCase() === input) {
      suggestions.push({
        type: validType,
        reason: 'case mismatch'
      });
    }
  }
  
  // Levenshtein distance for typos
  for (const validType of this.#validOperationTypes) {
    const distance = this.#levenshteinDistance(input, validType);
    if (distance <= 2) {
      suggestions.push({
        type: validType,
        reason: 'possible typo',
        distance
      });
    }
  }
  
  // Partial matches
  for (const validType of this.#validOperationTypes) {
    if (validType.includes(input) || input.includes(validType)) {
      suggestions.push({
        type: validType,
        reason: 'partial match'
      });
    }
  }
  
  return suggestions.sort((a, b) => (a.distance || 999) - (b.distance || 999));
}
```

#### Hint Generation
```javascript
#generateHints(issues, data) {
  const hints = [];
  
  // Analyze patterns in issues
  if (issues.some(i => i.message.includes('wrong level'))) {
    hints.push({
      level: 'info',
      message: 'Common fix: Ensure operation-specific properties are inside "parameters"',
      example: {
        wrong: { type: 'IF', condition: {}, then_actions: [] },
        correct: { type: 'IF', parameters: { condition: {}, then_actions: [] } }
      }
    });
  }
  
  // Suggest documentation
  if (issues.some(i => i.message.includes('Unknown operation type'))) {
    hints.push({
      level: 'info',
      message: 'See data/schemas/operations/*.schema.json for valid operation types'
    });
  }
  
  return hints;
}
```

### 5. Integration with Validation Pipeline

#### Update Schema Validation Utils
```javascript
// src/utils/schemaValidationUtils.js
import { OperationPreValidator } from '../validation/operationPreValidator.js';

export async function validateOperation(data, schemaId, context = {}) {
  // Step 1: Pre-validation
  const preValidator = new OperationPreValidator({
    logger: context.logger,
    operationTypes: validOperationTypes
  });
  
  const preValidation = preValidator.validate(data, context);
  
  if (!preValidation.valid) {
    return {
      valid: false,
      errors: preValidation.issues,
      hints: preValidation.hints,
      phase: 'pre-validation'
    };
  }
  
  // Step 2: Full schema validation (existing code)
  return validateAgainstSchema(data, schemaId);
}
```

### 6. Performance Optimization

The pre-validator must be fast:
```javascript
class OperationPreValidator {
  constructor(options) {
    // Cache operation requirements
    this.#requirementsCache = new Map();
    
    // Pre-compile regex patterns
    this.#patterns = {
      identifier: /^[a-zA-Z_][a-zA-Z0-9_]*$/,
      componentId: /^[a-zA-Z0-9_]+:[a-zA-Z0-9_]+$/
    };
  }
  
  validate(data) {
    // Fast path for obviously invalid data
    if (!data || typeof data !== 'object') {
      return { valid: false, issues: [/* ... */] };
    }
    
    // Use early returns to avoid unnecessary checks
    // Target: <5ms for pre-validation
  }
}
```

## Success Criteria

### Functional Requirements
- [ ] Pre-validator catches structural issues before full validation
- [ ] Clear error messages for common mistakes
- [ ] Intelligent suggestions for typos and case mismatches
- [ ] Performance overhead <5ms

### Quality Requirements
- [ ] Pre-validation integrated seamlessly into pipeline
- [ ] No false positives (valid operations pass pre-validation)
- [ ] Helpful hints for fixing issues
- [ ] Comprehensive operation type registry

## Test Requirements

### Unit Tests
```javascript
describe('OperationPreValidator', () => {
  it('should detect missing type field');
  it('should detect invalid type values');
  it('should detect properties at wrong nesting level');
  it('should suggest similar valid types for typos');
  it('should validate all 41 operation types');
  it('should complete in <5ms for typical operations');
});
```

### Integration Tests
- Test with actual rule files
- Verify pre-validation runs before full validation
- Ensure error messages reach the user
- Test performance impact on large rule sets

## Dependencies
- Requires list of all 41 valid operation types
- Should be implemented after AJVVALENH-001 and AJVVALENH-002
- Will improve effectiveness of AJVVALENH-004

## Estimated Complexity
- **Effort**: 4-6 hours
- **Risk**: Low-Medium
- **Testing**: 2-3 hours

## Implementation Notes

### Key Design Decisions
1. Keep pre-validation lightweight and fast
2. Focus on common mistakes that cause anyOf cascades
3. Provide actionable hints, not just error messages
4. Make it easy to add new operation types

### Error Message Quality
```javascript
// Bad error message
"Invalid data"

// Good error message
"IF operation has 'condition' at wrong level - should be inside 'parameters'"

// Best error message with hint
{
  message: "IF operation structure error",
  details: "Properties 'condition' and 'then_actions' found at operation level",
  fix: "Move these properties inside a 'parameters' object",
  example: "{ type: 'IF', parameters: { condition: {...}, then_actions: [...] } }"
}
```

## Definition of Done
- [ ] Pre-validator module created and tested
- [ ] Operation type registry complete
- [ ] Integration with validation pipeline
- [ ] Unit tests passing
- [ ] Integration tests passing
- [ ] Performance benchmarks met (<5ms)
- [ ] Documentation updated

## Related Tickets
- AJVVALENH-001: Complete ajvAnyOfErrorFormatter Integration
- AJVVALENH-002: Add Comprehensive Tests for Error Formatters
- AJVVALENH-004: Create Validation Testing Suite
- AJVVALENH-006: Create Two-Phase Validation System

## Notes
This pre-validator will dramatically improve the developer experience by catching common structural issues before they trigger the anyOf cascade. By providing immediate, clear feedback for basic mistakes, we can prevent the confusion caused by hundreds of irrelevant error messages.