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
import { LoadFailureValidator } from './validators/LoadFailureValidator.js';

/** @typedef {import('../../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../../interfaces/IAnatomyBlueprintRepository.js').IAnatomyBlueprintRepository} IAnatomyBlueprintRepository */
/** @typedef {import('../../interfaces/coreServices.js').ISchemaValidator} ISchemaValidator */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../slotGenerator.js').default} SlotGenerator */
/** @typedef {import('../services/entityMatcherService.js').default} EntityMatcherService */

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
  #entityMatcherService;
  #loadFailureValidator;

  constructor({
    dataRegistry,
    anatomyBlueprintRepository,
    schemaValidator,
    slotGenerator,
    entityMatcherService,
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
    validateDependency(entityMatcherService, 'IEntityMatcherService', logger, {
      requiredMethods: [
        'findMatchingEntities',
        'findMatchingEntitiesForSlot',
        'mergePropertyRequirements',
      ],
    });

    this.#dataRegistry = dataRegistry;
    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
    this.#schemaValidator = schemaValidator;
    this.#slotGenerator = slotGenerator;
    this.#entityMatcherService = entityMatcherService;
    this.#logger = logger;
    this.#loadFailures = loadFailures;
    this.#loadFailureValidator = new LoadFailureValidator({ logger });
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

    // 3. Body Descriptors Validation (Critical - P0)
    if (results.errors.length === 0 || !options.failFast) {
      await this.#checkBodyDescriptors(recipe, results);
    }

    // 4. Blueprint Validation (Critical - P0)
    await this.#checkBlueprintExists(recipe, results);

    // 5. Socket/Slot Compatibility (Critical - P0)
    if (this.#blueprintExists(results)) {
      await this.#checkSocketSlotCompatibility(recipe, results);
    }

    // 6. Pattern Matching Dry-Run (Warning - P1)
    if (!options.skipPatternValidation) {
      await this.#checkPatternMatching(recipe, results);
    }

    // 7. Descriptor Coverage (Suggestion - P1)
    if (!options.skipDescriptorChecks) {
      this.#checkDescriptorCoverage(recipe, results);
    }

    // 8. Part Availability (Critical - P0)
    if (!options.skipPartAvailabilityChecks) {
      await this.#checkPartAvailability(recipe, results);
    }

    // 9. Generated Slot Part Availability (Critical - P0)
    // Check that entity definitions exist for ALL slots that patterns will match
    if (!options.skipGeneratedSlotChecks && this.#blueprintExists(results)) {
      await this.#checkGeneratedSlotPartAvailability(recipe, results);
    }

    // 10. Entity Definition Load Failures (Critical - P0)
    // This check runs last to provide context for missing entity definitions
    if (!options.skipLoadFailureChecks) {
      await this.#checkEntityDefinitionLoadFailures(recipe, results, options);
    }

    // 11. Recipe Usage Check (Warning - P1)
    // Verify that entity definitions actually reference this recipe
    if (!options.skipRecipeUsageCheck) {
      this.#checkRecipeUsage(recipe, results);
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

  async #checkBodyDescriptors(recipe, results) {
    try {
      // Get the anatomy:body component definition to retrieve the schema
      const bodyComponent = this.#dataRegistry.get('components', 'anatomy:body');

      if (!bodyComponent) {
        this.#logger.warn('anatomy:body component not found, skipping bodyDescriptors validation');
        return;
      }

      // Extract the descriptors schema from anatomy:body component
      const descriptorsSchema = bodyComponent.dataSchema?.properties?.body?.properties?.descriptors;

      if (!descriptorsSchema) {
        this.#logger.warn(
          'anatomy:body component missing descriptors schema, skipping bodyDescriptors validation'
        );
        return;
      }

      // Get bodyDescriptors from recipe
      const bodyDescriptors = recipe.bodyDescriptors;

      if (!bodyDescriptors || typeof bodyDescriptors !== 'object') {
        // No bodyDescriptors to validate (this is allowed)
        results.passed.push({
          check: 'body_descriptors',
          message: 'No bodyDescriptors to validate',
        });
        return;
      }

      // Validate each descriptor field against the schema
      const errors = [];
      const descriptorProperties = descriptorsSchema.properties || {};

      for (const [descriptorKey, descriptorValue] of Object.entries(bodyDescriptors)) {
        const propertySchema = descriptorProperties[descriptorKey];

        if (!propertySchema) {
          errors.push({
            type: 'UNKNOWN_BODY_DESCRIPTOR',
            severity: 'error',
            field: descriptorKey,
            value: descriptorValue,
            message: `Unknown body descriptor '${descriptorKey}'`,
            fix: `Remove '${descriptorKey}' from bodyDescriptors or add it to the anatomy:body component schema`,
            allowedDescriptors: Object.keys(descriptorProperties),
          });
          continue;
        }

        // Validate enum values
        if (propertySchema.enum) {
          if (!propertySchema.enum.includes(descriptorValue)) {
            errors.push({
              type: 'INVALID_BODY_DESCRIPTOR_VALUE',
              severity: 'error',
              field: descriptorKey,
              value: descriptorValue,
              message: `Invalid value '${descriptorValue}' for body descriptor '${descriptorKey}'`,
              fix: `Use one of the allowed values: ${propertySchema.enum.join(', ')}`,
              allowedValues: propertySchema.enum,
            });
          }
        }

        // Validate type
        if (propertySchema.type && typeof descriptorValue !== propertySchema.type) {
          errors.push({
            type: 'INVALID_BODY_DESCRIPTOR_TYPE',
            severity: 'error',
            field: descriptorKey,
            value: descriptorValue,
            message: `Invalid type for body descriptor '${descriptorKey}': expected ${propertySchema.type}, got ${typeof descriptorValue}`,
            fix: `Change value to type ${propertySchema.type}`,
            expectedType: propertySchema.type,
            actualType: typeof descriptorValue,
          });
        }
      }

      if (errors.length === 0) {
        const descriptorCount = Object.keys(bodyDescriptors).length;
        results.passed.push({
          check: 'body_descriptors',
          message: `All ${descriptorCount} body descriptor(s) valid`,
        });
      } else {
        results.errors.push(...errors);
      }
    } catch (error) {
      this.#logger.error('Body descriptors check failed', error);
      results.errors.push({
        type: 'VALIDATION_ERROR',
        check: 'body_descriptors',
        message: 'Failed to validate body descriptors',
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
        // First check if slot properties have descriptors
        const hasDescriptorsInProperties = this.#hasDescriptorComponents(
          Object.keys(slot.properties || {})
        );

        // If slot has no descriptors in properties, check if preferId entity has descriptors
        let hasDescriptorsInPreferredEntity = false;
        if (!hasDescriptorsInProperties && slot.preferId) {
          hasDescriptorsInPreferredEntity = this.#preferredEntityHasDescriptors(slot.preferId);
        }

        const hasDescriptors = hasDescriptorsInProperties || hasDescriptorsInPreferredEntity;

        if (!hasDescriptors) {
          const reason = slot.preferId
            ? `No descriptor components in slot properties, and preferred entity '${slot.preferId}' has no descriptors`
            : 'No descriptor components in properties';

          suggestions.push({
            type: 'MISSING_DESCRIPTORS',
            location: { type: 'slot', name: slotName },
            message: `Slot '${slotName}' may not appear in descriptions`,
            reason,
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

  /**
   * Checks if a preferred entity (referenced by preferId) has descriptor components
   *
   * @param {string} entityId - Entity ID to check (e.g., 'anatomy:humanoid_head_bearded')
   * @returns {boolean} True if entity has descriptor components
   * @private
   */
  #preferredEntityHasDescriptors(entityId) {
    try {
      // Look up the entity definition in the data registry
      const allEntityDefs = this.#dataRegistry.getAll('entityDefinitions');
      const entityDef = allEntityDefs.find((def) => def.id === entityId);

      if (!entityDef) {
        this.#logger.debug(
          `RecipePreflightValidator: Entity '${entityId}' not found when checking for descriptors`
        );
        return false;
      }

      // Check if any component in the entity starts with 'descriptors:'
      const componentIds = Object.keys(entityDef.components || {});
      return this.#hasDescriptorComponents(componentIds);
    } catch (error) {
      this.#logger.error(
        `Failed to check descriptors for preferred entity '${entityId}'`,
        error
      );
      return false;
    }
  }

  async #checkPartAvailability(recipe, results) {
    try {
      const errors = [];
      const allEntityDefs = this.#dataRegistry.getAll('entityDefinitions');

      // Check slots
      for (const [slotName, slot] of Object.entries(recipe.slots || {})) {
        const matchingEntities = this.#entityMatcherService.findMatchingEntities(
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
        const matchingEntities = this.#entityMatcherService.findMatchingEntities(
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
            properties: this.#entityMatcherService.mergePropertyRequirements(
              pattern.properties || {},
              blueprintSlot.requirements?.properties || {}
            ),
          };

          // Find matching entities
          const matchingEntities = this.#entityMatcherService.findMatchingEntitiesForSlot(
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
   * Run the extracted LoadFailureValidator and merge its output into the legacy result object.
   *
   * @param {object} recipe - Recipe being validated
   * @param {object} results - Aggregated results collection
   * @param {object} options - Validation options
   */
  async #checkEntityDefinitionLoadFailures(recipe, results, options) {
    try {
      const loadFailureResult = await this.#loadFailureValidator.validate(
        recipe,
        {
          recipePath: options.recipePath,
          loadFailures: this.#loadFailures,
        }
      );

      this.#mergeValidatorResult(results, loadFailureResult);
    } catch (error) {
      this.#logger.error('Entity definition load failure check failed', error);
    }
  }

  /**
   * Merge a standalone validator result into the legacy results object.
   *
   * @param {object} targetResults - RecipePreflightValidator results accumulator
   * @param {object} validatorResult - Result produced by BaseValidator subclass
   */
  #mergeValidatorResult(targetResults, validatorResult) {
    if (!validatorResult) {
      return;
    }

    if (Array.isArray(validatorResult.errors)) {
      targetResults.errors.push(...validatorResult.errors);
    }

    if (Array.isArray(validatorResult.warnings)) {
      targetResults.warnings.push(...validatorResult.warnings);
    }

    if (Array.isArray(validatorResult.suggestions)) {
      targetResults.suggestions.push(...validatorResult.suggestions);
    }

    if (Array.isArray(validatorResult.passed)) {
      targetResults.passed.push(...validatorResult.passed);
    }
  }

  /**
   * Check if any entity definitions reference this recipe
   * This helps catch ID mismatches where the recipe exists but with wrong ID
   *
   * @param {object} recipe - Recipe to validate
   * @param {object} results - Validation results object
   */
  #checkRecipeUsage(recipe, results) {
    try {
      const allEntityDefs = this.#dataRegistry.getAll('entityDefinitions');
      const referencingEntities = [];

      // Find all entity definitions that reference this recipe
      for (const entityDef of allEntityDefs) {
        const bodyComponent = entityDef.components?.['anatomy:body'];
        if (bodyComponent?.recipeId === recipe.recipeId) {
          referencingEntities.push(entityDef.id);
        }
      }

      if (referencingEntities.length === 0) {
        results.warnings.push({
          type: 'RECIPE_UNUSED',
          severity: 'warning',
          check: 'recipe_usage',
          message: `Recipe '${recipe.recipeId}' is not referenced by any entity definitions`,
          suggestion: 'Verify that the recipeId matches what entity definitions expect',
          details: {
            recipeId: recipe.recipeId,
            hint: `Entity definitions should have: "anatomy:body": { "recipeId": "${recipe.recipeId}" }`,
          },
        });
      } else {
        results.passed.push({
          check: 'recipe_usage',
          message: `Recipe is referenced by ${referencingEntities.length} entity definition(s)`,
          details: {
            referencingEntities: referencingEntities.slice(0, 5), // Show first 5
            totalCount: referencingEntities.length,
          },
        });
      }
    } catch (error) {
      this.#logger.error('Recipe usage check failed', error);
      // Don't add to results - this is a diagnostic check
    }
  }
}

export default RecipePreflightValidator;
