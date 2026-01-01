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

    mockContainerElement = {
      innerHTML: '',
      appendChild: jest.fn(),
      querySelector: jest.fn().mockReturnValue(null),
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
