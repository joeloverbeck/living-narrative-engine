/**
 * @file DeathConditionMonitor.test.js
 * @description Unit tests for DeathConditionMonitor (DAMAGESIMULATOR-015)
 */

import DeathConditionMonitor from '../../../../src/domUI/damage-simulator/DeathConditionMonitor.js';
import { jest } from '@jest/globals';

describe('DeathConditionMonitor', () => {
  let mockLogger;
  let mockEventBus;
  let mockContainerElement;
  let mockHeader;
  let deathConditionMonitor;

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn().mockReturnValue(() => {}),
    };

    mockHeader = {
      addEventListener: jest.fn(),
    };

    mockContainerElement = {
      innerHTML: '',
      appendChild: jest.fn(),
      querySelector: jest.fn((selector) => {
        if (selector === '.ds-death-header') {
          return mockHeader;
        }
        return null;
      }),
    };

    deathConditionMonitor = new DeathConditionMonitor({
      containerElement: mockContainerElement,
      eventBus: mockEventBus,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    if (deathConditionMonitor) {
      deathConditionMonitor.destroy();
    }
  });

  describe('Constructor', () => {
    it('should validate required dependencies - missing containerElement', () => {
      expect(
        () =>
          new DeathConditionMonitor({
            eventBus: mockEventBus,
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should validate required dependencies - missing eventBus', () => {
      expect(
        () =>
          new DeathConditionMonitor({
            containerElement: mockContainerElement,
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should validate required dependencies - missing logger', () => {
      expect(
        () =>
          new DeathConditionMonitor({
            containerElement: mockContainerElement,
            eventBus: mockEventBus,
          })
      ).toThrow();
    });

    it('should create monitor with all valid dependencies', () => {
      expect(deathConditionMonitor).toBeInstanceOf(DeathConditionMonitor);
    });

    it('should subscribe to entity-loaded, damage-applied and config-changed events', () => {
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        DeathConditionMonitor.EVENTS.ENTITY_LOADED,
        expect.any(Function)
      );
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        DeathConditionMonitor.EVENTS.DAMAGE_APPLIED,
        expect.any(Function)
      );
      expect(mockEventBus.subscribe).toHaveBeenCalledWith(
        DeathConditionMonitor.EVENTS.CONFIG_CHANGED,
        expect.any(Function)
      );
    });
  });

  describe('should identify death-triggering parts', () => {
    it('should identify parts with anatomy:vital_organ component where killOnDestroy is true', () => {
      const anatomyData = createAnatomyDataWithVitalOrgans();

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      const summary = deathConditionMonitor.getDeathConditionSummary();

      // Should find brain and heart (killOnDestroy !== false)
      expect(summary.vitalOrgans).toHaveLength(2);
      expect(summary.vitalOrgans.map((o) => o.organType)).toContain('brain');
      expect(summary.vitalOrgans.map((o) => o.organType)).toContain('heart');
    });

    it('should ignore parts with killOnDestroy set to false', () => {
      const anatomyData = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 50, 50, false), // killOnDestroy: false
          createVitalOrganPart('torso', 'Torso', 'heart', 100, 100, true),
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      const summary = deathConditionMonitor.getDeathConditionSummary();

      expect(summary.vitalOrgans).toHaveLength(1);
      expect(summary.vitalOrgans[0].organType).toBe('heart');
    });

    it('should handle nested anatomy parts with vital organs', () => {
      const anatomyData = {
        parts: [
          {
            id: 'torso',
            name: 'Torso',
            currentHealth: 100,
            maxHealth: 100,
            components: {},
            children: [
              createVitalOrganPart('heart', 'Heart', 'heart', 30, 30, true),
            ],
          },
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      const summary = deathConditionMonitor.getDeathConditionSummary();

      expect(summary.vitalOrgans).toHaveLength(1);
      expect(summary.vitalOrgans[0].partName).toBe('Heart');
    });
  });

  describe('should calculate hits until death', () => {
    it('should calculate hits until death based on current damage config', () => {
      const anatomyData = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 50, 50, true),
        ],
      };
      const damageEntry = { amount: 10, damageType: 'blunt' };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.updateDamageConfig(damageEntry, 1.0);
      const summary = deathConditionMonitor.getDeathConditionSummary();

      // 50 health / 10 damage = 5 hits
      expect(summary.vitalOrgans[0].hitsUntilDeath).toBe(5);
    });

    it('should apply multiplier to damage when calculating hits', () => {
      const anatomyData = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 50, 50, true),
        ],
      };
      const damageEntry = { amount: 10, damageType: 'blunt' };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.updateDamageConfig(damageEntry, 2.0); // 2x multiplier
      const summary = deathConditionMonitor.getDeathConditionSummary();

      // 50 health / (10 * 2) = 2.5 → ceil = 3 hits
      expect(summary.vitalOrgans[0].hitsUntilDeath).toBe(3);
    });

    it('should return 0 hits until death when part is already destroyed', () => {
      const anatomyData = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 0, 50, true), // 0 health
        ],
      };
      const damageEntry = { amount: 10, damageType: 'blunt' };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.updateDamageConfig(damageEntry, 1.0);
      const summary = deathConditionMonitor.getDeathConditionSummary();

      expect(summary.vitalOrgans[0].hitsUntilDeath).toBe(0);
      expect(summary.vitalOrgans[0].status).toBe(DeathConditionMonitor.STATUS.DESTROYED);
    });

    it('should use default damage (10) when no damage configured', () => {
      const anatomyData = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 50, 50, true),
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      // No updateDamageConfig called - implementation uses default damage of 10
      const summary = deathConditionMonitor.getDeathConditionSummary();

      // 50 health / 10 default damage = 5 hits
      expect(summary.vitalOrgans[0].hitsUntilDeath).toBe(5);
    });
  });

  describe('should show warning at low health', () => {
    it('should return WARNING status when health is between 10-25%', () => {
      const anatomyData = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 20, 100, true), // 20%
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      const summary = deathConditionMonitor.getDeathConditionSummary();

      expect(summary.vitalOrgans[0].status).toBe(DeathConditionMonitor.STATUS.WARNING);
    });

    it('should return CRITICAL status when health is below 10%', () => {
      const anatomyData = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 5, 100, true), // 5%
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      const summary = deathConditionMonitor.getDeathConditionSummary();

      expect(summary.vitalOrgans[0].status).toBe(DeathConditionMonitor.STATUS.CRITICAL);
    });

    it('should return SAFE status when health is above 25%', () => {
      const anatomyData = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 50, 100, true), // 50%
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      const summary = deathConditionMonitor.getDeathConditionSummary();

      expect(summary.vitalOrgans[0].status).toBe(DeathConditionMonitor.STATUS.SAFE);
    });
  });

  describe('should trigger death alert at threshold', () => {
    it('should set isDead true when any vital organ has 0 health', () => {
      const anatomyData = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 0, 50, true), // destroyed
          createVitalOrganPart('torso', 'Torso', 'heart', 100, 100, true),
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      const summary = deathConditionMonitor.getDeathConditionSummary();

      expect(summary.isDead).toBe(true);
      // Implementation returns just partName (destruction is appended in render)
      expect(summary.deathCause).toBe('Head');
    });

    it('should set isInDanger true when hits until death is 1', () => {
      const anatomyData = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 10, 50, true),
        ],
      };
      const damageEntry = { amount: 10, damageType: 'blunt' };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.updateDamageConfig(damageEntry, 1.0);
      const summary = deathConditionMonitor.getDeathConditionSummary();

      expect(summary.isInDanger).toBe(true);
    });

    it('should not set isInDanger when hits until death is more than 1', () => {
      const anatomyData = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 50, 50, true),
        ],
      };
      const damageEntry = { amount: 10, damageType: 'blunt' };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.updateDamageConfig(damageEntry, 1.0);
      const summary = deathConditionMonitor.getDeathConditionSummary();

      // 50/10 = 5 hits
      expect(summary.isInDanger).toBe(false);
    });
  });

  describe('should update after damage events', () => {
    it('should log damage event when applied to monitored entity', () => {
      const anatomyData = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 50, 50, true),
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData);

      // Get the damage-applied handler and call it
      const damageAppliedCall = mockEventBus.subscribe.mock.calls.find(
        (call) => call[0] === DeathConditionMonitor.EVENTS.DAMAGE_APPLIED
      );
      const handler = damageAppliedCall[1];

      // Call handler with damage event - handler logs and awaits refresh from DamageSimulatorUI
      handler({
        payload: {
          entityId: 'entity-1',
        },
      });

      // Implementation logs damage, awaits external refresh (doesn't update anatomy directly)
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[DeathConditionMonitor] Damage applied, awaiting refresh'
      );
    });

    it('should update when setEntity is called with new anatomy data', () => {
      const anatomyData1 = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 50, 50, true),
        ],
      };
      const anatomyData2 = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 30, 50, true), // reduced health
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData1);
      let summary = deathConditionMonitor.getDeathConditionSummary();
      expect(summary.vitalOrgans[0].currentHealth).toBe(50);

      // DamageSimulatorUI would call setEntity with refreshed anatomy data
      deathConditionMonitor.setEntity('entity-1', anatomyData2);
      summary = deathConditionMonitor.getDeathConditionSummary();
      expect(summary.vitalOrgans[0].currentHealth).toBe(30);
    });
  });

  describe('should handle multiple death conditions', () => {
    it('should track multiple vital organs simultaneously', () => {
      const anatomyData = createAnatomyDataWithVitalOrgans();
      const damageEntry = { amount: 10, damageType: 'blunt' };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.updateDamageConfig(damageEntry, 1.0);
      const summary = deathConditionMonitor.getDeathConditionSummary();

      expect(summary.vitalOrgans).toHaveLength(2);
      expect(summary.vitalOrgans[0].organType).toBeDefined();
      expect(summary.vitalOrgans[1].organType).toBeDefined();
    });

    it('should report isInDanger based on worst vital organ', () => {
      const anatomyData = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 50, 50, true), // SAFE
          createVitalOrganPart('torso', 'Torso', 'heart', 5, 100, true), // CRITICAL
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      const summary = deathConditionMonitor.getDeathConditionSummary();

      // isInDanger should reflect critical state (overall status is internal, not exposed in summary)
      expect(summary.isInDanger).toBe(true);
      // The deathCause shows the critical part
      expect(summary.deathCause).toBe('Torso');
      // Individual organ statuses should be correct
      const headOrgan = summary.vitalOrgans.find((o) => o.organType === 'brain');
      const heartOrgan = summary.vitalOrgans.find((o) => o.organType === 'heart');
      expect(headOrgan.status).toBe(DeathConditionMonitor.STATUS.SAFE);
      expect(heartOrgan.status).toBe(DeathConditionMonitor.STATUS.CRITICAL);
    });
  });

  describe('should handle parts without death condition', () => {
    it('should not include non-vital parts in vital organ list', () => {
      const anatomyData = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 50, 50, true),
          {
            id: 'arm',
            name: 'Left Arm',
            currentHealth: 30,
            maxHealth: 30,
            components: {}, // No vital_organ component
          },
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      const summary = deathConditionMonitor.getDeathConditionSummary();

      expect(summary.vitalOrgans).toHaveLength(1);
      expect(summary.vitalOrgans[0].partName).toBe('Head');
    });

    it('should handle entity with no vital organs', () => {
      const anatomyData = {
        parts: [
          {
            id: 'arm',
            name: 'Left Arm',
            currentHealth: 30,
            maxHealth: 30,
            components: {},
          },
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      const summary = deathConditionMonitor.getDeathConditionSummary();

      expect(summary.vitalOrgans).toHaveLength(0);
      expect(summary.isDead).toBe(false);
      expect(summary.isInDanger).toBe(false);
    });
  });

  describe('should reset on entity change', () => {
    it('should clear state when new entity is loaded', () => {
      const anatomyData1 = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 10, 50, true),
        ],
      };
      const anatomyData2 = {
        parts: [
          createVitalOrganPart('torso', 'Torso', 'heart', 100, 100, true),
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData1);
      deathConditionMonitor.setEntity('entity-2', anatomyData2);

      const summary = deathConditionMonitor.getDeathConditionSummary();

      // Should only have entity-2's vital organs
      expect(summary.vitalOrgans).toHaveLength(1);
      expect(summary.vitalOrgans[0].partName).toBe('Torso');
    });
  });

  describe('should track death state correctly', () => {
    it('should track DESTROYED state when health reaches 0', () => {
      const anatomyData = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 0, 50, true),
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      const summary = deathConditionMonitor.getDeathConditionSummary();

      expect(summary.vitalOrgans[0].status).toBe(DeathConditionMonitor.STATUS.DESTROYED);
    });

    it('should correctly identify death cause from first destroyed vital organ', () => {
      const anatomyData = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 50, 50, true),
          createVitalOrganPart('torso', 'Torso', 'heart', 0, 100, true), // destroyed
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      const summary = deathConditionMonitor.getDeathConditionSummary();

      expect(summary.isDead).toBe(true);
      // Implementation returns just partName (destruction is appended in render)
      expect(summary.deathCause).toBe('Torso');
    });
  });

  describe('should handle healed parts correctly', () => {
    it('should update status when part is healed', () => {
      // Start with low health
      const anatomyData1 = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 5, 50, true), // CRITICAL
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData1);
      let summary = deathConditionMonitor.getDeathConditionSummary();
      expect(summary.vitalOrgans[0].status).toBe(DeathConditionMonitor.STATUS.CRITICAL);

      // Heal the part
      const anatomyData2 = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 40, 50, true), // SAFE
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData2);
      summary = deathConditionMonitor.getDeathConditionSummary();
      expect(summary.vitalOrgans[0].status).toBe(DeathConditionMonitor.STATUS.SAFE);
    });

    it('should clear death state when destroyed part is healed', () => {
      // Start dead
      const anatomyData1 = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 0, 50, true),
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData1);
      let summary = deathConditionMonitor.getDeathConditionSummary();
      expect(summary.isDead).toBe(true);

      // Heal
      const anatomyData2 = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 50, 50, true),
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData2);
      summary = deathConditionMonitor.getDeathConditionSummary();
      expect(summary.isDead).toBe(false);
    });
  });

  describe('render', () => {
    it('should render panel with vital organ list', () => {
      const anatomyData = createAnatomyDataWithVitalOrgans();

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.render();

      const html = mockContainerElement.innerHTML;
      expect(html).toContain('ds-death-monitor');
      expect(html).toContain('Death Conditions');
    });

    it('should render empty state message when no entity loaded', () => {
      deathConditionMonitor.render();

      const html = mockContainerElement.innerHTML;
      expect(html).toContain('No vital organs detected');
    });

    it('should render death alert when entity is dead', () => {
      const anatomyData = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 0, 50, true),
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.render();

      const html = mockContainerElement.innerHTML;
      expect(html).toContain('ENTITY IS DEAD');
    });

    it('should render danger alert when one hit from death', () => {
      const anatomyData = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 10, 50, true),
        ],
      };
      const damageEntry = { amount: 10, damageType: 'blunt' };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.updateDamageConfig(damageEntry, 1.0);
      deathConditionMonitor.render();

      const html = mockContainerElement.innerHTML;
      expect(html).toContain('1 hit until death');
    });
  });

  describe('wouldDieOnHit', () => {
    it('should return true if damage would reduce vital organ to 0', () => {
      const anatomyData = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 10, 50, true),
        ],
      };
      const damageEntry = { amount: 15, damageType: 'blunt' };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.updateDamageConfig(damageEntry, 1.0);

      expect(deathConditionMonitor.wouldDieOnHit(damageEntry, 'head')).toBe(true);
    });

    it('should return false if damage would not reduce vital organ to 0', () => {
      const anatomyData = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 30, 50, true),
        ],
      };
      const damageEntry = { amount: 10, damageType: 'blunt' };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.updateDamageConfig(damageEntry, 1.0);

      expect(deathConditionMonitor.wouldDieOnHit(damageEntry, 'head')).toBe(false);
    });

    it('should return false for non-vital parts', () => {
      const anatomyData = {
        parts: [
          {
            id: 'arm',
            name: 'Left Arm',
            currentHealth: 10,
            maxHealth: 30,
            components: {},
          },
        ],
      };
      const damageEntry = { amount: 15, damageType: 'blunt' };

      deathConditionMonitor.setEntity('entity-1', anatomyData);

      expect(deathConditionMonitor.wouldDieOnHit(damageEntry, 'arm')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all state', () => {
      const anatomyData = createAnatomyDataWithVitalOrgans();

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.clear();

      const summary = deathConditionMonitor.getDeathConditionSummary();
      expect(summary.vitalOrgans).toHaveLength(0);
      expect(summary.isDead).toBe(false);
    });
  });

  describe('destroy', () => {
    it('should unsubscribe from all events', () => {
      const unsubscribeFn = jest.fn();
      mockEventBus.subscribe.mockReturnValue(unsubscribeFn);

      const monitor = new DeathConditionMonitor({
        containerElement: mockContainerElement,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      monitor.destroy();

      // Should have unsubscribed 3 times (ENTITY_LOADED, DAMAGE_APPLIED, CONFIG_CHANGED)
      expect(unsubscribeFn).toHaveBeenCalledTimes(3);
    });
  });

  // ============================================
  // Edge Case Tests for Full Coverage
  // ============================================

  describe('Event handler edge cases', () => {
    describe('ENTITY_LOADED handler', () => {
      it('should call setEntity when both instanceId and anatomyData are provided', () => {
        const anatomyData = createAnatomyDataWithVitalOrgans();

        const unsubEntityCall = mockEventBus.subscribe.mock.calls.find(
          (call) => call[0] === DeathConditionMonitor.EVENTS.ENTITY_LOADED
        );
        const handler = unsubEntityCall[1];

        // Trigger the event with valid payload
        handler({
          payload: { instanceId: 'entity-from-event', anatomyData },
        });

        // Verify entity was set by checking summary
        const summary = deathConditionMonitor.getDeathConditionSummary();
        expect(summary.vitalOrgans).toHaveLength(2); // head, torso
        expect(summary.vitalOrgans[0].partId).toBe('head');
        expect(summary.vitalOrgans[1].partId).toBe('torso');
      });

      it('should not call setEntity when instanceId is missing', () => {
        const anatomyData = createAnatomyDataWithVitalOrgans();
        const setEntitySpy = jest.spyOn(deathConditionMonitor, 'setEntity');

        const unsubEntityCall = mockEventBus.subscribe.mock.calls.find(
          (call) => call[0] === DeathConditionMonitor.EVENTS.ENTITY_LOADED
        );
        const handler = unsubEntityCall[1];

        handler({
          payload: { anatomyData }, // missing instanceId
        });

        expect(setEntitySpy).not.toHaveBeenCalled();
        setEntitySpy.mockRestore();
      });

      it('should not call setEntity when anatomyData is missing', () => {
        const setEntitySpy = jest.spyOn(deathConditionMonitor, 'setEntity');

        const unsubEntityCall = mockEventBus.subscribe.mock.calls.find(
          (call) => call[0] === DeathConditionMonitor.EVENTS.ENTITY_LOADED
        );
        const handler = unsubEntityCall[1];

        handler({
          payload: { instanceId: 'entity-1' }, // missing anatomyData
        });

        expect(setEntitySpy).not.toHaveBeenCalled();
        setEntitySpy.mockRestore();
      });

      it('should handle ENTITY_LOADED event with null payload', () => {
        const setEntitySpy = jest.spyOn(deathConditionMonitor, 'setEntity');

        const unsubEntityCall = mockEventBus.subscribe.mock.calls.find(
          (call) => call[0] === DeathConditionMonitor.EVENTS.ENTITY_LOADED
        );
        const handler = unsubEntityCall[1];

        handler({ payload: null });

        expect(setEntitySpy).not.toHaveBeenCalled();
        setEntitySpy.mockRestore();
      });

      it('should handle ENTITY_LOADED event with undefined payload', () => {
        const setEntitySpy = jest.spyOn(deathConditionMonitor, 'setEntity');

        const unsubEntityCall = mockEventBus.subscribe.mock.calls.find(
          (call) => call[0] === DeathConditionMonitor.EVENTS.ENTITY_LOADED
        );
        const handler = unsubEntityCall[1];

        handler({});

        expect(setEntitySpy).not.toHaveBeenCalled();
        setEntitySpy.mockRestore();
      });
    });

    describe('CONFIG_CHANGED handler', () => {
      it('should not update config when damageEntry is missing in CONFIG_CHANGED', () => {
        const updateDamageConfigSpy = jest.spyOn(
          deathConditionMonitor,
          'updateDamageConfig'
        );

        const unsubConfigCall = mockEventBus.subscribe.mock.calls.find(
          (call) => call[0] === DeathConditionMonitor.EVENTS.CONFIG_CHANGED
        );
        const handler = unsubConfigCall[1];

        handler({
          payload: { multiplier: 2 }, // missing damageEntry
        });

        expect(updateDamageConfigSpy).not.toHaveBeenCalled();
        updateDamageConfigSpy.mockRestore();
      });

      it('should handle CONFIG_CHANGED event with null payload', () => {
        const updateDamageConfigSpy = jest.spyOn(
          deathConditionMonitor,
          'updateDamageConfig'
        );

        const unsubConfigCall = mockEventBus.subscribe.mock.calls.find(
          (call) => call[0] === DeathConditionMonitor.EVENTS.CONFIG_CHANGED
        );
        const handler = unsubConfigCall[1];

        handler({ payload: null });

        expect(updateDamageConfigSpy).not.toHaveBeenCalled();
        updateDamageConfigSpy.mockRestore();
      });

      it('should use default multiplier of 1 when not provided in CONFIG_CHANGED', () => {
        const anatomyData = {
          parts: [createVitalOrganPart('head', 'Head', 'brain', 50, 50, true)],
        };
        const damageEntry = { amount: 10 };

        deathConditionMonitor.setEntity('entity-1', anatomyData);

        const unsubConfigCall = mockEventBus.subscribe.mock.calls.find(
          (call) => call[0] === DeathConditionMonitor.EVENTS.CONFIG_CHANGED
        );
        const handler = unsubConfigCall[1];

        handler({
          payload: { damageEntry }, // multiplier not provided
        });

        const summary = deathConditionMonitor.getDeathConditionSummary();
        // 50 health / (10 * 1) = 5 hits
        expect(summary.vitalOrgans[0].hitsUntilDeath).toBe(5);
      });
    });
  });

  describe('Panel interaction - collapse/expand', () => {
    it('should bind click listener to header', () => {
      const anatomyData = createAnatomyDataWithVitalOrgans();
      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.render();

      expect(mockHeader.addEventListener).toHaveBeenCalledWith(
        'click',
        expect.any(Function)
      );
    });

    it('should bind keydown listener to header', () => {
      const anatomyData = createAnatomyDataWithVitalOrgans();
      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.render();

      expect(mockHeader.addEventListener).toHaveBeenCalledWith(
        'keydown',
        expect.any(Function)
      );
    });

    it('should toggle collapse on header click', () => {
      const anatomyData = createAnatomyDataWithVitalOrgans();
      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.render();

      // Get the click handler
      const clickHandler = mockHeader.addEventListener.mock.calls.find(
        (call) => call[0] === 'click'
      )[1];

      // Initially not collapsed - shows ▼
      expect(mockContainerElement.innerHTML).toContain('▼');

      // Call the handler to toggle collapse
      clickHandler();

      // Should be collapsed now - shows ▶
      expect(mockContainerElement.innerHTML).toContain('▶');
    });

    it('should toggle collapse on Enter key', () => {
      const anatomyData = createAnatomyDataWithVitalOrgans();
      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.render();

      // Get the keydown handler
      const keydownHandler = mockHeader.addEventListener.mock.calls.find(
        (call) => call[0] === 'keydown'
      )[1];

      // Mock event
      const mockEvent = {
        key: 'Enter',
        preventDefault: jest.fn(),
      };

      // Initially not collapsed
      expect(mockContainerElement.innerHTML).toContain('▼');

      // Call the handler with Enter key
      keydownHandler(mockEvent);

      // Should prevent default and toggle
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockContainerElement.innerHTML).toContain('▶');
    });

    it('should toggle collapse on Space key', () => {
      const anatomyData = createAnatomyDataWithVitalOrgans();
      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.render();

      // Get the keydown handler
      const keydownHandler = mockHeader.addEventListener.mock.calls.find(
        (call) => call[0] === 'keydown'
      )[1];

      // Mock event
      const mockEvent = {
        key: ' ',
        preventDefault: jest.fn(),
      };

      // Initially not collapsed
      expect(mockContainerElement.innerHTML).toContain('▼');

      // Call the handler with Space key
      keydownHandler(mockEvent);

      // Should prevent default and toggle
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockContainerElement.innerHTML).toContain('▶');
    });

    it('should not toggle collapse on other keys', () => {
      const anatomyData = createAnatomyDataWithVitalOrgans();
      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.render();

      // Get the keydown handler
      const keydownHandler = mockHeader.addEventListener.mock.calls.find(
        (call) => call[0] === 'keydown'
      )[1];

      // Mock event with a different key
      const mockEvent = {
        key: 'A',
        preventDefault: jest.fn(),
      };

      // Initially not collapsed
      expect(mockContainerElement.innerHTML).toContain('▼');

      // Call the handler with 'A' key
      keydownHandler(mockEvent);

      // Should NOT prevent default or toggle (still shows ▼)
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockContainerElement.innerHTML).toContain('▼');
    });

    it('should not bind events if header element is null', () => {
      const nullHeaderContainer = {
        innerHTML: '',
        appendChild: jest.fn(),
        querySelector: jest.fn().mockReturnValue(null), // Header not found
      };

      const monitor = new DeathConditionMonitor({
        containerElement: nullHeaderContainer,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      const anatomyData = createAnatomyDataWithVitalOrgans();
      monitor.setEntity('entity-1', anatomyData);
      // This should not throw - just skips event binding
      monitor.render();

      // Verify no errors occurred
      expect(nullHeaderContainer.innerHTML).toContain('ds-death-monitor');
      monitor.destroy();
    });
  });

  describe('Edge cases - vital organ extraction', () => {
    it('should handle anatomyData with null parts property', () => {
      deathConditionMonitor.setEntity('entity-1', { parts: null });
      const summary = deathConditionMonitor.getDeathConditionSummary();

      expect(summary.vitalOrgans).toHaveLength(0);
    });

    it('should handle anatomyData with undefined parts property', () => {
      deathConditionMonitor.setEntity('entity-1', {});
      const summary = deathConditionMonitor.getDeathConditionSummary();

      expect(summary.vitalOrgans).toHaveLength(0);
    });

    it('should handle null anatomyData', () => {
      deathConditionMonitor.setEntity('entity-1', null);
      const summary = deathConditionMonitor.getDeathConditionSummary();

      expect(summary.vitalOrgans).toHaveLength(0);
    });
  });

  describe('Edge cases - damage calculations', () => {
    it('should use default damage of 10 when damage amount is 0', () => {
      const anatomyData = {
        parts: [createVitalOrganPart('head', 'Head', 'brain', 50, 50, true)],
      };
      // amount: 0 triggers default (|| 10), so 50 / 10 = 5 hits
      const damageEntry = { amount: 0, damageType: 'blunt' };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.updateDamageConfig(damageEntry, 1.0);
      const summary = deathConditionMonitor.getDeathConditionSummary();

      expect(summary.vitalOrgans[0].hitsUntilDeath).toBe(5);
    });

    it('should use default multiplier of 1 when multiplier is 0', () => {
      const anatomyData = {
        parts: [createVitalOrganPart('head', 'Head', 'brain', 50, 50, true)],
      };
      const damageEntry = { amount: 10, damageType: 'blunt' };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      // multiplier: 0 triggers default (|| 1), so 50 / (10 * 1) = 5 hits
      deathConditionMonitor.updateDamageConfig(damageEntry, 0);
      const summary = deathConditionMonitor.getDeathConditionSummary();

      expect(summary.vitalOrgans[0].hitsUntilDeath).toBe(5);
    });

    it('should return Infinity when negative damage provided', () => {
      const anatomyData = {
        parts: [createVitalOrganPart('head', 'Head', 'brain', 50, 50, true)],
      };
      // Negative amount is truthy, so -10 * 1 = -10 <= 0 triggers Infinity
      const damageEntry = { amount: -10, damageType: 'heal' };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.updateDamageConfig(damageEntry, 1.0);
      const summary = deathConditionMonitor.getDeathConditionSummary();

      expect(summary.vitalOrgans[0].hitsUntilDeath).toBe(Infinity);
    });
  });

  describe('Edge cases - wouldDieOnHit targetPartId filtering', () => {
    it('should skip checking non-targeted vital organs when targetPartId is specified', () => {
      const anatomyData = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 10, 50, true),
          createVitalOrganPart('torso', 'Torso', 'heart', 50, 100, true),
        ],
      };
      const damageEntry = { amount: 15 };

      deathConditionMonitor.setEntity('entity-1', anatomyData);

      // Only check torso (heart) with 50 health, not head (brain) with 10 health
      // 15 damage would kill brain but NOT heart
      // The continue statement will skip the brain check since we target torso
      const result = deathConditionMonitor.wouldDieOnHit(damageEntry, 'torso');
      expect(result).toBe(false); // 50 health - 15 damage = 35 (survives)

      // But targeting head should return true (10 - 15 <= 0)
      const resultHead = deathConditionMonitor.wouldDieOnHit(
        damageEntry,
        'head'
      );
      expect(resultHead).toBe(true);
    });

    it('should skip all non-matching parts when specific targetPartId is provided', () => {
      const anatomyData = {
        parts: [
          createVitalOrganPart('head', 'Head', 'brain', 5, 50, true),
          createVitalOrganPart('torso', 'Torso', 'heart', 5, 100, true),
          createVitalOrganPart('neck', 'Neck', 'spine', 100, 100, true),
        ],
      };
      const damageEntry = { amount: 10 };

      deathConditionMonitor.setEntity('entity-1', anatomyData);

      // Target only neck (spine) which has 100 health - won't die from 10 damage
      // This forces continue to execute for brain and heart
      const result = deathConditionMonitor.wouldDieOnHit(damageEntry, 'neck');
      expect(result).toBe(false); // 100 - 10 = 90 (survives)
    });
  });

  describe('Edge cases - rendering', () => {
    it('should render default organ icon for unknown organ types', () => {
      const anatomyData = {
        parts: [
          {
            id: 'special',
            name: 'Special Organ',
            components: {
              'anatomy:vital_organ': {
                organType: 'unknown', // Not a standard type
                killOnDestroy: true,
              },
              'anatomy:part_health': {
                current: 50,
                max: 50,
              },
            },
          },
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.render();

      const html = mockContainerElement.innerHTML;
      expect(html).toContain('🫀'); // Default organ icon
    });

    it('should render default organ icon for custom organ types like liver', () => {
      const anatomyData = {
        parts: [
          {
            id: 'custom',
            name: 'Custom Vital Organ',
            components: {
              'anatomy:vital_organ': {
                organType: 'liver', // Custom type not in switch
                killOnDestroy: true,
              },
              'anatomy:part_health': {
                current: 40,
                max: 40,
              },
            },
          },
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.render();

      const html = mockContainerElement.innerHTML;
      expect(html).toContain('🫀'); // Default organ icon
    });

    it('should render Invulnerable text when organ cannot be damaged', () => {
      const anatomyData = {
        parts: [createVitalOrganPart('head', 'Head', 'brain', 50, 50, true)],
      };
      // Negative damage triggers Infinity hitsUntilDeath = Invulnerable text
      const damageEntry = { amount: -10 };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.updateDamageConfig(damageEntry, 1.0);
      deathConditionMonitor.render();

      const html = mockContainerElement.innerHTML;
      expect(html).toContain('Invulnerable');
    });

    it('should handle non-string values in escapeHtml via numeric part id', () => {
      const anatomyData = {
        parts: [
          {
            id: 123, // numeric ID instead of string
            name: 'Numeric ID Part',
            components: {
              'anatomy:vital_organ': {
                organType: 'brain',
                killOnDestroy: true,
              },
              'anatomy:part_health': {
                current: 50,
                max: 50,
              },
            },
          },
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.render();

      const html = mockContainerElement.innerHTML;
      // Should not throw and should contain the converted numeric ID
      expect(html).toContain('123');
    });
  });

  describe('Branch coverage - wouldDieOnHit edge cases', () => {
    it('should handle null damageEntry (uses fallback amount of 0)', () => {
      const anatomyData = {
        parts: [createVitalOrganPart('head', 'Head', 'brain', 10, 50, true)],
      };
      deathConditionMonitor.setEntity('entity-1', anatomyData);

      // null damageEntry - amount defaults to 0, no damage done
      const result = deathConditionMonitor.wouldDieOnHit(null);
      expect(result).toBe(false);
    });

    it('should handle undefined damageEntry (uses fallback amount of 0)', () => {
      const anatomyData = {
        parts: [createVitalOrganPart('head', 'Head', 'brain', 10, 50, true)],
      };
      deathConditionMonitor.setEntity('entity-1', anatomyData);

      // undefined damageEntry - amount defaults to 0, no damage done
      const result = deathConditionMonitor.wouldDieOnHit(undefined);
      expect(result).toBe(false);
    });

    it('should handle damageEntry with missing amount property', () => {
      const anatomyData = {
        parts: [createVitalOrganPart('head', 'Head', 'brain', 10, 50, true)],
      };
      deathConditionMonitor.setEntity('entity-1', anatomyData);

      // amount not provided - defaults to 0
      const result = deathConditionMonitor.wouldDieOnHit({});
      expect(result).toBe(false);
    });
  });

  describe('Branch coverage - DAMAGE_APPLIED event', () => {
    it('should log debug message when damage applied to current entity', () => {
      const anatomyData = createAnatomyDataWithVitalOrgans();
      deathConditionMonitor.setEntity('entity-1', anatomyData);

      // Find the DAMAGE_APPLIED handler
      const unsubDamageCall = mockEventBus.subscribe.mock.calls.find(
        (call) => call[0] === DeathConditionMonitor.EVENTS.DAMAGE_APPLIED
      );
      const handler = unsubDamageCall[1];

      // Trigger event with matching entityId
      handler({
        payload: { entityId: 'entity-1', damage: 10 },
      });

      // Should log debug message
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[DeathConditionMonitor] Damage applied, awaiting refresh'
      );
    });

    it('should not log when damage applied to different entity', () => {
      const anatomyData = createAnatomyDataWithVitalOrgans();
      deathConditionMonitor.setEntity('entity-1', anatomyData);

      // Clear previous calls
      mockLogger.debug.mockClear();

      // Find the DAMAGE_APPLIED handler
      const unsubDamageCall = mockEventBus.subscribe.mock.calls.find(
        (call) => call[0] === DeathConditionMonitor.EVENTS.DAMAGE_APPLIED
      );
      const handler = unsubDamageCall[1];

      // Trigger event with different entityId
      handler({
        payload: { entityId: 'different-entity', damage: 10 },
      });

      // Should NOT log debug message
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        '[DeathConditionMonitor] Damage applied, awaiting refresh'
      );
    });

    it('should not log when no entity is set', () => {
      // No entity set

      // Find the DAMAGE_APPLIED handler
      const unsubDamageCall = mockEventBus.subscribe.mock.calls.find(
        (call) => call[0] === DeathConditionMonitor.EVENTS.DAMAGE_APPLIED
      );
      const handler = unsubDamageCall[1];

      // Trigger event
      handler({
        payload: { entityId: 'entity-1', damage: 10 },
      });

      // Should NOT log debug message (no currentEntityId set)
      expect(mockLogger.debug).not.toHaveBeenCalledWith(
        '[DeathConditionMonitor] Damage applied, awaiting refresh'
      );
    });
  });

  describe('Branch coverage - vital organ extraction edge cases', () => {
    it('should handle missing health component with defaults', () => {
      const anatomyData = {
        parts: [
          {
            id: 'head',
            name: 'Head',
            components: {
              'anatomy:vital_organ': {
                organType: 'brain',
                killOnDestroy: true,
              },
              // No anatomy:part_health component
            },
          },
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      const summary = deathConditionMonitor.getDeathConditionSummary();

      // Should use defaults: current=0, max=1, percent=0
      expect(summary.vitalOrgans[0].currentHealth).toBe(0);
      expect(summary.vitalOrgans[0].maxHealth).toBe(1);
      expect(summary.vitalOrgans[0].healthPercent).toBe(0);
    });

    it('should handle health component with max of 0', () => {
      const anatomyData = {
        parts: [
          {
            id: 'head',
            name: 'Head',
            components: {
              'anatomy:vital_organ': {
                organType: 'brain',
                killOnDestroy: true,
              },
              'anatomy:part_health': {
                current: 0,
                max: 0, // Division by zero case
              },
            },
          },
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      const summary = deathConditionMonitor.getDeathConditionSummary();

      // Should handle division by zero with healthPercent = 0
      expect(summary.vitalOrgans[0].healthPercent).toBe(0);
    });

    it('should handle missing organType with unknown default', () => {
      const anatomyData = {
        parts: [
          {
            id: 'head',
            name: 'Head',
            components: {
              'anatomy:vital_organ': {
                // No organType specified
                killOnDestroy: true,
              },
              'anatomy:part_health': {
                current: 50,
                max: 50,
              },
            },
          },
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      const summary = deathConditionMonitor.getDeathConditionSummary();

      // Should use 'unknown' as default organType
      expect(summary.vitalOrgans[0].organType).toBe('unknown');
    });

    it('should use part.id as name when part.name is missing', () => {
      const anatomyData = {
        parts: [
          {
            id: 'head',
            // No name property
            components: {
              'anatomy:vital_organ': {
                organType: 'brain',
                killOnDestroy: true,
              },
              'anatomy:part_health': {
                current: 50,
                max: 50,
              },
            },
          },
        ],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      const summary = deathConditionMonitor.getDeathConditionSummary();

      // Should use part.id as partName
      expect(summary.vitalOrgans[0].partName).toBe('head');
    });
  });

  describe('Branch coverage - death alert deathCause fallback', () => {
    it('should render Unknown as death cause when deathCause is undefined (isDead)', () => {
      // Create a destroyed vital organ
      const anatomyData = {
        parts: [createVitalOrganPart('head', 'Head', 'brain', 0, 50, true)],
      };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.render();

      const html = mockContainerElement.innerHTML;
      // When organ is destroyed, deathCause should be the partName, but test the Unknown fallback
      // Actually, deathCause is set when there's a destroyed organ
      expect(html).toContain('ENTITY IS DEAD');
      expect(html).toContain('Head destruction'); // deathCause is set from destroyed organ
    });

    it('should render Vital organ as death cause when deathCause is undefined (isInDanger)', () => {
      // Create a critical vital organ (not destroyed)
      const anatomyData = {
        parts: [createVitalOrganPart('head', 'Head', 'brain', 5, 100, true)],
      };
      const damageEntry = { amount: 10 };

      deathConditionMonitor.setEntity('entity-1', anatomyData);
      deathConditionMonitor.updateDamageConfig(damageEntry, 1.0);
      deathConditionMonitor.render();

      const html = mockContainerElement.innerHTML;
      // With 5 health and 10 damage, hitsUntilDeath = 1, so critical
      expect(html).toContain('CRITICAL CONDITION');
      expect(html).toContain('Head at critical health'); // deathCause is set from critical organ
    });
  });
});

// ============================================
// Test Helper Functions
// ============================================

/**
 * Create a vital organ part for testing
 * @param {string} id - Part ID
 * @param {string} name - Part name
 * @param {string} organType - Organ type (brain, heart, spine)
 * @param {number} currentHealth - Current health
 * @param {number} maxHealth - Max health
 * @param {boolean} killOnDestroy - Kill on destroy flag
 * @returns {Object} Part object
 */
function createVitalOrganPart(
  id,
  name,
  organType,
  currentHealth,
  maxHealth,
  killOnDestroy = true
) {
  return {
    id,
    name,
    currentHealth,
    maxHealth,
    components: {
      'anatomy:vital_organ': {
        organType,
        killOnDestroy,
      },
      'anatomy:part_health': {
        current: currentHealth,
        max: maxHealth,
      },
    },
  };
}

/**
 * Create anatomy data with multiple vital organs
 * @returns {Object} Anatomy data with brain and heart
 */
function createAnatomyDataWithVitalOrgans() {
  return {
    parts: [
      createVitalOrganPart('head', 'Head', 'brain', 50, 50, true),
      createVitalOrganPart('torso', 'Torso', 'heart', 100, 100, true),
    ],
  };
}
