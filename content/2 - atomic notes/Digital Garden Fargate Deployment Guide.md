2026-07-04 11:08 (revised 2026-07-04 — v2, selected path)

# Digital Garden Fargate Deployment Guide
*AI Generated*
[[homelab]], [[SAA-C03]], [[Digital Garden EC2 Deployment Guide]]

**Status (2026-07-12): built and partially verified live.** All AWS infrastructure exists and works: S3 bucket, both IAM roles, ECR image, task definition, cluster, EventBridge rule + invoke role. A real manual `run-task` confirmed the full chain works end to end through `git clone → npm ci → S3 vault pull → rsync → git commit → git push` — a real commit with real vault content landed on GitHub from a live Fargate task. **Not yet verified:** `quartz build` and `wrangler deploy` — blocked on the `digitalgarden/cloudflare-token` secret, which hasn't been created yet (see Step 4). Also empirically hit the overlapping-runs race condition described in Notes below, from firing multiple manual test runs close together — not a design flaw, confirms the documented tradeoff is real.

Move the automated vault sync + deploy pipeline off any always-on server entirely. Instead of an EC2 box running cron 24/7, package `pipeline.sh` into a container and run it as an event-triggered ECS Fargate task — compute only exists for the ~10 minutes/day the job actually runs.

## Why This Over Plain EC2

The [[Digital Garden EC2 Deployment Guide|EC2 plan]] solves the "Mac must be awake" problem but pays for a full instance 24/7 and needs SSH key management, systemd units, and manual patching. Fargate trades that for:

- **No server to patch or SSH into** — task runs, does its job, disappears
- **Pay-per-second compute** — ~10 min/day vs 24/7 billing
- **Broader AWS surface for SAA-C03 study**: ECS, Fargate, ECR, IAM task/execution roles, Secrets Manager, EventBridge Scheduler, CloudWatch Logs, SNS — vs just EC2 + cron
- **No long-lived SSH key on a box** — task role grants scoped, temporary credentials instead

Tradeoff: more moving parts to wire up front (Dockerfile, ECR push, task definition, IAM roles) vs a single EC2 launch. Worth it if the goal is AWS exposure, not just uptime.

## Architecture

```
Mac (launchd, lightweight)
   │ aws s3 sync ~/Documents/Me → s3://digitalgarden-vault-sync --delete
   │ aws s3 cp /dev/null s3://digitalgarden-vault-sync/.sync-complete   (marker, written last)
   ▼
S3 bucket (vault mirror) ──PutObject on .sync-complete──► EventBridge rule ──► ECS RunTask (Fargate)
                                                                                    │
                                                                    container: git clone digitalgarden fresh (entrypoint, not baked)
                                                                                    │ npm ci
                                                                                    │ pull vault from S3
                                                                                    │ rsync → content/
                                                                                    │ git commit + push  (token from Secrets Manager)
                                                                                    │ npx quartz build
                                                                                    │ npx wrangler deploy (token from Secrets Manager)
                                                                                    │
                                                                          stdout/stderr → CloudWatch Logs (awslogs driver)
                                                                          failure → EventBridge rule → SNS
                                                                                    │
                                                                          Cloudflare Workers (prod)
```

The Mac still does one small thing — mirror the vault to S3. This is a plain `aws s3 sync`, not the full pipeline, so it stays cheap and simple even though it's local. Everything downstream (git, build, deploy) moves to the container.

**Why a marker object, not a rule on every PutObject:** `aws s3 sync` of a whole vault fires one `PutObject` per changed file — a 20-note edit session would queue 20 task launches back to back, racing each other's `git push`. The Mac sync script writes `.sync-complete` as its last step; the EventBridge rule filters on that single object key, so exactly one task run happens per Mac sync, no matter how many notes changed.

**Why event-driven over the original nightly cron:** fires right when the vault actually changed instead of a fixed midnight guess (and works if the Mac happens to be asleep at midnight but synced earlier). Also swaps a fixed `schedule-expression` for an S3-event `EventPattern` rule — different EventBridge rule type, more SAA reps.

## Steps

### 1. Containerize the Pipeline

