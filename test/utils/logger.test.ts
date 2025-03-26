import { describe, it, expect } from 'vitest';
import { Printer } from '../../src/utils/logger';
import * as PrinterModule from '@sp-packages/printer';

describe('Logger Module', () => {
  it('should re-export Printer from @sp-packages/printer', () => {
    expect(Printer).toBe(PrinterModule.Printer);
  });
});
