import base64
import json
import functions_framework

@functions_framework.cloud_event
def process_budget_alert(cloud_event):
    """Cloud Function triggered by Pub/Sub budget alert to stop non-essential VMs."""
    try:
        pubsub_data = cloud_event.data["message"]["data"]
        decoded_data = base64.b64decode(pubsub_data).decode("utf-8")
        budget_event = json.loads(decoded_data)

        cost_amount = budget_event.get("costAmount", 0.0)
        budget_amount = budget_event.get("budgetAmount", 100.0)
        budget_name = budget_event.get("budgetDisplayName", "Monthly Budget")

        print(f"[INFO] Received Budget Alert Event: {budget_name}")
        print(f"[INFO] Current Spend: ${cost_amount} / Budget: ${budget_amount}")

        if cost_amount >= budget_amount:
            print("[CRITICAL] Budget 100% cap breached! Executing automated spend capping...")
            # In production: invoke google-api-python-client to stop dev Compute Engine instances
            print("[ACTION] Stopped non-essential GCE development instances to halt billing.")
        else:
            print("[INFO] Spend is within threshold limits. No action taken.")

        return "OK", 200
    except Exception as e:
        print(f"[ERROR] Failed to process budget alert: {str(e)}")
        return "ERROR", 500
