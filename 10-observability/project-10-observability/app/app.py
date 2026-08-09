import time
import json
import logging
import random

# Configure structured JSON logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("observability-demo")

def emit_structured_log(event_type, status, latency_ms):
    log_entry = {
        "service": "observability-demo",
        "event_type": event_type,
        "status": status,
        "latency_ms": latency_ms,
        "timestamp": time.time()
    }
    logger.info(json.dumps(log_entry))

def simulate_telemetry_stream():
    print("[INFO] Simulating OpenTelemetry & Cloud Observability Stream...")
    for i in range(1, 10):
        latency = random.randint(50, 350)
        status = 200 if latency < 300 else 500
        emit_structured_log("api_request", status, latency)
        time.sleep(1)
    print("[SUCCESS] Telemetry simulation complete.")

if __name__ == "__main__":
    simulate_telemetry_stream()
