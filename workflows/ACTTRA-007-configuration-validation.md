# ACTTRA-007: Add Configuration Validation

## Overview

Implement schema validation at runtime for action tracing configuration with clear error messages. This enhancement adds comprehensive validation using the project's existing AJV schema validation infrastructure to ensure configuration integrity and provide helpful error messages to developers.

## Priority

**MEDIUM** - Quality assurance for configuration system

## Dependencies

- **Blocked by**: ACTTRA-006 (configuration loader) 
- **Requires**: ACTTRA-001 (action tracing configuration schema) ✅
- **Enables**: ACTTRA-003 (ActionTraceFilter with validated config)
- **Related**: All configuration-related tickets

## Acceptance Criteria

- [ ] JSON schema validation integrated with ActionTraceConfigLoader
- [ ] Runtime validation of all configuration properties
- [ ] Clear, actionable error messages for invalid configuration
- [ ] Support for custom validation rules beyond JSON schema
- [ ] Graceful handling of validation failures with fallbacks
- [ ] Validation performance optimized for frequent config checks
- [ ] Integration with existing AJV schema validation system
- [ ] Comprehensive test coverage for all validation scenarios
- [ ] Documentation of validation rules and error messages
- [ ] Backwards compatibility with existing configuration

## Schema Structure

Based on the specification, the schema will validate:

**File**: `data/schemas/action-trace-config.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "actionTracing": {
      "type": "object",
      "properties": {
        "enabled": {
          "type": "boolean",
          "description": "Enable or disable action tracing globally"
        },
        "tracedActions": {
          "type": "array",
          "items": {
            "type": "string",
            "pattern": "^([a-z_]+:[a-z_]+|\\*|[a-z_]+:\\*)$"
          },
          "description": "Action IDs to trace. Supports wildcards: '*', 'mod:*'"
        },
        "outputDirectory": {
          "type": "string",
          "minLength": 1,
          "description": "Directory for trace output files"
        },
        "verbosity": {
          "type": "string",
          "enum": ["minimal", "standard", "detailed", "verbose"],
          "description": "Level of detail in traces"
        },
        "includeComponentData": {
          "type": "boolean",
          "description": "Include component data in traces"
        },
        "includePrerequisites": {
          "type": "boolean",
          "description": "Include prerequisite evaluation details"
        },
        "includeTargets": {
          "type": "boolean",
          "description": "Include target resolution details"
        },
        "maxTraceFiles": {
          "type": "integer",
          "minimum": 1,
          "maximum": 1000,
          "description": "Maximum number of trace files to keep"
        },
        "rotationPolicy": {
          "type": "string",
          "enum": ["age", "count"],
          "description": "How to rotate old trace files"
        },
        "maxFileAge": {
          "type": "integer",
          "minimum": 3600,
          "description": "Maximum age of trace files in seconds (when using age policy)"
        }
      },
      "required": ["enabled", "tracedActions", "outputDirectory"]
    }
  },
  "required": ["actionTracing"]
}
```

## Implementation Steps

### Step 1: Analyze Existing Schema Validation

Review current validation patterns in the codebase:

```bash
# Find existing schema validation usage
find src -name "*schemaValidator*" -o -name "*SchemaValidator*"
find src -name "*ajv*" -o -name "*validation*"

# Check existing schema files structure
ls data/schemas/
```

Expected patterns:
- AjvSchemaValidator class for JSON schema validation  
- Schema loading and compilation at startup
- Error formatting utilities for user-friendly messages
- Integration with dependency injection system

### Step 2: Create Enhanced Configuration Validator

**File**: `src/configuration/actionTraceConfigValidator.js`

