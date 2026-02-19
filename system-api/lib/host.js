// ── Host system data reader
// Reads directly from /proc, nvidia-smi, ip, wg — NOT from Docker stats
const { execSync, exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// ── CPU usage (from /proc/stat)
let lastCpuTimes = null;
function getCpuPercent() {
  try {
    const stat = fs.readFileSync('/proc/stat', 'utf8');
    const line = stat.split('\n')[0];
    const parts = line.split(/\s+/).slice(1).map(Number);
    const [user, nice, system, idle, iowait, irq, softirq, steal] = parts;
    const total = parts.reduce((a, b) => a + b, 0);
    const idleTime = idle + (iowait || 0);

    if (!lastCpuTimes) {
      lastCpuTimes = { total, idle: idleTime };
      return 0;
    }

    const diffTotal = total - lastCpuTimes.total;
    const diffIdle  = idleTime - lastCpuTimes.idle;
    lastCpuTimes = { total, idle: idleTime };

    return diffTotal > 0 ? Math.round((1 - diffIdle / diffTotal) * 100 * 10) / 10 : 0;
  } catch { return null; }
}

// ── CPU temperature
function getCpuTemp() {
  try {
    // Try thermal zone first (most CPUs)
    const zones = fs.readdirSync('/sys/class/thermal')
      .filter(d => d.startsWith('thermal_zone'));
    for (const zone of zones) {
      const type = fs.readFileSync(`/sys/class/thermal/${zone}/type`, 'utf8').trim();
      if (type.includes('cpu') || type.includes('x86') || type.includes('acpi')) {
        const temp = parseInt(fs.readFileSync(`/sys/class/thermal/${zone}/temp`, 'utf8')) / 1000;
        if (temp > 0 && temp < 150) return temp;
      }
    }
    // Fallback: any thermal zone
    const temp = parseInt(fs.readFileSync('/sys/class/thermal/thermal_zone0/temp', 'utf8')) / 1000;
    return temp > 0 ? temp : null;
  } catch { return null; }
}

// ── RAM (from /proc/meminfo)
function getMemInfo() {
  try {
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf8');
    const getValue = (key) => {
      const match = meminfo.match(new RegExp(`^${key}:\\s+(\\d+)`, 'm'));
      return match ? parseInt(match[1]) * 1024 : 0; // KB → bytes
    };
    const total = getValue('MemTotal');
    const free  = getValue('MemFree');
    const buffers = getValue('Buffers');
    const cached = getValue('Cached');
    const sReclaimable = getValue('SReclaimable');
    const used = total - free - buffers - cached - sReclaimable;
    const swap_total = getValue('SwapTotal');
    const swap_free  = getValue('SwapFree');

    return {
      total_bytes: total,
      used_bytes:  Math.max(0, used),
      free_bytes:  total - used,
      total_gb:    Math.round(total / 1073741824 * 100) / 100,
      used_gb:     Math.round(Math.max(0, used) / 1073741824 * 100) / 100,
      percent:     total > 0 ? Math.round(Math.max(0, used) / total * 100 * 10) / 10 : 0,
      swap_total_gb: Math.round(swap_total / 1073741824 * 100) / 100,
      swap_used_gb:  Math.round((swap_total - swap_free) / 1073741824 * 100) / 100,
      swap_percent:  swap_total > 0 ? Math.round((swap_total - swap_free) / swap_total * 100) : 0,
    };
  } catch { return null; }
}

// ── Disk (from /proc/mounts + statvfs)
function getDisks() {
  try {
    const output = execSync(
      "df -BK --output=source,fstype,size,used,avail,pcent,target 2>/dev/null | tail -n +2",
      { timeout: 5000 }
    ).toString().trim();

    return output.split('\n')
      .map(line => {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 7) return null;
        const [source, fstype, size, used, avail, pcent, mount] = parts;
        // Skip pseudo/virtual filesystems
        if (['tmpfs','devtmpfs','overlay','squashfs','udev','cgroupfs','cgroup'].includes(fstype)) return null;
        if (mount.startsWith('/dev') || mount.startsWith('/sys') || mount.startsWith('/proc') || mount.startsWith('/run')) return null;
        const parseK = v => parseInt(v) * 1024;
        return {
          name:       source.split('/').pop(),
          mount_point: mount,
          fs_type:    fstype,
          total_bytes: parseK(size),
          used_bytes:  parseK(used),
          free_bytes:  parseK(avail),
          percent:     parseInt(pcent),
        };
      })
      .filter(Boolean);
  } catch { return []; }
}

// ── Uptime (from /proc/uptime)
function getUptime() {
  try {
    const uptime = parseFloat(fs.readFileSync('/proc/uptime', 'utf8').split(' ')[0]);
    return Math.floor(uptime);
  } catch { return null; }
}

