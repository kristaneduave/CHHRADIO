-- Migration for Workstation Availability Map

CREATE TABLE floors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  width INTEGER NOT NULL,  -- Pixel width of the floor plan image
  height INTEGER NOT NULL, -- Pixel height of the floor plan image
  bounds JSONB,             -- Useful for Leaflet bounds defining
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE floors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users on floors"
  ON floors FOR SELECT
  USING (true);

CREATE POLICY "Enable insert/update/delete for admins on floors"
  ON floors FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

CREATE TABLE workstations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  floor_id UUID REFERENCES floors(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  x FLOAT NOT NULL,        -- Leaflet CRS.Simple X coordinate
  y FLOAT NOT NULL,        -- Leaflet CRS.Simple Y coordinate
  section TEXT,            -- e.g., 'Main Reading Room'
  status_override TEXT,    -- e.g., 'OUT_OF_SERVICE'
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workstations_floor ON workstations(floor_id);

ALTER TABLE workstations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users on workstations"
  ON workstations FOR SELECT
  USING (true);

CREATE POLICY "Enable insert/update/delete for admins on workstations"
  ON workstations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );


CREATE TABLE occupancy_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workstation_id UUID REFERENCES workstations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id),   -- Supabase Auth user ID
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,    -- Null means currently active
  display_name_snapshot TEXT,
  client_type TEXT CHECK (client_type IN ('qr', 'kiosk', 'mobile', 'web')),
  metadata_json JSONB
);

CREATE INDEX idx_active_sessions ON occupancy_sessions(workstation_id) WHERE ended_at IS NULL;
CREATE INDEX idx_occupancy_sessions_user ON occupancy_sessions(user_id);

ALTER TABLE occupancy_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users on sessions"
  ON occupancy_sessions FOR SELECT
  USING (true);

CREATE POLICY "Enable insert for authenticated users on their own sessions"
  ON occupancy_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for users on their own active sessions"
  ON occupancy_sessions FOR UPDATE
  USING (auth.uid() = user_id AND ended_at IS NULL);


-- View for Current Status
CREATE VIEW current_workstation_status AS
SELECT 
  w.id,
  w.label,
  w.x, w.y,
  w.floor_id,
  w.section,
  COALESCE(w.status_override, 
    CASE 
      WHEN s.id IS NOT NULL AND (NOW() - s.last_seen_at) < INTERVAL '30 minutes' THEN 'IN_USE'
      ELSE 'AVAILABLE'
    END
  ) as status,
  s.display_name_snapshot as occupant_name,
  s.user_id as occupant_id,
  s.started_at,
  s.last_seen_at
FROM workstations w
LEFT JOIN LATERAL (
  -- Get the most recent active session
  SELECT * FROM occupancy_sessions 
  WHERE workstation_id = w.id AND ended_at IS NULL
  ORDER BY started_at DESC LIMIT 1
) s ON true;

