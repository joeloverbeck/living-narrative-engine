// src/core/dependencyInjection/registrarHelpers.js

/**
 * @fileoverview Helper functions and classes to simplify DI container registration.
 */

/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../tokens.js').DiToken} DiToken */

// --- Using your container's types ---
/** @typedef {import('../appContainer.js').FactoryFunction} FactoryFunction */
/** @typedef {import('../appContainer.js').RegistrationOptions} RegistrationOptions */ // Assuming this type *could* include 'tags'

/** @typedef {(...args: any[]) => any} Constructor */


/**
 * Creates a factory function suitable for your AppContainer registration
 * that instantiates a class (`Ctor`) resolving its dependencies from the container.
 *
 * @template T
 * @param {Constructor<T>} Ctor - The class constructor to instantiate.
 * @param {DiToken[]} [deps=[]] - An array of dependency tokens to resolve from the container.
 * @returns {FactoryFunction} A factory function that resolves dependencies and calls the constructor.
 */
export const asSingleton = (Ctor, deps = []) => c => new Ctor(...deps.map(k => c.resolve(k)));

/**
 * Provides a fluent interface for registering services with the DI container,
 * simplifying common patterns like singletons and tagging.
 */
export class Registrar {
    /** @type {AppContainer} */
    #container;
    /** @type {string[] | null} */
    #tags = null;

    /**
     * @param {AppContainer} container - The DI container instance.
     */
    constructor(container) {
        this.#container = container;
    }

    /**
     * Registers a dependency with the container using the provided token, factory, and options.
     * Applies any pending tags set by `.tagged()`.
     *
     * @template T
     * @param {DiToken} token - The key to register the dependency under.
     * @param {FactoryFunction | any} factoryOrValue - The factory function or value (will be wrapped if not function in helpers).
     * @param {RegistrationOptions} [options={}] - Registration options (e.g., lifecycle).
     * @returns {this} The Registrar instance for chaining.
     */
    register(token, factoryOrValue, options = {}) {
        // Note: The base register should expect a factory. Helpers adapt values.
        if (typeof factoryOrValue !== 'function') {
            console.warn(`Registrar.register called directly with non-function for token "${String(token)}". Wrapping, but prefer using helpers like .instance() or .singletonFactory().`);
            const value = factoryOrValue;
            factoryOrValue = () => value;
        }

        const registrationOptions = {...options};
        if (this.#tags) {
            // *** FIX HERE: Uncomment this line ***
            // Add the pending tags to the options object. Create 'tags' array if it doesn't exist.
            registrationOptions.tags = [...(registrationOptions.tags || []), ...this.#tags];
            // Optional: Remove the warning if tags are now intended to be supported
            // console.warn('Registrar: Tagging functionality used, but AppContainer may not support it.');
        }

        // Now registrationOptions includes both lifecycle and tags (if any were pending)
        this.#container.register(token, /** @type {FactoryFunction} */ (factoryOrValue), registrationOptions);
        this.#tags = null; // Reset tags after registration
        return this;
    }

    /**
     * Specifies tags to be added to the *next* registration.
     * @param {string | string[]} tagOrTags - A single tag or an array of tags.
     * @returns {this} The Registrar instance for chaining.
     */
    tagged(tagOrTags) {
        this.#tags = Array.isArray(tagOrTags) ? [...tagOrTags] : [tagOrTags];
        return this;
    }

    /**
     * Registers a class constructor as a singleton.
     * Automatically resolves constructor dependencies based on the provided tokens.
     *
     * @template T
     * @param {DiToken} token - The key to register the dependency under.
     * @param {Constructor<T>} Ctor - The class constructor.
     * @param {DiToken[]} [deps=[]] - An array of dependency tokens for the constructor.
     * @returns {this} The Registrar instance for chaining.
     */
    single(token, Ctor, deps = []) {
        const factory = asSingleton(Ctor, deps);
        this.singletonFactory(token, factory);
        return this;
    }

    /**
     * Registers a pre-existing instance as a singleton.
     *
     * @template T
     * @param {DiToken} token - The key to register the instance under.
     * @param {T} instance - The instance to register.
     * @returns {this} The Registrar instance for chaining.
     */
    instance(token, instance) {
        const factoryFn = () => instance;
        // Pass the tags along if instance() is called after tagged()
        this.register(token, factoryFn, {lifecycle: 'singleton'});
        return this;
    }

    /**
     * Registers a factory function as a singleton.
     * Use this when instantiation logic is more complex than just `new Ctor(...deps)`.
     *
     * @template T
     * @param {DiToken} token - The key to register the dependency under.
     * @param {FactoryFunction} factoryFn - The factory function (takes container `c` as arg).
     * @returns {this} The Registrar instance for chaining.
     */
    singletonFactory(token, factoryFn) {
        if (typeof factoryFn !== 'function') {
            throw new Error(`Registrar.singletonFactory requires a function for token "${String(token)}", but received type ${typeof factoryFn}`);
        }
        // Pass the tags along if singletonFactory() is called after tagged()
        this.register(token, factoryFn, {lifecycle: 'singleton'});
        return this;
    }
}