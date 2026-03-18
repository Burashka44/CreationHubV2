// ── Background metrics collector — writes to PostgreSQL every N seconds
const db   = require('./db');
const host = require('./host');

let interval = null;

async function collect() {
  try {
    const m = await host.getAllMetrics();

    // System metrics
    if (m.cpu !== null || m.mem) {
      const net = m.net?.interfaces;
      const mainIface = net ? Object.keys(net)[0] : null;
      const speed = mainIface && m.net?.speeds?.[mainIface];

      await db.query(`
        INSERT INTO system_metrics
          (cpu_percent, cpu_temp_c, ram_percent, ram_used_gb, ram_total_gb,
           swap_percent, net_rx_bytes, net_tx_bytes, net_rx_mbps, net_tx_mbps,
           uptime_seconds, load_avg_1, load_avg_5, load_avg_15)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      `, [
        m.cpu,
        m.cpuTemp,
        m.mem?.percent,
        m.mem?.used_gb,
        m.mem?.total_gb,
        m.mem?.swap_percent,
        mainIface ? m.net.interfaces[mainIface].rx_bytes : null,
        mainIface ? m.net.interfaces[mainIface].tx_bytes : null,
        speed ? speed.rx_mbps : null,
        speed ? speed.tx_mbps : null,
        m.uptime,
        m.load?.avg1,
        m.load?.avg5,
        m.load?.avg15,
      ]);
    }

    // Disk snapshots (every 60s, not every collection)
    const now = Date.now();
    if (!collect._lastDisk || now - collect._lastDisk > 60000) {
      collect._lastDisk = now;
      for (const disk of (m.disks || [])) {
        await db.query(`
          INSERT INTO disk_snapshots (name, mount_point, used_bytes, total_bytes, percent, fs_type)
          VALUES ($1,$2,$3,$4,$5,$6)
        `, [disk.name, disk.mount_point, disk.used_bytes, disk.total_bytes, disk.percent, disk.fs_type]);
      }
    }

    // GPU metrics
    for (const gpu of (m.gpus || [])) {
      await db.query(`
        INSERT INTO gpu_metrics
          (gpu_index, gpu_name, gpu_temp_c, vrm_temp_c, gpu_util_percent, mem_util_percent,
           mem_used_mb, mem_total_mb, power_draw_w, power_limit_w, fan_speed_percent, nvlink_active)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `, [
        gpu.gpu_index, gpu.gpu_name, gpu.gpu_temp_c, gpu.vrm_temp_c,
        gpu.gpu_util_percent, gpu.mem_util_percent,
        gpu.mem_used_mb, gpu.mem_total_mb,
        gpu.power_draw_w, gpu.power_limit_w,
        gpu.fan_speed_percent, gpu.nvlink_active,
      ]);
    }

    // Auto cleanup old metrics (daily)
    if (!collect._lastCleanup || now - collect._lastCleanup > 86400000) {
      collect._lastCleanup = now;
      const { rows } = await db.query("SELECT value FROM app_settings WHERE key='log_retention_days'");
      const days = parseInt(rows[0]?.value || '30');
      await db.query("DELETE FROM system_metrics WHERE timestamp < NOW() - ($1 || ' days')::interval", [days]);
      await db.query("DELETE FROM disk_snapshots WHERE timestamp < NOW() - ($1 || ' days')::interval", [days]);
      await db.query("DELETE FROM gpu_metrics WHERE timestamp < NOW() - ($1 || ' days')::interval", [days]);
    }

  } catch (err) {
    console.error('[Metrics Collector]', err.message);
  }
}

function start(intervalSeconds = 10) {
  console.log(`[Metrics] Starting collector (every ${intervalSeconds}s)`);
  // Initial collection
  setTimeout(collect, 2000);
  // Periodic collection
  interval = setInterval(collect, intervalSeconds * 1000);
}

function stop() {
  if (interval) clearInterval(interval);
}

module.exports = { start, stop, collect };
