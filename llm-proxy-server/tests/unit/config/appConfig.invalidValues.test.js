import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import {
  getAppConfigService,
  resetAppConfigServiceInstance,
} from '../../../src/config/appConfig.js';

const createLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

describe('AppConfigService - Invalid Configuration Values Coverage', () => {
  let logger;

  beforeEach(() => {
    jest.resetModules();
    resetAppConfigServiceInstance();
    process.env = {};
    logger = createLogger();
  });

  describe('Cache Configuration Invalid Values', () => {
    test('CACHE_DEFAULT_TTL with non-numeric value triggers warning and uses default', () => {
      process.env.CACHE_DEFAULT_TTL = 'invalid_number';

      getAppConfigService(logger);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "CACHE_DEFAULT_TTL invalid: 'invalid_number'. Using default:"
        )
      );
    });

    test('CACHE_DEFAULT_TTL with NaN value triggers warning and uses default', () => {
      process.env.CACHE_DEFAULT_TTL = 'NaN';

      getAppConfigService(logger);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "CACHE_DEFAULT_TTL invalid: 'NaN'. Using default:"
        )
      );
    });

    test('CACHE_MAX_SIZE with non-numeric value triggers warning and uses default', () => {
      process.env.CACHE_MAX_SIZE = 'not_a_number';

      getAppConfigService(logger);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "CACHE_MAX_SIZE invalid: 'not_a_number'. Using default:"
        )
      );
    });

    test('CACHE_MAX_SIZE with zero value triggers warning and uses default', () => {
      process.env.CACHE_MAX_SIZE = '0';

      getAppConfigService(logger);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("CACHE_MAX_SIZE invalid: '0'. Using default:")
      );
    });

    test('CACHE_MAX_SIZE with negative value triggers warning and uses default', () => {
      process.env.CACHE_MAX_SIZE = '-10';

      getAppConfigService(logger);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining("CACHE_MAX_SIZE invalid: '-10'. Using default:")
      );
    });

    test('API_KEY_CACHE_TTL with non-numeric value triggers warning and uses default', () => {
      process.env.API_KEY_CACHE_TTL = 'invalid';

      getAppConfigService(logger);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "API_KEY_CACHE_TTL invalid: 'invalid'. Using default:"
        )
      );
    });
  });

  describe('HTTP Agent Configuration Invalid Values', () => {
    test('HTTP_AGENT_MAX_SOCKETS with non-numeric value triggers warning and uses default', () => {
      process.env.HTTP_AGENT_MAX_SOCKETS = 'invalid';

      getAppConfigService(logger);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "HTTP_AGENT_MAX_SOCKETS invalid: 'invalid'. Using default:"
        )
      );
    });

    test('HTTP_AGENT_MAX_SOCKETS with zero value triggers warning and uses default', () => {
      process.env.HTTP_AGENT_MAX_SOCKETS = '0';

      getAppConfigService(logger);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "HTTP_AGENT_MAX_SOCKETS invalid: '0'. Using default:"
        )
      );
    });

    test('HTTP_AGENT_MAX_SOCKETS with negative value triggers warning and uses default', () => {
      process.env.HTTP_AGENT_MAX_SOCKETS = '-5';

      getAppConfigService(logger);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "HTTP_AGENT_MAX_SOCKETS invalid: '-5'. Using default:"
        )
      );
    });

    test('HTTP_AGENT_MAX_FREE_SOCKETS with non-numeric value triggers warning and uses default', () => {
      process.env.HTTP_AGENT_MAX_FREE_SOCKETS = 'invalid';

      getAppConfigService(logger);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "HTTP_AGENT_MAX_FREE_SOCKETS invalid: 'invalid'. Using default:"
        )
      );
    });

    test('HTTP_AGENT_MAX_FREE_SOCKETS with negative value triggers warning and uses default', () => {
      process.env.HTTP_AGENT_MAX_FREE_SOCKETS = '-1';

      getAppConfigService(logger);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "HTTP_AGENT_MAX_FREE_SOCKETS invalid: '-1'. Using default:"
        )
      );
    });

    test('HTTP_AGENT_TIMEOUT with non-numeric value triggers warning and uses default', () => {
      process.env.HTTP_AGENT_TIMEOUT = 'invalid';

      getAppConfigService(logger);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "HTTP_AGENT_TIMEOUT invalid: 'invalid'. Using default:"
        )
      );
    });

    test('HTTP_AGENT_TIMEOUT with zero value triggers warning and uses default', () => {
      process.env.HTTP_AGENT_TIMEOUT = '0';

      getAppConfigService(logger);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "HTTP_AGENT_TIMEOUT invalid: '0'. Using default:"
        )
      );
    });

    test('HTTP_AGENT_FREE_SOCKET_TIMEOUT with non-numeric value triggers warning and uses default', () => {
      process.env.HTTP_AGENT_FREE_SOCKET_TIMEOUT = 'invalid';

      getAppConfigService(logger);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "HTTP_AGENT_FREE_SOCKET_TIMEOUT invalid: 'invalid'. Using default:"
        )
      );
    });

    test('HTTP_AGENT_FREE_SOCKET_TIMEOUT with zero value triggers warning and uses default', () => {
      process.env.HTTP_AGENT_FREE_SOCKET_TIMEOUT = '0';

      getAppConfigService(logger);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "HTTP_AGENT_FREE_SOCKET_TIMEOUT invalid: '0'. Using default:"
        )
      );
    });

    test('HTTP_AGENT_MAX_TOTAL_SOCKETS with non-numeric value triggers warning and uses default', () => {
      process.env.HTTP_AGENT_MAX_TOTAL_SOCKETS = 'invalid';

      getAppConfigService(logger);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "HTTP_AGENT_MAX_TOTAL_SOCKETS invalid: 'invalid'. Using default:"
        )
      );
    });

    test('HTTP_AGENT_MAX_TOTAL_SOCKETS with zero value triggers warning and uses default', () => {
      process.env.HTTP_AGENT_MAX_TOTAL_SOCKETS = '0';

      getAppConfigService(logger);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "HTTP_AGENT_MAX_TOTAL_SOCKETS invalid: '0'. Using default:"
        )
      );
    });

    test('HTTP_AGENT_MAX_IDLE_TIME with non-numeric value triggers warning and uses default', () => {
      process.env.HTTP_AGENT_MAX_IDLE_TIME = 'invalid';

      getAppConfigService(logger);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "HTTP_AGENT_MAX_IDLE_TIME invalid: 'invalid'. Using default:"
        )
      );
    });

    test('HTTP_AGENT_MAX_IDLE_TIME with zero value triggers warning and uses default', () => {
      process.env.HTTP_AGENT_MAX_IDLE_TIME = '0';

      getAppConfigService(logger);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          "HTTP_AGENT_MAX_IDLE_TIME invalid: '0'. Using default:"
        )
      );
    });
  });

  describe('Multiple Invalid Values Scenario', () => {
    test('multiple invalid environment variables trigger multiple warnings', () => {
      process.env.CACHE_DEFAULT_TTL = 'invalid';
      process.env.CACHE_MAX_SIZE = '0';
      process.env.HTTP_AGENT_MAX_SOCKETS = 'bad';
      process.env.HTTP_AGENT_TIMEOUT = '-1';

      getAppConfigService(logger);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('CACHE_DEFAULT_TTL invalid')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('CACHE_MAX_SIZE invalid')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('HTTP_AGENT_MAX_SOCKETS invalid')
      );
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('HTTP_AGENT_TIMEOUT invalid')
      );
    });
  });
});
