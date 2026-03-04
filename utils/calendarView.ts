export const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export const toLocalDateInputValue = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const fromLocalDateInput = (value: string): Date => {
  const [year, month, day] = value.split('-').map((part) => Number(part));
  if (!year || !month || !day) {
    throw new Error('Invalid local date input.');
  }
  const next = new Date(year, month - 1, day);
  next.setHours(0, 0, 0, 0);
  return next;
};

export const buildEventDateTimeRange = (args: {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
}): { start: Date; end: Date } => {
  const startDate = fromLocalDateInput(args.startDate);
  const endDate = fromLocalDateInput(args.endDate);

  if (args.isAllDay) {
    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  const parseTime = (value: string): [number, number] => {
    const [hoursRaw, minutesRaw] = value.split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
      throw new Error('Invalid event time.');
    }
    return [hours, minutes];
  };

  const [startHours, startMinutes] = parseTime(args.startTime);
  const [endHours, endMinutes] = parseTime(args.endTime);

  const start = new Date(startDate);
  start.setHours(startHours, startMinutes, 0, 0);
  const end = new Date(endDate);
  end.setHours(endHours, endMinutes, 0, 0);

  return { start, end };
};

export const getWeekStart = (date: Date, weekStartsOnMonday = true): Date => {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  const day = value.getDay(); // 0=Sun, 1=Mon
  const offset = weekStartsOnMonday ? (day === 0 ? -6 : 1 - day) : -day;
  value.setDate(value.getDate() + offset);
  return value;
};

export const getWeekDays = (date: Date, weekStartsOnMonday = true): Date[] => {
  const start = getWeekStart(date, weekStartsOnMonday);
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
};

export const isSameWeek = (a: Date, b: Date, mondayStart = true): boolean => {
  const aStart = getWeekStart(a, mondayStart);
  const bStart = getWeekStart(b, mondayStart);
  return isSameDay(aStart, bStart);
};

const shortMonth = (date: Date) => date.toLocaleDateString([], { month: 'short' });

export const formatWeekRange = (start: Date, end: Date): string => {
  const startMonth = shortMonth(start);
  const endMonth = shortMonth(end);
  const startDay = start.getDate();
  const endDay = end.getDate();
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();

  if (startYear !== endYear) {
    return `${startMonth} ${startDay}, ${startYear} - ${endMonth} ${endDay}, ${endYear}`;
  }
  if (startMonth !== endMonth) {
    return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
  }
  return `${startMonth} ${startDay} - ${endDay}`;
};
