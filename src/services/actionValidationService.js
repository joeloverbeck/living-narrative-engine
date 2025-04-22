// src/services/actionValidationService.js

// --- Type Imports ---
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../types/actionDefinition.js').ActionDefinition} ActionDefinition */
/** @typedef {import('../types/actionDefinition.js').ConditionObject} ConditionObject */
/** @typedef {import('../types/common.js').NamespacedId} NamespacedId */
/** @typedef {import('../core/interfaces/coreServices.js').ILogger} ILogger */
/** @typedef {import('../logic/defs.js').JsonLogicEvaluationContext} JsonLogicEvaluationContext */
/** @typedef {import('../logic/defs.js').JsonLogicEntityContext} JsonLogicEntityContext */
/** @typedef {import('../logic/jsonLogicEvaluationService.js').default} JsonLogicEvaluationService */
// --- ADDED JSDoc Type Import (No change from previous step, but confirms presence) ---
/** @typedef {import('../validation/componentRequirementChecker.js').ComponentRequirementChecker} ComponentRequirementChecker */

// --- Model Imports ---
import { ActionTargetContext } from '../models/ActionTargetContext.js';

// --- Helper Imports ---
import { createComponentAccessor } from '../logic/contextAssembler.js';
// --- ADDED Import (No change from previous step, but confirms presence) ---
import { ComponentRequirementChecker } from '../validation/componentRequirementChecker.js'; // Adjust path if needed

/**
 * Service responsible for validating if a specific action is currently valid
 * for a given actor and target context, based on the game state and action definitions.
 * It checks component requirements (using ComponentRequirementChecker), domain compatibility,
 * and prerequisites (using JSON Logic).
 */
export class ActionValidationService {
    /** @private @type {EntityManager} */
    #entityManager;
    /** @private @type {GameDataRepository} */
    #gameDataRepository;
    /** @private @type {ILogger} */
    #logger;
    /** @private @type {JsonLogicEvaluationService} */
    #jsonLogicEvaluationService;
    // --- ADDED Private Field (No change from previous step, but confirms presence) ---
    /** @private @type {ComponentRequirementChecker} */
    #componentRequirementChecker;

    /**
     * Creates an instance of ActionValidationService.
     * @param {object} dependencies - The required dependencies.
     * @param {EntityManager} dependencies.entityManager - Service to access entity instances and component data.
     * @param {GameDataRepository} dependencies.gameDataRepository - Service to access game data definitions (like actions).
     * @param {ILogger} dependencies.logger - Logger service instance.
     * @param {JsonLogicEvaluationService} dependencies.jsonLogicEvaluationService - Service to evaluate JSON Logic rules.
     * @param {ComponentRequirementChecker} dependencies.componentRequirementChecker - Service to check entity component requirements. // <-- Confirmed JSDoc update
     * @throws {Error} If any required dependency is missing or invalid.
     */
    constructor({entityManager, gameDataRepository, logger, jsonLogicEvaluationService, componentRequirementChecker}) { // <-- Confirmed param addition
        if (!entityManager || typeof entityManager.getEntityInstance !== 'function') {
            throw new Error("ActionValidationService requires a valid EntityManager instance.");
        }
        if (!gameDataRepository || typeof gameDataRepository.getAction !== 'function') {
            throw new Error("ActionValidationService requires a valid GameDataRepository instance.");
        }
        if (!logger || typeof logger.debug !== 'function' || typeof logger.error !== 'function') {
            throw new Error("ActionValidationService requires a valid ILogger instance.");
        }
        if (!jsonLogicEvaluationService || typeof jsonLogicEvaluationService.evaluate !== 'function') {
            throw new Error("ActionValidationService requires a valid JsonLogicEvaluationService instance.");
        }
        // --- ADDED Null/Type Check for new dependency (No change from previous step, but confirms presence) ---
        if (!componentRequirementChecker || typeof componentRequirementChecker.check !== 'function') {
            throw new Error("ActionValidationService requires a valid ComponentRequirementChecker instance.");
        }

        this.#entityManager = entityManager;
        this.#gameDataRepository = gameDataRepository;
        this.#logger = logger;
        this.#jsonLogicEvaluationService = jsonLogicEvaluationService;
        // --- Assign injected dependency (No change from previous step, but confirms presence) ---
        this.#componentRequirementChecker = componentRequirementChecker;
        this.#logger.info("ActionValidationService initialized.");
    }

