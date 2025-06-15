// src/logic/operationHandlers/ifHandler.js

/**
 * @file Executes conditional actions using JsonLogic.
 * @see src/logic/operationHandlers/ifHandler.js
 */

/** @typedef {import('../../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../operationInterpreter.js').default} OperationInterpreter */
/** @typedef {import('../defs.js').ExecutionContext} ExecutionContext */
/** @typedef {import('../defs.js').OperationParams} OperationParams */

class IfHandler {
  /** @type {ILogger} */
  #logger;
  /** @type {JsonLogicEvaluationService} */
  #jsonLogic;
  /** @type {OperationInterpreter} */
  #opInterpreter;

  /**
   * @param {object} deps
   * @param {ILogger} deps.logger
   * @param {JsonLogicEvaluationService} deps.jsonLogicEvaluationService
   * @param {OperationInterpreter} deps.operationInterpreter
   */
  constructor({ logger, jsonLogicEvaluationService, operationInterpreter }) {
    if (!logger?.debug) throw new Error('IfHandler requires ILogger');
    if (!jsonLogicEvaluationService?.evaluate)
      throw new Error('IfHandler requires JsonLogicEvaluationService');
    if (!operationInterpreter?.execute)
      throw new Error('IfHandler requires OperationInterpreter');
    this.#logger = logger;
    this.#jsonLogic = jsonLogicEvaluationService;
    this.#opInterpreter = operationInterpreter;
  }

  /**
   * Parameters for the IF operation.
   *
   * @typedef {object} IfOperationParams
   * @property {object} condition
   * @property {import('../../data/schemas/operation.schema.json').Operation[]} [then_actions]
   * @property {import('../../data/schemas/operation.schema.json').Operation[]} [else_actions]
   */

  /**
   * Execute the IF operation.
   *
   * @param {IfOperationParams|OperationParams|null|undefined} params
   * @param {ExecutionContext} execCtx
   */
  execute(params, execCtx) {
    const log = execCtx?.logger ?? this.#logger;
    if (!params || typeof params !== 'object') {
      log.warn('IF: parameters missing or invalid');
      return;
    }
    const {
      condition,
      then_actions: thenActs = [],
      else_actions: elseActs = [],
    } = params;
    let result = false;
    try {
      result = this.#jsonLogic.evaluate(condition, execCtx.evaluationContext);
    } catch (e) {
      log.error('IF: condition error', e);
      return;
    }

    const actions = Array.isArray(result ? thenActs : elseActs)
      ? result
        ? thenActs
        : elseActs
      : [];

    return actions;
  }
}

export default IfHandler;
