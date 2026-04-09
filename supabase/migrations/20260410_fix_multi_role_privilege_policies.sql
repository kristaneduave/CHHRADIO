-- Make privilege checks honor supplemental roles stored in public.user_roles.
-- Legacy policies that only inspect profiles.role still exist, but these
-- additive policies allow multi-role users to pass RLS without changing their
-- primary profile role.

drop policy if exists "announcements_insert_multi_role_publishers" on public.announcements;
create policy "announcements_insert_multi_role_publishers"
on public.announcements
for insert
to authenticated
with check (
  public.current_user_has_any_role(array['admin', 'training_officer', 'moderator', 'consultant'])
);

drop policy if exists "announcements_update_multi_role_publishers" on public.announcements;
create policy "announcements_update_multi_role_publishers"
on public.announcements
for update
to authenticated
using (
  public.current_user_has_any_role(array['admin', 'training_officer', 'moderator'])
  or (
    public.current_user_has_role('consultant')
    and announcements.author_id = auth.uid()
  )
)
with check (
  public.current_user_has_any_role(array['admin', 'training_officer', 'moderator'])
  or (
    public.current_user_has_role('consultant')
    and announcements.author_id = auth.uid()
  )
);

drop policy if exists "announcements_delete_multi_role_publishers" on public.announcements;
create policy "announcements_delete_multi_role_publishers"
on public.announcements
for delete
to authenticated
using (
  public.current_user_has_any_role(array['admin', 'training_officer', 'moderator'])
  or (
    public.current_user_has_role('consultant')
    and announcements.author_id = auth.uid()
  )
);

drop policy if exists "notifications_insert_multi_role_publishers" on public.notifications;
create policy "notifications_insert_multi_role_publishers"
on public.notifications
for insert
to authenticated
with check (
  public.current_user_has_any_role(array['admin', 'training_officer', 'moderator', 'consultant'])
);

drop policy if exists "notification_recipients_insert_multi_role_publishers" on public.notification_recipients;
create policy "notification_recipients_insert_multi_role_publishers"
on public.notification_recipients
for insert
to authenticated
with check (
  public.current_user_has_any_role(array['admin', 'training_officer', 'moderator', 'consultant'])
);

drop policy if exists "quiz_attempts_select_multi_role_privileged" on public.quiz_attempts;
create policy "quiz_attempts_select_multi_role_privileged"
on public.quiz_attempts
for select
to authenticated
using (
  user_id = auth.uid()
  or exists (
    select 1
    from public.quiz_exams e
    where e.id = quiz_attempts.exam_id
      and e.created_by = auth.uid()
  )
  or public.current_user_has_any_role(array['admin', 'moderator', 'training_officer'])
);

drop policy if exists "calendar_events_insert_multi_role_privileged" on public.calendar_events;
create policy "calendar_events_insert_multi_role_privileged"
on public.calendar_events
for insert
to authenticated
with check (
  public.current_user_has_any_role(array['admin', 'moderator', 'training_officer'])
);

drop policy if exists "calendar_events_update_multi_role_privileged" on public.calendar_events;
create policy "calendar_events_update_multi_role_privileged"
on public.calendar_events
for update
to authenticated
using (
  public.current_user_has_any_role(array['admin', 'moderator', 'training_officer'])
)
with check (
  public.current_user_has_any_role(array['admin', 'moderator', 'training_officer'])
);

drop policy if exists "calendar_events_delete_multi_role_privileged" on public.calendar_events;
create policy "calendar_events_delete_multi_role_privileged"
on public.calendar_events
for delete
to authenticated
using (
  public.current_user_has_any_role(array['admin', 'moderator', 'training_officer'])
);

drop policy if exists "daily_duty_roster_select_multi_role_privileged" on public.daily_duty_roster;
create policy "daily_duty_roster_select_multi_role_privileged"
on public.daily_duty_roster
for select
to authenticated
using (
  public.current_user_has_any_role(array['admin', 'moderator'])
);

drop policy if exists "daily_duty_roster_insert_multi_role_privileged" on public.daily_duty_roster;
create policy "daily_duty_roster_insert_multi_role_privileged"
on public.daily_duty_roster
for insert
to authenticated
with check (
  public.current_user_has_any_role(array['admin', 'moderator'])
);

