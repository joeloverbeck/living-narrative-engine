/**
 * @file Unit tests for LogMaintenanceScheduler service
 * @description Tests for automated log rotation and cleanup scheduling functionality
 * @see logMaintenanceScheduler.js
 */

import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from '@jest/globals';
import cron from 'node-cron';
import LogMaintenanceScheduler from '../../../src/services/logMaintenanceScheduler.js';
import { ConsoleLogger } from '../../../src/consoleLogger.js';

// Mock the cron module
jest.mock('node-cron');

/**
 * Mock LogStorageService for testing
 */
class MockLogStorageService {
  /**
   *
   */
  constructor() {
    this.rotateLargeFiles = jest.fn().mockResolvedValue(0);
    this.cleanupOldLogs = jest.fn().mockResolvedValue(0);
  }

  /**
   *
   */
  reset() {
    this.rotateLargeFiles.mockClear();
    this.cleanupOldLogs.mockClear();
    this.rotateLargeFiles.mockResolvedValue(0);
    this.cleanupOldLogs.mockResolvedValue(0);
  }
}

/**
 * Mock AppConfigService for testing
 */
class MockAppConfigService {
  /**
   *
   * @param debugConfig
   */
  constructor(debugConfig = {}) {
    this.debugConfig = {
      scheduler: {
        enabled: true,
        rotationCheckSchedule: '0 * * * *',
        cleanupSchedule: '0 2 * * *',
        enableRetry: true,
        maxRetries: 3,
        retryDelayMs: 5000, // Match production default of 5 seconds
        ...debugConfig.scheduler,
      },
      ...debugConfig,
    };
  }

  /**
   *
   */
  getDebugLoggingConfig() {
    return this.debugConfig;
  }

  /**
   *
   */
  isDebugLoggingEnabled() {
    return true;
  }

  /**
   *
   * @param config
   */
  setDebugConfig(config) {
    this.debugConfig = { ...this.debugConfig, ...config };
  }
}

/**
 * Mock ScheduledTask for testing
 */
class MockScheduledTask {
  /**
   *
   */
  constructor() {
    this.start = jest.fn();
    this.stop = jest.fn();
    this.running = false;
    this.nextDate = jest.fn().mockReturnValue(new Date());
  }

  /**
   *
   * @param running
   */
  setRunning(running) {
    this.running = running;
  }

  /**
   *
   */
  reset() {
    this.start.mockClear();
    this.stop.mockClear();
    this.nextDate.mockClear();
    this.running = false;
    this.nextDate.mockReturnValue(new Date());
  }
}

