#!/bin/bash

# Windsurf-Tool - 快速打包脚本

echo "================================"
echo "Windsurf-Tool - 打包工具"
echo "================================"
echo ""

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未安装Node.js"
    echo "请访问 https://nodejs.org/ 下载安装"
    exit 1
fi

echo "✓ Node.js版本: $(node --version)"
echo "✓ npm版本: $(npm --version)"
echo ""

# 检查依赖
if [ ! -d "node_modules" ]; then
    echo "📦 安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
    echo "✓ 依赖安装完成"
    echo ""
fi

# 清理旧文件
if [ -d "dist" ]; then
    echo "🧹 清理旧的打包文件..."
    rm -rf dist/
    echo "✓ 清理完成"
    echo ""
fi

# 选择打包平台
echo "请选择打包平台:"
echo "1) macOS (DMG + ZIP)"
echo "2) Windows (NSIS)"
echo "3) Linux (AppImage + DEB)"
echo "4) 全平台"
echo ""
read -p "请输入选项 (1-4): " choice

case $choice in
    1)
        echo ""
        echo "🚀 开始打包 macOS 版本..."
        npm run build:mac
        ;;
    2)
        echo ""
        echo "🚀 开始打包 Windows 版本..."
        npm run build:win
        ;;
    3)
        echo ""
        echo "🚀 开始打包 Linux 版本..."
        npm run build:linux
        ;;
    4)
        echo ""
        echo "🚀 开始打包全平台版本..."
        npm run build
        ;;
    *)
        echo "❌ 无效选项"
        exit 1
        ;;
esac

# 检查打包结果
if [ $? -eq 0 ]; then
    echo ""
    echo "================================"
    echo "✅ 打包成功!"
    echo "================================"
    echo ""
    echo "📦 打包文件位置: dist/"
    echo ""
    
    if [ -d "dist" ]; then
        echo "生成的文件:"
        ls -lh dist/ | grep -v "^d" | awk '{print "  - " $9 " (" $5 ")"}'
        echo ""
        echo "总大小: $(du -sh dist/ | awk '{print $1}')"
    fi
    
    echo ""
    echo "💡 提示:"
    echo "  - macOS: 打开 dist/*.dmg 安装"
    echo "  - Windows: 运行 dist/*.exe 安装"
    echo "  - Linux: 运行 dist/*.AppImage 或安装 dist/*.deb"
    echo ""
    
    # 询问是否打开dist目录
    read -p "是否打开dist目录? (y/n): " open_dist
    if [ "$open_dist" = "y" ] || [ "$open_dist" = "Y" ]; then
        open dist/
    fi
else
    echo ""
    echo "================================"
    echo "❌ 打包失败"
    echo "================================"
    echo ""
    echo "请检查错误信息并重试"
    echo ""
    echo "常见问题:"
    echo "  1. 检查Node.js版本 (建议 v16+)"
    echo "  2. 删除node_modules后重新安装: rm -rf node_modules && npm install"
    echo "  3. 清理npm缓存: npm cache clean --force"
    echo "  4. 查看详细日志: DEBUG=electron-builder npm run build"
    echo ""
    exit 1
fi
