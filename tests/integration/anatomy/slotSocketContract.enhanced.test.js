/**
 * @file Enhanced contract tests for SlotGenerator ↔ SocketGenerator synchronization
 * @description Comprehensive edge case testing for all orientation schemes
 * Part of ANASYSREF-007: Comprehensive Testing Strategy
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import SlotGenerator from '../../../src/anatomy/slotGenerator.js';
import SocketGenerator from '../../../src/anatomy/socketGenerator.js';
import { createTestBed } from '../../common/testBed.js';

describe('SlotGenerator ↔ SocketGenerator Contract - Enhanced', () => {
  let testBed;
  let slotGenerator;
  let socketGenerator;

  beforeEach(() => {
    testBed = createTestBed();
    slotGenerator = new SlotGenerator({ logger: testBed.mockLogger });
    socketGenerator = new SocketGenerator({ logger: testBed.mockLogger });
  });

  describe('Edge Cases - All Schemes', () => {
    it('should generate matching keys for all orientation schemes with various counts', () => {
      const schemes = ['bilateral', 'radial', 'indexed', 'custom'];
      const counts = [1, 2, 8, 16];

      for (const scheme of schemes) {
        for (const count of counts) {
          // Skip custom with positions not provided for counts > 1
          if (scheme === 'custom' && count > 1) {
            continue;
          }

          // For bilateral, use index template for counts > 4 to avoid duplicates
          let idTemplate;
          if (scheme === 'bilateral' && count > 4) {
            idTemplate = 'test_{{orientation}}_{{index}}';
          } else if (scheme === 'indexed') {
            idTemplate = 'test_{{index}}';
          } else if (scheme === 'custom') {
            idTemplate = 'test_{{position}}';
          } else {
            idTemplate = 'test_{{orientation}}';
          }

          const template = {
            topology: {
              rootType: 'test_root',
              limbSets: [
                {
                  type: 'test_limb',
                  count,
                  socketPattern: {
                    orientationScheme: scheme,
                    idTemplate,
                    allowedTypes: ['test_type'],
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
          expect(slotKeys.length).toBe(count);
        }
      }
    });

    it('should handle quadrupedal arrangement (count=4, bilateral scheme)', () => {
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

    it('should handle single element (count=1) for all schemes', () => {
      const schemes = ['bilateral', 'radial', 'indexed', 'custom'];

      for (const scheme of schemes) {
        const template = {
          topology: {
            rootType: 'test_root',
            limbSets: [
              {
                type: 'single',
                count: 1,
                socketPattern: {
                  orientationScheme: scheme,
                  idTemplate:
                    scheme === 'indexed'
                      ? 'single_{{index}}'
                      : scheme === 'custom'
                        ? 'single_{{position}}'
                        : 'single_{{orientation}}',
                  allowedTypes: ['single'],
                },
              },
            ],
          },
        };

        const slots = slotGenerator.generateBlueprintSlots(template);
        const sockets = socketGenerator.generateSockets(template);

        const slotKeys = Object.keys(slots);
        const socketIds = sockets.map((s) => s.id);

        expect(slotKeys).toEqual(socketIds);
        expect(slotKeys.length).toBe(1);
      }
    });
  });

  describe('Edge Cases - Large Counts', () => {
    it('should handle bilateral with large count (16)', () => {
      const template = {
        topology: {
          rootType: 'test_root',
          limbSets: [
            {
              type: 'limb',
              count: 16,
              socketPattern: {
                idTemplate: 'limb_{{orientation}}_{{index}}',
                orientationScheme: 'bilateral',
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
      expect(slotKeys.length).toBe(16);

      // Verify alternating left/right pattern
      const leftCount = slotKeys.filter((k) => k.includes('left')).length;
      const rightCount = slotKeys.filter((k) => k.includes('right')).length;
      expect(leftCount).toBe(8);
      expect(rightCount).toBe(8);
    });

    it('should handle indexed with large count (20)', () => {
      const template = {
        topology: {
          rootType: 'test_root',
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

      const slots = slotGenerator.generateBlueprintSlots(template);
      const sockets = socketGenerator.generateSockets(template);

      const slotKeys = Object.keys(slots).sort();
      const socketIds = sockets.map((s) => s.id).sort();

      expect(slotKeys).toEqual(socketIds);
      expect(slotKeys.length).toBe(20);

      // Verify sequential numbering
      for (let i = 1; i <= 20; i++) {
        expect(slotKeys).toContain(`segment_${i}`);
      }
    });
  });

  describe('Edge Cases - Custom Positions', () => {
    it('should handle custom scheme with explicit positions', () => {
      const positions = ['alpha', 'beta', 'gamma', 'delta'];
      const template = {
        topology: {
          rootType: 'test_root',
          limbSets: [
            {
              type: 'custom_limb',
              count: 4,
              socketPattern: {
                idTemplate: 'limb_{{position}}',
                orientationScheme: 'custom',
                allowedTypes: ['limb'],
                positions,
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
        'limb_alpha',
        'limb_beta',
        'limb_delta',
        'limb_gamma',
      ]);
    });

    it('should handle radial scheme with explicit positions', () => {
      const positions = ['dorsal', 'ventral', 'lateral_left', 'lateral_right'];
      const template = {
        topology: {
          rootType: 'test_root',
          limbSets: [
            {
              type: 'fin',
              count: 4,
              socketPattern: {
                idTemplate: 'fin_{{position}}',
                orientationScheme: 'radial',
                allowedTypes: ['fin'],
                positions,
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
      expect(slotKeys.length).toBe(4);
    });
  });

  describe('Edge Cases - Multiple Limb Sets', () => {
    it('should maintain synchronization across multiple limb sets', () => {
      const template = {
        topology: {
          rootType: 'complex_body',
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
            {
              type: 'leg',
              count: 4,
              socketPattern: {
                idTemplate: 'leg_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['leg'],
              },
            },
            {
              type: 'tentacle',
              count: 8,
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
      expect(slotKeys.length).toBe(2 + 4 + 8);

      // Verify no duplicate keys
      expect(new Set(slotKeys).size).toBe(slotKeys.length);
    });
  });

  describe('Edge Cases - Mixed Template Variables', () => {
    it('should handle templates with all variable types', () => {
      const template = {
        topology: {
          rootType: 'test_root',
          limbSets: [
            {
              type: 'hybrid',
              count: 4,
              arrangement: 'quadrupedal',
              socketPattern: {
                idTemplate: '{{type}}_{{orientation}}_{{index}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['hybrid'],
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

      // Verify all keys include type, orientation, and index
      for (const key of slotKeys) {
        // For quadrupedal, expect left_front, left_rear, right_front, right_rear
        expect(key).toMatch(/^hybrid_(left|right)_(front|rear)_\d+$/);
      }
    });
  });

  describe('Edge Cases - Appendages', () => {
    it('should synchronize appendages with limbSets', () => {
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
      const sockets = socketGenerator.generateSockets(template);

      const slotKeys = Object.keys(slots).sort();
      const socketIds = sockets.map((s) => s.id).sort();

      expect(slotKeys).toEqual(socketIds);
      expect(slotKeys.length).toBe(4);

      // Verify all expected IDs present
      expect(slotKeys).toEqual(['arm_left', 'arm_right', 'head', 'tail']);
    });
  });

  describe('Data Integrity', () => {
    it('should ensure every slot has a corresponding socket with matching properties', () => {
      const template = {
        topology: {
          rootType: 'test_root',
          limbSets: [
            {
              type: 'limb',
              count: 4,
              socketPattern: {
                idTemplate: 'limb_{{orientation}}',
                orientationScheme: 'bilateral',
                allowedTypes: ['limb_type_a', 'limb_type_b'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);
      const sockets = socketGenerator.generateSockets(template);

      // Create lookup map for sockets
      const socketMap = new Map(sockets.map((s) => [s.id, s]));

      // Verify each slot has a matching socket
      for (const [slotKey, slotData] of Object.entries(slots)) {
        expect(socketMap.has(slotKey)).toBe(true);

        const socket = socketMap.get(slotKey);
        expect(slotData.socket).toBe(socket.id);

        // Verify allowedTypes match
        expect(socket.allowedTypes).toEqual(
          expect.arrayContaining(['limb_type_a', 'limb_type_b'])
        );
      }
    });

    it('should ensure no orphaned sockets (every socket has a slot)', () => {
      const template = {
        topology: {
          rootType: 'test_root',
          limbSets: [
            {
              type: 'limb',
              count: 3,
              socketPattern: {
                idTemplate: 'limb_{{index}}',
                orientationScheme: 'indexed',
                allowedTypes: ['limb'],
              },
            },
          ],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);
      const sockets = socketGenerator.generateSockets(template);

      const slotKeySet = new Set(Object.keys(slots));

      // Verify every socket has a corresponding slot
      for (const socket of sockets) {
        expect(slotKeySet.has(socket.id)).toBe(true);
      }
    });
  });

  describe('Empty Templates', () => {
    it('should handle template with no limbSets or appendages', () => {
      const template = {
        topology: {
          rootType: 'simple_root',
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);
      const sockets = socketGenerator.generateSockets(template);

      expect(Object.keys(slots)).toHaveLength(0);
      expect(sockets).toHaveLength(0);
    });

    it('should handle template with empty limbSets array', () => {
      const template = {
        topology: {
          rootType: 'simple_root',
          limbSets: [],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);
      const sockets = socketGenerator.generateSockets(template);

      expect(Object.keys(slots)).toHaveLength(0);
      expect(sockets).toHaveLength(0);
    });

    it('should handle template with empty appendages array', () => {
      const template = {
        topology: {
          rootType: 'simple_root',
          appendages: [],
        },
      };

      const slots = slotGenerator.generateBlueprintSlots(template);
      const sockets = socketGenerator.generateSockets(template);

      expect(Object.keys(slots)).toHaveLength(0);
      expect(sockets).toHaveLength(0);
    });
  });
});
