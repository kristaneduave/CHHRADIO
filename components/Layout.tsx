import React, { useEffect, useRef } from 'react';
import { Screen, ScreenMeta } from '../types';
import { AnimatePresence, motion } from 'framer-motion';
import { triggerHaptic } from '../utils/haptics';

interface LayoutProps {
  children: React.ReactNode;
  activeScreen: Screen;
  setScreen: (screen: Screen) => void;
  unreadNotificationsCount?: number;
}

const Layout: React.FC<LayoutProps> = ({ children, activeScreen, setScreen, unreadNotificationsCount = 0 }) => {
  const mainRef = useRef<HTMLElement>(null);
  const isDesktopWideScreen = activeScreen === 'calendar' || activeScreen === 'live-map';
  const hideBottomNav = activeScreen === 'monthly-census';

  useEffect(() => {
    // Prevent carrying scroll position across tabs on mobile.
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [activeScreen]);

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
    { screen: 'live-map', label: 'Live Map', icon: 'map', outlineIcon: 'map' },
    { screen: 'profile', label: 'Profile', icon: 'person', outlineIcon: 'person' },
  ];

  return (
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
            className="flex-1 flex flex-col w-full h-full"
          >
            {children}
            {/* Spacer to prevent content from hiding behind floating nav when scrolled to bottom */}
            {!hideBottomNav && <div className="h-32 shrink-0 w-full pointer-events-none" aria-hidden="true" />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Navigation */}
      {!hideBottomNav && (
        <nav className="fixed bottom-10 left-0 right-0 z-50 pointer-events-none px-4 flex justify-center pb-[env(safe-area-inset-bottom)]">
          <div className="relative pointer-events-auto bg-[#1a232f]/35 backdrop-blur-xl shadow-2xl shadow-black/50 border border-white/[0.08] rounded-full py-2 px-3">
            <div className="flex items-center gap-1.5">
              {navItems.map((item) => {
                const isActive = activeScreen === item.screen;
                return (
                  <button
                    key={item.screen}
                    onClick={() => {
                      setScreen(item.screen);
                      triggerHaptic('light');
                    }}
                    className={`flex flex-col items-center justify-center w-[64px] h-[50px] relative group transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 rounded-full ${isActive ? 'bg-white/15 text-white shadow-inner border border-white/5' : 'text-slate-400 hover:text-white hover:bg-white/5'
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
    </div>
  );
};

export default Layout;
