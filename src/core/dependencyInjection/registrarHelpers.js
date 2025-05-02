// src/core/dependencyInjection/registrarHelpers.js
// ****** CORRECTED FILE ******

/**
 * @fileoverview Helper functions and classes to simplify DI container registration.
 */

/** @typedef {import('../config/appContainer.js').default} AppContainer */
/** @typedef {import('../config/tokens.js').DiToken} DiToken */

// --- Using your container's types ---
/** @typedef {import('../config/appContainer.js').FactoryFunction} FactoryFunction */
// Assuming RegistrationOptions might include 'tags' based on your comment
/** @typedef {{ lifecycle?: 'singletonFactory' | 'singleton' | 'transient', tags?: string[] }} RegistrationOptions */ // Added singletonFactory lifecycle

/** @typedef {(...args: any[]) => any} ConstructorAny */
/** @template T @typedef {new (...args: any[]) => T} Constructor<T> */


/**
 * INTERNAL helper function (not exported directly).
 * Creates a factory function suitable for AppContainer registration
 * that instantiates a class (`Ctor`) resolving its dependencies into a *single object map*
 * and injecting that map as the only argument to the constructor.
 *
 * @template T
 * @param {Constructor<T>} Ctor - The class constructor to instantiate.
 * @param {DiToken[]} [deps=[]] - An array of dependency tokens to resolve from the container.
 * @returns {FactoryFunction} A factory function that resolves dependencies into an object and calls the constructor.
 */
