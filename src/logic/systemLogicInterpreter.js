// src/logic/systemLogicInterpreter.js

import {createJsonLogicContext} from './contextAssembler.js';

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../events/eventBus.js').default} EventBus */
/** @typedef {import('./jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('./operationInterpreter.js').default} OperationInterpreter */
/** @typedef {import('./defs.js').GameEvent} GameEvent */
/** @typedef {import('../../data/schemas/rule.schema.json').SystemRule} SystemRule */
/** @typedef {import('../../data/schemas/operation.schema.json').Operation} Operation */
/** @typedef {import('./defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */

/**
 * @typedef {object} ConditionEvaluationResult
 * @property {boolean} conditionPassed - Whether the condition (if present) evaluated to true. True if no condition exists.
 * @property {boolean} evaluationErrorOccurred - Whether an error occurred during the evaluation of the condition.
 */


/**
 * @class SystemLogicInterpreter
 * Responsible for listening to game events, matching them against SystemRule definitions,
 * evaluating optional rule conditions using JSON Logic, and triggering the execution
 * of the rule's action sequence via the OperationInterpreter if the conditions are met.
 * Manages a shared execution context for all rules triggered by a single event.
 */
class SystemLogicInterpreter {
    /** @private @type {ILogger} */
    #logger;
    /** @private @type {EventBus} */
    #eventBus;
    /** @private @type {IDataRegistry} */
    #dataRegistry;
    /** @private @type {JsonLogicEvaluationService} */
    #jsonLogicEvaluationService;
    /** @private @type {EntityManager} */
    #entityManager;
    /** @private @type {OperationInterpreter} */
    #operationInterpreter;
    /** @private @type {Map<string, SystemRule[]>} */
    #ruleCache = new Map();
    /** @private @type {boolean} */
    #initialized = false;
    /** @private @type {Function | null} */ // To store the bound handler for removal
    #boundEventHandler = null;

    constructor({logger, eventBus, dataRegistry, jsonLogicEvaluationService, entityManager, operationInterpreter}) {
        if (!logger || typeof logger.info !== 'function') {
            throw new Error('SystemLogicInterpreter requires a valid ILogger instance.');
        }
        if (!eventBus || typeof eventBus.subscribe !== 'function') {
            throw new Error("SystemLogicInterpreter requires a valid EventBus instance with a 'subscribe' method.");
        }
        if (!dataRegistry || typeof dataRegistry.getAllSystemRules !== 'function') {
            throw new Error("SystemLogicInterpreter requires a valid IDataRegistry instance with an 'getAllSystemRules' method.");
        }
        if (!jsonLogicEvaluationService || typeof jsonLogicEvaluationService.evaluate !== 'function') {
            throw new Error("SystemLogicInterpreter requires a valid JsonLogicEvaluationService instance with an 'evaluate' method.");
        }
        if (!entityManager || typeof entityManager.getEntityInstance !== 'function') {
            throw new Error("SystemLogicInterpreter requires a valid EntityManager instance with a 'getEntityInstance' method.");
        }
        if (!operationInterpreter || typeof operationInterpreter.execute !== 'function') {
            throw new Error("SystemLogicInterpreter requires a valid OperationInterpreter instance with an 'execute' method.");
        }

        this.#logger = logger;
        this.#eventBus = eventBus;
        this.#dataRegistry = dataRegistry;
        this.#jsonLogicEvaluationService = jsonLogicEvaluationService;
        this.#entityManager = entityManager;
        this.#operationInterpreter = operationInterpreter;
        this.#boundEventHandler = this.#handleEvent.bind(this);
        this.#logger.info('SystemLogicInterpreter instance created. Ready for initialization.');
    }

    initialize() {
        if (this.#initialized) {
            this.#logger.warn('SystemLogicInterpreter already initialized.');
            return;
        }
        this.#loadAndCacheRules();
        this.#subscribeToEvents();
        this.#initialized = true;
        this.#logger.info('SystemLogicInterpreter successfully initialized and subscribed to events.');
    }

