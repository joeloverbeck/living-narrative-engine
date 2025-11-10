/**
 * @file Comprehensive pre-flight validator for anatomy recipes
 * @see ./rules/componentExistenceValidationRule.js
 * @see ./rules/propertySchemaValidationRule.js
 * @see ./loadTimeValidationContext.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import { ComponentExistenceValidationRule } from './rules/componentExistenceValidationRule.js';
import { PropertySchemaValidationRule } from './rules/propertySchemaValidationRule.js';
import { LoadTimeValidationContext } from './loadTimeValidationContext.js';
import { ValidationReport } from './ValidationReport.js';
import { validateSocketSlotCompatibility } from './socketSlotCompatibilityValidator.js';
import { validatePatternMatching } from './patternMatchingValidator.js';

/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/IAnatomyBlueprintRepository.js').IAnatomyBlueprintRepository} IAnatomyBlueprintRepository */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../slotGenerator.js').default} SlotGenerator */

/**
 * Comprehensive pre-flight validator for anatomy recipes
 * Orchestrates multiple validation checks and produces unified report
 */
class RecipePreflightValidator {
  #dataRegistry;
  #anatomyBlueprintRepository;
  #schemaValidator;
  #slotGenerator;
  #logger;
  #loadFailures;

  constructor({
    dataRegistry,
    anatomyBlueprintRepository,
    schemaValidator,
    slotGenerator,
    logger,
    loadFailures = {},
  }) {
    validateDependency(dataRegistry, 'IDataRegistry', logger, {
      requiredMethods: ['get', 'getAll'],
    });
    validateDependency(
      anatomyBlueprintRepository,
      'IAnatomyBlueprintRepository',
      logger,
      {
        requiredMethods: ['getBlueprint', 'getRecipe'],
      }
    );
    validateDependency(schemaValidator, 'ISchemaValidator', logger, {
      requiredMethods: ['validate'],
    });
    validateDependency(slotGenerator, 'ISlotGenerator', logger, {
      requiredMethods: [
        'extractSlotKeysFromLimbSet',
        'extractSlotKeysFromAppendage',
      ],
    });

    this.#dataRegistry = dataRegistry;
    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
    this.#schemaValidator = schemaValidator;
    this.#slotGenerator = slotGenerator;
    this.#logger = logger;
    this.#loadFailures = loadFailures;
  }

  /**
   * Validates a recipe with all pre-flight checks
   *
   * @param {object} recipe - Recipe to validate
   * @param {object} options - Validation options
   * @returns {Promise<ValidationReport>} Comprehensive validation report
   */
  async validate(recipe, options = {}) {
    const results = {
      recipeId: recipe.recipeId,
      recipePath: options.recipePath,
      timestamp: new Date().toISOString(),
      errors: [],
      warnings: [],
      suggestions: [],
      passed: [],
    };

    // Run all validation checks
    await this.#runValidationChecks(recipe, results, options);

    return new ValidationReport(results);
  }

  async #runValidationChecks(recipe, results, options) {
    // 1. Component Existence (Critical - P0)
    await this.#checkComponentExistence(recipe, results);

    // 2. Property Schemas (Critical - P0)
    if (results.errors.length === 0 || !options.failFast) {
      await this.#checkPropertySchemas(recipe, results);
    }

    // 3. Blueprint Validation (Critical - P0)
    await this.#checkBlueprintExists(recipe, results);

    // 4. Socket/Slot Compatibility (Critical - P0)
    if (this.#blueprintExists(results)) {
      await this.#checkSocketSlotCompatibility(recipe, results);
    }

    // 5. Pattern Matching Dry-Run (Warning - P1)
    if (!options.skipPatternValidation) {
      await this.#checkPatternMatching(recipe, results);
    }

    // 6. Descriptor Coverage (Suggestion - P1)
    if (!options.skipDescriptorChecks) {
      this.#checkDescriptorCoverage(recipe, results);
    }

    // 7. Part Availability (Critical - P0)
    if (!options.skipPartAvailabilityChecks) {
      await this.#checkPartAvailability(recipe, results);
    }

    // 8. Generated Slot Part Availability (Critical - P0)
    // Check that entity definitions exist for ALL slots that patterns will match
    if (!options.skipGeneratedSlotChecks && this.#blueprintExists(results)) {
      await this.#checkGeneratedSlotPartAvailability(recipe, results);
    }

