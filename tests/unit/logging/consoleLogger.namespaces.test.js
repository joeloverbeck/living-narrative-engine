import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import ConsoleLogger, { LogLevel } from '../../../src/logging/consoleLogger.js';

describe('ConsoleLogger - Debug Namespace Functionality', () => {
  let logger;
  let consoleDebugSpy;

  beforeEach(() => {
    // Spy on console.debug
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleDebugSpy.mockRestore();
  });

  describe('namespace parameter support', () => {
    beforeEach(() => {
      logger = new ConsoleLogger(LogLevel.DEBUG);
      // Clear spy after construction (initialization message)
      consoleDebugSpy.mockClear();
    });

    it('should log debug messages without namespace (backward compatibility)', () => {
      logger.debug('test message');
      expect(consoleDebugSpy).toHaveBeenCalledWith('test message');
    });

    it('should log debug messages without namespace with additional args', () => {
      const data = { foo: 'bar' };
      logger.debug('test message', data);
      expect(consoleDebugSpy).toHaveBeenCalledWith('test message', data);
    });

    it('should NOT log debug messages with namespace when namespace not enabled', () => {
      logger.debug('test message', 'engine:init');
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should log debug messages with namespace when namespace is enabled', () => {
      logger.enableDebugNamespace('engine:init');
      logger.debug('test message', 'engine:init');
      expect(consoleDebugSpy).toHaveBeenCalledWith('test message');
    });

    it('should log debug messages with namespace and additional args', () => {
      logger.enableDebugNamespace('engine:init');
      const data = { foo: 'bar' };
      logger.debug('test message', 'engine:init', data);
      expect(consoleDebugSpy).toHaveBeenCalledWith('test message', data);
    });

    it('should NOT log when log level is above DEBUG', () => {
      logger.setLogLevel(LogLevel.INFO);
      logger.debug('test message');
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });
  });

  describe('namespace management', () => {
    beforeEach(() => {
      logger = new ConsoleLogger(LogLevel.DEBUG);
      consoleDebugSpy.mockClear();
    });

    it('should enable a debug namespace', () => {
      logger.enableDebugNamespace('engine:init');
      expect(logger.getEnabledNamespaces()).toContain('engine:init');
    });

    it('should enable multiple namespaces', () => {
      logger.enableDebugNamespace('engine:init');
      logger.enableDebugNamespace('ai:memory');
      const namespaces = logger.getEnabledNamespaces();
      expect(namespaces).toContain('engine:init');
      expect(namespaces).toContain('ai:memory');
      expect(namespaces).toHaveLength(2);
    });

    it('should disable a debug namespace', () => {
      logger.enableDebugNamespace('engine:init');
      logger.disableDebugNamespace('engine:init');
      expect(logger.getEnabledNamespaces()).not.toContain('engine:init');
    });

    it('should clear all namespaces', () => {
      logger.enableDebugNamespace('engine:init');
      logger.enableDebugNamespace('ai:memory');
      logger.clearDebugNamespaces();
      expect(logger.getEnabledNamespaces()).toHaveLength(0);
    });

    it('should trim whitespace from namespace names', () => {
      logger.enableDebugNamespace('  engine:init  ');
      expect(logger.getEnabledNamespaces()).toContain('engine:init');
    });

    it('should ignore empty namespace strings', () => {
      logger.enableDebugNamespace('');
      logger.enableDebugNamespace('   ');
      expect(logger.getEnabledNamespaces()).toHaveLength(0);
    });
  });

  describe('global debug mode', () => {
    beforeEach(() => {
      logger = new ConsoleLogger(LogLevel.DEBUG);
      consoleDebugSpy.mockClear();
    });

    it('should log all debug messages when global debug is enabled', () => {
      logger.setGlobalDebug(true);
      logger.debug('message 1', 'engine:init');
      logger.debug('message 2', 'ai:memory');
      logger.debug('message 3', 'unknown:namespace');

      expect(consoleDebugSpy).toHaveBeenCalledTimes(3);
      expect(consoleDebugSpy).toHaveBeenCalledWith('message 1');
      expect(consoleDebugSpy).toHaveBeenCalledWith('message 2');
      expect(consoleDebugSpy).toHaveBeenCalledWith('message 3');
    });

    it('should return global debug status', () => {
      expect(logger.isGlobalDebugEnabled()).toBe(false);
      logger.setGlobalDebug(true);
      expect(logger.isGlobalDebugEnabled()).toBe(true);
    });

    it('should disable global debug mode', () => {
      logger.setGlobalDebug(true);
      logger.setGlobalDebug(false);
      expect(logger.isGlobalDebugEnabled()).toBe(false);

      logger.debug('test', 'engine:init');
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });
  });

  describe('constructor options', () => {
    it('should initialize with enabled namespaces from options', () => {
      const namespaces = new Set(['engine:init', 'ai:memory']);
      logger = new ConsoleLogger(LogLevel.DEBUG, {
        enabledNamespaces: namespaces,
      });

      const enabled = logger.getEnabledNamespaces();
      expect(enabled).toContain('engine:init');
      expect(enabled).toContain('ai:memory');
    });

    it('should initialize with global debug from options', () => {
      logger = new ConsoleLogger(LogLevel.DEBUG, { globalDebug: true });
      expect(logger.isGlobalDebugEnabled()).toBe(true);
    });

    it('should handle invalid enabledNamespaces option', () => {
      logger = new ConsoleLogger(LogLevel.DEBUG, {
        enabledNamespaces: 'invalid',
      });
      expect(logger.getEnabledNamespaces()).toHaveLength(0);
    });

    it('should handle invalid globalDebug option', () => {
      logger = new ConsoleLogger(LogLevel.DEBUG, { globalDebug: 'invalid' });
      expect(logger.isGlobalDebugEnabled()).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    beforeEach(() => {
      logger = new ConsoleLogger(LogLevel.DEBUG);
      consoleDebugSpy.mockClear();
    });

    it('should respect both namespace enablement and log level', () => {
      logger.enableDebugNamespace('engine:init');
      logger.setLogLevel(LogLevel.INFO);

      logger.debug('test', 'engine:init');
      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    it('should handle mixed namespace and non-namespace debug calls', () => {
      logger.enableDebugNamespace('engine:init');

      logger.debug('no namespace');
      logger.debug('with enabled namespace', 'engine:init');
      logger.debug('with disabled namespace', 'ai:memory');

      expect(consoleDebugSpy).toHaveBeenCalledTimes(2);
      expect(consoleDebugSpy).toHaveBeenCalledWith('no namespace');
      expect(consoleDebugSpy).toHaveBeenCalledWith('with enabled namespace');
    });

    it('should handle namespace priority: global > specific', () => {
      logger.setGlobalDebug(true);
      // Even without enabling specific namespace, it should log
      logger.debug('test', 'engine:init');
      expect(consoleDebugSpy).toHaveBeenCalledWith('test');
    });
  });
});
