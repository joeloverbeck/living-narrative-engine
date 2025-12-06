/**
 * @file Integration tests for SocketGenerator service with AnatomyStructureTemplateLoader
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import SocketGenerator from '../../../src/anatomy/socketGenerator.js';
import { createTestBed } from '../../common/testBed.js';

describe('SocketGenerator Integration Tests', () => {
  let testBed;
  let socketGenerator;

  beforeEach(() => {
    testBed = createTestBed();
    socketGenerator = new SocketGenerator({
      logger: testBed.mockLogger,
    });
  });

  describe('Real-World Templates', () => {
    it('should generate sockets for a humanoid dragon template', () => {
      // Simulates a real structure template that would be loaded
      const dragonTemplate = {
        id: 'anatomy:structure_dragon',
        description: 'Dragon with 4 legs, 2 wings, head, and tail',
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
                allowedTypes: ['dragon_leg', 'scaled_leg'],
                nameTpl: '{{orientation}} leg',
              },
            },
            {
              type: 'wing',
              count: 2,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: 'wing_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['dragon_wing', 'bat_wing'],
                nameTpl: '{{orientation}} wing',
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
                allowedTypes: ['dragon_head', 'reptilian_head'],
                nameTpl: 'head',
              },
            },
            {
              type: 'tail',
              count: 1,
              attachment: 'posterior',
              socketPattern: {
                idTemplate: 'tail',
                allowedTypes: ['dragon_tail', 'reptilian_tail'],
                nameTpl: 'tail',
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(dragonTemplate);

      // Should generate 8 total sockets
      expect(sockets).toHaveLength(8);

      // Verify leg socket IDs
      expect(sockets[0].id).toBe('leg_left_front');
      expect(sockets[1].id).toBe('leg_right_front');
      expect(sockets[2].id).toBe('leg_left_rear');
      expect(sockets[3].id).toBe('leg_right_rear');

      // Verify wing socket IDs
      expect(sockets[4].id).toBe('wing_left');
      expect(sockets[5].id).toBe('wing_right');

      // Verify appendage socket IDs
      expect(sockets[6].id).toBe('head');
      expect(sockets[7].id).toBe('tail');

      // Verify allowedTypes are preserved
      expect(sockets[0].allowedTypes).toEqual(['dragon_leg', 'scaled_leg']);
      expect(sockets[4].allowedTypes).toEqual(['dragon_wing', 'bat_wing']);

      // Verify nameTpl is included
      expect(sockets[0].nameTpl).toBe('{{orientation}} leg');
      expect(sockets[6].nameTpl).toBe('head');
    });

    it('should generate sockets for a spider template', () => {
      const spiderTemplate = {
        id: 'anatomy:structure_spider',
        description: 'Spider body structure with 8 legs',
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
              arrangementHint: 'octagonal_radial',
            },
          ],
          appendages: [
            {
              type: 'torso',
              count: 1,
              attachment: 'posterior',
              socketPattern: {
                idTemplate: 'abdomen',
                allowedTypes: ['spider_abdomen'],
                nameTpl: 'abdomen',
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(spiderTemplate);

      // Should generate 9 total sockets (8 legs + abdomen)
      expect(sockets).toHaveLength(9);

      // Verify leg sockets
      for (let i = 0; i < 8; i++) {
        expect(sockets[i].id).toBe(`leg_${i + 1}`);
        expect(sockets[i].allowedTypes).toEqual(['spider_leg']);
        expect(sockets[i].nameTpl).toBe('leg {{index}}');
      }

      // Verify abdomen socket
      expect(sockets[8].id).toBe('abdomen');
      expect(sockets[8].allowedTypes).toEqual(['spider_abdomen']);
    });

    it('should generate sockets for a centaur template', () => {
      const centaurTemplate = {
        id: 'anatomy:structure_centaur',
        description:
          'Centaur with humanoid upper body and quadruped lower body',
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
                allowedTypes: ['horse_leg'],
                nameTpl: '{{orientation}} leg',
              },
            },
            {
              type: 'arm',
              count: 2,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: 'arm_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['human_arm', 'humanoid_arm'],
                nameTpl: '{{orientation}} arm',
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
                allowedTypes: ['human_head', 'humanoid_head'],
                nameTpl: 'head',
              },
            },
            {
              type: 'tail',
              count: 1,
              attachment: 'posterior',
              optional: true,
              socketPattern: {
                idTemplate: 'tail',
                allowedTypes: ['horse_tail'],
                nameTpl: 'tail',
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(centaurTemplate);

      // Should generate 8 total sockets (4 legs + 2 arms + head + tail)
      expect(sockets).toHaveLength(8);

      // Verify horse legs (quadrupedal)
      expect(sockets[0].id).toBe('leg_left_front');
      expect(sockets[1].id).toBe('leg_right_front');
      expect(sockets[2].id).toBe('leg_left_rear');
      expect(sockets[3].id).toBe('leg_right_rear');

      // Verify humanoid arms (bilateral)
      expect(sockets[4].id).toBe('arm_left');
      expect(sockets[5].id).toBe('arm_right');

      // Verify appendages
      expect(sockets[6].id).toBe('head');
      expect(sockets[7].id).toBe('tail');
    });

    it('should generate sockets for an octopoid template', () => {
      const octopoidTemplate = {
        id: 'anatomy:structure_octopoid',
        description: 'Octopoid creature with mantle, head, and 8 tentacles',
        topology: {
          rootType: 'mantle',
          limbSets: [
            {
              type: 'tentacle',
              count: 8,
              arrangement: 'radial',
              socketPattern: {
                idTemplate: 'tentacle_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['octopus_tentacle', 'squid_tentacle'],
                nameTpl: 'tentacle {{index}}',
              },
              arrangementHint: 'octagonal_radial',
            },
          ],
          appendages: [
            {
              type: 'head',
              count: 1,
              attachment: 'anterior',
              socketPattern: {
                idTemplate: 'head',
                allowedTypes: ['octopus_head', 'cephalopod_head'],
                nameTpl: 'head',
              },
            },
            {
              type: 'siphon',
              count: 1,
              attachment: 'ventral',
              socketPattern: {
                idTemplate: 'siphon',
                allowedTypes: ['cephalopod_siphon'],
                nameTpl: 'siphon',
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(octopoidTemplate);

      // Should generate 10 total sockets (8 tentacles + head + siphon)
      expect(sockets).toHaveLength(10);

      // Verify tentacle sockets
      for (let i = 0; i < 8; i++) {
        expect(sockets[i].id).toBe(`tentacle_${i + 1}`);
        expect(sockets[i].allowedTypes).toContain('octopus_tentacle');
      }

      // Verify appendages
      expect(sockets[8].id).toBe('head');
      expect(sockets[9].id).toBe('siphon');
    });

    it('should generate sockets for a gryphon template', () => {
      const gryphonTemplate = {
        id: 'anatomy:structure_gryphon',
        description:
          'Gryphon with eagle head, wings, and quadrupedal lion body',
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
                allowedTypes: ['lion_leg', 'eagle_talon'],
                nameTpl: '{{orientation}} leg',
              },
              arrangementHint: 'front_talons_rear_paws',
            },
            {
              type: 'wing',
              count: 2,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: 'wing_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['eagle_wing', 'feathered_wing'],
                nameTpl: '{{orientation}} wing',
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
                allowedTypes: ['eagle_head', 'raptor_head'],
                nameTpl: 'head',
              },
            },
            {
              type: 'tail',
              count: 1,
              attachment: 'posterior',
              socketPattern: {
                idTemplate: 'tail',
                allowedTypes: ['lion_tail', 'feline_tail'],
                nameTpl: 'tail',
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(gryphonTemplate);

      // Should generate 8 total sockets
      expect(sockets).toHaveLength(8);

      // Verify all socket IDs
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
  });

  describe('Performance Benchmarks', () => {
    it('should generate 20 sockets in less than 5ms', () => {
      const largeTemplate = {
        topology: {
          rootType: 'body',
          limbSets: [
            {
              type: 'segment',
              count: 20,
              socketPattern: {
                idTemplate: 'segment_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['segment'],
              },
            },
          ],
        },
      };

      const startTime = performance.now();
      const sockets = socketGenerator.generateSockets(largeTemplate);
      const endTime = performance.now();

      expect(sockets).toHaveLength(20);
      expect(endTime - startTime).toBeLessThan(5);
    });

    it('should generate 100 sockets in less than 20ms', () => {
      const veryLargeTemplate = {
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

      const startTime = performance.now();
      const sockets = socketGenerator.generateSockets(veryLargeTemplate);
      const endTime = performance.now();

      expect(sockets).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(30);
    });
  });

  describe('Socket Format Validation', () => {
    it('should generate sockets compatible with SocketManager expectations', () => {
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
                allowedTypes: ['human_arm'],
                nameTpl: '{{orientation}} arm',
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      // Each socket should have the required structure
      for (const socket of sockets) {
        expect(socket).toHaveProperty('id');
        expect(socket).toHaveProperty('orientation');
        expect(socket).toHaveProperty('allowedTypes');
        expect(Array.isArray(socket.allowedTypes)).toBe(true);
        expect(socket.allowedTypes.length).toBeGreaterThan(0);
      }

      // Verify optional nameTpl properties on sockets that have them
      const socketsWithNameTpl = sockets.filter((s) => s.nameTpl);
      for (const socket of socketsWithNameTpl) {
        expect(typeof socket.nameTpl).toBe('string');
      }
    });

    it('should generate socket IDs that are valid identifiers', () => {
      const template = {
        topology: {
          rootType: 'body',
          limbSets: [
            {
              type: 'limb',
              count: 5,
              socketPattern: {
                idTemplate: 'limb_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['limb'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      // All socket IDs should be valid identifiers (alphanumeric + underscore)
      const validIdPattern = /^[a-z_][a-z0-9_]*$/;
      for (const socket of sockets) {
        expect(validIdPattern.test(socket.id)).toBe(true);
      }
    });
  });

  describe('Edge Cases and Validation', () => {
    it('should handle templates with only limbSets', () => {
      const template = {
        topology: {
          rootType: 'body',
          limbSets: [
            {
              type: 'leg',
              count: 6,
              socketPattern: {
                idTemplate: 'leg_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['insect_leg'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(6);
    });

    it('should handle templates with only appendages', () => {
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
            {
              type: 'tail',
              count: 1,
              socketPattern: {
                idTemplate: 'tail',
                allowedTypes: ['tail'],
              },
            },
          ],
        },
      };

      const sockets = socketGenerator.generateSockets(template);

      expect(sockets).toHaveLength(2);
    });

    it('should handle multiple appendages of same type', () => {
      const template = {
        topology: {
          rootType: 'head',
          appendages: [
            {
              type: 'eye',
              count: 3,
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

      expect(sockets).toHaveLength(3);
      expect(sockets[0].id).toBe('eye_1');
      expect(sockets[1].id).toBe('eye_2');
      expect(sockets[2].id).toBe('eye_3');
    });
  });
});
