import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import CalendarScreen from './CalendarScreen';

const { mockCalendarService } = vi.hoisted(() => ({
  mockCalendarService: {
    getEvents: vi.fn(),
    getUpcomingEvents: vi.fn(),
    searchEvents: vi.fn(),
    createEvent: vi.fn(),
    updateEvent: vi.fn(),
    deleteEvent: vi.fn(),
  },
}));

vi.mock('../services/CalendarService', () => ({
  CalendarService: mockCalendarService,
}));

vi.mock('../services/newsfeedService', () => ({
  createSystemNotification: vi.fn(),
  fetchAllRecipientUserIds: vi.fn(async () => []),
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'u-1' } } })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: { role: 'admin' } })),
        })),
      })),
    })),
  },
}));

describe('CalendarScreen', () => {
  const setViewport = (viewport: 'mobile' | 'desktop') => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => {
        const matches =
          viewport === 'desktop'
            ? query === '(min-width: 1280px)' || query === '(min-width: 768px)'
            : false;

        return {
          matches,
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        };
      }),
    });
  };

  beforeEach(() => {
    vi.useRealTimers();
    setViewport('mobile');
    const now = new Date();
    const meetingEvent = {
      id: 'evt-meeting',
      title: 'Morning Huddle',
      start_time: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0).toISOString(),
      end_time: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0, 0).toISOString(),
      event_type: 'meeting' as const,
      is_all_day: false,
      created_by: 'u-1',
      coverage_details: [],
    };
    mockCalendarService.getEvents.mockReset();
    mockCalendarService.getUpcomingEvents.mockReset();
    mockCalendarService.searchEvents.mockReset();
    mockCalendarService.createEvent.mockReset();
    mockCalendarService.updateEvent.mockReset();
    mockCalendarService.deleteEvent.mockReset();
    mockCalendarService.getEvents.mockResolvedValue([meetingEvent]);
    mockCalendarService.getUpcomingEvents.mockResolvedValue([meetingEvent]);
    mockCalendarService.searchEvents.mockResolvedValue([]);
    mockCalendarService.createEvent.mockResolvedValue({
      id: 'evt-1',
      title: 'Test',
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      event_type: 'meeting',
      is_all_day: true,
      created_by: 'u-1',
      coverage_details: [],
    });
  });

  it('renders without crashing', async () => {
    render(<CalendarScreen />);
    expect(screen.getByText('Calendar')).toBeInTheDocument();
    await waitFor(() => expect(mockCalendarService.getEvents).toHaveBeenCalled());
    expect(screen.getByText('Schedule')).toBeInTheDocument();
    expect(screen.getByText('Month navigator')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-layout')).toHaveAttribute('data-calendar-viewport', 'mobile');
  });

  it('blocks save when title is missing', async () => {
    render(<CalendarScreen />);
    await waitFor(() => expect(mockCalendarService.getEvents).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Create Event' }));
    const saveButton = await screen.findByText('Create event');
    expect(saveButton).toBeDisabled();
    expect(mockCalendarService.createEvent).not.toHaveBeenCalled();
  });

  it('opens the schedule filter drawer and applies an event type filter', async () => {
    render(<CalendarScreen />);
    await waitFor(() => expect(mockCalendarService.getEvents).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Open schedule filters' }));
    fireEvent.change(screen.getByLabelText('Event type'), { target: { value: 'exam' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));

    expect(await screen.findByText('Type: Exam')).toBeInTheDocument();
    expect(screen.getByText('No exam found')).toBeInTheDocument();
  });

  it('searches calendar events from the search bar', async () => {
    render(<CalendarScreen />);
    await waitFor(() => expect(mockCalendarService.getEvents).toHaveBeenCalled());

    fireEvent.change(screen.getByRole('textbox', { name: 'Search calendar events' }), { target: { value: 'huddle' } });
    await waitFor(() => expect(mockCalendarService.searchEvents).toHaveBeenCalledWith('huddle'), { timeout: 1500 });
  });

  it('uses a mobile sheet modal on narrow viewports', async () => {
    render(<CalendarScreen />);
    await waitFor(() => expect(mockCalendarService.getEvents).toHaveBeenCalled());

    fireEvent.click(screen.getByRole('button', { name: 'Create Event' }));

    expect(await screen.findByTestId('calendar-event-modal-sheet')).toBeInTheDocument();
    expect(screen.queryByTestId('calendar-event-modal-desktop')).not.toBeInTheDocument();
  });

  it('shows desktop layout markers and inline actions on wide viewports', async () => {
    setViewport('desktop');
    render(<CalendarScreen />);
    await waitFor(() => expect(mockCalendarService.getEvents).toHaveBeenCalled());

    expect(screen.getByTestId('calendar-layout')).toHaveAttribute('data-calendar-viewport', 'desktop');
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Create Event' }));
    expect(await screen.findByTestId('calendar-event-modal-desktop')).toBeInTheDocument();
  });
});
