import { validateDependencies } from './dependencyUtils.js';

/**
 * Higher-order class decorator that validates dependencies during construction.
 *
 * @param {Function} Base - The base class to extend.
 * @param {Function} specFn - Function that returns dependency specification from args.
 * @returns {Function} A new class that extends Base with dependency validation.
 */
export function withValidatedDeps(Base, specFn) {
  return class extends Base {
    constructor(args) {
      super(args);
      validateDependencies(specFn(args), args.logger);
    }
  };
}
