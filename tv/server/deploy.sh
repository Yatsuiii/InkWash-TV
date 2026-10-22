#!/usr/bin/env bash
# Deploys the guide service (template.yaml) after checking everything it needs.
# Every check is read-only; nothing in AWS changes until `sam deploy` at the end.
# Usage: ./deploy.sh   (sam deploy --guided then asks for GuideKey, AlertEmail, the limits, and the
# AnthropicKey and GeminiKey: type them there, never into a chat)
set -euo pipefail
cd "$(dirname "$0")"

STACK=inkwash-guide
REGION=us-east-1   # Polly's voice, Claude on Bedrock (without an AnthropicKey) and Nova Reel are all here

problems=()
need() { problems+=("$1"); }

command -v aws >/dev/null || need "aws CLI missing: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
command -v sam >/dev/null || need "sam CLI missing: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"

if command -v node >/dev/null; then
  major=$(node -p 'process.versions.node.split(".")[0]')
  [ "$major" -ge 20 ] || need "node $major is too old, package.json needs >= 20: https://nodejs.org/en/download"
else
  need "node missing: https://nodejs.org/en/download"
fi

if command -v aws >/dev/null; then
  aws sts get-caller-identity >/dev/null 2>&1 \
    || need "aws is not signed in: run 'aws configure' (https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html)"
  current=${AWS_REGION:-${AWS_DEFAULT_REGION:-$(aws configure get region 2>/dev/null || true)}}
  [ "$current" = "$REGION" ] \
    || need "region is '${current:-unset}', this stack needs $REGION: run 'export AWS_REGION=$REGION' or 'aws configure set region $REGION'"
fi

if [ ${#problems[@]} -gt 0 ]; then
  printf 'Not deploying. Fix these first:\n' >&2
  printf '  - %s\n' "${problems[@]}" >&2
  exit 1
fi

npm install --omit=dev
sam deploy --guided --stack-name "$STACK" --region "$REGION" --capabilities CAPABILITY_IAM
