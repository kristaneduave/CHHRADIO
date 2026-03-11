import { EventType } from '../../types';

export type CalendarViewScope = 'selected' | 'week' | 'upcoming';
export type CalendarViewport = 'mobile' | 'tablet' | 'desktop';

export interface CalendarFilterOption {
  id: EventType | 'all';
  label: string;
}

export interface CalendarScopeOption {
  id: CalendarViewScope;
  label: string;
  description: string;
}

export interface CalendarWeekDayMeta {
  date: Date;
  label: string;
  isSelected: boolean;
  isToday: boolean;
  count: number;
}
