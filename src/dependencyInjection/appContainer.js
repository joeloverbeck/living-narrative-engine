// src/dependencyInjection/appContainer.js
// ****** CORRECTED FILE ******
/* eslint-disable no-console */
/** @typedef {import('./tokens.js').DiToken} DiToken */

/**
 * @typedef {'singleton' | 'transient' | 'singletonFactory'} Lifecycle
 */

/**
 * @typedef {object} RegistrationOptions
 * @property {Lifecycle} [lifecycle='singleton'] - How the instance should be managed.
 * @property {DiToken[]} [dependencies] - Dependencies (keys) for class constructor injection. Added by Registrar.single/transient.
 * @property {string[]} [tags=[]] - Optional tags for resolving multiple services.
 */

/**
 * @callback FactoryFunction
 * @param {AppContainer} container - The container instance, to resolve dependencies.
 * @returns {any} The created service instance.
 */

/** @typedef {new (...args: any[]) => any} ClassConstructor */

/**
 * A lightweight Dependency Injection (DI) container.
 * Manages instantiation and lifecycle of registered services/systems.
 *
 * @implements {import('../interfaces/container.js').IServiceResolver}
 */
class AppContainer {
  /** @type {Map<string, { registration: FactoryFunction | ClassConstructor | any, options: RegistrationOptions }>} */
  #registrations = new Map();
  /** @type {Map<string, any>} */
  #instances = new Map(); // Stores singleton instances

