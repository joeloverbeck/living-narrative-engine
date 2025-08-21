# DEBUGLOGGING-017: Implement Configuration Validation System

**Status**: Not Started  
**Priority**: P1 - High  
**Phase**: 3 - Configuration  
**Component**: Configuration System  
**Estimated**: 3 hours

## Description

Implement a robust configuration validation system that validates debug logging configuration at multiple points: load time, runtime updates, and before applying changes. Provide clear, actionable error messages for invalid configurations.

## Technical Requirements

### 1. Validation Layers

```javascript
// Layer 1: Schema validation (structural)
validateSchema(config); // JSON Schema validation

// Layer 2: Semantic validation (logical)
validateSemantics(config); // Business rules

// Layer 3: Runtime validation (environment)
validateRuntime(config); // Environment compatibility

// Layer 4: Security validation
validateSecurity(config); // Security constraints
```

### 2. Validation Rules

```javascript
const VALIDATION_RULES = {
  // Endpoint must be reachable
  endpointReachable: async (endpoint) => {},

  // Batch size vs flush interval balance
  batchFlushBalance: (batchSize, flushInterval) => {},

  // Category conflicts
  categoryConflicts: (categories) => {},

  // Performance thresholds
  performanceLimits: (config) => {},

  // Security constraints
  securityConstraints: (endpoint) => {},
};
```

### 3. Error Messages

```javascript
const ERROR_MESSAGES = {
  INVALID_MODE:
    'Invalid mode: {mode}. Must be one of: console, remote, hybrid, test, none',
  UNREACHABLE_ENDPOINT:
    'Cannot reach endpoint: {endpoint}. Please check the URL and server status',
  INVALID_BATCH_SIZE:
    'Batch size {size} is invalid. Must be between 1 and 1000',
  CATEGORY_CONFLICT: 'Category {category} has conflicting settings',
  PERFORMANCE_WARNING: 'Configuration may cause performance issues: {reason}',
};
```

## Implementation Steps

1. **Create Multi-Layer Validator**
   - [ ] Create `src/logging/config/configValidationService.js`
   - [ ] Implement schema validation layer
   - [ ] Implement semantic validation layer
   - [ ] Implement runtime validation layer

2. **Schema Validation Layer**

   ```javascript
   class SchemaValidator {
     constructor(schema) {
       this.ajv = new Ajv({ allErrors: true, verbose: true });
       this.validate = this.ajv.compile(schema);
     }

     validateSchema(config) {
       const valid = this.validate(config);
       if (!valid) {
         return {
           valid: false,
           errors: this.formatSchemaErrors(this.validate.errors),
         };
       }
       return { valid: true };
     }

     formatSchemaErrors(errors) {
       return errors.map((err) => ({
         path: err.instancePath,
         message: err.message,
         suggestion: this.getSuggestion(err),
       }));
     }
   }
   ```

3. **Semantic Validation Layer**

   ```javascript
   class SemanticValidator {
     validateSemantics(config) {
       const errors = [];

       // Check batch size vs interval
       if (config.remote.batchSize > 500 && config.remote.flushInterval < 500) {
         errors.push({
           rule: 'batch-flush-balance',
           message: 'Large batch with short interval may cause issues',
           suggestion: 'Increase flushInterval or decrease batchSize',
         });
       }

       // Check category consistency
       if (
         config.mode === 'none' &&
         Object.values(config.categories).some((c) => c.enabled)
       ) {
         errors.push({
           rule: 'mode-category-mismatch',
           message: 'Categories enabled but mode is "none"',
           suggestion: 'Change mode or disable categories',
         });
       }

       return errors.length ? { valid: false, errors } : { valid: true };
     }
   }
   ```

4. **Runtime Validation Layer**

   ```javascript
   class RuntimeValidator {
     async validateRuntime(config) {
       const errors = [];

       // Check endpoint reachability
       if (config.mode === 'remote' || config.mode === 'hybrid') {
         const reachable = await this.checkEndpoint(config.remote.endpoint);
         if (!reachable) {
           errors.push({
             rule: 'endpoint-reachable',
             message: `Cannot reach ${config.remote.endpoint}`,
             suggestion: 'Check server is running and URL is correct',
           });
         }
       }

       // Check file permissions (server-side)
       if (config.storage?.path) {
         const writable = await this.checkWritePermission(config.storage.path);
         if (!writable) {
           errors.push({
             rule: 'storage-writable',
             message: `Cannot write to ${config.storage.path}`,
             suggestion: 'Check directory permissions',
           });
         }
       }

       return errors.length ? { valid: false, errors } : { valid: true };
     }
   }
   ```

