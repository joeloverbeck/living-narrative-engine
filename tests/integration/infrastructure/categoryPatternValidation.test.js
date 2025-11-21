/**
 * @file Category pattern validation tests for infrastructure components
 * @description TSTAIMIG-002: Validates category-specific patterns and handler selection logic
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import { ModTestHandlerFactory } from '../../common/mods/ModTestHandlerFactory.js';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityBuilder } from '../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../common/mods/ModAssertionHelpers.js';
import { SimpleEntityManager } from '../../common/entities/index.js';

// Mock file system for fixture auto-loading
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    readFile: jest.fn(),
  },
  constants: {
    F_OK: 0,
  },
}));

describe('Category Pattern Validation (TSTAIMIG-002)', () => {
  let entityManager;
  let eventBus;
  let logger;
  let assertionHelpers;
  let fs;
  let mockGameDataRepository;

  beforeEach(() => {
    entityManager = new SimpleEntityManager([]);
    eventBus = {
      dispatch: jest.fn().mockResolvedValue(true),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    };
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    assertionHelpers = new ModAssertionHelpers(entityManager);

    fs = require('fs');
    fs.promises.access.mockClear();
    fs.promises.readFile.mockClear();
    mockGameDataRepository = {
      getComponentDefinition: jest.fn().mockReturnValue(null),
      get: jest.fn().mockReturnValue(undefined),
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Exercise Category Pattern Validation', () => {
    it('should validate exercise category uses standard handlers', () => {
      const factoryMethod =
        ModTestHandlerFactory.getHandlerFactoryForCategory('exercise');
      const handlers = factoryMethod(entityManager, eventBus, logger, mockGameDataRepository);

      // Exercise category should use standard handlers
      expect(handlers).toHaveProperty('QUERY_COMPONENT');
      expect(handlers).toHaveProperty('QUERY_COMPONENTS');
      expect(handlers).toHaveProperty('GET_NAME');
      expect(handlers).toHaveProperty('GET_TIMESTAMP');
      expect(handlers).toHaveProperty('DISPATCH_PERCEPTIBLE_EVENT');
      expect(handlers).toHaveProperty('DISPATCH_EVENT');
      expect(handlers).toHaveProperty('QUERY_COMPONENTS');
      expect(handlers).toHaveProperty('END_TURN');
      expect(handlers).toHaveProperty('SET_VARIABLE');
      expect(handlers).toHaveProperty('LOG_MESSAGE');

      // Exercise category should NOT have ADD_COMPONENT
      expect(handlers).not.toHaveProperty('ADD_COMPONENT');

      // Verify handler count matches standard pattern (includes QUERY_LOOKUP, FOR_EACH, IF)
      expect(Object.keys(handlers)).toHaveLength(12);
    });

    it('should validate exercise category entity patterns', () => {
      // Exercise entities typically have stamina, fitness, activity tracking
      const exerciseActor = new ModEntityBuilder('exercise-actor')
        .withName('Fitness Enthusiast')
        .atLocation('gym')
        .withComponent('core:actor', {})
        .withComponent('exercise:stamina', { current: 85, max: 100 })
        .withComponent('exercise:fitness_level', { level: 'intermediate' })
        .withComponent('positioning:standing', {})
        .build();

      entityManager.addEntity(exerciseActor);

      // Validate exercise-specific components
      assertionHelpers.assertComponentAdded(
        'exercise-actor',
        'exercise:stamina'
      );
      assertionHelpers.assertComponentAdded(
        'exercise-actor',
        'exercise:fitness_level'
      );

      const entity = entityManager.getEntityInstance('exercise-actor');
      expect(entity.components['exercise:stamina']).toEqual({
        current: 85,
        max: 100,
      });
    });

    it('should validate exercise category file naming patterns', async () => {
      // Exercise actions follow naming: exercise_<action>_action.js
      // These are the expected paths that would be tried:
      // 'data/mods/exercise/actions/exercise_pushup_action.js',
      // 'data/mods/exercise/actions/pushup_action.js',
      // 'data/mods/exercise/actions/exercise_pushup.js',
      // 'data/mods/exercise/actions/pushup.js',

      // Mock file system to test fallback pattern
      // ModTestFixture uses readFile directly, not access
      // Clear any previous mocks
      fs.promises.readFile.mockClear();

      fs.promises.readFile
        .mockRejectedValueOnce(new Error('File not found')) // First rule path fails
        .mockRejectedValueOnce(new Error('File not found')) // Second rule path fails
        .mockResolvedValueOnce(
          // Third rule path succeeds with valid rule definition
          JSON.stringify({
            $schema: 'schema://living-narrative-engine/rule.schema.json',
            rule_id: 'handle_show_off_biceps',
            event_type: 'core:attempt_action',
            condition: {
              condition_ref: 'exercise:event-is-action-show-off-biceps',
            },
            actions: [
              {
                type: 'DISPATCH_PERCEPTIBLE_EVENT',
                parameters: {
                  perception_type: 'visual',
                  description_text: 'Show off those gains!',
                },
              },
            ],
          })
        )
        .mockRejectedValueOnce(new Error('File not found')) // First condition path fails
        .mockRejectedValueOnce(new Error('File not found')) // Second condition path fails
        .mockResolvedValueOnce(
          // Third condition path succeeds with valid condition definition
          JSON.stringify({
            $schema: 'schema://living-narrative-engine/condition.schema.json',
            id: 'exercise:event-is-action-show-off-biceps',
            description: 'Matches the show_off_biceps action.',
            logic: {
              '==': [
                { var: 'event.payload.actionId' },
                'exercise:show_off_biceps',
              ],
            },
          })
        );

      const testData = await ModTestFixture.forAction(
        'exercise',
        'show_off_biceps'
      );
      expect(testData.actionFile).toBeDefined();

      // Verify correct fallback pattern was used (3 rule attempts + 3 condition attempts)
      expect(fs.promises.readFile).toHaveBeenCalledTimes(6);
    });

    it('should validate exercise category event patterns', async () => {
      const handlers = ModTestHandlerFactory.createStandardHandlers(
        entityManager,
        eventBus,
        logger
      );

      // Exercise events are typically perceptible (visible to other actors)
      await handlers.DISPATCH_PERCEPTIBLE_EVENT.execute({
        location_id: 'test-location',
        description_text: 'Exercise activity started',
        perception_type: 'visual',
        actor_id: 'exercise-actor',
        contextual_data: {
          exercise: 'jogging',
          intensity: 'moderate',
        },
      });

      expect(eventBus.dispatch).toHaveBeenCalledWith(
        'core:perceptible_event',
        expect.objectContaining({
          actorId: 'exercise-actor',
          locationId: 'test-location',
          descriptionText: 'Exercise activity started',
          perceptionType: 'visual',
          contextualData: expect.objectContaining({
            exercise: 'jogging',
            intensity: 'moderate',
          }),
        })
      );

      // Exercise actions typically end turn
      await handlers.END_TURN.execute([]);
      assertionHelpers.assertActionSuccess({
        shouldEndTurn: true,
        shouldHavePerceptibleEvent: true,
      });
    });
  });

  describe('Violence Category Pattern Validation', () => {
    it('should validate violence category uses perception logging handlers', () => {
      const factoryMethod =
        ModTestHandlerFactory.getHandlerFactoryForCategory('violence');
      const handlers = factoryMethod(entityManager, eventBus, logger, mockGameDataRepository);

      // Violence category uses perception logging handlers (17 handlers)
      expect(handlers).toHaveProperty('DISPATCH_EVENT');
      expect(handlers).toHaveProperty('DISPATCH_PERCEPTIBLE_EVENT');
      expect(handlers).toHaveProperty('QUERY_COMPONENTS');
      expect(handlers).toHaveProperty('GET_NAME');
      expect(handlers).toHaveProperty('SET_VARIABLE');
      expect(handlers).toHaveProperty('ADD_COMPONENT');
      expect(handlers).toHaveProperty('ADD_PERCEPTION_LOG_ENTRY');
      expect(handlers).toHaveProperty('REMOVE_COMPONENT');
      expect(handlers).toHaveProperty('LOCK_MOVEMENT');
      expect(handlers).toHaveProperty('UNLOCK_MOVEMENT');

      // Violence uses perception logging handler set (25 handlers)
      // Includes BREAK_CLOSENESS_WITH_TARGET, MERGE_CLOSENESS_CIRCLE, QUERY_LOOKUP, REGENERATE_DESCRIPTION, FOR_EACH, IF, ESTABLISH_LYING_CLOSENESS, and CONSUME_ITEM
      expect(Object.keys(handlers)).toHaveLength(25);
    });

    it('should validate violence category entity patterns', () => {
      // Violence entities have aggressor/victim roles, damage tracking
      const aggressorActor = new ModEntityBuilder('aggressor-actor')
        .withName('Aggressive Character')
        .atLocation('hostile-area')
        .withComponent('core:actor', {})
        .withComponent('violence:aggressor', {
          aggressionLevel: 'high',
          combatSkill: 7,
        })
        .withComponent('violence:health', { current: 100, max: 100 })
        .build();

      const victimActor = new ModEntityBuilder('victim-actor')
        .withName('Target Character')
        .atLocation('hostile-area')
        .closeToEntity('aggressor-actor')
        .withComponent('core:actor', {})
        .withComponent('violence:health', { current: 80, max: 100 })
        .build();

      entityManager.addEntity(aggressorActor);
      entityManager.addEntity(victimActor);

      // Validate violence-specific components
      assertionHelpers.assertComponentAdded(
        'aggressor-actor',
        'violence:aggressor'
      );
      assertionHelpers.assertComponentAdded('victim-actor', 'violence:health');

      const aggressor = entityManager.getEntityInstance('aggressor-actor');
      expect(aggressor.components['violence:aggressor']).toEqual({
        aggressionLevel: 'high',
        combatSkill: 7,
      });
    });

    it('should validate violence category event patterns', async () => {
      const handlers = ModTestHandlerFactory.createStandardHandlers(
        entityManager,
        eventBus,
        logger
      );

      // Violence events can be both regular and perceptible
      await handlers.DISPATCH_EVENT.execute([
        'VIOLENCE_DAMAGE_CALCULATED',
        JSON.stringify({ damage: 15, target: 'victim-actor' }),
      ]);

      await handlers.DISPATCH_PERCEPTIBLE_EVENT.execute([
        'VIOLENCE_INITIATED',
        JSON.stringify({
          aggressor: 'aggressor-actor',
          victim: 'victim-actor',
          action: 'punch',
        }),
      ]);

      // Violence actions may not always end turn (combos, reactions)
      assertionHelpers.assertActionSuccess({
        shouldEndTurn: false,
        shouldHavePerceptibleEvent: true,
      });
    });
  });

  describe('Affection Category Pattern Validation', () => {
    it('should validate affection category uses component mutation handlers', () => {
      const factoryMethod =
        ModTestHandlerFactory.getHandlerFactoryForCategory('affection');
      const handlers = factoryMethod(entityManager, eventBus, logger, mockGameDataRepository);

      // Affection category now supports component mutation operations
      expect(handlers).toHaveProperty('DISPATCH_PERCEPTIBLE_EVENT');
      expect(handlers).toHaveProperty('GET_NAME');
      expect(handlers).toHaveProperty('END_TURN');
      expect(handlers).toHaveProperty('ADD_COMPONENT');
      expect(handlers).toHaveProperty('REMOVE_COMPONENT');

      // Component mutations set includes QUERY_LOOKUP, FOR_EACH, IF (14 handlers total)
      expect(Object.keys(handlers)).toHaveLength(14);
    });

    it('should validate affection category entity patterns', () => {
      // Affection entities have relationship, consent, and emotional state tracking
      const romanticActor = new ModEntityBuilder('romantic-actor')
        .withName('Romantic Lead')
        .atLocation('intimate-setting')
        .withComponent('core:actor', {})
        .withComponent('affection:romantic_interest', {
          target: 'romantic-partner',
          level: 'high',
          relationship: 'dating',
        })
        .withComponent('affection:emotional_state', {
          mood: 'affectionate',
          arousal: 'moderate',
        })
        .build();

      const partnerActor = new ModEntityBuilder('romantic-partner')
        .withName('Romantic Partner')
        .atLocation('intimate-setting')
        .closeToEntity('romantic-actor')
        .withComponent('core:actor', {})
        .withComponent('affection:consent', {
          level: 'enthusiastic',
          boundaries: ['kissing', 'cuddling'],
        })
        .build();

      entityManager.addEntity(romanticActor);
      entityManager.addEntity(partnerActor);

      // Validate affection-specific components
      assertionHelpers.assertComponentAdded(
        'romantic-actor',
        'affection:romantic_interest'
      );
      assertionHelpers.assertComponentAdded(
        'romantic-partner',
        'affection:consent'
      );

      const romantic = entityManager.getEntityInstance('romantic-actor');
      expect(romantic.components['affection:romantic_interest']).toEqual({
        target: 'romantic-partner',
        level: 'high',
        relationship: 'dating',
      });
    });

    it('should validate affection category event patterns', async () => {
      const handlers = ModTestHandlerFactory.createStandardHandlers(
        entityManager,
        eventBus,
        logger
      );

      // Affection events are typically perceptible but private
      await handlers.DISPATCH_PERCEPTIBLE_EVENT.execute([
        'INTIMACY_INITIATED',
        JSON.stringify({
          participants: ['romantic-actor', 'romantic-partner'],
          action: 'kiss_cheek',
          setting: 'private',
        }),
      ]);

      // Intimacy actions typically end turn
      await handlers.END_TURN.execute([]);

      assertionHelpers.assertActionSuccess({
        shouldEndTurn: true,
        shouldHavePerceptibleEvent: true,
      });
    });
  });

  describe('Sex Category Pattern Validation', () => {
    it('should validate sex category uses component mutation handlers', () => {
      const factoryMethod =
        ModTestHandlerFactory.getHandlerFactoryForCategory('sex');
      const handlers = factoryMethod(entityManager, eventBus, logger, mockGameDataRepository);

      // Sex category should support component mutations
      expect(handlers).toHaveProperty('DISPATCH_PERCEPTIBLE_EVENT');
      expect(handlers).toHaveProperty('SET_VARIABLE');
      expect(handlers).toHaveProperty('ADD_COMPONENT');
      expect(handlers).toHaveProperty('REMOVE_COMPONENT');

      // Component mutations set includes QUERY_LOOKUP, FOR_EACH, IF (14 handlers total)
      expect(Object.keys(handlers)).toHaveLength(14);
    });

    it('should validate sex category entity patterns', () => {
      // Sex entities have explicit consent, anatomical details, experience tracking
      const adultActor = new ModEntityBuilder('adult-participant')
        .withName('Adult Participant')
        .atLocation('private-bedroom')
        .withComponent('core:actor', {})
        .withComponent('sex:participant', {
          experience: 'experienced',
          preferences: ['gentle', 'communicative'],
        })
        .withComponent('sex:anatomy', {
          bodyType: 'adult',
          sensitiveAreas: ['neck', 'back'],
        })
        .build();

      const consentingPartner = new ModEntityBuilder('consenting-partner')
        .withName('Consenting Partner')
        .atLocation('private-bedroom')
        .closeToEntity('adult-participant')
        .withComponent('core:actor', {})
        .withComponent('sex:consent', {
          explicit: true,
          boundaries: ['safe_words', 'communication'],
          comfort_level: 'high',
        })
        .build();

      entityManager.addEntity(adultActor);
      entityManager.addEntity(consentingPartner);

      // Validate sex-specific components
      assertionHelpers.assertComponentAdded(
        'adult-participant',
        'sex:participant'
      );
      assertionHelpers.assertComponentAdded(
        'consenting-partner',
        'sex:consent'
      );

      const participant = entityManager.getEntityInstance('adult-participant');
      expect(participant.components['sex:participant']).toEqual({
        experience: 'experienced',
        preferences: ['gentle', 'communicative'],
      });
    });

    it('should validate sex category event patterns', async () => {
      const handlers = ModTestHandlerFactory.createStandardHandlers(
        entityManager,
        eventBus,
        logger
      );

      // Sex events are perceptible to participants but private
      await handlers.DISPATCH_PERCEPTIBLE_EVENT.execute([
        'SEXUAL_ACTION',
        JSON.stringify({
          participants: ['adult-participant', 'consenting-partner'],
          action: 'caress',
          intensity: 'gentle',
          consent_confirmed: true,
        }),
      ]);

      // Sex actions may continue without ending turn
      assertionHelpers.assertActionSuccess({
        shouldEndTurn: false,
        shouldHavePerceptibleEvent: true,
      });
    });
  });

  describe('Positioning Category Pattern Validation', () => {
    it('should validate positioning category uses handlers with ADD_COMPONENT', () => {
      const factoryMethod =
        ModTestHandlerFactory.getHandlerFactoryForCategory('positioning');
      const handlers = factoryMethod(entityManager, eventBus, logger, mockGameDataRepository);

      // Positioning category MUST have ADD_COMPONENT handler
      expect(handlers).toHaveProperty('ADD_COMPONENT');
      expect(handlers).toHaveProperty('GET_NAME');
      expect(handlers).toHaveProperty('DISPATCH_PERCEPTIBLE_EVENT');
      expect(handlers).toHaveProperty('END_TURN');

      // Positioning uses extended handler set with perception logging (25 handlers instead of 12)
      // Includes: 12 standard (with QUERY_LOOKUP, FOR_EACH, IF) + ADD_COMPONENT, ADD_PERCEPTION_LOG_ENTRY, REMOVE_COMPONENT,
      // LOCK_MOVEMENT, UNLOCK_MOVEMENT, MODIFY_ARRAY_FIELD, MODIFY_COMPONENT,
      // ATOMIC_MODIFY_COMPONENT, BREAK_CLOSENESS_WITH_TARGET, MERGE_CLOSENESS_CIRCLE, REGENERATE_DESCRIPTION, ESTABLISH_LYING_CLOSENESS, CONSUME_ITEM
      expect(Object.keys(handlers)).toHaveLength(25);

      // Verify ADD_COMPONENT is functional
      expect(typeof handlers.ADD_COMPONENT.execute).toBe('function');
    });

    it('should validate positioning category entity patterns', () => {
      // Positioning entities have spatial, postural, and furniture interaction data
      const mobileActor = new ModEntityBuilder('mobile-actor')
        .withName('Mobile Character')
        .atLocation('furnished-room')
        .withComponent('core:actor', {})
        .withComponent('positioning:standing', {
          posture: 'upright',
          balance: 'stable',
        })
        .withComponent('positioning:mobility', {
          speed: 'normal',
          agility: 'high',
        })
        .build();

      const furniture = new ModEntityBuilder('comfortable-chair')
        .withName('Comfortable Chair')
        .atLocation('furnished-room')
        .withComponent('positioning:furniture', {
          type: 'chair',
          capacity: 1,
          available: true,
          comfort_level: 'high',
        })
        .build();

      entityManager.addEntity(mobileActor);
      entityManager.addEntity(furniture);

      // Validate positioning-specific components
      assertionHelpers.assertComponentAdded(
        'mobile-actor',
        'positioning:standing'
      );
      assertionHelpers.assertComponentAdded(
        'comfortable-chair',
        'positioning:furniture'
      );

      const actor = entityManager.getEntityInstance('mobile-actor');
      expect(actor.components['positioning:standing']).toEqual({
        posture: 'upright',
        balance: 'stable',
      });
    });

    it('should validate positioning category uses ADD_COMPONENT operations', async () => {
      const handlers = ModTestHandlerFactory.createHandlersWithAddComponent(
        entityManager,
        eventBus,
        logger,
        mockGameDataRepository
      );

      // Create positioning scenario
      const actor = new ModEntityBuilder('positionable-actor')
        .withName('Positionable Actor')
        .atLocation('test-room')
        .withComponent('core:actor', {})
        .withComponent('positioning:standing', {})
        .build();

      entityManager.addEntity(actor);

      // Positioning actions typically use ADD_COMPONENT to change position state
      await handlers.ADD_COMPONENT.execute({
        entity_ref: 'positionable-actor',
        component_type: 'positioning:sitting',
        value: {
          furniture: 'chair',
          comfort: 'comfortable',
          transition: 'smooth',
        },
      });

      // Verify component was added
      assertionHelpers.assertComponentAdded(
        'positionable-actor',
        'positioning:sitting'
      );

      const updatedActor =
        entityManager.getEntityInstance('positionable-actor');
      expect(updatedActor.components).toHaveProperty('positioning:sitting');
      expect(updatedActor.components['positioning:sitting']).toEqual({
        furniture: 'chair',
        comfort: 'comfortable',
        transition: 'smooth',
      });

      // Positioning actions typically end turn after position change
      await handlers.END_TURN.execute([]);

      assertionHelpers.assertActionSuccess({
        shouldEndTurn: true,
        shouldHavePerceptibleEvent: false, // ADD_COMPONENT doesn't create perceptible events
      });
    });

    it('should validate positioning category file naming patterns', async () => {
      // Positioning actions follow naming: positioning_<action>_action.js
      // ModTestFixture uses readFile directly, not access
      // Clear any previous mocks
      fs.promises.readFile.mockClear();

      fs.promises.readFile
        .mockResolvedValueOnce(
          // Rule file succeeds on first attempt
          JSON.stringify({
            $schema: 'schema://living-narrative-engine/rule.schema.json',
            rule_id: 'handle_sit_on_chair',
            event_type: 'core:attempt_action',
            condition: {
              condition_ref: 'positioning:event-is-action-sit-on-chair',
            },
            actions: [
              {
                type: 'ADD_COMPONENT',
                parameters: {
                  entity_ref: 'actor',
                  component_type: 'positioning:sitting',
                  component_data: {
                    furniture: '{{FURNITURE}}',
                  },
                },
              },
            ],
          })
        )
        .mockResolvedValueOnce(
          // Condition file succeeds on first attempt
          JSON.stringify({
            $schema: 'schema://living-narrative-engine/condition.schema.json',
            id: 'positioning:event-is-action-sit-on-chair',
            description: 'Matches the sit_on_chair action.',
            logic: {
              '==': [
                { var: 'event.payload.actionId' },
                'positioning:sit_on_chair',
              ],
            },
          })
        );

      const testData = await ModTestFixture.forAction(
        'positioning',
        'sit_on_chair'
      );
      expect(testData.actionFile).toBeDefined();

      const actionData = JSON.parse(testData.actionFile);
      expect(actionData.rule_id).toBe('handle_sit_on_chair');
      expect(actionData.actions[0].type).toBe('ADD_COMPONENT');
    });
  });

  describe('Cross-Category Pattern Consistency', () => {
    it('should validate consistent handler factory selection across categories', () => {
      const categories = [
        'exercise',
        'violence',
        'affection',
        'sex',
        'positioning',
      ];
      const factoryResults = {};

      categories.forEach((category) => {
        const factoryMethod =
          ModTestHandlerFactory.getHandlerFactoryForCategory(category);
        const handlers = factoryMethod(entityManager, eventBus, logger, mockGameDataRepository);
        factoryResults[category] = {
          handlerCount: Object.keys(handlers).length,
          hasAddComponent: Object.prototype.hasOwnProperty.call(
            handlers,
            'ADD_COMPONENT'
          ),
          commonHandlers: ['GET_NAME', 'END_TURN', 'LOG_MESSAGE'].every((h) =>
            Object.prototype.hasOwnProperty.call(handlers, h)
          ),
        };
      });

      const expectedHandlerConfig = {
        exercise: { handlerCount: 12, hasAddComponent: false }, // +3 for QUERY_LOOKUP, FOR_EACH, IF
        violence: { handlerCount: 25, hasAddComponent: true }, // +3 for QUERY_LOOKUP, FOR_EACH, IF, +1 for REGENERATE_DESCRIPTION, +1 for ESTABLISH_LYING_CLOSENESS, +1 for CONSUME_ITEM
        sex: { handlerCount: 14, hasAddComponent: true }, // +3 for QUERY_LOOKUP, FOR_EACH, IF
        affection: { handlerCount: 14, hasAddComponent: true }, // +3 for QUERY_LOOKUP, FOR_EACH, IF
      };

      Object.entries(expectedHandlerConfig).forEach(
        ([category, { handlerCount, hasAddComponent }]) => {
          expect(factoryResults[category].handlerCount).toBe(handlerCount);
          expect(factoryResults[category].hasAddComponent).toBe(
            hasAddComponent
          );
          expect(factoryResults[category].commonHandlers).toBe(true);
        }
      );

      // Positioning should have 25 handlers (includes ADD_COMPONENT, perception logging handlers, BREAK_CLOSENESS_WITH_TARGET, MERGE_CLOSENESS_CIRCLE, QUERY_LOOKUP, REGENERATE_DESCRIPTION, FOR_EACH, IF, ESTABLISH_LYING_CLOSENESS, and CONSUME_ITEM)
      expect(factoryResults.positioning.handlerCount).toBe(25);
      expect(factoryResults.positioning.hasAddComponent).toBe(true);
      expect(factoryResults.positioning.commonHandlers).toBe(true);
    });

    it('should validate consistent entity builder patterns across categories', () => {
      const categoryEntities = {
        exercise: new ModEntityBuilder('exercise-entity')
          .withName('Exercise Entity')
          .withComponent('core:actor', {})
          .withComponent('exercise:stamina', { current: 100 })
          .build(),

        violence: new ModEntityBuilder('violence-entity')
          .withName('Violence Entity')
          .withComponent('core:actor', {})
          .withComponent('violence:health', { current: 100 })
          .build(),

        affection: new ModEntityBuilder('affection-entity')
          .withName('Affection Entity')
          .withComponent('core:actor', {})
          .withComponent('affection:consent', { level: 'enthusiastic' })
          .build(),

        sex: new ModEntityBuilder('sex-entity')
          .withName('Sex Entity')
          .withComponent('core:actor', {})
          .withComponent('sex:consent', { explicit: true })
          .build(),

        positioning: new ModEntityBuilder('positioning-entity')
          .withName('Positioning Entity')
          .withComponent('core:actor', {})
          .withComponent('positioning:standing', {})
          .build(),
      };

      // All entities should have consistent base structure
      Object.values(categoryEntities).forEach((entity) => {
        expect(entity).toHaveProperty('id');
        expect(entity).toHaveProperty('components');
        expect(entity.components).toHaveProperty('core:actor');
        expect(entity.components).toHaveProperty('core:name');
      });

      // Category-specific components should be present
      expect(categoryEntities.exercise.components).toHaveProperty(
        'exercise:stamina'
      );
      expect(categoryEntities.violence.components).toHaveProperty(
        'violence:health'
      );
      expect(categoryEntities.affection.components).toHaveProperty(
        'affection:consent'
      );
      expect(categoryEntities.sex.components).toHaveProperty('sex:consent');
      expect(categoryEntities.positioning.components).toHaveProperty(
        'positioning:standing'
      );
    });

    it('should validate consistent assertion patterns across categories', () => {
      const testCategories = [
        'exercise',
        'violence',
        'affection',
        'sex',
        'positioning',
      ];

      testCategories.forEach((category) => {
        const actor = new ModEntityBuilder(`${category}-test-actor`)
          .withName(`${category} Test Actor`)
          .withComponent('core:actor', {})
          .withComponent(`${category}:test_component`, { value: 'test' })
          .build();

        entityManager.addEntity(actor);

        // All categories should support component assertions
        expect(() => {
          assertionHelpers.assertComponentAdded(
            `${category}-test-actor`,
            `${category}:test_component`
          );
        }).not.toThrow();

        // All categories should support action success assertions
        expect(() => {
          assertionHelpers.assertActionSuccess({
            shouldEndTurn: true,
            shouldHavePerceptibleEvent: false,
          });
        }).not.toThrow();
      });
    });

    it('should validate consistent file loading patterns across categories', async () => {
      const testCategories = [
        'exercise',
        'violence',
        'affection',
        'sex',
        'positioning',
      ];

      // Clear any previous mocks and reset
      fs.promises.readFile.mockReset();

      // Mock successful file loading for all categories
      // ModTestFixture uses readFile directly, not access
      // Use path-based mocking to handle parallel execution correctly
      fs.promises.readFile.mockImplementation((filePath) => {
        // Extract the category from the file path
        const pathStr = filePath.toString();

        // Check which category this path belongs to
        for (const category of testCategories) {
          if (pathStr.includes(`mods/${category}/`)) {
            // Check if this is a rule file or condition file
            if (pathStr.includes('/rules/')) {
              // Return rule file for this category
              return Promise.resolve(
                JSON.stringify({
                  $schema: 'schema://living-narrative-engine/rule.schema.json',
                  rule_id: `handle_${category}_test_action`,
                  event_type: 'core:attempt_action',
                  condition: {
                    condition_ref: `${category}:event-is-action-test-action`,
                  },
                  actions: [
                    {
                      type: 'LOG_MESSAGE',
                      parameters: {
                        message: `Test ${category} Action`,
                      },
                    },
                  ],
                })
              );
            } else if (pathStr.includes('/conditions/')) {
              // Return condition file
              return Promise.resolve(
                JSON.stringify({
                  $schema: 'schema://living-narrative-engine/condition.schema.json',
                  id: `${category}:event-is-action-test-action`,
                  description: `Matches the ${category} test action.`,
                  logic: {
                    '==': [
                      { var: 'event.payload.actionId' },
                      `${category}:test_action`,
                    ],
                  },
                })
              );
            }
          }
        }

        // If path doesn't match any expected pattern, reject
        return Promise.reject(new Error(`File not found: ${filePath}`));
      });

      const loadPromises = testCategories.map(async (category) => {
        const testData = await ModTestFixture.forAction(
          category,
          'test_action'
        );
        expect(testData.actionFile).toBeDefined();

        const actionData = JSON.parse(testData.actionFile);
        expect(actionData.rule_id).toBe(`handle_${category}_test_action`);
        return actionData;
      });

      const results = await Promise.all(loadPromises);

      // All categories should successfully load with consistent structure
      results.forEach((actionData, index) => {
        expect(actionData).toHaveProperty('rule_id');
        expect(actionData).toHaveProperty('event_type');
        expect(actionData).toHaveProperty('actions');
        expect(actionData.actions.length).toBeGreaterThan(0);
        expect(actionData.condition).toHaveProperty('condition_ref');
        expect(actionData.condition.condition_ref).toBe(
          `${testCategories[index]}:event-is-action-test-action`
        );
      });
    });
  });

  describe('Unknown Category Pattern Validation', () => {
    it('should validate unknown categories default to standard handlers', () => {
      const unknownCategories = [
        'custom',
        'fantasy',
        'scifi',
        'horror',
        'comedy',
      ];

      unknownCategories.forEach((category) => {
        const factoryMethod =
          ModTestHandlerFactory.getHandlerFactoryForCategory(category);
        const handlers = factoryMethod(entityManager, eventBus, logger, mockGameDataRepository);

        // Unknown categories should default to standard handlers (12 handlers including QUERY_LOOKUP, FOR_EACH, IF)
        expect(Object.keys(handlers)).toHaveLength(12);
        expect(handlers).not.toHaveProperty('ADD_COMPONENT');

        // Should have all standard handlers
        expect(handlers).toHaveProperty('QUERY_COMPONENT');
        expect(handlers).toHaveProperty('QUERY_COMPONENTS');
        expect(handlers).toHaveProperty('GET_NAME');
        expect(handlers).toHaveProperty('GET_TIMESTAMP');
        expect(handlers).toHaveProperty('DISPATCH_PERCEPTIBLE_EVENT');
        expect(handlers).toHaveProperty('DISPATCH_EVENT');
        expect(handlers).toHaveProperty('END_TURN');
        expect(handlers).toHaveProperty('SET_VARIABLE');
        expect(handlers).toHaveProperty('LOG_MESSAGE');
      });
    });

    it('should validate empty/null categories handle gracefully', () => {
      const edgeCases = ['', null, undefined, 'unknown'];

      edgeCases.forEach((category) => {
        const factoryMethod =
          ModTestHandlerFactory.getHandlerFactoryForCategory(category);
        expect(factoryMethod).toBeDefined();
        expect(typeof factoryMethod).toBe('function');

        const handlers = factoryMethod(entityManager, eventBus, logger, mockGameDataRepository);
        expect(handlers).toBeDefined();
        expect(Object.keys(handlers)).toHaveLength(12); // Default to standard handlers (including QUERY_LOOKUP, FOR_EACH, IF)
      });
    });
  });
});
