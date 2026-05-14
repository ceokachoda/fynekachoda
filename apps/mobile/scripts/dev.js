#!/usr/bin/env node
// Wrapper around `expo start` that hardens dev startup on Windows.
//
// Three issues addressed:
//
// 1. Expo CLI hits https://api.expo.dev/v2/versions/latest at boot to validate
//    your installed SDK packages. On Node 24 + Windows + IPv6, undici sometimes
//    hangs and throws `TypeError: fetch failed`, killing `expo start` before
//    Metro can serve. We bypass that check with EXPO_OFFLINE=1 (the documented
//    Expo flag for this scenario). To force the online check back on, run with
//    `EXPO_OFFLINE=0 pnpm dev:mobile`.
//
// 2. As defence-in-depth we pass --dns-result-order=ipv4first as a direct CLI
//    flag to the child Node so any other outbound fetch resolves IPv4 first.
//
// 3. Expo CLI sometimes prints a QR encoding `exp://127.0.0.1:8081` instead of
//    your LAN IP — happens on Windows with multiple network adapters (Hyper-V
//    virtual switch, WSL, VPN clients). A phone on the same Wi-Fi cannot reach
//    127.0.0.1, so the QR scan fails with "could not connect to the server".
//    We auto-detect the real LAN IP and set REACT_NATIVE_PACKAGER_HOSTNAME so
//    Metro advertises it. Override by exporting REACT_NATIVE_PACKAGER_HOSTNAME
//    yourself, or pass --tunnel for ngrok.
//
// Forward argv after the script: `pnpm dev:mobile -- --android`, `--tunnel`,
// `--clear`, etc. still work.

const { spawn } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');

function detectLanIp() {
  const interfaces = os.networkInterfaces();
  const candidates = [];

  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    // Skip virtualization, VPN, WSL, loopback adapters that won't be reachable
    // from a phone on the physical Wi-Fi.
    if (/vEthernet|Hyper-?V|VPN|WSL|VMware|VirtualBox|Loopback|Pseudo|TAP|Tunnel/i.test(name)) {
      continue;
    }
    for (const addr of addrs) {
      if (addr.family !== 'IPv4') continue;
      if (addr.internal) continue;
      const isPrivate =
        /^192\.168\./.test(addr.address) ||
        /^10\./.test(addr.address) ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(addr.address);
      if (isPrivate) {
        candidates.push({ name, address: addr.address });
      }
    }
  }

  // Prefer Wi-Fi-named adapters.
  const wifi = candidates.find((c) => /Wi-?Fi|Wireless/i.test(c.name));
  return (wifi ?? candidates[0])?.address;
}

const cliJs = path.resolve(__dirname, '..', 'node_modules', '@expo', 'cli', 'build', 'bin', 'cli');

const env = { ...process.env };
if (env.EXPO_OFFLINE === undefined) {
  env.EXPO_OFFLINE = '1';
}

if (!env.REACT_NATIVE_PACKAGER_HOSTNAME) {
  const lanIp = detectLanIp();
  if (lanIp) {
    env.REACT_NATIVE_PACKAGER_HOSTNAME = lanIp;
    console.log(`[dev] Advertising Metro on LAN IP ${lanIp}`);
  } else {
    console.warn('[dev] No LAN IP detected; QR may encode localhost. Run with --tunnel if your phone cannot reach the dev server.');
  }
}

const child = spawn(
  process.execPath,
  ['--dns-result-order=ipv4first', cliJs, 'start', ...process.argv.slice(2)],
  { stdio: 'inherit', env },
);

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
