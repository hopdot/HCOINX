# Terrebonne Registry — HCOINX Slack Operations

This integration adds a Slack operations interface and a browser dashboard for the Terrebonne Parish School & Bus Registry.

The registry API remains the system of record. API route names are configurable because the uploaded ZIP source and OpenAPI schema have not yet been inspected in this session. Verify the route paths before production use.

## Slack commands
- /registry schools — public school register
- /registry buses — public bus-route register
- /registry report — aggregate counts
- /registry request <description> — submit a public-record request

The bot uses an explicit public-field allow-list. Never expose student names, student IDs, dates of birth, home addresses, individual attendance, individual bus assignments, or other student-level information in Slack.

## Setup
1. Create a Slack app with Socket Mode enabled and add the /registry slash command.
2. Grant commands scope and install it to the intended workspace.
3. Copy .env.example to .env and provide the Slack tokens and registry API URL/token.
4. Verify the three registry paths against the API's actual OpenAPI schema.
5. Set REGISTRY_ALLOWED_CHANNELS to approved channel IDs.
6. Run: pip install -r requirements.txt && python app.py

Keep secrets in the deployment host's secret manager. Never commit .env. Use a least-privilege API token.

## Dashboard
Open dashboard/index.html. Enter the public HTTPS API base URL and verified public GET paths. This browser dashboard uses public endpoints only and does not accept API credentials.

## Production checklist
- Confirm API route names and response schemas.
- Confirm the public disclosure policy and allowed fields.
- Add gateway rate limits, authentication, audit logging, and retention controls.
- Verify Slack channel authorization and staging integration tests.
- Obtain workspace administrator approval before installing the Slack app.

The repository code is a deployment-ready starter scaffold, not evidence that the Slack app has been installed or that a live registry service is deployed.