describe('LogMaintenanceScheduler - Service Initialization', () => {
  let logger;
  let logStorageService;
  let mockRotationTask;
  let mockCleanupTask;

  beforeEach(() => {
    logger = new ConsoleLogger();
    logger.debug = jest.fn();
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();

    logStorageService = new MockLogStorageService();
    mockRotationTask = new MockScheduledTask();
    mockCleanupTask = new MockScheduledTask();

    // Mock cron module
    cron.validate = jest.fn().mockReturnValue(true);
    cron.schedule = jest
      .fn()
      .mockReturnValueOnce(mockRotationTask)
      .mockReturnValueOnce(mockCleanupTask);
  });

  afterEach(() => {
    jest.clearAllMocks();
    logStorageService.reset();
    mockRotationTask.reset();
    mockCleanupTask.reset();
  });

  it('should initialize with AppConfigService', () => {
    const appConfigService = new MockAppConfigService();

    const scheduler = new LogMaintenanceScheduler(
      logger,
      logStorageService,
      appConfigService
    );

    expect(scheduler).toBeInstanceOf(LogMaintenanceScheduler);
    expect(logger.debug).toHaveBeenCalledWith(
      'LogMaintenanceScheduler: Initialized with AppConfigService',
      expect.objectContaining({
        config: expect.objectContaining({
          enabled: true,
          rotationCheckSchedule: '0 * * * *',
          cleanupSchedule: '0 2 * * *',
        }),
      })
    );
  });

  it('should initialize with legacy config object', () => {
    const config = {
      enabled: false,
      rotationCheckSchedule: '0 2 * * *',
      cleanupSchedule: '0 3 * * *',
      maxRetries: 5,
    };

    const scheduler = new LogMaintenanceScheduler(
      logger,
      logStorageService,
      config
    );

    expect(scheduler).toBeInstanceOf(LogMaintenanceScheduler);
    expect(logger.debug).toHaveBeenCalledWith(
      'LogMaintenanceScheduler: Initialized with config object',
      expect.objectContaining({
        config: expect.objectContaining({
          enabled: false,
          rotationCheckSchedule: '0 2 * * *',
          cleanupSchedule: '0 3 * * *',
          maxRetries: 5,
        }),
      })
    );
  });

  it('should validate cron expressions during initialization', () => {
    const appConfigService = new MockAppConfigService();

    new LogMaintenanceScheduler(logger, logStorageService, appConfigService);

    expect(cron.validate).toHaveBeenCalledWith('0 * * * *');
    expect(cron.validate).toHaveBeenCalledWith('0 2 * * *');
    expect(logger.debug).toHaveBeenCalledWith(
      'LogMaintenanceScheduler: Cron expressions validated successfully'
    );
  });

  it('should throw error for invalid cron expressions', () => {
    cron.validate = jest.fn().mockReturnValue(false);
    const appConfigService = new MockAppConfigService();

    expect(() => {
      new LogMaintenanceScheduler(logger, logStorageService, appConfigService);
    }).toThrow('Invalid rotation check cron expression: 0 * * * *');
  });

  it('should throw error if LogStorageService is not provided', () => {
    expect(() => {
      new LogMaintenanceScheduler(logger, null);
    }).toThrow('LogStorageService is required');
  });
});

