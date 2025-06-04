// src/core/interfaces/IServiceResolver.js

/**
 * @file Defines the IServiceResolver interface for resolving
 * services based on tags within a dependency injection container.
 * This promotes loose coupling between components needing tag-based
 * resolution and the specific container implementation (like AppContainer).
 */

/**
 * @interface IServiceResolver
 * @classdesc Defines the contract for a service that can resolve registered
 * dependencies based on assigned tags. This allows components to request
 * collections of services implementing a certain role or feature (e.g.,
 * 'initializableSystem', 'plugin') without being coupled to the concrete
 * container implementation.
 *
 * Implementations of this interface are expected to be provided by the
 * dependency injection container used in the application.
 */
export class IServiceResolver {
  /**
   * Resolves and returns all registered service instances associated
   * with the specified tag.
   *
   * Implementations should return an array of instances. If no services
   * are found with the given tag, an empty array should be returned.
   * The resolution mechanism (e.g., handling singletons vs. transients)
   * depends on the specific container implementation. Based on the current
   * AppContainer, this resolution is synchronous.
   * @function resolveByTag // JSDoc hint for method within interface/class structure
   * @param {string} tag - The tag identifying the group of services to resolve.
   * Cannot be null or empty.
   * @returns {Array<any>} An array containing the instances of the services
   * registered with the specified tag. Returns an empty array `[]` if no
   * matching services are found or if the tag is invalid. The type `any`
   * is used here as the resolved services can be of various types, and
   * the specific types depend on what was registered with the tag.
   * @throws {Error} While the interface contract itself doesn't mandate throwing,
   * concrete implementations *may* throw critical errors if the underlying
   * resolution process fails catastrophically (e.g., container configuration
   * issue, unrecoverable error during dependency creation for a required
   * tagged service). Errors encountered during the resolution of
   * individual* tagged services might be handled differently by the
   * implementation (e.g., logged and skipped, returning only successfully
   * resolved instances) - refer to the specific implementation's documentation.
   * An implementation *should not* throw if the tag simply doesn't exist;
   * it should return an empty array in that case.
   */
  resolveByTag(tag) {
    // Interface methods should not be called directly.
    // This stub helps catch incorrect usage. Implementations must override this.
    throw new Error('IServiceResolver.resolveByTag method not implemented.');
  }
}

// --- Boilerplate to ensure this file is treated as a module ---
// This is especially important if no actual 'export' statement exists,
// but even with the 'export class', it reinforces module status.
export {};
