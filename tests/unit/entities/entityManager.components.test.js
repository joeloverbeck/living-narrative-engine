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
} from '../../common/entities/testBed.js';
import { expectDispatchCalls } from '../../common/engine/dispatchTestUtils.js';
import { EntityNotFoundError } from '../../../src/errors/entityNotFoundError.js';
import {
  COMPONENT_ADDED_ID,
  COMPONENT_REMOVED_ID,
} from '../../../src/constants/eventIds.js';

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

      it('should add a new component to an existing entity and return true', () => {
        // Arrange
        const { entityManager } = getBed();
        const { PRIMARY } = TestData.InstanceIDs;
        getBed().createEntity('basic', {
          instanceId: PRIMARY,
        });
        getBed().resetDispatchMock();

        // Act
        const result = entityManager.addComponent(
          PRIMARY,
          NEW_COMPONENT_ID,
          NEW_COMPONENT_DATA
        );

        // Assert
        expect(result).toBe(true);
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
        const entity = getBed().createEntity('basic', {
          instanceId: PRIMARY,
        });
        getBed().resetDispatchMock();

        // Act
        entityManager.addComponent(
          PRIMARY,
          NEW_COMPONENT_ID,
          NEW_COMPONENT_DATA
        );

        // Assert
        expectDispatchCalls(mocks.eventDispatcher.dispatch, [
          [
            COMPONENT_ADDED_ID,
            {
              entity: entity,
              componentTypeId: NEW_COMPONENT_ID,
              componentData: NEW_COMPONENT_DATA,
              oldComponentData: undefined,
            },
          ],
        ]);
      });

      it('should update an existing component and return true', () => {
        // Arrange
        const { entityManager } = getBed();
        const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
        const { PRIMARY } = TestData.InstanceIDs;
        const UPDATED_NAME_DATA = { name: 'Updated Name' };

        getBed().createEntity('basic', { instanceId: PRIMARY });

        // Act
        const result = entityManager.addComponent(
          PRIMARY,
          NAME_COMPONENT_ID,
          UPDATED_NAME_DATA
        );

        // Assert
        expect(result).toBe(true);
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

        const entity = getBed().createEntity('basic', {
          instanceId: PRIMARY,
        });
        const originalNameData = entity.getComponentData(NAME_COMPONENT_ID);
        getBed().resetDispatchMock();

        // Act
        entityManager.addComponent(
          PRIMARY,
          NAME_COMPONENT_ID,
          UPDATED_NAME_DATA
        );

        // Assert
        expectDispatchCalls(mocks.eventDispatcher.dispatch, [
          [
            COMPONENT_ADDED_ID,
            {
              entity: entity,
              componentTypeId: NAME_COMPONENT_ID,
              componentData: UPDATED_NAME_DATA,
              oldComponentData: originalNameData,
            },
          ],
        ]);
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

      it('should throw an error if component validation fails', () => {
        // Arrange
        const { entityManager, mocks } = getBed();
        const { PRIMARY } = TestData.InstanceIDs;
        getBed().createEntity('basic', { instanceId: PRIMARY });
        getBed().resetDispatchMock();

        const validationErrors = [{ message: 'Invalid data' }];
        mocks.validator.validate.mockReturnValue({
          isValid: false,
          errors: validationErrors,
        });

        // Act & Assert
        const expectedDetails = JSON.stringify(validationErrors, null, 2);
        expect(() => {
          entityManager.addComponent(
            PRIMARY,
            NEW_COMPONENT_ID,
            NEW_COMPONENT_DATA
          );
        }).toThrow(
          `addComponent ${NEW_COMPONENT_ID} to entity ${PRIMARY} Errors:\n${expectedDetails}`
        );
        expect(mocks.eventDispatcher.dispatch).not.toHaveBeenCalled();
      });

      it('should correctly handle null componentData without throwing or validating', () => {
        // Arrange
        const { entityManager, mocks } = getBed();
        const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
        const { PRIMARY } = TestData.InstanceIDs;
        getBed().createEntity('basic', { instanceId: PRIMARY });

        // Act & Assert
        expect(() =>
          entityManager.addComponent(PRIMARY, NAME_COMPONENT_ID, null)
        ).not.toThrow();
        expect(mocks.validator.validate).not.toHaveBeenCalled();
        expect(
          entityManager.getComponentData(PRIMARY, NAME_COMPONENT_ID)
        ).toBeNull();
      });

      it.each(
        TestData.InvalidValues.componentDataNotObject.filter(
          (v) => v !== null && !Array.isArray(v)
        )
      )(
        'should throw a descriptive error when componentData is %p',
        (value) => {
          // Arrange
          const { entityManager, mocks } = getBed();
          const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
          const { PRIMARY } = TestData.InstanceIDs;
          getBed().createEntity('basic', { instanceId: PRIMARY });
          const receivedType = typeof value;
          const expectedError = `EntityManager.addComponent: componentData for ${NAME_COMPONENT_ID} on ${PRIMARY} must be an object or null. Received: ${receivedType}`;

          // Act & Assert
          expect(() =>
            entityManager.addComponent(PRIMARY, NAME_COMPONENT_ID, value)
          ).toThrow(expectedError);
          expect(mocks.logger.error).toHaveBeenCalledWith(expectedError, {
            componentTypeId: NAME_COMPONENT_ID,
            instanceId: PRIMARY,
            receivedType: receivedType,
          });
        }
      );

      it.each(TestData.InvalidValues.invalidIdPairs)(
        'should return false for invalid inputs',
        (instanceId, componentTypeId) => {
          const { entityManager, mocks } = getBed();
          const result = entityManager.addComponent(
            instanceId,
            componentTypeId,
            {}
          );
          expect(result).toBe(false);
          expect(mocks.logger.warn).toHaveBeenCalled();
        }
      );

      it('should return false if the internal entity update fails', () => {
        // Arrange
        const { entityManager, mocks } = getBed();
        const { PRIMARY } = TestData.InstanceIDs;
        const entity = getBed().createEntity('basic', {
          instanceId: PRIMARY,
        });
        // Clear dispatcher mock to ignore the ENTITY_CREATED event from setup.
        getBed().resetDispatchMock();

        // Mock the entity's own method to simulate an internal failure
        const addComponentSpy = jest
          .spyOn(entity, 'addComponent')
          .mockReturnValue(false);

        // Act
        const result = entityManager.addComponent(PRIMARY, 'any:comp', {});

        // Assert
        expect(result).toBe(false);
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
      it('should remove an existing component override and return true', () => {
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
        const result = entityManager.removeComponent(
          PRIMARY,
          NAME_COMPONENT_ID
        );

        // Assert
        expect(result).toBe(true);
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
        const entity = getBed().createEntity('basic', {
          instanceId: PRIMARY,
        });
        entityManager.addComponent(PRIMARY, NAME_COMPONENT_ID, overrideData);
        getBed().resetDispatchMock();

        // Act
        entityManager.removeComponent(PRIMARY, NAME_COMPONENT_ID);

        // Assert
        expectDispatchCalls(mocks.eventDispatcher.dispatch, [
          [
            COMPONENT_REMOVED_ID,
            {
              entity: entity,
              componentTypeId: NAME_COMPONENT_ID,
              oldComponentData: overrideData,
            },
          ],
        ]);
      });

      it('should return false if component is not an override on the instance', () => {
        // Arrange
        const { entityManager, mocks } = getBed();
        const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
        const { PRIMARY } = TestData.InstanceIDs;
        getBed().createEntity('basic', { instanceId: PRIMARY });
        // NAME_COMPONENT_ID exists on definition, but not as an override
        getBed().resetDispatchMock();

        // Act
        const result = entityManager.removeComponent(
          PRIMARY,
          NAME_COMPONENT_ID
        );

        // Assert
        expect(result).toBe(false);
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

      it.each(TestData.InvalidValues.invalidIdPairs)(
        'should return false for invalid inputs',
        (instanceId, componentTypeId) => {
          const { entityManager, mocks } = getBed();
          const result = entityManager.removeComponent(
            instanceId,
            componentTypeId
          );
          expect(result).toBe(false);
          expect(mocks.logger.warn).toHaveBeenCalledWith(
            expect.stringContaining('Invalid')
          );
        }
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
        const overrideData = { name: 'Overridden Name' };
        getBed().createEntity('basic', {
          instanceId: PRIMARY,
          componentOverrides: { [NAME_COMPONENT_ID]: overrideData },
        });

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
        const { NAME_COMPONENT_ID } = TestData.ComponentIDs;

        // Act
        const data = entityManager.getComponentData(GHOST, NAME_COMPONENT_ID);

        // Assert
        expect(data).toBeUndefined();
      });

      it.each(TestData.InvalidValues.invalidIdPairs)(
        'should return undefined for invalid inputs',
        (instanceId, componentTypeId) => {
          const { entityManager, mocks } = getBed();
          const result = entityManager.getComponentData(
            instanceId,
            componentTypeId
          );
          expect(result).toBeUndefined();
          expect(mocks.logger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Called with invalid')
          );
        }
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

        // Act & Assert
        expect(entityManager.hasComponent(PRIMARY, NAME_COMPONENT_ID)).toBe(
          true
        );
      });

      it('should return true if the component is added as an override', () => {
        // Arrange
        const { entityManager } = getBed();
        const { PRIMARY } = TestData.InstanceIDs;
        const NEW_COMPONENT_ID = 'core:health';
        getBed().createEntity('basic', {
          instanceId: PRIMARY,
          componentOverrides: { [NEW_COMPONENT_ID]: { hp: 10 } },
        });

        // Act & Assert
        expect(entityManager.hasComponent(PRIMARY, NEW_COMPONENT_ID)).toBe(
          true
        );
      });

      it('should return false if the component does not exist', () => {
        // Arrange
        const { entityManager } = getBed();
        const { PRIMARY } = TestData.InstanceIDs; // FIX: Was TestA
        getBed().createEntity('basic', { instanceId: PRIMARY });

        // Act & Assert
        expect(entityManager.hasComponent(PRIMARY, 'non:existent')).toBe(false);
      });

      it('should return false for a non-existent entity instance', () => {
        // Arrange
        const { entityManager } = getBed();
        const { GHOST } = TestData.InstanceIDs;
        const { NAME_COMPONENT_ID } = TestData.ComponentIDs;

        // Act & Assert
        expect(entityManager.hasComponent(GHOST, NAME_COMPONENT_ID)).toBe(
          false
        );
      });

      it.each(TestData.InvalidValues.invalidIdPairs)(
        'should return false for invalid inputs',
        (instanceId, componentTypeId) => {
          const { entityManager, mocks } = getBed();
          const result = entityManager.hasComponent(
            instanceId,
            componentTypeId
          );
          expect(result).toBe(false);
          expect(mocks.logger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Called with invalid')
          );
        }
      );

      describe('with checkOverrideOnly flag', () => {
        it('should return false if component is only on definition', () => {
          // Arrange
          const { entityManager } = getBed();
          const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
          const { PRIMARY } = TestData.InstanceIDs;
          getBed().createEntity('basic', { instanceId: PRIMARY });

          // Act & Assert
          expect(
            entityManager.hasComponent(PRIMARY, NAME_COMPONENT_ID, true)
          ).toBe(false);
        });

        it('should return true if component is an override', () => {
          // Arrange
          const { entityManager } = getBed();
          const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
          const { PRIMARY } = TestData.InstanceIDs;
          getBed().createEntity('basic', {
            instanceId: PRIMARY,
            componentOverrides: { [NAME_COMPONENT_ID]: { name: 'Override' } },
          });

          // Act & Assert
          expect(
            entityManager.hasComponent(PRIMARY, NAME_COMPONENT_ID, true)
          ).toBe(true);
        });
      });
    });
  }
);
