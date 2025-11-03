/**
 * @file Integration tests verifying that SlotGenerator and SocketGenerator produce synchronized IDs
 * @description CRITICAL: Slot keys must exactly match socket IDs for proper blueprint processing
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import SlotGenerator from '../../../src/anatomy/slotGenerator.js';
import SocketGenerator from '../../../src/anatomy/socketGenerator.js';
import { createTestBed } from '../../common/testBed.js';

describe('SlotGenerator + SocketGenerator Synchronization', () => {
  let testBed;
  let slotGenerator;
  let socketGenerator;

  beforeEach(() => {
    testBed = createTestBed();
    slotGenerator = new SlotGenerator({
      logger: testBed.mockLogger,
    });
    socketGenerator = new SocketGenerator({
      logger: testBed.mockLogger,
    });
  });

  describe('Indexed Orientation', () => {
    it('should produce matching slot keys and socket IDs for indexed scheme', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'leg',
              count: 4,
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
      const sockets = socketGenerator.generateSockets(template);

      // Extract slot keys and socket IDs
      const slotKeys = Object.keys(slots).sort();
      const socketIds = sockets.map((s) => s.id).sort();

      // Verify they match exactly
      expect(slotKeys).toEqual(socketIds);
      expect(slotKeys).toEqual(['leg_1', 'leg_2', 'leg_3', 'leg_4']);
    });
  });

  describe('Bilateral Orientation', () => {
    it('should produce matching slot keys and socket IDs for bilateral pairs', () => {
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
      const sockets = socketGenerator.generateSockets(template);

      const slotKeys = Object.keys(slots).sort();
      const socketIds = sockets.map((s) => s.id).sort();

      expect(slotKeys).toEqual(socketIds);
      expect(slotKeys).toEqual(['arm_left', 'arm_right']);
    });

    it('should produce matching slot keys and socket IDs for quadrupedal arrangement', () => {
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
      const sockets = socketGenerator.generateSockets(template);

      const slotKeys = Object.keys(slots).sort();
      const socketIds = sockets.map((s) => s.id).sort();

      expect(slotKeys).toEqual(socketIds);
      expect(slotKeys).toEqual([
        'leg_left_front',
        'leg_left_rear',
        'leg_right_front',
        'leg_right_rear',
      ]);
    });

    it('should produce matching slot keys and socket IDs for bilateral with count > 2', () => {
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
      const sockets = socketGenerator.generateSockets(template);

      const slotKeys = Object.keys(slots).sort();
      const socketIds = sockets.map((s) => s.id).sort();

      expect(slotKeys).toEqual(socketIds);
      // Should alternate left/right (odd = left, even = right)
      expect(slotKeys).toEqual([
        'eye_left_1',
        'eye_left_3',
        'eye_left_5',
        'eye_right_2',
        'eye_right_4',
        'eye_right_6',
      ]);
    });
  });

  describe('Radial Orientation', () => {
    it('should produce matching slot keys and socket IDs for radial with explicit positions', () => {
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
      const sockets = socketGenerator.generateSockets(template);

      const slotKeys = Object.keys(slots).sort();
      const socketIds = sockets.map((s) => s.id).sort();

      expect(slotKeys).toEqual(socketIds);
      expect(slotKeys).toEqual([
        'tentacle_back',
        'tentacle_front',
        'tentacle_left',
        'tentacle_right',
      ]);
    });

    it('should produce matching slot keys and socket IDs for octagonal radial (count=8)', () => {
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
      const sockets = socketGenerator.generateSockets(template);

      const slotKeys = Object.keys(slots).sort();
      const socketIds = sockets.map((s) => s.id).sort();

      expect(slotKeys).toEqual(socketIds);
      expect(slotKeys).toEqual([
        'leg_anterior',
        'leg_anterior_left',
        'leg_anterior_right',
        'leg_left',
        'leg_posterior',
        'leg_posterior_left',
        'leg_posterior_right',
        'leg_right',
      ]);
    });

    it('should produce matching slot keys and socket IDs for radial without explicit positions', () => {
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
      const sockets = socketGenerator.generateSockets(template);

      const slotKeys = Object.keys(slots).sort();
      const socketIds = sockets.map((s) => s.id).sort();

      expect(slotKeys).toEqual(socketIds);
      expect(slotKeys).toEqual([
        'tentacle_1',
        'tentacle_2',
        'tentacle_3',
        'tentacle_4',
        'tentacle_5',
        'tentacle_6',
      ]);
    });
  });

  describe('Custom Orientation', () => {
    it('should produce matching slot keys and socket IDs for custom orientation', () => {
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
      const sockets = socketGenerator.generateSockets(template);

      const slotKeys = Object.keys(slots).sort();
      const socketIds = sockets.map((s) => s.id).sort();

      expect(slotKeys).toEqual(socketIds);
      expect(slotKeys).toEqual(['wing_left_wing', 'wing_right_wing']);
    });

    it('should produce matching slot keys and socket IDs for custom without positions', () => {
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
      const sockets = socketGenerator.generateSockets(template);

      const slotKeys = Object.keys(slots).sort();
      const socketIds = sockets.map((s) => s.id).sort();

      expect(slotKeys).toEqual(socketIds);
      expect(slotKeys).toEqual([
        'limb_1',
        'limb_2',
        'limb_3',
      ]);
    });
  });

  describe('Complex Templates', () => {
    it('should produce matching keys/IDs for complex template with mixed orientation schemes', () => {
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
          appendages: [
            {
              type: 'pedipalp',
              count: 2,
              attachment: 'anterior',
              socketPattern: {
                idTemplate: 'pedipalp_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['pedipalp'],
              },
            },
            {
              type: 'spinneret',
              count: 3,
              attachment: 'posterior',
              socketPattern: {
                idTemplate: 'spinneret_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['spinneret'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);
      const sockets = socketGenerator.generateSockets(template);

      const slotKeys = Object.keys(slots).sort();
      const socketIds = sockets.map((s) => s.id).sort();

      // Verify exact match
      expect(slotKeys).toEqual(socketIds);

      // Verify total count
      expect(slotKeys).toHaveLength(8 + 2 + 3);

      // Verify all expected IDs are present
      const expectedIds = [
        // 8 legs (octagonal)
        'leg_anterior',
        'leg_anterior_right',
        'leg_right',
        'leg_posterior_right',
        'leg_posterior',
        'leg_posterior_left',
        'leg_left',
        'leg_anterior_left',
        // 2 pedipalps (bilateral)
        'pedipalp_left',
        'pedipalp_right',
        // 3 spinnerets (indexed)
        'spinneret_1',
        'spinneret_2',
        'spinneret_3',
      ].sort();

      expect(slotKeys).toEqual(expectedIds);
    });

    it('should verify every slot key exists as a socket ID', () => {
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
            {
              type: 'leg',
              count: 2,
              arrangement: 'bilateral',
              socketPattern: {
                idTemplate: 'leg_{{orientation}}',
                orientationScheme: 'bilateral',
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
            {
              type: 'tail',
              count: 1,
              attachment: 'posterior',
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
      const sockets = socketGenerator.generateSockets(template);

      const socketIdSet = new Set(sockets.map((s) => s.id));

      // Verify every slot key exists as a socket ID
      for (const slotKey of Object.keys(slots)) {
        expect(socketIdSet.has(slotKey)).toBe(true);
        expect(slots[slotKey].socket).toBe(slotKey);
      }
    });
  });

  describe('Template Variable Consistency', () => {
    it('should apply template variables identically in both generators', () => {
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
      const sockets = socketGenerator.generateSockets(template);

      const slotKeys = Object.keys(slots).sort();
      const socketIds = sockets.map((s) => s.id).sort();

      expect(slotKeys).toEqual(socketIds);
      expect(slotKeys).toEqual(['arm_left_1', 'arm_right_2']);
    });

    it('should handle multiple occurrences of same variable', () => {
      const template = {
        topology: {
          rootType: 'torso',
          limbSets: [
            {
              type: 'limb',
              count: 2,
              socketPattern: {
                idTemplate: 'limb_{{index}}_num_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['limb'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);
      const sockets = socketGenerator.generateSockets(template);

      const slotKeys = Object.keys(slots).sort();
      const socketIds = sockets.map((s) => s.id).sort();

      expect(slotKeys).toEqual(socketIds);
      expect(slotKeys).toEqual(['limb_1_num_1', 'limb_2_num_2']);
    });
  });
});