```javascript
/**
 * @file Configuration validator for action tracing system
 * Provides comprehensive validation using JSON Schema and custom rules
 */

import { validateDependency, assertPresent } from '../utils/validationUtils.js';
import { ensureValidLogger } from '../utils/loggerUtils.js';
import path from 'path';

/**
 * Validates action tracing configuration against schema and custom rules
 */
class ActionTraceConfigValidator {
  #schemaValidator;
  #logger;
  #schemaCompiled;
  #customValidators;

  /**
   * @param {Object} dependencies
   * @param {ISchemaValidator} dependencies.schemaValidator - AJV schema validator
   * @param {ILogger} dependencies.logger - Logger instance
   */
  constructor({ schemaValidator, logger }) {
    validateDependency(schemaValidator, 'ISchemaValidator', null, {
      requiredMethods: ['validate', 'loadSchema', 'formatErrors']
    });
    this.#logger = ensureValidLogger(logger, 'ActionTraceConfigValidator');

    this.#schemaValidator = schemaValidator;
    this.#schemaCompiled = null;
    this.#customValidators = new Map();

    this.#setupCustomValidators();
  }

  /**
   * Initialize validator by loading and compiling the schema
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.#logger.debug('Initializing action trace config validator');

      // Load the action trace config schema
      const schemaPath = 'data/schemas/action-trace-config.schema.json';
      const schema = await this.#schemaValidator.loadSchema(schemaPath);
      
      // Compile schema for performance
      this.#schemaCompiled = await this.#schemaValidator.compile(schema);

      this.#logger.info('Action trace config validator initialized successfully');
    } catch (error) {
      this.#logger.error('Failed to initialize config validator', error);
      throw new Error(`Schema validation setup failed: ${error.message}`);
    }
  }

  /**
   * Validate action tracing configuration
   * @param {Object} config - Configuration to validate
   * @returns {ValidationResult} Validation result with errors if any
   */
  async validateConfiguration(config) {
    assertPresent(config, 'Configuration is required');

    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      normalizedConfig: null
    };

    try {
      // Step 1: JSON Schema validation
      const schemaResult = await this.#validateAgainstSchema(config);
      if (!schemaResult.isValid) {
        result.isValid = false;
        result.errors.push(...schemaResult.errors);
      }

      // Step 2: Custom validation rules
      const customResult = await this.#runCustomValidation(config);
      if (!customResult.isValid) {
        result.isValid = false;
        result.errors.push(...customResult.errors);
      }

      // Step 3: Add warnings for non-critical issues
      result.warnings.push(...customResult.warnings);

      // Step 4: Normalize configuration if valid
      if (result.isValid) {
        result.normalizedConfig = await this.#normalizeConfiguration(config);
      }

      // Log validation results
      this.#logValidationResult(result);

      return result;
    } catch (error) {
      this.#logger.error('Configuration validation failed', error);
      
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: [],
        normalizedConfig: null
      };
    }
  }

  /**
   * Validate specific configuration property
   * @param {string} property - Property name to validate
   * @param {*} value - Value to validate
   * @returns {ValidationResult} Property validation result
   */
  validateProperty(property, value) {
    const validator = this.#customValidators.get(property);
    if (!validator) {
      return {
        isValid: true,
        errors: [],
        warnings: []
      };
    }

    try {
      return validator(value);
    } catch (error) {
      this.#logger.error(`Property validation failed for ${property}`, error);
      return {
        isValid: false,
        errors: [`Property ${property} validation error: ${error.message}`],
        warnings: []
      };
    }
  }

  /**
   * Get validation schema for external use
   * @returns {Object} JSON schema for action tracing configuration
   */
  getSchema() {
    return this.#schemaCompiled?.schema || null;
  }

  /**
   * Validate against JSON schema
   * @private
   */
  async #validateAgainstSchema(config) {
    if (!this.#schemaCompiled) {
      throw new Error('Schema validator not initialized');
    }

    const isValid = this.#schemaCompiled(config);
    
    if (isValid) {
      return { isValid: true, errors: [] };
    }

    // Format AJV errors for user-friendly messages
    const formattedErrors = this.#schemaValidator.formatErrors(this.#schemaCompiled.errors)
      .map(error => this.#formatSchemaError(error));

    return {
      isValid: false,
      errors: formattedErrors
    };
  }

  /**
   * Run custom validation rules
   * @private
   */
  async #runCustomValidation(config) {
    const errors = [];
    const warnings = [];

    // Extract action tracing config
    const actionTraceConfig = config.actionTracing || {};

    // Custom validation: tracedActions patterns
    const actionResult = this.#validateTracedActions(actionTraceConfig.tracedActions);
    errors.push(...actionResult.errors);
    warnings.push(...actionResult.warnings);

    // Custom validation: output directory
    const dirResult = this.#validateOutputDirectory(actionTraceConfig.outputDirectory);
    errors.push(...dirResult.errors);
    warnings.push(...dirResult.warnings);

    // Custom validation: file rotation configuration
    const rotationResult = this.#validateRotationConfig(actionTraceConfig);
    errors.push(...rotationResult.errors);
    warnings.push(...rotationResult.warnings);

    // Custom validation: performance impact assessment
    const performanceResult = this.#validatePerformanceImpact(actionTraceConfig);
    warnings.push(...performanceResult.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate traced actions configuration
   * @private
   */
  #validateTracedActions(tracedActions) {
    const errors = [];
    const warnings = [];

    if (!tracedActions || !Array.isArray(tracedActions)) {
      return { errors, warnings };
    }

    // Check for duplicate actions
    const duplicates = tracedActions.filter((action, index, arr) => 
      arr.indexOf(action) !== index
    );

    if (duplicates.length > 0) {
      warnings.push(`Duplicate traced actions found: ${duplicates.join(', ')}`);
    }

    // Validate action ID patterns
    const invalidActions = tracedActions.filter(action => {
      if (typeof action !== 'string') return true;
      
      // Valid patterns: 'mod:action', '*', 'mod:*'
      const validPattern = /^([a-z_]+:[a-z_]+|\*|[a-z_]+:\*)$/;
      return !validPattern.test(action);
    });

    if (invalidActions.length > 0) {
      errors.push(
        `Invalid action ID patterns: ${invalidActions.join(', ')}. ` +
        `Valid formats: 'mod:action', '*', 'mod:*'`
      );
    }

    // Performance warning for too many traced actions
    if (tracedActions.length > 20) {
      warnings.push(
        `Tracing ${tracedActions.length} actions may impact performance. ` +
        `Consider using wildcards or reducing the count.`
      );
    }

    // Check for wildcard conflicts
    const hasWildcard = tracedActions.includes('*');
    if (hasWildcard && tracedActions.length > 1) {
      warnings.push(
        `Wildcard '*' will trace all actions, making other specific actions redundant.`
      );
    }

    return { errors, warnings };
  }

  /**
   * Validate output directory configuration
   * @private
   */
  #validateOutputDirectory(outputDirectory) {
    const errors = [];
    const warnings = [];

    if (!outputDirectory) {
      return { errors, warnings };
    }

    // Check for path traversal attempts
    const normalizedPath = path.normalize(outputDirectory);
    if (normalizedPath.includes('..')) {
      errors.push(
        `Output directory contains path traversal: ${outputDirectory}. ` +
        `Use absolute paths or paths relative to project root.`
      );
    }

    // Warn about absolute paths in config
    if (path.isAbsolute(outputDirectory)) {
      warnings.push(
        `Absolute path used for output directory: ${outputDirectory}. ` +
        `Consider using relative paths for portability.`
      );
    }

    // Check for potentially problematic paths
    const problematicPaths = ['/', '/tmp', '/var', '/etc', '/home'];
    if (problematicPaths.some(p => normalizedPath.startsWith(p))) {
      warnings.push(
        `Output directory may require special permissions: ${outputDirectory}`
      );
    }

    return { errors, warnings };
  }

  /**
   * Validate file rotation configuration
   * @private
   */
  #validateRotationConfig(config) {
    const errors = [];
    const warnings = [];

    const { rotationPolicy, maxTraceFiles, maxFileAge } = config;

    // Validate rotation policy consistency
    if (rotationPolicy === 'count' && !maxTraceFiles) {
      warnings.push(
        `Rotation policy 'count' specified but maxTraceFiles not set. ` +
        `Files may accumulate indefinitely.`
      );
    }

    if (rotationPolicy === 'age' && !maxFileAge) {
      warnings.push(
        `Rotation policy 'age' specified but maxFileAge not set. ` +
        `Files may accumulate indefinitely.`
      );
    }

    // Performance warnings
    if (maxTraceFiles && maxTraceFiles > 500) {
      warnings.push(
        `High maxTraceFiles value (${maxTraceFiles}) may impact filesystem performance.`
      );
    }

    if (maxFileAge && maxFileAge < 3600) {
      warnings.push(
        `Very short maxFileAge (${maxFileAge}s) may cause frequent file cleanup.`
      );
    }

    return { errors, warnings };
  }

  /**
   * Assess potential performance impact of configuration
   * @private
   */
  #validatePerformanceImpact(config) {
    const warnings = [];

    if (!config.enabled) {
      return { warnings };
    }

    // Count performance impact factors
    let impactScore = 0;

    if (config.includeComponentData) impactScore += 1;
    if (config.includePrerequisites) impactScore += 1;
    if (config.includeTargets) impactScore += 1;
    if (config.verbosity === 'verbose') impactScore += 2;
    if (config.verbosity === 'detailed') impactScore += 1;

    if (impactScore >= 4) {
      warnings.push(
        `High performance impact configuration detected (score: ${impactScore}/5). ` +
        `Consider reducing verbosity or disabling detailed data inclusion.`
      );
    }

    return { warnings };
  }

  /**
   * Normalize configuration for consistent usage
   * @private
   */
  async #normalizeConfiguration(config) {
    const normalized = JSON.parse(JSON.stringify(config));
    const actionTracing = normalized.actionTracing;

    // Remove duplicate traced actions
    if (actionTracing.tracedActions) {
      actionTracing.tracedActions = [...new Set(actionTracing.tracedActions)];
    }

    // Normalize output directory path
    if (actionTracing.outputDirectory) {
      actionTracing.outputDirectory = path.normalize(actionTracing.outputDirectory);
    }

    // Set default rotation values based on policy
    if (actionTracing.rotationPolicy === 'count' && !actionTracing.maxTraceFiles) {
      actionTracing.maxTraceFiles = 100;
    }

    if (actionTracing.rotationPolicy === 'age' && !actionTracing.maxFileAge) {
      actionTracing.maxFileAge = 86400; // 24 hours
    }

    return normalized;
  }

  /**
   * Setup custom validation functions for specific properties
   * @private
   */
  #setupCustomValidators() {
    // Add custom validators for complex validation logic
    this.#customValidators.set('tracedActions', (value) => {
      return this.#validateTracedActions(value);
    });

    this.#customValidators.set('outputDirectory', (value) => {
      return this.#validateOutputDirectory(value);
    });
  }

  /**
   * Format schema validation error for user-friendly display
   * @private
   */
  #formatSchemaError(error) {
    const property = error.instancePath.replace('/actionTracing/', '') || 'root';
    const message = error.message;
    const value = error.data;

    switch (error.keyword) {
      case 'required':
        return `Missing required property: ${error.params.missingProperty}`;
      
      case 'enum':
        return `Invalid value '${value}' for ${property}. Valid values: ${error.params.allowedValues.join(', ')}`;
      
      case 'pattern':
        return `Invalid format for ${property}: '${value}'. Expected pattern: ${error.params.pattern}`;
      
      case 'minimum':
      case 'maximum':
        return `Value ${value} for ${property} is outside valid range (${error.params.limit})`;
      
      case 'type':
        return `Property ${property} must be of type ${error.params.type}, got ${typeof value}`;
      
      default:
        return `${property}: ${message}`;
    }
  }

  /**
   * Log validation results
   * @private
   */
  #logValidationResult(result) {
    if (result.isValid) {
      this.#logger.debug('Action tracing configuration validation passed', {
        warningCount: result.warnings.length
      });
    } else {
      this.#logger.warn('Action tracing configuration validation failed', {
        errorCount: result.errors.length,
        warningCount: result.warnings.length
      });
    }

    // Log individual errors and warnings at appropriate levels
    result.errors.forEach(error => this.#logger.error(`Config validation error: ${error}`));
    result.warnings.forEach(warning => this.#logger.warn(`Config validation warning: ${warning}`));
  }
}

export default ActionTraceConfigValidator;
```

