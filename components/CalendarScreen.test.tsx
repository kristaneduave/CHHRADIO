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
  beforeEach(() => {
    mockCalendarService.getEvents.mockResolvedValue([]);
    mockCalendarService.getUpcomingEvents.mockResolvedValue([]);
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
  });

  it('blocks save when title is missing', async () => {
    render(<CalendarScreen />);
    await waitFor(() => expect(mockCalendarService.getEvents).toHaveBeenCalled());

    fireEvent.click(screen.getByTitle('Create Event'));
    const saveButton = await screen.findByText('Save Event');
    expect(saveButton).toBeDisabled();
    expect(mockCalendarService.createEvent).not.toHaveBeenCalled();
  });
});
