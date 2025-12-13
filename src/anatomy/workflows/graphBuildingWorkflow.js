/**
 * @file Workflow for building anatomy graph adjacency cache
 */

import { BaseService } from '../../utils/serviceBase.js';
import { GraphBuildingError } from '../orchestration/anatomyErrorHandler.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';

/** @typedef {import('../../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../bodyGraphService.js').BodyGraphService} BodyGraphService */

/**
 * Workflow responsible for building and managing anatomy graph structures
 * Extracted from AnatomyGenerationService to follow SRP
 */
export class GraphBuildingWorkflow extends BaseService {
  /** @type {IEntityManager} */
  #entityManager;
  /** @type {ILogger} */
  #logger;
  /** @type {BodyGraphService} */
  #bodyGraphService;

  /**
   * @param {object} deps
   * @param {IEntityManager} deps.entityManager
   * @param {ILogger} deps.logger
   * @param {BodyGraphService} deps.bodyGraphService
   */
  constructor({ entityManager, logger, bodyGraphService }) {
    super();
    this.#logger = this._init('GraphBuildingWorkflow', logger, {
      entityManager: {
        value: entityManager,
        requiredMethods: ['getEntityInstance'],
      },
      bodyGraphService: {
        value: bodyGraphService,
        requiredMethods: ['buildAdjacencyCache'],
      },
    });
    this.#entityManager = entityManager;
    this.#bodyGraphService = bodyGraphService;
  }

  /**
   * Builds the adjacency cache for efficient graph traversal
   *
   * @param {string} rootId - The root entity ID of the anatomy graph
   * @returns {Promise<void>}
   * @throws {GraphBuildingError} If cache building fails
   * @throws {InvalidArgumentError} If rootId is invalid
   */
  async buildCache(rootId) {
    if (!rootId) {
      throw new InvalidArgumentError('rootId is required');
    }

    this.#logger.debug(
      `GraphBuildingWorkflow: Building adjacency cache for root entity '${rootId}'`
    );

    try {
      // Validate that the root entity exists
      await this.#validateRootEntity(rootId);

      // Build the adjacency cache
      await this.#bodyGraphService.buildAdjacencyCache(rootId);

      this.#logger.debug(
        `GraphBuildingWorkflow: Successfully built adjacency cache for root entity '${rootId}'`
      );
    } catch (error) {
      if (error instanceof InvalidArgumentError) {
        throw error;
      }

      this.#logger.error(
        `GraphBuildingWorkflow: Failed to build adjacency cache for root entity '${rootId}'`,
        { error: error.message, stack: error.stack }
      );

      throw new GraphBuildingError(
        `Failed to build adjacency cache for root entity '${rootId}': ${error.message}`,
        rootId,
        error
      );
    }
  }

  /**
   * Rebuilds the adjacency cache, useful after modifications
   *
   * @param {string} rootId - The root entity ID of the anatomy graph
   * @returns {Promise<void>}
   * @throws {GraphBuildingError} If cache rebuilding fails
   */
  async rebuildCache(rootId) {
    this.#logger.debug(
      `GraphBuildingWorkflow: Rebuilding adjacency cache for root entity '${rootId}'`
    );

    // Clear any existing cache before rebuilding
    if (this.#bodyGraphService.clearCache) {
      this.#bodyGraphService.clearCache(rootId);
    }

    await this.buildCache(rootId);
  }

  /**
   * Validates that the root entity exists and has proper anatomy structure
   *
   * @private
   * @param {string} rootId - The root entity ID to validate
   * @throws {InvalidArgumentError} If root entity is invalid
   */
  async #validateRootEntity(rootId) {
    const rootEntity = this.#entityManager.getEntityInstance(rootId);

    if (!rootEntity) {
      throw new InvalidArgumentError(
        `Root entity '${rootId}' not found in entity manager`
      );
    }

    // Validate that it's actually an anatomy part
    if (!rootEntity.hasComponent('anatomy:part')) {
      this.#logger.warn(
        `GraphBuildingWorkflow: Root entity '${rootId}' does not have anatomy:part component`
      );
    }

    this.#logger.debug(
      `GraphBuildingWorkflow: Root entity '${rootId}' validated successfully`
    );
  }

  /**
   * Checks if a cache exists for the given root entity
   *
   * @param {string} rootId - The root entity ID to check
   * @returns {boolean} True if cache exists
   */
  hasCacheForRoot(rootId) {
    if (!rootId) {
      return false;
    }

    // This assumes bodyGraphService has a method to check cache existence
    // If not, this would need to be adjusted based on the actual API
    if (this.#bodyGraphService.hasCache) {
      return this.#bodyGraphService.hasCache(rootId);
    }

    // Default to assuming cache doesn't exist if we can't check
    return false;
  }

  /**
   * Validates the integrity of an existing graph cache
   *
   * @param {string} rootId - The root entity ID to validate
   * @returns {Promise<{valid: boolean, issues: string[]}>}
   */
  async validateCache(rootId) {
    const issues = [];

    try {
      // Check if root entity exists
      const rootEntity = this.#entityManager.getEntityInstance(rootId);
      if (!rootEntity) {
        issues.push(`Root entity '${rootId}' not found`);
        return { valid: false, issues };
      }

      // Additional validation could be added here based on bodyGraphService capabilities
      // For example, checking if all referenced entities in the cache still exist
      let serviceReportedInvalid = false;

      if (
        this.#bodyGraphService.validateCache &&
        typeof this.#bodyGraphService.validateCache === 'function'
      ) {
        const serviceResult =
          await this.#bodyGraphService.validateCache(rootId);

        if (Array.isArray(serviceResult?.issues)) {
          issues.push(
            ...serviceResult.issues.filter((issue) => typeof issue === 'string')
          );
        } else if (Array.isArray(serviceResult)) {
          issues.push(
            ...serviceResult.filter((issue) => typeof issue === 'string')
          );
        } else if (typeof serviceResult === 'string') {
          issues.push(serviceResult);
        }

        if (serviceResult?.valid === false) {
          serviceReportedInvalid = true;

          if (!serviceResult?.issues?.length) {
            issues.push(
              `BodyGraphService reported invalid cache state for root entity '${rootId}'`
            );
          }
        }
      }

      const valid = issues.length === 0 && !serviceReportedInvalid;

      if (valid) {
        this.#logger.debug(
          `GraphBuildingWorkflow: Cache for root entity '${rootId}' is valid`
        );
      } else {
        this.#logger.warn(
          `GraphBuildingWorkflow: Cache validation failed for root entity '${rootId}'`,
          { issues }
        );
      }

      return { valid, issues };
    } catch (error) {
      this.#logger.error(
        `GraphBuildingWorkflow: Error during cache validation for root entity '${rootId}'`,
        { error: error.message }
      );
      issues.push(`Validation error: ${error.message}`);
      return { valid: false, issues };
    }
  }
}
