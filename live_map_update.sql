-- ==============================================================================
-- LIVE MAP CONSOLIDATION SCRIPT
-- Purpose: Merges all separate sections into one single "Radiology Department" map
-- ==============================================================================

-- 1. Start fresh by clearing out all current sessions and workstations
DELETE FROM public.occupancy_sessions;
DELETE FROM public.current_workstation_status;
DELETE FROM public.workstations;

-- 2. Delete all floors except one, renaming that last one to be the Master Map
DO $$
DECLARE
    master_floor_id UUID;
BEGIN
    -- Grab the first floor we can find to be our master
    SELECT id INTO master_floor_id FROM public.floors LIMIT 1;

    IF master_floor_id IS NULL THEN
        -- If literally no floors exist, insert a fresh one
        INSERT INTO public.floors (name, image_url, width, height) 
        VALUES ('Radiology Department', '/live-map-chhradio.jpg', 1000, 1000)
        RETURNING id INTO master_floor_id;
    ELSE
        -- Delete every other floor except the master
        DELETE FROM public.floors WHERE id != master_floor_id;
        
        -- Update the master floor to use the new exact square dimensions and image
        UPDATE public.floors 
        SET name = 'Radiology Department',
            image_url = '/live-map-chhradio.jpg',
            width = 1000,
            height = 1000
        WHERE id = master_floor_id;
    END IF;

    -- ==========================================
    -- 3. INSERT ALL 29 WORKSTATIONS ONTO THE MASTER FLOOR
    -- ==========================================
    
    -- QUADRANT 1: GENERAL RADIOLOGY (Top Left)
    -- Top Row
    INSERT INTO public.workstations (floor_id, label, x, y, section) VALUES 
    (master_floor_id, 'GenRad-01', 190, 80, 'General Radiology'),
    (master_floor_id, 'GenRad-02', 250, 80, 'General Radiology'),
    (master_floor_id, 'GenRad-03', 340, 80, 'General Radiology');
    
    -- Left Wall
    INSERT INTO public.workstations (floor_id, label, x, y, section) VALUES 
    (master_floor_id, 'GenRad-04', 80, 110, 'General Radiology'),
    (master_floor_id, 'GenRad-05', 80, 160, 'General Radiology'),
    (master_floor_id, 'GenRad-06', 80, 230, 'General Radiology');

    -- Right Wall
    INSERT INTO public.workstations (floor_id, label, x, y, section) VALUES 
    (master_floor_id, 'GenRad-07', 410, 150, 'General Radiology'),
    (master_floor_id, 'GenRad-08', 410, 205, 'General Radiology'),
    (master_floor_id, 'GenRad-09', 410, 260, 'General Radiology');

    -- Bottom Left Pods
    INSERT INTO public.workstations (floor_id, label, x, y, section) VALUES 
    (master_floor_id, 'GenRad-10', 105, 420, 'General Radiology'),
    (master_floor_id, 'GenRad-11', 135, 455, 'General Radiology');

    -- Bottom Right Pod
    INSERT INTO public.workstations (floor_id, label, x, y, section) VALUES 
    (master_floor_id, 'GenRad-12', 430, 420, 'General Radiology');

    -- ==========================================
    -- QUADRANT 2: CT SCAN (Top Right)
    -- ==========================================

    -- Top Control Room
    INSERT INTO public.workstations (floor_id, label, x, y, section) VALUES 
    (master_floor_id, 'CT-Control-1', 568, 88, 'CT Scan'),
    (master_floor_id, 'CT-Control-2', 645, 88, 'CT Scan'),
    (master_floor_id, 'CT-Control-3', 705, 88, 'CT Scan');

    -- Inner Reading Room
    INSERT INTO public.workstations (floor_id, label, x, y, section) VALUES 
    (master_floor_id, 'CT-Read-1', 845, 220, 'CT Scan'),
    (master_floor_id, 'CT-Read-2', 915, 220, 'CT Scan');

    -- Bottom Pods (CT Area)
    INSERT INTO public.workstations (floor_id, label, x, y, section) VALUES 
    (master_floor_id, 'CT-Station-1', 585, 405, 'CT Scan'),
    (master_floor_id, 'CT-Station-2', 585, 460, 'CT Scan'),
    (master_floor_id, 'CT-Station-3', 775, 420, 'CT Scan'),
    (master_floor_id, 'CT-Station-4', 925, 400, 'CT Scan'),
    (master_floor_id, 'CT-Station-5', 925, 455, 'CT Scan');

    -- ==========================================
    -- QUADRANT 3: MRI (Bottom Left)
    -- ==========================================

    -- Top Reading Desk
    INSERT INTO public.workstations (floor_id, label, x, y, section) VALUES 
    (master_floor_id, 'MRI-Read-1', 310, 582, 'MRI'),
    (master_floor_id, 'MRI-Read-2', 445, 582, 'MRI');

    -- Middle Row
    INSERT INTO public.workstations (floor_id, label, x, y, section) VALUES 
    (master_floor_id, 'MRI-Control-1', 205, 740, 'MRI'),
    (master_floor_id, 'MRI-Control-2', 330, 740, 'MRI'),
    (master_floor_id, 'MRI-Control-3', 420, 740, 'MRI');

    -- Bottom Pods
    INSERT INTO public.workstations (floor_id, label, x, y, section) VALUES 
    (master_floor_id, 'MRI-Station-1', 345, 825, 'MRI'),
    (master_floor_id, 'MRI-Station-2', 420, 825, 'MRI');

    -- ==========================================
    -- QUADRANT 4: WARDS / ER (Bottom Right)
    -- ==========================================

    -- Interventional Radiology Desk
    INSERT INTO public.workstations (floor_id, label, x, y, section) VALUES 
    (master_floor_id, 'IR-01', 810, 955, 'Interventional Radiology');

END $$;
