// src/logic/systemLogicInterpreter.js

import {createJsonLogicContext} from './contextAssembler.js'; // Assuming path

// --- JSDoc Imports for Type Hinting ---
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../core/interfaces/coreServices.js').IDataRegistry} IDataRegistry */
/** @typedef {import('../core/eventBus.js').default} EventBus */ // Assuming path and default export
/** @typedef {import('./jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */ // Assuming path and default export
/** @typedef {import('../entities/entityManager.js').default} EntityManager */ // Assuming path and default export
/** @typedef {import('./defs.js').GameEvent} GameEvent */ // Assuming GameEvent definition exists
/** @typedef {import('../../data/schemas/system-rule.schema.json').SystemRule} SystemRule */ // Assuming generated type or structural compatibility
/** @typedef {import('../../data/schemas/operation.schema.json').Operation} Operation */ // Define Operation based on schema
/** @typedef {import('./defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */

/**
 * @class SystemLogicInterpreter
 * Responsible for listening to game events, matching them against SystemRule definitions,
 * evaluating optional rule conditions using JSON Logic, and triggering the execution
 * of the rule's action sequence if the conditions are met.
 */
class SystemLogicInterpreter {
    /**
     * @private
     * @type {ILogger}
     */
    #logger;

    /**
     * @private
     * @type {EventBus}
     */
    #eventBus;

    /**
     * @private
     * @type {IDataRegistry}
     */
    #dataRegistry;

    /**
     * @private
     * @type {JsonLogicEvaluationService}
     */
    #jsonLogicEvaluationService;

    /**
     * @private
     * @type {EntityManager}
     */
    #entityManager;

    /**
     * @private
     * @type {Map<string, SystemRule[]>}
     * @description Cache of rules keyed by event type for faster lookup.
     */
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
     * @throws {Error} If any required dependency is missing or invalid.
     */
    constructor({logger, eventBus, dataRegistry, jsonLogicEvaluationService, entityManager}) {
        if (!logger || typeof logger.info !== 'function') {
            throw new Error("SystemLogicInterpreter requires a valid ILogger instance.");
        }
        if (!eventBus || typeof eventBus.subscribe !== 'function') {
            throw new Error("SystemLogicInterpreter requires a valid EventBus instance with a 'subscribe' method.");
        }
        if (!dataRegistry || typeof dataRegistry.getAllSystemRules !== 'function') { // Assuming getAllSystemRules exists
            throw new Error("SystemLogicInterpreter requires a valid IDataRegistry instance with an 'getAllSystemRules' method.");
        }
        if (!jsonLogicEvaluationService || typeof jsonLogicEvaluationService.evaluate !== 'function') {
            throw new Error("SystemLogicInterpreter requires a valid JsonLogicEvaluationService instance.");
        }
        if (!entityManager || typeof entityManager.getEntityInstance !== 'function') {
            throw new Error("SystemLogicInterpreter requires a valid EntityManager instance.");
        }

        this.#logger = logger;
        this.#eventBus = eventBus;
        this.#dataRegistry = dataRegistry;
        this.#jsonLogicEvaluationService = jsonLogicEvaluationService;
        this.#entityManager = entityManager;

        this.#logger.info("SystemLogicInterpreter initialized. Ready to process events.");
    }

    /**
     * Loads rules from the registry, builds the cache, and subscribes to events.
     * Should be called after all services are ready.
     */
    initialize() {
        if (this.#initialized) {
            this.#logger.warn("SystemLogicInterpreter already initialized.");
            return;
        }
        this.#loadAndCacheRules();
        this.#subscribeToEvents();
        this.#initialized = true;
        this.#logger.info("SystemLogicInterpreter successfully initialized and subscribed to events.");
    }

    /**
     * Loads all system rules from the data registry and caches them by event type.
     * @private
     */
    #loadAndCacheRules() {
        this.#logger.info("Loading and caching system rules by event type...");
        this.#ruleCache.clear(); // Clear existing cache if re-initializing
        const allRules = this.#dataRegistry.getAllSystemRules(); // Assuming this returns SystemRule[]

