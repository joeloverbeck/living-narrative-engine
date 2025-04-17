// src/systems/perceptionSystem.js

import {
    EVENT_LOOK_INTENDED,
    EVENT_EXAMINE_INTENDED, // Ensure this is imported
    EVENT_DISPLAY_LOCATION,
    EVENT_DISPLAY_MESSAGE,
} from '../types/eventTypes.js';
import {
    getVisibleEntityDisplayNames,
    formatExitString,
    // formatExamineDescription, // We will implement this as a private method for now
} from '../utils/perceptionUtils.js';
import {getDisplayName, TARGET_MESSAGES} from '../utils/messages.js'; // Ensure getDisplayName is imported
import {PositionComponent} from '../components/positionComponent.js';
import {NameComponent} from '../components/nameComponent.js';
import {DescriptionComponent} from '../components/descriptionComponent.js'; // Ensure DescriptionComponent is imported
import {ItemComponent} from '../components/itemComponent.js'; // Ensure ItemComponent is imported
import {PassageDetailsComponent} from '../components/passageDetailsComponent.js';
import OpenableComponent from '../components/openableComponent.js';
import LockableComponent from '../components/lockableComponent.js';
import {ConnectionsComponent} from "../components/connectionsComponent.js";
// Assuming a simple NonPlayerCharacterComponent or similar exists for filtering
// If not, adjust the filter predicate as needed.
// import NonPlayerCharacterComponent from '../components/nonPlayerCharacterComponent.js';


/** @typedef {import('../core/eventBus.js').default} EventBus */
/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../entities/entity.js').default} Entity */
/** @typedef {import('../types/eventTypes.js').LookIntendedPayload} LookIntendedPayload */
/** @typedef {import('../types/eventTypes.js').ExamineIntendedPayload} ExamineIntendedPayload */
/** @typedef {import('../types/eventTypes.js').UIDisplayLocationPayload} UIDisplayLocationPayload */

/** @typedef {import('../types/eventTypes.js').UIMessageDisplayPayload} UIMessageDisplayPayload */

/**
 * PerceptionSystem
 *
 * Listens for intent events (look, examine) and translates game state
 * into UI-layer events for display, without causing direct gameplay side-effects.
 * Handles basic visibility by checking presence in a location. Does not yet
 * implement advanced visibility rules (lighting, FoW, etc.).
 */
class PerceptionSystem {
    /** @type {EventBus} */
    eventBus;
    /** @type {EntityManager} */
    entityManager;

    /**
     * @param {object} dependencies
     * @param {EventBus} dependencies.eventBus - The central event bus.
     * @param {EntityManager} dependencies.entityManager - The entity manager service.
     */
    constructor({eventBus, entityManager}) {
        if (!eventBus) {
            throw new Error("PerceptionSystem requires an EventBus instance.");
        }
        if (!entityManager) {
            throw new Error("PerceptionSystem requires an EntityManager instance.");
        }

        this.eventBus = eventBus;
        this.entityManager = entityManager;

        console.debug("PerceptionSystem instance created.");
    }

