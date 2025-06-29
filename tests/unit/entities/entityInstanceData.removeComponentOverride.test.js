/**
 * @file Test suite for the EntityInstanceData class.
 * @see tests/entities/entityInstanceData.removeComponentOverride.test.js
 */

// --- Imports ---
import { describe, it, expect, beforeEach } from '@jest/globals';
import EntityInstanceData from '../../../src/entities/entityInstanceData.js';
import EntityDefinition from '../../../src/entities/entityDefinition.js';

// --- Test Suite ---

describe('EntityInstanceData', () => {
  let baseDefinition;
  let defComponents;

  beforeEach(() => {
    // Arrange: Create a common, simple entity definition for use in tests.
    defComponents = {
      'core:health': { value: 100 },
      'core:description': { text: 'A default entity' },
    };
    baseDefinition = new EntityDefinition('test:base', {
      components: defComponents,
    });
  });

  describe('constructor', () => {
    it('should initialize correctly with a definition and no overrides', () => {
      // Act
      const instance = new EntityInstanceData(
        'instance-1',
        baseDefinition,
        {},
        console
      );

      // Assert
      expect(instance.instanceId).toBe('instance-1');
      expect(instance.definition).toBe(baseDefinition);
      expect(instance.overrides).toEqual({});
    });

    it('should perform a deep clone of initial overrides', () => {
      // Arrange
      const initialOverrides = {
        'core:position': { locationId: 'test:location' },
      };

      // Act
      const instance = new EntityInstanceData(
        'instance-1',
        baseDefinition,
        initialOverrides,
        console
      );

      // Assert
      expect(instance.overrides).toEqual(initialOverrides);
      expect(instance.overrides['core:position']).not.toBe(
        initialOverrides['core:position']
      );
    });
  });

  describe('removeComponentOverride(componentTypeId)', () => {
    let instance;
    const positionComponent = {
      'core:position': { locationId: 'test:location' },
    };
    const inventoryComponent = { 'core:inventory': { items: ['item-a'] } };

    beforeEach(() => {
      // Arrange: Create an instance with a mix of overrides for each test.
      instance = new EntityInstanceData(
        'instance-1',
        baseDefinition,
        {
          ...positionComponent,
          ...inventoryComponent,
        },
        console
      );
    });

    it('should remove an existing component override and return true', () => {
      // Act
      const result = instance.removeComponentOverride('core:position');

      // Assert
      expect(result).toBe(true);
      expect(instance.overrides).not.toHaveProperty('core:position');
      expect(instance.overrides).toHaveProperty('core:inventory'); // Ensure other overrides are untouched
    });

    it('should return false when trying to remove a non-existent override', () => {
      // Act
      const result = instance.removeComponentOverride('core:nonexistent');

      // Assert
      expect(result).toBe(false);
      expect(instance.overrides).toHaveProperty('core:position');
      expect(instance.overrides).toHaveProperty('core:inventory');
    });

    it('should return false for invalid componentTypeIds without altering overrides', () => {
      // Arrange
      const originalOverrides = JSON.parse(JSON.stringify(instance.overrides));

      // Act & Assert
      expect(instance.removeComponentOverride(null)).toBe(false);
      expect(instance.removeComponentOverride(undefined)).toBe(false);
      expect(instance.removeComponentOverride('')).toBe(false);
      expect(instance.removeComponentOverride('   ')).toBe(false);
      expect(instance.removeComponentOverride(123)).toBe(false);

      expect(instance.overrides).toEqual(originalOverrides);
    });

    it('should prevent direct mutation of overrides', () => {
      const original = instance.overrides;
      // verify frozen
      expect(Object.isFrozen(original)).toBe(true);
      expect(() => {
        instance.overrides = {};
      }).toThrow(TypeError);
      expect(instance.overrides).toBe(original);
    });

    it('should cause getComponentData to fall back to the definition after removal', () => {
      // Arrange
      const healthOverride = { 'core:health': { value: 50, temporary: true } };
      instance.setComponentOverride(
        'core:health',
        healthOverride['core:health']
      );

      // Pre-condition check
      expect(instance.getComponentData('core:health')).toEqual(
        healthOverride['core:health']
      );

      // Act
      const result = instance.removeComponentOverride('core:health');

      // Assert
      expect(result).toBe(true);
      // Now, getComponentData should return the data from the baseDefinition
      expect(instance.getComponentData('core:health')).toEqual(
        defComponents['core:health']
      );
      // Ensure it's a clone, not a reference
      expect(instance.getComponentData('core:health')).not.toBe(
        defComponents['core:health']
      );
    });

    it('should cause hasComponentOverride(id) to return false after removal', () => {
      // Pre-condition check
      expect(instance.hasComponentOverride('core:position')).toBe(true);

      // Act
      instance.removeComponentOverride('core:position');

      // Assert
      expect(instance.hasComponentOverride('core:position')).toBe(false);
    });

    it('should not affect hasComponent(id) if the component exists on the definition', () => {
      // Arrange
      instance.setComponentOverride('core:health', { value: 50 });

      // Pre-condition checks
      expect(instance.hasComponent('core:health')).toBe(true); // From override
      expect(instance.hasComponentOverride('core:health')).toBe(true); // From override

      // Act
      instance.removeComponentOverride('core:health');

      // Assert
      expect(instance.hasComponent('core:health')).toBe(true); // Falls back to definition
      expect(instance.hasComponentOverride('core:health')).toBe(false); // Override is gone
    });
  });
});
