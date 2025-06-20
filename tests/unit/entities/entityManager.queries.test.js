/**
 * @file This file consolidates all tests for the EntityManager's entity query and
 * accessor methods, such as getEntityInstance and getEntitiesWithComponent.
 * It exclusively uses the TestBed helper for all setup to ensure consistency and reduce boilerplate.
 * @see tests/unit/entities/entityManager.queries.test.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBed, TestData } from '../../common/entities/testBed.js';

describe('EntityManager - Queries and Accessors', () => {
  let testBed;

  beforeEach(() => {
    testBed = new TestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  // ----------------------------------------------------------------------//
  //
  //                          getEntityInstance
  //
  // ----------------------------------------------------------------------//
  describe('getEntityInstance', () => {
    it('should return the correct entity instance if the ID exists', () => {
      // Arrange
      const { entityManager } = testBed;
      const { BASIC } = TestData.DefinitionIDs;
      const { PRIMARY } = TestData.InstanceIDs;
      testBed.setupDefinitions(TestData.Definitions.basic);
      const expectedEntity = entityManager.createEntityInstance(BASIC, {
        instanceId: PRIMARY,
      });

      // Act
      const result = entityManager.getEntityInstance(PRIMARY);

      // Assert
      expect(result).toBe(expectedEntity);
    });

    it('should return undefined if the entity ID does not exist', () => {
      // Arrange
      const { entityManager } = testBed;
      const { GHOST } = TestData.InstanceIDs; // A non-existent ID

      // Act
      const result = entityManager.getEntityInstance(GHOST);

      // Assert
      expect(result).toBeUndefined();
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['an empty string', ''],
      ['a non-string', 12345],
    ])(
      'should return undefined for an invalid ID type: %s',
      (desc, invalidId) => {
        // Arrange
        const { entityManager, mocks } = testBed;

        // Act
        const result = entityManager.getEntityInstance(invalidId);

        // Assert
        expect(result).toBeUndefined();
        expect(mocks.logger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Called with invalid ID format')
        );
      }
    );
  });

  // ----------------------------------------------------------------------//
  //
  //                          getEntitiesWithComponent
  //
  // ----------------------------------------------------------------------//
  describe('getEntitiesWithComponent', () => {
    const COMPONENT_A = 'test:comp-a';
    const COMPONENT_B = 'test:comp-b';

    it('should return an empty array if no entities exist', () => {
      // Arrange
      const { entityManager } = testBed;

      // Act
      const results = entityManager.getEntitiesWithComponent(COMPONENT_A);

      // Assert
      expect(results).toEqual([]);
    });

    it('should return an empty array if no entities have the specified component', () => {
      // Arrange
      const { entityManager } = testBed;
      testBed.setupDefinitions(TestData.Definitions.basic);
      entityManager.createEntityInstance(TestData.DefinitionIDs.BASIC, {
        componentOverrides: { [COMPONENT_B]: { val: 1 } },
      });

      // Act
      const results = entityManager.getEntitiesWithComponent(COMPONENT_A);

      // Assert
      expect(results).toEqual([]);
    });

    it('should return only entities that have the specified component', () => {
      // Arrange
      const { entityManager } = testBed;
      testBed.setupDefinitions(TestData.Definitions.basic);

      const entity1 = entityManager.createEntityInstance(
        TestData.DefinitionIDs.BASIC,
        {
          instanceId: 'instance-1',
          componentOverrides: { [COMPONENT_A]: { val: 1 } },
        }
      );
      const entity2 = entityManager.createEntityInstance(
        TestData.DefinitionIDs.BASIC,
        {
          instanceId: 'instance-2',
          componentOverrides: { [COMPONENT_B]: { val: 2 } },
        }
      );
      const entity3 = entityManager.createEntityInstance(
        TestData.DefinitionIDs.BASIC,
        {
          instanceId: 'instance-3',
          componentOverrides: {
            [COMPONENT_A]: { val: 3 },
            [COMPONENT_B]: { val: 4 },
          },
        }
      );

      // Act
      const results = entityManager.getEntitiesWithComponent(COMPONENT_A);
      const resultIds = results.map((e) => e.id);

      // Assert
      expect(results).toHaveLength(2);
      expect(resultIds).toContain(entity1.id);
      expect(resultIds).toContain(entity3.id);
      expect(resultIds).not.toContain(entity2.id);
    });

    it('should return entities that have the component on their definition', () => {
      // Arrange
      const { entityManager } = testBed;
      const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
      testBed.setupDefinitions(
        TestData.Definitions.basic,
        TestData.Definitions.actor
      ); // basic has name, actor does not

      const entityWithComponent = entityManager.createEntityInstance(
        TestData.DefinitionIDs.BASIC
      );
      const entityWithoutComponent = entityManager.createEntityInstance(
        TestData.DefinitionIDs.ACTOR
      );

      // Act
      const results = entityManager.getEntitiesWithComponent(NAME_COMPONENT_ID);
      const resultIds = results.map((e) => e.id);

      // Assert
      expect(results).toHaveLength(1);
      expect(resultIds).toContain(entityWithComponent.id);
      expect(resultIds).not.toContain(entityWithoutComponent.id);
    });

    it('should return an empty array for invalid componentTypeIds', () => {
      // Arrange
      const { entityManager, mocks } = testBed;
      testBed.setupDefinitions(TestData.Definitions.basic);
      entityManager.createEntityInstance(TestData.DefinitionIDs.BASIC);

      // Act & Assert
      expect(entityManager.getEntitiesWithComponent(null)).toEqual([]);
      expect(entityManager.getEntitiesWithComponent(undefined)).toEqual([]);
      expect(entityManager.getEntitiesWithComponent('')).toEqual([]);
      expect(entityManager.getEntitiesWithComponent('   ')).toEqual([]);
      expect(entityManager.getEntitiesWithComponent(123)).toEqual([]);
      expect(mocks.logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Received invalid componentTypeId')
      );
    });

    it('should return a new array, not a live reference', () => {
      // Arrange
      const { entityManager } = testBed;
      testBed.setupDefinitions(TestData.Definitions.basic);
      const entity1 = entityManager.createEntityInstance(
        TestData.DefinitionIDs.BASIC,
        {
          componentOverrides: { [COMPONENT_A]: { val: 1 } },
        }
      );

      // Act
      const results1 = entityManager.getEntitiesWithComponent(COMPONENT_A);
      expect(results1).toHaveLength(1);

      // Modify the state by adding another entity with the component
      const entity2 = entityManager.createEntityInstance(
        TestData.DefinitionIDs.BASIC,
        {
          componentOverrides: { [COMPONENT_A]: { val: 2 } },
        }
      );

      const results2 = entityManager.getEntitiesWithComponent(COMPONENT_A);

      // Assert
      expect(results1).toHaveLength(1); // The original result array should be unchanged.
      expect(results2).toHaveLength(2);
      expect(results2.map((e) => e.id)).toContain(entity1.id);
      expect(results2.map((e) => e.id)).toContain(entity2.id);
    });
  });
});