    /**
     * Initializes the system by subscribing to perception-related intent events.
     */
    initialize() {
        this.eventBus.subscribe(EVENT_LOOK_INTENDED, this.#handleLook.bind(this));
        // Ensure examine subscription exists (it did in the original code)
        this.eventBus.subscribe(EVENT_EXAMINE_INTENDED, this.#handleExamine.bind(this));

        console.info("PerceptionSystem initialized and subscribed to intent events.");
    }

    // #handleLook method remains unchanged from the provided code...
    /**
     * Handles the EVENT_LOOK_INTENDED event.
     * Gathers game state based on the scope ('location', 'self', 'target')
     * and dispatches the appropriate UI event (EVENT_DISPLAY_LOCATION or ui:message_display).
     * @param {LookIntendedPayload} payload - The event payload.
     * @private
     */
    async #handleLook(payload) {
        console.debug(`Received ${EVENT_LOOK_INTENDED}`, payload);
        const {actorId, scope, targetEntityId} = payload;

        try {
            const actor = this.entityManager.getEntityInstance(actorId);
            if (!actor) {
                console.error(`Cannot handle look: Actor entity not found for ID ${actorId}`);
                return;
            }

            switch (scope) {
                case 'location':
                    await this.#processLookLocation(actor);
                    break;

                case 'self':
                    await this.#processLookSelf(actor);
                    break;

                case 'target':
                    if (!targetEntityId) {
                        console.error(`Cannot handle look target: targetEntityId is missing in payload for actor ${actorId}`);
                        return;
                    }
                    await this.#processLookTarget(actor, targetEntityId);
                    break;

                default:
                    console.warn(`Unhandled look scope: ${scope} for actor ${actorId}`);
            }
        } catch (error) {
            console.error(`Error processing ${EVENT_LOOK_INTENDED} for actor ${actorId}:`, error);
            // Optionally dispatch a generic error message to the user
            await this.#dispatchMessage("An error occurred while trying to look around.", 'error', actorId);
        }
    }

    // #processLookLocation method remains unchanged...
    async #processLookLocation(actor) {
        const position = actor.getComponent(PositionComponent);
        if (!position || !position.locationId) {
            console.warn(`Actor ${actor.id} has no location to look at.`);
            // await this.#dispatchMessage(TARGET_MESSAGES.LOOK_LOCATION_UNKNOWN, 'warning');
            return;
        }

        const locationId = position.locationId;
        const locationEntity = this.entityManager.getEntityInstance(locationId);
        if (!locationEntity) {
            console.error(`Location entity not found for ID: ${locationId}`);
            // await this.#dispatchMessage(TARGET_MESSAGES.LOOK_LOCATION_UNKNOWN, 'error');
            return;
        }

        const locationName = getDisplayName(locationEntity);
        // Corrected property access for DescriptionComponent based on its definition
        const locationDesc = locationEntity.getComponent(DescriptionComponent)?.text ?? 'You see nothing special about this place.';

        // Gather exits
        const exits = this.#getLocationExits(locationId); // Assuming this returns the new format with description property

        // Get the Set of entity IDs present in the location using the actual EntityManager method
        const entityIdsInLocation = this.entityManager.getEntitiesInLocation(locationId);

        // Initialize arrays to hold the {name, id} objects
        const items = [];
        const entities = []; // For non-item entities like NPCs

        // Iterate over the entity IDs found in the location
        for (const entityId of entityIdsInLocation) {
            // Skip the actor performing the look action
            if (entityId === actor.id) {
                continue;
            }

            // Retrieve the actual entity instance using its ID
            const entityInstance = this.entityManager.getEntityInstance(entityId);

            // If the instance couldn't be retrieved (e.g., removed concurrently), skip it
            if (!entityInstance) {
                console.warn(`PerceptionSystem: Entity instance not found for ID ${entityId} listed in location ${locationId}. Skipping.`);
                continue;
            }

            // Check if the entity is an item
            if (entityInstance.hasComponent(ItemComponent)) {
                items.push({
                    name: getDisplayName(entityInstance), // Get name using the utility
                    id: entityInstance.id               // Get ID directly from the instance
                });
            }
            // Check if it's another type of entity we want to list (e.g., has a name but isn't an item)
            else if (entityInstance.hasComponent(NameComponent)) {
                // The 'else if' prevents items from being listed twice
                entities.push({
                    name: getDisplayName(entityInstance),
                    id: entityInstance.id
                });
            }
            // Entities without ItemComponent or NameComponent are ignored for the basic look description
        }


        /** @type {UIDisplayLocationPayload} */
        const payload = {
            name: locationName,
            description: locationDesc,
            // Map exit data to the format expected by UIDisplayLocationPayload
            exits: exits.map(exit => ({
                direction: exit.direction,
                // Assuming #getLocationExits provides a 'description' field compatible with UI_DISPLAY_LOCATION
                description: exit.description,
                // Map other potential fields if available and needed by UI
                locationId: exit.targetLocationId ?? undefined,
                isLocked: exit.state === 'locked',
                isBlocked: exit.state === 'closed' || exit.state === 'locked' || exit.state === 'impassable',
                displayName: exit.blockerName ?? undefined // Added based on UIDisplayLocationPayload example
            })),
            items: items.length > 0 ? items : undefined, // Omit if empty
            entities: entities.length > 0 ? entities : undefined, // Omit if empty
            // connections: [], // Example - uncomment and populate if needed
        };

        await this.eventBus.dispatch(EVENT_DISPLAY_LOCATION, payload);
        console.debug(`Dispatched ${EVENT_DISPLAY_LOCATION} for actor ${actor.id} in location ${locationId}`);
    }

    // #getLocationExits method remains unchanged...
    #getLocationExits(locationId) {
        const exitDetails = [];
        const locationEntity = this.entityManager.getEntityInstance(locationId);
        // Correction: Get connection IDs from the ConnectionsComponent on the location entity
        const connectionsComponent = locationEntity?.getComponent(ConnectionsComponent);

