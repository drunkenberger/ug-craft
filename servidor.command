#!/bin/bash
# Doble clic para iniciar el servidor multijugador de EugeCraft.
cd "$(dirname "$0")"
# Cargar nvm si node no está en el PATH (instalación típica en macOS).
if ! command -v node >/dev/null 2>&1; then
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
fi
exec node server.js
