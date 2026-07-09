// Choose the best LAN IP from os.networkInterfaces()-style input.
// Physical adapters are preferred over virtual ones (VMware, WSL, Docker, VPN
// tun/tap, …) so we don't advertise a host-only 192.168.56.x over real Wi-Fi.
// But a virtual-adapter address is still far better than "localhost" — a QR
// code or share link pointing at localhost is useless to other devices — so we
// only fall back to "localhost" when there is no external IPv4 address at all.
const VIRTUAL_ADAPTER = /loopback|vmware|virtualbox|vethernet|wsl|hyper|utun|tun|tap|docker|br-|vbox/;

function pickLanIP(nets) {
  const preferred = [];
  const fallback = [];

  for (const name of Object.keys(nets || {})) {
    for (const net of nets[name] || []) {
      if (net.family !== "IPv4" || net.internal) continue;
      (VIRTUAL_ADAPTER.test(name.toLowerCase()) ? fallback : preferred).push(net.address);
    }
  }

  const best = list =>
    list.find(a => a.startsWith("192.168.")) ||
    list.find(a => a.startsWith("10.")) ||
    list.find(a => a.startsWith("172.")) ||
    list[0];

  return best(preferred) || best(fallback) || "localhost";
}

module.exports = { pickLanIP };
