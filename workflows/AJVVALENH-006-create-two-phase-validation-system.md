# AJVVALENH-006: Create Two-Phase Validation System

## Priority: 3 - Medium

## Problem Statement
Currently, validation happens in a single pass where structural and content validation occur simultaneously. This means a simple structural error (like properties at the wrong nesting level) triggers full content validation against all possible schemas, generating hundreds of errors. A two-phase validation system would first validate structure, then content, providing clearer error messages and better performance.

## Current State
- Single-phase validation combines structure and content checks
- Structural errors trigger full anyOf validation cascade
- No clear separation between "shape" errors and "content" errors
- Developers see all errors at once, making it hard to prioritize fixes

## Technical Requirements

### 1. Two-Phase Validation Architecture

```
Input Data
    ↓
Phase 1: Structural Validation
- Check basic object structure
- Verify required top-level fields
- Validate type discriminator
- Check nesting levels
    ↓ (Pass/Fail with clear errors)
Phase 2: Content Validation  
- Validate field values
- Check data types
- Apply business rules
- Validate relationships
    ↓
Final Result
```

### 2. Phase 1: Structural Validator

```javascript
// src/validation/StructuralValidator.js
export class StructuralValidator {
  constructor({ logger, schemaRegistry }) {
    this.#logger = logger;
    this.#schemaRegistry = schemaRegistry;
    this.#structuralRules = this.#buildStructuralRules();
  }
  
  /**
   * Phase 1: Validate structure only
   * Fast, lightweight checks for common structural issues
   */
  validateStructure(data, schemaType = 'operation') {
    const result = {
      valid: true,
      phase: 'structural',
      errors: [],
      warnings: [],
      structuralProfile: null
    };
    
    // Level 1: Basic type checking
    if (!this.#isValidBaseStructure(data)) {
      result.valid = false;
      result.errors.push({
        level: 'structural',
        message: 'Data must be a non-null object',
        path: '$',
        fatal: true
      });
      return result;  // Fatal error, stop here
    }
    
    // Level 2: Required fields presence
    const requiredFields = this.#getRequiredFields(schemaType);
    const missingFields = this.#checkRequiredFields(data, requiredFields);
    if (missingFields.length > 0) {
      result.valid = false;
      result.errors.push(...missingFields.map(field => ({
        level: 'structural',
        message: `Missing required field: ${field}`,
        path: `$.${field}`,
        fatal: false
      })));
    }
    
    // Level 3: Type discriminator validation
    if (schemaType === 'operation' && data.type) {
      const typeValidation = this.#validateTypeDiscriminator(data.type);
      if (!typeValidation.valid) {
        result.valid = false;
        result.errors.push(typeValidation.error);
      } else {
        result.structuralProfile = typeValidation.profile;
      }
    }
    
    // Level 4: Nesting structure validation
    if (result.structuralProfile) {
      const nestingErrors = this.#validateNestingStructure(
        data, 
        result.structuralProfile
      );
      if (nestingErrors.length > 0) {
        result.valid = false;
        result.errors.push(...nestingErrors);
      }
    }
    
    // Level 5: Structural patterns
    const patternWarnings = this.#checkStructuralPatterns(data);
    result.warnings.push(...patternWarnings);
    
    return result;
  }
  
  #isValidBaseStructure(data) {
    return data !== null && 
           data !== undefined && 
           typeof data === 'object' && 
           !Array.isArray(data);
  }
  
  #validateTypeDiscriminator(type) {
    // Check if type is valid
    const validTypes = this.#schemaRegistry.getValidTypes('operation');
    
    if (!validTypes.includes(type)) {
      return {
        valid: false,
        error: {
          level: 'structural',
          message: `Invalid operation type: "${type}"`,
          path: '$.type',
          validTypes,
          suggestions: this.#findSimilarTypes(type, validTypes)
        }
      };
    }
    
    // Get structural profile for this type
    const profile = this.#schemaRegistry.getStructuralProfile(type);
    return {
      valid: true,
      profile
    };
  }
  
  #validateNestingStructure(data, profile) {
    const errors = [];
    
    // Check if properties are at correct nesting level
    profile.properties.forEach(prop => {
      const expectedPath = prop.path; // e.g., "parameters.condition"
      const actualValue = this.#getValueAtPath(data, expectedPath);
      const wrongLevelValue = this.#getValueAtPath(data, prop.name);
      
      if (!actualValue && wrongLevelValue) {
        errors.push({
          level: 'structural',
          message: `Property "${prop.name}" found at wrong nesting level`,
          path: `$.${prop.name}`,
          correctPath: `$.${expectedPath}`,
          hint: `Move "${prop.name}" to ${expectedPath}`,
          fix: this.#generateStructuralFix(data, prop)
        });
      }
    });
    
    return errors;
  }
  
  #checkStructuralPatterns(data) {
    const warnings = [];
    
    // Pattern: Operations usually have parameters
    if (data.type && !data.parameters) {
      warnings.push({
        level: 'structural',
        type: 'warning',
        message: 'Most operations require a "parameters" object',
        path: '$.parameters',
        hint: 'Consider adding a parameters object for operation data'
      });
    }
    
    // Pattern: Check for common typos
    const commonTypos = {
      'parameter': 'parameters',
      'param': 'parameters',
      'condition': 'parameters.condition',  // If at root level
      'actions': 'then_actions'
    };
    
    Object.keys(data).forEach(key => {
      if (commonTypos[key]) {
        warnings.push({
          level: 'structural',
          type: 'warning',
          message: `Possible typo: "${key}"`,
          path: `$.${key}`,
          suggestion: commonTypos[key]
        });
      }
    });
    
    return warnings;
  }
}
```

