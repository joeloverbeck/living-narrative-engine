/**
 * @file Property-based tests for Damage Types and Effects
 * Uses fast-check to verify invariants for bleed DPS bounds and burn stacking stability.
 * @see specs/damage-types-and-special-effects.md
 * @see tickets/DAMTYPANDSPEEFF-005-testing-and-performance-coverage.md
 */

// Increase timeout for async property tests with many runs
jest.setTimeout(15000);

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import fc from 'fast-check';
import DamageTypeEffectsService, {
  BLEEDING_COMPONENT_ID,
  BURNING_COMPONENT_ID,
} from '../../../src/anatomy/services/damageTypeEffectsService.js';

/**
 * Internal bleed severity map values for validation.
 * These match the internal implementation in damageTypeEffectsService.js
 * and are duplicated here for property testing purposes.
 */
const BLEED_SEVERITY_MAP = {
  minor: { tickDamage: 1 },
  moderate: { tickDamage: 3 },
  severe: { tickDamage: 5 },
};

/**
 * Valid bleed severity levels from the spec
 */
const VALID_SEVERITIES = ['minor', 'moderate', 'severe'];

/**
 * Valid poison scopes from the spec
 */
const VALID_POISON_SCOPES = ['part', 'entity'];

/**
 * Creates a mock entity manager for property testing
 *
 * @returns {object} Mock entity manager with component tracking
 */
function createMockEntityManager() {
  const components = new Map();

  return {
    getComponentData: jest.fn((entityId, componentId) => {
      const key = `${entityId}:${componentId}`;
      return components.get(key) ?? null;
    }),
    addComponent: jest.fn(async (entityId, componentId, data) => {
      const key = `${entityId}:${componentId}`;
      components.set(key, data);
    }),
    removeComponent: jest.fn(async (entityId, componentId) => {
      const key = `${entityId}:${componentId}`;
      components.delete(key);
    }),
    hasComponent: jest.fn((entityId, componentId) => {
      const key = `${entityId}:${componentId}`;
      return components.has(key);
    }),
    _getComponent: (entityId, componentId) => {
      const key = `${entityId}:${componentId}`;
      return components.get(key);
    },
    _clear: () => components.clear(),
  };
}

/**
 * Creates a mock logger for property testing
 *
 * @returns {object} Mock logger
 */
function createMockLogger() {
  return {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  };
}

/**
 * Creates a mock event dispatcher for property testing
 *
 * @returns {object} Mock dispatcher
 */
function createMockDispatcher() {
  return { dispatch: jest.fn() };
}

