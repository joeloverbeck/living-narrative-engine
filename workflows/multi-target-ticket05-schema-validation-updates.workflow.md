# Ticket 5: Schema and Validation Updates

## Overview

Update JSON schemas and validation systems to support the enhanced event payload structure and entity reference resolution introduced in previous tickets. This ensures data integrity, enables proper validation of multi-target events, and provides clear documentation for the enhanced system.

## Problem Statement

**Current Issue**: Existing JSON schemas don't support the enhanced event payload structure with comprehensive target information, and entity reference schemas don't recognize placeholder names as valid references.

**Root Cause**: Schemas were designed for the original single-target system and need updates to accommodate:

- Enhanced event payload with `targets` object and legacy fields
- Placeholder names ("primary", "secondary", "tertiary") in entity references
- New validation requirements for multi-target consistency
- Metadata fields for target resolution tracking

**Target Outcome**: Comprehensive schema validation that ensures data integrity while supporting both legacy and enhanced formats.

## Dependencies

- **Ticket 1**: Enhanced event payload structure requirements
- **Ticket 2**: Entity reference resolution enhancements
- **Ticket 3**: Target reference resolver service validation needs
- Existing JSON schema validation system using AJV
- Event system schema definitions

## Implementation Details

### 1. Enhanced Event Payload Schema

**Step 1.1**: Update core event payload schema to support multi-target structure

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "multi-target-action-event-payload.schema.json",
  "title": "Multi-Target Action Event Payload",
  "description": "Enhanced event payload supporting multi-target actions with comprehensive target information",
  "type": "object",
  "properties": {
    "actorId": {
      "type": "string",
      "description": "ID of the actor performing the action",
      "minLength": 1,
      "pattern": "^\\S(.*\\S)?$"
    },
    "actionId": {
      "type": "string",
      "description": "ID of the action being performed",
      "minLength": 1,
      "pattern": "^[a-zA-Z0-9_]+:[a-zA-Z0-9_-]+$"
    },
    "actionText": {
      "type": "string",
      "description": "Formatted action text with resolved target names",
      "minLength": 1
    },

    "primaryId": {
      "type": ["string", "null"],
      "description": "Entity ID of primary target (backward compatibility)",
      "minLength": 1
    },
    "secondaryId": {
      "type": ["string", "null"],
      "description": "Entity ID of secondary target (backward compatibility)",
      "minLength": 1
    },
    "tertiaryId": {
      "type": ["string", "null"],
      "description": "Entity ID of tertiary target (backward compatibility)",
      "minLength": 1
    },

    "targets": {
      "type": "object",
      "description": "Comprehensive target information",
      "properties": {
        "primary": { "$ref": "#/definitions/targetInfo" },
        "secondary": { "$ref": "#/definitions/targetInfo" },
        "tertiary": { "$ref": "#/definitions/targetInfo" }
      },
      "additionalProperties": false
    },

    "resolvedTargetCount": {
      "type": "integer",
      "description": "Number of resolved targets",
      "minimum": 0,
      "maximum": 10
    },
    "hasContextDependencies": {
      "type": "boolean",
      "description": "Whether any targets were resolved from context"
    },

    "resolutionMetadata": {
      "type": "object",
      "description": "Additional metadata about target resolution",
      "properties": {
        "resolutionMethod": {
          "type": "string",
          "enum": ["direct", "context", "interactive", "default"]
        },
        "resolutionDuration": {
          "type": "number",
          "minimum": 0
        },
        "cacheHits": {
          "type": "integer",
          "minimum": 0
        }
      },
      "additionalProperties": false
    }
  },
  "required": ["actorId", "actionId", "actionText"],
  "additionalProperties": true,

  "definitions": {
    "targetInfo": {
      "type": "object",
      "description": "Complete information about a resolved target",
      "properties": {
        "entityId": {
          "type": "string",
          "description": "Resolved entity ID",
          "minLength": 1,
          "anyOf": [
            {
              "pattern": "^[a-zA-Z0-9_]+:[a-zA-Z0-9_-]+$",
              "description": "Namespaced entity ID (mod:identifier)"
            },
            {
              "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
              "description": "UUID entity ID"
            },
            {
              "enum": ["none", "self"],
              "description": "Special entity keywords"
            }
          ]
        },
        "placeholder": {
          "type": "string",
          "description": "Original placeholder name",
          "enum": ["primary", "secondary", "tertiary"]
        },
        "description": {
          "type": ["string", "null"],
          "description": "Human-readable target description"
        },
        "resolvedFromContext": {
          "type": "boolean",
          "description": "Whether target was resolved from context",
          "default": false
        },
        "contextSource": {
          "type": ["string", "null"],
          "description": "Source placeholder if resolved from context",
          "enum": ["primary", "secondary", "tertiary", null]
        },
        "resolutionMethod": {
          "type": "string",
          "description": "Method used for target resolution",
          "enum": ["direct", "context", "interactive", "default", "fallback"]
        },
        "timestamp": {
          "type": "number",
          "description": "When target was resolved (Unix timestamp)",
          "minimum": 0
        }
      },
      "required": ["entityId", "placeholder"],
      "additionalProperties": false,

      "if": {
        "properties": { "resolvedFromContext": { "const": true } }
      },
      "then": {
        "properties": {
          "contextSource": {
            "type": "string",
            "not": { "const": null }
          }
        },
        "required": ["contextSource"]
      }
    },

    "entityId": {
      "type": "string",
      "description": "Valid entity ID format",
      "minLength": 1,
      "anyOf": [
        {
          "pattern": "^[a-zA-Z0-9_]+:[a-zA-Z0-9_-]+$",
          "description": "Namespaced entity ID"
        },
        {
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "UUID entity ID"
        },
        {
          "enum": ["none", "self"],
          "description": "Special keywords"
        }
      ]
    }
  },

  "anyOf": [
    {
      "description": "At least one target must be present in some form",
      "anyOf": [
        {
          "properties": { "primaryId": { "type": "string" } },
          "required": ["primaryId"]
        },
        {
          "properties": { "targets": { "properties": { "primary": true } } },
          "required": ["targets"]
        }
      ]
    }
  ]
}
```

### 2. Enhanced Entity Reference Schema

**Step 2.1**: Update entity reference schema to support placeholder names

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "enhanced-entity-reference.schema.json",
  "title": "Enhanced Entity Reference",
  "description": "Entity reference supporting placeholders, keywords, and direct IDs",
  "oneOf": [
    {
      "type": "string",
      "description": "String entity reference",
      "minLength": 1,
      "pattern": "^\\S(.*\\S)?$",
      "anyOf": [
        {
          "enum": ["actor", "target"],
          "description": "Traditional keywords"
        },
        {
          "enum": ["primary", "secondary", "tertiary"],
          "description": "Multi-target placeholder names"
        },
        {
          "pattern": "^[a-zA-Z0-9_]+:[a-zA-Z0-9_-]+$",
          "description": "Namespaced entity ID (mod:identifier)"
        },
        {
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "UUID entity ID"
        },
        {
          "enum": ["none", "self"],
          "description": "Special entity keywords"
        }
      ]
    },
    {
      "type": "object",
      "description": "Object entity reference",
      "properties": {
        "entity_id": {
          "type": "string",
          "minLength": 1,
          "$ref": "#/definitions/entityId"
        }
      },
      "required": ["entity_id"],
      "additionalProperties": false
    }
  ],

  "definitions": {
    "entityId": {
      "type": "string",
      "minLength": 1,
      "anyOf": [
        {
          "pattern": "^[a-zA-Z0-9_]+:[a-zA-Z0-9_-]+$",
          "description": "Namespaced entity ID"
        },
        {
          "pattern": "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
          "description": "UUID entity ID"
        },
        {
          "enum": ["none", "self"],
          "description": "Special keywords"
        }
      ]
    }
  }
}
```

