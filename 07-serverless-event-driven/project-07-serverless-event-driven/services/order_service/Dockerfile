FROM python:3.10-slim

WORKDIR /app

RUN pip install --no-cache-dir flask google-cloud-pubsub gunicorn

COPY app.py ./

ENV PORT=8080

CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--threads", "8", "app:app"]
