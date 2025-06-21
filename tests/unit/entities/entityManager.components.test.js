/**
 * @file This file consolidates all tests for the EntityManager's component-level
 * manipulation methods: addComponent, removeComponent, getComponentData, and hasComponent.
 * It exclusively uses the TestBed helper for all setup to ensure consistency and reduce boilerplate.
 * @see tests/unit/entities/entityManager.components.test.js
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  describeEntityManagerSuite,
  TestData,
} from '../../common/entities/index.js';
import { runInvalidIdPairTests } from '../../common/entities/index.js';
import { EntityNotFoundError } from '../../../src/errors/entityNotFoundError.js';
import { InvalidArgumentError } from '../../../src/errors/invalidArgumentError.js';
import { ValidationError } from '../../../src/errors/validationError.js';
import {
  COMPONENT_ADDED_ID,
  COMPONENT_REMOVED_ID,
} from '../../../src/constants/eventIds.js';
import { expectSingleDispatch } from '../../common/engine/dispatchTestUtils.js';

describeEntityManagerSuite(
  'EntityManager - Component Manipulation',
  (getBed) => {
    // ----------------------------------------------------------------------//
    //
    //                          addComponent
    //
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
        entityManager.addComponent(
          PRIMARY,
          NEW_COMPONENT_ID,
          NEW_COMPONENT_DATA
        );

        // Assert
        expect(entityManager.hasComponent(PRIMARY, NEW_COMPONENT_ID)).toBe(
          true
        );
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
        entityManager.addComponent(
          PRIMARY,
          NEW_COMPONENT_ID,
          NEW_COMPONENT_DATA
        );

        // Assert
        expectSingleDispatch(
          mocks.eventDispatcher.dispatch,
          COMPONENT_ADDED_ID,
          {
            entity: entity,
            componentTypeId: NEW_COMPONENT_ID,
            componentData: NEW_COMPONENT_DATA,
            oldComponentData: undefined,
          }
        );
      });

      it('should update an existing component', () => {
        // Arrange
        const { entityManager } = getBed();
        const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
        const { PRIMARY } = TestData.InstanceIDs;
        const UPDATED_NAME_DATA = { name: 'Updated Name' };

        getBed().createEntity('basic', { instanceId: PRIMARY });

        // Act
        entityManager.addComponent(
          PRIMARY,
          NAME_COMPONENT_ID,
          UPDATED_NAME_DATA
        );

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
        entityManager.addComponent(
          PRIMARY,
          NAME_COMPONENT_ID,
          UPDATED_NAME_DATA
        );

        // Assert
        expectSingleDispatch(
          mocks.eventDispatcher.dispatch,
          COMPONENT_ADDED_ID,
          {
            entity: entity,
            componentTypeId: NAME_COMPONENT_ID,
            componentData: UPDATED_NAME_DATA,
            oldComponentData: originalNameData,
          }
        );
      });

      it('should throw EntityNotFoundError for a non-existent entity', () => {
        // Arrange
        const { entityManager } = getBed();
        const { GHOST } = TestData.InstanceIDs; // Assuming a non-existent ID

        // Act & Assert
        expect(() =>
          entityManager.addComponent(
            GHOST,
            NEW_COMPONENT_ID,
            NEW_COMPONENT_DATA
          )
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
        getBed().createEntity('basic', { instanceId: PRIMARY });

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
      )(
        'should throw InvalidArgumentError when componentData is %p',
        (value) => {
          // Arrange
          const { entityManager, mocks } = getBed();
          const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
          const { PRIMARY } = TestData.InstanceIDs;
          getBed().createEntity('basic', { instanceId: PRIMARY });
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
        }
      );

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
        expect(() =>
          entityManager.addComponent(PRIMARY, 'any:comp', {})
        ).toThrow(
          "Failed to add component 'any:comp' to entity 'test-instance-01'. Internal entity update failed."
        );
        expect(mocks.logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('entity.addComponent returned false')
        );
        expect(mocks.eventDispatcher.dispatch).not.toHaveBeenCalled();

        addComponentSpy.mockRestore();
      });
    });

    // ----------------------------------------------------------------------//
    //
    //                          removeComponent
    //
    // ----------------------------------------------------------------------//
    describe('removeComponent', () => {
      it('should remove an existing component override', () => {
        // Arrange
        const { entityManager } = getBed();
        const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
        const { PRIMARY } = TestData.InstanceIDs;

        // Add component as an override
        getBed().createEntity('basic', {
          instanceId: PRIMARY,
        });
        entityManager.addComponent(PRIMARY, NAME_COMPONENT_ID, {
          name: 'Override',
        });
        expect(
          entityManager.hasComponent(PRIMARY, NAME_COMPONENT_ID, true)
        ).toBe(true);

        // Act
        entityManager.removeComponent(PRIMARY, NAME_COMPONENT_ID);

        // Assert
        expect(
          entityManager.hasComponent(PRIMARY, NAME_COMPONENT_ID, true)
        ).toBe(false);
      });

      it('should dispatch a COMPONENT_REMOVED event with the old data', () => {
        // Arrange
        const { entityManager, mocks } = getBed();
        const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
        const { PRIMARY } = TestData.InstanceIDs;
        const overrideData = { name: 'ToBeRemoved' };
        const entity = getBed().createEntity(
          'basic',
          {
            instanceId: PRIMARY,
          },
          { resetDispatch: true }
        );
        entityManager.addComponent(PRIMARY, NAME_COMPONENT_ID, overrideData);
        getBed().resetDispatchMock();

        // Act
        entityManager.removeComponent(PRIMARY, NAME_COMPONENT_ID);

        // Assert
        expectSingleDispatch(
          mocks.eventDispatcher.dispatch,
          COMPONENT_REMOVED_ID,
          {
            entity: entity,
            componentTypeId: NAME_COMPONENT_ID,
            oldComponentData: overrideData,
          }
        );
      });

      it('should throw an error if component is not an override on the instance', () => {
        // Arrange
        const { entityManager, mocks } = getBed();
        const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
        const { PRIMARY } = TestData.InstanceIDs;
        getBed().createEntity(
          'basic',
          { instanceId: PRIMARY },
          { resetDispatch: true }
        );
        // NAME_COMPONENT_ID exists on definition, but not as an override

        // Act & Assert
        expect(() =>
          entityManager.removeComponent(PRIMARY, NAME_COMPONENT_ID)
        ).toThrow(
          "Component 'core:name' not found as an override on entity 'test-instance-01'. Nothing to remove at instance level."
        );
        expect(mocks.eventDispatcher.dispatch).not.toHaveBeenCalled();
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
    describe('getComponentData', () => {
      it('should return component data if the component exists on the definition', () => {
        // Arrange
        const { entityManager } = getBed();
        const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
        const { PRIMARY } = TestData.InstanceIDs;
        getBed().createEntity('basic', { instanceId: PRIMARY });
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
        getBed().createEntity('basic', { instanceId: PRIMARY });
        entityManager.addComponent(PRIMARY, NAME_COMPONENT_ID, overrideData);

        // Act
        const data = entityManager.getComponentData(PRIMARY, NAME_COMPONENT_ID);

        // Assert
        expect(data).toEqual(overrideData);
      });

      it('should return undefined for a non-existent component', () => {
        // Arrange
        const { entityManager } = getBed();
        const { PRIMARY } = TestData.InstanceIDs;
        getBed().createEntity('basic', { instanceId: PRIMARY });

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
    describe('hasComponent', () => {
      it('should return true if the component exists on the definition', () => {
        // Arrange
        const { entityManager } = getBed();
        const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
        const { PRIMARY } = TestData.InstanceIDs;
        getBed().createEntity('basic', { instanceId: PRIMARY });

        // Act
        const result = entityManager.hasComponent(PRIMARY, NAME_COMPONENT_ID);

        // Assert
        expect(result).toBe(true);
      });

      it('should return true if the component is added as an override', () => {
        // Arrange
        const { entityManager } = getBed();
        const { PRIMARY } = TestData.InstanceIDs;
        getBed().createEntity('basic', { instanceId: PRIMARY });

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
        getBed().createEntity('basic', { instanceId: PRIMARY });

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
          getBed().createEntity('basic', { instanceId: PRIMARY });

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
          getBed().createEntity('basic', { instanceId: PRIMARY });
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
          getBed().createEntity('basic', { instanceId: PRIMARY });

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
          getBed().createEntity('basic', { instanceId: PRIMARY });
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
  }
);