    /**
     * Checks if a given action is valid for the specified actor and target context
     * based on the current game state and the action's definition.
     * Performs checks in order: Actor components, Domain/Context compatibility,
     * Target entity resolution & components (if applicable), Prerequisites (using JSON Logic).
     *
     * @param {ActionDefinition} actionDefinition - The definition object of the action to validate. Must be valid.
     * @param {Entity} actorEntity - The entity instance performing the action. Must be valid.
     * @param {ActionTargetContext} targetContext - The context object describing the action's target. Must be valid.
     * @returns {boolean} True if the action is deemed valid according to all checks, false otherwise.
     * @throws {Error} If critical input parameters (actionDefinition, actorEntity, targetContext) are missing or structurally invalid.
     */
    isValid(actionDefinition, actorEntity, targetContext) {
        // --- Critical Input Validation ---
        if (!actionDefinition || typeof actionDefinition.id !== 'string' || !actionDefinition.id.trim()) {
            const errorMsg = "ActionValidationService.isValid: Missing or invalid actionDefinition (must have non-empty string 'id').";
            this.#logger.error(errorMsg, {actionDefinition});
            throw new Error(errorMsg);
        }
        if (!actorEntity || typeof actorEntity.id !== 'string' || !actorEntity.id.trim() || typeof actorEntity.hasComponent !== 'function') {
            const errorMsg = `ActionValidationService.isValid: Missing or invalid actorEntity object for action '${actionDefinition.id}'.`;
            this.#logger.error(errorMsg, {actorEntity});
            throw new Error(errorMsg);
        }
        if (!targetContext || typeof targetContext.type !== 'string' || !(targetContext instanceof ActionTargetContext)) {
            const errorMsg = `ActionValidationService.isValid: Missing or invalid targetContext object for action '${actionDefinition.id}' actor '${actorEntity.id}'. Expected instance of ActionTargetContext.`;
            this.#logger.error(errorMsg, {targetContext});
            throw new Error(errorMsg);
        }
        // --- End Input Validation ---

        const actionId = actionDefinition.id;
        const actorId = actorEntity.id;
        // Use a slightly more specific context description for the checker calls
        const actorContextDesc = `action '${actionId}' actor requirements`;
        const targetContextDesc = `action '${actionId}' target requirements`;
        let targetEntity = null;

        this.#logger.debug(`Validating action '${actionId}' for actor ${actorId} with target context: type='${targetContext.type}', entityId='${targetContext.entityId ?? 'N/A'}', direction='${targetContext.direction ?? 'N/A'}'`);

        try {
            // --- STEP 1: Actor Component Requirement Checks ---
            // --- UPDATED: Use injected checker ---
            if (!this.#componentRequirementChecker.check(
                actorEntity,
                actionDefinition.actor_required_components,
                actionDefinition.actor_forbidden_components,
                'actor',            // entityRole
                actorContextDesc    // contextDescription
            )) {
                // Failure reason logged within the checker's check method
                // Log adjusted to reflect failure is logged internally by the checker
                // this.#logger.debug(`Action Validation Failed (Step 1): Actor ${actorId} failed component checks for ${actorContextDesc}.`);
                return false; // Actor doesn't meet requirements
            }
            this.#logger.debug(` -> Step 1 PASSED: Actor ${actorId} meets component requirements for ${actionId}.`);


            // --- STEP 2: Target Domain / Context Type Compatibility Checks ---
            const expectedDomain = actionDefinition.target_domain || 'none';
            const contextType = targetContext.type;

            // (This section remains unchanged)
            if (contextType !== 'none') {
                const entityDomains = ['self', 'inventory', 'equipment', 'environment', 'location', 'location_items', 'location_non_items', 'nearby', 'nearby_including_blockers'];
                const directionDomains = ['direction'];
                const noTargetDomains = ['none'];

                if (noTargetDomains.includes(expectedDomain) ) {
                    this.#logger.debug(`Validation failed (Step 2): Action '${actionId}' (domain '${expectedDomain}') is incompatible with provided context type '${contextType}'.`);
                    return false;
                }
                if (directionDomains.includes(expectedDomain) && contextType !== 'direction' ) {
                    this.#logger.debug(`Validation failed (Step 2): Action '${actionId}' (domain '${expectedDomain}') requires 'direction' context, but got '${contextType}'.`);
                    return false;
                }
                if (entityDomains.includes(expectedDomain) && contextType !== 'entity' ) {
                    this.#logger.debug(`Validation failed (Step 2): Action '${actionId}' (domain '${expectedDomain}') requires 'entity' context, but got '${contextType}'.`);
                    return false;
                }
                if (expectedDomain === 'self' && contextType === 'entity' && targetContext.entityId !== actorId) {
                    this.#logger.debug(`Validation failed (Step 2): Action '${actionId}' (domain 'self') requires target to be actor ${actorId}, but context targets entity ${targetContext.entityId}.`);
                    return false;
                }
            }
            this.#logger.debug(` -> Step 2 PASSED: Domain ('${expectedDomain}') and Context Type ('${contextType}') are compatible for ${actionId}.`);


            // --- STEP 3: Target Entity Resolution and Component Checks (Conditional) ---
            if (contextType === 'entity') {
                const targetEntityId = targetContext.entityId;
                if (!targetEntityId) {
                    this.#logger.error(`Action Validation Internal Error (Step 3): Context type is 'entity' but entityId is missing for action '${actionId}'. Should have been caught by ActionTargetContext constructor.`);
                    return false;
                }
                targetEntity = this.#entityManager.getEntityInstance(targetEntityId);
                if (!targetEntity) {
                    this.#logger.debug(`Action Validation Failed (Step 3a): Target entity ID '${targetEntityId}' (specified in context for action '${actionId}') was not found or is not currently active.`);
                    return false;
                }
                this.#logger.debug(` -> Step 3a PASSED: Resolved target entity ${targetEntityId} for ${actionId}.`);

                // --- UPDATED: Use injected checker ---
                // Corresponds to Step 3b in the ticket
                if (!this.#componentRequirementChecker.check(
                    targetEntity,
                    actionDefinition.target_required_components,
                    actionDefinition.target_forbidden_components,
                    'target',           // entityRole
                    targetContextDesc   // contextDescription
                )) {
                    // Failure reason logged within the checker's check method
                    // Log adjusted to reflect failure is logged internally by the checker
                    // this.#logger.debug(`Action Validation Failed (Step 3b): Target ${targetEntityId} failed component checks for ${targetContextDesc}.`);
                    return false; // Target doesn't meet requirements
                }
                this.#logger.debug(` -> Step 3b PASSED: Target ${targetEntityId} meets component requirements for ${actionId}.`);
            } else {
                this.#logger.debug(` -> Step 3 SKIPPED: No target entity resolution/component checks needed for context type '${contextType}' in action '${actionId}'.`);
            }