describe('LogMaintenanceScheduler - Scheduler Control', () => {
  let logger;
  let logStorageService;
  let appConfigService;
  let scheduler;
  let mockRotationTask;
  let mockCleanupTask;

  beforeEach(() => {
    logger = new ConsoleLogger();
    logger.debug = jest.fn();
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();

    logStorageService = new MockLogStorageService();
    appConfigService = new MockAppConfigService();
    mockRotationTask = new MockScheduledTask();
    mockCleanupTask = new MockScheduledTask();

    cron.validate = jest.fn().mockReturnValue(true);
    cron.schedule = jest
      .fn()
      .mockReturnValueOnce(mockRotationTask)
      .mockReturnValueOnce(mockCleanupTask);

    scheduler = new LogMaintenanceScheduler(
      logger,
      logStorageService,
      appConfigService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    logStorageService.reset();
    mockRotationTask.reset();
    mockCleanupTask.reset();
  });

  describe('start()', () => {
    it('should start scheduler successfully', async () => {
      await scheduler.start();

      expect(logger.info).toHaveBeenCalledWith(
        'LogMaintenanceScheduler.start: Starting maintenance scheduler'
      );
      expect(cron.schedule).toHaveBeenCalledTimes(2);
      expect(mockRotationTask.start).toHaveBeenCalled();
      expect(mockCleanupTask.start).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'LogMaintenanceScheduler.start: Maintenance scheduler started successfully',
        expect.objectContaining({
          rotationSchedule: '0 * * * *',
          cleanupSchedule: '0 2 * * *',
        })
      );
    });

    it('should not start if scheduler is disabled', async () => {
      appConfigService.setDebugConfig({
        scheduler: { enabled: false },
      });
      const disabledScheduler = new LogMaintenanceScheduler(
        logger,
        logStorageService,
        appConfigService
      );

      await disabledScheduler.start();

      expect(logger.info).toHaveBeenCalledWith(
        'LogMaintenanceScheduler.start: Scheduler is disabled'
      );
      expect(cron.schedule).not.toHaveBeenCalled();
    });

    it('should not start if already running', async () => {
      await scheduler.start();
      jest.clearAllMocks();

      await scheduler.start();

      expect(logger.warn).toHaveBeenCalledWith(
        'LogMaintenanceScheduler.start: Scheduler already running'
      );
      expect(cron.schedule).not.toHaveBeenCalled();
    });

    it('should handle startup errors', async () => {
      const error = new Error('Cron scheduling failed');
      cron.schedule = jest.fn().mockImplementation(() => {
        throw error;
      });

      await expect(scheduler.start()).rejects.toThrow('Cron scheduling failed');
      expect(logger.error).toHaveBeenCalledWith(
        'LogMaintenanceScheduler.start: Failed to start scheduler',
        expect.objectContaining({
          error: 'Cron scheduling failed',
        })
      );
    });
  });

  describe('stop()', () => {
    it('should stop scheduler successfully', async () => {
      await scheduler.start();
      mockRotationTask.setRunning(true);
      mockCleanupTask.setRunning(true);

      await scheduler.stop();

      expect(logger.info).toHaveBeenCalledWith(
        'LogMaintenanceScheduler.stop: Stopping maintenance scheduler'
      );
      expect(mockRotationTask.stop).toHaveBeenCalled();
      expect(mockCleanupTask.stop).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'LogMaintenanceScheduler.stop: Maintenance scheduler stopped successfully'
      );
    });

    it('should handle stop when not running', async () => {
      await scheduler.stop();

      expect(logger.debug).toHaveBeenCalledWith(
        'LogMaintenanceScheduler.stop: Scheduler not running'
      );
    });

    it('should handle errors during stop', async () => {
      await scheduler.start();
      const error = new Error('Stop failed');
      mockRotationTask.stop = jest.fn().mockImplementation(() => {
        throw error;
      });

      await scheduler.stop();

      expect(logger.error).toHaveBeenCalledWith(
        'LogMaintenanceScheduler.stop: Error stopping scheduler',
        expect.objectContaining({
          error: 'Stop failed',
        })
      );
    });
  });

  describe('getStatus()', () => {
    it('should return correct status when not started', () => {
      const status = scheduler.getStatus();

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
    });

    it('should return correct status when running', async () => {
      await scheduler.start();
      mockRotationTask.setRunning(true);
      mockCleanupTask.setRunning(true);

      const status = scheduler.getStatus();

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
    });

    it('should return correct status when scheduler is disabled', () => {
      appConfigService.setDebugConfig({
        scheduler: { enabled: false },
      });
      const disabledScheduler = new LogMaintenanceScheduler(
        logger,
        logStorageService,
        appConfigService
      );

      const status = disabledScheduler.getStatus();

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
    });
  });
});

