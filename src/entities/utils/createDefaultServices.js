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
import EntityLifecycleManager from '../services/entityLifecycleManager.js';

/** @typedef {import('../services/entityRepositoryAdapter.js').EntityRepositoryAdapter} EntityRepositoryAdapter */
/** @typedef {import('../services/componentMutationService.js').ComponentMutationService} ComponentMutationService */
/** @typedef {import('../services/errorTranslator.js').ErrorTranslator} ErrorTranslator */
/** @typedef {import('../factories/entityFactory.js').default} EntityFactory */
/** @typedef {import('../services/definitionCache.js').DefinitionCache} DefinitionCache */
/** @typedef {import('../services/entityLifecycleManager.js').EntityLifecycleManager} EntityLifecycleManager */

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
 * @param {import('../../ports/IEntityRepository.js').IEntityRepository} [deps.repository]
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
  repository = null,
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
  const entityLifecycleManager = new EntityLifecycleManager({
    registry,
    logger,
    eventDispatcher,
    repository,
    entityRepository,
    factory: entityFactory,
    errorTranslator,
    definitionCache,
  });

  return {
    entityRepository,
    componentMutationService,
    errorTranslator,
    entityFactory,
    definitionCache,
    entityLifecycleManager,
  };
}

export default createDefaultServices;
