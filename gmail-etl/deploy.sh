#!/bin/bash
# Deploy EROS Gmail ETL to Cloud Run

set -e

# Configuration
PROJECT_ID="of-scheduler-proj"
REGION="us-central1"
JOB_NAME="eros-gmail-etl-job"
SERVICE_ACCOUNT="gmail-elt-pipeline-sa@of-scheduler-proj.iam.gserviceaccount.com"
IMAGE_NAME="gcr.io/$PROJECT_ID/$JOB_NAME"

echo "🚀 Deploying EROS Gmail ETL to Cloud Run"
echo "Project: $PROJECT_ID"
echo "Region: $REGION"
echo "Job: $JOB_NAME"

# Build and push Docker image
echo "📦 Building Docker image..."
docker build -t $IMAGE_NAME .

echo "📤 Pushing image to Container Registry..."
docker push $IMAGE_NAME

# Deploy to Cloud Run as a Job
echo "🚀 Deploying to Cloud Run Jobs..."
gcloud run jobs replace --region=$REGION - <<EOF
apiVersion: run.googleapis.com/v1
kind: Job
metadata:
  name: $JOB_NAME
  labels:
    app: eros-gmail-etl
    environment: production
spec:
  template:
    spec:
      template:
        spec:
          serviceAccountName: $SERVICE_ACCOUNT
          timeoutSeconds: 3600
          containers:
          - image: $IMAGE_NAME
            env:
            - name: PROJECT_ID
              value: "$PROJECT_ID"
            - name: BQ_DATASET
              value: "eros_source"
            - name: BQ_TABLE
              value: "mass_message_daily_final"
            - name: TARGET_GMAIL_USER
              value: "kyle@erosops.com"
            - name: GMAIL_SA_SECRET_NAME
              value: "gmail-etl-sa-key"
            - name: STATE_BUCKET
              value: "eros-data-pipe-state"
            - name: GCS_RAW_BUCKET
              value: "eros-report-files-raw-2025"
            - name: MAX_MESSAGES_PER_RUN
              value: "5"
            - name: LOG_LEVEL
              value: "INFO"
            resources:
              limits:
                cpu: "2"
                memory: "4Gi"
          restartPolicy: OnFailure
EOF

echo "✅ Deployment complete!"
echo ""
echo "To run the job manually:"
echo "gcloud run jobs execute $JOB_NAME --region=$REGION"
echo ""
echo "To view logs:"
echo "gcloud logging read 'resource.type=\"cloud_run_job\" AND resource.labels.job_name=\"$JOB_NAME\"' --limit=50 --format='table(timestamp,severity,textPayload)'"