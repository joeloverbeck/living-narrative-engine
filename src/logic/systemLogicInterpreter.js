// src/logic/systemLogicInterpreter.js
// -----------------------------------------------------------------------------
//  SYSTEM-LOGIC INTERPRETER
//  v2.7 — restores full-fidelity debug/error messages required by legacy tests
// -----------------------------------------------------------------------------

import { createNestedExecutionContext } from './contextAssembler.js';
import { ATTEMPT_ACTION_ID } from '../constants/eventIds.js';
import { REQUIRED_ENTITY_MANAGER_METHODS } from '../constants/entityManager.js';
import { evaluateConditionWithLogging } from './jsonLogicEvaluationService.js';
import { BaseService } from '../utils/serviceBase.js';
import { executeActionSequence } from './actionSequence.js';
import { buildRuleCache } from '../utils/ruleCacheUtils.js';
import { isEmptyCondition } from '../utils/jsonLogicUtils.js';

/* ---------------------------------------------------------------------------
 * Internal types (JSDoc only)
 * ------------------------------------------------------------------------- */
/** @typedef {import('../interfaces/coreServices.js').ILogger}               ILogger */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry}         IDataRegistry */
/** @typedef {import('../interfaces/IEventBus.js').IEventBus}                IEventBus */
/** @typedef {import('../interfaces/IEventBus.js').EventListener}           EventListener */
/** @typedef {import('./jsonLogicEvaluationService.js').default}            JsonLogicEvaluationService */
/** @typedef {import('../entities/entityManager.js').default}               EntityManager */
/** @typedef {import('./operationInterpreter.js').default}                  OperationInterpreter */
/** @typedef {import('../anatomy/bodyGraphService.js').default}             BodyGraphService */
/** @typedef {{rule_id?: string, event_type: string, event_payload_filters?: object, condition?: any, actions: any[]}} SystemRule */
/** @typedef {import('./defs.js').JsonLogicEvaluationContext}               JsonLogicEvaluationContext */
/** @typedef {import('./defs.js').ExecutionContext}                         ExecutionContext */
/** @typedef {{catchAll:SystemRule[], byAction:Map<string,SystemRule[]>}}   RuleBucket */

/* ---------------------------------------------------------------------------
 * Class
 * ------------------------------------------------------------------------- */
class SystemLogicInterpreter extends BaseService {
  /** @type {ILogger} */ #logger;
  /** @type {IEventBus} */ #eventBus;
  /** @type {IDataRegistry} */ #dataRegistry;
  /** @type {JsonLogicEvaluationService} */ #jsonLogic;
  /** @type {EntityManager} */ #entityManager;
  /** @type {OperationInterpreter} */ #operationInterpreter;
  /** @type {BodyGraphService} */ #bodyGraphService; // eslint-disable-line no-unused-private-class-members
  /** @type {Map<string,RuleBucket>} */ #ruleCache = new Map();
  /** @type {boolean} */ #initialized = false;
  /** @type {EventListener|null} */ #boundEventHandler = null;

