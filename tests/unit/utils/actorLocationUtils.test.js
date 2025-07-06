import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { getActorLocation } from '../../../src/utils/actorLocationUtils.js';

/** @typedef {import('../../../src/interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * Creates a mock entity for tests.
 *
 * @param {string} id - Identifier for the entity.
 * @returns {{id: string, getComponentData: jest.Mock}} Mock entity.
 */
function createMockEntity(id) {
  return { id, getComponentData: jest.fn() };
}

describe('getActorLocation', () => {
  /** @type {jest.Mocked<IEntityManager>} */
  let mockEntityManager;

  beforeEach(() => {
    mockEntityManager = {
      getComponentData: jest.fn(),
      getEntityInstance: jest.fn(),
    };
  });

  it('returns entity instance when locationId resolves to entity', () => {
    const actor = createMockEntity('actor1');
    const locEntity = createMockEntity('loc1');
    mockEntityManager.getComponentData.mockReturnValue({ locationId: 'loc1' });
    mockEntityManager.getEntityInstance.mockImplementation((id) =>
      id === 'loc1' ? locEntity : actor
    );

    const result = getActorLocation('actor1', mockEntityManager);
    expect(result).toBe(locEntity);
  });

  it('returns locationId string when entity lookup fails', () => {
    const actor = createMockEntity('actor1');
    mockEntityManager.getComponentData.mockReturnValue({ locationId: 'loc1' });
    mockEntityManager.getEntityInstance.mockImplementation((id) =>
      id === 'actor1' ? actor : undefined
    );

    const result = getActorLocation('actor1', mockEntityManager);
    expect(result).toBe('loc1');
  });

  it('returns null when position component missing or invalid', () => {
    mockEntityManager.getComponentData.mockReturnValue(undefined);
    const result = getActorLocation('actor1', mockEntityManager);
    expect(result).toBeNull();

    mockEntityManager.getComponentData.mockReturnValue({ locationId: '' });
    expect(getActorLocation('actor1', mockEntityManager)).toBeNull();
  });

  it('returns null when parameters are invalid', () => {
    expect(getActorLocation(null, mockEntityManager)).toBeNull();
    expect(getActorLocation('actor1', null)).toBeNull();
  });
});