            // =========================================================================
            // --- START: Assemble JsonLogicEvaluationContext ---
            /** @type {JsonLogicEvaluationContext} */
            const evaluationContext = { actor: null, target: null, event: {}, context: {}, globals: {}, entities: {} };
            if (actorEntity && actorEntity.id) {
                evaluationContext.actor = { id: actorEntity.id, components: createComponentAccessor(actorEntity.id, this.#entityManager, this.#logger) };
                this.#logger.debug(`Assembled actor context for JsonLogic evaluation. Actor ID: ${evaluationContext.actor.id}`);
            } else {
                this.#logger.warn(`Actor entity [${actorEntity?.id ?? 'ID missing or entity null'}] is unexpectedly invalid during JsonLogic context assembly for action '${actionId}'. Actor context will be null.`);
            }
            if (targetEntity && targetEntity.id) {
                evaluationContext.target = { id: targetEntity.id, components: createComponentAccessor(targetEntity.id, this.#entityManager, this.#logger) };
                this.#logger.debug(`Assembled target context for JsonLogic evaluation. Target ID: ${evaluationContext.target.id}`);
            } else {
                this.#logger.debug(`No valid targetEntity found or resolved for action '${actionId}', target context remains null.`);
            }
            evaluationContext.event = { type: 'ACTION_VALIDATION', payload: { actionId: actionDefinition.id } };
            this.#logger.debug(`JsonLogicEvaluationContext fully assembled. Keys: ${Object.keys(evaluationContext).join(', ')}`);
            // =========================================================================
            // --- END: Assemble JsonLogicEvaluationContext ---
            // =========================================================================


            // --- STEP 4: Prerequisite Checks ---
            const prerequisites = actionDefinition.prerequisites || [];
            if (prerequisites.length > 0) {
                this.#logger.debug(` -> Step 4: Checking ${prerequisites.length} prerequisite(s) for ${actionId}...`);
                for (const prerequisite of prerequisites) {
                    const rule = prerequisite.logic;
                    if (!rule) {
                        this.#logger.warn(`Action Validation: Skipping prerequisite in action '${actionId}' due to missing 'logic' property. Considering this a failure.`, { prerequisite });
                        return false;
                    }
                    this.#logger.debug(` -> Evaluating prerequisite rule: Type='${prerequisite.condition_type || 'N/A'}', Negate=${prerequisite.negate || false} for action '${actionId}'...`);
                    const prerequisitePassed = this.#jsonLogicEvaluationService.evaluate(rule, evaluationContext);
                    this.#logger.debug(`    Rule evaluation result: ${prerequisitePassed}`);
                    if (!prerequisitePassed) {
                        const failureMsg = prerequisite.failure_message || `Prerequisite type '${prerequisite.condition_type || 'N/A'}' not met.`;
                        this.#logger.debug(`Action Validation Failed (Step 4): Prerequisite check FAILED for action '${actionId}'. Reason: ${failureMsg}`);
                        return false;
                    }
                }
                this.#logger.debug(` -> Step 4 PASSED: All ${prerequisites.length} prerequisite(s) met for ${actionId}.`);
            } else {
                this.#logger.debug(` -> Step 4 PASSED: No prerequisites defined for ${actionId}.`);
            }
            // --- End Prerequisite Checks ---


            // --- STEP 5: Placeholder for Additional Domain-Specific Validation ---
            this.#logger.debug(` -> Step 5 PASSED: Placeholder for additional domain-specific checks for ${actionId}.`);


            // If execution reaches this point, all checks have passed.
            this.#logger.debug(`Validation FINAL RESULT: PASSED for action '${actionId}' (actor ${actorId}, contextType '${targetContext.type}', targetId/Dir '${targetContext.entityId ?? targetContext.direction ?? 'N/A'}').`);
            return true; // Action is valid

        } catch (error) {
            // Catch unexpected errors during the validation process
            this.#logger.error(`Unexpected error during action validation process for action '${actionId}' (actor '${actorId}'):`, error);
            return false; // Treat any unexpected error as a validation failure
        }
    }

}