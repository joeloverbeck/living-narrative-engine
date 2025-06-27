/**
 * @file Tests for EntityManager.createEntityInstance
 * @see src/entities/entityManager.js
 */

import { describe, it, expect, jest } from '@jest/globals';
import {
  describeEntityManagerSuite,
  TestData,
  TestBed,
} from '../../common/entities/index.js';
import { runInvalidDefinitionIdTests } from '../../common/entities/index.js';
import Entity from '../../../src/entities/entity.js';
import { DefinitionNotFoundError } from '../../../src/errors/definitionNotFoundError.js';
import { DuplicateEntityError } from '../../../src/errors/duplicateEntityError.js';
import { expectEntityCreatedDispatch } from '../../common/engine/dispatchTestUtils.js';

describeEntityManagerSuite('EntityManager - createEntityInstance', (getBed) => {
  describe('createEntityInstance', () => {
    it('should create an entity with an ID from the injected generator if no instanceId is provided', () => {
      // Arrange
      const mockIdGenerator = () => 'test-entity-id-123';
      const testBed = new TestBed({ idGenerator: mockIdGenerator });

      const entity = testBed.createBasicEntity();

      // Assert
      expect(entity).toBeInstanceOf(Entity);
      expect(entity.id).toBe('test-entity-id-123');
      expect(entity.definitionId).toBe(TestData.DefinitionIDs.BASIC);
    });

    it('should create an entity with a specific instanceId if provided, ignoring the generator', () => {
      // Arrange
      const mockIdGenerator = jest.fn(() => 'should-not-be-called');
      const testBed = new TestBed({ idGenerator: mockIdGenerator });
      const { PRIMARY } = TestData.InstanceIDs;

      const entity = testBed.createBasicEntity({
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

      const entity = getBed().createBasicEntity();

      // Assert
      expectEntityCreatedDispatch(
        mocks.eventDispatcher.dispatch,
        entity,
        false
      );
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
      getBed().createBasicEntity({ instanceId: PRIMARY }); // Create the first one

      // Act & Assert
      expect(() => {
        entityManager.createEntityInstance(TestData.DefinitionIDs.BASIC, {
          instanceId: PRIMARY,
        });
      }).toThrow(DuplicateEntityError);
    });

    runInvalidDefinitionIdTests(getBed, (em, defId) =>
      em.createEntityInstance(defId)
    );

    it('should fetch and cache the EntityDefinition on first use', () => {
      // Arrange
      const { mocks } = getBed();

      // Act
      getBed().createBasicEntity({ instanceId: 'e1' });
      getBed().createBasicEntity({ instanceId: 'e2' });

      // Assert
      expect(mocks.registry.getEntityDefinition).toHaveBeenCalledTimes(1);
      expect(mocks.registry.getEntityDefinition).toHaveBeenCalledWith(
        TestData.DefinitionIDs.BASIC
      );
    });

    it('should correctly apply component overrides', () => {
      // Arrange
      const overrides = {
        'core:description': { text: 'Overridden Description' },
        'new:component': { data: 'xyz' },
      };

      // Act
      const entity = getBed().createBasicEntity({
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
      const { PRIMARY } = TestData.InstanceIDs;
      getBed().setupTestDefinitions('basic');
      const validationErrors = [{ message: 'Validation failed' }];
      mocks.validator.validate.mockReturnValue({
        isValid: false,
        errors: validationErrors,
      });

      // Act & Assert
      expect(() =>
        entityManager.createEntityInstance(TestData.DefinitionIDs.BASIC, {
          instanceId: PRIMARY,
          componentOverrides: { 'core:name': { name: 'invalid' } },
        })
      ).toThrow(/Validation failed/);
    });
    });
  });
});
