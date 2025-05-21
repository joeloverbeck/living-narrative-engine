// src/core/config/registrarHelpers.js
// ****** CORRECTED FILE ******

/**
 * @fileoverview Helper functions and classes to simplify DI container registration.
 */

/** @typedef {import('./appContainer.js').default} AppContainer */
/** @typedef {import('./tokens.js').DiToken} DiToken */
/** @typedef {import('./appContainer.js').FactoryFunction} FactoryFunction */
/** @typedef {{ lifecycle?: 'singletonFactory' | 'singleton' | 'transient', tags?: string[], dependencies?: DiToken[] }} RegistrationOptions */ // Added dependencies
/** @typedef {(...args: any[]) => any} ConstructorAny */

/** @template T @typedef {new (...args: any[]) => T} Constructor<T> */

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
        if (!container || typeof container.register !== 'function') {
            throw new Error('Registrar requires a valid AppContainer instance.');
        }
        this.#container = container;
    }

    /**
     * Registers a dependency with the container using the provided token, value/class/factory, and options.
     * Applies any pending tags set by `.tagged()`.
     * This is the base method called by helpers like .single(), .instance(), etc.
     *
     * @template T
     * @param {DiToken} token - The key to register the dependency under.
     * @param {FactoryFunction | Constructor<T> | T} factoryOrValueOrClass - The factory, class, or value to register.
     * @param {RegistrationOptions} [options={}] - Registration options (e.g., lifecycle, dependencies, tags).
     * @returns {this} The Registrar instance for chaining.
     */
    register(token, factoryOrValueOrClass, options = {}) {
        // *** FIX: Removed the incorrect wrapping of values into factories ***
        // let factoryFn = factoryOrValue;
        // if (typeof factoryOrValue !== 'function') {
        //     const value = factoryOrValue;
        //     factoryFn = () => value; // NO LONGER WRAPPING VALUES
        // }

        const registrationOptions = {...options};
        if (this.#tags) {
            registrationOptions.tags = [...(registrationOptions.tags || []), ...this.#tags];
        }

        // Perform the actual registration on the container, passing the
        // factory/value/class directly as received by this method.
        // The container itself (or the mock resolveSpy) is responsible for handling it.
        this.#container.register(token, factoryOrValueOrClass, registrationOptions);

        this.#tags = null; // Reset tags after registration is done
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
     * Passes the constructor and dependency tokens directly to the container.
     * Assumes the container (or mock resolveSpy) knows how to handle
     * dependency injection for class constructors when `dependencies` option is present.
     *
     * @template T
     * @param {DiToken} token - The key to register the dependency under.
     * @param {Constructor<T>} Ctor - The class constructor.
     * @param {DiToken[]} [deps=[]] - An array of dependency tokens for the constructor.
     * @returns {this} The Registrar instance for chaining.
     */
    single(token, Ctor, deps = []) {
        // *** FIX: Pass the Constructor (Ctor) directly, not a generated factory ***
        // const factory = _createFactoryForObjectInjection(Ctor, deps); // Don't create factory here
        this.register(token, Ctor, { // Pass Ctor
            lifecycle: 'singleton',
            dependencies: deps // Pass dependencies in options for the container/resolver
        });
        return this;
    }

    /**
     * Registers a pre-existing instance as a singleton.
     * Passes the instance value directly to the container.
     *
     * @template T
     * @param {DiToken} token - The key to register the instance under.
     * @param {T} instance - The instance to register.
     * @returns {this} The Registrar instance for chaining.
     */
    instance(token, instance) {
        // *** FIX: Pass the instance directly, not a factory that returns it ***
        // const factoryFn = () => instance;
        this.register(token, instance, { // Pass instance
            lifecycle: 'singleton'
        });
        return this;
    }

    /**
     * Registers a factory function as a singleton.
     * Use this when instantiation logic is complex or needs the container.
     * The factory is called once by the container/resolver and the result is cached.
     *
     * @template T
     * @param {DiToken} token - The key to register the dependency under.
     * @param {FactoryFunction} factoryFn - The factory function (takes container `c`/`resolver` as arg).
     * @returns {this} The Registrar instance for chaining.
     */
    singletonFactory(token, factoryFn) {
        if (typeof factoryFn !== 'function') {
            throw new Error(`Registrar.singletonFactory requires a function for token "${String(token)}", but received type ${typeof factoryFn}`);
        }
        // This was likely correct already - passes the factory function directly.
        this.register(token, factoryFn, {lifecycle: 'singletonFactory'});
        return this;
    }

    /**
     * Registers a class constructor for transient lifecycle.
     * A new instance is created each time it's resolved by the container/resolver.
     * Passes the constructor and dependency tokens directly to the container.
     *
     * @template T
     * @param {DiToken} token - The key to register the dependency under.
     * @param {Constructor<T>} Ctor - The class constructor.
     * @param {DiToken[]} [deps=[]] - An array of dependency tokens for the constructor.
     * @returns {this} The Registrar instance for chaining.
     */
    transient(token, Ctor, deps = []) {
        // *** FIX: Pass the Constructor (Ctor) directly ***
        // const factory = _createFactoryForObjectInjection(Ctor, deps);
        this.register(token, Ctor, { // Pass Ctor
            lifecycle: 'transient',
            dependencies: deps // Pass dependencies in options
        });
        return this;
    }

    /**
     * Registers a factory function for transient lifecycle.
     * A new instance is created via the factory each time it's resolved by the container/resolver.
     *
     * @template T
     * @param {DiToken} token - The key to register the dependency under.
     * @param {FactoryFunction} factoryFn - The factory function (takes container `c`/`resolver` as arg).
     * @returns {this} The Registrar instance for chaining.
     */
    transientFactory(token, factoryFn) {
        if (typeof factoryFn !== 'function') {
            throw new Error(`Registrar.transientFactory requires a function for token "${String(token)}", but received type ${typeof factoryFn}`);
        }
        // This was likely correct already.
        this.register(token, factoryFn, {lifecycle: 'transient'});
        return this;
    }
}