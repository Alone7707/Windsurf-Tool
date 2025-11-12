# GitHub 配置和上传指南

## 步骤 1: 创建 GitHub 仓库

1. 登录到 [GitHub](https://github.com)
2. 点击右上角的 "+" 号，选择 "New repository"
3. 填写仓库信息：
   - Repository name: `windsurf-account-switcher` 或你喜欢的名称
   - Description: `Windsurf-Tool 账号管理工具 - 批量注册、自动切换、账号池管理`
   - 选择 Public 或 Private
   - **不要**勾选 "Add a README file"、"Add .gitignore"、"Choose a license"（因为我们已经有了）
4. 点击 "Create repository"

## 步骤 2: 关联本地仓库与 GitHub

在终端中执行以下命令：

```bash
# 添加远程仓库（将 YOUR_USERNAME 替换为你的GitHub用户名，REPOSITORY_NAME 替换为你的仓库名）
git remote add origin https://github.com/YOUR_USERNAME/REPOSITORY_NAME.git

# 重命名主分支为 main（如果当前是 master）
git branch -M main

# 推送到 GitHub
git push -u origin main
```

## 步骤 3: 创建发布版本

1. 在 GitHub 仓库页面，点击 "Releases"
2. 点击 "Create a new release"
3. 在 "Tag version" 中输入版本号，例如：`v1.0.0`
4. 填写发布标题和描述
5. 点击 "Publish release"

## 步骤 4: 验证 GitHub Actions

1. 推送代码后，进入仓库的 "Actions" 标签页
2. 你会看到工作流正在运行
3. 构建完成后，在 "Releases" 中会看到生成的 .exe 安装包

## 自动化触发条件

工作流会在以下情况自动运行：
- 推送到 `main` 或 `master` 分支
- 创建版本标签（如 `v1.0.0`）
- 手动触发（在 Actions 页面点击 "Run workflow"）

## 构建输出

- Windows 安装包：`.exe` 文件
- Mac 应用：`.dmg` 和 `.zip` 文件
- Linux 应用：`.AppImage` 和 `.deb` 文件

构建的文件会作为 GitHub Release 的附件提供下载。