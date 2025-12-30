/**
 * @file Unit tests for BurnApplicator
 * @see src/anatomy/applicators/burnApplicator.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import BurnApplicator, {
  BURNING_COMPONENT_ID,
  BURNING_STARTED_EVENT,
  DEFAULT_TICK_DAMAGE,
  DEFAULT_DURATION_TURNS,
  DEFAULT_BURN_STACK_COUNT,
} from '../../../../src/anatomy/applicators/burnApplicator.js';

describe('BurnApplicator', () => {
  let mockLogger;
  let mockEntityManager;
  let mockDispatchStrategy;
  let applicator;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      addComponent: jest.fn().mockResolvedValue(undefined),
      hasComponent: jest.fn().mockReturnValue(false),
      getComponentData: jest.fn().mockReturnValue(null),
    };

    mockDispatchStrategy = {
      dispatch: jest.fn(),
      recordEffect: jest.fn(),
    };

    applicator = new BurnApplicator({
      logger: mockLogger,
      entityManager: mockEntityManager,
    });
  });

  describe('constructor', () => {
    it('validates logger dependency', () => {
      expect(() => {
        new BurnApplicator({
          logger: null,
          entityManager: mockEntityManager,
        });
      }).toThrow();
    });

    it('validates entityManager dependency', () => {
      expect(() => {
        new BurnApplicator({
          logger: mockLogger,
          entityManager: null,
        });
      }).toThrow();
    });

    it('creates instance with valid dependencies', () => {
      const instance = new BurnApplicator({
        logger: mockLogger,
        entityManager: mockEntityManager,
      });
      expect(instance).toBeInstanceOf(BurnApplicator);
    });
  });

  describe('applyStacking()', () => {
    it('increments stackedCount when canStack is true', () => {
      const existingBurn = {
        remainingTurns: 2,
        tickDamage: 3,
        stackedCount: 2,
      };

      const result = applicator.applyStacking(
        existingBurn,
        true, // canStack
        2, // baseDamage (dps)
        3, // duration
        1 // baseStackCount
      );

      expect(result.stackedCount).toBe(3); // 2 + 1
    });

    it('accumulates tickDamage when canStack is true', () => {
      const existingBurn = {
        remainingTurns: 2,
        tickDamage: 3,
        stackedCount: 1,
      };

      const result = applicator.applyStacking(
        existingBurn,
        true, // canStack
        2, // baseDamage (dps)
        3, // duration
        1 // baseStackCount
      );

      expect(result.tickDamage).toBe(5); // 3 + 2
    });

    it('preserves tickDamage when canStack is false', () => {
      const existingBurn = {
        remainingTurns: 2,
        tickDamage: 5,
        stackedCount: 2,
      };

      const result = applicator.applyStacking(
        existingBurn,
        false, // canStack
        2, // baseDamage (dps)
        3, // duration
        1 // baseStackCount
      );

      expect(result.tickDamage).toBe(5); // unchanged
    });

    it('refreshes remainingTurns in both modes', () => {
      const existingBurn = {
        remainingTurns: 1, // almost expired
        tickDamage: 3,
        stackedCount: 1,
      };

      const stackResult = applicator.applyStacking(
        existingBurn,
        true, // canStack
        2,
        5, // new duration
        1
      );
      expect(stackResult.remainingTurns).toBe(5);

      const refreshResult = applicator.applyStacking(
        existingBurn,
        false, // canStack
        2,
        5, // new duration
        1
      );
      expect(refreshResult.remainingTurns).toBe(5);
    });

    it('uses baseStackCount when existing burn has no stackedCount', () => {
      const existingBurn = {
        remainingTurns: 2,
        tickDamage: 3,
        // stackedCount missing
      };

      const result = applicator.applyStacking(
        existingBurn,
        true, // canStack
        2, // baseDamage
        3, // duration
        1 // baseStackCount
      );

      // Should use baseStackCount (1) as the starting value, then increment
      expect(result.stackedCount).toBe(2); // 1 + 1
    });

    it('preserves stackedCount when canStack is false and missing', () => {
      const existingBurn = {
        remainingTurns: 2,
        tickDamage: 3,
        // stackedCount missing
      };

      const result = applicator.applyStacking(
        existingBurn,
        false, // canStack
        2,
        3,
        1 // baseStackCount
      );

      expect(result.stackedCount).toBe(1); // uses baseStackCount
    });
  });

  describe('apply()', () => {
    const baseParams = {
      entityId: 'entity-1',
      partId: 'part-1',
      effectDefinition: null,
      damageEntryConfig: null,
      dispatchStrategy: null,
      sessionContext: { sessionId: 'test-session' },
    };

    beforeEach(() => {
      baseParams.dispatchStrategy = mockDispatchStrategy;
    });

    it('returns { applied: true, stacked: false } for fresh burn application', async () => {
      const result = await applicator.apply(baseParams);
      expect(result).toEqual({
        applied: true,
        stacked: false,
        stackedCount: 1,
      });
    });

    it('returns { applied: true, stacked: true } when stacking on existing burn', async () => {
      mockEntityManager.hasComponent.mockReturnValue(true);
      mockEntityManager.getComponentData.mockReturnValue({
        remainingTurns: 2,
        tickDamage: 2,
        stackedCount: 1,
      });

      const result = await applicator.apply({
        ...baseParams,
        damageEntryConfig: { canStack: true },
      });

      expect(result).toEqual({
        applied: true,
        stacked: true,
        stackedCount: 2,
      });
    });

    it('adds fresh anatomy:burning component with baseStackCount', async () => {
      await applicator.apply(baseParams);

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        BURNING_COMPONENT_ID,
        expect.objectContaining({
          stackedCount: 1, // DEFAULT_BURN_STACK_COUNT
        })
      );
    });

    it('uses config dps over definition defaults (tickDamage)', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { dps: 5 },
        effectDefinition: { defaults: { tickDamage: 2 } },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        BURNING_COMPONENT_ID,
        expect.objectContaining({
          tickDamage: 5,
        })
      );
    });

    it('uses config durationTurns over definition defaults', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { durationTurns: 5 },
        effectDefinition: { defaults: { durationTurns: 3 } },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        BURNING_COMPONENT_ID,
        expect.objectContaining({
          remainingTurns: 5,
        })
      );
    });

    it('uses definition defaults when config lacks dps', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: {},
        effectDefinition: { defaults: { tickDamage: 3 } },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        BURNING_COMPONENT_ID,
        expect.objectContaining({
          tickDamage: 3,
        })
      );
    });

    it('uses DEFAULT_TICK_DAMAGE when no config or definition', async () => {
      expect(DEFAULT_TICK_DAMAGE).toBe(1);

      await applicator.apply(baseParams);

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        BURNING_COMPONENT_ID,
        expect.objectContaining({
          tickDamage: 1,
        })
      );
    });

    it('uses DEFAULT_DURATION_TURNS when no config or definition', async () => {
      expect(DEFAULT_DURATION_TURNS).toBe(2);

      await applicator.apply(baseParams);

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        BURNING_COMPONENT_ID,
        expect.objectContaining({
          remainingTurns: 2,
        })
      );
    });

    it('accumulates tickDamage when canStack is true', async () => {
      mockEntityManager.hasComponent.mockReturnValue(true);
      mockEntityManager.getComponentData.mockReturnValue({
        remainingTurns: 2,
        tickDamage: 3,
        stackedCount: 1,
      });

      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { dps: 2, canStack: true },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        BURNING_COMPONENT_ID,
        expect.objectContaining({
          tickDamage: 5, // 3 + 2
        })
      );
    });

    it('increments stackedCount when canStack is true', async () => {
      mockEntityManager.hasComponent.mockReturnValue(true);
      mockEntityManager.getComponentData.mockReturnValue({
        remainingTurns: 2,
        tickDamage: 3,
        stackedCount: 2,
      });

      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { canStack: true },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        BURNING_COMPONENT_ID,
        expect.objectContaining({
          stackedCount: 3,
        })
      );
    });

    it('refreshes duration only when canStack is false', async () => {
      mockEntityManager.hasComponent.mockReturnValue(true);
      mockEntityManager.getComponentData.mockReturnValue({
        remainingTurns: 1,
        tickDamage: 5,
        stackedCount: 3,
      });

      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { dps: 2, durationTurns: 4, canStack: false },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        BURNING_COMPONENT_ID,
        {
          tickDamage: 5, // unchanged
          stackedCount: 3, // unchanged
          remainingTurns: 4, // refreshed
        }
      );
    });

    it('handles missing stackedCount on existing burn (uses baseStackCount)', async () => {
      mockEntityManager.hasComponent.mockReturnValue(true);
      mockEntityManager.getComponentData.mockReturnValue({
        remainingTurns: 2,
        tickDamage: 3,
        // stackedCount missing
      });

      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { canStack: true },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        BURNING_COMPONENT_ID,
        expect.objectContaining({
          stackedCount: 2, // baseStackCount (1) + 1
        })
      );
    });

    it('dispatches event via strategy with correct stackedCount', async () => {
      const beforeTime = Date.now();

      await applicator.apply(baseParams);

      const afterTime = Date.now();

      expect(mockDispatchStrategy.dispatch).toHaveBeenCalledWith(
        BURNING_STARTED_EVENT,
        expect.objectContaining({
          entityId: 'entity-1',
          partId: 'part-1',
          stackedCount: 1,
        }),
        baseParams.sessionContext
      );

      const payload = mockDispatchStrategy.dispatch.mock.calls[0][1];
      expect(payload.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(payload.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('records effect via strategy when applied', async () => {
      await applicator.apply(baseParams);

      expect(mockDispatchStrategy.recordEffect).toHaveBeenCalledWith(
        'part-1',
        'burning',
        baseParams.sessionContext
      );
    });

    it('uses custom componentId from effectDefinition', async () => {
      await applicator.apply({
        ...baseParams,
        effectDefinition: { componentId: 'custom:burning_status' },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        'custom:burning_status',
        expect.any(Object)
      );
    });

    it('uses custom startedEventId from effectDefinition', async () => {
      await applicator.apply({
        ...baseParams,
        effectDefinition: { startedEventId: 'custom:burn_started' },
      });

      expect(mockDispatchStrategy.dispatch).toHaveBeenCalledWith(
        'custom:burn_started',
        expect.any(Object),
        baseParams.sessionContext
      );
    });

    it('uses stacking.defaultStacks from effectDefinition.defaults', async () => {
      await applicator.apply({
        ...baseParams,
        effectDefinition: {
          defaults: {
            stacking: {
              defaultStacks: 2,
            },
          },
        },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        BURNING_COMPONENT_ID,
        expect.objectContaining({
          stackedCount: 2,
        })
      );
    });

    it('uses stacking.canStack from effectDefinition.defaults when not in config', async () => {
      mockEntityManager.hasComponent.mockReturnValue(true);
      mockEntityManager.getComponentData.mockReturnValue({
        remainingTurns: 2,
        tickDamage: 3,
        stackedCount: 1,
      });

      await applicator.apply({
        ...baseParams,
        effectDefinition: {
          defaults: {
            stacking: {
              canStack: true,
            },
          },
        },
      });

      // Should stack because effectDefinition.defaults.stacking.canStack is true
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        BURNING_COMPONENT_ID,
        expect.objectContaining({
          stackedCount: 2, // 1 + 1
        })
      );
    });

    it('logs debug message when burning is applied', async () => {
      await applicator.apply(baseParams);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Burning applied to part part-1')
      );
    });

    it('includes all required component data fields', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { dps: 3, durationTurns: 4 },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        BURNING_COMPONENT_ID,
        {
          remainingTurns: 4,
          tickDamage: 3,
          stackedCount: 1,
        }
      );
    });

    it('includes all required event payload fields', async () => {
      await applicator.apply(baseParams);

      const payload = mockDispatchStrategy.dispatch.mock.calls[0][1];
      expect(payload).toHaveProperty('entityId', 'entity-1');
      expect(payload).toHaveProperty('partId', 'part-1');
      expect(payload).toHaveProperty('stackedCount', 1);
      expect(payload).toHaveProperty('timestamp');
      expect(typeof payload.timestamp).toBe('number');
    });
  });

  describe('exported constants', () => {
    it('exports BURNING_COMPONENT_ID', () => {
      expect(BURNING_COMPONENT_ID).toBe('anatomy:burning');
    });

    it('exports BURNING_STARTED_EVENT', () => {
      expect(BURNING_STARTED_EVENT).toBe('anatomy:burning_started');
    });

    it('exports DEFAULT_TICK_DAMAGE', () => {
      expect(DEFAULT_TICK_DAMAGE).toBe(1);
    });

    it('exports DEFAULT_DURATION_TURNS', () => {
      expect(DEFAULT_DURATION_TURNS).toBe(2);
    });

    it('exports DEFAULT_BURN_STACK_COUNT', () => {
      expect(DEFAULT_BURN_STACK_COUNT).toBe(1);
    });
  });

  describe('invariants', () => {
    const baseParams = {
      entityId: 'entity-1',
      partId: 'part-1',
      effectDefinition: null,
      damageEntryConfig: null,
      dispatchStrategy: null,
      sessionContext: { sessionId: 'test-session' },
    };

    beforeEach(() => {
      baseParams.dispatchStrategy = mockDispatchStrategy;
    });

    it('INV-4: adds exactly one component to part', async () => {
      await applicator.apply(baseParams);
      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
    });

    it('INV-5: dispatches exactly one event', async () => {
      await applicator.apply(baseParams);
      expect(mockDispatchStrategy.dispatch).toHaveBeenCalledTimes(1);
    });

    it('component data structure matches expected format', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { dps: 3, durationTurns: 4 },
      });

      const componentData = mockEntityManager.addComponent.mock.calls[0][2];
      expect(componentData).toEqual({
        remainingTurns: 4,
        tickDamage: 3,
        stackedCount: 1,
      });
    });

    it('event payload structure matches expected format', async () => {
      await applicator.apply(baseParams);

      const payload = mockDispatchStrategy.dispatch.mock.calls[0][1];
      expect(Object.keys(payload).sort()).toEqual(
        ['entityId', 'partId', 'stackedCount', 'timestamp'].sort()
      );
    });
  });
});
