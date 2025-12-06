import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

describe('BodyDescriptionComposer visibility rules', () => {
  let composer;
  let bodyEntity;
  let entityFinder;
  let equipmentData;
  let slotMetadata;
  let partEntity;
  let entities;

  const bodyComponent = { body: { root: 'root' } };

  beforeEach(() => {
    equipmentData = { equipped: {} };
    slotMetadata = {
      slotMappings: {
        torso_lower: {
          coveredSockets: ['penis'],
          allowedLayers: ['underwear', 'base', 'outer'],
        },
      },
    };

    partEntity = {
      id: 'part-penis',
      hasComponent: jest.fn((componentId) =>
        [
          'anatomy:part',
          'anatomy:visibility_rules',
          'anatomy:joint',
          'core:description',
        ].includes(componentId)
      ),
      getComponentData: jest.fn((componentId) => {
        switch (componentId) {
          case 'anatomy:part':
            return { subType: 'penis' };
          case 'anatomy:visibility_rules':
            return {
              clothingSlotId: 'torso_lower',
              nonBlockingLayers: ['underwear', 'accessories'],
            };
          case 'anatomy:joint':
            return { socketId: 'penis' };
          case 'core:description':
            return { text: 'penis desc' };
          default:
            return null;
        }
      }),
    };

    entities = {
      [partEntity.id]: partEntity,
    };

    entityFinder = {
      getEntityInstance: jest.fn((id) => entities[id] || null),
    };

    bodyEntity = {
      id: 'actor-1',
      hasComponent: jest.fn((componentId) => componentId === 'anatomy:body'),
      getComponentData: jest.fn((componentId) => {
        switch (componentId) {
          case 'anatomy:body':
            return bodyComponent;
          case 'clothing:slot_metadata':
            return slotMetadata;
          case 'clothing:equipment':
            return equipmentData;
          default:
            return null;
        }
      }),
    };

    composer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: {
        buildDescription: jest.fn(),
        buildMultipleDescription: jest.fn(),
        getPlural: jest.fn(),
      },
      bodyGraphService: {
        getAllParts: jest.fn(() => [partEntity.id]),
      },
      entityFinder,
      anatomyFormattingService: {
        getDescriptionOrder: jest.fn(() => ['penis']),
        getGroupedParts: jest.fn(() => new Set()),
        getPairedParts: jest.fn(() => new Set()),
        getIrregularPlurals: jest.fn(() => ({})),
        formatDescriptorValue: jest.fn((label, value) => `${label}: ${value}`),
        formatPartName: jest.fn((value) => value),
      },
      partDescriptionGenerator: {
        generatePartDescription: jest.fn(),
      },
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      },
    });
  });

  it('hides parts when a blocking layer covers the socket', async () => {
    equipmentData.equipped = {
      torso_lower: {
        base: ['pants'],
      },
    };

    const description = await composer.composeDescription(bodyEntity);

    expect(description).toBe('');
  });

  it('allows parts when only non-blocking layers are equipped', async () => {
    equipmentData.equipped = {
      torso_lower: {
        underwear: ['briefs'],
      },
    };

    const description = await composer.composeDescription(bodyEntity);

    expect(description).toBe('Penis: penis desc');
  });

  it('shows parts when the controlling slot is empty', async () => {
    equipmentData.equipped = {};

    const description = await composer.composeDescription(bodyEntity);

    expect(description).toBe('Penis: penis desc');
  });

  it('hides parts when blocking and non-blocking layers are mixed', async () => {
    equipmentData.equipped = {
      torso_lower: {
        underwear: ['briefs'],
        base: ['pants'],
      },
    };

    const description = await composer.composeDescription(bodyEntity);

    expect(description).toBe('');
  });

  it('hides parts when secondary coverage blocks the controlling slot', async () => {
    entities.cloak = {
      id: 'cloak',
      hasComponent: jest.fn(),
      getComponentData: jest.fn((componentId) =>
        componentId === 'clothing:coverage_mapping'
          ? { covers: ['torso_lower'], coveragePriority: 'outer' }
          : null
      ),
    };

    equipmentData.equipped = {
      full_body: {
        outer: ['cloak'],
      },
    };

    const description = await composer.composeDescription(bodyEntity);

    expect(description).toBe('');
  });

  it('defaults to visible when slot metadata is missing', async () => {
    slotMetadata = null;

    const description = await composer.composeDescription(bodyEntity);

    expect(description).toBe('Penis: penis desc');
  });

  it('defaults to visible when the joint component is missing', async () => {
    partEntity = {
      ...partEntity,
      hasComponent: jest.fn((componentId) =>
        [
          'anatomy:part',
          'anatomy:visibility_rules',
          'core:description',
        ].includes(componentId)
      ),
      getComponentData: jest.fn((componentId) => {
        switch (componentId) {
          case 'anatomy:part':
            return { subType: 'penis' };
          case 'anatomy:visibility_rules':
            return {
              clothingSlotId: 'torso_lower',
              nonBlockingLayers: ['underwear', 'accessories'],
            };
          case 'core:description':
            return { text: 'penis desc' };
          default:
            return null;
        }
      }),
    };

    entities[partEntity.id] = partEntity;

    const description = await composer.composeDescription(bodyEntity);

    expect(description).toBe('Penis: penis desc');
  });

  it('defaults to visible when the visibility component is absent', async () => {
    partEntity = {
      ...partEntity,
      hasComponent: jest.fn((componentId) =>
        ['anatomy:part', 'anatomy:joint', 'core:description'].includes(
          componentId
        )
      ),
      getComponentData: jest.fn((componentId) => {
        switch (componentId) {
          case 'anatomy:part':
            return { subType: 'penis' };
          case 'anatomy:joint':
            return { socketId: 'penis' };
          case 'core:description':
            return { text: 'penis desc' };
          default:
            return null;
        }
      }),
    };

    entities[partEntity.id] = partEntity;

    const description = await composer.composeDescription(bodyEntity);

    expect(description).toBe('Penis: penis desc');
  });
});
