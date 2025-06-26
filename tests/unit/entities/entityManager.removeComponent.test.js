import { describe, it, expect } from '@jest/globals';
import {
  describeEntityManagerSuite,
  TestData,
} from '../../common/entities/index.js';
import { runInvalidIdPairTests } from '../../common/entities/index.js';
import { EntityNotFoundError } from '../../../src/errors/entityNotFoundError.js';
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
      getBed().createEntityWithOverride(
        'basic',
        { [NAME_COMPONENT_ID]: { name: 'Override' } },
        { instanceId: PRIMARY }
      );
      expect(entityManager.hasComponent(PRIMARY, NAME_COMPONENT_ID, true)).toBe(
        true
      );

      // Act
      entityManager.removeComponent(PRIMARY, NAME_COMPONENT_ID);

      // Assert
      expect(entityManager.hasComponent(PRIMARY, NAME_COMPONENT_ID, true)).toBe(
        false
      );
    });

    it('should dispatch a COMPONENT_REMOVED event with the old data', () => {
      // Arrange
      const { entityManager, mocks } = getBed();
      const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      const overrideData = { name: 'ToBeRemoved' };
      const entity = getBed().createEntityWithOverride(
        'basic',
        { [NAME_COMPONENT_ID]: overrideData },
        { instanceId: PRIMARY, resetDispatch: true }
      );

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
      ).toThrow(
        "Component 'core:name' not found as an override on entity 'test-instance-01'. Nothing to remove at instance level."
      );
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