### 3. Operation Parameter Schema Updates

**Step 3.1**: Update operation schemas to support enhanced entity references

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "get-name-operation.schema.json",
  "title": "GET_NAME Operation Parameters",
  "description": "Parameters for GET_NAME operation with enhanced entity reference support",
  "type": "object",
  "properties": {
    "entity_ref": {
      "$ref": "enhanced-entity-reference.schema.json#",
      "description": "Entity reference (supports placeholders, keywords, and direct IDs)"
    },
    "result_variable": {
      "type": "string",
      "description": "Variable name to store the result",
      "minLength": 1,
      "pattern": "^[a-zA-Z_][a-zA-Z0-9_]*$"
    },
    "fallback_value": {
      "type": "string",
      "description": "Value to use if entity name cannot be resolved",
      "default": "Unnamed Character"
    }
  },
  "required": ["entity_ref", "result_variable"],
  "additionalProperties": false,

  "examples": [
    {
      "entity_ref": "primary",
      "result_variable": "primaryName",
      "fallback_value": "Unknown Person"
    },
    {
      "entity_ref": "actor",
      "result_variable": "actorName"
    },
    {
      "entity_ref": { "entity_id": "core:player" },
      "result_variable": "playerName"
    }
  ]
}
```

### 4. Validation Rule Updates

**Step 4.1**: Create custom validation rules for multi-target consistency

```javascript
/**
 * @file multiTargetValidationRules.js
 * @description Custom validation rules for multi-target event payloads
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';

/**
 * Multi-target validation rules and custom keywords
 */
