/**
 * @file This file consolidates all tests for the EntityManager's automatic injection
 * of default components for actor entities (e.g., goals, notes, stm).
 * It exclusively uses the TestBed helper for all setup to ensure consistency,
 * centralization, and reduce boilerplate.
 * @see src/entities/entityManager.js
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { TestBed, TestData } from '../../common/entities/testBed.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';

describe('EntityManager - Default Component Injection', () => {
  let testBed;

  beforeEach(() => {
    testBed = new TestBed();
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('for Actors', () => {
    it('should inject core:goals if not present', () => {
      // Arrange
      const { entityManager, mocks } = testBed;
      const { ACTOR } = TestData.DefinitionIDs;
      const { GOALS_COMPONENT_ID } = TestData.ComponentIDs;

      // The default actor definition in TestData does not have goals
      testBed.setupDefinitions(TestData.Definitions.actor);

      // Act
      const entity = entityManager.createEntityInstance(ACTOR);

      // Assert
      const hasGoals = entity.hasComponent(GOALS_COMPONENT_ID);
      expect(hasGoals).toBe(true);

      const goalsData = entity.getComponentData(GOALS_COMPONENT_ID);
      expect(goalsData).toEqual({ goals: [] });

      // Check that the validation was called for the injected component.
      expect(mocks.validator.validate).toHaveBeenCalledWith(
        GOALS_COMPONENT_ID,
        { goals: [] }
      );
    });

    it('should inject core:notes if not present', () => {
      // Arrange
      const { entityManager, mocks } = testBed;
      const { ACTOR } = TestData.DefinitionIDs;
      const { NOTES_COMPONENT_ID } = TestData.ComponentIDs;

      testBed.setupDefinitions(TestData.Definitions.actor);

      // Act
      const entity = entityManager.createEntityInstance(ACTOR);

      // Assert
      const hasNotes = entity.hasComponent(NOTES_COMPONENT_ID);
      expect(hasNotes).toBe(true);

      const notesData = entity.getComponentData(NOTES_COMPONENT_ID);
      expect(notesData).toEqual({ notes: [] });

      expect(mocks.validator.validate).toHaveBeenCalledWith(
        NOTES_COMPONENT_ID,
        { notes: [] }
      );
    });

    it('should inject core:short_term_memory if not present', () => {
      // Arrange
      const { entityManager, mocks } = testBed;
      const { ACTOR } = TestData.DefinitionIDs;
      const { SHORT_TERM_MEMORY_COMPONENT_ID } = TestData.ComponentIDs;
      const expectedDefaultSTM = { thoughts: [], maxEntries: 10 };

      testBed.setupDefinitions(TestData.Definitions.actor);

      // Act
      const entity = entityManager.createEntityInstance(ACTOR);

      // Assert
      const hasSTM = entity.hasComponent(SHORT_TERM_MEMORY_COMPONENT_ID);
      expect(hasSTM).toBe(true);

      const stmData = entity.getComponentData(SHORT_TERM_MEMORY_COMPONENT_ID);
      expect(stmData).toEqual(expectedDefaultSTM);

      expect(mocks.validator.validate).toHaveBeenCalledWith(
        SHORT_TERM_MEMORY_COMPONENT_ID,
        expectedDefaultSTM
      );
    });

    it('should not override existing default components', () => {
      // Arrange
      const { entityManager, mocks } = testBed;
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

      testBed.setupDefinitions(actorWithDefaultsDef);
      mocks.validator.validate.mockClear(); // Clear any calls from setup

      // Act
      const entity = entityManager.createEntityInstance('test:actor-with-data');

      // Assert
      // 1. The custom data should be present.
      expect(entity.getComponentData(GOALS_COMPONENT_ID)).toEqual(customGoals);
      expect(entity.getComponentData(NOTES_COMPONENT_ID)).toEqual(customNotes);
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
      const { entityManager } = testBed;
      const {
        GOALS_COMPONENT_ID,
        NOTES_COMPONENT_ID,
        SHORT_TERM_MEMORY_COMPONENT_ID,
      } = TestData.ComponentIDs;
      const { BASIC } = TestData.DefinitionIDs;

      // The 'basic' definition is not an actor
      testBed.setupDefinitions(TestData.Definitions.basic);

      // Act
      const entity = entityManager.createEntityInstance(BASIC);

      // Assert
      expect(entity.hasComponent(GOALS_COMPONENT_ID)).toBe(false);
      expect(entity.hasComponent(NOTES_COMPONENT_ID)).toBe(false);
      expect(entity.hasComponent(SHORT_TERM_MEMORY_COMPONENT_ID)).toBe(false);
    });
  });
});
