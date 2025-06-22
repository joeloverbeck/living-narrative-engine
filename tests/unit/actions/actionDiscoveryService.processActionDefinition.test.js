import {
  describe,
  it,
  beforeEach,
  afterEach,
  expect,
  jest,
} from '@jest/globals';
import { ActionDiscoveryService } from '../../../src/actions/actionDiscoveryService.js';
import { safeDispatchError } from '../../../src/utils/safeDispatchErrorUtils.js';

jest.mock('../../../src/utils/safeDispatchErrorUtils.js');

describe('ActionDiscoveryService - processActionDefinition', () => {
  /** @type {ActionDiscoveryService} */
  let service;
  /** @type {object} */
  let gameDataRepo;
  /** @type {object} */
  let entityManager;
  /** @type {object} */
  let actionValidationService;
  /** @type {jest.Mock} */
  let formatActionCommandFn;
  /** @type {jest.Mock} */
  let getEntityIdsForScopesFn;
  /** @type {object} */
  let logger;
  /** @type {object} */
  let safeEventDispatcher;

  beforeEach(() => {
    gameDataRepo = { getAllActionDefinitions: jest.fn() };
    entityManager = {
      getEntityInstance: jest.fn(),
      getComponentData: jest.fn().mockReturnValue(null),
    };
    actionValidationService = { isValid: () => true };
    formatActionCommandFn = jest.fn(() => 'doit');
    getEntityIdsForScopesFn = jest.fn(() => new Set());
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
    safeEventDispatcher = { dispatch: jest.fn() };
    service = new ActionDiscoveryService({
      gameDataRepository: gameDataRepo,
      entityManager,
      actionValidationService,
      formatActionCommandFn,
      getEntityIdsForScopesFn,
      logger,
      safeEventDispatcher,
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('handles handler errors and continues processing', async () => {
    const failingDef = {
      id: 'fail',
      commandVerb: 'fail',
      scope: 'none',
    };
    const okDef = { id: 'ok', commandVerb: 'wait', scope: 'none' };
    gameDataRepo.getAllActionDefinitions.mockReturnValue([failingDef, okDef]);

    // Simulate a handler error by making isValid throw for the failing action
    actionValidationService.isValid = jest.fn((actionDef) => {
      if (actionDef.id === 'fail') {
        throw new Error('boom');
      }
      return true;
    });

    const actor = { id: 'actor' };
    const context = {};

    const result = await service.getValidActions(actor, context);

    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].id).toBe('ok');
    expect(result.errors).toHaveLength(1);
    expect(safeDispatchError).toHaveBeenCalledTimes(1);
  });

  it('falls back to scoped entity discovery when scope handler is missing', async () => {
    const def = {
      id: 'attack',
      commandVerb: 'attack',
      scope: 'monster',
    };
    gameDataRepo.getAllActionDefinitions.mockReturnValue([def]);
    getEntityIdsForScopesFn.mockReturnValue(new Set(['monster1']));
    formatActionCommandFn.mockReturnValue('attack monster1');

    const actor = { id: 'actor' };
    const context = {};

    const result = await service.getValidActions(actor, context);

    expect(getEntityIdsForScopesFn).toHaveBeenCalledWith(
      ['monster'],
      context,
      expect.any(Object)
    );
    expect(result.actions).toEqual([
      {
        id: 'attack',
        name: 'attack',
        command: 'attack monster1',
        description: '',
        params: { targetId: 'monster1' },
      },
    ]);
  });
});
