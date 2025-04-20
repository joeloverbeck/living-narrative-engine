// src/systems/triggerDispatcher.js

// Import necessary components used by action implementations
import {ConnectionsComponent} from "../components/connectionsComponent.js"; // eslint-disable-line no-unused-vars

/** @typedef {import('../core/services/gameDataRepository.js').GameDataRepository} GameDataRepository */

/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../core/eventBus.js').default} EventBus */

class TriggerDispatcher {
    #eventBus;
    #repository; // Renamed
    #entityManager;
    #triggerIdToHandlerMap = new Map();
    #activeOneShotTriggerIds = new Set();

    constructor({eventBus, gameDataRepository, entityManager}) { // Updated param name
        if (!eventBus) throw new Error("TriggerDispatcher requires options.eventBus.");
        if (!gameDataRepository) throw new Error("TriggerDispatcher requires options.gameDataRepository."); // Updated check
        if (!entityManager) throw new Error("TriggerDispatcher requires options.entityManager.");

        this.#eventBus = eventBus;
        this.#repository = gameDataRepository; // Updated assignment
        this.#entityManager = entityManager;
        console.log("TriggerDispatcher: Instance created.");
    }

    /** Scan GameDataRepository, subscribe to each trigger’s listen_to.event_type */
    initialize() {
        console.log("TriggerDispatcher: Initializing...");
        const allTriggers = this.#repository.getAllTriggers();

        if (!allTriggers?.length) {
            console.log("TriggerDispatcher: No trigger definitions found.");
            return;
        }

        let count = 0;
        for (const trig of allTriggers) {
            // ── Skip disabled triggers early ───────────────────────────────────
            if (trig.enabled === false) {
                console.log("TriggerDispatcher: Skipping disabled trigger:", trig.id);
                continue;
            }

            if (!trig?.id || !trig.listen_to?.event_type) {
                console.warn("TriggerDispatcher: Skipping invalid trigger:", trig);
                continue;
            }

            // one‑shot bookkeeping (defaults to one‑shot if not explicitly false)
            if (trig.one_shot !== false) this.#activeOneShotTriggerIds.add(trig.id);

            const eventName = trig.listen_to.event_type;
            const handler = (evtData) => this.#handleMatch(trig, eventName, evtData);

            // 👉 Store both the handler and the event name so we can later unsubscribe
            this.#triggerIdToHandlerMap.set(trig.id, {eventName, handler});
            this.#eventBus.subscribe(eventName, handler);
            count++;
        }
        console.log(`TriggerDispatcher: Subscribed ${count} triggers.`);
    }

    /**
     * Gracefully unsubscribe all registered listeners and clear internal
     * bookkeeping structures. Intended for hot‑reload environments and unit
     * tests.
     */
    shutdown() {
        console.log("TriggerDispatcher: Shutting down...");

        for (const {eventName, handler} of this.#triggerIdToHandlerMap.values()) {
            // Use optional chaining: some EventBus implementations might not yet
            // expose an `unsubscribe` method; fail softly in that scenario.
            this.#eventBus.unsubscribe?.(eventName, handler);
        }

        this.#triggerIdToHandlerMap.clear();
        this.#activeOneShotTriggerIds.clear();

        console.log("TriggerDispatcher: Shutdown complete. All listeners removed.");
    }

    /** Core callback: verify filters, emit effects, deal with one‑shot */
    async #handleMatch(triggerDef, listenedEventName, eventData) {
        // disabled?
        if (triggerDef.enabled === false) return;

        // one‑shot already fired?
        if (triggerDef.one_shot !== false &&
            !this.#activeOneShotTriggerIds.has(triggerDef.id)) return;

        if (!this.#checkFilters(
            {...triggerDef.listen_to, parentTriggerId: triggerDef.id},
            listenedEventName,
            eventData
        )) return;

        console.log(`TriggerDispatcher: MATCH ${triggerDef.id} on ${listenedEventName}`);

        // ── Effect dispatch ────────────────────────────────────────────────
        const effects = triggerDef.effects ?? [];
        for (const eff of effects) {
            if (eff?.type !== "trigger_event") continue;     // ignore unknown types

            const standardCtx = {
                triggerId: triggerDef.id,
                matchedEventData: eventData,
                firedAt: Date.now(),
            };

            const effectPayload = eff.parameters?.payload ?? {};

            await this.#eventBus.dispatch(
                eff.parameters?.eventName,
                {
                    ...standardCtx,
                    ...effectPayload,
                    ...eventData
                }
            );
        }
        // ───────────────────────────────────────────────────────────────────

        // mark one‑shot as consumed
        if (triggerDef.one_shot !== false) {
            this.#activeOneShotTriggerIds.delete(triggerDef.id);
        }
    }

    /**
     * Flat‑property strict‑equality filter.
     *
     * @private
     * @param {{filters?: Record<string, any>, parentTriggerId?: string}} listenCondition —
     *        The `listen_to` object from a trigger plus an internal `parentTriggerId`.
     * @param {string} eventName — The name of the event being evaluated (unused for MVP).
     * @param {Record<string, any>} eventData — The payload that accompanied the event.
     * @returns {boolean} `true` if **all** filters match, or if no filters are defined;
     *                    otherwise `false`.  Never throws.
     */
    #checkFilters(listenCondition, eventName, eventData) { // eslint-disable-line no-unused-vars
        const filters = listenCondition?.filters;

        // ── Wild‑card: no filters means automatic match ─────────────────────
        if (!filters || Object.keys(filters).length === 0) return true;

        // ── Strict equality check, early‑exit on first mismatch ─────────────
        // We purposely avoid `for…of Object.entries` to dodge per‑iteration array
        // allocations; a simple `for…in` does the job.
        for (const prop in filters) {                       // eslint-disable-line guard-for-in
            if (eventData?.[prop] !== filters[prop]) return false;
        }
        return true;
    }
}

export default TriggerDispatcher;