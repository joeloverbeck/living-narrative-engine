import { validateAndClone } from './componentValidation.js';

/**
 * Factory to create a validate-and-clone helper bound to a logger and validator.
 *
 * @param {import('../../interfaces/coreServices.js').ISchemaValidator} schemaValidator - Schema validator.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger instance.
 * @param {import('../../ports/IComponentCloner.js').IComponentCloner} clonerFn - Component cloner.
 * @returns {(componentTypeId: string, data: object, errorContext: string) => object} Preconfigured helper.
 */
export function createValidateAndClone(schemaValidator, logger, clonerFn) {
  return function validateAndCloneBound(componentTypeId, data, errorContext) {
    return validateAndClone(
      componentTypeId,
      data,
      schemaValidator,
      logger,
      errorContext,
      clonerFn
    );
  };
}

export default createValidateAndClone;
