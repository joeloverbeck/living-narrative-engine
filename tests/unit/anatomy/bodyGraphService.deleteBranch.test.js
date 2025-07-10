import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import {
  createMockLogger,
  createMockSafeEventDispatcher,
} from '../../common/mockFactories/index.js';
import { AnatomyCacheManager } from '../../../src/anatomy/anatomyCacheManager.js';
import { AnatomyGraphAlgorithms } from '../../../src/anatomy/anatomyGraphAlgorithms.js';

// Helper to build a basic service with torso->arm hierarchy
/**
 * Creates a BodyGraphService instance with a simple torso -> arm structure.
 *
 * @returns {{service: BodyGraphService, entityManager: object, logger: object, dispatcher: object}}
 *   Service instance and associated mocks.
 */
function buildService() {
  const entities = [
    {
      id: 'torso',
      components: {
        'anatomy:part': { subType: 'torso' },
        'anatomy:body': { root: 'torso' },
      },
    },
    {
      id: 'arm',
      components: {
        'anatomy:part': { subType: 'arm' },
        'anatomy:joint': { parentId: 'torso', socketId: 'shoulder' },
      },
    },
  ];
  const entityManager = new SimpleEntityManager(entities);
  const logger = createMockLogger();
  const dispatcher = createMockSafeEventDispatcher();
  const service = new BodyGraphService({
    entityManager,
    logger,
    eventDispatcher: dispatcher,
  });
  service.buildAdjacencyCache('torso');
  return { service, entityManager, logger, dispatcher };
}

describe('BodyGraphService additional branch coverage', () => {
  /** @type {import('../../../src/anatomy/bodyGraphService.js').BodyGraphService} */
  let service;
  let dispatcher;

  beforeEach(() => {
    ({ service, dispatcher } = buildService());
  });

  it('removes child from parent and deletes cache on non-cascade detach', async () => {
    const parentNode = { id: 'torso', children: ['arm'] };
    jest
      .spyOn(AnatomyCacheManager.prototype, 'get')
      .mockReturnValue(parentNode);
    const invalidateCacheSpy = jest.spyOn(
      AnatomyCacheManager.prototype,
      'invalidateCacheForRoot'
    );
    jest.spyOn(AnatomyGraphAlgorithms, 'getSubgraph').mockReturnValue(['arm']);
    jest
      .spyOn(AnatomyGraphAlgorithms, 'getAnatomyRoot')
      .mockReturnValue('torso');

    const result = await service.detachPart('arm', { cascade: false });

    expect(result).toEqual({
      detached: ['arm'],
      parentId: 'torso',
      socketId: 'shoulder',
    });
    // Cache should be invalidated for the root, not individual node deleted
    expect(invalidateCacheSpy).toHaveBeenCalledWith('torso');
    expect(dispatcher.dispatch).toHaveBeenCalled();
  });
});
