import React from 'react';

interface ProfileEditorProps {
    profile: any;
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
    handleRerollAvatar: () => void;
    nicknameError: string | null;
}

export const ProfileEditor: React.FC<ProfileEditorProps> = ({
    profile,
    handleChange,
    handleRerollAvatar,
    nicknameError
}) => {
    return (
        <div className="w-full max-w-sm space-y-4 z-10 mb-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                <div className="flex items-center justify-between mb-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-left">Identity & Avatar</p>
                    <button
                        onClick={handleRerollAvatar}
                        className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded border border-white/10 text-[9px] font-bold uppercase text-slate-300 transition-colors flex items-center gap-1"
                    >
                        <span className="material-icons text-[12px]">casino</span>
                        Reroll Sprite
                    </button>
                </div>
                <div>
                    <label className="block text-left text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Full Name</label>
                    <input
                        name="full_name"
                        value={profile.full_name}
                        onChange={handleChange}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-slate-600"
                        placeholder="Dr. Alex Smith"
                    />
                </div>
                <div>
                    <label className="block text-left text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Display Name (Required)</label>
                    <input
                        name="nickname"
                        value={profile.nickname || ''}
                        onChange={handleChange}
                        className={`w-full bg-white/5 border rounded-xl px-4 py-2.5 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-slate-600 ${nicknameError ? 'border-rose-500/50' : 'border-white/10'}`}
                        placeholder="How others will see your name"
                    />
                    <p className="mt-1.5 text-[10px] text-slate-500 text-left">Used in covers, activity feeds, and presence.</p>
                    {nicknameError ? <p className="mt-1 text-[10px] text-rose-400 text-left">{nicknameError}</p> : null}
                </div>
                <div>
                    <label className="block text-left text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Year Level</label>
                    <input
                        name="year_level"
                        value={profile.year_level}
                        onChange={handleChange}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-slate-600"
                        placeholder="e.g. R1, R2, Fellow"
                    />
                </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-left">Roleplay & Gamification</p>
                <div>
                    <label className="block text-left text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Title / Specialization</label>
                    <input
                        name="title"
                        value={profile.title}
                        onChange={handleChange}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-slate-600"
                        placeholder="e.g. CT Veteran, Neuro Whisperer"
                    />
                </div>
                <div>
                    <label className="block text-left text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Character Motto</label>
                    <input
                        name="motto"
                        value={profile.motto}
                        onChange={handleChange}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all placeholder:text-slate-600"
                        placeholder="A short, catchy phrase..."
                    />
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Work Mode</label>
                        <select
                            name="work_mode"
                            value={profile.work_mode}
                            onChange={handleChange}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2.5 text-white text-xs focus:border-primary focus:ring-1 outline-none appearance-none"
                        >
                            <option value="Focused">Focused</option>
                            <option value="Collaborative">Collaborative</option>
                            <option value="Speed Reading">Speed Reading</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Main Modality</label>
                        <select
                            name="main_modality"
                            value={profile.main_modality}
                            onChange={handleChange}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2.5 text-white text-xs focus:border-primary focus:ring-1 outline-none appearance-none"
                        >
                            <option value="CT">CT</option>
                            <option value="MRI">MRI</option>
                            <option value="X-Ray">X-Ray</option>
                            <option value="Ultrasound">Ultrasound</option>
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="block text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Faction / Guild</label>
                        <input
                            name="faction"
                            value={profile.faction}
                            onChange={handleChange}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2.5 text-white text-[11px] focus:border-primary focus:ring-1 outline-none placeholder:text-slate-600"
                            placeholder="e.g. The ER Squad"
                        />
                    </div>
                    <div>
                        <label className="block text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Map Status</label>
                        <select
                            name="map_status"
                            value={profile.map_status}
                            onChange={handleChange}
                            className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2.5 text-white text-[11px] focus:border-primary focus:ring-1 outline-none appearance-none"
                        >
                            <option value="At Workstation">At Workstation</option>
                            <option value="On Rounds">On Rounds</option>
                            <option value="Coffee Break">Coffee Break</option>
                            <option value="In Conference">In Conference</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-left">About</p>
                <div>
                    <label className="block text-left text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Bio</label>
                    <textarea
                        name="bio"
                        value={profile.bio}
                        onChange={handleChange}
                        rows={3}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none placeholder:text-slate-600"
                        placeholder="Resident physician..."
                    />
                </div>
            </div>
        </div>
    );
};
