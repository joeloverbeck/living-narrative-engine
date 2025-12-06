/**
 * @file TargetDependencyResolver - Service for analyzing target dependencies and resolution order
 * @see MultiTargetResolutionStage.js
 */

import { BaseService } from '../base/BaseService.js';
import { ServiceError, ServiceErrorCodes } from '../base/ServiceError.js';

/**
 * @typedef {import('../interfaces/ITargetDependencyResolver.js').TargetDefinition} TargetDefinition
 * @typedef {import('../interfaces/ITargetDependencyResolver.js').ValidationResult} ValidationResult
 * @typedef {import('../interfaces/ITargetDependencyResolver.js').DependencyInfo} DependencyInfo
 */

/**
 * Service for analyzing target definitions and determining resolution order based on dependencies
 *
 * Provides:
 * - Topological sorting algorithm for dependency resolution
 * - Circular dependency detection with clear error messages
 * - Maximum iteration protection to prevent infinite loops
 * - Comprehensive dependency validation
 */
export class TargetDependencyResolver extends BaseService {
  /**
   * @param {object} deps
   * @param {import('../../../../interfaces/coreServices.js').ILogger} deps.logger
   */
  constructor({ logger }) {
    super({ logger });
    this.logOperation('initialized', { service: 'TargetDependencyResolver' });
  }

  /**
   * Analyze target definitions and return resolution order
   *
   * Uses topological sorting to determine the correct order for resolving targets
   * based on their contextFrom dependencies.
   *
   * @param {Object.<string, TargetDefinition>} targetDefinitions - Map of target key to definition
   * @returns {string[]} Dependency-ordered target keys
   * @throws {ServiceError} If circular dependencies detected or invalid definitions
   */
  getResolutionOrder(targetDefinitions) {
    // Validate input parameters
    this.validateParams({ targetDefinitions }, ['targetDefinitions']);

    if (typeof targetDefinitions !== 'object' || targetDefinitions === null) {
      throw new ServiceError(
        'Target definitions must be a non-null object',
        ServiceErrorCodes.VALIDATION_ERROR,
        targetDefinitions
      );
    }

    const targetKeys = Object.keys(targetDefinitions);
    if (targetKeys.length === 0) {
      this.logOperation('getResolutionOrder', { result: 'empty_input' });
      return [];
    }

    this.logOperation('getResolutionOrder', {
      targetCount: targetKeys.length,
      targets: targetKeys,
    });

    try {
      // Validate all target definitions first
      const validationResult = this.validateDependencies(targetDefinitions);
      if (!validationResult.success) {
        throw new ServiceError(
          `Invalid target definitions: ${validationResult.errors.join(', ')}`,
          ServiceErrorCodes.VALIDATION_ERROR,
          validationResult.errors
        );
      }

      // Perform topological sort with cycle detection
      const order = this.#performTopologicalSort(targetDefinitions);

      this.logOperation('getResolutionOrder', {
        result: 'success',
        order,
        orderCount: order.length,
      });

      return order;
    } catch (error) {
      this.logger.error('Failed to determine resolution order', {
        targetDefinitions,
        error: error.message,
      });

      if (error instanceof ServiceError) {
        throw error;
      }

      throw new ServiceError(
        `Resolution order calculation failed: ${error.message}`,
        ServiceErrorCodes.OPERATION_FAILED,
        error
      );
    }
  }

  /**
   * Validate target definitions for dependency issues
   *
   * @param {Object.<string, TargetDefinition>} targetDefinitions
   * @returns {ValidationResult}
   */
  validateDependencies(targetDefinitions) {
    const errors = [];
    const warnings = [];

    if (!targetDefinitions || typeof targetDefinitions !== 'object') {
      return {
        success: false,
        errors: ['Target definitions must be a non-null object'],
        warnings: [],
      };
    }

    const targetKeys = Object.keys(targetDefinitions);

    // Validate each target definition
    for (const [key, targetDef] of Object.entries(targetDefinitions)) {
      // Check required fields
      if (!targetDef || typeof targetDef !== 'object') {
        errors.push(`Target '${key}' must be an object`);
        continue;
      }

      if (!targetDef.scope || typeof targetDef.scope !== 'string') {
        errors.push(`Target '${key}' must have a valid scope string`);
      }

      if (!targetDef.placeholder || typeof targetDef.placeholder !== 'string') {
        errors.push(`Target '${key}' must have a valid placeholder string`);
      }

      // Validate contextFrom references
      if (targetDef.contextFrom) {
        if (typeof targetDef.contextFrom !== 'string') {
          errors.push(`Target '${key}' contextFrom must be a string`);
        } else if (!targetKeys.includes(targetDef.contextFrom)) {
          errors.push(
            `Target '${key}' references unknown contextFrom: '${targetDef.contextFrom}'`
          );
        } else if (targetDef.contextFrom === key) {
          errors.push(`Target '${key}' cannot reference itself in contextFrom`);
        }
      }

      // Optional field validation
      if (targetDef.description && typeof targetDef.description !== 'string') {
        warnings.push(`Target '${key}' description should be a string`);
      }
    }

    const result = {
      success: errors.length === 0,
      errors,
      warnings,
    };

    this.logOperation('validateDependencies', {
      targetCount: targetKeys.length,
      errorCount: errors.length,
      warningCount: warnings.length,
      success: result.success,
    });

    return result;
  }

