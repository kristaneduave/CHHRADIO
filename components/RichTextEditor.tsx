import React, { useEffect, useMemo, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';
import { mergeAttributes } from '@tiptap/core';

type ToolbarMode = 'compact' | 'expanded';
type EditorSurface = 'dark' | 'paper';

const StyledText = TextStyle.extend({
  addAttributes() {
    return {
      color: {
        default: null,
        parseHTML: (element) => element.style.color || null,
        renderHTML: (attributes) => {
          if (!attributes.color) return {};
          return {
            style: `color: ${attributes.color}`,
          };
        },
      },
      fontSize: {
        default: null,
        parseHTML: (element) => element.style.fontSize || null,
        renderHTML: (attributes) => {
          if (!attributes.fontSize) return {};
          return {
            style: `font-size: ${attributes.fontSize}`,
          };
        },
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },
});

const MIN_EDITOR_FONT_SIZE = 12;
const MAX_EDITOR_FONT_SIZE = 20;
const DEFAULT_EDITOR_FONT_SIZE = 14;

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number | string;
  toolbarMode?: ToolbarMode;
  autoFocus?: boolean;
  className?: string;
  editorClassName?: string;
  onOpenFocusMode?: () => void;
  showFocusButton?: boolean;
  surface?: EditorSurface;
}

const getMinHeightValue = (minHeight?: number | string) => {
  if (typeof minHeight === 'number') return `${minHeight}px`;
  return minHeight || '240px';
};

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 240,
  toolbarMode = 'compact',
  autoFocus = false,
  className = '',
  editorClassName = '',
  onOpenFocusMode,
  showFocusButton = false,
  surface = 'dark',
}: RichTextEditorProps) {
  const minHeightValue = useMemo(() => getMinHeightValue(minHeight), [minHeight]);
  const isExpanded = toolbarMode === 'expanded';
  const scrollAreaClassName = toolbarMode === 'expanded'
    ? 'rich-editor-scroll-area rich-editor-scroll-area-expanded'
    : 'rich-editor-scroll-area rich-editor-scroll-area-compact';
  const isPaperSurface = surface === 'paper';
  const editorContentClassName = isPaperSurface
    ? `rich-editor-content rich-editor-content-paper h-full rounded-b-[22px] rounded-t-none bg-white px-6 py-5 text-sm text-slate-900 shadow-[0_18px_45px_rgba(15,23,42,0.14)] focus:outline-none ${editorClassName}`.trim()
    : `rich-editor-content h-full rounded-b-2xl bg-black/40 px-5 py-4 text-sm text-white focus:outline-none ${editorClassName}`.trim();
  const wrapperClassName = isPaperSurface
    ? 'flex flex-col overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-colors focus-within:border-cyan-500/22'
    : 'flex flex-col overflow-hidden rounded-[24px] border border-white/5 bg-white/[0.03] transition-colors focus-within:border-cyan-500/22';
  const editorThemeStyle = useMemo<React.CSSProperties>(() => ({
    ['--rich-editor-heading-color' as string]: isPaperSurface ? '#0f172a' : '#f8fafc',
    ['--rich-editor-blockquote-border' as string]: isPaperSurface ? 'rgba(14, 165, 233, 0.35)' : 'rgba(34, 211, 238, 0.55)',
    ['--rich-editor-blockquote-bg' as string]: isPaperSurface ? 'rgba(241, 245, 249, 0.92)' : 'rgba(15, 23, 42, 0.75)',
    ['--rich-editor-blockquote-color' as string]: isPaperSurface ? '#334155' : '#dbeafe',
    ['--rich-editor-paper-edge' as string]: 'rgba(148, 163, 184, 0.2)',
  }), [isPaperSurface]);
  const toolbarClassName = isPaperSurface
    ? `rich-editor-toolbar-expanded rounded-t-[28px] flex flex-wrap items-center justify-center gap-2 border-b border-white/10 bg-white/[0.04] px-4 py-3 ${isExpanded ? 'sticky top-0 z-10 backdrop-blur-xl' : ''}`
    : `rich-editor-toolbar-expanded rounded-t-[24px] flex flex-wrap items-center justify-center gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-3 ${isExpanded ? 'sticky top-0 z-10 backdrop-blur-xl' : ''}`;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      StyledText,
    ],
    content: value || '',
    autofocus: autoFocus,
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
    editorProps: {
      attributes: {
        class: editorContentClassName,
        'data-placeholder': placeholder || '',
      },
    },
  });

  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    if (value !== currentHtml) {
      editor.commands.setContent(value || '', false, {
        preserveWhitespace: 'full',
      });
    }
  }, [editor, value]);

  const toolbarButtonBase = 'rounded-lg px-2.5 py-2 text-sm font-semibold transition-colors sm:px-3';
  const textColors = [
    { label: 'Default', value: '', swatch: 'transparent' },
    { label: 'Amber', value: '#78350f', swatch: '#92400e' },
    { label: 'Rose', value: '#881337', swatch: '#9f1239' },
    { label: 'Emerald', value: '#14532d', swatch: '#166534' },
    { label: 'Blue', value: '#1d4ed8', swatch: '#2563eb' },
    { label: 'Violet', value: '#6d28d9', swatch: '#7c3aed' },
    { label: 'Red', value: '#b91c1c', swatch: '#dc2626' },
  ];

  if (!editor) {
    return null;
  }

  const withSelection = (currentEditor: Editor, callback: () => void) => {
    const { from, to, empty } = currentEditor.state.selection;
    if (empty || from === to) return;
    callback();
  };

  const applyTextColor = (color: string) => {
    withSelection(editor, () => {
      const chain = editor.chain().focus();
      if (!color) {
        chain.setMark('textStyle', { color: null }).removeEmptyTextStyle().run();
        return;
      }
      chain.setMark('textStyle', { color }).run();
    });
  };

  const getSelectionFontSize = () => {
    const rawSize = editor.getAttributes('textStyle').fontSize;
    const parsed = rawSize ? Number.parseInt(String(rawSize), 10) : NaN;
    return Number.isFinite(parsed) ? parsed : DEFAULT_EDITOR_FONT_SIZE;
  };

  const applyFontSize = (nextSize: number) => {
    const clamped = Math.max(MIN_EDITOR_FONT_SIZE, Math.min(MAX_EDITOR_FONT_SIZE, nextSize));
    editor.chain().focus().setMark('textStyle', { fontSize: `${clamped}px` }).run();
  };

  const changeFontSize = (delta: number) => {
    applyFontSize(getSelectionFontSize() + delta);
  };

  const clearTextFormatting = () => {
    editor
      .chain()
      .focus()
      .unsetMark('bold')
      .unsetMark('textStyle')
      .removeEmptyTextStyle()
      .run();
  };

  return (
    <>
      <div className={`${wrapperClassName} ${className}`.trim()} style={editorThemeStyle}>
        <div className={toolbarClassName}>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`${toolbarButtonBase} ${editor.isActive('bold') ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
          title="Bold"
        >
          <span className="material-icons text-[18px]">format_bold</span>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`${toolbarButtonBase} ${editor.isActive('bulletList') ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
          title="Bullet List"
        >
          <span className="material-icons text-[18px]">format_list_bulleted</span>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`${toolbarButtonBase} ${editor.isActive('orderedList') ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
          title="Numbered List"
        >
          <span className="material-icons text-[18px]">format_list_numbered</span>
        </button>
        <div className="rich-editor-toolbar-divider mx-1 hidden h-4 w-px bg-white/10 sm:block" />
        <div className="rich-editor-style-pill flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-2 py-1">
          <button
            type="button"
            onClick={() => changeFontSize(-1)}
            className="flex h-7 min-w-[30px] items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            title={`Decrease font size (min ${MIN_EDITOR_FONT_SIZE}px)`}
          >
            <span className="text-[13px] font-bold">A-</span>
          </button>
          <span className="min-w-[42px] text-center text-[11px] font-semibold text-slate-300">
            {getSelectionFontSize()}px
          </span>
          <button
            type="button"
            onClick={() => changeFontSize(1)}
            className="flex h-7 min-w-[30px] items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
            title={`Increase font size (max ${MAX_EDITOR_FONT_SIZE}px)`}
          >
            <span className="text-[13px] font-bold">A+</span>
          </button>
        </div>
        <button
          type="button"
          onClick={clearTextFormatting}
          className="rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
          title="Clear text formatting"
        >
          Clear
        </button>
        <div className="rich-editor-style-pill flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2 py-1">
          <span className="min-w-[82px] px-1 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Text Color</span>
          {textColors.map((color) => (
            <button
              key={`inline-text-${color.label}`}
              type="button"
              onClick={() => applyTextColor(color.value)}
              className={`flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                color.value
                  ? 'border-white/10 bg-white/[0.04] hover:bg-white/10'
                  : 'border-white/10 bg-transparent text-slate-400 hover:bg-white/10 hover:text-white'
              }`}
              title={color.label}
            >
              {color.value ? (
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color.swatch }} />
              ) : (
                <span className="material-icons text-[14px]">format_color_reset</span>
              )}
            </button>
          ))}
        </div>

        {isExpanded && (
          <>
            <button
              type="button"
              onClick={() => editor.chain().focus().undo().run()}
              className={`${toolbarButtonBase} text-slate-400 hover:bg-white/10 hover:text-white`}
              title="Undo"
            >
              <span className="material-icons text-[18px]">undo</span>
            </button>
            <button
              type="button"
              onClick={() => editor.chain().focus().redo().run()}
              className={`${toolbarButtonBase} text-slate-400 hover:bg-white/10 hover:text-white`}
              title="Redo"
            >
              <span className="material-icons text-[18px]">redo</span>
            </button>
          </>
        )}

        <div className="rich-editor-toolbar-actions flex w-full items-center justify-center pt-1">
          {showFocusButton && onOpenFocusMode && (
            <button
              type="button"
              onClick={onOpenFocusMode}
              className="min-w-[176px] rounded-xl bg-cyan-500/15 px-4 py-2 text-xs font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/20"
            >
              Open Full Editor
            </button>
          )}
        </div>
        </div>

        <style>{`
          @media (max-width: 767px) {
            .rich-editor-toolbar-expanded {
              display: flex;
              flex-wrap: wrap;
              justify-content: center;
              align-items: center;
              gap: 0.5rem;
            }

            .rich-editor-toolbar-expanded .rich-editor-toolbar-divider {
              display: none;
            }

            .rich-editor-toolbar-expanded .rich-editor-style-pill {
              width: 100%;
              justify-content: center;
            }

            .rich-editor-toolbar-expanded .rich-editor-toolbar-actions {
              justify-content: center;
              padding-top: 0;
              width: auto;
            }
          }
        `}</style>

        <div className={`relative min-h-0 flex-1 overflow-y-auto ${scrollAreaClassName}`}>
          <div
            className="pointer-events-none absolute left-6 top-5 z-[1] text-sm text-slate-500"
            style={{ display: editor.isEmpty ? 'block' : 'none' }}
          >
            {placeholder}
          </div>
          <EditorContent editor={editor} style={{ minHeight: minHeightValue }} />
        </div>
      </div>
      <style>{`
        .rich-editor-content {
          min-height: inherit;
          height: 100%;
          max-width: 100%;
          line-height: 1.7;
          min-width: 0;
          overflow-wrap: anywhere;
          word-break: break-word;
          white-space: pre-wrap;
        }

        .rich-editor-content-paper {
          position: relative;
        }

        .rich-editor-content-paper::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          border-radius: 22px;
          box-shadow:
            inset 0 0 0 1px var(--rich-editor-paper-edge, rgba(148, 163, 184, 0.2)),
            inset 0 18px 26px rgba(255, 255, 255, 0.55);
        }

        .rich-editor-scroll-area {
          scrollbar-width: thin;
        }

        .rich-editor-scroll-area-compact {
          max-height: 31rem;
        }

        .rich-editor-scroll-area-expanded {
          scrollbar-color: rgba(148, 163, 184, 0.48) rgba(255, 255, 255, 0.06);
        }

        .rich-editor-scroll-area::-webkit-scrollbar {
          width: 10px;
        }

        .rich-editor-scroll-area::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 999px;
        }

        .rich-editor-scroll-area::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.28);
          border-radius: 999px;
          border: 2px solid rgba(8, 17, 26, 0.85);
        }

        .rich-editor-scroll-area-expanded::-webkit-scrollbar-thumb {
          background: rgba(148, 163, 184, 0.5);
        }

        .rich-editor-scroll-area::-webkit-scrollbar-thumb:hover {
          background: rgba(148, 163, 184, 0.62);
        }

        @media (max-width: 639px) {
          .rich-editor-content {
            padding-left: 1rem;
            padding-right: 1rem;
            padding-top: 1rem;
            padding-bottom: 1rem;
          }
        }

        .rich-editor-content h2,
        .rich-editor-content h3 {
          margin: 0.75rem 0 0.45rem;
          font-weight: 800;
          color: var(--rich-editor-heading-color, #f8fafc);
          letter-spacing: -0.02em;
        }

        .rich-editor-content h2 {
          font-size: 1.1rem;
        }

        .rich-editor-content h3 {
          font-size: 1rem;
        }

        .rich-editor-content p {
          margin: 0.4rem 0;
          overflow-wrap: anywhere;
          max-width: 100%;
        }

        .rich-editor-content > :first-child {
          margin-top: 0;
        }

        .rich-editor-content ul,
        .rich-editor-content ol {
          margin: 0.65rem 0;
          padding-left: 1.5rem;
        }

        .rich-editor-content ul {
          list-style: disc;
        }

        .rich-editor-content ol {
          list-style: decimal;
        }

        .rich-editor-content li {
          margin: 0.3rem 0;
          padding-left: 0.2rem;
        }

        .rich-editor-content li > p {
          margin: 0;
        }

        .rich-editor-content span {
          overflow-wrap: anywhere;
          max-width: 100%;
        }

        .rich-editor-content ul ul,
        .rich-editor-content ol ol,
        .rich-editor-content ul ol,
        .rich-editor-content ol ul {
          margin-top: 0.3rem;
          margin-bottom: 0.3rem;
        }

        .rich-editor-content blockquote {
          margin: 0.85rem 0;
          border-left: 3px solid var(--rich-editor-blockquote-border, rgba(34, 211, 238, 0.55));
          background: var(--rich-editor-blockquote-bg, rgba(15, 23, 42, 0.75));
          padding: 0.85rem 1rem;
          border-radius: 0 1rem 1rem 0;
          color: var(--rich-editor-blockquote-color, #dbeafe);
        }

        .rich-editor-content:focus {
          outline: none;
        }
      `}</style>
    </>
  );
}
