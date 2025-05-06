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
import {resolveTargetConnection} from './connectionResolver.js';

/* -------------------------------------------------------- */
/*  ResolutionStatus enum                                   */
/* -------------------------------------------------------- */
export const ResolutionStatus = Object.freeze({
    FOUND_UNIQUE: 'FOUND_UNIQUE',
    NOT_FOUND: 'NOT_FOUND',
    AMBIGUOUS: 'AMBIGUOUS',
    SELF: 'SELF',
});

/* -------------------------------------------------------- */
/*  TargetResolutionService                                 */

/* -------------------------------------------------------- */
class TargetResolutionService {
    constructor() {
        console.log('TargetResolutionService initialized.');
    }

    /**
     * Resolves the concrete target of an action.
     *
     * @param {ActionDefinition} actionDefinition
     * @param {ActionContext}    context
     * @returns {Promise<import('./targetResolutionService.js').TargetResolutionResult>}
     */
    async resolveActionTarget(actionDefinition, context) {
        /* --------------------------------------------
         * Accept both `actingEntity` and legacy `playerEntity`
         * ------------------------------------------ */
        const actingEntity = context?.actingEntity ?? context?.playerEntity;

        if (
            !actionDefinition ||
            !context ||
            !actingEntity ||
            !context.entityManager ||
            !context.parsedCommand
        ) {
            console.error('TargetResolutionService: invalid actionDefinition or context.');
            return {
                status: ResolutionStatus.NOT_FOUND,
                targetType: null,
                targetId: null,
                targetEntity: null,
                targetConnectionEntity: null,
            };
        }

        const {target_domain} = actionDefinition;
        const {entityManager, parsedCommand} = context;

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
            };
        }

        /* =========================================================
         *  domain: self
         * =======================================================*/
        if (target_domain === 'self') {
            return {
                status: ResolutionStatus.FOUND_UNIQUE,
                targetType: 'self',
                targetId: actingEntity.id,
                targetEntity: actingEntity,
                targetConnectionEntity: null,
            };
        }

        /* =========================================================
         *  domain: direction
         * =======================================================*/
        if (target_domain === 'direction') {
            const rawDir = parsedCommand.directObjectPhrase ?? '';
            const dirName = rawDir.trim();
            if (!dirName) {
                return {
                    status: ResolutionStatus.NOT_FOUND,
                    targetType: null,
                    targetId: null,
                    targetEntity: null,
                    targetConnectionEntity: null,
                };
            }

            try {
                const connEntity = resolveTargetConnection(context, dirName, actionDefinition.name || actionDefinition.id);
                if (connEntity === null) {
                    return {
                        status: ResolutionStatus.NOT_FOUND,
                        targetType: null,
                        targetId: null,
                        targetEntity: null,
                        targetConnectionEntity: null,
                    };
                }

                return {
                    status: ResolutionStatus.FOUND_UNIQUE,
                    targetType: 'direction',
                    targetId: connEntity.id,
                    targetEntity: null,
                    targetConnectionEntity: connEntity,
                };
            } catch (err) {
                console.error('TargetResolutionService (direction): unexpected error', err);
                return {
                    status: ResolutionStatus.NOT_FOUND,
                    targetType: null,
                    targetId: null,
                    targetEntity: null,
                    targetConnectionEntity: null,
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
            'nearby_including_blockers',
        ];

        if (entityDomains.includes(target_domain)) {
            const rawName = parsedCommand.directObjectPhrase ?? '';
            const targetName = rawName.trim();
            if (!targetName) {
                return {
                    status: ResolutionStatus.NOT_FOUND,
                    targetType: null,
                    targetId: null,
                    targetEntity: null,
                    targetConnectionEntity: null,
                };
            }

            /* 1. collect candidate IDs */
            const candidateIds = getEntityIdsForScopes([target_domain], {
                ...context,
                playerEntity: actingEntity,
            });

            if (candidateIds.size === 0) {
                return {
                    status: ResolutionStatus.NOT_FOUND,
                    targetType: null,
                    targetId: null,
                    targetEntity: null,
                    targetConnectionEntity: null,
                };
            }

            const candidates = Array.from(candidateIds)
                .map(id => entityManager.getEntityInstance(id))
                .filter(Boolean);

            if (candidates.length === 0) {
                return {
                    status: ResolutionStatus.NOT_FOUND,
                    targetType: null,
                    targetId: null,
                    targetEntity: null,
                    targetConnectionEntity: null,
                };
            }

            /* 2. fuzzy-match name */
            const result = findTarget(targetName, candidates);

            switch (result.status) {
                case 'NOT_FOUND':
                    return {
                        status: ResolutionStatus.NOT_FOUND,
                        targetType: null,
                        targetId: null,
                        targetEntity: null,
                        targetConnectionEntity: null,
                    };

                case 'FOUND_AMBIGUOUS':
                    return {
                        status: ResolutionStatus.AMBIGUOUS,
                        targetType: 'entity',
                        targetId: null,
                        targetEntity: null,
                        targetConnectionEntity: null,
                    };

                case 'FOUND_UNIQUE': {
                    const match = result.matches[0];
                    return {
                        status: ResolutionStatus.FOUND_UNIQUE,
                        targetType: 'entity',
                        targetId: match.id,
                        targetEntity: match,
                        targetConnectionEntity: null,
                    };
                }

                default:
                    // should never happen, but stay defensive
                    console.error(`TargetResolutionService: unexpected findTarget status '${result.status}'`);
                    return {
                        status: ResolutionStatus.NOT_FOUND,
                        targetType: null,
                        targetId: null,
                        targetEntity: null,
                        targetConnectionEntity: null,
                    };
            }
        }

        /* =========================================================
         *  unhandled domain
         * =======================================================*/
        console.warn(`TargetResolutionService: unhandled domain '${target_domain}'.`);
        return {
            status: ResolutionStatus.NOT_FOUND,
            targetType: null,
            targetId: null,
            targetEntity: null,
            targetConnectionEntity: null,
        };
    }
}

export default TargetResolutionService;