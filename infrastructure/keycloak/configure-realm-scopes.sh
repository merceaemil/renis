#!/usr/bin/env bash
# Keycloak --import-realm omits the "openid" client scope and often mis-links default scopes.
# TYPO3 oauth2_client calls /userinfo (needs openid) and renis_auth matches users by email (needs profile/email).
set -euo pipefail

SERVER="${KEYCLOAK_SERVER:-http://keycloak:8080}"
ADMIN_USER="${KEYCLOAK_ADMIN:-admin}"
ADMIN_PASS="${KEYCLOAK_ADMIN_PASSWORD:-admin}"
REALM="${KEYCLOAK_REALM:-renis}"
CLIENTS="${KEYCLOAK_OIDC_CLIENTS:-renis-typo3,renis-management}"
# OIDC scopes required for TYPO3 / management login (do not use SAML role_list here).
REQUIRED_DEFAULT_SCOPES="${KEYCLOAK_REQUIRED_DEFAULT_SCOPES:-openid profile email roles web-origins acr basic}"
# Branded UI theme — applied to existing realms since --import-realm only runs on first start.
LOGIN_THEME="${KEYCLOAK_LOGIN_THEME:-renis}"
EMAIL_THEME="${KEYCLOAK_EMAIL_THEME:-renis}"
# Internationalization — also re-applied on existing realms (English + French).
I18N_ENABLED="${KEYCLOAK_I18N_ENABLED:-true}"
I18N_SUPPORTED_LOCALES="${KEYCLOAK_I18N_SUPPORTED_LOCALES:-en,fr}"
I18N_DEFAULT_LOCALE="${KEYCLOAK_I18N_DEFAULT_LOCALE:-en}"

KCADM=/opt/keycloak/bin/kcadm.sh

echo "configure-realm-scopes: waiting for Keycloak admin API at ${SERVER}..."
READY=0
for _ in $(seq 1 90); do
  if "${KCADM}" config credentials \
    --server "${SERVER}" \
    --realm master \
    --user "${ADMIN_USER}" \
    --password "${ADMIN_PASS}" >/dev/null 2>&1 \
    && "${KCADM}" get "realms/${REALM}" >/dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 2
done
if [[ "${READY}" -ne 1 ]]; then
  echo "configure-realm-scopes: Keycloak admin API not ready after 180s" >&2
  exit 1
fi

# kcadm -q name=… is not an exact match; filter id,name CSV in bash (Keycloak image has no awk).
resolve_scope_id() {
  local name="$1"
  local line scope_id scope_name
  while IFS= read -r line; do
    [[ -z "${line}" ]] && continue
    scope_id="${line%%,*}"
    scope_name="${line#*,}"
    if [[ "${scope_name}" == "${name}" ]]; then
      echo "${scope_id}"
      return 0
    fi
  done <<< "$("${KCADM}" get client-scopes -r "${REALM}" --fields id,name --format csv --noquotes 2>/dev/null || true)"
  return 1
}

client_has_default_scope() {
  local cid="$1"
  local scope_id="$2"
  "${KCADM}" get "clients/${cid}/default-client-scopes" -r "${REALM}" --fields id 2>/dev/null | grep -q "${scope_id}"
}

# Create openid scope if the realm import did not (KC #16168).
OPENID_ID=$(resolve_scope_id openid || true)
if [[ -z "${OPENID_ID}" ]]; then
  echo "configure-realm-scopes: creating openid client scope in realm ${REALM}"
  CREATE_OUT=$("${KCADM}" create client-scopes -r "${REALM}" -f - <<'EOF'
{
  "name": "openid",
  "protocol": "openid-connect",
  "attributes": {
    "include.in.token.scope": "true",
    "display.on.consent.screen": "false"
  }
}
EOF
  )
  OPENID_ID=$(echo "${CREATE_OUT}" | sed -n "s/.*id '\\([^']*\\)'.*/\\1/p")
  if [[ -z "${OPENID_ID}" ]]; then
    OPENID_ID=$(resolve_scope_id openid || true)
  fi