### 3. Phase 2: Content Validator

```javascript
// src/validation/ContentValidator.js
export class ContentValidator {
  constructor({ ajvValidator, logger }) {
    this.#ajvValidator = ajvValidator;
    this.#logger = logger;
  }
  
  /**
   * Phase 2: Validate content after structure passes
   * Full schema validation with enhanced error handling
   */
  validateContent(data, structuralProfile) {
    const result = {
      valid: true,
      phase: 'content',
      errors: [],
      warnings: []
    };
    
    // Use structural profile to select specific schema
    const schema = this.#selectSchema(structuralProfile);
    
    // Validate with specific schema (not anyOf)
    const ajvResult = this.#ajvValidator.validate(schema, data);
    
    if (!ajvResult.valid) {
      result.valid = false;
      result.errors = this.#formatContentErrors(
        ajvResult.errors,
        data,
        structuralProfile
      );
    }
    
    // Additional content checks
    const contentWarnings = this.#checkContentPatterns(data, structuralProfile);
    result.warnings.push(...contentWarnings);
    
    return result;
  }
  
  #selectSchema(structuralProfile) {
    // Use profile to get exact schema, avoiding anyOf
    if (structuralProfile && structuralProfile.type) {
      return this.#ajvValidator.getSchema(
        `operation-${structuralProfile.type.toLowerCase()}`
      );
    }
    
    // Fallback to general schema
    return this.#ajvValidator.getSchema('operation');
  }
  
  #formatContentErrors(errors, data, profile) {
    // Enhanced error formatting for content phase
    return errors.map(error => ({
      level: 'content',
      message: this.#humanizeErrorMessage(error),
      path: error.instancePath || error.dataPath,
      schemaPath: error.schemaPath,
      value: this.#getValueAtPath(data, error.instancePath),
      expected: error.params,
      context: profile?.type
    }));
  }
  
  #checkContentPatterns(data, profile) {
    const warnings = [];
    
    // Type-specific content patterns
    if (profile?.type === 'IF') {
      // Check for empty then_actions
      if (data.parameters?.then_actions?.length === 0) {
        warnings.push({
          level: 'content',
          type: 'warning',
          message: 'IF operation has empty then_actions',
          path: '$.parameters.then_actions',
          hint: 'Consider if this IF operation is necessary'
        });
      }
      
      // Check for always-true/false conditions
      if (this.#isAlwaysTrue(data.parameters?.condition)) {
        warnings.push({
          level: 'content',
          type: 'warning',
          message: 'Condition is always true',
          path: '$.parameters.condition',
          hint: 'Consider removing the IF operation'
        });
      }
    }
    
    return warnings;
  }
}
```