  /**
   * Perform topological sort with cycle detection
   *
   * This is the core algorithm extracted from MultiTargetResolutionStage.js lines 531-567
   *
   * @param {Object.<string, TargetDefinition>} targetDefs
   * @returns {string[]} Ordered target keys
   * @throws {ServiceError} If circular dependencies detected
   * @private
   */
  #performTopologicalSort(targetDefs) {
    const order = [];
    const pending = new Set(Object.keys(targetDefs));
    const maxIterations = pending.size * 2; // Prevent infinite loops
    let iterations = 0;

    this.logOperation(
      'performTopologicalSort',
      {
        initialPending: Array.from(pending),
        maxIterations,
      },
      'debug'
    );

    while (pending.size > 0 && iterations < maxIterations) {
      iterations++;

      // Find targets with no unresolved dependencies
      const ready = Array.from(pending).filter((key) => {
        const targetDef = targetDefs[key];

        // No dependencies
        if (!targetDef.contextFrom) return true;

        // Dependency already resolved
        return order.includes(targetDef.contextFrom);
      });

      this.logOperation(
        'sortIteration',
        {
          iteration: iterations,
          pending: Array.from(pending),
          ready,
          currentOrder: [...order],
        },
        'debug'
      );

      if (ready.length === 0) {
        // Circular dependency or invalid reference
        const remaining = Array.from(pending);
        const dependencyMap = this.#analyzeDependencyChains(
          targetDefs,
          remaining
        );

        throw new ServiceError(
          `Circular dependency detected in target resolution: ${remaining.join(', ')}. Dependency chains: ${JSON.stringify(dependencyMap)}`,
          ServiceErrorCodes.CIRCULAR_DEPENDENCY,
          {
            remaining,
            dependencyMap,
            iterations,
            partialOrder: [...order],
          }
        );
      }

      // Add ready targets to order
      ready.forEach((key) => {
        order.push(key);
        pending.delete(key);
      });
    }

    if (iterations >= maxIterations) {
      throw new ServiceError(
        `Resolution order calculation exceeded maximum iterations (${maxIterations}). Possible infinite loop.`,
        ServiceErrorCodes.OPERATION_FAILED,
        {
          maxIterations,
          finalOrder: [...order],
          remaining: Array.from(pending),
        }
      );
    }

    return order;
  }

  /**
   * Analyze dependency chains for better error reporting
   *
   * @param {Object.<string, TargetDefinition>} targetDefs
   * @param {string[]} problemTargets
   * @returns {object} Dependency chain analysis
   * @private
   */
  #analyzeDependencyChains(targetDefs, problemTargets) {
    const chains = {};

    for (const target of problemTargets) {
      const chain = [];
      const visited = new Set();
      let current = target;

      while (current && !visited.has(current)) {
        visited.add(current);
        chain.push(current);

        const targetDef = targetDefs[current];
        current = targetDef?.contextFrom;

        // If we've found a cycle
        if (current && chain.includes(current)) {
          const cycleStart = chain.indexOf(current);
          chains[target] = {
            fullChain: chain,
            cycle: chain.slice(cycleStart).concat([current]),
          };
          break;
        }
      }

      if (!chains[target]) {
        chains[target] = {
          fullChain: chain,
          cycle: null,
        };
      }
    }

    return chains;
  }

  /**
   * Get dependency information for all targets
   *
   * @param {Object.<string, TargetDefinition>} targetDefinitions - Map of target key to definition
   * @returns {DependencyInfo[]} Array of dependency information for each target
   */
  getDependencyGraph(targetDefinitions) {
    this.validateParams({ targetDefinitions }, ['targetDefinitions']);

    const dependencyInfoArray = [];

    for (const [key, targetDef] of Object.entries(targetDefinitions)) {
      const dependencies = [];

      if (targetDef.contextFrom && targetDefinitions[targetDef.contextFrom]) {
        dependencies.push(targetDef.contextFrom);
      }

      dependencyInfoArray.push({
        targetKey: key,
        dependencies,
        isOptional: false,
      });
    }

    this.logOperation('getDependencyGraph', {
      targetCount: Object.keys(targetDefinitions).length,
      totalDependencies: dependencyInfoArray.reduce(
        (sum, info) => sum + info.dependencies.length,
        0
      ),
    });

    return dependencyInfoArray;
  }

  /**
   * Check if a specific target has circular dependencies
   *
   * @param {string} targetKey - The target key to check
   * @param {Object.<string, TargetDefinition>} targetDefinitions - Map of target key to definition
   * @returns {boolean} True if circular dependency exists
   */
  hasCircularDependency(targetKey, targetDefinitions) {
    this.validateParams({ targetKey, targetDefinitions }, [
      'targetKey',
      'targetDefinitions',
    ]);
    this.validateNonBlankString(targetKey, 'targetKey');

    if (!targetDefinitions[targetKey]) {
      throw new ServiceError(
        `Target '${targetKey}' not found in definitions`,
        ServiceErrorCodes.VALIDATION_ERROR,
        targetKey
      );
    }

    const recursionStack = new Set();

    const hasCycle = (key) => {
      if (recursionStack.has(key)) {
        return true;
      }

      recursionStack.add(key);

      const targetDef = targetDefinitions[key];
      if (targetDef?.contextFrom && targetDefinitions[targetDef.contextFrom]) {
        if (hasCycle(targetDef.contextFrom)) {
          return true;
        }
      }

      recursionStack.delete(key);
      return false;
    };

    const result = hasCycle(targetKey);

    this.logOperation('hasCircularDependency', {
      targetKey,
      hasCircularDependency: result,
    });

    return result;
  }
}