        // Guard against missing location or component
        if (!connectionsComponent) {
            console.warn(`Location entity ${locationId} not found or missing ConnectionsComponent.`);
            return exitDetails; // Return empty array
        }

        // Use the component's method to get all connection {direction, connectionEntityId} pairs
        const allConnections = connectionsComponent.getAllConnections(); // Returns array [{ direction, connectionEntityId }]

        // Iterate through the connection IDs obtained from the component
        for (const {connectionEntityId} of allConnections) { // Iterate using the ID from the component's data

            const connection = this.entityManager.getEntityInstance(connectionEntityId); // Use the ID from the pair
            const passageDetails = connection?.getComponent(PassageDetailsComponent);

            if (!connection || !passageDetails) {
                console.warn(`Invalid connection entity or missing components for ID ${connectionEntityId} in location ${locationId}`);
                continue;
            }

            const direction = passageDetails.getDirectionFrom(locationId);
            if (!direction) {
                console.warn(`Could not determine direction for connection ${connectionEntityId} from location ${locationId}`);
                continue;
            }

            const targetLocationId = passageDetails.getOtherLocationId(locationId);
            const blockerEntityId = passageDetails.getBlockerId();
            const blockerEntity = blockerEntityId ? this.entityManager.getEntityInstance(blockerEntityId) : null;

            let effectivePassageState = 'open';

            if (blockerEntity) {
                const openable = blockerEntity.getComponent(OpenableComponent);
                const lockable = blockerEntity.getComponent(LockableComponent);

                if (lockable && lockable.isLocked) {
                    effectivePassageState = 'locked';
                } else if (openable && !openable.isOpen) {
                    effectivePassageState = 'closed';
                } else if (openable && openable.isOpen) {
                    effectivePassageState = 'open';
                } else {
                    effectivePassageState = 'impassable';
                    console.debug(`Blocker ${blockerEntity.id} for ${direction} is neither openable nor lockable, treating as impassable.`);
                }
            } else {
                const rawState = (passageDetails.getState?.() || '').toLowerCase();
                if (['impassable', 'collapsed', 'blocked', 'sealed'].includes(rawState)) {
                    effectivePassageState = 'impassable';
                }
            }

            const description = formatExitString(
                direction,
                passageDetails,
                blockerEntity,
                effectivePassageState
            );

            exitDetails.push({
                direction: direction,
                description: description,
                state: effectivePassageState,
                targetLocationId: targetLocationId,
                blockerName: blockerEntity ? getDisplayName(blockerEntity) : undefined
            });
        }

        const dirOrder = {north: 1, east: 2, south: 3, west: 4, up: 5, down: 6};
        exitDetails.sort((a, b) => {
            const orderA = dirOrder[a.direction.toLowerCase()] || 100;
            const orderB = dirOrder[b.direction.toLowerCase()] || 100;
            if (orderA !== orderB) return orderA - orderB;
            return a.direction.localeCompare(b.direction);
        });


