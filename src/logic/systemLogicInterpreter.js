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
        // --- AC1: Added Validation ---
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
     * Finds matching rules based on event type and processes them.
     * @param {GameEvent} event - The event object dispatched by the EventBus.
     * @private
     */
    #handleEvent(event) { // <<< MODIFY THIS METHOD
        if (!event || typeof event.type !== 'string') {
            this.#logger.warn('Received invalid event object. Ignoring.', {event});
            // --- Add temporary console log ---
            console.log('[SystemLogicInterpreter DEBUG] Received invalid event object. Ignoring.');
            return;
        }

        const eventType = event.type; // Store for clarity and use eventType below

        const matchingRules = this.#ruleCache.get(eventType);

        this.#logger.debug(`Received event: ${eventType}`, {payload: event.payload}); // Existing log

        // Use the retrieved value, ensuring it's an array for the length check
        const rulesToProcess = matchingRules || [];

        if (rulesToProcess.length === 0) {
            this.#logger.debug(`No system rules found for event type: ${eventType}`);
            return; // Return early
        }

        // If we reach here, the condition was false
        this.#logger.debug(`Found ${rulesToProcess.length} rule(s) matching event type: ${eventType}. Processing...`); // Existing log

        rulesToProcess.forEach(rule => {
            try {
                this.#processRule(rule, event);
            } catch (error) {
                this.#logger.error(`[CRITICAL] Uncaught error during #processRule execution for rule '${rule.rule_id || 'NO_ID'}', event '${eventType}':`, error);
            }
        });
    }

    /**
     * Evaluates the condition of a system rule, if present.
     * Handles logging related to condition presence and evaluation outcome/errors.
     * @param {SystemRule} rule - The system rule definition.
     * @param {JsonLogicEvaluationContext} evaluationContext - The context for evaluation.
     * @returns {ConditionEvaluationResult} An object indicating if the condition passed and if an error occurred.
     * @private
     * @fulfils AC1, AC4
     */
    #evaluateRuleCondition(rule, evaluationContext) {
        const ruleId = rule.rule_id || 'NO_ID';
        let conditionPassed = true;
        let evaluationErrorOccurred = false;

        // Check if a valid condition object exists
        if (rule.condition && typeof rule.condition === 'object' && Object.keys(rule.condition).length > 0) {
            this.#logger.debug(`[Rule ${ruleId}] Condition found. Evaluating...`);
            let conditionResult = false;
            try {
                this.#logger.debug(`[Rule ${ruleId}] Starting condition evaluation.`);
                // Pass evaluation context to the service
                conditionResult = this.#jsonLogicEvaluationService.evaluate(rule.condition, evaluationContext);
                this.#logger.debug(`[Rule ${ruleId}] Condition evaluation raw result: ${conditionResult}`);
                conditionPassed = !!conditionResult; // Convert to boolean
            } catch (evalError) {
                evaluationErrorOccurred = true;
                conditionPassed = false; // Treat evaluation errors as condition failure
                // AC4: Log evaluation error details
                this.#logger.error(
                    `[Rule ${ruleId}] Error during condition evaluation. Treating condition as FALSE.`,
                    evalError // Log the actual error object
                );
            }
            // AC4: Log the final boolean outcome after evaluation
            this.#logger.debug(`[Rule ${ruleId}] Condition evaluation final boolean result: ${conditionPassed}`);

        } else {
            // AC4: Log when no condition is present
            this.#logger.debug(`[Rule ${ruleId}] No condition defined or condition is empty. Defaulting to passed.`);
            // conditionPassed remains true (default)
        }

        return {conditionPassed, evaluationErrorOccurred};
    }

    /**
     * Processes a single matched SystemRule against the triggering event.
     * Assembles context, evaluates the rule's condition (if any) via #evaluateRuleCondition,
     * and executes actions if the condition passes.
     * @param {SystemRule} rule - The system rule definition.
     * @param {GameEvent} event - The triggering event.
     * @private
     */
    #processRule(rule, event) {
        const ruleId = rule.rule_id || 'NO_ID';
        this.#logger.debug(`Processing rule '${ruleId}' for event '${event.type}'...`);

        /** @type {JsonLogicEvaluationContext | null} */
        let evaluationContext = null;

        // 1. Assemble Context
        try {
            const actorId = event.payload?.actorId ?? event.payload?.entityId ?? null;
            const targetId = event.payload?.targetId ?? null;
            this.#logger.debug(`[Rule ${ruleId}] Resolved IDs - Actor: ${actorId}, Target: ${targetId}`);
            this.#logger.debug(`[Rule ${ruleId}] Assembling JsonLogic context...`);
            evaluationContext = createJsonLogicContext(event, actorId, targetId, this.#entityManager, this.#logger);
            const actorFound = !!evaluationContext?.actor;
            const targetFound = !!evaluationContext?.target;
            this.#logger.debug(`[Rule ${ruleId}] JsonLogic context assembled successfully. Actor found: ${actorFound}, Target found: ${targetFound}`);
        } catch (contextError) {
            this.#logger.error(`[Rule ${ruleId}] Failed to assemble JsonLogicEvaluationContext for event '${event.type}'. Cannot proceed with rule evaluation/execution.`, contextError);
            return; // Stop processing this rule if context fails
        }

        // 2. Evaluate Condition
        const evaluationResult = this.#evaluateRuleCondition(rule, evaluationContext);

        // 3. Execute Actions based on Condition Result
        if (evaluationResult.conditionPassed) {
            this.#logger.debug(`[Rule ${ruleId}] Condition passed or absent. Checking for actions.`);

            let actionsToExecute = null;
            let actionsAreValid = false;
            try {
                this.#logger.debug(`---> [${ruleId}] Pre-check rule.actions type: ${typeof rule.actions}, isArray: ${Array.isArray(rule.actions)}`);

                if (Array.isArray(rule.actions) && rule.actions.length > 0) {
                    actionsToExecute = rule.actions; // Assign if it's a valid array
                    actionsAreValid = true;
                    this.#logger.debug(`---> [${ruleId}] rule.actions appears to be a valid, non-empty array. Length: ${actionsToExecute.length}`);
                    // Attempt to log content safely
                    try {
                        this.#logger.debug(`---> [${ruleId}] rule.actions content: ${JSON.stringify(actionsToExecute)}`);
                        // Check the first element explicitly
                        if (actionsToExecute[0]) {
                            this.#logger.debug(`---> [${ruleId}] First action type: ${actionsToExecute[0].type}`);
                        } else {
                            this.#logger.warn(`---> [${ruleId}] First action element is null/undefined!`);
                        }
                    } catch (stringifyError) {
                        this.#logger.error(`---> [${ruleId}] FAILED to stringify rule.actions!`, stringifyError);
                        // Even if stringify fails, proceed if it's an array
                    }
                } else {
                    this.#logger.debug(`---> [${ruleId}] rule.actions is not a non-empty array. Type: ${typeof rule.actions}, Length: ${rule.actions ? rule.actions.length : 'N/A'}`);
                }
            } catch (checkError) {
                this.#logger.error(`---> [${ruleId}] CRITICAL Error during rule.actions check!`, checkError);
                // Do not proceed if the check itself fails critically
                actionsAreValid = false;
            }
            // +++ END DEBUG +++


            // --- Original Logic (modified to use checked variables) ---
            // if (Array.isArray(rule.actions) && rule.actions.length > 0) { // Original check
            if (actionsAreValid && actionsToExecute) { // Use the result of our checks
                this.#logger.debug(`[Rule ${ruleId}] Executing ${actionsToExecute.length} actions.`); // Use checked length
                // Pass the potentially validated actions array
                this._executeActions(actionsToExecute, evaluationContext, `Rule '${ruleId}'`); // Use checked array
            } else {
                this.#logger.debug(`[Rule ${ruleId}] No valid actions defined or action list is empty.`); // Updated log
            }
            // --- End Original Logic ---

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
     * logs them, and halts the sequence for the current rule.
     *
     * @param {Operation[]} actions - The array of Operation objects to execute.
     * @param {JsonLogicEvaluationContext} executionContext - The context for this execution sequence.
     * @param {string} scopeDescription - A description for logging (e.g., "Rule 'X'", "IF THEN branch").
     * @private
     */
    _executeActions(actions, executionContext, scopeDescription) {
        if (!Array.isArray(actions) || actions.length === 0) {
            this.#logger.debug(`No actions to execute for scope: ${scopeDescription}.`);
            return;
        }

        this.#logger.info(`---> Entering action sequence for: ${scopeDescription}. ${actions.length} actions total.`);
        // +++ DEBUG: Log the actions array itself +++
        try {
            this.#logger.debug(`---> Actions content for ${scopeDescription}: ${JSON.stringify(actions)}`);
        } catch (e) {
            this.#logger.warn(`---> Could not stringify actions array for ${scopeDescription}`);
        }
        // +++ END DEBUG +++


        for (let i = 0; i < actions.length; i++) {
            // +++ DEBUG: Add very early log inside loop +++
            this.#logger.debug(`---> [${scopeDescription}] Loop iteration START: i = ${i}`);
            // +++ END DEBUG +++

            const operation = actions[i];
            const operationIndex = i + 1; // 1-based index for logging

            // +++ DEBUG: Check if operation is valid early +++
            if (!operation || typeof operation !== 'object') {
                this.#logger.error(`---> [${scopeDescription} - Action ${operationIndex}] CRITICAL: Operation at index ${i} is not a valid object. Halting sequence. Operation:`, operation);
                console.error(`!!!!!!!!! CRITICAL: Operation at index ${i} is not a valid object !!!!!!!!!!`, operation); // Direct console fallback
                break;
            }
            // +++ END DEBUG +++

            const operationDesc = operation.comment ? `(Comment: ${operation.comment})` : '';
            const opTypeString = operation?.type ?? 'MISSING_TYPE'; // Handle potentially missing type

            this.#logger.debug(`---> [${scopeDescription} - Action ${operationIndex}/${actions.length}] Processing Operation: ${opTypeString} ${operationDesc}`);

            try {
                if (!this.#operationInterpreter) {
                    this.#logger.error(`---> [${scopeDescription} - Action ${operationIndex}] CRITICAL: OperationInterpreter not available! Halting sequence for this rule.`);
                    console.error(`!!!!!!!!! CRITICAL: OperationInterpreter not available !!!!!!!!!!`); // Direct console fallback
                    break; // Halt the sequence
                }

                // Handle IF internally first because it controls flow within this interpreter
                if (opTypeString === 'IF') {
                    this.#handleIfOperation(operation, executionContext, scopeDescription, operationIndex);
                } else {
                    // +++ DEBUG: Log before calling interpreter execute +++
                    this.#logger.debug(`---> [${scopeDescription} - Action ${operationIndex}] Calling OperationInterpreter.execute for type: ${opTypeString}`);
                    // +++ END DEBUG +++
                    this.#operationInterpreter.execute(operation, executionContext);
                    // +++ DEBUG: Log after calling interpreter execute (if no error) +++
                    this.#logger.debug(`---> [${scopeDescription} - Action ${operationIndex}] OperationInterpreter.execute call completed (no error thrown) for type: ${opTypeString}`);
                    // +++ END DEBUG +++
                }

            } catch (invocationError) {
                // --- TICKET-12.2: Catch Block Enhancement ---
                // +++ DEBUG: Use console.error as fallback +++
                console.error(`!!!!!!!!! ERROR CAUGHT IN _executeActions CATCH BLOCK (Rule: ${scopeDescription}, Action Index: ${i}) !!!!!!!!!!`, invocationError);
                // +++ END DEBUG +++

                // Log the critical error with context and the error object
                this.#logger.error(
                    `---> [${scopeDescription} - Action ${operationIndex}/${actions.length}] CRITICAL error during execution of Operation ${opTypeString}. Halting sequence for this rule. Error:`,
                    invocationError // Log the actual error object
                );
                // Halt the loop, preventing subsequent actions in this sequence
                break;
                // --- END TICKET-12.2 ---
            }
        }

        this.#logger.info(`<--- Finished action sequence for: ${scopeDescription}.`);
    }


    /**
     * Handles the execution logic for an IF operation.
     * Evaluates the condition and recursively calls _executeActions for the appropriate branch.
     * @param {Operation} ifOperation - The IF operation object.
     * @param {JsonLogicEvaluationContext} executionContext - The current execution context.
     * @param {string} parentScopeDesc - Description of the parent scope for logging.
     * @param {number} operationIndex - Index of the IF operation in its sequence.
     * @private
     * @throws {Error} Rethrows errors from evaluation or nested execution to be caught by caller (_executeActions).
     */
    #handleIfOperation(ifOperation, executionContext, parentScopeDesc, operationIndex) {
        const parentIfDesc = `${parentScopeDesc} - IF Action ${operationIndex}`;

        const params = ifOperation.parameters;
        // Improved validation: Check params exist before accessing properties
        if (!params || typeof params.condition !== 'object' || params.condition === null || !Array.isArray(params.then_actions)) {
            // Log as error, but don't throw here - allow outer loop to potentially continue if desired (though currently it halts on throw)
            this.#logger.error(`---> [${parentIfDesc}] Invalid IF operation structure: Missing or invalid 'condition' or 'then_actions'. Skipping IF block execution.`);
            // Consider if this *should* throw to halt the main sequence, per strict error handling.
            // For now, logging and returning as per original structure. If this should halt, throw new Error(...).
            return;
        }
        const condition = params.condition;
        const then_actions = params.then_actions;
        const else_actions = params.else_actions; // Optional, validation below

        let conditionResult = false;
        try {
            this.#logger.debug(`---> [${parentIfDesc}] Evaluating IF condition...`);
            conditionResult = this.#jsonLogicEvaluationService.evaluate(condition, executionContext);
            this.#logger.info(`---> [${parentIfDesc}] IF condition evaluation result: ${conditionResult}`);
        } catch (evalError) {
            this.#logger.error(`---> [${parentIfDesc}] Error evaluating IF condition. Error:`, evalError);
            // --- TICKET-12.2 Review: Re-throw evaluation error ---
            // This error will be caught by the `catch` block in the calling `_executeActions` loop,
            // which will then log it again (with more context) and halt the sequence via `break;`.
            throw evalError;
        }

        try {
            // --- TICKET-12.2 Review: Nested Execution Errors ---
            // Errors thrown during the recursive call to _executeActions within either
            // the THEN or ELSE branch will also propagate up to the `catch` block
            // in the *calling* `_executeActions` loop (the one iterating through the main action list).
            // That catch block handles the logging and halting.
            if (conditionResult) {
                this.#logger.debug(`---> [${parentIfDesc}] Condition TRUE. Executing THEN branch.`);
                // Execute THEN actions. Errors here will propagate up.
                this._executeActions(then_actions, executionContext, `${parentIfDesc} / THEN`);
            } else {
                // Validate else_actions only if the condition is false
                if (else_actions && Array.isArray(else_actions) && else_actions.length > 0) {
                    this.#logger.debug(`---> [${parentIfDesc}] Condition FALSE. Executing ELSE branch.`);
                    // Execute ELSE actions. Errors here will propagate up.
                    this._executeActions(else_actions, executionContext, `${parentIfDesc} / ELSE`);
                } else {
                    this.#logger.debug(`---> [${parentIfDesc}] Condition FALSE and no ELSE branch present or actions empty. Continuing after IF block.`);
                }
            }
        } catch (nestedExecutionError) {
            // This catch block is technically redundant if the goal is just propagation.
            // However, keeping it allows for potential specific logging *at this level* if needed later.
            // For now, just re-throw to ensure it reaches the primary catch in _executeActions.
            this.#logger.error(`---> [${parentIfDesc}] Error during nested action execution (THEN/ELSE). Error:`, nestedExecutionError);
            throw nestedExecutionError; // Ensure propagation
        }

        this.#logger.debug(`---> [${parentIfDesc}] Finished processing IF block.`);
    }

}

export default SystemLogicInterpreter;