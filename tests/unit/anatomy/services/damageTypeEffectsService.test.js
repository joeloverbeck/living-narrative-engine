import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import DamageTypeEffectsService from '../../../../src/anatomy/services/damageTypeEffectsService.js';

describe('DamageTypeEffectsService', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockDispatcher;
  let mockRngProvider;

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

    service = new DamageTypeEffectsService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      safeEventDispatcher: mockDispatcher,
      rngProvider: mockRngProvider,
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
          })
      ).toThrow();
    });

    it('should throw if entityManager is missing', () => {
      expect(
        () =>
          new DamageTypeEffectsService({
            logger: mockLogger,
            safeEventDispatcher: mockDispatcher,
          })
      ).toThrow();
    });

    it('should throw if safeEventDispatcher is missing', () => {
      expect(
        () =>
          new DamageTypeEffectsService({
            logger: mockLogger,
            entityManager: mockEntityManager,
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
          })
      ).toThrow();
    });

    it('should use Math.random as default rngProvider', () => {
      const serviceWithDefaultRng = new DamageTypeEffectsService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        safeEventDispatcher: mockDispatcher,
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

      it('should honor registry-defined apply order when provided', async () => {
        mockDispatcher.dispatch.mockClear();
        const statusEffectRegistry = {
          getAll: jest.fn().mockReturnValue([
            {
              id: 'dismembered',
              effectType: 'dismember',
              componentId: 'anatomy:dismembered',
              startedEventId: 'anatomy:dismembered',
              defaults: { thresholdFraction: 0.8 },
            },
            {
              id: 'fractured',
              effectType: 'fracture',
              componentId: 'anatomy:fractured',
              startedEventId: 'anatomy:fractured',
              defaults: { thresholdFraction: 0.5 },
            },
            {
              id: 'poisoned',
              effectType: 'poison',
              componentId: 'anatomy:poisoned',
              startedEventId: 'anatomy:poisoned_started',
              defaults: { durationTurns: 3, tickDamage: 1, scope: 'part' },
            },
            {
              id: 'burning',
              effectType: 'burn',
              componentId: 'anatomy:burning',
              startedEventId: 'anatomy:burning_started',
              defaults: {
                durationTurns: 2,
                tickDamage: 1,
                stacking: { canStack: false, defaultStacks: 1 },
              },
            },
            {
              id: 'bleeding',
              effectType: 'bleed',
              componentId: 'anatomy:bleeding',
              startedEventId: 'anatomy:bleeding_started',
              defaults: {
                baseDurationTurns: 2,
                severity: { minor: { tickDamage: 1 } },
              },
            },
          ]),
          getApplyOrder: jest
            .fn()
            .mockReturnValue(['poisoned', 'burning', 'bleeding']),
        };

        const orderedService = new DamageTypeEffectsService({
          logger: mockLogger,
          entityManager: mockEntityManager,
          safeEventDispatcher: mockDispatcher,
          statusEffectRegistry,
          rngProvider: mockRngProvider,
        });

        const callOrder = [];
        mockDispatcher.dispatch.mockImplementation((event) => {
          callOrder.push(event);
        });

        await orderedService.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'mixed',
            amount: 30,
            bleed: { enabled: true },
            burn: { enabled: true },
            poison: { enabled: true },
          },
        });

        expect(callOrder).toEqual([
          'anatomy:poisoned_started',
          'anatomy:burning_started',
          'anatomy:bleeding_started',
        ]);
      });
    });

    it('should use registry defaults for component IDs and durations', async () => {
      mockEntityManager.addComponent.mockClear();
      mockDispatcher.dispatch.mockClear();

      const statusEffectRegistry = {
        getAll: jest.fn().mockReturnValue([
          {
            id: 'dismembered',
            effectType: 'dismember',
            componentId: 'anatomy:dismembered',
            startedEventId: 'anatomy:dismembered',
            defaults: { thresholdFraction: 0.8 },
          },
          {
            id: 'fractured',
            effectType: 'fracture',
            componentId: 'anatomy:fractured',
            startedEventId: 'anatomy:fractured',
            defaults: { thresholdFraction: 0.5 },
          },
          {
            id: 'bleeding',
            effectType: 'bleed',
            componentId: 'anatomy:bleeding',
            startedEventId: 'anatomy:bleeding_started',
            defaults: { baseDurationTurns: 2, severity: { minor: { tickDamage: 1 } } },
          },
          {
            id: 'burning',
            effectType: 'burn',
            componentId: 'custom:burning',
            startedEventId: 'custom:burning_started',
            defaults: {
              tickDamage: 7,
              durationTurns: 5,
              stacking: { canStack: false, defaultStacks: 2 },
            },
          },
          {
            id: 'poisoned',
            effectType: 'poison',
            componentId: 'anatomy:poisoned',
            startedEventId: 'anatomy:poisoned_started',
            defaults: { durationTurns: 3, tickDamage: 1, scope: 'part' },
          },
        ]),
        getApplyOrder: jest.fn().mockReturnValue(['burning']),
      };

      const serviceWithRegistry = new DamageTypeEffectsService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        safeEventDispatcher: mockDispatcher,
        statusEffectRegistry,
        rngProvider: mockRngProvider,
      });

      await serviceWithRegistry.applyEffectsForDamage({
        ...baseParams,
        damageEntry: {
          name: 'fire',
          amount: 30,
          burn: { enabled: true },
        },
      });

      expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
        'part:arm',
        'custom:burning',
        expect.objectContaining({
          remainingTurns: 5,
          tickDamage: 7,
          stackedCount: 2,
        })
      );
      expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
        'custom:burning_started',
        expect.objectContaining({
          entityId: 'entity:player',
          partId: 'part:arm',
        })
      );
    });

    describe('registry signaling', () => {
      it('warns and falls back when registry is empty', async () => {
        const emptyRegistry = {
          getAll: jest.fn().mockReturnValue([]),
          getApplyOrder: jest.fn().mockReturnValue([]),
        };
        mockLogger.warn.mockClear();
        mockDispatcher.dispatch.mockClear();
        mockEntityManager.addComponent.mockClear();

        const serviceWithEmptyRegistry = new DamageTypeEffectsService({
          logger: mockLogger,
          entityManager: mockEntityManager,
          safeEventDispatcher: mockDispatcher,
          statusEffectRegistry: emptyRegistry,
          rngProvider: mockRngProvider,
        });

        await serviceWithEmptyRegistry.applyEffectsForDamage({
          ...baseParams,
          damageEntry: {
            name: 'fire',
            amount: 30,
            bleed: { enabled: true },
          },
        });

        expect(mockLogger.warn).toHaveBeenCalledTimes(5);
        expect(mockLogger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            'DamageTypeEffectsService: Missing status-effect registry entry for dismember'
          )
        );
        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          'anatomy:bleeding_started',
          expect.objectContaining({
            entityId: 'entity:player',
            partId: 'part:arm',
          })
        );
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
    });
  });
});
