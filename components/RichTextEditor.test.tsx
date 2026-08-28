import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RichTextEditor } from './RichTextEditor';

describe('RichTextEditor', () => {
  it('exposes the expanded formatting and table controls', () => {
    render(
      <RichTextEditor
        value="<p>Teaching note</p>"
        onChange={() => undefined}
        toolbarMode="expanded"
      />
    );

    expect(screen.getByTitle('Bold')).toBeInTheDocument();
    expect(screen.getByTitle('Italic')).toBeInTheDocument();
    expect(screen.getByTitle('Underline')).toBeInTheDocument();
    expect(screen.getByTitle('Heading')).toBeInTheDocument();
    expect(screen.getByTitle('Subheading')).toBeInTheDocument();
    expect(screen.getByTitle('Blockquote')).toBeInTheDocument();
    expect(screen.getByTitle('Insert table')).toBeInTheDocument();
  });

  it('loads and edits table content', async () => {
    const onChange = vi.fn();
    const { container } = render(
      <RichTextEditor
        value="<table><tbody><tr><th>Finding</th><th>Meaning</th></tr><tr><td>Halo</td><td>Sign</td></tr></tbody></table>"
        onChange={onChange}
        toolbarMode="expanded"
      />
    );

    expect(container.querySelector('table')).toBeInTheDocument();
    expect(container.querySelectorAll('th')).toHaveLength(2);
    expect(screen.getByTitle('Add row')).toBeInTheDocument();

    fireEvent.click(screen.getByTitle('Add row'));
    await waitFor(() => expect(onChange).toHaveBeenCalled());
    expect(onChange.mock.calls.at(-1)?.[0]).toContain('<table');
  });
});
