import {expect} from "@jest/globals";
import {NameComponent} from "../components/nameComponent.js";
import {PositionComponent} from "../components/positionComponent.js";

/**
 * Waits for a specific event to be dispatched via a Jest spy.
 * Returns the payload of the first matching event call found.
 *
 * @param {jest.SpyInstance} spy - The Jest spy instance spying on the dispatch method.
 * @param {string} eventName - The name of the event to wait for.
 * @param {any} payloadMatcher - An expect matcher (e.g., objectContaining, exact object, any()) or a value to match the payload against using expect().toEqual().
 * @param {number} [timeout=1000] - Maximum time to wait in milliseconds.
 * @returns {Promise<any>} A Promise that resolves with the captured payload of the matching event.
 * @throws {Error} If the event is not found with a matching payload within the timeout period.
 */
export async function waitForEvent(spy, eventName, payloadMatcher, timeout = 1000) {
    const start = Date.now();
    let lastError = null;

    while (Date.now() - start < timeout) {
        // Find all calls matching the event name *since the spy was last cleared*
        const callsWithName = spy.mock.calls.filter(call => call[0] === eventName);

        for (const call of callsWithName) {
            const [, payload] = call; // Get the payload from this call
            try {
                // Use expect().toEqual() for the comparison. This works well with
                // expect.objectContaining(), expect.any(), or exact values passed in payloadMatcher.
                expect(payload).toEqual(payloadMatcher);
                // Match found! Return this payload.
                return payload;
            } catch (matchError) {
                // This specific payload didn't match the criteria.
                lastError = matchError; // Store the last mismatch error for better reporting on timeout
                // Continue checking other calls (if any).
            }
        }

        // If no matching call was found yet, wait a bit before checking again.
        await new Promise(resolve => setTimeout(resolve, 50)); // Check roughly 20 times/sec
    }

    // If loop finishes, timeout occurred.
    console.error(`waitForEvent: Timed out waiting for event "${eventName}". Last payload mismatch error:`, lastError?.message);
    console.error(`waitForEvent: Payloads received for "${eventName}" during wait:`,
        spy.mock.calls.filter(call => call[0] === eventName).map(call => call[1]) // Log payloads received
    );
    throw new Error(`Timed out waiting for event "${eventName}" with matching payload after ${timeout}ms`);
}

// Helper to create and register entities
export const setupEntity = (entityManager, id, name, components = [], locationId = 'test_location') => {
    const entity = entityManager.createEntityInstance(id);

    if (!entity) {
        console.error(`Failed to create or retrieve entity instance for ${id} in setupEntity`);
        throw new Error(`Entity instance creation failed for ${id}`);
    }

    // Add/Update Name Component
    if (!entity.hasComponent(NameComponent)) {
        entity.addComponent(new NameComponent({ value: name }));
    } else {
        entity.getComponent(NameComponent).value = name; // Update if exists
    }


    // --- Refined Position Component Handling & Index Notification ---
    let oldLocationId = null;
    const existingPosComp = entity.getComponent(PositionComponent);

    if (existingPosComp) {
        oldLocationId = existingPosComp.locationId; // Get current location before potentially changing it
        console.log(`setupEntity: Entity ${id} already has PositionComponent. Old Location: ${oldLocationId}`); // Optional Log
    }

    // Add or Update Position Component
    if (!existingPosComp) {
        console.log(`setupEntity: Adding new PositionComponent to ${id} with location ${locationId}`); // Optional Log
        entity.addComponent(new PositionComponent({ locationId: locationId }));
    } else if (existingPosComp.locationId !== locationId) {
        // Only update if the location is actually different
        console.log(`setupEntity: Updating existing PositionComponent on ${id} from ${oldLocationId} to ${locationId}`); // Optional Log
        existingPosComp.locationId = locationId;
    } else {
        // Location is already correct, no component update needed
        console.log(`setupEntity: PositionComponent on ${id} already has correct location ${locationId}.`); // Optional Log
    }

    // Notify AFTER the component state is correct
    // Only notify if the location actually changed or was newly set
    if (oldLocationId !== locationId) {
        console.log(`setupEntity: Notifying position change for ${id}: ${oldLocationId} -> ${locationId}`); // Log the notification
        entityManager.notifyPositionChange(id, oldLocationId, locationId);
    }
    // --- End Refined Handling ---


    // Add other components passed in the array
    components.forEach(comp => {
        const compKey = comp.constructor?.name || typeof comp;
        if (!entity.hasComponent(comp.constructor)) { // Check using constructor
            entity.addComponent(comp);
        } else {
            // console.warn(`setupEntity: Component ${compKey} already exists on ${id}. Skipping add.`);
            // Optionally update existing component data here if needed
        }
    });

    return entity;
};
