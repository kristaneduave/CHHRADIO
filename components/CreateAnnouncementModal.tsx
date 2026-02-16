
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../services/supabase';
import { Announcement } from '../types';

interface CreateAnnouncementModalProps {
    onClose: () => void;
    onSuccess: () => void;
    editingAnnouncement?: Announcement | null;
}

interface Attachment {
    file: File;
    preview?: string;
    id: string; // temp id for UI
}

const CreateAnnouncementModal: React.FC<CreateAnnouncementModalProps> = ({ onClose, onSuccess, editingAnnouncement }) => {
    const [title, setTitle] = useState(editingAnnouncement?.title || '');
    const [content, setContent] = useState(editingAnnouncement?.content || '');
    // Handle legacy mappings
    const [category, setCategory] = useState(
        (editingAnnouncement?.category === 'Miscellaneous' ? 'Misc' : editingAnnouncement?.category) || 'Announcement'
    );

    // File State
    const [attachments, setAttachments] = useState<Attachment[]>([]);
    // If editing, we might have existing attachments. For now, we only handle new uploads or clearing existing "main" image.
    // To support full editing of existing array, we'd need to fetch them. 
    // Given the timeline, we'll treat "image_url" as the "Cover Image" and manage new attachments separately or merged?
    // Plan: We will store ALL new files in 'attachments'. We will use the FIRST image as 'image_url' for backward compatibility.
    // Existing image is kept in `existingCoverImage` state.

    const [existingCoverImage, setExistingCoverImage] = useState<string | null>(editingAnnouncement?.imageUrl || null);

    const [externalLink, setExternalLink] = useState(editingAnnouncement?.externalLink || '');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    // New Feature State
    const [icon, setIcon] = useState(editingAnnouncement?.icon || '📣');
    const [links, setLinks] = useState<{ url: string; title: string }[]>(editingAnnouncement?.links || []);
    const [showLinkInput, setShowLinkInput] = useState(false);

    // Temp state for adding a new link
    const [newLinkUrl, setNewLinkUrl] = useState('');

    const categories = ['Announcement', 'Research', 'Event', 'Misc'];
    const emojis = ['📣', '😊', '😂', '🔥', '👍', '🎉', '❤️', '🏥', '💊', '🩺', '🚑', '🧪', '📋', '✅', '⚠️', '📎', '📅', '👋', '🌟', '💡'];

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files) as File[];
            const totalFiles = attachments.length + newFiles.length;

            if (totalFiles > 8) {
                setError('Maximum 8 files allowed.');
                return;
            }

            const processedFiles: Attachment[] = newFiles.map(file => ({
                file,
                id: Math.random().toString(36).substr(2, 9),
                preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined
            }));

            // Validate sizes
            const invalidFile = processedFiles.find(a => a.file.size > 20 * 1024 * 1024);
            if (invalidFile) {
                setError(`File ${invalidFile.file.name} is too large (max 20MB).`);
                return;
            }

            setAttachments(prev => [...prev, ...processedFiles]);
            setError(null);
        }
    };

    const removeAttachment = (id: string) => {
        setAttachments(prev => prev.filter(a => a.id !== id));
    };

    const removeExistingCover = () => {
        setExistingCoverImage(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Not authenticated');

            // Upload Files
            const uploadedAttachments = [];
            let newCoverImageUrl = null;

            for (const att of attachments) {
                const file = att.file;
                const fileExt = file.name.split('.').pop();
                const fileName = `${Math.random()}.${fileExt}`;
                const filePath = `${user.id}/${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('announcements')
                    .upload(filePath, file);

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('announcements')
                    .getPublicUrl(filePath);

                uploadedAttachments.push({
                    url: publicUrl,
                    type: file.type,
                    name: file.name,
                    size: file.size
                });
            }

            // Determine Cover Image
            // If we have an existing cover and haven't deleted it, use it.
            // If we uploaded new images, maybe use the first one as cover if no existing cover?
            // User requested "photo upload". We will stick to: `image_url` is the dedicated cover.
            // If `attachments` has images, `image_url` effectively becomes redundant or the "Main" one.
            // Logic: If `existingCoverImage` is null, and we have new uploaded images, take the first one as `image_url`.

            let finalImageUrl = existingCoverImage;

            // Find first image in new uploads
            const firstNewImage = uploadedAttachments.find(a => a.type.startsWith('image/'));

            if (!finalImageUrl && firstNewImage) {
                finalImageUrl = firstNewImage.url;
            }

            // Determine Attachments Array to save
            // This merges new uploads. What about preserving old `attachments` if we were editing?
            // Currently `editingAnnouncement` doesn't have `attachments` in the object passed from parent yet (unless we fetch).
            // For now, we just append new ones. 
            // NOTE: This implementation replaces/adds. Real production needs full edit capability of arrays.
            // Given the scope, we will save `uploadedAttachments` as the attachments.

            if (editingAnnouncement) {
                // Update
                const { error: updateError } = await supabase
                    .from('announcements')
                    .update({
                        title,
                        content,
                        category,
                        image_url: finalImageUrl,
                        attachments: uploadedAttachments, // Overwrites for now (or append if we could)
                        external_link: links.length > 0 ? links[0].url : '', // Backward compat
                        links: links,
                        icon: icon,
                        created_at: new Date().toISOString() // Bump
                    })
                    .eq('id', editingAnnouncement.id);

                if (updateError) throw updateError;
            } else {
                // Insert
                const { error: insertError } = await supabase.from('announcements').insert({
                    title,
                    content,
                    category,
                    author_id: user.id,
                    image_url: finalImageUrl,
                    attachments: uploadedAttachments,
                    external_link: links.length > 0 ? links[0].url : '',
                    links: links,
                    icon: icon
                });

                if (insertError) throw insertError;
            }

            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Error saving announcement:', err);
            setError(err.message || 'Failed to save announcement');
        } finally {
            setLoading(false);
        }
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 p-4">
            <div className="w-full max-w-lg bg-[#0c1829] border border-white/10 rounded-3xl shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300 relative overflow-hidden h-auto max-h-[85vh] flex flex-col">
                {/* Background Glow */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2" />

                {/* Minimalist Header */}
                <div className="flex justify-end p-4 absolute top-0 right-0 z-20">
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                    >
                        <span className="material-icons text-lg">close</span>
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar relative z-10 pt-12">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-sm flex items-center gap-3">
                            <span className="material-icons text-lg">error_outline</span>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} id="create-announcement-form" className="space-y-6">

                        {/* Title & Icon Header */}
                        <div className="flex items-start gap-4">
                            {/* Icon Selector */}
                            <div className="relative shrink-0 pt-1">
                                <button
                                    type="button"
                                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                                    className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-2xl shadow-lg shadow-black/20"
                                >
                                    {icon}
                                </button>
                                {showEmojiPicker && (
                                    <div className="absolute top-14 left-0 bg-[#0F1720] border border-white/10 rounded-xl shadow-xl p-2 w-64 grid grid-cols-5 gap-1 z-50 animate-in fade-in zoom-in-95 duration-200">
                                        {emojis.map(emoji => (
                                            <button
                                                key={emoji}
                                                type="button"
                                                onClick={() => {
                                                    setIcon(emoji);
                                                    setShowEmojiPicker(false);
                                                }}
                                                className="w-10 h-10 flex items-center justify-center text-xl hover:bg-white/10 rounded-lg transition-colors"
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Title Input */}
                            <div className="flex-1 space-y-2">
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    className="w-full bg-transparent border-none p-0 text-2xl sm:text-3xl font-bold text-white placeholder-slate-600 focus:ring-0 focus:outline-none transition-all"
                                    placeholder="What's happening?"
                                    autoFocus
                                    required
                                />
                            </div>
                        </div>

                        {/* Category Pills */}
                        {/* Category Pills */}
                        <div className="flex flex-wrap gap-2 pb-2">
                            {categories.map((cat) => (
                                <button
                                    key={cat}
                                    type="button"
                                    onClick={() => setCategory(cat)}
                                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap border ${category === cat
                                        ? 'bg-primary text-white border-primary shadow-lg shadow-primary/25'
                                        : 'bg-white/5 border-white/5 text-slate-400 hover:bg-white/10 hover:border-white/10 hover:text-slate-200'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {/* Content */}
                        <div>
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                className="w-full bg-transparent border-none p-0 text-slate-300 placeholder-slate-600 focus:ring-0 focus:outline-none min-h-[120px] text-base leading-relaxed resize-none"
                                placeholder="Share the details..."
                                required
                            />
                        </div>

                        {/* Links List */}
                        {links.length > 0 && (
                            <div className="space-y-2">
                                {links.map((link, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 group">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
                                                <span className="material-icons text-sm">link</span>
                                            </div>
                                            <span className="text-sm text-blue-400 truncate underline decoration-blue-500/30">{link.url}</span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setLinks(prev => prev.filter((_, i) => i !== idx))}
                                            className="text-slate-500 hover:text-red-400 transition-colors p-1"
                                        >
                                            <span className="material-icons text-sm">close</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Link Input Logic */}
                        {showLinkInput && (
                            <div className="bg-white/5 rounded-xl p-3 flex items-center gap-3 border border-white/5 focus-within:border-white/20 transition-colors animate-in fade-in slide-in-from-left-2 duration-200">
                                <span className="material-icons text-slate-500">link</span>
                                <input
                                    type="url"
                                    value={newLinkUrl}
                                    onChange={(e) => setNewLinkUrl(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (newLinkUrl) {
                                                setLinks(prev => [...prev, { url: newLinkUrl, title: newLinkUrl }]);
                                                setNewLinkUrl('');
                                                setShowLinkInput(false);
                                            }
                                        }
                                    }}
                                    className="w-full bg-transparent border-none p-0 text-sm text-blue-400 placeholder-slate-600 focus:ring-0 focus:outline-none"
                                    placeholder="https://... (Press Enter to add)"
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setNewLinkUrl('');
                                        setShowLinkInput(false);
                                    }}
                                    className="text-slate-500 hover:text-white transition-colors"
                                >
                                    <span className="material-icons text-sm">close</span>
                                </button>
                            </div>
                        )}

                        {/* Attachments Area */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-end gap-2 mb-2">
                                {/* Add Link Button */}
                                <button
                                    type="button"
                                    onClick={() => setShowLinkInput(true)}
                                    disabled={showLinkInput}
                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-blue-400 hover:text-blue-300 transition-all cursor-pointer border border-blue-500/20 hover:border-blue-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <span className="material-icons text-sm">link</span>
                                    <span className="text-[10px] font-bold uppercase tracking-wide">Add Link</span>
                                </button>

                                {/* Add Files Button */}
                                <div className="relative">
                                    <input
                                        type="file"
                                        multiple
                                        accept="image/*, .pdf, .doc, .docx"
                                        onChange={handleFileSelect}
                                        id="file-upload"
                                        className="hidden"
                                    />
                                    <label
                                        htmlFor="file-upload"
                                        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-primary hover:text-primary-light transition-all cursor-pointer border border-primary/20 hover:border-primary/50"
                                    >
                                        <span className="material-icons text-sm">add</span>
                                        <span className="text-[10px] font-bold uppercase tracking-wide">Add Files</span>
                                    </label>
                                </div>
                            </div>

                            {/* Existing Cover Image (if editing) */}
                            {existingCoverImage && (
                                <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 group">
                                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/30 shrink-0">
                                        <img src={existingCoverImage} alt="Cover" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-xs font-bold text-white truncate">Current Cover Image</p>
                                        <p className="text-[10px] text-slate-500">Will be kept unless removed</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={removeExistingCover}
                                        className="w-7 h-7 flex items-center justify-center rounded-full bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                                    >
                                        <span className="material-icons text-sm">delete</span>
                                    </button>
                                </div>
                            )}

                            {/* New Attachments List */}
                            <div className="grid grid-cols-1 gap-2">
                                {attachments.map((att) => (
                                    <div key={att.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10 group animate-in slide-in-from-bottom-2 duration-200">
                                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-black/30 shrink-0 flex items-center justify-center border border-white/5">
                                            {att.preview ? (
                                                <img src={att.preview} alt="Preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <span className="material-icons text-slate-400 text-lg">description</span>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-xs font-bold text-white truncate">{att.file.name}</p>
                                            <p className="text-[10px] text-slate-500">{(att.file.size / 1024 / 1024).toFixed(2)} MB</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeAttachment(att.id)}
                                            className="w-7 h-7 flex items-center justify-center rounded-full bg-white/5 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-colors"
                                        >
                                            <span className="material-icons text-sm">close</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>

                    </form>
                </div>

                {/* Footer - Fixed */}
                <div className="flex justify-between items-center p-4 border-t border-white/5 bg-[#0c1829] relative z-20 shrink-0">
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            form="create-announcement-form"
                            className="px-6 py-2.5 bg-gradient-to-r from-primary to-blue-600 hover:from-primary-dark hover:to-blue-700 text-white rounded-xl text-xs font-bold tracking-wide shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <span className="material-icons animate-spin text-sm">sync</span>
                                    Posting...
                                </>
                            ) : (
                                <>
                                    <span>POST</span>
                                    <span className="material-icons text-sm">send</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CreateAnnouncementModal;