### 4. Orchestrator for Two-Phase Validation

```javascript
// src/validation/TwoPhaseValidator.js
export class TwoPhaseValidator {
  constructor({ structuralValidator, contentValidator, logger }) {
    this.#structuralValidator = structuralValidator;
    this.#contentValidator = contentValidator;
    this.#logger = logger;
  }
  
  /**
   * Orchestrate two-phase validation
   */
  async validate(data, options = {}) {
    const result = {
      valid: true,
      phases: {},
      errors: [],
      warnings: [],
      suggestions: []
    };
    
    // Phase 1: Structural Validation
    const structuralResult = await this.#runPhase1(data, options);
    result.phases.structural = structuralResult;
    
    if (!structuralResult.valid) {
      result.valid = false;
      result.errors.push(...structuralResult.errors);
      result.warnings.push(...structuralResult.warnings);
      
      // Generate fix suggestions for structural errors
      result.suggestions = this.#generateStructuralFixes(
        data, 
        structuralResult
      );
      
      // Stop here if structural validation fails (unless forced)
      if (!options.continueOnStructuralError) {
        result.earlyTermination = true;
        result.message = 'Structural validation failed. Fix structural issues before content validation.';
        return result;
      }
    }
    
    // Phase 2: Content Validation (only if structure passes or forced)
    if (structuralResult.valid || options.continueOnStructuralError) {
      const contentResult = await this.#runPhase2(
        data, 
        structuralResult.structuralProfile,
        options
      );
      result.phases.content = contentResult;
      
      if (!contentResult.valid) {
        result.valid = false;
        result.errors.push(...contentResult.errors);
        result.warnings.push(...contentResult.warnings);
      }
    }
    
    // Combine and prioritize all issues
    result.prioritizedIssues = this.#prioritizeIssues(result);
    
    return result;
  }
  
  #runPhase1(data, options) {
    try {
      return this.#structuralValidator.validateStructure(
        data, 
        options.schemaType
      );
    } catch (error) {
      this.#logger.error('Phase 1 validation error', error);
      return {
        valid: false,
        phase: 'structural',
        errors: [{
          level: 'system',
          message: 'Structural validation failed unexpectedly',
          error: error.message
        }]
      };
    }
  }
  
  #runPhase2(data, structuralProfile, options) {
    try {
      return this.#contentValidator.validateContent(
        data, 
        structuralProfile
      );
    } catch (error) {
      this.#logger.error('Phase 2 validation error', error);
      return {
        valid: false,
        phase: 'content',
        errors: [{
          level: 'system',
          message: 'Content validation failed unexpectedly',
          error: error.message
        }]
      };
    }
  }
  
  #prioritizeIssues(result) {
    // Priority order:
    // 1. Fatal structural errors
    // 2. Non-fatal structural errors  
    // 3. Content errors
    // 4. Warnings
    
    const allIssues = [
      ...result.errors.filter(e => e.fatal),
      ...result.errors.filter(e => !e.fatal && e.level === 'structural'),
      ...result.errors.filter(e => e.level === 'content'),
      ...result.warnings
    ];
    
    return allIssues.slice(0, 10);  // Show top 10 issues
  }
  
  #generateStructuralFixes(data, structuralResult) {
    const fixes = [];
    
    structuralResult.errors.forEach(error => {
      if (error.fix) {
        fixes.push(error.fix);
      } else if (error.correctPath) {
        fixes.push({
          type: 'move_property',
          from: error.path,
          to: error.correctPath,
          description: `Move property from ${error.path} to ${error.correctPath}`
        });
      }
    });
    
    return fixes;
  }
}
```

### 5. Integration with Existing System

