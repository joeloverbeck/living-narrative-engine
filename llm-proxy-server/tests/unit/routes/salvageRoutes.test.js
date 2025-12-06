import { createSalvageRoutes } from '../../../src/routes/salvageRoutes.js';

const findRoute = (router, path) =>
  router.stack.find((layer) => layer.route && layer.route.path === path);

describe('createSalvageRoutes', () => {
  let salvageController;

  beforeEach(() => {
    salvageController = {
      handleSalvageByRequestId: jest.fn(),
      handleSalvageStats: jest.fn(),
    };
  });

  it('registers GET handlers for salvage retrieval and stats', () => {
    const router = createSalvageRoutes(salvageController);

    const salvageRoute = findRoute(router, '/salvage/:requestId');
    const statsRoute = findRoute(router, '/salvage-stats');

    expect(salvageRoute).toBeDefined();
    expect(statsRoute).toBeDefined();

    expect(salvageRoute.route.methods.get).toBe(true);
    expect(statsRoute.route.methods.get).toBe(true);

    expect(salvageController.handleSalvageByRequestId).not.toHaveBeenCalled();
    expect(salvageController.handleSalvageStats).not.toHaveBeenCalled();
  });

  it('delegates salvage retrieval to the controller with request and response objects', () => {
    const router = createSalvageRoutes(salvageController);
    const salvageRoute = findRoute(router, '/salvage/:requestId');
    const handler = salvageRoute.route.stack[0].handle;

    const req = { params: { requestId: 'abc123' } };
    const res = { json: jest.fn() };

    handler(req, res);

    expect(salvageController.handleSalvageByRequestId).toHaveBeenCalledTimes(1);
    expect(salvageController.handleSalvageByRequestId).toHaveBeenCalledWith(
      req,
      res
    );
  });

  it('delegates salvage stats retrieval to the controller with request and response objects', () => {
    const router = createSalvageRoutes(salvageController);
    const statsRoute = findRoute(router, '/salvage-stats');
    const handler = statsRoute.route.stack[0].handle;

    const req = { query: {} };
    const res = { status: jest.fn() };

    handler(req, res);

    expect(salvageController.handleSalvageStats).toHaveBeenCalledTimes(1);
    expect(salvageController.handleSalvageStats).toHaveBeenCalledWith(req, res);
  });
});