fi

IFS=',' read -ra CLIENT_IDS <<< "${CLIENTS}"
for CLIENT_ID_NAME in "${CLIENT_IDS[@]}"; do
  CLIENT_ID_NAME="${CLIENT_ID_NAME//[[:space:]]/}"
  [[ -z "${CLIENT_ID_NAME}" ]] && continue
  CID=$("${KCADM}" get clients -r "${REALM}" -q "clientId=${CLIENT_ID_NAME}" --fields id --format csv --noquotes 2>/dev/null | tail -1)
  if [[ -z "${CID}" ]]; then
    echo "configure-realm-scopes: client ${CLIENT_ID_NAME} not found, skipping"
    continue
  fi
  echo "configure-realm-scopes: ensuring default scopes on ${CLIENT_ID_NAME}"
  for SCOPE_NAME in ${REQUIRED_DEFAULT_SCOPES}; do
    SCOPE_ID=$(resolve_scope_id "${SCOPE_NAME}" || true)
    if [[ -z "${SCOPE_ID}" ]]; then
      echo "configure-realm-scopes: warning: client scope ${SCOPE_NAME} not found in realm ${REALM}" >&2
      continue
    fi
    if client_has_default_scope "${CID}" "${SCOPE_ID}"; then
      continue
    fi
    echo "configure-realm-scopes:   + ${SCOPE_NAME}"
    "${KCADM}" update "clients/${CID}/default-client-scopes/${SCOPE_ID}" -r "${REALM}"
  done
done

# Ensure the realm uses the RENIS login + email themes. realm-renis.json sets these
# on import, but Keycloak skips realm-level updates if the realm already exists.
if [[ -n "${LOGIN_THEME}" || -n "${EMAIL_THEME}" ]]; then
  echo "configure-realm-scopes: ensuring realm themes (loginTheme=${LOGIN_THEME}, emailTheme=${EMAIL_THEME})"
  UPDATE_ARGS=()
  [[ -n "${LOGIN_THEME}" ]] && UPDATE_ARGS+=("-s" "loginTheme=${LOGIN_THEME}")
  [[ -n "${EMAIL_THEME}" ]] && UPDATE_ARGS+=("-s" "emailTheme=${EMAIL_THEME}")
  "${KCADM}" update "realms/${REALM}" "${UPDATE_ARGS[@]}" || \
    echo "configure-realm-scopes: warning: failed to update realm themes" >&2
fi

# Ensure the realm has internationalization on with the supported locales.
# Keycloak ignores realm-level keys from realm-renis.json on subsequent boots.
if [[ "${I18N_ENABLED}" == "true" ]]; then
  echo "configure-realm-scopes: ensuring i18n (locales=${I18N_SUPPORTED_LOCALES}, default=${I18N_DEFAULT_LOCALE})"
  # kcadm needs a JSON array for supportedLocales: split CSV and quote each value.
  LOCALES_JSON="["
  FIRST=1
  IFS=',' read -ra LOCALE_ARR <<< "${I18N_SUPPORTED_LOCALES}"
  for L in "${LOCALE_ARR[@]}"; do
    L="${L//[[:space:]]/}"
    [[ -z "${L}" ]] && continue
    if [[ "${FIRST}" -eq 1 ]]; then
      LOCALES_JSON+="\"${L}\""
      FIRST=0
    else
      LOCALES_JSON+=",\"${L}\""
    fi
  done
  LOCALES_JSON+="]"
  "${KCADM}" update "realms/${REALM}" \
    -s "internationalizationEnabled=true" \
    -s "defaultLocale=${I18N_DEFAULT_LOCALE}" \
    -s "supportedLocales=${LOCALES_JSON}" || \
    echo "configure-realm-scopes: warning: failed to update realm i18n settings" >&2
fi

echo "configure-realm-scopes: done"
