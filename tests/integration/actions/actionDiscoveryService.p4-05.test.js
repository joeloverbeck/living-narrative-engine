/**
 * @file Test suite to ensure the new ActionDiscoverService for Phase 4 works properly.
 * @see tests/integration/actions/actionDiscoveryService.p4-05.test.js
 */
import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import { mock, mockReset } from 'jest-mock-extended';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import { ActionTargetContext } from '../../../src/models/actionTargetContext.js';
import {
  TARGET_DOMAIN_NONE,
  TARGET_DOMAIN_SELF,
} from '../../../src/constants/targetDomains.js';
import { PrerequisiteEvaluationService } from '../../../src/actions/validation/prerequisiteEvaluationService.js';
import { ActionIndex } from '../../../src/actions/actionIndex.js';
import { IEntityManager } from '../../../src/interfaces/IEntityManager.js';

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
const mockGameDataRepo = mock();
const mockEventDispatcher = mock();
const mockGetActorLocationFn = jest.fn();
const mockGetEntityDisplayNameFn = jest.fn();

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

    // Instantiate the service with mocked dependencies.
    service = new ActionDiscoveryService({
      gameDataRepository: mockGameDataRepo,
      entityManager: mockEntityManager,
      prerequisiteEvaluationService: mockPrereqService,
      actionIndex: mockActionIndex,
      logger: mockLogger,
      formatActionCommandFn: mockFormatActionCommandFn,
      safeEventDispatcher: mockEventDispatcher,
      targetResolutionService: mockTargetResolutionService,
      traceContextFactory: jest.fn(() => ({ addLog: jest.fn(), logs: [] })),
      getActorLocationFn: mockGetActorLocationFn,
      getEntityDisplayNameFn: mockGetEntityDisplayNameFn,
    });

    // A standard actor for tests
    actorEntity = { id: 'player', name: 'Player' };

    // Default mock behaviors for successful formatting
    mockFormatActionCommandFn.mockImplementation((actionDef, targetCtx) => ({
      ok: true,
      value: `${actionDef.commandVerb} ${targetCtx.entityId || ''}`.trim(),
    }));
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
      mockActionIndex.getCandidateActions.mockReturnValue([actionDef]);
      mockPrereqService.evaluate.mockReturnValue(false);

      // Act
      const { actions } = await service.getValidActions(actorEntity, {});

      // Assert
      expect(actions).toHaveLength(0);
      expect(mockPrereqService.evaluate).toHaveBeenCalledTimes(1);

      // FIX: The `evaluate` method now receives a 5th argument for tracing, which is `null` here.
      // The assertion must be updated to expect this new argument.
      expect(mockPrereqService.evaluate).toHaveBeenCalledWith(
        actionDef.prerequisites,
        actionDef,
        actorEntity,
        null // The new trace argument defaults to null
      );
      expect(mockTargetResolutionService.resolveTargets).not.toHaveBeenCalled();
    });

    test('should check prerequisites even for TARGET_DOMAIN_SELF actions before proceeding', async () => {
      const actionDef = {
        id: 'test:self_action_fail',
        commandVerb: 'meditate',
        prerequisites: [{ condition: 'is_calm' }],
        scope: TARGET_DOMAIN_SELF,
      };
      mockActionIndex.getCandidateActions.mockReturnValue([actionDef]);
      mockPrereqService.evaluate.mockReturnValue(false);

      const { actions } = await service.getValidActions(actorEntity, {});

      expect(actions).toHaveLength(0);
      expect(mockPrereqService.evaluate).toHaveBeenCalledTimes(1);
      expect(mockFormatActionCommandFn).not.toHaveBeenCalled();
    });

    test('should not evaluate prerequisites if the action has none and proceed to scope resolution', async () => {
      const actionDef = {
        id: 'test:action_no_prereq',
        commandVerb: 'look',
        prerequisites: [],
        scope: 'some_scope',
      };
      mockActionIndex.getCandidateActions.mockReturnValue([actionDef]);
      mockTargetResolutionService.resolveTargets.mockResolvedValue([
        { type: 'entity', entityId: 'target1' },
      ]);

      const { actions } = await service.getValidActions(actorEntity, {});

      expect(actions).toHaveLength(1);
      expect(actions[0].id).toBe(actionDef.id);
      expect(mockPrereqService.evaluate).not.toHaveBeenCalled();
      expect(mockTargetResolutionService.resolveTargets).toHaveBeenCalledTimes(
        1
      );
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
      mockActionIndex.getCandidateActions.mockReturnValue([actionDef]);
      mockPrereqService.evaluate.mockReturnValue(true);
      mockTargetResolutionService.resolveTargets.mockResolvedValue([
        { type: 'entity', entityId: 'goblin1' },
        { type: 'entity', entityId: 'goblin2' },
      ]);

      const { actions } = await service.getValidActions(actorEntity, {});

      expect(actions).toHaveLength(2);
      expect(actions.map((a) => a.params.targetId)).toEqual(
        expect.arrayContaining(['goblin1', 'goblin2'])
      );
      expect(mockPrereqService.evaluate).toHaveBeenCalledTimes(1);
      expect(mockTargetResolutionService.resolveTargets).toHaveBeenCalledTimes(
        1
      );

      expect(mockFormatActionCommandFn).toHaveBeenCalledTimes(2);
      expect(mockFormatActionCommandFn).toHaveBeenCalledWith(
        actionDef,
        expect.objectContaining({ entityId: 'goblin1' }),
        mockEntityManager,
        expect.anything(),
        expect.any(Function)
      );
      expect(mockFormatActionCommandFn).toHaveBeenCalledWith(
        actionDef,
        expect.objectContaining({ entityId: 'goblin2' }),
        mockEntityManager,
        expect.anything(),
        expect.any(Function)
      );
    });

    test('should generate one action for TARGET_DOMAIN_SELF scope if prereqs pass', async () => {
      const actionDef = {
        id: 'test:self_action_pass',
        commandVerb: 'heal',
        scope: TARGET_DOMAIN_SELF,
        prerequisites: [{ condition: 'is_injured' }],
      };
      mockActionIndex.getCandidateActions.mockReturnValue([actionDef]);
      mockPrereqService.evaluate.mockReturnValue(true);
      mockTargetResolutionService.resolveTargets.mockResolvedValue([
        { type: 'entity', entityId: actorEntity.id },
      ]);

      const { actions } = await service.getValidActions(actorEntity, {});

      expect(actions).toHaveLength(1);
      expect(actions[0].id).toBe(actionDef.id);
      expect(actions[0].params.targetId).toBe(actorEntity.id);
      expect(mockPrereqService.evaluate).toHaveBeenCalledTimes(1);
      expect(mockTargetResolutionService.resolveTargets).toHaveBeenCalledTimes(
        1
      );
      expect(mockFormatActionCommandFn).toHaveBeenCalledTimes(1);
      expect(mockFormatActionCommandFn).toHaveBeenCalledWith(
        actionDef,
        expect.objectContaining({ entityId: actorEntity.id }),
        mockEntityManager,
        expect.anything(),
        expect.any(Function)
      );
    });

    test('should generate one action for TARGET_DOMAIN_NONE scope if prereqs pass', async () => {
      const actionDef = {
        id: 'test:none_action_pass',
        commandVerb: 'shout',
        scope: TARGET_DOMAIN_NONE,
        prerequisites: [{ condition: 'is_vocal' }],
      };
      mockActionIndex.getCandidateActions.mockReturnValue([actionDef]);
      mockPrereqService.evaluate.mockReturnValue(true);
      mockTargetResolutionService.resolveTargets.mockResolvedValue([
        { type: 'none', entityId: null },
      ]);

      const { actions } = await service.getValidActions(actorEntity, {});

      expect(actions).toHaveLength(1);
      expect(actions[0].id).toBe(actionDef.id);
      expect(actions[0].params.targetId).toBeNull();
      expect(mockPrereqService.evaluate).toHaveBeenCalledTimes(1);
      expect(mockTargetResolutionService.resolveTargets).toHaveBeenCalledTimes(
        1
      );
      expect(mockFormatActionCommandFn).toHaveBeenCalledTimes(1);
      expect(mockFormatActionCommandFn).toHaveBeenCalledWith(
        actionDef,
        expect.objectContaining({ type: 'none' }),
        mockEntityManager,
        expect.anything(),
        expect.any(Function)
      );
    });

    test('should skip action if scope resolves to zero targets', async () => {
      const actionDef = {
        id: 'test:empty_scope_action',
        commandVerb: 'persuade',
        scope: 'friends',
        prerequisites: [{ condition: 'is_charismatic' }],
      };
      mockActionIndex.getCandidateActions.mockReturnValue([actionDef]);
      mockPrereqService.evaluate.mockReturnValue(true);
      mockTargetResolutionService.resolveTargets.mockResolvedValue([]);

      const { actions } = await service.getValidActions(actorEntity, {});

      expect(actions).toHaveLength(0);
      expect(mockPrereqService.evaluate).toHaveBeenCalledTimes(1);
      expect(mockTargetResolutionService.resolveTargets).toHaveBeenCalledTimes(
        1
      );
      expect(mockFormatActionCommandFn).not.toHaveBeenCalled();
    });
  });
});
