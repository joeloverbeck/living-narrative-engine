#!/usr/bin/env node

/**
 * @file Backward-compatible wrapper for the modern recipe validation CLI.
 */

import { runValidation } from './validate-recipe-v2.js';

await runValidation(process.argv);
