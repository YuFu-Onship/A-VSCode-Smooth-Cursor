(function createFloatingCursorEffect() {
    const editor = document.querySelector(".part.editor");
    if (!editor) {
        setTimeout(createFloatingCursorEffect, 500);
        return;
    }
    if (document.getElementById('love2d-cursor-canvas')) return;

    const canvas = document.createElement('canvas');
    canvas.id = 'love2d-cursor-canvas';
    canvas.width = 500;
    canvas.height = 500;
    const ctx = canvas.getContext('2d');

    const style = canvas.style;
    style.position = 'absolute';
    style.pointerEvents = 'none';
    style.zIndex = '9999';
    style.transform = 'translate(-50%, -50%)';

    editor.appendChild(canvas);

    // ---------------- Cursor ----------------
    class Cursor {
        constructor() {
            this.x = 0;
            this.y = 0;
            this.targetX = 0;
            this.targetY = 0;

            // 加快缓动：0.1 → 0.06
            this.moveTime = 0.04;

            this.timer = 0;
            this.alpha = 1;
        }

        setTarget(x, y) {
            this.targetX = x;
            this.targetY = y;
        }

        update(dt) {
            dt = Math.min(dt, 1 / 30);

            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;

            const vx = (dx / this.moveTime) * dt;
            const vy = (dy / this.moveTime) * dt;

            const useVx = Math.abs(dx) <= Math.abs(vx) ? dx : vx;
            const useVy = Math.abs(dy) <= Math.abs(vy) ? dy : vy;

            this.x += useVx;
            this.y += useVy;

            // alpha 呼吸保留
            this.timer += dt * 3;
            if (this.timer >= Math.PI) this.timer = 0;
            this.alpha = Math.abs(Math.cos(this.timer));
        }

        api_return_xy() {
            return { x: this.x, y: this.y };
        }
    }

    // ---------------- Anchor（链条） ----------------
    class Anchor {
        constructor() {
            this.nodes = [];
            this.tarX = 100;
            this.tarY = 100;
            this.lastPosition = { x: this.tarX, y: this.tarY };
            this.startPoint = { x: this.tarX, y: this.tarY };
            this.isMove = false;

            // 链条节点间距：原来 10 → 改为 6
            this.segmentDist = 4;
            this.maxNodes = 20;
        }

        api_tar_pos(x, y) {
            this.tarX = x;
            this.tarY = y;
        }

        __compute_next_position(a, b, s) {
            let vx = b.x - a.x;
            let vy = b.y - a.y;

            if (Math.abs(vx) < 1e-6 && Math.abs(vy) < 1e-6) {
                vx = s; vy = 0;
            }
            const dist = Math.sqrt(vx * vx + vy * vy);
            return {
                x: a.x + (vx / dist) * s,
                y: a.y + (vy / dist) * s
            };
        }

        update(dt) {
            const dx = this.tarX - this.lastPosition.x;
            const dy = this.tarY - this.lastPosition.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= 1) {
                this.isMove = false;
                this.startPoint = { x: this.tarX, y: this.tarY };
            } else {
                this.isMove = true;
                if (this.nodes.length === 0) {
                    this.nodes.push({ x: this.tarX, y: this.tarY });
                }
            }

            // 头节点跟随 tar
            if (this.nodes.length > 0) {
                this.nodes[0].x = this.tarX;
                this.nodes[0].y = this.tarY;

                // 链式收缩
                for (let i = 1; i < this.nodes.length; i++) {
                    const prev = this.nodes[i - 1];
                    const cur = this.nodes[i];
                    const next = this.__compute_next_position(prev, cur, this.segmentDist);
                    cur.x = next.x;
                    cur.y = next.y;
                }
            }

            // 若在移动：补长链条
            if (this.isMove && this.nodes.length < this.maxNodes) {
                const tail = this.nodes[this.nodes.length - 1];
                const dx2 = tail.x - this.startPoint.x;
                const dy2 = tail.y - this.startPoint.y;
                const d2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
                if (d2 >= this.segmentDist) {
                    this.nodes.push({ x: this.startPoint.x, y: this.startPoint.y });
                }
            }

            // 不移动则缩短
            if (!this.isMove && this.nodes.length > 1) {
                this.nodes.shift();
            }

            this.lastPosition.x = this.tarX;
            this.lastPosition.y = this.tarY;
        }

        draw(ctx, canvas, cursorPos) {
            if (this.nodes.length < 2) return;

            ctx.beginPath();
            ctx.lineWidth = 16; // 线条宽度（你要的 16~20，我给 20）
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.strokeStyle = 'rgba(255,255,255,1)';

            const first = this.nodes[0];
            ctx.moveTo(
                first.x - cursorPos.x + canvas.width / 2,
                first.y - cursorPos.y + canvas.height / 2
            );

            for (let i = 1; i < this.nodes.length; i++) {
                const p = this.nodes[i];
                ctx.lineTo(
                    p.x - cursorPos.x + canvas.width / 2,
                    p.y - cursorPos.y + canvas.height / 2
                );
            }

            ctx.stroke();
        }
    }

    // ---------------- 启动 ----------------
    const cursor = new Cursor();
    const anchor = new Anchor();

    const editorRectInit = editor.getBoundingClientRect();
    cursor.x = editorRectInit.width / 2;
    cursor.y = editorRectInit.height / 2;

    let lastTime = performance.now();

    function findVisibleCursorElement(editorEl) {
        const list = editorEl.getElementsByClassName("cursor");
        for (const el of list) {
            if (el.style.visibility !== 'hidden') return el;
        }
        return null;
    }

    function animationLoop(now) {
        const dt = Math.min((now - lastTime) / 1000, 1 / 30);
        lastTime = now;

        const cursorEl = findVisibleCursorElement(editor);
        if (cursorEl) {
            const rect = cursorEl.getBoundingClientRect();
            const editorRect = editor.getBoundingClientRect();
            const tx = rect.left - editorRect.left + rect.width / 2;
            const ty = rect.top - editorRect.top + rect.height / 2;
            cursor.setTarget(tx, ty);
        }

        cursor.update(dt);

        style.left = `${cursor.x}px`;
        style.top = `${cursor.y}px`;

        const pos = cursor.api_return_xy();
        anchor.api_tar_pos(pos.x, pos.y);
        anchor.update(dt);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        anchor.draw(ctx, canvas, pos);

        requestAnimationFrame(animationLoop);
    }

    requestAnimationFrame(animationLoop);
})();
