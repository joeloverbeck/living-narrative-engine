import { describe, it, expect } from '@jest/globals';
import {
  describeEntityManagerSuite,
  TestData,
} from '../../common/entities/index.js';
import { runInvalidIdPairTests } from '../../common/entities/index.js';
import { EntityNotFoundError } from '../../../src/errors/entityNotFoundError.js';
import { ComponentOverrideNotFoundError } from '../../../src/errors/componentOverrideNotFoundError.js';
import {
  expectComponentRemovedDispatch,
  expectNoDispatch,
} from '../../common/engine/dispatchTestUtils.js';

describeEntityManagerSuite('EntityManager - removeComponent', (getBed) => {
  describe('removeComponent', () => {
    it('should remove an existing component override', () => {
      // Arrange
      const { entityManager } = getBed();
      const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
      const { PRIMARY } = TestData.InstanceIDs;

      // Add component as an override
      getBed().createEntityWithOverrides('basic', {
        overrides: { [NAME_COMPONENT_ID]: { name: 'Override' } },
        instanceId: PRIMARY,
      });
      expect(
        entityManager.hasComponentOverride(PRIMARY, NAME_COMPONENT_ID)
      ).toBe(true);

      // Act
      entityManager.removeComponent(PRIMARY, NAME_COMPONENT_ID);

      // Assert
      expect(
        entityManager.hasComponentOverride(PRIMARY, NAME_COMPONENT_ID)
      ).toBe(false);
    });

    it('should dispatch a COMPONENT_REMOVED event with the old data', () => {
      // Arrange
      const { entityManager, mocks } = getBed();
      const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      const overrideData = { name: 'ToBeRemoved' };
      const entity = getBed().createEntityWithOverrides('basic', {
        overrides: { [NAME_COMPONENT_ID]: overrideData },
        instanceId: PRIMARY,
        resetDispatch: true,
      });

      // Act
      entityManager.removeComponent(PRIMARY, NAME_COMPONENT_ID);

      // Assert
      expectComponentRemovedDispatch(
        mocks.eventDispatcher.dispatch,
        entity,
        NAME_COMPONENT_ID,
        overrideData
      );
    });

    it('should throw an error if component is not an override on the instance', () => {
      // Arrange
      const { entityManager, mocks } = getBed();
      const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      getBed().createEntity('basic', {
        instanceId: PRIMARY,
        resetDispatch: true,
      });
      // NAME_COMPONENT_ID exists on definition, but not as an override

      // Act & Assert
      expect(() =>
        entityManager.removeComponent(PRIMARY, NAME_COMPONENT_ID)
      ).toThrow(ComponentOverrideNotFoundError);
      expectNoDispatch(mocks.eventDispatcher.dispatch);
    });

    it('should throw EntityNotFoundError for a non-existent entity', () => {
      // Arrange
      const { entityManager } = getBed();
      const { GHOST } = TestData.InstanceIDs;
      const { NAME_COMPONENT_ID } = TestData.ComponentIDs;

      // Act & Assert
      expect(() =>
        entityManager.removeComponent(GHOST, NAME_COMPONENT_ID)
      ).toThrow(new EntityNotFoundError(GHOST));
    });

    runInvalidIdPairTests(getBed, (em, instanceId, componentTypeId) =>
      em.removeComponent(instanceId, componentTypeId)
    );
  });

  // ----------------------------------------------------------------------//
  //
  //                          getComponentData
  //
  // ----------------------------------------------------------------------//
});
