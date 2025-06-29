import { describe, expect, it } from '@jest/globals';
import { DescriptorFormatter } from '../../../src/anatomy/descriptorFormatter.js';
import { BodyPartDescriptionBuilder } from '../../../src/anatomy/bodyPartDescriptionBuilder.js';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';
import { AnatomyDescriptionService } from '../../../src/anatomy/anatomyDescriptionService.js';
import { BodyGraphService } from '../../../src/anatomy/bodyGraphService.js';
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

      const description = bodyPartDescriptionBuilder.buildDescription(breastEntity);
      expect(description).toBe('a D-cup, meaty, and firm breast');
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

      const description = bodyPartDescriptionBuilder.buildDescription(eyeEntity);
      expect(description).toBe('a cobalt, almond eye');
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

      const description = bodyPartDescriptionBuilder.buildDescription(hairEntity);
      expect(description).toBe('long, raven-black, and straight hair');
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
      expect(description).toBe('a pair of cobalt, almond eyes');
    });
  });

  describe('Full body description composition', () => {
    it('should handle body without descriptors gracefully', () => {
      const descriptorFormatter = new DescriptorFormatter();
      const bodyPartDescriptionBuilder = new BodyPartDescriptionBuilder({
        descriptorFormatter,
      });

      const minimalBody = {
        id: 'minimal-body',
        components: {
          [ANATOMY_BODY_COMPONENT_ID]: {
            rootPartId: 'torso',
            body: {
              root: 'torso',
              parts: { torso: 'torso' },
              allParts: ['torso'],
            },
          },
        },
      };

      const minimalTorso = {
        id: 'torso',
        components: {
          [ANATOMY_PART_COMPONENT_ID]: { subType: 'torso' },
        },
      };

      // Mock entity finder to return our minimal entities
      const mockEntityFinder = {
        getEntity: (id) => {
          if (id === 'minimal-body') return minimalBody;
          if (id === 'torso') return minimalTorso;
          return null;
        },
      };

      const mockBodyGraphService = {
        getAllParts: () => ['torso'],
      };

      const composer = new BodyDescriptionComposer({
        bodyPartDescriptionBuilder,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
      });

      const description = composer.composeDescription(minimalBody);
      expect(description).toBe('The body has a torso');
    });

    it('should compose a simple body with multiple parts', () => {
      const descriptorFormatter = new DescriptorFormatter();
      const bodyPartDescriptionBuilder = new BodyPartDescriptionBuilder({
        descriptorFormatter,
      });

      const bodyEntity = {
        id: 'body-1',
        components: {
          [ANATOMY_BODY_COMPONENT_ID]: {
            rootPartId: 'torso-1',
          },
          'descriptors:build': { build: 'athletic' },
        },
      };

      const parts = {
        'torso-1': {
          id: 'torso-1',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'torso' },
          },
        },
        'hair-1': {
          id: 'hair-1',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'hair' },
            'descriptors:color_extended': { color: 'blonde' },
            'descriptors:length_hair': { length: 'short' },
          },
        },
        'eye-1': {
          id: 'eye-1',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'eye' },
            'descriptors:color_extended': { color: 'blue' },
          },
        },
        'eye-2': {
          id: 'eye-2',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'eye' },
            'descriptors:color_extended': { color: 'blue' },
          },
        },
      };

      const mockEntityFinder = {
        getEntity: (id) => parts[id] || bodyEntity,
      };

      const mockBodyGraphService = {
        getAllParts: () => ['torso-1', 'hair-1', 'eye-1', 'eye-2'],
      };

      const composer = new BodyDescriptionComposer({
        bodyPartDescriptionBuilder,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
      });

      const description = composer.composeDescription(bodyEntity);
      expect(description).toContain('athletic figure');
      expect(description).toContain('short, blonde hair');
      expect(description).toContain('blue eyes');
    });
  });

  describe('AnatomyDescriptionService integration', () => {
    it('should update description components correctly', () => {
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
            rootPartId: 'torso-1',
          },
        },
      };

      const parts = {
        'body-1': bodyEntity,
        'torso-1': {
          id: 'torso-1',
          components: {
            [ANATOMY_PART_COMPONENT_ID]: { subType: 'torso' },
          },
        },
      };

      const mockEntityFinder = {
        getEntity: (id) => parts[id],
      };

      const mockBodyGraphService = {
        getAllParts: () => ['torso-1'],
      };

      const mockBodyDescriptionComposer = {
        composeDescription: () => 'A simple body with a torso.',
      };

      const service = new AnatomyDescriptionService({
        bodyPartDescriptionBuilder,
        bodyDescriptionComposer: mockBodyDescriptionComposer,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
        componentManager: mockComponentManager,
      });

      // Generate descriptions
      service.generateAllDescriptions(bodyEntity);

      // Check that descriptions were added
      expect(updatedComponents['torso-1'][DESCRIPTION_COMPONENT_ID]).toEqual({
        text: 'a torso',
      });
      expect(updatedComponents['body-1'][DESCRIPTION_COMPONENT_ID]).toEqual({
        text: 'A simple body with a torso.',
      });
    });
  });
});