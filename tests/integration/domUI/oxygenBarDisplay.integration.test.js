/**
 * @file Integration tests for oxygen bar display in the Physical Condition panel.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { InjuryStatusPanel } from '../../../src/domUI/injuryStatusPanel.js';
import DocumentContext from '../../../src/domUI/documentContext.js';
import OxygenAggregationService from '../../../src/anatomy/services/oxygenAggregationService.js';
import DepleteOxygenHandler from '../../../src/logic/operationHandlers/depleteOxygenHandler.js';
import RestoreOxygenHandler from '../../../src/logic/operationHandlers/restoreOxygenHandler.js';
import { TURN_STARTED_ID } from '../../../src/constants/eventIds.js';
import SimpleEntityManager from '../../common/entities/simpleEntityManager.js';
import { createEventBus } from '../../common/mockFactories/eventBus.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';

describe('Oxygen Bar Display - Integration', () => {
  let entityManager;
  let eventBus;
  let documentContext;
  let logger;
  let oxygenAggregationService;
  let injuryAggregationService;
  let injuryNarrativeFormatterService;
  let panel;
  let idCounter;

  const buildActorId = (suffix) => {
    idCounter += 1;
    return `oxygen-test-${suffix}-${idCounter}`;
  };

  const createExecutionContext = () => ({
    logger,
    evaluationContext: {},
  });

  const createActorWithLungs = async (actorId, oxygenLevel = 20) => {
    const leftLungId = `${actorId}-left-lung`;
    const rightLungId = `${actorId}-right-lung`;
    const perOrganOxygen = Math.max(0, oxygenLevel / 2);

    entityManager.createEntity(actorId);
    await entityManager.addComponent(actorId, 'anatomy:body', {
      parts: [leftLungId, rightLungId],
    });

    entityManager.createEntity(leftLungId);
    await entityManager.addComponent(leftLungId, 'anatomy:part', {
      ownerEntityId: actorId,
      subType: 'lung',
      orientation: 'left',
    });
    await entityManager.addComponent(
      leftLungId,
      'breathing-states:respiratory_organ',
      {
        respirationType: 'pulmonary',
        oxygenCapacity: 10,
        currentOxygen: Math.min(10, perOrganOxygen),
        depletionRate: 1,
        restorationRate: 10,
      }
    );

    entityManager.createEntity(rightLungId);
    await entityManager.addComponent(rightLungId, 'anatomy:part', {
      ownerEntityId: actorId,
      subType: 'lung',
      orientation: 'right',
    });
    await entityManager.addComponent(
      rightLungId,
      'breathing-states:respiratory_organ',
      {
        respirationType: 'pulmonary',
        oxygenCapacity: 10,
        currentOxygen: Math.min(10, perOrganOxygen),
        depletionRate: 1,
        restorationRate: 10,
      }
    );
  };

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="injury-status-widget">
        <div id="injury-status-content">
          <div id="injury-narrative"></div>
        </div>
      </div>
    `;

    idCounter = 0;
    logger = createMockLogger();
    entityManager = new SimpleEntityManager();
    eventBus = createEventBus();
    documentContext = new DocumentContext(document, logger);

    oxygenAggregationService = new OxygenAggregationService({
      logger,
      entityManager,
    });

    injuryAggregationService = {
      aggregateInjuries: () => ({
        entityId: 'injury-test',
        injuredParts: [],
        bleedingParts: [],
        burningParts: [],
        poisonedParts: [],
        fracturedParts: [],
        destroyedParts: [],
        overallHealthPercentage: 100,
        isDying: false,
        isDead: false,
        dyingTurnsRemaining: 0,
        causeOfDeath: null,
      }),
    };

    injuryNarrativeFormatterService = {
      formatFirstPerson: () => '',
    };
  });

  afterEach(() => {
    if (panel) {
      panel.dispose();
      panel = null;
    }
    document.body.innerHTML = '';
  });

  describe('Event Integration', () => {
    it('should update oxygen bar on TURN_STARTED event', async () => {
      const actorId = buildActorId('turn');
      await createActorWithLungs(actorId, 20);

      panel = new InjuryStatusPanel({
        logger,
        documentContext,
        validatedEventDispatcher: eventBus,
        injuryAggregationService,
        injuryNarrativeFormatterService,
        oxygenAggregationService,
      });

      await eventBus.dispatch(TURN_STARTED_ID, { entityId: actorId });

      const oxygenWrapper = document.querySelector('#oxygen-bar-wrapper');
      expect(oxygenWrapper).not.toBeNull();
      expect(
        oxygenWrapper.querySelector('.oxygen-percentage-text').textContent
      ).toBe('100%');
    });

    it('should reflect current component state after depletion', async () => {
      const actorId = buildActorId('deplete');
      await createActorWithLungs(actorId, 20);

      panel = new InjuryStatusPanel({
        logger,
        documentContext,
        validatedEventDispatcher: eventBus,
        injuryAggregationService,
        injuryNarrativeFormatterService,
        oxygenAggregationService,
      });

      const depleteHandler = new DepleteOxygenHandler({
        logger,
        entityManager,
        safeEventDispatcher: eventBus,
        jsonLogicService: { evaluate: () => null },
      });

      await depleteHandler.execute(
        { entityId: actorId, amount: 5 },
        createExecutionContext()
      );

      await eventBus.dispatch(TURN_STARTED_ID, { entityId: actorId });

      const oxygenWrapper = document.querySelector('#oxygen-bar-wrapper');
      expect(
        oxygenWrapper.querySelector('.oxygen-percentage-text').textContent
      ).toBe('50%');
    });

    it('should reflect current component state after restoration', async () => {
      const actorId = buildActorId('restore');
      await createActorWithLungs(actorId, 10);

      panel = new InjuryStatusPanel({
        logger,
        documentContext,
        validatedEventDispatcher: eventBus,
        injuryAggregationService,
        injuryNarrativeFormatterService,
        oxygenAggregationService,
      });

      const restoreHandler = new RestoreOxygenHandler({
        logger,
        entityManager,
        safeEventDispatcher: eventBus,
        jsonLogicService: { evaluate: () => null },
      });

      await restoreHandler.execute(
        { entityId: actorId, restoreFull: true },
        createExecutionContext()
      );

      await eventBus.dispatch(TURN_STARTED_ID, { entityId: actorId });

      const oxygenWrapper = document.querySelector('#oxygen-bar-wrapper');
      expect(
        oxygenWrapper.querySelector('.oxygen-percentage-text').textContent
      ).toBe('100%');
    });
  });

  describe('Handler Integration', () => {
    it('should show reduced percentage after DEPLETE_OXYGEN execution', async () => {
      const actorId = buildActorId('handler-deplete');
      await createActorWithLungs(actorId, 20);

      const handler = new DepleteOxygenHandler({
        logger,
        entityManager,
        safeEventDispatcher: eventBus,
        jsonLogicService: { evaluate: () => null },
      });

      await handler.execute(
        { entityId: actorId, amount: 5 },
        createExecutionContext()
      );

      const summary = oxygenAggregationService.aggregateOxygen(actorId);
      expect(summary.percentage).toBe(50);
    });

    it('should show increased percentage after RESTORE_OXYGEN execution', async () => {
      const actorId = buildActorId('handler-restore');
      await createActorWithLungs(actorId, 10);

      const handler = new RestoreOxygenHandler({
        logger,
        entityManager,
        safeEventDispatcher: eventBus,
        jsonLogicService: { evaluate: () => null },
      });

      await handler.execute(
        { entityId: actorId, amount: 10 },
        createExecutionContext()
      );

      const summary = oxygenAggregationService.aggregateOxygen(actorId);
      expect(summary.percentage).toBe(100);
    });

    it('should show 100% after restoreFull: true execution', async () => {
      const actorId = buildActorId('handler-restore-full');
      await createActorWithLungs(actorId, 0);

      const handler = new RestoreOxygenHandler({
        logger,
        entityManager,
        safeEventDispatcher: eventBus,
        jsonLogicService: { evaluate: () => null },
      });

      await handler.execute(
        { entityId: actorId, restoreFull: true },
        createExecutionContext()
      );

      const summary = oxygenAggregationService.aggregateOxygen(actorId);
      expect(summary.percentage).toBe(100);
    });
  });

  describe('Multi-Organ Scenarios', () => {
    it('should show combined percentage for human with two lungs', async () => {
      const actorId = buildActorId('multi');
      await createActorWithLungs(actorId, 20);

      const summary = oxygenAggregationService.aggregateOxygen(actorId);
      expect(summary.percentage).toBe(100);
      expect(summary.organCount).toBe(2);
      expect(summary.totalOxygenCapacity).toBe(20);
    });

    it('should handle asymmetric damage (one lung at 50%, one at 100%)', async () => {
      const actorId = buildActorId('asym');
      const leftLungId = `${actorId}-left-lung`;
      const rightLungId = `${actorId}-right-lung`;

      entityManager.createEntity(actorId);
      entityManager.createEntity(leftLungId);
      entityManager.createEntity(rightLungId);

      await entityManager.addComponent(leftLungId, 'anatomy:part', {
        ownerEntityId: actorId,
      });
      await entityManager.addComponent(
        leftLungId,
        'breathing-states:respiratory_organ',
        {
          respirationType: 'pulmonary',
          oxygenCapacity: 10,
          currentOxygen: 5,
        }
      );

      await entityManager.addComponent(rightLungId, 'anatomy:part', {
        ownerEntityId: actorId,
      });
      await entityManager.addComponent(
        rightLungId,
        'breathing-states:respiratory_organ',
        {
          respirationType: 'pulmonary',
          oxygenCapacity: 10,
          currentOxygen: 10,
        }
      );

      const summary = oxygenAggregationService.aggregateOxygen(actorId);
      expect(summary.percentage).toBe(75);
    });

    it('should handle single organ creature', async () => {
      const actorId = buildActorId('single');
      const lungId = `${actorId}-lung`;

      entityManager.createEntity(actorId);
      entityManager.createEntity(lungId);

      await entityManager.addComponent(lungId, 'anatomy:part', {
        ownerEntityId: actorId,
      });
      await entityManager.addComponent(
        lungId,
        'breathing-states:respiratory_organ',
        {
          respirationType: 'pulmonary',
          oxygenCapacity: 15,
          currentOxygen: 12,
        }
      );

      const summary = oxygenAggregationService.aggregateOxygen(actorId);
      expect(summary.percentage).toBe(80);
      expect(summary.organCount).toBe(1);
    });
  });
});
