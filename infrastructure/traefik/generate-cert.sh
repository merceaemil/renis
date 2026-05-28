#!/usr/bin/env bash
# Generate a self-signed TLS cert for renis.arxia.com (dev only).
# Re-run safely: skips work if cert is already present and valid.
set -euo pipefail

CERT_DIR="$(cd "$(dirname "$0")" && pwd)/certs"
CRT="${CERT_DIR}/renis.arxia.com.crt"
KEY="${CERT_DIR}/renis.arxia.com.key"

mkdir -p "${CERT_DIR}"

if [[ -f "${CRT}" && -f "${KEY}" ]]; then
  if openssl x509 -in "${CRT}" -noout -checkend 86400 >/dev/null 2>&1; then
    echo "Cert already present and valid: ${CRT}"
    exit 0
  fi
fi

cat > "${CERT_DIR}/openssl.cnf" <<'CNF'
[req]
default_bits       = 2048
prompt             = no
default_md         = sha256
distinguished_name = dn
req_extensions     = req_ext

[dn]
C  = BI
ST = Bujumbura
L  = Bujumbura
O  = RENIS-BI Dev
CN = renis.arxia.com

[req_ext]
subjectAltName = @alt_names

[alt_names]
DNS.1 = renis.arxia.com
DNS.2 = *.renis.arxia.com
DNS.3 = localhost
IP.1  = 127.0.0.1
CNF

openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
  -keyout "${KEY}" \
  -out "${CRT}" \
  -config "${CERT_DIR}/openssl.cnf" \
  -extensions req_ext

chmod 644 "${CRT}" "${KEY}"

echo "Generated self-signed cert for renis.arxia.com:"
echo "  ${CRT}"
echo "  ${KEY}"
