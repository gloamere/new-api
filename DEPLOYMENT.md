# 香港服务器部署

生产环境绑定见 `.server-ops.json`；服务器连接和密钥引用以 CompRes 的 `hongkong-01` 画像为准。仅从 `main` 发布，`dev` 用于日常开发及接收上游更新。

部署目录为服务器 `/opt/new-api`。`docker-compose.yml` 运行由指定 `main` 提交构建的 New API 镜像及独立 PostgreSQL；应用只在 Docker 网络监听 3000，由现有 Caddy 的 `newapi.gloamere.com` 站点反向代理。密钥在服务器 root 可读的 `/opt/new-api/.env`，不进入仓库。当前发布提交为 `789c970199ea527e6a26e071915f4a4cd2c64178`。

发布前备份 PostgreSQL 数据和 `/opt/new-api/data`，记录当前镜像与 Compose 配置。更新时从已验证的 `main` 提交生成新源码目录，构建新镜像，验证后修改 Compose 的构建目录与镜像标签，再运行 `docker compose up -d --no-build new-api`。验证容器健康、`/api/status` 和外部 HTTPS。数据库迁移可能不可逆，回滚前须评估新版本迁移并使用发布前备份。

回滚应用镜像：恢复先前的 Compose 文件或把 `new-api` 的 `image` 指回先前已保留的镜像，运行 `cd /opt/new-api && docker compose up -d --no-build new-api`。不要删除 PostgreSQL 卷。Caddy 修改的备份在 `/opt/gloamere/compose/caddy/Caddyfile.bak-newapi-20260930-163425`；恢复该备份后须先运行 `docker exec gloamere-caddy caddy validate --config /etc/caddy/Caddyfile`，再重载 Caddy。该 Caddy 备份只适用于期间没有其他 Caddy 配置变更的情况。

2026-09-30 部署时，Cloudflare DNS 尚缺 `newapi.gloamere.com` 记录，公网 HTTPS 验证待完成。

## 腾讯云独立实例（2026-10-31）

环境绑定为 `tencent-production`，保留香港 `production` 绑定。仅将官方 `upstream/main` 更新到 `dev` 并验证后，合并 `main` 发布；不要迁移或改写香港数据库。

腾讯云独立目录 `/opt/new-api`，Compose 采用 `compose.tencent.yaml`，New API 监听 `127.0.0.1:13000`，PostgreSQL 16 仅在独立 Docker 网络。`.env` 只保存不可变镜像引用；`runtime.env` 与 `postgres.env` 为服务器 root:600 凭据文件，禁止读取到日志、提交或聊天。会话与加密密钥由服务器安全随机生成。初始部署不对公网暴露未初始化管理端。

从指定提交使用 `git archive` 导出；远端 `releases/<commit>/Dockerfile.tencent` 保留官方构建流程，镜像源替换为腾讯镜像，限制构建器到 2 CPU/5 GiB、Go 并发为 2，并执行前端 typecheck/build、relaykit 与 tokenkit 独立编译。构建出的应用版本带源码提交，镜像固定标签。

发布前保存清单、镜像、数据库备份；升级用 `docker compose --env-file /opt/new-api/.env -f /opt/new-api/compose.yaml up -d --no-build`。仅对本实例操作。数据库迁移后回滚须评估兼容性，必要时恢复本实例发布前备份；禁止删除其他服务或数据卷。备份位于 `/opt/new-api/backups`，只保存于服务器受限目录，禁止将含凭据备份下载到公共产物。

本次部署：官方上游 `ea343c4a81151bfd537d33b66527c25fa21a1112` 的 201 个提交已快进到 dev，再将部署配置提交 `cf99b02e8350d0f0f71890606d8948336da9a880` 合入 main。远端 origin/dev、origin/main 已同步；部署标签为 `deploy-tencent-newapi-20261031-cf99b02e8`。应用源码为该 main 提交中的上游代码，部署配置为同一提交新增的三个文件。镜像 `gloamere/new-api:ea343c4a8-20261031`，ID `sha256:df5d477dd08cdde6a57a62490c65827e96e4d15ae74592cf856a31e67a8a9b31`。

公网域名 `api.gloamere.cn`，DNSPod A 记录为 `175.24.190.175`、TTL 600。由现有 `dujiao-next-caddy` 热重载新增独立站点，原站点保留；变更前备份 `/opt/dujiao-next/shared/caddy/Caddyfile.bak-newapi-20261031`。初始化完成前公网仅返回 503 提示；管理员在本地 SSH 隧道 `http://127.0.0.1:13000/setup` 自行设置密码。开放公网前将 `runtime.env` 设置为 `SESSION_COOKIE_SECURE=true`、`SESSION_COOKIE_TRUSTED_URL=https://api.gloamere.cn`、`TRUSTED_PROXIES=127.0.0.1/32,172.21.0.1/32`，再仅重建本项目应用容器。

已验证：前端 1410 文件类型检查、生产构建、relaykit/tokenkit 独立编译及根模块应用编译；Compose 校验、PostgreSQL 与应用健康、版本回读、DNS 与有效 HTTPS。未执行全量自动化测试，也未配置模型渠道或进行付费推理验证。构建器与其缓存已移除；初次准备下载的旧版 Go/Bun 及未使用 Debian 镜像已清理。源码恢复目录保留 `/opt/new-api/releases/ea343c4a8`，配置和数据库备份保留 `/opt/new-api/backups`。

2026-10-31 19:35（Asia/Shanghai）上线回读：用户已自行初始化管理员（1 个 root、1 条 setup 记录）；安全 Cookie、HTTPS 精确 Origin 与网桥网关代理白名单已应用，Caddy 正式反代已开启。公网首页/状态接口 200，未认证 `/v1/models` 为 401，商城仍为 200。初始化后备份 `/opt/new-api/backups/20261031T113500Z`。临时本地初始化隧道收尾关闭，正式入口为 `https://api.gloamere.cn`。尚未配置模型渠道或桌宠集成。