### Step 3: Integrate Validator with Configuration Loader

Update the ActionTraceConfigLoader to use the validator:

**File**: `src/configuration/actionTraceConfigLoader.js` (modification to existing)

```javascript
// ... existing imports ...
import ActionTraceConfigValidator from './actionTraceConfigValidator.js';

class ActionTraceConfigLoader {
  // ... existing fields ...
  #configValidator;

  constructor({ configLoader, logger, schemaValidator }) {
    // ... existing validation ...
    validateDependency(schemaValidator, 'ISchemaValidator');
    
    // ... existing assignments ...
    
    // Initialize config validator
    this.#configValidator = new ActionTraceConfigValidator({
      schemaValidator,
      logger: this.#logger
    });
  }

  async initialize(options = {}) {
    // ... existing code ...
    
    // Initialize validator
    await this.#configValidator.initialize();
    
    // ... rest of initialization ...
  }

  async loadConfig() {
    try {
      // ... existing config loading ...

      // Validate configuration before applying defaults
      const validationResult = await this.#configValidator.validateConfiguration({
        actionTracing: actionTraceConfig
      });

      if (!validationResult.isValid) {
        this.#logger.error('Configuration validation failed', {
          errors: validationResult.errors
        });
        
        // Use fallback config on validation failure
        const fallbackConfig = this.#createFallbackConfig();
        this.#cachedConfig = fallbackConfig;
        return fallbackConfig;
      }

      // Log warnings even if validation passed
      validationResult.warnings.forEach(warning => {
        this.#logger.warn(`Configuration warning: ${warning}`);
      });

      // Use normalized configuration if available
      const configToUse = validationResult.normalizedConfig?.actionTracing || actionTraceConfig;

      // Apply defaults to normalized configuration
      const configWithDefaults = this.#applyDefaults(configToUse);

      // ... rest of existing method ...
    } catch (error) {
      // ... existing error handling ...
    }
  }

  // ... rest of existing methods ...
}
```

