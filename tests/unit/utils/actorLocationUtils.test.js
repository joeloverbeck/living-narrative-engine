import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { getActorLocation } from '../../../src/utils/actorLocationUtils.js';

/** @typedef {import('../../../src/interfaces/IEntityManager.js').IEntityManager} IEntityManager */

/**
 * Simple mock entity class
 *
 * @param id
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
    const locEntity = createMockEntity('loc1');
    mockEntityManager.getComponentData.mockReturnValue({ locationId: 'loc1' });
    mockEntityManager.getEntityInstance.mockReturnValue(locEntity);

    const result = getActorLocation('actor1', mockEntityManager);
    expect(result).toBe(locEntity);
  });

  it('returns locationId string when entity lookup fails', () => {
    mockEntityManager.getComponentData.mockReturnValue({ locationId: 'loc1' });
    mockEntityManager.getEntityInstance.mockReturnValue(undefined);

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
