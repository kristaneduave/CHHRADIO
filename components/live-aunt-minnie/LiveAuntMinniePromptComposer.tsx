import React, { useRef } from 'react';
import { AuntMinnieCaseOption, LiveAuntMinniePromptInput } from '../../types';

interface LiveAuntMinniePromptComposerProps {
  prompt: LiveAuntMinniePromptInput;
  auntMinnieCases: AuntMinnieCaseOption[];
  saving?: boolean;
  heading?: string;
  onClose: () => void;
  onPromptChange: (updates: Partial<LiveAuntMinniePromptInput>) => void;
  onAddPromptImage: (file: File) => Promise<void>;
  onSave: () => Promise<void>;
}

const LiveAuntMinniePromptComposer: React.FC<LiveAuntMinniePromptComposerProps> = ({
  prompt,
  auntMinnieCases,
  saving = false,
  heading = 'New question',
  onClose,
  onPromptChange,
  onAddPromptImage,
  onSave,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

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
              value=""
              onChange={(event) => {
                const selected = auntMinnieCases.find((item) => item.id === event.target.value);
                if (!selected?.imageUrl) return;
                onPromptChange({
                  source_case_id: selected.id,
                  images: [...(prompt.images || []), { image_url: selected.imageUrl, caption: selected.title }],
                  official_answer: prompt.official_answer || selected.diagnosis || '',
                  answer_explanation: prompt.answer_explanation || selected.notes || '',
                });
              }}
              className="min-w-0 flex-1 rounded-[20px] border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400/30 focus:ring-2 focus:ring-cyan-400/10"
            >
              <option value="">Library</option>
              {auntMinnieCases.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>
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
      </div>

      <div className="border-t border-white/10 px-4 py-4 sm:px-5">
        <button
          type="button"
          onClick={() => void onSave()}
          disabled={saving}
          className="w-full rounded-[20px] border border-cyan-400/20 bg-cyan-500/90 px-4 py-3.5 text-base font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Post'}
        </button>
      </div>
    </section>
  );
};

export default LiveAuntMinniePromptComposer;
