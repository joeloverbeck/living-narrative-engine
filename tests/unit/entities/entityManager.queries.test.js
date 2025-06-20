/**
 * @file This file consolidates all tests for the EntityManager's entity query and
 * accessor methods, such as getEntityInstance and getEntitiesWithComponent.
 * It exclusively uses the TestBed helper for all setup to ensure consistency and reduce boilerplate.
 * @see tests/unit/entities/entityManager.queries.test.js
 */

import { describe, it, expect } from '@jest/globals';
import {
  describeEntityManagerSuite,
  TestData,
} from '../../common/entities/testBed.js';

describeEntityManagerSuite(
  'EntityManager - Queries and Accessors',
  (getBed) => {
    // ----------------------------------------------------------------------//
    //
    //                          getEntityInstance
    //
    // ----------------------------------------------------------------------//
    describe('getEntityInstance', () => {
      it('should return the correct entity instance if the ID exists', () => {
        // Arrange
        const { entityManager } = getBed();
        const { PRIMARY } = TestData.InstanceIDs;
        const expectedEntity = getBed().createEntity('basic', {
          instanceId: PRIMARY,
        });

        // Act
        const result = entityManager.getEntityInstance(PRIMARY);

        // Assert
        expect(result).toBe(expectedEntity);
      });

      it('should return undefined if the entity ID does not exist', () => {
        // Arrange
        const { entityManager } = getBed();
        const { GHOST } = TestData.InstanceIDs; // A non-existent ID

        // Act
        const result = entityManager.getEntityInstance(GHOST);

        // Assert
        expect(result).toBeUndefined();
      });

      it.each(TestData.InvalidValues.invalidIds)(
        'should return undefined for an invalid ID type: %p',
        (invalidId) => {
          // Arrange
          const { entityManager, mocks } = getBed();

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
        const { entityManager } = getBed();

        // Act
        const results = entityManager.getEntitiesWithComponent(COMPONENT_A);

        // Assert
        expect(results).toEqual([]);
      });

      it('should return an empty array if no entities have the specified component', () => {
        // Arrange
        const { entityManager } = getBed();
        getBed().createEntity('basic', {
          componentOverrides: { [COMPONENT_B]: { val: 1 } },
        });

        // Act
        const results = entityManager.getEntitiesWithComponent(COMPONENT_A);

        // Assert
        expect(results).toEqual([]);
      });

      it('should return only entities that have the specified component', () => {
        // Arrange
        const { entityManager } = getBed();
        const entity1 = getBed().createEntity('basic', {
          instanceId: 'instance-1',
          componentOverrides: { [COMPONENT_A]: { val: 1 } },
        });
        const entity2 = getBed().createEntity('basic', {
          instanceId: 'instance-2',
          componentOverrides: { [COMPONENT_B]: { val: 2 } },
        });
        const entity3 = getBed().createEntity('basic', {
          instanceId: 'instance-3',
          componentOverrides: {
            [COMPONENT_A]: { val: 3 },
            [COMPONENT_B]: { val: 4 },
          },
        });

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
        const { entityManager } = getBed();
        const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
        getBed().setupDefinitions(
          TestData.Definitions.basic,
          TestData.Definitions.actor
        ); // basic has name, actor does not

        const entityWithComponent = getBed().createEntity('basic');
        const entityWithoutComponent = getBed().createEntity('actor');

        // Act
        const results =
          entityManager.getEntitiesWithComponent(NAME_COMPONENT_ID);
        const resultIds = results.map((e) => e.id);

        // Assert
        expect(results).toHaveLength(1);
        expect(resultIds).toContain(entityWithComponent.id);
        expect(resultIds).not.toContain(entityWithoutComponent.id);
      });

      it.each(TestData.InvalidValues.invalidIds)(
        'should return an empty array for invalid componentTypeId %p',
        (invalidId) => {
          // Arrange
          const { entityManager, mocks } = getBed();
          getBed().createEntity('basic');

          // Act
          const result = entityManager.getEntitiesWithComponent(invalidId);

          // Assert
          expect(result).toEqual([]);
          expect(mocks.logger.debug).toHaveBeenCalledWith(
            expect.stringContaining('Received invalid componentTypeId')
          );
        }
      );

      it('should return a new array, not a live reference', () => {
        // Arrange
        const { entityManager } = getBed();
        const entity1 = getBed().createEntity('basic', {
          componentOverrides: { [COMPONENT_A]: { val: 1 } },
        });

        // Act
        const results1 = entityManager.getEntitiesWithComponent(COMPONENT_A);
        expect(results1).toHaveLength(1);

        // Modify the state by adding another entity with the component
        const entity2 = getBed().createEntity('basic', {
          componentOverrides: { [COMPONENT_A]: { val: 2 } },
        });

        const results2 = entityManager.getEntitiesWithComponent(COMPONENT_A);

        // Assert
        expect(results1).toHaveLength(1); // The original result array should be unchanged.
        expect(results2).toHaveLength(2);
        expect(results2.map((e) => e.id)).toContain(entity1.id);
        expect(results2.map((e) => e.id)).toContain(entity2.id);
      });
    });
  }
);