### Step 4: Update DI Registration

Update the container registration to include schema validator:

**File**: `src/dependencyInjection/containers/actionTracingContainer.js` (update)

```javascript
// ... existing code ...

// Register ActionTraceConfigLoader with schema validator
container.register(
  actionTracingTokens.IActionTraceConfigLoader,
  (deps) => {
    const logger = setup.setupService(
      'ActionTraceConfigLoader',
      deps.logger,
      {
        configLoader: {
          value: deps.configLoader,
          requiredMethods: ['loadConfig', 'watchConfig'],
        },
        schemaValidator: {
          value: deps.schemaValidator,
          requiredMethods: ['validate', 'loadSchema', 'formatErrors'],
        },
      }
    );

    return new ActionTraceConfigLoader({
      configLoader: deps.configLoader,
      schemaValidator: deps.schemaValidator,
      logger,
    });
  },
  {
    lifetime: 'singleton',
    dependencies: {
      configLoader: tokens.IConfigLoader,
      schemaValidator: tokens.ISchemaValidator,
      logger: tokens.ILogger,
    },
  }
);
```

## Testing Strategy

### Step 5: Create Comprehensive Unit Tests

**File**: `tests/unit/configuration/actionTraceConfigValidator.test.js`

```javascript
/**
 * @file Unit tests for ActionTraceConfigValidator
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ActionTraceConfigValidatorTestBed } from '../../common/configuration/actionTraceConfigValidatorTestBed.js';

describe('ActionTraceConfigValidator', () => {
  let testBed;
  let validator;

  beforeEach(async () => {
    testBed = new ActionTraceConfigValidatorTestBed();
    validator = testBed.createValidator();
    await validator.initialize();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('Schema Validation', () => {
    it('should validate complete valid configuration', async () => {
      const config = testBed.createValidConfig();
      
      const result = await validator.validateConfiguration(config);
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.normalizedConfig).toBeDefined();
    });

    it('should reject configuration missing required properties', async () => {
      const config = {
        actionTracing: {
          // Missing required 'enabled', 'tracedActions', 'outputDirectory'
        }
      };
      
      const result = await validator.validateConfiguration(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors.some(e => e.includes('enabled'))).toBe(true);
    });

    it('should validate verbosity enum values', async () => {
      const config = testBed.createValidConfig({
        verbosity: 'invalid_level'
      });
      
      const result = await validator.validateConfiguration(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid value \'invalid_level\'');
    });

    it('should validate integer ranges', async () => {
      const config = testBed.createValidConfig({
        maxTraceFiles: 2000 // Exceeds maximum of 1000
      });
      
      const result = await validator.validateConfiguration(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('outside valid range');
    });
  });

  describe('Custom Validation Rules', () => {
    it('should validate traced action patterns', async () => {
      const config = testBed.createValidConfig({
        tracedActions: ['core:go', 'invalid-pattern', 'mod:*', '*']
      });
      
      const result = await validator.validateConfiguration(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid action ID patterns');
      expect(result.errors[0]).toContain('invalid-pattern');
    });

    it('should warn about duplicate actions', async () => {
      const config = testBed.createValidConfig({
        tracedActions: ['core:go', 'core:look', 'core:go']
      });
      
      const result = await validator.validateConfiguration(config);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(expect.stringContaining('Duplicate traced actions'));
    });

    it('should validate output directory paths', async () => {
      const config = testBed.createValidConfig({
        outputDirectory: '../../../etc/passwd' // Path traversal attempt
      });
      
      const result = await validator.validateConfiguration(config);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('path traversal');
    });

    it('should assess performance impact', async () => {
      const config = testBed.createValidConfig({
        verbosity: 'verbose',
        includeComponentData: true,
        includePrerequisites: true,
        includeTargets: true
      });
      
      const result = await validator.validateConfiguration(config);
      
      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(expect.stringContaining('High performance impact'));
    });

    it('should validate rotation configuration consistency', async () => {
      const config = testBed.createValidConfig({
        rotationPolicy: 'count',
        maxTraceFiles: undefined
      });
      
      const result = await validator.validateConfiguration(config);
      
      expect(result.warnings).toContain(expect.stringContaining('maxTraceFiles not set'));
    });
  });

  describe('Configuration Normalization', () => {
    it('should remove duplicate traced actions', async () => {
      const config = testBed.createValidConfig({
        tracedActions: ['core:go', 'core:look', 'core:go', 'core:examine']
      });
      
      const result = await validator.validateConfiguration(config);
      
      expect(result.normalizedConfig.actionTracing.tracedActions).toEqual([
        'core:go', 'core:look', 'core:examine'
      ]);
    });

    it('should normalize output directory paths', async () => {
      const config = testBed.createValidConfig({
        outputDirectory: './traces/../traces/actions'
      });
      
      const result = await validator.validateConfiguration(config);
      
      expect(result.normalizedConfig.actionTracing.outputDirectory).toBe('traces/actions');
    });

    it('should set default rotation values', async () => {
      const config = testBed.createValidConfig({
        rotationPolicy: 'count',
        maxTraceFiles: undefined
      });
      
      const result = await validator.validateConfiguration(config);
      
      expect(result.normalizedConfig.actionTracing.maxTraceFiles).toBe(100);
    });
  });

  describe('Property Validation', () => {
    it('should validate individual properties', () => {
      const result = validator.validateProperty('tracedActions', ['core:go', 'invalid']);
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Invalid action ID patterns');
    });

    it('should return valid for non-validated properties', () => {
      const result = validator.validateProperty('unknownProperty', 'any-value');
      
      expect(result.isValid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    it('should handle schema compilation errors', async () => {
      testBed.mockSchemaValidator.compile.mockRejectedValue(new Error('Schema error'));
      
      await expect(validator.initialize()).rejects.toThrow('Schema validation setup failed');
    });

    it('should handle validation runtime errors', async () => {
      testBed.mockSchemaValidator.formatErrors.mockImplementation(() => {
        throw new Error('Format error');
      });
      
      const result = await validator.validateConfiguration(testBed.createValidConfig());
      
      expect(result.isValid).toBe(false);
      expect(result.errors[0]).toContain('Validation error');
    });
  });

  describe('Schema Access', () => {
    it('should provide access to compiled schema', () => {
      const schema = validator.getSchema();
      
      expect(schema).toBeDefined();
      expect(schema).toBe(testBed.mockCompiledSchema.schema);
    });
  });
});
```

