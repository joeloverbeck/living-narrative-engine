import { validateDependencies } from './dependencyUtils.js';

/**
 * Creates a subclass that validates dependencies during construction.
 *
 * @param {new (...args: any[]) => any} Base - The base class to extend.
 * @param {(args: any) => Array<{
 *   dependency: *,
 *   name: string,
 *   methods?: string[],
 *   isFunction?: boolean
 * }>} specFn - Function that returns dependency specification from args.
 * @returns {new (...args: any[]) => any} A new class that extends Base with dependency validation.
 */
export function withValidatedDeps(Base, specFn) {
  return class extends Base {
    /**
     * Initializes the decorated class with validated dependencies.
     *
     * @param {any} args - Constructor arguments passed to Base.
     */
    constructor(args) {
      super(args);
      validateDependencies(specFn(args), args.logger);
    }
  };
}
