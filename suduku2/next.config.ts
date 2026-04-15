import type { NextConfig } from "next";

/**
 * 开发模式下 Next 会拦截「非本站 origin」对 dev 资源与端点的请求。
 * iPhone/iPad Safari 通过 `http://<局域网 IP>:3003` 访问时，浏览器发出的 `Origin`/`Referer`
 * 主机名是局域网 IP（如 `10.0.0.7`），与 dev 进程绑定的 `0.0.0.0`/`localhost` 不一致；
 * 若未放行，`_next/static` 与 HMR 会 403，React 无法水合，会话条会永远停在「加载中…」。
 *
 * 下方通配符与 Next `isCsrfOriginAllowed` 一致（按 `.` 分段匹配），覆盖常见私网 IPv4。
 * 若仍需额外主机名，可在 `.env.local` 中设置（逗号分隔）：
 * `SUDUKU2_DEV_ALLOWED_ORIGINS=example.local`
 */
const extraDevOrigins =
  process.env.SUDUKU2_DEV_ALLOWED_ORIGINS?.split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0) ?? [];

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "127.0.0.1",
    "*.local",
    "10.*.*.*",
    "172.*.*.*",
    "192.168.*.*",
    ...extraDevOrigins,
  ],
};

export default nextConfig;
