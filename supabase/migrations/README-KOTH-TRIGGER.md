# King of the Hill Control Trigger

This database trigger automatically processes RFID badge scans and updates station control status for the King of the Hill gameplay mode without requiring any firmware changes.

## How It Works

1. When an RFID scan is inserted into the `rfid_scans` table by the ESP32:
   - The trigger activates and checks if there's an active game session
   - If the game is King of the Hill, it continues processing
   - It looks up the team associated with the scanned badge
   - It verifies the station is part of the active game session

2. If a team member scans a badge at a station:
   - If the station is not controlled by any team, their team takes control
   - If the station is controlled by another team, control switches to the new team
   - If the station is already controlled by their team, nothing changes

3. When control changes:
   - The previous control record is updated with its total duration
   - A new control record is created for the new controlling team
   - The gameplay page's real-time subscription automatically updates the UI

## Installation

Run this migration in your Supabase SQL Editor:

1. Go to your Supabase project
2. Navigate to the SQL Editor
3. Create a new query
4. Copy and paste the contents of `20250811_koth_control_trigger.sql`
5. Run the query

## Testing

To test if the trigger is working:

1. Start a King of the Hill game and select stations
2. Assign badges to teams
3. Use the ESP32 to scan a badge at a station
4. The gameplay page should update to show the station is now controlled by that team
5. Check the `station_control` table to confirm a new record was created

## Troubleshooting

If station control isn't updating:

1. Make sure badges are assigned to teams
2. Confirm that stations are selected for the active game
3. Check the Supabase logs for any errors in the trigger execution
4. Verify that the station UUIDs in the firmware match those in your database

## Data Flow

```
ESP32 scans badge -> rfid_scans INSERT -> 
trigger processes scan -> station_control UPDATE/INSERT -> 
real-time subscription notifies frontend -> UI updates
```
