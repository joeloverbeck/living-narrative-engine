/**
 * @file Comprehensive unit tests for ModTestFixture
 * @description Complete test coverage for ModTestFixture factory and all fixture classes
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import {
  ModTestFixture,
  ModActionTestFixture,
  ModRuleTestFixture,
  ModCategoryTestFixture,
} from '../../../common/mods/ModTestFixture.js';

import { ModEntityScenarios } from '../../../common/mods/ModEntityBuilder.js';
import { ModAssertionHelpers } from '../../../common/mods/ModAssertionHelpers.js';
import { createTestBed } from '../../../common/testBed.js';

// Mock the file loading (both async and sync APIs used in fixtures)
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    readdir: jest.fn().mockResolvedValue([]),
  },
  existsSync: jest.fn().mockReturnValue(false),
  readdirSync: jest.fn().mockReturnValue([]),
  readFileSync: jest.fn().mockReturnValue('{}'),
}));

describe('ModTestFixture - Comprehensive Unit Tests', () => {
  let testBed;
  let mockRuleFile;
  let mockConditionFile;

  beforeEach(() => {
    testBed = createTestBed();
    jest.clearAllMocks();

    mockRuleFile = {
      rule_id: 'handle_kiss_cheek',
      event_type: 'core:attempt_action',
      condition: { condition_ref: 'intimacy:event-is-action-kiss-cheek' },
      actions: [{ type: 'GET_NAME', parameters: {} }],
    };

    mockConditionFile = {
      id: 'intimacy:event-is-action-kiss-cheek',
      description:
        'Checks if the triggering event is for the kissing:kiss_cheek action.',
      logic: {
        '==': [{ var: 'event.payload.actionId' }, 'kissing:kiss_cheek'],
      },
    };
  });

  afterEach(() => {
    testBed.cleanup();
  });

  describe('ModTestFixture Factory Methods', () => {
    describe('forAction (without auto-loading)', () => {
      it('should create ModActionTestFixture with provided files', async () => {
        const fixture = await ModTestFixture.forAction(
          'intimacy',
          'kissing:kiss_cheek',
          mockRuleFile,
          mockConditionFile
        );

        expect(fixture).toBeInstanceOf(ModActionTestFixture);
        expect(fixture.modId).toBe('intimacy');
        expect(fixture.actionId).toBe('kissing:kiss_cheek');
        expect(fixture.ruleFile).toEqual(mockRuleFile);
        expect(fixture.conditionFile).toEqual(mockConditionFile);
      });

      it('should accept options parameter', async () => {
        const options = { customOption: 'value' };
        const fixture = await ModTestFixture.forAction(
          'intimacy',
          'kissing:kiss_cheek',
          mockRuleFile,
          mockConditionFile,
          options
        );

        expect(fixture.options).toEqual(options);
      });

      it('should throw descriptive error on fixture creation failure', async () => {
        // Pass invalid rule file to trigger constructor error
        const invalidRuleFile = null;

        await expect(
          ModTestFixture.forAction(
            'intimacy',
            'kissing:kiss_cheek',
            invalidRuleFile,
            mockConditionFile
          )
        ).rejects.toThrow(
          /ModTestFixture.forAction failed for intimacy:kissing:kiss_cheek/
        );
      });
    });

    describe('forRule (without auto-loading)', () => {
      it('should create ModRuleTestFixture with provided files', async () => {
        const fixture = await ModTestFixture.forRule(
          'intimacy',
          'handle_kiss_cheek',
          mockRuleFile,
          mockConditionFile
        );

        expect(fixture).toBeInstanceOf(ModRuleTestFixture);
        expect(fixture.modId).toBe('intimacy');
        expect(fixture.ruleId).toBe('handle_kiss_cheek');
        expect(fixture.ruleFile).toEqual(mockRuleFile);
        expect(fixture.conditionFile).toEqual(mockConditionFile);
      });

      it('should accept options parameter', async () => {
        const options = { ruleOption: true };
        const fixture = await ModTestFixture.forRule(
          'intimacy',
          'handle_kiss_cheek',
          mockRuleFile,
          mockConditionFile,
          options
        );

        expect(fixture.options).toEqual(options);
      });

      it('should throw descriptive error on fixture creation failure', async () => {
        const invalidRuleFile = null;

        await expect(
          ModTestFixture.forRule(
            'intimacy',
            'handle_kiss_cheek',
            invalidRuleFile,
            mockConditionFile
          )
        ).rejects.toThrow(
          /ModTestFixture.forRule failed for intimacy:handle_kiss_cheek/
        );
      });
    });

    describe('forCategory', () => {
      it('should create ModCategoryTestFixture', () => {
        const fixture = ModTestFixture.forCategory('positioning');

        expect(fixture).toBeInstanceOf(ModCategoryTestFixture);
        expect(fixture.categoryName).toBe('positioning');
        expect(fixture.modId).toBe('positioning');
      });

      it('should accept options parameter', () => {
        const options = { categorySpecific: 'setting' };
        const fixture = ModTestFixture.forCategory('intimacy', options);

        expect(fixture.options).toEqual(options);
      });

      it('should handle all supported categories', () => {
        const categories = [
          'positioning',
          'intimacy',
          'sex',
          'violence',
          'exercise',
        ];

        categories.forEach((category) => {
          const fixture = ModTestFixture.forCategory(category);
          expect(fixture.categoryName).toBe(category);
        });
      });
    });
  });

  describe('BaseModTestFixture', () => {
    let fixture;

    beforeEach(async () => {
      fixture = await ModTestFixture.forAction(
        'intimacy',
        'kissing:kiss_cheek',
        mockRuleFile,
        mockConditionFile
      );
    });

    describe('setupEnvironment', () => {
      it('should create test environment with proper configuration', () => {
        expect(fixture.testEnv).toBeTruthy();
        expect(fixture.eventBus).toBeDefined();
        expect(fixture.entityManager).toBeDefined();
        expect(fixture.logger).toBeDefined();
      });

      it('should expand macros in rule actions', () => {
        // The fixture should have processed macros during setup
        expect(fixture.testEnv).toBeTruthy();
        // Specific macro expansion would be tested in integration tests
      });

      it('should configure data registry with rule and condition', () => {
        const dataRegistry = fixture.testEnv.dataRegistry;
        expect(dataRegistry.getAllSystemRules).toBeDefined();
        expect(dataRegistry.getConditionDefinition).toBeDefined();

        // Test that our rule is returned
        const rules = dataRegistry.getAllSystemRules();
        expect(rules).toHaveLength(1);
        expect(rules[0].rule_id).toBe('handle_kiss_cheek');
      });
    });

    describe('reset', () => {
      it('should reset environment with new entities', () => {
        const mockEntities = [
          { id: 'entity1', components: {} },
          { id: 'entity2', components: {} },
        ];

        // Mock the reset method on testEnv
        fixture.testEnv.reset = jest.fn();

        fixture.reset(mockEntities);

        expect(fixture.testEnv.reset).toHaveBeenCalledWith(mockEntities);
      });

      it('should handle reset with empty entities array', () => {
        fixture.testEnv.reset = jest.fn();

        fixture.reset();

        expect(fixture.testEnv.reset).toHaveBeenCalledWith([]);
      });

      it('should handle reset when testEnv is null', () => {
        fixture.testEnv = null;

        // Should not throw
        expect(() => fixture.reset()).not.toThrow();
      });
    });

    describe('cleanup', () => {
      it('should cleanup test environment', () => {
        fixture.testEnv.cleanup = jest.fn();

        fixture.cleanup();

        expect(fixture.testEnv.cleanup).toHaveBeenCalled();
      });

      it('should handle cleanup when testEnv is null', () => {
        fixture.testEnv = null;

        // Should not throw
        expect(() => fixture.cleanup()).not.toThrow();
      });
    });

    describe('property accessors', () => {
      it('should return eventBus from testEnv', () => {
        const mockEventBus = { dispatch: jest.fn() };
        fixture.testEnv.eventBus = mockEventBus;

        expect(fixture.eventBus).toBe(mockEventBus);
      });

      it('should return events from testEnv', () => {
        const mockEvents = [{ type: 'test_event' }];
        fixture.testEnv.events = mockEvents;

        expect(fixture.events).toBe(mockEvents);
      });

      it('should return empty array when testEnv has no events', () => {
        fixture.testEnv.events = undefined;

        expect(fixture.events).toEqual([]);
      });

      it('should return entityManager from testEnv', () => {
        const mockEntityManager = { getEntityInstance: jest.fn() };
        fixture.testEnv.entityManager = mockEntityManager;

        expect(fixture.entityManager).toBe(mockEntityManager);
      });

      it('should return logger from testEnv', () => {
        const mockLogger = { info: jest.fn() };
        fixture.testEnv.logger = mockLogger;

        expect(fixture.logger).toBe(mockLogger);
      });

      it('should handle null testEnv gracefully', () => {
        fixture.testEnv = null;

        expect(fixture.eventBus).toBeUndefined();
        expect(fixture.events).toEqual([]);
        expect(fixture.entityManager).toBeUndefined();
        expect(fixture.logger).toBeUndefined();
      });
    });
  });

  describe('ModActionTestFixture', () => {
    let fixture;

    beforeEach(async () => {
      fixture = await ModTestFixture.forAction(
        'intimacy',
        'kissing:kiss_cheek',
        mockRuleFile,
        mockConditionFile
      );
    });

    describe('constructor', () => {
      it('should set action-specific properties', () => {
        expect(fixture.actionId).toBe('kissing:kiss_cheek');
        expect(fixture.ruleFile).toEqual(mockRuleFile);
        expect(fixture.conditionFile).toEqual(mockConditionFile);
      });

      it('should setup environment with correct condition ID', () => {
        // Condition ID should be derived from action ID
        expect(fixture.testEnv).toBeTruthy();
      });

      it('should handle action IDs with and without namespace', async () => {
        const fixtureSimple = await ModTestFixture.forAction(
          'intimacy',
          'kiss_cheek',
          mockRuleFile,
          mockConditionFile
        );

        expect(fixtureSimple.actionId).toBe('kiss_cheek');
        expect(fixtureSimple.testEnv).toBeTruthy();
      });
    });

    describe('createStandardActorTarget', () => {
      it('should create standard actor-target scenario', () => {
        const mockScenario = {
          actor: { id: 'alice', components: {} },
          target: { id: 'bob', components: {} },
        };

        // Mock ModEntityScenarios
        const createActorTargetPairSpy = jest
          .spyOn(ModEntityScenarios, 'createActorTargetPair')
          .mockReturnValue(mockScenario);
        const createRoomSpy = jest
          .spyOn(ModEntityScenarios, 'createRoom')
          .mockReturnValue({ id: 'room1', components: {} });

        fixture.reset = jest.fn();

        const result = fixture.createStandardActorTarget(['Alice', 'Bob']);

        expect(createActorTargetPairSpy).toHaveBeenCalledWith({
          names: ['Alice', 'Bob'],
          location: 'room1',
          closeProximity: true,
        });
        expect(createRoomSpy).toHaveBeenCalledWith('room1', 'Test Room');
        expect(fixture.reset).toHaveBeenCalled();
        expect(result).toBe(mockScenario);

        createActorTargetPairSpy.mockRestore();
        createRoomSpy.mockRestore();
      });

      it('should accept custom options', () => {
        const mockScenario = {
          actor: { id: 'alice', components: {} },
          target: { id: 'bob', components: {} },
        };

        const createActorTargetPairSpy = jest
          .spyOn(ModEntityScenarios, 'createActorTargetPair')
          .mockReturnValue(mockScenario);
        jest
          .spyOn(ModEntityScenarios, 'createRoom')
          .mockReturnValue({ id: 'room2', components: {} });

        fixture.reset = jest.fn();

        fixture.createStandardActorTarget(['Custom1', 'Custom2'], {
          location: 'room2',
          customOption: true,
        });

        expect(createActorTargetPairSpy).toHaveBeenCalledWith({
          names: ['Custom1', 'Custom2'],
          location: 'room2',
          closeProximity: true,
          customOption: true,
        });

        createActorTargetPairSpy.mockRestore();
      });

      it('should handle includeRoom option', () => {
        const mockScenario = {
          actor: { id: 'alice', components: {} },
          target: { id: 'bob', components: {} },
        };

        jest
          .spyOn(ModEntityScenarios, 'createActorTargetPair')
          .mockReturnValue(mockScenario);
        const createRoomSpy = jest
          .spyOn(ModEntityScenarios, 'createRoom')
          .mockReturnValue({ id: 'room1', components: {} });

        fixture.reset = jest.fn();

        fixture.createStandardActorTarget(['Alice', 'Bob'], {
          includeRoom: false,
        });

        expect(createRoomSpy).not.toHaveBeenCalled();
        expect(fixture.reset).toHaveBeenCalledWith([
          mockScenario.actor,
          mockScenario.target,
        ]);
      });
    });

    describe('createCloseActors', () => {
      it('should create close proximity actors', () => {
        const createStandardActorTargetSpy = jest
          .spyOn(fixture, 'createStandardActorTarget')
          .mockReturnValue({ actor: {}, target: {} });

        fixture.createCloseActors(['Alice', 'Bob'], { customOption: true });

        expect(createStandardActorTargetSpy).toHaveBeenCalledWith(
          ['Alice', 'Bob'],
          {
            closeProximity: true,
            customOption: true,
          }
        );

        createStandardActorTargetSpy.mockRestore();
      });
    });

    describe('createAnatomyScenario', () => {
      it('should create anatomy scenario with body parts', () => {
        const mockScenario = {
          allEntities: [
            { id: 'alice', components: {} },
            { id: 'bob', components: {} },
            { id: 'torso1', components: {} },
          ],
        };

        const createAnatomyScenarioSpy = jest
          .spyOn(ModEntityScenarios, 'createAnatomyScenario')
          .mockReturnValue(mockScenario);
        jest
          .spyOn(ModEntityScenarios, 'createRoom')
          .mockReturnValue({ id: 'room1', components: {} });

        fixture.reset = jest.fn();

        const result = fixture.createAnatomyScenario(
          ['Alice', 'Bob'],
          ['torso'],
          { anatomyOption: true }
        );

        expect(createAnatomyScenarioSpy).toHaveBeenCalledWith({
          names: ['Alice', 'Bob'],
          location: 'room1',
          bodyParts: ['torso'],
          anatomyOption: true,
        });
        expect(result).toBe(mockScenario);

        createAnatomyScenarioSpy.mockRestore();
      });
    });

    describe('createMultiActorScenario', () => {
      it('should create multi-actor scenario with observers', () => {
        const mockScenario = {
          allEntities: [
            { id: 'alice', components: {} },
            { id: 'bob', components: {} },
            { id: 'charlie', components: {} },
          ],
        };

        const createMultiActorScenarioSpy = jest
          .spyOn(ModEntityScenarios, 'createMultiActorScenario')
          .mockReturnValue(mockScenario);
        jest
          .spyOn(ModEntityScenarios, 'createRoom')
          .mockReturnValue({ id: 'room1', components: {} });

        fixture.reset = jest.fn();

        const result = fixture.createMultiActorScenario(
          ['Alice', 'Bob', 'Charlie'],
          { multiOption: true }
        );

        expect(createMultiActorScenarioSpy).toHaveBeenCalledWith({
          names: ['Alice', 'Bob', 'Charlie'],
          location: 'room1',
          closeToMain: 1,
          multiOption: true,
        });
        expect(result).toBe(mockScenario);

        createMultiActorScenarioSpy.mockRestore();
      });
    });

    describe('executeAction', () => {
      it('should dispatch action with correct payload', async () => {
        // Setup: Create entities for the test
        fixture.reset([
          { id: 'alice', components: {} },
          { id: 'bob', components: {} },
        ]);

        fixture.testEnv.eventBus = { dispatch: jest.fn() };

        await fixture.executeAction('alice', 'bob', { skipDiscovery: true });

        expect(fixture.eventBus.dispatch).toHaveBeenCalledWith(
          'core:attempt_action',
          expect.objectContaining({
            eventName: 'core:attempt_action',
            actorId: 'alice',
            actionId: 'kissing:kiss_cheek',
            targetId: 'bob',
            originalInput: 'kiss_cheek bob',
          })
        );
      });

      it('should accept custom options', async () => {
        // Setup: Create entities for the test
        fixture.reset([
          { id: 'alice', components: {} },
          { id: 'bob', components: {} },
        ]);

        fixture.testEnv.eventBus = { dispatch: jest.fn() };

        await fixture.executeAction('alice', 'bob', {
          skipDiscovery: true,
          originalInput: 'custom input',
          additionalPayload: { customField: 'value' },
        });

        expect(fixture.eventBus.dispatch).toHaveBeenCalledWith(
          'core:attempt_action',
          expect.objectContaining({
            originalInput: 'custom input',
            customField: 'value',
          })
        );
      });

      it('should extract action name from namespaced action ID', async () => {
        // Setup: Create entities for the test
        fixture.reset([
          { id: 'alice', components: {} },
          { id: 'bob', components: {} },
        ]);

        fixture.testEnv.eventBus = { dispatch: jest.fn() };

        await fixture.executeAction('alice', 'bob', { skipDiscovery: true });

        const call = fixture.eventBus.dispatch.mock.calls[0];
        const payload = call[1];
        expect(payload.originalInput).toBe('kiss_cheek bob');
      });
    });

    describe('assertion methods', () => {
      it('should delegate assertActionSuccess to ModAssertionHelpers', () => {
        const assertActionSuccessSpy = jest
          .spyOn(ModAssertionHelpers, 'assertActionSuccess')
          .mockImplementation(() => {});

        fixture.testEnv.events = [{ type: 'success' }];
        fixture.assertActionSuccess('Expected message', { option: true });

        expect(assertActionSuccessSpy).toHaveBeenCalledWith(
          fixture.events,
          'Expected message',
          { option: true }
        );

        assertActionSuccessSpy.mockRestore();
      });

      it('should delegate assertPerceptibleEvent to ModAssertionHelpers', () => {
        const assertPerceptibleEventSpy = jest
          .spyOn(ModAssertionHelpers, 'assertPerceptibleEvent')
          .mockImplementation(() => {});

        fixture.testEnv.events = [{ type: 'perceptible' }];
        const expectedEvent = { type: 'perceptible' };
        fixture.assertPerceptibleEvent(expectedEvent);

        expect(assertPerceptibleEventSpy).toHaveBeenCalledWith(
          fixture.events,
          expectedEvent
        );

        assertPerceptibleEventSpy.mockRestore();
      });

      it('should delegate assertComponentAdded to ModAssertionHelpers', () => {
        const assertComponentAddedSpy = jest
          .spyOn(ModAssertionHelpers, 'assertComponentAdded')
          .mockImplementation(() => {});

        fixture.testEnv.entityManager = { hasComponent: jest.fn() };
        fixture.assertComponentAdded('entity1', 'component1', { data: true });

        expect(assertComponentAddedSpy).toHaveBeenCalledWith(
          fixture.entityManager,
          'entity1',
          'component1',
          { data: true }
        );

        assertComponentAddedSpy.mockRestore();
      });

      it('should delegate assertActionFailure to ModAssertionHelpers', () => {
        const assertActionFailureSpy = jest
          .spyOn(ModAssertionHelpers, 'assertActionFailure')
          .mockImplementation(() => {});

        fixture.testEnv.events = [];
        fixture.assertActionFailure({ option: true });

        expect(assertActionFailureSpy).toHaveBeenCalledWith(fixture.events, {
          option: true,
        });

        assertActionFailureSpy.mockRestore();
      });

      it('should delegate assertOnlyExpectedEvents to ModAssertionHelpers', () => {
        const assertOnlyExpectedEventsSpy = jest
          .spyOn(ModAssertionHelpers, 'assertOnlyExpectedEvents')
          .mockImplementation(() => {});

        fixture.testEnv.events = [{ type: 'allowed' }];
        fixture.assertOnlyExpectedEvents(['allowed']);

        expect(assertOnlyExpectedEventsSpy).toHaveBeenCalledWith(
          fixture.events,
          ['allowed']
        );

        assertOnlyExpectedEventsSpy.mockRestore();
      });
    });

    describe('clearEvents', () => {
      it('should clear events array', () => {
        fixture.testEnv.events = [{ type: 'event1' }, { type: 'event2' }];

        fixture.clearEvents();

        expect(fixture.events).toHaveLength(0);
      });

      it('should handle null events array', () => {
        fixture.testEnv.events = null;

        // Should not throw
        expect(() => fixture.clearEvents()).not.toThrow();
      });
    });
  });

  describe('ModRuleTestFixture', () => {
    let fixture;

    beforeEach(async () => {
      fixture = await ModTestFixture.forRule(
        'intimacy',
        'handle_kiss_cheek',
        mockRuleFile,
        mockConditionFile
      );
    });

    describe('constructor', () => {
      it('should inherit from ModActionTestFixture and set rule-specific properties', () => {
        expect(fixture).toBeInstanceOf(ModActionTestFixture);
        expect(fixture.ruleId).toBe('handle_kiss_cheek');
        expect(fixture.actionId).toBe('handle_kiss_cheek'); // Should be same as ruleId
      });
    });

    describe('testRuleTriggers', () => {
      it('should test that rule triggers for correct action', async () => {
        const executeActionSpy = jest
          .spyOn(fixture, 'executeAction')
          .mockResolvedValue();

        await fixture.testRuleTriggers('alice', 'kissing:kiss_cheek', 'bob');

        expect(executeActionSpy).toHaveBeenCalledWith('alice', 'bob', {
          originalInput: 'kiss_cheek bob',
        });

        executeActionSpy.mockRestore();
      });

      it('should extract action name from namespaced action ID', async () => {
        const executeActionSpy = jest
          .spyOn(fixture, 'executeAction')
          .mockResolvedValue();

        await fixture.testRuleTriggers(
          'alice',
          'deference:kneel_before',
          'bob'
        );

        expect(executeActionSpy).toHaveBeenCalledWith('alice', 'bob', {
          originalInput: 'kneel_before bob',
        });

        executeActionSpy.mockRestore();
      });
    });

    describe('testRuleDoesNotTrigger', () => {
      it('should test that rule does not trigger for wrong action', async () => {
        fixture.testEnv.eventBus = { dispatch: jest.fn() };
        fixture.testEnv.events = [];

        const assertRuleDidNotTriggerSpy = jest
          .spyOn(ModAssertionHelpers, 'assertRuleDidNotTrigger')
          .mockImplementation(() => {});

        await fixture.testRuleDoesNotTrigger('alice', 'wrong:action', 'bob');

        expect(fixture.eventBus.dispatch).toHaveBeenCalledWith(
          'core:attempt_action',
          expect.objectContaining({
            eventName: 'core:attempt_action',
            actorId: 'alice',
            actionId: 'wrong:action',
            targetId: 'bob',
            originalInput: 'action bob',
          })
        );
        expect(assertRuleDidNotTriggerSpy).toHaveBeenCalledWith(
          fixture.events,
          0
        );

        assertRuleDidNotTriggerSpy.mockRestore();
      });

      it('should handle action without target', async () => {
        fixture.testEnv.eventBus = { dispatch: jest.fn() };
        fixture.testEnv.events = [];

        const assertRuleDidNotTriggerSpy = jest
          .spyOn(ModAssertionHelpers, 'assertRuleDidNotTrigger')
          .mockImplementation(() => {});

        await fixture.testRuleDoesNotTrigger('alice', 'wrong:action');

        expect(fixture.eventBus.dispatch).toHaveBeenCalledWith(
          'core:attempt_action',
          expect.objectContaining({
            eventName: 'core:attempt_action',
            actorId: 'alice',
            actionId: 'wrong:action',
          })
        );
        expect(fixture.eventBus.dispatch.mock.calls[0][1]).not.toHaveProperty(
          'targetId'
        );
        expect(fixture.eventBus.dispatch.mock.calls[0][1]).not.toHaveProperty(
          'originalInput'
        );

        assertRuleDidNotTriggerSpy.mockRestore();
      });
    });
  });

  describe('ModCategoryTestFixture', () => {
    describe('constructor', () => {
      it('should set category-specific properties', () => {
        const fixture = new ModCategoryTestFixture('positioning', {
          option: 'value',
        });

        expect(fixture.categoryName).toBe('positioning');
        expect(fixture.modId).toBe('positioning'); // Should inherit from BaseModTestFixture
        expect(fixture.options).toEqual({ option: 'value' });
      });
    });

    describe('createCategoryScenario', () => {
      it('should create positioning scenario', () => {
        const fixture = new ModCategoryTestFixture('positioning');
        const mockScenario = { actor: {}, target: {} };

        const createPositioningScenarioSpy = jest
          .spyOn(ModEntityScenarios, 'createPositioningScenario')
          .mockReturnValue(mockScenario);

        const result = fixture.createCategoryScenario('test', { option: true });

        expect(createPositioningScenarioSpy).toHaveBeenCalledWith({
          option: true,
        });
        expect(result).toBe(mockScenario);

        createPositioningScenarioSpy.mockRestore();
      });

      it('should create intimacy scenario with close proximity', () => {
        const fixture = new ModCategoryTestFixture('intimacy');
        const mockScenario = { actor: {}, target: {} };

        const createActorTargetPairSpy = jest
          .spyOn(ModEntityScenarios, 'createActorTargetPair')
          .mockReturnValue(mockScenario);

        const result = fixture.createCategoryScenario('test', { option: true });

        expect(createActorTargetPairSpy).toHaveBeenCalledWith({
          closeProximity: true,
          option: true,
        });
        expect(result).toBe(mockScenario);

        createActorTargetPairSpy.mockRestore();
      });

      it('should create sex scenario with close proximity', () => {
        const fixture = new ModCategoryTestFixture('sex');
        const mockScenario = { actor: {}, target: {} };

        const createActorTargetPairSpy = jest
          .spyOn(ModEntityScenarios, 'createActorTargetPair')
          .mockReturnValue(mockScenario);

        fixture.createCategoryScenario('test');

        expect(createActorTargetPairSpy).toHaveBeenCalledWith({
          closeProximity: true,
        });

        createActorTargetPairSpy.mockRestore();
      });

      it('should create violence scenario without close proximity', () => {
        const fixture = new ModCategoryTestFixture('violence');
        const mockScenario = { actor: {}, target: {} };

        const createActorTargetPairSpy = jest
          .spyOn(ModEntityScenarios, 'createActorTargetPair')
          .mockReturnValue(mockScenario);

        fixture.createCategoryScenario('test');

        expect(createActorTargetPairSpy).toHaveBeenCalledWith({});

        createActorTargetPairSpy.mockRestore();
      });

      it('should create exercise scenario without close proximity', () => {
        const fixture = new ModCategoryTestFixture('exercise');
        const mockScenario = { actor: {}, target: {} };

        const createActorTargetPairSpy = jest
          .spyOn(ModEntityScenarios, 'createActorTargetPair')
          .mockReturnValue(mockScenario);

        fixture.createCategoryScenario('test');

        expect(createActorTargetPairSpy).toHaveBeenCalledWith({});

        createActorTargetPairSpy.mockRestore();
      });

      it('should handle unknown category with default scenario', () => {
        const fixture = new ModCategoryTestFixture('unknown');
        const mockScenario = { actor: {}, target: {} };

        const createActorTargetPairSpy = jest
          .spyOn(ModEntityScenarios, 'createActorTargetPair')
          .mockReturnValue(mockScenario);

        fixture.createCategoryScenario('test');

        expect(createActorTargetPairSpy).toHaveBeenCalledWith({});

        createActorTargetPairSpy.mockRestore();
      });
    });

    describe('getDefaultEntities', () => {
      it('should return default entities for category', () => {
        const fixture = new ModCategoryTestFixture('intimacy');
        const mockScenario = {
          actor: { id: 'actor1' },
          target: { id: 'target1' },
        };
        const mockRoom = { id: 'room1' };

        jest
          .spyOn(fixture, 'createCategoryScenario')
          .mockReturnValue(mockScenario);
        jest.spyOn(ModEntityScenarios, 'createRoom').mockReturnValue(mockRoom);

        const entities = fixture.getDefaultEntities();

        expect(entities).toEqual([
          mockRoom,
          mockScenario.actor,
          mockScenario.target,
        ]);
      });
    });
  });
});
