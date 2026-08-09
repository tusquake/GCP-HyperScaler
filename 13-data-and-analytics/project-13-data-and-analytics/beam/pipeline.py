import apache_beam as beam
from apache_beam.options.pipeline_options import PipelineOptions
import json

class ParseAndValidateEvent(beam.DoFn):
    def process(self, element):
        try:
            record = json.loads(element.decode("utf-8"))
            if "user_id" in record and "event_type" in record:
                yield record
        except Exception as e:
            # Handle corrupt payload silently for side outputs
            pass

def run_pipeline():
    options = PipelineOptions(streaming=True)
    with beam.Pipeline(options=options) as p:
        (
            p
            | "ReadFromPubSub" >> beam.io.ReadFromPubSub(subscription="projects/PROJECT_ID/subscriptions/analytics-sub")
            | "ParseJSON" >> beam.ParDo(ParseAndValidateEvent())
            | "Window5Min" >> beam.WindowInto(beam.window.SlidingWindows(size=300, period=60))
            | "WriteToBigQuery" >> beam.io.WriteToBigQuery("PROJECT_ID:analytics_ds.web_events")
        )

if __name__ == "__main__":
    run_pipeline()
