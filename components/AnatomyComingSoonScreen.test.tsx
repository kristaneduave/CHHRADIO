import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AnatomyComingSoonScreen from './AnatomyComingSoonScreen';

const mockData = vi.hoisted(() => ({
  sections: [
    { id: 'head-neck', label: 'Head & Neck', description: 'Head section description' },
    { id: 'thorax', label: 'Thorax', description: 'Thorax section description' },
  ],
  items: [
    {
      id: 'hn-1',
      section: 'head-neck',
      title: 'Orbital MRI',
      subtitle: 'Optic nerve',
      caption: 'Head and neck reference',
      thumbnailUrl: 'thumb-hn-1',
      imageUrl: 'full-hn-1',
      tags: ['orbit', 'mri'],
      modality: 'MRI',
      sortOrder: 1,
    },
    {
      id: 'tx-1',
      section: 'thorax',
      title: 'Thoracic CT',
      subtitle: 'Mediastinum',
      caption: 'Chest anatomy',
      thumbnailUrl: 'thumb-tx-1',
      imageUrl: 'full-tx-1',
      tags: ['thorax', 'ct'],
      modality: 'CT',
      sortOrder: 1,
    },
    {
      id: 'tx-2',
      section: 'thorax',
      title: 'Bronchial Tree',
      subtitle: 'Segmental bronchi',
      caption: 'Airway anatomy',
      thumbnailUrl: 'thumb-tx-2',
      imageUrl: 'full-tx-2',
      tags: ['lung'],
      modality: 'CT',
      sortOrder: 2,
    },
  ],
}));

vi.mock('../data/anatomyGallery', () => ({
  ANATOMY_SECTIONS: mockData.sections,
  ANATOMY_GALLERY_ITEMS: mockData.items,
  ANATOMY_FEATURED_TAGS: [],
}));

describe('AnatomyComingSoonScreen', () => {
  beforeEach(() => {
    mockData.sections.splice(0, mockData.sections.length, 
      { id: 'head-neck', label: 'Head & Neck', description: 'Head section description' },
      { id: 'thorax', label: 'Thorax', description: 'Thorax section description' },
    );
    mockData.items.splice(0, mockData.items.length,
      {
        id: 'hn-1',
        section: 'head-neck',
        title: 'Orbital MRI',
        subtitle: 'Optic nerve',
        caption: 'Head and neck reference',
        thumbnailUrl: 'thumb-hn-1',
        imageUrl: 'full-hn-1',
        tags: ['orbit', 'mri'],
        modality: 'MRI',
        sortOrder: 1,
      },
      {
        id: 'tx-1',
        section: 'thorax',
        title: 'Thoracic CT',
        subtitle: 'Mediastinum',
        caption: 'Chest anatomy',
        thumbnailUrl: 'thumb-tx-1',
        imageUrl: 'full-tx-1',
        tags: ['thorax', 'ct'],
        modality: 'CT',
        sortOrder: 1,
      },
      {
        id: 'tx-2',
        section: 'thorax',
        title: 'Bronchial Tree',
        subtitle: 'Segmental bronchi',
        caption: 'Airway anatomy',
        thumbnailUrl: 'thumb-tx-2',
        imageUrl: 'full-tx-2',
        tags: ['lung'],
        modality: 'CT',
        sortOrder: 2,
      },
    );
  });

  it('renders the anatomy gallery instead of the placeholder state', () => {
    render(<AnatomyComingSoonScreen />);

    expect(screen.getByRole('heading', { name: 'Anatomy' })).toBeInTheDocument();
    expect(screen.getByText('Teaching atlas')).toBeInTheDocument();
    expect(screen.queryByText('Anatomy page coming soon')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Head & Neck' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Thorax' })).toBeInTheDocument();
  });

  it('filters items by search text and by section', async () => {
    render(<AnatomyComingSoonScreen />);

    fireEvent.change(screen.getByLabelText('Search anatomy gallery'), { target: { value: 'bronchial' } });
    expect(screen.getByText('Bronchial Tree')).toBeInTheDocument();
    expect(screen.queryByText('Orbital MRI')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Search anatomy gallery'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Head & Neck' }));

    await waitFor(() => {
      expect(screen.getByText('Orbital MRI')).toBeInTheDocument();
      expect(screen.queryByText('Thoracic CT')).not.toBeInTheDocument();
    });
  });

  it('opens the viewer and navigates within the current filtered collection', async () => {
    render(<AnatomyComingSoonScreen />);

    fireEvent.click(screen.getByRole('button', { name: 'Thorax' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open Thoracic CT' }));

    const dialog = await screen.findByRole('dialog', { name: 'Anatomy image viewer' });
    expect(within(dialog).getByText('Thoracic CT')).toBeInTheDocument();
    expect(within(dialog).getByText('1/2')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Next anatomy image' }));
    expect(within(dialog).getByText('Bronchial Tree')).toBeInTheDocument();
    expect(within(dialog).getByText('2/2')).toBeInTheDocument();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Close anatomy image viewer' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Anatomy image viewer' })).not.toBeInTheDocument());
  });

  it('renders the empty dataset state cleanly', () => {
    mockData.items.splice(0, mockData.items.length);

    render(<AnatomyComingSoonScreen />);

    expect(screen.getByText('No anatomy images configured yet')).toBeInTheDocument();
  });

  it('renders thumbnail and viewer fallbacks when images fail', async () => {
    render(<AnatomyComingSoonScreen />);

    const thumbnail = screen.getByAltText('Orbital MRI');
    fireEvent.error(thumbnail);
    expect(screen.getByText('Image unavailable')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open Thoracic CT' }));
    const dialog = await screen.findByRole('dialog', { name: 'Anatomy image viewer' });
    const viewerImage = within(dialog).getByAltText('Thoracic CT');
    fireEvent.error(viewerImage);

    expect(within(dialog).getByText('Image unavailable')).toBeInTheDocument();
  });

  it('renders the no-results state when the filters remove all items', () => {
    render(<AnatomyComingSoonScreen />);

    fireEvent.change(screen.getByLabelText('Search anatomy gallery'), { target: { value: 'not-a-match' } });

    expect(screen.getByText('No matching anatomy images')).toBeInTheDocument();
  });
});
