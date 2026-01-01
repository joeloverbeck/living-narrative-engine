/**
 * @file MultiHitSimulator.test.js
 * @description Unit tests for MultiHitSimulator component
 */

import MultiHitSimulator from '../../../../src/domUI/damage-simulator/MultiHitSimulator.js';
import { jest } from '@jest/globals';

describe('MultiHitSimulator', () => {
  let mockLogger;
  let mockDamageExecutionService;
  let mockEventBus;
  let mockContainerElement;
  let simulator;

  const createMockContainerElement = () => ({
    appendChild: jest.fn(),
    querySelector: jest.fn().mockReturnValue(null),
    querySelectorAll: jest.fn().mockReturnValue([]),
    innerHTML: '',
  });

  const createMockParts = () => [
    { id: 'part-head', name: 'Head', weight: 2 },
    { id: 'part-torso', name: 'Torso', weight: 5 },
    { id: 'part-arm', name: 'Arm', weight: 3 },
  ];

  const createValidConfig = () => ({
    hitCount: 10,
    delayMs: 100,
    targetMode: 'random',
    focusPartId: null,
    damageEntry: { base_damage: 10, damageType: 'slashing' },
    multiplier: 1,
    entityId: 'entity-123',
  });

  beforeEach(() => {
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockDamageExecutionService = {
      applyDamage: jest.fn().mockResolvedValue({
        success: true,
        results: [
          {
            targetPartId: 'part-head',
            targetPartName: 'Head',
            damageDealt: 10,
            damageType: 'slashing',
            severity: 'moderate',
          },
        ],
        error: null,
      }),
      getTargetableParts: jest.fn().mockReturnValue(createMockParts()),
    };

    mockEventBus = {
      dispatch: jest.fn(),
      subscribe: jest.fn().mockReturnValue(() => {}),
    };

    mockContainerElement = createMockContainerElement();

    simulator = new MultiHitSimulator({
      containerElement: mockContainerElement,
      damageExecutionService: mockDamageExecutionService,
      eventBus: mockEventBus,
      logger: mockLogger,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    // Clean up any pending timers
    jest.useRealTimers();
  });

  describe('Constructor', () => {
    it('should validate required dependencies in constructor', () => {
      expect(
        () =>
          new MultiHitSimulator({
            damageExecutionService: mockDamageExecutionService,
            eventBus: mockEventBus,
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should throw if damageExecutionService is missing', () => {
      expect(
        () =>
          new MultiHitSimulator({
            containerElement: mockContainerElement,
            eventBus: mockEventBus,
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should throw if eventBus is missing', () => {
      expect(
        () =>
          new MultiHitSimulator({
            containerElement: mockContainerElement,
            damageExecutionService: mockDamageExecutionService,
            logger: mockLogger,
          })
      ).toThrow();
    });

    it('should throw if logger is missing', () => {
      expect(
        () =>
          new MultiHitSimulator({
            containerElement: mockContainerElement,
            damageExecutionService: mockDamageExecutionService,
            eventBus: mockEventBus,
          })
      ).toThrow();
    });

    it('should create simulator with all valid dependencies', () => {
      expect(simulator).toBeInstanceOf(MultiHitSimulator);
    });
  });

  describe('should validate hit count range', () => {
    it('should reject hit count below minimum', () => {
      expect(() =>
        simulator.configure({
          ...createValidConfig(),
          hitCount: 0,
        })
      ).toThrow('Hit count must be between 1 and 100');
    });

    it('should reject hit count above maximum', () => {
      expect(() =>
        simulator.configure({
          ...createValidConfig(),
          hitCount: 101,
        })
      ).toThrow('Hit count must be between 1 and 100');
    });

    it('should accept hit count at minimum', () => {
      expect(() =>
        simulator.configure({
          ...createValidConfig(),
          hitCount: 1,
        })
      ).not.toThrow();
    });

    it('should accept hit count at maximum', () => {
      expect(() =>
        simulator.configure({
          ...createValidConfig(),
          hitCount: 100,
        })
      ).not.toThrow();
    });

    it('should reject non-numeric hit count', () => {
      expect(() =>
        simulator.configure({
          ...createValidConfig(),
          hitCount: 'ten',
        })
      ).toThrow('Hit count must be between 1 and 100');
    });

    it('should reject delay below minimum', () => {
      expect(() =>
        simulator.configure({
          ...createValidConfig(),
          delayMs: -1,
        })
      ).toThrow('Delay must be between 0 and 1000ms');
    });

    it('should reject delay above maximum', () => {
      expect(() =>
        simulator.configure({
          ...createValidConfig(),
          delayMs: 1001,
        })
      ).toThrow('Delay must be between 0 and 1000ms');
    });

    it('should reject invalid target mode', () => {
      expect(() =>
        simulator.configure({
          ...createValidConfig(),
          targetMode: 'invalid',
        })
      ).toThrow('Target mode must be one of: random, round-robin, focus');
    });

    it('should require focusPartId for focus mode', () => {
      expect(() =>
        simulator.configure({
          ...createValidConfig(),
          targetMode: 'focus',
          focusPartId: null,
        })
      ).toThrow('Focus mode requires a focusPartId');
    });

    it('should require entityId', () => {
      expect(() =>
        simulator.configure({
          ...createValidConfig(),
          entityId: '',
        })
      ).toThrow('Entity ID is required');
    });

    it('should require damageEntry', () => {
      expect(() =>
        simulator.configure({
          ...createValidConfig(),
          damageEntry: null,
        })
      ).toThrow('Damage entry is required');
    });
  });

  describe('should execute configured number of hits', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('should execute exactly the configured number of hits', async () => {
      simulator.configure({
        ...createValidConfig(),
        hitCount: 5,
        delayMs: 0,
      });

      const runPromise = simulator.run();
      await jest.runAllTimersAsync();
      const result = await runPromise;

      expect(result.hitsExecuted).toBe(5);
      expect(mockDamageExecutionService.applyDamage).toHaveBeenCalledTimes(5);
    });

    it('should complete with the correct number of hits', async () => {
      simulator.configure({
        ...createValidConfig(),
        hitCount: 3,
        delayMs: 0,
      });

      const runPromise = simulator.run();
      await jest.runAllTimersAsync();
      const result = await runPromise;

      expect(result.completed).toBe(true);
      expect(result.hitsExecuted).toBe(3);
    });
  });

  describe('should respect delay between hits', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('should wait the configured delay between hits', async () => {
      simulator.configure({
        ...createValidConfig(),
        hitCount: 3,
        delayMs: 100,
      });

      const runPromise = simulator.run();

      // First hit executes immediately
      await jest.advanceTimersByTimeAsync(0);
      expect(mockDamageExecutionService.applyDamage).toHaveBeenCalledTimes(1);

      // Wait for delay
      await jest.advanceTimersByTimeAsync(100);
      expect(mockDamageExecutionService.applyDamage).toHaveBeenCalledTimes(2);

      // Wait for next delay
      await jest.advanceTimersByTimeAsync(100);
      expect(mockDamageExecutionService.applyDamage).toHaveBeenCalledTimes(3);

      await runPromise;
    });

    it('should not delay after the last hit', async () => {
      simulator.configure({
        ...createValidConfig(),
        hitCount: 2,
        delayMs: 500,
      });

      const runPromise = simulator.run();
      await jest.runAllTimersAsync();
      await runPromise;

      // Should only have 1 delay (between hit 1 and 2), not after hit 2
      expect(mockDamageExecutionService.applyDamage).toHaveBeenCalledTimes(2);
    });
  });

  describe('should support random targeting mode', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('should use random part selection', async () => {
      simulator.configure({
        ...createValidConfig(),
        hitCount: 10,
        delayMs: 0,
        targetMode: 'random',
      });

      const runPromise = simulator.run();
      await jest.runAllTimersAsync();
      const result = await runPromise;

      // All hits should call applyDamage with a targetPartId from the parts list
      const parts = createMockParts();
      const partIds = parts.map((p) => p.id);

      mockDamageExecutionService.applyDamage.mock.calls.forEach((call) => {
        const targetPartId = call[0].targetPartId;
        expect(partIds).toContain(targetPartId);
      });

      expect(result.hitsExecuted).toBe(10);
    });
  });

  describe('should support round-robin targeting mode', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('should cycle through parts in order', async () => {
      simulator.configure({
        ...createValidConfig(),
        hitCount: 6,
        delayMs: 0,
        targetMode: 'round-robin',
      });

      const runPromise = simulator.run();
      await jest.runAllTimersAsync();
      await runPromise;

      const calls = mockDamageExecutionService.applyDamage.mock.calls;
      const parts = createMockParts();

      // Should cycle: head, torso, arm, head, torso, arm
      expect(calls[0][0].targetPartId).toBe(parts[0].id);
      expect(calls[1][0].targetPartId).toBe(parts[1].id);
      expect(calls[2][0].targetPartId).toBe(parts[2].id);
      expect(calls[3][0].targetPartId).toBe(parts[0].id);
      expect(calls[4][0].targetPartId).toBe(parts[1].id);
      expect(calls[5][0].targetPartId).toBe(parts[2].id);
    });
  });

  describe('should support focus single part mode', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('should target only the focus part', async () => {
      const focusPartId = 'part-head';

      simulator.configure({
        ...createValidConfig(),
        hitCount: 5,
        delayMs: 0,
        targetMode: 'focus',
        focusPartId,
      });

      const runPromise = simulator.run();
      await jest.runAllTimersAsync();
      await runPromise;

      mockDamageExecutionService.applyDamage.mock.calls.forEach((call) => {
        expect(call[0].targetPartId).toBe(focusPartId);
      });
    });
  });

  describe('should stop immediately when requested', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('should stop execution when stop() is called', async () => {
      simulator.configure({
        ...createValidConfig(),
        hitCount: 100,
        delayMs: 50,
      });

      const runPromise = simulator.run();

      // Execute first hit
      await jest.advanceTimersByTimeAsync(0);
      expect(mockDamageExecutionService.applyDamage).toHaveBeenCalledTimes(1);

      // Stop the simulation
      simulator.stop();

      // Advance all timers
      await jest.runAllTimersAsync();
      const result = await runPromise;

      expect(result.completed).toBe(false);
      expect(result.stoppedReason).toBe('user_stopped');
      expect(result.hitsExecuted).toBeLessThan(100);
    });

    it('should clear delay timeout when stopped', async () => {
      simulator.configure({
        ...createValidConfig(),
        hitCount: 10,
        delayMs: 1000,
      });

      const runPromise = simulator.run();

      // Wait for first hit to complete
      await jest.advanceTimersByTimeAsync(0);

      // Stop mid-delay
      simulator.stop();

      // Complete all timers
      await jest.runAllTimersAsync();
      const result = await runPromise;

      expect(result.completed).toBe(false);
      expect(result.hitsExecuted).toBe(1);
    });
  });

  describe('should track progress correctly', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('should report correct progress at each step', async () => {
      simulator.configure({
        ...createValidConfig(),
        hitCount: 4,
        delayMs: 0,
      });

      const runPromise = simulator.run();

      // Check initial state
      expect(simulator.getProgress().status).toBe('running');

      await jest.runAllTimersAsync();
      await runPromise;

      expect(simulator.getProgress().status).toBe('completed');
      expect(simulator.getProgress().currentHit).toBe(4);
      expect(simulator.getProgress().totalHits).toBe(4);
      expect(simulator.getProgress().percentComplete).toBe(100);
    });

    it('should start with idle status', () => {
      expect(simulator.getProgress().status).toBe('idle');
    });

    it('should report running status during execution', async () => {
      jest.useFakeTimers();

      simulator.configure({
        ...createValidConfig(),
        hitCount: 5,
        delayMs: 100,
      });

      const runPromise = simulator.run();

      expect(simulator.isRunning()).toBe(true);
      expect(simulator.getProgress().status).toBe('running');

      await jest.runAllTimersAsync();
      await runPromise;

      expect(simulator.isRunning()).toBe(false);
    });
  });

  describe('should emit progress events', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('should emit progress event after each hit', async () => {
      simulator.configure({
        ...createValidConfig(),
        hitCount: 3,
        delayMs: 0,
      });

      const runPromise = simulator.run();
      await jest.runAllTimersAsync();
      await runPromise;

      const progressCalls = mockEventBus.dispatch.mock.calls.filter(
        (call) => call[0] === MultiHitSimulator.SIMULATION_EVENTS.PROGRESS
      );

      expect(progressCalls.length).toBe(3);
      expect(progressCalls[0][1].currentHit).toBe(1);
      expect(progressCalls[1][1].currentHit).toBe(2);
      expect(progressCalls[2][1].currentHit).toBe(3);
    });

    it('should emit complete event on successful completion', async () => {
      simulator.configure({
        ...createValidConfig(),
        hitCount: 2,
        delayMs: 0,
      });

      const runPromise = simulator.run();
      await jest.runAllTimersAsync();
      await runPromise;

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        MultiHitSimulator.SIMULATION_EVENTS.COMPLETE,
        expect.objectContaining({
          completed: true,
          hitsExecuted: 2,
        })
      );
    });

    it('should emit stopped event when stopped by user', async () => {
      simulator.configure({
        ...createValidConfig(),
        hitCount: 100,
        delayMs: 50,
      });

      const runPromise = simulator.run();

      await jest.advanceTimersByTimeAsync(0);
      simulator.stop();

      await jest.runAllTimersAsync();
      await runPromise;

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        MultiHitSimulator.SIMULATION_EVENTS.STOPPED,
        expect.objectContaining({
          completed: false,
          stoppedReason: 'user_stopped',
        })
      );
    });
  });

  describe('should generate summary statistics', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('should calculate total damage correctly', async () => {
      mockDamageExecutionService.applyDamage.mockResolvedValue({
        success: true,
        results: [{ damageDealt: 15, targetPartId: 'part-head' }],
        error: null,
      });

      simulator.configure({
        ...createValidConfig(),
        hitCount: 3,
        delayMs: 0,
      });

      const runPromise = simulator.run();
      await jest.runAllTimersAsync();
      const result = await runPromise;

      expect(result.totalDamage).toBe(45); // 3 hits * 15 damage
    });

    it('should track hits per part', async () => {
      let hitCount = 0;
      mockDamageExecutionService.applyDamage.mockImplementation(() => {
        hitCount++;
        const partId = hitCount <= 2 ? 'part-head' : 'part-torso';
        return Promise.resolve({
          success: true,
          results: [{ damageDealt: 10, targetPartId: partId }],
          error: null,
        });
      });

      simulator.configure({
        ...createValidConfig(),
        hitCount: 4,
        delayMs: 0,
      });

      const runPromise = simulator.run();
      await jest.runAllTimersAsync();
      const result = await runPromise;

      expect(result.partHitCounts['part-head']).toBe(2);
      expect(result.partHitCounts['part-torso']).toBe(2);
    });

    it('should track duration correctly', async () => {
      simulator.configure({
        ...createValidConfig(),
        hitCount: 3,
        delayMs: 100,
      });

      const runPromise = simulator.run();
      await jest.runAllTimersAsync();
      const result = await runPromise;

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('should track effects triggered', async () => {
      let hitCount = 0;
      mockDamageExecutionService.applyDamage.mockImplementation(() => {
        hitCount++;
        const severity = hitCount === 1 ? 'moderate' : 'severe';
        return Promise.resolve({
          success: true,
          results: [
            { damageDealt: 10, targetPartId: 'part-head', severity },
          ],
          error: null,
        });
      });

      simulator.configure({
        ...createValidConfig(),
        hitCount: 3,
        delayMs: 0,
      });

      const runPromise = simulator.run();
      await jest.runAllTimersAsync();
      const result = await runPromise;

      expect(result.effectsTriggered).toContain('moderate');
      expect(result.effectsTriggered).toContain('severe');
    });
  });

  describe('should handle errors during simulation', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('should emit error event on failure', async () => {
      mockDamageExecutionService.applyDamage.mockRejectedValueOnce(
        new Error('Damage application failed')
      );

      simulator.configure({
        ...createValidConfig(),
        hitCount: 3,
        delayMs: 0,
      });

      // No timers needed - mock rejection happens immediately with delayMs: 0
      await expect(simulator.run()).rejects.toThrow('Damage application failed');

      expect(mockEventBus.dispatch).toHaveBeenCalledWith(
        MultiHitSimulator.SIMULATION_EVENTS.ERROR,
        expect.objectContaining({
          error: 'Damage application failed',
        })
      );
    });

    it('should log error on failure', async () => {
      mockDamageExecutionService.applyDamage.mockRejectedValueOnce(
        new Error('Test error')
      );

      simulator.configure({
        ...createValidConfig(),
        hitCount: 2,
        delayMs: 0,
      });

      // No timers needed - mock rejection happens immediately with delayMs: 0
      await expect(simulator.run()).rejects.toThrow('Test error');

      expect(mockLogger.error).toHaveBeenCalledWith(
        '[MultiHitSimulator] Simulation error:',
        expect.any(Error)
      );
    });

    it('should reset running state after error', async () => {
      mockDamageExecutionService.applyDamage.mockRejectedValueOnce(
        new Error('Test error')
      );

      simulator.configure({
        ...createValidConfig(),
        hitCount: 2,
        delayMs: 0,
      });

      // No timers needed - mock rejection happens immediately with delayMs: 0
      await expect(simulator.run()).rejects.toThrow();

      expect(simulator.isRunning()).toBe(false);
    });
  });

  describe('should prevent concurrent simulations', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('should throw if run() called while already running', async () => {
      simulator.configure({
        ...createValidConfig(),
        hitCount: 10,
        delayMs: 100,
      });

      const runPromise = simulator.run();

      // Try to run again while first is running
      await expect(simulator.run()).rejects.toThrow(
        'Simulation already running'
      );

      simulator.stop();
      await jest.runAllTimersAsync();
      await runPromise;
    });

    it('should throw if not configured before running', async () => {
      const newSimulator = new MultiHitSimulator({
        containerElement: mockContainerElement,
        damageExecutionService: mockDamageExecutionService,
        eventBus: mockEventBus,
        logger: mockLogger,
      });

      await expect(newSimulator.run()).rejects.toThrow(
        'Simulation not configured'
      );
    });
  });

  describe('should reset state between simulations', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    it('should reset progress between runs', async () => {
      simulator.configure({
        ...createValidConfig(),
        hitCount: 5,
        delayMs: 0,
      });

      // First run
      const firstRunPromise = simulator.run();
      await jest.runAllTimersAsync();
      await firstRunPromise;

      expect(simulator.getProgress().currentHit).toBe(5);

      // Second run
      simulator.configure({
        ...createValidConfig(),
        hitCount: 3,
        delayMs: 0,
      });

      const secondRunPromise = simulator.run();
      await jest.runAllTimersAsync();
      const result = await secondRunPromise;

      expect(result.hitsExecuted).toBe(3);
      expect(simulator.getProgress().currentHit).toBe(3);
    });

    it('should reset round-robin index between runs', async () => {
      simulator.configure({
        ...createValidConfig(),
        hitCount: 3,
        delayMs: 0,
        targetMode: 'round-robin',
      });

      // First run
      const firstRunPromise = simulator.run();
      await jest.runAllTimersAsync();
      await firstRunPromise;

      // Clear mocks but keep implementation
      mockDamageExecutionService.applyDamage.mockClear();

      // Second run should start from first part again
      simulator.configure({
        ...createValidConfig(),
        hitCount: 2,
        delayMs: 0,
        targetMode: 'round-robin',
      });

      const secondRunPromise = simulator.run();
      await jest.runAllTimersAsync();
      await secondRunPromise;

      const parts = createMockParts();
      const calls = mockDamageExecutionService.applyDamage.mock.calls;

      // Should start from first part again
      expect(calls[0][0].targetPartId).toBe(parts[0].id);
      expect(calls[1][0].targetPartId).toBe(parts[1].id);
    });

    it('should allow running again after completion', async () => {
      simulator.configure({
        ...createValidConfig(),
        hitCount: 2,
        delayMs: 0,
      });

      // First run
      const firstRunPromise = simulator.run();
      await jest.runAllTimersAsync();
      await firstRunPromise;

      expect(simulator.isRunning()).toBe(false);

      // Second run should work
      simulator.configure({
        ...createValidConfig(),
        hitCount: 2,
        delayMs: 0,
      });

      const secondRunPromise = simulator.run();
      await jest.runAllTimersAsync();
      const result = await secondRunPromise;

      expect(result.completed).toBe(true);
    });
  });

  describe('Static constants', () => {
    it('should expose SIMULATION_EVENTS', () => {
      expect(MultiHitSimulator.SIMULATION_EVENTS).toBeDefined();
      expect(MultiHitSimulator.SIMULATION_EVENTS.PROGRESS).toBe(
        'damage-simulator:simulation-progress'
      );
      expect(MultiHitSimulator.SIMULATION_EVENTS.COMPLETE).toBe(
        'damage-simulator:simulation-complete'
      );
      expect(MultiHitSimulator.SIMULATION_EVENTS.STOPPED).toBe(
        'damage-simulator:simulation-stopped'
      );
      expect(MultiHitSimulator.SIMULATION_EVENTS.ERROR).toBe(
        'damage-simulator:simulation-error'
      );
    });

    it('should expose DEFAULTS', () => {
      expect(MultiHitSimulator.DEFAULTS).toBeDefined();
      expect(MultiHitSimulator.DEFAULTS.HIT_COUNT).toBe(10);
      expect(MultiHitSimulator.DEFAULTS.DELAY_MS).toBe(100);
      expect(MultiHitSimulator.DEFAULTS.TARGET_MODE).toBe('random');
      expect(MultiHitSimulator.DEFAULTS.MIN_HITS).toBe(1);
      expect(MultiHitSimulator.DEFAULTS.MAX_HITS).toBe(100);
      expect(MultiHitSimulator.DEFAULTS.MIN_DELAY).toBe(0);
      expect(MultiHitSimulator.DEFAULTS.MAX_DELAY).toBe(1000);
    });

    it('should expose TARGET_MODES', () => {
      expect(MultiHitSimulator.TARGET_MODES).toBeDefined();
      expect(MultiHitSimulator.TARGET_MODES).toContain('random');
      expect(MultiHitSimulator.TARGET_MODES).toContain('round-robin');
      expect(MultiHitSimulator.TARGET_MODES).toContain('focus');
    });
  });

  describe('setEntityConfig', () => {
    it('should set entity configuration from external source', () => {
      simulator.setEntityConfig({
        entityId: 'test-entity',
        damageEntry: { base_damage: 20 },
        multiplier: 1.5,
      });

      expect(mockDamageExecutionService.getTargetableParts).toHaveBeenCalledWith(
        'test-entity'
      );
    });

    it('should use default multiplier if not provided', () => {
      simulator.setEntityConfig({
        entityId: 'test-entity',
        damageEntry: { base_damage: 10 },
      });

      // Configure should work with the defaults
      expect(() =>
        simulator.configure({
          hitCount: 5,
          delayMs: 50,
          targetMode: 'random',
          focusPartId: null,
          damageEntry: { base_damage: 10 },
          multiplier: 1,
          entityId: 'test-entity',
        })
      ).not.toThrow();
    });
  });

  describe('render', () => {
    it('should render HTML to container', () => {
      simulator.render();

      expect(mockContainerElement.innerHTML).toContain(
        'ds-multi-hit-simulator'
      );
      expect(mockContainerElement.innerHTML).toContain('Multi-Hit Simulation');
      expect(mockContainerElement.innerHTML).toContain('ds-hit-count');
      expect(mockContainerElement.innerHTML).toContain('ds-hit-delay-slider');
      expect(mockContainerElement.innerHTML).toContain('ds-sim-run-btn');
      expect(mockContainerElement.innerHTML).toContain('ds-sim-stop-btn');
    });

    it('should include target mode options', () => {
      simulator.render();

      expect(mockContainerElement.innerHTML).toContain('random');
      expect(mockContainerElement.innerHTML).toContain('round-robin');
      expect(mockContainerElement.innerHTML).toContain('focus');
    });

    it('should include progress and results sections', () => {
      simulator.render();

      expect(mockContainerElement.innerHTML).toContain('ds-sim-progress');
      expect(mockContainerElement.innerHTML).toContain('ds-sim-results');
      expect(mockContainerElement.innerHTML).toContain('ds-result-hits');
      expect(mockContainerElement.innerHTML).toContain('ds-result-damage');
      expect(mockContainerElement.innerHTML).toContain('ds-result-duration');
      expect(mockContainerElement.innerHTML).toContain('ds-result-avg');
    });
  });

  describe('getTargetableParts', () => {
    it('should return copy of targetable parts', () => {
      simulator.setEntityConfig({
        entityId: 'test-entity',
        damageEntry: { base_damage: 10 },
      });

      const parts = simulator.getTargetableParts();

      expect(parts).toHaveLength(3);
      expect(parts[0]).toEqual({
        id: 'part-head',
        name: 'Head',
        weight: 2,
      });
    });

    it('should return empty array if no entity configured', () => {
      const parts = simulator.getTargetableParts();
      expect(parts).toEqual([]);
    });
  });
});
