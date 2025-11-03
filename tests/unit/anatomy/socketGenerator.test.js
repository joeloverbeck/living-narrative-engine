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

    it('should default to indexed scheme when orientation is unknown', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'fin',
              count: 2,
              socketPattern: {
                idTemplate: 'fin_{{orientation}}',
                orientationScheme: 'mystery',
                allowedTypes: ['fin'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(2);
      expect(sockets[0].orientation).toBe('1');
      expect(sockets[1].orientation).toBe('2');
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

    it('should support quadrupedal orientation scheme explicitly', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'leg',
              count: 4,
              socketPattern: {
                idTemplate: 'quadruped_leg_{{orientation}}',
                orientationScheme: 'quadrupedal',
                allowedTypes: ['leg'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(4);
      expect(sockets.map((socket) => socket.orientation)).toEqual([
        'left_front',
        'right_front',
        'left_rear',
        'right_rear',
      ]);
      expect(sockets.map((socket) => socket.id)).toEqual([
        'quadruped_leg_left_front',
        'quadruped_leg_right_front',
        'quadruped_leg_left_rear',
        'quadruped_leg_right_rear',
      ]);
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
      expect(sockets[0].orientation).toBe('1');
      expect(sockets[4].orientation).toBe('5');
    });

    it('should generate fallback positions when explicit list is shorter than count', () => {
      const template = {
        topology: {
          rootType: 'orb',
          limbSets: [
            {
              type: 'tendril',
              count: 3,
              arrangement: 'radial',
              socketPattern: {
                idTemplate: 'tendril_{{position}}',
                orientationScheme: 'radial',
                allowedTypes: ['tendril'],
                positions: ['north', 'east'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(3);
      expect(sockets[0].orientation).toBe('north');
      expect(sockets[1].orientation).toBe('east');
      expect(sockets[2].orientation).toBe('3');
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
      expect(sockets[0].id).toBe('limb_1');
      expect(sockets[1].id).toBe('limb_2');
      expect(testBed.mockLogger.warn).toHaveBeenCalled();
      for (const [message] of testBed.mockLogger.warn.mock.calls) {
        expect(message).toContain(
          'Custom orientation scheme used without positions array'
        );
      }
    });

    it('should use fallback positions when custom array is shorter than count', () => {
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
                positions: ['alpha'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(3);
      expect(sockets[0].id).toBe('limb_alpha');
      expect(sockets[1].id).toBe('limb_2');
      expect(sockets[2].id).toBe('limb_3');
      expect(testBed.mockLogger.warn).not.toHaveBeenCalled();
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

    it('should default {{type}} to "part" when allowedTypes array is empty', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'attachment',
              count: 1,
              socketPattern: {
                idTemplate: 'attachment_{{type}}',
                orientationScheme: 'indexed',
                allowedTypes: [],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(1);
      expect(sockets[0].id).toBe('attachment_part');
      expect(sockets[0].allowedTypes).toEqual([]);
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

    it('should handle multiple limb sets with different orientation schemes', () => {
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
            {
              type: 'tentacle',
              count: 8,
              arrangement: 'radial',
              socketPattern: {
                idTemplate: 'tentacle_{{orientation}}',
                orientationScheme: 'radial',
                allowedTypes: ['tentacle'],
              },
            },
            {
              type: 'sensor',
              count: 3,
              socketPattern: {
                idTemplate: 'sensor_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['sensor'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(15);
      // Verify bilateral sockets
      expect(sockets.slice(0, 4).map((s) => s.id)).toEqual([
        'leg_left_front',
        'leg_right_front',
        'leg_left_rear',
        'leg_right_rear',
      ]);
      // Verify radial sockets
      expect(sockets.slice(4, 12).every((s) => s.id.startsWith('tentacle_'))).toBe(
        true
      );
      // Verify indexed sockets
      expect(sockets.slice(12, 15).map((s) => s.id)).toEqual([
        'sensor_1',
        'sensor_2',
        'sensor_3',
      ]);
    });

    it('should handle maximum appendage count (10)', () => {
      const template = {
        topology: {
          rootType: 'torso',
          appendages: [
            {
              type: 'eye',
              count: 10,
              socketPattern: {
                idTemplate: 'eye_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['eye'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(10);
      expect(sockets[0].id).toBe('eye_1');
      expect(sockets[9].id).toBe('eye_10');
    });
  });

  describe('Validation - Comprehensive', () => {
    it('should detect duplicate socket IDs across limbSets and appendages', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'arm',
              count: 1,
              socketPattern: {
                idTemplate: 'limb_socket',
                orientationScheme: 'indexed',
                allowedTypes: ['arm'],
              },
            },
          ],
          appendages: [
            {
              type: 'tail',
              count: 1,
              socketPattern: {
                idTemplate: 'limb_socket',
                orientationScheme: 'indexed',
                allowedTypes: ['tail'],
              },
            },
          ],
        },
      };

      expect(() => {
        socketGenerator.generateSockets(template);
      }).toThrow('Duplicate socket IDs');
      expect(() => {
        socketGenerator.generateSockets(template);
      }).toThrow('limb_socket');
    });

    it('should detect duplicate socket IDs within same limbSet', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'leg',
              count: 3,
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

    it('should handle empty allowedTypes array gracefully', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'generic',
              count: 1,
              socketPattern: {
                idTemplate: 'socket_{{type}}',
                orientationScheme: 'indexed',
                allowedTypes: [],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(1);
      expect(sockets[0].id).toBe('socket_part');
      expect(sockets[0].allowedTypes).toEqual([]);
    });
  });

  describe('Socket/Slot Synchronization Verification', () => {
    it('should generate socket IDs compatible with SlotGenerator keys - bilateral', () => {
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

      // These IDs must match SlotGenerator's slot keys exactly
      expect(sockets.map((s) => s.id)).toEqual(['arm_left', 'arm_right']);
    });

    it('should generate socket IDs compatible with SlotGenerator keys - radial octagonal', () => {
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

      // These IDs must match SlotGenerator's slot keys exactly
      expect(sockets.map((s) => s.id)).toEqual([
        'leg_anterior',
        'leg_anterior_right',
        'leg_right',
        'leg_posterior_right',
        'leg_posterior',
        'leg_posterior_left',
        'leg_left',
        'leg_anterior_left',
      ]);
    });

    it('should generate socket IDs compatible with SlotGenerator keys - custom positions', () => {
      const template = {
        topology: {
          rootType: 'body',
          limbSets: [
            {
              type: 'wing',
              count: 3,
              socketPattern: {
                idTemplate: 'wing_{{position}}',
                orientationScheme: 'custom',
                allowedTypes: ['wing'],
                positions: ['dorsal', 'lateral_left', 'lateral_right'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      // These IDs must match SlotGenerator's slot keys exactly
      expect(sockets.map((s) => s.id)).toEqual([
        'wing_dorsal',
        'wing_lateral_left',
        'wing_lateral_right',
      ]);
    });

    it('should generate socket IDs compatible with SlotGenerator keys - indexed', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'leg',
              count: 6,
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

      // These IDs must match SlotGenerator's slot keys exactly
      expect(sockets.map((s) => s.id)).toEqual([
        'leg_1',
        'leg_2',
        'leg_3',
        'leg_4',
        'leg_5',
        'leg_6',
      ]);
    });

    it('should generate socket IDs compatible with SlotGenerator keys - quadrupedal', () => {
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
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      // These IDs must match SlotGenerator's slot keys exactly
      expect(sockets.map((s) => s.id)).toEqual([
        'leg_left_front',
        'leg_right_front',
        'leg_left_rear',
        'leg_right_rear',
      ]);
    });
  });

  describe('Socket Index Storage', () => {
    it('should include index property in generated sockets', () => {
      const template = {
        topology: {
          rootType: 'mantle',
          limbSets: [
            {
              type: 'tentacle',
              count: 3,
              arrangement: 'radial',
              socketPattern: {
                idTemplate: 'tentacle_{{index}}',
                nameTpl: 'tentacle {{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['tentacle'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(3);
      // Verify each socket has an index property
      expect(sockets[0].index).toBe(1);
      expect(sockets[1].index).toBe(2);
      expect(sockets[2].index).toBe(3);
      // Verify index is used in socket IDs
      expect(sockets[0].id).toBe('tentacle_1');
      expect(sockets[1].id).toBe('tentacle_2');
      expect(sockets[2].id).toBe('tentacle_3');
    });

    it('should store index for name template substitution', () => {
      const template = {
        topology: {
          rootType: 'body',
          limbSets: [
            {
              type: 'leg',
              count: 4,
              arrangement: 'bilateral_pairs',
              socketPattern: {
                idTemplate: 'leg_{{orientation}}_{{index}}',
                nameTpl: '{{orientation}} leg {{index}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['leg'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      // Bilateral arrangement generates indices sequentially (not per pair)
      expect(sockets).toHaveLength(4);
      expect(sockets[0].index).toBe(1); // left front
      expect(sockets[1].index).toBe(2); // right front
      expect(sockets[2].index).toBe(3); // left rear
      expect(sockets[3].index).toBe(4); // right rear
    });
  });
});
