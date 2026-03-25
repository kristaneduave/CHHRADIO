import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import CalendarEventModal from './CalendarEventModal';
import { EventType } from '../../types';

const baseProps = () => ({
  isOpen: true,
  viewport: 'mobile' as const,
  editingEventId: null,
  selectedDateLabel: 'March 25',
  isSubmitting: false,
  validationErrors: {},
  allowedTypes: ['meeting', 'leave', 'exam'] as EventType[],
  availableModalities: ['CT', 'MRI'],
  eventTypeColors: {
    rotation: 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-100',
    call: 'bg-orange-500/20 border border-orange-500/40 text-orange-100',
    meeting: 'bg-sky-500/20 border border-sky-500/40 text-sky-100',
    leave: 'bg-purple-500/20 border border-purple-500/40 text-purple-100',
    exam: 'bg-amber-500/20 border border-amber-500/40 text-amber-100',
    lecture: 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-100',
    pcr: 'bg-rose-500/20 border border-rose-500/40 text-rose-100',
    pickleball: 'bg-lime-500/20 border border-lime-500/40 text-lime-100',
  } as Record<EventType, string>,
  newEventType: 'meeting' as EventType,
  isAllDay: false,
  newEventStartDate: '2026-03-25',
  newEventEndDate: '2026-03-25',
  newEventTime: '08:00',
  newEventEndTime: '09:00',
  assignedToName: '',
  newEventDescription: '',
  showMoreOptions: false,
  coverageDetails: [],
  onClose: vi.fn(),
  onSave: vi.fn(),
  setNewEventType: vi.fn(),
  setIsAllDay: vi.fn(),
  setNewEventStartDate: vi.fn(),
  setNewEventEndDate: vi.fn(),
  setNewEventTime: vi.fn(),
  setNewEventEndTime: vi.fn(),
  setAssignedToName: vi.fn(),
  setNewEventDescription: vi.fn(),
  setShowMoreOptions: vi.fn(),
  addCoverage: vi.fn(),
  removeCoverage: vi.fn(),
  updateCoverageName: vi.fn(),
  toggleCoverageModality: vi.fn(),
});

describe('CalendarEventModal', () => {
  it('hides time fields for all-day events and disables save when title is blank', () => {
    const props = baseProps();

    render(<CalendarEventModal {...props} isAllDay={true} />);

    expect(screen.getByRole('button', { name: 'Create event' })).toBeDisabled();
    expect(screen.queryByDisplayValue('08:00')).not.toBeInTheDocument();
    expect(screen.queryByDisplayValue('09:00')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /all day/i }));
    expect(props.setIsAllDay).toHaveBeenCalledWith(false);
  });

  it('renders leave coverage controls and forwards coverage interactions', () => {
    const props = baseProps();

    render(
      <CalendarEventModal
        {...props}
        newEventType="leave"
        assignedToName="Dr. Santos"
        showMoreOptions={true}
        coverageDetails={[{ user_id: '', name: 'Dr. Cruz', modalities: ['CT'] }]}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Add Coverage/i }));
    expect(props.addCoverage).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByDisplayValue('Dr. Cruz'), { target: { value: 'Dr. Reyes' } });
    expect(props.updateCoverageName).toHaveBeenCalledWith(0, 'Dr. Reyes');

    fireEvent.click(screen.getByRole('button', { name: 'MRI' }));
    expect(props.toggleCoverageModality).toHaveBeenCalledWith(0, 'MRI');

    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(props.removeCoverage).toHaveBeenCalledWith(0);

    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));
    expect(props.onSave).toHaveBeenCalledTimes(1);
  });
});
