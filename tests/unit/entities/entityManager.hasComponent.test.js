import { describe, it, expect } from '@jest/globals';
import {
  describeEntityManagerSuite,
  TestData,
} from '../../common/entities/index.js';
import { runInvalidIdPairTests } from '../../common/entities/index.js';

describeEntityManagerSuite('EntityManager - hasComponent', (getBed) => {
  describe('hasComponent', () => {
    it.each([
      [
        'component exists on definition',
        {},
        TestData.ComponentIDs.NAME_COMPONENT_ID,
        true,
      ],
      [
        'component added as override',
        { 'new:component': { data: 'test' } },
        'new:component',
        true,
      ],
      ['component does not exist', {}, 'non:existent', false],
    ])('%s', (_desc, overrides, componentId, expected) => {
      const { entityManager } = getBed();
      const { PRIMARY } = TestData.InstanceIDs;
      if (Object.keys(overrides).length) {
        getBed().createEntityWithOverrides('basic', {
          overrides,
          instanceId: PRIMARY,
        });
      } else {
        getBed().createBasicEntity({ instanceId: PRIMARY });
      }

      const result = entityManager.hasComponent(PRIMARY, componentId);
      expect(result).toBe(expected);
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

    describe('hasComponentOverride (legacy checkOverrideOnly flag)', () => {
      it.each([
        ['component only on definition', false],
        ['component as override', true],
      ])('should handle %s', (_desc, useOverride) => {
        const { entityManager } = getBed();
        const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
        const { PRIMARY } = TestData.InstanceIDs;
        if (useOverride) {
          getBed().createEntityWithOverrides('basic', {
            overrides: { [NAME_COMPONENT_ID]: { name: 'Override' } },
            instanceId: PRIMARY,
          });
        } else {
          getBed().createBasicEntity({ instanceId: PRIMARY });
        }
        const result = entityManager.hasComponentOverride(
          PRIMARY,
          NAME_COMPONENT_ID
        );
        expect(result).toBe(useOverride);
      });
    });

    describe('hasComponentOverride', () => {
      it.each([
        ['component only on definition', false],
        ['component as override', true],
      ])('should handle %s', (_desc, useOverride) => {
        const { entityManager } = getBed();
        const { NAME_COMPONENT_ID } = TestData.ComponentIDs;
        const { PRIMARY } = TestData.InstanceIDs;
        if (useOverride) {
          getBed().createEntityWithOverrides('basic', {
            overrides: { [NAME_COMPONENT_ID]: { name: 'Override' } },
            instanceId: PRIMARY,
          });
        } else {
          getBed().createBasicEntity({ instanceId: PRIMARY });
        }
        const result = entityManager.hasComponentOverride(
          PRIMARY,
          NAME_COMPONENT_ID
        );
        expect(result).toBe(useOverride);
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
});
