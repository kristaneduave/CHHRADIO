import React, { useEffect, useRef, useState } from 'react';
import { Screen, ScreenMeta } from '../types';
import { AnimatePresence, motion } from 'framer-motion';
import { triggerHaptic } from '../utils/haptics';
import { useAppViewport } from './responsive/useViewport';
import { getScreenLayoutMode } from './layout/screenLayoutConfig';

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
  const viewport = useAppViewport();
  const layoutMode = getScreenLayoutMode(activeScreen);

  const isDesktop = viewport === 'desktop';
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

  const ITEM_COLORS: Record<string, { bg: string, border: string, text: string }> = {
    'newsfeed': { bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', text: 'text-cyan-400' },
    'article-library': { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400' },
    'dashboard': { bg: 'bg-sky-500/10', border: 'border-sky-500/20', text: 'text-sky-400' },
    'anatomy': { bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400' },
    'profile': { bg: 'bg-amber-500/10', border: 'border-amber-500/20', text: 'text-amber-400' },
  };

  const navItems = [
    { screen: 'dashboard', label: 'Home', icon: 'home', outlineIcon: 'home' },
    { screen: 'newsfeed', label: 'Newsfeed', icon: 'newspaper', outlineIcon: 'newspaper' },
    { screen: 'article-library', label: 'Articles', icon: 'fact_check', outlineIcon: 'fact_check' },
    { screen: 'anatomy', label: 'Anatomy', icon: 'favorite', outlineIcon: 'favorite_border' },
    { screen: 'profile', label: 'Profile', icon: 'person', outlineIcon: 'person_outline' },
  ] as (ScreenMeta & { outlineIcon: string })[];

  const isDashboardDesktop = isDesktop && activeScreen === 'dashboard';
  const mainWidthClassName = isDashboardDesktop
    ? 'max-w-[1180px]'
    : isDesktop
    ? layoutMode === 'wide'
      ? 'max-w-7xl'
      : layoutMode === 'split'
        ? 'max-w-6xl'
        : layoutMode === 'narrow'
          ? 'max-w-2xl'
          : 'max-w-5xl'
    : 'max-w-md';

  return (
    <LayoutScrollContext.Provider value={scrollContainer}>
      <div className="relative h-screen h-[100dvh] flex flex-col bg-app overflow-hidden text-text-primary">
        <div className="relative flex min-h-0 flex-1">
          {isDesktop && !hideBottomNav && (
            <aside className="hidden xl:block">
              {/* Edge-Docked Vertical Nav */}
              <div 
                className="fixed inset-y-0 left-0 z-20 w-[80px] flex flex-col items-start justify-center group"
              >
                {/* Background Glass Layer */}
                <div 
                  className="absolute inset-0 bg-[#0c1222]/85 backdrop-blur-[40px] border-r-[1.5px] border-white/[0.08] shadow-2xl transition-all duration-300 pointer-events-none"
                />

                <div className="w-[80px] flex flex-col items-start space-y-4 relative z-10 overflow-visible mt-2">
                  {navItems.map((item) => {
                    const isActive = activeScreen === item.screen;
                    const c = ITEM_COLORS[item.screen] || ITEM_COLORS['dashboard'];
                    
                    return (
                      <div key={`desktop-${item.screen}`} className={`relative flex items-center h-[56px] z-10 w-[190px] pl-[14px]`}>
                        {/* Custom Tab Protrusion */}
                        <button
                          onClick={() => setScreen(item.screen)}
                          onMouseEnter={() => prefetchScreen?.(item.screen)}
                          onFocus={() => prefetchScreen?.(item.screen)}
                          className={`relative flex items-center h-[52px] rounded-2xl transition-all duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)] group/btn focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/50 w-[52px] hover:w-[180px] ${isActive ? 'bg-[#111623] border border-white/5 shadow-md' : 'bg-transparent border border-transparent shadow-none hover:bg-[#1a2333] hover:border-white/5'}`}
                          aria-label={`Open ${item.label}`}
                        >
                           {/* Highlighted Icon Tile & Badge */}
                           <div className={`flex-shrink-0 relative flex items-center justify-center w-[40px] h-[40px] rounded-xl ml-[5px] transition-all duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${isActive ? `${c.bg} ${c.border} border-[1.5px] shadow-[0_0_15px_rgba(255,255,255,0.02)]` : `bg-transparent border border-transparent group-hover/btn:${c.bg} group-hover/btn:${c.border} group-hover/btn:border-[1.5px]`}`}>
                              <span className={`material-icons transition-all duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${isActive ? `${c.text} drop-shadow-[0_0_8px_currentColor]` : `text-slate-500 group-hover/btn:${c.text} group-hover/btn:drop-shadow-[0_0_8px_currentColor] group-hover/btn:scale-110`} text-[22px]`}>
                                {isActive ? item.icon : item.outlineIcon}
                              </span>
                              
                              {/* Unread Counter Badge anchored tightly to icon box */}
                              {item.screen === 'newsfeed' && unreadNotificationsCount > 0 && (
                                <span className={`absolute -top-0.5 -right-0.5 z-20 flex min-h-[16px] min-w-[16px] items-center justify-center rounded-full bg-[#ef4444] px-1 text-[10px] font-bold leading-none text-white shadow-md transition-all duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)]`}>
                                  {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                                </span>
                              )}
                           </div>
                           
                           {/* Extended Text Block (Hidden globally except on individual button hover) */}
                           <div className={`flex flex-1 items-center justify-between whitespace-nowrap overflow-hidden transition-all duration-[350ms] ease-[cubic-bezier(0.16,1,0.3,1)] opacity-0 -translate-x-3 group-hover/btn:opacity-100 group-hover/btn:translate-x-0 ml-3`}>
                              <span className={`font-bold tracking-[0.08em] uppercase text-[12px] ${isActive ? c.text : `text-slate-400 group-hover/btn:${c.text}`}`}>
                                 {item.label}
                              </span>
                              <span className="material-icons text-slate-600 text-[18px] mr-3 group-hover/btn:text-slate-400 transition-colors">
                                 chevron_right
                              </span>
                           </div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </aside>
          )}

          <main
            ref={mainRef}
            className={`relative z-10 mx-auto w-full flex-[1_1_0%] flex flex-col overflow-y-auto overflow-x-hidden ${isDesktop ? 'px-0 py-6' : ''} ${mainWidthClassName}`}
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
        </div>

        {!isDesktop && !hideBottomNav && (
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
