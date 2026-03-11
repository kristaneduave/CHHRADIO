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
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-left">About</p>
                <div>
                    <label className="block text-left text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Hobbies & Interests</label>
                    <textarea
                        name="bio"
                        value={profile.bio}
                        onChange={handleChange}
                        rows={3}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none placeholder:text-slate-600"
                        placeholder="What do you like to do outside of the hospital?"
                    />
                </div>
            </div>
        </div>
    );
};