```javascript
// src/utils/schemaValidationUtils.js
import { TwoPhaseValidator } from '../validation/TwoPhaseValidator.js';

let twoPhaseValidator;

export function initializeTwoPhaseValidation(config) {
  const structuralValidator = new StructuralValidator({
    logger: config.logger,
    schemaRegistry: config.schemaRegistry
  });
  
  const contentValidator = new ContentValidator({
    ajvValidator: config.ajvValidator,
    logger: config.logger
  });
  
  twoPhaseValidator = new TwoPhaseValidator({
    structuralValidator,
    contentValidator,
    logger: config.logger
  });
}

export async function validateWithTwoPhases(data, options = {}) {
  if (!twoPhaseValidator) {
    throw new Error('Two-phase validator not initialized');
  }
  
  // Feature flag check
  if (!config.features?.twoPhaseValidation) {
    // Fall back to single-phase validation
    return validateAgainstSchema(data, options.schemaId);
  }
  
  return twoPhaseValidator.validate(data, options);
}
```

### 6. Performance Optimization

```javascript
class StructuralValidator {
  constructor(options) {
    // Pre-compile patterns for performance
    this.#patterns = {
      operationType: /^[A-Z][A-Z_]*$/,
      componentId: /^[a-z]+:[a-z_]+$/,
      variableName: /^[a-zA-Z_][a-zA-Z0-9_]*$/
    };
    
    // Cache structural profiles
    this.#profileCache = new Map();
    
    // Pre-build validation rules
    this.#rules = this.#compileRules();
  }
  
  validateStructure(data) {
    // Fast path for cached profiles
    const cacheKey = this.#getCacheKey(data);
    if (this.#profileCache.has(cacheKey)) {
      return this.#profileCache.get(cacheKey);
    }
    
    // Perform validation
    const result = this.#performValidation(data);
    
    // Cache successful structural profiles
    if (result.valid && result.structuralProfile) {
      this.#profileCache.set(cacheKey, result.structuralProfile);
    }
    
    return result;
  }
}
```

## Success Criteria

### Functional Requirements
- [ ] Two-phase validation correctly separates structural and content checks
- [ ] Structural errors don't trigger content validation cascade
- [ ] Clear error messages for each phase
- [ ] Performance improvement over single-phase

### Quality Requirements
- [ ] Structural validation completes in <5ms
- [ ] Content validation uses targeted schemas
- [ ] Error count reduced by >80% for structural issues
- [ ] System remains backward compatible

## Test Requirements

### Unit Tests
```javascript
describe('Two-Phase Validation', () => {
  describe('Structural Phase', () => {
    it('should detect missing type field');
    it('should detect invalid type values');
    it('should detect wrong nesting levels');
    it('should complete in <5ms');
  });
  
  describe('Content Phase', () => {
    it('should only run after structural passes');
    it('should use targeted schema based on type');
    it('should validate content accurately');
  });
  
  describe('Error Handling', () => {
    it('should stop after structural errors by default');
    it('should continue if forced');
    it('should prioritize errors correctly');
  });
});
```

### Integration Tests
- Test with real operation files
- Verify error messages reach UI
- Test performance improvements
- Test backward compatibility

## Dependencies
- Builds on AJVVALENH-003 (Pre-validation)
- Complements AJVVALENH-005 (Discriminated Unions)
- Should be tested with AJVVALENH-004 test suite

## Estimated Complexity
- **Effort**: 8-10 hours
- **Risk**: Medium (architectural change)
- **Testing**: 4-5 hours

## Implementation Notes

### Key Design Decisions
1. Keep phases independent for flexibility
2. Cache structural profiles for performance
3. Allow forcing content validation for debugging
4. Maintain backward compatibility with flags

### Migration Strategy
1. Implement behind feature flag
2. Run in parallel with existing validation
3. Compare results and performance
4. Gradual rollout based on success metrics

## Definition of Done
- [ ] Two-phase validator implemented
- [ ] Structural validator complete
- [ ] Content validator complete
- [ ] Orchestrator functioning
- [ ] Tests passing
- [ ] Performance targets met
- [ ] Feature flag implemented
- [ ] Documentation updated

## Related Tickets
- AJVVALENH-003: Implement Pre-validation Type Checker
- AJVVALENH-005: Implement Discriminated Union Schema Pattern
- AJVVALENH-007: Build Schema Validation Debugger

## Notes
This two-phase approach will dramatically improve the validation experience by providing clear, targeted feedback at each stage. Developers will see structural issues immediately without the noise of content validation errors, making it much easier to fix problems incrementally.