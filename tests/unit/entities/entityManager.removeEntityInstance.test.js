/**
 * @file Tests for EntityManager.removeEntityInstance
 * @see src/entities/entityManager.js
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  describeEntityManagerSuite,
  TestData,
  TestBed,
} from '../../common/entities/index.js';
import {
  runInvalidEntityIdTests,
} from '../../common/entities/index.js';
import { EntityNotFoundError } from '../../../src/errors/entityNotFoundError.js';
import { expectEntityRemovedDispatch } from '../../common/engine/dispatchTestUtils.js';

describeEntityManagerSuite('EntityManager - removeEntityInstance', (getBed) => {
  describe('removeEntityInstance', () => {
    it('should remove an existing entity', () => {
      // Arrange
      const { entityManager } = getBed();
      const entity = getBed().createBasicEntity();
      expect(entityManager.getEntityInstance(entity.id)).toBe(entity);

      // Act
      entityManager.removeEntityInstance(entity.id);

      // Assert
      expect(entityManager.getEntityInstance(entity.id)).toBeUndefined();
    });

    it('should dispatch an ENTITY_REMOVED event upon successful removal', () => {
      // Arrange
      const { entityManager, mocks } = getBed();
      const entity = getBed().createEntity('basic', { resetDispatch: true });

      // Act
      entityManager.removeEntityInstance(entity.id);

      // Assert
      expectEntityRemovedDispatch(mocks.eventDispatcher.dispatch, entity);
    });

    it('should throw an EntityNotFoundError when trying to remove a non-existent entity', () => {
      // Arrange
      const { entityManager } = getBed();
      const { PRIMARY } = TestData.InstanceIDs;

      // Act & Assert
      expect(() => entityManager.removeEntityInstance(PRIMARY)).toThrow(
        new EntityNotFoundError(PRIMARY)
      );
    });

    runInvalidEntityIdTests(getBed, (em, instanceId) =>
      em.removeEntityInstance(instanceId)
    );

    it('should throw an error if EntityRepository fails internally', () => {
      // This is a tricky test for a defensive code path.
      const stubRepo = {
        add: jest.fn(),
        get: jest.fn(),
        has: jest.fn(() => true),
        remove: jest.fn(() => {
          throw new Error('Test repository failure');
        }),
        clear: jest.fn(),
        entities: jest.fn(() => [].values()),
      };

      // Arrange
      const testBed = new TestBed({
        entityManagerOptions: { repository: stubRepo },
      });
      const { entityManager, mocks } = testBed;
      const { PRIMARY } = TestData.InstanceIDs;
      testBed.createBasicEntity({ instanceId: PRIMARY });

      // Act & Assert
      expect(() => entityManager.removeEntityInstance(PRIMARY)).toThrow(
        "Internal error: Failed to remove entity 'test-instance-01' from repository despite entity being found."
      );
      expect(mocks.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'EntityRepository.remove failed for already retrieved entity'
        )
      );
      testBed.cleanup();
    });
  });
