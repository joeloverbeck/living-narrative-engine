# Recipe Validation Refactoring Recommendations

**Date:** 2025-01-14
**Related:** `recipe-validation-architecture-analysis.md`
**Goal:** Transform patchwork architecture into robust, flexible, and maintainable validation system

---

## Executive Summary

This document provides actionable recommendations for refactoring the recipe validation system from its current monolithic patchwork architecture to a robust, extensible, and maintainable design. The refactoring is organized into **4 implementation phases** that can be executed incrementally while maintaining backward compatibility.

### Recommended Architecture

```
┌─────────────────────────────────────────────────────┐
│         Validation Pipeline Orchestrator            │
│  (Chain of Responsibility + Strategy Pattern)       │
├─────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │  Validator   │  │  Validator   │  │ Validator│ │
│  │  Plugin 1    │→ │  Plugin 2    │→ │ Plugin N │ │
│  └──────────────┘  └──────────────┘  └──────────┘ │
├─────────────────────────────────────────────────────┤
│              Validation Context                     │
│  (Shared state, configuration, dependencies)        │
├─────────────────────────────────────────────────────┤
│  ┌────────────┐  ┌────────────┐  ┌──────────────┐ │
│  │  Config    │  │    DI      │  │   Result     │ │
│  │  Manager   │  │  Container │  │   Aggregator │ │
│  └────────────┘  └────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Key Benefits

| Improvement               | Current          | Target              | Impact                     |
| ------------------------- | ---------------- | ------------------- | -------------------------- |
| **File Size**             | 1,207 lines      | <500 per file       | ✅ Guideline compliance    |
| **Test Coverage**         | 0% unit tests    | 80%+ coverage       | ✅ Regression prevention   |
| **Extensibility**         | Closed system    | Plugin architecture | ✅ Mod-specific validators |
| **Configuration**         | Hardcoded        | JSON config         | ✅ Environment flexibility |
| **Code Duplication**      | 5 instances      | 0 instances         | ✅ DRY compliance          |
| **Validation Complexity** | 128 flag configs | Linear pipeline     | ✅ Simplified testing      |

---

## Refactoring Phases

### Phase 1: Foundation & Interfaces (Week 1-2)

**Goal:** Establish core abstractions without breaking existing system

#### 1.1 Create Validator Interface

**File:** `src/anatomy/validation/interfaces/IValidator.js`

```javascript
/**
 * @file Core validator interface for recipe validation pipeline
 * @interface
 */

/**
 * Validation severity levels
 * @typedef {'error' | 'warning' | 'info'} ValidationSeverity
 */

/**
 * Validation issue
 * @typedef {Object} ValidationIssue
 * @property {string} type - Issue type identifier
 * @property {ValidationSeverity} severity - Issue severity
 * @property {string} message - Human-readable message
 * @property {Object} [metadata] - Additional context
 */

/**
 * Validation result
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Overall validation status
 * @property {ValidationIssue[]} issues - All validation issues
 * @property {Object} [metadata] - Additional result data
 */

/**
 * Validator interface
 * @interface IValidator
 */
export class IValidator {
  /**
   * Validator name (unique identifier)
   * @type {string}
   */
  get name() {
    throw new Error('Not implemented');
  }

  /**
   * Validator priority (lower = runs first)
   * @type {number}
   */
  get priority() {
    throw new Error('Not implemented');
  }

  /**
   * Whether this validator should stop pipeline on failure
   * @type {boolean}
   */
  get failFast() {
    return false;
  }

  /**
   * Validate recipe
   * @param {Object} recipe - Recipe to validate
   * @param {Object} context - Validation context
   * @returns {Promise<ValidationResult>}
   */
  async validate(recipe, context) {
    throw new Error('Not implemented');
  }
}
```

#### 1.2 Create Validation Context

**File:** `src/anatomy/validation/core/ValidationContext.js`

```javascript
/**
 * @file Validation context for dependency injection and state sharing
 */

import { assertPresent } from '../../../utils/dependencyUtils.js';

/**
 * Immutable validation context
 */
export class ValidationContext {
  #dataRegistry;
  #schemaValidator;
  #blueprintProcessor;
  #logger;
  #config;
  #metadata;

  constructor({
    dataRegistry,
    schemaValidator,
    blueprintProcessor,
    logger,
    config = {},
  }) {
    assertPresent(dataRegistry, 'dataRegistry is required');
    assertPresent(schemaValidator, 'schemaValidator is required');
    assertPresent(blueprintProcessor, 'blueprintProcessor is required');
    assertPresent(logger, 'logger is required');

    this.#dataRegistry = dataRegistry;
    this.#schemaValidator = schemaValidator;
    this.#blueprintProcessor = blueprintProcessor;
    this.#logger = logger;
    this.#config = Object.freeze({ ...config });
    this.#metadata = new Map();
  }

  // Getters for immutable access
  get dataRegistry() {
    return this.#dataRegistry;
  }

  get schemaValidator() {
    return this.#schemaValidator;
  }

  get blueprintProcessor() {
    return this.#blueprintProcessor;
  }

  get logger() {
    return this.#logger;
  }

  get config() {
    return this.#config;
  }

  // Metadata management (for validator state sharing)
  setMetadata(key, value) {
    this.#metadata.set(key, value);
  }

  getMetadata(key) {
    return this.#metadata.get(key);
  }

  hasMetadata(key) {
    return this.#metadata.has(key);
  }

