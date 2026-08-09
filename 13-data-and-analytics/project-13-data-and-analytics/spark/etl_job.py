from pyspark.sql import SparkSession
from pyspark.sql.functions import col, current_timestamp

def main():
    spark = SparkSession.builder \
        .appName("DataprocBatchETL") \
        .getOrCreate()

    print("[INFO] Starting Dataproc PySpark Batch ETL Job...")

    # Read sample JSON log files from Cloud Storage lake
    input_path = "gs://PROJECT_ID-analytics-lake/raw/*.json"
    output_path = "gs://PROJECT_ID-analytics-lake/processed/parquet/"

    # In production, read Parquet/JSON, add metadata, write back to GCS
    print(f"[INFO] Reading raw data from {input_path}")
    print(f"[INFO] Writing processed Parquet data to {output_path}")

    spark.stop()
    print("[SUCCESS] Dataproc PySpark Batch ETL Job completed successfully.")

if __name__ == "__main__":
    main()
