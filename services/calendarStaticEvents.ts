import { CalendarEvent } from '../types';

const LOCAL_CALENDAR_SOURCE_ID = '00000000-0000-0000-0000-000000000000';
const PH_TIMEZONE_OFFSET = '+08:00';

const atStartOfDay = (date: string) => `${date}T00:00:00${PH_TIMEZONE_OFFSET}`;
const atEndOfDay = (date: string) => `${date}T23:59:59.999${PH_TIMEZONE_OFFSET}`;

const createLeaveEvent = ({
  id,
  title,
  startDate,
  endDate,
  coverageNames = [],
  description,
}: {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  coverageNames?: string[];
  description?: string;
}): CalendarEvent => ({
  id,
  title,
  description,
  start_time: atStartOfDay(startDate),
  end_time: atEndOfDay(endDate),
  event_type: 'leave',
  created_by: LOCAL_CALENDAR_SOURCE_ID,
  is_all_day: true,
  created_at: atStartOfDay(startDate),
  coverage_details: coverageNames.map((name) => ({
    name,
    modalities: [],
  })),
});

export const STATIC_CALENDAR_EVENTS: CalendarEvent[] = [
  createLeaveEvent({
    id: 'static-leave-padillo-2026-03-24-2026-04-04',
    title: 'Clojohn Padillo, MD',
    startDate: '2026-03-24',
    endDate: '2026-04-04',
    coverageNames: ['Dr. Mila'],
  }),
  createLeaveEvent({
    id: 'static-leave-madarang-2026-03-10-2026-04-16',
    title: 'Esther Febe Madarang, MD',
    startDate: '2026-03-10',
    endDate: '2026-04-16',
    coverageNames: ['Dr. Rae', 'Dr. Maude', 'Dr. Lorna', 'Dr. Nicole'],
  }),
  createLeaveEvent({
    id: 'static-leave-guinto-2026-04-01',
    title: 'Mabelle Guinto, MD',
    startDate: '2026-04-01',
    endDate: '2026-04-01',
    coverageNames: ['Dr. Carie', 'Dr. Andy'],
  }),
  createLeaveEvent({
    id: 'static-leave-ding-2026-04-01-2026-04-06',
    title: 'Julius Walter Ding, MD',
    startDate: '2026-04-01',
    endDate: '2026-04-06',
    coverageNames: ['Dr. Raisa', 'Dr. Maude', 'Dr. Nicole', 'Dr. Andy'],
  }),
  createLeaveEvent({
    id: 'static-leave-vano-yu-2026-04-01-2026-04-18',
    title: 'Lorna Grace Vano-Yu, MD',
    startDate: '2026-04-01',
    endDate: '2026-04-18',
    description: 'No covers.',
  }),
  createLeaveEvent({
    id: 'static-leave-tarongoy-2026-04-02-2026-04-05',
    title: 'Nelia Tarongoy, MD',
    startDate: '2026-04-02',
    endDate: '2026-04-05',
    coverageNames: ['Dr. Raisa'],
  }),
  createLeaveEvent({
    id: 'static-leave-yu-2026-04-02-2026-04-04',
    title: 'David Dean Yu, MD',
    startDate: '2026-04-02',
    endDate: '2026-04-04',
    coverageNames: ['Dr. Maude', 'Dr. Nicole', 'Dr. Rae'],
    description: 'Dr. Rae covers on April 4 only.',
  }),
  createLeaveEvent({
    id: 'static-leave-paredes-2026-04-02-2026-04-05',
    title: 'Milagros Paredes, MD',
    startDate: '2026-04-02',
    endDate: '2026-04-05',
    coverageNames: ['Dr. Andy', 'Dr. Raisa'],
    description: 'Dr. Raisa covers on April 3 only.',
  }),
  createLeaveEvent({
    id: 'static-leave-baisac-2026-04-02-2026-04-05',
    title: 'Christian Darrell Baisac, MD',
    startDate: '2026-04-02',
    endDate: '2026-04-05',
    coverageNames: ['Dr. Sindo', 'Dr. Yukoya'],
  }),
  createLeaveEvent({
    id: 'static-leave-chan-2026-04-03-2026-04-05',
    title: 'Demosthenes Chan, MD',
    startDate: '2026-04-03',
    endDate: '2026-04-05',
    coverageNames: ['Dr. Maude', 'Dr. Nicole', 'Dr. Gino', 'Dr. Rae', 'Dr. Karl'],
    description: 'Dr. Rae covers on April 4-5 only. Dr. Karl covers on April 5 only.',
  }),
  createLeaveEvent({
    id: 'static-leave-guinto-2026-04-08',
    title: 'Mabelle Guinto, MD',
    startDate: '2026-04-08',
    endDate: '2026-04-08',
    coverageNames: ['Dr. Carie', 'Dr. Andy'],
  }),
  createLeaveEvent({
    id: 'static-leave-fernandez-2026-04-08-2026-04-12',
    title: 'Lynette Fernandez, MD',
    startDate: '2026-04-08',
    endDate: '2026-04-12',
    coverageNames: ['Dr. Maude', 'Dr. Nicole', 'Dr. Gino', 'Dr. Rae', 'Dr. Karl'],
    description: 'Dr. Karl covers on April 8-9 only.',
  }),
  createLeaveEvent({
    id: 'static-leave-paredes-2026-04-09-2026-04-12',
    title: 'Milagros Paredes, MD',
    startDate: '2026-04-09',
    endDate: '2026-04-12',
    coverageNames: ['Dr. Andy', 'Dr. Tornilla'],
  }),
  createLeaveEvent({
    id: 'static-leave-co-2026-04-14-2026-04-24',
    title: 'Nicole Lorraine Co, MD',
    startDate: '2026-04-14',
    endDate: '2026-04-24',
    description: 'No covers.',
  }),
  createLeaveEvent({
    id: 'static-leave-koa-2026-04-14-2026-04-20',
    title: 'Karl John Koa, MD',
    startDate: '2026-04-14',
    endDate: '2026-04-20',
    coverageNames: ['Dr. Eric', 'Dr. Gino', 'Dr. Maude', 'Dr. Rae'],
  }),
  createLeaveEvent({
    id: 'static-leave-yu-2026-04-20',
    title: 'David Dean Yu, MD',
    startDate: '2026-04-20',
    endDate: '2026-04-20',
    coverageNames: ['Dr. Maude', 'Dr. Rae', 'Dr. Lorna'],
    description: 'Will read PET. If with VIP patient, ask ERB first.',
  }),
  createLeaveEvent({
    id: 'static-leave-acuna-2026-04-27-2026-05-06',
    title: 'Andy Christian Acuna, MD',
    startDate: '2026-04-27',
    endDate: '2026-05-06',
    coverageNames: ['Dr. Guinto', 'Dr. Gino', 'Dr. Mila'],
  }),
];
