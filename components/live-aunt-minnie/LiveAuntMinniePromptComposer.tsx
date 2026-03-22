import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AuntMinnieCaseOption, LiveAuntMinniePromptInput } from '../../types';

interface LiveAuntMinniePromptComposerProps {
  prompt: LiveAuntMinniePromptInput;
  auntMinnieCases: AuntMinnieCaseOption[];
  saving?: boolean;
  heading?: string;
  delaySeconds?: number | null;
  postActionLabel?: string;
  postModeSummary?: string;
  onClose: () => void;
  onDelaySecondsChange?: (value: number | null) => void;
  onPromptChange: (updates: Partial<LiveAuntMinniePromptInput>) => void;
  onAddPromptImage: (file: File) => Promise<void>;
  onSave: () => Promise<void>;
}

const LiveAuntMinniePromptComposer: React.FC<LiveAuntMinniePromptComposerProps> = ({
  prompt,
  auntMinnieCases,
  saving = false,
  heading = 'New question',
  delaySeconds = null,
  postActionLabel = 'Post',
  postModeSummary,
  onClose,
  onDelaySecondsChange,
  onPromptChange,
  onAddPromptImage,
  onSave,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState('');

  const selectedCase = useMemo(
    () => auntMinnieCases.find((item) => item.id === selectedCaseId) || null,
    [auntMinnieCases, selectedCaseId],
  );

  useEffect(() => {
    if (selectedCaseId && !selectedCase) {
      setSelectedCaseId('');
    }
  }, [selectedCase, selectedCaseId]);

  const formatSourceLabel = (item: AuntMinnieCaseOption) => {
    if (item.submissionType === 'interesting_case') return 'Interesting Case';
    if (item.submissionType === 'rare_pathology') return 'Rare Pathology';
    return 'Aunt Minnie';
  };

  const selectedCaseImages = selectedCase?.imageUrls?.length
    ? selectedCase.imageUrls
    : selectedCase?.imageUrl
      ? [selectedCase.imageUrl]
      : [];

  const appendLibraryImage = (selected: AuntMinnieCaseOption, imageUrl: string, imageIndex: number) => {
    const existingImages = prompt.images || [];
    const duplicateExists = existingImages.some((image) => image.image_url === imageUrl);
    if (duplicateExists) {
      return;
    }

    onPromptChange({
      source_case_id: selected.id,
      images: [
        ...existingImages,
        {
          image_url: imageUrl,
          caption:
            selectedCaseImages.length > 1
              ? `${selected.title} ${imageIndex + 1}`
              : selected.title,
        },
      ],
      official_answer: prompt.official_answer || selected.diagnosis || '',
      answer_explanation: prompt.answer_explanation || selected.notes || '',
    });
  };

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#101b26] shadow-[0_-24px_60px_rgba(3,10,18,0.5)] md:rounded-none md:border-l md:border-t-0">
      <div className="mx-auto mt-3 h-1.5 w-14 rounded-full bg-white/10 md:hidden" />

      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div>
          <p className="text-lg font-semibold text-white">{heading}</p>
          <p className="text-sm text-slate-400">Images first, prompt second.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10"
        >
          Close
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-5 sm:px-5">
        <div className="space-y-3">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              const files = Array.from(event.target.files || []);
              files.forEach((file) => {
                void onAddPromptImage(file);
              });
              event.currentTarget.value = '';
            }}
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex-1 rounded-[20px] border border-cyan-400/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15"
            >
              Add image
            </button>
            <select
              value={selectedCaseId}
              onChange={(event) => {
                setSelectedCaseId(event.target.value);
              }}
              className="min-w-0 flex-1 rounded-[20px] border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/30 focus:ring-2 focus:ring-cyan-400/10"
            >
              <option value="">Case library</option>
              {auntMinnieCases.map((item) => (
                <option key={item.id} value={item.id}>
                  [{formatSourceLabel(item)}] {item.title}
                </option>
              ))}
            </select>
          </div>

          {selectedCase ? (
            <div className="rounded-[22px] border border-white/10 bg-black/20 p-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{selectedCase.title}</p>
                  <p className="text-xs text-slate-400">
                    {formatSourceLabel(selectedCase)}{selectedCaseImages.length > 1 ? ` • Choose image` : ' • Tap to add'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCaseId('')}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium text-slate-300 transition hover:bg-white/10"
                >
                  Clear
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {selectedCaseImages.map((imageUrl, imageIndex) => {
                  const alreadyAdded = (prompt.images || []).some((image) => image.image_url === imageUrl);
                  return (
                    <button
                      key={`${selectedCase.id}:${imageUrl}:${imageIndex}`}
                      type="button"
                      onClick={() => appendLibraryImage(selectedCase, imageUrl, imageIndex)}
                      disabled={alreadyAdded}
                      className="group overflow-hidden rounded-[18px] border border-white/10 bg-[#0b131c] text-left transition hover:border-cyan-400/30 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <div className="relative">
                        <img
                          src={imageUrl}
                          alt={`${selectedCase.title} ${imageIndex + 1}`}
                          className="h-24 w-full object-cover"
                        />
                        <div className="absolute left-2 top-2 rounded-full bg-slate-950/85 px-2 py-1 text-[11px] font-semibold text-white">
                          {imageIndex + 1}
                        </div>
                      </div>
                      <div className="px-3 py-2">
                        <p className="text-xs font-medium text-slate-200">
                          {alreadyAdded ? 'Added' : 'Use image'}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          {(prompt.images || []).length === 0 ? (
            <div className="flex min-h-[180px] items-center justify-center rounded-[22px] border border-dashed border-white/10 bg-black/20 text-sm text-slate-500">
              No images
            </div>
          ) : (
            (prompt.images || []).map((image, imageIndex) => (
              <div key={`${image.image_url}:${imageIndex}`} className="overflow-hidden rounded-[22px] border border-white/10 bg-black/20">
                <div className="relative">
                  <img
                    src={image.image_url}
                    alt={`Question image ${imageIndex + 1}`}
                    className="h-48 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const nextImages = (prompt.images || []).filter((_, currentIndex) => currentIndex !== imageIndex);
                      onPromptChange({ images: nextImages });
                    }}
                    className="absolute right-3 top-3 rounded-full border border-black/20 bg-slate-950/80 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    Remove
                  </button>
                </div>
                <div className="border-t border-white/10 p-3">
                  <input
                    value={image.caption || ''}
                    onChange={(event) => {
                      const nextImages = (prompt.images || []).map((currentImage, currentIndex) =>
                        currentIndex === imageIndex ? { ...currentImage, caption: event.target.value } : currentImage,
                      );
                      onPromptChange({ images: nextImages });
                    }}
                    placeholder="Caption (optional)"
                    className="w-full rounded-2xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition focus:border-cyan-400/30 focus:ring-2 focus:ring-cyan-400/10"
                  />
                </div>
              </div>
            ))
          )}
        </div>

        <label className="block space-y-2">
          <span className="text-sm font-semibold text-slate-300">Prompt</span>
          <textarea
            value={prompt.question_text || ''}
            onChange={(event) => onPromptChange({ question_text: event.target.value })}
            placeholder="What should they identify?"
            className="min-h-[108px] w-full rounded-[22px] border border-white/10 bg-black/30 px-4 py-3 text-base text-white outline-none transition focus:border-cyan-400/30 focus:ring-2 focus:ring-cyan-400/10"
          />
        </label>

        {onDelaySecondsChange && (
          <label className="block space-y-2">
            <span className="text-sm font-semibold text-slate-300">When to post</span>
            <select
              value={delaySeconds ?? ''}
              onChange={(event) => {
                const nextValue = event.target.value ? Number(event.target.value) : null;
                onDelaySecondsChange(nextValue);
              }}
              className="w-full rounded-[20px] border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/30 focus:ring-2 focus:ring-cyan-400/10"
            >
              <option value="">Immediate</option>
              <option value="15">15 sec</option>
              <option value="30">30 sec</option>
              <option value="45">45 sec</option>
              <option value="60">60 sec</option>
            </select>
          </label>
        )}
      </div>

      <div className="border-t border-white/10 px-4 py-4 sm:px-5">
        {postModeSummary && (
          <p className="mb-3 text-xs text-slate-400">
            {postModeSummary}
          </p>
        )}
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving}
          className="w-full rounded-[20px] border border-cyan-400/20 bg-cyan-500/90 px-4 py-3.5 text-base font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving...' : postActionLabel}
        </button>
      </div>
    </section>
  );
};

export default LiveAuntMinniePromptComposer;
