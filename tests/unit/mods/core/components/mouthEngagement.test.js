/**
 * @file Unit tests for the core:mouth_engagement component.
 */

import { describe, it, expect } from '@jest/globals';
import mouthEngagementComponent from '../../../../../data/mods/core/components/mouth_engagement.component.json';

describe('core:mouth_engagement component', () => {
  describe('component definition', () => {
    it('has correct id', () => {
      expect(mouthEngagementComponent.id).toBe('core:mouth_engagement');
    });

    it('has appropriate description', () => {
      expect(mouthEngagementComponent.description).toContain('mouth availability');
    });

    it('has correct schema type', () => {
      expect(mouthEngagementComponent.dataSchema.type).toBe('object');
    });

    it('requires locked property', () => {
      expect(mouthEngagementComponent.dataSchema.required).toContain('locked');
    });

    it('defines locked as boolean with default false', () => {
      const lockedSchema =
        mouthEngagementComponent.dataSchema.properties.locked;
      expect(lockedSchema.type).toBe('boolean');
      expect(lockedSchema.default).toBe(false);
    });

    it('defines forcedOverride as boolean with default false', () => {
      const forcedOverrideSchema =
        mouthEngagementComponent.dataSchema.properties.forcedOverride;
      expect(forcedOverrideSchema.type).toBe('boolean');
      expect(forcedOverrideSchema.default).toBe(false);
    });

    it('does not allow additional properties', () => {
      expect(mouthEngagementComponent.dataSchema.additionalProperties).toBe(
        false
      );
    });

    it('has standard component schema reference', () => {
      expect(mouthEngagementComponent.$schema).toBe(
        'schema://living-narrative-engine/component.schema.json'
      );
    });
  });

  describe('component behavior', () => {
    it('should initialize with locked false by default', () => {
      const newComponent = {
        locked: false,
      };
      expect(newComponent.locked).toBe(false);
    });

    it('should initialize with forcedOverride false by default', () => {
      const newComponent = {
        locked: false,
        forcedOverride: false,
      };
      expect(newComponent.forcedOverride).toBe(false);
    });

    it('should accept custom locked value', () => {
      const component = {
        locked: true,
        forcedOverride: false,
      };
      expect(component.locked).toBe(true);
      expect(component.forcedOverride).toBe(false);
    });

    it('should accept custom forcedOverride value', () => {
      const component = {
        locked: false,
        forcedOverride: true,
      };
      expect(component.locked).toBe(false);
      expect(component.forcedOverride).toBe(true);
    });

    it('should support both properties being true', () => {
      const component = {
        locked: true,
        forcedOverride: true,
      };
      expect(component.locked).toBe(true);
      expect(component.forcedOverride).toBe(true);
    });

    it('should support toggling locked state', () => {
      const component = {
        locked: false,
        forcedOverride: false,
      };

      // Lock the mouth
      component.locked = true;
      expect(component.locked).toBe(true);

      // Unlock the mouth
      component.locked = false;
      expect(component.locked).toBe(false);
    });

    it('should support toggling forcedOverride state', () => {
      const component = {
        locked: false,
        forcedOverride: false,
      };

      // Enable forced override
      component.forcedOverride = true;
      expect(component.forcedOverride).toBe(true);

      // Disable forced override
      component.forcedOverride = false;
      expect(component.forcedOverride).toBe(false);
    });
  });
});