// src/services/itemTargetResolver.js
// ─────────────────────────────────────────────────────────────────────────────
import {PositionComponent} from '../components/positionComponent.js';
import {ConnectionsComponent} from '../components/connectionsComponent.js';
import {PassageDetailsComponent} from '../components/passageDetailsComponent.js';
import {TARGET_MESSAGES, getDisplayName} from '../utils/messages.js';

/** @typedef {import('../entities/entity.js').default} Entity */

/**
 * Resolve and validate an item‑use target.
 * If the explicit target is a connection that owns a blocker, the blocker door
 * becomes the effective target.
 */
export class ItemTargetResolverService {
    #em;
    #bus;
    #ce;

    constructor({entityManager, eventBus, conditionEvaluationService}) {
        this.#em = entityManager;
        this.#bus = eventBus;
        this.#ce = conditionEvaluationService;
    }

    /**
     * @param {object} p
     * @returns {Promise<{success:boolean,target:Entity|null,targetType:'entity'|'connection'|'none',messages:any[]}>}
     */
    async resolveItemTarget(p) {
        const {
            userEntity, usableComponentData,
            explicitTargetEntityId, explicitTargetConnectionEntityId, itemName
        } = p;

        const messages = [];
        const log = (t, type = 'internal') => messages.push({text: t, type});

        if (!usableComponentData.target_required)
            return {success: true, target: null, targetType: 'none', messages};

        // ─────────────────────────── resolve CONNECTION ─────────────────────────
        if (explicitTargetConnectionEntityId) {
            const conn = this.#em.getEntityInstance(explicitTargetConnectionEntityId);
            if (conn) {
                // Quick room‑exit sanity check (property‑agnostic):
                const userRoomId = userEntity.getComponent(PositionComponent)?.locationId;
                const exits = this.#em
                    .getEntityInstance(userRoomId)
                    ?.getComponent(ConnectionsComponent)
                    ?.getAllConnections() ?? [];

                const isExitHere = exits.some(e => (e.id ?? e.connectionEntityId) === conn.id);
                if (!isExitHere) log('Connection is not an exit from this room.', 'warning');
                else {
                    // swap to blocker if any
                    const passage = conn.getComponent(PassageDetailsComponent);
                    const blockerId = passage?.blockerEntityId ?? null;

                    if (blockerId) {
                        const blocker = this.#em.getEntityInstance(blockerId);
                        if (blocker) {
                            log(`Connection blocked by ${getDisplayName(blocker)} – using blocker.`);
                            return {success: true, target: blocker, targetType: 'entity', messages};
                        }
                    }
                    return {success: true, target: conn, targetType: 'connection', messages};
                }
            }
        }

        // ─────────────────────────── resolve ENTITY ─────────────────────────────
        if (explicitTargetEntityId) {
            const ent = this.#em.getEntityInstance(explicitTargetEntityId);
            if (ent) return {success: true, target: ent, targetType: 'entity', messages};
        }

        // ─────────────────────────── failure ────────────────────────────────────
        await this.#bus.dispatch('ui:message_display', {
            text: usableComponentData.failure_message_target_required
                ?? TARGET_MESSAGES.USE_REQUIRES_TARGET(itemName),
            type: 'warning'
        });
        return {success: false, target: null, targetType: 'none', messages};
    }
}