drop policy if exists "daily_duty_roster_update_multi_role_privileged" on public.daily_duty_roster;
create policy "daily_duty_roster_update_multi_role_privileged"
on public.daily_duty_roster
for update
to authenticated
using (
  public.current_user_has_any_role(array['admin', 'moderator'])
)
with check (
  public.current_user_has_any_role(array['admin', 'moderator'])
);

drop policy if exists "daily_duty_roster_delete_multi_role_privileged" on public.daily_duty_roster;
create policy "daily_duty_roster_delete_multi_role_privileged"
on public.daily_duty_roster
for delete
to authenticated
using (
  public.current_user_has_any_role(array['admin', 'moderator'])
);

drop policy if exists "resident_monthly_census_read_multi_role_privileged" on public.resident_monthly_census;
create policy "resident_monthly_census_read_multi_role_privileged"
on public.resident_monthly_census
for select
to authenticated
using (
  resident_id = auth.uid()
  or public.current_user_has_any_role(array['admin', 'moderator', 'training_officer'])
);

drop policy if exists "resident_monthly_census_insert_multi_role_privileged" on public.resident_monthly_census;
create policy "resident_monthly_census_insert_multi_role_privileged"
on public.resident_monthly_census
for insert
to authenticated
with check (
  resident_id = auth.uid()
  or public.current_user_has_any_role(array['admin', 'moderator', 'training_officer'])
);

drop policy if exists "resident_monthly_census_update_multi_role_privileged" on public.resident_monthly_census;
create policy "resident_monthly_census_update_multi_role_privileged"
on public.resident_monthly_census
for update
to authenticated
using (
  resident_id = auth.uid()
  or public.current_user_has_any_role(array['admin', 'moderator', 'training_officer'])
)
with check (
  resident_id = auth.uid()
  or public.current_user_has_any_role(array['admin', 'moderator', 'training_officer'])
);

drop policy if exists "account_access_requests_manage_multi_role_privileged" on public.account_access_requests;
create policy "account_access_requests_manage_multi_role_privileged"
on public.account_access_requests
for all
to authenticated
using (
  public.current_user_has_any_role(array['admin', 'moderator', 'training_officer'])
)
with check (
  public.current_user_has_any_role(array['admin', 'moderator', 'training_officer'])
);

drop policy if exists "resident_endorsements_insert_multi_role_participants" on public.resident_endorsements;
create policy "resident_endorsements_insert_multi_role_participants"
on public.resident_endorsements
for insert
to authenticated
with check (
  public.current_user_has_any_role(array['resident', 'admin', 'moderator'])
);

drop policy if exists "resident_endorsements_update_multi_role_privileged" on public.resident_endorsements;
create policy "resident_endorsements_update_multi_role_privileged"
on public.resident_endorsements
for update
to authenticated
using (
  created_by = auth.uid()
  or public.current_user_has_any_role(array['admin', 'moderator', 'training_officer'])
)
with check (
  created_by = auth.uid()
  or public.current_user_has_any_role(array['admin', 'moderator', 'training_officer'])
);

drop policy if exists "resident_endorsements_delete_multi_role_privileged" on public.resident_endorsements;
create policy "resident_endorsements_delete_multi_role_privileged"
on public.resident_endorsements
for delete
to authenticated
using (
  created_by = auth.uid()
  or public.current_user_has_any_role(array['admin', 'moderator', 'training_officer'])
);

drop policy if exists "resident_endorsement_comments_insert_multi_role_participants" on public.resident_endorsement_comments;
create policy "resident_endorsement_comments_insert_multi_role_participants"
on public.resident_endorsement_comments
for insert
to authenticated
with check (
  public.current_user_has_any_role(array['resident', 'admin', 'moderator'])
);

drop policy if exists "resident_endorsement_comments_update_multi_role_privileged" on public.resident_endorsement_comments;
create policy "resident_endorsement_comments_update_multi_role_privileged"
on public.resident_endorsement_comments
for update
to authenticated
using (
  created_by = auth.uid()
  or public.current_user_has_any_role(array['admin', 'moderator', 'training_officer'])
)
with check (
  created_by = auth.uid()
  or public.current_user_has_any_role(array['admin', 'moderator', 'training_officer'])
);

drop policy if exists "resident_endorsement_comments_delete_multi_role_privileged" on public.resident_endorsement_comments;
create policy "resident_endorsement_comments_delete_multi_role_privileged"
on public.resident_endorsement_comments
for delete
to authenticated
using (
  created_by = auth.uid()
  or public.current_user_has_any_role(array['admin', 'moderator', 'training_officer'])
);
