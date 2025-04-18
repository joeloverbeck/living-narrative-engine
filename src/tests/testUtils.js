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
export const setupEntity = (entityManager, id, name, components = [], locationId = null) => { // Keep locationId default or adjust as needed
    console.log(`>>> setupEntity called for ID: ${id}. Received locationId: ${locationId}`);
    // Get or create the entity instance. createEntityInstance handles definitions & default components.
    const entity = entityManager.createEntityInstance(id); // Assuming forceNew=false default

    if (!entity) {
        console.error(`Failed to create or retrieve entity instance for ${id} in setupEntity`);
        throw new Error(`Entity instance creation failed for ${id}`);
    }

    // --- Name Component Handling (Seems OK) ---
    if (!entity.hasComponent(NameComponent)) {
        entity.addComponent(new NameComponent({value: name}));
    } else {
        entity.getComponent(NameComponent).value = name; // Update if exists
    }

    // --- Position Component Handling (Revised) ---
    const existingPosComp = entity.getComponent(PositionComponent);
    const oldLocationId = existingPosComp?.locationId ?? null;

    console.log(`>>> Position check for ${id}. locationId !== null is ${locationId !== null}. Has existingPosComp: ${!!existingPosComp}`);

    if (locationId !== null) { // Only add/update if a non-null locationId is intended
        if (!existingPosComp) {
            // Add position component only if locationId is not null
            entity.addComponent(new PositionComponent({locationId: locationId}));
            entityManager.notifyPositionChange(id, null, locationId); // Notify addition
        } else if (existingPosComp.locationId !== locationId) {
            // Update existing component's locationId
            existingPosComp.locationId = locationId;
            entityManager.notifyPositionChange(id, oldLocationId, locationId); // Notify update
        }
        // If locationId matches existing, do nothing regarding position
        console.log(`>>> INSIDE locationId !== null block for ${id}`);
    } else {
        console.log(`>>> INSIDE locationId === null block for ${id}`);
        // If locationId is null, ensure no position component exists or remove it
        // (Though typically you wouldn't remove one added by definition this way)
        // For this test's purpose, if locationId is null, we simply *don't add* one.
        // If the definition *had* one, the test setup might need refinement.
    }

    // --- Component Handling from Array (Needs Correction) ---
    components.forEach(compInstance => {
        const ComponentClass = compInstance?.constructor;
        if (!ComponentClass || typeof ComponentClass !== 'function' || !compInstance instanceof ComponentClass) {
            console.warn(`setupEntity: Skipping component as it doesn't seem to be a class instance:`, compInstance);
            return;
        }

        // *** CORE FIX ***
        // Always add/replace the component provided in the test setup array.
        // This ensures the test's explicit components overwrite any defaults added by createEntityInstance.
        // Assuming entity.addComponent handles replacement if the component type exists.
        // If addComponent does NOT replace, you would need:
        // if (entity.hasComponent(ComponentClass)) {
        //     entity.removeComponent(ComponentClass); // Requires removeComponent method
        // }
        entity.addComponent(compInstance);
        // *** END CORE FIX ***

    });

    return entity;
};
