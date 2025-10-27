/**
 * @file Unit tests for SlotGenerator service
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import SlotGenerator from '../../../src/anatomy/slotGenerator.js';
import { createTestBed } from '../../common/testBed.js';

describe('SlotGenerator', () => {
  let testBed;
  let slotGenerator;

  beforeEach(() => {
    testBed = createTestBed();
    slotGenerator = new SlotGenerator({
      logger: testBed.mockLogger,
    });
  });

  describe('Constructor', () => {
    it('should require a logger dependency', () => {
      expect(() => {
        new SlotGenerator({});
      }).toThrow();
    });

    it('should initialize with valid dependencies', () => {
      expect(slotGenerator).toBeDefined();
    });
  });

  describe('generateBlueprintSlots', () => {
    it('should throw error if template is missing', () => {
      expect(() => {
        slotGenerator.generateBlueprintSlots(null);
      }).toThrow('Invalid structure template');
    });

    it('should throw error if topology is missing', () => {
      expect(() => {
        slotGenerator.generateBlueprintSlots({});
      }).toThrow('Invalid structure template');
    });

    it('should generate empty object for empty template', () => {
      const template = {
        topology: {
          rootType: 'torso',
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(slots).toEqual({});
    });

    it('should generate slots from limbSets with indexed orientation', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'leg',
              count: 2,
              socketPattern: {
                idTemplate: 'leg_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['leg'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(Object.keys(slots)).toHaveLength(2);
      expect(slots['leg_1']).toEqual({
        socket: 'leg_1',
        requirements: {
          partType: 'leg',
          components: ['anatomy:part'],
        },
        optional: false,
      });
      expect(slots['leg_2']).toEqual({
        socket: 'leg_2',
        requirements: {
          partType: 'leg',
          components: ['anatomy:part'],
        },
        optional: false,
      });
    });

    it('should generate slots from appendages', () => {
      const template = {
        topology: {
          rootType: 'torso',
          appendages: [
            {
              type: 'head',
              count: 1,
              attachment: 'anterior',
              socketPattern: {
                idTemplate: 'head',
                orientationScheme: 'indexed',
                allowedTypes: ['head'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(Object.keys(slots)).toHaveLength(1);
      expect(slots['head']).toEqual({
        socket: 'head',
        requirements: {
          partType: 'head',
          components: ['anatomy:part'],
        },
        optional: false,
      });
    });

    it('should handle optional flag from limbSets', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'tail',
              count: 1,
              optional: true,
              socketPattern: {
                idTemplate: 'tail',
                orientationScheme: 'indexed',
                allowedTypes: ['tail'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(slots['tail'].optional).toBe(true);
    });

    it('should handle optional flag from appendages', () => {
      const template = {
        topology: {
          rootType: 'torso',
          appendages: [
            {
              type: 'antenna',
              count: 2,
              attachment: 'anterior',
              optional: true,
              socketPattern: {
                idTemplate: 'antenna_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['antenna'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(slots['antenna_1'].optional).toBe(true);
      expect(slots['antenna_2'].optional).toBe(true);
    });

    it('should not throw error when static idTemplate creates same key (last wins)', () => {
      // When idTemplate is static without variables, same key is generated multiple times
      // In JavaScript object, last assignment wins - this is expected behavior
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'leg',
              count: 2,
              socketPattern: {
                idTemplate: 'leg',
                orientationScheme: 'indexed',
                allowedTypes: ['leg'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      // Only one slot key exists (last one overwrites previous)
      expect(Object.keys(slots)).toHaveLength(1);
      expect(slots['leg']).toBeDefined();
    });

    it('should combine limbSets and appendages slots', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'leg',
              count: 2,
              socketPattern: {
                idTemplate: 'leg_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['leg'],
              },
            },
          ],
          appendages: [
            {
              type: 'head',
              count: 1,
              attachment: 'anterior',
              socketPattern: {
                idTemplate: 'head',
                orientationScheme: 'indexed',
                allowedTypes: ['head'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(Object.keys(slots)).toHaveLength(3);
      expect(slots['leg_1']).toBeDefined();
      expect(slots['leg_2']).toBeDefined();
      expect(slots['head']).toBeDefined();
    });
  });

  describe('Bilateral Orientation', () => {
    it('should generate left/right for bilateral orientation with count=2', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'arm',
              count: 2,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: 'arm_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['arm'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(Object.keys(slots)).toHaveLength(2);
      expect(slots['arm_left']).toBeDefined();
      expect(slots['arm_right']).toBeDefined();
    });

    it('should generate quadrupedal orientations for count=4 with quadrupedal arrangement', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'leg',
              count: 4,
              arrangement: 'quadrupedal',
              socketPattern: {
                idTemplate: 'leg_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['leg'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(Object.keys(slots)).toHaveLength(4);
      expect(slots['leg_left_front']).toBeDefined();
      expect(slots['leg_right_front']).toBeDefined();
      expect(slots['leg_left_rear']).toBeDefined();
      expect(slots['leg_right_rear']).toBeDefined();
    });

    it('should alternate left/right for bilateral with count > 2', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'eye',
              count: 6,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: 'eye_{{orientation}}_{{index}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['eye'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(Object.keys(slots)).toHaveLength(6);
      // Odd indices should be left, even should be right
      expect(slots['eye_left_1']).toBeDefined();
      expect(slots['eye_right_2']).toBeDefined();
      expect(slots['eye_left_3']).toBeDefined();
      expect(slots['eye_right_4']).toBeDefined();
      expect(slots['eye_left_5']).toBeDefined();
      expect(slots['eye_right_6']).toBeDefined();
    });
  });

  describe('Radial Orientation', () => {
    it('should use explicit positions array for radial orientation', () => {
      const template = {
        topology: {
          rootType: 'cephalothorax',
          limbSets: [
            {
              type: 'tentacle',
              count: 4,
              arrangement: 'radial',
              socketPattern: {
                idTemplate: 'tentacle_{{position}}',
                orientationScheme: 'radial',
                allowedTypes: ['tentacle'],
                positions: ['front', 'right', 'back', 'left'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(Object.keys(slots)).toHaveLength(4);
      expect(slots['tentacle_front']).toBeDefined();
      expect(slots['tentacle_right']).toBeDefined();
      expect(slots['tentacle_back']).toBeDefined();
      expect(slots['tentacle_left']).toBeDefined();
    });

    it('should generate octagonal positions for count=8 without explicit positions', () => {
      const template = {
        topology: {
          rootType: 'cephalothorax',
          limbSets: [
            {
              type: 'leg',
              count: 8,
              arrangement: 'radial',
              socketPattern: {
                idTemplate: 'leg_{{position}}',
                orientationScheme: 'radial',
                allowedTypes: ['leg'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(Object.keys(slots)).toHaveLength(8);
      expect(slots['leg_anterior']).toBeDefined();
      expect(slots['leg_anterior_right']).toBeDefined();
      expect(slots['leg_right']).toBeDefined();
      expect(slots['leg_posterior_right']).toBeDefined();
      expect(slots['leg_posterior']).toBeDefined();
      expect(slots['leg_posterior_left']).toBeDefined();
      expect(slots['leg_left']).toBeDefined();
      expect(slots['leg_anterior_left']).toBeDefined();
    });

    it('should generate generic positions for radial without explicit positions', () => {
      const template = {
        topology: {
          rootType: 'cephalothorax',
          limbSets: [
            {
              type: 'tentacle',
              count: 6,
              arrangement: 'radial',
              socketPattern: {
                idTemplate: 'tentacle_{{position}}',
                orientationScheme: 'radial',
                allowedTypes: ['tentacle'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(Object.keys(slots)).toHaveLength(6);
      expect(slots['tentacle_position_1']).toBeDefined();
      expect(slots['tentacle_position_2']).toBeDefined();
      expect(slots['tentacle_position_3']).toBeDefined();
      expect(slots['tentacle_position_4']).toBeDefined();
      expect(slots['tentacle_position_5']).toBeDefined();
      expect(slots['tentacle_position_6']).toBeDefined();
    });
  });

  describe('Custom Orientation', () => {
    it('should use explicit positions for custom orientation', () => {
      const template = {
        topology: {
          rootType: 'torso',
          appendages: [
            {
              type: 'wing',
              count: 2,
              attachment: 'dorsal',
              socketPattern: {
                idTemplate: 'wing_{{position}}',
                orientationScheme: 'custom',
                allowedTypes: ['wing'],
                positions: ['left_wing', 'right_wing'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(Object.keys(slots)).toHaveLength(2);
      expect(slots['wing_left_wing']).toBeDefined();
      expect(slots['wing_right_wing']).toBeDefined();
    });

    it('should fallback to position_N if custom orientation has no positions array', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'limb',
              count: 3,
              socketPattern: {
                idTemplate: 'limb_{{position}}',
                orientationScheme: 'custom',
                allowedTypes: ['limb'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(Object.keys(slots)).toHaveLength(3);
      expect(slots['limb_position_1']).toBeDefined();
      expect(slots['limb_position_2']).toBeDefined();
      expect(slots['limb_position_3']).toBeDefined();
      expect(testBed.mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Custom orientation scheme used without positions array')
      );
    });
  });

  describe('Template Variable Substitution', () => {
    it('should replace {{index}} variable', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'leg',
              count: 2,
              socketPattern: {
                idTemplate: 'leg_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['leg'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(slots['leg_1']).toBeDefined();
      expect(slots['leg_2']).toBeDefined();
    });

    it('should replace {{orientation}} variable', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'arm',
              count: 2,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: 'arm_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['arm'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(slots['arm_left']).toBeDefined();
      expect(slots['arm_right']).toBeDefined();
    });

    it('should replace {{position}} variable (alias for orientation)', () => {
      const template = {
        topology: {
          rootType: 'cephalothorax',
          limbSets: [
            {
              type: 'leg',
              count: 2,
              socketPattern: {
                idTemplate: 'leg_{{position}}',
                orientationScheme: 'radial',
                allowedTypes: ['leg'],
                positions: ['front', 'back'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(slots['leg_front']).toBeDefined();
      expect(slots['leg_back']).toBeDefined();
    });

    it('should replace {{type}} variable with first allowed type', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'limb',
              count: 2,
              socketPattern: {
                idTemplate: '{{type}}_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['spider_leg'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(slots['spider_leg_1']).toBeDefined();
      expect(slots['spider_leg_2']).toBeDefined();
    });

    it('should handle multiple variable replacements', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'arm',
              count: 2,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: '{{type}}_{{orientation}}_{{index}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['arm'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(slots['arm_left_1']).toBeDefined();
      expect(slots['arm_right_2']).toBeDefined();
    });
  });

  describe('Edge Cases', () => {
    it('should handle count=1', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'tail',
              count: 1,
              socketPattern: {
                idTemplate: 'tail',
                orientationScheme: 'indexed',
                allowedTypes: ['tail'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(Object.keys(slots)).toHaveLength(1);
      expect(slots['tail']).toBeDefined();
    });

    it('should handle empty limbSets array', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [],
          appendages: [
            {
              type: 'head',
              count: 1,
              attachment: 'anterior',
              socketPattern: {
                idTemplate: 'head',
                orientationScheme: 'indexed',
                allowedTypes: ['head'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(Object.keys(slots)).toHaveLength(1);
      expect(slots['head']).toBeDefined();
    });

    it('should handle empty appendages array', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'leg',
              count: 2,
              socketPattern: {
                idTemplate: 'leg_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['leg'],
              },
            },
          ],
          appendages: [],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(Object.keys(slots)).toHaveLength(2);
      expect(slots['leg_1']).toBeDefined();
      expect(slots['leg_2']).toBeDefined();
    });

    it('should handle static idTemplate without variables', () => {
      const template = {
        topology: {
          rootType: 'torso',
          appendages: [
            {
              type: 'head',
              count: 1,
              attachment: 'anterior',
              socketPattern: {
                idTemplate: 'anterior_head',
                orientationScheme: 'indexed',
                allowedTypes: ['head'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(slots['anterior_head']).toBeDefined();
    });
  });

  describe('Requirements Structure', () => {
    it('should include correct partType in requirements', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'spider_leg',
              count: 1,
              socketPattern: {
                idTemplate: 'leg_1',
                orientationScheme: 'indexed',
                allowedTypes: ['spider_leg'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(slots['leg_1'].requirements.partType).toBe('spider_leg');
    });

    it('should include anatomy:part component in requirements', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'arm',
              count: 1,
              socketPattern: {
                idTemplate: 'arm',
                orientationScheme: 'indexed',
                allowedTypes: ['arm'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);

      expect(slots['arm'].requirements.components).toEqual(['anatomy:part']);
    });
  });
});
