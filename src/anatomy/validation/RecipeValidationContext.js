/**
 * @file RecipeValidationContext.js
 * @description Immutable context object for recipe validation dependency injection.
 * Provides a clean abstraction for passing validation dependencies to recipe validators,
 * replacing ad-hoc parameter passing with a structured, immutable context.
 * Key Features:
 * - Immutable dependency injection
 * - Metadata sharing between validators
 * - Context derivation for configuration overrides
 * - Strict dependency validation
 * @see src/anatomy/validation/RecipeValidationRunner.js - Will consume this context
 * @see src/interfaces/IRecipeValidator.js - Validators receive context via options
 */

import { validateDependency } from '../../utils/dependencyUtils.js';

/**
 * Immutable context for recipe validation operations.
 *
 * This context encapsulates all dependencies needed by recipe validators,
 * providing a clean dependency injection mechanism and shared state management.
 *
 * @class RecipeValidationContext
 */
class RecipeValidationContext {
  // Private fields for immutability
  #dataRegistry;
  #schemaValidator;
  #anatomyBlueprintRepository;
  #slotGenerator;
  #logger;
  #config;
  #metadata;

  /**
   * Creates a new RecipeValidationContext.
   *
   * @param {object} params - Context parameters
   * @param {object} params.dataRegistry - Component/action data registry
   * @param {object} params.schemaValidator - Schema validation service
   * @param {object} params.anatomyBlueprintRepository - Blueprint/recipe repository
   * @param {object} params.slotGenerator - Socket/slot extraction service
   * @param {object} params.logger - Logging service
   * @param {object} params.config - Optional configuration object
   * @throws {Error} If any required dependency is missing or invalid
   */
  constructor({
    dataRegistry,
    schemaValidator,
    anatomyBlueprintRepository,
    slotGenerator,
    logger,
    config = {},
  }) {
    // Validate all required dependencies
    validateDependency(dataRegistry, 'IDataRegistry', console, {
      requiredMethods: ['get', 'getAll'],
    });

    validateDependency(schemaValidator, 'ISchemaValidator', console, {
      requiredMethods: ['validate'],
    });

    validateDependency(
      anatomyBlueprintRepository,
      'IAnatomyBlueprintRepository',
      console,
      {
        requiredMethods: ['getBlueprint', 'getRecipe'],
      }
    );

    validateDependency(slotGenerator, 'ISlotGenerator', console, {
      requiredMethods: ['generateSlots'],
    });

    validateDependency(logger, 'ILogger', console, {
      requiredMethods: ['info', 'warn', 'error', 'debug'],
    });

    // Store dependencies in private fields
    this.#dataRegistry = dataRegistry;
    this.#schemaValidator = schemaValidator;
    this.#anatomyBlueprintRepository = anatomyBlueprintRepository;
    this.#slotGenerator = slotGenerator;
    this.#logger = logger;

    // Freeze config to ensure immutability
    this.#config = Object.freeze({ ...config });

    // Initialize metadata storage
    this.#metadata = new Map();
  }

  /**
   * Gets the data registry dependency.
   *
   * @returns {object} The data registry for component/action lookups
   */
  get dataRegistry() {
    return this.#dataRegistry;
  }

  /**
   * Gets the schema validator dependency.
   *
   * @returns {object} The schema validation service
   */
  get schemaValidator() {
    return this.#schemaValidator;
  }

  /**
   * Gets the anatomy blueprint repository dependency.
   *
   * @returns {object} The blueprint/recipe repository
   */
  get anatomyBlueprintRepository() {
    return this.#anatomyBlueprintRepository;
  }

  /**
   * Gets the slot generator dependency.
   *
   * @returns {object} The socket/slot extraction service
   */
  get slotGenerator() {
    return this.#slotGenerator;
  }

  /**
   * Gets the logger dependency.
   *
   * @returns {object} The logging service
   */
  get logger() {
    return this.#logger;
  }

  /**
   * Gets the frozen configuration object.
   *
   * @returns {object} Immutable configuration object
   */
  get config() {
    return this.#config;
  }

  /**
   * Stores metadata for sharing state between validators.
   * Metadata allows validators to share computation results or state
   * without tightly coupling to each other.
   *
   * @param {string} key - Metadata key
   * @param {unknown} value - Metadata value
   * @example
   * context.setMetadata('validatedComponents', new Set(['core:actor']));
   */
  setMetadata(key, value) {
    this.#metadata.set(key, value);
  }

  /**
   * Retrieves metadata by key.
   *
   * @param {string} key - Metadata key
   * @returns {unknown} The metadata value, or undefined if not found
   * @example
   * const components = context.getMetadata('validatedComponents');
   */
  getMetadata(key) {
    return this.#metadata.get(key);
  }

  /**
   * Checks if metadata exists for the given key.
   *
   * @param {string} key - Metadata key
   * @returns {boolean} True if metadata exists, false otherwise
   * @example
   * if (context.hasMetadata('validatedComponents')) {
   *   // Use cached results
   * }
   */
  hasMetadata(key) {
    return this.#metadata.has(key);
  }

  /**
   * Creates a new context with merged configuration.
   * This allows creating derived contexts with configuration overrides
   * while preserving the original context's immutability.
   * Dependencies are shared with the new context, but config is merged
   * and metadata is isolated (new context has empty metadata).
   *
   * @param {object} configUpdates - Configuration updates to merge
   * @returns {RecipeValidationContext} New context with merged config
   * @example
   * const strictContext = context.withConfig({ strictMode: true });
   * // Original context unchanged, new context has strictMode enabled
   */
  withConfig(configUpdates) {
    return new RecipeValidationContext({
      dataRegistry: this.#dataRegistry,
      schemaValidator: this.#schemaValidator,
      anatomyBlueprintRepository: this.#anatomyBlueprintRepository,
      slotGenerator: this.#slotGenerator,
      logger: this.#logger,
      config: { ...this.#config, ...configUpdates },
    });
  }
}

export default RecipeValidationContext;