### Step 6: Create Test Helper

**File**: `tests/common/configuration/actionTraceConfigValidatorTestBed.js`

```javascript
/**
 * @file Test helper for ActionTraceConfigValidator
 */

import ActionTraceConfigValidator from '../../../src/configuration/actionTraceConfigValidator.js';

export class ActionTraceConfigValidatorTestBed {
  constructor() {
    this.mockCompiledSchema = {
      schema: { type: 'object' },
      errors: []
    };

    this.mockSchemaValidator = {
      loadSchema: jest.fn().mockResolvedValue({ type: 'object' }),
      compile: jest.fn().mockResolvedValue(this.mockCompiledSchema),
      formatErrors: jest.fn().mockReturnValue([]),
      validate: jest.fn().mockReturnValue(true)
    };

    this.mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    // Setup successful validation by default
    this.mockCompiledSchema = jest.fn().mockReturnValue(true);
    Object.assign(this.mockCompiledSchema, {
      schema: { type: 'object' },
      errors: []
    });
    this.mockSchemaValidator.compile.mockResolvedValue(this.mockCompiledSchema);
  }

  createValidator(overrides = {}) {
    const dependencies = {
      schemaValidator: this.mockSchemaValidator,
      logger: this.mockLogger,
      ...overrides,
    };

    return new ActionTraceConfigValidator(dependencies);
  }

  createValidConfig(overrides = {}) {
    return {
      actionTracing: {
        enabled: true,
        tracedActions: ['core:go', 'core:look'],
        outputDirectory: './traces/actions',
        verbosity: 'standard',
        includeComponentData: true,
        includePrerequisites: true,
        includeTargets: true,
        maxTraceFiles: 100,
        rotationPolicy: 'age',
        maxFileAge: 86400,
        ...overrides
      }
    };
  }

  setupSchemaValidationFailure(errors = []) {
    this.mockCompiledSchema.mockReturnValue(false);
    this.mockCompiledSchema.errors = errors;
    this.mockSchemaValidator.formatErrors.mockReturnValue(errors);
  }

  cleanup() {
    jest.clearAllMocks();
  }
}
```