    // 9. Entity Definition Load Failures (Critical - P0)
    // This check runs last to provide context for missing entity definitions
    if (!options.skipLoadFailureChecks) {
      this.#checkEntityDefinitionLoadFailures(results);
    }
  }

  async #checkComponentExistence(recipe, results) {
    try {
      // Use ComponentExistenceValidationRule from ANASYSIMP-001
      const componentRule = new ComponentExistenceValidationRule({
        logger: this.#logger,
        dataRegistry: this.#dataRegistry,
      });

      // Create context with just this recipe
      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { [recipe.recipeId]: recipe },
      });

      const issues = await componentRule.validate(context);
      const errors = issues.filter((i) => i.severity === 'error');

      if (errors.length === 0) {
        results.passed.push({
          check: 'component_existence',
          message: `All ${this.#countComponentReferences(recipe)} component references exist`,
        });
      } else {
        results.errors.push(...errors);
      }
    } catch (error) {
      this.#logger.error('Component existence check failed', error);
      results.errors.push({
        type: 'VALIDATION_ERROR',
        check: 'component_existence',
        message: 'Failed to validate component existence',
        error: error.message,
      });
    }
  }

  async #checkPropertySchemas(recipe, results) {
    try {
      // Use PropertySchemaValidationRule from ANASYSIMP-002
      const propertyRule = new PropertySchemaValidationRule({
        logger: this.#logger,
        dataRegistry: this.#dataRegistry,
        schemaValidator: this.#schemaValidator,
      });

      // Create context with just this recipe
      const context = new LoadTimeValidationContext({
        blueprints: {},
        recipes: { [recipe.recipeId]: recipe },
      });

      const issues = await propertyRule.validate(context);
      const errors = issues.filter((i) => i.severity === 'error');

      if (errors.length === 0) {
        results.passed.push({
          check: 'property_schemas',
          message: `All ${this.#countPropertyObjects(recipe)} property objects valid`,
        });
      } else {
        results.errors.push(...errors);
      }
    } catch (error) {
      this.#logger.error('Property schema check failed', error);
      results.errors.push({
        type: 'VALIDATION_ERROR',
        check: 'property_schemas',
        message: 'Failed to validate property schemas',
        error: error.message,
      });
    }
  }

  async #checkBlueprintExists(recipe, results) {
    try {
      const blueprint =
        await this.#anatomyBlueprintRepository.getBlueprint(recipe.blueprintId);

      if (!blueprint) {
        results.errors.push({
          type: 'BLUEPRINT_NOT_FOUND',
          blueprintId: recipe.blueprintId,
          message: `Blueprint '${recipe.blueprintId}' does not exist`,
          fix: `Create blueprint at data/mods/*/blueprints/${recipe.blueprintId.split(':')[1]}.blueprint.json`,
          severity: 'error',
        });
      } else {
        results.passed.push({
          check: 'blueprint_exists',
          message: `Blueprint '${recipe.blueprintId}' found`,
          blueprint: {
            id: blueprint.id,
            root: blueprint.root,
            structureTemplate: blueprint.structureTemplate,
          },
        });
      }
    } catch (error) {
      this.#logger.error('Blueprint existence check failed', error);
      results.errors.push({
        type: 'VALIDATION_ERROR',
        check: 'blueprint_exists',
        message: 'Failed to check blueprint existence',
        error: error.message,
      });
    }
  }

  async #checkSocketSlotCompatibility(recipe, results) {
    try {
      const blueprint =
        await this.#anatomyBlueprintRepository.getBlueprint(recipe.blueprintId);
      if (!blueprint) return; // Already caught by blueprint check

      const errors = await validateSocketSlotCompatibility(
        blueprint,
        this.#dataRegistry
      );

      if (errors.length === 0) {
        const socketCount = this.#countAdditionalSlots(blueprint);
        results.passed.push({
          check: 'socket_slot_compatibility',
          message: `All ${socketCount} additionalSlot socket references valid`,
        });
      } else {
        results.errors.push(...errors);
      }
    } catch (error) {
      this.#logger.error('Socket/slot compatibility check failed', error);
      results.warnings.push({
        type: 'VALIDATION_WARNING',
        check: 'socket_slot_compatibility',
        message: 'Failed to validate socket/slot compatibility',
        error: error.message,
      });
    }
  }

  /**
   * Ensures blueprint is fully processed with generated slots and merged additionalSlots
   * V2 blueprints with structure templates need slot generation before pattern validation
   *
   * @param {object} blueprint - Raw blueprint from repository
   * @returns {Promise<object>} Processed blueprint with all slots merged
   * @private
   */
  async #ensureBlueprintProcessed(blueprint) {
    // V1 blueprints or already-processed blueprints pass through
    if (!blueprint.structureTemplate || blueprint._generatedSockets) {
      return blueprint;
    }

    // V2 blueprint needs processing
    this.#logger.debug(
      `RecipePreflightValidator: Processing V2 blueprint '${blueprint.id}' with structure template`
    );

    // Load structure template
    const template = this.#dataRegistry.get(
      'anatomyStructureTemplates',
      blueprint.structureTemplate
    );

    if (!template) {
      this.#logger.warn(
        `RecipePreflightValidator: Structure template '${blueprint.structureTemplate}' not found, using raw blueprint`
      );
      return blueprint;
    }

    // Generate slots from structure template
    // This mirrors what blueprintLoader.js does at runtime
    const generatedSlots = this.#slotGenerator.generateBlueprintSlots(template);
    const additionalSlots = blueprint.additionalSlots || {};

    // Merge generated slots with additionalSlots (additionalSlots take precedence)
    const mergedSlots = {
      ...generatedSlots,
      ...additionalSlots,
    };

    this.#logger.debug(
      `RecipePreflightValidator: Generated ${Object.keys(generatedSlots).length} slots, merged with ${Object.keys(additionalSlots).length} additionalSlots = ${Object.keys(mergedSlots).length} total slots`
    );

    // Return processed blueprint with merged slots
    return {
      ...blueprint,
      slots: mergedSlots,
      _generatedSockets: true, // Mark as processed
    };
  }

  async #checkPatternMatching(recipe, results) {
    try {
      const patterns = recipe.patterns || [];
      if (patterns.length === 0) {
        results.passed.push({
          check: 'pattern_matching',
          message: 'No patterns to validate',
        });
        return;
      }

      // Get blueprint for the recipe
      const rawBlueprint =
        await this.#anatomyBlueprintRepository.getBlueprint(recipe.blueprintId);

      if (!rawBlueprint) {
        this.#logger.warn(
          `Cannot validate patterns: blueprint '${recipe.blueprintId}' not found`
        );
        return;
      }

      // Process blueprint to generate slots and merge additionalSlots
      // This ensures the validator sees the same blueprint structure as runtime
      const blueprint = await this.#ensureBlueprintProcessed(rawBlueprint);

      // Run pattern matching dry-run validation
      const warnings = validatePatternMatching(
        recipe,
        blueprint,
        this.#dataRegistry,
        this.#slotGenerator,
        this.#logger
      );

      if (warnings.length === 0) {
        const patternCount = patterns.length;
        results.passed.push({
          check: 'pattern_matching',
          message: `All ${patternCount} pattern(s) have matching slots`,
        });
      } else {
        results.warnings.push(...warnings);
      }
    } catch (error) {
      this.#logger.error('Pattern matching check failed', error);
      results.warnings.push({
        type: 'VALIDATION_WARNING',
        check: 'pattern_matching',
        message: 'Pattern matching check failed',
        error: error.message,
      });
    }
  }

  #checkDescriptorCoverage(recipe, results) {
    try {
      // Check if entities referenced by slots/patterns have descriptor components
      // This is a suggestion-level check (not critical)

      const suggestions = [];

      for (const [slotName, slot] of Object.entries(recipe.slots || {})) {
        const hasDescriptors = this.#hasDescriptorComponents(
          Object.keys(slot.properties || {})
        );

        if (!hasDescriptors) {
          suggestions.push({
            type: 'MISSING_DESCRIPTORS',
            location: { type: 'slot', name: slotName },
            message: `Slot '${slotName}' may not appear in descriptions`,
            reason: 'No descriptor components in properties',
            suggestion:
              'Add descriptor components (descriptors:size_category, descriptors:texture, etc.)',
            impact: 'Part will be excluded from anatomy description',
          });
        }
      }

      if (suggestions.length > 0) {
        results.suggestions.push(...suggestions);
      } else {
        results.passed.push({
          check: 'descriptor_coverage',
          message: 'All slots have descriptor components',
        });
      }
    } catch (error) {
      this.#logger.error('Descriptor coverage check failed', error);
      // Don't add error/warning - this is optional
    }
  }

  #hasDescriptorComponents(tags) {
    return tags.some((tag) => tag.startsWith('descriptors:'));
  }

  async #checkPartAvailability(recipe, results) {
    try {
      const errors = [];
      const allEntityDefs = this.#dataRegistry.getAll('entityDefinitions');

      // Check slots
      for (const [slotName, slot] of Object.entries(recipe.slots || {})) {
        const matchingEntities = this.#findMatchingEntities(
          slot,
          allEntityDefs
        );

        if (matchingEntities.length === 0) {
          errors.push({
            type: 'PART_UNAVAILABLE',
            severity: 'error',
            location: { type: 'slot', name: slotName },
            message: `No entity definitions found for slot '${slotName}'`,
            details: {
              partType: slot.partType,
              requiredTags: slot.tags || [],
              requiredProperties: Object.keys(slot.properties || {}),
              totalEntitiesChecked: allEntityDefs.length,
            },
          });
        }
      }

      // Check patterns
      for (let i = 0; i < (recipe.patterns || []).length; i++) {
        const pattern = recipe.patterns[i];
        const matchingEntities = this.#findMatchingEntities(
          pattern,
          allEntityDefs
        );

        if (matchingEntities.length === 0) {
          errors.push({
            type: 'PART_UNAVAILABLE',
            severity: 'error',
            location: { type: 'pattern', index: i },
            message: `No entity definitions found for pattern ${i}`,
            details: {
              partType: pattern.partType,
              requiredTags: pattern.tags || [],
              requiredProperties: Object.keys(pattern.properties || {}),
              totalEntitiesChecked: allEntityDefs.length,
            },
          });
        }
      }

      if (errors.length === 0) {
        results.passed.push({
          check: 'part_availability',
          message: 'All slots and patterns have matching entity definitions',
        });
      } else {
        results.errors.push(...errors);
      }
    } catch (error) {
      this.#logger.error('Part availability check failed', error);
      results.errors.push({
        type: 'VALIDATION_ERROR',
        check: 'part_availability',
        message: 'Failed to validate part availability',
        error: error.message,
      });
    }
  }

  #findMatchingEntities(slotOrPattern, allEntityDefs) {
    const matches = [];
    const requiredPartType = slotOrPattern.partType;
    const requiredTags = slotOrPattern.tags || [];
    const requiredPropertyValues = slotOrPattern.properties || {};

    for (const entityDef of allEntityDefs) {
      // Check if entity has anatomy:part component with matching subType
      const anatomyPart = entityDef.components?.['anatomy:part'];
      if (!anatomyPart || anatomyPart.subType !== requiredPartType) {
        continue;
      }

      // Check if entity has all required tags (components)
      const hasAllTags = requiredTags.every(
        (tag) => entityDef.components?.[tag] !== undefined
      );
      if (!hasAllTags) {
        continue;
      }

      // Check if entity property VALUES match required property values
      // This mirrors the runtime behavior in partSelectionService.js #matchesProperties
      if (!this.#matchesPropertyValues(entityDef, requiredPropertyValues)) {
        continue;
      }

      matches.push(entityDef.id);
    }

    return matches;
  }

  /**
   * Validates that entity definitions exist for all slots that patterns will match
   * This is critical because patterns dynamically match slots from the blueprint,
   * and we need to ensure parts are available for each matched slot.
   *
   * @param {object} recipe - Recipe to validate
   * @param {object} results - Validation results object
   */
  async #checkGeneratedSlotPartAvailability(recipe, results) {
    try {
      const rawBlueprint = await this.#anatomyBlueprintRepository.getBlueprint(
        recipe.blueprintId
      );

      if (!rawBlueprint) {
        // Blueprint check already failed, skip this check
        return;
      }

      // Process blueprint to ensure all slots are generated
      const blueprint = await this.#ensureBlueprintProcessed(rawBlueprint);

      const patterns = recipe.patterns || [];
      if (patterns.length === 0) {
        // No patterns to check
        return;
      }

      const allEntityDefs = this.#dataRegistry.getAll('entityDefinitions');
      const errors = [];
      let totalSlotsChecked = 0;

      // Load structure template and generate sockets if blueprint uses one
      let generatedSockets = {};
      if (blueprint.structureTemplate) {
        this.#logger.info(
          `RecipePreflightValidator: Loading structure template '${blueprint.structureTemplate}'`
        );
        const structureTemplate = this.#dataRegistry.get(
          'anatomyStructureTemplates',
          blueprint.structureTemplate
        );
        if (structureTemplate) {
          this.#logger.info(
            `RecipePreflightValidator: Structure template found, generating sockets`
          );
          // Dynamically import SocketGenerator to generate sockets
          const { default: SocketGenerator } = await import(
            '../socketGenerator.js'
          );
          const socketGenerator = new SocketGenerator({ logger: this.#logger });
          const sockets = socketGenerator.generateSockets(structureTemplate);

          this.#logger.info(
            `RecipePreflightValidator: Generated ${sockets.length} sockets from structure template`
          );

          // Build socket lookup map by socket id
          for (const socket of sockets) {
            generatedSockets[socket.id] = socket;
          }
        } else {
          this.#logger.warn(
            `RecipePreflightValidator: Structure template '${blueprint.structureTemplate}' not found in data registry`
          );
        }
      }

      // For each pattern, find slots it matches and validate entity availability
      for (let patternIndex = 0; patternIndex < patterns.length; patternIndex++) {
        const pattern = patterns[patternIndex];

        // Get all slots this pattern will match
        const { findMatchingSlots } = await import(
          './patternMatchingValidator.js'
        );
        const matchResult = findMatchingSlots(
          pattern,
          blueprint,
          this.#dataRegistry,
          this.#slotGenerator,
          this.#logger
        );

        const matchedSlots = matchResult.matches;

        // For each matched slot, verify entity definitions exist
        for (const slotKey of matchedSlots) {
          totalSlotsChecked++;

          // Get the socket requirements for this slot
          // Check both blueprint.slots and generated sockets from structure template
          const blueprintSlot = blueprint.slots?.[slotKey] || generatedSockets[slotKey];
          if (!blueprintSlot) {
            // Slot doesn't exist in blueprint or generated sockets
            this.#logger.warn(
              `RecipePreflightValidator: Slot '${slotKey}' matched by pattern but not found in blueprint or structure template`
            );
            continue;
          }

          // Build combined requirements: pattern requirements + socket allowed types + blueprint slot requirements
          const combinedRequirements = {
            partType: pattern.partType,
            allowedTypes: blueprintSlot.allowedTypes || ['*'],
            tags: [
              ...(pattern.tags || []),
              ...(blueprintSlot.requirements?.components || []),
            ],
            properties: this.#mergePropertyRequirements(
              pattern.properties || {},
              blueprintSlot.requirements?.properties || {}
            ),
          };

          // Find matching entities
          const matchingEntities = this.#findMatchingEntitiesForSlot(
            combinedRequirements,
            allEntityDefs
          );

          if (matchingEntities.length === 0) {
            errors.push({
              type: 'GENERATED_SLOT_PART_UNAVAILABLE',
              severity: 'error',
              location: {
                type: 'generated_slot',
                slotKey,
                patternIndex,
                pattern: this.#getPatternDescription(pattern),
              },
              message: `No entity definitions found for generated slot '${slotKey}' (matched by pattern ${patternIndex})`,
              details: {
                slotKey,
                patternIndex,
                partType: pattern.partType,
                allowedTypes: blueprintSlot.allowedTypes,
                requiredTags: combinedRequirements.tags,
                requiredProperties: Object.keys(combinedRequirements.properties),
                totalEntitiesChecked: allEntityDefs.length,
                blueprintRequiredComponents: blueprintSlot.requirements?.components || [],
                blueprintRequiredProperties: Object.keys(blueprintSlot.requirements?.properties || {}),
              },
              fix: `Create an entity definition in data/mods/anatomy/entities/definitions/ with:\n` +
                `  - anatomy:part component with subType: "${pattern.partType}"\n` +
                `  - Required tags (pattern + blueprint): ${JSON.stringify(combinedRequirements.tags)}\n` +
                `  - Required property components: ${JSON.stringify(Object.keys(combinedRequirements.properties))}`,
            });
          }
        }
      }

      if (errors.length === 0) {
        results.passed.push({
          check: 'generated_slot_part_availability',
          message: `All ${totalSlotsChecked} generated slot(s) from patterns have matching entity definitions`,
        });
      } else {
        results.errors.push(...errors);
      }
    } catch (error) {
      this.#logger.error('Generated slot part availability check failed', error);
      results.errors.push({
        type: 'VALIDATION_ERROR',
        check: 'generated_slot_part_availability',
        message: 'Failed to validate generated slot part availability',
        error: error.message,
      });
    }
  }

  /**
   * Find matching entities for a slot with combined requirements
   * Similar to #findMatchingEntities but also checks allowedTypes
   *
   * @param {object} requirements - Combined requirements
   * @param {Array} allEntityDefs - All entity definitions
   * @returns {Array<string>} Matching entity IDs
   */
  #findMatchingEntitiesForSlot(requirements, allEntityDefs) {
    const matches = [];
    const { partType, allowedTypes, tags, properties } = requirements;

    for (const entityDef of allEntityDefs) {
      // Check if entity has anatomy:part component with matching subType
      const anatomyPart = entityDef.components?.['anatomy:part'];
      if (!anatomyPart) {
        continue;
      }

      // Check partType requirement
      if (partType && anatomyPart.subType !== partType) {
        continue;
      }

      // Check if subType is in allowedTypes (unless allowedTypes includes '*')
      if (
        allowedTypes &&
        !allowedTypes.includes('*') &&
        !allowedTypes.includes(anatomyPart.subType)
      ) {
        continue;
      }

      // Check if entity has all required tags (components)
      const hasAllTags = tags.every(
        (tag) => entityDef.components?.[tag] !== undefined
      );
      if (!hasAllTags) {
        continue;
      }

      // Check if entity properties match required property VALUES
      // Properties is an object like { "descriptors:build": { "build": "slim" } }
      if (!this.#matchesPropertyValues(entityDef, properties)) {
        continue;
      }

      matches.push(entityDef.id);
    }

    return matches;
  }

  /**
   * Checks if entity definition matches property value requirements
   * Mimics the production code's #matchesProperties method
   *
   * @param {object} entityDef - Entity definition
   * @param {object} propertyRequirements - Required property components with values
   * @returns {boolean} True if all property values match
   */
  #matchesPropertyValues(entityDef, propertyRequirements) {
    if (!propertyRequirements || typeof propertyRequirements !== 'object') {
      return true;
    }

    for (const [componentId, requiredProps] of Object.entries(
      propertyRequirements
    )) {
      const component = entityDef.components?.[componentId];
      if (!component) {
        return false;
      }

      for (const [propKey, propValue] of Object.entries(requiredProps)) {
        if (component[propKey] !== propValue) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Deep merge property requirements from pattern and blueprint
   * Ensures that both sets of constraints are preserved when they target the same component
   *
   * @param {object} patternProperties - Property requirements from pattern
   * @param {object} blueprintProperties - Property requirements from blueprint slot
   * @returns {object} Merged property requirements with all constraints
   * @example
   * // Pattern requires: descriptors:venom.potency === 'high'
   * // Blueprint requires: descriptors:venom.color === 'green'
   * // Result: descriptors:venom must have both potency='high' AND color='green'
   * const merged = this.#mergePropertyRequirements(
   *   { "descriptors:venom": { "potency": "high" } },
   *   { "descriptors:venom": { "color": "green" } }
   * );
   * // => { "descriptors:venom": { "potency": "high", "color": "green" } }
   */
  #mergePropertyRequirements(patternProperties, blueprintProperties) {
    const merged = { ...patternProperties };

    // Deep merge blueprint properties into pattern properties
    for (const [componentId, blueprintProps] of Object.entries(blueprintProperties)) {
      if (merged[componentId]) {
        // Component exists in both - merge the property constraints
        merged[componentId] = {
          ...merged[componentId],
          ...blueprintProps,
        };
      } else {
        // Component only in blueprint - add it
        merged[componentId] = { ...blueprintProps };
      }
    }

    return merged;
  }

  /**
   * Get a human-readable description of a pattern
   *
   * @param {object} pattern - Pattern definition
   * @returns {string} Pattern description
   */
  #getPatternDescription(pattern) {
    if (pattern.matchesGroup) return `matchesGroup '${pattern.matchesGroup}'`;
    if (pattern.matchesPattern !== undefined)
      return `matchesPattern '${pattern.matchesPattern}'`;
    if (pattern.matchesAll)
      return `matchesAll ${JSON.stringify(pattern.matchesAll)}`;
    if (Array.isArray(pattern.matches))
      return `explicit [${pattern.matches.join(', ')}]`;
    return 'unknown pattern';
  }

  #blueprintExists(results) {
    return results.passed.some((p) => p.check === 'blueprint_exists');
  }

  #countComponentReferences(recipe) {
    let count = 0;

    for (const slot of Object.values(recipe.slots || {})) {
      count += (slot.tags || []).length;
      count += Object.keys(slot.properties || {}).length;
    }

    for (const pattern of recipe.patterns || []) {
      count += (pattern.tags || []).length;
      count += Object.keys(pattern.properties || {}).length;
    }

    return count;
  }

  #countPropertyObjects(recipe) {
    let count = 0;

    for (const slot of Object.values(recipe.slots || {})) {
      count += Object.keys(slot.properties || {}).length;
    }

    for (const pattern of recipe.patterns || []) {
      count += Object.keys(pattern.properties || {}).length;
    }

    return count;
  }

  #countAdditionalSlots(blueprint) {
    return Object.keys(blueprint.additionalSlots || {}).length;
  }

  /**
   * Check for entity definition load failures and provide detailed diagnostics
   * This helps explain why entity definitions are missing from the registry
   *
   * @param {object} results - Validation results object
   */
  #checkEntityDefinitionLoadFailures(results) {
    try {
      const entityDefFailures = this.#loadFailures?.entityDefinitions?.failures || [];

      if (entityDefFailures.length === 0) {
        return; // No failures to report
      }

      // Parse failures to extract detailed error information
      for (const failure of entityDefFailures) {
        const filename = failure.file;
        const error = failure.error;

        // Extract entity ID from filename (e.g., 'foo.entity.json' -> likely 'anatomy:foo')
        const baseId = filename.replace('.entity.json', '');

        // Try to parse error message for component validation failures
        const componentValidationMatch = error?.message?.match(
          /Invalid components: \[(.*?)\]/
        );

        if (componentValidationMatch) {
          const failedComponents = componentValidationMatch[1].split(', ');

          // Try to extract more details about the validation errors
          const validationDetails = this.#extractComponentValidationDetails(
            error,
            failedComponents
          );

          results.errors.push({
            type: 'ENTITY_LOAD_FAILURE',
            severity: 'error',
            location: { type: 'entity_definition', file: filename },
            message: `Entity definition '${baseId}' failed to load due to component validation errors`,
            details: {
              file: filename,
              failedComponents,
              error: error.message,
              validationDetails,
            },
            fix: validationDetails.length > 0
              ? `Fix validation errors:\n    ${validationDetails.map(d => `${d.component}: ${d.issue}`).join('\n    ')}`
              : `Check component values in ${filename} for: ${failedComponents.join(', ')}`,
          });
        } else {
          // Generic load failure
          results.errors.push({
            type: 'ENTITY_LOAD_FAILURE',
            severity: 'error',
            location: { type: 'entity_definition', file: filename },
            message: `Entity definition '${baseId}' failed to load`,
            details: {
              file: filename,
              error: error?.message || String(error),
            },
            fix: `Review ${filename} for validation errors`,
          });
        }
      }

      this.#logger.debug(
        `RecipePreflightValidator: Found ${entityDefFailures.length} entity definition load failures`
      );
    } catch (error) {
      this.#logger.error('Entity definition load failure check failed', error);
      // Don't add to results - this is a diagnostic check
    }
  }

  /**
   * Extract detailed component validation information from error
   *
   * @param {Error} error - Error object
   * @param {string[]} failedComponents - List of failed component IDs
   * @returns {Array<{component: string, issue: string}>} Validation details
   */
  #extractComponentValidationDetails(error, failedComponents) {
    const details = [];

    // The error message may contain schema validation details
    // Try to extract enum mismatches, which are common
    const errorString = error?.message || '';

    for (const componentId of failedComponents) {
      // Look for schema validation errors in the error message
      // Common pattern: "data/propertyName must be equal to one of the allowed values"
      const enumErrorMatch = errorString.match(
        new RegExp(`data/(\\w+) must be equal to one of the allowed values`, 'i')
      );

      if (enumErrorMatch) {
        details.push({
          component: componentId,
          issue: `Property '${enumErrorMatch[1]}' has an invalid value. Check allowed enum values in the component schema.`,
        });
      } else {
        // Generic validation failure
        details.push({
          component: componentId,
          issue: 'Component validation failed. Check schema requirements.',
        });
      }
    }

    return details;
  }
}

export default RecipePreflightValidator;
