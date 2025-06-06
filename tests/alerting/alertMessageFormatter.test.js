import { AlertMessageFormatter } from '../../src/alerting/AlertMessageFormatter.js';
import { beforeEach, describe, expect, it } from '@jest/globals';

describe('AlertMessageFormatter', () => {
  let formatter;

  beforeEach(() => {
    formatter = new AlertMessageFormatter();
  });

  // Test Status Code Mappings
  describe('Status Code Mapping', () => {
    it('should format a 401 status code correctly', () => {
      const details = {
        statusCode: 401,
        raw: 'Unauthorized',
        url: '/api/data',
      };
      const result = formatter.format(details);
      expect(result.displayMessage).toBe(
        'Authentication failed. Please check your credentials or permissions.'
      );
      expect(result.developerDetails).toBe('401 Unauthorized at /api/data');
    });

    it('should format a 403 status code correctly', () => {
      const details = { statusCode: 403, raw: 'Forbidden' };
      const result = formatter.format(details);
      expect(result.displayMessage).toBe(
        'Authentication failed. Please check your credentials or permissions.'
      );
      expect(result.developerDetails).toBe('403 Forbidden');
    });

    it('should format a 404 status code correctly', () => {
      const details = { statusCode: 404 };
      const result = formatter.format(details);
      expect(result.displayMessage).toBe(
        'The requested resource could not be found.'
      );
      expect(result.developerDetails).toBe('404');
    });

    it('should format a 500 status code correctly', () => {
      const details = {
        statusCode: 500,
        raw: 'Internal Server Error',
        url: '/api/process',
      };
      const result = formatter.format(details);
      expect(result.displayMessage).toBe(
        'An unexpected server error occurred. Please try again later.'
      );
      expect(result.developerDetails).toBe(
        '500 Internal Server Error at /api/process'
      );
    });

    it('should format a 503 status code correctly', () => {
      const details = { statusCode: 503 };
      const result = formatter.format(details);
      expect(result.displayMessage).toBe(
        'Service temporarily unavailable. Please retry in a moment.'
      );
      expect(result.developerDetails).toBe('503');
    });

    it('should use the message as a fallback for an unmapped status code', () => {
      const details = {
        statusCode: 418,
        message: "I'm a teapot",
        raw: "I'm a teapot",
      };
      const result = formatter.format(details);
      expect(result.displayMessage).toBe("I'm a teapot");
      expect(result.developerDetails).toBe("418 I'm a teapot");
    });
  });

  // Test Generic Fallbacks
  describe('Generic Fallbacks', () => {
    it('should use details.message if no statusCode is present', () => {
      const details = { message: 'A generic warning happened.' };
      const result = formatter.format(details);
      expect(result.displayMessage).toBe('A generic warning happened.');
      expect(result.developerDetails).toBeNull();
    });

    it('should handle a details.message that is not a string', () => {
      const details = { message: 12345 };
      const result = formatter.format(details);
      expect(result.displayMessage).toBe('12345');
      expect(result.developerDetails).toBeNull();
    });
  });

  // Test Default/Malformed Cases
  describe('Default and Malformed Cases', () => {
    it('should return a generic message for a null details object', () => {
      const result = formatter.format(null);
      expect(result.displayMessage).toBe('An unknown warning/error occurred.');
      expect(result.developerDetails).toBe('null');
    });

    it('should return a generic message for an undefined details object', () => {
      const result = formatter.format(undefined);
      expect(result.displayMessage).toBe('An unknown warning/error occurred.');
      expect(result.developerDetails).toBe('Malformed details: undefined');
    });

    it('should return a generic message for a non-object details input', () => {
      const result = formatter.format('this is a string');
      expect(result.displayMessage).toBe('An unknown warning/error occurred.');
      expect(result.developerDetails).toBe('Malformed details: string');
    });

    it('should return a generic message for an empty details object', () => {
      const result = formatter.format({});
      expect(result.displayMessage).toBe('An unknown warning/error occurred.');
      expect(result.developerDetails).toBeNull();
    });

    it('should return a generic message for an object with no useful properties', () => {
      const result = formatter.format({ foo: 'bar', baz: 123 });
      expect(result.displayMessage).toBe('An unknown warning/error occurred.');
      expect(result.developerDetails).toBeNull();
    });
  });
});
