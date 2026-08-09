-- Query 1: Top 10 Most Expensive GCP Services in Billing Account
SELECT
  service.description AS service_name,
  ROUND(SUM(cost), 2) AS total_cost_usd,
  currency
FROM `gcp_billing_export.gcp_billing_export_v1_ALL`
WHERE _PARTITIONDATE >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
GROUP BY service_name, currency
ORDER BY total_cost_usd DESC
LIMIT 10;

-- Query 2: Daily Cost Spend Trend by Region
SELECT
  usage_start_time,
  location.region AS region,
  ROUND(SUM(cost), 2) AS daily_cost_usd
FROM `gcp_billing_export.gcp_billing_export_v1_ALL`
WHERE _PARTITIONDATE >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
GROUP BY usage_start_time, region
ORDER BY usage_start_time DESC;