    #loadAndCacheRules() {
        this.#logger.info('Loading and caching system rules by event type...');
        this.#ruleCache.clear();
        const allRules = this.#dataRegistry.getAllSystemRules();

        if (!allRules || !Array.isArray(allRules)) {
            this.#logger.error('Failed to load system rules from data registry. Result was not an array.');
            return;
        }

        for (const rule of allRules) {
            if (!rule || typeof rule.event_type !== 'string') {
                this.#logger.warn('Skipping invalid rule definition (missing or invalid event_type):', rule);
                continue;
            }
            const eventType = rule.event_type;
            if (!this.#ruleCache.has(eventType)) {
                this.#ruleCache.set(eventType, []);
            }
            this.#ruleCache.get(eventType).push(rule);
            this.#logger.debug(`Cached rule '${rule.rule_id || 'NO_ID'}' for event type '${eventType}'`);
        }
        this.#logger.info(`Finished caching rules. ${this.#ruleCache.size} event types have associated rules.`);
    }

    #subscribeToEvents() {
        const eventTypesToListen = Array.from(this.#ruleCache.keys());
        if (eventTypesToListen.length > 0) {
            if (!this.#boundEventHandler) {
                this.#logger.error('SystemLogicInterpreter: Bound event handler is null during subscription attempt.');
                return;
            }
            this.#eventBus.subscribe('*', this.#boundEventHandler);
            this.#logger.info('Subscribed to all events (\'*\') using the EventBus.');
        } else {
            this.#logger.warn('No system rules loaded or cached. SystemLogicInterpreter will not actively listen for specific events.');
        }
    }

    #handleEvent(event) {
        if (!event || typeof event.type !== 'string') {
            this.#logger.warn('Received invalid event object. Ignoring.', {event});
            return;
        }

        const eventType = event.type;
        const matchingRules = this.#ruleCache.get(eventType) || [];
        this.#logger.debug(`Received event: ${eventType}. Found ${matchingRules.length} potential rule(s).`, {payload: event.payload});

        if (matchingRules.length === 0) {
            return;
        }

        let finalNestedExecutionContext; // This will be the NESTED context passed to rule actions
        let jsonLogicDataForEvaluation; // This will be the FLAT context for JSONLogic condition evaluation

        try {
            const actorId = event.payload?.actorId ?? event.payload?.entityId ?? null;
            const targetId = event.payload?.targetId ?? null;
            this.#logger.debug(`[Event: ${eventType}] Assembling JsonLogic context via createJsonLogicContext... (ActorID: ${actorId}, TargetID: ${targetId})`);

            // Step 1: Get the JsonLogicEvaluationContext (expected to be flat: {event, actor, target, context, logger})
            jsonLogicDataForEvaluation = createJsonLogicContext(event, actorId, targetId, this.#entityManager, this.#logger);

            // Step 2: Validate and normalize the JsonLogicEvaluationContext
            if (!jsonLogicDataForEvaluation || typeof jsonLogicDataForEvaluation.context !== 'object' || jsonLogicDataForEvaluation.context === null) {
                this.#logger.warn(`[Event: ${eventType}] createJsonLogicContext did not return a valid JsonLogicEvaluationContext with a '.context' object. Creating a default one.`);
                jsonLogicDataForEvaluation = {
                    event: event,
                    actor: null,
                    target: null,
                    context: {},
                    logger: this.#logger
                };
                if (actorId && this.#entityManager && typeof this.#entityManager.getEntityInstance === 'function') {
                    try {
                        jsonLogicDataForEvaluation.actor = this.#entityManager.getEntityInstance(actorId) || null;
                        if (jsonLogicDataForEvaluation.actor) this.#logger.debug(`[Default Context] Resolved actor ${actorId}`); else this.#logger.debug(`[Default Context] Actor ${actorId} not found`);
                    } catch (e) {
                        this.#logger.error(`[Default Context] Error getting actor instance ${actorId}`, e);
                    }
                }
                if (targetId && this.#entityManager && typeof this.#entityManager.getEntityInstance === 'function') {
                    try {
                        jsonLogicDataForEvaluation.target = this.#entityManager.getEntityInstance(targetId) || null;
                        if (jsonLogicDataForEvaluation.target) this.#logger.debug(`[Default Context] Resolved target ${targetId}`); else this.#logger.debug(`[Default Context] Target ${targetId} not found`);
                    } catch (e) {
                        this.#logger.error(`[Default Context] Error getting target instance ${targetId}`, e);
                    }
                }
            } else {
                this.#logger.debug(`[Event: ${eventType}] createJsonLogicContext returned a valid JsonLogicEvaluationContext.`);
            }

            // Step 3: Construct the final (nested) ExecutionContext for operation handlers
            finalNestedExecutionContext = {
                event: event,
                actor: jsonLogicDataForEvaluation.actor, // Promote actor from jsonLogicData to top-level for convenience
                target: jsonLogicDataForEvaluation.target, // Promote target from jsonLogicData to top-level for convenience
                logger: this.#logger, // The logger for this overall execution
                evaluationContext: jsonLogicDataForEvaluation // Nest the JsonLogic context here
            };
            this.#logger.debug(`[Event: ${eventType}] Final ExecutionContext (nested structure) assembled successfully.`);

        } catch (contextError) {
            this.#logger.error(`[Event: ${eventType}] Critical error during ExecutionContext assembly. Cannot proceed with rule processing for this event.`, contextError);
            return;
        }

        this.#logger.debug(`Processing ${matchingRules.length} rule(s) for event type: ${eventType} with final execution context...`);

        matchingRules.forEach(rule => {
            try {
                // Pass the FULL NESTED context (finalNestedExecutionContext) to #processRule.
                // #processRule will then extract the .evaluationContext part for its condition logic.
                this.#processRule(rule, event, finalNestedExecutionContext);
            } catch (error) {
                this.#logger.error(`[CRITICAL] Uncaught error during #processRule execution for rule '${rule.rule_id || 'NO_ID'}', event '${eventType}':`, error);
            }
        });

        try {
            if (finalNestedExecutionContext?.evaluationContext?.context) {
                this.#logger.debug('Final state of executionContext.evaluationContext.context keys: ' + Object.keys(finalNestedExecutionContext.evaluationContext.context).join(', '));
            } else {
                this.#logger.warn('Could not log final evaluationContext.context keys, path invalid.');
            }
        } catch (logError) {
            this.#logger.warn('Error logging final context keys.', logError);
        }
        this.#logger.debug(`Finished processing rules for event: ${eventType}.`);
    }

    #evaluateRuleCondition(rule, jsonLogicDataForEval) { // Receives the FLAT JsonLogicContext
        const ruleId = rule.rule_id || 'NO_ID';
        let conditionPassed = true;
        let evaluationErrorOccurred = false;

        // This check is crucial and correctly targets the flat context for JSONLogic
        if (!jsonLogicDataForEval || typeof jsonLogicDataForEval.context !== 'object' || jsonLogicDataForEval.context === null) {
            this.#logger.error(`[Rule ${ruleId} - ConditionEval] Invalid jsonLogicDataForEval or its .context property. Condition evaluation cannot proceed safely.`);
            return {conditionPassed: false, evaluationErrorOccurred: true};
        }

        if (rule.condition && typeof rule.condition === 'object' && Object.keys(rule.condition).length > 0) {
            this.#logger.debug(`[Rule ${ruleId}] Condition found. Evaluating using jsonLogicDataForEval...`);
            let conditionResult = false;
            try {
                conditionResult = this.#jsonLogicEvaluationService.evaluate(rule.condition, jsonLogicDataForEval);
                this.#logger.debug(`[Rule ${ruleId}] Condition evaluation raw result: ${conditionResult}`);
                conditionPassed = !!conditionResult;
            } catch (evalError) {
                evaluationErrorOccurred = true;
                conditionPassed = false;
                this.#logger.error(`[Rule ${ruleId}] Error during condition evaluation. Treating condition as FALSE.`, evalError);
            }
            this.#logger.debug(`[Rule ${ruleId}] Condition evaluation final boolean result: ${conditionPassed}`);
        } else {
            this.#logger.debug(`[Rule ${ruleId}] No condition defined or condition is empty. Defaulting to passed.`);
        }
        return {conditionPassed, evaluationErrorOccurred};
    }

    #processRule(rule, event, finalNestedExecutionContext) { // Receives the FULL NESTED context
        const ruleId = rule.rule_id || 'NO_ID';
        this.#logger.debug(`Processing rule '${ruleId}' for event '${event.type}'. Full context received.`);

        // Extract the flat JsonLogicContext (which is finalNestedExecutionContext.evaluationContext)
        // This is the data object that JSONLogic conditions will operate against.
        const jsonLogicDataForEval = finalNestedExecutionContext.evaluationContext;

        // Validate the actual data context that will be used by JSONLogic conditions
        if (!jsonLogicDataForEval || typeof jsonLogicDataForEval.context !== 'object' || jsonLogicDataForEval.context === null) {
            this.#logger.error(`[Rule ${ruleId}] The 'evaluationContext' or 'evaluationContext.context' within the provided execution context is invalid. Cannot evaluate rule condition.`, {receivedFullContext: finalNestedExecutionContext});
            return; // Halt processing for this rule
        }

        const evaluationResult = this.#evaluateRuleCondition(rule, jsonLogicDataForEval);

        if (evaluationResult.conditionPassed) {
            if (Array.isArray(rule.actions) && rule.actions.length > 0) {
                this.#logger.debug(`[Rule ${ruleId}] Executing ${rule.actions.length} actions.`);
                // _executeActions receives the FULL NESTED context, as OperationInterpreter and handlers expect it
                this._executeActions(rule.actions, finalNestedExecutionContext, `Rule '${ruleId}'`);
            } else {
                this.#logger.debug(`[Rule ${ruleId}] No valid actions defined or action list is empty.`);
            }
        } else {
            const reason = evaluationResult.evaluationErrorOccurred
                ? 'due to error during condition evaluation'
                : 'due to condition evaluating to false';
            this.#logger.info(`Rule '${ruleId}' actions skipped for event '${event.type}' ${reason}.`);
        }
    }

    _executeActions(actions, finalNestedExecutionContext, scopeDescription) { // Receives FULL NESTED context
        if (!Array.isArray(actions) || actions.length === 0) {
            this.#logger.debug(`No actions to execute for scope: ${scopeDescription}.`);
            return;
        }

        for (let i = 0; i < actions.length; i++) {
            const operation = actions[i];
            const operationIndex = i + 1;

            if (!operation || typeof operation !== 'object') {
                this.#logger.error(`---> [${scopeDescription} - Action ${operationIndex}] CRITICAL: Operation at index ${i} is not a valid object. Halting sequence. Operation:`, operation);
                break;
            }

            const operationDesc = operation.comment ? `(Comment: ${operation.comment})` : '';
            const opTypeString = operation?.type ?? 'MISSING_TYPE';
            this.#logger.debug(`---> [${scopeDescription} - Action ${operationIndex}/${actions.length}] Processing Operation: ${opTypeString} ${operationDesc}`);

            try {
                if (!this.#operationInterpreter) {
                    this.#logger.error(`---> [${scopeDescription} - Action ${operationIndex}] CRITICAL: OperationInterpreter not available! Halting sequence for this rule.`);
                    break;
                }

                if (opTypeString === 'IF') {
                    this.#handleIfOperation(operation, finalNestedExecutionContext, scopeDescription, operationIndex);
                } else {
                    // OperationInterpreter expects the FULL NESTED context
                    this.#operationInterpreter.execute(operation, finalNestedExecutionContext);
                    this.#logger.debug(`---> [${scopeDescription} - Action ${operationIndex}] OperationInterpreter.execute call completed (no error thrown) for type: ${opTypeString}`);
                }
            } catch (invocationError) {
                this.#logger.error(`---> [${scopeDescription} - Action ${operationIndex}/${actions.length}] CRITICAL error during execution of Operation ${opTypeString}. Halting sequence for this rule. Error:`, invocationError);
                break;
            }
        }
        this.#logger.info(`<--- Finished action sequence for: ${scopeDescription}.`);
    }

    #handleIfOperation(ifOperation, finalNestedExecutionContext, parentScopeDesc, operationIndex) { // Receives FULL NESTED context
        const parentIfDesc = `${parentScopeDesc} - IF Action ${operationIndex}`;
        const params = ifOperation.parameters;

        if (!params || typeof params.condition !== 'object' || params.condition === null || !Array.isArray(params.then_actions)) {
            this.#logger.error(`---> [${parentIfDesc}] Invalid IF operation structure: Missing or invalid 'condition' or 'then_actions'. Skipping IF block execution.`);
            return;
        }
        const condition = params.condition;
        const then_actions = params.then_actions;
        const else_actions = params.else_actions;

        let conditionResult = false;
        try {
            this.#logger.debug(`---> [${parentIfDesc}] Evaluating IF condition...`);
            // Evaluate IF's condition using the FLAT context from within the nested structure
            // This is finalNestedExecutionContext.evaluationContext
            const jsonLogicDataForIfCondition = finalNestedExecutionContext.evaluationContext;

            if (!jsonLogicDataForIfCondition || typeof jsonLogicDataForIfCondition.context !== 'object' || jsonLogicDataForIfCondition.context === null) {
                this.#logger.error(`---> [${parentIfDesc}] Invalid jsonLogicDataForIfCondition or its .context property for IF condition. Treating as FALSE.`);
                conditionResult = false; // Or throw an error specific to IF condition failure
            } else {
                conditionResult = this.#jsonLogicEvaluationService.evaluate(condition, jsonLogicDataForIfCondition);
            }
            this.#logger.info(`---> [${parentIfDesc}] IF condition evaluation result: ${conditionResult}`);
        } catch (evalError) {
            this.#logger.error(`---> [${parentIfDesc}] Error evaluating IF condition. Error:`, evalError);
            throw evalError; // Rethrow to be caught by _executeActions if desired, or handle differently
        }

        try {
            if (conditionResult) {
                this.#logger.debug(`---> [${parentIfDesc}] Condition TRUE. Executing THEN branch.`);
                this._executeActions(then_actions, finalNestedExecutionContext, `${parentIfDesc} / THEN`);
            } else {
                if (else_actions && Array.isArray(else_actions) && else_actions.length > 0) {
                    this.#logger.debug(`---> [${parentIfDesc}] Condition FALSE. Executing ELSE branch.`);
                    this._executeActions(else_actions, finalNestedExecutionContext, `${parentIfDesc} / ELSE`);
                } else {
                    this.#logger.debug(`---> [${parentIfDesc}] Condition FALSE and no ELSE branch present or actions empty. Continuing after IF block.`);
                }
            }
        } catch (nestedExecutionError) {
            this.#logger.error(`---> [${parentIfDesc}] Error during nested action execution (THEN/ELSE). Rethrowing. Error:`, nestedExecutionError);
            throw nestedExecutionError;
        }
        this.#logger.debug(`---> [${parentIfDesc}] Finished processing IF block.`);
    }

    shutdown() {
        this.#logger.info('SystemLogicInterpreter: Shutting down...');
        if (this.#eventBus && typeof this.#eventBus.unsubscribe === 'function' && this.#boundEventHandler) {
            try {
                this.#eventBus.unsubscribe('*', this.#boundEventHandler);
                this.#logger.info('SystemLogicInterpreter: Unsubscribed from all events (\'*\') on the EventBus.');
            } catch (error) {
                this.#logger.error('SystemLogicInterpreter: Error during event bus unsubscription:', error);
            }
        } else {
            if (!this.#boundEventHandler) {
                this.#logger.warn('SystemLogicInterpreter: Shutdown called, but no event handler was stored (possibly never initialized or subscribed).');
            } else {
                this.#logger.warn('SystemLogicInterpreter: Shutdown called, but EventBus or unsubscribe method is unavailable.');
            }
        }
        this.#ruleCache.clear();
        this.#initialized = false;
        this.#boundEventHandler = null;
        this.#logger.info('SystemLogicInterpreter: Shutdown complete.');
    }
}

export default SystemLogicInterpreter;