// src/entities/utils/createDefaultDeps.js

import InMemoryEntityRepository from '../../adapters/InMemoryEntityRepository.js';
import UuidGenerator from '../../adapters/UuidGenerator.js';
import LodashCloner from '../../adapters/LodashCloner.js';
import DefaultComponentPolicy from '../../adapters/DefaultComponentPolicy.js';

/**
 * Create default dependencies for {@link EntityManager}.
 *
 * @returns {{
 *   repository: import('../../ports/IEntityRepository.js').IEntityRepository,
 *   idGenerator: import('../../ports/IIdGenerator.js').IIdGenerator,
 *   cloner: import('../../ports/IComponentCloner.js').IComponentCloner,
 *   defaultPolicy: import('../../ports/IDefaultComponentPolicy.js').IDefaultComponentPolicy,
 * }} Object containing default implementations.
 */
export function createDefaultDeps() {
  return {
    repository: new InMemoryEntityRepository(),
    idGenerator: UuidGenerator,
    cloner: LodashCloner,
    defaultPolicy: new DefaultComponentPolicy(),
  };
}

export default createDefaultDeps;