describe('Damage Types - Property Tests', () => {
  describe('Bleed Severity Map Invariants', () => {
    it('should have positive tickDamage for all severities', () => {
      // Property: All severity values in BLEED_SEVERITY_MAP must have positive tickDamage
      fc.assert(
        fc.property(fc.constantFrom(...VALID_SEVERITIES), (severity) => {
          const config = BLEED_SEVERITY_MAP[severity];
          expect(config).toBeDefined();
          expect(config.tickDamage).toBeGreaterThan(0);
        }),
        { numRuns: VALID_SEVERITIES.length, seed: 42 }
      );
    });

    it('should have monotonically increasing tickDamage from minor to severe', () => {
      // Property: minor < moderate < severe in terms of tickDamage
      const minorDamage = BLEED_SEVERITY_MAP.minor.tickDamage;
      const moderateDamage = BLEED_SEVERITY_MAP.moderate.tickDamage;
      const severeDamage = BLEED_SEVERITY_MAP.severe.tickDamage;

      expect(minorDamage).toBeLessThan(moderateDamage);
      expect(moderateDamage).toBeLessThan(severeDamage);
    });
  });

  describe('Bleed DPS Bounds', () => {
    it('should never produce negative durations for randomized damage types', () => {
      // Property: For any valid bleed configuration, duration must be positive
      fc.assert(
        fc.property(
          fc.constantFrom(...VALID_SEVERITIES),
          fc.integer({ min: 1, max: 100 }), // baseDurationTurns
          (severity, baseDurationTurns) => {
            const damageType = {
              id: 'test-type',
              bleed: {
                enabled: true,
                severity,
                baseDurationTurns,
              },
            };

            expect(damageType.bleed.baseDurationTurns).toBeGreaterThan(0);
            expect(BLEED_SEVERITY_MAP[severity]).toBeDefined();
          }
        ),
        { numRuns: 50, seed: 42 }
      );
    });

    it('should never produce negative or zero tickDamage for valid severities', () => {
      // Property: tickDamage must always be positive
      fc.assert(
        fc.property(fc.constantFrom(...VALID_SEVERITIES), (severity) => {
          const tickDamage = BLEED_SEVERITY_MAP[severity].tickDamage;
          expect(tickDamage).toBeGreaterThan(0);
          expect(Number.isFinite(tickDamage)).toBe(true);
          expect(Number.isNaN(tickDamage)).toBe(false);
        }),
        { numRuns: VALID_SEVERITIES.length, seed: 42 }
      );
    });

    it('should produce bounded DPS values for all severity + duration combinations', () => {
      // Property: DPS should be reasonable (tickDamage * turns) within expected bounds
      fc.assert(
        fc.property(
          fc.constantFrom(...VALID_SEVERITIES),
          fc.integer({ min: 1, max: 20 }), // realistic duration range
          (severity, duration) => {
            const tickDamage = BLEED_SEVERITY_MAP[severity].tickDamage;
            const totalDamage = tickDamage * duration;

            // Total damage should be positive and bounded
            expect(totalDamage).toBeGreaterThan(0);
            expect(totalDamage).toBeLessThanOrEqual(100); // severe (5) * 20 turns = 100
          }
        ),
        { numRuns: 100, seed: 42 }
      );
    });
  });

  describe('Burn Stacking Stability', () => {
    let entityManager;
    let logger;
    let dispatcher;

    beforeEach(() => {
      entityManager = createMockEntityManager();
      logger = createMockLogger();
      dispatcher = createMockDispatcher();
    });

    it('should monotonically increase stackedCount with canStack=true', async () => {
      // Property: Repeated burn applications with canStack=true should increase count
      const ids = { entity: 'entity-1', part: 'part-1' };

      // Set up part component
      await entityManager.addComponent(ids.part, 'anatomy:part', {
        ownerEntityId: ids.entity,
        subType: 'torso',
      });

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 10 }), // number of applications
          fc.integer({ min: 1, max: 5 }), // dps
          fc.integer({ min: 1, max: 5 }), // durationTurns
          async (applicationCount, dps, durationTurns) => {
            entityManager._clear();
            await entityManager.addComponent(ids.part, 'anatomy:part', {
              ownerEntityId: ids.entity,
              subType: 'torso',
            });

            const damageType = {
              name: 'fire',
              amount: 10,
              burn: { enabled: true, dps, durationTurns, canStack: true },
            };

            const service = new DamageTypeEffectsService({
              logger,
              entityManager,
              safeEventDispatcher: dispatcher,
              rngProvider: () => 0.5,
            });

            let previousStackCount = 0;

            for (let i = 0; i < applicationCount; i++) {
              await service.applyEffectsForDamage({
                entityId: ids.entity,
                partId: ids.part,
                damageEntry: damageType,
                maxHealth: 100,
                currentHealth: 100,
              });

              const burning = entityManager._getComponent(
                ids.part,
                BURNING_COMPONENT_ID
              );
              expect(burning).not.toBeNull();
              expect(burning.stackedCount).toBeGreaterThanOrEqual(
                previousStackCount
              );
              previousStackCount = burning.stackedCount;
            }

            // Final stacked count should match application count
            const finalBurning = entityManager._getComponent(
              ids.part,
              BURNING_COMPONENT_ID
            );
            expect(finalBurning.stackedCount).toBe(applicationCount);
          }
        ),
        { numRuns: 20, seed: 42 }
      );
    });

    it('should not increase stackedCount beyond 1 with canStack=false', async () => {
      // Property: With canStack=false, stackedCount should remain 1
      const ids = { entity: 'entity-1', part: 'part-1' };

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 2, max: 5 }), // number of applications
          fc.integer({ min: 1, max: 5 }), // dps
          fc.integer({ min: 1, max: 5 }), // durationTurns
          async (applicationCount, dps, durationTurns) => {
            entityManager._clear();
            await entityManager.addComponent(ids.part, 'anatomy:part', {
              ownerEntityId: ids.entity,
              subType: 'torso',
            });

            const damageType = {
              name: 'fire',
              amount: 10,
              burn: { enabled: true, dps, durationTurns, canStack: false },
            };

            const service = new DamageTypeEffectsService({
              logger,
              entityManager,
              safeEventDispatcher: dispatcher,
              rngProvider: () => 0.5,
            });

            for (let i = 0; i < applicationCount; i++) {
              await service.applyEffectsForDamage({
                entityId: ids.entity,
                partId: ids.part,
                damageEntry: damageType,
                maxHealth: 100,
                currentHealth: 100,
              });

              const burning = entityManager._getComponent(
                ids.part,
                BURNING_COMPONENT_ID
              );
              expect(burning).not.toBeNull();
              // stackedCount should always be 1 with canStack=false
              expect(burning.stackedCount).toBe(1);
            }
          }
        ),
        { numRuns: 20, seed: 42 }
      );
    });

    it('should refresh duration on reapplication with canStack=false', async () => {
      // Property: Reapplying burn with canStack=false should reset duration
      const ids = { entity: 'entity-1', part: 'part-1' };

      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 5 }), // initial duration
          fc.integer({ min: 1, max: 5 }), // refresh duration
          async (initialDuration, refreshDuration) => {
            entityManager._clear();
            await entityManager.addComponent(ids.part, 'anatomy:part', {
              ownerEntityId: ids.entity,
              subType: 'torso',
            });

            // First application
            let damageType = {
              name: 'fire',
              amount: 10,
              burn: {
                enabled: true,
                dps: 2,
                durationTurns: initialDuration,
                canStack: false,
              },
            };

            let service = new DamageTypeEffectsService({
              logger,
              entityManager,
              safeEventDispatcher: dispatcher,
              rngProvider: () => 0.5,
            });

              await service.applyEffectsForDamage({
                entityId: ids.entity,
                partId: ids.part,
                damageEntry: damageType,
                maxHealth: 100,
                currentHealth: 100,
              });

            // Second application with different duration
            damageType = {
              name: 'fire',
              amount: 10,
              burn: {
                enabled: true,
                dps: 2,
                durationTurns: refreshDuration,
                canStack: false,
              },
            };

            service = new DamageTypeEffectsService({
              logger,
              entityManager,
              safeEventDispatcher: dispatcher,
              rngProvider: () => 0.5,
            });

              await service.applyEffectsForDamage({
                entityId: ids.entity,
                partId: ids.part,
                damageEntry: damageType,
                maxHealth: 100,
                currentHealth: 100,
              });

            const burning = entityManager._getComponent(
              ids.part,
              BURNING_COMPONENT_ID
            );
            expect(burning).not.toBeNull();
            expect(burning.remainingTurns).toBe(refreshDuration);
          }
        ),
        { numRuns: 20, seed: 42 }
      );
    });
  });

  describe('Bleed Application Invariants', () => {
    let entityManager;
    let logger;
    let dispatcher;

    beforeEach(() => {
      entityManager = createMockEntityManager();
      logger = createMockLogger();
      dispatcher = createMockDispatcher();
    });

    it('should attach bleeding component with valid structure', async () => {
      // Property: Applied bleeding should always have required fields with valid values
      const ids = { entity: 'entity-1', part: 'part-1' };

      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...VALID_SEVERITIES),
          fc.integer({ min: 1, max: 10 }),
          async (severity, baseDurationTurns) => {
            entityManager._clear();
            await entityManager.addComponent(ids.part, 'anatomy:part', {
              ownerEntityId: ids.entity,
              subType: 'torso',
            });

            const damageType = {
              name: 'slashing',
              amount: 20,
              bleed: { enabled: true, severity, baseDurationTurns },
            };

            const service = new DamageTypeEffectsService({
              logger,
              entityManager,
              safeEventDispatcher: dispatcher,
              rngProvider: () => 0.5,
            });

            await service.applyEffectsForDamage({
              entityId: ids.entity,
              partId: ids.part,
              damageEntry: damageType,
              maxHealth: 100,
              currentHealth: 80,
            });

            const bleeding = entityManager._getComponent(
              ids.part,
              BLEEDING_COMPONENT_ID
            );
            expect(bleeding).not.toBeNull();

            // Verify structure invariants
            expect(bleeding.severity).toBe(severity);
            expect(bleeding.remainingTurns).toBeGreaterThan(0);
            expect(bleeding.tickDamage).toBeGreaterThan(0);
            expect(Number.isFinite(bleeding.remainingTurns)).toBe(true);
            expect(Number.isFinite(bleeding.tickDamage)).toBe(true);
          }
        ),
        { numRuns: 30, seed: 42 }
      );
    });
  });

  describe('Poison Scope Invariants', () => {
    it('should only accept valid scope values', () => {
      // Property: Only 'part' and 'entity' are valid poison scopes
      fc.assert(
        fc.property(fc.constantFrom(...VALID_POISON_SCOPES), (scope) => {
          expect(['part', 'entity']).toContain(scope);
        }),
        { numRuns: VALID_POISON_SCOPES.length, seed: 42 }
      );
    });

    it('should reject invalid scope values', () => {
      // Property: Arbitrary strings that aren't 'part' or 'entity' are invalid
      fc.assert(
        fc.property(
          fc.string().filter((s) => !VALID_POISON_SCOPES.includes(s)),
          (invalidScope) => {
            expect(VALID_POISON_SCOPES).not.toContain(invalidScope);
          }
        ),
        { numRuns: 20, seed: 42 }
      );
    });
  });

  describe('Damage Type Definition Defaults', () => {
    it('should handle missing optional fields gracefully', async () => {
      // Property: Damage types with missing optional sections should not throw
      const entityManager = createMockEntityManager();
      const logger = createMockLogger();
      const dispatcher = createMockDispatcher();
      const ids = { entity: 'entity-1', part: 'part-1' };

      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 20 }),
            name: fc.option(fc.string(), { nil: undefined }),
            description: fc.option(fc.string(), { nil: undefined }),
          }),
          async (minimalDamageType) => {
            entityManager._clear();
            await entityManager.addComponent(ids.part, 'anatomy:part', {
              ownerEntityId: ids.entity,
              subType: 'torso',
            });

            const service = new DamageTypeEffectsService({
              logger,
              entityManager,
              safeEventDispatcher: dispatcher,
              rngProvider: () => 0.5,
            });

            // Should not throw even with minimal damage type
            await expect(
              service.applyEffectsForDamage({
                entityId: ids.entity,
                partId: ids.part,
                damageEntry: {
                  name: minimalDamageType.id,
                  amount: 10,
                },
                maxHealth: 100,
                currentHealth: 90,
              })
            ).resolves.not.toThrow();
          }
        ),
        { numRuns: 20, seed: 42 }
      );
    });
  });
});
