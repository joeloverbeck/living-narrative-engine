import { describe, it, expect } from '@jest/globals';
import {
  describeEntityManagerSuite,
  TestData,
} from '../../common/entities/index.js';
import { runInvalidIdPairTests } from '../../common/entities/index.js';

describeEntityManagerSuite('EntityManager - hasComponent', (getBed) => {
  describe('hasComponent', () => {
    it('should return true if the component exists on the definition', () => {
      // Arrange
      const { entityManager } = getBed();
      const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      getBed().createBasicEntity({ instanceId: PRIMARY });

      // Act
      const result = entityManager.hasComponent(PRIMARY, NAME_COMPONENT_ID);

      // Assert
      expect(result).toBe(true);
    });

    it('should return true if the component is added as an override', () => {
      // Arrange
      const { entityManager } = getBed();
      const { PRIMARY } = TestData.InstanceIDs;
      getBed().createBasicEntity({ instanceId: PRIMARY });

      // Act
      entityManager.addComponent(PRIMARY, 'new:component', { data: 'test' });
      const result = entityManager.hasComponent(PRIMARY, 'new:component');

      // Assert
      expect(result).toBe(true);
    });

    it('should return false if the component does not exist', () => {
      // Arrange
      const { entityManager } = getBed();
      const { PRIMARY } = TestData.InstanceIDs;
      getBed().createBasicEntity({ instanceId: PRIMARY });

      // Act
      const result = entityManager.hasComponent(PRIMARY, 'non:existent');

      // Assert
      expect(result).toBe(false);
    });

    it('should return false for a non-existent entity instance', () => {
      // Arrange
      const { entityManager } = getBed();
      const { GHOST } = TestData.InstanceIDs;

      // Act
      const result = entityManager.hasComponent(GHOST, 'any:component');

      // Assert
      expect(result).toBe(false);
    });

    runInvalidIdPairTests(getBed, (em, instanceId, componentTypeId) =>
      em.hasComponent(instanceId, componentTypeId)
    );

    describe('with checkOverrideOnly flag', () => {
      it('should return false if component is only on definition', () => {
        // Arrange
        const { entityManager } = getBed();
        const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
        const { PRIMARY } = TestData.InstanceIDs;
        getBed().createBasicEntity({ instanceId: PRIMARY });

        // Act
        const result = entityManager.hasComponent(
          PRIMARY,
          NAME_COMPONENT_ID,
          true
        );

        // Assert
        expect(result).toBe(false);
      });

      it('should return true if component is an override', () => {
        // Arrange
        const { entityManager } = getBed();
        const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
        const { PRIMARY } = TestData.InstanceIDs;
        getBed().createBasicEntity({ instanceId: PRIMARY });
        entityManager.addComponent(PRIMARY, NAME_COMPONENT_ID, {
          name: 'Override',
        });

        // Act
        const result = entityManager.hasComponent(
          PRIMARY,
          NAME_COMPONENT_ID,
          true
        );

        // Assert
        expect(result).toBe(true);
      });
    });

    describe('hasComponentOverride', () => {
      it('should return false if component is only on definition', () => {
        // Arrange
        const { entityManager } = getBed();
        const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
        const { PRIMARY } = TestData.InstanceIDs;
        getBed().createBasicEntity({ instanceId: PRIMARY });

        // Act
        const result = entityManager.hasComponentOverride(
          PRIMARY,
          NAME_COMPONENT_ID
        );

        // Assert
        expect(result).toBe(false);
      });

      it('should return true if component is an override', () => {
        // Arrange
        const { entityManager } = getBed();
        const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
        const { PRIMARY } = TestData.InstanceIDs;
        getBed().createBasicEntity({ instanceId: PRIMARY });
        entityManager.addComponent(PRIMARY, NAME_COMPONENT_ID, {
          name: 'Override',
        });

        // Act
        const result = entityManager.hasComponentOverride(
          PRIMARY,
          NAME_COMPONENT_ID
        );

        // Assert
        expect(result).toBe(true);
      });

      it('should return false for a non-existent entity instance', () => {
        // Arrange
        const { entityManager } = getBed();
        const { GHOST } = TestData.InstanceIDs;

        // Act
        const result = entityManager.hasComponentOverride(
          GHOST,
          'any:component'
        );

        // Assert
        expect(result).toBe(false);
      });

      runInvalidIdPairTests(getBed, (em, instanceId, componentTypeId) =>
        em.hasComponentOverride(instanceId, componentTypeId)
      );
    });
  });
});
