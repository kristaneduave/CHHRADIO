import React, { useEffect, useRef, useState } from 'react';
import { Screen, ScreenMeta } from '../types';
import { AnimatePresence, motion } from 'framer-motion';
import { triggerHaptic } from '../utils/haptics';

export const LayoutScrollContext = React.createContext<HTMLElement | null>(null);

interface LayoutProps {
  children: React.ReactNode;
  activeScreen: Screen;
  setScreen: (screen: Screen) => void;
  prefetchScreen?: (screen: Screen) => void;
  unreadNotificationsCount?: number;
}

const Layout: React.FC<LayoutProps> = ({ children, activeScreen, setScreen, prefetchScreen, unreadNotificationsCount = 0 }) => {
  const mainRef = useRef<HTMLElement>(null);
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(null);
  const [isNavHologramActive, setIsNavHologramActive] = useState(false);
  const [isBottomNavHidden, setIsBottomNavHidden] = useState(false);
  const isDesktopWideScreen = activeScreen === 'calendar' || activeScreen === 'live-map';
  const hideBottomNav = activeScreen === 'monthly-census' || isBottomNavHidden;

  useEffect(() => {
    setScrollContainer(mainRef.current);
  }, []);

  useEffect(() => {
    // Prevent carrying scroll position across tabs on mobile.
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [activeScreen]);

  useEffect(() => {
    let timeoutId: number | undefined;
    const handleHologram = () => {
      setIsNavHologramActive(true);
      if (timeoutId) window.clearTimeout(timeoutId);
      timeoutId = window.setTimeout(() => {
        setIsNavHologramActive(false);
      }, 2200);
    };

    window.addEventListener('radcore-nav-hologram', handleHologram as EventListener);
    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      window.removeEventListener('radcore-nav-hologram', handleHologram as EventListener);
    };
  }, []);

  useEffect(() => {
    const handleBottomNavVisibility = (event: Event) => {
      const customEvent = event as CustomEvent<{ hidden?: boolean }>;
      setIsBottomNavHidden(Boolean(customEvent.detail?.hidden));
    };

    window.addEventListener('radcore-bottom-nav-visibility', handleBottomNavVisibility as EventListener);
    return () => {
      window.removeEventListener('radcore-bottom-nav-visibility', handleBottomNavVisibility as EventListener);
    };
  }, []);

  // Global Haptic Feedback Interceptor
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target || !target.closest) return;

      const isInteractive = target.closest('button') ||
        target.closest('a') ||
        target.closest('[role="button"]') ||
        target.closest('.interactive-haptic');

      if (isInteractive) {
        triggerHaptic('light');
      }
    };

    // Use capture phase to ensure it fires even if event propagation is stopped by React
    document.addEventListener('click', handleGlobalClick, { capture: true });
    return () => document.removeEventListener('click', handleGlobalClick, { capture: true });
  }, []);

  const navItems: (ScreenMeta & { outlineIcon: string })[] = [
    { screen: 'dashboard', label: 'Home', icon: 'home', outlineIcon: 'home' },
    { screen: 'newsfeed', label: 'Newsfeed', icon: 'newspaper', outlineIcon: 'newspaper' },
    { screen: 'article-library', label: 'Articles', icon: 'fact_check', outlineIcon: 'fact_check' },
    { screen: 'live-map', label: 'Live Map', icon: 'map', outlineIcon: 'map' },
    { screen: 'profile', label: 'Profile', icon: 'person', outlineIcon: 'person' },
  ];

  return (
    <LayoutScrollContext.Provider value={scrollContainer}>
      <div className="relative h-screen h-[100dvh] flex flex-col bg-app overflow-hidden text-text-primary">
        <main
          ref={mainRef}
          className={`relative z-10 mx-auto w-full flex-[1_1_0%] flex flex-col overflow-y-auto overflow-x-hidden ${isDesktopWideScreen ? 'max-w-md lg:max-w-7xl' : 'max-w-md'
            }`}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeScreen}
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.98, y: -10 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex-1 flex flex-col w-full min-h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>

        {!hideBottomNav && (
          <nav className="fixed bottom-6 left-0 right-0 z-50 pointer-events-none px-4 flex justify-center pb-[env(safe-area-inset-bottom)]">
            <div
              className={`relative pointer-events-auto rounded-full py-1.5 px-3 overflow-hidden transition-all duration-500 ${isNavHologramActive
                ? 'bg-[#101a28] border border-cyan-300/40 shadow-[0_0_30px_rgba(34,211,238,0.24),0_0_50px_rgba(236,72,153,0.18)] nav-hologram-shell'
                : 'bg-[#1a232f] shadow-2xl shadow-[#040810] border border-[#2a3441]'
                }`}
            >
              {isNavHologramActive && (
                <>
                  <div className="pointer-events-none absolute inset-0 rounded-full bg-[linear-gradient(115deg,rgba(34,211,238,0.16),rgba(255,255,255,0.05)_38%,rgba(244,114,182,0.18)_72%,rgba(59,130,246,0.16))] opacity-90" />
                  <div className="pointer-events-none absolute inset-[1px] rounded-full border border-white/20 mix-blend-screen nav-hologram-chromatic" />
                  <div className="pointer-events-none absolute inset-x-4 top-1/2 h-8 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.28),transparent_70%)] blur-xl" />
                  <div className="pointer-events-none absolute inset-0 rounded-full nav-hologram-scanlines opacity-70" />
                </>
              )}
              <div className="flex items-center gap-1">
                {navItems.map((item) => {
                  const isActive = activeScreen === item.screen;
                  return (
                    <button
                      key={item.screen}
                      onClick={() => {
                        setScreen(item.screen);
                        triggerHaptic('light');
                      }}
                      onMouseEnter={() => prefetchScreen?.(item.screen)}
                      onFocus={() => prefetchScreen?.(item.screen)}
                      onTouchStart={() => prefetchScreen?.(item.screen)}
                      className={`flex flex-col items-center justify-center w-[54px] h-[48px] relative group transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-full ${isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
                        } ${isNavHologramActive ? 'nav-hologram-item' : ''
                        }`}
                      aria-label={`Open ${item.label}`}
                    >
                      <div className="relative flex flex-col items-center justify-center">
                        <div className="relative">
                          <span
                            className="material-icons transition-all duration-300 text-[26px]"
                          >
                            {isActive ? item.icon : item.outlineIcon}
                          </span>

                          {item.screen === 'newsfeed' && unreadNotificationsCount > 0 && (
                            <span
                              className={`absolute -top-1 -right-2 min-w-[18px] h-[16px] px-1 flex items-center justify-center rounded-[8px] bg-[#f23b55] text-[9px] font-black tracking-tight text-white shadow-sm shadow-black/30 z-10`}
                              style={{ lineHeight: 1 }}
                            >
                              {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </nav>
        )}

        <style>{`
          @keyframes navHologramGlitch {
            0%, 100% { transform: translate3d(0, 0, 0) scale(1); }
            14% { transform: translate3d(-1px, 0, 0) scale(1.005); }
            28% { transform: translate3d(1px, -1px, 0) scale(0.998); }
            42% { transform: translate3d(-1px, 1px, 0) scale(1.004); }
            56% { transform: translate3d(1px, 0, 0) scale(0.999); }
            70% { transform: translate3d(-1px, -1px, 0) scale(1.003); }
            84% { transform: translate3d(1px, 1px, 0) scale(0.999); }
          }

          @keyframes navHologramChromatic {
            0%, 100% { transform: translateX(0); opacity: 0.55; }
            25% { transform: translateX(-1px); opacity: 0.85; }
            50% { transform: translateX(1px); opacity: 0.7; }
            75% { transform: translateX(-0.5px); opacity: 0.9; }
          }

          @keyframes navHologramScan {
            0% { transform: translateY(-120%); }
            100% { transform: translateY(140%); }
          }

          .nav-hologram-shell {
            animation: navHologramGlitch 0.32s linear infinite;
            backdrop-filter: blur(18px) saturate(150%);
            -webkit-backdrop-filter: blur(18px) saturate(150%);
          }

          .nav-hologram-chromatic::before,
          .nav-hologram-chromatic::after {
            content: '';
            position: absolute;
            inset: 0;
            border-radius: inherit;
            border: 1px solid transparent;
            animation: navHologramChromatic 0.25s linear infinite;
          }

          .nav-hologram-chromatic::before {
            border-color: rgba(34, 211, 238, 0.65);
            transform: translateX(-1px);
          }

          .nav-hologram-chromatic::after {
            border-color: rgba(244, 114, 182, 0.5);
            transform: translateX(1px);
          }

          .nav-hologram-scanlines::before {
            content: '';
            position: absolute;
            inset: 0;
            background:
              linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.22) 48%, transparent 100%),
              repeating-linear-gradient(
                to bottom,
                rgba(255,255,255,0.05) 0px,
                rgba(255,255,255,0.05) 1px,
                transparent 1px,
                transparent 5px
              );
            animation: navHologramScan 1.2s linear infinite;
          }

          .nav-hologram-item .material-icons {
            text-shadow:
              -1px 0 rgba(34, 211, 238, 0.8),
              1px 0 rgba(244, 114, 182, 0.55),
              0 0 12px rgba(255,255,255,0.22);
          }
        `}</style>
      </div>
    </LayoutScrollContext.Provider>
  );
};

export default Layout;
