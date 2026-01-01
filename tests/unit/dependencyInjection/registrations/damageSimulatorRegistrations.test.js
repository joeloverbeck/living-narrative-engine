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

      // Verify start and complete messages are present and in correct order
      const startIndex = callOrder.indexOf(
        '[DamageSimulator] Starting component registrations...'
      );
      const completeIndex = callOrder.indexOf(
        '[DamageSimulator] Component registrations complete.'
      );
      expect(startIndex).toBe(0);
      expect(completeIndex).toBe(callOrder.length - 1);
      expect(startIndex).toBeLessThan(completeIndex);
    });
  });
});
