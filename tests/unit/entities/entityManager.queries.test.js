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

    // ----------------------------------------------------------------------//
    //
    //                          findEntities
    //
    // ----------------------------------------------------------------------//
    describe('findEntities', () => {
      const COMPONENT_A = 'test:comp-a';
      const COMPONENT_B = 'test:comp-b';
      const COMPONENT_C = 'test:comp-c';

      let entity1, entity2, entity3, entity4;

      beforeEach(() => {
        const { entityManager } = getBed();
        getBed().setupDefinitions(TestData.Definitions.basic);

        // entity1: has A
        entity1 = entityManager.createEntityInstance(
          TestData.DefinitionIDs.BASIC,
          {
            instanceId: 'e1',
            componentOverrides: { [COMPONENT_A]: { val: 1 } },
          }
        );

        // entity2: has B, C
        entity2 = entityManager.createEntityInstance(
          TestData.DefinitionIDs.BASIC,
          {
            instanceId: 'e2',
            componentOverrides: {
              [COMPONENT_B]: { val: 2 },
              [COMPONENT_C]: { val: 3 },
            },
          }
        );

        // entity3: has A, B
        entity3 = entityManager.createEntityInstance(
          TestData.DefinitionIDs.BASIC,
          {
            instanceId: 'e3',
            componentOverrides: {
              [COMPONENT_A]: { val: 4 },
              [COMPONENT_B]: { val: 5 },
            },
          }
        );

        // entity4: has A, B, C
        entity4 = entityManager.createEntityInstance(
          TestData.DefinitionIDs.BASIC,
          {
            instanceId: 'e4',
            componentOverrides: {
              [COMPONENT_A]: { val: 6 },
              [COMPONENT_B]: { val: 7 },
              [COMPONENT_C]: { val: 8 },
            },
          }
        );
      });

      it('should return an empty array and warn if no positive conditions are provided', () => {
        const { entityManager, mocks } = getBed();
        const results = entityManager.findEntities({ without: [COMPONENT_A] });
        expect(results).toEqual([]);
        expect(mocks.logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('called with no "withAll" or "withAny"')
        );
      });

      it('should handle empty queries gracefully', () => {
        const { entityManager, mocks } = getBed();
        const results = entityManager.findEntities({});
        expect(results).toEqual([]);
        expect(mocks.logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('called with no "withAll" or "withAny"')
        );
      });

      it('should return entities with ALL of the specified components', () => {
        const { entityManager } = getBed();
        const results = entityManager.findEntities({
          withAll: [COMPONENT_A, COMPONENT_B],
        });
        const ids = results.map((e) => e.id);
        expect(ids).toHaveLength(2);
        expect(ids).toContain(entity3.id);
        expect(ids).toContain(entity4.id);
      });

      it('should return entities with ANY of the specified components', () => {
        const { entityManager } = getBed();
        const results = entityManager.findEntities({
          withAny: [COMPONENT_A, COMPONENT_C],
        });
        const ids = results.map((e) => e.id);
        expect(ids).toHaveLength(4); // e1 (A), e2 (C), e3 (A), e4 (A, C)
        expect(ids).toContain(entity1.id);
        expect(ids).toContain(entity2.id);
        expect(ids).toContain(entity3.id);
        expect(ids).toContain(entity4.id);
      });

      it('should exclude entities with any of the WITHOUT components', () => {
        const { entityManager } = getBed();
        // Find entities with A, but without C
        const results = entityManager.findEntities({
          withAll: [COMPONENT_A],
          without: [COMPONENT_C],
        });
        const ids = results.map((e) => e.id);
        expect(ids).toHaveLength(2); // e1, e3
        expect(ids).toContain(entity1.id);
        expect(ids).toContain(entity3.id);
      });

      it('should correctly combine withAll and withAny', () => {
        const { entityManager } = getBed();
        // Must have A, and must have either B or C
        const results = entityManager.findEntities({
          withAll: [COMPONENT_A],
          withAny: [COMPONENT_B, COMPONENT_C],
        });
        const ids = results.map((e) => e.id);
        expect(ids).toHaveLength(2); // e3 (A, B), e4 (A, B, C)
        expect(ids).toContain(entity3.id);
        expect(ids).toContain(entity4.id);
      });

      it('should correctly combine withAll, withAny, and without', () => {
        const { entityManager } = getBed();
        // Must have A, must have B or C, but must NOT have C
        // This logic simplifies to: Must have A and B, but not C
        const results = entityManager.findEntities({
          withAll: [COMPONENT_A],
          withAny: [COMPONENT_B, COMPONENT_C],
          without: [COMPONENT_C],
        });
        const ids = results.map((e) => e.id);
        expect(ids).toHaveLength(1); // e3 (A,B)
        expect(ids).toContain(entity3.id);
      });

      it('should return an empty array if a withAll condition is impossible', () => {
        const { entityManager } = getBed();
        const results = entityManager.findEntities({
          withAll: [COMPONENT_A, 'nonexistent'],
        });
        expect(results).toEqual([]);
      });

      it('should return an empty array if withAny condition is not met', () => {
        const { entityManager } = getBed();
        const results = entityManager.findEntities({
          withAll: [COMPONENT_A],
          withAny: ['nonexistent'],
        });
        expect(results).toEqual([]);
      });

      it('should return all entities when query matches all', () => {
        const { entityManager } = getBed();
        const results = entityManager.findEntities({
          withAny: [COMPONENT_A, COMPONENT_B, COMPONENT_C],
        });
        expect(results).toHaveLength(4);
      });
    });
  }
);
