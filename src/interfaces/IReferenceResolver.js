// src/interfaces/IReferenceResolver.js

/**
 * @interface IReferenceResolver
 * @description Contract for services that resolve definition identifiers to
 * instance identifiers within component data.
 */
export class IReferenceResolver {
  /**
   * Resolves references in component data according to a provided specification.
   *
   * @param {object} componentDataInstance - The component data being processed.
   * @param {object} spec - The resolution specification.
   * @param {string} entityId - Identifier of the entity being processed.
   * @param {string} componentTypeId - Identifier of the component type.
   * @returns {{resolvedValue: any, valueChanged: boolean}}
   * An object describing the resolved value and whether any change occurred.
   */

  resolve(componentDataInstance, spec, entityId, componentTypeId) {
    throw new Error('IReferenceResolver.resolve not implemented');
  }
}