        return exitDetails;
    }

    // #processLookSelf method remains unchanged...
    async #processLookSelf(actor) {
        await this.#dispatchMessage(TARGET_MESSAGES.LOOK_SELF, 'info', actor.id);
    }

    // #processLookTarget method remains unchanged...
    async #processLookTarget(actor, targetEntityId) {
        const targetEntity = this.entityManager.getEntityInstance(targetEntityId);

        if (!targetEntity) {
            console.warn(`Actor ${actor.id} tried to look at non-existent target entity ${targetEntityId}`);
            // Dispatch a message indicating the target isn't visible/found
            await this.#dispatchMessage("You don't see that here.", 'info', actor.id, targetEntityId);
            return;
        }

        const targetName = getDisplayName(targetEntity);
        // Corrected property access for DescriptionComponent
        let description = targetEntity.getComponent(DescriptionComponent)?.text;

        if (!description) {
            description = TARGET_MESSAGES.LOOK_DEFAULT_DESCRIPTION(targetName);
        }

        // TODO: Revisit if more complex description logic is needed for 'look target'
        const messageText = description;

        await this.#dispatchMessage(messageText, 'info', actor.id, targetEntityId);
    }


    // --- NEW/MODIFIED Methods for Examine ---

    /**
     * Handles the EVENT_EXAMINE_INTENDED event.
     * Retrieves the target entity, builds a detailed description (including item extras),
     * and dispatches a ui:message_display event.
     * @param {ExamineIntendedPayload} payload - The event payload.
     * @private
     */
    async #handleExamine(payload) {
        console.debug(`Received ${EVENT_EXAMINE_INTENDED}`, payload);
        const {actorId, targetEntityId} = payload;

        try {
            // Retrieve the target entity instance
            const targetEntity = this.entityManager.getEntityInstance(targetEntityId);

            // Implement entity not-found guard
            if (!targetEntity) {
                console.error(`Cannot handle examine: Target entity not found for ID ${targetEntityId} (potentially destroyed after intent).`);
                // Dispatch the user-friendly fallback message
                await this.#dispatchMessage("You cannot examine that.", 'info', actorId, targetEntityId);
                return;
            }

            // Build the detailed description using the helper method
            const descriptionText = this._buildExamineDescription(targetEntity);

            // Dispatch the result
            await this.#dispatchMessage(descriptionText, 'info', actorId, targetEntityId);

        } catch (error) {
            console.error(`Error processing ${EVENT_EXAMINE_INTENDED} for actor ${actorId} targeting ${targetEntityId}:`, error);
            // Dispatch a generic error message to the user
            await this.#dispatchMessage("An error occurred while trying to examine that.", 'error', actorId, targetEntityId);
        }
    }

    /**
     * Builds the detailed description string for an examined entity.
     * Includes base description and appends item-specific details if applicable.
     * @param {Entity} entity - The entity being examined.
     * @returns {string} The formatted description string.
     * @private
     */
    _buildExamineDescription(entity) {
        const name = getDisplayName(entity);

        // Get base description from DescriptionComponent or use default
        const descriptionComp = entity.getComponent(DescriptionComponent);
        // Corrected template literal based on ticket refinement
        let baseDesc = descriptionComp?.text ?? `You see nothing special about the ${name}.`;

        // Check for ItemComponent and build details string
        const itemComp = entity.getComponent(ItemComponent);
        let itemDetails = []; // Array to hold detail strings like "Quantity: 2", "Weight: 5"

        if (itemComp) {
            // Add Quantity if stackable and more than 1
            if (itemComp.quantity > 1) {
                itemDetails.push(`Quantity: ${itemComp.quantity}`);
            }
            // Add Weight (display based on ticket spec - can refine later e.g., only if > 0)
            itemDetails.push(`Weight: ${itemComp.weight}`);

            // Future enhancements: Add more details here (e.g., condition, value)
            // if (itemComp.condition) itemDetails.push(`Condition: ${itemComp.condition}`);
        }

        // Combine base description with item details (if any)
        let fullDescription = baseDesc;
        if (itemDetails.length > 0) {
            // Join details with ", " and wrap in parentheses on a new line for clarity
            fullDescription += `\n(${itemDetails.join(', ')})`;
        }

        return fullDescription;
    }

    // --- End NEW/MODIFIED Methods ---


    /**
     * Helper to dispatch a UI message event.
     * @param {string} text - The message text.
     * @param {'info' | 'warning' | 'error' | 'success' | 'combat' | 'combat_hit' | 'combat_critical' | 'sound' | 'prompt' | 'internal' | 'debug'} type - The message type. // Added types from eventTypes.js
     * @param {string} [actorId] - Optional actor ID for logging context.
     * @param {string} [targetId] - Optional target ID for logging context.
     * @private
     */
    async #dispatchMessage(text, type = 'info', actorId = 'N/A', targetId = 'N/A') {
        /** @type {UIMessageDisplayPayload} */
        const payload = {text, type};
        await this.eventBus.dispatch(EVENT_DISPLAY_MESSAGE, payload);
        // Use logger instance for consistency
        console.debug(`Dispatched ${EVENT_DISPLAY_MESSAGE} (Actor: ${actorId}, Target: ${targetId}): "${text}"`);
    }


    /**
     * Placeholder for potential future shutdown logic (e.g., unsubscribing).
     */
    shutdown() {
        // Unsubscribe from events if any were added in initialize()
        // Check if unsubscribe method exists before calling
        if (this.eventBus && typeof this.eventBus.unsubscribe === 'function') {
            // Use the bound method references stored if needed, or re-bind:
            this.eventBus.unsubscribe(EVENT_LOOK_INTENDED, this.#handleLook.bind(this));
            this.eventBus.unsubscribe(EVENT_EXAMINE_INTENDED, this.#handleExamine.bind(this));
            console.info("PerceptionSystem shutdown and unsubscribed from events.");
        } else {
            console.info("PerceptionSystem shutdown.");
        }
    }
}

export default PerceptionSystem;