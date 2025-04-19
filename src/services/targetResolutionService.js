// src/services/targetResolutionService.js

'use strict';

// --- Necessary Imports for Type Hinting ---

// JSDoc typedef based on the provided action-definition.schema.json
/**
 * Defines the structure for an Action Definition.
 * @typedef {object} ActionDefinition
 * @property {string} id - Unique, namespaced ID (e.g., 'core:action_eat').
 * @property {string} [name] - Human-readable name (e.g., 'Eat').
 * @property {'none' | 'self' | 'inventory' | 'equipment' | 'environment' | 'direction'} target_domain - Where to look for targets.
 * @property {string[]} [actor_required_components=[]] - Components the actor must have.
 * @property {string[]} [actor_forbidden_components=[]] - Components the actor must NOT have.
 * @property {string[]} [target_required_components=[]] - Components the target must have.
 * @property {string[]} [target_forbidden_components=[]] - Components the target must NOT have.
 * @property {object[]} [prerequisites=[]] - Additional conditions to check. Referencing #/definitions/ConditionObject from schema.
 * @property {string} template - Text template for command output (e.g., 'eat {target}').
 * @property {object} [dispatch_event] - Optional event to dispatch on success.
 * @property {string} [dispatch_event.eventName] - Namespaced event ID.
 * @property {object<string, string>} [dispatch_event.payload] - Event payload mapping.
 * @property {any} [additionalProperties] - Allows for extensions.
 */

// JSDoc typedef referencing the definition in actionTypes.js
/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */

// Actual import for Entity type
/** @typedef {import('../entities/entity.js').default} Entity */

// --- Core Dependencies ---
import {getEntityIdsForScopes} from './entityScopeService.js';
import {findTarget} from '../utils/targetFinder.js';
import {TARGET_MESSAGES, getDisplayName} from '../utils/messages.js'; // Assuming getDisplayName is here too
import {EVENT_DISPLAY_MESSAGE} from "../types/eventTypes.js"; // Assuming path
import {resolveTargetConnection} from './connectionResolver.js';
import {PassageDetailsComponent} from '../components/passageDetailsComponent.js';


// --- Enum Definition ---

/**
 * Enum defining the possible outcomes of the target resolution process.
 * @enum {string}
 * @readonly
 */
export const ResolutionStatus = Object.freeze({
    /** Indicates exactly one valid target was found. */
    FOUND_UNIQUE: 'FOUND_UNIQUE',
    /** Indicates no potential targets matching the criteria were found. */
    NOT_FOUND: 'NOT_FOUND',
    /** Indicates multiple potential targets were found, making the request ambiguous. */
    AMBIGUOUS: 'AMBIGUOUS',
    /** Indicates potential targets were found initially, but filtering removed all candidates. */
    FILTER_EMPTY: 'FILTER_EMPTY',
    /** Indicates the input parameters (actionDefinition, context) were invalid or insufficient for resolution. */
    INVALID_INPUT: 'INVALID_INPUT',
    /** Indicates an unexpected error occurred during the resolution process. */
    ERROR: 'ERROR'
});


// --- Result Type Definition ---

/**
 * Defines the structure of the result returned by the target resolution service.
 * Contains the outcome status and details about the resolved target(s) or failures.
 *
 * @typedef {object} TargetResolutionResult
 * @property {ResolutionStatus} status - The overall outcome of the resolution attempt.
 * @property {('entity'|'direction'|'self'|'none'|null)} targetType - The type of target resolved (e.g., 'entity', 'direction'). Null if resolution failed or no target needed.
 * @property {(string|null)} targetId - The unique ID of the resolved target (e.g., entity ID 'item_key_01', direction 'north'). Null if resolution failed or no specific ID applicable.
 * @property {(Entity|null)} targetEntity - The actual Entity object instance, if the resolved target is an entity. Null otherwise.
 * @property {(Entity|null)} targetConnectionEntity - For 'direction' domain, this holds the resolved ConnectionEntity. Null otherwise.
 * @property {string[]} candidateIds - An array of potential target IDs considered, especially relevant for AMBIGUOUS or FILTER_EMPTY statuses. Empty if not applicable.
 * @property {(object|null)} details - An optional object containing additional context-specific information about the resolution (e.g., specific filter failures, ambiguity reasons, targetLocationId, blockerEntityId for directions).
 * @property {(string|null)} error - An error message if the status is ERROR or sometimes INVALID_INPUT, detailing the failure reason. Null otherwise.
 */


