/**
 * @file Interface definition for the Anatomy System Facade
 * @description Provides a simplified, high-level API for anatomy system operations
 * @see src/shared/facades/BaseFacade.js
 * @see src/anatomy/bodyGraphService.js
 * @see src/anatomy/anatomyDescriptionService.js
 */

import BaseFacade from '../../shared/facades/BaseFacade.js';
import { InvalidArgumentError } from '../../errors/invalidArgumentError.js';
import { assertNonBlankString } from '../../utils/dependencyUtils.js';
import { 
  createSuccessResponse, 
  createErrorResponse,
  createQueryResponse,
  createModificationResponse,
  createBulkResponse,
  createValidationResponse,
  createGraphResponse,
  createDescriptionResponse,
  withTiming,
} from '../../shared/facades/types/FacadeResponses.js';
import {
  createQueryOptions,
  createModificationOptions,
  createBulkOptions,
  createValidationOptions,
  createDescriptionOptions,
  mergeOptions,
} from '../../shared/facades/types/FacadeOptions.js';

/** @typedef {import('../../shared/facades/types/FacadeOptions.js').QueryOptions} QueryOptions */
/** @typedef {import('../../shared/facades/types/FacadeOptions.js').ModificationOptions} ModificationOptions */
/** @typedef {import('../../shared/facades/types/FacadeOptions.js').BulkOptions} BulkOptions */
/** @typedef {import('../../shared/facades/types/FacadeOptions.js').ValidationOptions} ValidationOptions */
/** @typedef {import('../../shared/facades/types/FacadeOptions.js').DescriptionOptions} DescriptionOptions */

/**
 * Interface for the Anatomy System Facade
 * Provides simplified access to complex anatomy system functionality
 */
class IAnatomySystemFacade extends BaseFacade {
  #bodyGraphService;
  #anatomyDescriptionService;
  #graphIntegrityValidator;
  #anatomyGenerationService;
  #bodyBlueprintFactory;

  /**
   * @param {object} deps - Dependencies
   * @param {*} deps.bodyGraphService - Body graph service
   * @param {*} deps.anatomyDescriptionService - Anatomy description service
   * @param {*} deps.graphIntegrityValidator - Graph integrity validator
   * @param {*} deps.anatomyGenerationService - Anatomy generation service
   * @param {*} deps.bodyBlueprintFactory - Body blueprint factory
   * @param {*} deps.logger - Logger service
   * @param {*} deps.eventBus - Event bus service
   * @param {*} deps.unifiedCache - Unified cache service
   * @param {*} [deps.circuitBreaker] - Circuit breaker service
   */
  constructor({ 
    bodyGraphService,
    anatomyDescriptionService,
    graphIntegrityValidator,
    anatomyGenerationService,
    bodyBlueprintFactory,
    ...baseDeps 
  }) {
    super(baseDeps);
    
    // Prevent direct instantiation of abstract interface
    if (this.constructor === IAnatomySystemFacade) {
      throw new Error('Cannot instantiate abstract class IAnatomySystemFacade');
    }

    this.#bodyGraphService = bodyGraphService;
    this.#anatomyDescriptionService = anatomyDescriptionService;
    this.#graphIntegrityValidator = graphIntegrityValidator;
    this.#anatomyGenerationService = anatomyGenerationService;
    this.#bodyBlueprintFactory = bodyBlueprintFactory;

    this.logOperation('info', 'AnatomySystemFacade initialized');
  }

  // =============================================================================
  // QUERY OPERATIONS
  // =============================================================================