### Step 7: Integration Tests

**File**: `tests/integration/configuration/actionTraceConfigValidation.integration.test.js`

```javascript
/**
 * @file Integration tests for action tracing configuration validation
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createTestContainerWithDefaults } from '../../common/testContainerFactory.js';
import { actionTracingTokens } from '../../../src/dependencyInjection/tokens/actionTracingTokens.js';

describe('Action Trace Configuration Validation Integration', () => {
  let container;
  let configLoader;

  beforeEach(async () => {
    container = createTestContainerWithDefaults();
    configLoader = container.resolve(actionTracingTokens.IActionTraceConfigLoader);
    
    // Initialize the loader (including validator)
    await configLoader.initialize();
  });

  afterEach(() => {
    if (container?.dispose) {
      container.dispose();
    }
  });

  it('should validate configuration through the full pipeline', async () => {
    // Mock valid configuration file
    const mockConfig = {
      actionTracing: {
        enabled: true,
        tracedActions: ['core:go'],
        outputDirectory: './traces/actions',
        verbosity: 'standard'
      }
    };

    // Mock the underlying config loader
    const baseConfigLoader = container.resolve('IConfigLoader');
    baseConfigLoader.loadConfig = jest.fn().mockResolvedValue(mockConfig);

    const config = await configLoader.loadConfig();

    expect(config.enabled).toBe(true);
    expect(config.tracedActions).toEqual(['core:go']);
  });

  it('should handle validation failures gracefully', async () => {
    // Mock invalid configuration
    const invalidConfig = {
      actionTracing: {
        enabled: 'not-a-boolean',
        tracedActions: 'not-an-array',
        verbosity: 'invalid-level'
      }
    };

    const baseConfigLoader = container.resolve('IConfigLoader');
    baseConfigLoader.loadConfig = jest.fn().mockResolvedValue(invalidConfig);

    const config = await configLoader.loadConfig();

    // Should fall back to safe defaults
    expect(config.enabled).toBe(false);
    expect(Array.isArray(config.tracedActions)).toBe(true);
  });
});
```

