import { describe, expect, it, jest } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

describe('BodyDescriptionComposer - Health Line', () => {
  const logger = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  function createComposer({
    injurySummary,
    healthNarrative = 'Perfect health.',
    equipmentText = 'Wearing: Cloak.',
  } = {}) {
    const bodyGraphService = { getAllParts: jest.fn().mockReturnValue([]) };
    const entityFinder = {
      getEntityInstance: jest.fn((id) => {
        if (id === 'item-1') {
          return {
            hasComponent: (componentId) =>
              componentId === 'core:conspicuous' || componentId === 'core:name',
            getComponentData: (componentId) =>
              componentId === 'core:name' ? { text: 'Coin' } : null,
          };
        }
        return null;
      }),
    };

    const injuryAggregationService = {
      aggregateInjuries: jest
        .fn()
        .mockReturnValue(injurySummary ?? { injuredParts: [] }),
    };

    const injuryNarrativeFormatterService = {
      formatThirdPersonVisible: jest.fn().mockReturnValue(healthNarrative),
    };

    const equipmentDescriptionService = {
      generateEquipmentDescription: jest.fn().mockResolvedValue(equipmentText),
    };

    const anatomyFormattingService = {
      getDescriptionOrder: () => ['equipment', 'inventory'],
    };

    return new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: {},
      bodyGraphService,
      entityFinder,
      anatomyFormattingService,
      partDescriptionGenerator: null,
      equipmentDescriptionService,
      activityDescriptionService: null,
      injuryAggregationService,
      injuryNarrativeFormatterService,
      logger,
    });
  }

  function createBodyEntity() {
    return {
      id: 'entity-1',
      hasComponent: (componentId) =>
        componentId === 'anatomy:body' || componentId === 'items:inventory',
      getComponentData: (componentId) => {
        if (componentId === 'anatomy:body') {
          return { body: { root: 'root' } };
        }
        if (componentId === 'items:inventory') {
          return { items: ['item-1'] };
        }
        return null;
      },
    };
  }

  it('should insert Health between equipment and inventory', async () => {
    const composer = createComposer({
      injurySummary: { injuredParts: [{ partEntityId: 'p1' }] },
      healthNarrative: 'Arm is fractured.',
    });

    const bodyEntity = createBodyEntity();

    const description = await composer.composeDescription(bodyEntity);
    const lines = description.split('\n');

    expect(lines[0]).toBe('Wearing: Cloak.');
    expect(lines[1]).toBe('Health: Arm is fractured.');
    expect(lines[2]).toBe('Inventory: Coin.');
  });

  it('should fall back to perfect health when no visible injuries remain', async () => {
    const composer = createComposer({
      injurySummary: { injuredParts: [] },
      healthNarrative: 'Perfect health.',
      equipmentText: '',
    });

    const bodyEntity = createBodyEntity();
    const description = await composer.composeDescription(bodyEntity);

    expect(description).toContain('Health: Perfect health.');
    expect(description.trim().endsWith('Inventory: Coin.')).toBe(true);
  });
});