// --- Helper Function for Message Keys ---

/**
 * Gets the appropriate TARGET_MESSAGES key suffix based on the domain.
 * @param {string} domain - The target domain (e.g., 'inventory', 'environment').
 * @returns {string} The uppercase suffix (e.g., 'INVENTORY') or 'GENERIC'.
 * @private
 */
function _getMessageKeySuffix(domain) {
    switch (domain) {
        case 'inventory':
            return 'INVENTORY';
        case 'equipment':
            return 'EQUIPMENT';
        case 'environment':
            return 'ENVIRONMENT';
        case 'location_items':
            return 'LOCATION_ITEMS'; // Example for potential future domains
        case 'nearby_including_blockers':
            return 'NEARBY_INCLUDING_BLOCKERS'; // Example
        default:
            return 'GENERIC'; // Fallback for unknown or less specific domains
    }
}


// --- Service Class/Module Definition ---

/**
 * Service responsible for resolving the specific target(s) of an action
 * based the action definition and the current game context.
 */
class TargetResolutionService {

    /**
     * Creates an instance of TargetResolutionService.
     */
    constructor() {
        console.log("TargetResolutionService initialized.");
        // Dependencies like EntityManager, GameDataRepository, etc., are expected
        // to be available within the 'context' object passed to methods.
        // Injecting connectionResolver is no longer needed as it's directly imported.
    }

