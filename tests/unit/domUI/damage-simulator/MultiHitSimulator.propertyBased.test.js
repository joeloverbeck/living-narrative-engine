/**
 * @file Property-based tests for MultiHitSimulator
 * Uses fast-check to verify invariants across random inputs.
 * @see specs/multi-hit-simulator-robustness.md
 */

jest.setTimeout(30000);

import { describe, it, expect, jest } from '@jest/globals';
import fc from 'fast-check';
import MultiHitSimulator from '../../../../src/domUI/damage-simulator/MultiHitSimulator.js';

const createMockContainerElement = () => ({
  appendChild: jest.fn(),
  querySelector: jest.fn().mockReturnValue(null),
  querySelectorAll: jest.fn().mockReturnValue([]),
  innerHTML: '',
});

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createMockEventBus = (progressEvents) => ({
  dispatch: jest.fn((eventType, payload) => {
    if (eventType === MultiHitSimulator.SIMULATION_EVENTS.PROGRESS) {
      progressEvents.push(payload);
    }
  }),
});

const createMockDamageExecutionService = (parts) => ({
  applyDamage: jest.fn().mockImplementation(async ({ targetPartId }) => ({
    success: true,
    results: [
      {
        targetPartId: targetPartId ?? (parts[0]?.id ?? 'unknown'),
        targetPartName: 'Part',
        damageDealt: 1,
        damageType: 'blunt',
        severity: 'minor',
      },
    ],
    error: null,
  })),
  getTargetableParts: jest.fn().mockReturnValue(parts),
});

const createValidConfig = (overrides = {}) => ({
  hitCount: 10,
  delayMs: 0,
  targetMode: 'random',
  focusPartId: null,
  damageEntry: { base_damage: 10, damageType: 'slashing' },
  multiplier: 1,
  entityId: 'entity-123',
  ...overrides,
});

const createPartsFromIds = (partIds) =>
  partIds.map((id, index) => ({
    id,
    name: `Part ${index + 1}`,
    weight: 1,
  }));

const FORBIDDEN_PART_IDS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'toString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
]);

const safePartIdArb = fc
  .stringMatching(/^[a-z][a-z0-9-]{0,10}$/)
  .filter((value) => !FORBIDDEN_PART_IDS.has(value));

describe('MultiHitSimulator - Property-Based Tests', () => {
  it('hitsExecuted matches hitCount when completed', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 100 }), async (hitCount) => {
        const progressEvents = [];
        const parts = createPartsFromIds(['part-a']);
        const simulator = new MultiHitSimulator({
          containerElement: createMockContainerElement(),
          damageExecutionService: createMockDamageExecutionService(parts),
          eventBus: createMockEventBus(progressEvents),
          logger: createMockLogger(),
        });

        simulator.configure(
          createValidConfig({
            hitCount,
            delayMs: 0,
            targetMode: 'random',
          })
        );

        const result = await simulator.run();

        expect(result.completed).toBe(true);
        expect(result.hitsExecuted).toBe(hitCount);
      })
    );
  });

  it('percentComplete never decreases during a run', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 20 }), async (hitCount) => {
        const progressEvents = [];
        const parts = createPartsFromIds(['part-a', 'part-b']);
        const simulator = new MultiHitSimulator({
          containerElement: createMockContainerElement(),
          damageExecutionService: createMockDamageExecutionService(parts),
          eventBus: createMockEventBus(progressEvents),
          logger: createMockLogger(),
        });

        simulator.configure(
          createValidConfig({
            hitCount,
            delayMs: 0,
            targetMode: 'random',
          })
        );

        await simulator.run();

        for (let i = 1; i < progressEvents.length; i++) {
          expect(progressEvents[i].percentComplete).toBeGreaterThanOrEqual(
            progressEvents[i - 1].percentComplete
          );
        }
      })
    );
  });

  it('round-robin targeting hits each part once per cycle', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.uniqueArray(safePartIdArb, {
          minLength: 2,
          maxLength: 10,
        }),
        async (partIds) => {
          const progressEvents = [];
          const parts = createPartsFromIds(partIds);
          const simulator = new MultiHitSimulator({
            containerElement: createMockContainerElement(),
            damageExecutionService: createMockDamageExecutionService(parts),
            eventBus: createMockEventBus(progressEvents),
            logger: createMockLogger(),
          });

          simulator.configure(
            createValidConfig({
              hitCount: partIds.length,
              delayMs: 0,
              targetMode: 'round-robin',
            })
          );

          const result = await simulator.run();

          partIds.forEach((partId) => {
            expect(result.partHitCounts[partId]).toBe(1);
          });
        }
      )
    );
  });

  it('duration accounts for configured delays', async () => {
    jest.useFakeTimers();

    try {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 10, max: 100 }),
          async (hitCount, delayMs) => {
            const progressEvents = [];
            const parts = createPartsFromIds(['part-a', 'part-b']);
            const simulator = new MultiHitSimulator({
              containerElement: createMockContainerElement(),
              damageExecutionService: createMockDamageExecutionService(parts),
              eventBus: createMockEventBus(progressEvents),
              logger: createMockLogger(),
            });

            simulator.configure(
              createValidConfig({
                hitCount,
                delayMs,
                targetMode: 'random',
              })
            );

            const runPromise = simulator.run();
            await jest.runAllTimersAsync();
            const result = await runPromise;
            const expectedMinDuration = delayMs * Math.max(hitCount - 1, 0);

            expect(result.completed).toBe(true);
            expect(result.durationMs).toBeGreaterThanOrEqual(expectedMinDuration);
          }
        )
      );
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
    }
  });
});
