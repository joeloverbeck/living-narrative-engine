/**
 * @file Focused test for closeness circle scope resolution
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ScopeEngine from '../../../src/scopeDsl/engine.js';
import ScopeRegistry from '../../../src/scopeDsl/scopeRegistry.js';
import { parseDslExpression } from '../../../src/scopeDsl/parser.js';
import { SimpleEntityManager } from '../../common/entities/index.js';
import ConsoleLogger from '../../../src/logging/consoleLogger.js';

describe('Closeness Circle Scope Resolution', () => {
  let scopeEngine;
  let scopeRegistry;
  let entityManager;
  let logger;

  beforeEach(() => {
    logger = new ConsoleLogger('ERROR'); // Change to ERROR to reduce noise
    
    // Create entity manager with test entities
    entityManager = new SimpleEntityManager([
      {
        id: 'actor1',
        components: {
          'core:name': { text: 'Actor 1' },
          'core:position': { locationId: 'room1' },
          'core:actor': {},
          'intimacy:closeness': { partners: ['actor2', 'actor3'] }
        },
      },
      {
        id: 'actor2', 
        components: {
          'core:name': { text: 'Actor 2' },
          'core:position': { locationId: 'room1' },
          'core:actor': {},
          'intimacy:closeness': { partners: ['actor1', 'actor3'] }
        },
      },
      {
        id: 'actor3',
        components: {
          'core:name': { text: 'Actor 3' },
          'core:position': { locationId: 'room1' },
          'core:actor': {},
          'intimacy:closeness': { partners: ['actor1', 'actor2'] }
        },
      },
      {
        id: 'actor4',
        components: {
          'core:name': { text: 'Actor 4' },
          'core:position': { locationId: 'room1' },
          'core:actor': {}
        },
      }
    ]);

    // Create scope registry and register the closeness scope
    scopeRegistry = new ScopeRegistry();
    scopeRegistry.initialize({
      'intimacy:close_actors': { 
        definition: 'intimacy:close_actors := actor.components.intimacy:closeness.partners[]',
        modId: 'intimacy'
      }
    });

    // Create scope engine
    scopeEngine = new ScopeEngine({
      scopeRegistry,
      logger,
      scopeCache: { get: jest.fn(), set: jest.fn() }
    });
  });

  it('should resolve partners from closeness component', () => {
    const actor1 = entityManager.getEntityInstance('actor1');
    const runtimeCtx = {
      entityManager,
      logger
    };

    // Parse the scope expression
    const scopeDef = scopeRegistry.getScope('intimacy:close_actors');
    const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
    
    const result = scopeEngine.resolve(ast, actor1, runtimeCtx);
    
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(2);
    expect(result.has('actor2')).toBe(true);
    expect(result.has('actor3')).toBe(true);
  });

  it('should return empty set for actor without closeness component', () => {
    const actor4 = entityManager.getEntityInstance('actor4');
    const runtimeCtx = {
      entityManager,
      logger
    };

    // Parse the scope expression
    const scopeDef = scopeRegistry.getScope('intimacy:close_actors');
    const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
    
    const result = scopeEngine.resolve(ast, actor4, runtimeCtx);
    
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it('should handle empty partners array', () => {
    // Add an actor with empty partners
    entityManager = new SimpleEntityManager([
      {
        id: 'actor5',
        components: {
          'core:name': { text: 'Actor 5' },
          'core:position': { locationId: 'room1' },
          'core:actor': {},
          'intimacy:closeness': { partners: [] }
        },
      }
    ]);

    const actor5 = entityManager.getEntityInstance('actor5');
    const runtimeCtx = {
      entityManager,
      logger
    };

    // Parse the scope expression
    const scopeDef = scopeRegistry.getScope('intimacy:close_actors');
    const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
    
    const result = scopeEngine.resolve(ast, actor5, runtimeCtx);
    
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(0);
  });

  it('should handle single partner in closeness circle', () => {
    entityManager = new SimpleEntityManager([
      {
        id: 'actor6',
        components: {
          'core:name': { text: 'Actor 6' },
          'core:position': { locationId: 'room1' },
          'core:actor': {},
          'intimacy:closeness': { partners: ['actor7'] }
        },
      },
      {
        id: 'actor7',
        components: {
          'core:name': { text: 'Actor 7' },
          'core:position': { locationId: 'room1' },
          'core:actor': {},
          'intimacy:closeness': { partners: ['actor6'] }
        },
      }
    ]);

    const actor6 = entityManager.getEntityInstance('actor6');
    const runtimeCtx = {
      entityManager,
      logger
    };

    // Parse the scope expression
    const scopeDef = scopeRegistry.getScope('intimacy:close_actors');
    const ast = parseDslExpression(scopeDef.definition.split(':=')[1].trim());
    
    const result = scopeEngine.resolve(ast, actor6, runtimeCtx);
    
    expect(result).toBeInstanceOf(Set);
    expect(result.size).toBe(1);
    expect(result.has('actor7')).toBe(true);
  });
});