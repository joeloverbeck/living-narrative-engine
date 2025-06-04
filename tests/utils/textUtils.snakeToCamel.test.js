// tests/utils/textUtils.snakeToCamel.test.js

import { snakeToCamel } from '../../src/utils/textUtils.js'; // Assuming 'tests' is at the project root, sibling to 'src'
import { describe, it, expect } from '@jest/globals';

describe('snakeToCamel Utility Function', () => {
  describe('Falsy and Invalid Inputs', () => {
    it('should return an empty string for null input', () => {
      expect(snakeToCamel(null)).toBe('');
    });

    it('should return an empty string for undefined input', () => {
      expect(snakeToCamel(undefined)).toBe('');
    });

    it('should return an empty string for an empty string input', () => {
      expect(snakeToCamel('')).toBe('');
    });

    it('should return an empty string for a number input', () => {
      expect(snakeToCamel(123)).toBe('');
    });

    it('should return an empty string for a boolean true input', () => {
      expect(snakeToCamel(true)).toBe('');
    });

    it('should return an empty string for a boolean false input', () => {
      expect(snakeToCamel(false)).toBe('');
    });

    it('should return an empty string for an object input', () => {
      expect(snakeToCamel({})).toBe('');
    });

    it('should return an empty string for an array input', () => {
      expect(snakeToCamel([])).toBe('');
    });
  });

  describe('Strings Without Underscores or Not Matching Pattern _[a-z]', () => {
    it('should return already camelCased string as is', () => {
      expect(snakeToCamel('alreadyCamelCase')).toBe('alreadyCamelCase');
    });

    it('should return PascalCased string as is', () => {
      expect(snakeToCamel('PascalCase')).toBe('PascalCase');
    });

    it('should return single word lowercase string as is', () => {
      expect(snakeToCamel('word')).toBe('word');
    });

    it('should return string with trailing underscore as is if not followed by a lowercase letter', () => {
      expect(snakeToCamel('word_')).toBe('word_');
    });

    it('should return string with leading underscore if not followed by a lowercase letter to form a match (e.g. _1)', () => {
      expect(snakeToCamel('_1word')).toBe('_1word'); // _1 is not _[a-z]
    });

    it('should handle strings with numbers and no matching underscores', () => {
      expect(snakeToCamel('word123')).toBe('word123');
    });

    it('should return string with underscore followed by number as is', () => {
      expect(snakeToCamel('word_123')).toBe('word_123');
    });

    it('should return all caps snake_case string as is because regex targets _[a-z]', () => {
      expect(snakeToCamel('ALL_CAPS_STRING')).toBe('ALL_CAPS_STRING');
    });

    it('should return string with underscore followed by uppercase letter as is', () => {
      expect(snakeToCamel('snake_Case')).toBe('snake_Case');
    });
  });

  describe('Standard Snake Case to Camel Case Conversion', () => {
    it('should convert simple snake_case to camelCase', () => {
      expect(snakeToCamel('snake_case')).toBe('snakeCase');
    });

    it('should convert a longer snake_case string to camelCase', () => {
      expect(snakeToCamel('another_example_string')).toBe(
        'anotherExampleString'
      );
    });

    it('should convert short snake_case strings', () => {
      expect(snakeToCamel('a_b_c_d_e')).toBe('aBCDE');
    });

    it('should convert snake_case with single letter segments', () => {
      expect(snakeToCamel('s_h_o_r_t')).toBe('sHORT');
    });
  });

  describe('Mixed Cases, Numbers, and Specific Underscore Patterns', () => {
    it('should convert snake_case with leading underscore correctly', () => {
      expect(snakeToCamel('_leading_underscore')).toBe('LeadingUnderscore');
    });

    it('should convert snake_case with multiple leading underscores correctly', () => {
      expect(snakeToCamel('__two_leading_underscores')).toBe(
        '_TwoLeadingUnderscores'
      );
    });

    it('should convert snake_case with three leading underscores correctly', () => {
      expect(snakeToCamel('___three_leading_underscores')).toBe(
        '__ThreeLeadingUnderscores'
      );
    });

    it('should convert term with leading underscore and internal underscores', () => {
      expect(snakeToCamel('_private_member_variable')).toBe(
        'PrivateMemberVariable'
      );
    });

    it('should handle snake_case with numbers correctly (numbers are not changed by _[a-z])', () => {
      expect(snakeToCamel('version_1_alpha')).toBe('version_1Alpha');
    });

    it('should handle snake_case with numbers in various positions', () => {
      expect(snakeToCamel('release_v1_2_beta_3')).toBe('releaseV1_2Beta_3');
    });

    it('should handle double underscores where only the one before a letter is processed', () => {
      expect(snakeToCamel('test__double_underscore')).toBe(
        'test_DoubleUnderscore'
      );
    });

    it('should handle triple underscores', () => {
      expect(snakeToCamel('test___triple_underscore')).toBe(
        'test__TripleUnderscore'
      );
    });

    it('should handle mixed alphanumeric parts', () => {
      expect(snakeToCamel('item_id_and_item_name')).toBe('itemIdAndItemName');
    });

    it('should handle strings ending with an underscore followed by a letter', () => {
      expect(snakeToCamel('ends_with_a')).toBe('endsWithA');
    });

    it('should handle complex cases with numbers, multiple underscores, and leading/trailing parts', () => {
      expect(
        snakeToCamel('_config_value_for_user_1_setting_alpha__final_')
      ).toBe('ConfigValueForUser_1SettingAlpha_Final_');
    });
  });
});