  /**
   * Registers a service/system with the container.
   *
   * @param {DiToken} key - A unique identifier for the service.
   * @param {FactoryFunction | ClassConstructor | any} factoryOrValueOrClass - The factory, class constructor, or value to register.
   * @param {RegistrationOptions} [options] - Registration options.
   */
  register(key, factoryOrValueOrClass, options = { lifecycle: 'singleton' }) {
    const registrationKey = String(key);
    if (this.#registrations.has(registrationKey)) {
      console.warn(
        `AppContainer: Service key "${registrationKey}" is already registered. Overwriting.`
      );
    }
    // Establish defaults carefully, ensuring dependencies isn't added unless intended
    const defaultOptions = {
      lifecycle: 'singleton',
      // dependencies: [], // DO NOT default dependencies here, check for presence later
      tags: [],
    };
    const effectiveOptions = { ...defaultOptions, ...options }; // Merge provided options over defaults

    const lifecycle = effectiveOptions.lifecycle;
    const tagsInfo =
      Array.isArray(effectiveOptions.tags) && effectiveOptions.tags.length > 0
        ? ` Tags: [${effectiveOptions.tags.join(', ')}]`
        : '';
    // Only log deps info if the key actually exists in the effective options
    const depsInfo =
      Object.prototype.hasOwnProperty.call(effectiveOptions, 'dependencies') &&
      Array.isArray(effectiveOptions.dependencies) &&
      effectiveOptions.dependencies.length > 0
        ? ` Deps: [${effectiveOptions.dependencies.join(', ')}]`
        : '';
    console.log(
      `AppContainer: Registering "${registrationKey}" (Lifecycle: ${lifecycle})${depsInfo}${tagsInfo}`
    );

    this.#registrations.set(registrationKey, {
      registration: factoryOrValueOrClass,
      options: effectiveOptions,
    });

    if (
      this.#instances.has(registrationKey) &&
      (lifecycle === 'singleton' || lifecycle === 'singletonFactory')
    ) {
      this.#instances.delete(registrationKey);
    }
  }

  /**
   * Resolves (retrieves or creates) an instance of a registered service.
   *
   * @template T
   * @param {DiToken} key - The unique identifier of the service to resolve.
   * @returns {T} The resolved service instance.
   * @throws {Error} If the key is not registered or creation fails.
   */
  resolve(key) {
    const registrationKey = String(key);
    const registration = this.#registrations.get(registrationKey);
    if (!registration) {
      const knownKeys = Array.from(this.#registrations.keys()).join(', ');
      throw new Error(
        `AppContainer: No service registered for key "${registrationKey}". Known keys: [${knownKeys}]`
      );
    }

    const { registration: factoryOrValueOrClass, options } = registration;
    const lifecycle = options.lifecycle || 'singleton';

    if (lifecycle === 'singleton' || lifecycle === 'singletonFactory') {
      if (this.#instances.has(registrationKey)) {
        return this.#instances.get(registrationKey);
      }
      try {
        const instance = this._createInstance(
          registrationKey,
          factoryOrValueOrClass,
          options
        );
        this.#instances.set(registrationKey, instance);
        return instance;
      } catch (error) {
        console.error(
          `AppContainer: Error creating singleton instance for "${registrationKey}":`,
          error
        );
        throw new Error(
          `Failed to create instance for "${registrationKey}" (lifecycle: ${lifecycle}): ${error.message}`,
          { cause: error }
        );
      }
    } else if (lifecycle === 'transient') {
      try {
        const instance = this._createInstance(
          registrationKey,
          factoryOrValueOrClass,
          options
        );
        return instance;
      } catch (error) {
        console.error(
          `AppContainer: Error creating transient instance for "${registrationKey}":`,
          error
        );
        throw new Error(
          `Failed to create instance for "${registrationKey}" (lifecycle: ${lifecycle}): ${error.message}`,
          { cause: error }
        );
      }
    } else {
      throw new Error(
        `AppContainer: Unknown lifecycle "${lifecycle}" for key "${registrationKey}".`
      );
    }
  }

  /**
   * Internal helper to create an instance based on registration info.
   *
   * @private
   * @param {string} key - The registration key (for logging).
   * @param {FactoryFunction | ClassConstructor | any} factoryOrValueOrClass - The registered item.
   * @param {RegistrationOptions} options - The registration options.
   * @returns {any} The created instance.
   */
  _createInstance(key, factoryOrValueOrClass, options) {
    // --- VVVVVV MODIFIED LOGIC VVVVVV ---
    // Determine registration type:
    // It's a class registration if it's a function AND the 'dependencies' key exists in options
    // (Registrar.single/transient always add this key, even if empty array).
    const isClassRegistration =
      typeof factoryOrValueOrClass === 'function' &&
      Object.prototype.hasOwnProperty.call(options || {}, 'dependencies');

    const isFactoryFunction =
      typeof factoryOrValueOrClass === 'function' && !isClassRegistration;
    // --- ^^^^^^ MODIFIED LOGIC ^^^^^^ ---

    if (isClassRegistration) {
      // --- Handle Class constructor (from .single/.transient) ---
      /** @type {ClassConstructor} */
      const ClassConstructor = factoryOrValueOrClass;
      // Ensure deps is an array, even if options.dependencies was null/undefined (though shouldn't happen with Registrar)
      const deps = Array.isArray(options.dependencies)
        ? options.dependencies
        : [];
      const dependenciesMap = {};
      const targetClassName = ClassConstructor.name || '[AnonymousClass]';

      // Only resolve dependencies if there are any
      if (deps.length > 0) {
        deps.forEach((depToken) => {
          let propName = String(depToken);
          if (
            propName.length > 1 &&
            propName.startsWith('I') &&
            propName[1] === propName[1].toUpperCase()
          )
            propName = propName.substring(1);
          propName = propName.charAt(0).toLowerCase() + propName.slice(1);
          try {
            dependenciesMap[propName] = this.resolve(depToken);
          } catch (e) {
            console.error(
              `[AppContainer._createInstance for ${key}] FAILED dependency resolution: Cannot resolve "${String(depToken)}" (for prop "${propName}") needed by "${targetClassName}".`,
              e
            );
            throw new Error(
              `Failed to resolve dependency "${String(depToken)}" needed by "${targetClassName}" (registered as "${key}"): ${e.message}`,
              { cause: e }
            );
          }
        });
      }

      // Use 'new', passing an empty map if no dependencies
      return new ClassConstructor(dependenciesMap);
    } else if (isFactoryFunction) {
      // --- Handle Factory function ---
      return factoryOrValueOrClass(this); // Execute factory
    } else {
      // --- Handle Instance/Value registration ---
      return factoryOrValueOrClass; // Return value
    }
  }

  /**
   * Resolves all registered services that have the specified tag.
   *
   * @template T
   * @param {string} tag - The tag to search for.
   * @returns {Array<T>} An array of resolved service instances associated with the tag.
   */
  resolveByTag(tag) {
    const resolvedInstances = [];

    for (const [key, registration] of this.#registrations.entries()) {
      if (registration.options?.tags?.includes(tag)) {
        try {
          const instance = this.resolve(key);
          resolvedInstances.push(instance);
        } catch (error) {
          console.error(
            `AppContainer: Error resolving tagged instance "${key}" for tag "${tag}":`,
            error
          );
        }
      }
    }

    return resolvedInstances;
  }

  /** Clears singleton instances */
  disposeSingletons() {
    console.log('AppContainer: Disposing singleton instances...');
    this.#instances.clear();
  }

  /** Clears all registrations and instances */
  reset() {
    console.log(
      'AppContainer: Resetting container (registrations and instances)...'
    );
    this.#registrations.clear();
    this.#instances.clear();
  }
}

export default AppContainer;
