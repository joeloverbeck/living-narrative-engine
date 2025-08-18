/**
 * @file Unit tests for color validation utilities
 */

import { describe, it, expect } from '@jest/globals';
import {
  validateColor,
  getColorErrorMessage,
} from '../../../src/utils/colorValidation.js';

describe('colorValidation', () => {
  describe('validateColor', () => {
    describe('Valid Colors', () => {
      it('should validate hex colors', () => {
        expect(validateColor('#fff')).toBe(true);
        expect(validateColor('#FFF')).toBe(true);
        expect(validateColor('#ffffff')).toBe(true);
        expect(validateColor('#FFFFFF')).toBe(true);
        expect(validateColor('#a1b2c3')).toBe(true);
        expect(validateColor('#000')).toBe(true);
        expect(validateColor('#123456')).toBe(true);
      });

      it('should validate rgb colors', () => {
        expect(validateColor('rgb(0, 0, 0)')).toBe(true);
        expect(validateColor('rgb(255, 255, 255)')).toBe(true);
        expect(validateColor('rgb(128, 128, 128)')).toBe(true);
        expect(validateColor('rgb(255,0,0)')).toBe(true); // No spaces
        expect(validateColor('rgb( 100 , 100 , 100 )')).toBe(true); // Extra spaces
      });

      it('should validate rgba colors', () => {
        expect(validateColor('rgba(0, 0, 0, 0)')).toBe(true);
        expect(validateColor('rgba(255, 255, 255, 1)')).toBe(true);
        expect(validateColor('rgba(128, 128, 128, 0.5)')).toBe(true);
        expect(validateColor('rgba(255, 0, 0, 0.75)')).toBe(true);
        expect(validateColor('rgba(0, 0, 0, 1.0)')).toBe(true);
      });

      it('should validate named colors', () => {
        expect(validateColor('red')).toBe(true);
        expect(validateColor('blue')).toBe(true);
        expect(validateColor('green')).toBe(true);
        expect(validateColor('white')).toBe(true);
        expect(validateColor('black')).toBe(true);
        expect(validateColor('aliceblue')).toBe(true);
        expect(validateColor('darkslategray')).toBe(true);
        expect(validateColor('cornflowerblue')).toBe(true);
        expect(validateColor('RED')).toBe(true); // Case insensitive
        expect(validateColor('DarkSlateGray')).toBe(true);
      });
    });

    describe('Invalid Colors', () => {
      it('should reject invalid hex colors', () => {
        expect(validateColor('#')).toBe(false);
        expect(validateColor('#ff')).toBe(false); // Too short
        expect(validateColor('#ffff')).toBe(false); // Invalid length
        expect(validateColor('#gggggg')).toBe(false); // Invalid characters
        expect(validateColor('#1234567')).toBe(false); // Too long
        expect(validateColor('fff')).toBe(false); // Missing #
      });

      it('should reject invalid rgb colors', () => {
        expect(validateColor('rgb(256, 0, 0)')).toBe(false); // > 255
        expect(validateColor('rgb(-1, 0, 0)')).toBe(false); // Negative
        expect(validateColor('rgb(0, 0)')).toBe(false); // Missing component
        expect(validateColor('rgb(0, 0, 0, 0.5)')).toBe(false); // Extra component
        expect(validateColor('rgb(a, b, c)')).toBe(false); // Non-numeric
      });

      it('should reject invalid rgba colors', () => {
        expect(validateColor('rgba(256, 0, 0, 0.5)')).toBe(false); // > 255
        expect(validateColor('rgba(0, 0, 0, 2)')).toBe(false); // Alpha > 1
        expect(validateColor('rgba(0, 0, 0, -0.5)')).toBe(false); // Negative alpha
        expect(validateColor('rgba(0, 0, 0)')).toBe(false); // Missing alpha
      });

      it('should reject invalid named colors', () => {
        expect(validateColor('notacolor')).toBe(false);
        expect(validateColor('purpleish')).toBe(false);
        expect(validateColor('dark blue')).toBe(false); // Space not allowed
        expect(validateColor('red-ish')).toBe(false);
      });

      it('should reject non-string values', () => {
        expect(validateColor(null)).toBe(false);
        expect(validateColor(undefined)).toBe(false);
        expect(validateColor(123)).toBe(false);
        expect(validateColor({})).toBe(false);
        expect(validateColor([])).toBe(false);
        expect(validateColor(true)).toBe(false);
      });
    });
  });

  describe('getColorErrorMessage', () => {
    it('should return appropriate error for non-string values', () => {
      expect(getColorErrorMessage(null)).toBe('Color must be a string');
      expect(getColorErrorMessage(123)).toBe('Color must be a string');
      expect(getColorErrorMessage({})).toBe('Color must be a string');
    });

    it('should return descriptive error for invalid string colors', () => {
      const error = getColorErrorMessage('invalidcolor');
      expect(error).toContain('Invalid CSS color value');
      expect(error).toContain('invalidcolor');
      expect(error).toContain('Expected hex');
    });
  });
});
