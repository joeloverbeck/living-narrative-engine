// src/logic/systemLogicInterpreter.js
// -----------------------------------------------------------------------------
//  SYSTEM-LOGIC INTERPRETER  (v2.5 — per-event cache + action-ID index)
// -----------------------------------------------------------------------------

import { createJsonLogicContext } from './contextAssembler.js';

/* ---------------------------------------------------------------------------
 *  Internal types (JSDoc only)
 * ------------------------------------------------------------------------- */
/** @typedef {import('../interfaces/coreServices.js').ILogger}               ILogger */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry}        IDataRegistry */
/** @typedef {import('../events/eventBus.js').default}                       EventBus */
/** @typedef {import('./jsonLogicEvaluationService.js').default}            JsonLogicEvaluationService */
/** @typedef {import('../entities/entityManager.js').default}               EntityManager */
/** @typedef {import('./operationInterpreter.js').default}                  OperationInterpreter */
/** @typedef {import('../../data/schemas/rule.schema.json').SystemRule}     SystemRule */
/** @typedef {{catchAll:SystemRule[], byAction:Map<string,SystemRule[]>}}   RuleBucket */

/* ---------------------------------------------------------------------------
 *  Class
 * ------------------------------------------------------------------------- */
class SystemLogicInterpreter {
  /** @type {ILogger}                  */ #logger;
  /** @type {EventBus}                 */ #eventBus;
  /** @type {IDataRegistry}            */ #dataRegistry;
  /** @type {JsonLogicEvaluationService} */ #jsonLogic;
  /** @type {EntityManager}            */ #entityManager;
  /** @type {OperationInterpreter}     */ #operationInterpreter;
  /** @type {Map<string,RuleBucket>}   */ #ruleCache = new Map();
  /** @type {boolean}                  */ #initialized = false;
  /** @type {Function|null}            */ #boundEventHandler = null;

  /* ----------------------------------------------------------------------- */
  constructor({
    logger,
    eventBus,
    dataRegistry,
    jsonLogicEvaluationService,
    entityManager,
    operationInterpreter,
  }) {
    if (!logger) throw new Error('SystemLogicInterpreter: logger required');
    if (!eventBus?.subscribe)
      throw new Error('SystemLogicInterpreter: eventBus invalid');
    if (!dataRegistry)
      throw new Error('SystemLogicInterpreter: dataRegistry invalid');
    if (!jsonLogicEvaluationService)
      throw new Error(
        'SystemLogicInterpreter: jsonLogicEvaluationService invalid'
      );
    if (!entityManager)
      throw new Error('SystemLogicInterpreter: entityManager invalid');
    if (!operationInterpreter)
      throw new Error('SystemLogicInterpreter: operationInterpreter invalid');

    this.#logger = logger;
    this.#eventBus = eventBus;
    this.#dataRegistry = dataRegistry;
    this.#jsonLogic = jsonLogicEvaluationService;
    this.#entityManager = entityManager;
    this.#operationInterpreter = operationInterpreter;
    this.#boundEventHandler = this.#handleEvent.bind(this);

    this.#logger.debug('SystemLogicInterpreter: created');
  }

  /* --------------------------------------------------------------------- */
  /*  Public lifecycle                                                      */

  /* --------------------------------------------------------------------- */
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
  /*  Rule caching                                                          */

  /* --------------------------------------------------------------------- */
  #loadAndCacheRules() {
    this.#ruleCache.clear();
    const rules = /** @type {SystemRule[]} */ (
      this.#dataRegistry.getAllSystemRules() || []
    );

    for (const rule of rules) {
      if (!rule?.event_type) {
        this.#logger.warn('Skipping rule with missing event_type', rule);
        continue;
      }

      /** @type {RuleBucket} */
      let bucket = this.#ruleCache.get(rule.event_type);
      if (!bucket) {
        bucket = { catchAll: [], byAction: new Map() };
        this.#ruleCache.set(rule.event_type, bucket);
      }

      // detect `{ "==":[ { "var":"event.payload.actionId" }, "<CONST>" ] }`
      let constId = null;
      const c = rule.condition;
      if (
        c &&
        typeof c === 'object' &&
        '==' in c &&
        Array.isArray(c['==']) &&
        c['=='].length === 2 &&
        typeof c['=='][1] === 'string' &&
        c['=='][0]?.var === 'event.payload.actionId'
      ) {
        constId = c['=='][1];
      }

      if (rule.event_type === 'core:attempt_action' && constId) {
        (
          bucket.byAction.get(constId) ??
          bucket.byAction.set(constId, []).get(constId)
        ).push(rule);
      } else {
        bucket.catchAll.push(rule);
      }

      // ---- per-rule debug line required by basic-integration tests ----
      this.#logger.debug(`Cached rule '${rule.rule_id}'`);
    }

