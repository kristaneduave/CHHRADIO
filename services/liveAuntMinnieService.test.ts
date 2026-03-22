import { describe, expect, it } from 'vitest';
import { __testables } from './liveAuntMinnieService';

describe('liveAuntMinnieService helpers', () => {
  it('recognizes host roles', () => {
    expect(__testables.isLiveAuntMinnieHostRole('consultant')).toBe(true);
    expect(__testables.isLiveAuntMinnieHostRole('faculty')).toBe(true);
    expect(__testables.isLiveAuntMinnieHostRole('resident')).toBe(false);
    expect(__testables.isLiveAuntMinnieHostRole(null)).toBe(false);
  });

  it('builds uppercase join codes', () => {
    const code = __testables.buildJoinCode();
    expect(code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('normalizes prompt input for persistence', () => {
    const normalized = __testables.normalizePromptInput(
      {
        images: [
          { image_url: ' https://example.com/image.png ', caption: ' AP view ' },
          { image_url: ' https://example.com/image-2.png ', caption: ' ' },
        ],
        question_text: ' Identify the diagnosis ',
        official_answer: ' Appendicitis ',
        answer_explanation: ' Acute inflammation of the appendix. ',
        accepted_aliases: [' appy ', ' acute appendicitis ', ''],
      },
      2,
    );

    expect(normalized).toEqual({
      sort_order: 2,
      source_case_id: null,
      question_text: 'Identify the diagnosis',
      official_answer: 'Appendicitis',
      answer_explanation: 'Acute inflammation of the appendix.',
      accepted_aliases: [],
      images: [
        { sort_order: 0, image_url: 'https://example.com/image.png', caption: 'AP view' },
        { sort_order: 1, image_url: 'https://example.com/image-2.png', caption: null },
      ],
    });
  });

  it('groups responses by prompt and maps the current user response', () => {
    const grouped = __testables.buildResponseMaps([
      {
        id: 'r1',
        session_id: 's1',
        prompt_id: 'p1',
        user_id: 'u1',
        response_text: 'Answer one',
        judgment: 'unreviewed',
        consultant_note: null,
        submitted_at: '2026-03-22T10:00:00.000Z',
        updated_at: '2026-03-22T10:00:00.000Z',
        reviewed_at: null,
        reviewed_by: null,
      },
      {
        id: 'r2',
        session_id: 's1',
        prompt_id: 'p1',
        user_id: 'u2',
        response_text: 'Answer two',
        judgment: 'unreviewed',
        consultant_note: null,
        submitted_at: '2026-03-22T10:00:00.000Z',
        updated_at: '2026-03-22T10:00:00.000Z',
        reviewed_at: null,
        reviewed_by: null,
      },
    ], 'u1');

    expect(grouped.responsesByPromptId.p1).toHaveLength(2);
    expect(grouped.myResponsesByPromptId.p1?.id).toBe('r1');
  });

  it('groups messages by prompt in chronological order', () => {
    const grouped = __testables.buildMessageMap([
      {
        id: 'm2',
        session_id: 's1',
        prompt_id: 'p1',
        user_id: 'u2',
        body: 'Second',
        created_at: '2026-03-22T10:01:00.000Z',
        updated_at: '2026-03-22T10:01:00.000Z',
      },
      {
        id: 'm1',
        session_id: 's1',
        prompt_id: 'p1',
        user_id: 'u1',
        body: 'First',
        created_at: '2026-03-22T10:00:00.000Z',
        updated_at: '2026-03-22T10:00:00.000Z',
      },
    ]);

    expect(grouped.messagesByPromptId.p1.map((message) => message.id)).toEqual(['m1', 'm2']);
  });
});
