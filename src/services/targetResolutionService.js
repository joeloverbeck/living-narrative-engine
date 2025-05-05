// src/services/targetResolutionService.js
'use strict';

/* -------------------------------------------------------- */
/*  Necessary typedef imports for editor IntelliSense only  */
/* -------------------------------------------------------- */
/**
 * @typedef {object} ActionDefinition
 * @property {string} id
 * @property {string} [name]
 * @property {'none' | 'self' | 'inventory' | 'equipment' | 'environment' | 'direction'} target_domain
 * @property {string[]} [actor_required_components]
 * @property {string[]} [actor_forbidden_components]
 * @property {string[]} [target_required_components]
 * @property {string[]} [target_forbidden_components]
 * @property {object[]} [prerequisites]
 * @property {string} template
 * @property {{eventName:string,payload:Object.<string,string>}} [dispatch_event]
 */

/** @typedef {import('../actions/actionTypes.js').ActionContext} ActionContext */
/** @typedef {import('../entities/entity.js').default} Entity */

/* -------------------------------------------------------- */
/*  Imports                                                 */
/* -------------------------------------------------------- */
import {getEntityIdsForScopes} from './entityScopeService.js';
import {findTarget} from '../utils/targetFinder.js';
import {TARGET_MESSAGES} from '../utils/messages.js';
import {resolveTargetConnection} from './connectionResolver.js';
import {PASSAGE_DETAILS_COMPONENT_TYPE_ID} from '../types/components.js';

/* -------------------------------------------------------- */
/*  ResolutionStatus enum                                   */
/* -------------------------------------------------------- */
export const ResolutionStatus = Object.freeze({
    FOUND_UNIQUE: 'FOUND_UNIQUE',
    NOT_FOUND: 'NOT_FOUND',
    AMBIGUOUS: 'AMBIGUOUS',
    FILTER_EMPTY: 'FILTER_EMPTY',
    INVALID_INPUT: 'INVALID_INPUT',
    ERROR: 'ERROR'
});

/* -------------------------------------------------------- */
/*  Helper: domain-specific message-key suffix              */

/* -------------------------------------------------------- */
function _getMessageKeySuffix(domain) {
    switch (domain) {
        case 'inventory'                :
            return 'INVENTORY';
        case 'equipment'                :
            return 'EQUIPMENT';
        case 'environment'              :
            return 'ENVIRONMENT';
        case 'location_items'           :
            return 'LOCATION_ITEMS';
        case 'nearby_including_blockers':
            return 'NEARBY_INCLUDING_BLOCKERS';
        default                         :
            return 'GENERIC';
    }
}

/* -------------------------------------------------------- */
/*  TargetResolutionService                                 */

/* -------------------------------------------------------- */
class TargetResolutionService {
    constructor() {
        console.log('TargetResolutionService initialized.');
    }