    // legacy summary line required by earlier tests
    this.#logger.debug(
      `Finished caching rules. ${this.#ruleCache.size} event types have associated rules.`
    );
  }

  /* --------------------------------------------------------------------- */
  /*  Event handling                                                        */

  /* --------------------------------------------------------------------- */
  /**
   * @param {{type:string,payload:any}} event
   */
  #handleEvent(event) {
    const bucket = this.#ruleCache.get(event.type);
    if (!bucket) return;

    /** @type {SystemRule[]} */
    let rules = bucket.catchAll;

    if (event.type === 'core:attempt_action') {
      const id = event.payload?.actionId;
      const specific = id ? bucket.byAction.get(id) : null;
      if (specific) rules = [...specific, ...bucket.catchAll];
    }

    if (rules.length === 0) return;

    // ---- event-level debug required by tests ----
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
        `[Event: ${event.type}] Assembling JsonLogic context via createJsonLogicContext... (ActorID: ${actorId}, TargetID: ${targetId})`
      );

      const evalCtx = createJsonLogicContext(
        event,
        actorId,
        targetId,
        this.#entityManager,
        this.#logger
      );

      this.#logger.debug(
        `[Event: ${event.type}] createJsonLogicContext returned a valid JsonLogicEvaluationContext.`
      );

      nestedCtx = {
        event,
        actor: evalCtx.actor,
        target: evalCtx.target,
        logger: this.#logger,
        evaluationContext: evalCtx,
      };

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
  /*  Rule processing                                                       */

  /* --------------------------------------------------------------------- */
  #evaluateRuleCondition(rule, flatCtx) {
    const ruleId = rule.rule_id || 'NO_ID';

    // no / empty condition → automatically passes
    if (
      !rule.condition ||
      (typeof rule.condition === 'object' &&
        !Array.isArray(rule.condition) &&
        Object.keys(rule.condition).length === 0)
    ) {
      this.#logger.debug(
        `[Rule ${ruleId}] No condition defined or condition is empty. Defaulting to passed.`
      );
      return { passed: true, errored: false };
    }

    this.#logger.debug(
      `[Rule ${ruleId}] Condition found. Evaluating using jsonLogicDataForEval...`
    );

    let rawResult;
    let passed = false;
    let errored = false;

    try {
      rawResult = this.#jsonLogic.evaluate(rule.condition, flatCtx);
      this.#logger.debug(
        `[Rule ${ruleId}] Condition evaluation raw result: ${rawResult}`
      );
      passed = !!rawResult;
    } catch (e) {
      errored = true;
      this.#logger.error(
        `[Rule ${ruleId}] Error during condition evaluation. Treating condition as FALSE.`,
        e
      );
      passed = false;
    }

    // always log final boolean result for unit-test visibility
    this.#logger.debug(
      `[Rule ${ruleId}] Condition evaluation final boolean result: ${passed}`
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
  /*  Action execution – intentionally public-ish for tests                 */

  /* --------------------------------------------------------------------- */
  _executeActions(actions, nestedCtx, scopeLabel) {
    const total = actions.length;

    for (let i = 0; i < total; i++) {
      const op = actions[i];
      const opIndex = i + 1;
      const opType = op?.type ?? 'MISSING_TYPE';
      const tag = `[${scopeLabel} - Action ${opIndex}/${total}]`;

      if (!op || typeof op !== 'object' || !op.type) {
        this.#logger.error(
          `${tag} CRITICAL: Operation at index ${i} is not a valid object. Halting sequence.`,
          op
        );
        break;
      }

      try {
        if (opType === 'IF') {
          this.#handleIf(op, nestedCtx, `${scopeLabel} IF#${opIndex}`);
        } else {
          this.#operationInterpreter.execute(op, nestedCtx);
        }
      } catch (err) {
        this.#logger.error(
          `${tag} CRITICAL error during execution of Operation ${opType}`,
          err
        );
        break; // halt subsequent actions
      }
    }
  }

  #handleIf(node, nestedCtx, label) {
    const {
      condition,
      then_actions = [],
      else_actions = [],
    } = node.parameters || {};

    let result = false;
    try {
      result = this.#jsonLogic.evaluate(condition, nestedCtx.evaluationContext);
    } catch (e) {
      this.#logger.error(`${label}: condition error`, e);
      return;
    }

    this._executeActions(
      result ? then_actions : else_actions,
      nestedCtx,
      label
    );
  }
}

export default SystemLogicInterpreter;
