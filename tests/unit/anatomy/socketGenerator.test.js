/**
 * @file Unit tests for SocketGenerator service
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import SocketGenerator from '../../../src/anatomy/socketGenerator.js';
import { createTestBed } from '../../common/testBed.js';

describe('SocketGenerator', () => {
  let testBed;
  let socketGenerator;

  beforeEach(() => {
    testBed = createTestBed();
    socketGenerator = new SocketGenerator({
      logger: testBed.mockLogger,
    });
  });

  describe('Constructor', () => {
    it('should require a logger dependency', () => {
      expect(() => {
        new SocketGenerator({});
      }).toThrow();
    });

    it('should initialize with valid dependencies', () => {
      expect(socketGenerator).toBeDefined();
    });
  });

  describe('generateSockets', () => {
    it('should throw error if template is missing', () => {
      expect(() => {
        socketGenerator.generateSockets(null);
      }).toThrow('Invalid structure template');
    });

    it('should throw error if topology is missing', () => {
      expect(() => {
        socketGenerator.generateSockets({});
      }).toThrow('Invalid structure template');
    });

    it('should generate empty array for empty template', () => {
      const template = {
        topology: {
          rootType: 'torso',
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toEqual([]);
    });

    it('should generate sockets from limbSets', () => {
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

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(2);
      expect(sockets[0].id).toBe('leg_1');
      expect(sockets[1].id).toBe('leg_2');
    });

    it('should generate sockets from appendages', () => {
      const template = {
        topology: {
          rootType: 'torso',
          appendages: [
            {
              type: 'head',
              count: 1,
              socketPattern: {
                idTemplate: 'head',
                orientationScheme: 'indexed',
                allowedTypes: ['head'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(1);
      expect(sockets[0].id).toBe('head');
    });

    it('should generate sockets from both limbSets and appendages', () => {
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
              socketPattern: {
                idTemplate: 'head',
                orientationScheme: 'indexed',
                allowedTypes: ['head'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(3);
      expect(sockets.map((s) => s.id)).toEqual(['leg_1', 'leg_2', 'head']);
    });

    it('should throw error on duplicate socket IDs', () => {
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

      expect(() => {
        socketGenerator.generateSockets(template);
      }).toThrow('Duplicate socket IDs');
    });
  });

  describe('Orientation Schemes - indexed', () => {
    it('should generate indexed orientations', () => {
      const template = {
        topology: {
          rootType: 'cephalothorax',
          limbSets: [
            {
              type: 'leg',
              count: 4,
              socketPattern: {
                idTemplate: 'leg_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['spider_leg'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(4);
      expect(sockets[0].orientation).toBe('1');
      expect(sockets[1].orientation).toBe('2');
      expect(sockets[2].orientation).toBe('3');
      expect(sockets[3].orientation).toBe('4');
    });
  });

  describe('Orientation Schemes - bilateral', () => {
    it('should generate bilateral orientations for pairs', () => {
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

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(2);
      expect(sockets[0].id).toBe('arm_left');
      expect(sockets[0].orientation).toBe('left');
      expect(sockets[1].id).toBe('arm_right');
      expect(sockets[1].orientation).toBe('right');
    });

    it('should generate quadrupedal orientations', () => {
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

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(4);
      expect(sockets[0].id).toBe('leg_left_front');
      expect(sockets[1].id).toBe('leg_right_front');
      expect(sockets[2].id).toBe('leg_left_rear');
      expect(sockets[3].id).toBe('leg_right_rear');
    });

    it('should alternate left/right for larger sets', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'arm',
              count: 6,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: 'arm_{{orientation}}_{{index}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['arm'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(6);
      expect(sockets[0].orientation).toBe('left');
      expect(sockets[1].orientation).toBe('right');
      expect(sockets[2].orientation).toBe('left');
      expect(sockets[3].orientation).toBe('right');
    });
  });

  describe('Orientation Schemes - radial', () => {
    it('should use explicit positions array for radial', () => {
      const template = {
        topology: {
          rootType: 'mantle',
          limbSets: [
            {
              type: 'tentacle',
              count: 4,
              arrangement: 'radial',
              socketPattern: {
                idTemplate: 'tentacle_{{position}}',
                orientationScheme: 'radial',
                allowedTypes: ['tentacle'],
                positions: ['north', 'east', 'south', 'west'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(4);
      expect(sockets[0].id).toBe('tentacle_north');
      expect(sockets[1].id).toBe('tentacle_east');
      expect(sockets[2].id).toBe('tentacle_south');
      expect(sockets[3].id).toBe('tentacle_west');
    });

    it('should generate octagonal positions for count=8', () => {
      const template = {
        topology: {
          rootType: 'cephalothorax',
          limbSets: [
            {
              type: 'leg',
              count: 8,
              arrangement: 'radial',
              socketPattern: {
                idTemplate: 'leg_{{orientation}}',
                orientationScheme: 'radial',
                allowedTypes: ['spider_leg'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(8);
      expect(sockets[0].orientation).toBe('anterior');
      expect(sockets[1].orientation).toBe('anterior_right');
      expect(sockets[2].orientation).toBe('right');
      expect(sockets[7].orientation).toBe('anterior_left');
    });

    it('should fall back to position_N for other counts', () => {
      const template = {
        topology: {
          rootType: 'center',
          limbSets: [
            {
              type: 'arm',
              count: 5,
              arrangement: 'radial',
              socketPattern: {
                idTemplate: 'arm_{{orientation}}',
                orientationScheme: 'radial',
                allowedTypes: ['arm'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(5);
      expect(sockets[0].orientation).toBe('position_1');
      expect(sockets[4].orientation).toBe('position_5');
    });
  });

  describe('Orientation Schemes - custom', () => {
    it('should use explicit positions array', () => {
      const template = {
        topology: {
          rootType: 'body',
          limbSets: [
            {
              type: 'limb',
              count: 3,
              socketPattern: {
                idTemplate: 'limb_{{position}}',
                orientationScheme: 'custom',
                allowedTypes: ['limb'],
                positions: ['alpha', 'beta', 'gamma'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(3);
      expect(sockets[0].id).toBe('limb_alpha');
      expect(sockets[1].id).toBe('limb_beta');
      expect(sockets[2].id).toBe('limb_gamma');
    });

    it('should fall back to position_N if positions array is missing', () => {
      const template = {
        topology: {
          rootType: 'body',
          limbSets: [
            {
              type: 'limb',
              count: 2,
              socketPattern: {
                idTemplate: 'limb_{{position}}',
                orientationScheme: 'custom',
                allowedTypes: ['limb'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(2);
      expect(sockets[0].id).toBe('limb_position_1');
      expect(sockets[1].id).toBe('limb_position_2');
    });
  });

  describe('Template Variables', () => {
    it('should replace {{index}} variable', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'leg',
              count: 3,
              socketPattern: {
                idTemplate: 'leg_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['leg'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets[0].id).toBe('leg_1');
      expect(sockets[1].id).toBe('leg_2');
      expect(sockets[2].id).toBe('leg_3');
    });

    it('should replace {{orientation}} variable', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'arm',
              count: 2,
              socketPattern: {
                idTemplate: 'arm_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['arm'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets[0].id).toBe('arm_left');
      expect(sockets[1].id).toBe('arm_right');
    });

    it('should replace {{position}} variable', () => {
      const template = {
        topology: {
          rootType: 'body',
          limbSets: [
            {
              type: 'limb',
              count: 2,
              socketPattern: {
                idTemplate: 'limb_{{position}}',
                orientationScheme: 'custom',
                allowedTypes: ['limb'],
                positions: ['top', 'bottom'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets[0].id).toBe('limb_top');
      expect(sockets[1].id).toBe('limb_bottom');
    });

    it('should replace {{type}} variable', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'arm',
              count: 1,
              socketPattern: {
                idTemplate: '{{type}}_socket',
                orientationScheme: 'indexed',
                allowedTypes: ['human_arm'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets[0].id).toBe('human_arm_socket');
    });

    it('should handle multiple variables in one template', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'leg',
              count: 2,
              socketPattern: {
                idTemplate: '{{type}}_{{orientation}}_{{index}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['dragon_leg'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets[0].id).toBe('dragon_leg_left_1');
      expect(sockets[1].id).toBe('dragon_leg_right_2');
    });

    it('should handle static templates without variables', () => {
      const template = {
        topology: {
          rootType: 'torso',
          appendages: [
            {
              type: 'head',
              count: 1,
              socketPattern: {
                idTemplate: 'head',
                allowedTypes: ['head'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets[0].id).toBe('head');
    });
  });

  describe('Socket Properties', () => {
    it('should preserve allowedTypes array', () => {
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
                allowedTypes: ['human_arm', 'robotic_arm', 'scaled_arm'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets[0].allowedTypes).toEqual([
        'human_arm',
        'robotic_arm',
        'scaled_arm',
      ]);
    });

    it('should include nameTpl when provided', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'leg',
              count: 1,
              socketPattern: {
                idTemplate: 'leg',
                orientationScheme: 'indexed',
                allowedTypes: ['leg'],
                nameTpl: '{{orientation}} leg',
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets[0].nameTpl).toBe('{{orientation}} leg');
    });

    it('should omit nameTpl when not provided', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'leg',
              count: 1,
              socketPattern: {
                idTemplate: 'leg',
                orientationScheme: 'indexed',
                allowedTypes: ['leg'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets[0].nameTpl).toBeUndefined();
    });
  });

  describe('Complex Scenarios', () => {
    it('should generate spider sockets (8 legs)', () => {
      const template = {
        topology: {
          rootType: 'cephalothorax',
          limbSets: [
            {
              type: 'leg',
              count: 8,
              arrangement: 'radial',
              socketPattern: {
                idTemplate: 'leg_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['spider_leg'],
                nameTpl: 'leg {{index}}',
              },
            },
          ],
          appendages: [
            {
              type: 'abdomen',
              count: 1,
              socketPattern: {
                idTemplate: 'abdomen',
                allowedTypes: ['spider_abdomen'],
                nameTpl: 'abdomen',
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(9);
      expect(sockets.slice(0, 8).every((s) => s.id.startsWith('leg_'))).toBe(
        true
      );
      expect(sockets[8].id).toBe('abdomen');
    });

    it('should generate dragon sockets (4 legs, 2 wings, head, tail)', () => {
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
                allowedTypes: ['dragon_leg'],
              },
            },
            {
              type: 'wing',
              count: 2,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: 'wing_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['dragon_wing'],
              },
            },
          ],
          appendages: [
            {
              type: 'head',
              count: 1,
              socketPattern: {
                idTemplate: 'head',
                allowedTypes: ['dragon_head'],
              },
            },
            {
              type: 'tail',
              count: 1,
              socketPattern: {
                idTemplate: 'tail',
                allowedTypes: ['dragon_tail'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(8);
      expect(sockets.map((s) => s.id)).toEqual([
        'leg_left_front',
        'leg_right_front',
        'leg_left_rear',
        'leg_right_rear',
        'wing_left',
        'wing_right',
        'head',
        'tail',
      ]);
    });

    it('should handle maximum limb count (100)', () => {
      const template = {
        topology: {
          rootType: 'body',
          limbSets: [
            {
              type: 'segment',
              count: 100,
              socketPattern: {
                idTemplate: 'segment_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['segment'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(100);
      expect(sockets[0].id).toBe('segment_1');
      expect(sockets[99].id).toBe('segment_100');
    });
  });
});
