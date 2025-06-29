// src/utils/registrarHelpers.js

/**
 * @file Helper functions and classes to simplify DI container registration.
 */

/** @typedef {import('./appContainer.js').default} AppContainer */
/** @typedef {import('./tokens.js').DiToken} DiToken */
/** @typedef {import('./appContainer.js').FactoryFunction} FactoryFunction */
/** @typedef {{ lifecycle?: 'singletonFactory' | 'singleton' | 'transient', tags?: string[], dependencies?: DiToken[] }} RegistrationOptions */

/**
 * Represents a constructor for a type T.
 *
 * @template T
 * @typedef {new (...args: any[]) => T} Constructor<T>
 */

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
   * Creates an instance of the Registrar.
   *
   * @param {AppContainer} container - The DI container instance to be used for registrations.
   */
  constructor(container) {
    if (!container || typeof container.register !== 'function') {
      throw new Error('Registrar requires a valid AppContainer instance.');
    }
    this.#container = container;
  }

  /**
   * Base registration call used by all helpers. It allows registering a factory,
   * a class constructor, or a pre-existing value/instance against a token.
   *
   * @template T The type of the service being registered.
   * @param {DiToken} token - The dependency injection token to register against.
   * @param {FactoryFunction | Constructor<T> | T} factoryOrValueOrClass - The factory function, class constructor, or direct value/instance to register.
   * @param {RegistrationOptions} [options] - Optional registration parameters, such as lifecycle, tags, or dependencies.
   * @returns {this} The registrar instance for fluent chaining.
   */
  register(token, factoryOrValueOrClass, options = {}) {
    const registrationOptions = { ...options };

    if (this.#tags) {
      registrationOptions.tags = [
        ...(registrationOptions.tags || []),
        ...this.#tags,
      ];
    }

    this.#container.register(token, factoryOrValueOrClass, registrationOptions);
    this.#tags = null; // reset after each registration
    return this;
  }

  /**
   * Tag the next registration with one or more tags. These tags can be used
   * later to resolve multiple services associated with a specific tag.
   *
   * @param {string|string[]} tagOrTags - A single tag string or an array of tag strings.
   * @returns {this} The registrar instance for fluent chaining.
   */
  tagged(tagOrTags) {
    this.#tags = Array.isArray(tagOrTags) ? [...tagOrTags] : [tagOrTags];
    return this;
  }

  /**
   * Register a class as a singleton. The container will create an instance
   * of this class the first time it's resolved and reuse that same instance
   * for all subsequent resolutions.
   *
   * @template T The type of the class being registered.
   * @param {DiToken} token - The dependency injection token to register the class against.
   * @param {Constructor<T>} Ctor - The class constructor to be registered as a singleton.
   * @param {DiToken[]} [deps] - An optional array of dependency tokens required by the class constructor.
   * @returns {this} The registrar instance for fluent chaining.
   */
  single(token, Ctor, deps = []) {
    return this.register(token, Ctor, {
      lifecycle: 'singleton',
      dependencies: deps,
    });
  }

  /**
   * Register an already-built instance as a singleton. The container will
   * always return this specific instance when the token is resolved.
   *
   * @template T The type of the instance being registered.
   * @param {DiToken} token - The dependency injection token to register the instance against.
   * @param {T} instance - The pre-existing instance to be registered.
   * @returns {this} The registrar instance for fluent chaining.
   */
  instance(token, instance) {
    return this.register(token, instance, {
      lifecycle: 'singleton',
      isInstance: true, // <-- essential for the jest expectations
    });
  }

  /**
   * Alias for {@link Registrar#instance} maintained for backward compatibility.
   *
   * @param {DiToken} token - The token to register the value against.
   * @param {*} value - The value or instance to register.
   * @returns {this} The registrar instance for chaining.
   */
  value(token, value) {
    const factory = () => value;
    return this.register(token, factory, { lifecycle: 'singletonFactory' });
  }

  /**
   * Register a factory function as a singleton. The factory function will be
   * called only once to create the instance, and this instance will be reused
   * for all subsequent resolutions of the token.
   *
   * @param {DiToken} token - The dependency injection token to register the factory against.
   * @param {FactoryFunction} factoryFn - The factory function that creates the instance.
   * @returns {this} The registrar instance for fluent chaining.
   */
  singletonFactory(token, factoryFn) {
    if (typeof factoryFn !== 'function') {
      throw new Error(
        `Registrar.singletonFactory requires a function for token "${String(
          token
        )}", but received ${typeof factoryFn}`
      );
    }
    return this.register(token, factoryFn, { lifecycle: 'singletonFactory' });
  }

  /**
   * Register a class as transient. A new instance of this class will be
   * created every time the token is resolved.
   *
   * @template T The type of the class being registered.
   * @param {DiToken} token - The dependency injection token to register the class against.
   * @param {Constructor<T>} Ctor - The class constructor to be registered as transient.
   * @param {DiToken[]} [deps] - An optional array of dependency tokens required by the class constructor.
   * @returns {this} The registrar instance for fluent chaining.
   */
  transient(token, Ctor, deps = []) {
    return this.register(token, Ctor, {
      lifecycle: 'transient',
      dependencies: deps,
    });
  }

  /**
   * Register a factory function as transient. The factory function will be
   * called to create a new instance every time the token is resolved.
   *
   * @param {DiToken} token - The dependency injection token to register the factory against.
   * @param {FactoryFunction} factoryFn - The factory function that creates the instance.
   * @returns {this} The registrar instance for fluent chaining.
   */
  transientFactory(token, factoryFn) {
    if (typeof factoryFn !== 'function') {
      throw new Error(
        `Registrar.transientFactory requires a function for token "${String(
          token
        )}", but received ${typeof factoryFn}`
      );
    }
    return this.register(token, factoryFn, { lifecycle: 'transient' });
  }
}

/**
 * Register a dependency using a registrar method while logging the action.
 *
 * @param {Registrar} registrar - The registrar instance.
 * @param {import('../interfaces/coreServices.js').ILogger} logger - Logger for debug output.
 * @param {keyof Registrar} method - Registrar method name to invoke.
 * @param {DiToken} token - The DI token to register under.
 * @param {...any} args - Additional arguments forwarded to the registrar method.
 * @returns {void}
 */
export function registerWithLog(registrar, logger, method, token, ...args) {
  if (typeof registrar[method] !== 'function') {
    throw new Error(`Unknown registrar method: ${String(method)}`);
  }
  registrar[method](token, ...args);
  logger.debug(`UI Registrations: Registered ${String(token)}.`);
}

/**
 * Resolve an optional dependency from the DI container.
 *
 * @description Returns `null` if the token is not registered.
 * @param {AppContainer} container - The container to resolve from.
 * @param {DiToken} token - The dependency token to resolve.
 * @returns {* | null} The resolved instance or `null`.
 */
export function resolveOptional(container, token) {
  return container.isRegistered(token) ? container.resolve(token) : null;
}
