import { describe, expect, it } from 'vitest';
import { RISK_FUNCTION_PROTOCOL, getRiskFunctionProtocol } from '../src/protocols/riskFunctionProtocol.js';
import { validateRiskFunctionResponses } from '../src/lib/riskFunction.js';
import { calculateFinalTier, CLASSIFICATION_VERSION } from '../src/lib/classification.js';

const complete = () => ({
  riskFactors: Object.fromEntries(RISK_FUNCTION_PROTOCOL.sections[0].items.map(({ id }) => [id, false])),
  functionalImpairment: Object.fromEntries(RISK_FUNCTION_PROTOCOL.sections[1].items.map(({ id }) => [id, false])),
});

describe('Risk/Function prototype protocol and responses', () => {
  it('has two sections, four unique template boolean items each, and a supported version', () => {
    expect(RISK_FUNCTION_PROTOCOL.version).toBe('risk-function-prototype-v1');
    expect(RISK_FUNCTION_PROTOCOL.sections.map(({ id }) => id)).toEqual(['risk', 'function']);
    const items = RISK_FUNCTION_PROTOCOL.sections.flatMap(({ items: sectionItems }) => sectionItems);
    expect(items.map(({ id }) => id)).toEqual([
      'risk.01', 'risk.02', 'risk.03', 'risk.04',
      'function.01', 'function.02', 'function.03', 'function.04',
    ]);
    expect(new Set(items.map(({ id }) => id)).size).toBe(8);
    for (const item of items) {
      expect(item.type).toBe('boolean');
      expect(item.label).toMatch(/^\[Template\]/);
    }
    expect(getRiskFunctionProtocol(RISK_FUNCTION_PROTOCOL.version)).toBe(RISK_FUNCTION_PROTOCOL);
    expect(getRiskFunctionProtocol('risk-function-prototype-v2')).toBeNull();
  });

  it('accepts separate partial responses and explicit false', () => {
    const result = validateRiskFunctionResponses({
      riskFactors: { 'risk.01': false }, functionalImpairment: { 'function.02': true },
    });
    expect(result.valid).toBe(true);
    expect(result.normalizedRiskFactors).toEqual({ 'risk.01': false });
    expect(result.normalizedFunctionalImpairment).toEqual({ 'function.02': true });
  });

  it('requires all eight answers only when completion is requested', () => {
    expect(validateRiskFunctionResponses(complete(), { requireComplete: true }).valid).toBe(true);
    const incomplete = complete();
    delete incomplete.functionalImpairment['function.04'];
    expect(validateRiskFunctionResponses(incomplete).valid).toBe(true);
    expect(validateRiskFunctionResponses(incomplete, { requireComplete: true }).valid).toBe(false);
  });

  it.each([
    { riskFactors: { 'risk.05': true } },
    { riskFactors: { 'risk.01': 'false' } },
    { functionalImpairment: { 'function.01': 0 } },
    { functionalImpairment: { 'function.01': null } },
    { riskFactors: [] },
  ])('rejects malformed sections: %j', (change) => {
    expect(validateRiskFunctionResponses({ ...complete(), ...change }).valid).toBe(false);
  });

  it('rejects unsupported versions', () => {
    expect(validateRiskFunctionResponses(complete(), { protocolVersion: 'risk-function-prototype-v2' }).valid).toBe(false);
  });
});

describe('prototype final classification', () => {
  it.each(['T1', 'T2', 'T3'])('accepts %s but has no Screen 6 adjustment rule', (baseTier) => {
    const responses = complete();
    responses.riskFactors['risk.01'] = true;
    responses.functionalImpairment['function.04'] = true;
    expect(calculateFinalTier({ baseTier, ...responses })).toEqual({
      classificationVersion: CLASSIFICATION_VERSION,
      baseTier,
      finalTier: baseTier,
      adjustmentRuleDefined: false,
      adjustmentsApplied: [],
    });
    expect(calculateFinalTier({ baseTier, ...complete() }).finalTier).toBe(baseTier);
  });

  it('rejects invalid tiers, incomplete or malformed responses, and unsupported versions', () => {
    expect(() => calculateFinalTier({ baseTier: 'T0', ...complete() })).toThrow();
    expect(() => calculateFinalTier({ baseTier: undefined, ...complete() })).toThrow();
    expect(() => calculateFinalTier({ baseTier: 'T2', riskFactors: {}, functionalImpairment: {} })).toThrow();
    expect(() => calculateFinalTier({ baseTier: 'T2', ...complete(), classificationVersion: 'classification-prototype-v2' })).toThrow();
    expect(() => calculateFinalTier({ baseTier: 'T2', ...complete(), riskFunctionProtocolVersion: 'risk-function-prototype-v2' })).toThrow();
  });
});
