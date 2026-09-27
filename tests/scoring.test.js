import { describe, expect, it } from 'vitest';
import { SRQ20_PROTOCOL } from '../src/protocols/srq20Protocol.js';
import { analyzeChecklist, analyzeSrq20, analyzeTranscript } from '../src/lib/scoring.js';

const responsesWith = (positives) => Object.fromEntries(SRQ20_PROTOCOL.items.map(({ id }, index) =>
  [id, index < positives]));

describe('SRQ-20 base scoring', () => {
  it.each([
    [0, 'T3'], [5, 'T3'], [6, 'T2'], [10, 'T2'], [11, 'T1'], [20, 'T1'],
  ])('scores %i positive answers as %s', (score, baseTier) => {
    expect(analyzeSrq20(responsesWith(score))).toEqual({ score, baseTier });
  });

  it('rejects incomplete, unknown, wrong-type, and unsupported-version responses', () => {
    const complete = responsesWith(8);
    const missing = { ...complete };
    delete missing['srq20.20'];
    for (const responses of [missing, { ...complete, 'srq20.21': false },
      { ...complete, 'srq20.01': 'true' }, null]) {
      expect(() => analyzeSrq20(responses)).toThrow();
    }
    expect(() => analyzeSrq20(complete, { protocolVersion: 'srq20-prototype-v2' })).toThrow();
  });
});

describe('legacy scoring regression', () => {
  it('keeps red/yellow/green transcript and checklist outputs', () => {
    expect(analyzeTranscript('tidak ada kata pemicu')).toMatchObject({ zona: 'hijau', score: 0 });
    expect(analyzeChecklist({})).toMatchObject({ zona: 'hijau', score: 0 });
    expect(analyzeChecklist({ q3: true })).toMatchObject({ zona: 'merah', score: 3 });
    expect(analyzeChecklist({ q4: true, q5: true })).toMatchObject({ zona: 'kuning', score: 2 });
  });
});
