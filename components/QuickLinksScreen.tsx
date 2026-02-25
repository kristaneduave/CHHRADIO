
import React from 'react';

const QuickLinksScreen: React.FC = () => {
    const links = [
        { title: 'Radiopaedia', url: 'https://radiopaedia.org/', icon: 'school', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
        { title: 'RSNA', url: 'https://www.rsna.org/', icon: 'medication', color: 'text-indigo-400', bg: 'bg-indigo-400/10' },
        { title: 'PubMed', url: 'https://pubmed.ncbi.nlm.nih.gov/', icon: 'menu_book', color: 'text-blue-400', bg: 'bg-blue-400/10' },
        { title: 'Hospital Portal', url: '#', icon: 'login', color: 'text-white', bg: 'bg-white/10' },
        { title: 'PACS Login', url: '#', icon: 'desktop_windows', color: 'text-orange-400', bg: 'bg-orange-400/10' },
        { title: 'Shift Schedule', url: '#', icon: 'schedule', color: 'text-rose-400', bg: 'bg-rose-400/10' },
    ];

    return (
        <div className="px-6 pt-6 pb-12 flex flex-col min-h-full animate-in fade-in duration-700">
            <header className="mb-4">
                <h1 className="text-3xl font-bold text-white">Quick Links</h1>
                <p className="text-slate-500 text-[11px] uppercase tracking-[0.2em] mt-1">External Resources</p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {links.map((link, index) => (
                    <a
                        key={index}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="glass-card-enhanced p-4 rounded-xl flex items-center gap-4 group hover:bg-white/5 border border-white/5 transition-all active:scale-[0.99]"
                    >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${link.bg} ${link.color}`}>
                            <span className="material-icons text-xl">{link.icon}</span>
                        </div>
                        <div className="flex-1">
                            <h3 className="text-sm font-semibold text-slate-200 group-hover:text-white transition-colors">{link.title}</h3>
                            <p className="text-[10px] text-slate-500 truncate">{link.url !== '#' ? link.url : 'Internal Access Only'}</p>
                        </div>
                        <span className="material-icons text-slate-600 group-hover:text-white transition-colors text-lg">open_in_new</span>
                    </a>
                ))}
            </div>
        </div>
    );
};

export default QuickLinksScreen;
