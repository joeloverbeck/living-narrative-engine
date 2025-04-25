// src/core/dependencyInjection/registrarHelpers.js

/**
 * @fileoverview Helper functions and classes to simplify DI container registration.
 */

/** @typedef {import('../appContainer.js').default} AppContainer */
/** @typedef {import('../tokens.js').DiToken} DiToken */
/** @typedef {import('awilix').ResolveOptions} ResolveOptions */
/** @typedef {import('awilix').Resolver} Resolver */
/** @typedef {import('awilix').ClassOrFunctionReturning} ClassOrFunctionReturning */
/** @typedef {import('awilix').BuildResolver} BuildResolver */
/** @typedef {(...args: any[]) => any} Constructor */


/**
 * Creates a factory function suitable for DI container registration (like awilix's asFunction)
 * that instantiates a class (`Ctor`) resolving its dependencies from the container.
 *
 * @template T
 * @param {Constructor<T>} Ctor - The class constructor to instantiate.
 * @param {DiToken[]} [deps=[]] - An array of dependency tokens to resolve from the container.
 * @returns {BuildResolver<T>} A factory function that resolves dependencies and calls the constructor.
 * @example
 * container.register({
 * myService: asSingleton(MyService, [tokens.Dep1, tokens.Dep2])
 * })
 * // equivalent to:
 * container.register({
 * myService: c => new MyService(c.resolve(tokens.Dep1), c.resolve(tokens.Dep2)),
 * // with { lifecycle: 'singleton' } applied separately or via Registrar
 * })
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
     * @param {Resolver<T>} factory - The resolver function or value.
     * @param {ResolveOptions} [options={}] - Registration options (e.g., lifecycle).
     * @returns {this} The Registrar instance for chaining.
     */
  register(token, factory, options = {}) {
    const registrationOptions = {...options};
    if (this.#tags) {
      registrationOptions.tags = [...(registrationOptions.tags || []), ...this.#tags];
    }

    this.#container.register(token, factory, registrationOptions);
    this.#tags = null; // Reset tags after registration
    return this;
  }

  /**
     * Specifies tags to be added to the *next* registration.
     *
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
    // Explicitly set lifecycle here as per helper goal
    this.register(token, factory, {lifecycle: 'singleton'});
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
    // awilix uses asValue for instances
    this.register(token, instance, {lifecycle: 'singleton'});
    return this;
  }

  /**
     * Registers a factory function as a singleton.
     * Use this when instantiation logic is more complex than just `new Ctor(...deps)`.
     *
     * @template T
     * @param {DiToken} token - The key to register the dependency under.
     * @param {BuildResolver<T>} factoryFn - The factory function (takes container `c` as arg).
     * @returns {this} The Registrar instance for chaining.
     */
  singletonFactory(token, factoryFn) {
    this.register(token, factoryFn, {lifecycle: 'singleton'});
    return this;
  }
}