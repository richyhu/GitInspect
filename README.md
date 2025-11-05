# GitInspect

## 包含内容
- `src/` 应用源代码（TypeScript/React/Vite）
- `help/` 辅助静态页面（克隆与令牌指南）
- 根配置与入口：`index.html`、`package.json`、`tsconfig.json`、`vite.config.ts`、`tailwind.config.js`、`postcss.config.js`
- 锁文件：`pnpm-lock.yaml`、`package-lock.json`（任选其一即可，保留不影响）

## 排除内容
- `dist/` 与 `apsd/` 等构建或导出文件夹
- `node_modules/` 与临时缓存
- IDE 配置与系统文件

> 以上排除规则已写入 `GitHub/.gitignore`。

## 本地启动（开发模式）
- 使用 npm：
  ```bash
  npm install
  npm run dev
  ```
- 使用 pnpm：
  ```bash
  pnpm install
  pnpm dev
  ```

启动后在浏览器打开本地地址（例如 Vite 提示的 `http://localhost:5173/`）。

## GitHub API 令牌
- 若访问 GitHub API 受限或需要访问私有仓库，请在应用主页面设置个人访问令牌（PAT）。
- 令牌创建路径：GitHub → Settings → Developer settings → Personal access tokens。
- Classic 模式：私有仓库勾选 `repo`；公共仓库可勾选 `public_repo`。

## 推送到 GitHub（示例流程）
在终端执行：
```bash
cd GitHub
# 初始化仓库
git init
# 添加远程（替换为你的仓库地址）
git remote add origin https://github.com/<your-username>/<your-repo>.git
# 提交
git add .
git commit -m "Initial source upload"
# 设置主分支并推送
git branch -M main
git push -u origin main
```

## 其它说明
- 如需单文件预览或构建产物，请在根目录执行构建并在 `dist/` 中查看；本目录不包含构建结果。
- 若你只使用 npm 或只使用 pnpm，可删除另一种锁文件以避免混用。

