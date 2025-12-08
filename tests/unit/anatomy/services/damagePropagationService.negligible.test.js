import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import DamageResolutionService from '../../../../src/logic/services/damageResolutionService.js';
import DamageAccumulator from '../../../../src/anatomy/services/damageAccumulator.js';

const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';
const PART_COMPONENT_ID = 'anatomy:part';
const NAME_COMPONENT_ID = 'core:name';
const GENDER_COMPONENT_ID = 'core:gender';

describe('DamageResolutionService - propagated negligible severity', () => {
  let service;
  let executionContext;
  let entityManager;
  let dispatcher;
  let damageAccumulator;
  let damageNarrativeComposer;
  let damageTypeEffectsService;
  let damagePropagationService;
  let deathCheckService;
  let logger;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    entityManager = {
      hasComponent: jest.fn((entityId, componentId) => {
        if (componentId === PART_HEALTH_COMPONENT_ID) {
          return entityId === 'child-1';
        }
        if (componentId === PART_COMPONENT_ID) {
          return entityId === 'child-1';
        }
        if (componentId === NAME_COMPONENT_ID || componentId === GENDER_COMPONENT_ID) {
          return entityId === 'entity-1';
        }
        return false;
      }),
      getComponentData: jest.fn((entityId, componentId) => {
        if (componentId === PART_COMPONENT_ID) {
          return { subType: 'heart', ownerEntityId: 'entity-1' };
        }
        if (componentId === PART_HEALTH_COMPONENT_ID) {
          return {
            currentHealth: 50,
            maxHealth: 50,
            state: 'healthy',
            turnsInState: 0,
          };
        }
        if (componentId === NAME_COMPONENT_ID) {
          return { text: 'Target' };
        }
        if (componentId === GENDER_COMPONENT_ID) {
          return { value: 'neutral' };
        }
        return null;
      }),
      addComponent: jest.fn().mockResolvedValue(),
    };

    dispatcher = { dispatch: jest.fn() };
    damageAccumulator = new DamageAccumulator({ logger });
    damageNarrativeComposer = { compose: jest.fn() };
    damageTypeEffectsService = {
      applyEffectsForDamage: jest.fn().mockResolvedValue({ severity: 'negligible' }),
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

    service = new DamageResolutionService({
      logger,
      entityManager,
      safeEventDispatcher: dispatcher,
      damageTypeEffectsService,
      damagePropagationService,
      deathCheckService,
      damageAccumulator,
      damageNarrativeComposer,
    });

    executionContext = {
      damageSession: damageAccumulator.createSession('entity-1'),
    };
  });

  it('classifies propagated hits as negligible when below threshold', async () => {
    await service.resolve({
      entityId: 'entity-1',
      partId: 'child-1',
      finalDamageEntry: { name: 'piercing', amount: 1 },
      propagatedFrom: 'torso-1',
      executionContext,
      isTopLevel: false,
      applyDamage: jest.fn(),
    });

    expect(executionContext.damageSession.entries).toHaveLength(1);
    expect(executionContext.damageSession.entries[0]).toMatchObject({
      partId: 'child-1',
      propagatedFrom: 'torso-1',
      severity: 'negligible',
    });
  });
});
