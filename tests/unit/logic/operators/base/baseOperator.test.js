/**
 * @file Unit tests for BaseOperator abstract class
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { BaseOperator } from '../../../../../src/logic/operators/base/baseOperator.js';

describe('BaseOperator', () => {
  let mockEntityManager;
  let mockLogger;

  beforeEach(() => {
    mockEntityManager = {
      getEntity: jest.fn(),
      getComponentData: jest.fn(),
    };
    mockLogger = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };
  });

  describe('Abstract Enforcement', () => {
    it('cannot be instantiated directly', () => {
      expect(() => {
        new BaseOperator({ entityManager: mockEntityManager, logger: mockLogger }, 'test_operator');
      }).toThrow('BaseOperator is abstract and cannot be instantiated directly');
    });

    it('can be extended by subclass', () => {
      class ConcreteOperator extends BaseOperator {
        constructor(deps) {
          super(deps, 'concrete_operator');
        }
        evaluateInternal() {
          return true;
        }
      }

      const operator = new ConcreteOperator({ entityManager: mockEntityManager, logger: mockLogger });
      expect(operator).toBeInstanceOf(BaseOperator);
      expect(operator).toBeInstanceOf(ConcreteOperator);
    });
  });

  describe('Constructor Validation', () => {
    class ConcreteOperator extends BaseOperator {
      constructor(deps) {
        super(deps, 'concrete_operator');
      }
      evaluateInternal() {
        return true;
      }
    }

    it('throws when entityManager is missing', () => {
      expect(() => {
        new ConcreteOperator({ logger: mockLogger });
      }).toThrow('BaseOperator: Missing required dependencies');
    });

    it('throws when logger is missing', () => {
      expect(() => {
        new ConcreteOperator({ entityManager: mockEntityManager });
      }).toThrow('BaseOperator: Missing required dependencies');
    });

    it('throws when both dependencies are missing', () => {
      expect(() => {
        new ConcreteOperator({});
      }).toThrow('BaseOperator: Missing required dependencies');
    });

    it('assigns dependencies to protected fields', () => {
      const operator = new ConcreteOperator({ entityManager: mockEntityManager, logger: mockLogger });
      expect(operator.entityManager).toBe(mockEntityManager);
      expect(operator.logger).toBe(mockLogger);
      expect(operator.operatorName).toBe('concrete_operator');
    });
  });

  describe('evaluate()', () => {
    class SuccessOperator extends BaseOperator {
      constructor(deps) {
        super(deps, 'success_operator');
      }
      evaluateInternal(params, context) {
        return { params, context, success: true };
      }
    }

    class ErrorOperator extends BaseOperator {
      constructor(deps) {
        super(deps, 'error_operator');
      }
      evaluateInternal() {
        throw new Error('Intentional test error');
      }
    }

    it('calls evaluateInternal with params and context', () => {
      const operator = new SuccessOperator({ entityManager: mockEntityManager, logger: mockLogger });
      const params = { testParam: 'value' };
      const context = { testContext: 'data' };

      const result = operator.evaluate(params, context);

      expect(result).toEqual({ params, context, success: true });
    });

    it('catches errors and returns getDefaultOnError()', () => {
      const operator = new ErrorOperator({ entityManager: mockEntityManager, logger: mockLogger });

      const result = operator.evaluate({}, {});

      expect(result).toBe(false);
    });

    it('logs errors when they occur', () => {
      const operator = new ErrorOperator({ entityManager: mockEntityManager, logger: mockLogger });

      operator.evaluate({}, {});

      expect(mockLogger.error).toHaveBeenCalledWith(
        'error_operator: Evaluation error',
        expect.any(Error)
      );
    });

    it('logs errors with correct operator name', () => {
      class NamedErrorOperator extends BaseOperator {
        constructor(deps) {
          super(deps, 'my_custom_operator');
        }
        evaluateInternal() {
          throw new Error('Test');
        }
      }

      const operator = new NamedErrorOperator({ entityManager: mockEntityManager, logger: mockLogger });
      operator.evaluate({}, {});

      expect(mockLogger.error).toHaveBeenCalledWith(
        'my_custom_operator: Evaluation error',
        expect.any(Error)
      );
    });
  });

  describe('evaluateInternal()', () => {
    it('throws when not implemented by subclass', () => {
      class IncompleteOperator extends BaseOperator {
        constructor(deps) {
          super(deps, 'incomplete_operator');
        }
        // evaluateInternal not overridden
      }

      const operator = new IncompleteOperator({ entityManager: mockEntityManager, logger: mockLogger });

      // Call evaluate() which will call evaluateInternal() and catch the error
      const result = operator.evaluate({}, {});

      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalledWith(
        'incomplete_operator: Evaluation error',
        expect.objectContaining({
          message: 'evaluateInternal must be implemented by subclass'
        })
      );
    });
  });

  describe('getDefaultOnError()', () => {
    it('returns false by default', () => {
      class DefaultOperator extends BaseOperator {
        constructor(deps) {
          super(deps, 'default_operator');
        }
        evaluateInternal() {
          throw new Error('Test');
        }
      }

      const operator = new DefaultOperator({ entityManager: mockEntityManager, logger: mockLogger });
      const result = operator.evaluate({}, {});

      expect(result).toBe(false);
    });

    it('can be overridden to return different value', () => {
      class NumericOperator extends BaseOperator {
        constructor(deps) {
          super(deps, 'numeric_operator');
        }
        evaluateInternal() {
          throw new Error('Test');
        }
        getDefaultOnError() {
          return 0;
        }
      }

      const operator = new NumericOperator({ entityManager: mockEntityManager, logger: mockLogger });
      const result = operator.evaluate({}, {});

      expect(result).toBe(0);
    });

    it('can be overridden to return null', () => {
      class NullOperator extends BaseOperator {
        constructor(deps) {
          super(deps, 'null_operator');
        }
        evaluateInternal() {
          throw new Error('Test');
        }
        getDefaultOnError() {
          return null;
        }
      }

      const operator = new NullOperator({ entityManager: mockEntityManager, logger: mockLogger });
      const result = operator.evaluate({}, {});

      expect(result).toBeNull();
    });

    it('can be overridden to return empty array', () => {
      class ArrayOperator extends BaseOperator {
        constructor(deps) {
          super(deps, 'array_operator');
        }
        evaluateInternal() {
          throw new Error('Test');
        }
        getDefaultOnError() {
          return [];
        }
      }

      const operator = new ArrayOperator({ entityManager: mockEntityManager, logger: mockLogger });
      const result = operator.evaluate({}, {});

      expect(result).toEqual([]);
    });
  });

  describe('Protected Field Access', () => {
    it('allows subclass to access entityManager', () => {
      class AccessTestOperator extends BaseOperator {
        constructor(deps) {
          super(deps, 'access_test');
        }
        evaluateInternal() {
          return this.entityManager.getEntity('test');
        }
      }

      mockEntityManager.getEntity.mockReturnValue({ id: 'test' });
      const operator = new AccessTestOperator({ entityManager: mockEntityManager, logger: mockLogger });

      const result = operator.evaluate({}, {});

      expect(mockEntityManager.getEntity).toHaveBeenCalledWith('test');
      expect(result).toEqual({ id: 'test' });
    });

    it('allows subclass to access logger', () => {
      class LogTestOperator extends BaseOperator {
        constructor(deps) {
          super(deps, 'log_test');
        }
        evaluateInternal() {
          this.logger.debug('Test message');
          return true;
        }
      }

      const operator = new LogTestOperator({ entityManager: mockEntityManager, logger: mockLogger });
      operator.evaluate({}, {});

      expect(mockLogger.debug).toHaveBeenCalledWith('Test message');
    });

    it('allows subclass to access operatorName', () => {
      class NameTestOperator extends BaseOperator {
        constructor(deps) {
          super(deps, 'name_test_operator');
        }
        evaluateInternal() {
          return this.operatorName;
        }
      }

      const operator = new NameTestOperator({ entityManager: mockEntityManager, logger: mockLogger });
      const result = operator.evaluate({}, {});

      expect(result).toBe('name_test_operator');
    });
  });
});
