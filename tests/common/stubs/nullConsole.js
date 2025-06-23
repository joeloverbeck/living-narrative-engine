/**
 * @file A stub implementation of the console API that does nothing.
 * @description Useful for quieting logs during tests while still providing a valid logger instance.
 */

import { Console } from 'node:console';
import { Writable } from 'node:stream';

// A writable stream that discards all data.
const nullStream = new Writable({
  write(chunk, encoding, callback) {
    callback();
  },
});

/**
 * A logger class that implements the standard console interface but produces no output.
 * It inherits from the real Node.js Console class to ensure it has all the same methods,
 * but it's instantiated with a stream that goes nowhere.
 */
export class NullConsole extends Console {
  constructor() {
    super(nullStream, nullStream);
  }

  // You can override specific methods here if you need to add custom
  // test-related logic, like counting calls, but for simply silencing
  // output, the base implementation is sufficient.
}
