/**
 * @file Unit tests for BleedApplicator
 * @see src/anatomy/applicators/bleedApplicator.js
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import BleedApplicator, {
  BLEEDING_COMPONENT_ID,
  BLEEDING_STARTED_EVENT,
  DEFAULT_BASE_DURATION_TURNS,
  BLEED_SEVERITY_MAP,
} from '../../../../src/anatomy/applicators/bleedApplicator.js';

describe('BleedApplicator', () => {
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

    applicator = new BleedApplicator({
      logger: mockLogger,
      entityManager: mockEntityManager,
    });
  });

  describe('constructor', () => {
    it('validates logger dependency', () => {
      expect(() => {
        new BleedApplicator({
          logger: null,
          entityManager: mockEntityManager,
        });
      }).toThrow();
    });

    it('validates entityManager dependency', () => {
      expect(() => {
        new BleedApplicator({
          logger: mockLogger,
          entityManager: null,
        });
      }).toThrow();
    });

    it('creates instance with valid dependencies', () => {
      const instance = new BleedApplicator({
        logger: mockLogger,
        entityManager: mockEntityManager,
      });
      expect(instance).toBeInstanceOf(BleedApplicator);
    });
  });

  describe('getTickDamageForSeverity()', () => {
    it('returns correct value for minor severity', () => {
      const result = applicator.getTickDamageForSeverity(
        'minor',
        BLEED_SEVERITY_MAP
      );
      expect(result).toBe(1);
    });

    it('returns correct value for moderate severity', () => {
      const result = applicator.getTickDamageForSeverity(
        'moderate',
        BLEED_SEVERITY_MAP
      );
      expect(result).toBe(3);
    });

    it('returns correct value for severe severity', () => {
      const result = applicator.getTickDamageForSeverity(
        'severe',
        BLEED_SEVERITY_MAP
      );
      expect(result).toBe(5);
    });

    it('returns minor value for unknown severity', () => {
      const result = applicator.getTickDamageForSeverity(
        'unknown',
        BLEED_SEVERITY_MAP
      );
      expect(result).toBe(1); // Falls back to minor
    });

    it('handles custom severity maps from config', () => {
      const customMap = {
        minor: { tickDamage: 2 },
        moderate: { tickDamage: 6 },
        severe: { tickDamage: 10 },
      };
      expect(applicator.getTickDamageForSeverity('moderate', customMap)).toBe(
        6
      );
    });

    it('returns 0 when severity map is empty', () => {
      const result = applicator.getTickDamageForSeverity('minor', {});
      expect(result).toBe(0);
    });

    it('returns 0 when severity map is null', () => {
      const result = applicator.getTickDamageForSeverity('minor', null);
      expect(result).toBe(0);
    });

    it('returns 0 when severity map is undefined', () => {
      const result = applicator.getTickDamageForSeverity('minor', undefined);
      expect(result).toBe(0);
    });

    it('returns 0 when severity data has no tickDamage property', () => {
      const mapWithoutTickDamage = {
        minor: {},
        moderate: { tickDamage: 3 },
      };
      const result = applicator.getTickDamageForSeverity(
        'minor',
        mapWithoutTickDamage
      );
      expect(result).toBe(0);
    });

    it('falls back to minor when unknown severity and minor exists', () => {
      const result = applicator.getTickDamageForSeverity(
        'extreme',
        BLEED_SEVERITY_MAP
      );
      expect(result).toBe(1); // minor tickDamage
    });

    it('returns 0 when unknown severity and no minor in map', () => {
      const mapWithoutMinor = {
        moderate: { tickDamage: 3 },
      };
      const result = applicator.getTickDamageForSeverity(
        'severe',
        mapWithoutMinor
      );
      expect(result).toBe(0);
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

    it('returns { applied: true } when effect is applied', async () => {
      const result = await applicator.apply(baseParams);
      expect(result).toEqual({ applied: true });
    });

    it('adds anatomy:bleeding component with correct severity', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { severity: 'moderate' },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        BLEEDING_COMPONENT_ID,
        expect.objectContaining({
          severity: 'moderate',
          tickDamage: 3,
        })
      );
    });

    it('uses config baseDurationTurns over definition defaults', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { baseDurationTurns: 5 },
        effectDefinition: { defaults: { baseDurationTurns: 3 } },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        BLEEDING_COMPONENT_ID,
        expect.objectContaining({
          remainingTurns: 5,
        })
      );
    });

    it('uses definition defaults when config lacks baseDurationTurns', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { severity: 'minor' },
        effectDefinition: { defaults: { baseDurationTurns: 4 } },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        BLEEDING_COMPONENT_ID,
        expect.objectContaining({
          remainingTurns: 4,
        })
      );
    });

    it('uses DEFAULT_BASE_DURATION_TURNS when no config or definition', async () => {
      expect(DEFAULT_BASE_DURATION_TURNS).toBe(2);

      await applicator.apply(baseParams);

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        BLEEDING_COMPONENT_ID,
        expect.objectContaining({
          remainingTurns: 2,
        })
      );
    });

    it('calculates correct tickDamage for minor severity', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { severity: 'minor' },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        BLEEDING_COMPONENT_ID,
        expect.objectContaining({
          tickDamage: 1,
        })
      );
    });

    it('calculates correct tickDamage for moderate severity', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { severity: 'moderate' },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        BLEEDING_COMPONENT_ID,
        expect.objectContaining({
          tickDamage: 3,
        })
      );
    });

    it('calculates correct tickDamage for severe severity', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { severity: 'severe' },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        BLEEDING_COMPONENT_ID,
        expect.objectContaining({
          tickDamage: 5,
        })
      );
    });

    it('falls back to minor tickDamage for unknown severity', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { severity: 'unknown' },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        BLEEDING_COMPONENT_ID,
        expect.objectContaining({
          severity: 'unknown',
          tickDamage: 1, // Falls back to minor
        })
      );
    });

    it('dispatches event via strategy with correct payload', async () => {
      const beforeTime = Date.now();

      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { severity: 'moderate' },
      });

      const afterTime = Date.now();

      expect(mockDispatchStrategy.dispatch).toHaveBeenCalledWith(
        BLEEDING_STARTED_EVENT,
        expect.objectContaining({
          entityId: 'entity-1',
          partId: 'part-1',
          severity: 'moderate',
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
        'bleeding',
        baseParams.sessionContext
      );
    });

    it('uses config severity over default', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { severity: 'severe' },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        BLEEDING_COMPONENT_ID,
        expect.objectContaining({
          severity: 'severe',
        })
      );
    });

    it('defaults to minor severity when no config severity', async () => {
      await applicator.apply(baseParams);

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        BLEEDING_COMPONENT_ID,
        expect.objectContaining({
          severity: 'minor',
        })
      );
    });

    it('uses custom componentId from effectDefinition', async () => {
      await applicator.apply({
        ...baseParams,
        effectDefinition: { componentId: 'custom:bleeding_status' },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        'custom:bleeding_status',
        expect.any(Object)
      );
    });

    it('uses custom startedEventId from effectDefinition', async () => {
      await applicator.apply({
        ...baseParams,
        effectDefinition: { startedEventId: 'custom:bleed_started' },
      });

      expect(mockDispatchStrategy.dispatch).toHaveBeenCalledWith(
        'custom:bleed_started',
        expect.any(Object),
        baseParams.sessionContext
      );
    });

    it('uses custom severity map from effectDefinition.defaults', async () => {
      const customSeverityMap = {
        minor: { tickDamage: 10 },
        moderate: { tickDamage: 20 },
        severe: { tickDamage: 30 },
      };

      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { severity: 'minor' },
        effectDefinition: { defaults: { severity: customSeverityMap } },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        BLEEDING_COMPONENT_ID,
        expect.objectContaining({
          tickDamage: 10,
        })
      );
    });

    it('logs debug message when bleeding is applied', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { severity: 'moderate' },
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Bleeding (moderate) applied to part part-1')
      );
    });

    it('includes all required component data fields', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { severity: 'severe', baseDurationTurns: 3 },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part-1',
        BLEEDING_COMPONENT_ID,
        {
          severity: 'severe',
          remainingTurns: 3,
          tickDamage: 5,
        }
      );
    });

    it('includes all required event payload fields', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { severity: 'minor' },
      });

      const payload = mockDispatchStrategy.dispatch.mock.calls[0][1];
      expect(payload).toHaveProperty('entityId', 'entity-1');
      expect(payload).toHaveProperty('partId', 'part-1');
      expect(payload).toHaveProperty('severity', 'minor');
      expect(payload).toHaveProperty('timestamp');
      expect(typeof payload.timestamp).toBe('number');
    });
  });

  describe('exported constants', () => {
    it('exports BLEEDING_COMPONENT_ID', () => {
      expect(BLEEDING_COMPONENT_ID).toBe('anatomy:bleeding');
    });

    it('exports BLEEDING_STARTED_EVENT', () => {
      expect(BLEEDING_STARTED_EVENT).toBe('anatomy:bleeding_started');
    });

    it('exports DEFAULT_BASE_DURATION_TURNS', () => {
      expect(DEFAULT_BASE_DURATION_TURNS).toBe(2);
    });

    it('exports BLEED_SEVERITY_MAP with correct structure', () => {
      expect(BLEED_SEVERITY_MAP).toEqual({
        minor: { tickDamage: 1 },
        moderate: { tickDamage: 3 },
        severe: { tickDamage: 5 },
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
        damageEntryConfig: { severity: 'moderate', baseDurationTurns: 4 },
      });

      const componentData = mockEntityManager.addComponent.mock.calls[0][2];
      expect(componentData).toEqual({
        severity: 'moderate',
        remainingTurns: 4,
        tickDamage: 3,
      });
    });

    it('event payload structure matches expected format', async () => {
      await applicator.apply({
        ...baseParams,
        damageEntryConfig: { severity: 'minor' },
      });

      const payload = mockDispatchStrategy.dispatch.mock.calls[0][1];
      expect(Object.keys(payload).sort()).toEqual(
        ['entityId', 'partId', 'severity', 'timestamp'].sort()
      );
    });
  });
});
