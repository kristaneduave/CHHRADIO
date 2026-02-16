ALTER TABLE public.events DROP CONSTRAINT IF EXISTS events_event_type_check;
ALTER TABLE public.events ADD CONSTRAINT events_event_type_check CHECK (event_type = ANY (ARRAY['rotation', 'call', 'lecture', 'exam', 'leave', 'meeting', 'other', 'pickleball']));
