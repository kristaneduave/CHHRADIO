import React, { useEffect, useMemo, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';
import { mergeAttributes } from '@tiptap/core';

type ToolbarMode = 'compact' | 'expanded';

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
      backgroundColor: {
        default: null,
        parseHTML: (element) => element.style.backgroundColor || null,
        renderHTML: (attributes) => {
          if (!attributes.backgroundColor) return {};
          return {
            style: `background-color: ${attributes.backgroundColor}`,
          };
        },
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
  },
});

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
}: RichTextEditorProps) {
  const minHeightValue = useMemo(() => getMinHeightValue(minHeight), [minHeight]);
  const [showStyleTools, setShowStyleTools] = useState(false);
  const scrollAreaClassName = toolbarMode === 'expanded'
    ? 'rich-editor-scroll-area rich-editor-scroll-area-expanded'
    : 'rich-editor-scroll-area rich-editor-scroll-area-compact';

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
        class: `rich-editor-content h-full rounded-b-2xl bg-black/40 px-5 py-4 text-sm text-white focus:outline-none ${editorClassName}`.trim(),
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
  const isExpanded = toolbarMode === 'expanded';
  const textColors = [
    { label: 'Default', value: '', swatch: 'transparent' },
    { label: 'Cyan', value: '#67e8f9', swatch: '#67e8f9' },
    { label: 'Amber', value: '#fbbf24', swatch: '#fbbf24' },
    { label: 'Rose', value: '#fb7185', swatch: '#fb7185' },
    { label: 'Emerald', value: '#34d399', swatch: '#34d399' },
  ];
  const highlightColors = [
    { label: 'None', value: 'transparent', swatch: 'transparent' },
    { label: 'Cyan Highlight', value: 'rgba(34, 211, 238, 0.22)', swatch: 'rgba(34, 211, 238, 0.5)' },
    { label: 'Amber Highlight', value: 'rgba(251, 191, 36, 0.22)', swatch: 'rgba(251, 191, 36, 0.5)' },
    { label: 'Rose Highlight', value: 'rgba(244, 114, 182, 0.22)', swatch: 'rgba(244, 114, 182, 0.5)' },
    { label: 'Emerald Highlight', value: 'rgba(52, 211, 153, 0.22)', swatch: 'rgba(52, 211, 153, 0.5)' },
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

  const applyHighlightColor = (backgroundColor: string) => {
    withSelection(editor, () => {
      const chain = editor.chain().focus();
      if (!backgroundColor || backgroundColor === 'transparent') {
        chain.setMark('textStyle', { backgroundColor: null }).removeEmptyTextStyle().run();
        return;
      }
      chain.setMark('textStyle', { backgroundColor }).run();
    });
  };

  return (
    <>
      <div className={`flex flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#0b121a] shadow-[0_18px_40px_rgba(2,6,23,0.3)] transition-colors focus-within:border-cyan-500/50 ${className}`.trim()}>
        <div className={`flex flex-wrap items-center justify-center gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-3 ${isExpanded ? 'sticky top-0 z-10 backdrop-blur-xl' : ''}`}>
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
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`${toolbarButtonBase} ${editor.isActive('heading', { level: 3 }) ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
          title="Heading"
        >
          <span className="material-icons text-[18px]">title</span>
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`${toolbarButtonBase} ${editor.isActive('blockquote') ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}
          title="Callout"
        >
          <span className="material-icons text-[18px]">format_quote</span>
        </button>

        <div className="mx-1 hidden h-4 w-px bg-white/10 sm:block" />

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

        <button
          type="button"
          onClick={() => setShowStyleTools((prev) => !prev)}
          className={`rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold transition-colors ${
            showStyleTools ? 'bg-cyan-500/15 text-cyan-200' : 'bg-white/[0.04] text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
          title="Text and highlight colors"
        >
          Style
        </button>

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

        <div className="flex w-full items-center justify-center pt-1">
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

        {showStyleTools && (
          <div className="flex flex-col items-center gap-2 border-b border-white/10 bg-white/[0.02] px-3 py-3">
            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2 py-1">
              <span className="min-w-[82px] px-1 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Text Color</span>
              {textColors.map((color) => (
                <button
                  key={`text-${color.label}`}
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

            <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/20 px-2 py-1">
              <span className="min-w-[82px] px-1 text-center text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Highlight</span>
              {highlightColors.map((color) => (
                <button
                  key={`highlight-${color.label}`}
                  type="button"
                  onClick={() => applyHighlightColor(color.value)}
                  className="flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] transition-colors hover:bg-white/10"
                  title={color.label}
                >
                  <span className="h-3 w-3 rounded-full border border-white/10" style={{ backgroundColor: color.swatch }} />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className={`relative min-h-0 flex-1 overflow-y-auto ${scrollAreaClassName}`}>
          <div
            className="pointer-events-none absolute left-4 top-4 z-[1] text-sm text-slate-500 sm:left-5"
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
          color: #f8fafc;
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
          border-left: 3px solid rgba(34, 211, 238, 0.55);
          background: rgba(15, 23, 42, 0.75);
          padding: 0.85rem 1rem;
          border-radius: 0 1rem 1rem 0;
          color: #dbeafe;
        }

        .rich-editor-content:focus {
          outline: none;
        }
      `}</style>
    </>
  );
}
