import os
import json
from flask import Flask, request, jsonify
from google.cloud import pubsub_v1

app = Flask(__name__)

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "proj-fund-5283")
TOPIC_ID = os.environ.get("PUBSUB_TOPIC", "order-events-topic")

publisher = pubsub_v1.PublisherClient()
topic_path = publisher.topic_path(PROJECT_ID, TOPIC_ID)

@app.route("/", methods=["GET"])
def health():
    return jsonify({"status": "HEALTHY", "service": "order-service"}), 200

@app.route("/orders", methods=["POST"])
def create_order():
    try:
        data = request.get_json()
        if not data or "order_id" not in data:
            return jsonify({"error": "Invalid payload; order_id required"}), 400

        order_id = data["order_id"]
        payload_bytes = json.dumps(data).encode("utf-8")

        # Publish event to Pub/Sub
        future = publisher.publish(topic_path, payload_bytes, event_type="order_created")
        message_id = future.result()

        return jsonify({
            "status": "SUCCESS",
            "message": f"Order {order_id} accepted and published to event stream",
            "order_id": order_id,
            "message_id": message_id
        }), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
