// src/logic/jsonLogicCustomOperators.js

import { BaseService } from '../utils/serviceBase.js';
import { OperatorRegistryFactory } from './operatorRegistryFactory.js';
import { validateOperatorWhitelist } from './operatorRegistrationValidator.js';

/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('./jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../anatomy/bodyGraphService.js').BodyGraphService} BodyGraphService */
/** @typedef {import('../interfaces/IEntityManager.js').IEntityManager} IEntityManager */
/** @typedef {import('../locations/services/lightingStateService.js').LightingStateService} LightingStateService */

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
  /** @private @type {LightingStateService} */
  #lightingStateService;
  /** @private @type {Set<string>} Track registered operators */
  #registeredOperators = new Set();
  /** @private @type {Array<{clearCache?: Function}>} Track operators with caches for clearing */
  #operatorsWithCaches = [];

  /**
   * Creates an instance of JsonLogicCustomOperators
   *
   * @param {object} dependencies
   * @param {ILogger} dependencies.logger
   * @param {BodyGraphService} dependencies.bodyGraphService
   * @param {IEntityManager} dependencies.entityManager
   * @param {LightingStateService} dependencies.lightingStateService
   */
  constructor({ logger, bodyGraphService, entityManager, lightingStateService }) {
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
      lightingStateService: {
        value: lightingStateService,
        requiredMethods: ['isLocationLit'],
      },
    });

    this.#bodyGraphService = bodyGraphService;
    this.#entityManager = entityManager;
    this.#lightingStateService = lightingStateService;

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
   * Creates a wrapper function for class-based operators.
   * @private
   * @param {Object} operator - Operator instance with evaluate method
   * @returns {Function} Wrapper function for JSON Logic
   */
  #createOperatorWrapper(operator) {
    return function (...args) {
      // 'this' is the evaluation context
      return operator.evaluate(args, this);
    };
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
    this.#operatorsWithCaches = [];

    // Create all operators using the factory
    const factory = new OperatorRegistryFactory({
      entityManager: this.#entityManager,
      bodyGraphService: this.#bodyGraphService,
      logger: this.#logger,
      lightingStateService: this.#lightingStateService,
    });

    const { operators, isSocketCoveredOp, socketExposureOp, operatorsWithCaches } =
      factory.createOperators();

    // Store operators that need external access (for backward compatibility)
    this.isSocketCoveredOp = isSocketCoveredOp;
    this.socketExposureOp = socketExposureOp;

    // Track operators with caches
    this.#operatorsWithCaches = operatorsWithCaches;

    // Register all operators
    for (const [name, operator] of operators) {
      if (typeof operator === 'function') {
        // Inline function operator (get_component_value)
        this.#registerOperator(name, operator, jsonLogicEvaluationService);
      } else {
        // Class-based operator
        this.#registerOperator(
          name,
          this.#createOperatorWrapper(operator),
          jsonLogicEvaluationService
        );
      }
    }

    // VALIDATION: Ensure all registered operators are whitelisted
    const allowedOps = jsonLogicEvaluationService.getAllowedOperations();
    validateOperatorWhitelist(
      this.#registeredOperators,
      allowedOps,
      this.#logger
    );

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

    for (const operator of this.#operatorsWithCaches) {
      if (typeof operator.clearCache === 'function') {
        operator.clearCache();
      }
    }
  }
}

export default JsonLogicCustomOperators;
