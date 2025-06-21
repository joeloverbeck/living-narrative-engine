/**
 * @file Mixin providing automatic stop invocation during cleanup.
 */

/**
 * @description Creates a mixin that stops a property during cleanup if it
 * supports a `stop` method.
 * @param {string} prop - Name of the instance property holding the stoppable
 *   object.
 * @returns {(Base: typeof import('./baseTestBed.js').default) => typeof import('./baseTestBed.js').default}
 *   Mixin function applying the stop logic.
 */
export function createStoppableMixin(prop) {
  return function StoppableMixin(Base) {
    return class Stoppable extends Base {
      /**
       * Invokes `stop` on the configured property if available then calls base
       * cleanup.
       *
       * @protected
       * @returns {Promise<void>} Resolves when cleanup is finished.
       */
      async _afterCleanup() {
        const target = this[prop];
        if (target && typeof target.stop === 'function') {
          await target.stop();
        }
        await super._afterCleanup();
      }
    };
  };
}

export default createStoppableMixin;
