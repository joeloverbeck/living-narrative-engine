import { describe, it, expect } from '@jest/globals';
import {
  describeEntityManagerSuite,
  TestData,
} from '../../common/entities/index.js';
import { runInvalidIdPairTests } from '../../common/entities/index.js';

describeEntityManagerSuite('EntityManager - getComponentData', (getBed) => {
  describe('getComponentData', () => {
    it('should return component data if the component exists on the definition', () => {
      // Arrange
      const { entityManager } = getBed();
      const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      getBed().createBasicEntity({ instanceId: PRIMARY });
      const expectedData = TestData.Definitions.basic.components['core:name'];

      // Act
      const data = entityManager.getComponentData(PRIMARY, NAME_COMPONENT_ID);

      // Assert
      expect(data).toEqual(expectedData);
    });

    it('should return overridden data if the component is overridden on the instance', () => {
      // Arrange
      const { entityManager } = getBed();
      const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      const overrideData = { name: 'Override' };
      getBed().createEntityWithOverrides(
        'basic',
        { [NAME_COMPONENT_ID]: overrideData },
        { instanceId: PRIMARY }
      );

      // Act
      const data = entityManager.getComponentData(PRIMARY, NAME_COMPONENT_ID);

      // Assert
      expect(data).toEqual(overrideData);
    });

    it('should return undefined for a non-existent component', () => {
      // Arrange
      const { entityManager } = getBed();
      const { PRIMARY } = TestData.InstanceIDs;
      getBed().createBasicEntity({ instanceId: PRIMARY });

      // Act
      const data = entityManager.getComponentData(PRIMARY, 'non:existent');

      // Assert
      expect(data).toBeUndefined();
    });

    it('should return undefined for a non-existent entity instance', () => {
      // Arrange
      const { entityManager } = getBed();
      const { GHOST } = TestData.InstanceIDs;

      // Act
      const data = entityManager.getComponentData(GHOST, 'any:component');

      // Assert
      expect(data).toBeUndefined();
    });

    runInvalidIdPairTests(getBed, (em, instanceId, componentTypeId) =>
      em.getComponentData(instanceId, componentTypeId)
    );
  });

  // ----------------------------------------------------------------------//
  //
  //                          hasComponent
  //
  // ----------------------------------------------------------------------//
});
