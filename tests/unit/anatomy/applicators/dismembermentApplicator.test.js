/**
 * @file Unit tests for DismembermentApplicator
 * @see src/anatomy/applicators/dismembermentApplicator.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import DismembermentApplicator, {
  DISMEMBERED_COMPONENT_ID,
  DISMEMBERED_EVENT,
  DEFAULT_THRESHOLD_FRACTION,
} from '../../../../src/anatomy/applicators/dismembermentApplicator.js';

describe('DismembermentApplicator', () => {
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
      hasComponent: jest.fn(),
      addComponent: jest.fn().mockResolvedValue(undefined),
    };

    mockDispatchStrategy = {
      dispatch: jest.fn(),
      recordEffect: jest.fn(),
    };

    applicator = new DismembermentApplicator({
      logger: mockLogger,
      entityManager: mockEntityManager,
    });
  });

  describe('constructor', () => {
    it('validates logger dependency', () => {
      expect(() => {
        new DismembermentApplicator({
          logger: null,
          entityManager: mockEntityManager,
        });
      }).toThrow();
    });

    it('validates entityManager dependency', () => {
      expect(() => {
        new DismembermentApplicator({
          logger: mockLogger,
          entityManager: null,
        });
      }).toThrow();
    });

    it('creates instance with valid dependencies', () => {
      const instance = new DismembermentApplicator({
        logger: mockLogger,
        entityManager: mockEntityManager,
      });
      expect(instance).toBeInstanceOf(DismembermentApplicator);
    });
  });

  describe('isEmbedded()', () => {
    it('returns true when part has anatomy:embedded component', () => {
      mockEntityManager.hasComponent.mockReturnValue(true);

      const result = applicator.isEmbedded('part-123');

      expect(result).toBe(true);
      expect(mockEntityManager.hasComponent).toHaveBeenCalledWith(
        'part-123',
        'anatomy:embedded'
      );
    });

    it('returns false when part lacks anatomy:embedded component', () => {
      mockEntityManager.hasComponent.mockReturnValue(false);

      const result = applicator.isEmbedded('part-456');

      expect(result).toBe(false);
    });

    it('handles entityManager errors gracefully', () => {
      mockEntityManager.hasComponent.mockImplementation(() => {
        throw new Error('Entity not found');
      });

      const result = applicator.isEmbedded('missing-part');

      expect(result).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error checking embedded status')
      );
    });
  });

  describe('meetsThreshold()', () => {
    it('returns false when damageAmount < maxHealth * threshold', () => {
      // 50 damage vs 100 * 0.8 = 80 threshold
      expect(applicator.meetsThreshold(50, 100, 0.8)).toBe(false);
    });

    it('returns true when damageAmount == maxHealth * threshold', () => {
      // 80 damage vs 100 * 0.8 = 80 threshold
      expect(applicator.meetsThreshold(80, 100, 0.8)).toBe(true);
    });

    it('returns true when damageAmount > maxHealth * threshold', () => {
      // 90 damage vs 100 * 0.8 = 80 threshold
      expect(applicator.meetsThreshold(90, 100, 0.8)).toBe(true);
    });

    it('handles edge case: maxHealth = 0', () => {
      expect(applicator.meetsThreshold(50, 0, 0.8)).toBe(false);
    });

    it('handles edge case: maxHealth < 0', () => {
      expect(applicator.meetsThreshold(50, -10, 0.8)).toBe(false);
    });

    it('handles edge case: threshold = 0', () => {
      // Any positive damage triggers dismemberment
      expect(applicator.meetsThreshold(1, 100, 0)).toBe(true);
      expect(applicator.meetsThreshold(0, 100, 0)).toBe(false);
    });

    it('handles edge case: threshold = 1', () => {
      // Damage must be >= full health
      expect(applicator.meetsThreshold(99, 100, 1)).toBe(false);
      expect(applicator.meetsThreshold(100, 100, 1)).toBe(true);
      expect(applicator.meetsThreshold(101, 100, 1)).toBe(true);
    });

    it('handles edge case: threshold > 1 (clamped to 1)', () => {
      // Threshold > 1 should be clamped to 1
      expect(applicator.meetsThreshold(100, 100, 1.5)).toBe(true);
      expect(applicator.meetsThreshold(99, 100, 1.5)).toBe(false);
    });
  });

  describe('apply()', () => {
    const baseParams = {
      entityId: 'entity-1',
      entityName: 'Test Entity',
      entityPronoun: 'they',
      partId: 'part-1',
      partType: 'arm',
      orientation: 'left',
      damageAmount: 100,
      damageTypeId: 'slashing',
      maxHealth: 100,
      currentHealth: 0,
      effectDefinition: null,
      damageEntryConfig: { enabled: true },
      dispatchStrategy: null,
      sessionContext: { sessionId: 'test-session' },
    };

    beforeEach(() => {
      baseParams.dispatchStrategy = mockDispatchStrategy;
      mockEntityManager.hasComponent.mockReturnValue(false);
    });

    it('returns { triggered: false } when damageEntryConfig.enabled is false', async () => {
      const result = await applicator.apply({
        ...baseParams,
        damageEntryConfig: { enabled: false },
      });

      expect(result).toEqual({ triggered: false });
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    it('returns { triggered: false } when damageEntryConfig is null', async () => {
      const result = await applicator.apply({
        ...baseParams,
        damageEntryConfig: null,
      });

      expect(result).toEqual({ triggered: false });
    });

    it('returns { triggered: false } when part is embedded', async () => {
      mockEntityManager.hasComponent.mockReturnValue(true);

      const result = await applicator.apply(baseParams);

      expect(result).toEqual({ triggered: false });
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('embedded')
      );
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    it('returns { triggered: false } when damage below threshold (default 0.8)', async () => {
      const result = await applicator.apply({
        ...baseParams,
        damageAmount: 50,
        maxHealth: 100,
      });

      expect(result).toEqual({ triggered: false });
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    it('returns { triggered: true } when damage meets threshold exactly', async () => {
      const result = await applicator.apply({
        ...baseParams,
        damageAmount: 80,
        maxHealth: 100,
      });

      expect(result).toEqual({ triggered: true });
    });

    it('returns { triggered: true } when damage exceeds threshold', async () => {
      const result = await applicator.apply({
        ...baseParams,
        damageAmount: 100,
        maxHealth: 100,
      });

      expect(result).toEqual({ triggered: true });
    });

    it('uses config thresholdFraction over definition defaults', async () => {
      const result = await applicator.apply({
        ...baseParams,
        damageAmount: 50,
        maxHealth: 100,
        damageEntryConfig: { enabled: true, thresholdFraction: 0.5 },
        effectDefinition: { defaults: { thresholdFraction: 0.9 } },
      });

      expect(result).toEqual({ triggered: true });
    });

    it('uses definition thresholdFraction when config lacks it', async () => {
      const result = await applicator.apply({
        ...baseParams,
        damageAmount: 90,
        maxHealth: 100,
        damageEntryConfig: { enabled: true },
        effectDefinition: { defaults: { thresholdFraction: 0.9 } },
      });

      expect(result).toEqual({ triggered: true });
    });

    it('uses DEFAULT_THRESHOLD_FRACTION when no config or definition', async () => {
      expect(DEFAULT_THRESHOLD_FRACTION).toBe(0.8);

      const result = await applicator.apply({
        ...baseParams,
        damageAmount: 80,
        maxHealth: 100,
        damageEntryConfig: { enabled: true },
        effectDefinition: null,
      });

      expect(result).toEqual({ triggered: true });
    });

    it('adds anatomy:dismembered component with correct data', async () => {
      await applicator.apply({
        ...baseParams,
        damageTypeId: 'crushing',
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        DISMEMBERED_COMPONENT_ID,
        { sourceDamageType: 'crushing' }
      );
    });

    it('uses effectDefinition.componentId when provided', async () => {
      await applicator.apply({
        ...baseParams,
        effectDefinition: { componentId: 'custom:severed' },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        'custom:severed',
        { sourceDamageType: 'slashing' }
      );
    });

    it('dispatches event via strategy with correct payload', async () => {
      const beforeTime = Date.now();

      await applicator.apply(baseParams);

      const afterTime = Date.now();

      expect(mockDispatchStrategy.dispatch).toHaveBeenCalledWith(
        DISMEMBERED_EVENT,
        expect.objectContaining({
          entityId: 'entity-1',
          entityName: 'Test Entity',
          entityPronoun: 'they',
          partId: 'part-1',
          partType: 'arm',
          orientation: 'left',
          damageTypeId: 'slashing',
        }),
        baseParams.sessionContext
      );

      const payload = mockDispatchStrategy.dispatch.mock.calls[0][1];
      expect(payload.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(payload.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('uses effectDefinition.startedEventId when provided', async () => {
      await applicator.apply({
        ...baseParams,
        effectDefinition: { startedEventId: 'custom:limb_severed' },
      });

      expect(mockDispatchStrategy.dispatch).toHaveBeenCalledWith(
        'custom:limb_severed',
        expect.any(Object),
        baseParams.sessionContext
      );
    });

    it('records effect via strategy when triggered', async () => {
      await applicator.apply(baseParams);

      expect(mockDispatchStrategy.recordEffect).toHaveBeenCalledWith(
        'part-1',
        'dismembered',
        baseParams.sessionContext
      );
    });

    it('does not add component when not triggered', async () => {
      await applicator.apply({
        ...baseParams,
        damageAmount: 10,
        maxHealth: 100,
      });

      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    it('does not dispatch event when not triggered', async () => {
      await applicator.apply({
        ...baseParams,
        damageAmount: 10,
        maxHealth: 100,
      });

      expect(mockDispatchStrategy.dispatch).not.toHaveBeenCalled();
      expect(mockDispatchStrategy.recordEffect).not.toHaveBeenCalled();
    });

    it('logs info when dismemberment is triggered', async () => {
      await applicator.apply({
        ...baseParams,
        damageTypeId: 'piercing',
      });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('dismembered by piercing damage')
      );
    });

    describe('suppressBodyPartSpawning flag', () => {
      it('includes suppressBodyPartSpawning=true in event payload when provided', async () => {
        await applicator.apply({
          ...baseParams,
          suppressBodyPartSpawning: true,
        });

        expect(mockDispatchStrategy.dispatch).toHaveBeenCalledWith(
          DISMEMBERED_EVENT,
          expect.objectContaining({
            suppressBodyPartSpawning: true,
          }),
          baseParams.sessionContext
        );
      });

      it('includes suppressBodyPartSpawning=false in event payload when explicitly provided', async () => {
        await applicator.apply({
          ...baseParams,
          suppressBodyPartSpawning: false,
        });

        expect(mockDispatchStrategy.dispatch).toHaveBeenCalledWith(
          DISMEMBERED_EVENT,
          expect.objectContaining({
            suppressBodyPartSpawning: false,
          }),
          baseParams.sessionContext
        );
      });

      it('defaults suppressBodyPartSpawning to false in event payload when not provided', async () => {
        await applicator.apply(baseParams);

        expect(mockDispatchStrategy.dispatch).toHaveBeenCalledWith(
          DISMEMBERED_EVENT,
          expect.objectContaining({
            suppressBodyPartSpawning: false,
          }),
          baseParams.sessionContext
        );
      });
    });
  });

  describe('exported constants', () => {
    it('exports DISMEMBERED_COMPONENT_ID', () => {
      expect(DISMEMBERED_COMPONENT_ID).toBe('anatomy:dismembered');
    });

    it('exports DISMEMBERED_EVENT', () => {
      expect(DISMEMBERED_EVENT).toBe('anatomy:dismembered');
    });

    it('exports DEFAULT_THRESHOLD_FRACTION', () => {
      expect(DEFAULT_THRESHOLD_FRACTION).toBe(0.8);
    });
  });
});
