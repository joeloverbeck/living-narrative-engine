/**
 * @file Unit tests for FractureApplicator
 * @see src/anatomy/applicators/fractureApplicator.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import FractureApplicator, {
  FRACTURED_COMPONENT_ID,
  STUNNED_COMPONENT_ID,
  FRACTURED_EVENT,
  HAS_RIGID_STRUCTURE_COMPONENT_ID,
  DEFAULT_THRESHOLD_FRACTION,
  DEFAULT_STUN_DURATION,
} from '../../../../src/anatomy/applicators/fractureApplicator.js';

describe('FractureApplicator', () => {
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
      hasComponent: jest.fn().mockReturnValue(true),
    };

    mockDispatchStrategy = {
      dispatch: jest.fn(),
      recordEffect: jest.fn(),
    };

    applicator = new FractureApplicator({
      logger: mockLogger,
      entityManager: mockEntityManager,
    });
  });

  describe('constructor', () => {
    it('validates logger dependency', () => {
      expect(() => {
        new FractureApplicator({
          logger: null,
          entityManager: mockEntityManager,
        });
      }).toThrow();
    });

    it('validates entityManager dependency', () => {
      expect(() => {
        new FractureApplicator({
          logger: mockLogger,
          entityManager: null,
        });
      }).toThrow();
    });

    it('validates entityManager has required methods', () => {
      expect(() => {
        new FractureApplicator({
          logger: mockLogger,
          entityManager: { addComponent: jest.fn() },
        });
      }).toThrow();
    });

    it('creates instance with valid dependencies', () => {
      const instance = new FractureApplicator({
        logger: mockLogger,
        entityManager: mockEntityManager,
      });
      expect(instance).toBeInstanceOf(FractureApplicator);
    });
  });

  describe('meetsThreshold()', () => {
    it('returns false when damageAmount < maxHealth * threshold', () => {
      // 40 damage vs 100 * 0.5 = 50 threshold
      expect(applicator.meetsThreshold(40, 100, 0.5)).toBe(false);
    });

    it('returns true when damageAmount == maxHealth * threshold', () => {
      // 50 damage vs 100 * 0.5 = 50 threshold
      expect(applicator.meetsThreshold(50, 100, 0.5)).toBe(true);
    });

    it('returns true when damageAmount > maxHealth * threshold', () => {
      // 60 damage vs 100 * 0.5 = 50 threshold
      expect(applicator.meetsThreshold(60, 100, 0.5)).toBe(true);
    });

    it('handles edge case: maxHealth = 0', () => {
      expect(applicator.meetsThreshold(50, 0, 0.5)).toBe(false);
    });

    it('handles edge case: maxHealth < 0', () => {
      expect(applicator.meetsThreshold(50, -10, 0.5)).toBe(false);
    });

    it('handles edge case: threshold = 0', () => {
      // Any positive damage triggers fracture
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

  describe('rollForStun()', () => {
    it('returns true when rng() < stunChance', () => {
      const rng = () => 0.2;
      expect(applicator.rollForStun(0.5, rng)).toBe(true);
    });

    it('returns false when rng() >= stunChance', () => {
      const rng = () => 0.6;
      expect(applicator.rollForStun(0.5, rng)).toBe(false);
    });

    it('returns false when rng() equals stunChance exactly', () => {
      const rng = () => 0.5;
      expect(applicator.rollForStun(0.5, rng)).toBe(false);
    });

    it('returns false when stunChance is 0', () => {
      const rng = () => 0;
      expect(applicator.rollForStun(0, rng)).toBe(false);
    });

    it('returns true when stunChance is 1', () => {
      const rng = () => 0.99;
      expect(applicator.rollForStun(1, rng)).toBe(true);
    });

    it('uses provided rng function', () => {
      const customRng = jest.fn().mockReturnValue(0.3);
      applicator.rollForStun(0.5, customRng);
      expect(customRng).toHaveBeenCalled();
    });
  });

  describe('hasRigidStructure()', () => {
    it('returns true when part has the rigid structure component', () => {
      mockEntityManager.hasComponent.mockReturnValue(true);

      expect(applicator.hasRigidStructure('part-1')).toBe(true);
      expect(mockEntityManager.hasComponent).toHaveBeenCalledWith(
        'part-1',
        HAS_RIGID_STRUCTURE_COMPONENT_ID
      );
    });

    it('returns false when part lacks the rigid structure component', () => {
      mockEntityManager.hasComponent.mockReturnValue(false);

      expect(applicator.hasRigidStructure('part-1')).toBe(false);
    });

    it('returns false and logs warning when entityManager throws', () => {
      mockEntityManager.hasComponent.mockImplementation(() => {
        throw new Error('boom');
      });

      expect(applicator.hasRigidStructure('part-1')).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error checking rigid structure')
      );
    });

    it('returns false and logs warning when entityManager throws non-Error', () => {
      mockEntityManager.hasComponent.mockImplementation(() => {
        throw 'string error';
      });

      expect(applicator.hasRigidStructure('part-1')).toBe(false);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Error checking rigid structure')
      );
    });
  });

  describe('apply()', () => {
    const baseParams = {
      entityId: 'entity-1',
      partId: 'part-1',
      damageAmount: 60,
      damageTypeId: 'bludgeoning',
      maxHealth: 100,
      currentHealth: 40,
      effectDefinition: null,
      damageEntryConfig: { enabled: true },
      dispatchStrategy: null,
      sessionContext: { sessionId: 'test-session' },
      rng: () => 0.5,
    };

    beforeEach(() => {
      baseParams.dispatchStrategy = mockDispatchStrategy;
    });

    it('returns { triggered: false, stunApplied: false } when damageEntryConfig.enabled is false', async () => {
      const result = await applicator.apply({
        ...baseParams,
        damageEntryConfig: { enabled: false },
      });

      expect(result).toEqual({ triggered: false, stunApplied: false });
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });

    it('returns { triggered: false, stunApplied: false } when damageEntryConfig is null', async () => {
      const result = await applicator.apply({
        ...baseParams,
        damageEntryConfig: null,
      });

      expect(result).toEqual({ triggered: false, stunApplied: false });
      expect(mockEntityManager.hasComponent).not.toHaveBeenCalled();
    });

    it('returns { triggered: false, stunApplied: false } when part lacks rigid structure', async () => {
      mockEntityManager.hasComponent.mockReturnValue(false);

      const result = await applicator.apply({
        ...baseParams,
        damageAmount: 60,
        maxHealth: 100,
      });

      expect(result).toEqual({ triggered: false, stunApplied: false });
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
      expect(mockDispatchStrategy.dispatch).not.toHaveBeenCalled();
    });

    it('logs debug when skipping fracture due to missing rigid structure', async () => {
      mockEntityManager.hasComponent.mockReturnValue(false);

      await applicator.apply({
        ...baseParams,
        damageAmount: 60,
        maxHealth: 100,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('lacks rigid structure')
      );
    });

    it('returns { triggered: false, stunApplied: false } when damage below threshold (default 0.5)', async () => {
      const result = await applicator.apply({
        ...baseParams,
        damageAmount: 40,
        maxHealth: 100,
      });

      expect(result).toEqual({ triggered: false, stunApplied: false });
      expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
    });

    it('returns { triggered: true, stunApplied: false } when damage meets threshold but stun roll fails', async () => {
      const result = await applicator.apply({
        ...baseParams,
        damageAmount: 60,
        maxHealth: 100,
        damageEntryConfig: { enabled: true, stunChance: 0.3 },
        rng: () => 0.5, // 0.5 >= 0.3, so stun fails
      });

      expect(result).toEqual({ triggered: true, stunApplied: false });
    });

    it('returns { triggered: true, stunApplied: true } when damage meets threshold and stun roll succeeds', async () => {
      const result = await applicator.apply({
        ...baseParams,
        damageAmount: 60,
        maxHealth: 100,
        damageEntryConfig: { enabled: true, stunChance: 0.7 },
        rng: () => 0.5, // 0.5 < 0.7, so stun succeeds
      });

      expect(result).toEqual({ triggered: true, stunApplied: true });
    });

    it('uses config thresholdFraction over definition defaults', async () => {
      const result = await applicator.apply({
        ...baseParams,
        damageAmount: 40,
        maxHealth: 100,
        damageEntryConfig: { enabled: true, thresholdFraction: 0.4 },
        effectDefinition: { defaults: { thresholdFraction: 0.9 } },
      });

      expect(result.triggered).toBe(true);
    });

    it('uses definition thresholdFraction when config lacks it', async () => {
      const result = await applicator.apply({
        ...baseParams,
        damageAmount: 30,
        maxHealth: 100,
        damageEntryConfig: { enabled: true },
        effectDefinition: { defaults: { thresholdFraction: 0.3 } },
      });

      expect(result.triggered).toBe(true);
    });

    it('uses DEFAULT_THRESHOLD_FRACTION when no config or definition', async () => {
      expect(DEFAULT_THRESHOLD_FRACTION).toBe(0.5);

      const result = await applicator.apply({
        ...baseParams,
        damageAmount: 50,
        maxHealth: 100,
        damageEntryConfig: { enabled: true },
        effectDefinition: null,
      });

      expect(result.triggered).toBe(true);
    });

    it('uses config stunChance over definition defaults', async () => {
      const result = await applicator.apply({
        ...baseParams,
        damageAmount: 60,
        maxHealth: 100,
        damageEntryConfig: { enabled: true, stunChance: 1 },
        effectDefinition: { defaults: { stun: { chance: 0 } } },
        rng: () => 0.5,
      });

      expect(result.stunApplied).toBe(true);
    });

    it('adds anatomy:fractured component to part with correct data', async () => {
      await applicator.apply({
        ...baseParams,
        damageTypeId: 'bludgeoning',
        currentHealth: 35,
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        FRACTURED_COMPONENT_ID,
        { sourceDamageType: 'bludgeoning', appliedAtHealth: 35 }
      );
    });

    it('uses effectDefinition.componentId when provided', async () => {
      await applicator.apply({
        ...baseParams,
        effectDefinition: { componentId: 'custom:cracked' },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        'custom:cracked',
        expect.any(Object)
      );
    });

    it('adds anatomy:stunned component to entity when stun triggered', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { enabled: true, stunChance: 1 },
        rng: () => 0.5,
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'entity-1',
        STUNNED_COMPONENT_ID,
        { remainingTurns: DEFAULT_STUN_DURATION, sourcePartId: 'part-1' }
      );
    });

    it('uses effectDefinition stun componentId when provided', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { enabled: true, stunChance: 1 },
        effectDefinition: { defaults: { stun: { componentId: 'custom:dazed' } } },
        rng: () => 0.5,
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'entity-1',
        'custom:dazed',
        expect.any(Object)
      );
    });

    it('uses config stunDuration over definition defaults', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { enabled: true, stunChance: 1, stunDuration: 3 },
        effectDefinition: { defaults: { stun: { durationTurns: 5 } } },
        rng: () => 0.5,
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'entity-1',
        STUNNED_COMPONENT_ID,
        { remainingTurns: 3, sourcePartId: 'part-1' }
      );
    });

    it('does not add stunned component when stun disabled in config', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { enabled: true, stunChance: 0 },
        rng: () => 0,
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        FRACTURED_COMPONENT_ID,
        expect.any(Object)
      );
    });

    it('does not add stunned component when stun roll fails', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { enabled: true, stunChance: 0.3 },
        rng: () => 0.5,
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledTimes(1);
      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        FRACTURED_COMPONENT_ID,
        expect.any(Object)
      );
    });

    it('dispatches event via strategy with stunApplied=true when stun triggered', async () => {
      const beforeTime = Date.now();

      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { enabled: true, stunChance: 1 },
        rng: () => 0.5,
      });

      const afterTime = Date.now();

      expect(mockDispatchStrategy.dispatch).toHaveBeenCalledWith(
        FRACTURED_EVENT,
        expect.objectContaining({
          entityId: 'entity-1',
          partId: 'part-1',
          damageTypeId: 'bludgeoning',
          stunApplied: true,
        }),
        baseParams.sessionContext
      );

      const payload = mockDispatchStrategy.dispatch.mock.calls[0][1];
      expect(payload.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(payload.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('dispatches event via strategy with stunApplied=false when stun not triggered', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { enabled: true, stunChance: 0 },
      });

      expect(mockDispatchStrategy.dispatch).toHaveBeenCalledWith(
        FRACTURED_EVENT,
        expect.objectContaining({
          stunApplied: false,
        }),
        baseParams.sessionContext
      );
    });

    it('uses effectDefinition.startedEventId when provided', async () => {
      await applicator.apply({
        ...baseParams,
        effectDefinition: { startedEventId: 'custom:bone_cracked' },
      });

      expect(mockDispatchStrategy.dispatch).toHaveBeenCalledWith(
        'custom:bone_cracked',
        expect.any(Object),
        baseParams.sessionContext
      );
    });

    it('records effect via strategy when triggered', async () => {
      await applicator.apply(baseParams);

      expect(mockDispatchStrategy.recordEffect).toHaveBeenCalledWith(
        'part-1',
        'fractured',
        baseParams.sessionContext
      );
    });

    it('does not add components when not triggered', async () => {
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

    it('logs debug when fracture is triggered', async () => {
      await applicator.apply({
        ...baseParams,
        damageTypeId: 'crushing',
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('fractured by crushing')
      );
    });

    it('uses Math.random when rng not provided', async () => {
      // This tests the default fallback behavior
      const paramsWithoutRng = { ...baseParams };
      delete paramsWithoutRng.rng;

      // With stunChance of 0, it should still work without RNG
      const result = await applicator.apply({
        ...paramsWithoutRng,
        damageEntryConfig: { enabled: true, stunChance: 0 },
      });

      expect(result.triggered).toBe(true);
      expect(result.stunApplied).toBe(false);
    });
  });

  describe('exported constants', () => {
    it('exports FRACTURED_COMPONENT_ID', () => {
      expect(FRACTURED_COMPONENT_ID).toBe('anatomy:fractured');
    });

    it('exports STUNNED_COMPONENT_ID', () => {
      expect(STUNNED_COMPONENT_ID).toBe('anatomy:stunned');
    });

    it('exports FRACTURED_EVENT', () => {
      expect(FRACTURED_EVENT).toBe('anatomy:fractured');
    });

    it('exports HAS_RIGID_STRUCTURE_COMPONENT_ID', () => {
      expect(HAS_RIGID_STRUCTURE_COMPONENT_ID).toBe(
        'anatomy:has_rigid_structure'
      );
    });

    it('exports DEFAULT_THRESHOLD_FRACTION', () => {
      expect(DEFAULT_THRESHOLD_FRACTION).toBe(0.5);
    });

    it('exports DEFAULT_STUN_DURATION', () => {
      expect(DEFAULT_STUN_DURATION).toBe(1);
    });
  });
});