        if (!allRules || !Array.isArray(allRules)) {
            this.#logger.error("Failed to load system rules from data registry. Result was not an array.");
            return;
        }

        for (const rule of allRules) {
            if (!rule || typeof rule.event_type !== 'string') {
                this.#logger.warn("Skipping invalid rule definition (missing or invalid event_type):", rule);
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
            this.#logger.info(`Subscribed to all events ('*') using the EventBus.`);
        } else {
            this.#logger.warn("No system rules loaded or cached. SystemLogicInterpreter will not actively listen for specific events.");
        }
    }

    /**
     * Handles an incoming event from the EventBus.
     * Finds matching rules based on event type and processes them.
     * @param {GameEvent} event - The event object dispatched by the EventBus.
     * @private
     */
    #handleEvent(event) {
        if (!event || typeof event.type !== 'string') {
            this.#logger.warn("Received invalid event object. Ignoring.", {event});
            return;
        }

        this.#logger.debug(`Received event: ${event.type}`, {payload: event.payload});

        const matchingRules = this.#ruleCache.get(event.type) || [];

        if (matchingRules.length === 0) {
            this.#logger.debug(`No system rules found for event type: ${event.type}`);
            return;
        }

        this.#logger.debug(`Found ${matchingRules.length} rule(s) matching event type: ${event.type}. Processing...`);

