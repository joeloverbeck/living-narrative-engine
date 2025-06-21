const { withValidatedDeps } = require('../../../src/utils/withValidatedDeps.js');

describe('withValidatedDeps', () => {
  it('throws on missing dependency', () => {
    // Base class
    class BaseClass {
      constructor(args) {
        this.args = args;
      }
    }

    // Dependency spec function that returns an iterable of dependency specs
    const specFn = (args) => [
      {
        dependency: args.requiredDep,
        name: 'requiredDep',
      },
    ];

    // Create decorated class
    const DecoratedClass = withValidatedDeps(BaseClass, specFn);

    // Mock logger
    const mockLogger = {
      error: jest.fn(),
    };

    // Should throw when requiredDep is missing
    expect(() => {
      new DecoratedClass({
        logger: mockLogger,
        // missing requiredDep
      });
    }).toThrow();

    // Should not throw when requiredDep is present
    expect(() => {
      new DecoratedClass({
        logger: mockLogger,
        requiredDep: 'some value',
      });
    }).not.toThrow();
  });
}); 