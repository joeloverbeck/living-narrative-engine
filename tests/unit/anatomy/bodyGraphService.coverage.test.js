import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import BodyGraphService, {
  LIMB_DETACHED_EVENT_ID,
} from '../../../src/anatomy/bodyGraphService.js';
import { EntityNotFoundError } from '../../../src/errors/entityNotFoundError.js';

/**
 * Helper to create a simple in-memory entity manager for testing
 *
 * @param entities
 */
const createEntityManager = (entities) => ({
  getEntityInstance: jest.fn((id) => {
    const ent = entities[id];
    if (!ent) throw new EntityNotFoundError(id);
    return ent;
  }),
  getComponentData: jest.fn(
    (id, comp) => entities[id]?.components[comp] ?? null
  ),
  getEntitiesWithComponent: jest.fn((comp) =>
    Object.values(entities).filter((e) => e.components[comp])
  ),
  removeComponent: jest.fn().mockResolvedValue(undefined),
});

describe('BodyGraphService', () => {
  let entities;
  let entityManager;
  let logger;
  let eventDispatcher;
  let service;
  let bodyComponent;

  beforeEach(() => {
    entities = {
      torso: {
        id: 'torso',
        components: {
          'anatomy:part': { subType: 'torso' },
          'anatomy:body': { root: 'torso' },
        },
      },
      arm: {
        id: 'arm',
        components: {
          'anatomy:part': { subType: 'arm' },
          'anatomy:joint': { parentId: 'torso', socketId: 'shoulder' },
        },
      },
      hand: {
        id: 'hand',
        components: {
          'anatomy:part': { subType: 'hand' },
          'anatomy:joint': { parentId: 'arm', socketId: 'wrist' },
          'weapon:grip': { capacity: 1 },
          status: { locked: true },
        },
      },
    };
    entityManager = createEntityManager(entities);
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    eventDispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
    service = new BodyGraphService({ entityManager, logger, eventDispatcher });
    bodyComponent = entities.torso.components['anatomy:body'];
    service.buildAdjacencyCache('torso');
  });

  it('builds adjacency cache and finds parts by type', () => {
    const parts = service.findPartsByType('torso', 'hand');
    expect(parts).toEqual(['hand']);
  });

  it('detaches a subtree when cascading', async () => {
    const result = await service.detachPart('arm', {
      cascade: true,
      reason: 'test',
    });
    expect(result).toEqual({
      detached: ['arm', 'hand'],
      parentId: 'torso',
      socketId: 'shoulder',
    });
    expect(entityManager.removeComponent).toHaveBeenCalledWith(
      'arm',
      'anatomy:joint'
    );
    expect(eventDispatcher.dispatch).toHaveBeenCalledWith(
      LIMB_DETACHED_EVENT_ID,
      expect.objectContaining({
        detachedEntityId: 'arm',
        parentEntityId: 'torso',
        socketId: 'shoulder',
        detachedCount: 2,
        reason: 'test',
        timestamp: expect.any(Number),
      })
    );
  });

  it('detaches only the root when cascade is false', async () => {
    const result = await service.detachPart('arm', { cascade: false });
    expect(result.detached).toEqual(['arm']);
    expect(entityManager.removeComponent).toHaveBeenCalledWith(
      'arm',
      'anatomy:joint'
    );
  });

  it('resolves root and path correctly', () => {
    expect(service.getAnatomyRoot('hand')).toBe('torso');
    expect(service.getPath('hand', 'torso')).toEqual(['hand', 'arm', 'torso']);
  });

  it('retrieves all parts from body component', () => {
    const ids = service.getAllParts(bodyComponent);
    expect(ids.sort()).toEqual(['arm', 'hand', 'torso'].sort());
  });

  it('checks for components and values on parts', () => {
    expect(service.hasPartWithComponent(bodyComponent, 'weapon:grip')).toBe(
      true
    );
    expect(
      service.hasPartWithComponentValue(bodyComponent, 'status', 'locked', true)
    ).toEqual({ found: true, partId: 'hand' });
  });

  it('validates the built cache', () => {
    const validation = service.validateCache();
    expect(validation).toEqual({ valid: true, issues: [] });
  });
});
