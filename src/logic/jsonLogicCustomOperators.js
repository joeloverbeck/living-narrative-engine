// src/logic/jsonLogicCustomOperators.js

import { BaseService } from '../utils/serviceBase.js';
import { HasPartWithComponentValueOperator } from './operators/hasPartWithComponentValueOperator.js';
import { HasPartOfTypeOperator } from './operators/hasPartOfTypeOperator.js';
import { HasPartOfTypeWithComponentValueOperator } from './operators/hasPartOfTypeWithComponentValueOperator.js';
import { HasClothingInSlotOperator } from './operators/hasClothingInSlotOperator.js';
import { HasClothingInSlotLayerOperator } from './operators/hasClothingInSlotLayerOperator.js';
import { IsSocketCoveredOperator } from './operators/isSocketCoveredOperator.js';

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
          'buildAdjacencyCache',
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

    // Create operator instances
    const hasPartWithComponentValueOp = new HasPartWithComponentValueOperator({
      entityManager: this.#entityManager,
      bodyGraphService: this.#bodyGraphService,
      logger: this.#logger,
    });

    const hasPartOfTypeOp = new HasPartOfTypeOperator({
      entityManager: this.#entityManager,
      bodyGraphService: this.#bodyGraphService,
      logger: this.#logger,
    });

    const hasPartOfTypeWithComponentValueOp =
      new HasPartOfTypeWithComponentValueOperator({
        entityManager: this.#entityManager,
        bodyGraphService: this.#bodyGraphService,
        logger: this.#logger,
      });

    const hasClothingInSlotOp = new HasClothingInSlotOperator({
      entityManager: this.#entityManager,
      logger: this.#logger,
    });

    const hasClothingInSlotLayerOp = new HasClothingInSlotLayerOperator({
      entityManager: this.#entityManager,
      logger: this.#logger,
    });

    this.isSocketCoveredOp = new IsSocketCoveredOperator({
      entityManager: this.#entityManager,
      logger: this.#logger,
    });

    // Register hasPartWithComponentValue operator
    jsonLogicEvaluationService.addOperation(
      'hasPartWithComponentValue',
      function (entityPath, componentId, propertyPath, expectedValue) {
        // 'this' is the evaluation context
        return hasPartWithComponentValueOp.evaluate(
          [entityPath, componentId, propertyPath, expectedValue],
          this
        );
      }
    );

    // Register hasPartOfType operator
    jsonLogicEvaluationService.addOperation(
      'hasPartOfType',
      function (entityPath, partType) {
        // 'this' is the evaluation context
        return hasPartOfTypeOp.evaluate([entityPath, partType], this);
      }
    );

    // Register hasPartOfTypeWithComponentValue operator
    jsonLogicEvaluationService.addOperation(
      'hasPartOfTypeWithComponentValue',
      function (
        entityPath,
        partType,
        componentId,
        propertyPath,
        expectedValue
      ) {
        // 'this' is the evaluation context
        return hasPartOfTypeWithComponentValueOp.evaluate(
          [entityPath, partType, componentId, propertyPath, expectedValue],
          this
        );
      }
    );

    // Register hasClothingInSlot operator
    jsonLogicEvaluationService.addOperation(
      'hasClothingInSlot',
      function (entityPath, slotName) {
        // 'this' is the evaluation context
        return hasClothingInSlotOp.evaluate([entityPath, slotName], this);
      }
    );

    // Register hasClothingInSlotLayer operator
    jsonLogicEvaluationService.addOperation(
      'hasClothingInSlotLayer',
      function (entityPath, slotName, layerName) {
        // 'this' is the evaluation context
        return hasClothingInSlotLayerOp.evaluate(
          [entityPath, slotName, layerName],
          this
        );
      }
    );

    // Register isSocketCovered operator
    const self = this;
    jsonLogicEvaluationService.addOperation(
      'isSocketCovered',
      function (entityPath, socketId) {
        // 'this' is the evaluation context
        return self.isSocketCoveredOp.evaluate([entityPath, socketId], this);
      }
    );

    this.#logger.info('Custom JSON Logic operators registered successfully');
  }

  /**
   * Clears all operator caches - useful for testing
   */
  clearCaches() {
    this.#logger.debug('Clearing custom operator caches');
    
    // Clear IsSocketCoveredOperator cache if it exists
    if (this.isSocketCoveredOp) {
      this.isSocketCoveredOp.clearCache();
    }
  }
}

export default JsonLogicCustomOperators;
