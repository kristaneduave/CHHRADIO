import React from 'react';
import { Screen } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeScreen: Screen;
  setScreen: (screen: Screen) => void;
}

const Layout: React.FC<LayoutProps> = ({ children, activeScreen, setScreen }) => {
  const navItems: { screen: Screen; icon: string; outlineIcon: string }[] = [
    { screen: 'dashboard', icon: 'home', outlineIcon: 'home' },
    { screen: 'search', icon: 'folder', outlineIcon: 'folder_open' }, // Database
    { screen: 'profile', icon: 'person', outlineIcon: 'person_outline' },
  ];

  return (
    <div className="relative h-screen h-[100dvh] flex flex-col bg-[#050B14] overflow-hidden">


      <main className={`relative z-10 max-w-md mx-auto w-full flex-1 flex flex-col pb-24 ${activeScreen === 'dashboard' ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {children}
      </main>

      {/* Global Bottom Gradient Fade */}
      <div className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#050B14] via-[#050B14]/90 to-transparent pointer-events-none z-40"></div>

      {/* Navigation */}
      <nav className="fixed bottom-0 left-0 w-full z-50 px-6 pb-4 pt-4 pointer-events-none">
        <div className="glass-panel rounded-2xl h-16 flex items-center justify-between px-2 mx-auto max-w-md pointer-events-auto shadow-2xl border border-white/5">
          {navItems.map((item) => (
            <button
              key={item.screen}
              onClick={() => setScreen(item.screen)}
              className={`flex flex-col items-center justify-center w-16 h-12 relative group transition-colors ${activeScreen === item.screen ? 'text-primary' : 'text-slate-400 hover:text-white'
                }`}
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
