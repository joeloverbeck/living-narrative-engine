/**
 * @file entityQuery.test.js
 * @description Unit tests for the EntityQuery class
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import EntityQuery from '../../../src/query/EntityQuery.js';

// Mock Entity class for testing
class MockEntity {
  constructor(components = []) {
    this.components = new Set(components);
  }

  hasComponent(componentTypeId) {
    return this.components.has(componentTypeId);
  }
}

describe('EntityQuery', () => {
  const COMPONENT_A = 'test:comp-a';
  const COMPONENT_B = 'test:comp-b';
  const COMPONENT_C = 'test:comp-c';
  const COMPONENT_D = 'test:comp-d';

  let entityWithA, entityWithB, entityWithC, entityWithAB, entityWithAC, entityWithBC, entityWithABC, entityWithNone;

  beforeEach(() => {
    // Create test entities with different component combinations
    entityWithA = new MockEntity([COMPONENT_A]);
    entityWithB = new MockEntity([COMPONENT_B]);
    entityWithC = new MockEntity([COMPONENT_C]);
    entityWithAB = new MockEntity([COMPONENT_A, COMPONENT_B]);
    entityWithAC = new MockEntity([COMPONENT_A, COMPONENT_C]);
    entityWithBC = new MockEntity([COMPONENT_B, COMPONENT_C]);
    entityWithABC = new MockEntity([COMPONENT_A, COMPONENT_B, COMPONENT_C]);
    entityWithNone = new MockEntity([]);
  });

  describe('Constructor', () => {
    it('should create an empty query when no options provided', () => {
      const query = new EntityQuery();
      expect(query.withAll).toEqual([]);
      expect(query.withAny).toEqual([]);
      expect(query.without).toEqual([]);
    });

    it('should create a query with provided options', () => {
      const query = new EntityQuery({
        withAll: [COMPONENT_A, COMPONENT_B],
        withAny: [COMPONENT_C],
        without: [COMPONENT_D]
      });
      expect(query.withAll).toEqual([COMPONENT_A, COMPONENT_B]);
      expect(query.withAny).toEqual([COMPONENT_C]);
      expect(query.without).toEqual([COMPONENT_D]);
    });

    it('should handle non-array inputs by converting to empty arrays', () => {
      const query = new EntityQuery({
        withAll: 'not-an-array',
        withAny: null,
        without: undefined
      });
      expect(query.withAll).toEqual([]);
      expect(query.withAny).toEqual([]);
      expect(query.without).toEqual([]);
    });

    it('should handle partial options', () => {
      const query = new EntityQuery({ withAll: [COMPONENT_A] });
      expect(query.withAll).toEqual([COMPONENT_A]);
      expect(query.withAny).toEqual([]);
      expect(query.without).toEqual([]);
    });
  });

  describe('hasPositiveConditions', () => {
    it('should return false for empty query', () => {
      const query = new EntityQuery();
      expect(query.hasPositiveConditions()).toBe(false);
    });

    it('should return true when withAll has components', () => {
      const query = new EntityQuery({ withAll: [COMPONENT_A] });
      expect(query.hasPositiveConditions()).toBe(true);
    });

    it('should return true when withAny has components', () => {
      const query = new EntityQuery({ withAny: [COMPONENT_A] });
      expect(query.hasPositiveConditions()).toBe(true);
    });

    it('should return true when both withAll and withAny have components', () => {
      const query = new EntityQuery({ 
        withAll: [COMPONENT_A], 
        withAny: [COMPONENT_B] 
      });
      expect(query.hasPositiveConditions()).toBe(true);
    });

    it('should return false when only without has components', () => {
      const query = new EntityQuery({ without: [COMPONENT_A] });
      expect(query.hasPositiveConditions()).toBe(false);
    });
  });

  describe('matches - withAll conditions', () => {
    it('should match entity with all required components', () => {
      const query = new EntityQuery({ withAll: [COMPONENT_A, COMPONENT_B] });
      expect(query.matches(entityWithAB)).toBe(true);
      expect(query.matches(entityWithABC)).toBe(true);
    });

    it('should not match entity missing any required component', () => {
      const query = new EntityQuery({ withAll: [COMPONENT_A, COMPONENT_B] });
      expect(query.matches(entityWithA)).toBe(false);
      expect(query.matches(entityWithB)).toBe(false);
      expect(query.matches(entityWithC)).toBe(false);
      expect(query.matches(entityWithAC)).toBe(false);
      expect(query.matches(entityWithBC)).toBe(false);
      expect(query.matches(entityWithNone)).toBe(false);
    });

    it('should match entity with empty withAll condition', () => {
      const query = new EntityQuery({ withAll: [] });
      expect(query.matches(entityWithA)).toBe(true);
      expect(query.matches(entityWithNone)).toBe(true);
    });
  });

  describe('matches - withAny conditions', () => {
    it('should match entity with any of the required components', () => {
      const query = new EntityQuery({ withAny: [COMPONENT_A, COMPONENT_B] });
      expect(query.matches(entityWithA)).toBe(true);
      expect(query.matches(entityWithB)).toBe(true);
      expect(query.matches(entityWithAB)).toBe(true);
      expect(query.matches(entityWithABC)).toBe(true);
    });

    it('should not match entity with none of the required components', () => {
      const query = new EntityQuery({ withAny: [COMPONENT_A, COMPONENT_B] });
      expect(query.matches(entityWithC)).toBe(false);
      expect(query.matches(entityWithNone)).toBe(false);
    });

    it('should match entity with empty withAny condition', () => {
      const query = new EntityQuery({ withAny: [] });
      expect(query.matches(entityWithA)).toBe(true);
      expect(query.matches(entityWithNone)).toBe(true);
    });
  });

  describe('matches - without conditions', () => {
    it('should match entity without any of the excluded components', () => {
      const query = new EntityQuery({ without: [COMPONENT_A, COMPONENT_B] });
      expect(query.matches(entityWithC)).toBe(true);
      expect(query.matches(entityWithNone)).toBe(true);
    });

    it('should not match entity with any of the excluded components', () => {
      const query = new EntityQuery({ without: [COMPONENT_A, COMPONENT_B] });
      expect(query.matches(entityWithA)).toBe(false);
      expect(query.matches(entityWithB)).toBe(false);
      expect(query.matches(entityWithAB)).toBe(false);
      expect(query.matches(entityWithABC)).toBe(false);
    });

    it('should match entity with empty without condition', () => {
      const query = new EntityQuery({ without: [] });
      expect(query.matches(entityWithA)).toBe(true);
      expect(query.matches(entityWithNone)).toBe(true);
    });
  });

  describe('matches - combined conditions', () => {
    it('should match entity with withAll and withAny conditions', () => {
      const query = new EntityQuery({
        withAll: [COMPONENT_A],
        withAny: [COMPONENT_B, COMPONENT_C]
      });
      expect(query.matches(entityWithAB)).toBe(true);
      expect(query.matches(entityWithAC)).toBe(true);
      expect(query.matches(entityWithABC)).toBe(true);
    });

    it('should not match entity missing withAll condition even if withAny is met', () => {
      const query = new EntityQuery({
        withAll: [COMPONENT_A],
        withAny: [COMPONENT_B, COMPONENT_C]
      });
      expect(query.matches(entityWithB)).toBe(false);
      expect(query.matches(entityWithC)).toBe(false);
      expect(query.matches(entityWithBC)).toBe(false);
    });

    it('should not match entity missing withAny condition even if withAll is met', () => {
      const query = new EntityQuery({
        withAll: [COMPONENT_A],
        withAny: [COMPONENT_B, COMPONENT_C]
      });
      expect(query.matches(entityWithA)).toBe(false);
    });

    it('should match entity with withAll and without conditions', () => {
      const query = new EntityQuery({
        withAll: [COMPONENT_A],
        without: [COMPONENT_B]
      });
      expect(query.matches(entityWithA)).toBe(true);
      expect(query.matches(entityWithAC)).toBe(true);
    });

    it('should not match entity with withAll but also with excluded component', () => {
      const query = new EntityQuery({
        withAll: [COMPONENT_A],
        without: [COMPONENT_B]
      });
      expect(query.matches(entityWithAB)).toBe(false);
      expect(query.matches(entityWithABC)).toBe(false);
    });

    it('should match entity with withAny and without conditions', () => {
      const query = new EntityQuery({
        withAny: [COMPONENT_A, COMPONENT_B],
        without: [COMPONENT_C]
      });
      expect(query.matches(entityWithA)).toBe(true);
      expect(query.matches(entityWithB)).toBe(true);
      expect(query.matches(entityWithAB)).toBe(true);
    });

    it('should not match entity with withAny but also with excluded component', () => {
      const query = new EntityQuery({
        withAny: [COMPONENT_A, COMPONENT_B],
        without: [COMPONENT_C]
      });
      expect(query.matches(entityWithAC)).toBe(false);
      expect(query.matches(entityWithBC)).toBe(false);
      expect(query.matches(entityWithABC)).toBe(false);
    });

    it('should match entity with all three conditions satisfied', () => {
      const query = new EntityQuery({
        withAll: [COMPONENT_A],
        withAny: [COMPONENT_B, COMPONENT_C],
        without: [COMPONENT_D]
      });
      expect(query.matches(entityWithAB)).toBe(true);
      expect(query.matches(entityWithAC)).toBe(true);
    });

    it('should not match entity with complex conditions not met', () => {
      const query = new EntityQuery({
        withAll: [COMPONENT_A],
        withAny: [COMPONENT_B, COMPONENT_C],
        without: [COMPONENT_D]
      });
      expect(query.matches(entityWithA)).toBe(false); // missing withAny
      expect(query.matches(entityWithB)).toBe(false); // missing withAll
      expect(query.matches(entityWithC)).toBe(false); // missing withAll
      expect(query.matches(entityWithBC)).toBe(false); // missing withAll
      expect(query.matches(entityWithNone)).toBe(false); // missing both withAll and withAny
    });
  });

  describe('matches - edge cases', () => {
    it('should handle entities with no components', () => {
      const query = new EntityQuery({ withAny: [COMPONENT_A] });
      expect(query.matches(entityWithNone)).toBe(false);
    });

    it('should handle queries with non-existent components', () => {
      const query = new EntityQuery({ withAll: ['non-existent'] });
      expect(query.matches(entityWithA)).toBe(false);
      expect(query.matches(entityWithNone)).toBe(false);
    });

    it('should handle empty arrays in all conditions', () => {
      const query = new EntityQuery({
        withAll: [],
        withAny: [],
        without: []
      });
      expect(query.matches(entityWithA)).toBe(true);
      expect(query.matches(entityWithNone)).toBe(true);
    });

    it('should handle single component in each condition type', () => {
      const query = new EntityQuery({
        withAll: [COMPONENT_A],
        withAny: [COMPONENT_B],
        without: [COMPONENT_C]
      });
      expect(query.matches(entityWithAB)).toBe(true);
      expect(query.matches(entityWithA)).toBe(false); // missing withAny
      expect(query.matches(entityWithB)).toBe(false); // missing withAll
      expect(query.matches(entityWithAC)).toBe(false); // has excluded component
    });
  });

  describe('performance characteristics', () => {
    it('should fail fast on without condition (first check)', () => {
      const query = new EntityQuery({
        without: [COMPONENT_A],
        withAll: [COMPONENT_B, COMPONENT_C, COMPONENT_D],
        withAny: [COMPONENT_B, COMPONENT_C, COMPONENT_D]
      });
      
      // This should fail fast on the without check, not proceed to check withAll/withAny
      expect(query.matches(entityWithA)).toBe(false);
    });

    it('should fail fast on withAll condition (second check)', () => {
      const query = new EntityQuery({
        withAll: [COMPONENT_A, COMPONENT_B],
        withAny: [COMPONENT_C, COMPONENT_D]
      });
      
      // This should fail fast on the withAll check, not proceed to check withAny
      expect(query.matches(entityWithA)).toBe(false);
    });
  });
}); 