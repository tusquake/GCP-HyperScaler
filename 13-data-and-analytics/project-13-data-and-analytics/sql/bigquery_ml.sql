-- DDL: Create Partitioned & Clustered Table
CREATE TABLE IF NOT EXISTS `analytics_ds.web_events` (
  event_id STRING,
  event_timestamp TIMESTAMP,
  user_id STRING,
  event_type STRING,
  page_url STRING,
  churned INT64
)
PARTITION BY DATE(event_timestamp)
CLUSTER BY event_type, user_id;

-- BigQuery ML (BQML): Train Logistic Regression Customer Churn Model
CREATE OR REPLACE MODEL `analytics_ds.churn_model`
OPTIONS(model_type='logistic_reg', input_label_cols=['churned']) AS
SELECT
  user_id,
  event_type,
  churned
FROM `analytics_ds.web_events`
WHERE event_timestamp IS NOT NULL;
