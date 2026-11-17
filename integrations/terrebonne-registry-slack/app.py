import os
import logging
import requests
from dotenv import load_dotenv
from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler

load_dotenv()
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))
log = logging.getLogger("terrebonne-registry-slack")

required = ["SLACK_BOT_TOKEN", "SLACK_APP_TOKEN", "SLACK_SIGNING_SECRET",
            "REGISTRY_API_BASE_URL", "REGISTRY_API_TOKEN"]
missing = [key for key in required if not os.getenv(key)]
if missing:
    raise RuntimeError("Missing environment variables: " + ", ".join(missing))

BASE = os.environ["REGISTRY_API_BASE_URL"].rstrip("/")
TOKEN = os.environ["REGISTRY_API_TOKEN"]
ALLOWED_CHANNELS = {x.strip() for x in os.getenv("REGISTRY_ALLOWED_CHANNELS", "").split(",") if x.strip()}
PATHS = {
    "schools": os.getenv("REGISTRY_SCHOOLS_PATH", "/api/public/schools"),
    "buses": os.getenv("REGISTRY_BUSES_PATH", "/api/public/buses"),
    "requests": os.getenv("REGISTRY_REQUESTS_PATH", "/api/public/requests"),
}
SAFE_FIELDS = {
    "schools": ("id", "name", "school_type", "city", "status"),
    "buses": ("route_id", "route_name", "service_area", "status"),
}

app = App(token=os.environ["SLACK_BOT_TOKEN"], signing_secret=os.environ["SLACK_SIGNING_SECRET"])

def registry_call(method, path, payload=None):
    response = requests.request(
        method, BASE + path,
        headers={"Authorization": "Bearer " + TOKEN, "Accept": "application/json"},
        json=payload, timeout=12
    )
    response.raise_for_status()
    return response.json() if response.content else {}

def safe_rows(kind, data):
    rows = data if isinstance(data, list) else data.get("items", data.get("results", [])) if isinstance(data, dict) else []
    if not isinstance(rows, list):
        return []
    return [{k: row.get(k) for k in SAFE_FIELDS[kind] if row.get(k) is not None}
            for row in rows if isinstance(row, dict)]

def format_rows(kind, rows):
    if not rows:
        return "No public " + kind + " records were returned."
    lines = ["• " + " | ".join(f"{k}: {v}" for k, v in row.items()) for row in rows[:15]]
    if len(rows) > 15:
        lines.append(f"Showing 15 of {len(rows)} records.")
    return "\n".join(lines)

@app.command("/registry")
def registry_command(ack, body, respond, command):
    ack()
    channel_id = body.get("channel_id", "")
    if ALLOWED_CHANNELS and channel_id not in ALLOWED_CHANNELS:
        respond("This command is not enabled in this channel.")
        return
    args = (command.get("text") or "").strip()
    parts = args.split(maxsplit=1)
    action = parts[0].lower() if parts else "help"
    try:
        if action in ("schools", "buses"):
            rows = safe_rows(action, registry_call("GET", PATHS[action]))
            respond(f"*Public {action.title()} Register*\n{format_rows(action, rows)}")
        elif action == "report":
            schools = safe_rows("schools", registry_call("GET", PATHS["schools"]))
            buses = safe_rows("buses", registry_call("GET", PATHS["buses"]))
            respond(f"*Registry Summary*\nPublic school records: {len(schools)}\nPublic bus-route records: {len(buses)}")
        elif action == "request":
            description = parts[1].strip() if len(parts) > 1 else ""
            if len(description) < 8 or len(description) > 500:
                respond("Usage: /registry request <8–500 character description>. Do not include student or other sensitive personal information.")
                return
            result = registry_call("POST", PATHS["requests"], {"description": description, "source": "slack"})
            tracking = (result.get("tracking_id") or result.get("request_id") or result.get("id")) if isinstance(result, dict) else None
            respond("Request submitted. Tracking reference: " + str(tracking or "submitted; check the request portal"))
        else:
            respond("Commands: /registry schools, /registry buses, /registry report, /registry request <description>")
    except requests.RequestException:
        log.exception("Registry API request failed")
        respond("The registry service could not complete that request. The event has been logged.")
    except Exception:
        log.exception("Unexpected registry command failure")
        respond("An internal error occurred. The event has been logged.")

if __name__ == "__main__":
    SocketModeHandler(app, os.environ["SLACK_APP_TOKEN"]).start()
