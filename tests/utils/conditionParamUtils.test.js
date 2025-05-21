// src/tests/utils/conditionParamUtils.test.js

import {describe, it, expect} from '@jest/globals';
import {
  getNumberParam,
  getStringParam,
  getBooleanParam,
  getValueParam,
} from '../../src/utils/conditionParamUtils.js'; // <= Updated import path

// --- Test Suite for Parameter Getters ---

describe('Condition Parameter Utility Functions (conditionParamUtils.js)', () => {

  // --- Test Data ---
  const conditionData = {
    numValue: 10,
    stringValue: 'hello',
    boolValue: true,
    nullValue: null,
    zeroValue: 0,
    falseValue: false,
    objValue: {a: 1},
    presentButWrongType: 'not a number',
  };
  const emptyConditionData = {};
  const nullConditionData = null;
  const undefinedConditionData = undefined;


  // --- getNumberParam ---
  describe('getNumberParam', () => {
    it('should return number value if present and correct type', () => {
      expect(getNumberParam(conditionData, 'numValue')).toBe(10);
      expect(getNumberParam(conditionData, 'zeroValue')).toBe(0);
    });
    it('should return default value if key is missing', () => {
      expect(getNumberParam(conditionData, 'missingKey', 99)).toBe(99);
      expect(getNumberParam(conditionData, 'missingKey')).toBeNull(); // Default default is null
      expect(getNumberParam(emptyConditionData, 'numValue', 99)).toBe(99);
    });
    it('should return default value if value has wrong type', () => {
      expect(getNumberParam(conditionData, 'presentButWrongType', 99)).toBe(99);
      expect(getNumberParam(conditionData, 'presentButWrongType')).toBeNull();
      expect(getNumberParam(conditionData, 'boolValue', 99)).toBe(99);
    });
    it('should return default value if value is null', () => {
      expect(getNumberParam(conditionData, 'nullValue', 99)).toBe(99);
      expect(getNumberParam(conditionData, 'nullValue')).toBeNull();
    });
    it('should return default value if conditionData itself is null or undefined', () => {
      expect(getNumberParam(nullConditionData, 'numValue', 99)).toBe(99);
      expect(getNumberParam(undefinedConditionData, 'numValue', 99)).toBe(99);
      expect(getNumberParam(nullConditionData, 'numValue')).toBeNull();
    });
  });

  // --- getStringParam ---
  describe('getStringParam', () => {
    it('should return string value if present and correct type', () => {
      expect(getStringParam(conditionData, 'stringValue')).toBe('hello');
    });
    it('should return default value if key is missing', () => {
      expect(getStringParam(conditionData, 'missingKey', 'default')).toBe('default');
      expect(getStringParam(conditionData, 'missingKey')).toBeNull();
      expect(getStringParam(emptyConditionData, 'stringValue', 'default')).toBe('default');
    });
    it('should return default value if value has wrong type', () => {
      expect(getStringParam(conditionData, 'numValue', 'default')).toBe('default');
      expect(getStringParam(conditionData, 'numValue')).toBeNull();
    });
    it('should return default value if value is null', () => {
      expect(getStringParam(conditionData, 'nullValue', 'default')).toBe('default');
      expect(getStringParam(conditionData, 'nullValue')).toBeNull();
    });
    it('should return default value if conditionData itself is null or undefined', () => {
      expect(getStringParam(nullConditionData, 'stringValue', 'default')).toBe('default');
      expect(getStringParam(undefinedConditionData, 'stringValue', 'default')).toBe('default');
      expect(getStringParam(nullConditionData, 'stringValue')).toBeNull();
    });
  });

  // --- getBooleanParam ---
  describe('getBooleanParam', () => {
    it('should return boolean value if present and correct type', () => {
      expect(getBooleanParam(conditionData, 'boolValue')).toBe(true);
      expect(getBooleanParam(conditionData, 'falseValue')).toBe(false);
    });
    it('should return default value if key is missing', () => {
      expect(getBooleanParam(conditionData, 'missingKey', true)).toBe(true);
      expect(getBooleanParam(conditionData, 'missingKey', false)).toBe(false);
      expect(getBooleanParam(conditionData, 'missingKey')).toBeNull();
      expect(getBooleanParam(emptyConditionData, 'boolValue', true)).toBe(true);
    });
    it('should return default value if value has wrong type', () => {
      expect(getBooleanParam(conditionData, 'numValue', true)).toBe(true);
      expect(getBooleanParam(conditionData, 'numValue')).toBeNull();
    });
    it('should return default value if value is null', () => {
      expect(getBooleanParam(conditionData, 'nullValue', true)).toBe(true);
      expect(getBooleanParam(conditionData, 'nullValue')).toBeNull();
    });
    it('should return default value if conditionData itself is null or undefined', () => {
      expect(getBooleanParam(nullConditionData, 'boolValue', true)).toBe(true);
      expect(getBooleanParam(undefinedConditionData, 'boolValue', true)).toBe(true);
      expect(getBooleanParam(nullConditionData, 'boolValue')).toBeNull();
    });
  });

  // --- getValueParam ---
  describe('getValueParam', () => {
    it('should return value regardless of type if present', () => {
      expect(getValueParam(conditionData, 'numValue')).toBe(10);
      expect(getValueParam(conditionData, 'stringValue')).toBe('hello');
      expect(getValueParam(conditionData, 'boolValue')).toBe(true);
      expect(getValueParam(conditionData, 'zeroValue')).toBe(0);
      expect(getValueParam(conditionData, 'falseValue')).toBe(false);
      expect(getValueParam(conditionData, 'objValue')).toEqual({a: 1});
    });
    it('should return undefined if key is missing', () => {
      expect(getValueParam(conditionData, 'missingKey')).toBeUndefined();
      expect(getValueParam(emptyConditionData, 'numValue')).toBeUndefined();
    });
    it('should return null if value is explicitly null', () => {
      expect(getValueParam(conditionData, 'nullValue')).toBeNull();
    });
    it('should return undefined if conditionData itself is null or undefined', () => {
      expect(getValueParam(nullConditionData, 'numValue')).toBeUndefined();
      expect(getValueParam(undefinedConditionData, 'numValue')).toBeUndefined();
    });
  });
});