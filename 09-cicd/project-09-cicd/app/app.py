import os
from flask import Flask, jsonify

app = Flask(__name__)

APP_VERSION = os.environ.get("APP_VERSION", "1.0.0")
APP_ENV = os.environ.get("APP_ENV", "staging")

@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "status": "HEALTHY",
        "service": "cicd-pipeline-demo",
        "version": APP_VERSION,
        "environment": APP_ENV
    }), 200

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
