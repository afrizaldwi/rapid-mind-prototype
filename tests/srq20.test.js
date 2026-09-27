import { describe, expect, it } from 'vitest';
import { SRQ20_PROTOCOL, getSrq20Protocol } from '../src/protocols/srq20Protocol.js';
import { validateSrq20Responses } from '../src/lib/srq20.js';

const completed = () => Object.fromEntries(SRQ20_PROTOCOL.items.map(({ id }) => [id, false]));

describe('SRQ-20 prototype protocol', () => {
  it('has exactly 20 ordered, unique stable IDs and unmistakable template labels', () => {
    expect(SRQ20_PROTOCOL.version).toBe('srq20-prototype-v1');
    const items = SRQ20_PROTOCOL.items;
    expect(items).toHaveLength(20);
    expect(items.map(({ id }) => id)).toEqual(Array.from({ length: 20 }, (_, index) =>
      `srq20.${String(index + 1).padStart(2, '0')}`));
    expect(new Set(items.map(({ id }) => id)).size).toBe(20);
    for (const item of items) {
      expect(item.type).toBe('boolean');
      expect(item.label).toMatch(/^\[Template\]/);
    }
    expect(getSrq20Protocol(SRQ20_PROTOCOL.version)).toBe(SRQ20_PROTOCOL);
    expect(getSrq20Protocol('srq20-prototype-v2')).toBeNull();
  });
});

describe('SRQ-20 response validation', () => {
  it('accepts partial drafts and explicit false, preserving only known answers', () => {
    const result = validateSrq20Responses({ 'srq20.01': false });
    expect(result.valid).toBe(true);
    expect(result.normalizedResponses).toEqual({ 'srq20.01': false });
  });

  it('requires all 20 items for completion, including false answers', () => {
    expect(validateSrq20Responses(completed(), { requireComplete: true }).valid).toBe(true);
    const missing = completed();
    delete missing['srq20.20'];
    expect(validateSrq20Responses(missing, { requireComplete: true }).valid).toBe(false);
    expect(validateSrq20Responses(missing).valid).toBe(true);
  });

  it.each([
    { 'srq20.21': true },
    { 'srq20.01': 'false' },
    { 'srq20.01': 0 },
    { 'srq20.01': null },
    JSON.parse('{"__proto__":true}'),
  ])('rejects unknown IDs and wrong answer types: %j', (responses) => {
    const result = validateSrq20Responses(responses);
    expect(result.valid).toBe(false);
    expect(Object.keys(result.normalizedResponses).every((id) => SRQ20_PROTOCOL.items.some((item) => item.id === id))).toBe(true);
  });

  it('rejects invalid containers and unsupported record versions', () => {
    for (const value of [null, [], 'text', 2]) {
      expect(validateSrq20Responses(value).valid).toBe(false);
    }
    expect(validateSrq20Responses(completed(), { protocolVersion: 'srq20-prototype-v2' }).valid).toBe(false);
  });
});
