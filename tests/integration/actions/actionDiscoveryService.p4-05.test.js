/**
 * @file Test suite to ensure the new ActionDiscoverService for Phase 4 works properly.
 * @see tests/integration/actions/actionDiscoveryService.p4-05.test.js
 */
import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import { mock, mockReset } from 'jest-mock-extended';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import { ActionPipelineOrchestrator } from '../../../src/actions/actionPipelineOrchestrator.js';
import {
  TARGET_DOMAIN_NONE,
  TARGET_DOMAIN_SELF,
} from '../../../src/constants/targetDomains.js';
import { PrerequisiteEvaluationService } from '../../../src/actions/validation/prerequisiteEvaluationService.js';
import { ActionIndex } from '../../../src/actions/actionIndex.js';
import { IEntityManager } from '../../../src/interfaces/IEntityManager.js';
import { createMockActionErrorContextBuilder } from '../../common/mockFactories/actions.js';

// Mocks for all dependencies
const mockActionIndex = mock(ActionIndex);
const mockPrereqService = mock(PrerequisiteEvaluationService);
const mockEntityManager = mock(IEntityManager);
const mockTargetResolutionService = {
  resolveTargets: jest.fn(),
};
const mockLogger = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};
const mockFormatActionCommandFn = jest.fn();

// Other dependencies that are required by the constructor but may not be used in every test
const mockEventDispatcher = mock();
const mockGetActorLocationFn = jest.fn();
const mockGetEntityDisplayNameFn = jest.fn();
const mockActionErrorContextBuilder = createMockActionErrorContextBuilder();

// Mock ActionPipelineOrchestrator
const mockActionPipelineOrchestrator = {
  discoverActions: jest.fn(),
};

