// src/core/appContainer.js
// ****** CORRECTED FILE ******

/**
 * @typedef {'singleton' | 'transient' | 'singletonFactory'} Lifecycle // Added 'singletonFactory' here for documentation clarity
 */

/**
 * @typedef {object} RegistrationOptions
 * @property {Lifecycle} [lifecycle='singleton'] - How the instance should be managed.
 * @property {string[]} [dependencies=[]] - Optional: Explicit dependencies (keys) for documentation or future validation. Not strictly enforced by resolve().
 */

/**
 * @callback FactoryFunction
 * @param {AppContainer} container - The container instance, to resolve dependencies.
 * @returns {any} The created service instance.
 */

/**
 * A lightweight Dependency Injection (DI) container.
 * Manages instantiation and lifecycle of registered services/systems.
 *
 * @implements {import('../interfaces/container.js').IServiceResolver}
 */
class AppContainer {
    /** @type {Map<string, { factory: FactoryFunction, options: RegistrationOptions & { tags?: string[] } }>} */
    #registrations = new Map();
    /** @type {Map<string, any>} */
    #instances = new Map(); // Stores singleton instances

    /**
     * Registers a service/system with the container.
     * @param {string} key - A unique identifier for the service.
     * @param {FactoryFunction} factory - A function that creates an instance of the service. It receives the container itself to resolve dependencies.
     * @param {RegistrationOptions & { tags?: string[] }} [options={ lifecycle: 'singleton' }] - Registration options (e.g., lifecycle, tags).
     */
    register(key, factory, options = {lifecycle: 'singleton'}) {
        if (this.#registrations.has(key)) {
            console.warn(`AppContainer: Service key "${key}" is already registered. Overwriting.`);
        }
        // Ensure tags are an array if provided, log correctly
        const lifecycle = options.lifecycle || 'singleton';
        const tagsInfo = Array.isArray(options.tags) && options.tags.length > 0 ? ` Tags: [${options.tags.join(', ')}]` : '';
        console.log(`AppContainer: Registering "${key}" (Lifecycle: ${lifecycle})${tagsInfo}`);
        this.#registrations.set(key, {factory, options});
    }

    /**
     * Resolves (retrieves or creates) an instance of a registered service.
     * @template T
     * @param {string} key - The unique identifier of the service to resolve.
     * @returns {T} The resolved service instance.
     * @throws {Error} If the key is not registered or creation fails.
     */
    resolve(key) {
        const registration = this.#registrations.get(key);
        if (!registration) {
            throw new Error(`AppContainer: No service registered for key "${key}".`);
        }

        const {factory, options} = registration;
        const lifecycle = options.lifecycle || 'singleton'; // Default to singleton

        // --- VVVVVV MODIFIED SECTION VVVVVV ---
        // Treat 'singleton' and 'singletonFactory' the same way: create once, cache.
        if (lifecycle === 'singleton' || lifecycle === 'singletonFactory') {
            if (!this.#instances.has(key)) {
                // Log slightly differently just for debugging clarity if needed
                const instanceType = lifecycle === 'singletonFactory' ? 'singleton (from factory)' : 'singleton';
                console.debug(`AppContainer: Creating ${instanceType} instance for "${key}"...`);
                try {
                    // Pass container to factory when creating instance
                    const instance = factory(this);
                    this.#instances.set(key, instance);
                    console.debug(`AppContainer: ${instanceType} instance for "${key}" created.`);
                } catch (error) {
                    console.error(`AppContainer: Error creating ${instanceType} instance for "${key}":`, error);
                    // Ensure the original error's context isn't lost
                    throw new Error(`Failed to create instance for "${key}" (lifecycle: ${lifecycle}): ${error.message}`, {cause: error});
                }
            }
            return this.#instances.get(key);
        } else if (lifecycle === 'transient') {
            // --- ^^^^^^ MODIFIED SECTION ^^^^^^ ---
            console.debug(`AppContainer: Creating transient instance for "${key}"...`);
            try {
                // Pass container to factory when creating instance
                const instance = factory(this);
                console.debug(`AppContainer: Transient instance for "${key}" created.`);
                return instance;
            } catch (error) {
                console.error(`AppContainer: Error creating transient instance for "${key}":`, error);
                // Ensure the original error's context isn't lost
                throw new Error(`Failed to create instance for "${key}" (lifecycle: ${lifecycle}): ${error.message}`, {cause: error});
            }
        } else {
            // This should now only catch genuinely unknown lifecycle strings
            throw new Error(`AppContainer: Unknown lifecycle "${lifecycle}" for key "${key}".`);
        }
    }

    /**
     * Resolves all registered services that have the specified tag.
     * Assumes synchronous factory functions based on the current resolve() implementation.
     * This method aligns with the IServiceResolver interface.
     * @template T
     * @param {string} tag - The tag to search for. Cannot be null or empty per IServiceResolver contract.
     * @returns {Array<T>} An array of resolved service instances associated with the tag. Returns an empty array `[]` if no matching services are found.
     */
    resolveByTag(tag) {
        const resolvedInstances = [];
        console.debug(`AppContainer: Resolving instances by tag "${tag}"...`);

        for (const [key, registration] of this.#registrations.entries()) {
            if (registration.options && Array.isArray(registration.options.tags) && registration.options.tags.includes(tag)) {
                console.debug(`AppContainer: Found tag "${tag}" on registration "${key}". Resolving...`);
                try {
                    const instance = this.resolve(key); // Handles singleton/transient/singletonFactory correctly now
                    resolvedInstances.push(instance);
                } catch (error) {
                    console.error(`AppContainer: Error resolving tagged instance "${key}" for tag "${tag}":`, error);
                    // Continue trying to resolve others
                }
            }
        }

        console.debug(`AppContainer: Found ${resolvedInstances.length} instances for tag "${tag}".`);
        return resolvedInstances;
    }


    /**
     * Clears all registered singleton instances. Useful for testing or full resets.
     */
    disposeSingletons() {
        console.log('AppContainer: Disposing singleton instances...');
        this.#instances.clear();
    }

    /**
     * Clears all registrations and instances. Use with caution.
     */
    reset() {
        console.log('AppContainer: Resetting container (registrations and instances)...');
        this.#registrations.clear();
        this.#instances.clear();
    }
}

export default AppContainer;