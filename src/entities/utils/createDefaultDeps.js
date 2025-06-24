// src/entities/utils/createDefaultDeps.js

import InMemoryEntityRepository from '../../adapters/InMemoryEntityRepository.js';
import UuidGenerator from '../../adapters/UuidGenerator.js';
import LodashCloner from '../../adapters/LodashCloner.js';
import DefaultComponentPolicy from '../../adapters/DefaultComponentPolicy.js';

/**
 * Create default dependencies for {@link EntityManager}.
 *
 * @param {object} [factories]
 * @param {Function} [factories.repositoryFactory] Factory for the entity repository.
 * @param {Function} [factories.idGeneratorFactory] Factory for the ID generator function.
 * @param {Function} [factories.clonerFactory] Factory for the component cloner.
 * @param {Function} [factories.defaultPolicyFactory] Factory for the default component policy.
 * @returns {{
 *   repository: import('../../ports/IEntityRepository.js').IEntityRepository,
 *   idGenerator: import('../../ports/IIdGenerator.js').IIdGenerator,
 *   cloner: import('../../ports/IComponentCloner.js').IComponentCloner,
 *   defaultPolicy: import('../../ports/IDefaultComponentPolicy.js').IDefaultComponentPolicy,
 * }} Object containing default implementations.
 */
export function createDefaultDeps({
  repositoryFactory = () => new InMemoryEntityRepository(),
  idGeneratorFactory = () => UuidGenerator,
  clonerFactory = () => LodashCloner,
  defaultPolicyFactory = () => new DefaultComponentPolicy(),
} = {}) {
  return {
    repository: repositoryFactory(),
    idGenerator: idGeneratorFactory(),
    cloner: clonerFactory(),
    defaultPolicy: defaultPolicyFactory(),
  };
}

export default createDefaultDeps;
