function createFloatingCursorEffect() {
    // 1. 初始准备：寻找编辑器元素，如果没找到就稍后重试
    const editor = document.querySelector(".part.editor");
    if (!editor) {
        setTimeout(createFloatingCursorEffect, 500);
        return;
    }

    // 防止重复创建
    if (document.getElementById('love2d-cursor-canvas')) {
        return;
    }

    // 2. 创建一个 100x100 的悬浮画布
    const canvas = document.createElement('canvas');
    canvas.id = 'love2d-cursor-canvas';
    canvas.width = 100;
    canvas.height = 100;
    const ctx = canvas.getContext('2d');
    
    // 设置画布样式
    const style = canvas.style;
    style.position = 'absolute';
    style.pointerEvents = 'none'; // 让鼠标事件穿透画布
    style.zIndex = '9999';
    style.transform = 'translate(-50%, -50%)'; // 将画布中心对准坐标点

    // 将画布添加到编辑器中
    editor.appendChild(canvas);

    // 3. 将你的 Lua Cursor "类" 翻译成 JavaScript Class
    class Cursor {
        constructor() {
            // 光标方块的尺寸
            this.width = 10;
            this.height = 20;

            // 位置信息
            this.x = 0; // 当前平滑移动后的 x 坐标
            this.y = 0; // 当前平滑移动后的 y 坐标
            this.targetX = 0; // VS Code 光标的实际 x 坐标
            this.targetY = 0; // VS Code 光标的实际 y 坐标

            // 用于实现弹性移动的变量 (速度)
            this.vx = 0;
            this.vy = 0;

            // 轨迹点数组，存储绝对坐标 [x1, y1, x2, y2, ...]
            this.points = [];
            this.maxPoints =8; // 轨迹点的数量，对应 Lua 代码里的 20 / 2 * 2 = 20

            // 呼吸效果的计时器和透明度
            this.alphaTime = 0;
            this.alpha = 1;
        }

        // 核心更新逻辑
        update(dt) {
            // --- A. 更新光标方块的平滑位置 ---
            // 这里使用了类似于你 __create_value_trip 的动量/阻尼算法
            const momentum = 0.85; // 动量 (越大越"滑")
            const speedFactor = 300; // 速度/弹性系数

            // 计算到目标的距离和加速度
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            const ax = dx * speedFactor;
            const ay = dy * speedFactor;

            // 更新速度
            this.vx = (this.vx + ax * dt) * momentum;
            this.vy = (this.vy + ay * dt) * momentum;
            
            // 更新位置
            this.x += this.vx * dt;
            this.y += this.vy * dt;

            // --- B. 更新轨迹点 ---
            // 将当前平滑移动后的点添加到轨迹数组头部
            this.points.unshift({ x: this.x, y: this.y });

            // 如果轨迹太长，就从末尾移除旧的点
            if (this.points.length > this.maxPoints) {
                this.points.pop();
            }

            // --- C. 更新呼吸效果 ---
            this.alphaTime += dt * 3;
            if (this.alphaTime > Math.PI * 2) {
                this.alphaTime -= Math.PI * 2;
            }
            this.alpha = Math.abs(Math.sin(this.alphaTime));
        }

        // 绘制逻辑
        draw(ctx) {
            // 清空画布
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // --- A. 绘制轨迹 ---
            if (this.points.length > 1) {
                ctx.beginPath();
                ctx.strokeStyle = 'rgba(255, 255, 255, 1)'; // 轨迹
                ctx.lineWidth =10;

                // 起始点：将第一个轨迹点的绝对坐标转换为画布的相对坐标
                const firstPoint = this.points[0];
                const startX = firstPoint.x - this.x + canvas.width / 2;
                const startY = firstPoint.y - this.y + canvas.height / 2;
                ctx.moveTo(startX, startY);

                // 连接后续所有点
                for (let i = 1; i < this.points.length; i++) {
                    const point = this.points[i];
                    const relativeX = point.x - this.x + canvas.width / 2;
                    const relativeY = point.y - this.y + canvas.height / 2;
                    ctx.lineTo(relativeX, relativeY);
                }
                ctx.stroke();
            }

            // --- B. 绘制光标方块 ---
            // 使用带有呼吸效果的透明度
            // ctx.fillStyle = `rgba(255, 255, 255, ${this.alpha})`;
            // 在画布正中心绘制方块
            // ctx.fillRect(
            //     canvas.width / 2 - this.width / 2,
            //     canvas.height / 2 - this.height / 2,
            //     this.width,
            //     this.height
            // );
        }
    }

    // 4. 初始化与动画循环
    const cursor = new Cursor();
    let lastTime = performance.now();

    function animationLoop(currentTime) {
        // 计算时间差 (delta time)
        const dt = (currentTime - lastTime) / 1000;
        lastTime = currentTime;

        // 寻找 VS Code 的光标 DOM 元素
        const cursorEl = editor.querySelector(".cursor");
        if (cursorEl) {
            const rect = cursorEl.getBoundingClientRect();
            const editorRect = editor.getBoundingClientRect();
            
            // 计算光标中心点的绝对坐标，并设置为目标
            cursor.targetX = rect.left - editorRect.left + rect.width / 2;
            cursor.targetY = rect.top - editorRect.top + rect.height / 2;
        }

        // 更新 cursor 对象的内部状态 (位置、轨迹、透明度)
        cursor.update(dt);

        // 将悬浮画布的实际位置移动到光标平滑移动后的位置
        style.left = `${cursor.x}px`;
        style.top = `${cursor.y}px`;

        // 在画布上绘制所有内容
        cursor.draw(ctx);

        // 请求下一帧动画
        requestAnimationFrame(animationLoop);
    }

    // 启动动画循环
    requestAnimationFrame(animationLoop);
}

// 当窗口加载完成后，执行我们的函数
window.addEventListener('load', createFloatingCursorEffect);