class MultiTargetValidationRules {
  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false,
    });
    addFormats(this.ajv);

    // Add custom keywords for multi-target validation
    this.#addCustomKeywords();
  }

  /**
   * Add custom validation keywords
   * @private
   */
  #addCustomKeywords() {
    // Custom keyword: targetConsistency
    this.ajv.addKeyword({
      keyword: 'targetConsistency',
      type: 'object',
      schemaType: 'boolean',
      compile: (schemaValue) => {
        return function validate(data) {
          if (!schemaValue) return true; // Skip validation if disabled

          const errors = [];

          // Check consistency between legacy and comprehensive formats
          const legacyFields = ['primaryId', 'secondaryId', 'tertiaryId'];
          const placeholders = ['primary', 'secondary', 'tertiary'];

          legacyFields.forEach((field, index) => {
            const placeholder = placeholders[index];
            const legacyValue = data[field];
            const comprehensiveValue = data.targets?.[placeholder]?.entityId;

            // If both exist, they must match
            if (
              legacyValue &&
              comprehensiveValue &&
              legacyValue !== comprehensiveValue
            ) {
              errors.push({
                instancePath: `/targets/${placeholder}/entityId`,
                schemaPath: '#/targetConsistency',
                keyword: 'targetConsistency',
                params: {
                  legacyField: field,
                  legacyValue,
                  comprehensiveValue,
                },
                message: `Target consistency error: ${field}=${legacyValue} but targets.${placeholder}.entityId=${comprehensiveValue}`,
              });
            }
          });

          if (errors.length > 0) {
            validate.errors = errors;
            return false;
          }

          return true;
        };
      },
    });

    // Custom keyword: requiredTargets
    this.ajv.addKeyword({
      keyword: 'requiredTargets',
      type: 'object',
      schemaType: 'array',
      compile: (requiredPlaceholders) => {
        return function validate(data) {
          const errors = [];

          requiredPlaceholders.forEach((placeholder) => {
            const hasLegacy = data[`${placeholder}Id`];
            const hasComprehensive = data.targets?.[placeholder]?.entityId;

            if (!hasLegacy && !hasComprehensive) {
              errors.push({
                instancePath: `/${placeholder}Id`,
                schemaPath: '#/requiredTargets',
                keyword: 'requiredTargets',
                params: { placeholder },
                message: `Required target '${placeholder}' is missing from both legacy and comprehensive formats`,
              });
            }
          });

          if (errors.length > 0) {
            validate.errors = errors;
            return false;
          }

          return true;
        };
      },
    });

    // Custom keyword: validEntityId
    this.ajv.addKeyword({
      keyword: 'validEntityId',
      type: 'string',
      schemaType: 'boolean',
      compile: (schemaValue) => {
        return function validate(entityId) {
          if (!schemaValue) return true;

          // UUID pattern
          const uuidPattern =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

          // Namespaced pattern
          const namespacedPattern = /^[a-zA-Z0-9_]+:[a-zA-Z0-9_-]+$/;

          // Special keywords
          const specialKeywords = ['none', 'self'];

          const isValid =
            uuidPattern.test(entityId) ||
            namespacedPattern.test(entityId) ||
            specialKeywords.includes(entityId);

          if (!isValid) {
            validate.errors = [
              {
                instancePath: '',
                schemaPath: '#/validEntityId',
                keyword: 'validEntityId',
                params: { entityId },
                message: `Invalid entity ID format: ${entityId}`,
              },
            ];
            return false;
          }

          return true;
        };
      },
    });
  }

  /**
   * Validate enhanced event payload
   * @param {Object} payload - Event payload to validate
   * @returns {ValidationResult} - Validation result
   */
  validateEventPayload(payload) {
    const schema = {
      $ref: 'multi-target-action-event-payload.schema.json#',
      targetConsistency: true,
      requiredTargets: this.#extractRequiredTargets(payload),
    };

    const validate = this.ajv.compile(schema);
    const isValid = validate(payload);

    return {
      valid: isValid,
      errors: validate.errors || [],
      formattedErrors: this.#formatValidationErrors(validate.errors || []),
    };
  }

  /**
   * Validate entity reference
   * @param {any} entityRef - Entity reference to validate
   * @returns {ValidationResult} - Validation result
   */
  validateEntityReference(entityRef) {
    const schema = { $ref: 'enhanced-entity-reference.schema.json#' };
    const validate = this.ajv.compile(schema);
    const isValid = validate(entityRef);

    return {
      valid: isValid,
      errors: validate.errors || [],
      formattedErrors: this.#formatValidationErrors(validate.errors || []),
    };
  }

  /**
   * Validate operation parameters
   * @param {string} operationType - Type of operation
   * @param {Object} parameters - Operation parameters
   * @returns {ValidationResult} - Validation result
   */
  validateOperationParameters(operationType, parameters) {
    const schemaMap = {
      GET_NAME: 'get-name-operation.schema.json#',
      GET_PROPERTY: 'get-property-operation.schema.json#',
      CHECK_RELATIONSHIP: 'check-relationship-operation.schema.json#',
    };

    const schemaRef = schemaMap[operationType];
    if (!schemaRef) {
      return {
        valid: false,
        errors: [{ message: `Unknown operation type: ${operationType}` }],
        formattedErrors: [`Unknown operation type: ${operationType}`],
      };
    }

    const schema = { $ref: schemaRef };
    const validate = this.ajv.compile(schema);
    const isValid = validate(parameters);

    return {
      valid: isValid,
      errors: validate.errors || [],
      formattedErrors: this.#formatValidationErrors(validate.errors || []),
    };
  }

  /**
   * Extract required targets from payload context
   * @private
   * @param {Object} payload - Event payload
   * @returns {Array<string>} - Required placeholder names
   */
  #extractRequiredTargets(payload) {
    // This could be enhanced to read from action definition
    // For now, detect from existing data
    const required = [];

    if (payload.primaryId || payload.targets?.primary) {
      required.push('primary');
    }
    if (payload.secondaryId || payload.targets?.secondary) {
      required.push('secondary');
    }
    if (payload.tertiaryId || payload.targets?.tertiary) {
      required.push('tertiary');
    }

    return required;
  }

  /**
   * Format validation errors for human readability
   * @private
   * @param {Array} errors - AJV validation errors
   * @returns {Array<string>} - Formatted error messages
   */
  #formatValidationErrors(errors) {
    return errors.map((error) => {
      const path = error.instancePath || 'root';
      const message = error.message || 'Unknown validation error';

      if (error.keyword === 'targetConsistency') {
        return `Target consistency error at ${path}: ${message}`;
      }

      if (error.keyword === 'requiredTargets') {
        return `Required target error: ${message}`;
      }

      return `Validation error at ${path}: ${message}`;
    });
  }
}

