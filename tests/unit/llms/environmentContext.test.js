// tests/llms/environmentContext.test.js
// --- FILE START ---

import { jest, describe, beforeEach, test, expect } from '@jest/globals';
import { EnvironmentContext } from '../../../src/llms/environmentContext.js'; // Adjust path as needed

const DEFAULT_PROXY_SERVER_URL = 'http://localhost:3001/api/llm-request';

/**
 * @returns {jest.Mocked<import('../../../src/llms/environmentContext.js').ILogger>} // Adjust path for ILogger definition
 */
const mockLogger = () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
});

describe('EnvironmentContext', () => {
  /** @type {ReturnType<typeof mockLogger>} */
  let logger;

  beforeEach(() => {
    logger = mockLogger();
    jest.clearAllMocks();
  });

  describe('Constructor and Validations', () => {
    describe('Logger Validation', () => {
      test('should throw error if logger is null', () => {
        expect(
          () =>
            new EnvironmentContext({
              logger: null,
              executionEnvironment: 'client',
            })
        ).toThrow('Missing required dependency: logger.');
      });

      test('should throw error if logger is an empty object', () => {
        expect(
          () =>
            new EnvironmentContext({
              logger: {},
              executionEnvironment: 'client',
            })
        ).toThrow("Invalid or missing method 'info' on dependency 'logger'.");
      });

      ['warn', 'error', 'debug'].forEach((method) => {
        test(`should throw error if logger is missing ${method} method`, () => {
          const incompleteLogger = { ...mockLogger() };
          delete incompleteLogger[method];
          expect(
            () =>
              new EnvironmentContext({
                logger: incompleteLogger,
                executionEnvironment: 'client',
              })
          ).toThrow(
            `Invalid or missing method '${method}' on dependency 'logger'.`
          );
        });
      });

      test('should use console.error if logger.error is missing during critical logger validation failure', () => {
        const consoleErrorSpy = jest
          .spyOn(console, 'error')
          .mockImplementation(() => {});
        const invalidLogger = {
          info: () => {},
          warn: () => {},
          debug: () => {},
        }; // Missing error
        try {
          new EnvironmentContext({
            logger: invalidLogger,
            executionEnvironment: 'client',
          });
        } catch (e) {
          // Expected to throw
        }
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Invalid or missing method 'error' on dependency 'logger'."
        );
        consoleErrorSpy.mockRestore();
      });
    });

    describe('Execution Environment Validation', () => {
      test('should correctly set executionEnvironment for "client"', () => {
        const context = new EnvironmentContext({
          logger,
          executionEnvironment: 'client',
        });
        expect(context.getExecutionEnvironment()).toBe('client');
        expect(logger.warn).not.toHaveBeenCalled();
      });

      test('should correctly set executionEnvironment for "server"', () => {
        const context = new EnvironmentContext({
          logger,
          executionEnvironment: 'server',
          projectRootPath: '/test/root',
        });
        expect(context.getExecutionEnvironment()).toBe('server');
        expect(logger.warn).not.toHaveBeenCalled();
      });

      test('should correctly set executionEnvironment for "unknown"', () => {
        const context = new EnvironmentContext({
          logger,
          executionEnvironment: 'unknown',
        });
        expect(context.getExecutionEnvironment()).toBe('unknown');
        expect(logger.warn).not.toHaveBeenCalled(); // No warning if explicitly 'unknown'
      });

      test('should default to "unknown" and log warning for invalid executionEnvironment string', () => {
        const context = new EnvironmentContext({
          logger,
          executionEnvironment: 'invalid_env',
        });
        expect(context.getExecutionEnvironment()).toBe('unknown');
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "Invalid executionEnvironment provided: 'invalid_env'. Defaulting to 'unknown'."
          )
        );
      });

      test('should default to "unknown" and log warning if executionEnvironment is null', () => {
        const context = new EnvironmentContext({
          logger,
          executionEnvironment: null,
        });
        expect(context.getExecutionEnvironment()).toBe('unknown');
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            "Invalid executionEnvironment provided: 'null'. Defaulting to 'unknown'."
          )
        );
      });

      test('should handle case-insensitivity for executionEnvironment', () => {
        const context = new EnvironmentContext({
          logger,
          executionEnvironment: 'CLIENT',
        });
        expect(context.getExecutionEnvironment()).toBe('client');
        const context2 = new EnvironmentContext({
          logger,
          executionEnvironment: 'SerVeR',
          projectRootPath: '/test/root',
        });
        expect(context2.getExecutionEnvironment()).toBe('server');
      });
    });

    describe('Project Root Path Validation', () => {
      // Server Environment
      test('server env: should correctly set projectRootPath if valid', () => {
        const context = new EnvironmentContext({
          logger,
          executionEnvironment: 'server',
          projectRootPath: ' /my/project/root/ ',
        });
        expect(context.getProjectRootPath()).toBe('/my/project/root/');
        expect(logger.debug).toHaveBeenCalledWith(
          "EnvironmentContext: Server-side projectRootPath set to: '/my/project/root/'"
        );
      });

      test('server env: should throw error if projectRootPath is null', () => {
        expect(
          () =>
            new EnvironmentContext({
              logger,
              executionEnvironment: 'server',
              projectRootPath: null,
            })
        ).toThrow(
          "EnvironmentContext: Constructor requires 'projectRootPath' (non-empty string) when executionEnvironment is 'server'."
        );
        expect(logger.error).toHaveBeenCalledWith(
          "EnvironmentContext: Constructor requires 'projectRootPath' (non-empty string) when executionEnvironment is 'server'."
        );
      });

      test('server env: should throw error if projectRootPath is empty string', () => {
        expect(
          () =>
            new EnvironmentContext({
              logger,
              executionEnvironment: 'server',
              projectRootPath: '  ',
            })
        ).toThrow(
          "EnvironmentContext: Constructor requires 'projectRootPath' (non-empty string) when executionEnvironment is 'server'."
        );
        expect(logger.error).toHaveBeenCalledWith(
          "EnvironmentContext: Constructor requires 'projectRootPath' (non-empty string) when executionEnvironment is 'server'."
        );
      });

      // Client Environment
      test('client env: projectRootPath should be null and log warning if provided', () => {
        const context = new EnvironmentContext({
          logger,
          executionEnvironment: 'client',
          projectRootPath: '/my/project/root/',
        });
        expect(context.getProjectRootPath()).toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
          "EnvironmentContext: 'projectRootPath' (\"/my/project/root/\") was provided, but executionEnvironment is 'client', not 'server'. It will be ignored."
        );
      });
      test('client env: projectRootPath should be null if not provided', () => {
        const context = new EnvironmentContext({
          logger,
          executionEnvironment: 'client',
        });
        expect(context.getProjectRootPath()).toBeNull();
        expect(logger.warn).not.toHaveBeenCalledWith(
          expect.stringContaining("'projectRootPath'")
        );
      });

      // Unknown Environment
      test('unknown env: projectRootPath should be null and log warning if provided', () => {
        const context = new EnvironmentContext({
          logger,
          executionEnvironment: 'unknown',
          projectRootPath: '/my/project/root/',
        });
        expect(context.getProjectRootPath()).toBeNull();
        expect(logger.warn).toHaveBeenCalledWith(
          "EnvironmentContext: 'projectRootPath' (\"/my/project/root/\") was provided, but executionEnvironment is 'unknown', not 'server'. It will be ignored."
        );
      });
    });

    describe('Proxy Server URL Validation', () => {
      // Client Environment
      test('client env: should correctly set proxyServerUrl if valid', () => {
        const url = 'http://localhost:4000/proxy';
        const context = new EnvironmentContext({
          logger,
          executionEnvironment: 'client',
          proxyServerUrl: ` ${url} `,
        });
        expect(context.getProxyServerUrl()).toBe(url);
      });

      test('client env: should use default proxyServerUrl and log info if null', () => {
        const context = new EnvironmentContext({
          logger,
          executionEnvironment: 'client',
          proxyServerUrl: null,
        });
        expect(context.getProxyServerUrl()).toBe(DEFAULT_PROXY_SERVER_URL);
      });

      test('client env: should use default proxyServerUrl and log warning if empty string', () => {
        const context = new EnvironmentContext({
          logger,
          executionEnvironment: 'client',
          proxyServerUrl: '   ',
        });
        expect(context.getProxyServerUrl()).toBe(DEFAULT_PROXY_SERVER_URL);
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            `Client-side proxyServerUrl provided but was empty or invalid ('   '). Using default: '${DEFAULT_PROXY_SERVER_URL}'.`
          )
        );
      });

      test('client env: should use default proxyServerUrl and log warning if invalid URL', () => {
        const invalidUrl = 'not-a-url';
        const context = new EnvironmentContext({
          logger,
          executionEnvironment: 'client',
          proxyServerUrl: invalidUrl,
        });
        expect(context.getProxyServerUrl()).toBe(DEFAULT_PROXY_SERVER_URL);
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining(
            `Provided proxyServerUrl '${invalidUrl}' for client environment is not a valid URL. Falling back to default: '${DEFAULT_PROXY_SERVER_URL}'.`
          )
        );
      });

      // Server Environment
      test('server env: should use provided valid proxyServerUrl and log debug', () => {
        const url = 'http://custom.proxy:1234';
        const context = new EnvironmentContext({
          logger,
          executionEnvironment: 'server',
          projectRootPath: '/root',
          proxyServerUrl: url,
        });
        expect(context.getProxyServerUrl()).toBe(url);
        expect(logger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            `proxyServerUrl ('${url}') was provided for non-client environment ('server'). It might not be used.`
          )
        );
      });

      test('server env: should use default proxyServerUrl and log debug if null', () => {
        const context = new EnvironmentContext({
          logger,
          executionEnvironment: 'server',
          projectRootPath: '/root',
          proxyServerUrl: null,
        });
        expect(context.getProxyServerUrl()).toBe(DEFAULT_PROXY_SERVER_URL);
        expect(logger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            `proxyServerUrl not provided for non-client environment ('server'). Defaulting to '${DEFAULT_PROXY_SERVER_URL}', though it might not be used.`
          )
        );
      });

      test('server env: should use default proxyServerUrl and log debug if invalid URL provided', () => {
        const invalidUrl = 'bad proxy';
        const context = new EnvironmentContext({
          logger,
          executionEnvironment: 'server',
          projectRootPath: '/root',
          proxyServerUrl: invalidUrl,
        });
        expect(context.getProxyServerUrl()).toBe(DEFAULT_PROXY_SERVER_URL);
        expect(logger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            `Provided proxyServerUrl '${invalidUrl}' for non-client environment is not a valid URL. Setting to default ('${DEFAULT_PROXY_SERVER_URL}'), but it might not be used.`
          )
        );
      });

      // Unknown Environment
      test('unknown env: should use provided valid proxyServerUrl and log debug', () => {
        const url = 'http://another.proxy:5678';
        const context = new EnvironmentContext({
          logger,
          executionEnvironment: 'unknown',
          proxyServerUrl: url,
        });
        expect(context.getProxyServerUrl()).toBe(url);
        expect(logger.debug).toHaveBeenCalledWith(
          expect.stringContaining(
            `proxyServerUrl ('${url}') was provided for non-client environment ('unknown'). It might not be used.`
          )
        );
      });
    });
  });

  describe('Getter Methods', () => {
    test('getExecutionEnvironment should return correct environment', () => {
      const clientContext = new EnvironmentContext({
        logger,
        executionEnvironment: 'client',
      });
      expect(clientContext.getExecutionEnvironment()).toBe('client');
      const serverContext = new EnvironmentContext({
        logger,
        executionEnvironment: 'server',
        projectRootPath: '/root',
      });
      expect(serverContext.getExecutionEnvironment()).toBe('server');
    });

    test('getProjectRootPath should return correct path for server, null otherwise', () => {
      const serverContext = new EnvironmentContext({
        logger,
        executionEnvironment: 'server',
        projectRootPath: '/path/to/root',
      });
      expect(serverContext.getProjectRootPath()).toBe('/path/to/root');

      const clientContext = new EnvironmentContext({
        logger,
        executionEnvironment: 'client',
        projectRootPath: '/path/to/root',
      });
      expect(clientContext.getProjectRootPath()).toBeNull(); // Ignored

      const unknownContext = new EnvironmentContext({
        logger,
        executionEnvironment: 'invalid',
        projectRootPath: '/path/to/root',
      });
      expect(unknownContext.getProjectRootPath()).toBeNull(); // Ignored
    });

    test('getProxyServerUrl should return correct URL', () => {
      const clientContext = new EnvironmentContext({
        logger,
        executionEnvironment: 'client',
        proxyServerUrl: 'http://client.proxy',
      });
      expect(clientContext.getProxyServerUrl()).toBe('http://client.proxy');

      const clientDefaultContext = new EnvironmentContext({
        logger,
        executionEnvironment: 'client',
      });
      expect(clientDefaultContext.getProxyServerUrl()).toBe(
        DEFAULT_PROXY_SERVER_URL
      );

      const serverContext = new EnvironmentContext({
        logger,
        executionEnvironment: 'server',
        projectRootPath: '/root',
        proxyServerUrl: 'http://server.proxy',
      });
      expect(serverContext.getProxyServerUrl()).toBe('http://server.proxy');

      const serverDefaultContext = new EnvironmentContext({
        logger,
        executionEnvironment: 'server',
        projectRootPath: '/root',
      });
      expect(serverDefaultContext.getProxyServerUrl()).toBe(
        DEFAULT_PROXY_SERVER_URL
      );
    });

    test('isClient should return true only for client environment', () => {
      const clientContext = new EnvironmentContext({
        logger,
        executionEnvironment: 'client',
      });
      expect(clientContext.isClient()).toBe(true);
      const serverContext = new EnvironmentContext({
        logger,
        executionEnvironment: 'server',
        projectRootPath: '/root',
      });
      expect(serverContext.isClient()).toBe(false);
      const unknownContext = new EnvironmentContext({
        logger,
        executionEnvironment: 'unknown',
      });
      expect(unknownContext.isClient()).toBe(false);
    });

    test('isServer should return true only for server environment', () => {
      const clientContext = new EnvironmentContext({
        logger,
        executionEnvironment: 'client',
      });
      expect(clientContext.isServer()).toBe(false);
      const serverContext = new EnvironmentContext({
        logger,
        executionEnvironment: 'server',
        projectRootPath: '/root',
      });
      expect(serverContext.isServer()).toBe(true);
      const unknownContext = new EnvironmentContext({
        logger,
        executionEnvironment: 'unknown',
      });
      expect(unknownContext.isServer()).toBe(false);
    });
  });
});

// --- FILE END ---
