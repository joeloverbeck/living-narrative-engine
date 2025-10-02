/**
 * @file Integration tests for LLM ID validation with periods
 * @description Tests that LLM IDs containing periods (e.g., claude-sonnet-4.5)
 * are properly accepted by the validation middleware
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import {
  validateLlmRequest,
  validateRequestHeaders,
  handleValidationErrors,
} from '../../src/middleware/validation.js';

describe('LLM ID Validation - Period Support Integration Tests', () => {
  let app;

  beforeAll(() => {
    // Create minimal Express app for testing validation
    app = express();
    app.use(express.json());

    // Test endpoint with validation middleware
    app.post(
      '/api/llm-request',
      validateRequestHeaders(),
      validateLlmRequest(),
      handleValidationErrors,
      (req, res) => {
        // If validation passes, return success
        res.status(200).json({
          success: true,
          llmId: req.body.llmId,
          message: 'Validation passed',
        });
      }
    );
  });

  describe('Valid LLM IDs with Periods', () => {
    test('should accept claude-sonnet-4.5 (single period with decimal version)', async () => {
      const response = await request(app)
        .post('/api/llm-request')
        .set('Content-Type', 'application/json')
        .send({
          llmId: 'claude-sonnet-4.5',
          targetPayload: {
            model: 'anthropic/claude-sonnet-4.5',
            messages: [{ role: 'user', content: 'test' }],
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.llmId).toBe('claude-sonnet-4.5');
    });

    test('should accept deepseek-chat-v3.1-toolcalling (period in version number)', async () => {
      const response = await request(app)
        .post('/api/llm-request')
        .set('Content-Type', 'application/json')
        .send({
          llmId: 'deepseek-chat-v3.1-toolcalling',
          targetPayload: {
            model: 'deepseek/deepseek-chat-v3.1',
            messages: [{ role: 'user', content: 'test' }],
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.llmId).toBe('deepseek-chat-v3.1-toolcalling');
    });

    test('should accept gpt-3.5-turbo (multiple periods)', async () => {
      const response = await request(app)
        .post('/api/llm-request')
        .set('Content-Type', 'application/json')
        .send({
          llmId: 'gpt-3.5-turbo',
          targetPayload: {
            model: 'openai/gpt-3.5-turbo',
            messages: [{ role: 'user', content: 'test' }],
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.llmId).toBe('gpt-3.5-turbo');
    });

    test('should accept llmId with period at different positions', async () => {
      const testIds = [
        'model.v1',
        'provider.model-v1',
        'provider-model.1.2',
        'test_model.v2.0',
      ];

      for (const llmId of testIds) {
        const response = await request(app)
          .post('/api/llm-request')
          .set('Content-Type', 'application/json')
          .send({
            llmId,
            targetPayload: {
              model: 'test/model',
              messages: [{ role: 'user', content: 'test' }],
            },
          });

        expect(response.status).toBe(200);
        expect(response.body.llmId).toBe(llmId);
      }
    });
  });

  describe('Edge Cases with Periods', () => {
    test('should accept llmId with consecutive periods', async () => {
      const response = await request(app)
        .post('/api/llm-request')
        .set('Content-Type', 'application/json')
        .send({
          llmId: 'model..v1',
          targetPayload: {
            model: 'test/model',
            messages: [{ role: 'user', content: 'test' }],
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.llmId).toBe('model..v1');
    });

    test('should accept llmId starting with period', async () => {
      const response = await request(app)
        .post('/api/llm-request')
        .set('Content-Type', 'application/json')
        .send({
          llmId: '.model-v1',
          targetPayload: {
            model: 'test/model',
            messages: [{ role: 'user', content: 'test' }],
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.llmId).toBe('.model-v1');
    });

    test('should accept llmId ending with period', async () => {
      const response = await request(app)
        .post('/api/llm-request')
        .set('Content-Type', 'application/json')
        .send({
          llmId: 'model-v1.',
          targetPayload: {
            model: 'test/model',
            messages: [{ role: 'user', content: 'test' }],
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.llmId).toBe('model-v1.');
    });
  });

  describe('Combined Valid Characters', () => {
    test('should accept llmId with all allowed characters including periods', async () => {
      const response = await request(app)
        .post('/api/llm-request')
        .set('Content-Type', 'application/json')
        .send({
          llmId: 'Provider_Model-v1.2.3',
          targetPayload: {
            model: 'test/model',
            messages: [{ role: 'user', content: 'test' }],
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.llmId).toBe('Provider_Model-v1.2.3');
    });

    test('should accept semantic version pattern in llmId', async () => {
      const response = await request(app)
        .post('/api/llm-request')
        .set('Content-Type', 'application/json')
        .send({
          llmId: 'claude-3.5-sonnet-20240620',
          targetPayload: {
            model: 'anthropic/claude-3.5-sonnet-20240620',
            messages: [{ role: 'user', content: 'test' }],
          },
        });

      expect(response.status).toBe(200);
      expect(response.body.llmId).toBe('claude-3.5-sonnet-20240620');
    });
  });

  describe('Invalid Characters Still Rejected', () => {
    test('should reject llmId with spaces', async () => {
      const response = await request(app)
        .post('/api/llm-request')
        .set('Content-Type', 'application/json')
        .send({
          llmId: 'model v1',
          targetPayload: {
            model: 'test/model',
            messages: [{ role: 'user', content: 'test' }],
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
    });

    test('should reject llmId with special characters (slashes)', async () => {
      const response = await request(app)
        .post('/api/llm-request')
        .set('Content-Type', 'application/json')
        .send({
          llmId: 'provider/model',
          targetPayload: {
            model: 'provider/model',
            messages: [{ role: 'user', content: 'test' }],
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
    });

    test('should reject llmId with special characters (colons)', async () => {
      const response = await request(app)
        .post('/api/llm-request')
        .set('Content-Type', 'application/json')
        .send({
          llmId: 'provider:model',
          targetPayload: {
            model: 'provider/model',
            messages: [{ role: 'user', content: 'test' }],
          },
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe(true);
    });
  });

  describe('Real-World Configuration IDs', () => {
    test('should accept all LLM IDs from actual llm-configs.json', async () => {
      const realConfigIds = [
        'claude-sonnet-4.5',
        'deepseek-chat-v3.1-toolcalling',
        'claude-3.5-sonnet-20240620',
        'gpt-4o-2024-11-20',
        'gpt-4o-mini-2024-07-18',
      ];

      for (const llmId of realConfigIds) {
        const response = await request(app)
          .post('/api/llm-request')
          .set('Content-Type', 'application/json')
          .send({
            llmId,
            targetPayload: {
              model: 'test/model',
              messages: [{ role: 'user', content: 'test' }],
            },
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.llmId).toBe(llmId);
      }
    });
  });
});