export default MultiTargetValidationRules;
```

### 5. Schema Loading and Management

**Step 5.1**: Update schema loading system to include new schemas

```javascript
/**
 * @file schemaManager.js
 * @description Enhanced schema manager supporting multi-target schemas
 */

import MultiTargetValidationRules from './multiTargetValidationRules.js';

class EnhancedSchemaManager {
  constructor({ logger, fileSystem }) {
    this.#logger = logger;
    this.#fileSystem = fileSystem;
    this.#validationRules = new MultiTargetValidationRules();
    this.#schemas = new Map();
    this.#loadedSchemaIds = new Set();
  }

  #logger;
  #fileSystem;
  #validationRules;
  #schemas;
  #loadedSchemaIds;

  /**
   * Load all multi-target related schemas
   * @returns {Promise<void>}
   */
  async loadMultiTargetSchemas() {
    const schemaFiles = [
      'multi-target-action-event-payload.schema.json',
      'enhanced-entity-reference.schema.json',
      'get-name-operation.schema.json',
      'get-property-operation.schema.json',
      'check-relationship-operation.schema.json',
    ];

    for (const schemaFile of schemaFiles) {
      try {
        await this.#loadSchemaFile(schemaFile);
        this.#logger.debug(`Loaded multi-target schema: ${schemaFile}`);
      } catch (error) {
        this.#logger.error(`Failed to load schema ${schemaFile}`, error);
        throw new Error(`Schema loading failed: ${schemaFile}`);
      }
    }

    this.#logger.info('All multi-target schemas loaded successfully', {
      loadedSchemas: Array.from(this.#loadedSchemaIds),
    });
  }

  /**
   * Validate event payload using enhanced validation
   * @param {Object} payload - Event payload to validate
   * @param {Object} options - Validation options
   * @returns {Promise<ValidationResult>} - Validation result
   */
  async validateEventPayload(payload, options = {}) {
    try {
      // Basic schema validation
      const schemaResult = this.#validationRules.validateEventPayload(payload);

      // Additional custom validations
      const customValidations = await this.#performCustomValidations(
        payload,
        options
      );

      // Combine results
      const result = {
        valid: schemaResult.valid && customValidations.valid,
        errors: [...schemaResult.errors, ...customValidations.errors],
        formattedErrors: [
          ...schemaResult.formattedErrors,
          ...customValidations.formattedErrors,
        ],
        warnings: customValidations.warnings || [],
      };

      this.#logger.debug('Event payload validation completed', {
        valid: result.valid,
        errorCount: result.errors.length,
        warningCount: result.warnings.length,
      });

      return result;
    } catch (error) {
      this.#logger.error('Event payload validation failed', error);
      return {
        valid: false,
        errors: [{ message: `Validation system error: ${error.message}` }],
        formattedErrors: [`Validation system error: ${error.message}`],
        warnings: [],
      };
    }
  }

  /**
   * Validate entity reference
   * @param {any} entityRef - Entity reference to validate
   * @returns {ValidationResult} - Validation result
   */
  validateEntityReference(entityRef) {
    return this.#validationRules.validateEntityReference(entityRef);
  }

  /**
   * Validate operation parameters
   * @param {string} operationType - Operation type
   * @param {Object} parameters - Parameters to validate
   * @returns {ValidationResult} - Validation result
   */
  validateOperationParameters(operationType, parameters) {
    return this.#validationRules.validateOperationParameters(
      operationType,
      parameters
    );
  }

  /**
   * Get validation statistics
   * @returns {Object} - Validation statistics
   */
  getValidationStatistics() {
    return {
      loadedSchemas: this.#loadedSchemaIds.size,
      availableSchemas: Array.from(this.#loadedSchemaIds),
      validationRulesActive: true,
      customKeywordsCount: 3, // targetConsistency, requiredTargets, validEntityId
    };
  }

  // Private helper methods

  /**
   * Load individual schema file
   * @private
   * @param {string} schemaFile - Schema file name
   */
  async #loadSchemaFile(schemaFile) {
    const schemaPath = `data/schemas/${schemaFile}`;
    const schemaContent = await this.#fileSystem.readJson(schemaPath);

    // Add to AJV instance
    this.#validationRules.ajv.addSchema(schemaContent, schemaContent.$id);

    // Track loaded schemas
    this.#schemas.set(schemaContent.$id, schemaContent);
    this.#loadedSchemaIds.add(schemaContent.$id);
  }

  /**
   * Perform custom validations beyond schema validation
   * @private
   * @param {Object} payload - Event payload
   * @param {Object} options - Validation options
   * @returns {Promise<Object>} - Custom validation results
   */
  async #performCustomValidations(payload, options) {
    const result = {
      valid: true,
      errors: [],
      formattedErrors: [],
      warnings: [],
    };

    // Validate target count consistency
    if (payload.targets && payload.resolvedTargetCount !== undefined) {
      const actualCount = Object.keys(payload.targets).length;
      if (actualCount !== payload.resolvedTargetCount) {
        result.warnings.push(
          `Target count mismatch: resolvedTargetCount=${payload.resolvedTargetCount} but targets object has ${actualCount} entries`
        );
      }
    }

    // Validate context dependency consistency
    if (payload.targets && payload.hasContextDependencies !== undefined) {
      const hasContextDeps = Object.values(payload.targets).some(
        (t) => t.resolvedFromContext
      );
      if (hasContextDeps !== payload.hasContextDependencies) {
        result.warnings.push(
          `Context dependency flag mismatch: hasContextDependencies=${payload.hasContextDependencies} but actual context dependencies=${hasContextDeps}`
        );
      }
    }

    // Validate contextSource references
    if (payload.targets) {
      for (const [placeholder, targetInfo] of Object.entries(payload.targets)) {
        if (targetInfo.resolvedFromContext && targetInfo.contextSource) {
          if (!payload.targets[targetInfo.contextSource]) {
            result.errors.push({
              message: `Target ${placeholder} references context source '${targetInfo.contextSource}' which is not present in targets`,
            });
            result.formattedErrors.push(
              `Invalid context source reference: ${placeholder} → ${targetInfo.contextSource}`
            );
            result.valid = false;
          }
        }
      }
    }

    return result;
  }
}

