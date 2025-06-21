/**
 * @file Mixin providing container token override helpers for test beds.
 */

/**
 * @description Creates a mixin that adds token override functionality to a base
 * test bed class.
 * @param {typeof import('./baseTestBed.js').default} Base - Base class to extend.
 * @returns {typeof import('./baseTestBed.js').default} Extended class with token override helpers.
 */
export function TokenOverrideMixin(Base) {
  return class TokenOverride extends Base {
    /** @type {Map<any, any>} */
    #tokenOverrides = new Map();

    /** @type {Function} */
    #originalResolve;

    /**
     * Initializes token override handling for the provided container.
     *
     * @protected
     * @param {{ resolve: import('jest').Mock }} container - DI container instance.
     * @returns {void}
     */
    _initTokenOverrides(container) {
      this.container = container;
      this.#originalResolve =
        this.container.resolve.getMockImplementation?.() ??
        this.container.resolve;
    }

    /**
     * Temporarily overrides container token resolution.
     *
     * @param {any} token - Token to override.
     * @param {any | (() => any)} value - Replacement value or function.
     * @returns {void}
     */
    withTokenOverride(token, value) {
      this.#tokenOverrides.set(token, value);
      this.container.resolve.mockImplementation((tok) => {
        if (this.#tokenOverrides.has(tok)) {
          const override = this.#tokenOverrides.get(tok);
          return typeof override === 'function' ? override() : override;
        }
        return this.#originalResolve(tok);
      });
    }

    /**
     * Restores the container state and clears overrides after base cleanup.
     *
     * @protected
     * @returns {Promise<void>} Promise resolving when container cleanup is complete.
     */
    async _afterCleanup() {
      this.container.resolve.mockImplementation(this.#originalResolve);
      this.#tokenOverrides.clear();
      await super._afterCleanup();
    }
  };
}

export default TokenOverrideMixin;