describe('LogMaintenanceScheduler - Maintenance Operations', () => {
  let logger;
  let logStorageService;
  let appConfigService;
  let scheduler;
  let rotationCallback;
  let cleanupCallback;

  beforeEach(() => {
    jest.useFakeTimers();
    
    logger = new ConsoleLogger();
    logger.debug = jest.fn();
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();

    logStorageService = new MockLogStorageService();
    appConfigService = new MockAppConfigService();

    // Capture callbacks for manual execution
    cron.validate = jest.fn().mockReturnValue(true);
    cron.schedule = jest.fn().mockImplementation((schedule, callback) => {
      if (schedule === '0 * * * *') {
        rotationCallback = callback;
      } else if (schedule === '0 2 * * *') {
        cleanupCallback = callback;
      }
      return {
        start: jest.fn(),
        stop: jest.fn(),
        running: false,
        nextDate: jest.fn().mockReturnValue(new Date()),
      };
    });

    scheduler = new LogMaintenanceScheduler(
      logger,
      logStorageService,
      appConfigService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
    logStorageService.reset();
  });

  describe('rotation operations', () => {
    it('should execute rotation check successfully', async () => {
      logStorageService.rotateLargeFiles.mockResolvedValue(3);
      await scheduler.start();

      await rotationCallback();

      expect(logStorageService.rotateLargeFiles).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        'LogMaintenanceScheduler: Starting scheduled rotation check'
      );
      expect(logger.info).toHaveBeenCalledWith(
        'LogMaintenanceScheduler: Scheduled rotation check completed',
        { rotatedFiles: 3 }
      );
    });

    it('should handle rotation failures', async () => {
      const error = new Error('Rotation failed');
      logStorageService.rotateLargeFiles.mockRejectedValue(error);
      await scheduler.start();

      await rotationCallback();

      expect(logger.error).toHaveBeenCalledWith(
        'LogMaintenanceScheduler: Scheduled rotation check failed',
        expect.objectContaining({
          error: 'Rotation failed',
        })
      );
    });

    it('should retry rotation on failure when retry enabled', async () => {
      const error = new Error('Rotation failed');
      logStorageService.rotateLargeFiles
        .mockRejectedValueOnce(error)
        .mockResolvedValue(1);

      await scheduler.start();

      // Execute initial rotation (should fail)
      await rotationCallback();

      expect(logger.warn).toHaveBeenCalledWith(
        'LogMaintenanceScheduler: Scheduling retry for rotation operation',
        expect.objectContaining({
          error: 'Rotation failed',
          retryAttempt: 1,
          maxRetries: 3,
        })
      );

      // Advance timers to trigger the retry
      jest.advanceTimersByTime(5000);
      
      // Allow promises to resolve
      await Promise.resolve();
      
      expect(logStorageService.rotateLargeFiles).toHaveBeenCalledTimes(2);
    });
  });

  describe('cleanup operations', () => {
    it('should execute cleanup successfully', async () => {
      logStorageService.cleanupOldLogs.mockResolvedValue(5);
      await scheduler.start();

      await cleanupCallback();

      expect(logStorageService.cleanupOldLogs).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        'LogMaintenanceScheduler: Starting scheduled cleanup'
      );
      expect(logger.info).toHaveBeenCalledWith(
        'LogMaintenanceScheduler: Scheduled cleanup completed',
        { cleanedDirectories: 5 }
      );
    });

    it('should handle cleanup failures', async () => {
      const error = new Error('Cleanup failed');
      logStorageService.cleanupOldLogs.mockRejectedValue(error);
      await scheduler.start();

      await cleanupCallback();

      expect(logger.error).toHaveBeenCalledWith(
        'LogMaintenanceScheduler: Scheduled cleanup failed',
        expect.objectContaining({
          error: 'Cleanup failed',
        })
      );
    });

    it('should respect maximum retry limit', async () => {
      const error = new Error('Cleanup failed');
      logStorageService.cleanupOldLogs.mockRejectedValue(error);
      appConfigService.setDebugConfig({
        scheduler: { maxRetries: 1 },
      });

      const retryScheduler = new LogMaintenanceScheduler(
        logger,
        logStorageService,
        appConfigService
      );
      await retryScheduler.start();

      // Capture new cleanup callback
      const retryCleanupCallback = cron.schedule.mock.calls.find(
        ([schedule]) => schedule === '0 2 * * *'
      )[1];

      // Execute cleanup twice (initial + 1 retry)
      await retryCleanupCallback();
      
      // Advance timers to trigger retry
      jest.advanceTimersByTime(5000);
      await Promise.resolve();

      // Execute again - should hit max retries
      await retryCleanupCallback();

      expect(logger.error).toHaveBeenCalledWith(
        'LogMaintenanceScheduler: Maximum retries exceeded for cleanup operation',
        expect.objectContaining({
          error: 'Cleanup failed',
          retries: 1,
          maxRetries: 1,
        })
      );
    });
  });

  describe('retry configuration', () => {
    it('should not retry when retry is disabled', async () => {
      const error = new Error('Operation failed');
      logStorageService.rotateLargeFiles.mockRejectedValue(error);
      appConfigService.setDebugConfig({
        scheduler: { enableRetry: false },
      });

      const noRetryScheduler = new LogMaintenanceScheduler(
        logger,
        logStorageService,
        appConfigService
      );
      await noRetryScheduler.start();

      // Capture rotation callback for no-retry scheduler
      const noRetryRotationCallback = cron.schedule.mock.calls.find(
        ([schedule]) => schedule === '0 * * * *'
      )[1];

      await noRetryRotationCallback();

      expect(logger.warn).toHaveBeenCalledWith(
        'LogMaintenanceScheduler: Retry disabled for failed rotation operation',
        { error: 'Operation failed' }
      );
    });

    it('should use custom retry delay', async () => {
      const customDelay = 2000;
      appConfigService.setDebugConfig({
        scheduler: { retryDelayMs: customDelay },
      });

      const customScheduler = new LogMaintenanceScheduler(
        logger,
        logStorageService,
        appConfigService
      );
      await customScheduler.start();

      const error = new Error('Custom delay test');
      logStorageService.rotateLargeFiles.mockRejectedValue(error);

      // Capture custom rotation callback
      const customRotationCallback = cron.schedule.mock.calls.find(
        ([schedule]) => schedule === '0 * * * *'
      )[1];

      await customRotationCallback();

      expect(logger.warn).toHaveBeenCalledWith(
        'LogMaintenanceScheduler: Scheduling retry for rotation operation',
        expect.objectContaining({
          delayMs: customDelay,
        })
      );
    });
  });
});