export default EnhancedSchemaManager;
```

### 6. Integration with Existing Validation System

**Step 6.1**: Update existing AjvSchemaValidator to support multi-target schemas

```javascript
/**
 * Enhanced AjvSchemaValidator with multi-target support
 */
class EnhancedAjvSchemaValidator {
  constructor({ logger, schemaManager }) {
    this.#logger = logger;
    this.#schemaManager = schemaManager;
    this.#initialized = false;
  }

  #logger;
  #schemaManager;
  #initialized;

  /**
   * Initialize validator with multi-target schemas
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.#initialized) {
      return;
    }

    try {
      // Load existing schemas
      await this.#loadExistingSchemas();

      // Load multi-target schemas
      await this.#schemaManager.loadMultiTargetSchemas();

      this.#initialized = true;
      this.#logger.info('Enhanced schema validator initialized');
    } catch (error) {
      this.#logger.error(
        'Failed to initialize enhanced schema validator',
        error
      );
      throw error;
    }
  }

  /**
   * Validate against schema with multi-target support
   * @param {any} data - Data to validate
   * @param {string} schemaId - Schema ID
   * @param {Object} options - Validation options
   * @returns {Promise<ValidationResult>} - Validation result
   */
  async validateAgainstSchema(data, schemaId, options = {}) {
    if (!this.#initialized) {
      await this.initialize();
    }

    // Check if it's a multi-target schema
    if (this.#isMultiTargetSchema(schemaId)) {
      return await this.#validateMultiTargetData(data, schemaId, options);
    }

    // Use existing validation for non-multi-target schemas
    return await this.#validateLegacyData(data, schemaId, options);
  }

  /**
   * Validate event payload specifically
   * @param {Object} payload - Event payload
   * @param {Object} options - Validation options
   * @returns {Promise<ValidationResult>} - Validation result
   */
  async validateEventPayload(payload, options = {}) {
    if (!this.#initialized) {
      await this.initialize();
    }

    return await this.#schemaManager.validateEventPayload(payload, options);
  }

  /**
   * Validate entity reference
   * @param {any} entityRef - Entity reference
   * @returns {ValidationResult} - Validation result
   */
  validateEntityReference(entityRef) {
    if (!this.#initialized) {
      throw new Error('Schema validator not initialized');
    }

    return this.#schemaManager.validateEntityReference(entityRef);
  }

  /**
   * Get validation capabilities
   * @returns {Object} - Validation capabilities
   */
  getCapabilities() {
    return {
      multiTargetSupport: this.#initialized,
      customValidationRules: this.#initialized,
      entityReferenceValidation: this.#initialized,
      operationParameterValidation: this.#initialized,
      statistics: this.#initialized
        ? this.#schemaManager.getValidationStatistics()
        : null,
    };
  }

  // Private helper methods

  /**
   * Check if schema ID is for multi-target functionality
   * @private
   * @param {string} schemaId - Schema ID to check
   * @returns {boolean} - True if multi-target schema
   */
  #isMultiTargetSchema(schemaId) {
    const multiTargetSchemas = [
      'multi-target-action-event-payload.schema.json',
      'enhanced-entity-reference.schema.json',
      'get-name-operation.schema.json',
      'get-property-operation.schema.json',
      'check-relationship-operation.schema.json',
    ];

