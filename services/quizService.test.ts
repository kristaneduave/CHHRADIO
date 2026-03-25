import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getUser, from } = vi.hoisted(() => {
  const from = vi.fn((table: string) => {
    if (table === 'quizzes') {
      const query = {
        eq: vi.fn(() => query),
        order: vi.fn(async () => ({
          data: [
            {
              id: 'quiz-1',
              title: 'Neuro Quiz',
              description: null,
              created_by: 'author-1',
              status: 'published',
              opens_at: '2026-03-25T00:00:00.000Z',
              closes_at: '2099-03-25T00:00:00.000Z',
            },
          ],
          error: null,
        })),
      };

      return {
        select: vi.fn(() => query),
      };
    }

    if (table === 'profiles') {
      return {
        select: vi.fn(() => ({
          in: vi.fn(async () => ({
            data: [
              {
                id: 'author-1',
                full_name: 'Admin Author',
                nickname: null,
                role: 'ADMIN',
              },
            ],
            error: null,
          })),
        })),
      };
    }

    if (table === 'quiz_questions') {
      return {
        select: vi.fn(() => ({
          in: vi.fn(async () => ({
            data: [{ quiz_id: 'quiz-1' }, { quiz_id: 'quiz-1' }],
            error: null,
          })),
        })),
      };
    }

    throw new Error(`Unexpected table ${table}`);
  });

  return {
    getUser: vi.fn(async () => ({ data: { user: { id: 'user-1' } } })),
    from,
  };
});

vi.mock('./supabase', () => ({
  supabase: {
    auth: {
      getUser,
    },
    from,
  },
}));

vi.mock('./userRoleService', () => ({
  getCurrentUserRoleState: vi.fn(async () => ({
    primaryRole: 'resident',
    roles: ['resident'],
  })),
}));

describe('quizService', () => {
  beforeEach(() => {
    vi.resetModules();
    from.mockClear();
    getUser.mockClear();
  });

  it('normalizes author roles when listing available quizzes', async () => {
    const { listAvailableQuizzes } = await import('./quizService');

    const result = await listAvailableQuizzes();

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'quiz-1',
      author_name: 'Admin Author',
      author_role: 'admin',
      question_count: 2,
      availability: 'open',
      can_start: true,
    });
  });
});