const _createFactoryForObjectInjection = (Ctor, deps = []) => {
    // Ensure Ctor is actually a function (potential constructor)
    if (typeof Ctor !== 'function') {
        console.error(`[_createFactoryForObjectInjection] Error: TargetClass provided is not a function. Value:`, Ctor);
        throw new Error(`Invalid registration attempt: TargetClass must be a constructor function.`);
    }

    /**
     * @param {AppContainer} resolver The container instance.
     * @returns {T} Instance of Ctor
     */
    const factoryFn = (resolver) => {
        const dependenciesMap = {};
        const targetClassName = Ctor.name || '[AnonymousClass]'; // Get class name for logging

        deps.forEach((token, index) => {
            let propName = '';

            // --- Dependency Property Name Derivation Logic ---
            if (typeof token === 'string') {
                propName = token; // Start with the original token name (e.g., "ILogger", "GameStateManager")

                // Apply naming convention:
                // 1. If it starts with 'I' followed by an uppercase letter (like "ILogger"), remove 'I'.
                // 2. Then, lowercase the first letter of the result.
                if (propName.length > 1 && propName.startsWith('I') && propName[1] === propName[1].toUpperCase()) {
                    // Remove the leading 'I' -> e.g., "Logger"
                    propName = propName.substring(1);
                }
                // Lowercase the first letter of the (potentially modified) string
                // e.g., "Logger" -> "logger", "GameStateManager" -> "gameStateManager"
                propName = propName.charAt(0).toLowerCase() + propName.slice(1);

            } else if (typeof token === 'symbol') {
                // Existing logic for symbols seems to match the desired convention already
                propName = Symbol.keyFor(token); // Get the symbol description (e.g., "ILogger")
                if (propName) {
                    // Apply naming convention: Remove leading 'I' if followed by an uppercase letter
                    if (propName.startsWith('I') && propName.length > 1 && propName[1] === propName[1].toUpperCase()) {
                        propName = propName.substring(1); // "ILogger" -> "Logger"
                    }
                    // Lowercase the first letter
                    propName = propName.charAt(0).toLowerCase() + propName.slice(1); // "Logger" -> "logger"
                }
            }

            // Fallback if propName couldn't be derived
            if (!propName) {
                propName = `dependency${index}`;
                console.warn(`[_createFactory] Could not reliably derive property name for dependency token at index ${index} (value: ${String(token)}) needed by "${targetClassName}". Using fallback name "${propName}". Check token definition and naming conventions.`);
            }
            // --- End Derivation ---

            try {
                // Resolve the dependency using the resolver
                dependenciesMap[propName] = resolver.resolve(token);
            } catch (resolveError) {
                // Add more context to resolution errors to aid debugging
                console.error(`[_createFactory] Failed to resolve dependency "${String(token)}" (for derived property "${propName}") needed by "${targetClassName}". Root cause:`, resolveError);
                // Re-throw the error to ensure the container's error handling catches it
                // Wrap it to provide more context about *which class* failed
                throw new Error(`Failed to resolve dependency "${String(token)}" for "${targetClassName}": ${resolveError.message}`);
            }
        });

        // Debugging: Log the map being passed (optional, can be noisy)
        // console.debug(`[_createFactory] Instantiating "${targetClassName}" with dependencies object: { ${Object.keys(dependenciesMap).join(', ')} }`);

        try {
            // Instantiate the class, passing the dependencies AS A SINGLE OBJECT LITERAL
            return new Ctor(dependenciesMap);
        } catch (constructorError) {
            console.error(`[_createFactory] Error occurred during constructor execution for "${targetClassName}". Dependencies passed: { ${Object.keys(dependenciesMap).join(', ')} }`, constructorError);
            // Re-throw the error from the constructor
            throw constructorError;
        }
    };
    return factoryFn;
};


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
        let factoryFn = factoryOrValue;
        // Ensure we always register a factory function for consistency internally, even for values
        if (typeof factoryOrValue !== 'function') {
            const value = factoryOrValue;
            factoryFn = () => value; // Wrap the value in a factory
        }

        const registrationOptions = {...options};
        if (this.#tags) {
            // Combine existing tags (if any) with the pending tags
            registrationOptions.tags = [...(registrationOptions.tags || []), ...this.#tags];
        }

        // Perform the actual registration on the container
        this.#container.register(token, /** @type {FactoryFunction} */ (factoryFn), registrationOptions);

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
     * Automatically resolves constructor dependencies based on the provided tokens,
     * injecting them as a single object argument.
     *
     * @template T
     * @param {DiToken} token - The key to register the dependency under.
     * @param {Constructor<T>} Ctor - The class constructor.
     * @param {DiToken[]} [deps=[]] - An array of dependency tokens for the constructor.
     * @returns {this} The Registrar instance for chaining.
     */
    single(token, Ctor, deps = []) {
        const factory = _createFactoryForObjectInjection(Ctor, deps);
        // *** CORRECTED DELEGATION ***
        // Delegate to the base register method with the correct lifecycle for this pattern.
        // The factory created by _createFactoryForObjectInjection doesn't need the container arg itself,
        // but the container needs to call it once to create the singleton.
        this.register(token, factory, { lifecycle: 'singleton' });
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
        const factoryFn = () => instance; // Factory just returns the existing instance
        this.register(token, factoryFn, { lifecycle: 'singleton' });
        return this;
    }

    /**
     * Registers a factory function as a singleton.
     * Use this when instantiation logic is more complex than just `new Ctor(depsMap)`,
     * especially when the factory needs the container itself.
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
        // Use the base register method, applying pending tags and setting the CORRECT lifecycle
        // ----- VVVVVV THE FIX IS HERE VVVVVV -----
        this.register(token, factoryFn, { lifecycle: 'singletonFactory' });
        // ----- ^^^^^^ THE FIX IS HERE ^^^^^^ -----
        return this;
    }

    /**
     * Registers a class constructor for transient lifecycle.
     * A new instance is created each time it's resolved.
     * Dependencies are resolved each time and injected as a single object argument.
     *
     * @template T
     * @param {DiToken} token - The key to register the dependency under.
     * @param {Constructor<T>} Ctor - The class constructor.
     * @param {DiToken[]} [deps=[]] - An array of dependency tokens for the constructor.
     * @returns {this} The Registrar instance for chaining.
     */
    transient(token, Ctor, deps = []) {
        const factory = _createFactoryForObjectInjection(Ctor, deps);
        this.register(token, factory, { lifecycle: 'transient' });
        return this;
    }

    /**
     * Registers a factory function for transient lifecycle.
     * A new instance is created via the factory each time it's resolved.
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
        this.register(token, factoryFn, { lifecycle: 'transient' });
        return this;
    }
}