    return multiTargetSchemas.some((schema) => schemaId.includes(schema));
  }

  /**
   * Validate data using multi-target validation
   * @private
   * @param {any} data - Data to validate
   * @param {string} schemaId - Schema ID
   * @param {Object} options - Validation options
   * @returns {Promise<ValidationResult>} - Validation result
   */
  async #validateMultiTargetData(data, schemaId, options) {
    if (schemaId.includes('event-payload')) {
      return await this.#schemaManager.validateEventPayload(data, options);
    }

    if (schemaId.includes('entity-reference')) {
      return this.#schemaManager.validateEntityReference(data);
    }

    if (schemaId.includes('operation')) {
      const operationType = this.#extractOperationType(schemaId);
      return this.#schemaManager.validateOperationParameters(
        operationType,
        data
      );
    }

    // Fallback to basic validation
    return await this.#performBasicValidation(data, schemaId);
  }

  /**
   * Extract operation type from schema ID
   * @private
   * @param {string} schemaId - Schema ID
   * @returns {string} - Operation type
   */
  #extractOperationType(schemaId) {
    if (schemaId.includes('get-name')) return 'GET_NAME';
    if (schemaId.includes('get-property')) return 'GET_PROPERTY';
    if (schemaId.includes('check-relationship')) return 'CHECK_RELATIONSHIP';
    return 'UNKNOWN';
  }
}

export default EnhancedAjvSchemaValidator;
```

### 7. Validation Error Reporting

**Step 7.1**: Create comprehensive error reporting system

```javascript
/**
 * Enhanced validation error reporting
 */
class ValidationErrorReporter {
  /**
   * Generate comprehensive validation report
   * @param {ValidationResult} result - Validation result
   * @param {Object} context - Additional context
   * @returns {Object} - Detailed validation report
   */
  static generateReport(result, context = {}) {
    const report = {
      summary: {
        valid: result.valid,
        errorCount: result.errors?.length || 0,
        warningCount: result.warnings?.length || 0,
        timestamp: new Date().toISOString(),
        context: context.type || 'unknown',
      },
      errors: this.#categorizeErrors(result.errors || []),
      warnings: result.warnings || [],
      suggestions: this.#generateSuggestions(result),
      debugInfo: this.#extractDebugInfo(result, context),
    };

    return report;
  }

