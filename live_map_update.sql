-- ==============================================================================
-- 🚀 THE FINAL LIVE MAP CONSOLIDATION SCRIPT
-- Purpose: Merges all sections into one "Radiology Department" map and forces browser cache update
-- ==============================================================================

-- 1. Start fresh by clearing out all current sessions and workstations
DELETE FROM public.occupancy_sessions;
DELETE FROM public.workstations;

-- 2. Consolidate down to just ONE master floor
DO $$
DECLARE
    master_floor_id UUID;
    cache_buster TEXT;
BEGIN
    -- Generates a random number like ?v=1738243 to force the browser to get the new image
    cache_buster := '?v=' || extract(epoch from now())::text;

    -- Grab the first floor we can find to be our master
    SELECT id INTO master_floor_id FROM public.floors LIMIT 1;

    IF master_floor_id IS NULL THEN
        -- If literally no floors exist, insert a fresh one
        INSERT INTO public.floors (name, image_url, width, height) 
        VALUES ('Radiology Department', '/live-map-chhradio.jpg' || cache_buster, 919, 1024)
        RETURNING id INTO master_floor_id;
    ELSE
        -- Delete every other floor except the master
        DELETE FROM public.floors WHERE id != master_floor_id;
        
        -- Update the master floor to use the new exact dimensions and image, WITH cache buster
        UPDATE public.floors 
        SET name = 'Radiology Department',
            image_url = '/live-map-chhradio.jpg' || cache_buster,
            width = 919,
            height = 1024
        WHERE id = master_floor_id;
    END IF;

    -- ==========================================
    -- 3. INSERT ALL 29 WORKSTATIONS ONTO THE MASTER FLOOR
    -- ==========================================
    
    -- QUADRANT 1: GENERAL RADIOLOGY (Top Left)
    INSERT INTO public.workstations (floor_id, label, x, y, section) VALUES 
    (master_floor_id, 'GenRad-01', 225, 115, 'General Radiology'),
    (master_floor_id, 'GenRad-02', 310, 115, 'General Radiology'),
    (master_floor_id, 'GenRad-03', 395, 115, 'General Radiology'),
    (master_floor_id, 'GenRad-04', 115, 150, 'General Radiology'),
    (master_floor_id, 'GenRad-05', 115, 230, 'General Radiology'),
    (master_floor_id, 'GenRad-06', 115, 310, 'General Radiology'),
    (master_floor_id, 'GenRad-07', 430, 150, 'General Radiology'),
    (master_floor_id, 'GenRad-08', 430, 230, 'General Radiology'),
    (master_floor_id, 'GenRad-09', 430, 310, 'General Radiology'),
    (master_floor_id, 'GenRad-10', 140, 435, 'General Radiology'),
    (master_floor_id, 'GenRad-11', 200, 470, 'General Radiology'),
    (master_floor_id, 'GenRad-12', 440, 435, 'General Radiology');

    -- QUADRANT 2: CT SCAN (Top Right)
    INSERT INTO public.workstations (floor_id, label, x, y, section) VALUES 
    (master_floor_id, 'CT-Control-1', 568, 110, 'CT Scan'),
    (master_floor_id, 'CT-Control-2', 645, 110, 'CT Scan'),
    (master_floor_id, 'CT-Control-3', 745, 110, 'CT Scan'),
    (master_floor_id, 'CT-Read-1', 865, 260, 'CT Scan'),
    (master_floor_id, 'CT-Read-2', 935, 260, 'CT Scan'),
    (master_floor_id, 'CT-Station-1', 595, 425, 'CT Scan'),
    (master_floor_id, 'CT-Station-2', 595, 500, 'CT Scan'),
    (master_floor_id, 'CT-Station-3', 775, 440, 'CT Scan'),
    (master_floor_id, 'CT-Station-4', 925, 425, 'CT Scan'),
    (master_floor_id, 'CT-Station-5', 925, 500, 'CT Scan');

    -- QUADRANT 3: MRI (Bottom Left)
    INSERT INTO public.workstations (floor_id, label, x, y, section) VALUES 
    (master_floor_id, 'MRI-Read-1', 330, 582, 'MRI'),
    (master_floor_id, 'MRI-Read-2', 455, 582, 'MRI'),
    (master_floor_id, 'MRI-Control-1', 240, 755, 'MRI'),
    (master_floor_id, 'MRI-Control-2', 340, 755, 'MRI'),
    (master_floor_id, 'MRI-Control-3', 440, 755, 'MRI'),
    (master_floor_id, 'MRI-Station-1', 340, 875, 'MRI'),
    (master_floor_id, 'MRI-Station-2', 420, 875, 'MRI');

    -- QUADRANT 4: WARDS / ER (Bottom Right)
    INSERT INTO public.workstations (floor_id, label, x, y, section) VALUES 
    (master_floor_id, 'IR-01', 810, 975, 'Interventional Radiology');

END $$;
