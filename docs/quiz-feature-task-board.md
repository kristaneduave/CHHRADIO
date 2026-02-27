# Quiz Feature Task Board

## Scope
Flesh out ResiHub quiz into a production-ready module with:
- maintainable frontend architecture
- complete authoring flow
- enforceable attempt/timing rules
- actionable analytics
- release-safe rollout and test coverage

## Milestones
1. `M1 Core Refactor`: split monolith screen and centralize quiz data access.
2. `M2 Authoring UX`: robust exam/question authoring including image questions.
3. `M3 Assessment Rules`: timed exams, attempt rules, server-side enforcement.
4. `M4 Analytics Depth`: drilldowns and cohort/trend views.
5. `M5 Governance + Release`: notifications policy, auditability, tests, rollout.

## Priority Legend
- `P0`: must-have / blocking.
- `P1`: high-value near-term.
- `P2`: enhancement.

## Effort Legend
- `S`: 0.5-1 day
- `M`: 1-2 days
- `L`: 3-5 days

## Backlog
| ID | Priority | Effort | Milestone | Task | File Scope | Depends On | Done Criteria |
|---|---|---|---|---|---|---|---|
| QUIZ-001 | P0 | M | M1 | Extract quiz API calls to service layer (`quizService`) | `components/QuizScreen.tsx`, `services/quizService.ts` | - | No direct Supabase calls in quiz UI leaf components |
| QUIZ-002 | P0 | M | M1 | Split `QuizScreen` into modular components (`ExamList`, `Runner`, `Summary`, `Manager`, `Analytics`) | `components/quiz/*`, `components/QuizScreen.tsx` | QUIZ-001 | `QuizScreen` reduced to orchestration + state composition |
| QUIZ-003 | P0 | S | M1 | Add typed quiz DTO mappers and error normalization helper | `services/quizService.ts`, `types.ts` | QUIZ-001 | No `any` in new quiz service surface; user-friendly error map |
| QUIZ-004 | P0 | S | M1 | Add authoring validation utility (options count, answer bounds, points) | `utils/quizValidation.ts`, `components/quiz/QuizManager.tsx` | QUIZ-002 | Invalid authoring payloads blocked before save |
| QUIZ-005 | P1 | M | M2 | Implement question reorder with persistent `sort_order` updates | `components/quiz/QuizManager.tsx`, `services/quizService.ts` | QUIZ-002 | Reordered list persists after reload |
| QUIZ-006 | P1 | S | M2 | Add duplicate and delete question actions with confirm | `components/quiz/QuizManager.tsx` | QUIZ-002 | Authors can duplicate/delete without state corruption |
| QUIZ-007 | P1 | M | M2 | Add image question authoring (`question_type=image`, `image_url`) | `components/quiz/QuizManager.tsx`, `components/quiz/QuizRunner.tsx`, storage helper | QUIZ-002 | Image questions render and grade correctly |
| QUIZ-008 | P1 | M | M2 | CSV import for MCQ batch authoring | `components/quiz/QuizManager.tsx`, `utils/quizCsv.ts` | QUIZ-004 | CSV import creates draft question set with validation feedback |
| QUIZ-009 | P0 | L | M3 | Add attempt policy columns + RLS-safe enforcement (`max_attempts`, `cooldown_hours`) | new Supabase migration, RPC update | QUIZ-003 | Attempt limits enforced server-side regardless of client |
| QUIZ-010 | P0 | M | M3 | Add timed exam countdown + auto-submit | `components/quiz/QuizRunner.tsx` | QUIZ-002 | Timeout auto-submits and stores attempt reliably |
| QUIZ-011 | P1 | M | M3 | Add randomization settings (question/order shuffle) with deterministic attempt mapping | migration + service + runner | QUIZ-009 | Same attempt remains internally consistent for grading/review |
| QUIZ-012 | P1 | S | M3 | Persist resume state safely (including timer checkpoint) | `components/quiz/QuizRunner.tsx`, local storage helper | QUIZ-010 | Refresh restores in-progress attempt without timer abuse |
| QUIZ-013 | P1 | M | M4 | Build attempt detail drilldown view | `components/quiz/QuizAnalytics.tsx`, service methods | QUIZ-002 | Authorized users can inspect per-attempt details |
| QUIZ-014 | P1 | M | M4 | Add cohort filters and trend charts (weekly/monthly) | `components/quiz/QuizAnalytics.tsx` | QUIZ-013 | Analytics supports role/year/specialty filters + trends |
| QUIZ-015 | P2 | S | M4 | Expand CSV export to multi-dataset export | `components/quiz/QuizAnalytics.tsx`, `utils/csv.ts` | QUIZ-013 | Export includes exam/question/user/group sets |
| QUIZ-016 | P1 | S | M5 | Notification policy refinement (publish-only by default) | `components/quiz/QuizManager.tsx` | QUIZ-002 | No notification spam on every save |
| QUIZ-017 | P1 | M | M5 | Add governance/audit fields (`updated_by`, optional soft delete) | migration + service | QUIZ-003 | Changes are traceable; archived data remains analyzable |
| QUIZ-018 | P1 | M | M5 | Add `My Attempts` history tab for residents | new `components/quiz/QuizMyAttempts.tsx` | QUIZ-002 | Residents can filter and review own attempts |
| QUIZ-019 | P0 | M | M5 | Add automated tests (service + UI critical paths) | `test/*`, `vitest` configs | QUIZ-001, QUIZ-002, QUIZ-009, QUIZ-010 | Coverage includes start/submit, authoring publish, policy limits |
| QUIZ-020 | P0 | S | M5 | Add rollout flags + staged release checklist | config constants + docs | QUIZ-019 | Feature flags control rollout; checklist signed off |

## Suggested Sprinting
1. `Sprint A`: QUIZ-001, QUIZ-002, QUIZ-003, QUIZ-004.
2. `Sprint B`: QUIZ-005, QUIZ-006, QUIZ-007.
3. `Sprint C`: QUIZ-009, QUIZ-010, QUIZ-012.
4. `Sprint D`: QUIZ-011, QUIZ-013, QUIZ-014.
5. `Sprint E`: QUIZ-016, QUIZ-017, QUIZ-018, QUIZ-019, QUIZ-020.

## Risks
- Existing backward-compat branches in quiz fetching can mask schema drift.
- Timer/auto-submit complexity can cause duplicate submissions without idempotency checks.
- Randomization needs stable answer mapping to avoid grading mismatch.
- Analytics views may need index tuning as attempts scale.

## Immediate Next Action
Start `Sprint A` with QUIZ-001 and QUIZ-002 in one branch:
- branch name: `feature/quiz-modularization-v1`
- first PR target: service extraction + component split with no behavior change
