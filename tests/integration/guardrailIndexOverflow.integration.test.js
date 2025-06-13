import { describe, beforeEach, it, expect, jest } from '@jest/globals';
import { AvailableActionsProvider } from '../../src/data/providers/availableActionsProvider.js';
import { ActionIndexingService } from '../../src/turns/services/actionIndexingService.js';
import { MAX_AVAILABLE_ACTIONS_PER_TURN } from '../../src/constants/core.js';

/**
 * Integration test for overflow guardrails across ActionIndexingService and
 * AvailableActionsProvider.
 */
describe('Guardrail – index overflow', () => {
  let provider;
  let discoverySvc;
  let entityManager;
  let logger;
  let actor;

  beforeEach(() => {
    logger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
    discoverySvc = { getValidActions: jest.fn() };
    entityManager = { getEntityInstance: jest.fn().mockResolvedValue(null) };
    const indexingService = new ActionIndexingService(logger);
    provider = new AvailableActionsProvider({
      actionDiscoveryService: discoverySvc,
      actionIndexingService: indexingService,
      entityManager,
    });
    actor = {
      id: 'actor-overflow',
      getComponentData: jest.fn().mockReturnValue({}),
    };
  });

  it('caps overflow and logs matching warnings', async () => {
    const discovered = Array.from({ length: 40000 }, (_, i) => ({
      id: `action-${i}`,
      command: `cmd-${i}`,
      params: {},
      description: `desc-${i}`,
    }));
    discoverySvc.getValidActions.mockResolvedValue(discovered);

    const turnContext = { game: { worldId: 'world', turn: 1 } };
    const result = await provider.get(actor, turnContext, logger);

    expect(result.length).toBe(MAX_AVAILABLE_ACTIONS_PER_TURN);
    expect(logger.warn).toHaveBeenCalledTimes(2);
    const [serviceWarn, providerWarn] = logger.warn.mock.calls.map((c) => c[0]);
    expect(serviceWarn).toContain(`actor \"${actor.id}\" truncated`);
    expect(providerWarn).toContain(`[Overflow] actor=${actor.id}`);
  });
});
