// ==============================================================================
// 组件: 模态弹窗管理器 (Modal Dialog)
// ==============================================================================

class ModalManager {
    constructor() {
        this.overlay = null;
        this.titleEl = null;
        this.bodyEl = null;
        this.footerEl = null;
        this.init();
    }

    init() {
        let el = document.getElementById('modal-root');
        if (!el) {
            el = document.createElement('div');
            el.id = 'modal-root';
            el.className = 'modal-overlay';
            el.innerHTML = `
                <div class="modal-card">
                    <div class="modal-header">
                        <h3 class="card-title" id="modal-title">弹窗标题</h3>
                        <button class="btn btn-secondary btn-sm" id="modal-close-btn" style="padding: 2px 8px; font-size: 1.1rem; border: none; cursor: pointer;">&times;</button>
                    </div>
                    <div class="modal-body" id="modal-body"></div>
                    <div class="modal-footer" id="modal-footer"></div>
                </div>
            `;
            document.body.appendChild(el);

            el.querySelector('#modal-close-btn').addEventListener('click', () => this.close());
            el.addEventListener('click', (e) => {
                if (e.target === el) this.close();
            });
        }
        this.overlay = el;
        this.titleEl = el.querySelector('#modal-title');
        this.bodyEl = el.querySelector('#modal-body');
        this.footerEl = el.querySelector('#modal-footer');
    }

    open({ title, content, footerButtons = [] }) {
        this.init();
        this.titleEl.textContent = title || '操作详情';
        
        if (typeof content === 'string') {
            this.bodyEl.innerHTML = content;
        } else if (content instanceof HTMLElement) {
            this.bodyEl.innerHTML = '';
            this.bodyEl.appendChild(content);
        }

        this.footerEl.innerHTML = '';
        footerButtons.forEach(btn => {
            const b = document.createElement('button');
            b.className = `btn ${btn.className || 'btn-secondary'}`;
            b.textContent = btn.text;
            b.addEventListener('click', (e) => {
                if (btn.onClick) btn.onClick(e, this);
            });
            this.footerEl.appendChild(b);
        });

        this.overlay.classList.add('active');
    }

    close() {
        if (this.overlay) {
            this.overlay.classList.remove('active');
        }
    }
}

export const modal = new ModalManager();
