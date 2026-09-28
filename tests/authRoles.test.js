import { describe, expect, it } from 'vitest';
import { getHomeRouteForRole } from '../src/lib/authRoles.js';

describe('role home routes', () => {
  it('maps every supported profile role to its own route', () => {
    expect(getHomeRouteForRole('relawan')).toBe('/relawan');
    expect(getHomeRouteForRole('nakes')).toBe('/faskes');
    expect(getHomeRouteForRole('admin')).toBe('/admin');
  });

  it('does not route unsupported profiles to another role', () => {
    expect(getHomeRouteForRole('unknown')).toBeNull();
    expect(getHomeRouteForRole(undefined)).toBeNull();
  });
});
