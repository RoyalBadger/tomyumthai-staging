# TYT print agent (restaurant PC)

Prints every paid order automatically, with no clicks and no print dialog:

- customer receipt → **counter** printer
- CHEF 2 ticket + MAIN KITCHEN ticket → **kitchen** printer (partial cut after each)

It polls the ordering server every few seconds, sends raw Star Line Mode text straight to
each printer's IP on port 9100 (no Windows driver involved), then tells the server the
order is printed. The portal's Print Tickets button becomes a "Reprint" that goes through
the agent; if the agent is offline the portal falls back to browser printing and shows a
red "Auto-print offline" pill.

## Install on the restaurant PC (one time, ~10 minutes)

1. Install **Node.js LTS** from https://nodejs.org (default options).
2. Create `C:\tyt-print-agent` and copy these files into it: `agent.mjs`, `tickets.mjs`,
   `config.example.json`.
3. Copy `config.example.json` to `config.json` and set:
   - `token` — the `PRINT_AGENT_TOKEN` value from the Vercel project's environment variables
   - `printers.counter` / `printers.kitchen` — the two printers' IP addresses (print a
     self-test by holding FEED while powering on; give both printers DHCP reservations in
     UniFi so the addresses never change)
   - `receipt` — `all` (default), `pickup`, `delivery`, or `none` to control which orders
     get a counter receipt
4. Test both printers and the server connection:

   ```powershell
   cd C:\tyt-print-agent
   node agent.mjs test
   ```

   A TEST ticket should come out of each printer and the last log line should say
   `server OK`. If a printer fails with a timeout, check its IP and that the PC and printer
   are on the same Wi-Fi.
5. Run it for real once, in the foreground, and place an order:

   ```powershell
   node agent.mjs
   ```

   Press Ctrl+C when satisfied.
6. Register it to start with Windows and restart itself if it crashes. In an
   **administrator** PowerShell:

   ```powershell
   $node = (Get-Command node.exe).Source
   $action    = New-ScheduledTaskAction -Execute $node -Argument 'agent.mjs' -WorkingDirectory 'C:\tyt-print-agent'
   $trigger   = New-ScheduledTaskTrigger -AtStartup
   $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
   $settings  = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
   Register-ScheduledTask -TaskName 'TYT Print Agent' -Action $action -Trigger $trigger -Principal $principal -Settings $settings
   Start-ScheduledTask -TaskName 'TYT Print Agent'
   ```

   Confirm: the portal's Live Orders tab shows a green **Auto-print online** pill within
   ten seconds.

## Day to day

- **Log:** `C:\tyt-print-agent\agent.log` (one line per ticket, errors included).
- **Restart:** Task Scheduler → TYT Print Agent → End, then Run. Or reboot the PC.
- **Printer down:** the agent retries every poll; the half that printed is remembered in
  `state.json` so nothing double-prints. The order stays un-printed on the server until
  both printers succeed, and the portal keeps working in the meantime.
- **Change a printer's IP:** edit `config.json`, restart the task.
- **Uninstall:** `Unregister-ScheduledTask -TaskName 'TYT Print Agent' -Confirm:$false`

## Commands

| Command | What it does |
| --- | --- |
| `node agent.mjs` | poll forever (what the scheduled task runs) |
| `node agent.mjs test` | test ticket to each printer + server check, then exit |
| `node agent.mjs once` | one poll cycle, then exit |

## Server side

- `PRINT_AGENT_TOKEN` env var on Vercel (32+ random characters). The agent sends it in the
  `X-Print-Token` header to `/api/admin/orders`; the server compares it in constant time.
- Migration `023_print_agent.sql`: `orders.printed_at`, `orders.print_requested_at`,
  `settings.print_agent_seen_at` (heartbeat).
- If the printer is ever switched to ESC/POS emulation in the Star utility, set
  `"emulation": "escpos"` in `config.json`.