describe('ADS-P4-05: Streamlined ActionDiscoveryService', () => {
  let service;
  let actorEntity;

  beforeEach(() => {
    // Reset mocks before each test to ensure isolation
    mockReset(mockActionIndex);
    mockReset(mockPrereqService);
    mockReset(mockEntityManager);
    mockReset(mockEventDispatcher);
    // Clear mocks for jest.fn()
    Object.values(mockLogger).forEach((fn) => fn.mockClear());
    mockGetActorLocationFn.mockClear();
    mockGetEntityDisplayNameFn.mockClear();
    mockFormatActionCommandFn.mockClear();
    mockTargetResolutionService.resolveTargets.mockClear();
    mockActionPipelineOrchestrator.discoverActions.mockClear();

    // Instantiate the service with mocked dependencies.
    service = new ActionDiscoveryService({
      entityManager: mockEntityManager,
      logger: mockLogger,
      actionPipelineOrchestrator: mockActionPipelineOrchestrator,
      traceContextFactory: jest.fn(() => ({ addLog: jest.fn(), logs: [] })),
      getActorLocationFn: mockGetActorLocationFn,
    });

    // A standard actor for tests
    actorEntity = { id: 'player', name: 'Player' };

    // Default mock behaviors for successful formatting
    mockFormatActionCommandFn.mockImplementation(
      (actionDef, targetContext) => ({
        ok: true,
        value:
          `${actionDef.commandVerb} ${targetContext.entityId || ''}`.trim(),
      })
    );
  });

  describe('Actor-State Prerequisite Check', () => {
    test('should discard action if actor-only prerequisites fail', async () => {
      const actionDef = {
        id: 'test:action_with_failing_prereq',
        commandVerb: 'test',
        prerequisites: [{ condition: 'is_strong' }],
        scope: 'some_scope',
      };

      // Arrange
      mockActionPipelineOrchestrator.discoverActions.mockResolvedValue({
        actions: [],
        errors: [],
        trace: null,
      });

      // Act
      const { actions } = await service.getValidActions(actorEntity, {});

      // Assert
      expect(actions).toHaveLength(0);
      expect(mockActionPipelineOrchestrator.discoverActions).toHaveBeenCalledTimes(1);
      expect(mockActionPipelineOrchestrator.discoverActions).toHaveBeenCalledWith(
        actorEntity,
        expect.objectContaining({ getActor: expect.any(Function) }),
        { trace: null }
      );
    });

    test('should check prerequisites even for TARGET_DOMAIN_SELF actions before proceeding', async () => {
      const actionDef = {
        id: 'test:self_action_fail',
        commandVerb: 'meditate',
        prerequisites: [{ condition: 'is_calm' }],
        scope: TARGET_DOMAIN_SELF,
      };
      mockActionPipelineOrchestrator.discoverActions.mockResolvedValue({
        actions: [],
        errors: [],
        trace: null,
      });

      const { actions } = await service.getValidActions(actorEntity, {});

      expect(actions).toHaveLength(0);
      expect(mockActionPipelineOrchestrator.discoverActions).toHaveBeenCalledTimes(1);
    });

    test('should not evaluate prerequisites if the action has none and proceed to scope resolution', async () => {
      const actionDef = {
        id: 'test:action_no_prereq',
        commandVerb: 'look',
        prerequisites: [],
        scope: 'some_scope',
      };
      mockActionPipelineOrchestrator.discoverActions.mockResolvedValue({
        actions: [{ id: actionDef.id, params: { targetId: 'target1' } }],
        errors: [],
        trace: null,
      });

      const { actions } = await service.getValidActions(actorEntity, {});

      expect(actions).toHaveLength(1);
      expect(actions[0].id).toBe(actionDef.id);
      expect(mockActionPipelineOrchestrator.discoverActions).toHaveBeenCalledTimes(1);
    });
  });

  describe('Scope Resolution and Action Generation', () => {
    test('should resolve scope and generate actions if actor prerequisites pass', async () => {
      const actionDef = {
        id: 'test:valid_action',
        name: 'Attack',
        commandVerb: 'attack',
        description: 'A basic attack.',
        prerequisites: [{ condition: 'is_not_stunned' }],
        scope: 'enemies_in_reach',
      };
      mockActionPipelineOrchestrator.discoverActions.mockResolvedValue({
        actions: [
          { id: actionDef.id, params: { targetId: 'goblin1' }, name: 'Attack', commandVerb: 'attack' },
          { id: actionDef.id, params: { targetId: 'goblin2' }, name: 'Attack', commandVerb: 'attack' },
        ],
        errors: [],
        trace: null,
      });

      const { actions } = await service.getValidActions(actorEntity, {});

      expect(actions).toHaveLength(2);
      expect(actions.map((a) => a.params.targetId)).toEqual(
        expect.arrayContaining(['goblin1', 'goblin2'])
      );
      expect(mockActionPipelineOrchestrator.discoverActions).toHaveBeenCalledTimes(1);
    });

    test('should generate one action for TARGET_DOMAIN_SELF scope if prereqs pass', async () => {
      const actionDef = {
        id: 'test:self_action_pass',
        commandVerb: 'heal',
        scope: TARGET_DOMAIN_SELF,
        prerequisites: [{ condition: 'is_injured' }],
      };
      mockActionPipelineOrchestrator.discoverActions.mockResolvedValue({
        actions: [{ id: actionDef.id, params: { targetId: actorEntity.id }, commandVerb: 'heal' }],
        errors: [],
        trace: null,
      });

      const { actions } = await service.getValidActions(actorEntity, {});

      expect(actions).toHaveLength(1);
      expect(actions[0].id).toBe(actionDef.id);
      expect(actions[0].params.targetId).toBe(actorEntity.id);
      expect(mockActionPipelineOrchestrator.discoverActions).toHaveBeenCalledTimes(1);
    });

    test('should generate one action for TARGET_DOMAIN_NONE scope if prereqs pass', async () => {
      const actionDef = {
        id: 'test:none_action_pass',
        commandVerb: 'shout',
        scope: TARGET_DOMAIN_NONE,
        prerequisites: [{ condition: 'is_vocal' }],
      };
      mockActionPipelineOrchestrator.discoverActions.mockResolvedValue({
        actions: [{ id: actionDef.id, params: { targetId: null }, commandVerb: 'shout' }],
        errors: [],
        trace: null,
      });

      const { actions } = await service.getValidActions(actorEntity, {});

      expect(actions).toHaveLength(1);
      expect(actions[0].id).toBe(actionDef.id);
      expect(actions[0].params.targetId).toBeNull();
      expect(mockActionPipelineOrchestrator.discoverActions).toHaveBeenCalledTimes(1);
    });

    test('should skip action if scope resolves to zero targets', async () => {
      const actionDef = {
        id: 'test:empty_scope_action',
        commandVerb: 'persuade',
        scope: 'friends',
        prerequisites: [{ condition: 'is_charismatic' }],
      };
      mockActionPipelineOrchestrator.discoverActions.mockResolvedValue({
        actions: [],
        errors: [],
        trace: null,
      });

      const { actions } = await service.getValidActions(actorEntity, {});

      expect(actions).toHaveLength(0);
      expect(mockActionPipelineOrchestrator.discoverActions).toHaveBeenCalledTimes(1);
    });
  });
});
