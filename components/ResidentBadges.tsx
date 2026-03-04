import React from 'react';

interface ResidentBadgesProps {
    activeBadges: string[];
}

export const ResidentBadges: React.FC<ResidentBadgesProps> = ({ activeBadges }) => {
    if (!activeBadges || activeBadges.length === 0) return null;

    return (
        <div className="flex justify-center gap-2 mb-4">
            {activeBadges.map(badge => {
                let badgeIcon = 'star';
                let badgeColor = 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20 shadow-[0_0_10px_rgba(250,204,21,0.2)]';
                let badgeTitle = 'Award';

                if (badge === 'workhorse') {
                    badgeIcon = 'hardware';
                    badgeColor = 'text-slate-300 bg-slate-400/10 border-slate-400/20';
                    badgeTitle = 'Workhorse';
                }
                if (badge === 'scholar') {
                    badgeIcon = 'school';
                    badgeColor = 'text-amber-400 bg-amber-400/10 border-amber-400/20 shadow-[0_0_10px_rgba(251,191,36,0.2)]';
                    badgeTitle = 'Scholar';
                }
                if (badge === 'punctuality') {
                    badgeIcon = 'query_builder';
                    badgeColor = 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
                    badgeTitle = 'Punctuality';
                }
                if (badge === 'high_scorer') {
                    badgeIcon = 'workspace_premium';
                    badgeColor = 'text-purple-400 bg-purple-400/10 border-purple-400/20 shadow-[0_0_10px_rgba(192,132,252,0.2)]';
                    badgeTitle = 'High Scorer';
                }

                return (
                    <div key={badge} title={badgeTitle} className={`w-8 h-8 rounded-full flex items-center justify-center border ${badgeColor}`}>
                        <span className="material-icons text-[16px]">{badgeIcon}</span>
                    </div>
                );
            })}
        </div>
    );
};
