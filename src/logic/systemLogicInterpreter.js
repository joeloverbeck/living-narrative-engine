// src/logic/systemLogicInterpreter.js

import {createJsonLogicContext} from './contextAssembler.js';

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../core/eventBus.js').default} EventBus */
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

    /**
     * Creates an instance of SystemLogicInterpreter.
     * @param {object} dependencies - The required services.
     * @param {ILogger} dependencies.logger - Logging service.
     * @param {EventBus} dependencies.eventBus - Service for event subscription and dispatch.
     * @param {IDataRegistry} dependencies.dataRegistry - Service to access loaded game data, including system rules.
     * @param {JsonLogicEvaluationService} dependencies.jsonLogicEvaluationService - Service to evaluate JSON Logic rules.
     * @param {EntityManager} dependencies.entityManager - Service to manage entities (needed for context assembly).
     * @param {OperationInterpreter} dependencies.operationInterpreter - Service to execute individual operations.
     * @throws {Error} If any required dependency is missing or invalid.
     */
    constructor({logger, eventBus, dataRegistry, jsonLogicEvaluationService, entityManager, operationInterpreter}) {
        // --- Existing Validation ---
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
        // --- End Validation ---

        this.#logger = logger;
        this.#eventBus = eventBus;
        this.#dataRegistry = dataRegistry;
        this.#jsonLogicEvaluationService = jsonLogicEvaluationService;
        this.#entityManager = entityManager;
        this.#operationInterpreter = operationInterpreter;

        this.#logger.info('SystemLogicInterpreter initialized. Ready to process events.');
    }

    /**
     * Loads rules from the registry, builds the cache, and subscribes to events.
     * Should be called after all services are ready.
     */
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

    /**
     * Loads all system rules from the data registry and caches them by event type.
     * @private
     */
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

    /**
     * Subscribes to the event bus to handle incoming events.
     * @private
     */
    #subscribeToEvents() {
        const eventTypesToListen = Array.from(this.#ruleCache.keys());
        if (eventTypesToListen.length > 0) {
            this.#eventBus.subscribe('*', this.#handleEvent.bind(this));
            this.#logger.info('Subscribed to all events (\'*\') using the EventBus.');
        } else {
            this.#logger.warn('No system rules loaded or cached. SystemLogicInterpreter will not actively listen for specific events.');
        }
    }

    /**
     * Handles an incoming event from the EventBus.
     * Finds matching rules, creates a SHARED context for this event, and processes each rule sequentially.
     * @param {GameEvent} event - The event object dispatched by the EventBus.
     * @private
     */
    #handleEvent(event) { // <<< MODIFIED METHOD >>>
        if (!event || typeof event.type !== 'string') {
            this.#logger.warn('Received invalid event object. Ignoring.', {event});
            return;
        }

        const eventType = event.type;
        const matchingRules = this.#ruleCache.get(eventType) || []; // Ensure it's an array

        this.#logger.debug(`Received event: ${eventType}. Found ${matchingRules.length} potential rule(s).`, {payload: event.payload});

        if (matchingRules.length === 0) {
            this.#logger.debug(`No system rules found for event type: ${eventType}`);
            return;
        }

        // --- FIX: Create ONE shared execution context for all rules triggered by THIS event ---
        let sharedExecutionContext = null;
        try {
            const actorId = event.payload?.actorId ?? event.payload?.entityId ?? null;
            const targetId = event.payload?.targetId ?? null;
            this.#logger.debug(`[Event: ${eventType}] Assembling shared JsonLogic context... (Actor: ${actorId}, Target: ${targetId})`);
            // Create the initial context object using the utility function
            sharedExecutionContext = createJsonLogicContext(event, actorId, targetId, this.#entityManager, this.#logger);

            // Ensure the 'context' property exists and is an object
            if (!sharedExecutionContext || typeof sharedExecutionContext.context !== 'object' || sharedExecutionContext.context === null) {
                this.#logger.warn(`[Event: ${eventType}] createJsonLogicContext did not return a valid structure with a context object. Creating default context.`);
                // Fallback if createJsonLogicContext is flawed or needs update
                if (!sharedExecutionContext) sharedExecutionContext = {};
                sharedExecutionContext.context = {}; // Ensure the mutable part exists
                // Manually add event if needed, assuming createJsonLogicContext should ideally do this
                sharedExecutionContext.event = event;
            }

            this.#logger.debug(`[Event: ${eventType}] Shared context assembled successfully.`);
        } catch (contextError) {
            this.#logger.error(`[Event: ${eventType}] Failed to assemble shared JsonLogicEvaluationContext. Cannot proceed with rule processing for this event.`, contextError);
            return; // Stop processing rules for this event if context fails fundamentally
        }
        // --- END FIX ---

        this.#logger.debug(`Processing ${matchingRules.length} rule(s) for event type: ${eventType} with shared context...`);

        // Process rules sequentially, passing the SAME shared context
        matchingRules.forEach(rule => {
            try {
                // <<< Pass the shared context to #processRule >>>
                this.#processRule(rule, event, sharedExecutionContext);
            } catch (error) {
                this.#logger.error(`[CRITICAL] Uncaught error during #processRule execution for rule '${rule.rule_id || 'NO_ID'}', event '${eventType}':`, error);
                // Continue to the next rule even if one fails catastrophically? Or break? For now, continue.
            }
        });

        this.#logger.debug('Final state of sharedExecutionContext.context: ' + sharedExecutionContext.context);

        this.#logger.debug(`Finished processing rules for event: ${eventType}.`);
    }

    /**
     * Evaluates the condition of a system rule, if present.
     * Handles logging related to condition presence and evaluation outcome/errors.
     * @param {SystemRule} rule - The system rule definition.
     * @param {JsonLogicEvaluationContext} evaluationContext - The context for evaluation (shared across rules for the same event).
     * @returns {ConditionEvaluationResult} An object indicating if the condition passed and if an error occurred.
     * @private
     */
    #evaluateRuleCondition(rule, evaluationContext) {
        const ruleId = rule.rule_id || 'NO_ID';
        let conditionPassed = true;
        let evaluationErrorOccurred = false;

        // Check if a valid condition object exists
        if (rule.condition && typeof rule.condition === 'object' && Object.keys(rule.condition).length > 0) {
            this.#logger.debug(`[Rule ${ruleId}] Condition found. Evaluating using shared context...`);
            let conditionResult = false;
            try {
                // Pass the shared evaluation context to the service
                conditionResult = this.#jsonLogicEvaluationService.evaluate(rule.condition, evaluationContext);
                this.#logger.debug(`[Rule ${ruleId}] Condition evaluation raw result: ${conditionResult}`);
                conditionPassed = !!conditionResult; // Convert to boolean
            } catch (evalError) {
                evaluationErrorOccurred = true;
                conditionPassed = false; // Treat evaluation errors as condition failure
                this.#logger.error(
                    `[Rule ${ruleId}] Error during condition evaluation. Treating condition as FALSE.`,
                    evalError
                );
            }
            this.#logger.debug(`[Rule ${ruleId}] Condition evaluation final boolean result: ${conditionPassed}`);

        } else {
            this.#logger.debug(`[Rule ${ruleId}] No condition defined or condition is empty. Defaulting to passed.`);
        }

        return {conditionPassed, evaluationErrorOccurred};
    }

    /**
     * Processes a single matched SystemRule against the triggering event using the shared context.
     * Evaluates the rule's condition and executes actions if the condition passes.
     * @param {SystemRule} rule - The system rule definition.
     * @param {GameEvent} event - The triggering event (primarily for logging).
     * @param {JsonLogicEvaluationContext} sharedExecutionContext - The shared context object for this event.
     * @private
     */
    #processRule(rule, event, sharedExecutionContext) { // <<< MODIFIED Signature >>>
        const ruleId = rule.rule_id || 'NO_ID';
        this.#logger.debug(`Processing rule '${ruleId}' for event '${event.type}' using shared context...`);

        // --- FIX: Use the shared context directly ---
        // No need to assemble context here, it's passed in.
        // Optional: Add validation if sharedExecutionContext might be null/invalid despite checks in #handleEvent
        if (!sharedExecutionContext || typeof sharedExecutionContext.context !== 'object') {
            this.#logger.error(`[Rule ${ruleId}] Invalid sharedExecutionContext received. Halting processing for this rule.`);
            return;
        }
        // --- END FIX ---

        // 2. Evaluate Condition (using the shared context)
        const evaluationResult = this.#evaluateRuleCondition(rule, sharedExecutionContext);

        // 3. Execute Actions based on Condition Result
        if (evaluationResult.conditionPassed) {
            // Basic check for actions array
            if (Array.isArray(rule.actions) && rule.actions.length > 0) {
                this.#logger.debug(`[Rule ${ruleId}] Executing ${rule.actions.length} actions.`);
                // <<< Pass the shared context to _executeActions >>>
                this._executeActions(rule.actions, sharedExecutionContext, `Rule '${ruleId}'`);
            } else {
                this.#logger.debug(`[Rule ${ruleId}] No valid actions defined or action list is empty.`);
            }

        } else {
            const reason = evaluationResult.evaluationErrorOccurred
                ? 'due to error during condition evaluation'
                : 'due to condition evaluating to false';
            this.#logger.info(
                `Rule '${ruleId}' actions skipped for event '${event.type}' ${reason}.`
            );
        }
    }


    /**
     * Executes a sequence of Operation objects using the OperationInterpreter.
     * Handles errors during the *invocation* of the interpreter or IF handling,
     * logs them, and halts the sequence for the current rule/scope.
     *
     * @param {Operation[]} actions - The array of Operation objects to execute.
     * @param {JsonLogicEvaluationContext} executionContext - The context for this execution sequence (shared).
     * @param {string} scopeDescription - A description for logging (e.g., "Rule 'X'", "IF THEN branch").
     * @private
     */
    _executeActions(actions, executionContext, scopeDescription) { // <<< Signature unchanged, but receives shared context >>>
        if (!Array.isArray(actions) || actions.length === 0) {
            this.#logger.debug(`No actions to execute for scope: ${scopeDescription}.`);
            return;
        }

        this.#logger.info(`---> Entering action sequence for: ${scopeDescription}. ${actions.length} actions total.`);
        // Logging actions content removed for brevity, but can be added back if needed

        for (let i = 0; i < actions.length; i++) {
            const operation = actions[i];
            const operationIndex = i + 1;

            if (!operation || typeof operation !== 'object') {
                this.#logger.error(`---> [${scopeDescription} - Action ${operationIndex}] CRITICAL: Operation at index ${i} is not a valid object. Halting sequence. Operation:`, operation);
                break; // Halt this sequence
            }

            const operationDesc = operation.comment ? `(Comment: ${operation.comment})` : '';
            const opTypeString = operation?.type ?? 'MISSING_TYPE';

            this.#logger.debug(`---> [${scopeDescription} - Action ${operationIndex}/${actions.length}] Processing Operation: ${opTypeString} ${operationDesc}`);

            try {
                if (!this.#operationInterpreter) {
                    this.#logger.error(`---> [${scopeDescription} - Action ${operationIndex}] CRITICAL: OperationInterpreter not available! Halting sequence for this rule.`);
                    break; // Halt the sequence
                }

                // Handle IF internally first
                if (opTypeString === 'IF') {
                    // <<< Pass the shared context down >>>
                    this.#handleIfOperation(operation, executionContext, scopeDescription, operationIndex);
                } else {
                    // <<< Pass the shared context down >>>
                    this.#operationInterpreter.execute(operation, executionContext);
                    this.#logger.debug(`---> [${scopeDescription} - Action ${operationIndex}] OperationInterpreter.execute call completed (no error thrown) for type: ${opTypeString}`);
                }

            } catch (invocationError) {
                console.error(`!!!!!!!!! ERROR CAUGHT IN _executeActions CATCH BLOCK (Rule: ${scopeDescription}, Action Index: ${i}) !!!!!!!!!!`, invocationError);
                this.#logger.error(
                    `---> [${scopeDescription} - Action ${operationIndex}/${actions.length}] CRITICAL error during execution of Operation ${opTypeString}. Halting sequence for this rule. Error:`,
                    invocationError // Log the actual error object
                );
                break; // Halt the sequence for this rule/scope
            }
        }

        this.#logger.info(`<--- Finished action sequence for: ${scopeDescription}.`);
    }


    /**
     * Handles the execution logic for an IF operation.
     * Evaluates the condition and recursively calls _executeActions for the appropriate branch.
     * @param {Operation} ifOperation - The IF operation object.
     * @param {JsonLogicEvaluationContext} executionContext - The current execution context (shared).
     * @param {string} parentScopeDesc - Description of the parent scope for logging.
     * @param {number} operationIndex - Index of the IF operation in its sequence.
     * @private
     * @throws {Error} Rethrows errors from evaluation or nested execution to be caught by caller (_executeActions).
     */
    #handleIfOperation(ifOperation, executionContext, parentScopeDesc, operationIndex) { // <<< Signature unchanged, but receives shared context >>>
        const parentIfDesc = `${parentScopeDesc} - IF Action ${operationIndex}`;

        const params = ifOperation.parameters;
        if (!params || typeof params.condition !== 'object' || params.condition === null || !Array.isArray(params.then_actions)) {
            this.#logger.error(`---> [${parentIfDesc}] Invalid IF operation structure: Missing or invalid 'condition' or 'then_actions'. Skipping IF block execution.`);
            return; // Skip this IF
        }
        const condition = params.condition;
        const then_actions = params.then_actions;
        const else_actions = params.else_actions;

        let conditionResult = false;
        try {
            this.#logger.debug(`---> [${parentIfDesc}] Evaluating IF condition using shared context...`);
            // <<< Pass the shared context >>>
            conditionResult = this.#jsonLogicEvaluationService.evaluate(condition, executionContext);
            this.#logger.info(`---> [${parentIfDesc}] IF condition evaluation result: ${conditionResult}`);
        } catch (evalError) {
            this.#logger.error(`---> [${parentIfDesc}] Error evaluating IF condition. Error:`, evalError);
            throw evalError; // Propagate error to halt _executeActions loop
        }

        try {
            if (conditionResult) {
                this.#logger.debug(`---> [${parentIfDesc}] Condition TRUE. Executing THEN branch.`);
                // <<< Pass the shared context >>>
                this._executeActions(then_actions, executionContext, `${parentIfDesc} / THEN`);
            } else {
                if (else_actions && Array.isArray(else_actions) && else_actions.length > 0) {
                    this.#logger.debug(`---> [${parentIfDesc}] Condition FALSE. Executing ELSE branch.`);
                    // <<< Pass the shared context >>>
                    this._executeActions(else_actions, executionContext, `${parentIfDesc} / ELSE`);
                } else {
                    this.#logger.debug(`---> [${parentIfDesc}] Condition FALSE and no ELSE branch present or actions empty. Continuing after IF block.`);
                }
            }
        } catch (nestedExecutionError) {
            // Log here if needed, but primarily rely on _executeActions catch block
            this.#logger.error(`---> [${parentIfDesc}] Error during nested action execution (THEN/ELSE). Rethrowing. Error:`, nestedExecutionError);
            throw nestedExecutionError; // Ensure propagation
        }

        this.#logger.debug(`---> [${parentIfDesc}] Finished processing IF block.`);
    }

}

export default SystemLogicInterpreter;