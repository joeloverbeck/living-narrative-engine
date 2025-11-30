// src/logic/jsonLogicCustomOperators.js

import { BaseService } from '../utils/serviceBase.js';
import { HasPartWithComponentValueOperator } from './operators/hasPartWithComponentValueOperator.js';
import { HasPartOfTypeOperator } from './operators/hasPartOfTypeOperator.js';
import { HasPartOfTypeWithComponentValueOperator } from './operators/hasPartOfTypeWithComponentValueOperator.js';
import { HasClothingInSlotOperator } from './operators/hasClothingInSlotOperator.js';
import { HasClothingInSlotLayerOperator } from './operators/hasClothingInSlotLayerOperator.js';
import { IsSocketCoveredOperator } from './operators/isSocketCoveredOperator.js';
import { HasSittingSpaceToRightOperator } from './operators/hasSittingSpaceToRightOperator.js';
import { CanScootCloserOperator } from './operators/canScootCloserOperator.js';
import { IsClosestLeftOccupantOperator } from './operators/isClosestLeftOccupantOperator.js';
import { IsClosestRightOccupantOperator } from './operators/isClosestRightOccupantOperator.js';
import { HasOtherActorsAtLocationOperator } from './operators/hasOtherActorsAtLocationOperator.js';
import { IsRemovalBlockedOperator } from './operators/isRemovalBlockedOperator.js';
import { HasComponentOperator } from './operators/hasComponentOperator.js';
import { IsHungryOperator } from './operators/isHungryOperator.js';
import { PredictedEnergyOperator } from './operators/predictedEnergyOperator.js';
import { CanConsumeOperator } from './operators/canConsumeOperator.js';
import { HasFreeGrabbingAppendagesOperator } from './operators/hasFreeGrabbingAppendagesOperator.js';
import { CanActorGrabItemOperator } from './operators/canActorGrabItemOperator.js';
import { IsItemBeingGrabbedOperator } from './operators/isItemBeingGrabbedOperator.js';
import { GetSkillValueOperator } from './operators/getSkillValueOperator.js';
import { validateOperatorWhitelist } from './operatorRegistrationValidator.js';
import { hasValidEntityId } from './utils/entityPathResolver.js';

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
  /** @private @type {Set<string>} Track registered operators */
  #registeredOperators = new Set();

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
   * Helper to register operator and track it
   *
   * @private
   * @param {string} name - Operator name
   * @param {Function} implementation - Operator implementation function
   * @param {JsonLogicEvaluationService} evaluationService - Evaluation service
   */
  #registerOperator(name, implementation, evaluationService) {
    evaluationService.addOperation(name, implementation);
    this.#registeredOperators.add(name);
  }

  /**
   * Registers all custom operators with the JsonLogicEvaluationService
   *
   * @param {JsonLogicEvaluationService} jsonLogicEvaluationService
   */
  registerOperators(jsonLogicEvaluationService) {
    this.#logger.debug('Registering custom JSON Logic operators');

    // Clear previous registrations
    this.#registeredOperators.clear();

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

    const hasSittingSpaceToRightOp = new HasSittingSpaceToRightOperator({
      entityManager: this.#entityManager,
      logger: this.#logger,
    });

    const canScootCloserOp = new CanScootCloserOperator({
      entityManager: this.#entityManager,
      logger: this.#logger,
    });

    const isClosestLeftOccupantOp = new IsClosestLeftOccupantOperator({
      entityManager: this.#entityManager,
      logger: this.#logger,
    });

    const isClosestRightOccupantOp = new IsClosestRightOccupantOperator({
      entityManager: this.#entityManager,
      logger: this.#logger,
    });

    const hasOtherActorsAtLocationOp = new HasOtherActorsAtLocationOperator({
      entityManager: this.#entityManager,
      logger: this.#logger,
    });

    const isRemovalBlockedOp = new IsRemovalBlockedOperator({
      entityManager: this.#entityManager,
      logger: this.#logger,
    });

    const hasComponentOp = new HasComponentOperator({
      entityManager: this.#entityManager,
      logger: this.#logger,
    });

    const getComponentValueOp = (entityRef, componentId, propertyPath = null) => {
      let entityId = null;

      if (hasValidEntityId(entityRef)) {
        entityId = entityRef.id;
      } else if (typeof entityRef === 'string' || typeof entityRef === 'number') {
        entityId = entityRef;
      }

      if (entityId === null || entityId === undefined) {
        return null;
      }

      const componentData = this.#entityManager.getComponentData(
        entityId,
        componentId
      );

      if (!componentData || typeof componentData !== 'object') {
        return null;
      }

      if (!propertyPath || typeof propertyPath !== 'string') {
        return componentData;
      }

      return propertyPath
        .split('.')
        .reduce(
          (value, key) =>
            value && Object.prototype.hasOwnProperty.call(value, key)
              ? value[key]
              : null,
          componentData
        );
    };

    const isHungryOp = new IsHungryOperator({
      entityManager: this.#entityManager,
      logger: this.#logger,
    });

    const predictedEnergyOp = new PredictedEnergyOperator({
      entityManager: this.#entityManager,
      logger: this.#logger,
    });

    const canConsumeOp = new CanConsumeOperator({
      entityManager: this.#entityManager,
      logger: this.#logger,
    });

    const hasFreeGrabbingAppendagesOp = new HasFreeGrabbingAppendagesOperator({
      entityManager: this.#entityManager,
      logger: this.#logger,
    });

    const canActorGrabItemOp = new CanActorGrabItemOperator({
      entityManager: this.#entityManager,
      logger: this.#logger,
    });

    const isItemBeingGrabbedOp = new IsItemBeingGrabbedOperator({
      entityManager: this.#entityManager,
      logger: this.#logger,
    });

    const getSkillValueOp = new GetSkillValueOperator({
      entityManager: this.#entityManager,
      logger: this.#logger,
    });

    // Register hasPartWithComponentValue operator
    this.#registerOperator(
      'hasPartWithComponentValue',
      function (entityPath, componentId, propertyPath, expectedValue) {
        // 'this' is the evaluation context
        return hasPartWithComponentValueOp.evaluate(
          [entityPath, componentId, propertyPath, expectedValue],
          this
        );
      },
      jsonLogicEvaluationService
    );

    // Register hasPartOfType operator
    this.#registerOperator(
      'hasPartOfType',
      function (entityPath, partType) {
        // 'this' is the evaluation context
        return hasPartOfTypeOp.evaluate([entityPath, partType], this);
      },
      jsonLogicEvaluationService
    );

    // Register hasPartOfTypeWithComponentValue operator
    this.#registerOperator(
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
      },
      jsonLogicEvaluationService
    );

    // Register hasClothingInSlot operator
    this.#registerOperator(
      'hasClothingInSlot',
      function (entityPath, slotName) {
        // 'this' is the evaluation context
        return hasClothingInSlotOp.evaluate([entityPath, slotName], this);
      },
      jsonLogicEvaluationService
    );

    // Register hasClothingInSlotLayer operator
    this.#registerOperator(
      'hasClothingInSlotLayer',
      function (entityPath, slotName, layerName) {
        // 'this' is the evaluation context
        return hasClothingInSlotLayerOp.evaluate(
          [entityPath, slotName, layerName],
          this
        );
      },
      jsonLogicEvaluationService
    );

    // Register isSocketCovered operator
    const self = this;
    this.#registerOperator(
      'isSocketCovered',
      function (entityPath, socketId) {
        // 'this' is the evaluation context
        return self.isSocketCoveredOp.evaluate([entityPath, socketId], this);
      },
      jsonLogicEvaluationService
    );

    // Register hasSittingSpaceToRight operator
    this.#registerOperator(
      'hasSittingSpaceToRight',
      function (entityPath, targetPath, minSpaces) {
        // 'this' is the evaluation context
        return hasSittingSpaceToRightOp.evaluate(
          [entityPath, targetPath, minSpaces],
          this
        );
      },
      jsonLogicEvaluationService
    );

    // Register canScootCloser operator
    this.#registerOperator(
      'canScootCloser',
      function (entityPath, targetPath) {
        // 'this' is the evaluation context
        return canScootCloserOp.evaluate([entityPath, targetPath], this);
      },
      jsonLogicEvaluationService
    );

    // Register isClosestLeftOccupant operator
    this.#registerOperator(
      'isClosestLeftOccupant',
      function (entityPath, targetPath, actorPath) {
        // 'this' is the evaluation context
        return isClosestLeftOccupantOp.evaluate(
          [entityPath, targetPath, actorPath],
          this
        );
      },
      jsonLogicEvaluationService
    );

    // Register isClosestRightOccupant operator
    this.#registerOperator(
      'isClosestRightOccupant',
      function (entityPath, targetPath, actorPath) {
        return isClosestRightOccupantOp.evaluate(
          [entityPath, targetPath, actorPath],
          this
        );
      },
      jsonLogicEvaluationService
    );

    // Register hasOtherActorsAtLocation operator
    this.#registerOperator(
      'hasOtherActorsAtLocation',
      function (entityPath) {
        // 'this' is the evaluation context
        return hasOtherActorsAtLocationOp.evaluate([entityPath], this);
      },
      jsonLogicEvaluationService
    );

    // Register isRemovalBlocked operator
    this.#registerOperator(
      'isRemovalBlocked',
      function (actorPath, targetItemPath) {
        // 'this' is the evaluation context
        return isRemovalBlockedOp.evaluate([actorPath, targetItemPath], this);
      },
      jsonLogicEvaluationService
    );

    // Register has_component operator
    this.#registerOperator(
      'has_component',
      function (entityPath, componentId) {
        // 'this' is the evaluation context
        return hasComponentOp.evaluate([entityPath, componentId], this);
      },
      jsonLogicEvaluationService
    );

    // Register get_component_value operator
    this.#registerOperator(
      'get_component_value',
      function (entityPath, componentId, propertyPath = null) {
        return getComponentValueOp(entityPath, componentId, propertyPath);
      },
      jsonLogicEvaluationService
    );

    // Register is_hungry operator
    this.#registerOperator(
      'is_hungry',
      function (entityPath) {
        // 'this' is the evaluation context
        return isHungryOp.evaluate([entityPath], this);
      },
      jsonLogicEvaluationService
    );

    // Register predicted_energy operator
    this.#registerOperator(
      'predicted_energy',
      function (entityPath) {
        // 'this' is the evaluation context
        return predictedEnergyOp.evaluate([entityPath], this);
      },
      jsonLogicEvaluationService
    );

    // Register can_consume operator
    this.#registerOperator(
      'can_consume',
      function (consumerPath, itemPath) {
        // 'this' is the evaluation context
        return canConsumeOp.evaluate([consumerPath, itemPath], this);
      },
      jsonLogicEvaluationService
    );

    // Register hasFreeGrabbingAppendages operator
    this.#registerOperator(
      'hasFreeGrabbingAppendages',
      function (entityPath, requiredCount) {
        // 'this' is the evaluation context
        return hasFreeGrabbingAppendagesOp.evaluate(
          [entityPath, requiredCount],
          this
        );
      },
      jsonLogicEvaluationService
    );

    // Register canActorGrabItem operator
    this.#registerOperator(
      'canActorGrabItem',
      function (actorPath, itemPath) {
        // 'this' is the evaluation context
        return canActorGrabItemOp.evaluate([actorPath, itemPath], this);
      },
      jsonLogicEvaluationService
    );

    // Register isItemBeingGrabbed operator
    this.#registerOperator(
      'isItemBeingGrabbed',
      function (actorPath, itemPath) {
        // 'this' is the evaluation context
        return isItemBeingGrabbedOp.evaluate([actorPath, itemPath], this);
      },
      jsonLogicEvaluationService
    );

    // Register getSkillValue operator
    this.#registerOperator(
      'getSkillValue',
      function (entityPath, componentId, propertyPath, defaultValue) {
        // 'this' is the evaluation context
        return getSkillValueOp.evaluate(
          [entityPath, componentId, propertyPath, defaultValue],
          this
        );
      },
      jsonLogicEvaluationService
    );

    // VALIDATION: Ensure all registered operators are whitelisted
    const allowedOps = jsonLogicEvaluationService.getAllowedOperations();
    validateOperatorWhitelist(this.#registeredOperators, allowedOps, this.#logger);

    this.#logger.info('Custom JSON Logic operators registered successfully', {
      count: this.#registeredOperators.size,
      operators: Array.from(this.#registeredOperators).sort(),
    });
  }

  /**
   * Get set of all registered custom operators.
   *
   * @returns {Set<string>} Set of registered operator names
   */
  getRegisteredOperators() {
    return new Set(this.#registeredOperators);
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
