import { validateAndClone } from './componentValidation.js';

/**
 * Factory to create a validate-and-clone helper bound to a logger and validator.
 *
 * @param {import('../../interfaces/coreServices.js').ISchemaValidator} validator - Schema validator.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger instance.
 * @param {import('../../ports/IComponentCloner.js').IComponentCloner} cloner - Component cloner.
 * @returns {(componentTypeId: string, data: object, context: string) => object} Preconfigured helper.
 */
export function createValidateAndClone(validator, logger, cloner) {
  return function validateAndCloneBound(componentTypeId, data, context) {
    return validateAndClone(
      componentTypeId,
      data,
      validator,
      logger,
      context,
      cloner
    );
  };
}

export default createValidateAndClone;