describe('LogMaintenanceScheduler - Configuration Edge Cases', () => {
  let logger;
  let logStorageService;

  beforeEach(() => {
    logger = new ConsoleLogger();
    logger.debug = jest.fn();
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();

    logStorageService = new MockLogStorageService();
    cron.validate = jest.fn().mockReturnValue(true);
    cron.schedule = jest.fn().mockReturnValue({
      start: jest.fn(),
      stop: jest.fn(),
      running: false,
      nextDate: jest.fn().mockReturnValue(new Date()),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    logStorageService.reset();
  });

  it('should handle custom cron schedules', () => {
    const customConfig = {
      scheduler: {
        rotationCheckSchedule: '*/30 * * * *', // Every 30 minutes
        cleanupSchedule: '0 0 * * 0', // Weekly on Sunday at midnight
      },
    };
    const appConfigService = new MockAppConfigService(customConfig);

    const scheduler = new LogMaintenanceScheduler(
      logger,
      logStorageService,
      appConfigService
    );

    expect(cron.validate).toHaveBeenCalledWith('*/30 * * * *');
    expect(cron.validate).toHaveBeenCalledWith('0 0 * * 0');
    expect(scheduler).toBeInstanceOf(LogMaintenanceScheduler);
  });

  it('should handle missing scheduler configuration gracefully', () => {
    const appConfigService = new MockAppConfigService({
      // No scheduler config provided
    });

    const scheduler = new LogMaintenanceScheduler(
      logger,
      logStorageService,
      appConfigService
    );

    const status = scheduler.getStatus();
    expect(status.isEnabled).toBe(true); // Should default to enabled
  });

  it('should handle partial scheduler configuration', () => {
    const partialConfig = {
      scheduler: {
        enabled: true,
        rotationCheckSchedule: '0 */2 * * *', // Every 2 hours
        // Missing cleanupSchedule - should use default
      },
    };
    const appConfigService = new MockAppConfigService(partialConfig);

    const scheduler = new LogMaintenanceScheduler(
      logger,
      logStorageService,
      appConfigService
    );

    expect(logger.debug).toHaveBeenCalledWith(
      'LogMaintenanceScheduler: Initialized with AppConfigService',
      expect.objectContaining({
        config: expect.objectContaining({
          rotationCheckSchedule: '0 */2 * * *',
          cleanupSchedule: '0 2 * * *', // Should use default
        }),
      })
    );
  });
});
