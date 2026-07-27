#!/usr/bin/env bash
set -euo pipefail

api_url="${RAILWAY_API_URL:-https://backboard.railway.com/graphql/v2}"

services_input="${SERVICES:-}"
if [[ -z "$services_input" ]]; then
  echo "SERVICES is required (space- or comma-separated Railway service names)." >&2
  exit 1
fi
read -r -a services <<<"${services_input//,/ }"

commit_sha="${COMMIT_SHA:-${GITHUB_SHA:-}}"
if [[ -z "$commit_sha" ]]; then
  echo "COMMIT_SHA or GITHUB_SHA is required." >&2
  exit 1
fi

image_prefix="${IMAGE_PREFIX:?IMAGE_PREFIX is required}"
image_prefix="$(printf '%s' "$image_prefix" | tr '[:upper:]' '[:lower:]')"

# Override IMAGE_TAG to force a config change (and therefore a redeploy) when
# the default sha tag already matches what Railway is running.
image_tag="${IMAGE_TAG:-sha-${commit_sha}}"

token="${RAILWAY_TOKEN:-}"
if [[ -z "$token" ]]; then
  echo "RAILWAY_TOKEN is required." >&2
  exit 1
fi

graphql() {
  local payload="$1"
  local response

  response="$(
    curl -fsS \
      -H "Project-Access-Token: ${token}" \
      -H "Content-Type: application/json" \
      --data "$payload" \
      "$api_url"
  )"

  if jq -e '.errors // [] | length > 0' <<<"$response" >/dev/null; then
    jq -r '.errors[]?.message' <<<"$response" >&2
    exit 1
  fi

  printf '%s\n' "$response"
}

write_output() {
  local name="$1"
  local value="${2:-}"

  if [[ -n "${GITHUB_OUTPUT:-}" ]]; then
    printf '%s=%s\n' "$name" "$value" >>"$GITHUB_OUTPUT"
  fi
}

project_id="${RAILWAY_PROJECT_ID:-}"
environment_id="${RAILWAY_ENVIRONMENT_ID:-}"

if [[ -z "$project_id" || -z "$environment_id" ]]; then
  token_payload="$(jq -n '{query: "query { projectToken { projectId environmentId } }"}')"
  token_response="$(graphql "$token_payload")"
  project_id="${project_id:-$(jq -r '.data.projectToken.projectId // empty' <<<"$token_response")}"
  environment_id="${environment_id:-$(jq -r '.data.projectToken.environmentId // empty' <<<"$token_response")}"
fi

if [[ -z "$project_id" || -z "$environment_id" ]]; then
  echo "Could not resolve Railway project/environment IDs. Set RAILWAY_PROJECT_ID and RAILWAY_ENVIRONMENT_ID." >&2
  exit 1
fi

services_payload="$(
  jq -n --arg projectId "$project_id" \
    '{query: "query($projectId: String!) { project(id: $projectId) { services(first: 100) { edges { node { id name } } } } }", variables: {projectId: $projectId}}'
)"
services_response="$(graphql "$services_payload")"

echo "Railway project: ${project_id}"
echo "Railway environment: ${environment_id}"

config_payload="$(
  jq -n --arg environmentId "$environment_id" \
    '{
      query: "query($environmentId: String!) { environment(id: $environmentId) { config(decryptVariables: false) } }",
      variables: {environmentId: $environmentId}
    }'
)"
config_response="$(graphql "$config_payload")"

patch_services='{}'
images='{}'
before_images='{}'

for service in "${services[@]}"; do
  service_id="$(
    jq -r --arg service "$service" \
      '.data.project.services.edges[]?.node | select(.name == $service) | .id' \
      <<<"$services_response"
  )"

  if [[ -z "$service_id" ]]; then
    echo "Could not find Railway service named '${service}' in project ${project_id}." >&2
    exit 1
  fi

  image="${image_prefix}/${service}:${image_tag}"

  service_config="$(
    jq -c --arg serviceId "$service_id" \
      '.data.environment.config.services[$serviceId] // {}' \
      <<<"$config_response"
  )"

  if ! jq -e 'type == "object"' <<<"$service_config" >/dev/null; then
    echo "Railway service config for ${service} is not an object." >&2
    exit 1
  fi

  before_image="$(jq -r '.source.image // empty' <<<"$service_config")"
  echo "Service '${service}' (${service_id}): ${before_image:-<unset>} -> ${image}"

  # Include the current deploy block with source.image so Railway keeps
  # dashboard-managed deploy settings such as multiRegionConfig/replicas.
  service_patch="$(
    jq -c --arg image "$image" '
      {
        source: ((.source // {}) + {image: $image})
      }
      + (if (.deploy // null) == null then {} else {deploy: .deploy} end)
    ' <<<"$service_config"
  )"

  patch_services="$(
    jq -c --arg serviceId "$service_id" --argjson patch "$service_patch" \
      '. + {($serviceId): $patch}' <<<"$patch_services"
  )"
  images="$(jq -c --arg service "$service" --arg image "$image" '. + {($service): $image}' <<<"$images")"
  before_images="$(jq -c --arg service "$service" --arg image "$before_image" '. + {($service): $image}' <<<"$before_images")"
done

message="Deploy ${image_tag}: ${services[*]}"

if [[ "${DRY_RUN:-false}" == "true" ]]; then
  echo "Would commit one environment patch (${message}) in environment ${environment_id}:"
  jq . <<<"$patch_services"
  exit 0
fi

patch_payload="$(
  jq -n \
    --arg environmentId "$environment_id" \
    --argjson patchServices "$patch_services" \
    --arg message "$message" \
    '{
      query: "mutation($environmentId: String!, $patch: EnvironmentConfig!, $message: String) { environmentPatchCommit(environmentId: $environmentId, patch: $patch, commitMessage: $message) }",
      variables: {
        environmentId: $environmentId,
        patch: {services: $patchServices},
        message: $message
      }
    }'
)"
patch_response="$(graphql "$patch_payload")"

patch_workflow_id="$(
  jq -r '
    .data.environmentPatchCommit
    | if type == "string" then . else empty end
  ' <<<"$patch_response"
)"

if [[ -z "$patch_workflow_id" ]]; then
  jq . <<<"$patch_response"
  exit 1
fi
echo "Triggered Railway patch workflow: ${patch_workflow_id}"
echo "Railway patch committed."

echo "Deployed ${services[*]} in one environment patch."
write_output "services" "${services[*]}"
write_output "images" "$images"
write_output "before_images" "$before_images"
write_output "patch_workflow_id" "$patch_workflow_id"
write_output "environment_id" "$environment_id"
