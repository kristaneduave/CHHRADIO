
import React, { useState } from 'react';
import { MOCK_BULLETINS } from '../constants';
import { BulletinPost } from '../types';

const BulletinScreen: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const categories = ['All', 'Research', 'Announcement', 'Event', 'Clinical'];

  const filteredBulletins = activeCategory === 'All' 
    ? MOCK_BULLETINS 
    : MOCK_BULLETINS.filter(b => b.category === activeCategory);

  const getCategoryColor = (category: string) => {
    switch(category) {
      case 'Research': return 'text-indigo-400';
      case 'Announcement': return 'text-amber-400';
      case 'Event': return 'text-emerald-400';
      case 'Clinical': return 'text-rose-400';
      default: return 'text-slate-500';
    }
  };

  return (
    <div className="px-6 pt-12 pb-12 flex flex-col min-h-full animate-in fade-in duration-700">
      <header className="mb-8">
        <h1 className="text-xl font-medium text-white tracking-tight">Bulletin</h1>
        <p className="text-slate-500 text-[11px] uppercase tracking-[0.2em] mt-1">Hospital Intelligence Feed</p>
      </header>

      {/* Minimalist Filter */}
      <div className="flex gap-6 overflow-x-auto pb-6 no-scrollbar border-b border-white/5 mb-8">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`relative whitespace-nowrap text-xs font-semibold transition-all pb-1 ${
              activeCategory === cat 
                ? 'text-primary' 
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {cat}
            {activeCategory === cat && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full animate-in slide-in-from-left-2"></span>
            )}
          </button>
        ))}
      </div>

      {/* List Feed */}
      <div className="flex-1 space-y-0">
        {filteredBulletins.map((post, idx) => (
          <div 
            key={post.id} 
            className={`py-6 flex gap-6 items-start group cursor-pointer transition-all border-b border-white/[0.03] last:border-0 ${
              idx === 0 ? 'pt-0' : ''
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[9px] font-bold uppercase tracking-widest ${getCategoryColor(post.category)}`}>
                  {post.category}
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-800"></span>
                <span className="text-[9px] text-slate-600 font-medium">{post.date}</span>
              </div>
              
              <h2 className="text-sm font-semibold text-slate-200 mb-2 leading-snug group-hover:text-white transition-colors">
                {post.title}
              </h2>
              
              <p className="text-[12px] text-slate-500 line-clamp-2 leading-relaxed mb-3">
                {post.summary}
              </p>

              <div className="flex items-center gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-1.5">
                  <span className="material-icons text-[12px] text-slate-600">person</span>
                  <span className="text-[10px] text-slate-500">{post.author}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="material-icons text-[12px] text-slate-600">visibility</span>
                  <span className="text-[10px] text-slate-500">{post.views}</span>
                </div>
              </div>
            </div>

            {post.imageUrl && (
              <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border border-white/5 bg-white/5">
                <img 
                  src={post.imageUrl} 
                  alt={post.title} 
                  className="w-full h-full object-cover grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-500"
                />
              </div>
            )}
          </div>
        ))}

        {filteredBulletins.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
             <span className="material-icons text-2xl text-slate-800 mb-3">auto_awesome</span>
             <p className="text-[11px] text-slate-600 uppercase tracking-widest">No new updates found</p>
          </div>
        )}
      </div>

      {/* Minimalist Create FAB */}
      <button className="fixed bottom-24 right-8 w-12 h-12 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white border border-white/10 flex items-center justify-center transition-all z-50 backdrop-blur-md">
        <span className="material-icons text-xl">edit</span>
      </button>
    </div>
  );
};

export default BulletinScreen;
