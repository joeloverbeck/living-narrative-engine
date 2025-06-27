/**
 * @file Tests for EntityManager.reconstructEntity
 * @see src/entities/entityManager.js
 */
import { describe, it, expect, jest } from '@jest/globals';
import {
  describeEntityManagerSuite,
  TestData,
  TestBed,
} from '../../common/entities/index.js';
import {
  runInvalidEntityIdTests,
  runInvalidDefinitionIdTests,
} from '../../common/entities/index.js';
import Entity from '../../../src/entities/entity.js';
import { DefinitionNotFoundError } from '../../../src/errors/definitionNotFoundError.js';
import { EntityNotFoundError } from '../../../src/errors/entityNotFoundError.js';
import { DuplicateEntityError } from '../../../src/errors/duplicateEntityError.js';
import { SerializedEntityError } from '../../../src/errors/serializedEntityError.js';
import { InvalidInstanceIdError } from '../../../src/errors/invalidInstanceIdError.js';
import { expectEntityCreatedDispatch } from '../../common/engine/dispatchTestUtils.js';
import { buildSerializedEntity } from '../../common/entities/index.js';
describeEntityManagerSuite('EntityManager - reconstructEntity', (getBed) => {
  describe('reconstructEntity', () => {
    it('should reconstruct an entity from serialized data', () => {
      const { entityManager } = getBed();
      const { PRIMARY } = TestData.InstanceIDs;
      getBed().setupTestDefinitions('basic');
      const serializedEntity = buildSerializedEntity(
        PRIMARY,
        TestData.DefinitionIDs.BASIC,
        {
          'core:name': { name: 'Reconstructed' },
        }
      );
      const entity = entityManager.reconstructEntity(serializedEntity);
      expect(entity).toBeInstanceOf(Entity);
      expect(entity.id).toBe(PRIMARY);
      expect(entity.definitionId).toBe(TestData.DefinitionIDs.BASIC);
      expect(entity.getComponentData('core:name').name).toBe('Reconstructed');
    });
    it('should dispatch an ENTITY_CREATED event with wasReconstructed: true', () => {
      const { entityManager, mocks } = getBed();
      const { PRIMARY } = TestData.InstanceIDs;
      getBed().setupTestDefinitions('basic');
      const serializedEntity = buildSerializedEntity(
        PRIMARY,
        TestData.DefinitionIDs.BASIC,
        {}
      );
      const entity = entityManager.reconstructEntity(serializedEntity);
      expectEntityCreatedDispatch(mocks.eventDispatcher.dispatch, entity, true);
    });
    it('should throw a DefinitionNotFoundError if the definition is not found', () => {
      const { entityManager } = getBed();
      const NON_EXISTENT_DEF_ID = 'non:existent';
      getBed().setupDefinitions(); // No definitions available
      const serializedEntity = buildSerializedEntity(
        'test-instance',
        NON_EXISTENT_DEF_ID,
        {}
      );
      expect(() => entityManager.reconstructEntity(serializedEntity)).toThrow(
        new DefinitionNotFoundError(NON_EXISTENT_DEF_ID)
      );
    });
    it('should throw a DuplicateEntityError if an entity with the same ID already exists', () => {
      const { entityManager } = getBed();
      const { PRIMARY } = TestData.InstanceIDs;
      getBed().setupTestDefinitions('basic');
      getBed().createBasicEntity({ instanceId: PRIMARY });
      const serializedEntity = buildSerializedEntity(
        PRIMARY,
        TestData.DefinitionIDs.BASIC,
        {}
      );
      expect(() => entityManager.reconstructEntity(serializedEntity)).toThrow(
        DuplicateEntityError
      );
    });
    it('should map duplicate ID errors to legacy message', () => {
      const { entityManager } = getBed();
      const { PRIMARY } = TestData.InstanceIDs;
      getBed().setupTestDefinitions('basic');
      getBed().createBasicEntity({ instanceId: PRIMARY });
      const serializedEntity = buildSerializedEntity(
        PRIMARY,
        TestData.DefinitionIDs.BASIC,
        {}
      );
      const expectedMsg =
        "EntityManager.reconstructEntity: Entity with ID '" +
        PRIMARY +
        "' already exists. Reconstruction aborted.";
      expect(() => entityManager.reconstructEntity(serializedEntity)).toThrow(
        expectedMsg
      );
    });
    it('should throw an error if a component fails validation', () => {
      const { entityManager, mocks } = getBed();
      const { PRIMARY } = TestData.InstanceIDs;
      getBed().setupTestDefinitions('basic');
      const validationErrors = [{ message: 'Validation failed' }];
      mocks.validator.validate.mockReturnValue({
        isValid: false,
        errors: validationErrors,
      });
      const serializedEntity = buildSerializedEntity(
        PRIMARY,
        TestData.DefinitionIDs.BASIC,
        {
          'core:name': { name: 'invalid' },
        }
      );
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
          SerializedEntityError
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
          InvalidInstanceIdError
        );
      });
    });
  });
});
