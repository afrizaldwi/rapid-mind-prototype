const homeRoutes = {
  relawan: '/relawan',
  nakes: '/faskes',
  admin: '/admin',
};

export function getHomeRouteForRole(role) {
  return Object.hasOwn(homeRoutes, role) ? homeRoutes[role] : null;
}
