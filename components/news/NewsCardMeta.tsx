import React from 'react';

interface NewsCardMetaProps {
  categoryLabel: string;
  categoryClassName: string;
  readingMinutes: number;
}

const NewsCardMeta: React.FC<NewsCardMetaProps> = ({ categoryLabel, categoryClassName, readingMinutes }) => {
  return (
    <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] uppercase tracking-wider text-slate-400 whitespace-nowrap">
      <span className={categoryClassName}>{categoryLabel}</span>
      <span className="text-slate-600">•</span>
      <span>{readingMinutes} min read</span>
    </div>
  );
};

export default NewsCardMeta;
