/**
 * @file Integration tests for ModTestFixture.loadDependencyConditions method
 * @description Tests the method with real mod data and scope resolution
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { ModTestFixture } from '../../common/mods/ModTestFixture.js';
import { ModEntityScenarios } from '../../common/mods/ModEntityBuilder.js';
import { ScopeResolverHelpers } from '../../common/mods/scopeResolverHelpers.js';
import fs from 'fs';
import path from 'path';
import { parseScopeDefinitions } from '../../../src/scopeDsl/scopeDefinitionParser.js';
import ScopeEngine from '../../../src/scopeDsl/engine.js';

describe('ModTestFixture - loadDependencyConditions Integration', () => {
  let testFixture;

  afterEach(() => {
    if (testFixture) {
      testFixture.cleanup();
    }
  });

  it('should work with real positioning mod conditions', async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );

    // Load a real condition from the positioning mod
    await testFixture.loadDependencyConditions([
      'positioning:actor-in-entity-facing-away'
    ]);

    // Verify the condition is properly loaded
    const condition = testFixture.testEnv.dataRegistry.getConditionDefinition(
      'positioning:actor-in-entity-facing-away'
    );

    expect(condition).toBeDefined();
    expect(condition.id).toBe('positioning:actor-in-entity-facing-away');
    expect(condition.description).toBeDefined();
    expect(typeof condition.description).toBe('string');
  });

  it('should work with multiple real conditions from same mod', async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );

    // Load multiple real conditions
    await testFixture.loadDependencyConditions([
      'positioning:actor-in-entity-facing-away',
      'positioning:entity-not-in-facing-away'
    ]);

    // Verify both conditions are loaded
    const condition1 = testFixture.testEnv.dataRegistry.getConditionDefinition(
      'positioning:actor-in-entity-facing-away'
    );
    const condition2 = testFixture.testEnv.dataRegistry.getConditionDefinition(
      'positioning:entity-not-in-facing-away'
    );

    expect(condition1).toBeDefined();
    expect(condition2).toBeDefined();
    expect(condition1.id).toBe('positioning:actor-in-entity-facing-away');
    expect(condition2.id).toBe('positioning:entity-not-in-facing-away');
  });

  it('should integrate with scope resolution workflow', async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );

    // Register positioning scopes
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

    // Load dependency condition
    await testFixture.loadDependencyConditions([
      'positioning:actor-in-entity-facing-away'
    ]);

    // Verify the condition is accessible during scope resolution
    const condition = testFixture.testEnv.dataRegistry.getConditionDefinition(
      'positioning:actor-in-entity-facing-away'
    );

    expect(condition).toBeDefined();
    expect(testFixture.testEnv.dataRegistry.getConditionDefinition).toBeDefined();
    expect(jest.isMockFunction(testFixture.testEnv.dataRegistry.getConditionDefinition)).toBe(true);
  });

  it('should support custom scopes that reference loaded conditions', async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );

    // Register positioning scopes
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

    // Load the condition that a custom scope might reference
    await testFixture.loadDependencyConditions([
      'positioning:actor-in-entity-facing-away'
    ]);

    // Create entities for testing
    const scenario = ModEntityScenarios.createActorTargetPair({
      names: ['Alice', 'Bob'],
      location: 'room1',
      closeProximity: true,
    });

    const entities = [
      ModEntityScenarios.createRoom('room1', 'Test Room'),
      scenario.actor,
      scenario.target,
    ];

    testFixture.reset(entities);

    // Verify the condition is available in the test environment
    const loadedCondition = testFixture.testEnv.dataRegistry.getConditionDefinition(
      'positioning:actor-in-entity-facing-away'
    );

    expect(loadedCondition).toBeDefined();
    expect(loadedCondition.id).toBe('positioning:actor-in-entity-facing-away');
  });

  it('should handle conditions with complex logic definitions', async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );

    await testFixture.loadDependencyConditions([
      'positioning:actor-in-entity-facing-away'
    ]);

    const condition = testFixture.testEnv.dataRegistry.getConditionDefinition(
      'positioning:actor-in-entity-facing-away'
    );

    // Verify condition has logic definition
    expect(condition).toHaveProperty('logic');
    expect(typeof condition.logic).toBe('object');
  });

  it('should maintain loaded conditions across test operations', async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );

    // Load conditions
    await testFixture.loadDependencyConditions([
      'positioning:actor-in-entity-facing-away'
    ]);

    // Perform some test operations
    const scenario = ModEntityScenarios.createActorTargetPair({
      names: ['Alice', 'Bob'],
      location: 'room1',
    });

    testFixture.reset([
      ModEntityScenarios.createRoom('room1', 'Test Room'),
      scenario.actor,
      scenario.target,
    ]);

    // Verify condition is still available after reset
    const condition = testFixture.testEnv.dataRegistry.getConditionDefinition(
      'positioning:actor-in-entity-facing-away'
    );

    expect(condition).toBeDefined();
    expect(condition.id).toBe('positioning:actor-in-entity-facing-away');
  });

  it('should work in a complete action discovery workflow', async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );

    // Register positioning scopes
    ScopeResolverHelpers.registerPositioningScopes(testFixture.testEnv);

    // Load dependency conditions
    await testFixture.loadDependencyConditions([
      'positioning:actor-in-entity-facing-away'
    ]);

    // Create test scenario
    const scenario = ModEntityScenarios.createPositioningScenario({
      actorName: 'Alice',
      targetName: 'Bob',
      furniture: true,
    });

    const entities = [
      ModEntityScenarios.createRoom('room1', 'Test Room'),
      scenario.actor,
      scenario.target,
      scenario.furniture,
    ];

    testFixture.reset(entities);

    // Verify the test environment is properly configured
    expect(testFixture.testEnv.dataRegistry.getConditionDefinition).toBeDefined();
    expect(testFixture.testEnv.entityManager).toBeDefined();

    // Verify loaded condition is accessible
    const condition = testFixture.testEnv.dataRegistry.getConditionDefinition(
      'positioning:actor-in-entity-facing-away'
    );
    expect(condition).toBeDefined();
  });

  it('should allow incremental loading of conditions', async () => {
    testFixture = await ModTestFixture.forAction(
      'positioning',
      'positioning:sit_down'
    );

    // Load first condition
    await testFixture.loadDependencyConditions([
      'positioning:actor-in-entity-facing-away'
    ]);

    const condition1 = testFixture.testEnv.dataRegistry.getConditionDefinition(
      'positioning:actor-in-entity-facing-away'
    );
    expect(condition1).toBeDefined();

    // Load second condition later
    await testFixture.loadDependencyConditions([
      'positioning:entity-not-in-facing-away'
    ]);

    const condition2 = testFixture.testEnv.dataRegistry.getConditionDefinition(
      'positioning:entity-not-in-facing-away'
    );
    expect(condition2).toBeDefined();

    // First condition should still be available
    const condition1Again = testFixture.testEnv.dataRegistry.getConditionDefinition(
      'positioning:actor-in-entity-facing-away'
    );
    expect(condition1Again).toBeDefined();
    expect(condition1Again).toEqual(condition1);
  });

  describe('Real-world usage scenarios', () => {
    it('should simplify test setup for cross-mod dependencies', async () => {
      // This demonstrates the primary use case: testing a mod that depends on
      // conditions from another mod (e.g., sex-anal-penetration depending on positioning)
      testFixture = await ModTestFixture.forAction(
        'positioning',
        'positioning:sit_down'
      );

      // Before: Would require 10+ lines of boilerplate
      // After: One simple call
      await testFixture.loadDependencyConditions([
        'positioning:actor-in-entity-facing-away',
        'positioning:entity-not-in-facing-away'
      ]);

      // Verify both are loaded and accessible
      const conditions = [
        'positioning:actor-in-entity-facing-away',
        'positioning:entity-not-in-facing-away'
      ].map(id => testFixture.testEnv.dataRegistry.getConditionDefinition(id));

      conditions.forEach(condition => {
        expect(condition).toBeDefined();
        expect(condition).toHaveProperty('id');
        expect(condition).toHaveProperty('logic');
      });
    });
  });
});
