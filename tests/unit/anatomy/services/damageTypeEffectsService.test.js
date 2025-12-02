import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import DamageTypeEffectsService from '../../../../src/anatomy/services/damageTypeEffectsService.js';

describe('DamageTypeEffectsService', () => {
  let service;
  let mockLogger;
  let mockEntityManager;
  let mockDataRegistry;
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

    mockDataRegistry = {
      get: jest.fn(),
    };

    mockDispatcher = {
      dispatch: jest.fn(),
    };

    mockRngProvider = jest.fn().mockReturnValue(0.5);

    service = new DamageTypeEffectsService({
      logger: mockLogger,
      entityManager: mockEntityManager,
      dataRegistry: mockDataRegistry,
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
            dataRegistry: mockDataRegistry,
            safeEventDispatcher: mockDispatcher,
          })
      ).toThrow();
    });

    it('should throw if entityManager is missing', () => {
      expect(
        () =>
          new DamageTypeEffectsService({
            logger: mockLogger,
            dataRegistry: mockDataRegistry,
            safeEventDispatcher: mockDispatcher,
          })
      ).toThrow();
    });

    it('should throw if dataRegistry is missing', () => {
      expect(
        () =>
          new DamageTypeEffectsService({
            logger: mockLogger,
            entityManager: mockEntityManager,
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
            dataRegistry: mockDataRegistry,
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
            dataRegistry: mockDataRegistry,
            safeEventDispatcher: mockDispatcher,
          })
      ).toThrow();
    });

    it('should use Math.random as default rngProvider', () => {
      const serviceWithDefaultRng = new DamageTypeEffectsService({
        logger: mockLogger,
        entityManager: mockEntityManager,
        dataRegistry: mockDataRegistry,
        safeEventDispatcher: mockDispatcher,
      });
      expect(serviceWithDefaultRng).toBeDefined();
    });
  });

  describe('applyEffectsForDamage', () => {
    const baseParams = {
      entityId: 'entity:player',
      partId: 'part:arm',
      amount: 30,
      damageType: 'slashing',
      maxHealth: 100,
      currentHealth: 70,
    };

    it('should skip effects when damage type is unknown', async () => {
      mockDataRegistry.get.mockReturnValue(null);

      await service.applyEffectsForDamage(baseParams);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Unknown damage type'),
        expect.any(Object)
      );
      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    it('should skip effects when damage type definition is empty', async () => {
      mockDataRegistry.get.mockReturnValue({});

      await service.applyEffectsForDamage(baseParams);

      expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
    });

    describe('dismemberment', () => {
      it('should trigger dismemberment when damage exceeds threshold', async () => {
        mockDataRegistry.get.mockReturnValue({
          id: 'slashing',
          dismember: { enabled: true, thresholdFraction: 0.8 },
        });

        await service.applyEffectsForDamage({
          ...baseParams,
          amount: 85, // >= 80% of 100 maxHealth
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
        mockDataRegistry.get.mockReturnValue({
          id: 'slashing',
          dismember: { enabled: true, thresholdFraction: 0.8 },
        });

        await service.applyEffectsForDamage({
          ...baseParams,
          amount: 70, // < 80% of 100 maxHealth
        });

        expect(mockDispatcher.dispatch).not.toHaveBeenCalledWith(
          'anatomy:dismembered',
          expect.anything()
        );
      });

      it('should skip other effects when dismemberment triggers', async () => {
        mockDataRegistry.get.mockReturnValue({
          id: 'slashing',
          dismember: { enabled: true, thresholdFraction: 0.8 },
          bleed: { enabled: true, severity: 'moderate' },
        });

        await service.applyEffectsForDamage({
          ...baseParams,
          amount: 85,
        });

        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          'anatomy:dismembered',
          expect.anything()
        );
        expect(mockDispatcher.dispatch).not.toHaveBeenCalledWith(
          'anatomy:bleeding_started',
          expect.anything()
        );
      });

      it('should not trigger dismemberment when disabled', async () => {
        mockDataRegistry.get.mockReturnValue({
          id: 'slashing',
          dismember: { enabled: false },
        });

        await service.applyEffectsForDamage({
          ...baseParams,
          amount: 95,
        });

        expect(mockDispatcher.dispatch).not.toHaveBeenCalledWith(
          'anatomy:dismembered',
          expect.anything()
        );
      });

      it('should use default threshold fraction of 0.8', async () => {
        mockDataRegistry.get.mockReturnValue({
          id: 'slashing',
          dismember: { enabled: true }, // No thresholdFraction specified
        });

        await service.applyEffectsForDamage({
          ...baseParams,
          amount: 80, // Exactly 80%
        });

        expect(mockDispatcher.dispatch).toHaveBeenCalledWith(
          'anatomy:dismembered',
          expect.anything()
        );
      });
    });

    describe('fracture', () => {
      it('should apply fracture when damage exceeds threshold', async () => {
        mockDataRegistry.get.mockReturnValue({
          id: 'blunt',
          fracture: { enabled: true, thresholdFraction: 0.5 },
        });

        await service.applyEffectsForDamage({
          ...baseParams,
          amount: 55, // >= 50% of 100 maxHealth
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
        mockDataRegistry.get.mockReturnValue({
          id: 'blunt',
          fracture: { enabled: true, thresholdFraction: 0.5, stunChance: 0.5 },
        });

        await service.applyEffectsForDamage({
          ...baseParams,
          amount: 55,
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
        mockDataRegistry.get.mockReturnValue({
          id: 'blunt',
          fracture: { enabled: true, thresholdFraction: 0.5, stunChance: 0.5 },
        });

        await service.applyEffectsForDamage({
          ...baseParams,
          amount: 55,
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

      it('should not apply fracture when damage below threshold', async () => {
        mockDataRegistry.get.mockReturnValue({
          id: 'blunt',
          fracture: { enabled: true, thresholdFraction: 0.5 },
        });

        await service.applyEffectsForDamage({
          ...baseParams,
          amount: 40, // < 50%
        });

        expect(mockEntityManager.addComponent).not.toHaveBeenCalledWith(
          'part:arm',
          'anatomy:fractured',
          expect.anything()
        );
      });

      it('should use default threshold fraction of 0.5', async () => {
        mockDataRegistry.get.mockReturnValue({
          id: 'blunt',
          fracture: { enabled: true }, // No thresholdFraction
        });

        await service.applyEffectsForDamage({
          ...baseParams,
          amount: 50, // Exactly 50%
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
        mockDataRegistry.get.mockReturnValue({
          id: 'slashing',
          bleed: { enabled: true, severity: 'moderate', baseDurationTurns: 3 },
        });

        await service.applyEffectsForDamage(baseParams);

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
        mockDataRegistry.get.mockReturnValue({
          id: 'slashing',
          bleed: { enabled: true }, // No severity specified
        });

        await service.applyEffectsForDamage(baseParams);

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
        mockDataRegistry.get.mockReturnValue({
          id: 'slashing',
          bleed: { enabled: true, severity: 'minor' },
        });

        await service.applyEffectsForDamage(baseParams);

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part:arm',
          'anatomy:bleeding',
          expect.objectContaining({ remainingTurns: 2 })
        );
      });

      it('should not apply bleed when part is destroyed', async () => {
        mockDataRegistry.get.mockReturnValue({
          id: 'slashing',
          bleed: { enabled: true },
        });

        await service.applyEffectsForDamage({
          ...baseParams,
          currentHealth: 0, // Part destroyed
        });

        expect(mockEntityManager.addComponent).not.toHaveBeenCalledWith(
          'part:arm',
          'anatomy:bleeding',
          expect.anything()
        );
      });

      it('should map severe severity to correct tick damage', async () => {
        mockDataRegistry.get.mockReturnValue({
          id: 'slashing',
          bleed: { enabled: true, severity: 'severe' },
        });

        await service.applyEffectsForDamage(baseParams);

        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part:arm',
          'anatomy:bleeding',
          expect.objectContaining({ tickDamage: 5 })
        );
      });
    });

    describe('burn', () => {
      it('should apply burning effect', async () => {
        mockDataRegistry.get.mockReturnValue({
          id: 'fire',
          burn: { enabled: true, dps: 5, durationTurns: 4 },
        });

        await service.applyEffectsForDamage(baseParams);

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
        mockDataRegistry.get.mockReturnValue({
          id: 'fire',
          burn: { enabled: true, dps: 3, durationTurns: 2, canStack: true },
        });

        await service.applyEffectsForDamage(baseParams);

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
        mockDataRegistry.get.mockReturnValue({
          id: 'fire',
          burn: { enabled: true, dps: 3, durationTurns: 4, canStack: false },
        });

        await service.applyEffectsForDamage(baseParams);

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
        mockDataRegistry.get.mockReturnValue({
          id: 'fire',
          burn: { enabled: true },
        });

        await service.applyEffectsForDamage(baseParams);

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
        mockDataRegistry.get.mockReturnValue({
          id: 'fire',
          burn: { enabled: true },
        });

        await service.applyEffectsForDamage({
          ...baseParams,
          currentHealth: 0,
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
        mockDataRegistry.get.mockReturnValue({
          id: 'venom',
          poison: { enabled: true, tick: 2, durationTurns: 5 },
        });

        await service.applyEffectsForDamage(baseParams);

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
        mockDataRegistry.get.mockReturnValue({
          id: 'venom',
          poison: { enabled: true, tick: 2, durationTurns: 5, scope: 'entity' },
        });

        await service.applyEffectsForDamage(baseParams);

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
        mockDataRegistry.get.mockReturnValue({
          id: 'venom',
          poison: { enabled: true },
        });

        await service.applyEffectsForDamage(baseParams);

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
        mockDataRegistry.get.mockReturnValue({
          id: 'venom',
          poison: { enabled: true },
        });

        await service.applyEffectsForDamage({
          ...baseParams,
          currentHealth: 0,
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

        mockDataRegistry.get.mockReturnValue({
          id: 'mixed',
          dismember: { enabled: true, thresholdFraction: 0.95 }, // Won't trigger
          fracture: { enabled: true, thresholdFraction: 0.2 },
          bleed: { enabled: true },
          burn: { enabled: true },
          poison: { enabled: true },
        });

        await service.applyEffectsForDamage(baseParams);

        expect(callOrder).toEqual([
          'anatomy:fractured',
          'anatomy:bleeding_started',
          'anatomy:burning_started',
          'anatomy:poisoned_started',
        ]);
      });
    });

    describe('edge cases', () => {
      it('should handle damage type with no effects configured', async () => {
        mockDataRegistry.get.mockReturnValue({
          id: 'psychic',
          // No effects defined
        });

        await service.applyEffectsForDamage(baseParams);

        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
      });

      it('should handle all effects disabled', async () => {
        mockDataRegistry.get.mockReturnValue({
          id: 'mixed',
          dismember: { enabled: false },
          fracture: { enabled: false },
          bleed: { enabled: false },
          burn: { enabled: false },
          poison: { enabled: false },
        });

        await service.applyEffectsForDamage(baseParams);

        expect(mockDispatcher.dispatch).not.toHaveBeenCalled();
        expect(mockEntityManager.addComponent).not.toHaveBeenCalled();
      });

      it('should handle zero damage amount', async () => {
        mockDataRegistry.get.mockReturnValue({
          id: 'slashing',
          bleed: { enabled: true },
        });

        await service.applyEffectsForDamage({
          ...baseParams,
          amount: 0,
        });

        // Should still apply bleed even with 0 damage
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part:arm',
          'anatomy:bleeding',
          expect.anything()
        );
      });

      it('should handle unknown severity in bleed config gracefully', async () => {
        mockDataRegistry.get.mockReturnValue({
          id: 'slashing',
          bleed: { enabled: true, severity: 'unknown_severity' },
        });

        await service.applyEffectsForDamage(baseParams);

        // Should fallback to minor
        expect(mockEntityManager.addComponent).toHaveBeenCalledWith(
          'part:arm',
          'anatomy:bleeding',
          expect.objectContaining({ tickDamage: 1 })
        );
      });
    });
  });
});
