import { describe, it, expect } from '@jest/globals';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import {
  createMockLogger,
  createMockSafeEventDispatcher,
} from '../../common/mockFactories/index.js';

/**
 * Utility to build a BodyGraphService with a simple two-part anatomy.
 *
 * @returns {{service: BodyGraphService, logger: object, dispatcher: object}}
 *   A ready-to-use service instance and its mocks.
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
  const em = new SimpleEntityManager(entities);
  const logger = createMockLogger();
  const dispatcher = createMockSafeEventDispatcher();
  const service = new BodyGraphService({
    entityManager: em,
    logger,
    eventDispatcher: dispatcher,
  });
  return { service, logger, dispatcher };
}

describe('BodyGraphService uncovered branches', () => {
  it('handles detachPart when parent node is missing from cache', async () => {
    const { service, dispatcher } = buildService();
    // intentionally do NOT build cache so parent lookup fails
    const result = await service.detachPart('arm', {
      cascade: false,
      reason: 'x',
    });
    expect(result).toEqual({
      detached: ['arm'],
      parentId: 'torso',
      socketId: 'shoulder',
    });
    expect(dispatcher.dispatch).toHaveBeenCalled();
    // parent not cached → branch where parentNode is falsy
  });

  it('getAllParts returns empty array when bodyComponent is null', () => {
    const { service } = buildService();
    expect(service.getAllParts(null)).toEqual([]);
  });

  it('getAllParts reads root from body.body.root', () => {
    const { service } = buildService();
    service.buildAdjacencyCache('torso');
    const bodyComponent = { body: { root: 'torso' } };
    expect(service.getAllParts(bodyComponent).sort()).toEqual(['arm', 'torso']);
  });

  it('getAllParts returns empty when body.body exists but has no root', () => {
    const { service } = buildService();
    service.buildAdjacencyCache('torso');
    expect(service.getAllParts({ body: {} })).toEqual([]);
  });

  it('hasPartWithComponentValue returns not found when path missing', () => {
    const { service } = buildService();
    service.buildAdjacencyCache('torso');
    const bodyComponent = { root: 'torso' };
    expect(
      service.hasPartWithComponentValue(
        bodyComponent,
        'anatomy:part',
        'non.existent',
        true
      )
    ).toEqual({ found: false });
  });
});
