/**
 * @file Test suite to ensure the context get the necessary data so down the line the scope can be processed.
 * @see tests/integration/scope.integration.test.js
 */

import { describe, test, expect } from '@jest/globals';
import { getEntityIdsForScopes } from '../../src/entities/entityScopeService.js';
import { TurnContext } from '../../src/turns/context/turnContext.js';

/* ---------------------------------------------------------------- *\
   Cheap stub implementations – just enough for the scope helpers.
\* ---------------------------------------------------------------- */
const makeStubEntity = (id, comps = {}) => ({
  id,
  hasComponent: (cmpId) => !!comps[cmpId],
  getComponentData: (cmpId) => comps[cmpId],
});

const stubManager = (world = {}) => ({
  getEntitiesInLocation: (locId) => world[locId] ?? [],
  getEntityInstance: (id) => world.__instances[id] ?? null,
  getComponentData: (id, cmpId) =>
    world.__instances[id]?.getComponentData(cmpId) ?? null,
});

/* ---------------------------------------------------------------- */

describe('entityScopeService integration', () => {
  test('inventory + location scopes are discovered when TurnContext exposes entityManager', () => {
    // Arrange world
    const swordId = 'item-sword';
    const ratId = 'npc-rat';
    const roomId = 'room-1';
    const playerId = 'pc-123';

    const world = {
      [roomId]: [playerId, ratId],
      __instances: {
        [playerId]: makeStubEntity(playerId, {
          'core:inventory': { items: [swordId] },
          'core:position': { locationId: roomId },
        }),
        [swordId]: makeStubEntity(swordId, { 'component:item': {} }),
        [ratId]: makeStubEntity(ratId, {}),
        [roomId]: makeStubEntity(roomId, {}),
      },
    };

    const em = stubManager(world);

    // Build a minimal TurnContext
    const ctx = new TurnContext({
      actor: world.__instances[playerId],
      logger: console,
      strategy: { decideAction: async () => null }, // not used
      handlerInstance: { requestIdleStateTransition: () => Promise.resolve() },
      onEndTurnCallback: () => {},
      services: { entityManager: em },
    });

    // Act
    const invSet = getEntityIdsForScopes('inventory', ctx, console);
    const locationSet = getEntityIdsForScopes('location', ctx, console);

    // Assert
    expect(invSet.has(swordId)).toBe(true);
    expect(locationSet.has(ratId)).toBe(true);
    expect(locationSet.has(playerId)).toBe(false); // self filtered
  });
});