  /* ----------------------------------------------------------------------- */
  /**
   * @param {object} params
   * @param {ILogger} params.logger
   * @param {IEventBus} params.eventBus
   * @param {IDataRegistry} params.dataRegistry
   * @param {JsonLogicEvaluationService} params.jsonLogicEvaluationService
   * @param {EntityManager} params.entityManager
   * @param {OperationInterpreter} params.operationInterpreter
   * @param {BodyGraphService} params.bodyGraphService
   */
  constructor({
    logger,
    eventBus,
    dataRegistry,
    jsonLogicEvaluationService,
    entityManager,
    operationInterpreter,
    bodyGraphService,
  }) {
    super();
    this.#logger = this._init('SystemLogicInterpreter', logger, {
      eventBus: {
        value: eventBus,
        requiredMethods: ['subscribe', 'unsubscribe'],
      },
      dataRegistry: {
        value: dataRegistry,
        requiredMethods: ['getAllSystemRules'],
      },
      jsonLogicEvaluationService: {
        value: jsonLogicEvaluationService,
        requiredMethods: ['evaluate'],
      },
      entityManager: {
        value: entityManager,
        requiredMethods: REQUIRED_ENTITY_MANAGER_METHODS,
      },
      operationInterpreter: {
        value: operationInterpreter,
        requiredMethods: ['execute'],
      },
      bodyGraphService: {
        value: bodyGraphService,
        requiredMethods: ['hasPartWithComponentValue'],
      },
    });

    this.#eventBus = eventBus;
    this.#dataRegistry = dataRegistry;
    this.#jsonLogic = jsonLogicEvaluationService;
    this.#entityManager = entityManager;
    this.#operationInterpreter = operationInterpreter;
    this.#bodyGraphService = bodyGraphService;
    this.#boundEventHandler = /** @type {EventListener} */ (
      this.#handleEvent.bind(this)
    );

    this.#logger.debug('SystemLogicInterpreter: created');
  }

  /* --------------------------------------------------------------------- */

  /* Public lifecycle                                                      */

  initialize() {
    if (this.#initialized) {
      this.#logger.warn('SystemLogicInterpreter already initialized.');
      return;
    }

    this.#registerCustomJsonLogicOperations();

    this.#loadAndCacheRules();

    if (this.#ruleCache.size > 0 && this.#boundEventHandler) {
      this.#eventBus.subscribe('*', this.#boundEventHandler);
      this.#logger.debug(
        "SystemLogicInterpreter: initialized & subscribed to '*'."
      );
    } else {
      this.#logger.warn(
        'No system rules loaded – interpreter will remain idle.'
      );
    }

    this.#initialized = true;
  }

  shutdown() {
    if (this.#boundEventHandler) {
      const removed = this.#eventBus.unsubscribe('*', this.#boundEventHandler);
      this.#logger.debug(
        `SystemLogicInterpreter: removed '*' subscription: ${removed}.`
      );
    }

    this.#ruleCache.clear();
    this.#boundEventHandler = null;
    this.#initialized = false;
    this.#logger.debug('SystemLogicInterpreter: shut down.');
  }

  /* --------------------------------------------------------------------- */

  /* Custom JsonLogic Operations                                          */

  #registerCustomJsonLogicOperations() {
    // Add hasBodyPartWithComponentValue operation
    this.#jsonLogic.addOperation(
      'hasBodyPartWithComponentValue',
      /**
       * @param {any} args @param {any} data
       * @param data
       */
      (args, data) => {
        // Create a minimal execution context for the handler
        /** @type {ExecutionContext} */
        const executionContext = {
          evaluationContext: /** @type {JsonLogicEvaluationContext} */ (
            /** @type {any} */ (data)
          ),
          entityManager: this.#entityManager,
          validatedEventDispatcher: /** @type {any} */ (null), // Not available in this context
          logger: this.#logger,
          // Other properties are optional
        };

        // Use the operation interpreter to execute the handler
        const result = this.#operationInterpreter.execute(
          { type: 'HAS_BODY_PART_WITH_COMPONENT_VALUE', parameters: args },
          executionContext
        );

        // The handler returns a boolean directly
        return result;
      }
    );

    this.#logger.debug('Custom JsonLogic operations registered');
  }

  /* --------------------------------------------------------------------- */

  /* Rule caching                                                          */

  #loadAndCacheRules() {
    const rules = /** @type {SystemRule[]} */ (
      this.#dataRegistry.getAllSystemRules() || []
    );

    this.#ruleCache = buildRuleCache(rules, this.#logger);

    this.#logger.debug(
      `Finished caching rules. ${this.#ruleCache.size} event types have associated rules.`
    );
  }

  /* --------------------------------------------------------------------- */

  /* Event handling                                                        */

  /**
   * Handle an incoming event and execute matching rules.
   *
   * @param {{type:string,payload:any}} event - Event object with type and payload.
   */
  async #handleEvent(event) {
    const startTime = Date.now();
    this.#logger.debug(
      `🎯 [SystemLogicInterpreter] Event received: ${event.type}`,
      { 
        payload: event.payload,
        timestamp: startTime,
        isAsync: true
      }
    );

    const bucket = this.#ruleCache.get(event.type);
    if (!bucket) {
      this.#logger.debug(
        `🎯 [SystemLogicInterpreter] No rules found for event type: ${event.type}`
      );
      return;
    }

    /** @type {SystemRule[]} */
    let rules = bucket.catchAll;

    if (event.type === ATTEMPT_ACTION_ID) {
      const id = event.payload?.actionId;
      const specific = id ? bucket.byAction.get(id) : null;
      if (specific) rules = [...specific, ...bucket.catchAll];
    }

    if (rules.length === 0) {
      this.#logger.debug(
        `🎯 [SystemLogicInterpreter] No matching rules for event: ${event.type}`
      );
      return;
    }

    // Keep original format for tests
    this.#logger.debug(
      `Received event: ${event.type}. Found ${rules.length} potential rule(s).`,
      { payload: event.payload }
    );
    
    // Add new enhanced debugging
    this.#logger.debug(
      `🎯 [SystemLogicInterpreter] Processing event: ${event.type}. Found ${rules.length} potential rule(s).`,
      { 
        payload: event.payload,
        ruleIds: rules.map(r => r.rule_id || 'NO_ID')
      }
    );

    /* assemble shared nested execution context once */
    let nestedCtx;
    try {
      const actorId = event.payload?.actorId ?? event.payload?.entityId ?? null;
      const targetId = event.payload?.targetId ?? null;

      // Keep original format for tests
      this.#logger.debug(
        `[Event: ${event.type}] Assembling execution context via createNestedExecutionContext... (ActorID: ${actorId}, TargetID: ${targetId})`
      );
      
      // Add new enhanced debugging
      this.#logger.debug(
        `🔧 [SystemLogicInterpreter] Assembling execution context via createNestedExecutionContext... (ActorID: ${actorId}, TargetID: ${targetId})`
      );

      nestedCtx = createNestedExecutionContext(
        event,
        actorId,
        targetId,
        this.#entityManager,
        this.#logger,
        undefined
      );

      // Keep original format for tests
      this.#logger.debug(
        `[Event: ${event.type}] createNestedExecutionContext returned a valid ExecutionContext.`
      );
      
      this.#logger.debug(
        `[Event: ${event.type}] Final ExecutionContext (nested structure) assembled successfully.`
      );
      
      // Add new enhanced debugging
      this.#logger.debug(
        `🔧 [SystemLogicInterpreter] Final ExecutionContext (nested structure) assembled successfully.`
      );
    } catch (e) {
      this.#logger.error(
        '❌ [SystemLogicInterpreter] Failed to build JsonLogic context for event',
        event,
        e
      );
      return;
    }

    /* run rules */
    this.#logger.debug(
      `🚀 [SystemLogicInterpreter] Starting rule processing for event: ${event.type} (${rules.length} rules)`
    );
    
    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const ruleId = rule.rule_id || 'NO_ID';
      
      this.#logger.debug(
        `📋 [SystemLogicInterpreter] Processing rule ${i + 1}/${rules.length}: ${ruleId}`
      );
      
      try {
        await this.#processRule(rule, event, nestedCtx);
        this.#logger.debug(
          `✅ [SystemLogicInterpreter] Rule ${ruleId} completed successfully`
        );
      } catch (err) {
        this.#logger.error(
          `❌ [SystemLogicInterpreter] Rule '${ruleId}' threw error:`,
          err
        );
      }
    }
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    this.#logger.debug(
      `🏁 [SystemLogicInterpreter] Finished processing event: ${event.type} (${duration}ms total)`
    );
  }

  /* --------------------------------------------------------------------- */

  /* Rule processing                                                       */

  /**
   * @param {SystemRule} rule
   * @param {JsonLogicEvaluationContext} flatCtx
   * @returns {{passed: boolean, errored: boolean}}
   */
  #evaluateRuleCondition(rule, flatCtx) {
    const ruleId = rule.rule_id || 'NO_ID';

    // no / empty condition → automatically passes
    if (!rule.condition || isEmptyCondition(rule.condition)) {
      this.#logger.debug(
        `[Rule ${ruleId}] No condition defined or condition is empty. Defaulting to passed.`
      );
      return { passed: true, errored: false };
    }

    this.#logger.debug(
      `[Rule ${ruleId}] Condition found. Evaluating using jsonLogicDataForEval...`
    );

    const { result: passed, errored } = evaluateConditionWithLogging(
      this.#jsonLogic,
      rule.condition,
      flatCtx,
      this.#logger,
      `[Rule ${ruleId}]`
    );
    return { passed, errored };
  }

  /**
   * @param {SystemRule} rule
   * @param {{type:string,payload:any}} event
   * @param {any} nestedCtx
   */
  async #processRule(rule, event, nestedCtx) {
    const ruleId = rule.rule_id || 'NO_ID';
    const ruleStartTime = Date.now();
    
    this.#logger.debug(
      `🔍 [SystemLogicInterpreter] Rule ${ruleId}: Starting condition evaluation`
    );
    
    const { passed, errored } = this.#evaluateRuleCondition(
      rule,
      nestedCtx.evaluationContext
    );

    if (!passed) {
      const reason = errored
        ? 'due to error during condition evaluation'
        : 'due to condition evaluating to false';
      // Keep original format for tests
      this.#logger.debug(
        `Rule '${ruleId}' actions skipped for event '${event.type}' ${reason}.`
      );
      
      // Add new enhanced debugging
      this.#logger.debug(
        `⏭️ [SystemLogicInterpreter] Rule '${ruleId}' actions skipped for event '${event.type}' ${reason}.`
      );
      return;
    }

    this.#logger.debug(
      `✅ [SystemLogicInterpreter] Rule ${ruleId}: Condition passed, proceeding to actions`
    );

    if (Array.isArray(rule.actions) && rule.actions.length) {
      this.#logger.debug(
        `🎬 [SystemLogicInterpreter] Rule ${ruleId}: Starting action sequence (${rule.actions.length} actions)`
      );
      
      try {
        await this._executeActions(rule.actions, nestedCtx, `Rule '${rule.rule_id}'`);
        
        const ruleEndTime = Date.now();
        const ruleDuration = ruleEndTime - ruleStartTime;
        this.#logger.debug(
          `🎉 [SystemLogicInterpreter] Rule ${ruleId}: Action sequence completed (${ruleDuration}ms)`
        );
      } catch (err) {
        this.#logger.error(
          `❌ [SystemLogicInterpreter] Rule ${ruleId}: Error during action sequence:`,
          err
        );
        throw err;
      }
    } else {
      this.#logger.debug(
        `⚠️ [SystemLogicInterpreter] Rule ${ruleId}: No actions to execute`
      );
    }
  }

  /* --------------------------------------------------------------------- */

  /* Action execution – intentionally public-ish for tests                 */

  /**
   * @param {any[]} actions
   * @param {any} nestedCtx
   * @param {string} scopeLabel
   */
  async _executeActions(actions, nestedCtx, scopeLabel) {
    const actionStartTime = Date.now();
    
    this.#logger.debug(
      `🎬 [SystemLogicInterpreter] _executeActions: Starting action sequence for ${scopeLabel} (${actions.length} actions)`
    );
    
    try {
      await executeActionSequence(
        actions,
        { ...nestedCtx, scopeLabel, jsonLogic: this.#jsonLogic },
        this.#logger,
        this.#operationInterpreter
      );
      
      const actionEndTime = Date.now();
      const actionDuration = actionEndTime - actionStartTime;
      this.#logger.debug(
        `🎉 [SystemLogicInterpreter] _executeActions: Action sequence completed for ${scopeLabel} (${actionDuration}ms)`
      );
    } catch (err) {
      this.#logger.error(
        `❌ [SystemLogicInterpreter] _executeActions: Error in action sequence for ${scopeLabel}:`,
        err
      );
      throw err;
    }
  }
}

export default SystemLogicInterpreter;
