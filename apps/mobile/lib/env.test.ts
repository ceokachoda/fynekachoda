import { describe, it, expect } from '@jest/globals';
import { required } from './env';

describe('env loader required()', () => {
  it('returns the value when defined', () => {
    expect(required('FOO', 'bar')).toBe('bar');
  });

  it('throws on undefined', () => {
    expect(() => required('FOO', undefined)).toThrow(/Missing env: FOO/);
  });

  it('throws on empty string', () => {
    expect(() => required('FOO', '')).toThrow(/Missing env: FOO/);
  });
});
