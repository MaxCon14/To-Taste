create table public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null,
  message text,
  rating smallint,
  created_at timestamptz not null default now(),
  constraint app_feedback_valid_submission check (
    (kind = 'rating' and rating is not null and rating between 1 and 5 and message is null)
    or (kind in ('feedback', 'help') and rating is null and message is not null
      and char_length(message) <= 2000 and message ~ '[^[:space:]]')
  )
);

create index app_feedback_user_id_idx on public.app_feedback (user_id);

alter table public.app_feedback enable row level security;
revoke all on public.app_feedback from public, anon, authenticated;
grant insert (kind, message, rating) on public.app_feedback to authenticated;

create policy "Signed-in users can submit app feedback"
  on public.app_feedback for insert to authenticated
  with check (user_id = (select auth.uid()) and not coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false));