  /**
   * Format validation report for console output
   * @param {Object} report - Validation report
   * @returns {string} - Formatted report
   */
  static formatForConsole(report) {
    const lines = [];

    lines.push(`\n=== Validation Report ===`);
    lines.push(`Status: ${report.summary.valid ? '✅ VALID' : '❌ INVALID'}`);
    lines.push(`Errors: ${report.summary.errorCount}`);
    lines.push(`Warnings: ${report.summary.warningCount}`);

    if (report.errors.schema.length > 0) {
      lines.push(`\nSchema Errors:`);
      report.errors.schema.forEach((error) => {
        lines.push(`  • ${error.path}: ${error.message}`);
      });
    }

    if (report.errors.custom.length > 0) {
      lines.push(`\nCustom Validation Errors:`);
      report.errors.custom.forEach((error) => {
        lines.push(`  • ${error.message}`);
      });
    }

    if (report.warnings.length > 0) {
      lines.push(`\nWarnings:`);
      report.warnings.forEach((warning) => {
        lines.push(`  ⚠️  ${warning}`);
      });
    }

    if (report.suggestions.length > 0) {
      lines.push(`\nSuggestions:`);
      report.suggestions.forEach((suggestion) => {
        lines.push(`  💡 ${suggestion}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Generate validation suggestions based on errors
   * @private
   * @param {ValidationResult} result - Validation result
   * @returns {Array<string>} - Suggestions
   */
  static #generateSuggestions(result) {
    const suggestions = [];

    if (!result.errors) return suggestions;

    result.errors.forEach((error) => {
      if (error.keyword === 'targetConsistency') {
        suggestions.push(
          'Ensure that legacy target fields (primaryId, secondaryId) match corresponding values in targets object'
        );
      }

      if (error.keyword === 'requiredTargets') {
        suggestions.push(
          'Add missing target information to both legacy fields and targets object'
        );
      }

      if (error.keyword === 'validEntityId') {
        suggestions.push(
          'Check entity ID format - should be namespaced (mod:id), UUID, or special keyword (none, self)'
        );
      }

      if (error.message?.includes('placeholder')) {
        suggestions.push(
          'Valid placeholders are: primary, secondary, tertiary'
        );
      }
    });

    return [...new Set(suggestions)]; // Remove duplicates
  }

  /**
   * Categorize errors by type
   * @private
   * @param {Array} errors - Validation errors
   * @returns {Object} - Categorized errors
   */
  static #categorizeErrors(errors) {
    return {
      schema: errors.filter(
        (e) => !e.keyword || ['type', 'required', 'format'].includes(e.keyword)
      ),
      custom: errors.filter((e) =>
        ['targetConsistency', 'requiredTargets', 'validEntityId'].includes(
          e.keyword
        )
      ),
      reference: errors.filter((e) => e.message?.includes('entity reference')),
      other: errors.filter(
        (e) =>
          !['schema', 'custom', 'reference'].some((cat) =>
            this.#categorizeErrors(errors)[cat].includes(e)
          )
      ),
    };
  }

  /**
   * Extract debug information
   * @private
   * @param {ValidationResult} result - Validation result
   * @param {Object} context - Validation context
   * @returns {Object} - Debug information
   */
  static #extractDebugInfo(result, context) {
    return {
      validationContext: context,
      errorDetails:
        result.errors?.map((e) => ({
          keyword: e.keyword,
          schemaPath: e.schemaPath,
          params: e.params,
        })) || [],
      dataPath: result.errors?.[0]?.instancePath || null,
      schemaId: context.schemaId || null,
    };
  }
}

export default ValidationErrorReporter;
```

## Acceptance Criteria

### Schema Definition Criteria

1. ✅ **Enhanced Event Payload Schema**: Supports both legacy and comprehensive target formats
2. ✅ **Entity Reference Schema**: Recognizes placeholder names as valid entity references
3. ✅ **Operation Parameter Schemas**: Updated to support enhanced entity references
4. ✅ **Custom Validation Keywords**: targetConsistency, requiredTargets, validEntityId implemented
5. ✅ **Backward Compatibility**: Existing schemas continue to work unchanged

### Validation Logic Criteria

6. ✅ **Target Consistency Validation**: Detects mismatches between legacy and comprehensive formats
7. ✅ **Required Target Validation**: Ensures all required targets are present
8. ✅ **Entity ID Format Validation**: Validates entity ID formats (UUID, namespaced, keywords)
9. ✅ **Context Dependency Validation**: Validates context source references
10. ✅ **Operation Parameter Validation**: Validates parameters for enhanced operations

### Integration Criteria

11. ✅ **AJV Integration**: Custom keywords work seamlessly with AJV validation
12. ✅ **Schema Loading**: Enhanced schema manager loads all multi-target schemas
13. ✅ **Error Reporting**: Comprehensive error reporting with categorization and suggestions
14. ✅ **Performance**: Schema validation adds <5ms overhead to existing validation
15. ✅ **Existing System Compatibility**: Enhances existing validation without breaking changes

### Quality Criteria

16. ✅ **Comprehensive Error Messages**: Clear, actionable error messages for validation failures
17. ✅ **Warning System**: Non-critical issues reported as warnings rather than errors
18. ✅ **Debugging Support**: Detailed debug information for troubleshooting validation issues
19. ✅ **Documentation**: Schema files include comprehensive descriptions and examples
20. ✅ **Test Coverage**: All validation rules covered by comprehensive test suite

## Testing Requirements

### Unit Tests

```javascript
describe('Multi-Target Schema Validation', () => {
  let schemaManager;
  let validator;

  beforeEach(async () => {
    schemaManager = new EnhancedSchemaManager({
      logger: mockLogger,
      fileSystem: mockFileSystem,
    });
    validator = new EnhancedAjvSchemaValidator({
      logger: mockLogger,
      schemaManager,
    });
    await validator.initialize();
  });

  describe('Event Payload Validation', () => {
    it('should validate enhanced event payload structure', async () => {
      const payload = {
        actorId: 'test_actor',
        actionId: 'test:action',
        actionText: 'test action text',
        primaryId: 'entity_123',
        targets: {
          primary: {
            entityId: 'entity_123',
            placeholder: 'primary',
            description: 'Test Entity',
          },
        },
        resolvedTargetCount: 1,
        hasContextDependencies: false,
      };

      const result = await validator.validateEventPayload(payload);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect target consistency errors', async () => {
      const payload = {
        actorId: 'test_actor',
        actionId: 'test:action',
        actionText: 'test action text',
        primaryId: 'entity_123',
        targets: {
          primary: {
            entityId: 'different_entity', // Inconsistent with primaryId
            placeholder: 'primary',
          },
        },
      };

      const result = await validator.validateEventPayload(payload);

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.keyword === 'targetConsistency')).toBe(
        true
      );
    });
  });

  describe('Entity Reference Validation', () => {
    it('should validate placeholder names', () => {
      const validRefs = ['primary', 'secondary', 'tertiary'];

      validRefs.forEach((ref) => {
        const result = validator.validateEntityReference(ref);
        expect(result.valid).toBe(true);
      });
    });

    it('should validate traditional entity references', () => {
      const validRefs = [
        'actor',
        'target',
        'core:player',
        'fd6a1e00-36b7-47cc-bdb2-4b65473614eb',
        { entity_id: 'test:entity' },
      ];

      validRefs.forEach((ref) => {
        const result = validator.validateEntityReference(ref);
        expect(result.valid).toBe(true);
      });
    });

    it('should reject invalid entity references', () => {
      const invalidRefs = [
        '', // Empty string
        'invalid-placeholder',
        { invalid: 'object' },
        123, // Wrong type
      ];

      invalidRefs.forEach((ref) => {
        const result = validator.validateEntityReference(ref);
        expect(result.valid).toBe(false);
      });
    });
  });

  describe('Operation Parameter Validation', () => {
    it('should validate GET_NAME operation parameters', () => {
      const validParams = {
        entity_ref: 'primary',
        result_variable: 'primaryName',
        fallback_value: 'Unknown',
      };

      const result = validator.validateOperationParameters(
        'GET_NAME',
        validParams
      );

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing required parameters', () => {
      const invalidParams = {
        entity_ref: 'primary',
        // Missing result_variable
      };

      const result = validator.validateOperationParameters(
        'GET_NAME',
        invalidParams
      );

      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.keyword === 'required')).toBe(true);
    });
  });

  describe('Custom Validation Rules', () => {
    it('should validate context source references', async () => {
      const payload = {
        actorId: 'test_actor',
        actionId: 'test:action',
        actionText: 'test action text',
        targets: {
          primary: {
            entityId: 'entity_1',
            placeholder: 'primary',
          },
          secondary: {
            entityId: 'entity_2',
            placeholder: 'secondary',
            resolvedFromContext: true,
            contextSource: 'primary', // Valid reference
          },
        },
      };

      const result = await validator.validateEventPayload(payload);

      expect(result.valid).toBe(true);
    });

    it('should detect invalid context source references', async () => {
      const payload = {
        actorId: 'test_actor',
        actionId: 'test:action',
        actionText: 'test action text',
        targets: {
          secondary: {
            entityId: 'entity_2',
            placeholder: 'secondary',
            resolvedFromContext: true,
            contextSource: 'nonexistent', // Invalid reference
          },
        },
      };

      const result = await validator.validateEventPayload(payload);

      expect(result.valid).toBe(false);
      expect(
        result.formattedErrors.some((e) => e.includes('context source'))
      ).toBe(true);
    });
  });
});

describe('Validation Error Reporting', () => {
  it('should generate comprehensive validation reports', () => {
    const validationResult = {
      valid: false,
      errors: [
        {
          keyword: 'targetConsistency',
          message: 'Target consistency error',
          instancePath: '/targets/primary/entityId',
        },
      ],
      warnings: ['Target count mismatch warning'],
    };

    const report = ValidationErrorReporter.generateReport(validationResult, {
      type: 'event-payload',
    });

    expect(report.summary.valid).toBe(false);
    expect(report.summary.errorCount).toBe(1);
    expect(report.summary.warningCount).toBe(1);
    expect(report.suggestions.length).toBeGreaterThan(0);
  });

  it('should format reports for console output', () => {
    const report = {
      summary: { valid: false, errorCount: 1, warningCount: 1 },
      errors: {
        schema: [],
        custom: [{ message: 'Test error' }],
        reference: [],
        other: [],
      },
      warnings: ['Test warning'],
      suggestions: ['Test suggestion'],
    };

    const formatted = ValidationErrorReporter.formatForConsole(report);

    expect(formatted).toContain('❌ INVALID');
    expect(formatted).toContain('Test error');
    expect(formatted).toContain('Test warning');
    expect(formatted).toContain('Test suggestion');
  });
});
```

### Integration Tests

```javascript
describe('Schema Validation Integration', () => {
  it('should integrate with existing event validation system', async () => {
    const testBed = new EventValidationTestBed();
    const validator = testBed.createEnhancedValidator();

    const event = testBed.createMultiTargetEvent({
      actionId: 'intimacy:adjust_clothing',
      targets: {
        primary: { entityId: 'iker_id', placeholder: 'primary' },
        secondary: { entityId: 'jacket_id', placeholder: 'secondary' },
      },
    });

    const result = await validator.validateEventPayload(event.payload);

    expect(result.valid).toBe(true);
  });

  it('should validate adjust_clothing action payload', async () => {
    const testBed = new ActionTestBed();
    const { amaia, iker, jacket } = await testBed.setupIntimacyScenario();

    const payload = {
      actorId: amaia.id,
      actionId: 'intimacy:adjust_clothing',
      actionText: "adjust Iker Aguirre's denim trucker jacket",
      primaryId: iker.id,
      secondaryId: jacket.id,
      targets: {
        primary: {
          entityId: iker.id,
          placeholder: 'primary',
          description: 'Iker Aguirre',
        },
        secondary: {
          entityId: jacket.id,
          placeholder: 'secondary',
          description: 'denim trucker jacket',
          resolvedFromContext: true,
          contextSource: 'primary',
        },
      },
      resolvedTargetCount: 2,
      hasContextDependencies: true,
    };

    const validator = new EnhancedAjvSchemaValidator(testBed.dependencies);
    await validator.initialize();

    const result = await validator.validateEventPayload(payload);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});
```

## Performance Benchmarks

- Schema loading: <50ms for all multi-target schemas
- Event payload validation: <5ms for typical payloads
- Entity reference validation: <1ms per reference
- Custom validation rules: <2ms additional overhead
- Error report generation: <3ms for typical error sets

## Dependencies and Prerequisites

### System Dependencies

- Existing AJV schema validation system
- JSON schema files in `data/schemas/` directory
- Event system for payload validation
- Operation parameter validation system

### Testing Dependencies

- Jest testing framework
- Mock file system for schema loading
- Test bed classes for integration testing

## Notes and Considerations

### Implementation Order

1. **Phase 1**: Core schema definitions (event payload, entity reference)
2. **Phase 2**: Operation parameter schemas
3. **Phase 3**: Custom validation rules and keywords
4. **Phase 4**: Enhanced schema manager and validation system
5. **Phase 5**: Error reporting and debugging tools
6. **Phase 6**: Integration with existing systems
7. **Phase 7**: Comprehensive testing and validation

### Risk Mitigation

- **Backward Compatibility**: All existing schemas continue to work unchanged
- **Performance Impact**: Custom validation rules optimized for minimal overhead
- **Error Handling**: Graceful degradation when validation fails
- **Schema Evolution**: Versioned schemas support future enhancements

### Future Enhancements

- Schema versioning and migration system
- Real-time schema validation in development mode
- Performance profiling and optimization tools
- Dynamic schema generation based on action definitions
- Integration with IDE/editor for real-time validation feedback
- Custom validation rules for specific game mechanics

This comprehensive schema and validation update ensures data integrity throughout the enhanced multi-target action system while maintaining compatibility with existing functionality.
