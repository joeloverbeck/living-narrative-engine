import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { BodyDescriptionComposer } from '../../../src/anatomy/bodyDescriptionComposer.js';
import { ANATOMY_BODY_COMPONENT_ID } from '../../../src/constants/componentIds.js';

describe('BodyDescriptionComposer', () => {
  let composer;
  let mockBodyPartDescriptionBuilder;
  let mockBodyGraphService;
  let mockEntityFinder;
  let mockAnatomyFormattingService;

  beforeEach(() => {
    // Create mocks
    mockBodyPartDescriptionBuilder = {
      buildDescription: jest.fn(),
      buildMultipleDescription: jest.fn(),
    };

    mockBodyGraphService = {
      getAllParts: jest.fn(),
    };

    mockEntityFinder = {
      getEntity: jest.fn(),
    };

    mockAnatomyFormattingService = {
      getDescriptionOrder: jest.fn(),
      getGroupedParts: jest.fn(),
    };

    // Create composer instance
    composer = new BodyDescriptionComposer({
      bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
      bodyGraphService: mockBodyGraphService,
      entityFinder: mockEntityFinder,
      anatomyFormattingService: mockAnatomyFormattingService,
    });
  });

  describe('composeDescription', () => {
    it('should return empty string for null entity', () => {
      const result = composer.composeDescription(null);
      expect(result).toBe('');
    });

    it('should return empty string for entity without anatomy:body component', () => {
      const entity = { components: {} };
      const result = composer.composeDescription(entity);
      expect(result).toBe('');
    });

    it('should return empty string for entity without rootPartId', () => {
      const entity = {
        components: {
          [ANATOMY_BODY_COMPONENT_ID]: {},
        },
      };
      const result = composer.composeDescription(entity);
      expect(result).toBe('');
    });

    it('should return empty string when no parts found', () => {
      const entity = {
        components: {
          [ANATOMY_BODY_COMPONENT_ID]: { rootPartId: 'root-1' },
        },
      };
      mockBodyGraphService.getAllParts.mockReturnValue([]);

      const result = composer.composeDescription(entity);
      expect(result).toBe('');
    });

    it('should compose complete body description', () => {
      const bodyEntity = {
        components: {
          [ANATOMY_BODY_COMPONENT_ID]: { rootPartId: 'torso-1' },
          'descriptors:build': { build: 'slender' },
        },
      };

      const partIds = ['torso-1', 'head-1', 'hair-1', 'eye-1', 'eye-2', 'arm-1', 'arm-2'];
      mockBodyGraphService.getAllParts.mockReturnValue(partIds);

      // Mock entity lookups
      mockEntityFinder.getEntity.mockImplementation((id) => {
        const entities = {
          'torso-1': { components: { 'anatomy:part': { subType: 'torso' } } },
          'head-1': { components: { 'anatomy:part': { subType: 'head' } } },
          'hair-1': { components: { 'anatomy:part': { subType: 'hair' } } },
          'eye-1': { components: { 'anatomy:part': { subType: 'eye' } } },
          'eye-2': { components: { 'anatomy:part': { subType: 'eye' } } },
          'arm-1': { components: { 'anatomy:part': { subType: 'arm' } } },
          'arm-2': { components: { 'anatomy:part': { subType: 'arm' } } },
        };
        return entities[id];
      });

      // Mock formatting service
      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue([
        'build', 'hair', 'eye', 'face', 'torso', 'arm',
      ]);
      mockAnatomyFormattingService.getGroupedParts.mockReturnValue(
        new Set(['eye', 'arm'])
      );

      // Mock descriptions
      mockBodyPartDescriptionBuilder.buildDescription.mockImplementation((entity) => {
        const subType = entity.components['anatomy:part'].subType;
        if (subType === 'hair') return 'long black hair';
        if (subType === 'torso') return 'a muscular torso';
        return '';
      });

      mockBodyPartDescriptionBuilder.buildMultipleDescription.mockImplementation((parts, type) => {
        if (type === 'eye') return 'piercing blue eyes';
        if (type === 'arm') return 'strong arms';
        return '';
      });

      const result = composer.composeDescription(bodyEntity);

      expect(result).toContain('A slender figure');
      expect(result).toContain('with long black hair');
      expect(result).toContain('piercing blue eyes');
      expect(result).toContain('The body has a muscular torso');
      expect(result).toContain('strong arms');
    });

    it('should use default values when anatomyFormattingService not provided', () => {
      composer = new BodyDescriptionComposer({
        bodyPartDescriptionBuilder: mockBodyPartDescriptionBuilder,
        bodyGraphService: mockBodyGraphService,
        entityFinder: mockEntityFinder,
        // No anatomyFormattingService
      });

      const bodyEntity = {
        components: {
          [ANATOMY_BODY_COMPONENT_ID]: { rootPartId: 'torso-1' },
        },
      };

      mockBodyGraphService.getAllParts.mockReturnValue(['torso-1', 'eye-1']);
      mockEntityFinder.getEntity.mockImplementation((id) => {
        if (id === 'torso-1') return { components: { 'anatomy:part': { subType: 'torso' } } };
        if (id === 'eye-1') return { components: { 'anatomy:part': { subType: 'eye' } } };
        return null;
      });

      mockBodyPartDescriptionBuilder.buildDescription.mockReturnValue('a torso');
      mockBodyPartDescriptionBuilder.buildMultipleDescription.mockReturnValue('an eye');

      const result = composer.composeDescription(bodyEntity);

      expect(result).toBeTruthy();
      // Should use default description order and grouped parts
    });

    it('should handle parts without subType', () => {
      const bodyEntity = {
        components: {
          [ANATOMY_BODY_COMPONENT_ID]: { rootPartId: 'torso-1' },
        },
      };

      mockBodyGraphService.getAllParts.mockReturnValue(['torso-1', 'invalid-1']);
      mockEntityFinder.getEntity.mockImplementation((id) => {
        if (id === 'torso-1') return { components: { 'anatomy:part': { subType: 'torso' } } };
        if (id === 'invalid-1') return { components: { 'anatomy:part': {} } }; // No subType
        return null;
      });

      mockAnatomyFormattingService.getDescriptionOrder.mockReturnValue(['torso']);
      mockAnatomyFormattingService.getGroupedParts.mockReturnValue(new Set());

      mockBodyPartDescriptionBuilder.buildDescription.mockReturnValue('a torso');

      const result = composer.composeDescription(bodyEntity);

      expect(result).toContain('The body has a torso');
    });
  });

  describe('groupPartsByType', () => {
    it('should group parts by subtype', () => {
      const partIds = ['arm-1', 'arm-2', 'leg-1'];
      
      mockEntityFinder.getEntity.mockImplementation((id) => {
        const entities = {
          'arm-1': { components: { 'anatomy:part': { subType: 'arm' } } },
          'arm-2': { components: { 'anatomy:part': { subType: 'arm' } } },
          'leg-1': { components: { 'anatomy:part': { subType: 'leg' } } },
        };
        return entities[id];
      });

      const result = composer.groupPartsByType(partIds);

      expect(result.size).toBe(2);
      expect(result.get('arm')).toHaveLength(2);
      expect(result.get('leg')).toHaveLength(1);
    });

    it('should skip null entities', () => {
      const partIds = ['valid-1', 'null-1'];
      
      mockEntityFinder.getEntity.mockImplementation((id) => {
        if (id === 'valid-1') return { components: { 'anatomy:part': { subType: 'arm' } } };
        return null;
      });

      const result = composer.groupPartsByType(partIds);

      expect(result.size).toBe(1);
      expect(result.get('arm')).toHaveLength(1);
    });

    it('should skip entities without anatomy:part component', () => {
      const partIds = ['valid-1', 'no-anatomy-1'];
      
      mockEntityFinder.getEntity.mockImplementation((id) => {
        if (id === 'valid-1') return { components: { 'anatomy:part': { subType: 'arm' } } };
        if (id === 'no-anatomy-1') return { components: {} };
        return null;
      });

      const result = composer.groupPartsByType(partIds);

      expect(result.size).toBe(1);
      expect(result.get('arm')).toHaveLength(1);
    });

    it('should skip parts without subType', () => {
      const partIds = ['valid-1', 'no-subtype-1'];
      
      mockEntityFinder.getEntity.mockImplementation((id) => {
        if (id === 'valid-1') return { components: { 'anatomy:part': { subType: 'arm' } } };
        if (id === 'no-subtype-1') return { components: { 'anatomy:part': {} } };
        return null;
      });

      const result = composer.groupPartsByType(partIds);

      expect(result.size).toBe(1);
      expect(result.get('arm')).toHaveLength(1);
    });
  });

  describe('composeSinglePartDescription', () => {
    it('should return empty string for non-existent part type', () => {
      const partsByType = new Map();
      const result = composer.composeSinglePartDescription('missing', partsByType);
      expect(result).toBe('');
    });

    it('should use multiple description for grouped parts', () => {
      const parts = [
        { components: { 'anatomy:part': { subType: 'eye' } } },
        { components: { 'anatomy:part': { subType: 'eye' } } },
      ];
      const partsByType = new Map([['eye', parts]]);

      mockAnatomyFormattingService.getGroupedParts.mockReturnValue(new Set(['eye']));
      mockBodyPartDescriptionBuilder.buildMultipleDescription.mockReturnValue('two eyes');

      const result = composer.composeSinglePartDescription('eye', partsByType);

      expect(result).toBe('two eyes');
      expect(mockBodyPartDescriptionBuilder.buildMultipleDescription).toHaveBeenCalledWith(parts, 'eye');
    });

    it('should use single description for non-grouped parts', () => {
      const part = { components: { 'anatomy:part': { subType: 'nose' } } };
      const partsByType = new Map([['nose', [part]]]);

      mockAnatomyFormattingService.getGroupedParts.mockReturnValue(new Set(['eye']));
      mockBodyPartDescriptionBuilder.buildDescription.mockReturnValue('a small nose');

      const result = composer.composeSinglePartDescription('nose', partsByType);

      expect(result).toBe('a small nose');
      expect(mockBodyPartDescriptionBuilder.buildDescription).toHaveBeenCalledWith(part);
    });
  });

  describe('extractBuildDescription', () => {
    it('should extract build description', () => {
      const entity = {
        components: {
          'descriptors:build': { build: 'athletic' },
        },
      };

      const result = composer.extractBuildDescription(entity);
      expect(result).toBe('A athletic figure');
    });

    it('should return empty string without build component', () => {
      const entity = { components: {} };
      const result = composer.extractBuildDescription(entity);
      expect(result).toBe('');
    });

    it('should return empty string with empty build value', () => {
      const entity = {
        components: {
          'descriptors:build': { build: '' },
        },
      };

      const result = composer.extractBuildDescription(entity);
      expect(result).toBe('');
    });
  });

  describe('composeHeadDescription', () => {
    it('should compose head description with all features', () => {
      const partsByType = new Map([
        ['hair', [{ components: { 'anatomy:part': { subType: 'hair' } } }]],
        ['eye', [
          { components: { 'anatomy:part': { subType: 'eye' } } },
          { components: { 'anatomy:part': { subType: 'eye' } } },
        ]],
        ['nose', [{ components: { 'anatomy:part': { subType: 'nose' } } }]],
        ['mouth', [{ components: { 'anatomy:part': { subType: 'mouth' } } }]],
        ['ear', [
          { components: { 'anatomy:part': { subType: 'ear' } } },
          { components: { 'anatomy:part': { subType: 'ear' } } },
        ]],
      ]);

      mockBodyPartDescriptionBuilder.buildDescription.mockImplementation((part) => {
        const subType = part.components['anatomy:part'].subType;
        if (subType === 'hair') return 'silky black hair';
        if (subType === 'nose') return 'a sharp nose';
        if (subType === 'mouth') return 'full lips';
        return '';
      });

      mockBodyPartDescriptionBuilder.buildMultipleDescription.mockImplementation((parts, type) => {
        if (type === 'eye') return 'bright green eyes';
        if (type === 'ear') return 'pointed ears';
        return '';
      });

      const result = composer.composeHeadDescription(partsByType);

      expect(result).toContain('with silky black hair');
      expect(result).toContain('bright green eyes');
      expect(result).toContain('that frame a sharp nose, full lips, pointed ears');
    });

    it('should handle missing hair', () => {
      const partsByType = new Map([
        ['eye', [{ components: { 'anatomy:part': { subType: 'eye' } } }]],
      ]);

      mockBodyPartDescriptionBuilder.buildMultipleDescription.mockReturnValue('dark eyes');

      const result = composer.composeHeadDescription(partsByType);

      expect(result).toBe('with dark eyes');
    });

    it('should handle missing eyes', () => {
      const partsByType = new Map([
        ['hair', [{ components: { 'anatomy:part': { subType: 'hair' } } }]],
      ]);

      mockBodyPartDescriptionBuilder.buildDescription.mockReturnValue('red hair');

      const result = composer.composeHeadDescription(partsByType);

      expect(result).toBe('with red hair');
    });

    it('should return empty string with no head parts', () => {
      const partsByType = new Map();
      const result = composer.composeHeadDescription(partsByType);
      expect(result).toBe('');
    });
  });

  describe('composeFaceFeatures', () => {
    it('should compose face features', () => {
      const partsByType = new Map([
        ['nose', [{ components: { 'anatomy:part': { subType: 'nose' } } }]],
        ['mouth', [{ components: { 'anatomy:part': { subType: 'mouth' } } }]],
        ['ear', [
          { components: { 'anatomy:part': { subType: 'ear' } } },
          { components: { 'anatomy:part': { subType: 'ear' } } },
        ]],
      ]);

      mockBodyPartDescriptionBuilder.buildDescription.mockImplementation((part) => {
        const subType = part.components['anatomy:part'].subType;
        if (subType === 'nose') return 'a button nose';
        if (subType === 'mouth') return 'thin lips';
        return '';
      });

      mockBodyPartDescriptionBuilder.buildMultipleDescription.mockReturnValue('small ears');

      const result = composer.composeFaceFeatures(partsByType);

      expect(result).toBe(' that frame a button nose, thin lips, small ears');
    });

    it('should return empty string with no face features', () => {
      const partsByType = new Map();
      const result = composer.composeFaceFeatures(partsByType);
      expect(result).toBe('');
    });

    it('should skip empty descriptions', () => {
      const partsByType = new Map([
        ['nose', [{ components: { 'anatomy:part': { subType: 'nose' } } }]],
        ['mouth', [{ components: { 'anatomy:part': { subType: 'mouth' } } }]],
      ]);

      mockBodyPartDescriptionBuilder.buildDescription.mockImplementation((part) => {
        const subType = part.components['anatomy:part'].subType;
        if (subType === 'nose') return 'a small nose';
        return ''; // Empty mouth description
      });

      const result = composer.composeFaceFeatures(partsByType);

      expect(result).toBe(' that frame a small nose');
    });
  });

  describe('composeTorsoDescription', () => {
    it('should describe breasts when present', () => {
      const partsByType = new Map([
        ['breast', [
          { components: { 'anatomy:part': { subType: 'breast' } } },
          { components: { 'anatomy:part': { subType: 'breast' } } },
        ]],
      ]);

      mockBodyPartDescriptionBuilder.buildMultipleDescription.mockReturnValue('full breasts');

      const result = composer.composeTorsoDescription(partsByType);

      expect(result).toBe('The torso features full breasts');
    });

    it('should describe torso when no breasts', () => {
      const partsByType = new Map([
        ['torso', [{ components: { 'anatomy:part': { subType: 'torso' } } }]],
      ]);

      mockBodyPartDescriptionBuilder.buildDescription.mockReturnValue('a lean torso');

      const result = composer.composeTorsoDescription(partsByType);

      expect(result).toBe('The body has a lean torso');
    });

    it('should not describe torso when breasts are present', () => {
      const partsByType = new Map([
        ['breast', [
          { components: { 'anatomy:part': { subType: 'breast' } } },
          { components: { 'anatomy:part': { subType: 'breast' } } },
        ]],
        ['torso', [{ components: { 'anatomy:part': { subType: 'torso' } } }]],
      ]);

      mockBodyPartDescriptionBuilder.buildMultipleDescription.mockReturnValue('modest breasts');
      mockBodyPartDescriptionBuilder.buildDescription.mockReturnValue('a torso');

      const result = composer.composeTorsoDescription(partsByType);

      expect(result).toBe('The torso features modest breasts');
      expect(mockBodyPartDescriptionBuilder.buildDescription).not.toHaveBeenCalled();
    });

    it('should return empty string with no torso parts', () => {
      const partsByType = new Map();
      const result = composer.composeTorsoDescription(partsByType);
      expect(result).toBe('');
    });
  });

  describe('composeLimbDescription', () => {
    it('should compose limb descriptions', () => {
      const partsByType = new Map([
        ['arm', [
          { components: { 'anatomy:part': { subType: 'arm' } } },
          { components: { 'anatomy:part': { subType: 'arm' } } },
        ]],
        ['hand', [
          { components: { 'anatomy:part': { subType: 'hand' } } },
          { components: { 'anatomy:part': { subType: 'hand' } } },
        ]],
        ['leg', [
          { components: { 'anatomy:part': { subType: 'leg' } } },
          { components: { 'anatomy:part': { subType: 'leg' } } },
        ]],
        ['foot', [
          { components: { 'anatomy:part': { subType: 'foot' } } },
          { components: { 'anatomy:part': { subType: 'foot' } } },
        ]],
      ]);

      mockBodyPartDescriptionBuilder.buildMultipleDescription.mockImplementation((parts, type) => {
        if (type === 'arm') return 'muscular arms';
        if (type === 'hand') return 'calloused hands';
        if (type === 'leg') return 'long legs';
        if (type === 'foot') return 'bare feet';
        return '';
      });

      const result = composer.composeLimbDescription(partsByType);

      expect(result).toBe('muscular arms ending in calloused hands, long legs ending in bare feet complete the form.');
    });

    it('should handle missing hands and feet', () => {
      const partsByType = new Map([
        ['arm', [{ components: { 'anatomy:part': { subType: 'arm' } } }]],
        ['leg', [{ components: { 'anatomy:part': { subType: 'leg' } } }]],
      ]);

      mockBodyPartDescriptionBuilder.buildMultipleDescription.mockImplementation((parts, type) => {
        if (type === 'arm') return 'arms';
        if (type === 'leg') return 'legs';
        return '';
      });

      const result = composer.composeLimbDescription(partsByType);

      expect(result).toBe('arms, legs complete the form.');
    });

    it('should return empty string with no limbs', () => {
      const partsByType = new Map();
      const result = composer.composeLimbDescription(partsByType);
      expect(result).toBe('');
    });
  });

  describe('composeAppendageDescription', () => {
    it('should compose appendage with both main and end parts', () => {
      const partsByType = new Map([
        ['arm', [{ components: { 'anatomy:part': { subType: 'arm' } } }]],
        ['hand', [{ components: { 'anatomy:part': { subType: 'hand' } } }]],
      ]);

      mockBodyPartDescriptionBuilder.buildMultipleDescription.mockImplementation((parts, type) => {
        if (type === 'arm') return 'strong arms';
        if (type === 'hand') return 'delicate hands';
        return '';
      });

      const result = composer.composeAppendageDescription(partsByType, 'arm', 'hand');

      expect(result).toBe('strong arms ending in delicate hands');
    });

    it('should handle only main parts', () => {
      const partsByType = new Map([
        ['arm', [{ components: { 'anatomy:part': { subType: 'arm' } } }]],
      ]);

      mockBodyPartDescriptionBuilder.buildMultipleDescription.mockReturnValue('arms');

      const result = composer.composeAppendageDescription(partsByType, 'arm', 'hand');

      expect(result).toBe('arms');
    });

    it('should handle only end parts', () => {
      const partsByType = new Map([
        ['hand', [{ components: { 'anatomy:part': { subType: 'hand' } } }]],
      ]);

      mockBodyPartDescriptionBuilder.buildMultipleDescription.mockReturnValue('hands');

      const result = composer.composeAppendageDescription(partsByType, 'arm', 'hand');

      expect(result).toBe('hands');
    });

    it('should return empty string with neither part type', () => {
      const partsByType = new Map();
      const result = composer.composeAppendageDescription(partsByType, 'arm', 'hand');
      expect(result).toBe('');
    });

    it('should handle empty end parts array', () => {
      const partsByType = new Map([
        ['arm', [{ components: { 'anatomy:part': { subType: 'arm' } } }]],
        ['hand', []], // Empty array
      ]);

      mockBodyPartDescriptionBuilder.buildMultipleDescription.mockReturnValue('arms');

      const result = composer.composeAppendageDescription(partsByType, 'arm', 'hand');

      expect(result).toBe('arms');
    });
  });

  describe('composeSpecialDescription', () => {
    it('should compose special features', () => {
      const partsByType = new Map([
        ['wing', [
          { components: { 'anatomy:part': { subType: 'wing' } } },
          { components: { 'anatomy:part': { subType: 'wing' } } },
        ]],
        ['tail', [{ components: { 'anatomy:part': { subType: 'tail' } } }]],
      ]);

      mockBodyPartDescriptionBuilder.buildMultipleDescription.mockImplementation((parts, type) => {
        if (type === 'wing') return 'large feathered wings';
        if (type === 'tail') return 'a long tail';
        return '';
      });

      const result = composer.composeSpecialDescription(partsByType);

      expect(result).toBe('Special features include large feathered wings and a long tail.');
    });

    it('should handle single special feature', () => {
      const partsByType = new Map([
        ['tail', [{ components: { 'anatomy:part': { subType: 'tail' } } }]],
      ]);

      mockBodyPartDescriptionBuilder.buildMultipleDescription.mockReturnValue('a bushy tail');

      const result = composer.composeSpecialDescription(partsByType);

      expect(result).toBe('Special features include a bushy tail.');
    });

    it('should return empty string with no special features', () => {
      const partsByType = new Map();
      const result = composer.composeSpecialDescription(partsByType);
      expect(result).toBe('');
    });

    it('should skip empty descriptions', () => {
      const partsByType = new Map([
        ['wing', [{ components: { 'anatomy:part': { subType: 'wing' } } }]],
        ['tail', [{ components: { 'anatomy:part': { subType: 'tail' } } }]],
      ]);

      mockBodyPartDescriptionBuilder.buildMultipleDescription.mockImplementation((parts, type) => {
        if (type === 'wing') return 'wings';
        return ''; // Empty tail description
      });

      const result = composer.composeSpecialDescription(partsByType);

      expect(result).toBe('Special features include wings.');
    });
  });
});