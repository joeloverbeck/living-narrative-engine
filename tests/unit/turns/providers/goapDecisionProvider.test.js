import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { GoapDecisionProvider } from '../../../../src/turns/providers/goapDecisionProvider.js';

const createLogger = () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
});

const createDispatcher = () => ({ dispatch: jest.fn() });

const createGoapController = () => ({
  decideTurn: jest.fn(),
});

const createContext = (overrides = {}) => ({
  game: overrides.game ?? { state: {} },
  entityManager: overrides.entityManager ?? {},
  getActor: jest.fn(() => ({ id: 'actor-1' })),
  ...overrides,
});

const createDependencies = (overrides = {}) => ({
  goapController: overrides.goapController ?? createGoapController(),
  logger: overrides.logger ?? createLogger(),
  safeEventDispatcher: overrides.safeEventDispatcher ?? createDispatcher(),
});

describe('GoapDecisionProvider', () => {
  let baseDeps;
  let mockContext;

  beforeEach(() => {
    jest.clearAllMocks();
    baseDeps = createDependencies();
    mockContext = createContext();
  });

  describe('constructor', () => {
    it('validates goapController dependency', () => {
      expect(() => {
        new GoapDecisionProvider({
          goapController: null,
          logger: baseDeps.logger,
          safeEventDispatcher: baseDeps.safeEventDispatcher,
        });
      }).toThrow();
    });

    it('validates logger dependency', () => {
      expect(() => {
        new GoapDecisionProvider({
          goapController: baseDeps.goapController,
          logger: null,
          safeEventDispatcher: baseDeps.safeEventDispatcher,
        });
      }).toThrow();
    });

    it('validates safeEventDispatcher dependency', () => {
      expect(() => {
        new GoapDecisionProvider({
          goapController: baseDeps.goapController,
          logger: baseDeps.logger,
          safeEventDispatcher: null,
        });
      }).toThrow();
    });
  });

  describe('decide() - GOAP integration', () => {
    it('calls GOAP controller with actor and world state', async () => {
      const provider = new GoapDecisionProvider(baseDeps);
      const actions = [
        {
          index: 1,
          actionId: 'core:sit_down',
          commandString: 'sit down',
          params: { targetId: 'chair-1' },
          description: 'Sit on chair',
          visual: null,
        },
      ];

      baseDeps.goapController.decideTurn.mockResolvedValue({
        actionHint: { actionId: 'core:sit_down', targetBindings: { target: 'chair-1' } },
      });

      await provider.decide({ id: 'actor-1' }, mockContext, actions);

      expect(baseDeps.goapController.decideTurn).toHaveBeenCalledWith(
        { id: 'actor-1' },
        expect.objectContaining({
          state: expect.any(Object),
          entityManager: expect.any(Object),
          actorId: 'actor-1',
        })
      );
    });

    it('returns correct action index when exact match found', async () => {
      const provider = new GoapDecisionProvider(baseDeps);
      const actions = [
        {
          index: 1,
          actionId: 'core:sit_down',
          commandString: 'sit down',
          params: { targetId: 'chair-1' },
          description: 'Sit on chair',
          visual: null,
        },
        {
          index: 2,
          actionId: 'core:stand_up',
          commandString: 'stand up',
          params: {},
          description: 'Stand up',
          visual: null,
        },
      ];

      baseDeps.goapController.decideTurn.mockResolvedValue({
        actionHint: { actionId: 'core:sit_down', targetBindings: { target: 'chair-1' } },
      });

      const result = await provider.decide({ id: 'actor-1' }, mockContext, actions);

      expect(result).toEqual({
        chosenIndex: 1,
        speech: null,
        thoughts: null,
        notes: null,
      });
    });

    it('matches action by targetId when binding uses different key', async () => {
      const provider = new GoapDecisionProvider(baseDeps);
      const actions = [
        {
          index: 1,
          actionId: 'core:sit_down',
          commandString: 'sit down',
          params: { targetId: 'chair-1' },
          description: 'Sit on chair',
          visual: null,
        },
      ];

      baseDeps.goapController.decideTurn.mockResolvedValue({
        actionHint: { actionId: 'core:sit_down', targetBindings: { seat: 'chair-1' } },
      });

      const result = await provider.decide({ id: 'actor-1' }, mockContext, actions);

      expect(result.chosenIndex).toBe(1);
    });

    it('returns first candidate when no target bindings exist', async () => {
      const provider = new GoapDecisionProvider(baseDeps);
      const actions = [
        {
          index: 1,
          actionId: 'core:stand_up',
          commandString: 'stand up',
          params: {},
          description: 'Stand up',
          visual: null,
        },
        {
          index: 2,
          actionId: 'core:stand_up',
          commandString: 'stand up again',
          params: {},
          description: 'Stand up again',
          visual: null,
        },
      ];

      baseDeps.goapController.decideTurn.mockResolvedValue({
        actionHint: { actionId: 'core:stand_up', targetBindings: {} },
      });

      const result = await provider.decide({ id: 'actor-1' }, mockContext, actions);

      expect(result.chosenIndex).toBe(1);
    });

    it('returns null when GOAP returns no decision', async () => {
      const provider = new GoapDecisionProvider(baseDeps);
      const actions = [
        {
          index: 1,
          actionId: 'core:test',
          commandString: 'test',
          params: {},
          description: 'Test action',
          visual: null,
        },
      ];

      baseDeps.goapController.decideTurn.mockResolvedValue(null);

      const result = await provider.decide({ id: 'actor-1' }, mockContext, actions);

      expect(result).toEqual({
        chosenIndex: null,
        speech: null,
        thoughts: null,
        notes: null,
      });
      expect(baseDeps.logger.debug).toHaveBeenCalledWith('GOAP returned no decision', {
        actorId: 'actor-1',
      });
    });

    it('returns null when GOAP returns result without actionHint', async () => {
      const provider = new GoapDecisionProvider(baseDeps);
      const actions = [
        {
          index: 1,
          actionId: 'core:test',
          commandString: 'test',
          params: {},
          description: 'Test action',
          visual: null,
        },
      ];

      baseDeps.goapController.decideTurn.mockResolvedValue({});

      const result = await provider.decide({ id: 'actor-1' }, mockContext, actions);

      expect(result.chosenIndex).toBe(null);
    });

    it('returns null when action hint not in available actions', async () => {
      const provider = new GoapDecisionProvider(baseDeps);
      const actions = [
        {
          index: 1,
          actionId: 'core:sit_down',
          commandString: 'sit down',
          params: { targetId: 'chair-1' },
          description: 'Sit on chair',
          visual: null,
        },
      ];

      baseDeps.goapController.decideTurn.mockResolvedValue({
        actionHint: { actionId: 'core:stand_up', targetBindings: {} },
      });

      const result = await provider.decide({ id: 'actor-1' }, mockContext, actions);

      expect(result.chosenIndex).toBe(null);
      expect(baseDeps.logger.warn).toHaveBeenCalledWith(
        'GOAP hint could not be resolved to action',
        expect.objectContaining({
          actorId: 'actor-1',
          hint: expect.objectContaining({ actionId: 'core:stand_up' }),
        })
      );
    });

    it('falls back to first candidate when exact target match not found', async () => {
      const provider = new GoapDecisionProvider(baseDeps);
      const actions = [
        {
          index: 1,
          actionId: 'core:sit_down',
          commandString: 'sit on chair 1',
          params: { targetId: 'chair-1' },
          description: 'Sit on chair 1',
          visual: null,
        },
        {
          index: 2,
          actionId: 'core:sit_down',
          commandString: 'sit on chair 2',
          params: { targetId: 'chair-2' },
          description: 'Sit on chair 2',
          visual: null,
        },
      ];

      // GOAP wants chair-3, but only chair-1 and chair-2 are available
      baseDeps.goapController.decideTurn.mockResolvedValue({
        actionHint: { actionId: 'core:sit_down', targetBindings: { seat: 'chair-3' } },
      });

      const result = await provider.decide({ id: 'actor-1' }, mockContext, actions);

      expect(result.chosenIndex).toBe(1); // Falls back to first candidate
      expect(baseDeps.logger.warn).toHaveBeenCalledWith(
        'No exact target match, using first candidate',
        expect.any(Object)
      );
    });

    it('handles GOAP controller errors gracefully', async () => {
      const provider = new GoapDecisionProvider(baseDeps);
      const actions = [
        {
          index: 1,
          actionId: 'core:test',
          commandString: 'test',
          params: {},
          description: 'Test action',
          visual: null,
        },
      ];

      baseDeps.goapController.decideTurn.mockRejectedValue(new Error('Planning failed'));

      const result = await provider.decide({ id: 'actor-1' }, mockContext, actions);

      expect(result.chosenIndex).toBe(null);
      expect(baseDeps.logger.error).toHaveBeenCalledWith(
        'GOAP decision failed',
        expect.objectContaining({
          actorId: 'actor-1',
          error: 'Planning failed',
        })
      );
    });

    it('logs decision when successfully made', async () => {
      const provider = new GoapDecisionProvider(baseDeps);
      const actions = [
        {
          index: 1,
          actionId: 'core:sit_down',
          commandString: 'sit down',
          params: { targetId: 'chair-1' },
          description: 'Sit on chair',
          visual: null,
        },
      ];

      baseDeps.goapController.decideTurn.mockResolvedValue({
        actionHint: { actionId: 'core:sit_down', targetBindings: { seat: 'chair-1' } },
      });

      await provider.decide({ id: 'actor-1' }, mockContext, actions);

      expect(baseDeps.logger.info).toHaveBeenCalledWith(
        'GOAP decision made',
        expect.objectContaining({
          actorId: 'actor-1',
          actionId: 'core:sit_down',
          chosenIndex: 1,
        })
      );
    });

    it('returns null when no actions are available', async () => {
      const provider = new GoapDecisionProvider(baseDeps);

      baseDeps.goapController.decideTurn.mockResolvedValue({
        actionHint: { actionId: 'core:test', targetBindings: {} },
      });

      const result = await provider.decide({ id: 'actor-1' }, mockContext, []);

      expect(result.chosenIndex).toBe(null);
    });
  });

  describe('world state extraction', () => {
    it('extracts world state from context.game', async () => {
      const provider = new GoapDecisionProvider(baseDeps);
      const customContext = createContext({
        game: { state: { hunger: 50, health: 100 } },
      });
      const actions = [
        {
          index: 1,
          actionId: 'core:test',
          commandString: 'test',
          params: {},
          description: 'Test',
          visual: null,
        },
      ];

      baseDeps.goapController.decideTurn.mockResolvedValue({
        actionHint: { actionId: 'core:test', targetBindings: {} },
      });

      await provider.decide({ id: 'actor-1' }, customContext, actions);

      expect(baseDeps.goapController.decideTurn).toHaveBeenCalledWith(
        { id: 'actor-1' },
        expect.objectContaining({
          state: { hunger: 50, health: 100 },
        })
      );
    });

    it('uses empty state when context.game is not available', async () => {
      const provider = new GoapDecisionProvider(baseDeps);
      const customContext = createContext({ game: null });
      const actions = [
        {
          index: 1,
          actionId: 'core:test',
          commandString: 'test',
          params: {},
          description: 'Test',
          visual: null,
        },
      ];

      baseDeps.goapController.decideTurn.mockResolvedValue({
        actionHint: { actionId: 'core:test', targetBindings: {} },
      });

      await provider.decide({ id: 'actor-1' }, customContext, actions);

      expect(baseDeps.goapController.decideTurn).toHaveBeenCalledWith(
        { id: 'actor-1' },
        expect.objectContaining({
          state: {},
        })
      );
    });
  });
});
