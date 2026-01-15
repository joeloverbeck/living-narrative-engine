/**
 * @file Tests for ExpressionStatusController
 * @description Verifies HTTP request handling for expression diagnostic status operations
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ExpressionStatusController } from '../../../src/handlers/expressionStatusController.js';

/**
 * All valid diagnostic status values that should be accepted.
 * Must match STATUS_KEYS from src/expressionDiagnostics/statusTheme.js
 */
const ALL_VALID_STATUSES = [
  'unknown',
  'impossible',
  'unobserved',
  'extremely_rare',
  'rare',
  'uncommon',
  'normal',
  'frequent',
];

describe('ExpressionStatusController', () => {
  /** @type {ExpressionStatusController} */
  let controller;
  let mockLogger;
  let mockExpressionFileService;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    mockExpressionFileService = {
      updateExpressionStatus: jest.fn().mockResolvedValue({
        success: true,
        message: 'Status updated',
        expressionId: 'test:expression',
      }),
      updateExpressionTriggerRate: jest.fn().mockResolvedValue({
        success: true,
        message: 'Trigger rate updated',
        expressionId: 'test:expression',
      }),
      scanAllExpressionStatuses: jest.fn().mockResolvedValue([]),
    };

    controller = new ExpressionStatusController(mockLogger, mockExpressionFileService);
  });

  describe('constructor', () => {
    it('should throw error when logger is not provided', () => {
      expect(() => new ExpressionStatusController(null, mockExpressionFileService)).toThrow(
        'ExpressionStatusController: logger is required'
      );
    });

    it('should throw error when expressionFileService is not provided', () => {
      expect(() => new ExpressionStatusController(mockLogger, null)).toThrow(
        'ExpressionStatusController: expressionFileService is required'
      );
    });

    it('should create instance successfully with valid dependencies', () => {
      const ctrl = new ExpressionStatusController(mockLogger, mockExpressionFileService);
      expect(ctrl).toBeInstanceOf(ExpressionStatusController);
      expect(mockLogger.debug).toHaveBeenCalledWith('ExpressionStatusController: Instance created');
    });
  });

  describe('handleUpdateStatus - status validation', () => {
    /**
     * Creates mock Express request/response objects.
     * @param {string} filePath - The file path in the request body
     * @param {string} status - The status in the request body
     * @returns {{ req: object, res: object }} Mock request and response
     */
    const createMockReqRes = (filePath, status) => {
      const req = { body: { filePath, status } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      return { req, res };
    };

    describe('should accept all valid statuses', () => {
      it.each(ALL_VALID_STATUSES)(
        'should accept status: %s',
        async (status) => {
          const { req, res } = createMockReqRes(
            'data/mods/emotions-test/expressions/test.expression.json',
            status
          );

          await controller.handleUpdateStatus(req, res);

          expect(res.status).toHaveBeenCalledWith(200);
          expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
              success: true,
            })
          );
          expect(mockExpressionFileService.updateExpressionStatus).toHaveBeenCalledWith(
            'data/mods/emotions-test/expressions/test.expression.json',
            status
          );
        }
      );
    });

    describe('should specifically accept uncommon and unobserved statuses', () => {
      it('should accept uncommon status without validation error', async () => {
        const { req, res } = createMockReqRes(
          'data/mods/emotions-curiosity/expressions/test.expression.json',
          'uncommon'
        );

        await controller.handleUpdateStatus(req, res);

        expect(res.status).not.toHaveBeenCalledWith(400);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(mockExpressionFileService.updateExpressionStatus).toHaveBeenCalledWith(
          expect.any(String),
          'uncommon'
        );
      });

      it('should accept unobserved status without validation error', async () => {
        const { req, res } = createMockReqRes(
          'data/mods/emotions-attention/expressions/test.expression.json',
          'unobserved'
        );

        await controller.handleUpdateStatus(req, res);

        expect(res.status).not.toHaveBeenCalledWith(400);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(mockExpressionFileService.updateExpressionStatus).toHaveBeenCalledWith(
          expect.any(String),
          'unobserved'
        );
      });
    });

    describe('should reject invalid statuses', () => {
      it.each(['invalid', 'not-a-status', 'RARE', 'Unknown', 'super_rare'])(
        'should reject invalid status: %s',
        async (invalidStatus) => {
          const { req, res } = createMockReqRes(
            'data/mods/emotions-test/expressions/test.expression.json',
            invalidStatus
          );

          await controller.handleUpdateStatus(req, res);

          expect(res.status).toHaveBeenCalledWith(400);
          expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
              error: true,
              message: expect.stringContaining('Invalid status'),
            })
          );
          expect(mockExpressionFileService.updateExpressionStatus).not.toHaveBeenCalled();
        }
      );
    });

    describe('should validate filePath field', () => {
      it('should reject missing filePath', async () => {
        const { req, res } = createMockReqRes(null, 'normal');

        await controller.handleUpdateStatus(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: true,
            message: 'Missing required field: filePath',
          })
        );
      });

      it('should reject non-expression file path', async () => {
        const { req, res } = createMockReqRes('data/mods/test/file.json', 'normal');

        await controller.handleUpdateStatus(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: true,
            message: 'Field filePath must end with .expression.json',
          })
        );
      });
    });

    describe('should validate status field', () => {
      it('should reject missing status', async () => {
        const { req, res } = createMockReqRes(
          'data/mods/emotions-test/expressions/test.expression.json',
          null
        );

        await controller.handleUpdateStatus(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: true,
            message: 'Missing required field: status',
          })
        );
      });

      it('should reject non-string status', async () => {
        const req = {
          body: {
            filePath: 'data/mods/emotions-test/expressions/test.expression.json',
            status: 123,
          },
        };
        const res = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn().mockReturnThis(),
        };

        await controller.handleUpdateStatus(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            error: true,
            message: 'Field status must be a string',
          })
        );
      });
    });
  });

  describe('handleUpdateStatus - service integration', () => {
    it('should handle service failure gracefully', async () => {
      mockExpressionFileService.updateExpressionStatus.mockResolvedValue({
        success: false,
        message: 'File not found',
      });

      const req = {
        body: {
          filePath: 'data/mods/emotions-test/expressions/test.expression.json',
          status: 'normal',
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await controller.handleUpdateStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: true,
          message: 'File not found',
        })
      );
    });

    it('should handle service exception gracefully', async () => {
      mockExpressionFileService.updateExpressionStatus.mockRejectedValue(
        new Error('Unexpected error')
      );

      const req = {
        body: {
          filePath: 'data/mods/emotions-test/expressions/test.expression.json',
          status: 'normal',
        },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await controller.handleUpdateStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: true,
          message: 'Failed to update expression status',
          details: 'Unexpected error',
        })
      );
    });
  });

  describe('handleUpdateStatus - triggerRate handling', () => {
    /**
     * Creates mock Express request/response objects with triggerRate.
     * @param {string} filePath - The file path in the request body
     * @param {string} status - The status in the request body
     * @param {number|undefined} triggerRate - Optional trigger rate
     * @returns {{ req: object, res: object }} Mock request and response
     */
    const createMockReqResWithRate = (filePath, status, triggerRate) => {
      const req = { body: { filePath, status, triggerRate } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };
      return { req, res };
    };

    it('should update trigger rate when provided', async () => {
      const { req, res } = createMockReqResWithRate(
        'data/mods/emotions-test/expressions/test.expression.json',
        'normal',
        0.125
      );

      await controller.handleUpdateStatus(req, res);

      expect(mockExpressionFileService.updateExpressionStatus).toHaveBeenCalled();
      expect(mockExpressionFileService.updateExpressionTriggerRate).toHaveBeenCalledWith(
        'data/mods/emotions-test/expressions/test.expression.json',
        0.125
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Status and trigger rate updated successfully',
        })
      );
    });

    it('should not call updateExpressionTriggerRate when triggerRate is not provided', async () => {
      const { req, res } = createMockReqResWithRate(
        'data/mods/emotions-test/expressions/test.expression.json',
        'normal',
        undefined
      );

      await controller.handleUpdateStatus(req, res);

      expect(mockExpressionFileService.updateExpressionStatus).toHaveBeenCalled();
      expect(mockExpressionFileService.updateExpressionTriggerRate).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should reject non-number triggerRate', async () => {
      const { req, res } = createMockReqResWithRate(
        'data/mods/emotions-test/expressions/test.expression.json',
        'normal',
        'not-a-number'
      );

      await controller.handleUpdateStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: true,
          message: 'Field triggerRate must be a number',
        })
      );
      expect(mockExpressionFileService.updateExpressionStatus).not.toHaveBeenCalled();
    });

    it('should reject triggerRate below 0', async () => {
      const { req, res } = createMockReqResWithRate(
        'data/mods/emotions-test/expressions/test.expression.json',
        'normal',
        -0.1
      );

      await controller.handleUpdateStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: true,
          message: 'Field triggerRate must be between 0.0 and 1.0',
        })
      );
    });

    it('should reject triggerRate above 1.0', async () => {
      const { req, res } = createMockReqResWithRate(
        'data/mods/emotions-test/expressions/test.expression.json',
        'normal',
        1.5
      );

      await controller.handleUpdateStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: true,
          message: 'Field triggerRate must be between 0.0 and 1.0',
        })
      );
    });

    it('should return partial success when status succeeds but triggerRate fails', async () => {
      mockExpressionFileService.updateExpressionTriggerRate.mockResolvedValue({
        success: false,
        message: 'Failed to update trigger rate',
      });

      const { req, res } = createMockReqResWithRate(
        'data/mods/emotions-test/expressions/test.expression.json',
        'normal',
        0.5
      );

      await controller.handleUpdateStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          triggerRateError: 'Failed to update trigger rate',
        })
      );
    });

    it('should accept boundary triggerRate values 0.0 and 1.0', async () => {
      // Test 0.0
      let { req, res } = createMockReqResWithRate(
        'data/mods/emotions-test/expressions/test.expression.json',
        'normal',
        0.0
      );

      await controller.handleUpdateStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockExpressionFileService.updateExpressionTriggerRate).toHaveBeenCalledWith(
        expect.any(String),
        0.0
      );

      // Reset mocks
      jest.clearAllMocks();

      // Test 1.0
      ({ req, res } = createMockReqResWithRate(
        'data/mods/emotions-test/expressions/test.expression.json',
        'normal',
        1.0
      ));

      await controller.handleUpdateStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockExpressionFileService.updateExpressionTriggerRate).toHaveBeenCalledWith(
        expect.any(String),
        1.0
      );
    });

    it('should accept very small triggerRate values', async () => {
      const { req, res } = createMockReqResWithRate(
        'data/mods/emotions-test/expressions/test.expression.json',
        'extremely_rare',
        0.00001
      );

      await controller.handleUpdateStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockExpressionFileService.updateExpressionTriggerRate).toHaveBeenCalledWith(
        expect.any(String),
        0.00001
      );
    });

    it('should accept null triggerRate (treated as not provided)', async () => {
      const { req, res } = createMockReqResWithRate(
        'data/mods/emotions-test/expressions/test.expression.json',
        'normal',
        null
      );

      await controller.handleUpdateStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockExpressionFileService.updateExpressionTriggerRate).not.toHaveBeenCalled();
    });
  });

  describe('handleScanStatuses', () => {
    it('should return expressions from service', async () => {
      const mockExpressions = [
        { id: 'test:expr1', filePath: 'path/to/expr1.json', diagnosticStatus: 'normal', triggerRate: 0.15 },
        { id: 'test:expr2', filePath: 'path/to/expr2.json', diagnosticStatus: 'rare', triggerRate: null },
      ];
      mockExpressionFileService.scanAllExpressionStatuses.mockResolvedValue(mockExpressions);

      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await controller.handleScanStatuses(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        expressions: mockExpressions,
      });
    });

    it('should handle scan failure gracefully', async () => {
      mockExpressionFileService.scanAllExpressionStatuses.mockRejectedValue(
        new Error('Scan failed')
      );

      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
      };

      await controller.handleScanStatuses(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: true,
          message: 'Failed to scan expression statuses',
        })
      );
    });
  });
});
