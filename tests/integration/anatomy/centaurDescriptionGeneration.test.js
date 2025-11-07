import { describe, expect, it, beforeEach } from '@jest/globals';
import { BodyPartDescriptionBuilder } from '../../../src/anatomy/bodyPartDescriptionBuilder.js';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';
import { DescriptorFormatter } from '../../../src/anatomy/descriptorFormatter.js';
import { PartDescriptionGenerator } from '../../../src/anatomy/PartDescriptionGenerator.js';
import {
  ANATOMY_BODY_COMPONENT_ID,
  ANATOMY_PART_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('Centaur Description Generation Integration', () => {
  let composer;
  let mockEntityFinder;
  let mockBodyGraphService;
  let mockEntityManager;

  beforeEach(() => {
    const descriptorFormatter = new DescriptorFormatter();
    const bodyPartDescriptionBuilder = new BodyPartDescriptionBuilder({
      descriptorFormatter,
    });

    // Mock AnatomyFormattingService to match default.json configuration
    const mockAnatomyFormattingService = {
      getDescriptionOrder: () => [
        'height',
        'skin_color',
        'build',
        'body_composition',
        'body_hair',
        'smell',
        'head',
        'hair',
        'eye',
        'face',
        'ear',
        'nose',
        'mouth',
        'neck',
        'breast',
        'torso',
        'centaur_upper_torso',
        'centaur_torso',
        'arm',
        'hand',
        'leg',
        'centaur_leg_front',
        'centaur_leg_rear',
        'ass_cheek',
        'foot',
        'pubic_hair',
        'vagina',
        'penis',
        'testicle',
        'tail',
        'horse_tail',
        'wing',
        'spider_cephalothorax',
        'spider_leg',
        'spider_abdomen',
        'spider_pedipalp',
        'spinneret',
        'mantle',
        'tentacle',
        'ink_reservoir',
        'beak',
        'equipment_mount',
        'equipment',
        'activity',
      ],
      getGroupedParts: () => new Set(),
      getPairedParts: () => new Set(['eye', 'ear', 'arm', 'leg', 'hand', 'foot']),
      getIrregularPlurals: () => ({ foot: 'feet' }),
      getNoArticleParts: () => new Set(),
      getDescriptorOrder: () => ['descriptors:size_category', 'descriptors:color_basic'],
      getDescriptorValueKeys: () => ['value', 'color', 'size'],
    };

    // Mock logger
    const mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    };

    // Setup mock services
    mockEntityFinder = {
      getEntityInstance: () => null, // Will be overridden in tests
    };

    // Mock entityManager (exposed to test scope)
    mockEntityManager = {
      getEntityInstance: (id) => null, // Will be overridden per test
      hasComponent: () => false,
      getComponentData: () => null,
    };

    const partDescriptionGenerator = new PartDescriptionGenerator({
      logger: mockLogger,
      bodyPartDescriptionBuilder,
      entityManager: mockEntityManager,
    });

    mockBodyGraphService = {
      getAllParts: () => [], // Will be overridden in tests
    };

    composer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder,
      bodyGraphService: mockBodyGraphService,
      entityFinder: mockEntityFinder,
      anatomyFormattingService: mockAnatomyFormattingService,
      partDescriptionGenerator,
    });
  });

  describe('Current behavior - what DOES work', () => {
    it('should generate body-level descriptors correctly', async () => {
      // Create a centaur body entity with body descriptors
      const bodyEntity = {
        id: 'centaur-body',
        components: {
          [ANATOMY_BODY_COMPONENT_ID]: {
            recipeId: 'anatomy:centaur_warrior',
            body: {
              root: 'torso',
              descriptors: {
                height: 'very-tall',
                build: 'athletic',
                composition: 'lean',
                hairDensity: 'light',
              },
              parts: {},
            },
          },
        },
        hasComponent: (componentId) => componentId === ANATOMY_BODY_COMPONENT_ID,
        getComponentData: (componentId) => bodyEntity.components[componentId],
      };

      mockBodyGraphService.getAllParts = () => [];

      const description = await composer.composeDescription(bodyEntity);

      // These body descriptors SHOULD work and DO work
      expect(description).toContain('Height: very-tall');
      expect(description).toContain('Build: athletic');
      expect(description).toContain('Body composition: lean');
      expect(description).toContain('Body hair: light');
    });

    it('should generate descriptions for standard parts (head, arms)', async () => {
      const bodyEntity = {
        id: 'centaur-body',
        components: {
          [ANATOMY_BODY_COMPONENT_ID]: {
            recipeId: 'anatomy:centaur_warrior',
            body: {
              root: 'head-1',
              parts: {},
            },
          },
        },
        hasComponent: (componentId) => componentId === ANATOMY_BODY_COMPONENT_ID,
        getComponentData: (componentId) => bodyEntity.components[componentId],
      };

      const parts = {
        'head-1': {
          id: 'head-1',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'head' },
            'descriptors:embellishment': { embellishment: 'scarred' },
          },
          hasComponent: (componentId) => {
            return Object.prototype.hasOwnProperty.call(
              parts['head-1'].components,
              componentId
            );
          },
          getComponentData: (componentId) => parts['head-1'].components[componentId],
        },
        'arm-right': {
          id: 'arm-right',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'arm' },
            'descriptors:build': { build: 'muscular' },
          },
          hasComponent: (componentId) => {
            return Object.prototype.hasOwnProperty.call(
              parts['arm-right'].components,
              componentId
            );
          },
          getComponentData: (componentId) =>
            parts['arm-right'].components[componentId],
        },
        'arm-left': {
          id: 'arm-left',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'arm' },
            'descriptors:build': { build: 'hulking' },
          },
          hasComponent: (componentId) => {
            return Object.prototype.hasOwnProperty.call(
              parts['arm-left'].components,
              componentId
            );
          },
          getComponentData: (componentId) => parts['arm-left'].components[componentId],
        },
      };

      mockEntityFinder.getEntityInstance = (id) => parts[id] || bodyEntity;
      mockEntityManager.getEntityInstance = (id) => parts[id] || bodyEntity;
      mockBodyGraphService.getAllParts = () => ['head-1', 'arm-right', 'arm-left'];

      const description = await composer.composeDescription(bodyEntity);

      // These parts SHOULD work and DO work because 'head' and 'arm' are in descriptionOrder
      expect(description).toContain('Head: embellished with scarred');
      expect(description).toContain('Arm 1: muscular');
      expect(description).toContain('Arm 2: hulking');
    });
  });

  describe('Centaur-specific parts - now working', () => {
    it('should generate description for centaur_upper_torso', async () => {
      const bodyEntity = {
        id: 'centaur-body',
        components: {
          [ANATOMY_BODY_COMPONENT_ID]: {
            recipeId: 'anatomy:centaur_warrior',
            body: {
              root: 'upper-torso-1',
              parts: {},
            },
          },
        },
        hasComponent: (componentId) => componentId === ANATOMY_BODY_COMPONENT_ID,
        getComponentData: (componentId) => bodyEntity.components[componentId],
      };

      const parts = {
        'upper-torso-1': {
          id: 'upper-torso-1',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'centaur_upper_torso' },
            'descriptors:build': { build: 'muscular' },
          },
          hasComponent: (componentId) => {
            return Object.prototype.hasOwnProperty.call(
              parts['upper-torso-1'].components,
              componentId
            );
          },
          getComponentData: (componentId) =>
            parts['upper-torso-1'].components[componentId],
        },
      };

      mockEntityFinder.getEntityInstance = (id) => parts[id] || bodyEntity;
      mockEntityManager.getEntityInstance = (id) => parts[id] || bodyEntity;
      mockBodyGraphService.getAllParts = () => ['upper-torso-1'];

      const description = await composer.composeDescription(bodyEntity);

      // Now works! The system uses the full subType name 'centaur_upper_torso' as the display label
      expect(description).toContain('Centaur upper torso: muscular');
    });

    it('should generate description for centaur_torso', async () => {
      const bodyEntity = {
        id: 'centaur-body',
        components: {
          [ANATOMY_BODY_COMPONENT_ID]: {
            recipeId: 'anatomy:centaur_warrior',
            body: {
              root: 'centaur-torso-1',
              parts: {},
            },
          },
        },
        hasComponent: (componentId) => componentId === ANATOMY_BODY_COMPONENT_ID,
        getComponentData: (componentId) => bodyEntity.components[componentId],
      };

      const parts = {
        'centaur-torso-1': {
          id: 'centaur-torso-1',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'centaur_torso' },
            'descriptors:build': { build: 'powerful' },
          },
          hasComponent: (componentId) => {
            return Object.prototype.hasOwnProperty.call(
              parts['centaur-torso-1'].components,
              componentId
            );
          },
          getComponentData: (componentId) =>
            parts['centaur-torso-1'].components[componentId],
        },
      };

      mockEntityFinder.getEntityInstance = (id) => parts[id] || bodyEntity;
      mockEntityManager.getEntityInstance = (id) => parts[id] || bodyEntity;
      mockBodyGraphService.getAllParts = () => ['centaur-torso-1'];

      const description = await composer.composeDescription(bodyEntity);

      // Now works! The system uses the full subType name 'centaur_torso' as the display label
      expect(description).toContain('Centaur torso: powerful');
    });

    it('should NOT generate description for equipment_mount (has no descriptors)', async () => {
      const bodyEntity = {
        id: 'centaur-body',
        components: {
          [ANATOMY_BODY_COMPONENT_ID]: {
            recipeId: 'anatomy:centaur_warrior',
            body: {
              root: 'quiver-mount-1',
              parts: {},
            },
          },
        },
        hasComponent: (componentId) => componentId === ANATOMY_BODY_COMPONENT_ID,
        getComponentData: (componentId) => bodyEntity.components[componentId],
      };

      const parts = {
        'quiver-mount-1': {
          id: 'quiver-mount-1',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'equipment_mount' },
          },
          hasComponent: (componentId) => {
            return Object.prototype.hasOwnProperty.call(
              parts['quiver-mount-1'].components,
              componentId
            );
          },
          getComponentData: (componentId) =>
            parts['quiver-mount-1'].components[componentId],
        },
      };

      mockEntityFinder.getEntityInstance = (id) => parts[id] || bodyEntity;
      mockEntityManager.getEntityInstance = (id) => parts[id] || bodyEntity;
      mockBodyGraphService.getAllParts = () => ['quiver-mount-1'];

      const description = await composer.composeDescription(bodyEntity);

      // Equipment mount has no descriptors, so no description is generated (empty string)
      expect(description).toBe('');
    });

    it('should generate description for horse_tail (uses full subType name)', async () => {
      const bodyEntity = {
        id: 'centaur-body',
        components: {
          [ANATOMY_BODY_COMPONENT_ID]: {
            recipeId: 'anatomy:centaur_warrior',
            body: {
              root: 'tail-1',
              parts: {},
            },
          },
        },
        hasComponent: (componentId) => componentId === ANATOMY_BODY_COMPONENT_ID,
        getComponentData: (componentId) => bodyEntity.components[componentId],
      };

      const parts = {
        'tail-1': {
          id: 'tail-1',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'horse_tail' },
            'descriptors:length_category': { length: 'long' },
          },
          hasComponent: (componentId) => {
            return Object.prototype.hasOwnProperty.call(
              parts['tail-1'].components,
              componentId
            );
          },
          getComponentData: (componentId) => parts['tail-1'].components[componentId],
        },
      };

      mockEntityFinder.getEntityInstance = (id) => parts[id] || bodyEntity;
      mockEntityManager.getEntityInstance = (id) => parts[id] || bodyEntity;
      mockBodyGraphService.getAllParts = () => ['tail-1'];

      const description = await composer.composeDescription(bodyEntity);

      // Now works! The system uses the full subType name 'horse_tail' as the display label
      expect(description).toContain('Horse tail: long');
    });
  });

  describe('Complete centaur description - proving the full issue', () => {
    it('should generate a complete centaur description with ALL parts', async () => {
      const bodyEntity = {
        id: 'centaur-body',
        components: {
          [ANATOMY_BODY_COMPONENT_ID]: {
            recipeId: 'anatomy:centaur_warrior',
            body: {
              root: 'centaur-torso',
              descriptors: {
                height: 'very-tall',
                build: 'athletic',
                composition: 'lean',
                hairDensity: 'light',
              },
              parts: {},
            },
          },
        },
        hasComponent: (componentId) => componentId === ANATOMY_BODY_COMPONENT_ID,
        getComponentData: (componentId) => bodyEntity.components[componentId],
      };

      const parts = {
        'head-1': {
          id: 'head-1',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'head' },
            'descriptors:embellishment': { embellishment: 'scarred' },
          },
          hasComponent: (componentId) => {
            return Object.prototype.hasOwnProperty.call(
              parts['head-1'].components,
              componentId
            );
          },
          getComponentData: (componentId) => parts['head-1'].components[componentId],
        },
        'upper-torso-1': {
          id: 'upper-torso-1',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'centaur_upper_torso' },
            'descriptors:build': { build: 'muscular' },
          },
          hasComponent: (componentId) => {
            return Object.prototype.hasOwnProperty.call(
              parts['upper-torso-1'].components,
              componentId
            );
          },
          getComponentData: (componentId) =>
            parts['upper-torso-1'].components[componentId],
        },
        'centaur-torso-1': {
          id: 'centaur-torso-1',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'centaur_torso' },
            'descriptors:build': { build: 'powerful' },
          },
          hasComponent: (componentId) => {
            return Object.prototype.hasOwnProperty.call(
              parts['centaur-torso-1'].components,
              componentId
            );
          },
          getComponentData: (componentId) =>
            parts['centaur-torso-1'].components[componentId],
        },
        'arm-right': {
          id: 'arm-right',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'arm' },
            'descriptors:build': { build: 'muscular' },
          },
          hasComponent: (componentId) => {
            return Object.prototype.hasOwnProperty.call(
              parts['arm-right'].components,
              componentId
            );
          },
          getComponentData: (componentId) =>
            parts['arm-right'].components[componentId],
        },
        'arm-left': {
          id: 'arm-left',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'arm' },
            'descriptors:build': { build: 'hulking' },
          },
          hasComponent: (componentId) => {
            return Object.prototype.hasOwnProperty.call(
              parts['arm-left'].components,
              componentId
            );
          },
          getComponentData: (componentId) => parts['arm-left'].components[componentId],
        },
        'leg-lf': {
          id: 'leg-lf',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'leg' },
            'descriptors:build': { build: 'sturdy' },
          },
          hasComponent: (componentId) => {
            return Object.prototype.hasOwnProperty.call(
              parts['leg-lf'].components,
              componentId
            );
          },
          getComponentData: (componentId) => parts['leg-lf'].components[componentId],
        },
        'leg-rf': {
          id: 'leg-rf',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'leg' },
            'descriptors:build': { build: 'sturdy' },
          },
          hasComponent: (componentId) => {
            return Object.prototype.hasOwnProperty.call(
              parts['leg-rf'].components,
              componentId
            );
          },
          getComponentData: (componentId) => parts['leg-rf'].components[componentId],
        },
        'leg-lr': {
          id: 'leg-lr',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'leg' },
            'descriptors:build': { build: 'sturdy' },
          },
          hasComponent: (componentId) => {
            return Object.prototype.hasOwnProperty.call(
              parts['leg-lr'].components,
              componentId
            );
          },
          getComponentData: (componentId) => parts['leg-lr'].components[componentId],
        },
        'leg-rr': {
          id: 'leg-rr',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'leg' },
            'descriptors:build': { build: 'sturdy' },
          },
          hasComponent: (componentId) => {
            return Object.prototype.hasOwnProperty.call(
              parts['leg-rr'].components,
              componentId
            );
          },
          getComponentData: (componentId) => parts['leg-rr'].components[componentId],
        },
        'tail-1': {
          id: 'tail-1',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'horse_tail' },
            'descriptors:length_category': { length: 'long' },
          },
          hasComponent: (componentId) => {
            return Object.prototype.hasOwnProperty.call(
              parts['tail-1'].components,
              componentId
            );
          },
          getComponentData: (componentId) => parts['tail-1'].components[componentId],
        },
        'quiver-mount': {
          id: 'quiver-mount',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'equipment_mount' },
          },
          hasComponent: (componentId) => {
            return Object.prototype.hasOwnProperty.call(
              parts['quiver-mount'].components,
              componentId
            );
          },
          getComponentData: (componentId) =>
            parts['quiver-mount'].components[componentId],
        },
      };

      mockEntityFinder.getEntityInstance = (id) => parts[id] || bodyEntity;
      mockEntityManager.getEntityInstance = (id) => parts[id] || bodyEntity;
      mockBodyGraphService.getAllParts = () => [
        'head-1',
        'upper-torso-1',
        'centaur-torso-1',
        'arm-right',
        'arm-left',
        'leg-lf',
        'leg-rf',
        'leg-lr',
        'leg-rr',
        'tail-1',
        'quiver-mount',
      ];

      const description = await composer.composeDescription(bodyEntity);

      // Body descriptors - SHOULD work ✅
      expect(description).toContain('Height: very-tall');
      expect(description).toContain('Build: athletic');
      expect(description).toContain('Body composition: lean');
      expect(description).toContain('Body hair: light');

      // Standard parts - SHOULD work ✅
      expect(description).toContain('Head: embellished with scarred');
      expect(description).toContain('Arm 1: muscular');
      expect(description).toContain('Arm 2: hulking');
      // When all legs have the same descriptor, they're grouped
      expect(description).toContain('Legs: sturdy');

      // Centaur-specific parts - Now work! ✅
      expect(description).toContain('Centaur upper torso: muscular');
      expect(description).toContain('Centaur torso: powerful');
      expect(description).toContain('Horse tail: long');
      // Note: equipment_mount has no descriptors, so it doesn't appear in description
    });
  });
});
