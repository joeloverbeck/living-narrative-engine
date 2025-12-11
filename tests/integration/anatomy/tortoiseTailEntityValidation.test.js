import { describe, it, expect } from '@jest/globals';
import fs, { readFileSync } from 'fs';
import { join } from 'path';

const ANATOMY_DEFINITIONS_PATH = join(
  process.cwd(),
  'data/mods/anatomy/entities/definitions'
);
const CREATURE_DEFINITIONS_PATH = join(
  process.cwd(),
  'data/mods/anatomy-creatures/entities/definitions'
);
const STRUCTURE_TEMPLATE_PATH = join(
  process.cwd(),
  'data/mods/anatomy-creatures/structure-templates/structure_tortoise_biped.structure-template.json'
);

const loadDefinition = (filename) => {
  const creaturePath = join(CREATURE_DEFINITIONS_PATH, filename);
  if (fs.existsSync(creaturePath)) {
    return JSON.parse(readFileSync(creaturePath, 'utf-8'));
  }

  const anatomyPath = join(ANATOMY_DEFINITIONS_PATH, filename);
  return JSON.parse(readFileSync(anatomyPath, 'utf-8'));
};

describe('Tortoise Tail Entity Validation', () => {
  const tailEntity = loadDefinition('tortoise_tail.entity.json');

  describe('tortoise_tail entity', () => {
    it('should have correct entity ID', () => {
      expect(tailEntity.id).toBe('anatomy-creatures:tortoise_tail');
    });

    it('should have correct description', () => {
      expect(tailEntity.description).toBe('Short, thick reptilian tail');
    });

    it('should have anatomy:part component with tortoise_tail subType', () => {
      expect(tailEntity.components['anatomy:part']).toBeDefined();
      expect(tailEntity.components['anatomy:part'].subType).toBe(
        'tortoise_tail'
      );
    });

    it('should have core:name component with text "tail"', () => {
      expect(tailEntity.components['core:name']).toBeDefined();
      expect(tailEntity.components['core:name'].text).toBe('tail');
    });

    it('should have descriptors:texture component with "scaled" texture', () => {
      expect(tailEntity.components['descriptors:texture']).toBeDefined();
      expect(tailEntity.components['descriptors:texture'].texture).toBe(
        'scaled'
      );
    });

    it('should have descriptors:length_category component with "short" length', () => {
      expect(
        tailEntity.components['descriptors:length_category']
      ).toBeDefined();
      expect(tailEntity.components['descriptors:length_category'].length).toBe(
        'short'
      );
    });

    it('should have descriptors:shape_general component with "conical" shape', () => {
      expect(tailEntity.components['descriptors:shape_general']).toBeDefined();
      expect(tailEntity.components['descriptors:shape_general'].shape).toBe(
        'conical'
      );
    });

    it('should have descriptors:color_extended component with "dark-olive" color', () => {
      expect(tailEntity.components['descriptors:color_extended']).toBeDefined();
      expect(tailEntity.components['descriptors:color_extended'].color).toBe(
        'dark-olive'
      );
    });
  });

  describe('Terminal appendage structure', () => {
    it('should NOT have anatomy:sockets component (terminal appendage)', () => {
      expect(tailEntity.components['anatomy:sockets']).toBeUndefined();
    });

    it('should have exactly 8 components (no sockets, includes core:weight)', () => {
      const componentKeys = Object.keys(tailEntity.components);
      expect(componentKeys.length).toBe(8);
    });
  });

  describe('Component structure', () => {
    it('should have all required components', () => {
      expect(tailEntity.components['anatomy:part']).toBeDefined();
      expect(tailEntity.components['anatomy:part_health']).toBeDefined();
      expect(tailEntity.components['core:name']).toBeDefined();
      expect(tailEntity.components['descriptors:texture']).toBeDefined();
      expect(
        tailEntity.components['descriptors:length_category']
      ).toBeDefined();
      expect(tailEntity.components['descriptors:shape_general']).toBeDefined();
      expect(tailEntity.components['descriptors:color_extended']).toBeDefined();
    });

    it('should have only the expected component keys', () => {
      const expectedKeys = [
        'anatomy:part',
        'anatomy:part_health',
        'core:name',
        'descriptors:color_extended',
        'descriptors:length_category',
        'descriptors:shape_general',
        'descriptors:texture',
        'core:weight',
      ];
      const actualKeys = Object.keys(tailEntity.components);
      expect(actualKeys.sort()).toEqual(expectedKeys.sort());
    });
  });

  describe('Schema compliance', () => {
    it('should reference correct schema', () => {
      expect(tailEntity.$schema).toBe(
        'schema://living-narrative-engine/entity-definition.schema.json'
      );
    });

    it('should have subType matching structure template allowedTypes', () => {
      expect(tailEntity.components['anatomy:part'].subType).toBe(
        'tortoise_tail'
      );
    });
  });

  describe('Descriptor validation', () => {
    it('should use valid texture value from schema enum', () => {
      const validTextures = [
        'bumpy',
        'chitinous',
        'coarse',
        'concentric-teeth',
        'croc-embossed',
        'faceted',
        'fleece',
        'fuzzy',
        'glossy',
        'leathery',
        'lipless-slit',
        'matte',
        'mucous',
        'nodular-receptors',
        'pale-clammy',
        'rib-knit',
        'ridged',
        'rough',
        'rugged',
        'scarred',
        'scaled',
        'serrated-edges',
        'silky',
        'slick',
        'slimy',
        'smooth',
        'smooth-muscular',
        'smooth-segmented',
        'soft',
        'suckered',
        'terry',
        'translucent',
        'translucent-slick',
        'translucent-veined',
        'velvety',
        'webbed-clawed',
      ];
      expect(validTextures).toContain(
        tailEntity.components['descriptors:texture'].texture
      );
    });

    it('should use valid length category from schema enum', () => {
      const validLengths = [
        'very-short',
        'short',
        'average',
        'medium',
        'long',
        'very-long',
        'extremely-long',
        'immense',
      ];
      expect(validLengths).toContain(
        tailEntity.components['descriptors:length_category'].length
      );
    });

    it('should use valid shape from schema enum', () => {
      const validShapes = [
        'flat',
        'angular',
        'bulbous',
        'conical',
        'curved',
        'cylindrical',
        'domed',
        'elongated',
        'hooked',
        'oval',
        'round',
        'square',
        'tapered',
      ];
      expect(validShapes).toContain(
        tailEntity.components['descriptors:shape_general'].shape
      );
    });

    it('should use valid color from schema enum', () => {
      const validColors = [
        'abyssal-black',
        'amber',
        'auburn',
        'blood-red',
        'blonde',
        'blush-pink',
        'bronze',
        'brown-grey-mixed',
        'brunette',
        'charcoal-gray',
        'cobalt',
        'corpse-pale',
        'cream',
        'crimson',
        'dark-olive',
        'dark-purple',
        'deep-crimson',
        'deep-navy',
        'gold',
        'hazel',
        'indigo',
        'iridescent-blue-green',
        'iridescent-green',
        'midnight-blue',
        'mottled-gray',
        'mottled-purple-gray',
        'murky-green',
        'navy',
        'nude',
        'olive-green',
        'pale-blue',
        'ice-blue',
        'pale-pink',
        'pale-pink-internal-organs-visible',
        'pale-translucent',
        'pearl-white',
        'powder-pink',
        'pupil-less-amber',
        'raven-black',
        'reddish-brown',
        'sand-beige',
        'sickly-gray-green',
        'silver',
        'smoke-black',
        'tan-brown',
        'taupe',
        'translucent-white',
        'varied-human-colors',
        'violet',
        'warm-brown',
      ];
      expect(validColors).toContain(
        tailEntity.components['descriptors:color_extended'].color
      );
    });
  });

  describe('Invariants', () => {
    it('should be a terminal appendage (no sockets)', () => {
      expect(tailEntity.components['anatomy:sockets']).toBeUndefined();
    });

    it('should have scaled texture consistent with reptilian anatomy', () => {
      expect(tailEntity.components['descriptors:texture'].texture).toBe(
        'scaled'
      );
    });

    it('should have short length as specified for tortoise tail', () => {
      expect(tailEntity.components['descriptors:length_category'].length).toBe(
        'short'
      );
    });

    it('should have conical shape characteristic', () => {
      expect(tailEntity.components['descriptors:shape_general'].shape).toBe(
        'conical'
      );
    });

    it('should have color consistent with tortoise appearance', () => {
      expect(tailEntity.components['descriptors:color_extended'].color).toBe(
        'dark-olive'
      );
    });
  });

  describe('Compatibility with structure template', () => {
    const structureTemplate = JSON.parse(
      readFileSync(STRUCTURE_TEMPLATE_PATH, 'utf-8')
    );

    it('should be compatible with structure template tail appendage', () => {
      const tailAppendage = structureTemplate.topology.appendages.find(
        (a) => a.type === 'tail'
      );
      expect(tailAppendage).toBeDefined();
      expect(tailAppendage.socketPattern.allowedTypes).toContain(
        'tortoise_tail'
      );
    });

    it('should match structure template allowedTypes exactly', () => {
      const tailAppendage = structureTemplate.topology.appendages.find(
        (a) => a.type === 'tail'
      );
      expect(tailEntity.components['anatomy:part'].subType).toBe(
        tailAppendage.socketPattern.allowedTypes[0]
      );
    });
  });

  describe('Reptilian characteristics', () => {
    it('should have scaled texture like other tortoise limbs', () => {
      const armEntity = loadDefinition('tortoise_arm.entity.json');
      expect(tailEntity.components['descriptors:texture'].texture).toBe(
        armEntity.components['descriptors:texture'].texture
      );
    });

    it('should use length_category component (not generic length)', () => {
      expect(
        tailEntity.components['descriptors:length_category']
      ).toBeDefined();
      expect(tailEntity.components['descriptors:length']).toBeUndefined();
    });

    it('should have olive-green color consistent with tortoise body', () => {
      const armEntity = loadDefinition('tortoise_arm.entity.json');
      expect(tailEntity.components['descriptors:color_extended'].color).toBe(
        armEntity.components['descriptors:color_extended'].color
      );
    });
  });
});
