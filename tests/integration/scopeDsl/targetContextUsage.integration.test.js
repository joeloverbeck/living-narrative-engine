import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { ScopeDslTestBed } from '../../common/scopeDsl/scopeDslTestBed.js';

describe('Target Context Usage in Scope DSL Integration', () => {
  let testBed;
  let scopeInterpreter;
  let contextBuilder;
  
  beforeEach(() => {
    testBed = new ScopeDslTestBed();
    scopeInterpreter = testBed.getScopeInterpreter();
    contextBuilder = testBed.getContextBuilder();
  });

  afterEach(() => {
    testBed.cleanup();
  });
  
  test('should use actor from context in scope evaluation', async () => {
    // Arrange
    const scope = 'actor.inventory.items[]';
    const context = {
      actor: { 
        id: 'player', 
        components: {
          'core:inventory': { items: ['sword', 'potion'] }
        }
      },
      location: { id: 'room', components: {} },
      game: { turnNumber: 1 }
    };
    
    // Act
    const result = await scopeInterpreter.evaluate(scope, context);
    
    // Assert
    expect(result).toEqual(['sword', 'potion']);
  });

  test('should use target from context in dependent scope', async () => {
    // Arrange
    const scope = 'target.topmost_clothing[]';
    const context = {
      actor: { id: 'player', components: {} },
      target: {
        id: 'npc',
        components: {
          'clothing:equipment': {
            equipped: {
              torso_upper: { outer: 'jacket' }
            }
          }
        }
      },
      location: { id: 'room', components: {} },
      game: { turnNumber: 1 }
    };
    
    // Act
    const result = await scopeInterpreter.evaluate(scope, context);
    
    // Assert
    expect(result).toContain('jacket');
  });

  test('should access previously resolved targets in multi-target context', async () => {
    // Arrange
    const scope = 'targets.primary[0].id';
    const context = {
      actor: { id: 'player', components: {} },
      targets: {
        primary: [{ id: 'item_001', components: {} }],
        secondary: [{ id: 'npc_002', components: {} }]
      },
      location: { id: 'room', components: {} },
      game: { turnNumber: 1 }
    };
    
    // Act
    const result = await scopeInterpreter.evaluate(scope, context);
    
    // Assert
    expect(result).toBe('item_001');
  });

  test('should access game state from context', async () => {
    // Arrange
    const scope = 'game.turnNumber';
    const context = {
      actor: { id: 'player', components: {} },
      location: { id: 'room', components: {} },
      game: { 
        turnNumber: 42,
        timeOfDay: 'afternoon'
      }
    };
    
    // Act
    const result = await scopeInterpreter.evaluate(scope, context);
    
    // Assert
    expect(result).toBe(42);
  });

  test('should build context using TargetContextBuilder', () => {
    // Arrange
    const actorId = 'player_123';
    const locationId = 'room_001';
    
    // Act
    const context = contextBuilder.buildBaseContext(actorId, locationId);
    
    // Assert
    expect(context).toHaveProperty('actor');
    expect(context).toHaveProperty('location');
    expect(context).toHaveProperty('game');
    expect(context.actor.id).toBe(actorId);
    expect(context.location.id).toBe(locationId);
  });
});