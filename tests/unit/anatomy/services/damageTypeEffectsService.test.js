import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import DamageTypeEffectsService from '../../../../src/anatomy/services/damageTypeEffectsService.js';

/**
 * Creates mock applicators for testing DamageTypeEffectsService.
 * These mocks simulate the real applicator behavior to preserve existing test coverage.
 * The mocks use the dispatchStrategy passed to them for proper session/immediate mode handling.
 */
function createMockApplicators(mockEntityManager) {
  return {
    effectDefinitionResolver: {
      resolveEffectDefinition: jest.fn((effectType) => ({
        id: `anatomy:${effectType === 'dismember' ? 'dismembered' : effectType === 'fracture' ? 'fractured' : effectType === 'bleed' ? 'bleeding' : effectType === 'burn' ? 'burning' : 'poisoned'}`,
        effectType,
        componentId: `anatomy:${effectType === 'dismember' ? 'dismembered' : effectType === 'fracture' ? 'fractured' : effectType === 'bleed' ? 'bleeding' : effectType === 'burn' ? 'burning' : 'poisoned'}`,
        startedEventId: `anatomy:${effectType === 'dismember' ? 'dismembered' : effectType === 'fracture' ? 'fractured' : effectType === 'bleed' ? 'bleeding_started' : effectType === 'burn' ? 'burning_started' : 'poisoned_started'}`,
        defaults: {
          thresholdFraction: effectType === 'dismember' ? 0.8 : 0.5,
        },
      })),
      resolveApplyOrder: jest.fn(() => [
        'anatomy:dismembered',
        'anatomy:fractured',
        'anatomy:bleeding',
        'anatomy:burning',
        'anatomy:poisoned',
      ]),
    },
    dismembermentApplicator: {
      apply: jest.fn(async ({ damageEntryConfig, damageAmount, maxHealth, effectDefinition, dispatchStrategy, sessionContext, entityId, entityName, entityPronoun, partId, partType, orientation, damageTypeId }) => {
        if (!damageEntryConfig?.enabled) {
          return { triggered: false };
        }
        const threshold = damageEntryConfig.thresholdFraction ?? effectDefinition?.defaults?.thresholdFraction ?? 0.8;
        if (damageAmount < threshold * maxHealth) {
          return { triggered: false };
        }
        // Check for embedded component
        if (mockEntityManager.hasComponent(partId, 'anatomy:embedded')) {
          return { triggered: false };
        }
        await mockEntityManager.addComponent(partId, 'anatomy:dismembered', {
          sourceDamageType: damageTypeId,
        });
        dispatchStrategy.dispatch('anatomy:dismembered', {
          entityId,
          entityName,
          entityPronoun,
          partId,
          partType,
          orientation,
          damageTypeId,
          timestamp: Date.now(),
        }, sessionContext);
        dispatchStrategy.recordEffect(partId, 'dismembered', sessionContext);
        return { triggered: true };
      }),
    },
    fractureApplicator: {
      apply: jest.fn(async ({ damageEntryConfig, damageAmount, maxHealth, currentHealth, effectDefinition, dispatchStrategy, sessionContext, entityId, partId, damageTypeId, rng }) => {
        if (!damageEntryConfig?.enabled) {
          return { triggered: false, stunApplied: false };
        }
        const threshold = damageEntryConfig.thresholdFraction ?? effectDefinition?.defaults?.thresholdFraction ?? 0.5;
        if (damageAmount < threshold * maxHealth) {
          return { triggered: false, stunApplied: false };
        }
        await mockEntityManager.addComponent(partId, 'anatomy:fractured', {
          sourceDamageType: damageTypeId,
          appliedAtHealth: currentHealth,
        });
        // Check for stun
        const stunChance = damageEntryConfig.stunChance ?? 0;
        const stunApplied = stunChance > 0 && rng() < stunChance;
        if (stunApplied) {
          const stunDuration = damageEntryConfig.stunDuration ?? 1;
          await mockEntityManager.addComponent(entityId, 'anatomy:stunned', {
            remainingTurns: stunDuration,
            sourcePartId: partId,
          });
        }
        dispatchStrategy.dispatch('anatomy:fractured', {
          entityId,
          partId,
          damageTypeId,
          stunApplied,
          timestamp: Date.now(),
        }, sessionContext);
        dispatchStrategy.recordEffect(partId, 'fractured', sessionContext);
        return { triggered: true, stunApplied };
      }),
    },
    bleedApplicator: {
      apply: jest.fn(async ({ damageEntryConfig, dispatchStrategy, sessionContext, entityId, partId }) => {
        const severity = damageEntryConfig?.severity ?? 'minor';
        const baseDuration = damageEntryConfig?.baseDurationTurns ?? 2;
        const severityMap = { minor: { tickDamage: 1 }, moderate: { tickDamage: 3 }, severe: { tickDamage: 5 } };
        const tickDamage = severityMap[severity]?.tickDamage ?? 1;
        await mockEntityManager.addComponent(partId, 'anatomy:bleeding', {
          severity,
          remainingTurns: baseDuration,
          tickDamage,
        });
        dispatchStrategy.dispatch('anatomy:bleeding_started', {
          entityId,
          partId,
          severity,
          timestamp: Date.now(),
        }, sessionContext);
        dispatchStrategy.recordEffect(partId, 'bleeding', sessionContext);
        return { applied: true };
      }),
    },
    burnApplicator: {
      apply: jest.fn(async ({ damageEntryConfig, dispatchStrategy, sessionContext, entityId, partId }) => {
        const dps = damageEntryConfig?.dps ?? 1;
        const durationTurns = damageEntryConfig?.durationTurns ?? 2;
        const canStack = damageEntryConfig?.canStack ?? false;
        const existingBurn = mockEntityManager.hasComponent(partId, 'anatomy:burning')
          ? mockEntityManager.getComponentData(partId, 'anatomy:burning')
          : null;
        let stackedCount = 1;
        let tickDamage = dps;
        let stacked = false;
        if (existingBurn && canStack) {
          tickDamage = existingBurn.tickDamage + dps;
          stackedCount = (existingBurn.stackedCount ?? 1) + 1;
          stacked = true;
        } else if (existingBurn) {
          tickDamage = existingBurn.tickDamage;
          stackedCount = existingBurn.stackedCount ?? 1;
        }
        await mockEntityManager.addComponent(partId, 'anatomy:burning', {
          remainingTurns: durationTurns,
          tickDamage,
          stackedCount,
        });
        dispatchStrategy.dispatch('anatomy:burning_started', {
          entityId,
          partId,
          stackedCount,
          timestamp: Date.now(),
        }, sessionContext);
        dispatchStrategy.recordEffect(partId, 'burning', sessionContext);
        return { applied: true, stacked, stackedCount };
      }),
    },
    poisonApplicator: {
      apply: jest.fn(async ({ damageEntryConfig, dispatchStrategy, sessionContext, entityId, partId }) => {
        const tickDamage = damageEntryConfig?.tick ?? 1;
        const durationTurns = damageEntryConfig?.durationTurns ?? 3;
        const scope = damageEntryConfig?.scope ?? 'part';
        const targetId = scope === 'entity' ? entityId : partId;
        await mockEntityManager.addComponent(targetId, 'anatomy:poisoned', {
          remainingTurns: durationTurns,
          tickDamage,
        });
        dispatchStrategy.dispatch('anatomy:poisoned_started', {
          entityId,
          partId: scope === 'part' ? partId : undefined,
          scope,
          timestamp: Date.now(),
        }, sessionContext);
        dispatchStrategy.recordEffect(partId, 'poisoned', sessionContext);
        return { applied: true, scope, targetId };
      }),
    },
  };
}

