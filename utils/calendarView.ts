export const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

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
