import React, { useEffect, useRef } from 'react';
import { Screen, ScreenMeta } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeScreen: Screen;
  setScreen: (screen: Screen) => void;
  unreadNotificationsCount?: number;
}

const Layout: React.FC<LayoutProps> = ({ children, activeScreen, setScreen, unreadNotificationsCount = 0 }) => {
  const mainRef = useRef<HTMLElement>(null);
  const isDesktopWideScreen = activeScreen === 'calendar' || activeScreen === 'live-map';

  useEffect(() => {
    // Prevent carrying scroll position across tabs on mobile.
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [activeScreen]);

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
        className={`relative z-10 mx-auto w-full flex-[1_1_0%] flex flex-col pb-20 overflow-y-auto ${isDesktopWideScreen ? 'max-w-md lg:max-w-7xl' : 'max-w-md'
          }`}
      >
        {children}
      </main>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 w-full z-50 pointer-events-none">
        {/* Seamless gradient mask for the scrolling content behind */}
        <div className="absolute bottom-0 left-0 w-full h-12 bg-gradient-to-t from-[#101922] to-transparent -z-10" />

        <div className="relative w-full pb-[env(safe-area-inset-bottom)] pointer-events-auto bg-gradient-to-b from-[#101922]/60 to-[#101922] backdrop-blur-2xl shadow-[0_-2px_10px_rgba(0,0,0,0.15)] border-t border-white/[0.06]">
          <div className="flex items-center justify-between px-4 mx-auto max-w-md h-[50px]">
            {navItems.map((item) => {
              const isActive = activeScreen === item.screen;
              return (
                <button
                  key={item.screen}
                  onClick={() => {
                    setScreen(item.screen);
                    // Add subtle haptic vibration (50ms) if supported by the browser
                    if (navigator.vibrate) {
                      navigator.vibrate(50);
                    }
                  }}
                  className={`flex flex-col items-center justify-center w-[23%] h-full relative group transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3072d6]/60 ${isActive ? 'text-[#3072d6]' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  aria-label={`Open ${item.label}`}
                >
                  <div className="relative flex flex-col items-center justify-center">
                    <div className="relative">
                      <span
                        className={`material-icons transition-all duration-300 ${isActive ? 'text-[24px] -translate-y-[1px]' : 'text-[24px] group-hover:-translate-y-[1px]'
                          }`}
                      >
                        {isActive ? item.icon : item.outlineIcon}
                      </span>

                      {item.screen === 'newsfeed' && unreadNotificationsCount > 0 && (
                        <span
                          className={`absolute -top-1 -right-2 min-w-[18px] h-[16px] px-1 flex items-center justify-center rounded-[8px] bg-[#f23b55] text-[9px] font-black tracking-tight text-white shadow-sm shadow-black/30 z-10 transition-transform duration-300 ${isActive ? '-translate-y-[1px]' : ''}`}
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
    </div>
  );
};

export default Layout;
