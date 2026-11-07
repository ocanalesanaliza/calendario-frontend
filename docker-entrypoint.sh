#!/bin/sh
set -eu

case "${MAINTENANCE_MODE:-false}" in
  false)
    cp /etc/nginx/templates/default.conf /etc/nginx/conf.d/default.conf
    ;;
  true)
    cp /etc/nginx/templates/maintenance.conf /etc/nginx/conf.d/default.conf
    ;;
  *)
    echo "MAINTENANCE_MODE must be 'true' or 'false' (received: ${MAINTENANCE_MODE})" >&2
    exit 1
    ;;
esac