  /**
   * Get all body parts for an entity
   *
   * @param {string} entityId - Entity identifier
   * @param {QueryOptions} [options] - Query options
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').QueryResponse>}
   */
  async getBodyParts(entityId, options = {}) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'getBodyParts', this);

      const queryOptions = mergeOptions(createQueryOptions(), options);
      const cacheKey = `anatomy:parts:${entityId}:${JSON.stringify(queryOptions)}`;

      return await this.cacheableOperation(cacheKey, async () => {
        const parts = await this.executeWithResilience(
          'getBodyParts',
          async () => await this.#bodyGraphService.getBodyParts(entityId, queryOptions),
          async () => [], // Fallback to empty array
        );

        // Apply filters and sorting if specified
        let filteredParts = parts;
        if (queryOptions.filters) {
          filteredParts = this.#applyFilters(parts, queryOptions.filters);
        }

        if (queryOptions.sortBy) {
          filteredParts = this.#sortItems(filteredParts, queryOptions.sortBy, queryOptions.sortOrder);
        }

        // Apply pagination
        const total = filteredParts.length;
        const offset = queryOptions.offset || 0;
        const limit = queryOptions.limit;
        
        let paginatedParts = filteredParts;
        if (limit) {
          paginatedParts = filteredParts.slice(offset, offset + limit);
        }

        const pagination = {
          total,
          count: paginatedParts.length,
          offset,
          hasMore: limit ? (offset + limit) < total : false,
          limit,
        };

        return createQueryResponse(paginatedParts, pagination, 'getBodyParts', {
          requestId: queryOptions.requestId,
          cached: false,
          cacheKey,
          filters: queryOptions.filters,
          sortBy: queryOptions.sortBy,
          sortOrder: queryOptions.sortOrder,
        });
      }, { ttl: queryOptions.ttl });
    }, 'getBodyParts', { requestId: options.requestId });
  }

  /**
   * Get the complete body graph for an entity
   *
   * @param {string} entityId - Entity identifier
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').GraphResponse>}
   */
  async getBodyGraph(entityId) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'getBodyGraph', this);

      const cacheKey = `anatomy:graph:${entityId}`;

      return await this.cacheableOperation(cacheKey, async () => {
        const graph = await this.executeWithResilience(
          'getBodyGraph',
          async () => await this.#bodyGraphService.buildGraph(entityId),
          async () => ({ nodes: [], edges: [], properties: {} }), // Fallback to empty graph
        );

        // Get graph analysis
        const analysis = await this.executeWithResilience(
          'analyzeBodyGraph',
          async () => await this.#bodyGraphService.analyzeGraph(graph),
          async () => ({}), // Fallback to empty analysis
        );

        const graphData = {
          nodes: graph.nodes || [],
          edges: graph.edges || [],
          properties: graph.properties || {},
        };

        return createSuccessResponse(graphData, 'getBodyGraph', {
          cached: false,
          cacheKey,
          analysis,
        });
      });
    }, 'getBodyGraph');
  }

  /**
   * Get body parts of a specific type
   *
   * @param {string} entityId - Entity identifier
   * @param {string} partType - Type of body part to retrieve
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').QueryResponse>}
   */
  async getPartByType(entityId, partType) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'getPartByType', this);
      assertNonBlankString(partType, 'Part type', 'getPartByType', this);

      const cacheKey = `anatomy:parts-by-type:${entityId}:${partType}`;

      return await this.cacheableOperation(cacheKey, async () => {
        const parts = await this.executeWithResilience(
          'getPartByType',
          async () => await this.#bodyGraphService.getPartsByType(entityId, partType),
          async () => [], // Fallback to empty array
        );

        const pagination = {
          total: parts.length,
          count: parts.length,
          offset: 0,
          hasMore: false,
        };

        return createQueryResponse(parts, pagination, 'getPartByType', {
          cached: false,
          cacheKey,
          filters: { partType },
        });
      });
    }, 'getPartByType');
  }

  /**
   * Get parts connected to a specific part
   *
   * @param {string} entityId - Entity identifier
   * @param {string} partId - Part identifier
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').QueryResponse>}
   */
  async getConnectedParts(entityId, partId) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'getConnectedParts', this);
      assertNonBlankString(partId, 'Part ID', 'getConnectedParts', this);

      const cacheKey = `anatomy:connected-parts:${entityId}:${partId}`;

      return await this.cacheableOperation(cacheKey, async () => {
        const connectedParts = await this.executeWithResilience(
          'getConnectedParts',
          async () => await this.#bodyGraphService.getConnectedParts(entityId, partId),
          async () => [], // Fallback to empty array
        );

        const pagination = {
          total: connectedParts.length,
          count: connectedParts.length,
          offset: 0,
          hasMore: false,
        };

        return createQueryResponse(connectedParts, pagination, 'getConnectedParts', {
          cached: false,
          cacheKey,
          filters: { connectedTo: partId },
        });
      });
    }, 'getConnectedParts');
  }

  // =============================================================================
  // MODIFICATION OPERATIONS
  // =============================================================================

  /**
   * Attach a body part to a parent part
   *
   * @param {string} entityId - Entity identifier
   * @param {string} partId - Part identifier to attach
   * @param {string} parentPartId - Parent part identifier
   * @param {ModificationOptions} [options] - Modification options
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').ModificationResponse>}
   */
  async attachPart(entityId, partId, parentPartId, options = {}) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'attachPart', this);
      assertNonBlankString(partId, 'Part ID', 'attachPart', this);
      assertNonBlankString(parentPartId, 'Parent Part ID', 'attachPart', this);

      const modOptions = mergeOptions(createModificationOptions(), options);

      const result = await this.executeWithResilience(
        'attachPart',
        async () => {
          // Validate attachment if required
          if (modOptions.validate && !modOptions.force) {
            const validation = await this.#graphIntegrityValidator.validateAttachment(
              entityId, 
              partId, 
              parentPartId
            );
            
            if (!validation.valid) {
              throw new InvalidArgumentError(`Invalid attachment: ${validation.errors.join(', ')}`);
            }
          }

          // Execute attachment
          const attachResult = await this.#bodyGraphService.attachPart(
            entityId, 
            partId, 
            parentPartId, 
            modOptions
          );

          // Invalidate related caches
          await this.invalidateCache(`anatomy:graph:${entityId}`);
          await this.invalidateCache(`anatomy:parts:${entityId}:*`, true);
          await this.invalidateCache(`anatomy:connected-parts:${entityId}:${parentPartId}`);

          return attachResult;
        },
      );

      const changes = {
        added: [{ partId, parentPartId, entityId }],
        removed: [],
        modified: [{ entityId, type: 'graph-structure' }],
      };

      // Dispatch attachment event
      if (modOptions.notifyOnChange) {
        this.dispatchEvent('ANATOMY_PART_ATTACHED', {
          entityId,
          partId,
          parentPartId,
          timestamp: Date.now(),
        });
      }

      return createModificationResponse(result, changes, 'attachPart', {
        requestId: modOptions.requestId,
        rollbackAvailable: true,
      });
    }, 'attachPart', { requestId: options.requestId });
  }

  /**
   * Detach a body part from its parent
   *
   * @param {string} entityId - Entity identifier
   * @param {string} partId - Part identifier to detach
   * @param {ModificationOptions} [options] - Modification options
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').ModificationResponse>}
   */
  async detachPart(entityId, partId, options = {}) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'detachPart', this);
      assertNonBlankString(partId, 'Part ID', 'detachPart', this);

      const modOptions = mergeOptions(createModificationOptions(), options);

      const result = await this.executeWithResilience(
        'detachPart',
        async () => {
          // Get current parent for event dispatching
          const connectedParts = await this.getConnectedParts(entityId, partId);
          const parentPart = connectedParts.data.find(p => p.relationship === 'parent');

          // Execute detachment
          const detachResult = await this.#bodyGraphService.detachPart(entityId, partId, modOptions);

          // Invalidate related caches
          await this.invalidateCache(`anatomy:graph:${entityId}`);
          await this.invalidateCache(`anatomy:parts:${entityId}:*`, true);
          if (parentPart) {
            await this.invalidateCache(`anatomy:connected-parts:${entityId}:${parentPart.partId}`);
          }

          return { ...detachResult, previousParent: parentPart };
        },
      );

      const changes = {
        added: [],
        removed: [{ partId, parentPartId: result.previousParent?.partId, entityId }],
        modified: [{ entityId, type: 'graph-structure' }],
      };

      // Dispatch detachment event
      if (modOptions.notifyOnChange) {
        this.dispatchEvent('ANATOMY_PART_DETACHED', {
          entityId,
          partId,
          previousParentId: result.previousParent?.partId,
          timestamp: Date.now(),
        });
      }

      return createModificationResponse(result, changes, 'detachPart', {
        requestId: modOptions.requestId,
        rollbackAvailable: true,
      });
    }, 'detachPart', { requestId: options.requestId });
  }

  /**
   * Replace an existing body part with a new one
   *
   * @param {string} entityId - Entity identifier
   * @param {string} oldPartId - Identifier of part to replace
   * @param {string} newPartId - Identifier of new part
   * @param {ModificationOptions} [options] - Modification options
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').ModificationResponse>}
   */
  async replacePart(entityId, oldPartId, newPartId, options = {}) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'replacePart', this);
      assertNonBlankString(oldPartId, 'Old Part ID', 'replacePart', this);
      assertNonBlankString(newPartId, 'New Part ID', 'replacePart', this);

      const modOptions = mergeOptions(createModificationOptions(), options);

      const result = await this.executeWithResilience(
        'replacePart',
        async () => {
          // Get connections of the old part for proper replacement
          const oldConnections = await this.getConnectedParts(entityId, oldPartId);

          // Execute replacement
          const replaceResult = await this.#bodyGraphService.replacePart(
            entityId, 
            oldPartId, 
            newPartId, 
            modOptions
          );

          // Invalidate related caches
          await this.invalidateCache(`anatomy:graph:${entityId}`);
          await this.invalidateCache(`anatomy:parts:${entityId}:*`, true);
          
          // Invalidate connected parts caches
          for (const connection of oldConnections.data) {
            await this.invalidateCache(`anatomy:connected-parts:${entityId}:${connection.partId}`);
          }

          return { ...replaceResult, oldConnections: oldConnections.data };
        },
      );

      const changes = {
        added: [{ partId: newPartId, entityId }],
        removed: [{ partId: oldPartId, entityId }],
        modified: [{ entityId, type: 'part-replacement' }],
      };

      // Dispatch replacement event
      if (modOptions.notifyOnChange) {
        this.dispatchEvent('ANATOMY_PART_REPLACED', {
          entityId,
          oldPartId,
          newPartId,
          timestamp: Date.now(),
        });
      }

      return createModificationResponse(result, changes, 'replacePart', {
        requestId: modOptions.requestId,
        rollbackAvailable: true,
      });
    }, 'replacePart', { requestId: options.requestId });
  }

  /**
   * Modify properties of an existing body part
   *
   * @param {string} entityId - Entity identifier
   * @param {string} partId - Part identifier
   * @param {object} modifications - Modifications to apply
   * @param {ModificationOptions} [options] - Modification options
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').ModificationResponse>}
   */
  async modifyPart(entityId, partId, modifications, options = {}) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'modifyPart', this);
      assertNonBlankString(partId, 'Part ID', 'modifyPart', this);

      if (!modifications || typeof modifications !== 'object') {
        throw new InvalidArgumentError('Modifications must be an object');
      }

      const modOptions = mergeOptions(createModificationOptions(), options);

      const result = await this.executeWithResilience(
        'modifyPart',
        async () => {
          // Execute modification
          const modifyResult = await this.#bodyGraphService.modifyPart(
            entityId, 
            partId, 
            modifications, 
            modOptions
          );

          // Invalidate related caches
          await this.invalidateCache(`anatomy:parts:${entityId}:*`, true);
          await this.invalidateCache(`anatomy:connected-parts:${entityId}:${partId}`);

          return modifyResult;
        },
      );

      const changes = {
        added: [],
        removed: [],
        modified: [{ partId, entityId, modifications: Object.keys(modifications) }],
      };

      // Dispatch modification event
      if (modOptions.notifyOnChange) {
        this.dispatchEvent('ANATOMY_PART_MODIFIED', {
          entityId,
          partId,
          modificationKeys: Object.keys(modifications),
          timestamp: Date.now(),
        });
      }

      return createModificationResponse(result, changes, 'modifyPart', {
        requestId: modOptions.requestId,
        rollbackAvailable: true,
      });
    }, 'modifyPart', { requestId: options.requestId });
  }

  // =============================================================================
  // GRAPH OPERATIONS
  // =============================================================================

  /**
   * Build a complete body graph from a blueprint
   *
   * @param {string} entityId - Entity identifier
   * @param {object} blueprint - Body blueprint definition
   * @param {ModificationOptions} [options] - Modification options
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').GraphResponse>}
   */
  async buildBodyGraph(entityId, blueprint, options = {}) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'buildBodyGraph', this);

      if (!blueprint || typeof blueprint !== 'object') {
        throw new InvalidArgumentError('Blueprint must be an object');
      }

      const modOptions = mergeOptions(createModificationOptions(), options);

      const result = await this.executeWithResilience(
        'buildBodyGraph',
        async () => {
          // Validate blueprint if required
          if (modOptions.validate && !modOptions.force) {
            const validation = await this.#bodyBlueprintFactory.validateBlueprint(blueprint);
            if (!validation.valid) {
              throw new InvalidArgumentError(`Invalid blueprint: ${validation.errors.join(', ')}`);
            }
          }

          // Build the graph
          const buildResult = await this.#anatomyGenerationService.buildFromBlueprint(
            entityId, 
            blueprint, 
            modOptions
          );

          // Invalidate all anatomy caches for this entity
          await this.invalidateCache(`anatomy:*:${entityId}:*`, true);

          return buildResult;
        },
      );

      // Get the final graph for response
      const finalGraph = await this.getBodyGraph(entityId);

      // Dispatch build event
      if (modOptions.notifyOnChange) {
        this.dispatchEvent('ANATOMY_GRAPH_BUILT', {
          entityId,
          blueprintType: blueprint.type || 'custom',
          partCount: finalGraph.data.nodes.length,
          timestamp: Date.now(),
        });
      }

      return createSuccessResponse(finalGraph.data, 'buildBodyGraph', {
        requestId: modOptions.requestId,
        analysis: finalGraph.analysis,
        blueprintUsed: blueprint.type || 'custom',
      });
    }, 'buildBodyGraph', { requestId: options.requestId });
  }

  /**
   * Validate the integrity of a body graph
   *
   * @param {string} entityId - Entity identifier
   * @param {ValidationOptions} [options] - Validation options
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').ValidationResponse>}
   */
  async validateGraph(entityId, options = {}) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'validateGraph', this);

      const validationOptions = mergeOptions(createValidationOptions(), options);

      const validation = await this.executeWithResilience(
        'validateGraph',
        async () => {
          return await this.#graphIntegrityValidator.validateEntityGraph(entityId, validationOptions);
        },
        async () => ({ 
          valid: false, 
          errors: [{ message: 'Graph validation service unavailable' }] 
        }),
      );

      return createValidationResponse(validation, 'validateGraph', {
        requestId: validationOptions.requestId,
        autoFixApplied: validationOptions.fixIssues && validation.autoFixed,
      });
    }, 'validateGraph', { requestId: options.requestId });
  }

  /**
   * Get graph constraints for an entity
   *
   * @param {string} entityId - Entity identifier
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').ItemResponse>}
   */
  async getGraphConstraints(entityId) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'getGraphConstraints', this);

      const cacheKey = `anatomy:constraints:${entityId}`;

      return await this.cacheableOperation(cacheKey, async () => {
        const constraints = await this.executeWithResilience(
          'getGraphConstraints',
          async () => await this.#bodyGraphService.getConstraints(entityId),
          async () => ({ rules: [], limits: {} }), // Fallback to empty constraints
        );

        return createSuccessResponse(constraints, 'getGraphConstraints', {
          cached: false,
          cacheKey,
        });
      });
    }, 'getGraphConstraints');
  }

  // =============================================================================
  // DESCRIPTION OPERATIONS
  // =============================================================================

  /**
   * Generate a description of the entity's anatomy
   *
   * @param {string} entityId - Entity identifier
   * @param {DescriptionOptions} [options] - Description options
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').DescriptionResponse>}
   */
  async generateDescription(entityId, options = {}) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'generateDescription', this);

      const descriptionOptions = mergeOptions(createDescriptionOptions(), options);
      const cacheKey = `anatomy:description:${entityId}:${JSON.stringify(descriptionOptions)}`;

      return await this.cacheableOperation(cacheKey, async () => {
        const description = await this.executeWithResilience(
          'generateDescription',
          async () => {
            return await this.#anatomyDescriptionService.generateEntityDescription(
              entityId, 
              descriptionOptions
            );
          },
          async () => ({ 
            description: 'Description unavailable', 
            style: descriptionOptions.style,
            perspective: descriptionOptions.perspective 
          }),
        );

        const descriptionData = {
          description: description.text || description.description,
          style: descriptionOptions.style,
          perspective: descriptionOptions.perspective,
          context: descriptionOptions.context,
          focusAreas: descriptionOptions.focus,
        };

        return createSuccessResponse(descriptionData, 'generateDescription', {
          cached: false,
          cacheKey,
          generationMetadata: description.metadata,
        });
      }, { ttl: descriptionOptions.ttl });
    }, 'generateDescription', { requestId: options.requestId });
  }

  /**
   * Get description of a specific body part
   *
   * @param {string} entityId - Entity identifier
   * @param {string} partId - Part identifier
   * @param {DescriptionOptions} [options] - Description options
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').DescriptionResponse>}
   */
  async getPartDescription(entityId, partId, options = {}) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'getPartDescription', this);
      assertNonBlankString(partId, 'Part ID', 'getPartDescription', this);

      const descriptionOptions = mergeOptions(createDescriptionOptions(), options);
      const cacheKey = `anatomy:part-description:${entityId}:${partId}:${JSON.stringify(descriptionOptions)}`;

      return await this.cacheableOperation(cacheKey, async () => {
        const description = await this.executeWithResilience(
          'getPartDescription',
          async () => {
            return await this.#anatomyDescriptionService.generatePartDescription(
              entityId, 
              partId, 
              descriptionOptions
            );
          },
          async () => ({ 
            description: 'Part description unavailable',
            partId,
            style: descriptionOptions.style 
          }),
        );

        const descriptionData = {
          description: description.text || description.description,
          partId,
          style: descriptionOptions.style,
          perspective: descriptionOptions.perspective,
          context: descriptionOptions.context,
        };

        return createSuccessResponse(descriptionData, 'getPartDescription', {
          cached: false,
          cacheKey,
          generationMetadata: description.metadata,
        });
      }, { ttl: descriptionOptions.ttl });
    }, 'getPartDescription', { requestId: options.requestId });
  }

  // =============================================================================
  // BULK OPERATIONS
  // =============================================================================

  /**
   * Attach multiple parts at once
   *
   * @param {string} entityId - Entity identifier
   * @param {object[]} parts - Array of {partId, parentPartId} objects
   * @param {BulkOptions} [options] - Bulk operation options
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').BulkResponse>}
   */
  async attachMultipleParts(entityId, parts, options = {}) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'attachMultipleParts', this);

      if (!Array.isArray(parts)) {
        throw new InvalidArgumentError('Parts must be an array');
      }

      const bulkOptions = mergeOptions(createBulkOptions(), options);
      const results = { processed: 0, successful: 0, failed: 0, results: [], errors: [] };

      for (let i = 0; i < parts.length; i += bulkOptions.batchSize) {
        const batch = parts.slice(i, i + bulkOptions.batchSize);
        
        const batchPromises = batch.map(async (part) => {
          try {
            const result = await this.attachPart(
              entityId, 
              part.partId, 
              part.parentPartId, 
              bulkOptions
            );
            results.successful++;
            if (bulkOptions.returnResults) {
              results.results.push({ part, result, success: true });
            }
          } catch (error) {
            results.failed++;
            results.errors.push({ part, error: error.message });
            if (bulkOptions.returnResults) {
              results.results.push({ part, error: error.message, success: false });
            }
            
            if (bulkOptions.stopOnError) {
              throw error;
            }
          }
        });

        if (bulkOptions.parallel) {
          await Promise.allSettled(batchPromises);
        } else {
          for (const promise of batchPromises) {
            await promise;
          }
        }

        results.processed += batch.length;

        // Call progress callback if provided
        if (bulkOptions.onProgress) {
          bulkOptions.onProgress({
            processed: results.processed,
            total: parts.length,
            successful: results.successful,
            failed: results.failed,
          });
        }
      }

      // Dispatch bulk event
      this.dispatchEvent('ANATOMY_BULK_ATTACH_COMPLETED', {
        entityId,
        partCount: parts.length,
        successful: results.successful,
        failed: results.failed,
        timestamp: Date.now(),
      });

      return createBulkResponse(results, 'attachMultipleParts', {
        requestId: bulkOptions.requestId,
        partial: results.failed > 0,
      });
    }, 'attachMultipleParts', { requestId: options.requestId });
  }

  /**
   * Detach multiple parts at once
   *
   * @param {string} entityId - Entity identifier
   * @param {string[]} partIds - Array of part identifiers
   * @param {BulkOptions} [options] - Bulk operation options
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').BulkResponse>}
   */
  async detachMultipleParts(entityId, partIds, options = {}) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'detachMultipleParts', this);

      if (!Array.isArray(partIds)) {
        throw new InvalidArgumentError('Part IDs must be an array');
      }

      const bulkOptions = mergeOptions(createBulkOptions(), options);
      const results = { processed: 0, successful: 0, failed: 0, results: [], errors: [] };

      for (let i = 0; i < partIds.length; i += bulkOptions.batchSize) {
        const batch = partIds.slice(i, i + bulkOptions.batchSize);
        
        const batchPromises = batch.map(async (partId) => {
          try {
            const result = await this.detachPart(entityId, partId, bulkOptions);
            results.successful++;
            if (bulkOptions.returnResults) {
              results.results.push({ partId, result, success: true });
            }
          } catch (error) {
            results.failed++;
            results.errors.push({ partId, error: error.message });
            if (bulkOptions.returnResults) {
              results.results.push({ partId, error: error.message, success: false });
            }
            
            if (bulkOptions.stopOnError) {
              throw error;
            }
          }
        });

        if (bulkOptions.parallel) {
          await Promise.allSettled(batchPromises);
        } else {
          for (const promise of batchPromises) {
            await promise;
          }
        }

        results.processed += batch.length;

        // Call progress callback if provided
        if (bulkOptions.onProgress) {
          bulkOptions.onProgress({
            processed: results.processed,
            total: partIds.length,
            successful: results.successful,
            failed: results.failed,
          });
        }
      }

      // Dispatch bulk event
      this.dispatchEvent('ANATOMY_BULK_DETACH_COMPLETED', {
        entityId,
        partCount: partIds.length,
        successful: results.successful,
        failed: results.failed,
        timestamp: Date.now(),
      });

      return createBulkResponse(results, 'detachMultipleParts', {
        requestId: bulkOptions.requestId,
        partial: results.failed > 0,
      });
    }, 'detachMultipleParts', { requestId: options.requestId });
  }

  /**
   * Rebuild entity anatomy from a new blueprint
   *
   * @param {string} entityId - Entity identifier
   * @param {object} blueprint - New blueprint definition
   * @param {ModificationOptions} [options] - Modification options
   * @returns {Promise<import('../../shared/facades/types/FacadeResponses.js').GraphResponse>}
   */
  async rebuildFromBlueprint(entityId, blueprint, options = {}) {
    return await withTiming(async () => {
      assertNonBlankString(entityId, 'Entity ID', 'rebuildFromBlueprint', this);

      if (!blueprint || typeof blueprint !== 'object') {
        throw new InvalidArgumentError('Blueprint must be an object');
      }

      const modOptions = mergeOptions(createModificationOptions(), options);

      const result = await this.executeWithResilience(
        'rebuildFromBlueprint',
        async () => {
          // Get current state for rollback if needed
          const currentGraph = await this.getBodyGraph(entityId);

          // Clear existing anatomy if cascade option is true
          if (modOptions.cascade) {
            await this.#anatomyGenerationService.clearEntityAnatomy(entityId);
          }

          // Build new anatomy
          const rebuildResult = await this.buildBodyGraph(entityId, blueprint, {
            ...modOptions,
            notifyOnChange: false, // We'll dispatch our own event
          });

          // Invalidate all caches
          await this.invalidateCache(`anatomy:*:${entityId}:*`, true);

          return {
            ...rebuildResult.data,
            previousGraph: currentGraph.data,
            blueprint: blueprint,
          };
        },
      );

      // Dispatch rebuild event
      if (modOptions.notifyOnChange) {
        this.dispatchEvent('ANATOMY_GRAPH_REBUILT', {
          entityId,
          blueprintType: blueprint.type || 'custom',
          partCount: result.nodes.length,
          timestamp: Date.now(),
        });
      }

      return createSuccessResponse(result, 'rebuildFromBlueprint', {
        requestId: modOptions.requestId,
        rollbackAvailable: true,
        blueprintUsed: blueprint.type || 'custom',
      });
    }, 'rebuildFromBlueprint', { requestId: options.requestId });
  }

  // =============================================================================
  // PRIVATE HELPER METHODS
  // =============================================================================

  /**
   * Apply filters to a collection of items
   *
   * @private
   * @param {object[]} items - Items to filter
   * @param {object} filters - Filter criteria
   * @returns {object[]} Filtered items
   */
  #applyFilters(items, filters) {
    return items.filter(item => {
      for (const [key, value] of Object.entries(filters)) {
        if (item[key] !== value) {
          return false;
        }
      }
      return true;
    });
  }

  /**
   * Sort items by a specific field
   *
   * @private
   * @param {object[]} items - Items to sort
   * @param {string} sortBy - Field to sort by
   * @param {string} [sortOrder] - Sort order
   * @returns {object[]} Sorted items
   */
  #sortItems(items, sortBy, sortOrder = 'asc') {
    return [...items].sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      
      if (aValue < bValue) {
        return sortOrder === 'asc' ? -1 : 1;
      }
      if (aValue > bValue) {
        return sortOrder === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }
}

export default IAnatomySystemFacade;