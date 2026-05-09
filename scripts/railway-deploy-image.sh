#!/usr/bin/env bash
set -euo pipefail

api_url="${RAILWAY_API_URL:-https://backboard.railway.com/graphql/v2}"
service="${SERVICE:?SERVICE is required}"
commit_sha="${COMMIT_SHA:-${GITHUB_SHA:-}}"

token_source="env"
token="${RAILWAY_TOKEN:-}"
if [[ -z "$token" && -f "$HOME/.railway/config.json" ]]; then
  token_source="local"
  token="$(jq -r '.user.token // empty' "$HOME/.railway/config.json")"
fi

if [[ -z "$token" ]]; then
  echo "RAILWAY_TOKEN is required, or log in locally with the Railway CLI." >&2
  exit 1
fi

image="${IMAGE:-}"
if [[ -z "$image" ]]; then
  image_prefix="${IMAGE_PREFIX:?IMAGE or IMAGE_PREFIX is required}"
  image="$(printf '%s' "${image_prefix}/${service}" | tr '[:upper:]' '[:lower:]'):sha-${commit_sha:?COMMIT_SHA or GITHUB_SHA is required}"
fi

token_header="${RAILWAY_TOKEN_HEADER:-}"
if [[ -z "$token_header" ]]; then
  if [[ "$token_source" == "local" ]]; then
    token_header="authorization"
  else
    token_header="project"
  fi
fi

case "$token_header" in
  authorization | bearer)
    auth_headers=(-H "Authorization: Bearer ${token}" -H "Content-Type: application/json")
    ;;
  project | project-access-token)
    auth_headers=(-H "Project-Access-Token: ${token}" -H "Content-Type: application/json")
    ;;
  both)
    auth_headers=(
      -H "Authorization: Bearer ${token}"
      -H "Project-Access-Token: ${token}"
      -H "Content-Type: application/json"
    )
    ;;
  *)
    echo "Invalid RAILWAY_TOKEN_HEADER '${token_header}'. Use project, authorization, or both." >&2
    exit 1
    ;;
esac

graphql() {
  local payload="$1"
  local response

  response="$(
    curl -fsS \
      "${auth_headers[@]}" \
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

if [[ -f "$HOME/.railway/config.json" ]]; then
  current_dir="$(pwd)"
  project_id="${project_id:-$(jq -r --arg dir "$current_dir" '.projects[$dir].project // empty' "$HOME/.railway/config.json")}"
  environment_id="${environment_id:-$(jq -r --arg dir "$current_dir" '.projects[$dir].environment // empty' "$HOME/.railway/config.json")}"
fi

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
service_id="$(
  jq -r --arg service "$service" \
    '.data.project.services.edges[]?.node | select(.name == $service) | .id' \
    <<<"$services_response"
)"

if [[ -z "$service_id" ]]; then
  echo "Could not find Railway service named '${service}' in project ${project_id}." >&2
  exit 1
fi

echo "Railway project: ${project_id}"
echo "Railway environment: ${environment_id}"
echo "Railway service '${service}': ${service_id}"
echo "Expected source image: ${image}"

read_environment_config() {
  local config_payload

  config_payload="$(
    jq -n --arg environmentId "$environment_id" \
      '{
        query: "query($environmentId: String!) { environment(id: $environmentId) { config(decryptVariables: false) } }",
        variables: {environmentId: $environmentId}
      }'
  )"
  graphql "$config_payload"
}

read_service_config() {
  local config_response
  local service_config

  config_response="$(read_environment_config)"
  service_config="$(
    jq -c --arg serviceId "$service_id" \
      '.data.environment.config.services[$serviceId] // {}' \
      <<<"$config_response"
  )"

  if ! jq -e 'type == "object"' <<<"$service_config" >/dev/null; then
    echo "Railway service config for ${service} is not an object." >&2
    exit 1
  fi

  printf '%s\n' "$service_config"
}

read_configured_image() {
  jq -r '.source.image // empty' \
    <<<"$(read_service_config)"
}

wait_for_configured_image() {
  local expected_image="$1"
  local label="$2"
  local current_image=""

  for attempt in 1 2 3 4 5; do
    current_image="$(read_configured_image)"
    if [[ "$current_image" == "$expected_image" ]]; then
      printf '%s\n' "$current_image"
      return 0
    fi

    if [[ "$attempt" -lt 5 ]]; then
      echo "Railway source image ${label} is ${current_image:-<unset>}; waiting for ${expected_image}." >&2
      sleep 2
    fi
  done

  printf '%s\n' "$current_image"
  return 1
}

before_service_config="$(read_service_config)"
before_image="$(jq -r '.source.image // empty' <<<"$before_service_config")"
echo "Railway source image before update: ${before_image:-<unset>}"

if [[ "${DRY_RUN:-false}" == "true" ]]; then
  echo "Would deploy ${service} (${service_id}) in environment ${environment_id} with image ${image}."
  exit 0
fi

service_patch="$(
  jq -c --arg image "$image" '
    {
      source: ((.source // {}) + {image: $image})
    }
    + (if (.deploy // null) == null then {} else {deploy: .deploy} end)
  ' <<<"$before_service_config"
)"

# Include the current deploy block with source.image so Railway keeps
# dashboard-managed deploy settings such as regions, replicas, and restart policy.
patch_payload="$(
  jq -n \
    --arg environmentId "$environment_id" \
    --arg serviceId "$service_id" \
    --argjson servicePatch "$service_patch" \
    --arg message "Set ${service} image to ${image}" \
    '{
      query: "mutation($environmentId: String!, $patch: EnvironmentConfig!, $message: String) { environmentPatchCommit(environmentId: $environmentId, patch: $patch, commitMessage: $message) }",
      variables: {
        environmentId: $environmentId,
        patch: {services: { ($serviceId): $servicePatch }},
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

if ! configured_image="$(wait_for_configured_image "$image" "after patch")"; then
  echo "Railway source image after patch: ${configured_image:-<unset>}"
  echo "Railway source image for ${service} is \"${configured_image}\", expected \"${image}\"." >&2
  exit 1
fi
echo "Railway source image after patch: ${configured_image:-<unset>}"

echo "Deployed ${service} with image ${image}."
write_output "image" "$image"
write_output "before_image" "$before_image"
write_output "after_update_image" "$configured_image"
write_output "patch_workflow_id" "$patch_workflow_id"
write_output "service_id" "$service_id"
write_output "environment_id" "$environment_id"
