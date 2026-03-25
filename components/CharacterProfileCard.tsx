import React from 'react';
import { CurrentWorkstationStatus } from '../types';
import { getRoleLabel, hasAnyRole, normalizeUserRole } from '../utils/roles';

interface CharacterProfileCardProps {
    workstation: CurrentWorkstationStatus;
}

// Temporary helper to determine "RPG Class/Level" based on typical medical roles
// We now try to use faction first, then title, then fallback to procedural
const getCharacterClass = (name: string, role?: string | null, faction?: string | null) => {
    const normalizedRole = normalizeUserRole(role);
    let baseClass = 'Specialist';
    if (normalizedRole === 'resident') baseClass = 'Resident';
    if (normalizedRole === 'fellow') baseClass = 'Fellow';
    if (normalizedRole === 'consultant') baseClass = 'Consultant';
    if (hasAnyRole(normalizedRole, ['admin', 'moderator'])) baseClass = 'Overlord';

    // This is a naive implementation; ideally, this comes from true user metadata/roles.
    const lowerName = name.toLowerCase();

    let color = 'text-sky-400';
    let bg = 'bg-sky-500/10';
    let border = 'border-sky-500/30';

    if (hasAnyRole(normalizedRole, ['admin', 'moderator', 'consultant'])) {
        color = 'text-purple-400';
        bg = 'bg-purple-500/10';
        border = 'border-purple-500/30';
    } else if (normalizedRole === 'fellow') {
        color = 'text-amber-400';
        bg = 'bg-amber-500/10';
        border = 'border-amber-500/30';
    } else if (normalizedRole === 'resident') {
        color = 'text-emerald-400';
        bg = 'bg-emerald-500/10';
        border = 'border-emerald-500/30';
    }

    return {
        title: faction ? `${faction} ${baseClass}` : `${getRoleLabel(normalizedRole)} ${baseClass}`,
        color,
        bg,
        border
    };
};

