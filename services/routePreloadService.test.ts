import { describe, expect, it, vi, beforeEach } from 'vitest';

const {
  preloadArticleLibraryLanding,
  preloadAnnouncementsWorkspace,
  preloadCalendarWorkspace,
  preloadQuizWorkspace,
  preloadLiveAuntMinnieWorkspace,
  preloadCurrentProfileHome,
  preloadResidentsCornerBootstrap,
  preloadConsultantDeckingEntries,
} = vi.hoisted(() => ({
  preloadArticleLibraryLanding: vi.fn(async () => undefined),
  preloadAnnouncementsWorkspace: vi.fn(async () => undefined),
  preloadCalendarWorkspace: vi.fn(async () => undefined),
  preloadQuizWorkspace: vi.fn(async () => undefined),
  preloadLiveAuntMinnieWorkspace: vi.fn(async () => undefined),
  preloadCurrentProfileHome: vi.fn(async () => undefined),
  preloadResidentsCornerBootstrap: vi.fn(async () => undefined),
  preloadConsultantDeckingEntries: vi.fn(async () => undefined),
}));

vi.mock('./articleLibraryService', () => ({
  preloadArticleLibraryLanding,
}));

vi.mock('./announcementsWorkspaceService', () => ({
  preloadAnnouncementsWorkspace,
}));

vi.mock('./calendarWorkspaceService', () => ({
  preloadCalendarWorkspace,
}));

vi.mock('./quizService', () => ({
  preloadQuizWorkspace,
}));

vi.mock('./liveAuntMinnieService', () => ({
  preloadLiveAuntMinnieWorkspace,
}));

vi.mock('./profileHomeService', () => ({
  preloadCurrentProfileHome,
}));

vi.mock('./residentsCornerService', () => ({
  preloadResidentsCornerBootstrap,
}));

vi.mock('./consultantDeckingService', () => ({
  preloadConsultantDeckingEntries,
}));

describe('routePreloadService', () => {
  beforeEach(() => {
    vi.resetModules();
    preloadQuizWorkspace.mockClear();
    preloadLiveAuntMinnieWorkspace.mockClear();
    preloadArticleLibraryLanding.mockClear();
    preloadAnnouncementsWorkspace.mockClear();
    preloadCalendarWorkspace.mockClear();
    preloadCurrentProfileHome.mockClear();
    preloadResidentsCornerBootstrap.mockClear();
    preloadConsultantDeckingEntries.mockClear();
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

  it('warms calendar workspace data when preloading calendar', async () => {
    const { preloadRouteForScreen } = await import('./routePreloadService');

    await preloadRouteForScreen('calendar');

    expect(preloadCalendarWorkspace).toHaveBeenCalledTimes(1);
  });

  it('warms announcements workspace data when preloading announcements', async () => {
    const { preloadRouteForScreen } = await import('./routePreloadService');

    await preloadRouteForScreen('announcements');

    expect(preloadAnnouncementsWorkspace).toHaveBeenCalledTimes(1);
  });

  it('warms current profile workspace data when preloading profile', async () => {
    const { preloadRouteForScreen } = await import('./routePreloadService');

    await preloadRouteForScreen('profile');

    expect(preloadCurrentProfileHome).toHaveBeenCalledTimes(1);
  });

  it('warms residents corner bootstrap data when preloading residents corner', async () => {
    const { preloadRouteForScreen } = await import('./routePreloadService');

    await preloadRouteForScreen('residents-corner');

    expect(preloadResidentsCornerBootstrap).toHaveBeenCalledTimes(1);
  });

  it('warms consultant decking data when preloading consultant decking', async () => {
    const { preloadRouteForScreen } = await import('./routePreloadService');

    await preloadRouteForScreen('consultant-decking');

    expect(preloadConsultantDeckingEntries).toHaveBeenCalledTimes(1);
  });
});
