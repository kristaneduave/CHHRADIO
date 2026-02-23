import React, { useEffect, useRef } from 'react';
import { Screen, ScreenMeta } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeScreen: Screen;
  setScreen: (screen: Screen) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeScreen, setScreen }) => {
  const mainRef = useRef<HTMLElement>(null);
  const isDesktopWideScreen = activeScreen === 'calendar';
  const [hideNav, setHideNav] = React.useState(false);

  useEffect(() => {
    // Prevent carrying scroll position across tabs on mobile.
    if (mainRef.current) {
      mainRef.current.scrollTop = 0;
    }
  }, [activeScreen]);

  useEffect(() => {
    const handler = (event: Event) => {
      const custom = event as CustomEvent<boolean>;
      setHideNav(Boolean(custom.detail));
    };
    window.addEventListener('dashboard-snapshot-visibility', handler as EventListener);
    return () => window.removeEventListener('dashboard-snapshot-visibility', handler as EventListener);
  }, []);

  const navItems: (ScreenMeta & { outlineIcon: string })[] = [
    { screen: 'dashboard', label: 'Home', icon: 'home', outlineIcon: 'home' },
    { screen: 'newsfeed', label: 'Newsfeed', icon: 'newspaper', outlineIcon: 'newspaper' },
    { screen: 'search', label: 'Case Library', icon: 'folder', outlineIcon: 'folder_open' },
    { screen: 'profile', label: 'Profile', icon: 'person', outlineIcon: 'person' },
  ];

  return (
    <div className="relative h-screen h-[100dvh] flex flex-col bg-app overflow-hidden text-text-primary">
      <main
        ref={mainRef}
        className={`relative z-10 mx-auto w-full flex-1 flex flex-col pb-20 ${
          isDesktopWideScreen ? 'max-w-md lg:max-w-7xl' : 'max-w-md'
        } ${activeScreen === 'dashboard' ? 'overflow-hidden' : 'overflow-y-auto'}`}
      >
        {children}
      </main>

      {/* Navigation */}
      <nav className={`fixed bottom-0 left-0 w-full z-50 px-6 pb-1 pt-2 pointer-events-none transition-opacity duration-150 ${hideNav ? 'opacity-0 invisible' : 'opacity-100 visible'}`}>
        <div className="glass-panel relative rounded-2xl h-16 flex items-center justify-between px-1.5 mx-auto max-w-md pointer-events-auto border border-border-default/70">
          {navItems.map((item) => (
            <button
              key={item.screen}
              onClick={() => setScreen(item.screen)}
              className={`flex flex-col items-center justify-center w-[23%] h-12 relative group transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-lg ${activeScreen === item.screen ? 'text-primary' : 'text-text-secondary hover:text-text-primary'
                }`}
              aria-label={`Open ${item.label}`}
            >
              <span className="material-icons text-2xl">
                {activeScreen === item.screen ? item.icon : item.outlineIcon}
              </span>
              {activeScreen === item.screen && (
                <span className="absolute -bottom-1 w-1 h-1 bg-primary rounded-full shadow-[0_0_8px_2px_rgba(13,162,231,0.6)]"></span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
};

export default Layout;
