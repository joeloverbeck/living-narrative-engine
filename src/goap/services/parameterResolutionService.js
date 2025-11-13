/**
 * @file Service for resolving parameter references in GOAP execution contexts
 * @see contextAssemblyService.js
 */

import { validateDependency } from '../../utils/dependencyUtils.js';
import ParameterResolutionError from '../errors/parameterResolutionError.js';

/**
 * Resolves string parameter references to actual values from execution context.
 * Supports dot-notation paths (e.g., "task.params.item", "actor.components.core:health.value")
 * with special handling for namespaced component IDs.
 */
class ParameterResolutionService {
  #entityManager;
  #logger;
  #cache;

  /**
   * @param {object} dependencies - Service dependencies
   * @param {object} dependencies.entityManager - Entity manager for validation
   * @param {object} dependencies.logger - Logger instance
   */
  constructor({ entityManager, logger }) {
    validateDependency(entityManager, 'IEntityManager', logger, {
      requiredMethods: ['getEntity', 'hasEntity'],
    });
    validateDependency(logger, 'ILogger', logger, {
      requiredMethods: ['debug', 'info', 'warn', 'error'],
    });

    this.#entityManager = entityManager;
    this.#logger = logger;
    this.#cache = new Map();
  }

  /**
   * Resolve a parameter reference to its value in the execution context.
   *
   * @param {string} reference - Dot-notation reference (e.g., "task.params.item")
   * @param {object} context - Execution context from ContextAssemblyService
   * @param {object} [options] - Resolution options
   * @param {boolean} [options.validateEntity] - Validate entity existence
   * @param {string} [options.contextType] - Context type for error messages
   * @param {number} [options.stepIndex] - Step index for error messages
   * @returns {any} Resolved value
   * @throws {ParameterResolutionError} If resolution fails
   */
  resolve(reference, context, options = {}) {
    const { validateEntity = true, contextType = 'unknown', stepIndex } = options;

    if (typeof reference !== 'string' || reference.trim() === '') {
      throw new ParameterResolutionError({
        reference: reference,
        failedStep: 'validation',
        contextType,
        stepIndex,
      });
    }

    // Check cache
    const cacheKey = `${reference}:${contextType}:${stepIndex ?? 'none'}`;
    if (this.#cache.has(cacheKey)) {
      this.#logger.debug(`Cache hit for parameter: ${reference}`);
      return this.#cache.get(cacheKey);
    }

    this.#logger.debug(`Resolving parameter: ${reference}`, { contextType, stepIndex });

    // Parse reference into path segments
    const segments = this.#parseReference(reference);
    this.#logger.debug(`Parsed segments: ${segments.join(' -> ')}`);

    // Navigate path through context
    let currentValue = context;
    let partialPath = '';
    const resolvedSegments = [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      // Check if current value is navigable
      if (currentValue === null || currentValue === undefined) {
        throw new ParameterResolutionError({
          reference,
          partialPath: resolvedSegments.join('.'),
          failedStep: segment,
          availableKeys: [],
          contextType,
          stepIndex,
        });
      }

      // Check if current value is an object
      if (typeof currentValue !== 'object') {
        throw new ParameterResolutionError({
          reference,
          partialPath: resolvedSegments.join('.'),
          failedStep: segment,
          availableKeys: [],
          contextType,
          stepIndex,
        });
      }

      // Check if property exists
      if (!(segment in currentValue)) {
        const availableKeys = Object.keys(currentValue);
        throw new ParameterResolutionError({
          reference,
          partialPath: resolvedSegments.join('.'),
          failedStep: segment,
          availableKeys,
          contextType,
          stepIndex,
        });
      }

      // Navigate to next level
      currentValue = currentValue[segment];
      resolvedSegments.push(segment);
      partialPath = resolvedSegments.join('.');
    }

    // Optional entity validation
    if (validateEntity && typeof currentValue === 'string') {
      // Check if value looks like an entity ID (contains underscore or colon)
      if (currentValue.includes('_') || currentValue.includes(':')) {
        if (!this.#entityManager.hasEntity(currentValue)) {
          this.#logger.warn(`Resolved entity ID does not exist: ${currentValue}`, {
            reference,
            partialPath,
          });
          throw new ParameterResolutionError({
            reference,
            partialPath,
            failedStep: 'entity_validation',
            availableKeys: [`Entity '${currentValue}' does not exist`],
            contextType,
            stepIndex,
          });
        }
      }
    }

    this.#logger.debug(`Resolved ${reference} to:`, currentValue);

    // Cache result
    this.#cache.set(cacheKey, currentValue);

    return currentValue;
  }

  /**
   * Parse a dot-notation reference into path segments.
   * Preserves colons within segments for namespaced component IDs.
   *
   * @param {string} reference - Reference string (e.g., "actor.components.core:health.value")
   * @returns {string[]} Path segments
   * @private
   */
  #parseReference(reference) {
    // Split on dots, preserving colons within segments
    const segments = reference.split('.').map((s) => s.trim());

    // Filter out empty segments
    return segments.filter((s) => s.length > 0);
  }

  /**
   * Clear the resolution cache.
   * Call this between refinement executions to prevent stale data.
   */
  clearCache() {
    this.#cache.clear();
    this.#logger.debug('Parameter resolution cache cleared');
  }

  /**
   * Resolve multiple references at once.
   *
   * @param {string[]} references - Array of reference strings
   * @param {object} context - Execution context
   * @param {object} [options] - Resolution options
   * @returns {Map<string, any>} Map of reference -> resolved value
   */
  resolveMultiple(references, context, options = {}) {
    const results = new Map();

    for (const reference of references) {
      try {
        const value = this.resolve(reference, context, options);
        results.set(reference, value);
      } catch (err) {
        this.#logger.warn(`Failed to resolve reference: ${reference}`, { error: err.message });
        // Continue resolving other references, don't throw
      }
    }

    return results;
  }
}

export default ParameterResolutionService;
