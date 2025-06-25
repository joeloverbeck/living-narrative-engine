import { describe, it, expect, jest } from '@jest/globals';
import {
  describeEntityManagerSuite,
  TestData,
} from '../../common/entities/index.js';
import { runInvalidIdPairTests } from '../../common/entities/index.js';
import { EntityNotFoundError } from '../../../src/errors/entityNotFoundError.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { ValidationError } from '../../../src/errors/validationError.js';
import { expectComponentAddedDispatch } from '../../common/engine/dispatchTestUtils.js';

describeEntityManagerSuite('EntityManager - addComponent', (getBed) => {
  // ----------------------------------------------------------------------//
  describe('addComponent', () => {
    const NEW_COMPONENT_ID = 'core:health';
    const NEW_COMPONENT_DATA = { current: 100, max: 100 };

    it('should add a new component to an existing entity', () => {
      // Arrange
      const { entityManager } = getBed();
      const { PRIMARY } = TestData.InstanceIDs;
      getBed().createEntity(
        'basic',
        {
          instanceId: PRIMARY,
        },
        { resetDispatch: true }
      );

      // Act
      entityManager.addComponent(PRIMARY, NEW_COMPONENT_ID, NEW_COMPONENT_DATA);

      // Assert
      expect(entityManager.hasComponent(PRIMARY, NEW_COMPONENT_ID)).toBe(true);
      const addedData = entityManager.getComponentData(
        PRIMARY,
        NEW_COMPONENT_ID
      );
      expect(addedData).toEqual(NEW_COMPONENT_DATA);
      expect(addedData).not.toBe(NEW_COMPONENT_DATA); // Ensure it's a clone
    });

    it('should dispatch a COMPONENT_ADDED event with undefined old data for a new component', () => {
      // Arrange
      const { entityManager, mocks } = getBed();
      const { PRIMARY } = TestData.InstanceIDs;
      const entity = getBed().createEntity(
        'basic',
        {
          instanceId: PRIMARY,
        },
        { resetDispatch: true }
      );

      // Act
      entityManager.addComponent(PRIMARY, NEW_COMPONENT_ID, NEW_COMPONENT_DATA);

      // Assert
      expectComponentAddedDispatch(
        mocks.eventDispatcher.dispatch,
        entity,
        NEW_COMPONENT_ID,
        NEW_COMPONENT_DATA,
        undefined
      );
    });

    it('should update an existing component', () => {
      // Arrange
      const { entityManager } = getBed();
      const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      const UPDATED_NAME_DATA = { name: 'Updated Name' };

      getBed().createBasicEntity({ instanceId: PRIMARY });

      // Act
      entityManager.addComponent(PRIMARY, NAME_COMPONENT_ID, UPDATED_NAME_DATA);

      // Assert
      const updatedData = entityManager.getComponentData(
        PRIMARY,
        NAME_COMPONENT_ID
      );
      expect(updatedData).toEqual(UPDATED_NAME_DATA);
    });

    it('should dispatch a COMPONENT_ADDED event with the previous data for an updated component', () => {
      // Arrange
      const { entityManager, mocks } = getBed();
      const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      const UPDATED_NAME_DATA = { name: 'Updated Name' };

      const entity = getBed().createEntity(
        'basic',
        {
          instanceId: PRIMARY,
        },
        { resetDispatch: true }
      );
      const originalNameData = entity.getComponentData(NAME_COMPONENT_ID);

      // Act
      entityManager.addComponent(PRIMARY, NAME_COMPONENT_ID, UPDATED_NAME_DATA);

      // Assert
      expectComponentAddedDispatch(
        mocks.eventDispatcher.dispatch,
        entity,
        NAME_COMPONENT_ID,
        UPDATED_NAME_DATA,
        originalNameData
      );
    });

    it('should throw EntityNotFoundError for a non-existent entity', () => {
      // Arrange
      const { entityManager } = getBed();
      const { GHOST } = TestData.InstanceIDs; // Assuming a non-existent ID

      // Act & Assert
      expect(() =>
        entityManager.addComponent(GHOST, NEW_COMPONENT_ID, NEW_COMPONENT_DATA)
      ).toThrow(new EntityNotFoundError(GHOST));
    });

    it('should throw ValidationError if component validation fails', () => {
      // Arrange
      const { entityManager, mocks } = getBed();
      const { PRIMARY } = TestData.InstanceIDs;
      getBed().createEntity(
        'basic',
        { instanceId: PRIMARY },
        { resetDispatch: true }
      );

      const validationErrors = [{ message: 'Invalid data' }];
      mocks.validator.validate.mockReturnValue({
        isValid: false,
        errors: validationErrors,
      });

      // Act & Assert
      expect(() => {
        entityManager.addComponent(
          PRIMARY,
          NEW_COMPONENT_ID,
          NEW_COMPONENT_DATA
        );
      }).toThrow(ValidationError);
      expect(mocks.eventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should throw InvalidArgumentError when componentData is null', () => {
      // Arrange
      const { entityManager, mocks } = getBed();
      const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      getBed().createBasicEntity({ instanceId: PRIMARY });

      // Act & Assert
      expect(() =>
        entityManager.addComponent(PRIMARY, NAME_COMPONENT_ID, null)
      ).toThrow(InvalidArgumentError);
      expect(mocks.validator.validate).not.toHaveBeenCalled();
    });

    it.each(
      TestData.InvalidValues.componentDataNotObject.filter(
        (v) => v !== null && !Array.isArray(v)
      )
    )('should throw InvalidArgumentError when componentData is %p', (value) => {
      // Arrange
      const { entityManager, mocks } = getBed();
      const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      getBed().createBasicEntity({ instanceId: PRIMARY });
      const receivedType = typeof value;
      const expectedError = `EntityManager.addComponent: componentData for ${NAME_COMPONENT_ID} on ${PRIMARY} must be an object. Received: ${receivedType}`;

      // Act & Assert
      expect(() =>
        entityManager.addComponent(PRIMARY, NAME_COMPONENT_ID, value)
      ).toThrow(InvalidArgumentError);
      expect(mocks.logger.error).toHaveBeenCalledWith(expectedError, {
        componentTypeId: NAME_COMPONENT_ID,
        instanceId: PRIMARY,
        receivedType: receivedType,
      });
    });

    runInvalidIdPairTests(getBed, (em, instanceId, componentTypeId) =>
      em.addComponent(instanceId, componentTypeId, {})
    );

    it('should throw an error if the internal entity update fails', () => {
      // Arrange
      const { entityManager, mocks } = getBed();
      const { PRIMARY } = TestData.InstanceIDs;
      const entity = getBed().createEntity(
        'basic',
        {
          instanceId: PRIMARY,
        },
        { resetDispatch: true }
      );

      // Mock the entity's own method to simulate an internal failure
      const addComponentSpy = jest
        .spyOn(entity, 'addComponent')
        .mockReturnValue(false);

      // Act & Assert
      expect(() => entityManager.addComponent(PRIMARY, 'any:comp', {})).toThrow(
        "Failed to add component 'any:comp' to entity 'test-instance-01'. Internal entity update failed."
      );
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('entity.addComponent returned false')
      );
      expect(mocks.eventDispatcher.dispatch).not.toHaveBeenCalled();

      addComponentSpy.mockRestore();
    });
  });
});
