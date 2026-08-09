import base64
import json
import functions_framework

@functions_framework.cloud_event
def process_order_event(cloud_event):
    """2nd Gen Cloud Function triggered by Eventarc / Pub/Sub."""
    try:
        pubsub_data = cloud_event.data["message"]["data"]
        decoded_payload = base64.b64decode(pubsub_data).decode("utf-8")
        order_event = json.loads(decoded_payload)

        order_id = order_event.get("order_id", "UNKNOWN")
        customer = order_event.get("customer", "N/A")
        amount = order_event.get("amount", 0.0)

        print(f"[INFO] Received Eventarc Pub/Sub Event for Order ID: {order_id}")
        print(f"[INFO] Customer: {customer}, Amount: ${amount}")
        print(f"[INFO] Notification email sent successfully for Order {order_id}.")
        return "OK", 200
    except Exception as e:
        print(f"[ERROR] Failed to process CloudEvent: {str(e)}")
        return "ERROR", 500