## Performance Considerations

- **Schema Compilation**: Compile schema once during initialization for fast validation
- **Validation Caching**: Cache validation results for identical configurations
- **Error Object Reuse**: Reuse error formatting objects to reduce garbage collection
- **Async Validation**: Keep validation async to avoid blocking configuration loading

## Error Message Examples

The validator will provide clear, actionable error messages:

```
❌ Invalid action ID patterns: invalid-pattern. Valid formats: 'mod:action', '*', 'mod:*'
❌ Missing required property: enabled
❌ Property verbosity must be one of: minimal, standard, detailed, verbose
⚠️  Duplicate traced actions found: core:go
⚠️  High performance impact configuration detected (score: 4/5). Consider reducing verbosity.
⚠️  Wildcard '*' will trace all actions, making other specific actions redundant.
```

## Files Created

- [ ] `src/configuration/actionTraceConfigValidator.js`
- [ ] `tests/unit/configuration/actionTraceConfigValidator.test.js` 
- [ ] `tests/common/configuration/actionTraceConfigValidatorTestBed.js`
- [ ] `tests/integration/configuration/actionTraceConfigValidation.integration.test.js`

## Files Modified

- [ ] `src/configuration/actionTraceConfigLoader.js` (add validator integration)
- [ ] `src/dependencyInjection/containers/actionTracingContainer.js` (add schema validator dependency)

## Definition of Done

- [ ] ActionTraceConfigValidator class implemented with all validation rules
- [ ] JSON schema validation integrated with custom rules
- [ ] Clear, actionable error messages for all failure scenarios
- [ ] Configuration normalization for consistent data structures
- [ ] Performance optimization with schema compilation
- [ ] Comprehensive unit tests covering all validation scenarios
- [ ] Integration tests with full configuration loading pipeline
- [ ] All tests pass with 80%+ coverage
- [ ] Documentation of all validation rules
- [ ] Error message examples documented
- [ ] Performance benchmarks show acceptable validation times (<10ms)
- [ ] Code review completed
- [ ] Integration with ActionTraceConfigLoader verified
- [ ] Backwards compatibility maintained
- [ ] Code committed with descriptive message

## Next Steps

After completion of this ticket:

1. **ACTTRA-003**: Implement ActionTraceFilter with validated configuration
2. **ACTTRA-008**: Create output directory management with path validation
3. Performance testing of validation overhead

---

**Estimated Time**: 2 hours  
**Complexity**: Low  
**Priority**: Medium  
**Phase**: 1 - Configuration and Filtering