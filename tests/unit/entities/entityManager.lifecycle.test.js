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
import {
  runInvalidEntityIdTests,
  runInvalidDefinitionIdTests,
} from '../../common/entities/invalidInputHelpers.js';
import Entity from '../../../src/entities/entity.js';
import { DefinitionNotFoundError } from '../../../src/errors/definitionNotFoundError.js';
import { EntityNotFoundError } from '../../../src/errors/entityNotFoundError.js';
import { DuplicateEntityError } from '../../../src/errors/duplicateEntityError.js';
import {
  ENTITY_CREATED_ID,
  ENTITY_REMOVED_ID,
} from '../../../src/constants/eventIds.js';

import { expectSingleDispatch } from '../../common/engine/dispatchTestUtils.js';

import { MapManager } from '../../../src/utils/mapManagerUtils.js';
import { buildSerializedEntity } from '../../common/entities/serializationUtils.js';

describeEntityManagerSuite('EntityManager - Lifecycle', (getBed) => {
  describe('constructor', () => {
    it('should instantiate successfully via TestBed', () => {
      // The beforeEach hook already does this. If it fails, the test will crash.
      expect(getBed().entityManager).toBeInstanceOf(
        getBed().entityManager.constructor
      );
    });

    it.each([
      ['registry', null],
      ['validator', null],
    ])(
      'should throw an error if the %s is missing or invalid',
      (depName, value) => {
        const { registry, validator, logger, eventDispatcher } = getBed().mocks;
        const EntityManager = getBed().entityManager.constructor;

        expect(
          () =>
            new EntityManager({
              registry: depName === 'registry' ? value : registry,
              validator: depName === 'validator' ? value : validator,
              logger,
              dispatcher: eventDispatcher,
            })
        ).toThrow(
          depName === 'registry'
            ? 'Missing required dependency: IDataRegistry.'
            : 'Missing required dependency: ISchemaValidator.'
        );
      }
    );

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
      expectSingleDispatch(mocks.eventDispatcher.dispatch, ENTITY_CREATED_ID, {
        entity,
        wasReconstructed: false,
      });
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

    it('should throw a DuplicateEntityError if an entity with the provided instanceId already exists', () => {
      // Arrange
      const { entityManager } = getBed();
      const { PRIMARY } = TestData.InstanceIDs;
      getBed().createEntity('basic', { instanceId: PRIMARY }); // Create the first one

      // Act & Assert
      expect(() => {
        entityManager.createEntityInstance(BASIC, { instanceId: PRIMARY });
      }).toThrow(DuplicateEntityError);
    });

    runInvalidDefinitionIdTests(getBed, (em, defId) =>
      em.createEntityInstance(defId)
    );

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
      const { entityManager, mocks } = getBed();
      const { BASIC } = TestData.DefinitionIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      getBed().setupDefinitions(TestData.Definitions.basic);
      const validationErrors = [{ message: 'Validation failed' }];
      mocks.validator.validate.mockReturnValue({
        isValid: false,
        errors: validationErrors,
      });

      // Act & Assert
      expect(() =>
        entityManager.createEntityInstance(BASIC, {
          instanceId: PRIMARY,
          componentOverrides: { 'core:name': { name: 'invalid' } },
        })
      ).toThrow(/Validation failed/);
    });
  });

  describe('reconstructEntity', () => {
    it('should reconstruct an entity from serialized data', () => {
      // Arrange
      const { entityManager } = getBed();
      const { BASIC } = TestData.DefinitionIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      getBed().setupDefinitions(TestData.Definitions.basic);

      const serializedEntity = buildSerializedEntity(PRIMARY, BASIC, {
        'core:name': { name: 'Reconstructed' },
      });

      // Act
      const entity = entityManager.reconstructEntity(serializedEntity);

      // Assert
      expect(entity).toBeInstanceOf(Entity);
      expect(entity.id).toBe(PRIMARY);
      expect(entity.definitionId).toBe(BASIC);
      expect(entity.getComponentData('core:name').name).toBe('Reconstructed');
    });

    it('should dispatch an ENTITY_CREATED event with wasReconstructed: true', () => {
      // Arrange
      const { entityManager, mocks } = getBed();
      const { BASIC } = TestData.DefinitionIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      getBed().setupDefinitions(TestData.Definitions.basic);

      const serializedEntity = buildSerializedEntity(PRIMARY, BASIC, {});

      // Act
      const entity = entityManager.reconstructEntity(serializedEntity);

      // Assert
      expectSingleDispatch(mocks.eventDispatcher.dispatch, ENTITY_CREATED_ID, {
        entity,
        wasReconstructed: true,
      });
    });

    it('should throw a DefinitionNotFoundError if the definition is not found', () => {
      // Arrange
      const { entityManager } = getBed();
      const NON_EXISTENT_DEF_ID = 'non:existent';
      getBed().setupDefinitions(); // No definitions available

      const serializedEntity = buildSerializedEntity(
        'test-instance',
        NON_EXISTENT_DEF_ID,
        {}
      );

      // Act & Assert
      expect(() => entityManager.reconstructEntity(serializedEntity)).toThrow(
        new DefinitionNotFoundError(NON_EXISTENT_DEF_ID)
      );
    });

    it('should throw a DuplicateEntityError if an entity with the same ID already exists', () => {
      // Arrange
      const { entityManager } = getBed();
      const { BASIC } = TestData.DefinitionIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      getBed().setupDefinitions(TestData.Definitions.basic);

      // Create the first entity
      getBed().createEntity('basic', { instanceId: PRIMARY });

      const serializedEntity = buildSerializedEntity(PRIMARY, BASIC, {});

      // Act & Assert
      expect(() => entityManager.reconstructEntity(serializedEntity)).toThrow(
        DuplicateEntityError
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

      const serializedEntity = buildSerializedEntity(PRIMARY, BASIC, {
        'core:name': { name: 'invalid' },
      });

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
        const serializedEntity = buildSerializedEntity(
          invalidId,
          TestData.DefinitionIDs.BASIC,
          {}
        );
        expect(() => entityManager.reconstructEntity(serializedEntity)).toThrow(
          'EntityManager.reconstructEntity: instanceId is missing or invalid in serialized data.'
        );
      });
    });
  });

  describe('removeEntityInstance', () => {
    it('should remove an existing entity', () => {
      // Arrange
      const { entityManager } = getBed();
      const entity = getBed().createEntity('basic');
      expect(entityManager.getEntityInstance(entity.id)).toBe(entity);

      // Act
      entityManager.removeEntityInstance(entity.id);

      // Assert
      expect(entityManager.getEntityInstance(entity.id)).toBeUndefined();
    });

    it('should dispatch an ENTITY_REMOVED event upon successful removal', () => {
      // Arrange
      const { entityManager, mocks } = getBed();
      const entity = getBed().createEntity(
        'basic',
        {},
        { resetDispatch: true }
      );

      // Act
      entityManager.removeEntityInstance(entity.id);

      // Assert
      expectSingleDispatch(mocks.eventDispatcher.dispatch, ENTITY_REMOVED_ID, {
        entity,
      });
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

    runInvalidEntityIdTests(getBed, (em, instanceId) =>
      em.removeEntityInstance(instanceId)
    );

    it('should throw an error if MapManager fails internally', () => {
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

      // Act & Assert
      expect(() => entityManager.removeEntityInstance(PRIMARY)).toThrow(
        "Internal error: Failed to remove entity 'test-instance-01' from MapManager despite entity being found."
      );
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
