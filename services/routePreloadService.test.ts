import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  preloadArticleLibraryLanding,
  preloadQuizWorkspace,
  preloadLiveAuntMinnieWorkspace,
  preloadResidentsCornerBootstrap,
} = vi.hoisted(() => ({
  preloadArticleLibraryLanding: vi.fn(async () => undefined),
  preloadQuizWorkspace: vi.fn(async () => undefined),
  preloadLiveAuntMinnieWorkspace: vi.fn(async () => undefined),
  preloadResidentsCornerBootstrap: vi.fn(async () => undefined),
}));

vi.mock('./articleLibraryService', () => ({
  preloadArticleLibraryLanding,
}));

vi.mock('./quizService', () => ({
  preloadQuizWorkspace,
}));

vi.mock('./liveAuntMinnieService', () => ({
  preloadLiveAuntMinnieWorkspace,
}));

vi.mock('./residentsCornerService', () => ({
  preloadResidentsCornerBootstrap,
}));

describe('routePreloadService', () => {
  beforeEach(() => {
    vi.resetModules();
    preloadQuizWorkspace.mockClear();
    preloadLiveAuntMinnieWorkspace.mockClear();
    preloadArticleLibraryLanding.mockClear();
    preloadResidentsCornerBootstrap.mockClear();
  });

  it('warms quiz and aunt minnie data when preloading quiz', async () => {
    const { preloadRouteForScreen } = await import('./routePreloadService');

    await preloadRouteForScreen('quiz');

    expect(preloadQuizWorkspace).toHaveBeenCalledTimes(1);
    expect(preloadLiveAuntMinnieWorkspace).toHaveBeenCalledTimes(1);
  });

  it('warms aunt minnie data when preloading the live aunt minnie screen', async () => {
    const { preloadRouteForScreen } = await import('./routePreloadService');

    await preloadRouteForScreen('live-aunt-minnie');

    expect(preloadQuizWorkspace).not.toHaveBeenCalled();
    expect(preloadLiveAuntMinnieWorkspace).toHaveBeenCalledTimes(1);
  });

  it('warms article library landing data when preloading article library', async () => {
    const { preloadRouteForScreen } = await import('./routePreloadService');

    await preloadRouteForScreen('article-library');

    expect(preloadArticleLibraryLanding).toHaveBeenCalledTimes(1);
  });

  it('warms residents corner bootstrap data when preloading residents corner', async () => {
    const { preloadRouteForScreen } = await import('./routePreloadService');

    await preloadRouteForScreen('residents-corner');

    expect(preloadResidentsCornerBootstrap).toHaveBeenCalledTimes(1);
  });
});
