alter table public.game_progress
  add column if not exists clue_used boolean not null default false,
  add column if not exists solved_at_revealed integer;

create or replace function public.get_game_statistics(target_game_id integer)
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'solved_count', (
      select count(*)
      from public.game_progress
      where game_id = target_game_id
        and won_game = true
    ),
    'with_clue', (
      select count(*)
      from public.game_progress
      where game_id = target_game_id
        and won_game = true
        and clue_used = true
    ),
    'without_clue', (
      select count(*)
      from public.game_progress
      where game_id = target_game_id
        and won_game = true
        and clue_used = false
    ),
    'distribution', coalesce((
      select json_object_agg(word_count::text, solved_count)
      from (
        select solved_at_revealed as word_count, count(*) as solved_count
        from public.game_progress
        where game_id = target_game_id
          and won_game = true
          and solved_at_revealed is not null
        group by solved_at_revealed
      ) distribution_rows
    ), '{}'::json)
  );
$$;

grant execute on function public.get_game_statistics(integer) to anon, authenticated;