    /**
     * Resolves the concrete target of an action.
     * Accepts either `context.actingEntity` (preferred) or the legacy
     * `context.playerEntity` for backward compatibility.
     *
     * @param {ActionDefinition} actionDefinition
     * @param {ActionContext}    context
     * @returns {Promise<import('./targetResolutionService.js').TargetResolutionResult>}
     */
    async resolveActionTarget(actionDefinition, context) {

        /* --------------------------------------------
         * Accept both `actingEntity` and `playerEntity`
         * ------------------------------------------ */
        const actingEntity = context?.actingEntity ?? context?.playerEntity;

        if (
            !actionDefinition ||
            !context ||
            !actingEntity ||   // <- renamed
            !context.entityManager ||
            !context.eventBus ||
            !context.parsedCommand
        ) {
            console.error(
                'TargetResolutionService.resolveActionTarget: Invalid actionDefinition or context provided.',
                {actionDefinition, context}
            );
            return {
                status: ResolutionStatus.INVALID_INPUT,
                targetType: null,
                targetId: null,
                targetEntity: null,
                targetConnectionEntity: null,
                candidateIds: [],
                details: null,
                error: 'Invalid action definition or context.'
            };
        }

        /* ------------- direction domain extra check ------------- */
        if (actionDefinition.target_domain === 'direction' && !context.currentLocation) {
            console.error(
                "TargetResolutionService.resolveActionTarget: Invalid context for 'direction' domain - currentLocation is missing."
            );
            return {
                status: ResolutionStatus.INVALID_INPUT,
                targetType: null,
                targetId: null,
                targetEntity: null,
                targetConnectionEntity: null,
                candidateIds: [],
                details: null,
                error: 'Context missing currentLocation for direction resolution.'
            };
        }

        /* --------------------------------------------
         * Local aliases pulled from validated context
         * ------------------------------------------ */
        const {
            target_domain,
            target_required_components = [],
            target_forbidden_components = []
        } = actionDefinition;

        const {
            entityManager,
            eventBus,
            parsedCommand,
            currentLocation
        } = context;

        const playerEntity = actingEntity;   // keep legacy local var name for existing logic

        /* =========================================================
         *  domain: none
         * =======================================================*/
        if (target_domain === 'none') {
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

        /* =========================================================
         *  domain: self
         * =======================================================*/
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

        /* =========================================================
         *  domain: direction
         * =======================================================*/
        if (target_domain === 'direction') {
            try {
                const targetName = parsedCommand.directObjectPhrase;
                if (!targetName || targetName.trim() === '') {
                    console.warn(
                        `TargetResolutionService: Missing or empty direction name (directObjectPhrase) for action '${actionDefinition.id}'.`
                    );
                    return {
                        status: ResolutionStatus.INVALID_INPUT,
                        targetType: null,
                        targetId: null,
                        targetEntity: null,
                        targetConnectionEntity: null,
                        candidateIds: [],
                        details: {message: 'Direction name missing from command.'},
                        error: 'Missing direction name.'
                    };
                }
                const trimmedTargetName = targetName.trim();

                const resolvedConnectionEntity = resolveTargetConnection(
                    context,
                    trimmedTargetName,
                    actionDefinition.name || actionDefinition.id
                );

                if (resolvedConnectionEntity === null) {
                    return {
                        status: ResolutionStatus.NOT_FOUND,
                        targetType: null,
                        targetId: null,
                        targetEntity: null,
                        targetConnectionEntity: null,
                        candidateIds: [],
                        details: {searchedDirection: trimmedTargetName},
                        error: null
                    };
                }

                // ensure passage details exist
                const passageDetails = resolvedConnectionEntity.getComponentData(
                    PASSAGE_DETAILS_COMPONENT_TYPE_ID
                );
                if (!passageDetails) {
                    console.error(
                        `TargetResolutionService: Resolved ConnectionEntity '${resolvedConnectionEntity.id}' lacks passage details.`
                    );
                    return {
                        status: ResolutionStatus.ERROR,
                        targetType: null,
                        targetId: null,
                        targetEntity: null,
                        targetConnectionEntity: null,
                        candidateIds: [],
                        details: {
                            missingComponent: PASSAGE_DETAILS_COMPONENT_TYPE_ID,
                            entityId: resolvedConnectionEntity.id
                        },
                        error: `Resolved connection '${resolvedConnectionEntity.id}' lacks required details.`
                    };
                }

                let targetLocationId = null;
                let blockerEntityId = null;
                try {
                    targetLocationId = passageDetails.getOtherLocationId(currentLocation.id);
                    blockerEntityId = passageDetails.getBlockerId();
                } catch (err) {
                    console.error(
                        `TargetResolutionService: Error processing passage details for connection '${resolvedConnectionEntity.id}':`,
                        err
                    );
                    return {
                        status: ResolutionStatus.ERROR,
                        targetType: null,
                        targetId: null,
                        targetEntity: null,
                        targetConnectionEntity: null,
                        candidateIds: [],
                        details: {passageError: err.message, entityId: resolvedConnectionEntity.id},
                        error: `Error processing passage details: ${err.message}`
                    };
                }

                return {
                    status: ResolutionStatus.FOUND_UNIQUE,
                    targetType: 'direction',
                    targetId: resolvedConnectionEntity.id,
                    targetEntity: null,
                    targetConnectionEntity: resolvedConnectionEntity,
                    candidateIds: [],
                    details: {targetLocationId, blockerEntityId},
                    error: null
                };

            } catch (error) {
                console.error(
                    `TargetResolutionService: Error resolving target for action '${actionDefinition.id}' in domain 'direction':`,
                    error
                );
                await eventBus.dispatch('textUI:display_message', {
                    text: TARGET_MESSAGES.INTERNAL_ERROR,
                    type: 'error'
                });
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

        /* =========================================================
         *  entity-based domains
         * =======================================================*/
        const entityDomains = [
            'inventory',
            'equipment',
            'environment',
            'location_items',
            'nearby_including_blockers'
        ];

        if (entityDomains.includes(target_domain)) {
            /* —— existing, unmodified entity-domain code follows —— */
            try {
                /* 1. Name from command */
                const targetName = parsedCommand.directObjectPhrase;
                if (!targetName || targetName.trim() === '') {
                    console.warn(
                        `TargetResolutionService: Missing or empty target name (directObjectPhrase) for action '${actionDefinition.id}' in domain '${target_domain}'.`
                    );
                    return {
                        status: ResolutionStatus.INVALID_INPUT,
                        targetType: null,
                        targetId: null,
                        targetEntity: null,
                        targetConnectionEntity: null,
                        candidateIds: [],
                        details: {message: 'Target name missing from command.'},
                        error: 'Missing target name.'
                    };
                }
                const trimmedTargetName = targetName.trim();

                /* 2. Candidate IDs from scopes */
                const candidateIdSet = getEntityIdsForScopes([target_domain], {
                    ...context,
                    playerEntity: playerEntity   // ensure legacy helpers receive it
                });

                /* 3. handle empty initial scope */
                if (candidateIdSet.size === 0) {
                    const key = _getMessageKeySuffix(target_domain);
                    const fn = TARGET_MESSAGES[`SCOPE_EMPTY_${key}`] || TARGET_MESSAGES.SCOPE_EMPTY_GENERIC;
                    await eventBus.dispatch('textUI:display_message', {
                        text: fn(actionDefinition.name || actionDefinition.id, target_domain),
                        type: 'info'
                    });
                    return {
                        status: ResolutionStatus.FILTER_EMPTY,
                        targetType: null,
                        targetId: null,
                        targetEntity: null,
                        targetConnectionEntity: null,
                        candidateIds: [],
                        details: {reason: 'Initial scope empty'},
                        error: null
                    };
                }

                /* 4. entity instances */
                const initialEntities = Array.from(candidateIdSet)
                    .map(id => entityManager.getEntityInstance(id))
                    .filter(Boolean);

                if (initialEntities.length === 0) {
                    const key = _getMessageKeySuffix(target_domain);
                    const fn = TARGET_MESSAGES[`SCOPE_EMPTY_${key}`] || TARGET_MESSAGES.SCOPE_EMPTY_GENERIC;
                    await eventBus.dispatch('textUI:display_message', {
                        text: fn(actionDefinition.name || actionDefinition.id, target_domain),
                        type: 'info'
                    });
                    return {
                        status: ResolutionStatus.FILTER_EMPTY,
                        targetType: null,
                        targetId: null,
                        targetEntity: null,
                        targetConnectionEntity: null,
                        candidateIds: Array.from(candidateIdSet),
                        details: {reason: 'No instances found for scope IDs'},
                        error: null
                    };
                }

                /* 5. component filters */
                const componentFilteredEntities = initialEntities.filter(entity => {
                    const hasAllRequired = target_required_components.every(c => entity.hasComponent(c));
                    if (!hasAllRequired) return false;
                    const hasForbidden = target_forbidden_components.some(c => entity.hasComponent(c));
                    return !hasForbidden;
                });

                if (componentFilteredEntities.length === 0) {
                    const key = _getMessageKeySuffix(target_domain);
                    const fn = TARGET_MESSAGES[`FILTER_EMPTY_${key}`] || TARGET_MESSAGES.SCOPE_EMPTY_GENERIC;
                    await eventBus.dispatch('textUI:display_message', {
                        text: fn(actionDefinition.name || actionDefinition.id, target_domain),
                        type: 'info'
                    });
                    return {
                        status: ResolutionStatus.FILTER_EMPTY,
                        targetType: null,
                        targetId: null,
                        targetEntity: null,
                        targetConnectionEntity: null,
                        candidateIds: initialEntities.map(e => e.id),
                        details: {reason: 'All candidates filtered out by component requirements.'},
                        error: null
                    };
                }

                /* 6. fuzzy name match */
                const findResult = findTarget(trimmedTargetName, componentFilteredEntities);

                switch (findResult.status) {
                    case 'NOT_FOUND': {
                        const key = _getMessageKeySuffix(target_domain);
                        let fn = TARGET_MESSAGES[`NOT_FOUND_${key}`] || TARGET_MESSAGES.NOT_FOUND_GENERIC;
                        if (typeof fn !== 'function') {
                            console.warn(`TargetResolutionService: Message function NOT_FOUND_${key} missing. Fallback to NOT_FOUND_NEARBY.`);
                            fn = TARGET_MESSAGES.NOT_FOUND_NEARBY;
                        }
                        await eventBus.dispatch('textUI:display_message', {
                            text: fn(trimmedTargetName),
                            type: 'info'
                        });
                        return {
                            status: ResolutionStatus.NOT_FOUND,
                            targetType: null,
                            targetId: null,
                            targetEntity: null,
                            targetConnectionEntity: null,
                            candidateIds: componentFilteredEntities.map(e => e.id),
                            details: {searchedName: trimmedTargetName},
                            error: null
                        };
                    }

                    case 'FOUND_AMBIGUOUS': {
                        const ambiguousEntities = findResult.matches;
                        await eventBus.dispatch('textUI:display_message', {
                            text: TARGET_MESSAGES.AMBIGUOUS_PROMPT(
                                actionDefinition.name || actionDefinition.id,
                                trimmedTargetName,
                                ambiguousEntities
                            ),
                            type: 'warning'
                        });
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
                        const match = findResult.matches[0];
                        return {
                            status: ResolutionStatus.FOUND_UNIQUE,
                            targetType: 'entity',
                            targetId: match.id,
                            targetEntity: match,
                            targetConnectionEntity: null,
                            candidateIds: [],
                            details: null,
                            error: null
                        };
                    }

                    default:
                        console.error(
                            `TargetResolutionService: Unexpected status from findTarget: ${findResult.status}`
                        );
                        return {
                            status: ResolutionStatus.ERROR,
                            targetType: null,
                            targetId: null,
                            targetEntity: null,
                            targetConnectionEntity: null,
                            candidateIds: [],
                            details: null,
                            error: 'Internal error during name matching.'
                        };
                }

            } catch (error) {
                console.error(
                    `TargetResolutionService: Error resolving target for action '${actionDefinition.id}' in domain '${target_domain}':`,
                    error
                );
                await eventBus.dispatch('textUI:display_message', {
                    text: TARGET_MESSAGES.INTERNAL_ERROR,
                    type: 'error'
                });
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

        /* =========================================================
         *  unhandled domain fallback
         * =======================================================*/
        console.error(
            `TargetResolutionService: Unhandled target_domain '${target_domain}' for action "${actionDefinition.id}".`
        );
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
}

export default TargetResolutionService;