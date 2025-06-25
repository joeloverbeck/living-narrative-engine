import { jest, describe, beforeEach, expect, it } from '@jest/globals';

import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import { POSITION_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('ActionDiscoveryService params exposure', () => {
  const dummyActionDef = {
    id: 'core:attack',
    name: 'Attack',
    commandVerb: 'attack',
    description: 'Attack target',
    scope: 'enemies',
  };

  let service;

  beforeEach(() => {
    const gameDataRepo = { getAllActionDefinitions: () => [dummyActionDef] };
    const entityManager = {
      getEntityInstance: (id) => {
        if (id === 'some-room') {
          return { id: 'some-room', getComponentData: () => null };
        }
        if (id === 'rat123') {
          return { id: 'rat123', getComponentData: () => null };
        }
        return null;
      },
      getComponentData: (entityId, componentId) => {
        if (entityId === 'player1' && componentId === POSITION_COMPONENT_ID) {
          return { locationId: 'some-room' };
        }
        return null;
      },
    };
    const actionValidationService = {
      isValid: () => true,
    };
    // FIX: Add the new required dependency
    const mockPrerequisiteEvaluationService = {
      evaluate: jest.fn().mockReturnValue(true),
    };
    const formatActionCommandFn = () => ({ ok: true, value: 'attack rat123' });
    const logger = {
      debug: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
    };
    const safeEventDispatcher = { dispatch: jest.fn() };

    const mockActionIndex = {
      getCandidateActions: jest.fn(() => [dummyActionDef]),
    };

    const mockTargetResolutionService = {
      resolveTargets: jest.fn().mockResolvedValue([
        { type: 'entity', entityId: 'rat123' }
      ]),
    };

    service = new ActionDiscoveryService({
      gameDataRepository: gameDataRepo,
      entityManager,
      actionValidationService,
      prerequisiteEvaluationService: mockPrerequisiteEvaluationService, // <-- The fix
      actionIndex: mockActionIndex,
      formatActionCommandFn,
      logger,
      safeEventDispatcher,
      targetResolutionService: mockTargetResolutionService,
      traceContextFactory: jest.fn(() => ({ addLog: jest.fn(), logs: [] })),
    });
  });

  it('should include params.targetId for entity-scoped actions', async () => {
    const actor = {
      id: 'player1',
      getComponentData: () => null,
      addComponent: jest.fn(),
      removeComponent: jest.fn(),
    };
    const context = {
      jsonLogicEval: {},
    };
    const result = await service.getValidActions(actor, context);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]).toMatchObject({
      id: 'core:attack',
      params: { targetId: 'rat123' },
    });
  });
});