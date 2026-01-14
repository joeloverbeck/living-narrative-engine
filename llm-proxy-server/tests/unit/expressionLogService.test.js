import { describe, expect, it, jest } from '@jest/globals';
import { ConsoleLogger } from '../../src/consoleLogger.js';
import { ExpressionLogService } from '../../src/services/expressionLogService.js';

describe('ExpressionLogService', () => {
  it('rejects log directories that escape the project root', () => {
    const logger = new ConsoleLogger();
    jest.spyOn(logger, 'debug').mockImplementation(() => {});

    expect(() => {
      new ExpressionLogService(logger, '../', '../escape');
    }).toThrow('ExpressionLogService: log directory must be within project root');
  });
});
