/**
 * @file Unit tests for BodyDescriptorValidationError
 */

import { describe, it, expect } from '@jest/globals';
import { BodyDescriptorValidationError } from '../../../../src/anatomy/errors/bodyDescriptorValidationError.js';
import { ValidationError } from '../../../../src/errors/validationError.js';

describe('BodyDescriptorValidationError', () => {
  describe('constructor', () => {
    it('should create error with message only', () => {
      const error = new BodyDescriptorValidationError('Test message');
      expect(error.message).toBe('Test message');
      expect(error.name).toBe('BodyDescriptorValidationError');
      expect(error.descriptorProperty).toBeNull();
      expect(error.invalidValue).toBeNull();
    });

    it('should create error with message and property', () => {
      const error = new BodyDescriptorValidationError(
        'Test message',
        'build',
        'invalid-value'
      );
      expect(error.message).toBe('Test message');
      expect(error.descriptorProperty).toBe('build');
      expect(error.invalidValue).toBe('invalid-value');
    });

    it('should inherit from ValidationError', () => {
      const error = new BodyDescriptorValidationError('Test message');
      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toBeInstanceOf(Error);
    });

    it('should have proper stack trace', () => {
      const error = new BodyDescriptorValidationError('Test message');
      expect(error.stack).toBeDefined();
      expect(typeof error.stack).toBe('string');
    });
  });

  describe('invalidEnumValue factory method', () => {
    it('should create error for invalid enum value', () => {
      const validValues = ['value1', 'value2', 'value3'];
      const error = BodyDescriptorValidationError.invalidEnumValue(
        'build',
        'invalid-build',
        validValues,
        'test-context'
      );

      expect(error).toBeInstanceOf(BodyDescriptorValidationError);
      expect(error.message).toContain('Invalid build descriptor:');
      expect(error.message).toContain('invalid-build');
      expect(error.message).toContain('test-context');
      expect(error.message).toContain('value1, value2, value3');
      expect(error.descriptorProperty).toBe('build');
      expect(error.invalidValue).toBe('invalid-build');
    });

    it('should use default context when not provided', () => {
      const validValues = ['value1', 'value2'];
      const error = BodyDescriptorValidationError.invalidEnumValue(
        'density',
        'invalid-density',
        validValues
      );

      expect(error.message).toContain('unknown');
    });
  });

  describe('unknownProperty factory method', () => {
    it('should create error for unknown property', () => {
      const supportedProperties = ['build', 'density', 'composition'];
      const error = BodyDescriptorValidationError.unknownProperty(
        'unknownProp',
        supportedProperties,
        'test-context'
      );

      expect(error).toBeInstanceOf(BodyDescriptorValidationError);
      expect(error.message).toContain('Unknown body descriptor property');
      expect(error.message).toContain('unknownProp');
      expect(error.message).toContain('test-context');
      expect(error.message).toContain('build, density, composition');
      expect(error.descriptorProperty).toBe('unknownProp');
      expect(error.invalidValue).toBeNull();
    });

    it('should use default context when not provided', () => {
      const supportedProperties = ['build', 'density'];
      const error = BodyDescriptorValidationError.unknownProperty(
        'unknownProp',
        supportedProperties
      );

      expect(error.message).toContain('unknown');
    });
  });

  describe('error properties', () => {
    it('should preserve error properties through factory methods', () => {
      const error1 = BodyDescriptorValidationError.invalidEnumValue(
        'build',
        'invalid-build',
        ['valid1', 'valid2']
      );
      expect(error1.descriptorProperty).toBe('build');
      expect(error1.invalidValue).toBe('invalid-build');

      const error2 = BodyDescriptorValidationError.unknownProperty(
        'unknownProp',
        ['supported1', 'supported2']
      );
      expect(error2.descriptorProperty).toBe('unknownProp');
      expect(error2.invalidValue).toBeNull();
    });
  });
});