// ── Load average (from /proc/loadavg)
function getLoadAvg() {
  try {
    const parts = fs.readFileSync('/proc/loadavg', 'utf8').split(' ');
    return {
      avg1:  parseFloat(parts[0]),
      avg5:  parseFloat(parts[1]),
      avg15: parseFloat(parts[2]),
    };
  } catch { return null; }
}

// ── Network (from /proc/net/dev)
let lastNetStats = null;
let lastNetTime = null;
function getNetStats(iface = null) {
  try {
    const content = fs.readFileSync('/proc/net/dev', 'utf8');
    const lines = content.split('\n').slice(2);
    const stats = {};

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 10) continue;
      const name = parts[0].replace(':', '');
      if (name === 'lo') continue;
      stats[name] = {
        rx_bytes: parseInt(parts[1]),
        tx_bytes: parseInt(parts[9]),
      };
    }

    const now = Date.now();
    let result = { interfaces: stats, speeds: {} };

    if (lastNetStats && lastNetTime) {
      const dt = (now - lastNetTime) / 1000;
      for (const [name, cur] of Object.entries(stats)) {
        const prev = lastNetStats[name];
        if (prev && dt > 0) {
          result.speeds[name] = {
            rx_mbps: Math.max(0, (cur.rx_bytes - prev.rx_bytes) / dt / 125000),
            tx_mbps: Math.max(0, (cur.tx_bytes - prev.tx_bytes) / dt / 125000),
          };
        }
      }
    }

    lastNetStats = stats;
    lastNetTime  = now;
    return result;
  } catch { return null; }
}

// ── GPU (nvidia-smi)
function getGpuMetrics() {
  try {
    const output = execSync(
      'nvidia-smi --query-gpu=index,name,temperature.gpu,temperature.memory,utilization.gpu,utilization.memory,memory.used,memory.total,power.draw,power.limit,fan.speed --format=csv,noheader,nounits 2>/dev/null',
      { timeout: 8000 }
    ).toString().trim();

    if (!output) return [];

    return output.split('\n').map(line => {
      const p = line.split(', ').map(s => s.trim());
      const nvlinkOutput = (() => {
        try {
          return execSync(
            `nvidia-smi nvlink --status -i ${p[0]} 2>/dev/null | grep -i active`,
            { timeout: 2000 }
          ).toString();
        } catch { return ''; }
      })();

      return {
        gpu_index:         parseInt(p[0]),
        gpu_name:          p[1],
        gpu_temp_c:        parseFloat(p[2]) || null,
        vrm_temp_c:        parseFloat(p[3]) || null,
        gpu_util_percent:  parseFloat(p[4]) || 0,
        mem_util_percent:  parseFloat(p[5]) || 0,
        mem_used_mb:       parseInt(p[6]) || 0,
        mem_total_mb:      parseInt(p[7]) || 0,
        power_draw_w:      parseFloat(p[8]) || null,
        power_limit_w:     parseFloat(p[9]) || null,
        fan_speed_percent: parseFloat(p[10]) || null,
        nvlink_active:     nvlinkOutput.toLowerCase().includes('active'),
      };
    });
  } catch { return []; }
}

// ── Public IP & GeoIP
async function getPublicIp() {
  const axios = require('axios');
  try {
    const res = await axios.get('https://ipinfo.io/json', { timeout: 5000 });
    return {
      ip:      res.data.ip,
      country: res.data.country,
      city:    res.data.city,
      region:  res.data.region,
      lat:     res.data.loc ? parseFloat(res.data.loc.split(',')[0]) : null,
      lon:     res.data.loc ? parseFloat(res.data.loc.split(',')[1]) : null,
      org:     res.data.org,
    };
  } catch { return null; }
}

// ── WireGuard status
function getWireguardStatus() {
  try {
    const output = execSync('wg show 2>/dev/null || nsenter -t 1 -n wg show 2>/dev/null', {
      timeout: 3000
    }).toString();
    const interfaces = output.match(/^interface:\s+(.+)/gm) || [];
    return {
      active: interfaces.length > 0,
      interfaces: interfaces.map(l => l.replace('interface:', '').trim()),
    };
  } catch {
    return { active: false, interfaces: [] };
  }
}

// ── All metrics in one call
async function getAllMetrics() {
  const cpu    = getCpuPercent();
  const cpuTemp = getCpuTemp();
  const mem    = getMemInfo();
  const disks  = getDisks();
  const net    = getNetStats();
  const uptime = getUptime();
  const load   = getLoadAvg();
  const gpus   = getGpuMetrics();
  const wg     = getWireguardStatus();

  return { cpu, cpuTemp, mem, disks, net, uptime, load, gpus, wg, timestamp: new Date() };
}

module.exports = {
  getCpuPercent, getCpuTemp,
  getMemInfo, getDisks,
  getUptime, getLoadAvg,
  getNetStats, getGpuMetrics,
  getPublicIp, getWireguardStatus,
  getAllMetrics,
};