describe('DamageTypeEffectsService', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockDispatcher;
  let mockRngProvider;
  let mockApplicators;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEntityManager = {
      getComponentData: jest.fn(),
      addComponent: jest.fn().mockResolvedValue(undefined),
      hasComponent: jest.fn().mockReturnValue(false),
    };

    mockDispatcher = {
      dispatch: jest.fn(),
    };

    mockRngProvider = jest.fn().mockReturnValue(0.5);

    mockApplicators = createMockApplicators(mockEntityManager, mockDispatcher);

    service = new DamageTypeEffectsService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockDispatcher,
      rngProvider: mockRngProvider,
      effectDefinitionResolver: mockApplicators.effectDefinitionResolver,
      dismembermentApplicator: mockApplicators.dismembermentApplicator,
      fractureApplicator: mockApplicators.fractureApplicator,
      bleedApplicator: mockApplicators.bleedApplicator,
      burnApplicator: mockApplicators.burnApplicator,
      poisonApplicator: mockApplicators.poisonApplicator,
    });
  });

  describe('constructor', () => {
    it('should initialize with all dependencies', () => {
      expect(service).toBeDefined();
    });

    it('should throw if logger is missing', () => {
      expect(
        () =>
          new DamageTypeEffectsService({
            entityManager: mockEntityManager,
            safeEventDispatcher: mockDispatcher,
            effectDefinitionResolver: mockApplicators.effectDefinitionResolver,
            dismembermentApplicator: mockApplicators.dismembermentApplicator,
            fractureApplicator: mockApplicators.fractureApplicator,
            bleedApplicator: mockApplicators.bleedApplicator,
            burnApplicator: mockApplicators.burnApplicator,
            poisonApplicator: mockApplicators.poisonApplicator,
          })
      ).toThrow();
    });

    it('should throw if entityManager is missing', () => {
      expect(
        () =>
          new DamageTypeEffectsService({
            logger: mockLogger,
            safeEventDispatcher: mockDispatcher,
            effectDefinitionResolver: mockApplicators.effectDefinitionResolver,
            dismembermentApplicator: mockApplicators.dismembermentApplicator,
            fractureApplicator: mockApplicators.fractureApplicator,
            bleedApplicator: mockApplicators.bleedApplicator,
            burnApplicator: mockApplicators.burnApplicator,
            poisonApplicator: mockApplicators.poisonApplicator,
          })
      ).toThrow();
    });

    it('should throw if safeEventDispatcher is missing', () => {
      expect(
        () =>
          new DamageTypeEffectsService({
            logger: mockLogger,
            entityManager: mockEntityManager,
            effectDefinitionResolver: mockApplicators.effectDefinitionResolver,
            dismembermentApplicator: mockApplicators.dismembermentApplicator,
            fractureApplicator: mockApplicators.fractureApplicator,
            bleedApplicator: mockApplicators.bleedApplicator,
            burnApplicator: mockApplicators.burnApplicator,
            poisonApplicator: mockApplicators.poisonApplicator,
          })
      ).toThrow();
    });

    it('should throw if entityManager missing required methods', () => {
      const invalidEntityManager = { getComponentData: jest.fn() };
      expect(
        () =>
          new DamageTypeEffectsService({
            logger: mockLogger,
            entityManager: invalidEntityManager,
            safeEventDispatcher: mockDispatcher,
            effectDefinitionResolver: mockApplicators.effectDefinitionResolver,
            dismembermentApplicator: mockApplicators.dismembermentApplicator,
            fractureApplicator: mockApplicators.fractureApplicator,
            bleedApplicator: mockApplicators.bleedApplicator,
            burnApplicator: mockApplicators.burnApplicator,
            poisonApplicator: mockApplicators.poisonApplicator,
          })
      ).toThrow();
    });

    it('should use Math.random as default rngProvider', () => {
      const serviceWithDefaultRng = new DamageTypeEffectsService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        safeEventDispatcher: mockDispatcher,
        effectDefinitionResolver: mockApplicators.effectDefinitionResolver,
        dismembermentApplicator: mockApplicators.dismembermentApplicator,
        fractureApplicator: mockApplicators.fractureApplicator,
        bleedApplicator: mockApplicators.bleedApplicator,
        burnApplicator: mockApplicators.burnApplicator,
        poisonApplicator: mockApplicators.poisonApplicator,
      });
      expect(serviceWithDefaultRng).toBeDefined();
    });
  });

  describe('applyEffectsForDamage', () => {
    // Base params with a minimal damageEntry
    const baseParams = {
      entityId: 'entity:player',
      partId: 'part:arm',
      damageEntry: {
        name: 'slashing',
        amount: 30,
      },
      maxHealth: 100,
      currentHealth: 70,
    };

    it('should skip effects when damageEntry is null', async () => {
      await service.applyEffectsForDamage({
        ...baseParams,
        damageEntry: null,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No damage entry provided'),
        expect.any(Object)
      );
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should skip effects when damageEntry is undefined', async () => {
      await service.applyEffectsForDamage({
        ...baseParams,
        damageEntry: undefined,
      });

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('No damage entry provided'),
        expect.any(Object)
      );
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should skip effects when damageEntry has no effect configurations', async () => {
      await service.applyEffectsForDamage({
        ...baseParams,
        damageEntry: { name: 'slashing', amount: 30 },
      });

      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    describe('dismemberment', () => {
      it('should trigger dismemberment when damage exceeds threshold', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'slashing',
            amount: 85, // >= 80% of 100 maxHealth
            dismember: { enabled: true, thresholdFraction: 0.8 },
          },
        });

        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          'anatomy:dismembered',
          expect.objectContaining({
            entityId: 'entity:player',
            partId: 'part:arm',
            damageTypeId: 'slashing',
          })
        );
      });

      it('should not trigger dismemberment when damage below threshold', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'slashing',
            amount: 70, // < 80% of 100 maxHealth
            dismember: { enabled: true, thresholdFraction: 0.8 },
          },
        });

        expect(mockDispatcher.dispatch).not.toHaveBeenCalledWith(
          'anatomy:dismembered',
          expect.anything()
        );
      });

      it('should continue to apply other effects when dismemberment triggers', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'slashing',
            amount: 85,
            dismember: { enabled: true, thresholdFraction: 0.8 },
            bleed: { enabled: true, severity: 'moderate' },
          },
        });

        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          'anatomy:dismembered',
          expect.anything()
        );
        // Verify we DO proceed to bleed
        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          'anatomy:bleeding_started',
          expect.anything()
        );
      });

      it('should not trigger dismemberment when disabled', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'slashing',
            amount: 95,
            dismember: { enabled: false },
          },
        });

        expect(mockDispatcher.dispatch).not.toHaveBeenCalledWith(
          'anatomy:dismembered',
          expect.anything()
        );
      });

      it('should use default threshold fraction of 0.8', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'slashing',
            amount: 80, // Exactly 80%
            dismember: { enabled: true }, // No thresholdFraction specified
          },
        });

        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          'anatomy:dismembered',
          expect.anything()
        );
      });

      it('should NOT trigger dismemberment when part has anatomy:embedded component', async () => {
        mockEntityManager.hasComponent.mockImplementation(
          (partId, componentId) => {
            return componentId === 'anatomy:embedded';
          }
        );

        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'slashing',
            amount: 95, // Above threshold
            dismember: { enabled: true, thresholdFraction: 0.8 },
          },
        });

        expect(mockEntityManager.hasComponent).toHaveBeenCalledWith(
          'part:arm',
          'anatomy:embedded'
        );
        expect(mockDispatcher.dispatch).not.toHaveBeenCalledWith(
          'anatomy:dismembered',
          expect.anything()
        );
        expect(mockEntityManager.addComponent).not.toHaveBeenCalledWith(
          'part:arm',
          'anatomy:dismembered',
          expect.anything()
        );
      });

      it('should still apply other effects (bleed) to embedded parts that cannot be dismembered', async () => {
        mockEntityManager.hasComponent.mockImplementation(
          (partId, componentId) => {
            return componentId === 'anatomy:embedded';
          }
        );

        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'slashing',
            amount: 95, // Above dismemberment threshold
            dismember: { enabled: true, thresholdFraction: 0.8 },
            bleed: { enabled: true, severity: 'moderate' },
          },
        });

        // Dismemberment should NOT occur due to embedded component
        expect(mockDispatcher.dispatch).not.toHaveBeenCalledWith(
          'anatomy:dismembered',
          expect.anything()
        );

        // But bleeding SHOULD still be applied
        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          'anatomy:bleeding_started',
          expect.anything()
        );
      });
    });

    describe('fracture', () => {
      it('should apply fracture when damage exceeds threshold', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'blunt',
            amount: 55, // >= 50% of 100 maxHealth
            fracture: { enabled: true, thresholdFraction: 0.5 },
          },
        });

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part:arm',
          'anatomy:fractured',
          expect.objectContaining({
            sourceDamageType: 'blunt',
            appliedAtHealth: 70,
          })
        );
        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          'anatomy:fractured',
          expect.objectContaining({
            entityId: 'entity:player',
            partId: 'part:arm',
            damageTypeId: 'blunt',
          })
        );
      });

      it('should apply stun when fracture triggers and RNG passes', async () => {
        mockRngProvider.mockReturnValue(0.3); // Below stunChance

        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'blunt',
            amount: 55,
            fracture: {
              enabled: true,
              thresholdFraction: 0.5,
              stunChance: 0.5,
            },
          },
        });

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'entity:player',
          'anatomy:stunned',
          expect.objectContaining({
            remainingTurns: 1,
            sourcePartId: 'part:arm',
          })
        );
        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          'anatomy:fractured',
          expect.objectContaining({ stunApplied: true })
        );
      });

      it('should not apply stun when RNG fails', async () => {
        mockRngProvider.mockReturnValue(0.8); // Above stunChance

        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'blunt',
            amount: 55,
            fracture: {
              enabled: true,
              thresholdFraction: 0.5,
              stunChance: 0.5,
            },
          },
        });

        expect(mockEntityManager.addComponent).not.toHaveBeenCalledWith(
          'entity:player',
          'anatomy:stunned',
          expect.anything()
        );
        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          'anatomy:fractured',
          expect.objectContaining({ stunApplied: false })
        );
      });

      it('should prefer per-call rng override when provided', async () => {
        mockRngProvider.mockReturnValue(0.9); // Would fail stun
        const overrideRng = jest.fn().mockReturnValue(0.1);

        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'blunt',
            amount: 55,
            fracture: {
              enabled: true,
              thresholdFraction: 0.5,
              stunChance: 0.5,
            },
          },
          rng: overrideRng,
        });

        expect(overrideRng).toHaveBeenCalled();
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'entity:player',
          'anatomy:stunned',
          expect.objectContaining({ sourcePartId: 'part:arm' })
        );
      });

      it('should not apply fracture when damage below threshold', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'blunt',
            amount: 40, // < 50%
            fracture: { enabled: true, thresholdFraction: 0.5 },
          },
        });

        expect(mockEntityManager.addComponent).not.toHaveBeenCalledWith(
          'part:arm',
          'anatomy:fractured',
          expect.anything()
        );
      });

      it('should use default threshold fraction of 0.5', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'blunt',
            amount: 50, // Exactly 50%
            fracture: { enabled: true }, // No thresholdFraction
          },
        });

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part:arm',
          'anatomy:fractured',
          expect.anything()
        );
      });
    });

    describe('bleed', () => {
      it('should apply bleeding with correct severity', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'slashing',
            amount: 30,
            bleed: {
              enabled: true,
              severity: 'moderate',
              baseDurationTurns: 3,
            },
          },
        });

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part:arm',
          'anatomy:bleeding',
          expect.objectContaining({
            severity: 'moderate',
            remainingTurns: 3,
            tickDamage: 3, // Moderate = 3 tick damage
          })
        );
        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          'anatomy:bleeding_started',
          expect.objectContaining({
            entityId: 'entity:player',
            partId: 'part:arm',
            severity: 'moderate',
          })
        );
      });

      it('should use minor severity by default', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'slashing',
            amount: 30,
            bleed: { enabled: true }, // No severity specified
          },
        });

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part:arm',
          'anatomy:bleeding',
          expect.objectContaining({
            severity: 'minor',
            tickDamage: 1,
          })
        );
      });

      it('should use default duration of 2 turns', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'slashing',
            amount: 30,
            bleed: { enabled: true, severity: 'minor' },
          },
        });

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part:arm',
          'anatomy:bleeding',
          expect.objectContaining({ remainingTurns: 2 })
        );
      });

      it('should not apply bleed when part is destroyed', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          currentHealth: 0, // Part destroyed
          damageEntry: {
            name: 'slashing',
            amount: 30,
            bleed: { enabled: true },
          },
        });

        expect(mockEntityManager.addComponent).not.toHaveBeenCalledWith(
          'part:arm',
          'anatomy:bleeding',
          expect.anything()
        );
      });

      it('should map severe severity to correct tick damage', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'slashing',
            amount: 30,
            bleed: { enabled: true, severity: 'severe' },
          },
        });

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part:arm',
          'anatomy:bleeding',
          expect.objectContaining({ tickDamage: 5 })
        );
      });
    });

    describe('burn', () => {
      it('should apply burning effect', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'fire',
            amount: 30,
            burn: { enabled: true, dps: 5, durationTurns: 4 },
          },
        });

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part:arm',
          'anatomy:burning',
          expect.objectContaining({
            remainingTurns: 4,
            tickDamage: 5,
            stackedCount: 1,
          })
        );
        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          'anatomy:burning_started',
          expect.objectContaining({
            entityId: 'entity:player',
            partId: 'part:arm',
            stackedCount: 1,
          })
        );
      });

      it('should stack burn damage when canStack is true', async () => {
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockReturnValue({
          tickDamage: 5,
          stackedCount: 2,
        });

        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'fire',
            amount: 30,
            burn: { enabled: true, dps: 3, durationTurns: 2, canStack: true },
          },
        });

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part:arm',
          'anatomy:burning',
          expect.objectContaining({
            tickDamage: 8, // 5 + 3
            stackedCount: 3, // 2 + 1
          })
        );
      });

      it('should refresh duration without stacking when canStack is false', async () => {
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockReturnValue({
          tickDamage: 5,
          stackedCount: 2,
        });

        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'fire',
            amount: 30,
            burn: { enabled: true, dps: 3, durationTurns: 4, canStack: false },
          },
        });

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part:arm',
          'anatomy:burning',
          expect.objectContaining({
            remainingTurns: 4,
            tickDamage: 5, // Keeps existing damage
            stackedCount: 2, // Keeps existing count
          })
        );
      });

      it('should use default values when not specified', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'fire',
            amount: 30,
            burn: { enabled: true },
          },
        });

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part:arm',
          'anatomy:burning',
          expect.objectContaining({
            remainingTurns: 2,
            tickDamage: 1,
          })
        );
      });

      it('should not apply burn when part is destroyed', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          currentHealth: 0,
          damageEntry: {
            name: 'fire',
            amount: 30,
            burn: { enabled: true },
          },
        });

        expect(mockEntityManager.addComponent).not.toHaveBeenCalledWith(
          'part:arm',
          'anatomy:burning',
          expect.anything()
        );
      });
    });

    describe('poison', () => {
      it('should apply poison to part by default', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'venom',
            amount: 30,
            poison: { enabled: true, tick: 2, durationTurns: 5 },
          },
        });

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part:arm', // Scope is 'part' by default
          'anatomy:poisoned',
          expect.objectContaining({
            remainingTurns: 5,
            tickDamage: 2,
          })
        );
        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          'anatomy:poisoned_started',
          expect.objectContaining({
            entityId: 'entity:player',
            partId: 'part:arm',
            scope: 'part',
          })
        );
      });

      it('should apply poison to entity when scope is entity', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'venom',
            amount: 30,
            poison: {
              enabled: true,
              tick: 2,
              durationTurns: 5,
              scope: 'entity',
            },
          },
        });

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'entity:player', // Scope is entity
          'anatomy:poisoned',
          expect.anything()
        );
        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          'anatomy:poisoned_started',
          expect.objectContaining({
            scope: 'entity',
            partId: undefined, // No partId when scope is entity
          })
        );
      });

      it('should use default values when not specified', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'venom',
            amount: 30,
            poison: { enabled: true },
          },
        });

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part:arm',
          'anatomy:poisoned',
          expect.objectContaining({
            remainingTurns: 3,
            tickDamage: 1,
          })
        );
      });

      it('should not apply poison when part is destroyed', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          currentHealth: 0,
          damageEntry: {
            name: 'venom',
            amount: 30,
            poison: { enabled: true },
          },
        });

        expect(mockEntityManager.addComponent).not.toHaveBeenCalledWith(
          expect.anything(),
          'anatomy:poisoned',
          expect.anything()
        );
      });
    });

    describe('effect processing order', () => {
      it('should process effects in correct order: dismember, fracture, bleed, burn, poison', async () => {
        const callOrder = [];
        mockDispatcher.dispatch.mockImplementation((event) => {
          callOrder.push(event);
        });

        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'mixed',
            amount: 30,
            dismember: { enabled: true, thresholdFraction: 0.95 }, // Won't trigger
            fracture: { enabled: true, thresholdFraction: 0.2 },
            bleed: { enabled: true },
            burn: { enabled: true },
            poison: { enabled: true },
          },
        });

        expect(callOrder).toEqual([
          'anatomy:fractured',
          'anatomy:bleeding_started',
          'anatomy:burning_started',
          'anatomy:poisoned_started',
        ]);
      });

    });

    describe('damageSession integration', () => {
      const createMockDamageSession = (partId) => ({
        entries: [
          {
            partId,
            effectsTriggered: [],
          },
        ],
        pendingEvents: [],
      });

      it('should queue dismembered event to session instead of dispatching immediately', async () => {
        const damageSession = createMockDamageSession('part:arm');

        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'slashing',
            amount: 85,
            dismember: { enabled: true, thresholdFraction: 0.8 },
          },
          damageSession,
        });

        // Should NOT dispatch directly
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();

        // Should queue event to session
        expect(damageSession.pendingEvents).toHaveLength(1);
        expect(damageSession.pendingEvents[0].eventType).toBe(
          'anatomy:dismembered'
        );
        expect(damageSession.pendingEvents[0].payload).toMatchObject({
          entityId: 'entity:player',
          partId: 'part:arm',
          damageTypeId: 'slashing',
        });

        // Should record effect in entry
        expect(damageSession.entries[0].effectsTriggered).toContain(
          'dismembered'
        );
      });

      it('should queue fractured event to session instead of dispatching immediately', async () => {
        const damageSession = createMockDamageSession('part:arm');

        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'blunt',
            amount: 55,
            fracture: { enabled: true, thresholdFraction: 0.5 },
          },
          damageSession,
        });

        // Should NOT dispatch directly
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();

        // Should queue event to session
        expect(damageSession.pendingEvents).toHaveLength(1);
        expect(damageSession.pendingEvents[0].eventType).toBe(
          'anatomy:fractured'
        );
        expect(damageSession.pendingEvents[0].payload).toMatchObject({
          entityId: 'entity:player',
          partId: 'part:arm',
          damageTypeId: 'blunt',
        });

        // Should record effect in entry
        expect(damageSession.entries[0].effectsTriggered).toContain('fractured');
      });

      it('should queue bleeding_started event to session instead of dispatching immediately', async () => {
        const damageSession = createMockDamageSession('part:arm');

        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'slashing',
            amount: 30,
            bleed: { enabled: true, severity: 'moderate' },
          },
          damageSession,
        });

        // Should NOT dispatch directly
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();

        // Should queue event to session
        expect(damageSession.pendingEvents).toHaveLength(1);
        expect(damageSession.pendingEvents[0].eventType).toBe(
          'anatomy:bleeding_started'
        );
        expect(damageSession.pendingEvents[0].payload).toMatchObject({
          entityId: 'entity:player',
          partId: 'part:arm',
          severity: 'moderate',
        });

        // Should record effect in entry
        expect(damageSession.entries[0].effectsTriggered).toContain('bleeding');
      });

      it('should queue burning_started event to session instead of dispatching immediately', async () => {
        const damageSession = createMockDamageSession('part:arm');

        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'fire',
            amount: 30,
            burn: { enabled: true, dps: 5, durationTurns: 4 },
          },
          damageSession,
        });

        // Should NOT dispatch directly
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();

        // Should queue event to session
        expect(damageSession.pendingEvents).toHaveLength(1);
        expect(damageSession.pendingEvents[0].eventType).toBe(
          'anatomy:burning_started'
        );
        expect(damageSession.pendingEvents[0].payload).toMatchObject({
          entityId: 'entity:player',
          partId: 'part:arm',
          stackedCount: 1,
        });

        // Should record effect in entry
        expect(damageSession.entries[0].effectsTriggered).toContain('burning');
      });

      it('should queue poisoned_started event to session instead of dispatching immediately', async () => {
        const damageSession = createMockDamageSession('part:arm');

        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'venom',
            amount: 30,
            poison: { enabled: true, tick: 2, durationTurns: 5 },
          },
          damageSession,
        });

        // Should NOT dispatch directly
        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();

        // Should queue event to session
        expect(damageSession.pendingEvents).toHaveLength(1);
        expect(damageSession.pendingEvents[0].eventType).toBe(
          'anatomy:poisoned_started'
        );
        expect(damageSession.pendingEvents[0].payload).toMatchObject({
          entityId: 'entity:player',
          scope: 'part',
        });

        // Should record effect in entry
        expect(damageSession.entries[0].effectsTriggered).toContain('poisoned');
      });

      it('should handle session with entry not found gracefully for dismemberment', async () => {
        // Session with different partId (entry not found scenario)
        const damageSession = {
          entries: [{ partId: 'part:other', effectsTriggered: [] }],
          pendingEvents: [],
        };

        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'slashing',
            amount: 85,
            dismember: { enabled: true, thresholdFraction: 0.8 },
          },
          damageSession,
        });

        // Should still queue the event
        expect(damageSession.pendingEvents).toHaveLength(1);
        expect(damageSession.pendingEvents[0].eventType).toBe(
          'anatomy:dismembered'
        );
      });

      it('should initialize effectsTriggered array when not present (fracture)', async () => {
        const damageSession = {
          entries: [{ partId: 'part:arm' }], // No effectsTriggered array
          pendingEvents: [],
        };

        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'blunt',
            amount: 55,
            fracture: { enabled: true, thresholdFraction: 0.5 },
          },
          damageSession,
        });

        // Should create effectsTriggered and add 'fractured'
        expect(damageSession.entries[0].effectsTriggered).toEqual(['fractured']);
        expect(damageSession.pendingEvents).toHaveLength(1);
      });

      it('should handle session with entry not found gracefully for fracture', async () => {
        const damageSession = {
          entries: [{ partId: 'part:other', effectsTriggered: [] }],
          pendingEvents: [],
        };

        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'blunt',
            amount: 55,
            fracture: { enabled: true, thresholdFraction: 0.5 },
          },
          damageSession,
        });

        // Should still queue the event even though entry not found
        expect(damageSession.pendingEvents).toHaveLength(1);
        expect(damageSession.pendingEvents[0].eventType).toBe('anatomy:fractured');
        // Entry for 'part:other' should remain unchanged
        expect(damageSession.entries[0].effectsTriggered).toEqual([]);
      });

      it('should initialize effectsTriggered array when not present (bleed)', async () => {
        const damageSession = {
          entries: [{ partId: 'part:arm' }], // No effectsTriggered array
          pendingEvents: [],
        };

        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'slashing',
            amount: 30,
            bleed: { enabled: true, severity: 'minor' },
          },
          damageSession,
        });

        // Should create effectsTriggered and add 'bleeding'
        expect(damageSession.entries[0].effectsTriggered).toEqual(['bleeding']);
        expect(damageSession.pendingEvents).toHaveLength(1);
      });

      it('should handle session with entry not found gracefully for bleed', async () => {
        const damageSession = {
          entries: [{ partId: 'part:other', effectsTriggered: [] }],
          pendingEvents: [],
        };

        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'slashing',
            amount: 30,
            bleed: { enabled: true, severity: 'minor' },
          },
          damageSession,
        });

        // Should still queue the event even though entry not found
        expect(damageSession.pendingEvents).toHaveLength(1);
        expect(damageSession.pendingEvents[0].eventType).toBe('anatomy:bleeding_started');
        // Entry for 'part:other' should remain unchanged
        expect(damageSession.entries[0].effectsTriggered).toEqual([]);
      });

      it('should initialize effectsTriggered array when not present (burn)', async () => {
        const damageSession = {
          entries: [{ partId: 'part:arm' }], // No effectsTriggered array
          pendingEvents: [],
        };

        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'fire',
            amount: 30,
            burn: { enabled: true, dps: 5, durationTurns: 4 },
          },
          damageSession,
        });

        // Should create effectsTriggered and add 'burning'
        expect(damageSession.entries[0].effectsTriggered).toEqual(['burning']);
        expect(damageSession.pendingEvents).toHaveLength(1);
      });

      it('should handle session with entry not found gracefully for burn', async () => {
        const damageSession = {
          entries: [{ partId: 'part:other', effectsTriggered: [] }],
          pendingEvents: [],
        };

        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'fire',
            amount: 30,
            burn: { enabled: true, dps: 5, durationTurns: 4 },
          },
          damageSession,
        });

        // Should still queue the event even though entry not found
        expect(damageSession.pendingEvents).toHaveLength(1);
        expect(damageSession.pendingEvents[0].eventType).toBe('anatomy:burning_started');
        // Entry for 'part:other' should remain unchanged
        expect(damageSession.entries[0].effectsTriggered).toEqual([]);
      });

      it('should initialize effectsTriggered array when not present (poison)', async () => {
        const damageSession = {
          entries: [{ partId: 'part:arm' }], // No effectsTriggered array
          pendingEvents: [],
        };

        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'venom',
            amount: 30,
            poison: { enabled: true, tick: 2, durationTurns: 5 },
          },
          damageSession,
        });

        // Should create effectsTriggered and add 'poisoned'
        expect(damageSession.entries[0].effectsTriggered).toEqual(['poisoned']);
        expect(damageSession.pendingEvents).toHaveLength(1);
      });

      it('should handle session with entry not found gracefully for poison', async () => {
        const damageSession = {
          entries: [{ partId: 'part:other', effectsTriggered: [] }],
          pendingEvents: [],
        };

        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'venom',
            amount: 30,
            poison: { enabled: true, tick: 2, durationTurns: 5 },
          },
          damageSession,
        });

        // Should still queue the event even though entry not found
        expect(damageSession.pendingEvents).toHaveLength(1);
        expect(damageSession.pendingEvents[0].eventType).toBe('anatomy:poisoned_started');
        // Entry for 'part:other' should remain unchanged
        expect(damageSession.entries[0].effectsTriggered).toEqual([]);
      });
    });

    describe('edge cases', () => {
      it('should handle damageEntry with no effects configured', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'psychic',
            amount: 30,
            // No effects defined
          },
        });

        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
      });

      it('should handle all effects disabled', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'mixed',
            amount: 30,
            dismember: { enabled: false },
            fracture: { enabled: false },
            bleed: { enabled: false },
            burn: { enabled: false },
            poison: { enabled: false },
          },
        });

        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
      });

      it('should handle zero damage amount', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'slashing',
            amount: 0,
            bleed: { enabled: true },
          },
        });

        // Should still apply bleed even with 0 damage
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part:arm',
          'anatomy:bleeding',
          expect.anything()
        );
      });

      it('should handle unknown severity in bleed config gracefully', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'slashing',
            amount: 30,
            bleed: { enabled: true, severity: 'unknown_severity' },
          },
        });

        // Should fallback to minor
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part:arm',
          'anatomy:bleeding',
          expect.objectContaining({ tickDamage: 1 })
        );
      });

      it('should handle missing amount in damageEntry', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'slashing',
            // amount is missing
            bleed: { enabled: true },
          },
        });

        // Should default amount to 0 and still apply bleed
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part:arm',
          'anatomy:bleeding',
          expect.anything()
        );
      });

      it('should use damageEntry.penetration when provided', async () => {
        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'slashing',
            amount: 30,
            penetration: 0.5,
            bleed: { enabled: true },
          },
        });

        // Penetration is stored in damageEntry but currently only used by ApplyDamageHandler
        // The service still processes effects correctly
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part:arm',
          'anatomy:bleeding',
          expect.anything()
        );
      });

      it('should handle existing burn without stackedCount when stacking', async () => {
        // Existing burn component WITHOUT stackedCount property
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockReturnValue({
          tickDamage: 5,
          remainingTurns: 2,
          // NO stackedCount property - should fallback to baseStackCount
        });

        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'fire',
            amount: 30,
            burn: { enabled: true, dps: 3, durationTurns: 4, canStack: true },
          },
        });

        // Should use baseStackCount (1) as fallback: (1) + 1 = 2
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part:arm',
          'anatomy:burning',
          expect.objectContaining({
            tickDamage: 8, // 5 + 3
            stackedCount: 2, // (baseStackCount=1) + 1
          })
        );
      });

      it('should handle existing burn without stackedCount when not stacking', async () => {
        // Existing burn component WITHOUT stackedCount property
        mockEntityManager.hasComponent.mockReturnValue(true);
        mockEntityManager.getComponentData.mockReturnValue({
          tickDamage: 5,
          remainingTurns: 2,
          // NO stackedCount property - should fallback to baseStackCount
        });

        await service.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'fire',
            amount: 30,
            burn: { enabled: true, dps: 3, durationTurns: 4, canStack: false },
          },
        });

        // Should use baseStackCount (1) as fallback, keep existing damage
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part:arm',
          'anatomy:burning',
          expect.objectContaining({
            tickDamage: 5, // Keeps existing damage
            stackedCount: 1, // baseStackCount fallback
          })
        );
      });
    });
  });

  describe('execution context tracing', () => {
    it('should add trace entries when executionContext has trace array', async () => {
      const executionContext = {
        trace: [],
      };

      await service.applyEffectsForDamage({
        entityId: 'entity:test',
        partId: 'part:arm',
        partName: 'Arm',
        damageEntry: {
          name: 'SLASH',
          bleed: { enabled: true },
        },
        executionContext,
      });

      expect(executionContext.trace.length).toBeGreaterThan(0);
      expect(executionContext.trace[0]).toMatchObject({
        phase: expect.any(String),
        message: expect.any(String),
        context: expect.objectContaining({
          entityId: 'entity:test',
          partId: 'part:arm',
          service: 'DamageTypeEffectsService',
        }),
      });
    });
  });
});
