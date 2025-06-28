// src/entities/utils/definitionLookup.js

import { assertValidId } from '../../utils/dependencyUtils.js';
import { DefinitionNotFoundError } from '../../errors/definitionNotFoundError.js';

/**
 * Retrieve an entity definition from a registry after validating the ID.
 *
 * @description
 * Shared helper used by EntityManager and EntityFactory to validate a
 * definition ID and fetch the corresponding definition from a data registry.
 * Logs warnings through the provided logger and throws if validation fails
 * or the definition cannot be found.
 * @param {string} definitionId - Identifier of the entity definition.
 * @param {import('../../interfaces/coreServices.js').IDataRegistry} registry - Data registry instance.
 * @param {import('../../interfaces/coreServices.js').ILogger} logger - Logger used for warnings.
 * @throws {import('../../errors/invalidArgumentError.js').InvalidArgumentError} When the ID is invalid.
 * @throws {DefinitionNotFoundError} When no matching definition exists.
 * @returns {import('../entityDefinition.js').default} The found entity definition.
 */
export function getDefinition(definitionId, registry, logger) {
  try {
    assertValidId(definitionId, 'definitionLookup.getDefinition', logger);
  } catch (err) {
    logger.warn(
      `definitionLookup.getDefinition called with invalid definitionId: '${definitionId}'`
    );
    throw err;
  }

  const definition = registry.getEntityDefinition(definitionId);
  if (!definition) {
    logger.warn(`Definition not found in registry: ${definitionId}`);
    throw new DefinitionNotFoundError(definitionId);
  }

  return definition;
}

export default getDefinition;
