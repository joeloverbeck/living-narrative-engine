/**
 * @jest-environment node
 * 
 * Unit tests for anatomy-related condition definitions
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';

describe('Anatomy Condition Definitions', () => {
  const conditionsPath = path.join(process.cwd(), 'data/mods/core/conditions');
  
  describe('actor-has-muscular-legs.condition.json', () => {
    let condition;

    beforeEach(() => {
      const conditionPath = path.join(conditionsPath, 'actor-has-muscular-legs.condition.json');
      const content = fs.readFileSync(conditionPath, 'utf8');
      condition = JSON.parse(content);
    });

    test('should have correct id', () => {
      expect(condition.id).toBe('core:actor-has-muscular-legs');
    });

    test('should have appropriate description', () => {
      expect(condition.description).toBe('Checks if the actor has at least one muscular leg.');
    });

    test('should use hasPartWithComponentValue operator', () => {
      expect(condition.logic).toHaveProperty('hasPartWithComponentValue');
    });

    test('should check for muscular build descriptor', () => {
      const args = condition.logic.hasPartWithComponentValue;
      expect(args).toEqual(['actor', 'descriptors:build', 'build', 'muscular']);
    });

    test('should have valid JSON structure', () => {
      expect(() => JSON.stringify(condition)).not.toThrow();
    });
  });

  describe('actor-has-shapely-legs.condition.json', () => {
    let condition;

    beforeEach(() => {
      const conditionPath = path.join(conditionsPath, 'actor-has-shapely-legs.condition.json');
      const content = fs.readFileSync(conditionPath, 'utf8');
      condition = JSON.parse(content);
    });

    test('should have correct id', () => {
      expect(condition.id).toBe('core:actor-has-shapely-legs');
    });

    test('should have appropriate description', () => {
      expect(condition.description).toBe('Checks if the actor has at least one shapely leg.');
    });

    test('should use hasPartWithComponentValue operator', () => {
      expect(condition.logic).toHaveProperty('hasPartWithComponentValue');
    });

    test('should check for shapely build descriptor', () => {
      const args = condition.logic.hasPartWithComponentValue;
      expect(args).toEqual(['actor', 'descriptors:build', 'build', 'shapely']);
    });

    test('should have valid JSON structure', () => {
      expect(() => JSON.stringify(condition)).not.toThrow();
    });
  });

  describe('updated follow.action.json', () => {
    let action;

    beforeEach(() => {
      const actionPath = path.join(process.cwd(), 'data/mods/core/actions/follow.action.json');
      const content = fs.readFileSync(actionPath, 'utf8');
      action = JSON.parse(content);
    });

    test('should have the correct prerequisites', () => {
      expect(action.prerequisites).toHaveLength(2);
    });

    test('should use the new actor-can-move condition', () => {
      expect(action.prerequisites[0].logic.condition_ref).toBe('core:actor-can-move');
      expect(action.prerequisites[0].failure_message).toBe('You cannot move without functioning legs.');
    });

    test('should maintain the actor-is-following prerequisite', () => {
      expect(action.prerequisites[1].logic.not.condition_ref).toBe('core:actor-is-following');
    });
  });
});