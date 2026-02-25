import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../services/supabase';
import { Announcement } from '../types';
import { createSystemNotification, fetchAllRecipientUserIds } from '../services/newsfeedService';
import LoadingButton from './LoadingButton';
import { normalizeUserRole } from '../utils/roles';
import { sanitizeNewsContent, sanitizeNewsTitle } from '../utils/newsTextSanitizer';
import { toastInfo } from '../utils/toast';
import {
    NEWS_CATEGORY_OPTIONS,
    formatCategoryLabel,
    getNewsCategoryDefaultSymbolKey,
    getNewsSymbolAssetPath,
    normalizeCategoryForStorage,
    normalizeCategoryForUi,
} from '../utils/newsPresentation';
import { getNewsCategoryStyleTokens, NEWS_SURFACE_BASE_CLASS } from '../utils/newsStyleTokens';
import NewsActionChip from './news/NewsActionChip';

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
    const [category, setCategory] = useState(normalizeCategoryForUi(editingAnnouncement?.category || 'Announcement'));

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
    const [canSetPriorityFlags, setCanSetPriorityFlags] = useState(false);
    const [priorityColumnsSupported, setPriorityColumnsSupported] = useState(true);
    const [isPinned, setIsPinned] = useState<boolean>(Boolean(editingAnnouncement?.is_pinned));

    // New Feature State
    const icon = editingAnnouncement?.icon || '';
    const [links, setLinks] = useState<{ url: string; title: string }[]>(editingAnnouncement?.links || []);
    const [showLinkInput, setShowLinkInput] = useState(false);
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

    // Temp state for adding a new link
    const [newLinkUrl, setNewLinkUrl] = useState('');

    const categories = [...NEWS_CATEGORY_OPTIONS];
    const categoryStyles = getNewsCategoryStyleTokens(category);
    const modalSymbol = icon || getNewsCategoryDefaultSymbolKey(category);

    useEffect(() => {
        const loadRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
            const role = normalizeUserRole(data?.role);
            setCanSetPriorityFlags(['admin', 'training_officer', 'moderator'].includes(role));
        };
        loadRole();
    }, []);

    const isMissingPriorityColumnError = (error: any) => {
        const message = String(error?.message || '').toLowerCase();
        return message.includes('is_pinned') || message.includes('pinned_at');
    };

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
            const sanitizedTitle = sanitizeNewsTitle(title);
            const sanitizedContent = sanitizeNewsContent(content);

            if (!sanitizedTitle || !sanitizedContent) {
                throw new Error('Title and content cannot be empty after formatting cleanup.');
            }
            const wasSanitized = sanitizedTitle !== title || sanitizedContent !== content;

            // Upload Files
            const uploadedAttachments = [];

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

            let announcementId: string | undefined = editingAnnouncement?.id;

            if (editingAnnouncement) {
                const updatePayload: Record<string, any> = {
                    title: sanitizedTitle,
                    content: sanitizedContent,
                    category: normalizeCategoryForStorage(category),
                    image_url: finalImageUrl,
                    attachments: uploadedAttachments, // Overwrites for now (or append if we could)
                    external_link: links.length > 0 ? links[0].url : '', // Backward compat
                    links: links,
                    icon: icon || null,
                    created_at: new Date().toISOString(), // Bump
                };
                if (canSetPriorityFlags && priorityColumnsSupported) {
                    updatePayload.is_pinned = isPinned;
                    updatePayload.pinned_at = isPinned ? (editingAnnouncement?.pinned_at || new Date().toISOString()) : null;
                }

                // Update
                let updateResult = await supabase
                    .from('announcements')
                    .update(updatePayload)
                    .eq('id', editingAnnouncement.id)
                    .select('id')
                    .single();

                if (updateResult.error && isMissingPriorityColumnError(updateResult.error)) {
                    setPriorityColumnsSupported(false);
                    const fallbackPayload = { ...updatePayload };
                    delete fallbackPayload.is_pinned;
                    delete fallbackPayload.pinned_at;
                    updateResult = await supabase
                        .from('announcements')
                        .update(fallbackPayload)
                        .eq('id', editingAnnouncement.id)
                        .select('id')
                        .single();
                }

                if (updateResult.error) throw updateResult.error;
                announcementId = updateResult.data?.id;
            } else {
                const insertPayload: Record<string, any> = {
                    title: sanitizedTitle,
                    content: sanitizedContent,
                    category: normalizeCategoryForStorage(category),
                    author_id: user.id,
                    image_url: finalImageUrl,
                    attachments: uploadedAttachments,
                    external_link: links.length > 0 ? links[0].url : '',
                    links: links,
                    icon: icon || null,
                };
                if (canSetPriorityFlags && priorityColumnsSupported) {
                    insertPayload.is_pinned = isPinned;
                    insertPayload.pinned_at = isPinned ? new Date().toISOString() : null;
                }

                // Insert
                let insertResult = await supabase
                    .from('announcements')
                    .insert(insertPayload)
                    .select('id')
                    .single();

                if (insertResult.error && isMissingPriorityColumnError(insertResult.error)) {
                    setPriorityColumnsSupported(false);
                    const fallbackPayload = { ...insertPayload };
                    delete fallbackPayload.is_pinned;
                    delete fallbackPayload.pinned_at;
                    insertResult = await supabase
                        .from('announcements')
                        .insert(fallbackPayload)
                        .select('id')
                        .single();
                }

                if (insertResult.error) throw insertResult.error;
                announcementId = insertResult.data?.id;
            }

            // Emit newsfeed notification to all users.
            let notificationDeliveryWarning = '';
            try {
                const recipients = await fetchAllRecipientUserIds();
                await createSystemNotification({
                    actorUserId: user.id,
                    type: 'announcement',
                    severity: 'info',
                    title: editingAnnouncement ? 'News Updated' : 'New News',
                    message: sanitizedTitle,
                    linkScreen: 'announcements',
                    linkEntityId: announcementId,
                    recipientUserIds: recipients.length > 0 ? recipients : [user.id],
                });
            } catch (notifError) {
                // Non-blocking; announcement save succeeded already.
                console.error('Failed to emit announcement notification (bulk):', notifError);

                // Fallback: ensure at least the posting user receives a notification.
                try {
                    await createSystemNotification({
                        actorUserId: user.id,
                        type: 'announcement',
                        severity: 'info',
                        title: editingAnnouncement ? 'News Updated' : 'New News',
                        message: sanitizedTitle,
                        linkScreen: 'announcements',
                        linkEntityId: announcementId,
                        recipientUserIds: [user.id],
                    });
                } catch (selfNotifError) {
                    console.error('Failed to emit fallback self notification:', selfNotifError);
                    const errorMessage =
                        selfNotifError && typeof selfNotifError === 'object' && 'message' in selfNotifError
                            ? String((selfNotifError as { message?: string }).message || '')
                            : '';
                    notificationDeliveryWarning = `News saved, but notification delivery failed.${errorMessage ? `\n\nReason: ${errorMessage}` : ''}`;
                }
            }

            onSuccess();
            onClose();
            if (wasSanitized) {
                toastInfo('Formatting updated', 'Emoji characters were removed to keep news professional.');
            }
            if (notificationDeliveryWarning) {
                window.alert(notificationDeliveryWarning);
            }
        } catch (err: any) {
            console.error('Error saving announcement:', err);
            setError(err.message || 'Failed to save news');
        } finally {
            setLoading(false);
        }
    };

    return ReactDOM.createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300 p-4">
            <div className={`${NEWS_SURFACE_BASE_CLASS} w-full max-w-lg rounded-b-3xl rounded-t-none shadow-2xl animate-in zoom-in-95 duration-300 h-auto max-h-[82vh] flex flex-col`}>
                <span className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-b-3xl rounded-t-none">
                    <span className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-white/18 to-transparent" />
                    <span className="absolute inset-[1px] rounded-b-[1.45rem] rounded-t-none border border-white/5" />
                    <span className={`absolute left-0 right-0 top-0 h-[2px] rounded-none ${categoryStyles.railTint} opacity-15 blur-[0.5px]`} />
                    <span className="absolute left-0 right-0 top-[1px] h-[1px] rounded-none bg-[linear-gradient(90deg,rgba(255,255,255,0.34)_0%,rgba(255,255,255,0.12)_50%,rgba(255,255,255,0.3)_100%)] shadow-[0_0_6px_rgba(255,255,255,0.08)] backdrop-blur-[8px]" />
                    <span
                        className={`absolute -left-10 top-1/2 h-[24rem] w-[24rem] -translate-y-1/2 opacity-[0.025] ${categoryStyles.watermark}`}
                        style={{
                            WebkitMaskImage: `url(${getNewsSymbolAssetPath(modalSymbol)})`,
                            maskImage: `url(${getNewsSymbolAssetPath(modalSymbol)})`,
                            WebkitMaskRepeat: 'no-repeat',
                            maskRepeat: 'no-repeat',
                            WebkitMaskPosition: 'left center',
                            maskPosition: 'left center',
                            WebkitMaskSize: 'contain',
                            maskSize: 'contain',
                        }}
                    />
                </span>

                {/* Minimalist Header */}
                <div className="flex justify-end p-4 absolute top-0 right-0 z-20">
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full border border-border-default/70 bg-black/15 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                    >
                        <span className="material-icons text-lg">close</span>
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar relative z-10 pt-8">
                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl mb-6 text-sm flex items-center gap-3">
                            <span className="material-icons text-lg">error_outline</span>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} id="create-announcement-form" className="space-y-6">

                        {/* Top Controls: Type + Pin */}
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="relative">
                                <button
                                    type="button"
                                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                                    className="flex items-center gap-2 rounded-full border border-border-default/70 bg-black/15 px-3 py-1.5 text-sm font-medium text-slate-200 transition-colors hover:bg-white/[0.08]"
                                >
                                    <span className={`w-2 h-2 rounded-full ${category === 'Announcement' ? 'bg-amber-400' :
                                        category === 'Research' ? 'bg-indigo-400' :
                                            category === 'Event' ? 'bg-emerald-400' : 'bg-slate-400'
                                        }`} />
                                    {formatCategoryLabel(category)}
                                    <span className="material-icons text-sm text-slate-500 ml-1">arrow_drop_down</span>
                                </button>

                                {showCategoryDropdown && (
                                    <>
                                        <div className="fixed inset-0 z-10" onClick={() => setShowCategoryDropdown(false)} />
                                        <div className={`${NEWS_SURFACE_BASE_CLASS} absolute top-full left-0 z-20 mt-1 w-52 overflow-hidden rounded-xl shadow-xl animate-in fade-in zoom-in-95 duration-100`}>
                                            {categories.map((cat) => (
                                                <button
                                                    key={cat}
                                                    type="button"
                                                    onClick={() => {
                                                        setCategory(cat);
                                                        setShowCategoryDropdown(false);
                                                    }}
                                                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${category === cat
                                                        ? 'bg-white/[0.06] text-white'
                                                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                                                        }`}
                                                >
                                                    <span className={`w-2 h-2 rounded-full ${cat === 'Announcement' ? 'bg-amber-400' :
                                                        cat === 'Research' ? 'bg-indigo-400' :
                                                            cat === 'Event' ? 'bg-emerald-400' : 'bg-slate-400'
                                                        }`} />
                                                    {formatCategoryLabel(cat)}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                            {canSetPriorityFlags && priorityColumnsSupported && (
                                <NewsActionChip
                                    onClick={() => setIsPinned((prev) => !prev)}
                                    icon={isPinned ? 'check_circle' : 'push_pin'}
                                    className={isPinned ? 'border-amber-400/60 bg-amber-500/10 text-amber-200 hover:bg-amber-500/15' : ''}
                                >
                                    Pin this post
                                </NewsActionChip>
                            )}
                        </div>

                        {/* Title */}
                        <div className="space-y-2">
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full bg-transparent border-none p-0 text-[22px] sm:text-[24px] font-semibold leading-tight tracking-[0.005em] text-white placeholder-slate-500 focus:ring-0 focus:outline-none transition-all"
                                placeholder="What's happening?"
                                required
                            />
                        </div>

                        {/* Content */}
                        <div>
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                className="w-full bg-transparent border-none p-0 text-slate-200 placeholder-slate-500 focus:ring-0 focus:outline-none min-h-[120px] text-base leading-relaxed resize-none"
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
                            <div className="bg-white/5 rounded-xl p-2 pl-3 flex items-center gap-2 border border-white/5 focus-within:border-white/20 transition-colors animate-in fade-in slide-in-from-left-2 duration-200">
                                <span className="material-icons text-slate-500 text-sm">link</span>
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
                                    className="flex-1 bg-transparent border-none p-0 text-base md:text-sm text-blue-400 placeholder-slate-600 focus:ring-0 focus:outline-none"
                                    placeholder="https://..."
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (newLinkUrl) {
                                            setLinks(prev => [...prev, { url: newLinkUrl, title: newLinkUrl }]);
                                            setNewLinkUrl('');
                                            setShowLinkInput(false);
                                        }
                                    }}
                                    className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                                    title="Add Link"
                                >
                                    <span className="material-icons text-sm font-bold">add</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setNewLinkUrl('');
                                        setShowLinkInput(false);
                                    }}
                                    className="p-1.5 text-slate-500 hover:text-white transition-colors"
                                >
                                    <span className="material-icons text-sm">close</span>
                                </button>
                            </div>
                        )}

                        {/* Attachments Area */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-end gap-2 mb-2">
                                {/* Add Link Button */}
                                <NewsActionChip onClick={() => setShowLinkInput(true)} disabled={showLinkInput} icon="link" className="disabled:opacity-50 disabled:cursor-not-allowed">
                                    Add Link
                                </NewsActionChip>

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
                                    <label htmlFor="file-upload">
                                        <span className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border-default/70 bg-black/15 px-3 py-1.5 text-[11px] font-medium text-slate-200 transition-colors hover:bg-white/[0.08]">
                                            <span className="material-icons text-[14px]">add</span>
                                            Add Files
                                        </span>
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
                <div className="flex justify-between items-center p-4 border-t border-white/10 bg-transparent relative z-20 shrink-0">
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 text-xs font-bold text-slate-400 hover:text-white transition-colors uppercase tracking-wider"
                        >
                            Cancel
                        </button>
                        <LoadingButton
                            type="submit"
                            isLoading={loading}
                            loadingText={editingAnnouncement ? 'Saving...' : 'Posting...'}
                            icon="send"
                            form="create-announcement-form"
                            className="px-6 py-2.5 bg-gradient-to-r from-primary to-blue-600 hover:from-primary-dark hover:to-blue-700 text-white rounded-xl text-xs font-bold tracking-wide shadow-lg shadow-primary/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
                        >
                            {editingAnnouncement ? 'SAVE' : 'POST'}
                        </LoadingButton>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default CreateAnnouncementModal;

