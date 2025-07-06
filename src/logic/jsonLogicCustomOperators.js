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
        requiredMethods: ['hasPartWithComponentValue']
      },
      entityManager: {
        value: entityManager,
        requiredMethods: ['getComponentData']
      }
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
    
    jsonLogicEvaluationService.addOperation('hasPartWithComponentValue', function(entityPath, componentId, propertyPath, expectedValue) {
      try {
        // 'this' is the evaluation context
        const context = this;
        
        // Navigate the entity path (e.g., "actor" or "target")
        let entity = context;
        const pathParts = entityPath.split('.');
        for (const part of pathParts) {
          if (!entity || typeof entity !== 'object') {
            logger.warn(`Invalid path ${entityPath} - ${part} not found`);
            return false;
          }
          entity = entity[part];
        }
        
        if (!entity || !entity.id) {
          logger.warn(`No entity found at path ${entityPath}`);
          return false;
        }
        
        const entityId = entity.id;
        
        // Get the body component for this entity
        const bodyComponent = entityManager.getComponentData(entityId, 'anatomy:body');
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
    });
    
    this.#logger.info('Custom JSON Logic operators registered successfully');
  }
}

export default JsonLogicCustomOperators;