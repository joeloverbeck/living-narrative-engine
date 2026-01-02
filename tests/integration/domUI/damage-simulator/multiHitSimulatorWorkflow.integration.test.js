/**
 * @file Integration tests for MultiHitSimulator workflow scenarios.
 * @see specs/multi-hit-simulator-robustness.md
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import MultiHitSimulator from '../../../../src/domUI/damage-simulator/MultiHitSimulator.js';

const DEFAULT_PARTS = [
  { id: 'part-1', name: 'Head', weight: 1 },
  { id: 'part-2', name: 'Torso', weight: 2 },
  { id: 'part-3', name: 'Arms', weight: 1 },
];

function createDependencies({ parts = DEFAULT_PARTS, applyDamageImpl } = {}) {
  const events = [];
  const eventBus = {
    dispatch: jest.fn((type, payload) => {
      events.push({ type, payload });
    }),
  };
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
  const damageExecutionService = {
    getTargetableParts: jest.fn(() => parts),
    applyDamage: jest.fn(async (args) => {
      if (applyDamageImpl) {
        return applyDamageImpl(args);
      }
      return {
        success: true,
        results: [
          {
            damageDealt: 1,
            targetPartId: args.targetPartId ?? null,
            severity: null,
          },
        ],
      };
    }),
  };

  return { eventBus, logger, damageExecutionService, events };
}

function createContainer() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  return container;
}

describe('MultiHitSimulator - Integration Tests', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    jest.useRealTimers();
  });

  describe('Full simulation workflow', () => {
    it('should complete Configure -> Run -> Events -> UI update cycle', async () => {
      const { eventBus, logger, damageExecutionService, events } =
        createDependencies({
          applyDamageImpl: async ({ targetPartId }) => ({
            success: true,
            results: [
              {
                damageDealt: 7,
                targetPartId,
                severity: null,
              },
            ],
          }),
        });
      const container = createContainer();
      const simulator = new MultiHitSimulator({
        containerElement: container,
        damageExecutionService,
        eventBus,
        logger,
      });

      simulator.render();
      simulator.configure({
        hitCount: 5,
        delayMs: 10,
        targetMode: 'round-robin',
        focusPartId: null,
        damageEntry: { base_damage: 10 },
        multiplier: 1,
        entityId: 'entity-1',
      });

      const runPromise = simulator.run();
      await jest.runAllTimersAsync();
      const results = await runPromise;

      const progressEvents = events.filter(
        (event) => event.type === MultiHitSimulator.SIMULATION_EVENTS.PROGRESS
      );
      const completeEvents = events.filter(
        (event) => event.type === MultiHitSimulator.SIMULATION_EVENTS.COMPLETE
      );

      expect(progressEvents).toHaveLength(5);
      expect(completeEvents).toHaveLength(1);
      expect(results.completed).toBe(true);
      expect(results.hitsExecuted).toBe(5);

      expect(container.querySelector('.ds-progress-text').textContent).toBe(
        '5 / 5 hits'
      );
      expect(container.querySelector('#ds-result-hits').textContent).toBe('5');
      expect(container.querySelector('#ds-result-damage').textContent).toBe(
        '35.0'
      );
      expect(container.querySelector('#ds-result-avg').textContent).toBe(
        '7.00'
      );
    });
  });

  describe('Stop during execution', () => {
    it('should emit STOPPED event with partial results and clean up', async () => {
      const { eventBus, logger, damageExecutionService, events } =
        createDependencies();
      const container = createContainer();
      const simulator = new MultiHitSimulator({
        containerElement: container,
        damageExecutionService,
        eventBus,
        logger,
      });

      simulator.render();
      simulator.configure({
        hitCount: 10,
        delayMs: 50,
        targetMode: 'round-robin',
        focusPartId: null,
        damageEntry: { base_damage: 10 },
        multiplier: 1,
        entityId: 'entity-1',
      });

      let resolveDamage;
      damageExecutionService.applyDamage.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveDamage = resolve;
          })
      );

      const runPromise = simulator.run();
      await Promise.resolve();

      resolveDamage({
        success: true,
        results: [
          {
            damageDealt: 1,
            targetPartId: 'part-1',
            severity: null,
          },
        ],
      });
      await Promise.resolve();

      expect(jest.getTimerCount()).toBe(1);
      simulator.stop();
      expect(jest.getTimerCount()).toBe(0);

      await jest.runAllTimersAsync();
      const results = await runPromise;

      const completeEvents = events.filter(
        (event) => event.type === MultiHitSimulator.SIMULATION_EVENTS.COMPLETE
      );
      const stoppedEvents = events.filter(
        (event) => event.type === MultiHitSimulator.SIMULATION_EVENTS.STOPPED
      );

      expect(completeEvents).toHaveLength(0);
      expect(stoppedEvents).toHaveLength(1);
      expect(results.completed).toBe(false);
      expect(results.hitsExecuted).toBeGreaterThanOrEqual(1);
      expect(results.hitsExecuted).toBeLessThan(10);
      expect(simulator.isRunning()).toBe(false);
    });
  });

  describe('Multiple consecutive runs', () => {
    it('should reset state between runs and maintain consistency', async () => {
      const parts = [
        { id: 'part-1', name: 'A', weight: 1 },
        { id: 'part-2', name: 'B', weight: 1 },
      ];
      const { eventBus, logger, damageExecutionService } = createDependencies({
        parts,
      });
      const targets = [];
      damageExecutionService.applyDamage.mockImplementation(
        async ({ targetPartId }) => {
          targets.push(targetPartId);
          return {
            success: true,
            results: [
              {
                damageDealt: 2,
                targetPartId,
                severity: null,
              },
            ],
          };
        }
      );

      const container = createContainer();
      const simulator = new MultiHitSimulator({
        containerElement: container,
        damageExecutionService,
        eventBus,
        logger,
      });

      simulator.render();
      simulator.configure({
        hitCount: 3,
        delayMs: 0,
        targetMode: 'round-robin',
        focusPartId: null,
        damageEntry: { base_damage: 10 },
        multiplier: 1,
        entityId: 'entity-1',
      });

      const resultsOne = await simulator.run();
      expect(resultsOne.hitsExecuted).toBe(3);

      simulator.configure({
        hitCount: 2,
        delayMs: 0,
        targetMode: 'round-robin',
        focusPartId: null,
        damageEntry: { base_damage: 10 },
        multiplier: 1,
        entityId: 'entity-1',
      });

      const runTwoPromise = simulator.run();
      expect(simulator.getProgress().currentHit).toBe(0);
      const resultsTwo = await runTwoPromise;

      expect(resultsTwo.hitsExecuted).toBe(2);
      expect(resultsTwo.partHitCounts).toEqual({ 'part-1': 1, 'part-2': 1 });

      expect(targets.slice(0, 3)).toEqual(['part-1', 'part-2', 'part-1']);
      expect(targets.slice(3)).toEqual(['part-1', 'part-2']);
    });
  });

  describe('Focus mode end-to-end', () => {
    it('should consistently target the specified part', async () => {
      const focusPartId = 'part-3';
      const parts = [
        { id: 'part-1', name: 'A', weight: 1 },
        { id: 'part-2', name: 'B', weight: 1 },
        { id: 'part-3', name: 'C', weight: 1 },
        { id: 'part-4', name: 'D', weight: 1 },
        { id: 'part-5', name: 'E', weight: 1 },
      ];
      const { eventBus, logger, damageExecutionService } = createDependencies({
        parts,
      });
      const targets = [];
      damageExecutionService.applyDamage.mockImplementation(
        async ({ targetPartId }) => {
          targets.push(targetPartId);
          return {
            success: true,
            results: [
              {
                damageDealt: 3,
                targetPartId,
                severity: null,
              },
            ],
          };
        }
      );

      const container = createContainer();
      const simulator = new MultiHitSimulator({
        containerElement: container,
        damageExecutionService,
        eventBus,
        logger,
      });

      simulator.render();
      simulator.configure({
        hitCount: 10,
        delayMs: 0,
        targetMode: 'focus',
        focusPartId,
        damageEntry: { base_damage: 10 },
        multiplier: 1,
        entityId: 'entity-1',
      });

      const results = await simulator.run();

      expect(results.partHitCounts).toEqual({ [focusPartId]: 10 });
      expect(Object.keys(results.partHitCounts)).toHaveLength(1);
      expect(targets).toEqual(Array(10).fill(focusPartId));
    });
  });
});