  // Create derived context with updated config
  withConfig(updates) {
    return new ValidationContext({
      dataRegistry: this.#dataRegistry,
      schemaValidator: this.#schemaValidator,
      blueprintProcessor: this.#blueprintProcessor,
      logger: this.#logger,
      config: { ...this.#config, ...updates },
    });
  }
}
```

#### 1.3 Create Configuration Schema

**File:** `data/schemas/validation-config.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "id": "schema://living-narrative-engine/validation-config.schema.json",
  "title": "Recipe Validation Configuration",
  "description": "Configuration schema for recipe validation system",
  "type": "object",
  "properties": {
    "mods": {
      "type": "object",
      "properties": {
        "essential": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Always-loaded mods for validation"
        },
        "optional": {
          "type": "array",
          "items": { "type": "string" },
          "description": "Optionally-loaded mods"
        },
        "autoDetect": {
          "type": "boolean",
          "description": "Auto-detect recipe's mod from path"
        }
      },
      "required": ["essential", "autoDetect"]
    },
    "validators": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "Validator identifier"
          },
          "enabled": {
            "type": "boolean",
            "description": "Whether validator is enabled"
          },
          "priority": {
            "type": "integer",
            "description": "Execution priority (lower = first)"
          },
          "failFast": {
            "type": "boolean",
            "description": "Stop pipeline on validator failure"
          },
          "config": {
            "type": "object",
            "description": "Validator-specific configuration"
          }
        },
        "required": ["name", "enabled", "priority"]
      }
    },
    "errorHandling": {
      "type": "object",
      "properties": {
        "defaultSeverity": {
          "type": "string",
          "enum": ["error", "warning", "info"]
        },
        "severityOverrides": {
          "type": "object",
          "additionalProperties": {
            "type": "string",
            "enum": ["error", "warning", "info"]
          }
        },
        "continueOnError": {
          "type": "boolean",
          "description": "Continue validation after errors"
        }
      }
    },
    "output": {
      "type": "object",
      "properties": {
        "format": {
          "type": "string",
          "enum": ["text", "json", "junit"]
        },
        "verbose": {
          "type": "boolean"
        },
        "colorize": {
          "type": "boolean"
        }
      }
    }
  },
  "required": ["mods", "validators"]
}
```

#### 1.4 Create Default Configuration

**File:** `config/validation-config.json`

```json
{
  "mods": {
    "essential": ["core", "descriptors", "anatomy"],
    "optional": [],
    "autoDetect": true
  },
  "validators": [
    {
      "name": "component_existence",
      "enabled": true,
      "priority": 0,
      "failFast": true
    },
    {
      "name": "property_schemas",
      "enabled": true,
      "priority": 1,
      "failFast": true
    },
    {
      "name": "body_descriptors",
      "enabled": true,
      "priority": 2,
      "failFast": true
    },
    {
      "name": "blueprint_exists",
      "enabled": true,
      "priority": 3,
      "failFast": true
    },
    {
      "name": "socket_slot_compatibility",
      "enabled": true,
      "priority": 4,
      "failFast": false
    },
    {
      "name": "pattern_matching",
      "enabled": true,
      "priority": 5,
      "failFast": false,
      "config": {
        "skipIfDisabled": true
      }
    },
    {
      "name": "descriptor_coverage",
      "enabled": true,
      "priority": 6,
      "failFast": false
    },
    {
      "name": "part_availability",
      "enabled": true,
      "priority": 7,
      "failFast": false
    },
    {
      "name": "generated_slot_parts",
      "enabled": true,
      "priority": 8,
      "failFast": false
    },
    {
      "name": "load_failures",
      "enabled": true,
      "priority": 9,
      "failFast": false
    },
    {
      "name": "recipe_usage",
      "enabled": true,
      "priority": 10,
      "failFast": false
    }
  ],
  "errorHandling": {
    "defaultSeverity": "error",
    "severityOverrides": {
      "socket_slot_compatibility": "warning",
      "descriptor_coverage": "info",
      "recipe_usage": "info"
    },
    "continueOnError": true
  },
  "output": {
    "format": "text",
    "verbose": false,
    "colorize": true
  }
}
```

**Phase 1 Deliverables:**

- ✅ `IValidator` interface
- ✅ `ValidationContext` class
- ✅ Configuration schema + default config
- ✅ Zero breaking changes to existing code

---

### Phase 2: Shared Services & Utilities (Week 3-4)

**Goal:** Eliminate code duplication and create reusable components

#### 2.1 String Utility Service

**File:** `src/utils/stringUtils.js`

```javascript
/**
 * @file String manipulation utilities
 */

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number} Edit distance
 */
export function levenshteinDistance(a, b) {
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Find closest match from list of candidates
 * @param {string} target - Target string
 * @param {string[]} candidates - Candidate strings
 * @param {number} maxDistance - Maximum edit distance
 * @returns {string[]} Sorted matches within max distance
 */
export function findClosestMatches(target, candidates, maxDistance = 3) {
  const matches = candidates
    .map((candidate) => ({
      value: candidate,
      distance: levenshteinDistance(target, candidate),
    }))
    .filter(({ distance }) => distance <= maxDistance)
    .sort((a, b) => a.distance - b.distance)
    .map(({ value }) => value);

  return matches;
}
```

**Migration:** Replace all 3 duplicated implementations with this utility

#### 2.2 Entity Matcher Service

**File:** `src/anatomy/services/entityMatcherService.js`

```javascript
/**
 * @file Entity matching service for validation
 */

import { assertPresent } from '../../utils/dependencyUtils.js';

/**
 * Matches entity definitions against criteria
 */
export class EntityMatcherService {
  #dataRegistry;
  #logger;

  constructor({ dataRegistry, logger }) {
    assertPresent(dataRegistry, 'dataRegistry is required');
    assertPresent(logger, 'logger is required');

    this.#dataRegistry = dataRegistry;
    this.#logger = logger;
  }

  /**
   * Find entities matching criteria
   * @param {Object} criteria - Match criteria
   * @param {string} [criteria.partType] - Required part type
   * @param {string[]} [criteria.allowedTypes] - Allowed part types
   * @param {string[]} [criteria.tags] - Required tags (all must match)
   * @param {Object} [criteria.properties] - Required property values
   * @returns {string[]} Matching entity IDs
   */
  findMatchingEntities(criteria) {
    const {
      partType,
      allowedTypes = [],
      tags = [],
      properties = {},
    } = criteria;

    const allEntityDefs = this.#dataRegistry.getAll('entities');
    const matches = [];

    for (const entityDef of allEntityDefs) {
      if (
        this.#matchesEntity(entityDef, {
          partType,
          allowedTypes,
          tags,
          properties,
        })
      ) {
        matches.push(entityDef.id);
      }
    }

    this.#logger.debug(
      `EntityMatcher: Found ${matches.length} matches for criteria`,
      { criteria, matches }
    );

    return matches;
  }

  #matchesEntity(entityDef, criteria) {
    const anatomyPart = entityDef.components?.['anatomy:part'];
    if (!anatomyPart) {
      return false;
    }

    // Check part type
    if (criteria.partType && anatomyPart.subType !== criteria.partType) {
      return false;
    }

    // Check allowed types
    if (criteria.allowedTypes.length > 0) {
      if (!criteria.allowedTypes.includes(anatomyPart.subType)) {
        return false;
      }
    }

    // Check all required tags
    const entityTags = anatomyPart.tags || [];
    const hasAllTags = criteria.tags.every((tag) => entityTags.includes(tag));
    if (!hasAllTags) {
      return false;
    }

    // Check property values
    for (const [propKey, expectedValue] of Object.entries(
      criteria.properties
    )) {
      if (anatomyPart.properties?.[propKey] !== expectedValue) {
        return false;
      }
    }

    return true;
  }
}
```

**Migration:** Replace 2 duplicated implementations in `RecipePreflightValidator`

#### 2.3 Blueprint Processor Service

**File:** `src/anatomy/services/blueprintProcessorService.js`

```javascript
/**
 * @file Blueprint processing service
 */

