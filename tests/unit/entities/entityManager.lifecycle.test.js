/**
 * @file This file consolidates all tests for the EntityManager's core lifecycle methods:
 * constructor, createEntityInstance, reconstructEntity, removeEntityInstance, and clearAll.
 * It exclusively uses the TestBed helper for setup to ensure consistency and reduce boilerplate.
 * @see src/entities/entityManager.js
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  describeEntityManagerSuite,
  TestData,
  TestBed,
} from '../../common/entities/testBed.js';
import Entity from '../../../src/entities/entity.js';
import { DefinitionNotFoundError } from '../../../src/errors/definitionNotFoundError.js';
import { EntityNotFoundError } from '../../../src/errors/entityNotFoundError.js';
import {
  ENTITY_CREATED_ID,
  ENTITY_REMOVED_ID,
} from '../../../src/constants/eventIds.js';
import { expectDispatchCalls } from '../../common/engine/dispatchTestUtils.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';
import MapManager from '../../../src/utils/mapManagerUtils.js';

describeEntityManagerSuite('EntityManager - Lifecycle', (getBed) => {
  describe('constructor', () => {
    it('should instantiate successfully via TestBed', () => {
      // The beforeEach hook already does this. If it fails, the test will crash.
      expect(getBed().entityManager).toBeInstanceOf(
        getBed().entityManager.constructor
      );
    });

    it('should throw an error if the data registry is missing or invalid', () => {
      const { validator, logger, eventDispatcher } = getBed().mocks;
      const EntityManager = getBed().entityManager.constructor;

      expect(
        () =>
          new EntityManager({
            registry: null,
            validator,
            logger,
            dispatcher: eventDispatcher,
          })
      ).toThrow('Missing required dependency: IDataRegistry.');
    });

    it('should throw an error if the schema validator is missing or invalid', () => {
      const { registry, logger, eventDispatcher } = getBed().mocks;
      const EntityManager = getBed().entityManager.constructor;

      expect(
        () =>
          new EntityManager({
            registry,
            validator: null,
            logger,
            dispatcher: eventDispatcher,
          })
      ).toThrow('Missing required dependency: ISchemaValidator.');
    });

    it('should use the injected idGenerator', () => {
      const mockIdGenerator = jest.fn();
      const localTestBed = new TestBed({ idGenerator: mockIdGenerator });
      // This test simply checks if the generator is stored,
      // createEntityInstance tests will check if it's *used*.
      // We can't directly access the private field, so we rely on functional tests.
      expect(localTestBed.entityManager).toBeDefined();
    });

    it('should default to a UUIDv4 generator if none is provided', () => {
      // Arrange
      const entity = getBed().createEntity('basic');

      // Assert
      // This is an indirect test. We can't check *which* function was used,
      // but we can check that the output conforms to the expected default (UUIDv4).
      expect(entity.id).toBeDefined();
      expect(typeof entity.id).toBe('string');
      // A simple regex to check for UUID v4 format.
      expect(entity.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });
  });

  describe('createEntityInstance', () => {
    const { BASIC } = TestData.DefinitionIDs;

    it('should create an entity with an ID from the injected generator if no instanceId is provided', () => {
      // Arrange
      const mockIdGenerator = () => 'test-entity-id-123';
      const localTestBed = new TestBed({ idGenerator: mockIdGenerator });

      const entity = localTestBed.createEntity('basic');

      // Assert
      expect(entity).toBeInstanceOf(Entity);
      expect(entity.id).toBe('test-entity-id-123');
      expect(entity.definitionId).toBe(BASIC);
    });

    it('should create an entity with a specific instanceId if provided, ignoring the generator', () => {
      // Arrange
      const mockIdGenerator = jest.fn(() => 'should-not-be-called');
      const localTestBed = new TestBed({ idGenerator: mockIdGenerator });
      const { PRIMARY } = TestData.InstanceIDs;

      const entity = localTestBed.createEntity('basic', {
        instanceId: PRIMARY,
      });

      // Assert
      expect(entity.id).toBe(PRIMARY);
      expect(entity).toBeInstanceOf(Entity);
      expect(mockIdGenerator).not.toHaveBeenCalled();
    });

    it('should dispatch an ENTITY_CREATED event upon successful creation', () => {
      // Arrange
      const { mocks } = getBed();

      const entity = getBed().createEntity('basic');

      // Assert
      expectDispatchCalls(mocks.eventDispatcher.dispatch, [
        [
          ENTITY_CREATED_ID,
          {
            entity,
            wasReconstructed: false,
          },
        ],
      ]);
    });

    it('should throw a DefinitionNotFoundError if the definitionId does not exist', () => {
      // Arrange
      const { entityManager } = getBed();
      const NON_EXISTENT_DEF_ID = 'non:existent';
      getBed().setupDefinitions(); // No definitions available

      // Act & Assert
      expect(() =>
        entityManager.createEntityInstance(NON_EXISTENT_DEF_ID)
      ).toThrow(new DefinitionNotFoundError(NON_EXISTENT_DEF_ID));
    });

    it('should throw an error if an entity with the provided instanceId already exists', () => {
      // Arrange
      const { entityManager } = getBed();
      const { PRIMARY } = TestData.InstanceIDs;
      getBed().createEntity('basic', { instanceId: PRIMARY }); // Create the first one

      // Act & Assert
      expect(() => {
        entityManager.createEntityInstance(BASIC, { instanceId: PRIMARY });
      }).toThrow(`Entity with ID '${PRIMARY}' already exists.`);
    });

    it('should throw a TypeError if definitionId is not a non-empty string', () => {
      // Arrange
      const { entityManager } = getBed();

      // Act & Assert
      expect(() => entityManager.createEntityInstance(null)).toThrow(TypeError);
      expect(() => entityManager.createEntityInstance(undefined)).toThrow(
        TypeError
      );
      expect(() => entityManager.createEntityInstance('')).toThrow(TypeError);
      expect(() => entityManager.createEntityInstance(123)).toThrow(TypeError);
      expect(() => entityManager.createEntityInstance({})).toThrow(TypeError);
    });

    it('should fetch and cache the EntityDefinition on first use', () => {
      // Arrange
      const { mocks } = getBed();

      // Act
      getBed().createEntity('basic', { instanceId: 'e1' });
      getBed().createEntity('basic', { instanceId: 'e2' });

      // Assert
      expect(mocks.registry.getEntityDefinition).toHaveBeenCalledTimes(1);
      expect(mocks.registry.getEntityDefinition).toHaveBeenCalledWith(BASIC);
    });

    it('should correctly apply component overrides', () => {
      // Arrange
      const overrides = {
        'core:description': { text: 'Overridden Description' },
        'new:component': { data: 'xyz' },
      };

      // Act
      const entity = getBed().createEntity('basic', {
        componentOverrides: overrides,
      });

      // Assert
      expect(entity.getComponentData('core:description').text).toBe(
        'Overridden Description'
      );
      expect(entity.hasComponent('new:component')).toBe(true);
      expect(entity.getComponentData('new:component').data).toBe('xyz');
    });

    it('should throw an error if component validation fails during creation', () => {
      // Arrange
      const { mocks } = getBed();
      const { PRIMARY } = TestData.InstanceIDs;

      const validationErrors = [{ message: 'Invalid data' }];
      mocks.validator.validate.mockReturnValue({
        isValid: false,
        errors: validationErrors,
      });
      const overrides = { 'new:component': { data: 'invalid' } };

      // Act & Assert
      const expectedDetails = JSON.stringify(validationErrors, null, 2);
      expect(() => {
        getBed().createEntity('basic', {
          instanceId: PRIMARY,
          componentOverrides: overrides,
        });
      }).toThrow(
        `New component new:component on entity ${PRIMARY} Errors:\n${expectedDetails}`
      );
    });

    it('should not mutate the original definition object', () => {
      // Arrange
      const { entityManager } = getBed();
      const mutableDef = new EntityDefinition('test:mutable', {
        components: { 'core:name': { value: 'A' } },
      });
      getBed().setupDefinitions(mutableDef);

      // Act
      entityManager.createEntityInstance(mutableDef.id, {
        componentOverrides: { 'core:name': { value: 'B' } }, // Override
      });

      // Assert
      expect(mutableDef.components).toEqual({ 'core:name': { value: 'A' } });
    });
  });
  // ... rest of the file is unchanged
  describe('reconstructEntity', () => {
    it('should successfully reconstruct a valid entity', () => {
      // Arrange
      const { entityManager, mocks } = getBed();
      const { BASIC } = TestData.DefinitionIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      getBed().setupDefinitions(TestData.Definitions.basic);

      const serializedEntity = {
        instanceId: PRIMARY,
        definitionId: BASIC,
        components: {
          'core:name': { name: 'Reconstructed Name' },
          'new:component': { data: 'reconstructed' },
        },
      };

      // Act
      const entity = entityManager.reconstructEntity(serializedEntity);

      // Assert
      expect(entity).toBeInstanceOf(Entity);
      expect(entity.id).toBe(PRIMARY);
      expect(entity.definitionId).toBe(BASIC);
      expect(entity.getComponentData('core:name').name).toBe(
        'Reconstructed Name'
      );
      expect(entity.getComponentData('new:component').data).toBe(
        'reconstructed'
      );

      // Assert event was dispatched
      expectDispatchCalls(mocks.eventDispatcher.dispatch, [
        [
          ENTITY_CREATED_ID,
          {
            entity,
            wasReconstructed: true,
          },
        ],
      ]);
    });

    it('should throw an error if the definition is not found', () => {
      // Arrange
      const { entityManager } = getBed();
      const UNKNOWN_DEF_ID = 'unknown:def';
      getBed().setupDefinitions(); // No definitions available
      const serializedEntity = {
        instanceId: TestData.InstanceIDs.PRIMARY,
        definitionId: UNKNOWN_DEF_ID,
        components: {},
      };

      // Act & Assert
      expect(() => entityManager.reconstructEntity(serializedEntity)).toThrow(
        new DefinitionNotFoundError(UNKNOWN_DEF_ID)
      );
    });

    it('should throw an error if an entity with the same ID already exists', () => {
      // Arrange
      const { entityManager } = getBed();
      const { BASIC } = TestData.DefinitionIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      getBed().createEntity('basic', { instanceId: PRIMARY }); // Pre-existing entity

      const serializedEntity = {
        instanceId: PRIMARY,
        definitionId: BASIC,
        components: {},
      };

      // Act & Assert
      expect(() => entityManager.reconstructEntity(serializedEntity)).toThrow(
        `EntityManager.reconstructEntity: Entity with ID '${PRIMARY}' already exists. Reconstruction aborted.`
      );
    });

    it('should throw an error if a component fails validation', () => {
      // Arrange
      const { entityManager, mocks } = getBed();
      const { BASIC } = TestData.DefinitionIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      getBed().setupDefinitions(TestData.Definitions.basic);
      const validationErrors = [{ message: 'Validation failed' }];
      mocks.validator.validate.mockReturnValue({
        isValid: false,
        errors: validationErrors,
      });

      const serializedEntity = {
        instanceId: PRIMARY,
        definitionId: BASIC,
        components: { 'core:name': { name: 'invalid' } },
      };

      // Act & Assert
      expect(() => entityManager.reconstructEntity(serializedEntity)).toThrow(
        /Reconstruction component.*Errors/
      );
    });

    describe('with invalid input data', () => {
      it.each(
        TestData.InvalidValues.serializedEntityShapes.filter(
          (v) => v === null || typeof v !== 'object'
        )
      )('should throw an error if serializedEntity is %p', (value) => {
        const { entityManager } = getBed();
        expect(() => entityManager.reconstructEntity(value)).toThrow(
          'EntityManager.reconstructEntity: serializedEntity data is missing or invalid.'
        );
      });

      it.each(
        TestData.InvalidValues.serializedInstanceIds.filter(
          (v) => typeof v !== 'number'
        )
      )('should throw an error if instanceId is %p', (invalidId) => {
        const { entityManager } = getBed();
        const serializedEntity = {
          instanceId: invalidId,
          definitionId: TestData.DefinitionIDs.BASIC,
          components: {},
        };
        expect(() => entityManager.reconstructEntity(serializedEntity)).toThrow(
          'EntityManager.reconstructEntity: instanceId is missing or invalid in serialized data.'
        );
      });
    });
  });

  describe('removeEntityInstance', () => {
    it('should remove an existing entity and return true', () => {
      // Arrange
      const { entityManager } = getBed();
      const entity = getBed().createEntity('basic');
      expect(entityManager.getEntityInstance(entity.id)).toBe(entity);

      // Act
      const result = entityManager.removeEntityInstance(entity.id);

      // Assert
      expect(result).toBe(true);
      expect(entityManager.getEntityInstance(entity.id)).toBeUndefined();
    });

    it('should dispatch an ENTITY_REMOVED event upon successful removal', () => {
      // Arrange
      const { entityManager, mocks } = getBed();
      const entity = getBed().createEntity('basic');
      getBed().resetDispatchMock();

      // Act
      entityManager.removeEntityInstance(entity.id);

      // Assert
      expectDispatchCalls(mocks.eventDispatcher.dispatch, [
        [
          ENTITY_REMOVED_ID,
          {
            entity,
          },
        ],
      ]);
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

    it.each(TestData.InvalidValues.invalidIds)(
      'should return false for invalid instanceId %p',
      (invalidId) => {
        const { entityManager, mocks } = getBed();
        expect(entityManager.removeEntityInstance(invalidId)).toBe(false);
        expect(mocks.logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('Attempted to remove entity with invalid ID')
        );
      }
    );

    it('should return false and log an error if MapManager fails internally', () => {
      // This is a tricky test for a defensive code path.
      // We need to spy on the MapManager's prototype BEFORE TestBed creates the EntityManager.
      const removeSpy = jest
        .spyOn(MapManager.prototype, 'remove')
        .mockReturnValue(false);

      // Arrange
      const localTestBed = new TestBed(); // Uses the spied-on MapManager
      const { entityManager, mocks } = localTestBed;
      const { PRIMARY } = TestData.InstanceIDs;
      localTestBed.createEntity('basic', { instanceId: PRIMARY });

      // Act
      const result = entityManager.removeEntityInstance(PRIMARY);

      // Assert
      expect(result).toBe(false);
      expect(mocks.logger.error).toHaveBeenCalledWith(
        expect.stringContaining(
          'MapManager.remove failed for already retrieved entity'
        )
      );

      // Clean up the spy
      removeSpy.mockRestore();
      localTestBed.cleanup();
    });
  });

  describe('clearAll', () => {
    it('should remove all active entities', () => {
      // Arrange
      const { entityManager } = getBed();
      const entity1 = getBed().createEntity('basic');
      const entity2 = getBed().createEntity('basic');

      expect(entityManager.activeEntities.size).toBe(2);

      // Act
      entityManager.clearAll();

      // Assert
      expect(entityManager.activeEntities.size).toBe(0);
      expect(entityManager.getEntityInstance(entity1.id)).toBeUndefined();
      expect(entityManager.getEntityInstance(entity2.id)).toBeUndefined();
    });

    it('should clear the internal definition cache', () => {
      // Arrange
      const { entityManager, mocks } = getBed();

      // Act
      getBed().createEntity('basic', { instanceId: 'e1' });
      // This should hit the cache
      getBed().createEntity('basic', { instanceId: 'e2' });
      expect(mocks.registry.getEntityDefinition).toHaveBeenCalledTimes(1);

      entityManager.clearAll();

      // After clearing, it should fetch from the registry again
      getBed().createEntity('basic', { instanceId: 'e3' });
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
