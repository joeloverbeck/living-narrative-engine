/**
 * @file Error types and handler for anatomy generation operations
 */

/**
 * Error thrown when anatomy generation fails
 *
 * @class
 * @augments {Error}
 */
export class AnatomyGenerationError extends Error {
  /**
   * @param {string} message - The error message describing the generation failure
   * @param {string} [entityId] - The ID of the entity that failed generation
   * @param {string} [recipeId] - The recipe ID that was being used
   * @param {Error} [cause] - The underlying error that caused this failure
   */
  constructor(message, entityId = null, recipeId = null, cause = null) {
    super(message);
    this.name = 'AnatomyGenerationError';
    this.entityId = entityId;
    this.recipeId = recipeId;
    this.cause = cause;
  }
}

/**
 * Error thrown when description generation fails
 *
 * @class
 * @augments {Error}
 */
export class DescriptionGenerationError extends Error {
  /**
   * @param {string} message - The error message describing the description failure
   * @param {string} [entityId] - The ID of the entity that failed description generation
   * @param {string[]} [partIds] - Array of part IDs that failed description generation
   * @param {Error} [cause] - The underlying error that caused this failure
   */
  constructor(message, entityId = null, partIds = null, cause = null) {
    super(message);
    this.name = 'DescriptionGenerationError';
    this.entityId = entityId;
    this.partIds = partIds;
    this.cause = cause;
  }
}

/**
 * Error thrown when graph building fails
 *
 * @class
 * @augments {Error}
 */
export class GraphBuildingError extends Error {
  /**
   * @param {string} message - The error message describing the graph building failure
   * @param {string} [rootId] - The root entity ID of the graph that failed to build
   * @param {Error} [cause] - The underlying error that caused this failure
   */
  constructor(message, rootId = null, cause = null) {
    super(message);
    this.name = 'GraphBuildingError';
    this.rootId = rootId;
    this.cause = cause;
  }
}

/**
 * Handles errors during anatomy operations with context preservation
 */
export class AnatomyErrorHandler {
  /** @type {import('../../interfaces/coreServices.js').ILogger} */
  #logger;

  /**
   * @param {object} deps
   * @param {import('../../interfaces/coreServices.js').ILogger} deps.logger
   */
  constructor({ logger }) {
    this.#logger = logger;
  }

  /**
   * Handles errors with context preservation and logging
   * 
   * @param {Error} error - The error to handle
   * @param {object} context - Additional context about the operation
   * @returns {Error} - The wrapped error with context
   */
  handle(error, context = {}) {
    const errorName = error.name || 'UnknownError';
    const errorMessage = error.message || 'Unknown error occurred';
    
    this.#logger.error(
      `AnatomyErrorHandler: ${errorName} occurred during anatomy operation`,
      {
        error: errorMessage,
        stack: error.stack,
        context,
        ...this.#extractErrorContext(error)
      }
    );

    // Wrap the error with appropriate anatomy-specific error type
    if (error instanceof AnatomyGenerationError ||
        error instanceof DescriptionGenerationError ||
        error instanceof GraphBuildingError) {
      return error; // Already wrapped
    }

    // Determine the appropriate error type based on context
    if (context.operation === 'generation') {
      return new AnatomyGenerationError(
        `Anatomy generation failed: ${errorMessage}`,
        context.entityId,
        context.recipeId,
        error
      );
    } else if (context.operation === 'description') {
      return new DescriptionGenerationError(
        `Description generation failed: ${errorMessage}`,
        context.entityId,
        context.partIds,
        error
      );
    } else if (context.operation === 'graphBuilding') {
      return new GraphBuildingError(
        `Graph building failed: ${errorMessage}`,
        context.rootId,
        error
      );
    }

    // Default to AnatomyGenerationError
    return new AnatomyGenerationError(
      `Anatomy operation failed: ${errorMessage}`,
      context.entityId,
      context.recipeId,
      error
    );
  }

  /**
   * Extracts additional context from known error types
   * 
   * @private
   * @param {Error} error
   * @returns {object}
   */
  #extractErrorContext(error) {
    const context = {};

    if (error instanceof AnatomyGenerationError) {
      context.entityId = error.entityId;
      context.recipeId = error.recipeId;
    } else if (error instanceof DescriptionGenerationError) {
      context.entityId = error.entityId;
      context.partIds = error.partIds;
    } else if (error instanceof GraphBuildingError) {
      context.rootId = error.rootId;
    }

    if (error.cause) {
      context.causedBy = {
        name: error.cause.name,
        message: error.cause.message
      };
    }

    return context;
  }
}