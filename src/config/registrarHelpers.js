// src/core/config/registrarHelpers.js

/**
 * @file Helper functions and classes to simplify DI container registration.
 */

/** @typedef {import('./appContainer.js').default} AppContainer */
/** @typedef {import('./tokens.js').DiToken} DiToken */
/** @typedef {import('./appContainer.js').FactoryFunction} FactoryFunction */
/** @typedef {{ lifecycle?: 'singletonFactory' | 'singleton' | 'transient', tags?: string[], dependencies?: DiToken[] }} RegistrationOptions */

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
   * Base registration call used by all helpers.
   * @template T
   * @param {DiToken} token
   * @param {FactoryFunction | Constructor<T> | T} factoryOrValueOrClass
   * @param {RegistrationOptions} [options]
   * @returns {this}
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
   * Tag the next registration.
   * @param {string|string[]} tagOrTags
   * @returns {this}
   */
  tagged(tagOrTags) {
    this.#tags = Array.isArray(tagOrTags) ? [...tagOrTags] : [tagOrTags];
    return this;
  }

  /**
   * Register a class as a singleton.
   * @template T
   * @param {DiToken} token
   * @param {Constructor<T>} Ctor
   * @param {DiToken[]} [deps]
   * @returns {this}
   */
  single(token, Ctor, deps = []) {
    return this.register(token, Ctor, {
      lifecycle: 'singleton',
      dependencies: deps,
    });
  }

  /**
   * Register an already-built instance.
   * @template T
   * @param {DiToken} token
   * @param {T} instance
   * @returns {this}
   */
  instance(token, instance) {
    return this.register(token, instance, {
      lifecycle: 'singleton',
      isInstance: true, // <-- essential for the jest expectations
    });
  }

  /**
   * Register a singleton factory.
   * @param {DiToken} token
   * @param {FactoryFunction} factoryFn
   * @returns {this}
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
   * Register a transient class.
   * @template T
   * @param {DiToken} token
   * @param {Constructor<T>} Ctor
   * @param {DiToken[]} [deps]
   * @returns {this}
   */
  transient(token, Ctor, deps = []) {
    return this.register(token, Ctor, {
      lifecycle: 'transient',
      dependencies: deps,
    });
  }

  /**
   * Register a transient factory.
   * @param {DiToken} token
   * @param {FactoryFunction} factoryFn
   * @returns {this}
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
