alter table consultant_covers 
add column if not exists logs jsonb default '[]'::jsonb;
