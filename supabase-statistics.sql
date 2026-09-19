create table if not exists public.nickname_progress (
  nickname text not null,
  game_id integer not null,
  revealed integer not null default 1,
  guesses integer not null default 0,
  finished boolean not null default false,
  won_game boolean not null default false,
  solved_without_clues boolean not null default false,
  clue_used boolean not null default false,
  solved_at_revealed integer,
  updated_at timestamptz not null default now(),
  primary key (nickname, game_id)
);

alter table public.nickname_progress enable row level security;

create or replace function public.get_nickname_game_state(
  player_nickname text,
  target_game_id integer
)
returns json
language sql
security definer
set search_path = public
as $$
  select to_json(progress_row)
  from public.nickname_progress progress_row
  where nickname = lower(trim(player_nickname))
    and game_id = target_game_id;
$$;

create or replace function public.save_nickname_game_state(
  player_nickname text,
  target_game_id integer,
  state_revealed integer,
  state_guesses integer,
  state_finished boolean,
  state_won_game boolean,
  state_solved_without_clues boolean,
  state_clue_used boolean,
  state_solved_at_revealed integer
)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.nickname_progress (
    nickname,
    game_id,
    revealed,
    guesses,
    finished,
    won_game,
    solved_without_clues,
    clue_used,
    solved_at_revealed,
    updated_at
  ) values (
    lower(trim(player_nickname)),
    target_game_id,
    state_revealed,
    state_guesses,
    state_finished,
    state_won_game,
    state_solved_without_clues,
    state_clue_used,
    state_solved_at_revealed,
    now()
  )
  on conflict (nickname, game_id) do update set
    revealed = excluded.revealed,
    guesses = excluded.guesses,
    finished = excluded.finished,
    won_game = excluded.won_game,
    solved_without_clues = excluded.solved_without_clues,
    clue_used = excluded.clue_used,
    solved_at_revealed = excluded.solved_at_revealed,
    updated_at = now();
$$;

create or replace function public.get_nickname_game_statistics(target_game_id integer)
returns json
language sql
security definer
set search_path = public
as $$
  select json_build_object(
    'solved_count', (
      select count(distinct nickname)
      from public.nickname_progress
      where game_id = target_game_id
        and won_game = true
    ),
    'with_clue', (
      select count(*)
      from public.nickname_progress
      where game_id = target_game_id
        and won_game = true
        and clue_used = true
    ),
    'without_clue', (
      select count(*)
      from public.nickname_progress
      where game_id = target_game_id
        and won_game = true
        and clue_used = false
    ),
    'distribution', coalesce((
      select json_object_agg(word_count::text, solved_count)
      from (
        select solved_at_revealed as word_count, count(*) as solved_count
        from public.nickname_progress
        where game_id = target_game_id
          and won_game = true
          and solved_at_revealed is not null
        group by solved_at_revealed
      ) distribution_rows
    ), '{}'::json)
  );
$$;

grant execute on function public.get_nickname_game_state(text, integer) to anon, authenticated;
grant execute on function public.save_nickname_game_state(text, integer, integer, integer, boolean, boolean, boolean, boolean, integer) to anon, authenticated;
grant execute on function public.get_nickname_game_statistics(integer) to anon, authenticated;
