-- Username: ammette spazi singoli interni (es. "Mario Rossi"), niente spazi iniziali/finali o doppi. 3-20 caratteri.
alter table public.profiles drop constraint if exists profiles_username_check;
alter table public.profiles add constraint profiles_username_check
  check (username is null or (char_length(username) between 3 and 20
    and username ~ '^[A-Za-z0-9._-]+( [A-Za-z0-9._-]+)*$'));
