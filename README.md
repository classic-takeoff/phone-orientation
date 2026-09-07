# 掌中姿态

手机传感器实时旋转可视化，面向 GitHub Pages 的纯静态页面。零运行时依赖、无 CDN、无数据上传。

## 使用

通过 HTTPS 在手机浏览器打开，点击“连接手机传感器”，允许运动与方向权限。第一次有效采样将舒适握姿设为正面。需要更换参照时点击“设为正面”。横竖屏切换会自动重新校准。演示模式明确标注为模拟数据。

## 开发

需要 Node.js 24，无需 npm install。

```sh
npm test
npm run build
npm start
```

本地预览 http://127.0.0.1:4173；手机访问局域网 HTTP 地址通常无法读取传感器，需部署 HTTPS。

## GitHub Pages 部署

目标账号：classic-takeoff。建议独立仓库：phone-orientation。

方式 A：上传整个项目至仓库 main 分支，在 Settings → Pages → Build and deployment → Source 选择 GitHub Actions，然后运行 Deploy phone orientation to Pages。仓库必须允许 Pages / Actions。工作流先测试、构建，再上传 docs 静态目录。

方式 B（无需 Actions 工作流）：将 docs/index.html 上传为仓库根目录 index.html，在 Settings → Pages 选择 Deploy from a branch、main、/(root)，保存。或者上传 docs 目录，选择 main、/docs。

首次部署成功后，默认网址应为 https://classic-takeoff.github.io/phone-orientation/ 。此地址只是预期地址，需 GitHub 实际部署成功后才能访问。

## 实现与限制

- W3C Z-X′-Y″ 姿态转四元数，最短路径插值，避免 0/360 度跳变与用于渲染的欧拉角奇异点。数值面板为相对姿态 XYZ 分解，接近奇异姿态时数值可能跳变，模型仍连续；非绝对航向。
- 坐标转换纠正浏览器 CSS 的向下 Y 轴。屏幕旋转参与坐标补偿，并以新握姿重设参照，不使用镜像相机。
- 0.65° 默认角度死区（可调 0.15–2°），对上次接受姿态比较，缓慢转动累积超过阈值后照常更新。
- 自适应四元数低通 5–45 Hz，明显转动立即提高响应；不是等待静止的 debounce。没有增加事件等待队列，也不预测未来姿态。
- 仅一个手机容器做 CSS 3D transform，6 个几何面；按需 requestAnimationFrame 跟随屏幕刷新，静止后停止动画循环；没有阴影贴图、WebGL 帧缓冲或高 DPR 画布。数值面板最多 10 Hz，性能统计 1 Hz。切后台卸载传感器监听、取消渲染。
- 对 HTTPS、权限拒绝、空传感器值、未收到数据及暂停/恢复做状态处理。只请求 DeviceOrientationEvent 所需权限。
- “模型更新”是 transform 写入次数，不是硬件显示帧率；“距最近采样”只是事件数据新鲜度，不是完整运动到光子延迟。不承诺所有手机上固定 60/120 FPS。
- 自动化数学测试验证死区、慢速累积、快速响应、横屏补偿、坐标方向及环绕连续性；真实手机传感器和浏览器权限必须由实体设备最终验证。

## 真机验收

1. Safari / Android 浏览器授权，正常握持时模型正面可见。
2. 向左倾斜、向右倾斜、前后俯仰，确认模型物理方向一致；翻转能看到背面。
3. 静止小幅手抖基本不变；连续缓慢转动能跟随，快速转动无明显长尾。
4. 横竖屏切换后重新校准；暂停、恢复、切后台、返回和权限拒绝状态正确。
5. 旋转经过 0/360° 没有整圈回转。不同手机采样率不同，以实际感受和读数验收。

参考：
- https://www.w3.org/TR/orientation-event/
- https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static
- https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site
