/**
 * @file ScopeDslTestBed
 * @description Test bed for scope DSL integration tests
 */

import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import { createMockLogger } from '../mockFactories/index.js';

/**
 * Mock context builder for testing
 */
class MockContextBuilder {
  buildBaseContext(actorId, locationId) {
    return {
      actor: { id: actorId, components: {} },
      location: { id: locationId, components: {} },
      game: { turnNumber: 1, timeOfDay: 'morning' },
    };
  }
}

/**
 * Mock scope interpreter for testing
 */
class MockScopeInterpreter {
  constructor() {
    this.scopeEngine = new ScopeEngine();
    this.scopeRegistry = new ScopeRegistry({ logger: createMockLogger() });
  }

  async evaluate(scope, context) {
    // Simple mock implementation that handles basic test cases
    if (scope === 'actor.inventory.items[]') {
      return context.actor?.components?.['core:inventory']?.items || [];
    }

    if (scope === 'target.topmost_clothing[]') {
      const equipped =
        context.target?.components?.['clothing:equipment']?.equipped || {};
      const items = [];
      for (const slot of Object.values(equipped)) {
        for (const layer of Object.values(slot)) {
          if (typeof layer === 'string') {
            items.push(layer);
          }
        }
      }
      return items;
    }

    if (scope === 'targets.primary[0].id') {
      return context.targets?.primary?.[0]?.id;
    }

    if (scope === 'game.turnNumber') {
      return context.game?.turnNumber;
    }

    // Default fallback for unknown scopes
    return null;
  }
}

/**
 * Test bed for scope DSL integration tests
 */
export class ScopeDslTestBed {
  constructor() {
    this.scopeInterpreter = new MockScopeInterpreter();
    this.contextBuilder = new MockContextBuilder();
    this.logger = createMockLogger();
  }

  getScopeInterpreter() {
    return this.scopeInterpreter;
  }

  getContextBuilder() {
    return this.contextBuilder;
  }

  cleanup() {
    // Cleanup any resources if needed
  }
}

export default ScopeDslTestBed;
