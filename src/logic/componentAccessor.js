// src/logic/componentAccessor.js

/** @typedef {import('../entities/entityManager.js').default} EntityManager */
/** @typedef {import('../interfaces/coreServices.js').ILogger} ILogger */

/**
 * Creates a proxy-like object to dynamically access component data for a given entity.
 * When a property (componentTypeId) is accessed on this object, it uses the
 * EntityManager to fetch the actual component data. Returns null if the component
 * does not exist on the entity.
 *
 * Note: This uses dynamic property definition with getters to simulate the
 * dynamic lookup described in the JsonLogicEntityContext JSDoc without needing
 * a full ES6 Proxy (which might be overkill or have compatibility concerns).
 * JSON Logic typically accesses specific, known properties, making this approach viable.
 *
 * @param {string | number} entityId - The ID of the entity whose components are accessed.
 * @param {EntityManager} entityManager - The EntityManager instance to use for data fetching.
 * @param {ILogger} logger - Logger instance for diagnostics.
 * @returns {Object<string, object|null>} An object that allows dynamic fetching of component data.
 */
export function createComponentAccessor(entityId, entityManager, logger) {
  // *** Revised Approach: Use a Proxy for true dynamic access ***
  return new Proxy(
    {},
    {
      // --- GET Trap (Correct logic + Optional Logging) ---
      get: function (target, prop, receiver) {
        // <<<--- ADD TEMPORARY LOGGING HERE --->>>
        // console.log(`!!! ComponentAccessor GET Trap: EntityID=${entityId}, Prop=${String(prop)}`);
        // <<<------------------------------------>>>
        if (typeof prop === 'string') {
          if (
            prop === 'isProxy' ||
            prop === 'then' ||
            typeof prop === 'symbol'
          ) {
            // console.log(`!!! ComponentAccessor GET Trap: Skipping special prop ${String(prop)}`);
            return undefined;
          }
          // logger.debug(`ComponentAccessor: GET trap for prop [${String(prop)}] on entity [${entityId}]`); // Can be noisy
          try {
            // <<<--- ADD TEMPORARY LOGGING HERE --->>>
            // console.log(`!!! ComponentAccessor GET Trap: Calling getComponentData(${entityId}, ${String(prop)})`);
            // <<<------------------------------------>>>
            const componentData = entityManager.getComponentData(
              entityId,
              prop
            );
            // console.log(`!!! ComponentAccessor GET Trap: Data for ${String(prop)}:`, componentData); // Be careful logging potentially large objects
            return componentData ?? null; // Return data or null
          } catch (error) {
            logger.error(
              `ComponentAccessor: Error fetching component [${String(prop)}] for entity [${entityId}]:`,
              error
            );
            return null;
          }
        }
        // console.log(`!!! ComponentAccessor GET Trap: Reflect.get for non-string prop ${String(prop)}`);
        return Reflect.get(target, prop, receiver);
      },

      set: function (target, prop, value) {
        // (Your existing set trap is fine)
        logger.warn(
          `ComponentAccessor: Attempted to set property [${String(prop)}] on read-only accessor for entity [${entityId}]. Operation ignored.`
        );
        return false;
      },

      // --- HAS Trap (Corrected Logic) ---
      has: function (target, prop) {
        if (typeof prop === 'string') {
          // --- Correct logic for 'has' trap ---
          // logger.debug(`ComponentAccessor: HAS trap for prop [${String(prop)}] on entity [${entityId}]`); // Can be noisy
          try {
            // Check existence using the correct EntityManager method
            const exists = entityManager.hasComponent(entityId, prop);
            // logger.debug(`ComponentAccessor: Existence check for [${String(prop)}]: ${exists}`); // Can be noisy
            return exists; // Return boolean
          } catch (error) {
            logger.error(
              `ComponentAccessor: Error checking component existence [${String(prop)}] for entity [${entityId}]:`,
              error
            );
            return false; // Return false on error
          }
        }
        // Fallback for non-string properties
        return Reflect.has(target, prop);
      },

      // --- OWNKEYS Trap (Existing logic is likely okay) ---
      ownKeys: function (target) {
        // logger.debug(`ComponentAccessor: ownKeys trap invoked for entity [${entityId}]. Returning empty array.`); // Can be noisy
        return []; // Returning empty is often safest unless full enumeration is needed
      },

      // --- GETOWNPROPERTYDESCRIPTOR Trap (Relies on the now-fixed 'has' trap) ---
      getOwnPropertyDescriptor: function (target, prop) {
        // Now that 'this.has' is fixed, this *might* work correctly.
        // It attempts to create a descriptor if the component exists.
        // Note: Directly calling 'has' might cause issues in strict environments, use Reflect.has if needed
        const exists = Reflect.has(this, prop); // Safer way to call the trap internally

        if (typeof prop === 'string' && exists) {
          // Use the result of the 'has' trap
          // logger.debug(`ComponentAccessor: getOwnPropertyDescriptor trap for existing prop [${String(prop)}]`); // Can be noisy
          return {
            // Using 'get' trap ensures consistency if data fetching is complex
            // Note: Using 'this.get' might also be problematic, use Reflect.get
            get: () => Reflect.get(this, prop, null), // Safer way to call the trap
            set: undefined, // Read-only
            enumerable: true, // Important for introspection
            configurable: true, // Usually true for proxy properties
          };
        }
        // logger.debug(`ComponentAccessor: getOwnPropertyDescriptor trap for non-string or non-existent prop [${String(prop)}]`); // Can be noisy
        // Fallback for non-string or non-existent properties
        return Reflect.getOwnPropertyDescriptor(target, prop);
      },
    }
  );
}