import {
  assertPresent,
  assertNonBlankString,
} from '../../utils/dependencyUtils.js';

/**
 * Processes blueprints (V1 and V2 formats)
 */
export class BlueprintProcessorService {
  #dataRegistry;
  #slotGenerator;
  #logger;

  constructor({ dataRegistry, slotGenerator, logger }) {
    assertPresent(dataRegistry, 'dataRegistry is required');
    assertPresent(slotGenerator, 'slotGenerator is required');
    assertPresent(logger, 'logger is required');

    this.#dataRegistry = dataRegistry;
    this.#slotGenerator = slotGenerator;
    this.#logger = logger;
  }

  /**
   * Process blueprint (handles V1 and V2 formats)
   * @param {Object} rawBlueprint - Raw blueprint definition
   * @returns {Object} Processed blueprint with resolved slots
   */
  processBlueprint(rawBlueprint) {
    assertPresent(rawBlueprint, 'rawBlueprint is required');
    assertNonBlankString(
      rawBlueprint.id,
      'blueprint.id',
      'processBlueprint',
      this.#logger
    );

    // V1 blueprint (already has slots)
    if (!rawBlueprint.structureTemplate) {
      return this.#processV1Blueprint(rawBlueprint);
    }

    // V2 blueprint (needs slot generation)
    return this.#processV2Blueprint(rawBlueprint);
  }

  /**
   * Check if blueprint is already processed
   * @param {Object} blueprint - Blueprint to check
   * @returns {boolean} True if processed
   */
  isProcessed(blueprint) {
    return blueprint.slots !== undefined;
  }

  #processV1Blueprint(blueprint) {
    this.#logger.debug(`Processing V1 blueprint: ${blueprint.id}`);
    return {
      ...blueprint,
      version: 'v1',
    };
  }

  #processV2Blueprint(blueprint) {
    this.#logger.debug(`Processing V2 blueprint: ${blueprint.id}`);

    const template = this.#dataRegistry.get(
      'anatomyStructureTemplates',
      blueprint.structureTemplate
    );

    if (!template) {
      throw new Error(
        `Structure template not found: ${blueprint.structureTemplate} for blueprint ${blueprint.id}`
      );
    }

    // Generate slots from structure template
    const generatedSlots = this.#slotGenerator.generateBlueprintSlots(template);

    // Merge with additionalSlots
    const additionalSlots = blueprint.additionalSlots || {};
    const mergedSlots = {
      ...generatedSlots,
      ...additionalSlots,
    };

    return {
      ...blueprint,
      slots: mergedSlots,
      version: 'v2',
      _originalStructureTemplate: blueprint.structureTemplate,
    };
  }
}
```

**Migration:** Replace inline blueprint processing in `RecipePreflightValidator`

#### 2.4 Validation Result Builder

**File:** `src/anatomy/validation/core/ValidationResultBuilder.js`

```javascript
/**
 * @file Fluent builder for validation results
 */

/**
 * Fluent builder for validation results
 */
export class ValidationResultBuilder {
  #issues = [];
  #metadata = {};

