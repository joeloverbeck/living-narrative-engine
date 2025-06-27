/**
 * @file Defines the interface for validating content dependencies.
 */

/**
 * @interface IContentDependencyValidator
 * @description Contract for validating entity and world content dependencies.
 */
export class IContentDependencyValidator {
  /**
   * Validates content dependencies for a specified world.
   *
   * @param {string} worldName - Identifier of the world to validate.
   * @returns {Promise<void>} Resolves when validation is complete.
   * @throws {Error} If not implemented by a subclass.
   */
  async validate(worldName) {
    const _worldName = worldName; // suppress unused param lint
    throw new Error(
      'IContentDependencyValidator.validate method not implemented.'
    );
  }
}

export default IContentDependencyValidator;
