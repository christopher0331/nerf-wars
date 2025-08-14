-- Get the exact station UUIDs to update firmware
SELECT 
    id,
    name,
    location,
    'Station ID: ' || id as firmware_line
FROM stations 
ORDER BY name;