  /**
   * Add error issue
   * @param {string} type - Error type
   * @param {string} message - Error message
   * @param {Object} [metadata] - Additional context
   * @returns {ValidationResultBuilder} This builder
   */
  addError(type, message, metadata = {}) {
    this.#issues.push({
      type,
      severity: 'error',
      message,
      metadata,
    });
    return this;
  }

  /**
   * Add warning issue
   * @param {string} type - Warning type
   * @param {string} message - Warning message
   * @param {Object} [metadata] - Additional context
   * @returns {ValidationResultBuilder} This builder
   */
  addWarning(type, message, metadata = {}) {
    this.#issues.push({
      type,
      severity: 'warning',
      message,
      metadata,
    });
    return this;
  }

  /**
   * Add info issue
   * @param {string} type - Info type
   * @param {string} message - Info message
   * @param {Object} [metadata] - Additional context
   * @returns {ValidationResultBuilder} This builder
   */
  addInfo(type, message, metadata = {}) {
    this.#issues.push({
      type,
      severity: 'info',
      message,
      metadata,
    });
    return this;
  }

  /**
   * Add multiple issues
   * @param {Array} issues - Issues to add
   * @returns {ValidationResultBuilder} This builder
   */
  addIssues(issues) {
    this.#issues.push(...issues);
    return this;
  }

  /**
   * Set result metadata
   * @param {string} key - Metadata key
   * @param {*} value - Metadata value
   * @returns {ValidationResultBuilder} This builder
   */
  setMetadata(key, value) {
    this.#metadata[key] = value;
    return this;
  }

  /**
   * Build final result
   * @returns {Object} Validation result
   */
  build() {
    const errors = this.#issues.filter((i) => i.severity === 'error');

    return {
      isValid: errors.length === 0,
      issues: [...this.#issues],
      metadata: { ...this.#metadata },
    };
  }

  /**
   * Create success result
   * @param {Object} [metadata] - Optional metadata
   * @returns {Object} Success result
   */
  static success(metadata = {}) {
    return new ValidationResultBuilder().setMetadata('success', true).build();
  }
}
```

**Phase 2 Deliverables:**

- ✅ String utilities (eliminates 3 duplications)
- ✅ Entity matcher service (eliminates 2 duplications)
- ✅ Blueprint processor service (eliminates 1 duplication)
- ✅ Validation result builder (standardizes result creation)

---

### Phase 3: Validator Implementations (Week 5-7)

**Goal:** Refactor inline validation methods to standalone validators

#### 3.1 Base Validator Class

**File:** `src/anatomy/validation/validators/BaseValidator.js`

```javascript
/**
 * @file Base validator implementation
 */

import { IValidator } from '../interfaces/IValidator.js';
import { ValidationResultBuilder } from '../core/ValidationResultBuilder.js';
import { assertNonBlankString } from '../../../utils/dependencyUtils.js';

/**
 * Base validator with common functionality
 */
export class BaseValidator extends IValidator {
  #name;
  #priority;
  #failFast;
  #logger;

  constructor({ name, priority, failFast = false, logger }) {
    super();
    assertNonBlankString(name, 'name', 'BaseValidator constructor', logger);

    this.#name = name;
    this.#priority = priority;
    this.#failFast = failFast;
    this.#logger = logger;
  }

  get name() {
    return this.#name;
  }

  get priority() {
    return this.#priority;
  }

  get failFast() {
    return this.#failFast;
  }

  /**
   * Template method for validation
   * @param {Object} recipe - Recipe to validate
   * @param {Object} context - Validation context
   * @returns {Promise<Object>} Validation result
   */
  async validate(recipe, context) {
    const builder = new ValidationResultBuilder();

    try {
      this.#logger.debug(`Running validator: ${this.#name}`);
      await this.performValidation(recipe, context, builder);
      return builder.build();
    } catch (error) {
      this.#logger.error(`Validator ${this.#name} threw exception`, error);
      return builder
        .addError(
          'VALIDATOR_EXCEPTION',
          `Validator ${this.#name} failed: ${error.message}`,
          { error: error.message, stack: error.stack }
        )
        .build();
    }
  }

  /**
   * Perform actual validation (to be implemented by subclasses)
   * @param {Object} recipe - Recipe to validate
   * @param {Object} context - Validation context
   * @param {ValidationResultBuilder} builder - Result builder
   * @returns {Promise<void>}
   * @abstract
   */
  async performValidation(recipe, context, builder) {
    throw new Error(
      `performValidation not implemented in ${this.constructor.name}`
    );
  }
}
```

#### 3.2 Example: Body Descriptor Validator

**File:** `src/anatomy/validation/validators/BodyDescriptorValidator.js`

```javascript
/**
 * @file Body descriptor validator
 */

import { BaseValidator } from './BaseValidator.js';

/**
 * Validates body descriptors against anatomy:body schema
 */
export class BodyDescriptorValidator extends BaseValidator {
  constructor({ logger }) {
    super({
      name: 'body_descriptors',
      priority: 2,
      failFast: true,
      logger,
    });
  }

  async performValidation(recipe, context, builder) {
    const bodyDescriptors = recipe.body?.descriptors || {};

    // Get anatomy:body component schema
    const bodyComponent = context.dataRegistry.get(
      'components',
      'anatomy:body'
    );
    if (!bodyComponent) {
      builder.addError(
        'COMPONENT_NOT_FOUND',
        'anatomy:body component not found in registry'
      );
      return;
    }

    // Extract descriptors schema
    const descriptorsSchema =
      bodyComponent.dataSchema?.properties?.body?.properties?.descriptors;

    if (!descriptorsSchema?.properties) {
      builder.addError(
        'SCHEMA_NOT_FOUND',
        'Descriptors schema not found in anatomy:body component'
      );
      return;
    }

    // Validate using AJV (proper schema validation)
    const valid = context.schemaValidator.validate(
      descriptorsSchema,
      bodyDescriptors
    );

    if (!valid) {
      const errors = context.schemaValidator.getErrors();
      errors.forEach((err) => {
        builder.addError('DESCRIPTOR_SCHEMA_VIOLATION', err.message, {
          dataPath: err.dataPath,
          schemaPath: err.schemaPath,
        });
      });
    }
  }
}
```

#### 3.3 Validator Registry

**File:** `src/anatomy/validation/core/ValidatorRegistry.js`

```javascript
/**
 * @file Validator registry for plugin management
 */

import { assertPresent } from '../../../utils/dependencyUtils.js';

/**
 * Registry for validation plugins
 */
export class ValidatorRegistry {
  #validators = new Map();
  #logger;

  constructor({ logger }) {
    assertPresent(logger, 'logger is required');
    this.#logger = logger;
  }

  /**
   * Register validator
   * @param {IValidator} validator - Validator instance
   */
  register(validator) {
    if (!validator || typeof validator.validate !== 'function') {
      throw new Error('Invalid validator: must implement validate() method');
    }

    if (this.#validators.has(validator.name)) {
      this.#logger.warn(
        `Validator ${validator.name} already registered, overwriting`
      );
    }

    this.#validators.set(validator.name, validator);
    this.#logger.debug(`Registered validator: ${validator.name}`);
  }

  /**
   * Get validator by name
   * @param {string} name - Validator name
   * @returns {IValidator|undefined} Validator instance
   */
  get(name) {
    return this.#validators.get(name);
  }

  /**
   * Get all validators sorted by priority
   * @returns {IValidator[]} Sorted validators
   */
  getAll() {
    return Array.from(this.#validators.values()).sort(
      (a, b) => a.priority - b.priority
    );
  }

  /**
   * Check if validator exists
   * @param {string} name - Validator name
   * @returns {boolean} True if exists
   */
  has(name) {
    return this.#validators.has(name);
  }

  /**
   * Unregister validator
   * @param {string} name - Validator name
   * @returns {boolean} True if removed
   */
  unregister(name) {
    const removed = this.#validators.delete(name);
    if (removed) {
      this.#logger.debug(`Unregistered validator: ${name}`);
    }
    return removed;
  }

  /**
   * Clear all validators
   */
  clear() {
    this.#validators.clear();
    this.#logger.debug('Cleared all validators');
  }
}
```

**Phase 3 Tasks:**

1. Create `BaseValidator` class
2. Refactor 11 validation checks to standalone validators:
   - ✅ Component Existence (already exists as rule)
   - ✅ Property Schemas (already exists as rule)
   - 🔄 Body Descriptors → `BodyDescriptorValidator`
   - 🔄 Blueprint Exists → `BlueprintExistenceValidator`
   - 🔄 Socket/Slot Compatibility → `SocketSlotCompatibilityValidator`
   - 🔄 Pattern Matching → `PatternMatchingValidator`
   - 🔄 Descriptor Coverage → `DescriptorCoverageValidator`
   - 🔄 Part Availability → `PartAvailabilityValidator`
   - 🔄 Generated Slot Parts → `GeneratedSlotPartsValidator`
   - 🔄 Load Failures → `LoadFailureValidator`
   - 🔄 Recipe Usage → `RecipeUsageValidator`
3. Create `ValidatorRegistry` for plugin management
4. Write comprehensive unit tests for each validator

---

### Phase 4: Pipeline Orchestration (Week 8-10)

**Goal:** Replace monolithic orchestrator with configurable pipeline

#### 4.1 Validation Pipeline

**File:** `src/anatomy/validation/core/ValidationPipeline.js`

```javascript
/**
 * @file Validation pipeline orchestrator
 */

