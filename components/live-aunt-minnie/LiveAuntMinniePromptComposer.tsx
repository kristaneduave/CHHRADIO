import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AuntMinnieCaseOption, LiveAuntMinniePromptInput } from '../../types';

type QuestionMode = 'identify' | 'diagnosis' | 'custom';

interface LiveAuntMinniePromptComposerProps {
  prompt: LiveAuntMinniePromptInput;
  questionNumber: number;
  auntMinnieCases: AuntMinnieCaseOption[];
  saving?: boolean;
  postActionLabel?: string;
  onClose: () => void;
  onPromptChange: (updates: Partial<LiveAuntMinniePromptInput>) => void;
  onAddPromptImage: (file: File) => Promise<void>;
  onSave: () => Promise<void>;
}

const IDENTIFY_TEMPLATE = 'Identify the structure/s.';
const DIAGNOSIS_TEMPLATE = 'What is the diagnosis?';

const getModeFromQuestionText = (value?: string): QuestionMode => {
  const text = value?.trim() || '';
  if (!text) return 'identify';
  if (text === IDENTIFY_TEMPLATE || text.startsWith(IDENTIFY_TEMPLATE)) return 'identify';
  if (text === DIAGNOSIS_TEMPLATE || text.startsWith(DIAGNOSIS_TEMPLATE)) return 'diagnosis';
  return 'custom';
};

const getPlaceholderByMode = (mode: QuestionMode) => {
  if (mode === 'identify') return 'Add instructions for what users should identify';
  if (mode === 'diagnosis') return 'Add instructions or qualifiers for the diagnosis question';
  return 'Write any question for this image set';
};

const LiveAuntMinniePromptComposer: React.FC<LiveAuntMinniePromptComposerProps> = ({
  prompt,
  questionNumber,
  auntMinnieCases,
  saving = false,
  postActionLabel = 'Post',
  onClose,
  onPromptChange,
  onAddPromptImage,
  onSave,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState('');
  const [questionMode, setQuestionMode] = useState<QuestionMode>(() => getModeFromQuestionText(prompt.question_text));

  const selectedCase = useMemo(
    () => auntMinnieCases.find((item) => item.id === selectedCaseId) || null,
    [auntMinnieCases, selectedCaseId],
  );

  useEffect(() => {
    if (selectedCaseId && !selectedCase) {
      setSelectedCaseId('');
    }
  }, [selectedCase, selectedCaseId]);

  useEffect(() => {
    setQuestionMode(getModeFromQuestionText(prompt.question_text));
  }, [prompt.id, prompt.question_text]);

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
          caption: '',
        },
      ],
    });
  };

  const applyQuestionMode = (mode: QuestionMode) => {
    setQuestionMode(mode);

    if (mode === 'identify') {
      onPromptChange({ question_text: IDENTIFY_TEMPLATE });
      return;
    }

    if (mode === 'diagnosis') {
      onPromptChange({ question_text: DIAGNOSIS_TEMPLATE });
      return;
    }

    const currentText = prompt.question_text?.trim() || '';
    if (currentText === IDENTIFY_TEMPLATE || currentText === DIAGNOSIS_TEMPLATE) {
      onPromptChange({ question_text: '' });
    }
  };

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-t-[28px] border border-white/10 bg-[#101b26] shadow-[0_-24px_60px_rgba(3,10,18,0.5)] md:rounded-none md:border-l md:border-t-0">
      <div className="mx-auto mt-3 h-1.5 w-14 rounded-full bg-white/10 md:hidden" />

      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <div>
          <p className="text-lg font-semibold text-white">Question {questionNumber}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-200 transition hover:bg-white/10"
        >
          Close
        </button>
      </div>

      <div className="mobile-nav-clearance flex-1 space-y-4 overflow-y-auto px-4 pb-10 sm:px-5 sm:pb-24">
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

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => applyQuestionMode('identify')}
              className={`rounded-[18px] border px-3 py-2.5 text-sm font-semibold transition ${
                questionMode === 'identify'
                  ? 'border-cyan-400/30 bg-cyan-500/15 text-cyan-100'
                  : 'border-white/10 bg-black/20 text-slate-300 hover:bg-white/10'
              }`}
            >
              Identify structure/s
            </button>
            <button
              type="button"
              onClick={() => applyQuestionMode('diagnosis')}
              className={`rounded-[18px] border px-3 py-2.5 text-sm font-semibold transition ${
                questionMode === 'diagnosis'
                  ? 'border-cyan-400/30 bg-cyan-500/15 text-cyan-100'
                  : 'border-white/10 bg-black/20 text-slate-300 hover:bg-white/10'
              }`}
            >
              Diagnosis?
            </button>
            <button
              type="button"
              onClick={() => applyQuestionMode('custom')}
              className={`rounded-[18px] border px-3 py-2.5 text-sm font-semibold transition ${
                questionMode === 'custom'
                  ? 'border-cyan-400/30 bg-cyan-500/15 text-cyan-100'
                  : 'border-white/10 bg-black/20 text-slate-300 hover:bg-white/10'
              }`}
            >
              Custom
            </button>
          </div>

          <textarea
            value={prompt.question_text || ''}
            onChange={(event) => {
              const nextValue = event.target.value;
              onPromptChange({ question_text: nextValue });
              if (!nextValue.trim()) {
                setQuestionMode('custom');
                return;
              }
              setQuestionMode(getModeFromQuestionText(nextValue));
            }}
            placeholder={getPlaceholderByMode(questionMode)}
            className="min-h-[108px] w-full rounded-[22px] border border-white/10 bg-black/30 px-4 py-3 text-base text-white outline-none transition focus:border-cyan-400/30 focus:ring-2 focus:ring-cyan-400/10"
          />
        </div>

      </div>

      <div className="mobile-sheet-footer-clearance border-t border-white/10 bg-[#101b26] px-4 py-4 sm:px-5">
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