5. **Create Validation Orchestrator**

   ```javascript
   export class ConfigValidationService {
     async validate(config, options = {}) {
       const results = {
         schema: null,
         semantic: null,
         runtime: null,
         valid: true,
         errors: [],
         warnings: [],
       };

       // Layer 1: Schema
       if (!options.skipSchema) {
         results.schema = this.schemaValidator.validate(config);
         if (!results.schema.valid) {
           results.valid = false;
           results.errors.push(...results.schema.errors);
         }
       }

       // Layer 2: Semantic
       if (!options.skipSemantic && results.valid) {
         results.semantic = this.semanticValidator.validate(config);
         if (!results.semantic.valid) {
           results.valid = false;
           results.errors.push(...results.semantic.errors);
         }
       }

       // Layer 3: Runtime (async)
       if (!options.skipRuntime && results.valid) {
         results.runtime = await this.runtimeValidator.validate(config);
         if (!results.runtime.valid) {
           results.warnings.push(...results.runtime.errors);
         }
       }

       return results;
     }
   }
   ```

## Acceptance Criteria

- [ ] Schema validation catches structural errors
- [ ] Semantic validation catches logical errors
- [ ] Runtime validation checks environment
- [ ] Clear, actionable error messages
- [ ] Suggestions provided for fixes
- [ ] Async validation for network checks
- [ ] Performance impact minimal
- [ ] Validation can be partially skipped

## Dependencies

- **Requires**: DEBUGLOGGING-016 (schema)
- **Uses**: AJV for schema validation
- **Used By**: DEBUGLOGGING-011 (config loading)

## Testing Requirements

1. **Unit Tests**
   - [ ] Test each validation layer
   - [ ] Test error message formatting
   - [ ] Test suggestion generation
   - [ ] Test validation options

2. **Integration Tests**
   - [ ] Test complete validation flow
   - [ ] Test with various invalid configs
   - [ ] Test async validation
   - [ ] Test partial validation

## Files to Create/Modify

- **Create**: `src/logging/config/configValidationService.js`
- **Create**: `src/logging/config/validators/schemaValidator.js`
- **Create**: `src/logging/config/validators/semanticValidator.js`
- **Create**: `src/logging/config/validators/runtimeValidator.js`
- **Create**: `tests/unit/logging/config/validation.test.js`

## Validation Examples

```javascript
// Valid configuration passes all layers
const result = await validator.validate(validConfig);
// { valid: true, errors: [], warnings: [] }

// Invalid mode fails schema validation
const result = await validator.validate({ mode: 'invalid' });
// {
//   valid: false,
//   errors: [{
//     path: '/mode',
//     message: 'must be one of allowed values',
//     suggestion: 'Use: console, remote, hybrid, test, or none'
//   }]
// }

// Unreachable endpoint generates warning
const result = await validator.validate(configWithBadEndpoint);
// {
//   valid: true,
//   warnings: [{
//     rule: 'endpoint-reachable',
//     message: 'Cannot reach http://invalid:3001',
//     suggestion: 'Check server is running'
//   }]
// }
```

## Performance Considerations

- Cache validation results when possible
- Async validation for network checks
- Timeout for endpoint reachability check
- Skip expensive validations in production

## Security Validation

```javascript
class SecurityValidator {
  validate(config) {
    const issues = [];

    // Check for localhost in production
    if (
      process.env.NODE_ENV === 'production' &&
      config.remote.endpoint.includes('localhost')
    ) {
      issues.push('localhost endpoint in production');
    }

    // Check for sensitive data in config
    if (JSON.stringify(config).match(/password|token|key/i)) {
      issues.push('Possible sensitive data in config');
    }

    return issues;
  }
}
```

## Notes

- Consider adding validation CLI tool
- May need custom validators for complex rules
- Think about validation performance caching
- Consider validation levels (strict vs permissive)
- Document common validation errors

## Related Tickets

- **Depends On**: DEBUGLOGGING-016 (schema)
- **Used By**: DEBUGLOGGING-011, DEBUGLOGGING-018
- **Related**: DEBUGLOGGING-019 (security)
