import { describe, it, expect, beforeEach, jest } from '@jest/globals';

import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';
import InjuryAggregationService from '../../../src/anatomy/services/injuryAggregationService.js';
import InjuryNarrativeFormatterService from '../../../src/anatomy/services/injuryNarrativeFormatterService.js';

const BODY_COMPONENT_ID = 'anatomy:body';
const PART_COMPONENT_ID = 'anatomy:part';
const PART_HEALTH_COMPONENT_ID = 'anatomy:part_health';
const VITAL_ORGAN_COMPONENT_ID = 'anatomy:vital_organ';
const BLEEDING_COMPONENT_ID = 'anatomy:bleeding';
const DISMEMBERED_COMPONENT_ID = 'anatomy:dismembered';
const INVENTORY_COMPONENT_ID = 'inventory:inventory';
const NAME_COMPONENT_ID = 'core:name';
const CONSPICUOUS_COMPONENT_ID = 'core:conspicuous';

describe('BodyDescriptionComposer health line integration', () => {
  let logger;

  beforeEach(() => {
    logger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };
  });

  function createEntityManager(componentStore) {
    return {
      hasComponent(entityId, componentId) {
        return Boolean(componentStore[entityId]?.[componentId]);
      },
      getComponentData(entityId, componentId) {
        return componentStore[entityId]?.[componentId] || null;
      },
      getEntityInstance(entityId) {
        return {
          id: entityId,
          hasComponent: (componentId) =>
            Boolean(componentStore[entityId]?.[componentId]),
          getComponentData: (componentId) =>
            componentStore[entityId]?.[componentId] || null,
        };
      },
    };
  }

  function createBodyGraphService(partsByActor) {
    return {
      getAllParts(bodyComponentOrBody, actorId) {
        if (bodyComponentOrBody?.parts) {
          return [...bodyComponentOrBody.parts];
        }

        if (bodyComponentOrBody?.body?.parts) {
          return [...bodyComponentOrBody.body.parts];
        }

        if (actorId && partsByActor[actorId]) {
          return [...partsByActor[actorId]];
        }

        return [];
      },
    };
  }

  function createComposer(partSpecs) {
    const componentStore = {};
    const partIds = partSpecs.map((spec) => spec.id);

    componentStore['actor-1'] = {
      [BODY_COMPONENT_ID]: { body: { root: 'body-root', parts: partIds } },
      [INVENTORY_COMPONENT_ID]: { items: ['item-1'] },
    };

    componentStore['item-1'] = {
      [NAME_COMPONENT_ID]: { text: 'Coin' },
      [CONSPICUOUS_COMPONENT_ID]: { visible: true },
    };

    for (const spec of partSpecs) {
      componentStore[spec.id] = {
        [PART_COMPONENT_ID]: {
          subType: spec.subType,
          orientation: spec.orientation ?? null,
          ownerEntityId: 'actor-1',
        },
        [PART_HEALTH_COMPONENT_ID]: {
          currentHealth: spec.currentHealth ?? 100,
          maxHealth: spec.maxHealth ?? 100,
          state: spec.state ?? 'healthy',
          turnsInState: 0,
        },
      };

      if (spec.vitalOrgan) {
        componentStore[spec.id][VITAL_ORGAN_COMPONENT_ID] = {
          healthCapThreshold: 0.5,
          healthCapValue: 0.5,
        };
      }

      if (spec.bleedingSeverity) {
        componentStore[spec.id][BLEEDING_COMPONENT_ID] = {
          severity: spec.bleedingSeverity,
          remainingTurns: 1,
          tickDamage: 1,
        };
      }

      if (spec.dismembered) {
        componentStore[spec.id][DISMEMBERED_COMPONENT_ID] = {
          dismemberedAt: Date.now(),
        };
      }
    }

    const entityManager = createEntityManager(componentStore);
    const bodyGraphService = createBodyGraphService({ 'actor-1': partIds });

    const injuryAggregationService = new InjuryAggregationService({
      logger,
      entityManager,
      bodyGraphService,
    });

    const injuryNarrativeFormatterService = new InjuryNarrativeFormatterService(
      {
        logger,
      }
    );

    const equipmentDescriptionService = {
      generateEquipmentDescription: jest
        .fn()
        .mockResolvedValue('Wearing: Cloak.'),
    };

    const anatomyFormattingService = {
      getDescriptionOrder: () => ['equipment', 'inventory'],
    };

    const composer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: {},
      bodyGraphService,
      entityFinder: entityManager,
      anatomyFormattingService,
      partDescriptionGenerator: null,
      equipmentDescriptionService,
      activityDescriptionService: null,
      injuryAggregationService,
      injuryNarrativeFormatterService,
      logger,
    });

    const bodyEntity = entityManager.getEntityInstance('actor-1');

    return { composer, bodyEntity };
  }

  it('emits perfect health when no injuries are visible', async () => {
    const { composer, bodyEntity } = createComposer([
      {
        id: 'torso',
        subType: 'torso',
        state: 'healthy',
      },
    ]);

    const description = await composer.composeDescription(bodyEntity);
    const lines = description.split('\n').filter(Boolean);

    expect(lines).toEqual([
      'Wearing: Cloak.',
      'Health: Perfect health.',
      'Inventory: Coin.',
    ]);
  });

  it('shows cosmetic health when only negligible surface damage exists', async () => {
    const { composer, bodyEntity } = createComposer([
      {
        id: 'torso',
        subType: 'torso',
        state: 'healthy',
        currentHealth: 99,
        maxHealth: 100,
      },
    ]);

    const description = await composer.composeDescription(bodyEntity);
    const lines = description.split('\n').filter(Boolean);

    expect(lines).toEqual([
      'Wearing: Cloak.',
      'Health: Cosmetic scuffs.',
      'Inventory: Coin.',
    ]);
  });

  it('inserts visible injury details between equipment and inventory', async () => {
    const { composer, bodyEntity } = createComposer([
      {
        id: 'left-arm',
        subType: 'arm',
        orientation: 'left',
        state: 'destroyed',
        dismembered: true,
      },
      {
        id: 'torso',
        subType: 'torso',
        state: 'healthy',
      },
    ]);

    const description = await composer.composeDescription(bodyEntity);
    const lines = description.split('\n').filter(Boolean);

    expect(lines[0]).toBe('Wearing: Cloak.');
    expect(lines[1]).toBe('Health: Left arm is missing.');
    expect(lines[2]).toBe('Inventory: Coin.');
  });

  it('falls back to perfect health when only vital-organ injuries exist', async () => {
    const { composer, bodyEntity } = createComposer([
      {
        id: 'heart',
        subType: 'heart',
        state: 'critical',
        vitalOrgan: true,
        bleedingSeverity: 'severe',
      },
    ]);

    const description = await composer.composeDescription(bodyEntity);
    const lines = description.split('\n').filter(Boolean);

    expect(lines[0]).toBe('Wearing: Cloak.');
    expect(lines[1]).toBe('Health: Perfect health.');
    expect(lines[2]).toBe('Inventory: Coin.');
  });
});
