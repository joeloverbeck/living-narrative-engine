/**
 * @file This test suite proves that cycles can't be created when following people.
 * @see tests/utils/followUtils.test.js
 */

import { beforeEach, describe, expect, test } from '@jest/globals';
import { mock } from 'jest-mock-extended';
import { wouldCreateCycle } from '../../src/utils/followUtils.js';
import { FOLLOWING_COMPONENT_ID } from '../../src/constants/componentIds.js';

/**
 * @typedef {import('../../src/interfaces/IEntityManager.js').IEntityManager} IEntityManager
 */

describe('wouldCreateCycle', () => {
  /** @type {IEntityManager} */
  let mockEntityManager;
  const mockEntities = new Map();

  // Helper to create a mock entity
  const createMockEntity = (id, followingId = null) => {
    const mockEntity = mock();
    mockEntity.id = id;
    if (followingId) {
      mockEntity.getComponentData
        .calledWith(FOLLOWING_COMPONENT_ID)
        .mockReturnValue({
          leaderId: followingId,
        });
    } else {
      mockEntity.getComponentData
        .calledWith(FOLLOWING_COMPONENT_ID)
        .mockReturnValue(null);
    }
    return mockEntity;
  };

  beforeEach(() => {
    mockEntities.clear();
    mockEntityManager = mock();

    // Wire up the mock entity manager to return our mock entities
    mockEntityManager.getEntityInstance.mockImplementation((id) => {
      return mockEntities.get(id);
    });
  });

  test('should return false when there is no potential for a cycle', () => {
    // A -> B, D wants to follow C. No connection.
    mockEntities.set('A', createMockEntity('A', 'B'));
    mockEntities.set('B', createMockEntity('B'));
    mockEntities.set('C', createMockEntity('C'));
    mockEntities.set('D', createMockEntity('D'));

    expect(wouldCreateCycle('D', 'C', mockEntityManager)).toBe(false);
  });

  test('should return false for a simple, non-cyclic follow chain', () => {
    // A -> B. C wants to follow A. Chain is C -> A -> B. No cycle.
    mockEntities.set('A', createMockEntity('A', 'B'));
    mockEntities.set('B', createMockEntity('B'));
    mockEntities.set('C', createMockEntity('C'));

    expect(wouldCreateCycle('C', 'A', mockEntityManager)).toBe(false);
  });

  test('should detect a direct cycle (A -> B, B tries to follow A)', () => {
    // A is already following B. B tries to follow A.
    mockEntities.set('A', createMockEntity('A'));
    mockEntities.set('B', createMockEntity('B', 'A')); // B is following A

    // A now tries to follow B, which would create A -> B -> A
    expect(wouldCreateCycle('A', 'B', mockEntityManager)).toBe(true);
  });

  test('should detect a long cycle (A -> B -> C, A tries to follow C)', () => {
    // C is following B, B is following A.
    mockEntities.set('A', createMockEntity('A'));
    mockEntities.set('B', createMockEntity('B', 'A'));
    mockEntities.set('C', createMockEntity('C', 'B'));

    // A now tries to follow C. This would create the cycle A -> C -> B -> A.
    expect(wouldCreateCycle('A', 'C', mockEntityManager)).toBe(true);
  });

  test('should detect a long cycle (A -> B -> C -> D, D tries to follow A)', () => {
    // NOTE: Corrected mock setup.
    // This test establishes a chain where A follows B, B follows C, and C follows D.
    // Then it checks if having D follow A would close the loop and create a cycle.
    mockEntities.set('A', createMockEntity('A', 'B')); // A follows B
    mockEntities.set('B', createMockEntity('B', 'C')); // B follows C
    mockEntities.set('C', createMockEntity('C', 'D')); // C follows D
    mockEntities.set('D', createMockEntity('D')); // D follows no one (yet)

    // D tries to follow A, would create D -> A -> B -> C -> D.
    expect(wouldCreateCycle('D', 'A', mockEntityManager)).toBe(true);
  });

  test('should return false if the prospective leader does not exist', () => {
    mockEntities.set('A', createMockEntity('A'));
    // B wants to follow non-existent entity 'C'
    expect(wouldCreateCycle('B', 'C', mockEntityManager)).toBe(false);
  });

  test('should return false if an entity in the chain does not exist', () => {
    // A -> B, but B doesn't exist. C wants to follow A.
    mockEntities.set('A', createMockEntity('A', 'B'));
    // No entity 'B' in the map.

    expect(wouldCreateCycle('C', 'A', mockEntityManager)).toBe(false);
  });

  test('should return false if an entity in the chain is not following anyone', () => {
    // A -> B, C -> D. E wants to follow A.
    mockEntities.set('A', createMockEntity('A', 'B'));
    mockEntities.set('B', createMockEntity('B')); // B is the end of the chain
    mockEntities.set('C', createMockEntity('C', 'D'));
    mockEntities.set('D', createMockEntity('D'));
    mockEntities.set('E', createMockEntity('E'));

    expect(wouldCreateCycle('E', 'A', mockEntityManager)).toBe(false);
  });

  test('should return false if a different cycle exists that does not involve the follower', () => {
    // X -> Y -> Z -> X is a cycle. A wants to follow X.
    mockEntities.set('X', createMockEntity('X', 'Z'));
    mockEntities.set('Y', createMockEntity('Y', 'X'));
    mockEntities.set('Z', createMockEntity('Z', 'Y'));
    mockEntities.set('A', createMockEntity('A'));

    // A wants to follow X. The path is A -> X -> Z -> Y -> X...
    // The visited check should prevent an infinite loop and correctly determine
    // that A is not part of this pre-existing cycle.
    expect(wouldCreateCycle('A', 'X', mockEntityManager)).toBe(false);
  });

  test('should return false if required parameters are missing', () => {
    expect(wouldCreateCycle(null, 'leader', mockEntityManager)).toBe(false);
    expect(wouldCreateCycle('follower', null, mockEntityManager)).toBe(false);
    expect(wouldCreateCycle('follower', 'leader', null)).toBe(false);
  });

  test('should return true if an actor tries to follow itself', () => {
    // This case might be prevented by action prerequisites, but the utility should handle it.
    mockEntities.set('A', createMockEntity('A'));
    expect(wouldCreateCycle('A', 'A', mockEntityManager)).toBe(true);
  });
});
