/**
 * @jest-environment node
 */

import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import DamageResolutionService from '../../../../src/logic/services/damageResolutionService.js';

const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';
const PART_COMPONENT_ID = 'anatomy:part';
const POSITION_COMPONENT_ID = 'core:position';
const NAME_COMPONENT_ID = 'core:name';
const GENDER_COMPONENT_ID = 'core:gender';

describe('DamageResolutionService', () => {
  /** @type {ReturnType<typeof createService>} */ let service;
  /** @type {object} */ let executionContext;
  /** @type {jest.Mocked<any>} */ let entityManager;
  /** @type {jest.Mocked<any>} */ let dispatcher;
  /** @type {jest.Mocked<any>} */ let damageAccumulator;
  /** @type {jest.Mocked<any>} */ let damageNarrativeComposer;
  /** @type {jest.Mocked<any>} */ let damageTypeEffectsService;
  /** @type {jest.Mocked<any>} */ let damagePropagationService;
  /** @type {jest.Mocked<any>} */ let deathCheckService;
  /** @type {jest.Mocked<any>} */ let callTracker;

  const baseSession = {
    entries: [],
    pendingEvents: [],
  };

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
        finalizationParams: null,
        deathInfo: null,
      }),
      finalizeDeathFromEvaluation: jest.fn(),
    };

    damageAccumulator = {
      createSession: jest
        .fn()
        .mockImplementation(() => ({
          ...baseSession,
          entries: [],
          pendingEvents: [],
        })),
      recordDamage: jest.fn().mockImplementation((session, entry) => {
        session.entries.push(entry);
      }),
      recordEffect: jest.fn(),
      queueEvent: jest
        .fn()
        .mockImplementation((session, eventType, payload) => {
          session.pendingEvents.push({ eventType, payload });
        }),
      finalize: jest.fn().mockImplementation((session) => ({
        entries: [...(session?.entries || [])],
        pendingEvents: [...(session?.pendingEvents || [])],
      })),
    };

    damageNarrativeComposer = {
      compose: jest.fn().mockReturnValue('composed narrative'),
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

  const seedComponentData = ({
    partHealth = { currentHealth: 10, maxHealth: 10, state: 'healthy' },
  } = {}) => {
    entityManager.hasComponent.mockImplementation((entityId, componentId) => {
      if (componentId === PART_HEALTH_COMPONENT_ID)
        return entityId === 'part-1';
      if (componentId === PART_COMPONENT_ID) return entityId === 'part-1';
      return false;
    });

    entityManager.getComponentData.mockImplementation(
      (entityId, componentId) => {
        if (componentId === NAME_COMPONENT_ID) return { text: 'Target' };
        if (componentId === GENDER_COMPONENT_ID) return { value: 'neutral' };
        if (componentId === PART_COMPONENT_ID) {
          return {
            subType: 'torso',
            ownerEntityId: 'entity-1',
          };
        }
        if (componentId === PART_HEALTH_COMPONENT_ID) return partHealth;
        if (componentId === POSITION_COMPONENT_ID)
          return { locationId: 'room-1' };
        return null;
      }
    );
  };

  beforeEach(() => {
    callTracker = [];
    executionContext = {};
    service = createService();
    seedComponentData();
  });

  it('reuses the same damage session when propagating damage to children', async () => {
    damagePropagationService.propagateDamage.mockReturnValue([
      { childPartId: 'child-1', damageApplied: 2, damageTypeId: 'slashing' },
    ]);
    const applyDamage = jest.fn();

    await service.resolve({
      entityId: 'entity-1',
      partId: 'part-1',
      finalDamageEntry: { name: 'slashing', amount: 5 },
      propagatedFrom: null,
      executionContext,
      isTopLevel: true,
      applyDamage,
    });

    expect(damageAccumulator.createSession).toHaveBeenCalledWith('entity-1');
    expect(applyDamage).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_ref: 'entity-1',
        part_ref: 'child-1',
        propagatedFrom: 'part-1',
        damage_entry: { name: 'slashing', amount: 2 },
      }),
      executionContext
    );
    expect(executionContext.damageSession).toBeUndefined();
  });

  it('dispatches narrative/queued events before finalizing death', async () => {
    damagePropagationService.propagateDamage.mockReturnValue([]);
    deathCheckService.evaluateDeathConditions.mockReturnValue({
      isDead: false,
      isDying: true,
      shouldFinalize: true,
      finalizationParams: null,
      deathInfo: null,
    });

    dispatcher.dispatch.mockImplementation((eventType) => {
      callTracker.push(eventType);
      return true;
    });
    damageAccumulator.finalize.mockImplementation((session) => {
      callTracker.push('finalize');
      return {
        entries: [...session.entries],
        pendingEvents: [
          ...session.pendingEvents,
          { eventType: 'anatomy:damage_applied', payload: { amount: 5 } },
        ],
      };
    });
    damageNarrativeComposer.compose.mockImplementation((entries) => {
      callTracker.push('compose');
      return `narrative(${entries.length})`;
    });
    deathCheckService.finalizeDeathFromEvaluation.mockImplementation(() => {
      callTracker.push('finalizeDeath');
    });

    await service.resolve({
      entityId: 'entity-1',
      partId: 'part-1',
      finalDamageEntry: { name: 'slashing', amount: 5 },
      propagatedFrom: null,
      executionContext,
      isTopLevel: true,
      applyDamage: jest.fn(),
    });

    const perceptibleIndex = callTracker.indexOf('core:perceptible_event');
    const damageAppliedIndex = callTracker.lastIndexOf(
      'anatomy:damage_applied'
    );
    const finalizeDeathIndex = callTracker.indexOf('finalizeDeath');

    expect(perceptibleIndex).toBeGreaterThan(-1);
    expect(damageAppliedIndex).toBeGreaterThan(perceptibleIndex);
    expect(finalizeDeathIndex).toBeGreaterThan(damageAppliedIndex);
    expect(callTracker).toContain('finalize');
    expect(callTracker).toContain('compose');
  });

  it('cleans up top-level damage session when effect application throws', async () => {
    damageTypeEffectsService.applyEffectsForDamage.mockImplementation(() => {
      throw new Error('effect boom');
    });

    await service.resolve({
      entityId: 'entity-1',
      partId: 'part-1',
      finalDamageEntry: { name: 'slashing', amount: 5 },
      propagatedFrom: null,
      executionContext,
      isTopLevel: true,
      applyDamage: jest.fn(),
    });

    expect(damageAccumulator.createSession).toHaveBeenCalledWith('entity-1');
    expect(executionContext.damageSession).toBeUndefined();
  });
});
