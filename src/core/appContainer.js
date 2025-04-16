// src/core/appContainer.js

/**
 * @typedef {'singleton' | 'transient'} Lifecycle
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
 */
class AppContainer {
    /** @type {Map<string, { factory: FactoryFunction, options: RegistrationOptions }>} */
    #registrations = new Map();
    /** @type {Map<string, any>} */
    #instances = new Map(); // Stores singleton instances

    /**
     * Registers a service/system with the container.
     * @param {string} key - A unique identifier for the service.
     * @param {FactoryFunction} factory - A function that creates an instance of the service. It receives the container itself to resolve dependencies.
     * @param {RegistrationOptions} [options={ lifecycle: 'singleton' }] - Registration options (e.g., lifecycle).
     */
    register(key, factory, options = { lifecycle: 'singleton' }) {
        if (this.#registrations.has(key)) {
            console.warn(`AppContainer: Service key "${key}" is already registered. Overwriting.`);
        }
        console.log(`AppContainer: Registering "${key}" (Lifecycle: ${options.lifecycle || 'singleton'})`);
        this.#registrations.set(key, { factory, options });
    }

    /**
     * Resolves (retrieves or creates) an instance of a registered service.
     * @template T
     * @param {string} key - The unique identifier of the service to resolve.
     * @returns {T} The resolved service instance.
     * @throws {Error} If the key is not registered.
     */
    resolve(key) {
        const registration = this.#registrations.get(key);
        if (!registration) {
            throw new Error(`AppContainer: No service registered for key "${key}".`);
        }

        const { factory, options } = registration;
        const lifecycle = options.lifecycle || 'singleton';

        if (lifecycle === 'singleton') {
            if (!this.#instances.has(key)) {
                console.debug(`AppContainer: Creating singleton instance for "${key}"...`);
                try {
                    const instance = factory(this); // Pass container to factory
                    this.#instances.set(key, instance);
                    console.debug(`AppContainer: Singleton instance for "${key}" created.`);
                } catch (error) {
                    console.error(`AppContainer: Error creating singleton instance for "${key}":`, error);
                    // Propagate the error to make initialization failures clear
                    throw new Error(`Failed to create instance for "${key}": ${error.message}`);
                }
            }
            return this.#instances.get(key);
        } else if (lifecycle === 'transient') {
            console.debug(`AppContainer: Creating transient instance for "${key}"...`);
            try {
                const instance = factory(this); // Pass container to factory
                console.debug(`AppContainer: Transient instance for "${key}" created.`);
                return instance;
            } catch (error) {
                console.error(`AppContainer: Error creating transient instance for "${key}":`, error);
                // Propagate the error
                throw new Error(`Failed to create instance for "${key}": ${error.message}`);
            }
        } else {
            throw new Error(`AppContainer: Unknown lifecycle "${lifecycle}" for key "${key}".`);
        }
    }

    /**
     * Clears all registered singleton instances. Useful for testing or full resets.
     */
    disposeSingletons() {
        console.log("AppContainer: Disposing singleton instances...");
        this.#instances.clear();
    }

    /**
     * Clears all registrations and instances. Use with caution.
     */
    reset() {
        console.log("AppContainer: Resetting container (registrations and instances)...");
        this.#registrations.clear();
        this.#instances.clear();
    }
}

export default AppContainer;