**Bug in the original design, fixed here:** don't `COPY . .` the repo into the image. That bakes the git working tree at image-build time — the *next* task run reuses the same image, so its local branch is still stuck at that build-time commit. `scripts/lib/02-git-publish.sh` does a plain `git push origin main` with no pull first, so the second run onward gets rejected as non-fast-forward. Fix: image ships no app code at all, just the OS deps + a thin entrypoint. The entrypoint `git clone`s the repo fresh every task run, so the working tree always starts from current `origin/main`.

`Dockerfile` at repo root:

```dockerfile
FROM node:22-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    git rsync awscli openssh-client ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
```

`entrypoint.sh` (new file, repo root):

```bash
#!/bin/bash
set -euo pipefail

GITHUB_TOKEN=$(aws secretsmanager get-secret-value \
  --secret-id digitalgarden/git-pat --query SecretString --output text)

git clone "https://x-access-token:${GITHUB_TOKEN}@github.com/ethancorn21/digitalgarden.git" /app
cd /app
npm ci

bash scripts/pipeline.sh
```

The embedded token in the clone URL becomes `origin`'s credential, so `git push origin main` later in the pipeline reuses it automatically — no separate git-credential setup needed inside the container.

Update `scripts/lib/01-sync-vault.sh` to pull from S3 instead of a local vault path:

```bash
# From:
VAULT="$HOME/Documents/Me"
# To:
VAULT="/tmp/vault"
aws s3 sync s3://digitalgarden-vault-sync "$VAULT" --delete
```

Order matters — `VAULT` gets set first, then immediately populated by the sync, *before* anything later in the script tries to read from it. `--delete` is effectively inert here since `/tmp/vault` starts empty on every fresh container run — included mainly for consistency with the Mac-side sync command below, which does need it (to remove notes you've actually deleted from the vault).

**Also fix `pipeline.sh`'s log path** — it currently hardcodes `LOG_FILE="$HOME/Library/Logs/digitalgarden-sync.log"` (macOS-only path, doesn't exist in the container). Point it at stdout instead so the CloudWatch `awslogs` log driver picks it up:

```bash
# From:
LOG_FILE="$HOME/Library/Logs/digitalgarden-sync.log"
# To:
LOG_FILE="/dev/stdout"
```

### 2. Push Image to ECR

Build context is now just `Dockerfile` + `entrypoint.sh` — no app code baked in, so this image only needs rebuilding/repushing when the *pipeline infrastructure* changes (new OS deps, entrypoint logic), not on every content change.

```bash
aws ecr create-repository --repository-name digitalgarden-pipeline --region <region>

aws ecr get-login-password --region <region> | \
  docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com

docker build --platform linux/amd64 -t digitalgarden-pipeline .
docker tag digitalgarden-pipeline:latest <account-id>.dkr.ecr.<region>.amazonaws.com/digitalgarden-pipeline:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/digitalgarden-pipeline:latest
```

**`--platform linux/amd64` is required if building on Apple Silicon** — hit this during the real build. Docker defaults to building for the host's architecture (arm64 on M-series Macs); the task definition defaults to expecting `x86_64` (Fargate's default `runtimePlatform`) unless told otherwise. Skip the flag and you get `CannotPullContainerError: image Manifest does not contain descriptor matching platform 'linux/amd64'` at task launch — the image exists in ECR, just for the wrong architecture.

### 3. S3 Bucket + Mac-Side Sync

```bash
aws s3 mb s3://digitalgarden-vault-sync --region <region>
```

Enable versioning (recovery insurance if a bad sync overwrites/corrupts vault content):

```bash
aws s3api put-bucket-versioning \
  --bucket digitalgarden-vault-sync \
  --versioning-configuration Status=Enabled
```

IAM user for the Mac, write-only to this bucket (least privilege — Mac never needs read access back):

```json
{
  "Effect": "Allow",
  "Action": ["s3:PutObject", "s3:ListBucket"],
  "Resource": ["arn:aws:s3:::digitalgarden-vault-sync", "arn:aws:s3:::digitalgarden-vault-sync/*"]
}
```

Replace the launchd job's rsync step with:

```bash
aws s3 sync ~/Documents/Me s3://digitalgarden-vault-sync --delete
aws s3 cp /dev/null s3://digitalgarden-vault-sync/.sync-complete
```

The second line is the debounce marker (see Architecture note above) — it must run *after* the sync completes, and it's the only object the EventBridge rule below reacts to.