    /**
     * Core function to resolve the target for a given action definition and context.
     * Handles entity-based target domains: 'self', 'inventory', 'equipment', 'environment', etc.
     * Handles 'direction' domain using connectionResolver.
     * *** NEW: Handles 'none' domain. ***
     *
     * @param {ActionDefinition} actionDefinition - The definition of the action being attempted.
     * @param {ActionContext} context - The current game context (player, location, managers, etc.). Requires currentLocation if target_domain is 'direction'.
     * @returns {Promise<TargetResolutionResult>} A promise that resolves with the TargetResolutionResult object.
     * @async
     */
    async resolveActionTarget(actionDefinition, context) {
        // --- Basic Input Validation ---
        if (!actionDefinition || !context || !context.playerEntity || !context.entityManager || !context.eventBus || !context.parsedCommand) {
            console.error("TargetResolutionService.resolveActionTarget: Invalid actionDefinition or context provided.", {
                actionDefinition,
                context
            });
            return {
                status: ResolutionStatus.INVALID_INPUT,
                targetType: null,
                targetId: null,
                targetEntity: null,
                targetConnectionEntity: null,
                candidateIds: [],
                details: null,
                error: "Invalid action definition or context."
            };
        }
        // *** Direction domain also requires currentLocation ***
        if (actionDefinition.target_domain === 'direction' && !context.currentLocation) {
            console.error("TargetResolutionService.resolveActionTarget: Invalid context for 'direction' domain - currentLocation is missing.");
            return {
                status: ResolutionStatus.INVALID_INPUT,
                targetType: null,
                targetId: null,
                targetEntity: null,
                targetConnectionEntity: null,
                candidateIds: [],
                details: null,
                error: "Context missing currentLocation for direction resolution."
            };
        }

        const {target_domain, target_required_components = [], target_forbidden_components = []} = actionDefinition;
        const {playerEntity, entityManager, eventBus, parsedCommand, currentLocation} = context; // Destructure currentLocation

        // --- [START SUB-TICKET 1.3.4 IMPLEMENTATION] ---
        // --- Handle 'none' Domain ---
        // Check if the target domain is 'none'. If so, return immediately as no target
        // resolution is needed. This signifies the action doesn't operate on a specific
        // target within the game world (e.g., 'look', 'inventory').
        if (target_domain === 'none') {
            // Return a result indicating success ('FOUND_UNIQUE' because the concept of
            // "no target" is uniquely resolved) with type 'none' and all target-specific
            // fields set to null, as per the ticket requirements. No user-facing message
            // is dispatched by the resolution service itself for this domain.
            return {
                status: ResolutionStatus.FOUND_UNIQUE,
                targetType: 'none',
                targetId: null,
                targetEntity: null,
                targetConnectionEntity: null,
                candidateIds: [],
                details: null,
                error: null
            };
        }
        // --- [END SUB-TICKET 1.3.4 IMPLEMENTATION] ---


        // --- Handle 'self' Domain ---
        if (target_domain === 'self') {
            return {
                status: ResolutionStatus.FOUND_UNIQUE,
                targetType: 'self',
                targetId: playerEntity.id,
                targetEntity: playerEntity,
                targetConnectionEntity: null,
                candidateIds: [],
                details: null,
                error: null
            };
        }

        // --- Handle 'direction' Domain (Sub-Ticket 1.3.3 Implementation) ---
        if (target_domain === 'direction') {
            try {
                // 1. Get Target Name (Direction)
                const targetName = parsedCommand.directObjectPhrase;
                if (!targetName || targetName.trim() === '') {
                    console.warn(`TargetResolutionService: Missing or empty direction name (directObjectPhrase) for action '${actionDefinition.id}'.`);
                    // Dispatch a generic "which way?" message? Maybe later. For now, INVALID_INPUT.
                    return {
                        status: ResolutionStatus.INVALID_INPUT,
                        targetType: null,
                        targetId: null,
                        targetEntity: null,
                        targetConnectionEntity: null,
                        candidateIds: [],
                        details: {message: "Direction name missing from command."},
                        error: "Missing direction name."
                    };
                }
                const trimmedTargetName = targetName.trim();

                // 2. Resolve Connection
                // connectionResolver.resolveTargetConnection handles finding the ConnectionEntity
                // and dispatches its own NOT_FOUND / AMBIGUOUS messages via the eventBus within the context.
                const resolvedConnectionEntity = resolveTargetConnection(context, trimmedTargetName, actionDefinition.name || actionDefinition.id);

                // 3. Handle Resolution Result
                if (resolvedConnectionEntity === null) {
                    // Not Found or Ambiguous - message already dispatched by resolver.
                    // We need to determine if it was NOT_FOUND or AMBIGUOUS.
                    // Since resolveTargetConnection doesn't return status, we might need
                    // to infer or slightly modify the resolver if we need precise status here.
                    // For now, let's *assume* null means NOT_FOUND unless we enhance the resolver.
                    // TODO: Potentially enhance resolveTargetConnection to return status or use a dedicated function.
                    // Let's return NOT_FOUND for now, as AMBIGUOUS would have prompted the user.
                    return {
                        status: ResolutionStatus.NOT_FOUND, // Or AMBIGUOUS if we could determine that
                        targetType: null,
                        targetId: null,
                        targetEntity: null,
                        targetConnectionEntity: null,
                        candidateIds: [], // TODO: Can we get candidate IDs from resolver? Maybe not easily.
                        details: {searchedDirection: trimmedTargetName},
                        error: null
                    };
                } else {
                    // Unique Connection Found
                    // 4. Retrieve PassageDetailsComponent
                    const passageDetails = resolvedConnectionEntity.getComponent(PassageDetailsComponent);
                    if (!passageDetails) {
                        console.error(`TargetResolutionService: Resolved ConnectionEntity '${resolvedConnectionEntity.id}' for action '${actionDefinition.id}' is missing PassageDetailsComponent.`);
                        return {
                            status: ResolutionStatus.ERROR, // Or INVALID_INPUT/NOT_FOUND? ERROR seems appropriate for missing component on resolved entity.
                            targetType: null,
                            targetId: null,
                            targetEntity: null,
                            targetConnectionEntity: null,
                            candidateIds: [],
                            details: {
                                missingComponent: 'PassageDetailsComponent',
                                entityId: resolvedConnectionEntity.id
                            },
                            error: `Resolved connection '${resolvedConnectionEntity.id}' lacks required details.`
                        };
                    }

                    // 5. Determine Target Location ID and Blocker ID
                    let targetLocationId = null;
                    let blockerEntityId = null;
                    try {
                        // Ensure currentLocation is available (checked at the start)
                        targetLocationId = passageDetails.getOtherLocationId(currentLocation.id);
                        blockerEntityId = passageDetails.getBlockerId();
                    } catch (passageError) {
                        console.error(`TargetResolutionService: Error processing PassageDetailsComponent for connection '${resolvedConnectionEntity.id}':`, passageError);
                        return {
                            status: ResolutionStatus.ERROR,
                            targetType: null,
                            targetId: null,
                            targetEntity: null,
                            targetConnectionEntity: null,
                            candidateIds: [],
                            details: {passageError: passageError.message, entityId: resolvedConnectionEntity.id},
                            error: `Error processing passage details: ${passageError.message}`
                        };
                    }


                    // 6. Return FOUND_UNIQUE Result
                    return {
                        status: ResolutionStatus.FOUND_UNIQUE,
                        targetType: 'direction', // As per ticket, stick to 'direction' initially
                        targetId: resolvedConnectionEntity.id, // ID of the ConnectionEntity
                        targetEntity: null, // Not an entity target in the traditional sense
                        targetConnectionEntity: resolvedConnectionEntity, // The resolved connection
                        candidateIds: [],
                        details: {targetLocationId: targetLocationId, blockerEntityId: blockerEntityId},
                        error: null
                    };
                }

            } catch (error) {
                console.error(`TargetResolutionService: Error resolving target for action '${actionDefinition.id}' in domain 'direction':`, error);
                // Dispatch a generic internal error message?
                await eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
                return {
                    status: ResolutionStatus.ERROR,
                    targetType: null,
                    targetId: null,
                    targetEntity: null,
                    targetConnectionEntity: null,
                    candidateIds: [],
                    details: null,
                    error: `Error during direction resolution: ${error.message}`
                };
            }
        }


        // --- Handle Other Entity-Based Domains (Existing Logic) ---
        const entityDomains = ['inventory', 'equipment', 'environment', 'location_items', 'nearby_including_blockers']; // Add others if needed
        if (entityDomains.includes(target_domain)) {
            try {
                // 1. Get Target Name
                const targetName = parsedCommand.directObjectPhrase;
                if (!targetName || targetName.trim() === '') {
                    console.warn(`TargetResolutionService: Missing or empty target name (directObjectPhrase) for action '${actionDefinition.id}' in domain '${target_domain}'.`);
                    return {
                        status: ResolutionStatus.INVALID_INPUT,
                        targetType: null,
                        targetId: null,
                        targetEntity: null,
                        targetConnectionEntity: null,
                        candidateIds: [],
                        details: {message: "Target name missing from command."},
                        error: "Missing target name."
                    };
                }
                const trimmedTargetName = targetName.trim();

                // 2. Get Candidate IDs
                const candidateIdSet = getEntityIdsForScopes([target_domain], context);

                // 3. Handle Empty Scope (Initial)
                if (candidateIdSet.size === 0) {
                    const messageKeySuffix = _getMessageKeySuffix(target_domain);
                    const messageFunc = TARGET_MESSAGES[`SCOPE_EMPTY_${messageKeySuffix}`] || TARGET_MESSAGES.SCOPE_EMPTY_GENERIC;
                    const messageText = messageFunc(actionDefinition.name || actionDefinition.id, target_domain);
                    await eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: messageText, type: 'info'});
                    return {
                        status: ResolutionStatus.FILTER_EMPTY,
                        targetType: null,
                        targetId: null,
                        targetEntity: null,
                        targetConnectionEntity: null,
                        candidateIds: [],
                        details: {reason: "Initial scope empty"},
                        error: null
                    };
                }

                // 4. Get Entity Instances & Filter Nulls
                const initialEntities = Array.from(candidateIdSet)
                    .map(id => entityManager.getEntityInstance(id))
                    .filter(entity => entity !== null && entity !== undefined);

                if (initialEntities.length === 0) {
                    console.warn(`TargetResolutionService: No valid entity instances found for IDs in scope '${target_domain}' for action '${actionDefinition.id}'.`);
                    const messageKeySuffix = _getMessageKeySuffix(target_domain);
                    const messageFunc = TARGET_MESSAGES[`SCOPE_EMPTY_${messageKeySuffix}`] || TARGET_MESSAGES.SCOPE_EMPTY_GENERIC;
                    const messageText = messageFunc(actionDefinition.name || actionDefinition.id, target_domain);
                    await eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: messageText, type: 'info'});
                    return {
                        status: ResolutionStatus.FILTER_EMPTY,
                        targetType: null,
                        targetId: null,
                        targetEntity: null,
                        targetConnectionEntity: null,
                        candidateIds: Array.from(candidateIdSet),
                        details: {reason: "No instances found for scope IDs"},
                        error: null
                    };
                }

                // 5. Filter by Components (Pre-filter)
                const componentFilteredEntities = initialEntities.filter(entity => {
                    const hasAllRequired = target_required_components.every(compId => {
                        const ComponentClass = entityManager.componentRegistry.get(compId);
                        if (!ComponentClass) {
                            console.error(`TargetResolutionService: Component class not found in registry for ID '${compId}' required by action '${actionDefinition.id}'.`);
                            return false;
                        }
                        return entity.hasComponent(ComponentClass);
                    });
                    if (!hasAllRequired) return false;

                    const hasAnyForbidden = target_forbidden_components.some(compId => {
                        const ComponentClass = entityManager.componentRegistry.get(compId);
                        if (!ComponentClass) {
                            console.error(`TargetResolutionService: Component class not found in registry for ID '${compId}' forbidden by action '${actionDefinition.id}'.`);
                            return false;
                        }
                        return entity.hasComponent(ComponentClass);
                    });
                    return !hasAnyForbidden;
                });

                // 6. Handle Empty Scope (Post-Component Filter)
                if (componentFilteredEntities.length === 0) {
                    const messageKeySuffix = _getMessageKeySuffix(target_domain);
                    const messageFunc = TARGET_MESSAGES[`FILTER_EMPTY_${messageKeySuffix}`] || TARGET_MESSAGES.SCOPE_EMPTY_GENERIC;
                    const messageText = messageFunc(actionDefinition.name || actionDefinition.id, target_domain);
                    await eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: messageText, type: 'info'});
                    return {
                        status: ResolutionStatus.FILTER_EMPTY, targetType: null, targetId: null, targetEntity: null,
                        targetConnectionEntity: null, candidateIds: initialEntities.map(e => e.id),
                        details: {reason: "All candidates filtered out by component requirements."}, error: null
                    };
                }


                // 7. Name Matching using findTarget
                const findResult = findTarget(trimmedTargetName, componentFilteredEntities);

                // 8. Handle findTarget Results
                switch (findResult.status) {
                    case 'NOT_FOUND': {
                        const messageKeySuffix = _getMessageKeySuffix(target_domain);
                        // Attempt lookup with specific key and the intended (but non-existent) fallback key
                        let messageFunc = TARGET_MESSAGES[`NOT_FOUND_${messageKeySuffix}`] || TARGET_MESSAGES.NOT_FOUND_GENERIC;

                        // ---> ADD/MODIFY THIS SECTION <---
                        // Check if the lookup failed and provide a guaranteed fallback
                        if (typeof messageFunc !== 'function') {
                            console.warn(`TargetResolutionService: Message function not found for keys NOT_FOUND_${messageKeySuffix} or NOT_FOUND_GENERIC. Using NOT_FOUND_NEARBY as fallback.`);
                            messageFunc = TARGET_MESSAGES.NOT_FOUND_NEARBY; // Use a known valid fallback function

                            // Optional: Add a check for the fallback itself in case messages.js is severely broken
                            if (typeof messageFunc !== 'function') {
                                console.error(`TargetResolutionService: CRITICAL - Fallback message function NOT_FOUND_NEARBY is also missing!`);
                                // Dispatch internal error and return ERROR status to prevent further issues
                                await eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {
                                    text: TARGET_MESSAGES.INTERNAL_ERROR,
                                    type: 'error'
                                });
                                return {
                                    status: ResolutionStatus.ERROR,
                                    error: "Internal configuration error: Missing essential message templates.",
                                    targetType: null,
                                    targetId: null,
                                    targetEntity: null,
                                    targetConnectionEntity: null,
                                    candidateIds: [],
                                    details: null
                                };
                            }
                        }
                        // ---> END OF ADDED/MODIFIED SECTION <---

                        // Now we are reasonably sure messageFunc is a function
                        const messageText = messageFunc(trimmedTargetName); // This line should no longer throw the TypeError
                        await eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: messageText, type: 'info'});

                        // Return the correct NOT_FOUND status
                        return {
                            status: ResolutionStatus.NOT_FOUND, // Should now return the correct status
                            targetType: null,
                            targetId: null,
                            targetEntity: null,
                            targetConnectionEntity: null,
                            candidateIds: componentFilteredEntities.map(e => e.id), // Keep original candidates list
                            details: {searchedName: trimmedTargetName},
                            error: null
                        };
                    }
                    case 'FOUND_AMBIGUOUS': {
                        const ambiguousEntities = findResult.matches;
                        const messageText = TARGET_MESSAGES.AMBIGUOUS_PROMPT(
                            actionDefinition.name || actionDefinition.id,
                            trimmedTargetName,
                            ambiguousEntities
                        );
                        await eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: messageText, type: 'warning'});
                        return {
                            status: ResolutionStatus.AMBIGUOUS,
                            targetType: 'entity',
                            targetId: null,
                            targetEntity: null,
                            targetConnectionEntity: null,
                            candidateIds: ambiguousEntities.map(e => e.id),
                            details: {searchedName: trimmedTargetName},
                            error: null
                        };
                    }
                    case 'FOUND_UNIQUE': {
                        const uniqueMatch = findResult.matches[0];
                        return {
                            status: ResolutionStatus.FOUND_UNIQUE,
                            targetType: 'entity',
                            targetId: uniqueMatch.id,
                            targetEntity: uniqueMatch,
                            targetConnectionEntity: null,
                            candidateIds: [],
                            details: null,
                            error: null
                        };
                    }
                    default:
                        console.error(`TargetResolutionService: Unexpected status from findTarget: ${findResult.status}`);
                        return {
                            status: ResolutionStatus.ERROR,
                            targetType: null,
                            targetId: null,
                            targetEntity: null,
                            targetConnectionEntity: null,
                            candidateIds: [],
                            details: null,
                            error: "Internal error during name matching."
                        };
                }

            } catch (error) {
                console.error(`TargetResolutionService: Error resolving target for action '${actionDefinition.id}' in domain '${target_domain}':`, error);
                await eventBus.dispatch(EVENT_DISPLAY_MESSAGE, {text: TARGET_MESSAGES.INTERNAL_ERROR, type: 'error'});
                return {
                    status: ResolutionStatus.ERROR,
                    targetType: null,
                    targetId: null,
                    targetEntity: null,
                    targetConnectionEntity: null,
                    candidateIds: [],
                    details: null,
                    error: `Error during resolution: ${error.message}`
                };
            }
        }

        // --- Fallback for unknown/unhandled domains ---
        console.error(`TargetResolutionService: Unhandled target_domain '${target_domain}' for action "${actionDefinition.id}".`);
        return {
            status: ResolutionStatus.ERROR,
            targetType: null,
            targetId: null,
            targetEntity: null,
            targetConnectionEntity: null,
            candidateIds: [],
            details: {unhandledDomain: target_domain},
            error: `Unhandled target domain: ${target_domain}`
        };
    }

} // End class TargetResolutionService

// --- Export Service ---
export default TargetResolutionService;