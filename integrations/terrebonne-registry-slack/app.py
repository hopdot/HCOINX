import logging, os
from datetime import datetime
from zoneinfo import ZoneInfo
import requests
from dotenv import load_dotenv
from slack_bolt import App
from slack_bolt.adapter.socket_mode import SocketModeHandler
from apscheduler.schedulers.background import BackgroundScheduler

load_dotenv()
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"), format="%(asctime)s %(levelname)s %(name)s %(message)s")
log = logging.getLogger("hcoinx.operations")

def csv_set(key): return {v.strip() for v in os.getenv(key, "").split(",") if v.strip()}

REQUIRED = ("SLACK_BOT_TOKEN", "SLACK_APP_TOKEN", "SLACK_SIGNING_SECRET")
missing = [key for key in REQUIRED if not os.getenv(key)]
if missing: raise RuntimeError("Missing required environment variables: " + ", ".join(missing))

BASE = os.getenv("REGISTRY_API_BASE_URL", "").rstrip("/")
TOKEN = os.getenv("REGISTRY_API_TOKEN", "")
ALLOWED_CHANNELS = csv_set("SLACK_ALLOWED_CHANNEL_IDS")
DIGEST_CHANNEL = os.getenv("DIGEST_CHANNEL_ID", "").strip()
TIMEZONE = os.getenv("TIMEZONE", "America/Chicago")
DIGEST_HOUR = int(os.getenv("DIGEST_HOUR", "8"))
PATHS = {"schools": os.getenv("REGISTRY_SCHOOLS_PATH", "/api/public/schools"), "buses": os.getenv("REGISTRY_BUSES_PATH", "/api/public/buses"), "requests": os.getenv("REGISTRY_REQUESTS_PATH", "/api/public/requests")}
SAFE_FIELDS = {"schools": ("id", "name", "school_type", "city", "status"), "buses": ("route_id", "route_name", "service_area", "status")}
app = App(token=os.environ["SLACK_BOT_TOKEN"], signing_secret=os.environ["SLACK_SIGNING_SECRET"])

def audit(event, **fields):
    safe = {k: v for k, v in fields.items() if k not in {"text", "description", "token"}}
    log.info("audit event=%s details=%s", event, safe)

def allowed(body): return not ALLOWED_CHANNELS or body.get("channel_id", "") in ALLOWED_CHANNELS

def api(method, path, payload=None):
    if not BASE or not TOKEN: raise RuntimeError("Registry API is not configured")
    if not BASE.startswith("https://"): raise RuntimeError("Registry API URL must use HTTPS")
    response = requests.request(method, BASE + "/" + path.lstrip("/"), headers={"Authorization": "Bearer " + TOKEN, "Accept": "application/json"}, json=payload, timeout=15)
    response.raise_for_status()
    return response.json() if response.content else {}

def rows(data):
    if isinstance(data, list): return data
    if isinstance(data, dict):
        for key in ("items", "results", "data"):
            if isinstance(data.get(key), list): return data[key]
    return []

def safe_rows(kind, data):
    return [{k: row.get(k) for k in SAFE_FIELDS[kind] if row.get(k) is not None} for row in rows(data) if isinstance(row, dict)]

def render_rows(kind, records):
    if not records: return "No public " + kind + " records returned."
    lines = ["• " + " | ".join(f"{k}: {v}" for k, v in row.items()) for row in records[:12]]
    if len(records) > 12: lines.append(f"Showing 12 of {len(records)} records.")
    return "\n".join(lines)

def registry(action, argument=""):
    if action in ("schools", "buses"):
        records = safe_rows(action, api("GET", PATHS[action]))
        return f"*Public {action.title()} Register*\n{render_rows(action, records)}"
    if action == "report":
        schools = safe_rows("schools", api("GET", PATHS["schools"]))
        buses = safe_rows("buses", api("GET", PATHS["buses"]))
        stamp = datetime.now(ZoneInfo(TIMEZONE)).strftime("%Y-%m-%d %H:%M %Z")
        return f"*Terrebonne Registry Summary*\nSchools: *{len(schools)}* | Bus routes: *{len(buses)}*\nChecked: {stamp}"
    if action == "request":
        description = argument.strip()
        if not 8 <= len(description) <= 500: return "Usage: /registry request <8–500 character description>. Do not include student or sensitive personal information."
        result = api("POST", PATHS["requests"], {"description": description, "source": "slack"})
        tracking = (result.get("tracking_id") or result.get("request_id") or result.get("id")) if isinstance(result, dict) else None
        return "Request submitted. Tracking reference: " + str(tracking or "submitted; check request portal")
    return "Use: schools, buses, report, or request <description>."

def response(action, argument=""):
    if action == "help": return "*HCOINX Operations*\n/hcoinx status — service status\n/hcoinx registry schools|buses|report — registry summaries\n/hcoinx registry request <description> — submit request\n/registry schools|buses|report|request — registry shortcut"
    if action == "status": return f"*HCOINX Status*\nSlack bot: online\nRegistry API: {("configured" if BASE and TOKEN else "not configured")}\nDaily digest: {("configured" if DIGEST_CHANNEL else "not configured")}"
    if action == "registry":
        parts = argument.split(maxsplit=1)
        return registry(parts[0].lower(), parts[1] if len(parts) > 1 else "") if parts else registry("help")
    return "Unknown command. Use /hcoinx help."

def handle(ack, body, respond, command, name):
    ack()
    if not allowed(body): respond("This command is not enabled in this channel."); audit("denied", channel=body.get("channel_id")); return
    parts = (command.get("text") or "").strip().split(maxsplit=1)
    action = parts[0].lower() if parts else "help"
    arg = parts[1] if len(parts) > 1 else ""
    try:
        result = registry(action, arg) if name == "/registry" else response(action, arg)
        respond(result)
        audit("command", command=name, action=action, channel=body.get("channel_id"), user=body.get("user_id"))
    except requests.RequestException as exc:
        log.exception("Registry API failure"); respond("Registry service unavailable; failure logged."); audit("api_error", error=type(exc).__name__)
    except Exception as exc:
        log.exception("Command failure"); respond("Command could not be completed; check service configuration and logs."); audit("command_error", error=type(exc).__name__)

@app.command("/hcoinx")
def hcoinx(ack, body, respond, command): handle(ack, body, respond, command, "/hcoinx")
@app.command("/registry")
def registry_command(ack, body, respond, command): handle(ack, body, respond, command, "/registry")
@app.event("app_mention")
def mention(event, say):
    if allowed({"channel_id": event.get("channel", "")}): say("HCOINX Operations is online. Use /hcoinx help for commands.")

def daily_digest():
    try:
        summary = registry("report")
        app.client.chat_postMessage(channel=DIGEST_CHANNEL, text="*Daily HCOINX Registry Digest*\n" + summary)
        audit("daily_digest_sent", channel=DIGEST_CHANNEL)
    except Exception as exc:
        log.exception("Daily digest failed"); audit("daily_digest_failed", error=type(exc).__name__)

if __name__ == "__main__":
    scheduler = BackgroundScheduler(timezone=TIMEZONE)
    if DIGEST_CHANNEL and BASE and TOKEN:
        scheduler.add_job(daily_digest, "cron", hour=DIGEST_HOUR, minute=0, id="registry-digest", replace_existing=True)
        scheduler.start()
        log.info("Daily digest scheduled at %02d:00 %s", DIGEST_HOUR, TIMEZONE)
    else: log.info("Daily digest disabled until registry API and digest channel are configured.")
    SocketModeHandler(app, os.environ["SLACK_APP_TOKEN"]).start()