        matchingRules.forEach(rule => {
            try {
                this.#processRule(rule, event);
            } catch (error) {
                this.#logger.error(`Error processing rule '${rule.rule_id || 'NO_ID'}' for event '${event.type}':`, error);
            }
        });
    }

    /**
     * Processes a single matched SystemRule against the triggering event.
     * Evaluates the rule's condition (if any) and executes actions if the condition passes.
     * @param {SystemRule} rule - The system rule definition.
     * @param {GameEvent} event - The triggering event.
     * @private
     */
    #processRule(rule, event) {
        const ruleId = rule.rule_id || 'NO_ID';
        this.#logger.debug(`Processing rule '${ruleId}' for event '${event.type}'...`);

        let evaluationContext = null;
        try {
            // Assemble the base context needed for condition evaluation AND action execution
            const actorId = event.payload?.actorId ?? event.payload?.entityId ?? null;
            const targetId = event.payload?.targetId ?? null;

            this.#logger.debug(`Assembling context for Rule '${ruleId}', Event '${event.type}'. ActorID=${actorId}, TargetID=${targetId}`);
            evaluationContext = createJsonLogicContext(
                event,
                actorId,
                targetId,
                this.#entityManager,
                this.#logger
            );
            // Crucially, the 'context' property within evaluationContext starts empty here
            // and will be populated by QUERY_COMPONENT operations during action execution.
            this.#logger.debug(`Context Assembled for Rule '${ruleId}'. Target in context:`, evaluationContext?.target ? {
                id: evaluationContext.target.id,
                hasComponents: !!evaluationContext.target.components
            } : 'null');

        } catch (contextError) {
            this.#logger.error(`Failed to assemble JsonLogicEvaluationContext for rule '${ruleId}' and event '${event.type}'. Cannot proceed.`, contextError);
            return; // Stop processing this rule
        }

        let ruleConditionResult = true; // Assume true if no condition
        if (rule.condition && typeof rule.condition === 'object' && Object.keys(rule.condition).length > 0) {
            this.#logger.debug(`Rule '${ruleId}' has a root condition. Evaluating...`);
            try {
                this.#logger.debug(`Evaluating Root Condition for Rule '${ruleId}'.`);
                ruleConditionResult = this.#jsonLogicEvaluationService.evaluate(rule.condition, evaluationContext);
                this.#logger.info(`Rule '${ruleId}' root condition evaluated. Result: ${ruleConditionResult}`); // Changed to info for visibility
            } catch (evalError) {
                this.#logger.error(`Error during root condition evaluation for rule '${ruleId}'. Assuming FALSE.`, evalError);
                ruleConditionResult = false;
            }
        } else {
            this.#logger.debug(`Rule '${ruleId}' has no root condition. Proceeding directly to actions.`);
        }

        if (ruleConditionResult) {
            this.#logger.debug(`Root condition for rule '${ruleId}' passed (or was absent). Executing actions.`);
            // Start execution of the main actions array
            // Pass the assembled context, which includes the empty 'context' object ready to be populated.
            this.#executeActions(rule.actions, evaluationContext, `Rule '${ruleId}'`);
        } else {
            this.#logger.debug(`Root condition for rule '${ruleId}' failed. Skipping actions.`);
        }
    }

    /**
     * Executes a sequence of Operation objects. Can be called recursively for IF branches.
     *
     * @param {Operation[]} actions - The array of Operation objects to execute.
     * @param {JsonLogicEvaluationContext} executionContext - The context for this execution sequence. This object is potentially mutated by operations like QUERY_COMPONENT.
     * @param {string} scopeDescription - A description for logging (e.g., "Rule 'X'", "IF THEN branch").
     * @private
     */
    #executeActions(actions, executionContext, scopeDescription) {
        if (!Array.isArray(actions) || actions.length === 0) {
            this.#logger.debug(`No actions to execute for scope: ${scopeDescription}.`);
            return;
        }

        this.#logger.info(`---> Entering action sequence for: ${scopeDescription}. ${actions.length} actions total.`);

        for (let i = 0; i < actions.length; i++) {
            const operation = actions[i];
            const operationIndex = i + 1; // 1-based index for logging
            const operationDesc = operation.comment ? `(Comment: ${operation.comment})` : '';
            this.#logger.debug(`---> [${scopeDescription} - Action ${operationIndex}/${actions.length}] Processing Operation: ${operation.type} ${operationDesc}`);

            try {
                // --- Task: Add logic to handle the case where operation.type is "IF". ---
                switch (operation.type) {
                    case 'IF':
                        this.#handleIfOperation(operation, executionContext, scopeDescription, operationIndex);
                        break;

                    case 'QUERY_COMPONENT':
                        // Placeholder for QUERY_COMPONENT logic (Ticket N+2)
                        // Would call a handler function, e.g., #handleQueryComponentOperation(operation, executionContext)
                        // This handler would use PayloadValueResolverService, call EntityManager,
                        // and crucially update executionContext.context[result_variable].
                        this.#logger.warn(`---> [${scopeDescription} - Action ${operationIndex}] Operation type ${operation.type} NOT YET IMPLEMENTED.`);
                        // --- Example of potential update ---
                        // const resultVar = operation.parameters?.result_variable;
                        // if (resultVar && executionContext.context) {
                        //    executionContext.context[resultVar] = { /* fetched data or null */ };
                        //    this.#logger.debug(`---> Stored query result in context.${resultVar}`);
                        // }
                        break;

                    case 'MODIFY_COMPONENT':
                        // Placeholder for MODIFY_COMPONENT logic (Ticket N+3)
                        // Would call a handler function, e.g., #handleModifyComponentOperation(operation, executionContext)
                        this.#logger.warn(`---> [${scopeDescription} - Action ${operationIndex}] Operation type ${operation.type} NOT YET IMPLEMENTED.`);
                        break;

                    case 'DISPATCH_EVENT':
                        // Placeholder for DISPATCH_EVENT logic (Ticket N+4)
                        // Would call a handler function, e.g., #handleDispatchEventOperation(operation, executionContext)
                        this.#logger.warn(`---> [${scopeDescription} - Action ${operationIndex}] Operation type ${operation.type} NOT YET IMPLEMENTED.`);
                        break;

                    case 'LOG':
                        // Placeholder for LOG logic (Ticket N+5)
                        // Would call a handler function, e.g., #handleLogOperation(operation, executionContext)
                        this.#logger.warn(`---> [${scopeDescription} - Action ${operationIndex}] Operation type ${operation.type} NOT YET IMPLEMENTED.`);
                        break;

                    default:
                        this.#logger.error(`---> [${scopeDescription} - Action ${operationIndex}] Encountered UNKNOWN Operation type: ${operation.type}. Skipping.`);
                        break;
                }

            } catch (error) {
                this.#logger.error(`---> [${scopeDescription} - Action ${operationIndex}] Critical error during execution of ${operation.type}. Halting this action sequence. Error:`, error);
                return; // Stop processing further actions in this sequence on error
            }
        }

        this.#logger.info(`<--- Finished action sequence for: ${scopeDescription}.`);
    }

    /**
     * Handles the execution logic for an IF operation.
     * @param {Operation} ifOperation - The IF operation object.
     * @param {JsonLogicEvaluationContext} executionContext - The current execution context.
     * @param {string} parentScopeDesc - Description of the parent scope for logging.
     * @param {number} operationIndex - Index of the IF operation in its sequence.
     * @private
     */
    #handleIfOperation(ifOperation, executionContext, parentScopeDesc, operationIndex) {
        const parentIfDesc = `${parentScopeDesc} - IF Action ${operationIndex}`;

        // --- Task: Extract parameters ---
        const params = ifOperation.parameters;
        if (!params || typeof params.condition !== 'object' || !Array.isArray(params.then_actions)) {
            this.#logger.error(`---> [${parentIfDesc}] Invalid IF operation structure: Missing or invalid 'condition' or 'then_actions'. Skipping IF block.`);
            return;
        }
        const condition = params.condition;
        const then_actions = params.then_actions;
        const else_actions = params.else_actions; // Optional

        // --- Task: Ensure the same JsonLogicEvaluationContext is available ---
        // 'executionContext' is passed directly, it contains event, actor, target, and the mutable context object.

        // --- Task: Call JsonLogicEvaluationService.evaluate ---
        let conditionResult = false;
        try {
            this.#logger.debug(`---> [${parentIfDesc}] Evaluating IF condition...`);
            // Log context before evaluation (optional, can be verbose)
            // console.dir(executionContext, { depth: 3 });
            conditionResult = this.#jsonLogicEvaluationService.evaluate(condition, executionContext);
            // --- Task: Ensure appropriate logging ---
            this.#logger.info(`---> [${parentIfDesc}] IF condition evaluation result: ${conditionResult}`);
        } catch (evalError) {
            this.#logger.error(`---> [${parentIfDesc}] Error evaluating IF condition. Assuming FALSE. Error:`, evalError);
            conditionResult = false; // Ensure false on error
        }

        // --- Task: Execute branches based on result ---
        if (conditionResult) {
            // --- Task: If true, recursively call for then_actions ---
            this.#logger.debug(`---> [${parentIfDesc}] Condition TRUE. Executing THEN branch.`);
            this.#executeActions(then_actions, executionContext, `${parentIfDesc} / THEN`);
        } else {
            // --- Task: If false and else_actions exists... ---
            if (else_actions && Array.isArray(else_actions) && else_actions.length > 0) {
                // --- Task: recursively call for else_actions ---
                this.#logger.debug(`---> [${parentIfDesc}] Condition FALSE. Executing ELSE branch.`);
                this.#executeActions(else_actions, executionContext, `${parentIfDesc} / ELSE`);
            } else {
                // --- Task: If false and no else_actions... ---
                this.#logger.debug(`---> [${parentIfDesc}] Condition FALSE and no ELSE branch present or actions empty. Continuing after IF block.`);
                // Simply proceed to the next operation after the IF block (handled by the loop in #executeActions)
            }
        }
        // --- Task: Execution correctly continues after the IF block ---
        // This is handled naturally by the loop in #executeActions which called this handler.
        // After this function returns, the loop will proceed to the next operation index.
    }

    // --- Placeholder Handler Functions for Other Operation Types ---
    // These would be implemented in subsequent tickets.

    // #handleQueryComponentOperation(operation, executionContext) { /* ... */ }
    // #handleModifyComponentOperation(operation, executionContext) { /* ... */ }
    // #handleDispatchEventOperation(operation, executionContext) { /* ... */ }
    // #handleLogOperation(operation, executionContext) { /* ... */ }

}

export default SystemLogicInterpreter;