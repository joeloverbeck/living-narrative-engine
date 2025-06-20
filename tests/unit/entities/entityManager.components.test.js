/**
 * @file This file consolidates all tests for the EntityManager's component-level
 * manipulation methods: addComponent, removeComponent, getComponentData, and hasComponent.
 * It exclusively uses the TestBed helper for all setup to ensure consistency and reduce boilerplate.
 * @see tests/unit/entities/entityManager.components.test.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { TestBed, TestData } from '../../common/entities/testBed.js';
import { EntityNotFoundError } from '../../../src/errors/entityNotFoundError.js';
import {
  COMPONENT_ADDED_ID,
  COMPONENT_REMOVED_ID,
} from '../../../src/constants/eventIds.js';

describe('EntityManager - Component Manipulation', () => {
  let testBed;

  beforeEach(() => {
    testBed = new TestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

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
      const { entityManager, mocks } = testBed;
      const { BASIC } = TestData.DefinitionIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      testBed.setupDefinitions(TestData.Definitions.basic);
      const entity = entityManager.createEntityInstance(BASIC, {
        instanceId: PRIMARY,
      });
      mocks.eventDispatcher.dispatch.mockClear(); // Clear events from creation

      // Act
      const result = entityManager.addComponent(
        PRIMARY,
        NEW_COMPONENT_ID,
        NEW_COMPONENT_DATA
      );

      // Assert
      expect(result).toBe(true);
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
      const { entityManager, mocks } = testBed;
      const { BASIC } = TestData.DefinitionIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      testBed.setupDefinitions(TestData.Definitions.basic);
      const entity = entityManager.createEntityInstance(BASIC, {
        instanceId: PRIMARY,
      });
      mocks.eventDispatcher.dispatch.mockClear();

      // Act
      entityManager.addComponent(PRIMARY, NEW_COMPONENT_ID, NEW_COMPONENT_DATA);

      // Assert
      expect(mocks.eventDispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(mocks.eventDispatcher.dispatch).toHaveBeenCalledWith(
        COMPONENT_ADDED_ID,
        {
          entity: entity,
          componentTypeId: NEW_COMPONENT_ID,
          componentData: NEW_COMPONENT_DATA,
          oldComponentData: undefined,
        }
      );
    });

    it('should update an existing component and return true', () => {
      // Arrange
      const { entityManager } = testBed;
      const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
      const { BASIC } = TestData.DefinitionIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      const UPDATED_NAME_DATA = { name: 'Updated Name' };

      testBed.setupDefinitions(TestData.Definitions.basic);
      entityManager.createEntityInstance(BASIC, { instanceId: PRIMARY });

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
      const { entityManager, mocks } = testBed;
      const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
      const { BASIC } = TestData.DefinitionIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      const UPDATED_NAME_DATA = { name: 'Updated Name' };

      testBed.setupDefinitions(TestData.Definitions.basic);
      const entity = entityManager.createEntityInstance(BASIC, {
        instanceId: PRIMARY,
      });
      const originalNameData = entity.getComponentData(NAME_COMPONENT_ID);
      mocks.eventDispatcher.dispatch.mockClear();

      // Act
      entityManager.addComponent(PRIMARY, NAME_COMPONENT_ID, UPDATED_NAME_DATA);

      // Assert
      expect(mocks.eventDispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(mocks.eventDispatcher.dispatch).toHaveBeenCalledWith(
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
      const { entityManager } = testBed;
      const { GHOST } = TestData.InstanceIDs; // Assuming a non-existent ID

      // Act & Assert
      expect(() =>
        entityManager.addComponent(GHOST, NEW_COMPONENT_ID, NEW_COMPONENT_DATA)
      ).toThrow(new EntityNotFoundError(GHOST));
    });

    it('should throw an error if component validation fails', () => {
      // Arrange
      const { entityManager, mocks } = testBed;
      const { BASIC } = TestData.DefinitionIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      testBed.setupDefinitions(TestData.Definitions.basic);
      entityManager.createEntityInstance(BASIC, { instanceId: PRIMARY });
      mocks.eventDispatcher.dispatch.mockClear(); // FIX: Clear dispatcher after setup

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
      const { entityManager, mocks } = testBed;
      const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
      const { BASIC } = TestData.DefinitionIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      testBed.setupDefinitions(TestData.Definitions.basic);
      entityManager.createEntityInstance(BASIC, { instanceId: PRIMARY });

      // Act & Assert
      expect(() =>
        entityManager.addComponent(PRIMARY, NAME_COMPONENT_ID, null)
      ).not.toThrow();
      expect(mocks.validator.validate).not.toHaveBeenCalled();
      expect(
        entityManager.getComponentData(PRIMARY, NAME_COMPONENT_ID)
      ).toBeNull();
    });

    it.each([
      ['undefined', undefined],
      ['a string', 'bad-data'],
      ['a number', 123],
      ['a boolean', false],
    ])(
      'should throw a descriptive error when componentData is %s',
      (desc, value) => {
        // Arrange
        const { entityManager, mocks } = testBed;
        const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
        const { BASIC } = TestData.DefinitionIDs;
        const { PRIMARY } = TestData.InstanceIDs;
        testBed.setupDefinitions(TestData.Definitions.basic);
        entityManager.createEntityInstance(BASIC, { instanceId: PRIMARY });
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

    it.each([
      ['instanceId', null, 'comp:id'],
      ['instanceId', '', 'comp:id'],
      ['componentTypeId', 'instance:id', null],
      ['componentTypeId', 'instance:id', '  '],
    ])(
      'should return false for invalid %s format',
      (param, instanceId, componentTypeId) => {
        const { entityManager, mocks } = testBed;
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
      const { entityManager, mocks } = testBed;
      const { BASIC } = TestData.DefinitionIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      testBed.setupDefinitions(TestData.Definitions.basic);
      const entity = entityManager.createEntityInstance(BASIC, {
        instanceId: PRIMARY,
      });
      // FIX: Clear dispatcher mock to ignore the ENTITY_CREATED event from setup.
      mocks.eventDispatcher.dispatch.mockClear();

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
      const { entityManager } = testBed;
      const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
      const { BASIC } = TestData.DefinitionIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      testBed.setupDefinitions(TestData.Definitions.basic);

      // Add component as an override
      const entity = entityManager.createEntityInstance(BASIC, {
        instanceId: PRIMARY,
      });
      entityManager.addComponent(PRIMARY, NAME_COMPONENT_ID, {
        name: 'Override',
      });
      expect(entityManager.hasComponent(PRIMARY, NAME_COMPONENT_ID, true)).toBe(
        true
      );

      // Act
      const result = entityManager.removeComponent(PRIMARY, NAME_COMPONENT_ID);

      // Assert
      expect(result).toBe(true);
      expect(entityManager.hasComponent(PRIMARY, NAME_COMPONENT_ID, true)).toBe(
        false
      );
    });

    it('should dispatch a COMPONENT_REMOVED event with the old data', () => {
      // Arrange
      const { entityManager, mocks } = testBed;
      const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
      const { BASIC } = TestData.DefinitionIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      const overrideData = { name: 'ToBeRemoved' };
      testBed.setupDefinitions(TestData.Definitions.basic);
      const entity = entityManager.createEntityInstance(BASIC, {
        instanceId: PRIMARY,
      });
      entityManager.addComponent(PRIMARY, NAME_COMPONENT_ID, overrideData);
      mocks.eventDispatcher.dispatch.mockClear();

      // Act
      entityManager.removeComponent(PRIMARY, NAME_COMPONENT_ID);

      // Assert
      expect(mocks.eventDispatcher.dispatch).toHaveBeenCalledTimes(1);
      expect(mocks.eventDispatcher.dispatch).toHaveBeenCalledWith(
        COMPONENT_REMOVED_ID,
        {
          entity: entity,
          componentTypeId: NAME_COMPONENT_ID,
          oldComponentData: overrideData,
        }
      );
    });

    it('should return false if component is not an override on the instance', () => {
      // Arrange
      const { entityManager, mocks } = testBed;
      const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
      const { BASIC } = TestData.DefinitionIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      testBed.setupDefinitions(TestData.Definitions.basic);
      entityManager.createEntityInstance(BASIC, { instanceId: PRIMARY });
      // NAME_COMPONENT_ID exists on definition, but not as an override
      mocks.eventDispatcher.dispatch.mockClear();

      // Act
      const result = entityManager.removeComponent(PRIMARY, NAME_COMPONENT_ID);

      // Assert
      expect(result).toBe(false);
      expect(mocks.eventDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should throw EntityNotFoundError for a non-existent entity', () => {
      // Arrange
      const { entityManager } = testBed;
      const { GHOST } = TestData.InstanceIDs;
      const { NAME_COMPONENT_ID } = TestData.ComponentIDs;

      // Act & Assert
      expect(() =>
        entityManager.removeComponent(GHOST, NAME_COMPONENT_ID)
      ).toThrow(new EntityNotFoundError(GHOST));
    });

    it.each([
      ['instanceId', null, 'comp:id'],
      ['instanceId', '', 'comp:id'],
      ['componentTypeId', 'instance:id', null],
      ['componentTypeId', 'instance:id', '  '],
    ])(
      'should return false for invalid %s format',
      (param, instanceId, componentTypeId) => {
        const { entityManager, mocks } = testBed;
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
      const { entityManager } = testBed;
      const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
      const { BASIC } = TestData.DefinitionIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      testBed.setupDefinitions(TestData.Definitions.basic);
      entityManager.createEntityInstance(BASIC, { instanceId: PRIMARY });
      const expectedData = TestData.Definitions.basic.components['core:name'];

      // Act
      const data = entityManager.getComponentData(PRIMARY, NAME_COMPONENT_ID);

      // Assert
      expect(data).toEqual(expectedData);
    });

    it('should return overridden data if the component is overridden on the instance', () => {
      // Arrange
      const { entityManager } = testBed;
      const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
      const { BASIC } = TestData.DefinitionIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      const overrideData = { name: 'Overridden Name' };
      testBed.setupDefinitions(TestData.Definitions.basic);
      entityManager.createEntityInstance(BASIC, {
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
      const { entityManager } = testBed;
      const { BASIC } = TestData.DefinitionIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      testBed.setupDefinitions(TestData.Definitions.basic);
      entityManager.createEntityInstance(BASIC, { instanceId: PRIMARY });

      // Act
      const data = entityManager.getComponentData(PRIMARY, 'non:existent');

      // Assert
      expect(data).toBeUndefined();
    });

    it('should return undefined for a non-existent entity instance', () => {
      // Arrange
      const { entityManager } = testBed;
      const { GHOST } = TestData.InstanceIDs;
      const { NAME_COMPONENT_ID } = TestData.ComponentIDs;

      // Act
      const data = entityManager.getComponentData(GHOST, NAME_COMPONENT_ID);

      // Assert
      expect(data).toBeUndefined();
    });

    it.each([
      ['instanceId', null, 'comp:id'],
      ['instanceId', '', 'comp:id'],
      ['componentTypeId', 'instance:id', null],
      ['componentTypeId', 'instance:id', ' '],
    ])(
      'should return undefined for invalid %s format',
      (param, instanceId, componentTypeId) => {
        const { entityManager, mocks } = testBed;
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
      const { entityManager } = testBed;
      const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
      const { BASIC } = TestData.DefinitionIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      testBed.setupDefinitions(TestData.Definitions.basic);
      entityManager.createEntityInstance(BASIC, { instanceId: PRIMARY });

      // Act & Assert
      expect(entityManager.hasComponent(PRIMARY, NAME_COMPONENT_ID)).toBe(true);
    });

    it('should return true if the component is added as an override', () => {
      // Arrange
      const { entityManager } = testBed;
      const { BASIC } = TestData.DefinitionIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      const NEW_COMPONENT_ID = 'core:health';
      testBed.setupDefinitions(TestData.Definitions.basic);
      entityManager.createEntityInstance(BASIC, {
        instanceId: PRIMARY,
        componentOverrides: { [NEW_COMPONENT_ID]: { hp: 10 } },
      });

      // Act & Assert
      expect(entityManager.hasComponent(PRIMARY, NEW_COMPONENT_ID)).toBe(true);
    });

    it('should return false if the component does not exist', () => {
      // Arrange
      const { entityManager } = testBed;
      const { BASIC } = TestData.DefinitionIDs;
      const { PRIMARY } = TestData.InstanceIDs; // FIX: Was TestA
      testBed.setupDefinitions(TestData.Definitions.basic);
      entityManager.createEntityInstance(BASIC, { instanceId: PRIMARY });

      // Act & Assert
      expect(entityManager.hasComponent(PRIMARY, 'non:existent')).toBe(false);
    });

    it('should return false for a non-existent entity instance', () => {
      // Arrange
      const { entityManager } = testBed;
      const { GHOST } = TestData.InstanceIDs;
      const { NAME_COMPONENT_ID } = TestData.ComponentIDs;

      // Act & Assert
      expect(entityManager.hasComponent(GHOST, NAME_COMPONENT_ID)).toBe(false);
    });

    it.each([
      ['instanceId', null, 'comp:id'],
      ['instanceId', '', 'comp:id'],
      ['componentTypeId', 'instance:id', null],
      ['componentTypeId', 'instance:id', ' '],
    ])(
      'should return false for invalid %s format',
      (param, instanceId, componentTypeId) => {
        const { entityManager, mocks } = testBed;
        const result = entityManager.hasComponent(instanceId, componentTypeId);
        expect(result).toBe(false);
        expect(mocks.logger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Called with invalid')
        );
      }
    );

    describe('with checkOverrideOnly flag', () => {
      it('should return false if component is only on definition', () => {
        // Arrange
        const { entityManager } = testBed;
        const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
        const { BASIC } = TestData.DefinitionIDs;
        const { PRIMARY } = TestData.InstanceIDs;
        testBed.setupDefinitions(TestData.Definitions.basic);
        entityManager.createEntityInstance(BASIC, { instanceId: PRIMARY });

        // Act & Assert
        expect(
          entityManager.hasComponent(PRIMARY, NAME_COMPONENT_ID, true)
        ).toBe(false);
      });

      it('should return true if component is an override', () => {
        // Arrange
        const { entityManager } = testBed;
        const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
        const { BASIC } = TestData.DefinitionIDs;
        const { PRIMARY } = TestData.InstanceIDs;
        testBed.setupDefinitions(TestData.Definitions.basic);
        entityManager.createEntityInstance(BASIC, {
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
});
