# 出游故事时间轴设计 QA

- Source visual truth: `/Users/xie/Documents/恋爱网站/.worktrees/story-timeline-capsule/docs/superpowers/evidence/story-timeline-approved-reference.png`
- Source prototype: `/Users/xie/Documents/恋爱网站/.superpowers/brainstorm/75769-1785789592/content/story-hall-final-preview.html`
- Implementation screenshot: `/Users/xie/Documents/恋爱网站/.worktrees/story-timeline-capsule/docs/superpowers/evidence/story-timeline-desktop-final.png`
- Responsive evidence: `/Users/xie/Documents/恋爱网站/.worktrees/story-timeline-capsule/docs/superpowers/evidence/story-timeline-mobile.png`
- Viewport: desktop 1280 × 720 CSS px, device scale factor 1；mobile 390 × 844 CSS px, device scale factor 1
- Pixel dimensions: source and desktop implementation均为 1280 × 720；无需密度归一化
- State: 已有 1 条旧版文字记录、无故事照片、无时间胶囊；云端已连接

## Full-view comparison evidence

参考图与实现图在同一浏览器、同一 1280 × 720 视口并排检查。最终实现已对齐参考图的主要构图：顶部标题与说明、三等分统计卡、左侧连续时间轴、右侧高对比时间胶囊卡，以及豆沙红/奶油白配色。真实数据较少，因此实现中的统计数字、照片和胶囊内容与参考图的演示数据不同，这是预期的数据差异。

## Focused region comparison evidence

- 时间轴：实现使用独立白色容器、左侧细线和节点、整行故事卡，结构与参考图一致；旧记录缺少照片时不会生成空照片占位。
- 时间胶囊：实现使用豆沙红重点卡、白色图标与文字；没有胶囊时呈现创建引导，避免伪造内容。
- 表单：独立记录表单包含日期范围、城市、标题、正文、心情和最多 6 张照片；胶囊表单包含标题、正文、照片和解锁日期。
- 响应式：窄屏无横向溢出，时间轴与胶囊改为单列，节点线保持在卡片左侧。

## Required fidelity surfaces

- Fonts and typography: 延续网站现有中文字体栈与粗细层级；标题、标签、正文层级清晰，未出现截断。
- Spacing and layout rhythm: 三列统计、1.7:0.8 主布局、22px 区间距和卡片内边距与参考图接近；移动端单列成立。
- Colors and visual tokens: 复用现有 `--rose`、`--rose-dark`、`--cream`、`--muted`；胶囊卡使用统一豆沙红，文字对比充分。
- Image quality and asset fidelity: 心形沿用项目已有矢量资源；删除图标使用 Heroicons MIT 矢量资源；真实记录无照片时不使用模糊占位图。
- Copy and content: “我们的时间轴”“按时间记录每一次出发”“写给未来的我们”等核心文案与确认方案一致；统计名称改为真实可计算的旅程、城市、照片。

## Findings

没有剩余的 P0、P1 或 P2 问题。

## Comparison history

1. 初次实现：时间轴误为左右交错、统计卡偏小、胶囊视觉权重不足（P2）。
2. 修正：改为参考图的左侧连续时间轴；统计卡改为三等分整行；胶囊卡改为豆沙红重点区。
3. 复查：同视口实现与参考图的布局比例、层级和配色已经对齐；控制台无 error/warning。

## Follow-up polish

- P3：浏览器原生文件选择按钮在不同系统上文字可能不同，后续可在不影响可访问性的前提下做统一外观。

final result: passed
