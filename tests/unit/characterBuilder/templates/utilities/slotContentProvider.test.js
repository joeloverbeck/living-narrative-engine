/**
 * @file Unit tests for SlotContentProvider
 * @see src/characterBuilder/templates/utilities/slotContentProvider.js
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { SlotContentProvider } from '../../../../../src/characterBuilder/templates/utilities/slotContentProvider.js';

describe('SlotContentProvider', () => {
  let provider;

  beforeEach(() => {
    provider = new SlotContentProvider();
  });

  describe('constructor', () => {
    it('should create an empty provider', () => {
      expect(provider).toBeInstanceOf(SlotContentProvider);
      expect(provider.isEmpty).toBe(true);
      expect(provider.size).toBe(0);
    });
  });

  describe('setSlot()', () => {
    it('should set named slots', () => {
      provider.setSlot('header', '<h1>Header</h1>');
      expect(provider.hasSlot('header')).toBe(true);
      expect(provider.getSlot('header')).toBe('<h1>Header</h1>');
    });

    it('should set default slot with null name', () => {
      provider.setSlot(null, '<p>Default content</p>');
      expect(provider.hasSlot(null)).toBe(true);
      expect(provider.getSlot(null)).toBe('<p>Default content</p>');
    });

    it('should set default slot with empty string name', () => {
      provider.setSlot('', '<p>Default content</p>');
      expect(provider.hasSlot('')).toBe(true);
      expect(provider.getSlot('')).toBe('<p>Default content</p>');
    });

    it('should handle function content', () => {
      provider.setSlot('dynamic', () => '<div>Dynamic content</div>');
      expect(provider.getSlot('dynamic')).toBe('<div>Dynamic content</div>');
    });

    it('should handle function errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      provider.setSlot('error', () => {
        throw new Error('Function error');
      });

      expect(provider.getSlot('error')).toBe('');
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should overwrite existing slots', () => {
      provider.setSlot('test', 'Original');
      provider.setSlot('test', 'Updated');
      expect(provider.getSlot('test')).toBe('Updated');
    });

    it('should throw error for invalid slot names', () => {
      expect(() => {
        provider.setSlot(123, 'Content');
      }).toThrow('Slot name must be a string or null');
    });
  });

  describe('getSlot()', () => {
    it('should return slot content', () => {
      provider.setSlot('test', 'Test content');
      expect(provider.getSlot('test')).toBe('Test content');
    });

    it('should return fallback for missing slots', () => {
      expect(provider.getSlot('missing', 'Fallback')).toBe('Fallback');
    });

    it('should return empty string as default fallback', () => {
      expect(provider.getSlot('missing')).toBe('');
    });

    it('should handle null and undefined content', () => {
      provider.setSlot('null', null);
      provider.setSlot('undefined', undefined);

      expect(provider.getSlot('null')).toBe('');
      expect(provider.getSlot('undefined')).toBe('');
    });

    it('should convert non-string content to string', () => {
      provider.setSlot('number', 123);
      provider.setSlot('boolean', true);
      provider.setSlot('object', { toString: () => 'Object string' });

      expect(provider.getSlot('number')).toBe('123');
      expect(provider.getSlot('boolean')).toBe('true');
      expect(provider.getSlot('object')).toBe('Object string');
    });
  });

  describe('hasSlot()', () => {
    it('should check for named slots', () => {
      provider.setSlot('exists', 'Content');
      expect(provider.hasSlot('exists')).toBe(true);
      expect(provider.hasSlot('missing')).toBe(false);
    });

    it('should check for default slot', () => {
      expect(provider.hasSlot(null)).toBe(false);
      provider.setSlot(null, 'Default');
      expect(provider.hasSlot(null)).toBe(true);
    });
  });

  describe('removeSlot()', () => {
    it('should remove named slots', () => {
      provider.setSlot('test', 'Content');
      expect(provider.hasSlot('test')).toBe(true);

      const removed = provider.removeSlot('test');
      expect(removed).toBe(true);
      expect(provider.hasSlot('test')).toBe(false);
    });

    it('should remove default slot', () => {
      provider.setSlot(null, 'Default');
      expect(provider.hasSlot(null)).toBe(true);

      const removed = provider.removeSlot(null);
      expect(removed).toBe(true);
      expect(provider.hasSlot(null)).toBe(false);
    });

    it('should return false for non-existent slots', () => {
      expect(provider.removeSlot('missing')).toBe(false);
    });
  });

  describe('getSlotNames()', () => {
    it('should return array of slot names', () => {
      provider.setSlot('header', 'Header');
      provider.setSlot('footer', 'Footer');
      provider.setSlot('sidebar', 'Sidebar');

      const names = provider.getSlotNames();
      expect(names).toEqual(['header', 'footer', 'sidebar']);
    });

    it('should not include default slot', () => {
      provider.setSlot(null, 'Default');
      provider.setSlot('named', 'Named');

      const names = provider.getSlotNames();
      expect(names).toEqual(['named']);
    });

    it('should return empty array when no named slots', () => {
      provider.setSlot(null, 'Default');
      expect(provider.getSlotNames()).toEqual([]);
    });
  });

  describe('getAllSlots()', () => {
    it('should return all slots including default', () => {
      provider.setSlot(null, 'Default');
      provider.setSlot('header', 'Header');
      provider.setSlot('footer', 'Footer');

      const all = provider.getAllSlots();
      expect(all).toEqual({
        default: 'Default',
        header: 'Header',
        footer: 'Footer',
      });
    });

    it('should return empty object when no slots', () => {
      expect(provider.getAllSlots()).toEqual({});
    });
  });

  describe('clear()', () => {
    it('should remove all slots', () => {
      provider.setSlot(null, 'Default');
      provider.setSlot('header', 'Header');
      provider.setSlot('footer', 'Footer');

      expect(provider.size).toBe(3);

      provider.clear();

      expect(provider.size).toBe(0);
      expect(provider.isEmpty).toBe(true);
      expect(provider.hasSlot(null)).toBe(false);
      expect(provider.hasSlot('header')).toBe(false);
    });
  });

  describe('size and isEmpty', () => {
    it('should track size correctly', () => {
      expect(provider.size).toBe(0);

      provider.setSlot('one', 'One');
      expect(provider.size).toBe(1);

      provider.setSlot('two', 'Two');
      expect(provider.size).toBe(2);

      provider.setSlot(null, 'Default');
      expect(provider.size).toBe(3);

      provider.removeSlot('one');
      expect(provider.size).toBe(2);
    });

    it('should track isEmpty correctly', () => {
      expect(provider.isEmpty).toBe(true);

      provider.setSlot('test', 'Test');
      expect(provider.isEmpty).toBe(false);

      provider.clear();
      expect(provider.isEmpty).toBe(true);
    });
  });

  describe('merge()', () => {
    it('should merge another provider', () => {
      const other = new SlotContentProvider();
      other.setSlot('header', 'Other Header');
      other.setSlot('footer', 'Other Footer');

      provider.setSlot('header', 'Original Header');
      provider.setSlot('sidebar', 'Original Sidebar');

      provider.merge(other);

      expect(provider.getSlot('header')).toBe('Other Header'); // Overwritten
      expect(provider.getSlot('footer')).toBe('Other Footer'); // Added
      expect(provider.getSlot('sidebar')).toBe('Original Sidebar'); // Unchanged
    });

    it('should respect overwrite flag', () => {
      const other = new SlotContentProvider();
      other.setSlot('header', 'Other Header');

      provider.setSlot('header', 'Original Header');

      provider.merge(other, false); // Don't overwrite

      expect(provider.getSlot('header')).toBe('Original Header');
    });

    it('should merge default slots', () => {
      const other = new SlotContentProvider();
      other.setSlot(null, 'Other Default');

      provider.merge(other);

      expect(provider.getSlot(null)).toBe('Other Default');
    });

    it('should throw error for non-provider argument', () => {
      expect(() => {
        provider.merge({ not: 'a provider' });
      }).toThrow('Can only merge with another SlotContentProvider');
    });
  });

  describe('clone()', () => {
    it('should create identical copy', () => {
      provider.setSlot(null, 'Default');
      provider.setSlot('header', 'Header');
      provider.setSlot('footer', 'Footer');

      const clone = provider.clone();

      expect(clone).not.toBe(provider);
      expect(clone.getAllSlots()).toEqual(provider.getAllSlots());
    });

    it('should create independent copy', () => {
      provider.setSlot('test', 'Original');

      const clone = provider.clone();
      clone.setSlot('test', 'Modified');

      expect(provider.getSlot('test')).toBe('Original');
      expect(clone.getSlot('test')).toBe('Modified');
    });
  });

  describe('static fromObject()', () => {
    it('should create provider from object', () => {
      const obj = {
        default: 'Default content',
        header: 'Header content',
        footer: 'Footer content',
      };

      const provider = SlotContentProvider.fromObject(obj);

      expect(provider.getSlot(null)).toBe('Default content');
      expect(provider.getSlot('header')).toBe('Header content');
      expect(provider.getSlot('footer')).toBe('Footer content');
    });

    it('should handle null and invalid input', () => {
      expect(SlotContentProvider.fromObject(null).isEmpty).toBe(true);
      expect(SlotContentProvider.fromObject(undefined).isEmpty).toBe(true);
      expect(SlotContentProvider.fromObject('string').isEmpty).toBe(true);
      expect(SlotContentProvider.fromObject(123).isEmpty).toBe(true);
    });
  });

  describe('toObject()', () => {
    it('should convert provider to object', () => {
      provider.setSlot(null, 'Default');
      provider.setSlot('header', 'Header');
      provider.setSlot('footer', 'Footer');

      const obj = provider.toObject();

      expect(obj).toEqual({
        default: 'Default',
        header: 'Header',
        footer: 'Footer',
      });
    });

    it('should return empty object for empty provider', () => {
      expect(provider.toObject()).toEqual({});
    });
  });
});
