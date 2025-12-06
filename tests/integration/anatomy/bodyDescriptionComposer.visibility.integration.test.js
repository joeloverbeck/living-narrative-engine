import { beforeEach, describe, expect, it } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';

function createPart(
  id,
  subType,
  { description, visibilityRules, socketId, name }
) {
  const components = {
    'anatomy:part': { subType },
  };

  if (description) {
    components['core:description'] = { text: description };
  }

  if (visibilityRules) {
    components['anatomy:visibility_rules'] = visibilityRules;
  }

  if (socketId) {
    components['anatomy:joint'] = { socketId };
  }

  if (name) {
    components['core:name'] = { text: name };
  }

  return {
    id,
    hasComponent: (componentId) => componentId in components,
    getComponentData: (componentId) => components[componentId] || null,
  };
}

describe('BodyDescriptionComposer clothing visibility (integration)', () => {
  const genitalVisibility = {
    clothingSlotId: 'torso_lower',
    nonBlockingLayers: ['underwear', 'accessories'],
  };

  const descriptionOrder = [
    'breast',
    'pubic_hair',
    'vagina',
    'penis',
    'testicle',
    'equipment',
  ];

  let parts;
  let partIds;
  let entityFinder;
  let bodyGraphService;
  let anatomyFormattingService;
  let partDescriptionGenerator;
  let equipmentDescriptionService;
  let currentEquipmentLine;
  let bodyEntity;
  let equipmentData;
  let composer;

  beforeEach(() => {
    parts = {
      'breast-left': createPart('breast-left', 'breast', {
        description: 'ample',
        name: 'Left breast',
      }),
      'breast-right': createPart('breast-right', 'breast', {
        description: 'ample',
        name: 'Right breast',
      }),
      'pubic-hair': createPart('pubic-hair', 'pubic_hair', {
        description: 'trimmed',
        visibilityRules: genitalVisibility,
        socketId: 'pubic_hair',
      }),
      vagina: createPart('vagina', 'vagina', {
        description: 'pliant',
        visibilityRules: genitalVisibility,
        socketId: 'vagina',
      }),
      penis: createPart('penis', 'penis', {
        description: 'veined',
        visibilityRules: genitalVisibility,
        socketId: 'penis',
      }),
      'testicle-left': createPart('testicle-left', 'testicle', {
        description: 'full',
        visibilityRules: genitalVisibility,
        socketId: 'left_testicle',
        name: 'Left testicle',
      }),
      'testicle-right': createPart('testicle-right', 'testicle', {
        description: 'full',
        visibilityRules: genitalVisibility,
        socketId: 'right_testicle',
        name: 'Right testicle',
      }),
    };

    partIds = [
      'breast-left',
      'breast-right',
      'pubic-hair',
      'vagina',
      'penis',
      'testicle-left',
      'testicle-right',
    ];

    entityFinder = {
      getEntityInstance: (id) => parts[id] || null,
    };

    bodyGraphService = {
      getAllParts: () => partIds,
    };

    anatomyFormattingService = {
      getDescriptionOrder: () => descriptionOrder,
      getPairedParts: () => new Set(['breast', 'testicle']),
      getIrregularPlurals: () => ({ foot: 'feet', tooth: 'teeth' }),
    };

    partDescriptionGenerator = {
      generatePartDescription: () => '',
    };

    equipmentData = { equipped: {} };

    const slotMetadata = {
      slotMappings: {
        torso_lower: {
          coveredSockets: [
            'pubic_hair',
            'penis',
            'left_testicle',
            'right_testicle',
            'vagina',
          ],
          allowedLayers: ['underwear', 'base', 'outer', 'accessories'],
        },
      },
    };

    bodyEntity = {
      id: 'actor-visibility',
      hasComponent: (componentId) => componentId === 'anatomy:body',
      getComponentData: (componentId) => {
        if (componentId === 'anatomy:body') {
          return { body: { root: 'torso-root' } };
        }
        if (componentId === 'clothing:slot_metadata') {
          return slotMetadata;
        }
        if (componentId === 'clothing:equipment') {
          return equipmentData;
        }
        return null;
      },
    };

    currentEquipmentLine = '';
    equipmentDescriptionService = {
      generateEquipmentDescription: () => currentEquipmentLine,
    };

    composer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: {
        buildDescription: () => '',
        buildMultipleDescription: () => '',
        getPlural: () => '',
      },
      bodyGraphService,
      entityFinder,
      anatomyFormattingService,
      partDescriptionGenerator,
      equipmentDescriptionService,
      logger: {
        debug: () => {},
        info: () => {},
        warn: () => {},
        error: () => {},
      },
    });
  });

  it('omits genital lines when the controlling slot has a blocking layer', async () => {
    equipmentData.equipped = {
      torso_lower: {
        base: ['pants'],
      },
    };
    currentEquipmentLine = 'Wearing: pants';

    const description = await composer.composeDescription(bodyEntity);

    expect(description).toBe(['Breasts: ample', 'Wearing: pants'].join('\n'));
    expect(description).not.toMatch(/Penis:/);
    expect(description).not.toMatch(/Testicles:/);
    expect(description).not.toMatch(/Pubic hair:/);
    expect(description).not.toMatch(/Vagina:/);
  });

  it('shows genital lines when only non-blocking layers are equipped', async () => {
    equipmentData.equipped = {
      torso_lower: {
        underwear: ['briefs'],
      },
    };
    currentEquipmentLine = 'Wearing: briefs';

    const description = await composer.composeDescription(bodyEntity);

    expect(description).toBe(
      [
        'Breasts: ample',
        'Pubic hair: trimmed',
        'Vagina: pliant',
        'Penis: veined',
        'Testicles: full',
        'Wearing: briefs',
      ].join('\n')
    );
  });

  it('hides futanari genitals behind blocking layers and reveals them when removed', async () => {
    equipmentData.equipped = {
      torso_lower: {
        outer: ['skirt'],
      },
    };
    currentEquipmentLine = 'Wearing: skirt';

    const hiddenDescription = await composer.composeDescription(bodyEntity);
    expect(hiddenDescription).toBe(
      ['Breasts: ample', 'Wearing: skirt'].join('\n')
    );

    equipmentData.equipped = {
      torso_lower: {
        underwear: ['briefs'],
      },
    };
    currentEquipmentLine = 'Wearing: underwear';

    const revealedDescription = await composer.composeDescription(bodyEntity);
    expect(revealedDescription).toContain('Penis: veined');
    expect(revealedDescription).toContain('Vagina: pliant');
    expect(revealedDescription).toContain('Testicles: full');
    expect(revealedDescription.startsWith('Breasts: ample')).toBe(true);
  });
});