import { assertPresent } from '../../../utils/dependencyUtils.js';
import { ValidationResultBuilder } from './ValidationResultBuilder.js';

/**
 * Orchestrates validation pipeline
 */
export class ValidationPipeline {
  #registry;
  #logger;
  #config;

  constructor({ registry, logger, config }) {
    assertPresent(registry, 'registry is required');
    assertPresent(logger, 'logger is required');
    assertPresent(config, 'config is required');

    this.#registry = registry;
    this.#logger = logger;
    this.#config = config;
  }

  /**
   * Execute validation pipeline
   * @param {Object} recipe - Recipe to validate
   * @param {Object} context - Validation context
   * @returns {Promise<Object>} Aggregated validation results
   */
  async execute(recipe, context) {
    const results = {
      passed: [],
      errors: [],
      warnings: [],
      info: [],
    };

    const validators = this.#getEnabledValidators();

    this.#logger.info(
      `Starting validation pipeline with ${validators.length} validators`
    );

    for (const validator of validators) {
      const validatorConfig = this.#getValidatorConfig(validator.name);

      if (!validatorConfig.enabled) {
        this.#logger.debug(`Skipping disabled validator: ${validator.name}`);
        continue;
      }

      try {
        const result = await validator.validate(recipe, context);

        this.#aggregateResult(validator.name, result, results);

        // Check fail-fast
        if (validator.failFast && !result.isValid) {
          this.#logger.warn(
            `Validator ${validator.name} failed with fail-fast enabled, stopping pipeline`
          );
          break;
        }
      } catch (error) {
        this.#logger.error(
          `Validator ${validator.name} threw exception`,
          error
        );
        results.errors.push({
          type: 'VALIDATOR_EXCEPTION',
          validator: validator.name,
          message: `Validator exception: ${error.message}`,
        });

        if (validator.failFast) {
          break;
        }
      }
    }

    this.#logger.info(
      `Validation complete: ${results.passed.length} passed, ${results.errors.length} errors, ${results.warnings.length} warnings`
    );

    return results;
  }

  #getEnabledValidators() {
    return this.#registry.getAll().filter((v) => {
      const config = this.#getValidatorConfig(v.name);
      return config.enabled !== false;
    });
  }

  #getValidatorConfig(name) {
    const validatorConfigs = this.#config.validators || [];
    return (
      validatorConfigs.find((c) => c.name === name) || {
        enabled: true,
        failFast: false,
      }
    );
  }

  #aggregateResult(validatorName, result, accumulator) {
    if (result.isValid) {
      accumulator.passed.push({
        validator: validatorName,
        message: `Validator ${validatorName} passed`,
      });
    }

    // Categorize issues by severity
    for (const issue of result.issues) {
      const severityOverride =
        this.#config.errorHandling?.severityOverrides?.[validatorName];
      const severity = severityOverride || issue.severity;

      const enhancedIssue = {
        ...issue,
        validator: validatorName,
        severity,
      };

      if (severity === 'error') {
        accumulator.errors.push(enhancedIssue);
      } else if (severity === 'warning') {
        accumulator.warnings.push(enhancedIssue);
      } else {
        accumulator.info.push(enhancedIssue);
      }
    }
  }
}
```

#### 4.2 Configuration Loader

**File:** `src/anatomy/validation/core/ConfigurationLoader.js`

```javascript
/**
 * @file Validation configuration loader
 */

import fs from 'fs/promises';
import path from 'path';
import {
  assertPresent,
  assertNonBlankString,
} from '../../../utils/dependencyUtils.js';

/**
 * Loads and validates configuration
 */
export class ConfigurationLoader {
  #schemaValidator;
  #logger;
  #defaultConfigPath;

  constructor({ schemaValidator, logger, defaultConfigPath }) {
    assertPresent(schemaValidator, 'schemaValidator is required');
    assertPresent(logger, 'logger is required');
    assertNonBlankString(
      defaultConfigPath,
      'defaultConfigPath',
      'ConfigurationLoader constructor',
      logger
    );

    this.#schemaValidator = schemaValidator;
    this.#logger = logger;
    this.#defaultConfigPath = defaultConfigPath;
  }

