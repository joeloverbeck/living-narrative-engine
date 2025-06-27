/**
 * @file createDefaultServices - Assembles default service instances for EntityManager.
 * @description Factory helper that constructs the various services used by
 *   EntityManager when they are not provided via dependency injection.
 */

import EntityRepositoryAdapter from '../services/entityRepositoryAdapter.js';
import ComponentMutationService from '../services/componentMutationService.js';
import ErrorTranslator from '../services/errorTranslator.js';
import EntityFactory from '../factories/entityFactory.js';
import DefinitionCache from '../services/definitionCache.js';

/** @typedef {import('../services/entityRepositoryAdapter.js').EntityRepositoryAdapter} EntityRepositoryAdapter */
/** @typedef {import('../services/componentMutationService.js').ComponentMutationService} ComponentMutationService */
/** @typedef {import('../services/errorTranslator.js').ErrorTranslator} ErrorTranslator */
/** @typedef {import('../factories/entityFactory.js').default} EntityFactory */
/** @typedef {import('../services/definitionCache.js').DefinitionCache} DefinitionCache */

/**
 * Assemble default service dependencies for {@link EntityManager}.
 *
 * @param {object} deps
 * @param {import('../../interfaces/coreServices.js').IDataRegistry} deps.registry
 * @param {import('../../interfaces/coreServices.js').ISchemaValidator} deps.validator
 * @param {import('../../interfaces/coreServices.js').ILogger} deps.logger
 * @param {import('../../interfaces/ISafeEventDispatcher.js').ISafeEventDispatcher} deps.eventDispatcher
 * @param {import('../../ports/IIdGenerator.js').IIdGenerator} deps.idGenerator
 * @param {import('../../ports/IComponentCloner.js').IComponentCloner} deps.cloner
 * @param {import('../../ports/IDefaultComponentPolicy.js').IDefaultComponentPolicy} deps.defaultPolicy
 * @returns {{
 *   entityRepository: EntityRepositoryAdapter,
 *   componentMutationService: ComponentMutationService,
 *   errorTranslator: ErrorTranslator,
 *   entityFactory: EntityFactory,
 *   definitionCache: DefinitionCache,
 * }} Collection of default service instances.
 */
export function createDefaultServices({
  registry,
  validator,
  logger,
  eventDispatcher,
  idGenerator,
  cloner,
  defaultPolicy,
}) {
  const entityRepository = new EntityRepositoryAdapter({ logger });
  const componentMutationService = new ComponentMutationService({
    entityRepository,
    validator,
    logger,
    eventDispatcher,
    cloner,
  });
  const errorTranslator = new ErrorTranslator({ logger });
  const entityFactory = new EntityFactory({
    validator,
    logger,
    idGenerator,
    cloner,
    defaultPolicy,
  });
  const definitionCache = new DefinitionCache({ registry, logger });

  return {
    entityRepository,
    componentMutationService,
    errorTranslator,
    entityFactory,
    definitionCache,
  };
}

export default createDefaultServices;
