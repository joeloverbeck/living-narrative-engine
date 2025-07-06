// src/logic/jsonLogicCustomOperators.js

import { BaseService } from '../utils/serviceBase.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../anatomy/bodyGraphService.js').BodyGraphService} BodyGraphService */
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * @class JsonLogicCustomOperators
 * @description Service responsible for registering custom JSON Logic operators
 */
export class JsonLogicCustomOperators extends BaseService {
  /** @private @type {ILogger} */
  #logger;
  /** @private @type {BodyGraphService} */
  #bodyGraphService;
  /** @private @type {IEntityManager} */
  #entityManager;

  /**
   * Creates an instance of JsonLogicCustomOperators
   *
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger
   * @param {BodyGraphService} dependencies.bodyGraphService
   * @param {IEntityManager} dependencies.entityManager
   */
  constructor({ logger, bodyGraphService, entityManager }) {
    super();
    this.#logger = this._init('JsonLogicCustomOperators', logger, {
      bodyGraphService: {
        value: bodyGraphService,
        requiredMethods: [
          'hasPartWithComponentValue',
          'findPartsByType',
          'getAllParts',
        ],
      },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData'],
      },
    });

    this.#bodyGraphService = bodyGraphService;
    this.#entityManager = entityManager;

    this.#logger.debug('JsonLogicCustomOperators initialized');
  }

  /**
   * Registers all custom operators with the JsonLogicEvaluationService
   *
   * @param {JsonLogicEvaluationService} jsonLogicEvaluationService
   */
  registerOperators(jsonLogicEvaluationService) {
    this.#logger.debug('Registering custom JSON Logic operators');

    // Register hasPartWithComponentValue operator
    // This operator checks if an entity has a body part with a specific component value
    // Usage: {"hasPartWithComponentValue": ["actor", "descriptors:build", "build", "muscular"]}
    const bodyGraphService = this.#bodyGraphService;
    const entityManager = this.#entityManager;
    const logger = this.#logger;

    jsonLogicEvaluationService.addOperation(
      'hasPartWithComponentValue',
      function (entityPath, componentId, propertyPath, expectedValue) {
        try {
          // 'this' is the evaluation context
          const context = this;
          
          logger.debug(`hasPartWithComponentValue called with entityPath='${entityPath}', componentId='${componentId}', propertyPath='${propertyPath}', expectedValue='${expectedValue}'`);

          let entity;
          // Special handling for "." which means the current entity in filter context
          if (entityPath === '.') {
            entity = context.entity;
          } else {
            // Navigate the entity path (e.g., "actor" or "target")
            entity = context;
            const pathParts = entityPath.split('.');
            for (const part of pathParts) {
              if (!entity || typeof entity !== 'object') {
                logger.warn(`Invalid path ${entityPath} - ${part} not found`);
                return false;
              }
              entity = entity[part];
            }
          }

          if (!entity || !entity.id) {
            logger.warn(`No entity found at path ${entityPath}`);
            return false;
          }

          const entityId = entity.id;
          logger.debug(`hasPartWithComponentValue: Found entity ID: ${entityId}`);

          // Get the body component for this entity
          const bodyComponent = entityManager.getComponentData(
            entityId,
            'anatomy:body'
          );
          if (!bodyComponent) {
            logger.debug(`Entity ${entityId} has no anatomy:body component`);
            return false;
          }

          // Use BodyGraphService to check for the part
          const result = bodyGraphService.hasPartWithComponentValue(
            bodyComponent,
            componentId,
            propertyPath,
            expectedValue
          );

          logger.debug(
            `hasPartWithComponentValue(${entityId}, ${componentId}, ${propertyPath}, ${expectedValue}) = ${result.found}`
          );

          return result.found;
        } catch (error) {
          logger.error('Error in hasPartWithComponentValue operator', error);
          return false;
        }
      }
    );

    // Register hasPartOfType operator
    // This operator checks if an entity has any body parts of a specific type
    // Usage: {"hasPartOfType": ["actor", "leg"]}
    jsonLogicEvaluationService.addOperation(
      'hasPartOfType',
      function (entityPath, partType) {
        try {
          // 'this' is the evaluation context
          const context = this;
          
          logger.debug(`hasPartOfType called with entityPath='${entityPath}', partType='${partType}'`);
          
          let entity;
          // Special handling for "." which means the current entity in filter context
          if (entityPath === '.') {
            entity = context.entity;
          } else {
            // Navigate the entity path (e.g., "actor" or "target")
            entity = context;
            const pathParts = entityPath.split('.');
            for (const part of pathParts) {
              if (!entity || typeof entity !== 'object') {
                logger.warn(`Invalid path ${entityPath} - ${part} not found`);
                return false;
              }
              entity = entity[part];
            }
          }

          if (!entity || !entity.id) {
            logger.warn(`No entity found at path ${entityPath}`);
            return false;
          }

          const entityId = entity.id;

          // Get the body component for this entity
          const bodyComponent = entityManager.getComponentData(
            entityId,
            'anatomy:body'
          );
          if (!bodyComponent) {
            logger.debug(`Entity ${entityId} has no anatomy:body component`);
            return false;
          }

          // Get the root entity ID from the body component
          let rootId = null;
          if (bodyComponent.body && bodyComponent.body.root) {
            rootId = bodyComponent.body.root;
          } else if (bodyComponent.root) {
            rootId = bodyComponent.root;
          }

          if (!rootId) {
            logger.debug(
              `Entity ${entityId} has no root in anatomy:body component`
            );
            return false;
          }

          // Build the cache for this anatomy if not already built
          bodyGraphService.buildAdjacencyCache(rootId);

          // Use BodyGraphService to find parts of the specified type
          const partsOfType = bodyGraphService.findPartsByType(
            rootId,
            partType
          );

          logger.debug(
            `hasPartOfType(${entityId}, ${partType}) = ${partsOfType.length > 0} (found ${partsOfType.length} parts)`
          );

          return partsOfType.length > 0;
        } catch (error) {
          logger.error('Error in hasPartOfType operator', error);
          return false;
        }
      }
    );

    // Register hasPartOfTypeWithComponentValue operator
    // This operator checks if an entity has body parts of a specific type with a specific component value
    // Usage: {"hasPartOfTypeWithComponentValue": ["actor", "leg", "descriptors:build", "build", "muscular"]}
    jsonLogicEvaluationService.addOperation(
      'hasPartOfTypeWithComponentValue',
      function (
        entityPath,
        partType,
        componentId,
        propertyPath,
        expectedValue
      ) {
        try {
          // 'this' is the evaluation context
          const context = this;

          let entity;
          // Special handling for "." which means the current entity in filter context
          if (entityPath === '.') {
            entity = context.entity;
          } else {
            // Navigate the entity path (e.g., "actor" or "target")
            entity = context;
            const pathParts = entityPath.split('.');
            for (const part of pathParts) {
              if (!entity || typeof entity !== 'object') {
                logger.warn(`Invalid path ${entityPath} - ${part} not found`);
                return false;
              }
              entity = entity[part];
            }
          }

          if (!entity || !entity.id) {
            logger.warn(`No entity found at path ${entityPath}`);
            return false;
          }

          const entityId = entity.id;

          // Get the body component for this entity
          const bodyComponent = entityManager.getComponentData(
            entityId,
            'anatomy:body'
          );
          if (!bodyComponent) {
            logger.debug(`Entity ${entityId} has no anatomy:body component`);
            return false;
          }

          // Get the root entity ID from the body component
          let rootId = null;
          if (bodyComponent.body && bodyComponent.body.root) {
            rootId = bodyComponent.body.root;
          } else if (bodyComponent.root) {
            rootId = bodyComponent.root;
          }

          if (!rootId) {
            logger.debug(
              `Entity ${entityId} has no root in anatomy:body component`
            );
            return false;
          }

          // Build the cache for this anatomy if not already built
          bodyGraphService.buildAdjacencyCache(rootId);

          // Use BodyGraphService to find parts of the specified type
          const partsOfType = bodyGraphService.findPartsByType(
            rootId,
            partType
          );

          if (partsOfType.length === 0) {
            logger.debug(`Entity ${entityId} has no parts of type ${partType}`);
            return false;
          }

          // Check each part of the specified type for the component value
          for (const partId of partsOfType) {
            const componentData = entityManager.getComponentData(
              partId,
              componentId
            );
            if (componentData) {
              // Navigate the property path within the component
              let value = componentData;
              const propParts = propertyPath.split('.');
              for (const prop of propParts) {
                if (value && typeof value === 'object') {
                  value = value[prop];
                } else {
                  value = undefined;
                  break;
                }
              }

              if (value === expectedValue) {
                logger.debug(
                  `hasPartOfTypeWithComponentValue(${entityId}, ${partType}, ${componentId}, ${propertyPath}, ${expectedValue}) = true (found in part ${partId})`
                );
                return true;
              }
            }
          }

          logger.debug(
            `hasPartOfTypeWithComponentValue(${entityId}, ${partType}, ${componentId}, ${propertyPath}, ${expectedValue}) = false`
          );
          return false;
        } catch (error) {
          logger.error(
            'Error in hasPartOfTypeWithComponentValue operator',
            error
          );
          return false;
        }
      }
    );

    this.#logger.info('Custom JSON Logic operators registered successfully');
  }
}

export default JsonLogicCustomOperators;