  /**
   * Load configuration from file
   * @param {string} [configPath] - Optional config path, uses default if not provided
   * @returns {Promise<Object>} Validated configuration
   */
  async load(configPath) {
    const targetPath = configPath || this.#defaultConfigPath;

    this.#logger.debug(`Loading validation config from: ${targetPath}`);

    try {
      const content = await fs.readFile(targetPath, 'utf-8');
      const config = JSON.parse(content);

      // Validate against schema
      const valid = this.#schemaValidator.validate(
        'schema://living-narrative-engine/validation-config.schema.json',
        config
      );

      if (!valid) {
        const errors = this.#schemaValidator.getErrors();
        throw new Error(
          `Invalid configuration: ${JSON.stringify(errors, null, 2)}`
        );
      }

      this.#logger.info(`Loaded validation configuration: ${targetPath}`);
      return config;
    } catch (error) {
      this.#logger.error(
        `Failed to load configuration from ${targetPath}`,
        error
      );
      throw error;
    }
  }

  /**
   * Merge configurations (user config overrides default)
   * @param {Object} defaultConfig - Default configuration
   * @param {Object} userConfig - User configuration
   * @returns {Object} Merged configuration
   */
  merge(defaultConfig, userConfig) {
    return {
      ...defaultConfig,
      ...userConfig,
      mods: {
        ...defaultConfig.mods,
        ...userConfig.mods,
      },
      errorHandling: {
        ...defaultConfig.errorHandling,
        ...userConfig.errorHandling,
        severityOverrides: {
          ...defaultConfig.errorHandling?.severityOverrides,
          ...userConfig.errorHandling?.severityOverrides,
        },
      },
      validators: this.#mergeValidators(
        defaultConfig.validators || [],
        userConfig.validators || []
      ),
    };
  }

  #mergeValidators(defaultValidators, userValidators) {
    const merged = new Map();

    // Add all default validators
    for (const validator of defaultValidators) {
      merged.set(validator.name, { ...validator });
    }

    // Override with user validators
    for (const validator of userValidators) {
      if (merged.has(validator.name)) {
        merged.set(validator.name, {
          ...merged.get(validator.name),
          ...validator,
        });
      } else {
        merged.set(validator.name, { ...validator });
      }
    }

    return Array.from(merged.values()).sort((a, b) => a.priority - b.priority);
  }
}
```

#### 4.3 Updated CLI Entry Point

**File:** `scripts/validate-recipe-v2.js` (new implementation)

```javascript
#!/usr/bin/env node

/**
 * @file Recipe validation CLI (refactored version)
 */

import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';

import { createContainer } from '../src/dependencyInjection/minimalContainerConfig.js';
import { ConfigurationLoader } from '../src/anatomy/validation/core/ConfigurationLoader.js';
import { ValidationContext } from '../src/anatomy/validation/core/ValidationContext.js';
import { ValidationPipeline } from '../src/anatomy/validation/core/ValidationPipeline.js';
import { ValidatorRegistry } from '../src/anatomy/validation/core/ValidatorRegistry.js';

// Import all validators
import { ComponentExistenceValidator } from '../src/anatomy/validation/validators/ComponentExistenceValidator.js';
import { PropertySchemasValidator } from '../src/anatomy/validation/validators/PropertySchemasValidator.js';
import { BodyDescriptorValidator } from '../src/anatomy/validation/validators/BodyDescriptorValidator.js';
// ... import remaining validators

const program = new Command();