Enable S3 → EventBridge forwarding on the bucket (off by default):

```bash
aws s3api put-bucket-notification-configuration \
  --bucket digitalgarden-vault-sync \
  --notification-configuration '{"EventBridgeConfiguration": {}}'
```

### 4. Secrets Manager

Store the two tokens the container needs at runtime:

```bash
aws secretsmanager create-secret --name digitalgarden/git-pat --secret-string "<PAT>"
aws secretsmanager create-secret --name digitalgarden/cloudflare-token --secret-string "<CF_API_TOKEN>"
```

`02-git-publish.sh` and `04-deploy.sh` fetch them at runtime instead of relying on a `.git-credentials` file or local `wrangler login`:

```bash
GITHUB_TOKEN=$(aws secretsmanager get-secret-value --secret-id digitalgarden/git-pat --query SecretString --output text)
CLOUDFLARE_API_TOKEN=$(aws secretsmanager get-secret-value --secret-id digitalgarden/cloudflare-token --query SecretString --output text)
```

### 5. IAM Roles + ECS Cluster + Task Definition

**IAM roles first** — both trusted by the ECS agent (`ecs-tasks.amazonaws.com`), scoped to different jobs (see distinction below):

```bash
cat > trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "ecs-tasks.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

aws iam create-role \
  --role-name digitalgarden-ecs-execution-role \
  --assume-role-policy-document file://trust-policy.json

aws iam attach-role-policy \
  --role-name digitalgarden-ecs-execution-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy

aws iam create-role \
  --role-name digitalgarden-ecs-task-role \
  --assume-role-policy-document file://trust-policy.json
```

