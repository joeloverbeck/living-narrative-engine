/**
 * @jest-environment node
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import DamageResolutionService from '../../../../src/logic/services/damageResolutionService.js';

const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';
const PART_COMPONENT_ID = 'anatomy:part';
const NAME_COMPONENT_ID = 'core:name';
const GENDER_COMPONENT_ID = 'core:gender';
const POSITION_COMPONENT_ID = 'core:position';

describe('DamageResolutionService Tracing', () => {
  /** @type {ReturnType<typeof createService>} */ let service;
  /** @type {object} */ let executionContext;
  /** @type {jest.Mocked<any>} */ let entityManager;
  /** @type {jest.Mocked<any>} */ let dispatcher;
  /** @type {jest.Mocked<any>} */ let damageAccumulator;
  /** @type {jest.Mocked<any>} */ let damageNarrativeComposer;
  /** @type {jest.Mocked<any>} */ let damageTypeEffectsService;
  /** @type {jest.Mocked<any>} */ let damagePropagationService;
  /** @type {jest.Mocked<any>} */ let deathCheckService;

  const createService = () => {
    const log = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    entityManager = {
      getComponentData: jest.fn(),
      hasComponent: jest.fn(),
      addComponent: jest.fn(),
    };

    dispatcher = {
      dispatch: jest.fn(),
    };

    damageTypeEffectsService = {
      applyEffectsForDamage: jest.fn(),
    };

    damagePropagationService = {
      propagateDamage: jest.fn().mockReturnValue([]),
    };

    deathCheckService = {
      evaluateDeathConditions: jest.fn().mockReturnValue({
        isDead: false,
        isDying: false,
        shouldFinalize: false,
      }),
      finalizeDeathFromEvaluation: jest.fn(),
    };

    damageAccumulator = {
      createSession: jest
        .fn()
        .mockReturnValue({ entries: [], pendingEvents: [] }),
      recordDamage: jest.fn(),
      queueEvent: jest.fn(),
      finalize: jest
        .fn()
        .mockReturnValue({ entries: [{ amount: 5 }], pendingEvents: [] }),
    };

    damageNarrativeComposer = {
      compose: jest.fn().mockReturnValue('Ouch!'),
    };

    return new DamageResolutionService({
      logger: log,
      entityManager,
      safeEventDispatcher: dispatcher,
      damageTypeEffectsService,
      damagePropagationService,
      deathCheckService,
      damageAccumulator,
      damageNarrativeComposer,
    });
  };

  const seedComponentData = () => {
    entityManager.hasComponent.mockReturnValue(true);
    entityManager.getComponentData.mockImplementation(
      (entityId, componentId) => {
        if (componentId === PART_HEALTH_COMPONENT_ID)
          return { currentHealth: 10, maxHealth: 10, state: 'healthy' };
        if (componentId === PART_COMPONENT_ID)
          return { subType: 'torso', ownerEntityId: 'entity-1' };
        if (componentId === POSITION_COMPONENT_ID)
          return { locationId: 'loc-1' };
        return {};
      }
    );
  };

  beforeEach(() => {
    executionContext = {};
    service = createService();
    seedComponentData();
  });

  it('populates executionContext.trace when enableTrace is true', async () => {
    executionContext.enableTrace = true;

    await service.resolve({
      entityId: 'entity-1',
      partId: 'part-1',
      finalDamageEntry: { name: 'blunt', amount: 5 },
      executionContext,
      isTopLevel: true,
      applyDamage: jest.fn(),
    });

    expect(executionContext.trace).toBeDefined();
    expect(Array.isArray(executionContext.trace)).toBe(true);
    expect(executionContext.trace.length).toBeGreaterThan(0);

    const phases = executionContext.trace.map((t) => t.phase);
    expect(phases).toContain('init');
    expect(phases).toContain('health_update');
    expect(phases).toContain('effects_applied');
    expect(phases).toContain('propagation_start');
    expect(phases).toContain('death_check');
    expect(phases).toContain('finalization');
    expect(phases).toContain('narrative');
  });

  it('does not create trace when enableTrace is undefined/false', async () => {
    await service.resolve({
      entityId: 'entity-1',
      partId: 'part-1',
      finalDamageEntry: { name: 'blunt', amount: 5 },
      executionContext,
      isTopLevel: true,
      applyDamage: jest.fn(),
    });

    expect(executionContext.trace).toBeUndefined();
  });

  it('traces skipped damage due to non-positive amount', async () => {
    executionContext.enableTrace = true;
    await service.resolve({
      entityId: 'entity-1',
      partId: 'part-1',
      finalDamageEntry: { name: 'blunt', amount: 0 },
      executionContext,
    });

    expect(executionContext.trace).toBeDefined();
    const phases = executionContext.trace.map((t) => t.phase);
    expect(phases).toContain('skip');
  });

  it('traces errors', async () => {
    executionContext.enableTrace = true;
    damageTypeEffectsService.applyEffectsForDamage.mockRejectedValue(
      new Error('Effect failed')
    );

    await service.resolve({
      entityId: 'entity-1',
      partId: 'part-1',
      finalDamageEntry: { name: 'blunt', amount: 5 },
      executionContext,
    });

    expect(executionContext.trace).toBeDefined();
    const errorTrace = executionContext.trace.find((t) => t.phase === 'error');
    expect(errorTrace).toBeDefined();
    expect(errorTrace.data.error).toBe('Effect failed');
  });

  it('appends to existing trace if provided', async () => {
    executionContext.trace = [{ phase: 'pre_existing', timestamp: 123 }];
    executionContext.enableTrace = true;

    await service.resolve({
      entityId: 'entity-1',
      partId: 'part-1',
      finalDamageEntry: { name: 'blunt', amount: 5 },
      executionContext,
    });

    expect(executionContext.trace.length).toBeGreaterThan(1);
    expect(executionContext.trace[0].phase).toBe('pre_existing');
  });

  it('traces effect application via DamageTypeEffectsService interaction', async () => {
    executionContext.enableTrace = true;

    // Setup DamageTypeEffectsService to simulate its internal tracing (as implemented)
    damageTypeEffectsService.applyEffectsForDamage.mockImplementation(
      async ({ executionContext }) => {
        if (executionContext?.trace) {
          executionContext.trace.push({
            phase: 'effect_test',
            message: 'Simulated effect',
          });
        }
      }
    );

    await service.resolve({
      entityId: 'entity-1',
      partId: 'part-1',
      finalDamageEntry: { name: 'blunt', amount: 5 },
      executionContext,
    });

    expect(executionContext.trace).toBeDefined();
    const phases = executionContext.trace.map((t) => t.phase);
    expect(phases).toContain('effect_test');
  });
});
