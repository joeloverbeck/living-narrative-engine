/**
 * @file Tests for EntityManager.clearAll
 * @see src/entities/entityManager.js
 */

import { describe, it, expect } from '@jest/globals';
import {
  describeEntityManagerSuite,
  TestData,
  TestBed,
} from '../../common/entities/index.js';

describeEntityManagerSuite('EntityManager - clearAll', (getBed) => {
  describe('clearAll', () => {
    it('should remove all active entities', () => {
      // Arrange
      const { entityManager } = getBed();
      const entity1 = getBed().createBasicEntity();
      const entity2 = getBed().createBasicEntity();

      expect(Array.from(entityManager.entities).length).toBe(2);

      // Act
      entityManager.clearAll();

      // Assert
      expect(Array.from(entityManager.entities).length).toBe(0);
      expect(entityManager.getEntityInstance(entity1.id)).toBeUndefined();
      expect(entityManager.getEntityInstance(entity2.id)).toBeUndefined();
    });

    it('should clear the internal definition cache', () => {
      // Arrange
      const { entityManager, mocks } = getBed();

      // Act
      getBed().createBasicEntity({ instanceId: 'e1' });
      // This should hit the cache
      getBed().createBasicEntity({ instanceId: 'e2' });
      expect(mocks.registry.getEntityDefinition).toHaveBeenCalledTimes(1);

      entityManager.clearAll();

      // After clearing, it should fetch from the registry again
      getBed().createBasicEntity({ instanceId: 'e3' });
      expect(mocks.registry.getEntityDefinition).toHaveBeenCalledTimes(2);
    });

    it('should log appropriate messages', () => {
      // Arrange
      const { entityManager, mocks } = getBed();

      // Act
      entityManager.clearAll();

      // Assert
      expect(mocks.logger.info).toHaveBeenCalledWith(
        'All entity instances removed from EntityManager.'
      );
      expect(mocks.logger.info).toHaveBeenCalledWith(
        'Entity definition cache cleared.'
      );
    });
  });
});
