# APEX / 极境飞驰

电脑浏览器上的 Three.js 3D 赛车原型。包含约 2.4 公里海岸环形赛道、程序化赛车、黄昏光照与阴影、行驶车辆、计圈、速度仪表和小地图。模型与驾驶物理为原创简化实现，非商业赛车游戏级的资产或车辆模拟。

## 直接下载游玩

[下载游戏压缩包](https://github.com/luoyonggang/ha/raw/refs/heads/main/downloads/APEX-Racing.zip)。解压后，用电脑 Chrome 或 Edge 打开 `APEX赛车.html`，点击“开始驾驶”。无需安装 Node.js。

也可以进入 `downloads/APEX-Racing.html`，使用 GitHub 的下载原始文件按钮保存，再用浏览器打开。

## 源码开发运行

需要 Node.js 20.19+ 或 22.12+。

```sh
npm ci --cache /workspace/.npm-cache
npm run dev
```

浏览器打开开发服务器，点击“开始驾驶”。

- W / ↑：油门；S / ↓：刹车与倒车
- A D / ← →：转向；空格：手刹
- C：切换追车、引擎盖、高位镜头
- R：回到起点；Esc：暂停，再点击继续驾驶恢复
- 右上角切换引擎声音；右下角切换画质

`npm run build` 生成生产文件；`npm run preview` 本地检查生产构建。需要支持 WebGL 的浏览器。无后端服务或密钥要求。
