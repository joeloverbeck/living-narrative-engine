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
      target_domain: 'none',
    };
    const okDef = { id: 'ok', commandVerb: 'wait', target_domain: 'none' };
    gameDataRepo.getAllActionDefinitions.mockReturnValue([failingDef, okDef]);
    const original = ActionDiscoveryService.DOMAIN_HANDLERS.none;
    ActionDiscoveryService.DOMAIN_HANDLERS.none = jest.fn(function (...args) {
      const [def] = args;
      if (def.id === 'fail') {
        throw new Error('boom');
      }
      return original.apply(this, args);
    });

    const actor = { id: 'actor' };
    const context = {};

    const actions = await service.getValidActions(actor, context);

    expect(actions).toHaveLength(1);
    expect(actions[0].id).toBe('ok');
    expect(safeDispatchError).toHaveBeenCalledTimes(1);

    ActionDiscoveryService.DOMAIN_HANDLERS.none = original;
  });

  it('falls back to scoped entity discovery when domain handler is missing', async () => {
    const def = {
      id: 'attack',
      commandVerb: 'attack',
      target_domain: 'monster',
    };
    gameDataRepo.getAllActionDefinitions.mockReturnValue([def]);
    getEntityIdsForScopesFn.mockReturnValue(new Set(['monster1']));
    formatActionCommandFn.mockReturnValue('attack monster1');

    const actor = { id: 'actor' };
    const context = {};

    const actions = await service.getValidActions(actor, context);

    expect(getEntityIdsForScopesFn).toHaveBeenCalledWith(
      ['monster'],
      context,
      expect.any(Object)
    );
    expect(actions).toEqual([
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
