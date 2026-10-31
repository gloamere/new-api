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
