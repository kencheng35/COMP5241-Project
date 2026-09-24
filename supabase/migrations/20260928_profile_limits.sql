begin;
alter table public.profiles add constraint profiles_display_name_length check (char_length(display_name) between 2 and 100) not valid;
alter table public.profiles add constraint profiles_learning_level_allowed check (learning_level in ('new', 'foundation', 'intermediate', 'advanced')) not valid;
alter table public.profiles add constraint profiles_subjects_length check (char_length(array_to_string(preferred_subjects, ', ')) <= 300) not valid;
alter table public.profiles add constraint profiles_goals_length check (char_length(learning_goals) <= 800) not valid;
commit;