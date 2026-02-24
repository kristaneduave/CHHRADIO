import React from 'react';
import { NEWS_ACTION_CHIP_CLASS, NEWS_ACTION_CHIP_DANGER_CLASS } from '../../utils/newsStyleTokens';

interface NewsActionChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  danger?: boolean;
  icon?: string;
}

const NewsActionChip: React.FC<NewsActionChipProps> = ({ danger = false, icon, className = '', children, ...props }) => (
  <button
    type="button"
    className={`${danger ? NEWS_ACTION_CHIP_DANGER_CLASS : NEWS_ACTION_CHIP_CLASS} ${className}`.trim()}
    {...props}
  >
    {icon ? <span className="material-icons text-[14px]">{icon}</span> : null}
    {children}
  </button>
);

export default NewsActionChip;