**Known gap in the managed policy — hit this during the real build:** `AmazonECSTaskExecutionRolePolicy` grants `logs:CreateLogStream` + `logs:PutLogEvents` but NOT `logs:CreateLogGroup`. Since the task definition uses `awslogs-create-group: true` (log group doesn't exist yet, created on first run), the task fails immediately with `AccessDeniedException` on `logs:CreateLogGroup` unless this is added:

```bash
cat > execution-role-logs-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "logs:CreateLogGroup",
      "Resource": "arn:aws:logs:<region>:<account-id>:log-group:/ecs/digitalgarden-pipeline:*"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name digitalgarden-ecs-execution-role \
  --policy-name CreateLogGroup \
  --policy-document file://execution-role-logs-policy.json
```

Task role — S3 read on the vault bucket:

```bash
cat > task-role-s3-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:ListBucket"],
      "Resource": [
        "arn:aws:s3:::digitalgarden-vault-sync",
        "arn:aws:s3:::digitalgarden-vault-sync/*"
      ]
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name digitalgarden-ecs-task-role \
  --policy-name S3VaultRead \
  --policy-document file://task-role-s3-policy.json
```

Task role — Secrets Manager read, scoped to one specific secret ARN (not a wildcard — least privilege):

```bash
cat > task-role-secrets-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:<region>:<account-id>:secret:digitalgarden/git-pat-XXXXXX"
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name digitalgarden-ecs-task-role \
  --policy-name SecretsGitPAT \
  --policy-document file://task-role-secrets-policy.json
```
(Swap `-XXXXXX` for the real random suffix on the secret's ARN — get it via `aws secretsmanager describe-secret --secret-id digitalgarden/git-pat --query ARN --output text`. Repeat this policy, or extend the `Resource` list, once the Cloudflare token secret exists too.)

**Cluster:**

```bash
aws ecs create-cluster --cluster-name digitalgarden
```

Task definition (Fargate launch type, `awsvpc` network mode):

```json
{
  "family": "digitalgarden-pipeline",
  "requiresCompatibilities": ["FARGATE"],
  "networkMode": "awsvpc",
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::<account-id>:role/digitalgarden-ecs-execution-role",
  "taskRoleArn": "arn:aws:iam::<account-id>:role/digitalgarden-ecs-task-role",
  "containerDefinitions": [{
    "name": "pipeline",
    "image": "<account-id>.dkr.ecr.<region>.amazonaws.com/digitalgarden-pipeline:latest",
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/digitalgarden-pipeline",
        "awslogs-region": "<region>",
        "awslogs-stream-prefix": "run",
        "awslogs-create-group": "true"
      }
    }
  }]
}
```

Two distinct IAM roles here — good SAA distinction:
- **Execution role**: lets ECS pull the image from ECR and write logs to CloudWatch
- **Task role**: what the *running container* can do — read the S3 vault bucket, read the two secrets

```bash
aws ecs register-task-definition --cli-input-json file://task-def.json
```
**
### 6. Networking

No inbound access needed (it's a batch job, not a server) — use a public subnet in the default VPC with `assignPublicIp: ENABLED` so the task can reach ECR, S3, GitHub, and Cloudflare without paying for a NAT Gateway. Security group: all egress, no ingress.

### 7. EventBridge Rule (S3 event, not a schedule)

**EventBridge's own role first** — separate from the execution/task roles, trusted by `events.amazonaws.com` (not `ecs-tasks.amazonaws.com`). EventBridge needs permission to *take an action in another service* (start a Fargate task) — this role grants exactly that, scoped tight: `ecs:RunTask` limited to this one task definition, and `iam:PassRole` limited to just the execution + task role ARNs (required so EventBridge can hand those roles to the new task without having broad access to every role in the account):

```bash
cat > eventbridge-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Service": "events.amazonaws.com" },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

aws iam create-role \
  --role-name eventbridge-ecs-invoke-role \
  --assume-role-policy-document file://eventbridge-trust-policy.json

cat > eventbridge-invoke-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ecs:RunTask",
      "Resource": "arn:aws:ecs:<region>:<account-id>:task-definition/digitalgarden-pipeline:*"
    },
    {
      "Effect": "Allow",
      "Action": "iam:PassRole",
      "Resource": [
        "arn:aws:iam::<account-id>:role/digitalgarden-ecs-execution-role",
        "arn:aws:iam::<account-id>:role/digitalgarden-ecs-task-role"
      ]
    }
  ]
}
EOF

aws iam put-role-policy \
  --role-name eventbridge-ecs-invoke-role \
  --policy-name RunDigitalgardenTask \
  --policy-document file://eventbridge-invoke-policy.json
```

**Then the rule** — an `EventBridge Scheduler` cron entry was the original plan; swapped for an event-pattern rule matching the `.sync-complete` marker object, so the task fires right when the Mac finishes syncing instead of on a fixed clock:

```bash
aws events put-rule \
  --name digitalgarden-vault-synced \
  --event-pattern '{
    "source": ["aws.s3"],
    "detail-type": ["Object Created"],
    "detail": {
      "bucket": {"name": ["digitalgarden-vault-sync"]},
      "object": {"key": [".sync-complete"]}
    }
  }'

aws events put-targets \
  --rule digitalgarden-vault-synced \
  --targets '[{
    "Id": "digitalgarden-task",
    "Arn": "arn:aws:ecs:<region>:<account-id>:cluster/digitalgarden",
    "RoleArn": "arn:aws:iam::<account-id>:role/eventbridge-ecs-invoke-role",
    "EcsParameters": {
      "TaskDefinitionArn": "arn:aws:ecs:<region>:<account-id>:task-definition/digitalgarden-pipeline",
      "LaunchType": "FARGATE",
      "NetworkConfiguration": {
        "awsvpcConfiguration": {
          "Subnets": ["<public-subnet-id>"],
          "SecurityGroups": ["<sg-id>"],
          "AssignPublicIp": "ENABLED"
        }
      }
    }
  }]'
```

Same `eventbridge-ecs-invoke-role` (needs `ecs:RunTask` + `iam:PassRole` for the task/execution roles) as the original scheduler plan — only the rule type changed, from a time-based schedule to an event pattern.

### 8. Verify

First, run the task manually — isolates container/IAM/task-def problems from the event trigger:

```bash
aws ecs run-task --cluster digitalgarden --task-definition digitalgarden-pipeline \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<subnet-id>],securityGroups=[<sg-id>],assignPublicIp=ENABLED}"
```

Check logs:

```bash
aws logs tail /ecs/digitalgarden-pipeline --follow
```

Then verify the actual event path end to end — drop the marker manually and confirm a task launches without calling `run-task` yourself:

```bash
aws s3 cp /dev/null s3://digitalgarden-vault-sync/.sync-complete
aws ecs list-tasks --cluster digitalgarden   # should show a new task shortly after
```

### 9. Decommission

- Trim the Mac launchd job down to just the `aws s3 sync` line — no more git/build/deploy locally
- The [[Digital Garden EC2 Deployment Guide|EC2 plan]] is no longer needed if this path is taken — no EC2 instance to launch at all

## Follow-Up: Failure Alerting (not blocking initial build, do before trusting the pipeline unattended)

Two layers — generic "something failed" plus a specific "git auth failed" signal, since the second one is the actual PAT-expiration case and a generic alarm just says "task failed" with no clue why.

### 1. SNS topic (shared target for both alarms below)

```bash
aws sns create-topic --name digitalgarden-pipeline-alerts
aws sns subscribe --topic-arn <topic-arn> --protocol email --notification-endpoint <your-email>
```
Confirm the subscription via the email AWS sends — required before it'll deliver.

### 2. Generic: EventBridge rule on any non-zero exit

EventBridge rule matching ECS task state changes where the task stopped with a non-zero exit code, targeting the SNS topic:

```json
{
  "source": ["aws.ecs"],
  "detail-type": ["ECS Task State Change"],
  "detail": {
    "clusterArn": ["arn:aws:ecs:<region>:<account-id>:cluster/digitalgarden"],
    "lastStatus": ["STOPPED"],
    "containers": { "exitCode": [{ "anything-but": 0 }] }
  }
}
```

### 3. Specific: CloudWatch Logs metric filter + alarm on git auth failure

Catches the PAT-expiration case by name instead of a generic failure. `git push` with a bad/expired token logs something like `remote: Invalid username or token` or `Authentication failed` to stdout, which flows to `/ecs/digitalgarden-pipeline` via the `awslogs` driver already configured above.

```bash
aws logs put-metric-filter \
  --log-group-name /ecs/digitalgarden-pipeline \
  --filter-name git-auth-failure \
  --filter-pattern "Authentication failed" \
  --metric-transformations \
    metricName=GitAuthFailure,metricNamespace=DigitalGarden,metricValue=1,defaultValue=0

aws cloudwatch put-metric-alarm \
  --alarm-name digitalgarden-git-auth-failure \
  --namespace DigitalGarden \
  --metric-name GitAuthFailure \
  --statistic Sum \
  --period 300 \
  --evaluation-periods 1 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --alarm-actions <topic-arn>
```

This is a true **CloudWatch Alarm** (metric threshold), distinct from the EventBridge/SNS rule above (event pattern match) — different mechanism, same destination. Worth having both: the EventBridge rule catches failures this filter pattern doesn't anticipate (e.g. `wrangler deploy` failing for an unrelated reason), the metric filter gives a precise "your PAT died" signal instead of a generic "something broke, go read logs."

### S3 Backup of Built Site

After `quartz build`, sync `public/` to a backup bucket before `wrangler deploy` — free point-in-time snapshot of every build, expire via lifecycle rule after 30 days.

## Cost

Task runs ~10 min/day (0.5 vCPU / 1GB):
- Fargate compute: ~5 vCPU-hr + 10 GB-hr per month ≈ **$0.25/mo**
- Secrets Manager: 2 secrets × $0.40 ≈ **$0.80/mo**
- CloudWatch Logs, EventBridge rule invocations, S3 event notifications, ECR storage: negligible at this volume ($1 per million EventBridge events, well under that here)
- **Total: roughly $1-2/mo (~$15-20/yr)** — cheaper than the always-on EC2 plan, for more AWS service exposure

## Notes

- Container needs a deploy key or fine-grained PAT for git push — do not bake it into the image, always fetch from Secrets Manager at runtime
- `wrangler` in the container authenticates via `CLOUDFLARE_API_TOKEN` env var, not `wrangler login` (that flow needs a browser)
- Local Docker build should be tested (`docker run` the image against a sample vault) before pushing to ECR
- Deploy target is Cloudflare **Workers** (`wrangler deploy`), not Pages — the build happens in the container (`quartz build`), Cloudflare just receives the finished `public/` via API. No Cloudflare-side build-count limit to worry about regardless of trigger frequency.
- `.sync-complete` marker approach means a burst of rapid Mac syncs (e.g. editing several notes in a row) could still overlap if a sync finishes mid-task-run — acceptable for a personal single-writer vault, but not safe as-is if this pattern were reused somewhere with concurrent writers
