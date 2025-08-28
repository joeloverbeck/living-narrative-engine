/**
 * @file Tests for LogMaintenanceScheduler status reporting undefined values
 * @description Reproduces and tests fixes for undefined status values in scheduler logs
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';

import LogMaintenanceScheduler from '../../../src/services/logMaintenanceScheduler.js';

const createMockLogger = () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
});

const createMockLogStorageService = () => ({
  rotateLogs: jest.fn().mockResolvedValue(2),
  cleanupOldLogs: jest.fn().mockResolvedValue(3),
});

describe('LogMaintenanceScheduler - Status Field Completeness', () => {
  let mockLogger;
  let mockLogStorageService;

  beforeEach(() => {
    mockLogger = createMockLogger();
    mockLogStorageService = createMockLogStorageService();
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any running schedulers
  });

  describe('Status field completeness verification', () => {
    it('should include nextRotationCheck and nextCleanup in status when not running', () => {
      const scheduler = new LogMaintenanceScheduler(
        mockLogger,
        mockLogStorageService,
        {
          enabled: true,
          rotationCheckSchedule: '0 * * * *',
          cleanupSchedule: '0 2 * * *',
        }
      );

      // Get the status before starting
      const status = scheduler.getStatus();

      // Status should include all required fields for server.js logging
      expect(status).toEqual({
        isRunning: false,
        isEnabled: true,
        rotationTaskActive: false,
        cleanupTaskActive: false,
        retryCounters: {},
        nextRotationCheck: 'Scheduled but not running',
        nextCleanup: 'Scheduled but not running',
        rotationSchedule: '0 * * * *',
        cleanupSchedule: '0 2 * * *',
      });

      // These fields are now provided with meaningful values
      expect(status.nextRotationCheck).toBe('Scheduled but not running');
      expect(status.nextCleanup).toBe('Scheduled but not running');
    });

    it('should include status fields when scheduler is started', async () => {
      const scheduler = new LogMaintenanceScheduler(
        mockLogger,
        mockLogStorageService,
        {
          enabled: true,
          rotationCheckSchedule: '0 * * * *', // Every hour
          cleanupSchedule: '0 2 * * *', // Daily at 2 AM
        }
      );

      // Start the scheduler
      await scheduler.start();

      try {
        // Get status after starting
        const status = scheduler.getStatus();

        // When running, status fields should be populated with schedule information
        expect(status.isRunning).toBe(true);
        expect(status.nextRotationCheck).toBe('Per schedule: 0 * * * *');
        expect(status.nextCleanup).toBe('Per schedule: 0 2 * * *');

        // The status object now provides all information server.js needs
      } finally {
        // Clean up
        await scheduler.stop();
      }
    });

    it('should demonstrate clear server.js logging with proper status fields', () => {
      const scheduler = new LogMaintenanceScheduler(
        mockLogger,
        mockLogStorageService,
        { enabled: true }
      );

      const status = scheduler.getStatus();

      // This simulates exactly what happens in server.js line 543
      const logMessage = `Log Maintenance Scheduler ENABLED - Next rotation check: ${status.nextRotationCheck}, Next cleanup: ${status.nextCleanup}`;
      
      // The resulting log message now contains meaningful information instead of "undefined"
      expect(logMessage).toContain('Next rotation check: Scheduled but not running');
      expect(logMessage).toContain('Next cleanup: Scheduled but not running');
      
      // This fixes the confusing logs we were seeing in error_logs.txt
    });
  });

  describe('Status reporting behavior', () => {
    it('should include complete scheduling information in status', async () => {
      // This test verifies that status includes all information needed for proper logging
      const scheduler = new LogMaintenanceScheduler(
        mockLogger,
        mockLogStorageService,
        {
          enabled: true,
          rotationCheckSchedule: '0 * * * *', // Every hour at minute 0
          cleanupSchedule: '0 2 * * *', // Daily at 2:00 AM
        }
      );

      await scheduler.start();

      try {
        const status = scheduler.getStatus();

        // The status now includes all required fields for proper logging
        expect(status).toEqual({
          isRunning: true,
          isEnabled: true,
          rotationTaskActive: true,
          cleanupTaskActive: true,
          retryCounters: {},
          nextRotationCheck: 'Per schedule: 0 * * * *',
          nextCleanup: 'Per schedule: 0 2 * * *',
          rotationSchedule: '0 * * * *',
          cleanupSchedule: '0 2 * * *',
        });

        // These fields now provide meaningful values
        expect(status.nextRotationCheck).toBe('Per schedule: 0 * * * *');
        expect(status.nextCleanup).toBe('Per schedule: 0 2 * * *');
      } finally {
        await scheduler.stop();
      }
    });

    it('should handle disabled scheduler status correctly', () => {
      const scheduler = new LogMaintenanceScheduler(
        mockLogger,
        mockLogStorageService,
        { enabled: false }
      );

      const status = scheduler.getStatus();

      expect(status).toEqual({
        isRunning: false,
        isEnabled: false,
        rotationTaskActive: false,
        cleanupTaskActive: false,
        retryCounters: {},
        nextRotationCheck: 'Not scheduled',
        nextCleanup: 'Not scheduled',
        rotationSchedule: '0 * * * *',
        cleanupSchedule: '0 2 * * *',
      });

      // When disabled, fields have clear "Not scheduled" values
      expect(status.nextRotationCheck).toBe('Not scheduled');
      expect(status.nextCleanup).toBe('Not scheduled');
    });
  });

  describe('Configuration edge cases', () => {
    it('should handle invalid cron expressions gracefully in status', () => {
      // Test that invalid cron expressions are rejected during construction
      expect(() => {
        new LogMaintenanceScheduler(
          mockLogger,
          mockLogStorageService,
          {
            enabled: true,
            rotationCheckSchedule: 'invalid-cron',
            cleanupSchedule: 'another-invalid-cron',
          }
        );
      }).toThrow('Invalid rotation check cron expression: invalid-cron');

      // This ensures configuration validation catches bad cron expressions early
    });

    it('should handle AppConfigService configuration source', () => {
      // Test with AppConfigService-like config object
      const mockAppConfig = {
        getDebugLoggingConfig: jest.fn(() => ({
          scheduler: {
            enabled: true,
            rotationCheckSchedule: '0 * * * *',
            cleanupSchedule: '0 2 * * *',
          },
        })),
        isDebugLoggingEnabled: jest.fn(() => true),
      };

      const scheduler = new LogMaintenanceScheduler(
        mockLogger,
        mockLogStorageService,
        mockAppConfig
      );

      const status = scheduler.getStatus();

      // Should work with AppConfigService and provide complete status
      expect(status.isEnabled).toBe(true);
      expect(mockAppConfig.getDebugLoggingConfig).toHaveBeenCalled();
      
      // Status now includes required fields
      expect(status.nextRotationCheck).toBe('Scheduled but not running');
      expect(status.nextCleanup).toBe('Scheduled but not running');
    });
  });
});