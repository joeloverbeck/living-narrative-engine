/**
 * @file Integration tests exercising buildActorContext with a live EntityManager.
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { EntityManagerTestBed } from '../../../common/entities/entityManagerTestBed.js';
import { buildActorContext } from '../../../../src/actions/validation/contextBuilders.js';
import { ComponentAccessorError } from '../../../../src/logic/componentAccessor.js';

/**
 * Helper to create a rich actor entity for validation tests.
 *
 * @param {EntityManagerTestBed} testBed
 * @returns {Promise<import('../../../../src/entities/entity.js').default>}
 */
async function createActorWithInventory(testBed) {
  return await testBed.createActorEntity({
    instanceId: 'integration-actor-1',
    overrides: {
      'core:inventory': { items: ['rope'], capacity: 5 },
      'core:status': { mood: 'focused', state: 'ready' },
    },
  });
}

describe('buildActorContext integration', () => {
  /** @type {EntityManagerTestBed} */
  let testBed;
  let entityManager;
  let logger;
  let actor;

  beforeEach(async () => {
    testBed = new EntityManagerTestBed();
    entityManager = testBed.entityManager;
    logger = testBed.mocks.logger;
    actor = await createActorWithInventory(testBed);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    if (testBed) {
      await testBed.cleanup();
    }
  });

  it('exposes live component data from the entity manager', async () => {
    const context = buildActorContext(actor.id, entityManager, logger);

    expect(context.id).toBe(actor.id);
    expect('core:inventory' in context.components).toBe(true);
    expect(context.components['core:inventory']).toEqual({
      items: ['rope'],
      capacity: 5,
    });
    expect(context.components['missing:component']).toBeNull();

    const serialized = context.components.toJSON();
    expect(serialized).toEqual(
      expect.objectContaining({
        'core:inventory': { items: ['rope'], capacity: 5 },
        'core:status': { mood: 'focused', state: 'ready' },
      })
    );

    await entityManager.addComponent(actor.id, 'core:inventory', {
      items: ['rope', 'torch'],
      capacity: 5,
    });

    expect(context.components['core:inventory']).toEqual({
      items: ['rope', 'torch'],
      capacity: 5,
    });
  });

  it('wraps entity manager errors inside ComponentAccessorError objects', () => {
    const context = buildActorContext(actor.id, entityManager, logger);
    const original = entityManager.getComponentData.bind(entityManager);

    jest
      .spyOn(entityManager, 'getComponentData')
      .mockImplementation((entityId, componentId, ...rest) => {
        if (componentId === 'core:status') {
          throw new Error('component lookup failed');
        }
        return original(entityId, componentId, ...rest);
      });

    const failingAccess = context.components['core:status'];
    expect(failingAccess).toHaveProperty('error');
    expect(failingAccess.error).toBeInstanceOf(ComponentAccessorError);
    expect(failingAccess.error.componentId).toBe('core:status');
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('ComponentAccessor: Error fetching component'),
      expect.any(Error)
    );
  });

  it('gracefully handles serialization failures by emitting a warning', () => {
    const context = buildActorContext(actor.id, entityManager, logger);

    jest
      .spyOn(entityManager, 'getAllComponentTypesForEntity')
      .mockImplementation(() => {
        throw new Error('enumeration failed');
      });

    const serialized = context.components.toJSON();
    expect(serialized).toEqual({});
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        'ComponentAccessor: Failed to serialize components for entity'
      ),
      expect.any(Error)
    );
  });
});