program
  .name('validate-recipe')
  .description('Validate anatomy recipe files')
  .argument('<recipe-path>', 'Path to recipe file')
  .option('-v, --verbose', 'Verbose output')
  .option('-c, --config <path>', 'Custom configuration file')
  .option('--fail-fast', 'Stop on first error')
  .action(async (recipePath, options) => {
    try {
      const container = createContainer();
      const logger = container.resolve('ILogger');

      // Load configuration
      const configLoader = new ConfigurationLoader({
        schemaValidator: container.resolve('IAJVSchemaValidator'),
        logger,
        defaultConfigPath: path.join(
          process.cwd(),
          'config/validation-config.json'
        ),
      });

      const config = await configLoader.load(options.config);

      // Load recipe
      const recipeContent = await fs.readFile(recipePath, 'utf-8');
      const recipe = JSON.parse(recipeContent);

      // Create validation context
      const context = new ValidationContext({
        dataRegistry: container.resolve('IDataRegistry'),
        schemaValidator: container.resolve('IAJVSchemaValidator'),
        blueprintProcessor: container.resolve('IBlueprintProcessor'),
        logger,
        config,
      });

      // Create validator registry
      const registry = new ValidatorRegistry({ logger });

      // Register all validators (could be automated via DI)
      registry.register(new ComponentExistenceValidator({ logger }));
      registry.register(new PropertySchemasValidator({ logger }));
      registry.register(new BodyDescriptorValidator({ logger }));
      // ... register remaining validators

      // Create pipeline
      const pipeline = new ValidationPipeline({
        registry,
        logger,
        config,
      });

      // Execute validation
      console.log(chalk.blue(`\nValidating recipe: ${recipePath}\n`));
      const results = await pipeline.execute(recipe, context);

      // Display results
      displayResults(results, options.verbose);

      // Exit with appropriate code
      process.exit(results.errors.length > 0 ? 1 : 0);
    } catch (error) {
      console.error(chalk.red(`\nValidation failed: ${error.message}\n`));
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

function displayResults(results, verbose) {
  // Passed checks
  if (results.passed.length > 0) {
    console.log(chalk.green(`✓ ${results.passed.length} checks passed`));
    if (verbose) {
      results.passed.forEach((check) => {
        console.log(chalk.green(`  ✓ ${check.validator}`));
      });
    }
  }

  // Errors
  if (results.errors.length > 0) {
    console.log(chalk.red(`\n✗ ${results.errors.length} errors:\n`));
    results.errors.forEach((error) => {
      console.log(chalk.red(`  [${error.validator}] ${error.message}`));
    });
  }

  // Warnings
  if (results.warnings.length > 0) {
    console.log(chalk.yellow(`\n⚠ ${results.warnings.length} warnings:\n`));
    results.warnings.forEach((warning) => {
      console.log(chalk.yellow(`  [${warning.validator}] ${warning.message}`));
    });
  }

  // Info
  if (results.info.length > 0 && verbose) {
    console.log(chalk.blue(`\nℹ ${results.info.length} suggestions:\n`));
    results.info.forEach((info) => {
      console.log(chalk.blue(`  [${info.validator}] ${info.message}`));
    });
  }
}

program.parse(process.argv);
```

**Phase 4 Deliverables:**

- ✅ `ValidationPipeline` orchestrator
- ✅ `ConfigurationLoader` with schema validation
- ✅ Updated CLI entry point
- ✅ Backward-compatible `validate-recipe.js` wrapper

---

## Migration Strategy

### Parallel Development Approach

**Goal:** Maintain backward compatibility while refactoring

```
Current System (validate-recipe.js)
    ↓
Refactored System (validate-recipe-v2.js)
    ↓
Feature Parity Testing
    ↓
Deprecate Old System
    ↓
Remove Legacy Code
```

### Step-by-Step Migration

#### Step 1: Feature Parity (Weeks 1-7)

- Develop new system alongside existing implementation
- No changes to `validate-recipe.js` or `RecipePreflightValidator.js`
- All new code in separate files
- **Testing:** Compare outputs between old and new systems

#### Step 2: Integration Testing (Week 8)

- Create comprehensive test suite comparing both systems
- Validate identical output for all existing recipes
- Document any behavioral differences
- **Gate:** 100% output parity required before proceeding

#### Step 3: Beta Release (Week 9)

- Release `validate-recipe-v2.js` as opt-in beta
- Add `--use-v2` flag to existing CLI
- Gather feedback from real usage
- **Monitoring:** Track adoption and issues

#### Step 4: Deprecation (Week 10)

- Make v2 the default
- Add deprecation warning to old system
- Provide migration guide for custom validators
- **Timeline:** 1 month deprecation period

#### Step 5: Removal (Week 14)

- Remove `RecipePreflightValidator.js` (1,207 lines)
- Remove old CLI entry point
- Clean up deprecated code
- **Celebration:** Delete the God class! 🎉

---

## Testing Strategy

### Unit Test Requirements

**Coverage Target:** 80% branches, 90% functions/lines

**Test Structure:**

```javascript
// tests/unit/anatomy/validation/validators/BodyDescriptorValidator.test.js

import { describe, it, expect, beforeEach } from '@jest/globals';
import { BodyDescriptorValidator } from '../../../../../src/anatomy/validation/validators/BodyDescriptorValidator.js';
import { ValidationContext } from '../../../../../src/anatomy/validation/core/ValidationContext.js';
import { createTestBed } from '../../../../common/testBed.js';

describe('BodyDescriptorValidator', () => {
  let testBed;
  let validator;
  let context;

  beforeEach(() => {
    testBed = createTestBed();
    validator = new BodyDescriptorValidator({
      logger: testBed.createMockLogger(),
    });

    context = new ValidationContext({
      dataRegistry: testBed.createMockDataRegistry(),
      schemaValidator: testBed.createMockSchemaValidator(),
      blueprintProcessor: testBed.createMockBlueprintProcessor(),
      logger: testBed.createMockLogger(),
    });
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('performValidation', () => {
    it('should pass when all descriptors are valid', async () => {
      const recipe = {
        body: {
          descriptors: {
            height: 'average',
            build: 'athletic',
          },
        },
      };

      const result = await validator.validate(recipe, context);

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should error when descriptor has invalid enum value', async () => {
      const recipe = {
        body: {
          descriptors: {
            height: 'invalid-value',
          },
        },
      };

      const result = await validator.validate(recipe, context);

      expect(result.isValid).toBe(false);
      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('DESCRIPTOR_SCHEMA_VIOLATION');
    });

    it('should error when descriptor has wrong type', async () => {
      const recipe = {
        body: {
          descriptors: {
            height: 123, // Should be string
          },
        },
      };

      const result = await validator.validate(recipe, context);

      expect(result.isValid).toBe(false);
      expect(result.issues[0].type).toBe('DESCRIPTOR_SCHEMA_VIOLATION');
    });
  });
});
```

### Integration Test Requirements

**File:** `tests/integration/anatomy/validation/ValidationPipeline.integration.test.js`

```javascript
describe('ValidationPipeline Integration', () => {
  it('should execute all validators in priority order', async () => {
    // Test full pipeline execution
  });

  it('should stop pipeline on fail-fast validator failure', async () => {
    // Test fail-fast behavior
  });

  it('should aggregate results from all validators', async () => {
    // Test result aggregation
  });

  it('should respect validator enable/disable configuration', async () => {
    // Test configuration override
  });

  it('should apply severity overrides from configuration', async () => {
    // Test severity mapping
  });
});
```

### Comparison Test Suite

**File:** `tests/integration/anatomy/validation/LegacyComparison.integration.test.js`

```javascript
describe('Legacy vs Refactored Comparison', () => {
  it('should produce identical results for valid recipe', async () => {
    const recipe = loadTestRecipe('valid-humanoid.recipe.json');

    const legacyResult = await runLegacyValidation(recipe);
    const newResult = await runRefactoredValidation(recipe);

    expect(newResult).toEqual(legacyResult);
  });

  it('should produce identical error messages for invalid recipe', async () => {
    const recipe = loadTestRecipe('invalid-missing-component.recipe.json');

    const legacyResult = await runLegacyValidation(recipe);
    const newResult = await runRefactoredValidation(recipe);

    expect(newResult.errors).toEqual(legacyResult.errors);
  });
});
```

---

## Performance Considerations

### Expected Performance Impact

| Metric              | Current | Target | Change                   |
| ------------------- | ------- | ------ | ------------------------ |
| **Startup Time**    | ~200ms  | ~250ms | +25% (config loading)    |
| **Validation Time** | ~500ms  | ~480ms | -4% (better caching)     |
| **Memory Usage**    | ~50MB   | ~55MB  | +10% (validator objects) |

### Optimization Strategies

1. **Lazy Validator Loading:** Load validators on-demand
2. **Result Caching:** Cache validation results for unchanged recipes
3. **Parallel Validation:** Run independent validators concurrently
4. **Early Exit:** Stop pipeline early when possible

---

## Backward Compatibility

### CLI Compatibility

**Old Command:**

```bash
npm run validate:recipe data/mods/anatomy/recipes/humanoid.recipe.json
```

**New Command (same result):**

```bash
npm run validate:recipe data/mods/anatomy/recipes/humanoid.recipe.json
```

**Advanced Usage (new features):**

```bash
# Use custom configuration
npm run validate:recipe recipe.json -- --config custom-validation.json

# Fail fast
npm run validate:recipe recipe.json -- --fail-fast

# Verbose output
npm run validate:recipe recipe.json -- --verbose
```

### API Compatibility

**Old API (programmatic usage):**

```javascript
const validator = new RecipePreflightValidator({
  /* ... */
});
const results = await validator.validate(recipe);
```

**New API (backward-compatible wrapper):**

```javascript
// Legacy interface maintained
const validator = new RecipePreflightValidator({
  /* ... */
});
const results = await validator.validate(recipe);

// Internally delegates to new pipeline
```

---

## Risk Mitigation

### High-Risk Areas

1. **Blueprint Processing Changes**
   - **Risk:** V2 blueprint handling may differ subtly
   - **Mitigation:** Comprehensive comparison testing

2. **Error Message Changes**
   - **Risk:** Different error formatting breaks tooling
   - **Mitigation:** Maintain exact error format compatibility

3. **Performance Regression**
   - **Risk:** New architecture slower than monolith
   - **Mitigation:** Performance benchmarking suite

4. **Configuration Schema Changes**
   - **Risk:** Breaking changes in config format
   - **Mitigation:** Schema versioning and migration tools

### Rollback Plan

**If critical issues discovered:**

1. Revert CLI to use old implementation
2. Mark new system as experimental
3. Address issues in isolated branch
4. Re-release when validated

**Rollback Command:**

```bash
git revert <refactoring-commits>
npm run validate:recipe # Uses old implementation
```

---

## Success Metrics

### Code Quality Metrics

| Metric                    | Before      | Target           | Success Criteria        |
| ------------------------- | ----------- | ---------------- | ----------------------- |
| **Max File Size**         | 1,207 lines | <500 lines       | ✅ All files comply     |
| **Code Duplication**      | 5 instances | 0 instances      | ✅ Zero duplication     |
| **Unit Test Coverage**    | 0%          | 80%+             | ✅ >80% branch coverage |
| **Cyclomatic Complexity** | High        | <10 per function | ✅ All functions simple |

### Functional Metrics

| Metric                        | Target        | Success Criteria                                  |
| ----------------------------- | ------------- | ------------------------------------------------- |
| **Output Parity**             | 100%          | ✅ Identical results for all test recipes         |
| **Configuration Flexibility** | Full          | ✅ Can disable any validator                      |
| **Extensibility**             | Plugin system | ✅ Can add custom validators without core changes |
| **Error Clarity**             | Improved      | ✅ Clear, actionable error messages               |

### Performance Metrics

| Metric              | Baseline | Target | Tolerance |
| ------------------- | -------- | ------ | --------- |
| **Validation Time** | 500ms    | <550ms | +10% max  |
| **Memory Usage**    | 50MB     | <60MB  | +20% max  |
| **Startup Time**    | 200ms    | <250ms | +25% max  |

---

## Implementation Checklist

### Phase 1: Foundation ✅

- [ ] Create `IValidator` interface
- [ ] Create `ValidationContext` class
- [ ] Create configuration schema
- [ ] Create default configuration file
- [ ] Write unit tests for core classes

### Phase 2: Services ✅

- [ ] Create `stringUtils.js` (Levenshtein)
- [ ] Create `EntityMatcherService`
- [ ] Create `BlueprintProcessorService`
- [ ] Create `ValidationResultBuilder`
- [ ] Migrate duplicated code to services
- [ ] Write unit tests for all services

### Phase 3: Validators ✅

- [ ] Create `BaseValidator` class
- [ ] Refactor 11 validators to standalone classes
- [ ] Create `ValidatorRegistry`
- [ ] Write comprehensive unit tests (80%+ coverage)
- [ ] Integration tests for validator interactions

### Phase 4: Pipeline ✅

- [ ] Create `ValidationPipeline` orchestrator
- [ ] Create `ConfigurationLoader`
- [ ] Create new CLI entry point (`validate-recipe-v2.js`)
- [ ] Implement backward-compatible wrapper
- [ ] Write integration tests
- [ ] Create comparison test suite

### Phase 5: Migration ✅

- [ ] Run comparison tests (100% parity)
- [ ] Beta release with opt-in flag
- [ ] Documentation and migration guide
- [ ] Deprecate old system
- [ ] Remove legacy code after deprecation period

---

## Conclusion

This refactoring transforms the recipe validation system from a **patchwork monolith** to a **robust, flexible, and maintainable architecture**:

### Key Improvements

1. **Modularity:** 1,207-line God class → 11 focused validators (<200 lines each)
2. **Testability:** 0% unit test coverage → 80%+ comprehensive testing
3. **Flexibility:** Hardcoded behavior → JSON configuration system
4. **Extensibility:** Closed system → Plugin architecture for custom validators
5. **Maintainability:** Code duplication eliminated, consistent patterns throughout

### Long-Term Benefits

- **Easier Feature Addition:** New validators plug in without core changes
- **Better Testing:** Individual validators can be unit tested in isolation
- **Clearer Code:** Each validator has single responsibility
- **Mod Extensibility:** Mod developers can add custom validation rules
- **Configuration Flexibility:** Different validation rules for different environments

### Next Steps

1. Review and approve refactoring plan
2. Begin Phase 1 implementation
3. Iterative development with continuous testing
4. Beta release for real-world validation
5. Full deployment and legacy code removal

---

**Document Version:** 1.0
**Last Updated:** 2025-01-14
**Status:** Ready for Implementation
