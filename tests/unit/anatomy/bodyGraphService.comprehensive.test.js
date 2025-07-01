import { beforeEach, describe, expect, it } from '@jest/globals';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import {
  createMockLogger,
  createMockSafeEventDispatcher,
} from '../../common/mockFactories/index.js';

/**
 * Additional comprehensive tests for BodyGraphService focusing on
 * path finding, detachment logic and threshold checks.
 */
describe('BodyGraphService comprehensive scenarios', () => {
  let entityManager;
  let logger;
  let dispatcher;
  let service;

  beforeEach(() => {
    const entities = [
      {
        id: 'torso',
        components: {
          'anatomy:part': { subType: 'torso' },
          'anatomy:sockets': { sockets: [{ id: 'arm_socket' }] },
        },
      },
      {
        id: 'arm',
        components: {
          'anatomy:part': { subType: 'arm' },
          'anatomy:joint': {
            parentId: 'torso',
            socketId: 'arm_socket',
            breakThreshold: 10,
          },
          'anatomy:sockets': { sockets: [{ id: 'hand_socket' }] },
        },
      },
      {
        id: 'hand',
        components: {
          'anatomy:part': { subType: 'hand' },
          'anatomy:joint': { parentId: 'arm', socketId: 'hand_socket' },
        },
      },
      {
        id: 'ring',
        components: {
          'anatomy:part': { subType: 'ring' },
          'anatomy:joint': { parentId: 'hand', socketId: 'ring_socket' },
        },
      },
    ];

    entityManager = new SimpleEntityManager(entities);
    entityManager.getAllEntities = () =>
      Array.from(entityManager.entities.values());
    logger = createMockLogger();
    dispatcher = createMockSafeEventDispatcher();
    dispatcher.dispatch.mockResolvedValue(undefined);

    service = new BodyGraphService({
      entityManager,
      logger,
      eventDispatcher: dispatcher,
    });

    service.buildAdjacencyCache('torso');
  });

  it('computes paths through multiple ancestors', () => {
    const path = service.getPath('ring', 'torso');
    expect(path).toEqual(['ring', 'hand', 'arm', 'torso']);
  });

  it('detaches a non-root part without cascading', async () => {
    const result = await service.detachPart('hand', { cascade: false });
    expect(result).toEqual({
      detached: ['hand'],
      parentId: 'arm',
      socketId: 'hand_socket',
    });
    // path should no longer exist after detachment
    expect(service.getPath('arm', 'hand')).toBeNull();
  });

  it('respects break thresholds when checking damage', () => {
    expect(service.shouldDetachFromDamage('arm', 9)).toBe(false);
    expect(service.shouldDetachFromDamage('arm', 10)).toBe(true);
  });

  it('updates queries after cascading detach', async () => {
    await service.detachPart('arm', { cascade: true });
    expect(service.findPartsByType('torso', 'hand')).toEqual([]);
    expect(service.getAnatomyRoot('arm')).toBe('torso');
  });
});
