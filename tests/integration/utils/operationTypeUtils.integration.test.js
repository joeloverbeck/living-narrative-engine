import { describe, it, expect } from '@jest/globals';
import OperationRegistry from '../../../src/logic/operationRegistry.js';
import OperationInterpreter from '../../../src/logic/operationInterpreter.js';

/**
 * Simple ILogger implementation that records structured log entries.
 */
class RecordingLogger {
  constructor(label = 'RecordingLogger') {
    this.label = label;
    this.records = {
      info: [],
      warn: [],
      error: [],
      debug: [],
    };
  }

  /**
   * @param {'info' | 'warn' | 'error' | 'debug'} level
   * @param {string} message
   * @param {...any} args
   * @returns {void}
   */
  _record(level, message, ...args) {
    this.records[level].push({ message, args });
  }

  info(message, ...args) {
    this._record('info', message, ...args);
  }

  warn(message, ...args) {
    this._record('warn', message, ...args);
  }

  error(message, ...args) {
    this._record('error', message, ...args);
  }

  debug(message, ...args) {
    this._record('debug', message, ...args);
  }
}

describe('operationTypeUtils integration', () => {
  it('trims whitespace across registry and interpreter interactions', async () => {
    const registryLogger = new RecordingLogger('registry');
    const interpreterLogger = new RecordingLogger('interpreter');

    const registry = new OperationRegistry({ logger: registryLogger });
    const interpreter = new OperationInterpreter({
      logger: interpreterLogger,
      operationRegistry: registry,
    });

    const executed = [];
    registry.register('  spaced-type  ', async (params, context) => {
      executed.push({ params, context });
    });

    await interpreter.execute(
      { type: '   spaced-type   ' },
      { evaluationContext: {} }
    );

    expect(executed).toHaveLength(1);
    expect(
      registryLogger.records.debug.some(({ message }) =>
        message.includes('Registered handler for operation type "spaced-type".')
      )
    ).toBe(true);
    expect(
      interpreterLogger.records.debug.some(({ message }) =>
        message.includes('operation type "spaced-type"')
      )
    ).toBe(true);
  });

  it('logs and rejects non-string operation types during registration', () => {
    const logger = new RecordingLogger('registry');
    const registry = new OperationRegistry({ logger });

    expect(() => registry.register(42, () => {})).toThrow(
      'OperationRegistry.register: operationType must be a non-empty string.'
    );

    expect(
      logger.records.error.some(
        ({ message, args }) =>
          message.includes(
            'OperationRegistry.register: operationType must be a non-empty string.'
          ) && args.length === 0
      )
    ).toBe(true);

    // Ensure no handler was accidentally registered after the failed attempt.
    expect(registry.getHandler('42')).toBeUndefined();
  });

  it('prevents execution when operation type normalizes to an empty string', async () => {
    const registry = new OperationRegistry({
      logger: new RecordingLogger('registry'),
    });
    const interpreterLogger = new RecordingLogger('interpreter');
    const interpreter = new OperationInterpreter({
      logger: interpreterLogger,
      operationRegistry: registry,
    });

    await interpreter.execute({ type: '   ' }, { evaluationContext: {} });

    expect(
      interpreterLogger.records.error[0].message.includes(
        'OperationInterpreter.execute: operationType must be a non-empty string.'
      )
    ).toBe(true);
    expect(
      interpreterLogger.records.error[1].message.includes(
        'OperationInterpreter received invalid operation object (missing type).'
      )
    ).toBe(true);
    expect(interpreterLogger.records.error[1].args[0]).toMatchObject({
      operation: { type: '   ' },
    });
  });
});
