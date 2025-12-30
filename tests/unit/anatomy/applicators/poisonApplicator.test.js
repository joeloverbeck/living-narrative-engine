/**
 * @file Unit tests for PoisonApplicator
 * @see src/anatomy/applicators/poisonApplicator.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import PoisonApplicator, {
  POISONED_COMPONENT_ID,
  POISONED_STARTED_EVENT,
  DEFAULT_TICK_DAMAGE,
  DEFAULT_DURATION_TURNS,
  DEFAULT_SCOPE,
} from '../../../../src/anatomy/applicators/poisonApplicator.js';

describe('PoisonApplicator', () => {
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
    };

    mockDispatchStrategy = {
      dispatch: jest.fn(),
      recordEffect: jest.fn(),
    };

    applicator = new PoisonApplicator({
      logger: mockLogger,
      entityManager: mockEntityManager,
    });
  });

  describe('constructor', () => {
    it('validates logger dependency', () => {
      expect(() => {
        new PoisonApplicator({
          logger: null,
          entityManager: mockEntityManager,
        });
      }).toThrow();
    });

    it('validates entityManager dependency', () => {
      expect(() => {
        new PoisonApplicator({
          logger: mockLogger,
          entityManager: null,
        });
      }).toThrow();
    });

    it('creates instance with valid dependencies', () => {
      const instance = new PoisonApplicator({
        logger: mockLogger,
        entityManager: mockEntityManager,
      });
      expect(instance).toBeInstanceOf(PoisonApplicator);
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

    describe('return values', () => {
      it('returns { applied: true, scope: "part" } for part-scope poison', async () => {
        const result = await applicator.apply({
          ...baseParams,
          damageEntryConfig: { scope: 'part' },
        });
        expect(result).toEqual({
          applied: true,
          scope: 'part',
          targetId: 'part-1',
        });
      });

      it('returns { applied: true, scope: "entity" } for entity-scope poison', async () => {
        const result = await applicator.apply({
          ...baseParams,
          damageEntryConfig: { scope: 'entity' },
        });
        expect(result).toEqual({
          applied: true,
          scope: 'entity',
          targetId: 'entity-1',
        });
      });

      it('returns default scope "part" when no scope specified', async () => {
        const result = await applicator.apply(baseParams);
        expect(result.scope).toBe('part');
      });
    });

    describe('component application', () => {
      it('adds anatomy:poisoned component to part when scope is "part"', async () => {
        await applicator.apply({
          ...baseParams,
          damageEntryConfig: { scope: 'part' },
        });

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part-1',
          POISONED_COMPONENT_ID,
          expect.any(Object)
        );
      });

      it('adds anatomy:poisoned component to entity when scope is "entity"', async () => {
        await applicator.apply({
          ...baseParams,
          damageEntryConfig: { scope: 'entity' },
        });

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'entity-1',
          POISONED_COMPONENT_ID,
          expect.any(Object)
        );
      });

      it('uses config tick over definition defaults for tickDamage', async () => {
        await applicator.apply({
          ...baseParams,
          damageEntryConfig: { tick: 5 },
          effectDefinition: { defaults: { tickDamage: 2 } },
        });

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part-1',
          POISONED_COMPONENT_ID,
          expect.objectContaining({
            tickDamage: 5,
          })
        );
      });

      it('uses config durationTurns over definition defaults', async () => {
        await applicator.apply({
          ...baseParams,
          damageEntryConfig: { durationTurns: 7 },
          effectDefinition: { defaults: { durationTurns: 4 } },
        });

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part-1',
          POISONED_COMPONENT_ID,
          expect.objectContaining({
            remainingTurns: 7,
          })
        );
      });

      it('uses config scope over definition defaults', async () => {
        await applicator.apply({
          ...baseParams,
          damageEntryConfig: { scope: 'entity' },
          effectDefinition: { defaults: { scope: 'part' } },
        });

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'entity-1', // entity scope
          POISONED_COMPONENT_ID,
          expect.any(Object)
        );
      });

      it('uses definition defaults when config lacks values', async () => {
        await applicator.apply({
          ...baseParams,
          damageEntryConfig: null,
          effectDefinition: {
            defaults: {
              tickDamage: 10,
              durationTurns: 6,
              scope: 'entity',
            },
          },
        });

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'entity-1', // entity scope from definition
          POISONED_COMPONENT_ID,
          {
            remainingTurns: 6,
            tickDamage: 10,
          }
        );
      });

      it('uses hardcoded defaults when no config or definition', async () => {
        expect(DEFAULT_TICK_DAMAGE).toBe(1);
        expect(DEFAULT_DURATION_TURNS).toBe(3);
        expect(DEFAULT_SCOPE).toBe('part');

        await applicator.apply(baseParams);

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part-1',
          POISONED_COMPONENT_ID,
          {
            remainingTurns: 3,
            tickDamage: 1,
          }
        );
      });

      it('uses custom componentId from effectDefinition', async () => {
        await applicator.apply({
          ...baseParams,
          effectDefinition: { componentId: 'custom:poison_status' },
        });

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part-1',
          'custom:poison_status',
          expect.any(Object)
        );
      });
    });

    describe('event dispatch', () => {
      it('dispatches event via strategy with partId when part-scope', async () => {
        await applicator.apply({
          ...baseParams,
          damageEntryConfig: { scope: 'part' },
        });

        expect(mockDispatchStrategy.dispatch).toHaveBeenCalledWith(
          POISONED_STARTED_EVENT,
          expect.objectContaining({
            entityId: 'entity-1',
            partId: 'part-1',
            scope: 'part',
          }),
          baseParams.sessionContext
        );
      });

      it('dispatches event via strategy without partId when entity-scope', async () => {
        await applicator.apply({
          ...baseParams,
          damageEntryConfig: { scope: 'entity' },
        });

        expect(mockDispatchStrategy.dispatch).toHaveBeenCalledWith(
          POISONED_STARTED_EVENT,
          expect.objectContaining({
            entityId: 'entity-1',
            partId: undefined,
            scope: 'entity',
          }),
          baseParams.sessionContext
        );
      });

      it('dispatches event via strategy with correct scope field', async () => {
        // Part scope
        await applicator.apply({
          ...baseParams,
          damageEntryConfig: { scope: 'part' },
        });

        let payload = mockDispatchStrategy.dispatch.mock.calls[0][1];
        expect(payload.scope).toBe('part');

        // Reset and test entity scope
        mockDispatchStrategy.dispatch.mockClear();
        await applicator.apply({
          ...baseParams,
          damageEntryConfig: { scope: 'entity' },
        });

        payload = mockDispatchStrategy.dispatch.mock.calls[0][1];
        expect(payload.scope).toBe('entity');
      });

      it('includes timestamp in event payload', async () => {
        const beforeTime = Date.now();
        await applicator.apply(baseParams);
        const afterTime = Date.now();

        const payload = mockDispatchStrategy.dispatch.mock.calls[0][1];
        expect(payload.timestamp).toBeGreaterThanOrEqual(beforeTime);
        expect(payload.timestamp).toBeLessThanOrEqual(afterTime);
      });

      it('records effect via strategy when applied', async () => {
        await applicator.apply(baseParams);

        expect(mockDispatchStrategy.recordEffect).toHaveBeenCalledWith(
          'part-1',
          'poisoned',
          baseParams.sessionContext
        );
      });

      it('uses custom startedEventId from effectDefinition', async () => {
        await applicator.apply({
          ...baseParams,
          effectDefinition: { startedEventId: 'custom:poison_started' },
        });

        expect(mockDispatchStrategy.dispatch).toHaveBeenCalledWith(
          'custom:poison_started',
          expect.any(Object),
          baseParams.sessionContext
        );
      });
    });

    describe('logging', () => {
      it('logs debug message for part-scope poison', async () => {
        await applicator.apply({
          ...baseParams,
          damageEntryConfig: { scope: 'part' },
        });

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Poison applied to part part-1')
        );
      });

      it('logs debug message for entity-scope poison', async () => {
        await applicator.apply({
          ...baseParams,
          damageEntryConfig: { scope: 'entity' },
        });

        expect(mockLogger.debug).toHaveBeenCalledWith(
          expect.stringContaining('Poison applied to entity entity-1')
        );
      });
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

    it('INV-4: adds exactly one component to target', async () => {
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
        damageEntryConfig: { tick: 4, durationTurns: 5 },
      });

      const componentData = mockEntityManager.addComponent.mock.calls[0][2];
      expect(componentData).toEqual({
        remainingTurns: 5,
        tickDamage: 4,
      });
    });

    it('event payload structure matches expected format for part-scope', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { scope: 'part' },
      });

      const payload = mockDispatchStrategy.dispatch.mock.calls[0][1];
      expect(Object.keys(payload).sort()).toEqual(
        ['entityId', 'partId', 'scope', 'timestamp'].sort()
      );
      expect(payload.entityId).toBe('entity-1');
      expect(payload.partId).toBe('part-1');
      expect(payload.scope).toBe('part');
      expect(typeof payload.timestamp).toBe('number');
    });

    it('event payload structure matches expected format for entity-scope', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { scope: 'entity' },
      });

      const payload = mockDispatchStrategy.dispatch.mock.calls[0][1];
      expect(Object.keys(payload).sort()).toEqual(
        ['entityId', 'partId', 'scope', 'timestamp'].sort()
      );
      expect(payload.entityId).toBe('entity-1');
      expect(payload.partId).toBeUndefined();
      expect(payload.scope).toBe('entity');
      expect(typeof payload.timestamp).toBe('number');
    });
  });

  describe('exported constants', () => {
    it('exports POISONED_COMPONENT_ID', () => {
      expect(POISONED_COMPONENT_ID).toBe('anatomy:poisoned');
    });

    it('exports POISONED_STARTED_EVENT', () => {
      expect(POISONED_STARTED_EVENT).toBe('anatomy:poisoned_started');
    });

    it('exports DEFAULT_TICK_DAMAGE', () => {
      expect(DEFAULT_TICK_DAMAGE).toBe(1);
    });

    it('exports DEFAULT_DURATION_TURNS', () => {
      expect(DEFAULT_DURATION_TURNS).toBe(3);
    });

    it('exports DEFAULT_SCOPE', () => {
      expect(DEFAULT_SCOPE).toBe('part');
    });
  });

  describe('edge cases', () => {
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

    it('handles null damageEntryConfig gracefully', async () => {
      const result = await applicator.apply({
        ...baseParams,
        damageEntryConfig: null,
      });
      expect(result.applied).toBe(true);
      expect(mockEntityManager.addComponent).toHaveBeenCalled();
    });

    it('handles undefined damageEntryConfig gracefully', async () => {
      const result = await applicator.apply({
        ...baseParams,
        damageEntryConfig: undefined,
      });
      expect(result.applied).toBe(true);
      expect(mockEntityManager.addComponent).toHaveBeenCalled();
    });

    it('handles null effectDefinition gracefully', async () => {
      const result = await applicator.apply({
        ...baseParams,
        effectDefinition: null,
      });
      expect(result.applied).toBe(true);
      expect(mockEntityManager.addComponent).toHaveBeenCalled();
    });

    it('handles undefined effectDefinition gracefully', async () => {
      const result = await applicator.apply({
        ...baseParams,
        effectDefinition: undefined,
      });
      expect(result.applied).toBe(true);
      expect(mockEntityManager.addComponent).toHaveBeenCalled();
    });

    it('handles effectDefinition with no defaults', async () => {
      const result = await applicator.apply({
        ...baseParams,
        effectDefinition: { componentId: 'custom:poison' },
      });
      expect(result.applied).toBe(true);
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        'custom:poison',
        {
          remainingTurns: DEFAULT_DURATION_TURNS,
          tickDamage: DEFAULT_TICK_DAMAGE,
        }
      );
    });

    it('handles empty damageEntryConfig object', async () => {
      const result = await applicator.apply({
        ...baseParams,
        damageEntryConfig: {},
      });
      expect(result.applied).toBe(true);
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        POISONED_COMPONENT_ID,
        {
          remainingTurns: DEFAULT_DURATION_TURNS,
          tickDamage: DEFAULT_TICK_DAMAGE,
        }
      );
    });

    it('handles null sessionContext', async () => {
      const result = await applicator.apply({
        ...baseParams,
        sessionContext: null,
      });
      expect(result.applied).toBe(true);
      expect(mockDispatchStrategy.dispatch).toHaveBeenCalledWith(
        POISONED_STARTED_EVENT,
        expect.any(Object),
        null
      );
      expect(mockDispatchStrategy.recordEffect).toHaveBeenCalledWith(
        'part-1',
        'poisoned',
        null
      );
    });

    it('handles tick value of 0', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { tick: 0 },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        POISONED_COMPONENT_ID,
        expect.objectContaining({
          tickDamage: 0,
        })
      );
    });

    it('handles durationTurns value of 0', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { durationTurns: 0 },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        POISONED_COMPONENT_ID,
        expect.objectContaining({
          remainingTurns: 0,
        })
      );
    });
  });
});
