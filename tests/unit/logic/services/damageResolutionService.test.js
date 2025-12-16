/**
 * @jest-environment node
 */

import fs from 'fs';
import path from 'path';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import AjvSchemaValidator from '../../../../src/validation/ajvSchemaValidator.js';
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
  /** @type {jest.Mocked<any>} */ let logger;

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
    logger = log;

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

  it('includes severity in DAMAGE_DEBUG logs', async () => {
    await service.resolve({
      entityId: 'entity-1',
      partId: 'part-1',
      finalDamageEntry: { name: 'blunt', amount: 1 },
      propagatedFrom: null,
      executionContext,
      isTopLevel: true,
    });

    const damageDebugLogs = logger.info.mock.calls
      .map(([message]) => message)
      .filter(
        (message) =>
          typeof message === 'string' &&
          message.includes('[DAMAGE_DEBUG]') &&
          message.includes('Severity=')
      );

    expect(damageDebugLogs.length).toBeGreaterThan(0);
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

  it('suppresses perceptible narrative dispatch when requested', async () => {
    executionContext = { suppressPerceptibleEvents: true };

    await service.resolve({
      entityId: 'entity-1',
      partId: 'part-1',
      finalDamageEntry: { name: 'piercing', amount: 4 },
      propagatedFrom: null,
      executionContext,
      isTopLevel: true,
      applyDamage: jest.fn(),
    });

    const dispatchedEvents = dispatcher.dispatch.mock.calls.map(
      ([eventType]) => eventType
    );

    expect(damageNarrativeComposer.compose).not.toHaveBeenCalled();
    expect(dispatchedEvents).toContain('anatomy:part_health_changed');
    expect(dispatchedEvents).not.toContain('core:perceptible_event');
    expect(damageAccumulator.finalize).toHaveBeenCalled();
    expect(executionContext.damageSession).toBeUndefined();
  });

  it('emits anatomy:damage_applied payloads that conform to the event schema', async () => {
    const damageAppliedDefinition = JSON.parse(
      fs.readFileSync(
        path.resolve('data/mods/anatomy/events/damage_applied.event.json'),
        'utf8'
      )
    );

    const schemaValidator = new AjvSchemaValidator({ logger });
    const payloadSchemaId = `${damageAppliedDefinition.id}#payload`;
    await schemaValidator.addSchema(
      damageAppliedDefinition.payloadSchema,
      payloadSchemaId
    );

    await service.resolve({
      entityId: 'entity-1',
      partId: 'part-1',
      finalDamageEntry: { name: 'slashing', amount: 5 },
      propagatedFrom: null,
      executionContext,
      isTopLevel: true,
      applyDamage: jest.fn(),
    });

    const queuedPayloads = damageAccumulator.queueEvent.mock.calls
      .filter(([eventSession, eventType]) => {
        return eventSession && eventType === 'anatomy:damage_applied';
      })
      .map(([, , payload]) => payload);

    expect(queuedPayloads.length).toBeGreaterThan(0);

    const validationResult = schemaValidator.validate(
      payloadSchemaId,
      queuedPayloads[0]
    );

    expect(validationResult.isValid).toBe(true);
    expect(validationResult.errors).toBeNull();
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

  describe('Missing Required Parameters', () => {
    it('returns early and logs warning when entityId is missing', async () => {
      await service.resolve({
        entityId: null,
        partId: 'part-1',
        finalDamageEntry: { name: 'slashing', amount: 5 },
        executionContext,
        isTopLevel: true,
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'DamageResolutionService: Missing required parameters',
        expect.objectContaining({ entityId: null })
      );
      expect(damageAccumulator.createSession).not.toHaveBeenCalled();
    });

    it('returns early and logs warning when partId is missing', async () => {
      await service.resolve({
        entityId: 'entity-1',
        partId: undefined,
        finalDamageEntry: { name: 'slashing', amount: 5 },
        executionContext,
        isTopLevel: true,
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'DamageResolutionService: Missing required parameters',
        expect.objectContaining({ partId: undefined })
      );
      expect(damageAccumulator.createSession).not.toHaveBeenCalled();
    });

    it('returns early and logs warning when finalDamageEntry is missing', async () => {
      await service.resolve({
        entityId: 'entity-1',
        partId: 'part-1',
        finalDamageEntry: null,
        executionContext,
        isTopLevel: true,
      });

      expect(logger.warn).toHaveBeenCalledWith(
        'DamageResolutionService: Missing required parameters',
        expect.objectContaining({ finalDamageEntry: null })
      );
      expect(damageAccumulator.createSession).not.toHaveBeenCalled();
    });
  });

  describe('Session Lifecycle Edge Cases', () => {
    it('returns early and dispatches error when session creation fails', async () => {
      damageAccumulator.createSession.mockReturnValue(null);

      await service.resolve({
        entityId: 'entity-1',
        partId: 'part-1',
        finalDamageEntry: { name: 'slashing', amount: 5 },
        executionContext,
        isTopLevel: true,
      });

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:system_error_occurred',
        expect.objectContaining({
          message: 'APPLY_DAMAGE: Failed to create damage session',
        })
      );
    });

    it('logs warning when propagated call has no session in executionContext', async () => {
      await service.resolve({
        entityId: 'entity-1',
        partId: 'part-1',
        finalDamageEntry: { name: 'slashing', amount: 5 },
        propagatedFrom: 'parent-part',
        executionContext: {},
        isTopLevel: false,
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Propagated damage call missing session')
      );
    });

    it('dispatches damage_applied directly when no session exists in propagated call', async () => {
      entityManager.hasComponent.mockImplementation((entityId, componentId) => {
        if (componentId === PART_HEALTH_COMPONENT_ID)
          return entityId === 'part-1';
        if (componentId === PART_COMPONENT_ID) return entityId === 'part-1';
        return false;
      });

      await service.resolve({
        entityId: 'entity-1',
        partId: 'part-1',
        finalDamageEntry: { name: 'slashing', amount: 5 },
        propagatedFrom: 'parent-part',
        executionContext: {},
        isTopLevel: false,
      });

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'anatomy:damage_applied',
        expect.objectContaining({
          entityId: 'entity-1',
          partId: 'part-1',
        })
      );
    });
  });

  describe('Part Without Health Component', () => {
    it('records damage without updating health when part has no health component', async () => {
      entityManager.hasComponent.mockImplementation((entityId, componentId) => {
        if (componentId === PART_COMPONENT_ID) return entityId === 'part-1';
        if (componentId === PART_HEALTH_COMPONENT_ID) return false;
        return false;
      });

      await service.resolve({
        entityId: 'entity-1',
        partId: 'part-1',
        finalDamageEntry: { name: 'slashing', amount: 5 },
        executionContext,
        isTopLevel: true,
      });

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('has no health component')
      );
      expect(damageAccumulator.recordDamage).toHaveBeenCalled();
      expect(entityManager.addComponent).not.toHaveBeenCalled();
    });
  });

  describe('Damage Clamping', () => {
    it('returns early when damage clamps to zero due to zero current health', async () => {
      seedComponentData({
        partHealth: { currentHealth: 0, maxHealth: 10, state: 'destroyed' },
      });

      await service.resolve({
        entityId: 'entity-1',
        partId: 'part-1',
        finalDamageEntry: { name: 'slashing', amount: 5 },
        executionContext,
        isTopLevel: true,
      });

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('resolved to 0 after clamping')
      );
      expect(entityManager.addComponent).not.toHaveBeenCalled();
    });
  });

  describe('Part Destruction', () => {
    it('dispatches part_destroyed event when health drops from positive to zero', async () => {
      seedComponentData({
        partHealth: { currentHealth: 5, maxHealth: 10, state: 'wounded' },
      });

      await service.resolve({
        entityId: 'entity-1',
        partId: 'part-1',
        finalDamageEntry: { name: 'slashing', amount: 10 },
        executionContext,
        isTopLevel: true,
        applyDamage: jest.fn(),
      });

      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'anatomy:part_destroyed',
        expect.objectContaining({
          entityId: 'entity-1',
          partId: 'part-1',
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Part part-1 destroyed')
      );
    });
  });

  describe('Death Check Edge Cases', () => {
    it('handles death check service throwing an error gracefully', async () => {
      deathCheckService.evaluateDeathConditions.mockImplementation(() => {
        throw new Error('Death check failed');
      });

      await service.resolve({
        entityId: 'entity-1',
        partId: 'part-1',
        finalDamageEntry: { name: 'slashing', amount: 5 },
        executionContext,
        isTopLevel: true,
        applyDamage: jest.fn(),
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('evaluateDeathConditions failed')
      );
      expect(deathCheckService.finalizeDeathFromEvaluation).not.toHaveBeenCalled();
    });

    it('logs isDying state without finalizing when shouldFinalize is false', async () => {
      deathCheckService.evaluateDeathConditions.mockReturnValue({
        isDead: false,
        isDying: true,
        shouldFinalize: false,
        finalizationParams: null,
        deathInfo: null,
      });

      await service.resolve({
        entityId: 'entity-1',
        partId: 'part-1',
        finalDamageEntry: { name: 'slashing', amount: 5 },
        executionContext,
        isTopLevel: true,
        applyDamage: jest.fn(),
      });

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('is now dying')
      );
      expect(deathCheckService.finalizeDeathFromEvaluation).not.toHaveBeenCalled();
    });
  });

  describe('Finalization Errors', () => {
    it('throws and logs error when session finalization fails', async () => {
      damageAccumulator.finalize.mockImplementation(() => {
        throw new Error('Finalization boom');
      });

      await expect(
        service.resolve({
          entityId: 'entity-1',
          partId: 'part-1',
          finalDamageEntry: { name: 'slashing', amount: 5 },
          executionContext,
          isTopLevel: true,
          applyDamage: jest.fn(),
        })
      ).rejects.toThrow('Finalization boom');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Session finalization threw an error'),
        expect.any(Error)
      );
    });

    it('throws and logs error when narrative composition fails', async () => {
      damageNarrativeComposer.compose.mockImplementation(() => {
        throw new Error('Compose boom');
      });

      await expect(
        service.resolve({
          entityId: 'entity-1',
          partId: 'part-1',
          finalDamageEntry: { name: 'slashing', amount: 5 },
          executionContext,
          isTopLevel: true,
          applyDamage: jest.fn(),
        })
      ).rejects.toThrow('Compose boom');

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Narrative composition threw an error'),
        expect.any(Error)
      );
    });
  });

  describe('Location Resolution', () => {
    it('errors when neither target nor actor has location', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Target' };
          if (componentId === GENDER_COMPONENT_ID) return { value: 'neutral' };
          if (componentId === PART_COMPONENT_ID) {
            return { subType: 'torso', ownerEntityId: 'entity-1' };
          }
          if (componentId === PART_HEALTH_COMPONENT_ID) {
            return { currentHealth: 10, maxHealth: 10, state: 'healthy' };
          }
          if (componentId === POSITION_COMPONENT_ID) return null;
          return null;
        }
      );

      await service.resolve({
        entityId: 'entity-1',
        partId: 'part-1',
        finalDamageEntry: { name: 'slashing', amount: 5 },
        executionContext: { actorId: 'actor-1' },
        isTopLevel: true,
        applyDamage: jest.fn(),
      });

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Cannot dispatch perceptible event')
      );
    });

    it('uses actor location as fallback when target has no location', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Target' };
          if (componentId === GENDER_COMPONENT_ID) return { value: 'neutral' };
          if (componentId === PART_COMPONENT_ID) {
            return { subType: 'torso', ownerEntityId: 'entity-1' };
          }
          if (componentId === PART_HEALTH_COMPONENT_ID) {
            return { currentHealth: 10, maxHealth: 10, state: 'healthy' };
          }
          if (componentId === POSITION_COMPONENT_ID) {
            if (entityId === 'actor-1') return { locationId: 'actor-room' };
            return null;
          }
          return null;
        }
      );

      await service.resolve({
        entityId: 'entity-1',
        partId: 'part-1',
        finalDamageEntry: { name: 'slashing', amount: 5 },
        executionContext: { actorId: 'actor-1' },
        isTopLevel: true,
        applyDamage: jest.fn(),
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("using actor's location")
      );
      expect(dispatcher.dispatch).toHaveBeenCalledWith(
        'core:perceptible_event',
        expect.objectContaining({ locationId: 'actor-room' })
      );
    });
  });

  describe('Component Lookup Exceptions', () => {
    it('returns Unknown when getEntityName throws', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === NAME_COMPONENT_ID) {
            throw new Error('Name lookup failed');
          }
          if (componentId === GENDER_COMPONENT_ID) return { value: 'neutral' };
          if (componentId === PART_COMPONENT_ID) {
            return { subType: 'torso', ownerEntityId: 'entity-1' };
          }
          if (componentId === PART_HEALTH_COMPONENT_ID) {
            return { currentHealth: 10, maxHealth: 10, state: 'healthy' };
          }
          if (componentId === POSITION_COMPONENT_ID) {
            return { locationId: 'room-1' };
          }
          return null;
        }
      );

      await service.resolve({
        entityId: 'entity-1',
        partId: 'part-1',
        finalDamageEntry: { name: 'slashing', amount: 5 },
        executionContext,
        isTopLevel: true,
        applyDamage: jest.fn(),
      });

      expect(damageAccumulator.recordDamage).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ entityName: 'Unknown' })
      );
    });

    it('returns neutral pronoun when getEntityPronoun throws', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Target' };
          if (componentId === GENDER_COMPONENT_ID) {
            throw new Error('Gender lookup failed');
          }
          if (componentId === PART_COMPONENT_ID) {
            return { subType: 'torso', ownerEntityId: 'entity-1' };
          }
          if (componentId === PART_HEALTH_COMPONENT_ID) {
            return { currentHealth: 10, maxHealth: 10, state: 'healthy' };
          }
          if (componentId === POSITION_COMPONENT_ID) {
            return { locationId: 'room-1' };
          }
          return null;
        }
      );

      await service.resolve({
        entityId: 'entity-1',
        partId: 'part-1',
        finalDamageEntry: { name: 'slashing', amount: 5 },
        executionContext,
        isTopLevel: true,
        applyDamage: jest.fn(),
      });

      expect(damageAccumulator.recordDamage).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ entityPronoun: 'they' })
      );
    });

    it('returns neutral possessive when getEntityPossessive throws', async () => {
      let genderCallCount = 0;
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Target' };
          if (componentId === GENDER_COMPONENT_ID) {
            genderCallCount++;
            if (genderCallCount > 1) {
              throw new Error('Gender lookup failed on possessive call');
            }
            return { value: 'male' };
          }
          if (componentId === PART_COMPONENT_ID) {
            return { subType: 'torso', ownerEntityId: 'entity-1' };
          }
          if (componentId === PART_HEALTH_COMPONENT_ID) {
            return { currentHealth: 10, maxHealth: 10, state: 'healthy' };
          }
          if (componentId === POSITION_COMPONENT_ID) {
            return { locationId: 'room-1' };
          }
          return null;
        }
      );

      await service.resolve({
        entityId: 'entity-1',
        partId: 'part-1',
        finalDamageEntry: { name: 'slashing', amount: 5 },
        executionContext,
        isTopLevel: true,
        applyDamage: jest.fn(),
      });

      expect(damageAccumulator.recordDamage).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ entityPossessive: 'their' })
      );
    });

    it('returns default part info when getPartInfo throws', async () => {
      // Track calls to PART_COMPONENT_ID to throw only on first call (inside #getPartInfo)
      // and return normal data on subsequent calls
      let partComponentCallCount = 0;
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Target' };
          if (componentId === GENDER_COMPONENT_ID) return { value: 'neutral' };
          if (componentId === PART_COMPONENT_ID) {
            partComponentCallCount++;
            if (partComponentCallCount === 1) {
              // First call is from #getPartInfo - throw to hit catch block at line 640
              throw new Error('Part lookup failed');
            }
            // Subsequent calls return normal data
            return { subType: 'torso', ownerEntityId: 'entity-1' };
          }
          if (componentId === PART_HEALTH_COMPONENT_ID) {
            return { currentHealth: 10, maxHealth: 10, state: 'healthy' };
          }
          if (componentId === POSITION_COMPONENT_ID) {
            return { locationId: 'room-1' };
          }
          return null;
        }
      );

      await service.resolve({
        entityId: 'entity-1',
        partId: 'part-1',
        finalDamageEntry: { name: 'slashing', amount: 5 },
        executionContext,
        isTopLevel: true,
        applyDamage: jest.fn(),
      });

      expect(damageAccumulator.recordDamage).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          partType: 'body part',
          orientation: null,
        })
      );
    });

    it('returns null when getEntityLocation throws', async () => {
      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Target' };
          if (componentId === GENDER_COMPONENT_ID) return { value: 'neutral' };
          if (componentId === PART_COMPONENT_ID) {
            return { subType: 'torso', ownerEntityId: 'entity-1' };
          }
          if (componentId === PART_HEALTH_COMPONENT_ID) {
            return { currentHealth: 10, maxHealth: 10, state: 'healthy' };
          }
          if (componentId === POSITION_COMPONENT_ID) {
            throw new Error('Position lookup failed');
          }
          return null;
        }
      );

      await service.resolve({
        entityId: 'entity-1',
        partId: 'part-1',
        finalDamageEntry: { name: 'slashing', amount: 5 },
        executionContext,
        isTopLevel: true,
        applyDamage: jest.fn(),
      });

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Cannot dispatch perceptible event')
      );
    });
  });

  describe('Severity Classification Edge Cases', () => {
    it('handles NaN damage in propagation severity classification', async () => {
      damagePropagationService.propagateDamage.mockReturnValue([
        { childPartId: 'child-1', damageApplied: NaN, damageTypeId: 'slashing' },
      ]);
      const applyDamage = jest.fn();

      await service.resolve({
        entityId: 'entity-1',
        partId: 'part-1',
        finalDamageEntry: { name: 'slashing', amount: 5 },
        executionContext,
        isTopLevel: true,
        applyDamage,
      });

      expect(applyDamage).toHaveBeenCalledWith(
        expect.objectContaining({
          damage_entry: expect.objectContaining({ amount: NaN }),
        }),
        executionContext
      );
    });

    it('falls back to default severity when health lookup throws in classification', async () => {
      // Set up hasComponent to return true for child-1's health component
      // and maintain normal behavior for other cases
      entityManager.hasComponent.mockImplementation((entityId, componentId) => {
        if (entityId === 'child-1' && componentId === PART_HEALTH_COMPONENT_ID) {
          return true;
        }
        // Replicate original seedComponentData behavior
        if (componentId === PART_HEALTH_COMPONENT_ID) {
          return entityId === 'part-1';
        }
        if (componentId === PART_COMPONENT_ID) {
          return entityId === 'part-1';
        }
        return false;
      });

      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          // Throw when getting health for child-1 to trigger severity classification fallback
          if (
            entityId === 'child-1' &&
            componentId === PART_HEALTH_COMPONENT_ID
          ) {
            throw new Error('Health lookup failed');
          }
          if (componentId === NAME_COMPONENT_ID) return { text: 'Target' };
          if (componentId === GENDER_COMPONENT_ID) return { value: 'neutral' };
          if (componentId === PART_COMPONENT_ID) {
            return { subType: 'torso', ownerEntityId: 'entity-1' };
          }
          if (componentId === PART_HEALTH_COMPONENT_ID) {
            return { currentHealth: 10, maxHealth: 10, state: 'healthy' };
          }
          if (componentId === POSITION_COMPONENT_ID) {
            return { locationId: 'room-1' };
          }
          return null;
        }
      );

      damagePropagationService.propagateDamage.mockReturnValue([
        { childPartId: 'child-1', damageApplied: 3, damageTypeId: 'slashing' },
      ]);
      const applyDamage = jest.fn();

      await service.resolve({
        entityId: 'entity-1',
        partId: 'part-1',
        finalDamageEntry: { name: 'slashing', amount: 5 },
        executionContext,
        isTopLevel: true,
        applyDamage,
      });

      expect(applyDamage).toHaveBeenCalled();
    });
  });

  describe('Empty Narrative Composition', () => {
    it('logs warning when composer returns empty narrative', async () => {
      damageNarrativeComposer.compose.mockReturnValue(null);

      await service.resolve({
        entityId: 'entity-1',
        partId: 'part-1',
        finalDamageEntry: { name: 'slashing', amount: 5 },
        executionContext,
        isTopLevel: true,
        applyDamage: jest.fn(),
      });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Composer returned empty narrative')
      );
    });
  });

  describe('Trace Functionality', () => {
    it('initializes trace array when enableTrace is true and trace is not set', async () => {
      const traceContext = { enableTrace: true };

      await service.resolve({
        entityId: 'entity-1',
        partId: 'part-1',
        finalDamageEntry: { name: 'slashing', amount: 5 },
        executionContext: traceContext,
        isTopLevel: true,
      });

      expect(traceContext.trace).toBeDefined();
      expect(Array.isArray(traceContext.trace)).toBe(true);
      expect(traceContext.trace.length).toBeGreaterThan(0);
    });

    it('adds trace entries when trace is enabled', async () => {
      const traceContext = { enableTrace: true, trace: [] };

      await service.resolve({
        entityId: 'entity-1',
        partId: 'part-1',
        finalDamageEntry: { name: 'slashing', amount: 5 },
        executionContext: traceContext,
        isTopLevel: true,
      });

      expect(traceContext.trace.length).toBeGreaterThan(0);
      expect(traceContext.trace[0]).toEqual(
        expect.objectContaining({
          phase: expect.any(String),
          message: expect.any(String),
          timestamp: expect.any(Number),
        })
      );
    });
  });

  describe('Non-Positive Damage Handling', () => {
    it('skips damage application for zero damage amount', async () => {
      await service.resolve({
        entityId: 'entity-1',
        partId: 'part-1',
        finalDamageEntry: { name: 'slashing', amount: 0 },
        executionContext,
        isTopLevel: true,
      });

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Non-positive damage')
      );
      expect(damageAccumulator.recordDamage).not.toHaveBeenCalled();
    });

    it('skips damage application for negative damage amount', async () => {
      await service.resolve({
        entityId: 'entity-1',
        partId: 'part-1',
        finalDamageEntry: { name: 'slashing', amount: -5 },
        executionContext,
        isTopLevel: true,
      });

      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Non-positive damage')
      );
      expect(damageAccumulator.recordDamage).not.toHaveBeenCalled();
    });

    it('adds skip trace when non-positive damage with trace enabled', async () => {
      const traceContext = { enableTrace: true, trace: [] };

      await service.resolve({
        entityId: 'entity-1',
        partId: 'part-1',
        finalDamageEntry: { name: 'slashing', amount: 0 },
        executionContext: traceContext,
        isTopLevel: true,
      });

      const skipTrace = traceContext.trace.find((t) => t.phase === 'skip');
      expect(skipTrace).toBeDefined();
      expect(skipTrace.message).toBe('Non-positive damage');
    });
  });

  describe('Propagation Severity Classification', () => {
    it('classifies severity using maxHealth when part has health component', async () => {
      // Set up child part to have health component
      entityManager.hasComponent.mockImplementation((entityId, componentId) => {
        if (entityId === 'child-1' && componentId === PART_HEALTH_COMPONENT_ID) {
          return true;
        }
        if (componentId === PART_HEALTH_COMPONENT_ID) {
          return entityId === 'part-1';
        }
        if (componentId === PART_COMPONENT_ID) {
          return entityId === 'part-1';
        }
        return false;
      });

      entityManager.getComponentData.mockImplementation(
        (entityId, componentId) => {
          if (componentId === NAME_COMPONENT_ID) return { text: 'Target' };
          if (componentId === GENDER_COMPONENT_ID) return { value: 'neutral' };
          if (componentId === PART_COMPONENT_ID) {
            return { subType: 'torso', ownerEntityId: 'entity-1' };
          }
          if (componentId === PART_HEALTH_COMPONENT_ID) {
            if (entityId === 'child-1') {
              return { currentHealth: 10, maxHealth: 20, state: 'healthy' };
            }
            return { currentHealth: 10, maxHealth: 10, state: 'healthy' };
          }
          if (componentId === POSITION_COMPONENT_ID) {
            return { locationId: 'room-1' };
          }
          return null;
        }
      );

      damagePropagationService.propagateDamage.mockReturnValue([
        { childPartId: 'child-1', damageApplied: 3, damageTypeId: 'slashing' },
      ]);
      const applyDamage = jest.fn();

      await service.resolve({
        entityId: 'entity-1',
        partId: 'part-1',
        finalDamageEntry: { name: 'slashing', amount: 5 },
        executionContext,
        isTopLevel: true,
        applyDamage,
      });

      // Should have called applyDamage for the child part
      expect(applyDamage).toHaveBeenCalledWith(
        expect.objectContaining({
          part_ref: 'child-1',
        }),
        executionContext
      );
    });
  });
});
