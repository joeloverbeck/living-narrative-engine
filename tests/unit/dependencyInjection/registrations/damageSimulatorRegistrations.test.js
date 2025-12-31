import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { registerDamageSimulatorComponents } from '../../../../src/dependencyInjection/registrations/damageSimulatorRegistrations.js';

describe('damageSimulatorRegistrations', () => {
  describe('registerDamageSimulatorComponents', () => {
    let mockContainer;
    let mockLogger;

    beforeEach(() => {
      mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      };

      mockContainer = {
        resolve: jest.fn().mockReturnValue(mockLogger),
        register: jest.fn(),
      };
    });

    it('should call registerDamageSimulatorComponents without throwing', () => {
      expect(() =>
        registerDamageSimulatorComponents(mockContainer)
      ).not.toThrow();
    });

    it('should resolve ILogger from container', () => {
      registerDamageSimulatorComponents(mockContainer);

      expect(mockContainer.resolve).toHaveBeenCalledWith('ILogger');
    });

    it('should log registration progress messages', () => {
      registerDamageSimulatorComponents(mockContainer);

      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[DamageSimulator] Starting component registrations...'
      );
      expect(mockLogger.debug).toHaveBeenCalledWith(
        '[DamageSimulator] Component registrations complete.'
      );
    });

    it('should log messages in correct order', () => {
      const callOrder = [];
      mockLogger.debug.mockImplementation((msg) => {
        callOrder.push(msg);
      });

      registerDamageSimulatorComponents(mockContainer);

      expect(callOrder).toEqual([
        '[DamageSimulator] Starting component registrations...',
        '[DamageSimulator] Component registrations complete.',
      ]);
    });
  });
});
