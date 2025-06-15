import {
  NAME_COMPONENT_ID,
  POSITION_COMPONENT_ID,
} from '../../../src/constants/componentIds.js';

/**
 * Build a basic world with four actors A, B, C, D and two rooms.
 * All actors start unlocked in room1 except D who starts in room2.
 *
 * @returns {Array<{id:string, components:object}>}
 */
export function buildABCDWorld() {
  return [
    { id: 'room1', components: { [NAME_COMPONENT_ID]: { text: 'Room1' } } },
    { id: 'room2', components: { [NAME_COMPONENT_ID]: { text: 'Room2' } } },
    {
      id: 'a1',
      components: {
        [NAME_COMPONENT_ID]: { text: 'A' },
        [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        'core:movement': { locked: false },
      },
    },
    {
      id: 'b1',
      components: {
        [NAME_COMPONENT_ID]: { text: 'B' },
        [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        'core:movement': { locked: false },
      },
    },
    {
      id: 'c1',
      components: {
        [NAME_COMPONENT_ID]: { text: 'C' },
        [POSITION_COMPONENT_ID]: { locationId: 'room1' },
        'core:movement': { locked: false },
      },
    },
    {
      id: 'd1',
      components: {
        [NAME_COMPONENT_ID]: { text: 'D' },
        [POSITION_COMPONENT_ID]: { locationId: 'room2' },
        'core:movement': { locked: false },
      },
    },
  ];
}
