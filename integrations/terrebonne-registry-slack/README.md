# HCOINX Operations Center — Slack + Terrebonne Registry

Repository: https://github.com/hopdot/HCOINX  
Integration path: integrations/terrebonne-registry-slack

This service adds a Slack operations bot and a static browser dashboard. Slack is an operator interface; the Terrebonne registry API remains the system of record.

## Included
- Slack Socket Mode bot with /hcoinx and /registry slash commands
- App-mention response
- Public school and bus-route lookups using a strict field allow-list
- Public-record request submission and tracking-reference response
- Daily aggregate registry digest to a configured Slack channel
- JSON-like operational audit events in process logs
- Slack app manifest, Dockerfile, Render blueprint, and GitHub Actions validation

## Slack command guide
- /hcoinx help — command guide
- /hcoinx status — bot and integration configuration status
- /hcoinx registry schools — public school register
- /hcoinx registry buses — public bus-route register
- /hcoinx registry report — aggregate counts
- /hcoinx registry request <description> — submit a request
- /registry schools|buses|report|request <description> — shortcut

Request descriptions are limited to 8–500 characters. Do not put student names, student IDs, dates of birth, home addresses, attendance, individual bus assignments, or other sensitive personal information into Slack requests.

## Slack app setup
1. Open https://api.slack.com/apps and choose Create New App → From an app manifest.
2. Select the HCOINX workspace and paste slack-app-manifest.json.
3. Review the requested scopes: commands, chat:write, app_mentions:read.
4. Enable Socket Mode in Slack app settings.
5. Create an app-level token with connections:write. Keep its xapp token private.
6. Install the app to the workspace and copy the bot token (xoxb), app-level token (xapp), and signing secret.
7. Create approved channels such as #hcoinx-ops, #hcoinx-alerts, #hcoinx-registry, #hcoinx-dev, and #hcoinx-compliance.
8. Invite the bot to the channels where it should operate. Set SLACK_ALLOWED_CHANNEL_IDS to the approved channel IDs; leave blank only for a deliberate all-channel deployment.
9. Configure the slash commands if the manifest import did not create them.

## Environment configuration
Copy .env.example to .env for local testing. Never commit .env.

Required:
- SLACK_BOT_TOKEN
- SLACK_APP_TOKEN
- SLACK_SIGNING_SECRET

Registry integration:
- REGISTRY_API_BASE_URL — HTTPS base URL
- REGISTRY_API_TOKEN — least-privilege bearer token
- REGISTRY_SCHOOLS_PATH, REGISTRY_BUSES_PATH, REGISTRY_REQUESTS_PATH — verify these against the actual registry OpenAPI schema before enabling commands

Automation:
- DIGEST_CHANNEL_ID — private or approved channel ID for daily digest
- DIGEST_HOUR — local hour, 0–23 (default 8)
- TIMEZONE — default America/Chicago
- SLACK_ALLOWED_CHANNEL_IDS — comma-separated allowed channel IDs

The current sample route paths are placeholders. They must be checked against the real registry API. If no registry API credentials are configured, the Slack bot still starts, but registry commands return a configuration error and the daily digest remains disabled.

## Local run
Python 3.12 is recommended.

    cd integrations/terrebonne-registry-slack
    python -m venv .venv
    source .venv/bin/activate
    pip install -r requirements.txt
    cp .env.example .env
    # Edit .env with actual credentials and verified registry endpoints.
    python app.py

## Deploy on Render
1. Push this branch to GitHub.
2. In Render, choose New → Blueprint and select this repository.
3. Point Render to integrations/terrebonne-registry-slack/render.yaml if prompted.
4. Create the worker and static-site services.
5. Enter the required Slack and registry secrets in the worker environment settings.
6. Set DIGEST_CHANNEL_ID and SLACK_ALLOWED_CHANNEL_IDS after creating the Slack channels.
7. Deploy the worker and static site.
8. Open the static-site URL Render assigns and test the dashboard after setting its public HTTPS API URL and confirmed public endpoints.
9. Confirm the worker logs show Socket Mode connected and, if enabled, the daily digest scheduled.

The worker is long-running and must not be deployed as a serverless function. Keep secrets only in the worker's secret environment. The dashboard must use public read-only endpoints; never put a bearer token in browser JavaScript.

## GitHub validation
The workflow in .github/workflows/hcoinx-slack-ops.yml runs syntax and manifest checks on pushes and pull requests. It does not install the Slack app or deploy services.

## Privacy and operational controls
- Only allow-listed aggregate/public fields are rendered in Slack.
- Never add student-level PII or private transport assignments to the bot's output.
- Restrict bot membership to approved operational channels.
- Use a dedicated read-only registry token for GETs and a separately scoped request-submission credential if the API supports it.
- Configure API-side authentication, rate limiting, request validation, retention, and audit logs.
- Route service logs to a retained log service; container-local logs may be ephemeral.
- Rotate Slack and registry tokens if exposed. Do not paste tokens into GitHub issues or chat.

## Production acceptance checklist
- [ ] Confirm API routes and response schemas from the registry OpenAPI document.
- [ ] Confirm public fields and privacy policy with the registry data owner.
- [ ] Test schools, buses, report, and request against a staging API.
- [ ] Verify approved-channel restrictions and Slack command responses.
- [ ] Confirm daily digest delivery and local timezone.
- [ ] Verify dashboard CORS and public endpoint availability.
- [ ] Review Slack scopes and remove unused permissions.
- [ ] Confirm log retention, rate limits, and incident response owner.

## Scope and current status
The repository files implement the integration. A live Slack workspace installation and live dashboard deployment still require workspace admin authorization, real credentials, and a reachable registry API. This project does not claim those external steps have happened automatically.
