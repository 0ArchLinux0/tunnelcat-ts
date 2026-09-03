#!/usr/bin/env bash
# build-helpers.sh — cross-build the Go helper for all platforms.
#
# This is the build pipeline for the bundled Go data plane.
# The TS CLI dispatches to bin/tunnelcat-helper (host platform)
# or the platform-specific optionalDep at install time.
#
# Requires:
#   - Go 1.27+
#   - A clone of the parked Go repo at $TUNNELCAT_GO_REPO
#     (default: ../tailcat, the parked repo at
#     github.com/0ArchLinux0/tunnelcat)
#   - For full cgo cross-build: a working C cross-compiler
#     toolchain. Without it, builds are non-cgo (CGO_ENABLED=0)
#     and the Rust bridge returns errors at runtime if exercised;
#     the rest of tunnelcat (data plane, CLI, WireGuard, DERP
#     relay) works fine. M2 brings a real cgo cross-build.
#
# Usage:
#   bin/build-helpers.sh
#
# Output:
#   bin/tunnelcat-helper              host platform (macOS/Linux)
#   bin/tunnelcat-helper-linux-amd64  cross-built
#   bin/tunnelcat-helper-darwin-amd64 cross-built
#   bin/tunnelcat-helper-darwin-arm64 cross-built
#   bin/tunnelcat-helper-windows-amd64.exe cross-built

set -euo pipefail

GO_REPO="${TUNNELCAT_GO_REPO:-$HOME/code_repo/tailcat}"
if [[ ! -d "$GO_REPO" ]]; then
  echo "error: GO_REPO not found at $GO_REPO" >&2
  echo "       set TUNNELCAT_GO_REPO=/path/to/tailcat" >&2
  exit 1
fi

cd "$GO_REPO"

# Build the Rust crate first (cgo dependency).
echo "==> Building Rust crate (release)"
(cd crates/tunnelcat-proto && cargo build --release)

# Host platform
echo "==> Building helper for host platform ($(uname -m))"
go build -o "${OLDPWD}/bin/tunnelcat-helper" ./cmd/tunnelcat

# Cross-builds. macOS from any host. Windows from any host.
# Linux/arm64 needs gcc-aarch64-linux-gnu on the build host.
echo "==> Cross-building helper for darwin/amd64"
GOOS=darwin GOARCH=amd64 CGO_ENABLED=0 go build \
  -o "${OLDPWD}/bin/tunnelcat-helper-darwin-amd64" \
  ./cmd/tunnelcat

echo "==> Cross-building helper for darwin/arm64"
GOOS=darwin GOARCH=arm64 CGO_ENABLED=0 go build \
  -o "${OLDPWD}/bin/tunnelcat-helper-darwin-arm64" \
  ./cmd/tunnelcat

echo "==> Cross-building helper for linux/amd64"
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build \
  -o "${OLDPWD}/bin/tunnelcat-helper-linux-amd64" \
  ./cmd/tunnelcat

echo "==> Cross-building helper for linux/arm64"
GOOS=linux GOARCH=arm64 CGO_ENABLED=0 go build \
  -o "${OLDPWD}/bin/tunnelcat-helper-linux-arm64" \
  ./cmd/tunnelcat

echo "==> Cross-building helper for windows/amd64"
GOOS=windows GOARCH=amd64 CGO_ENABLED=0 go build \
  -o "${OLDPWD}/bin/tunnelcat-helper-windows-amd64.exe" \
  ./cmd/tunnelcat

echo ""
echo "Done. Built helpers:"
ls -lh "${OLDPWD}/bin/tunnelcat-helper"*
