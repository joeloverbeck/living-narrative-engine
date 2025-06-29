import { describe, it, expect, jest } from '@jest/globals';
import { EventDispatchService } from '../../../src/utils/eventDispatchService.js';
import { createMockLogger } from '../../common/mockFactories/loggerMocks.js';
import * as loggerUtils from '../../../src/utils/loggerUtils.js';

jest.mock('../../../src/utils/loggerUtils.js');
const service = new EventDispatchService();

describe('dispatchWithLogging', () => {
  it('logs debug message on successful dispatch without identifier', async () => {
    const dispatcher = { dispatch: jest.fn().mockResolvedValue(undefined) };
    const logger = createMockLogger();
    loggerUtils.ensureValidLogger.mockReturnValue(logger);

    await service.dispatchWithLogging(dispatcher, 'evt', { foo: 1 }, logger);

    expect(loggerUtils.ensureValidLogger).toHaveBeenCalledWith(
      logger,
      'dispatchWithLogging'
    );
    expect(dispatcher.dispatch).toHaveBeenCalledWith('evt', { foo: 1 }, {});
    expect(logger.debug).toHaveBeenCalledWith("Dispatched 'evt'.");
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs error message on failed dispatch with identifier and options', async () => {
    const error = new Error('boom');
    const dispatcher = { dispatch: jest.fn().mockRejectedValue(error) };
    const logger = createMockLogger();
    loggerUtils.ensureValidLogger.mockReturnValue(logger);
    const options = { opt: true };

    await service.dispatchWithLogging(
      dispatcher,
      'evt',
      { bar: 2 },
      logger,
      'ID',
      options
    );

    expect(dispatcher.dispatch).toHaveBeenCalledWith(
      'evt',
      { bar: 2 },
      options
    );
    expect(logger.debug).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      "Failed dispatching 'evt' event for ID.",
      error
    );
  });
});
