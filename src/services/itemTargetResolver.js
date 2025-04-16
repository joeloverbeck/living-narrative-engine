// src/services/itemTargetResolver.js

// --- Imports ---
import {PositionComponent} from '../components/positionComponent.js';
import {ConnectionsComponent} from '../components/connectionsComponent.js';
import {TARGET_MESSAGES, getDisplayName} from '../utils/messages.js';

// --- JSDoc Type Imports / Definitions ---

// Assume these are defined in referenced files or should be defined centrally.
// Using JSDoc @typedef for clarity based on ticket requirements.
/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../components/connectionsComponent.js').Connection} Connection */ // Assuming Connection type exists in connectionsComponent or similar
/** @typedef {import('../../data/schemas/item.schema.json').definitions.UsableComponent} UsableComponentData */ // Assuming schema type definition
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationService} ConditionEvaluationService */
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationContext} ConditionEvaluationContext */
/** @typedef {import('../services/conditionEvaluationService.js').ConditionEvaluationOptions} ConditionEvaluationOptions */

/**
 * Represents an internal or UI message generated during action processing.
 * (Define locally if not imported from a shared location like actionTypes.js)
 * @typedef {object} ActionMessage
 * @property {string} text - The message content.
 * @property {'internal' | 'info' | 'warning' | 'error' | 'success' | 'debug' | 'ui' | 'prompt'} type - The message type.
 */

/**
 * The result structure returned by the resolveItemTarget method.
 * @typedef {object} ResolveItemTargetResult
 * @property {boolean} success - True if target resolution (and validation) succeeded or if no target was required.
 * @property {Entity | Connection | null} target - The validated target object (Entity or Connection instance), or null if no target was required or found/validated.
 * @property {'entity' | 'connection' | 'none'} targetType - The type of the resolved target.
 * @property {ActionMessage[]} messages - Array of internal/debugging messages generated during resolution.
 */


// ========================================================================
// == ItemTargetResolverService Class =====================================
// ========================================================================

/**
 * Service dedicated to resolving and validating targets specifically for item usage actions.
 */
export class ItemTargetResolverService {
    // Private instance members to hold dependencies
    #entityManager;
    #eventBus;
    #conditionEvaluationService;

    /**
     * Creates an instance of ItemTargetResolverService.
     * Dependencies are injected via the constructor.
     * @param {object} options - Container for required service dependencies.
     * @param {EntityManager} options.entityManager - The EntityManager instance for entity lookups.
     * @param {EventBus} options.eventBus - The EventBus instance for dispatching messages.
     * @param {ConditionEvaluationService} options.conditionEvaluationService - The service for evaluating target conditions.
     * @throws {Error} If any required dependency is missing.
     */
    constructor({entityManager, eventBus, conditionEvaluationService}) {
        if (!entityManager) {
            throw new Error('ItemTargetResolverService: EntityManager dependency is required.');
        }
        if (!eventBus) {
            throw new Error('ItemTargetResolverService: EventBus dependency is required.');
        }
        if (!conditionEvaluationService) {
            throw new Error('ItemTargetResolverService: ConditionEvaluationService dependency is required.');
        }

        this.#entityManager = entityManager;
        this.#eventBus = eventBus;
        this.#conditionEvaluationService = conditionEvaluationService;
    }

