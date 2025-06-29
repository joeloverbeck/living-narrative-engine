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
/** @typedef {import('./jsonLogicEvaluationService.js').default}            JsonLogicEvaluationService */
/** @typedef {import('../entities/entityManager.js').default}               EntityManager */
/** @typedef {import('./operationInterpreter.js').default}                  OperationInterpreter */
/** @typedef {import('../../data/schemas/rule.schema.json').SystemRule}     SystemRule */
/** @typedef {import('./defs.js').JsonLogicEvaluationContext}               JsonLogicEvaluationContext */
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
  /** @type {Map<string,RuleBucket>} */ #ruleCache = new Map();
  /** @type {boolean} */ #initialized = false;
  /** @type {Function|null} */ #boundEventHandler = null;

  /* ----------------------------------------------------------------------- */
  constructor({
    logger,
    eventBus,
    dataRegistry,
    jsonLogicEvaluationService,
    entityManager,
    operationInterpreter,
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
    });

    this.#eventBus = eventBus;
    this.#dataRegistry = dataRegistry;
    this.#jsonLogic = jsonLogicEvaluationService;
    this.#entityManager = entityManager;
    this.#operationInterpreter = operationInterpreter;
    this.#boundEventHandler = this.#handleEvent.bind(this);

    this.#logger.debug('SystemLogicInterpreter: created');
  }

  /* --------------------------------------------------------------------- */

  /* Public lifecycle                                                      */

  initialize() {
    if (this.#initialized) {
      this.#logger.warn('SystemLogicInterpreter already initialized.');
      return;
    }

    this.#loadAndCacheRules();

    if (this.#ruleCache.size > 0) {
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
    if (this.#boundEventHandler)
      this.#eventBus.unsubscribe('*', this.#boundEventHandler);

    this.#ruleCache.clear();
    this.#boundEventHandler = null;
    this.#initialized = false;
    this.#logger.debug('SystemLogicInterpreter: shut down.');
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
  #handleEvent(event) {
    const bucket = this.#ruleCache.get(event.type);
    if (!bucket) return;

    /** @type {SystemRule[]} */
    let rules = bucket.catchAll;

    if (event.type === ATTEMPT_ACTION_ID) {
      const id = event.payload?.actionId;
      const specific = id ? bucket.byAction.get(id) : null;
      if (specific) rules = [...specific, ...bucket.catchAll];
    }

    if (rules.length === 0) return;

    this.#logger.debug(
      `Received event: ${event.type}. Found ${rules.length} potential rule(s).`,
      { payload: event.payload }
    );

    /* assemble shared nested execution context once */
    let nestedCtx;
    try {
      const actorId = event.payload?.actorId ?? event.payload?.entityId ?? null;
      const targetId = event.payload?.targetId ?? null;

      this.#logger.debug(
        `[Event: ${event.type}] Assembling execution context via createNestedExecutionContext... (ActorID: ${actorId}, TargetID: ${targetId})`
      );

      nestedCtx = createNestedExecutionContext(
        event,
        actorId,
        targetId,
        this.#entityManager,
        this.#logger
      );

      this.#logger.debug(
        `[Event: ${event.type}] createNestedExecutionContext returned a valid ExecutionContext.`
      );

      this.#logger.debug(
        `[Event: ${event.type}] Final ExecutionContext (nested structure) assembled successfully.`
      );
    } catch (e) {
      this.#logger.error(
        'Failed to build JsonLogic context for event',
        event,
        e
      );
      return;
    }

    /* run rules */
    for (const rule of rules) {
      try {
        this.#processRule(rule, event, nestedCtx);
      } catch (err) {
        this.#logger.error(
          `SystemLogicInterpreter: rule '${rule.rule_id || 'NO_ID'}' threw:`,
          err
        );
      }
    }
  }

  /* --------------------------------------------------------------------- */

  /* Rule processing                                                       */

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

  #processRule(rule, event, nestedCtx) {
    const { passed, errored } = this.#evaluateRuleCondition(
      rule,
      nestedCtx.evaluationContext
    );

    if (!passed) {
      const reason = errored
        ? 'due to error during condition evaluation'
        : 'due to condition evaluating to false';
      this.#logger.debug(
        `Rule '${rule.rule_id}' actions skipped for event '${event.type}' ${reason}.`
      );
      return;
    }

    if (Array.isArray(rule.actions) && rule.actions.length) {
      this._executeActions(rule.actions, nestedCtx, `Rule '${rule.rule_id}'`);
    }
  }

  /* --------------------------------------------------------------------- */

  /* Action execution – intentionally public-ish for tests                 */

  _executeActions(actions, nestedCtx, scopeLabel) {
    executeActionSequence(
      actions,
      { ...nestedCtx, scopeLabel, jsonLogic: this.#jsonLogic },
      this.#logger,
      this.#operationInterpreter
    );
  }
}

export default SystemLogicInterpreter;