const CharacterProfileCard: React.FC<CharacterProfileCardProps> = ({ workstation }) => {
    const occupantName = workstation.occupant_name || 'Unknown User';
    const charClass = getCharacterClass(occupantName, workstation.occupant_role, workstation.occupant_faction);

    // Gamification Attributes
    const seed = workstation.occupant_avatar_seed || workstation.occupant_id || occupantName;
    const title = workstation.occupant_title || '';
    const motto = workstation.occupant_motto || '';
    const workMode = workstation.occupant_work_mode || 'Focused';
    const modality = workstation.occupant_main_modality || 'CT';
    const activeBadges = workstation.occupant_active_badges || [];

    // Visual FX based on Work Mode
    let frameGlow = 'shadow-[inset_0_0_20px_rgba(0,0,0,0.8)]';
    let frameBorder = 'border-slate-600';
    if (workMode === 'Collaborative') {
        frameGlow = 'shadow-[inset_0_0_20px_rgba(59,130,246,0.6)] animate-pulse';
        frameBorder = 'border-blue-400';
    } else if (workMode === 'Speed Reading') {
        frameGlow = 'shadow-[inset_0_0_20px_rgba(244,63,94,0.6)]';
        frameBorder = 'border-rose-400';
    }

    // Generate some fake stats for the demo
    const intelligence = Math.floor(Math.random() * 20) + 5; // Cases read
    const stamina = Math.floor(Math.random() * 8) + 2; // Hours online

    return (
        <div className="w-full bg-slate-900/90 border-2 border-slate-700 rounded-xl p-4 shadow-2xl backdrop-blur-md relative overflow-hidden font-mono">
            {/* Scanline overlay effect for retro feel */}
            <div className="absolute inset-0 pointer-events-none bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAACCAYAAACZgbYnAAAAEklEQVQIW2NkYGD4z8DAwMgAA0QAMwuL3gQAAAAASUVORK5CYII=')] opacity-20 MixBlendMode-overlay"></div>

            <div className="flex gap-4 relative z-10">
                {/* Avatar Portrait Box */}
                <div className={`shrink-0 w-24 h-24 bg-slate-800 border-2 ${frameBorder} rounded-lg p-1 shadow-inner relative flex items-center justify-center overflow-hidden transition-colors`}>
                    <img
                        src={`https://api.dicebear.com/9.x/pixel-art/svg?seed=${encodeURIComponent(seed)}&m=2`}
                        alt="Avatar"
                        className="w-full h-full object-cover scale-150 rendering-pixelated"
                    />
                    <div className={`absolute top-0 left-0 w-full h-full pointer-events-none ${frameGlow}`}></div>
                </div>

                {/* Character Info */}
                <div className="flex-1">
                    <div className="flex items-start justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-white mb-0 uppercase tracking-wider shadow-black drop-shadow-md">{occupantName}</h2>
                            {title && <h3 className="text-[10px] text-primary-light font-bold uppercase tracking-widest mb-1 shadow-black drop-shadow-md">{title}</h3>}
                        </div>
                        {/* Modality Icon */}
                        <div className="bg-slate-800 border border-slate-600 rounded px-1.5 py-0.5 ml-2 shrink-0 shadow-[2px_2px_0_rgba(0,0,0,0.3)]">
                            <span className="text-[9px] font-bold text-white uppercase tracking-wider">{modality}</span>
                        </div>
                    </div>

                    <div className={`inline-flex items-center mt-1 px-2 py-0.5 rounded border ${charClass.bg} ${charClass.border} ${charClass.color} text-[10px] font-bold uppercase tracking-widest mb-2 shadow-[2px_2px_0_rgba(0,0,0,0.3)]`}>
                        {charClass.title}
                    </div>

                    {/* Active Badges */}
                    {activeBadges.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                            {activeBadges.map(badge => {
                                let badgeIcon = 'star';
                                let badgeColor = 'text-yellow-400 bg-yellow-400/10 border-yellow-400/40 shadow-[0_0_5px_rgba(250,204,21,0.4)]';
                                let badgeTitle = 'Badge';
                                if (badge === 'workhorse') { badgeIcon = 'hardware'; badgeColor = 'text-slate-300 bg-slate-400/10 border-slate-400/40'; badgeTitle = 'Workhorse'; }
                                if (badge === 'scholar') { badgeIcon = 'school'; badgeColor = 'text-amber-400 bg-amber-400/10 border-amber-400/40 shadow-[0_0_5px_rgba(251,191,36,0.4)]'; badgeTitle = 'Scholar'; }
                                if (badge === 'punctuality') { badgeIcon = 'query_builder'; badgeColor = 'text-emerald-400 bg-emerald-400/10 border-emerald-400/40'; badgeTitle = 'Punctuality'; }
                                if (badge === 'high_scorer') { badgeIcon = 'workspace_premium'; badgeColor = 'text-purple-400 bg-purple-400/10 border-purple-400/40 shadow-[0_0_5px_rgba(192,132,252,0.4)]'; badgeTitle = 'High Scorer'; }
                                return (
                                    <div key={badge} title={badgeTitle} className={`w-5 h-5 rounded flex items-center justify-center border ${badgeColor}`}>
                                        <span className="material-icons text-[12px]">{badgeIcon}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="bg-black/40 border border-slate-700 rounded p-2">
                            <div className="text-[9px] text-slate-400 uppercase tracking-widest mb-1">INT (Cases)</div>
                            <div className="flex items-end gap-1">
                                <span className="text-lg font-bold text-sky-400 leading-none">{intelligence}</span>
                                <span className="text-[10px] text-slate-500 mb-0.5">/day</span>
                            </div>
                        </div>
                        <div className="bg-black/40 border border-slate-700 rounded p-2">
                            <div className="text-[9px] text-slate-400 uppercase tracking-widest mb-1">STM (Hours)</div>
                            <div className="flex items-end gap-1">
                                <span className="text-lg font-bold text-amber-400 leading-none">{stamina}</span>
                                <span className="text-[10px] text-slate-500 mb-0.5">/shift</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Status Message & Motto */}
            <div className="mt-4 pt-4 border-t border-slate-800 relative z-10">
                {motto && (
                    <div className="mb-3 text-center">
                        <p className="text-[10px] text-slate-400 italic">"{motto}"</p>
                    </div>
                )}

                {(workstation.status_message || workstation.occupant_map_status) && (
                    <div>
                        <div className="text-[9px] text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1">
                            <span className="material-icons text-[12px]">format_quote</span>
                            {workstation.occupant_map_status || 'Current Action'}
                        </div>
                        {workstation.status_message && (
                            <p className="text-sm text-slate-300 italic border-l-2 border-slate-600 pl-3">"{workstation.status_message}"</p>
                        )}
                    </div>
                )}
            </div>

            {/* Decoration */}
            <div className="absolute bottom-2 right-2 text-slate-800 font-bold text-4xl opacity-20 select-none pointer-events-none">
                Ch.
            </div>
        </div>
    );
};

export default CharacterProfileCard;