    /**
     * Resolves the target for an item usage action based on explicit IDs and validates it.
     * Prioritizes connection ID, falls back to entity ID if connection fails.
     * [Logic extracted and modified from TargetResolutionService.resolveItemTarget]
     * @param {object} params - The parameters for target resolution.
     * @param {Entity} params.userEntity - The entity using the item.
     * @param {UsableComponentData} params.usableComponentData - The item's Usable component data.
     * @param {string | null | undefined} params.explicitTargetEntityId - Optional entity ID provided by the event.
     * @param {string | null | undefined} params.explicitTargetConnectionEntityId - Optional connection *entity* ID provided by the event.
     * @param {string} params.itemName - The display name of the item being used (for messages).
     *
     * @returns {Promise<ResolveItemTargetResult>} - A promise resolving to the outcome of the target resolution.
     */
    async resolveItemTarget(
        {userEntity, usableComponentData, explicitTargetEntityId, explicitTargetConnectionEntityId, itemName}
    ) {
        /** @type {ActionMessage[]} */
        const messages = [];
        const log = (text, type = 'internal') => messages.push({text, type});

        log(`Starting resolveItemTarget for item: ${itemName}`);

        // --- 1. Check if Target is Required ---
        if (!usableComponentData.target_required) {
            log(`Target not required for ${itemName}.`);
            return {success: true, target: null, targetType: 'none', messages};
        }

        log(`Target required. Explicit Entity ID: ${explicitTargetEntityId}, Connection Entity ID: ${explicitTargetConnectionEntityId}`);

        // --- 2. Resolve Potential Target from Explicit IDs ---
        let potentialTarget = null;
        let targetType = 'none'; // 'entity', 'connection', or 'none'
        let validatedTargetEntityContext = null;
        let validatedTargetConnectionContext = null;
        let connectionAttemptFailed = false; // Flag to track if the connection path failed

        // --- 2a. PRIORITIZE Explicit Connection Entity Target ---
        if (explicitTargetConnectionEntityId) {
            log(`Attempting to resolve explicit connection target: ${explicitTargetConnectionEntityId}`);

            const connectionEntity = this.#entityManager.getEntityInstance(explicitTargetConnectionEntityId);

            if (!connectionEntity) {
                log(`Failed to fetch Connection Entity instance with ID: ${explicitTargetConnectionEntityId}`, 'warning');
                connectionAttemptFailed = true;
                // !! DO NOT RETURN: Allow fallback to entity ID if provided !!
            } else {
                log(`Successfully fetched Connection Entity: ${getDisplayName(connectionEntity)} (${connectionEntity.id})`);
                log("Starting validation: Is connection a valid exit from user's location?");

                // Perform connection validation sequence
                let connectionValidationPassed = true; // Assume pass until a check fails

                // 1. Get user's PositionComponent and locationId
                const userPosComp = userEntity.getComponent(PositionComponent);
                if (!userPosComp) {
                    log("CONN-5.2.4 Failure: User missing PositionComponent.", 'warning');
                    connectionValidationPassed = false;
                }

                const userLocationId = userPosComp?.locationId; // Safely access locationId
                if (connectionValidationPassed && !userLocationId) {
                    log("CONN-5.2.4 Failure: User PositionComponent missing locationId.", 'warning');
                    connectionValidationPassed = false;
                }

                // 2. Fetch user's location entity
                let userLocation = null;
                if (connectionValidationPassed) {
                    log(`User location ID: ${userLocationId}`);
                    userLocation = this.#entityManager.getEntityInstance(userLocationId);
                    if (!userLocation) {
                        log(`CONN-5.2.4 Failure: Could not fetch user location entity: ${userLocationId}`, 'warning');
                        connectionValidationPassed = false;
                    } else {
                        log(`Workspaceed user location entity: ${getDisplayName(userLocation)} (${userLocation.id})`);
                    }
                }

                // 3. Get ConnectionsComponent from userLocation
                let connectionsComp = null;
                if (connectionValidationPassed) {
                    connectionsComp = userLocation.getComponent(ConnectionsComponent);
                    if (!connectionsComp) {
                        log(`CONN-5.2.4 Failure: User location ${userLocation.id} missing ConnectionsComponent.`, 'warning');
                        connectionValidationPassed = false;
                    } else {
                        log("Fetched ConnectionsComponent from user location.");
                    }
                }

                // 4. Check if the target connection is listed as an exit
                let matchingExit = null;
                if (connectionValidationPassed) {
                    const currentExits = connectionsComp.getAllConnections();
                    log("Checking fetched connection against current location's exits.");
                    matchingExit = currentExits.find(exit => exit.connectionEntityId === connectionEntity.id);
                    if (!matchingExit) {
                        log(`CONN-5.2.4 Failure: Connection Entity ${connectionEntity.id} is NOT a valid exit from ${userLocation.id}.`, 'warning');
                        connectionValidationPassed = false;
                    }
                }

                // --- Final Connection Result ---
                if (connectionValidationPassed) {
                    log(`Validation successful. Connection ${connectionEntity.id} is a valid exit.`);
                    // Mark the connection entity as the potential target
                    potentialTarget = connectionEntity;
                    targetType = 'connection';
                    // Store the validated context information for condition evaluation
                    validatedTargetConnectionContext = {
                        connectionEntity: connectionEntity,
                        direction: matchingExit?.direction // Store direction
                    };
                    log(`Potential target confirmed as CONNECTION ${getDisplayName(potentialTarget)} (${potentialTarget.id}). Proceeding to condition checks (if any).`);
                } else {
                    // Validation failed at some step
                    log(`Connection validation failed for ${connectionEntity.id}.`, 'warning');
                    connectionAttemptFailed = true; // Mark connection path as failed overall
                    // !! DO NOT RETURN: Allow fallback to entity ID !!
                }
            }
        } // --- End of explicit connection entity ID block ---

        // --- 2b. Attempt Explicit Entity Target ONLY IF No Valid Connection Target was Found/Specified/Validated ---
        // This block will now run if:
        // - No connection ID was provided initially OR
        // - A connection ID was provided, but fetching or validation failed (connectionAttemptFailed is true)
        if (!potentialTarget && explicitTargetEntityId) {
            log(`Attempting to resolve explicit entity target (fallback or primary): ${explicitTargetEntityId}`);

            potentialTarget = this.#entityManager.getEntityInstance(explicitTargetEntityId);

            if (potentialTarget) {
                targetType = 'entity';
                validatedTargetEntityContext = potentialTarget; // Store for condition context
                log(`Found potential explicit target: ENTITY ${getDisplayName(potentialTarget)} (${potentialTarget.id})`);
                // If we got here via fallback, the overall attempt might now succeed, so clear the connection failure flag
                connectionAttemptFailed = false;
            } else {
                log(`Explicit entity target ID ${explicitTargetEntityId} not found.`, 'warning');
                // If connection attempt ALSO failed or wasn't made, this is a final failure.
                // The message dispatch below will handle this.
            }
        }

        // --- 3. Handle Target Required But Not Found/Specified/Validated ---
        if (!potentialTarget) {
            // This means:
            // - Target required, but no IDs provided OR
            // - Connection ID provided, failed fetch/validation, AND no valid entity ID fallback provided/found OR
            // - Entity ID provided (primary), failed fetch.
            log(`Target required, but no valid target resolved after checking connection (if any) and entity (if any).`, 'error');

            let failureMsg = '';
            // Determine the most appropriate failure message based on what was attempted
            if (explicitTargetConnectionEntityId && connectionAttemptFailed) {
                // If connection was the priority and it failed (fetch or validation)
                failureMsg = TARGET_MESSAGES.USE_INVALID_TARGET_CONNECTION(explicitTargetConnectionEntityId);
            } else if (explicitTargetEntityId) {
                // If entity was the target (either primary or fallback) and it wasn't found
                failureMsg = TARGET_MESSAGES.USE_INVALID_TARGET_ENTITY(explicitTargetEntityId);
            } else {
                // If target was required but neither ID was provided
                failureMsg = usableComponentData.failure_message_target_required || TARGET_MESSAGES.USE_REQUIRES_TARGET(itemName);
            }

            // Dispatch the determined failure message
            this.#eventBus.dispatch('ui:message_display', {text: failureMsg, type: 'warning'});
            return {success: false, target: null, targetType: 'none', messages};
        }

        // --- 4. Validate the Found Potential Target Against Conditions ---
        // If we reach here, potentialTarget is either a valid Connection entity or a valid Entity instance.
        const targetName = getDisplayName(potentialTarget);
        log(`Validating potential target ('${targetName}') against target_conditions.`);

        if (usableComponentData.target_conditions && usableComponentData.target_conditions.length > 0) {
            // Construct the context object conditionally based on targetType.
            /** @type {ConditionEvaluationContext} */
            let targetCheckContext;

            if (targetType === 'connection') {
                // validatedTargetConnectionContext should have been set during successful connection validation
                targetCheckContext = {
                    userEntity: userEntity,
                    targetConnectionContext: validatedTargetConnectionContext, // Use the validated context object { connectionEntity, direction }
                    targetEntityContext: null // Explicitly null
                };
                log(`CONN-5.3.1: Condition context prepared for CONNECTION target.`);
            } else if (targetType === 'entity') {
                // validatedTargetEntityContext should have been set during successful entity resolution
                targetCheckContext = {
                    userEntity: userEntity,
                    targetEntityContext: validatedTargetEntityContext, // Use the validated entity instance
                    targetConnectionContext: null // Explicitly null
                };
                log(`CONN-5.3.1: Condition context prepared for ENTITY target.`);
            } else {
                // Defensive coding: Should not happen if logic above is correct.
                log(`ERROR: Cannot determine condition context structure for unknown targetType '${targetType}'. Proceeding with potentially incorrect context.`, 'error');
                // Fallback context structure (less ideal)
                targetCheckContext = {
                    userEntity: userEntity,
                    targetEntityContext: (targetType === 'entity' ? potentialTarget : null),
                    targetConnectionContext: (targetType === 'connection' ? validatedTargetConnectionContext : null)
                };
            }

            // Setup evaluation options
            /** @type {ConditionEvaluationOptions} */
            const targetOptions = {
                itemName: itemName,
                checkType: 'Target',
                fallbackMessages: {
                    target: usableComponentData.failure_message_invalid_target || TARGET_MESSAGES.USE_INVALID_TARGET(itemName),
                    default: TARGET_MESSAGES.USE_INVALID_TARGET(itemName)
                }
            };

            // The subject of the condition check is the actual target (Entity or Connection Entity instance)
            const conditionSubject = potentialTarget;
            log(`CONN-5.3.1: Condition subject is set to potentialTarget (ID: ${potentialTarget?.id}, Type: ${targetType}).`);

            // Call evaluateConditions using the injected dependency
            const targetCheckResult = await this.#conditionEvaluationService.evaluateConditions(
                conditionSubject,
                targetCheckContext, // Use the conditionally constructed context object
                usableComponentData.target_conditions,
                targetOptions
            );

            messages.push(...targetCheckResult.messages);

            // Handle condition evaluation failure
            if (!targetCheckResult.success) {
                log(`Target conditions failed for target '${targetName}'.`, 'warning');
                // Prioritize the message from the evaluation result.
                const failureMessageToDispatch = targetCheckResult.failureMessage ||
                    usableComponentData.failure_message_invalid_target ||
                    TARGET_MESSAGES.USE_INVALID_TARGET(itemName);

                // Dispatch message using the injected dependency
                this.#eventBus.dispatch('ui:message_display', {text: failureMessageToDispatch, type: 'warning'});
                log(`CONN-5.3.1: Dispatched failure message: "${failureMessageToDispatch}"`);

                return {success: false, target: null, targetType: 'none', messages};
            } else {
                log(`Target '${targetName}' passed validation conditions.`);
            }
        } else {
            log(`No target_conditions defined for ${itemName}. Target considered valid.`);
        }

        // --- 5. Target Found and Validated (including conditions) ---
        log(`Target resolution successful. Validated Target: ${targetType} '${targetName}'.`);
        // Return the validated potential target (which could be an Entity or a Connection entity)
        return {success: true, target: potentialTarget, targetType: targetType, messages};
    } // End resolveItemTarget

} // End ItemTargetResolverService Class