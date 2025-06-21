/**
 * @file This file consolidates all tests for the EntityManager's automatic injection
 * of default components for actor entities (e.g., goals, notes, stm).
 * It exclusively uses the TestBed helper for all setup to ensure consistency,
 * centralization, and reduce boilerplate.
 * @see src/entities/entityManager.js
 */

import { describe, it, expect } from '@jest/globals';
import {
  describeEntityManagerSuite,
  TestData,
} from '../../common/entities/index.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';

describeEntityManagerSuite(
  'EntityManager - Default Component Injection',
  (getBed) => {
    describe('for Actors', () => {
      const {
        GOALS_COMPONENT_ID,
        NOTES_COMPONENT_ID,
        SHORT_TERM_MEMORY_COMPONENT_ID,
      } = TestData.ComponentIDs;

      const defaultComponentsTable = [
        [GOALS_COMPONENT_ID, TestData.DefaultComponentData[GOALS_COMPONENT_ID]],
        [NOTES_COMPONENT_ID, TestData.DefaultComponentData[NOTES_COMPONENT_ID]],
        [
          SHORT_TERM_MEMORY_COMPONENT_ID,
          TestData.DefaultComponentData[SHORT_TERM_MEMORY_COMPONENT_ID],
        ],
      ];

      it.each(defaultComponentsTable)(
        'should inject %s if not present',
        (id, expected) => {
          // Arrange
          const { mocks } = getBed();

          // Act
          const entity = getBed().createEntity('actor');

          // Assert
          expect(entity.hasComponent(id)).toBe(true);
          expect(entity.getComponentData(id)).toEqual(expected);
          expect(mocks.validator.validate).toHaveBeenCalledWith(id, expected);
        }
      );

      it('should not override existing default components', () => {
        // Arrange
        const { entityManager, mocks } = getBed();
        const {
          ACTOR_COMPONENT_ID,
          GOALS_COMPONENT_ID,
          NOTES_COMPONENT_ID,
          SHORT_TERM_MEMORY_COMPONENT_ID,
        } = TestData.ComponentIDs;

        const customGoals = { goals: [{ text: 'My Goal' }] };
        const customNotes = { notes: [{ text: 'My Note' }] };
        const customStm = { thoughts: ['My thought'], maxEntries: 5 };

        const actorWithDefaultsDef = new EntityDefinition(
          'test:actor-with-data',
          {
            components: {
              [ACTOR_COMPONENT_ID]: {},
              [GOALS_COMPONENT_ID]: customGoals,
              [NOTES_COMPONENT_ID]: customNotes,
              [SHORT_TERM_MEMORY_COMPONENT_ID]: customStm,
            },
          }
        );

        getBed().setupDefinitions(actorWithDefaultsDef);
        mocks.validator.validate.mockClear(); // Clear any calls from setup

        // Act
        const entity = entityManager.createEntityInstance(
          'test:actor-with-data'
        );

        // Assert
        // 1. The custom data should be present.
        expect(entity.getComponentData(GOALS_COMPONENT_ID)).toEqual(
          customGoals
        );
        expect(entity.getComponentData(NOTES_COMPONENT_ID)).toEqual(
          customNotes
        );
        expect(entity.getComponentData(SHORT_TERM_MEMORY_COMPONENT_ID)).toEqual(
          customStm
        );

        // 2. The validator should NOT have been called for these components, because
        // they were part of the definition and not injected by the manager.
        // (Note: The manager DOES validate overrides, but not base definition components).
        expect(mocks.validator.validate).not.toHaveBeenCalledWith(
          GOALS_COMPONENT_ID,
          expect.any(Object)
        );
        expect(mocks.validator.validate).not.toHaveBeenCalledWith(
          NOTES_COMPONENT_ID,
          expect.any(Object)
        );
        expect(mocks.validator.validate).not.toHaveBeenCalledWith(
          SHORT_TERM_MEMORY_COMPONENT_ID,
          expect.any(Object)
        );
      });
    });

    describe('for Non-Actors', () => {
      it('should not inject any default components', () => {
        // Arrange
        const {
          GOALS_COMPONENT_ID,
          NOTES_COMPONENT_ID,
          SHORT_TERM_MEMORY_COMPONENT_ID,
        } = TestData.ComponentIDs;

        // The 'basic' definition is not an actor
        getBed().setupDefinitions(TestData.Definitions.basic);

        // Act
        const entity = getBed().createEntity('basic');

        // Assert
        expect(entity.hasComponent(GOALS_COMPONENT_ID)).toBe(false);
        expect(entity.hasComponent(NOTES_COMPONENT_ID)).toBe(false);
        expect(entity.hasComponent(SHORT_TERM_MEMORY_COMPONENT_ID)).toBe(false);
      });
    });
  }
);
