import { describe, expect, it } from '@jest/globals';
import fs from 'fs';
import path from 'path';
import { DescriptorFormatter } from '../../../src/anatomy/descriptorFormatter.js';
import { BodyPartDescriptionBuilder } from '../../../src/anatomy/bodyPartDescriptionBuilder.js';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';
import { AnatomyDescriptionService } from '../../../src/anatomy/anatomyDescriptionService.js';
import { AnatomyFormattingService } from '../../../src/services/anatomyFormattingService.js';
import {
  ANATOMY_BODY_COMPONENT_ID,
  ANATOMY_PART_COMPONENT_ID,
  DESCRIPTION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

describe('Body Description Generation Integration', () => {
  describe('Individual body part descriptions', () => {
    it('should generate description for a breast with descriptors', () => {
      // Setup
      const descriptorFormatter = new DescriptorFormatter();
      const bodyPartDescriptionBuilder = new BodyPartDescriptionBuilder({
        descriptorFormatter,
      });

      // Create a test breast entity
      const breastEntity = {
        id: 'test-breast',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'breast' },
          'descriptors:size_specific': { size: 'D-cup' },
          'descriptors:weight_feel': { weight: 'meaty' },
          'descriptors:firmness': { firmness: 'firm' },
        },
      };

      const description =
        bodyPartDescriptionBuilder.buildDescription(breastEntity);
      expect(description).toBe('D-cup, meaty, firm');
    });

    it('should generate description for an eye with descriptors', () => {
      const descriptorFormatter = new DescriptorFormatter();
      const bodyPartDescriptionBuilder = new BodyPartDescriptionBuilder({
        descriptorFormatter,
      });

      const eyeEntity = {
        id: 'test-eye',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'eye' },
          'descriptors:color_extended': { color: 'cobalt' },
          'descriptors:shape_eye': { shape: 'almond' },
        },
      };

      const description =
        bodyPartDescriptionBuilder.buildDescription(eyeEntity);
      expect(description).toBe('cobalt, almond');
    });

    it('should generate description for hair without article', () => {
      const descriptorFormatter = new DescriptorFormatter();
      const bodyPartDescriptionBuilder = new BodyPartDescriptionBuilder({
        descriptorFormatter,
      });

      const hairEntity = {
        id: 'test-hair',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'hair' },
          'descriptors:color_extended': { color: 'raven-black' },
          'descriptors:length_hair': { length: 'long' },
          'descriptors:hair_style': { style: 'straight' },
        },
      };

      const description =
        bodyPartDescriptionBuilder.buildDescription(hairEntity);
      expect(description).toBe('long, raven-black, straight');
    });

    it('should handle paired body parts', () => {
      const descriptorFormatter = new DescriptorFormatter();
      const bodyPartDescriptionBuilder = new BodyPartDescriptionBuilder({
        descriptorFormatter,
      });

      const eyes = [
        {
          id: 'eye-1',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'eye' },
            'descriptors:color_extended': { color: 'cobalt' },
            'descriptors:shape_eye': { shape: 'almond' },
          },
        },
        {
          id: 'eye-2',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'eye' },
            'descriptors:color_extended': { color: 'cobalt' },
            'descriptors:shape_eye': { shape: 'almond' },
          },
        },
      ];

      const description = bodyPartDescriptionBuilder.buildMultipleDescription(
        eyes,
        'eye'
      );
      expect(description).toBe('cobalt, almond');
    });
  });

  describe('Full body description composition', () => {
    it('should handle body without descriptors gracefully', async () => {
      const descriptorFormatter = new DescriptorFormatter();
      const bodyPartDescriptionBuilder = new BodyPartDescriptionBuilder({
        descriptorFormatter,
      });

      const minimalBody = {
        id: 'minimal-body',
        components: {
          [ANATOMY_BODY_COMPONENT_ID]: {
            recipeId: 'test:minimal',
            body: {
              root: 'torso',
              parts: { torso: 'torso' },
            },
          },
        },
        hasComponent: (componentId) => {
          return componentId === ANATOMY_BODY_COMPONENT_ID;
        },
        getComponentData: (componentId) => {
          return minimalBody.components[componentId];
        },
      };

      const minimalTorso = {
        id: 'torso',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'torso' },
        },
        hasComponent: (componentId) => {
          return componentId === ANATOMY_PART_COMPONENT_ID;
        },
        getComponentData: (componentId) => {
          return minimalTorso.components[componentId];
        },
      };

      // Mock entity finder to return our minimal entities
      const mockEntityFinder = {
        getEntityInstance: (id) => {
          if (id === 'minimal-body') return minimalBody;
          if (id === 'torso') return minimalTorso;
          return null;
        },
      };

      const mockBodyGraphService = {
        getAllParts: (bodyComponent) => [bodyComponent.root],
      };

      const composer = new BodyDescriptionComposer({
        bodyPartDescriptionBuilder,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
      });

      const description = await composer.composeDescription(minimalBody);
      expect(description).toBe('');
    });

    it('should compose a simple body with multiple parts', async () => {
      const descriptorFormatter = new DescriptorFormatter();
      const bodyPartDescriptionBuilder = new BodyPartDescriptionBuilder({
        descriptorFormatter,
      });

      const bodyEntity = {
        id: 'body-1',
        components: {
          [ANATOMY_BODY_COMPONENT_ID]: {
            recipeId: 'test:athletic',
            body: {
              root: 'torso-1',
              parts: {},
            },
          },
          'descriptors:build': { build: 'athletic' },
        },
        hasComponent: (componentId) => {
          return Object.prototype.hasOwnProperty.call(
            bodyEntity.components,
            componentId
          );
        },
        getComponentData: (componentId) => {
          return bodyEntity.components[componentId];
        },
      };

      const parts = {
        'torso-1': {
          id: 'torso-1',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'torso' },
            'core:description': { text: 'muscular' },
          },
          hasComponent: (componentId) => {
            return Object.prototype.hasOwnProperty.call(
              parts['torso-1'].components,
              componentId
            );
          },
          getComponentData: (componentId) => {
            return parts['torso-1'].components[componentId];
          },
        },
        'hair-1': {
          id: 'hair-1',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'hair' },
            'descriptors:color_extended': { color: 'blonde' },
            'descriptors:length_hair': { length: 'short' },
            'core:description': { text: 'short, blonde' },
          },
          hasComponent: (componentId) => {
            return Object.prototype.hasOwnProperty.call(
              parts['hair-1'].components,
              componentId
            );
          },
          getComponentData: (componentId) => {
            return parts['hair-1'].components[componentId];
          },
        },
        'eye-1': {
          id: 'eye-1',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'eye' },
            'descriptors:color_extended': { color: 'blue' },
            'core:description': { text: 'blue' },
          },
          hasComponent: (componentId) => {
            return Object.prototype.hasOwnProperty.call(
              parts['eye-1'].components,
              componentId
            );
          },
          getComponentData: (componentId) => {
            return parts['eye-1'].components[componentId];
          },
        },
        'eye-2': {
          id: 'eye-2',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'eye' },
            'descriptors:color_extended': { color: 'blue' },
            'core:description': { text: 'blue' },
          },
          hasComponent: (componentId) => {
            return Object.prototype.hasOwnProperty.call(
              parts['eye-2'].components,
              componentId
            );
          },
          getComponentData: (componentId) => {
            return parts['eye-2'].components[componentId];
          },
        },
      };

      const mockEntityFinder = {
        getEntityInstance: (id) => parts[id] || bodyEntity,
      };

      const mockBodyGraphService = {
        getAllParts: () => ['torso-1', 'hair-1', 'eye-1', 'eye-2'],
      };

      const composer = new BodyDescriptionComposer({
        bodyPartDescriptionBuilder,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
      });

      const description = await composer.composeDescription(bodyEntity);
      expect(description).toContain('Build: athletic');
      expect(description).toContain('Hair: short, blonde');
      expect(description).toContain('Eyes: blue');
    });
  });

  describe('AnatomyDescriptionService integration', () => {
    it('should update description components correctly', async () => {
      const descriptorFormatter = new DescriptorFormatter();
      const bodyPartDescriptionBuilder = new BodyPartDescriptionBuilder({
        descriptorFormatter,
      });

      // Mock components manager
      const updatedComponents = {};
      const mockComponentManager = {
        addComponent: (entityId, componentId, data) => {
          if (!updatedComponents[entityId]) {
            updatedComponents[entityId] = {};
          }
          updatedComponents[entityId][componentId] = data;
        },
        updateComponent: (entityId, componentId, data) => {
          if (!updatedComponents[entityId]) {
            updatedComponents[entityId] = {};
          }
          updatedComponents[entityId][componentId] = data;
        },
      };

      const bodyEntity = {
        id: 'body-1',
        components: {
          [ANATOMY_BODY_COMPONENT_ID]: {
            recipeId: 'test:simple',
            body: {
              root: 'torso-1',
              parts: {},
            },
          },
        },
        hasComponent: (componentId) => {
          return componentId === ANATOMY_BODY_COMPONENT_ID;
        },
        getComponentData: (componentId) => {
          return bodyEntity.components[componentId];
        },
      };

      const parts = {
        'body-1': bodyEntity,
        'torso-1': {
          id: 'torso-1',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'torso' },
          },
          hasComponent: (componentId) => {
            return componentId === ANATOMY_PART_COMPONENT_ID;
          },
          getComponentData: (componentId) => {
            return parts['torso-1'].components[componentId];
          },
        },
      };

      const mockEntityFinder = {
        getEntityInstance: (id) => parts[id],
      };

      const mockBodyGraphService = {
        getAllParts: () => ['torso-1'],
      };

      const mockBodyDescriptionComposer = {
        composeDescription: async () => 'A simple body with a torso.',
      };

      const service = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder,
        bodyDescriptionComposer: mockBodyDescriptionComposer,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
        componentManager: mockComponentManager,
      });

      // Generate descriptions
      await service.generateAllDescriptions(bodyEntity);

      // Check that descriptions were added
      // The torso has no descriptors, so it won't get a description component
      expect(updatedComponents['body-1']).toBeDefined();
      expect(updatedComponents['body-1'][DESCRIPTION_COMPONENT_ID]).toEqual({
        text: 'A simple body with a torso.',
      });
    });
  });

  describe('Teeth description coverage', () => {
    const loadDefaultFormattingConfig = () => {
      const formattingConfigPath = path.resolve(
        process.cwd(),
        'data/mods/anatomy/anatomy-formatting/default.json'
      );
      return JSON.parse(fs.readFileSync(formattingConfigPath, 'utf8'));
    };

    const createPart = (id, subType, description) => {
      const components = {
        [ANATOMY_PART_COMPONENT_ID]: { subType },
        'core:description': { text: description },
      };
      return {
        id,
        components,
        hasComponent: (componentId) =>
          Object.prototype.hasOwnProperty.call(components, componentId),
        getComponentData: (componentId) => components[componentId],
      };
    };

    it('should surface teeth when formatting order includes the part', async () => {
      const formattingConfig = loadDefaultFormattingConfig();
      const formattingConfigWithMeta = { ...formattingConfig, _modId: 'anatomy' };

      const mockDataRegistry = {
        getAll: (type) =>
          type === 'anatomyFormatting' ? [formattingConfigWithMeta] : [],
        get: (type, id) => {
          if (type === 'meta' && id === 'final_mod_order') {
            return ['anatomy'];
          }
          if (type === 'anatomyFormatting' && id === 'default') {
            return formattingConfigWithMeta;
          }
          return null;
        },
      };

      const formattingService = new AnatomyFormattingService({
        dataRegistry: mockDataRegistry,
        logger: {
          info: () => {},
          warn: () => {},
          error: () => {},
          debug: () => {},
        },
        safeEventDispatcher: { dispatch: () => {} },
      });
      formattingService.initialize();

      const parts = {
        'torso-1': createPart('torso-1', 'torso', 'stocky torso'),
        'mouth-1': createPart('mouth-1', 'mouth', 'medium, firm'),
        'teeth-1': createPart(
          'teeth-1',
          'teeth',
          'large, ivory, chisel-shaped'
        ),
      };

      const bodyComponents = {
        [ANATOMY_BODY_COMPONENT_ID]: {
          recipeId: 'dredgers:beaver_folk_male_standard',
          body: { root: 'torso-1' },
        },
      };

      const bodyEntity = {
        id: 'actor-1',
        components: bodyComponents,
        hasComponent: (componentId) =>
          Object.prototype.hasOwnProperty.call(bodyComponents, componentId),
        getComponentData: (componentId) => bodyComponents[componentId],
      };

      const composer = new BodyDescriptionComposer({
        bodyGraphService: {
          getAllParts: () => Object.keys(parts),
        },
        entityFinder: {
          getEntityInstance: (id) => parts[id] || null,
        },
        anatomyFormattingService: formattingService,
      });

      const description = await composer.composeDescription(bodyEntity);

      expect(description).toContain('Mouth: medium, firm');
      expect(description).toContain('Teeth: large, ivory, chisel-shaped');
    });
  });
});
