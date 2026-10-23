# 鼠标的偶像梦模拟器 · 开发交接

> 给接手这个项目的 agent：读完这一页就能开工。
> 约定优先于个人偏好；如果这里的约定和你的习惯冲突，按这里的来。

---

## 0. 这是个什么项目

一个**纯前端**的文字演出类虚拟偶像养成推演游戏。玩家是企划的新负责人，用 25 万启动资金，
带 8 个不火的虚拟主播活过 24 个月，最后把她们送上线上演唱会的舞台。

- 这是随手做的梗项目，不追求商业质量，**但代码质量和可维护性要当真**。
- 基调是「一本正经地搞一个荒诞的企划」：数据表、复盘报告、成本模型，配上跑调的老板。
- 全部画面和声音由代码实时合成，项目里**没有任何图片、音频、字体素材**。

梗的出典：鼠标（B 站 UID 13315327）长期做 V 圈偶像企划、屡战屡败，
「鼠标的偶像梦」就成了圈内一个梗。这个模拟器就是模拟这件事。

---

## 1. 先跑起来

```bash
npm install
npm run dev        # http://localhost:5288
npm run typecheck  # vue-tsc，改完必跑
npm run build      # 产物在 dist/
npm run sim        # 无界面平衡模拟器
```

纯前端，无后端。存档在 `localStorage`（键 `mouse-idol-dream-v1`）。

---

## 2. 技术栈

Vite 7 + Vue 3 + TypeScript（strict）+ Pinia 3 + **PixiJS 8**。

没有 UI 框架、没有 CSS 预处理器、没有路由库。`App.vue` 按 `game.screen` 手写四个页面切换。

---

## 3. 目录地图

```
src/
  main.ts / App.vue          挂载、页面切换、音频开关、主题 dock、toast
  styles/base.css            全部设计变量（两套主题）、基础样式、通用类

  data/config.json           ★ 全局数值：经济、收入与抽成、疲劳、心态、Live 评分、事件概率
  data/idols.json            ★ 八个成员的能力、粉丝、心态、配色、造型编号
  data/actions.json          ★ 十四个行动的 AP / 花费 / 涨粉 / 疲劳 / 成长 / 口碑 / 浮动
  data/idols.ts actions.ts   JSON 的类型包装（+ 初始状态工厂、标签映射）
  data/narration.ts          文字演出库：每个行动 4 档 × 若干条
  data/events.ts             16 个随机事件（条件 / 正文 / 选项 → EventOutcome）
  data/endings.ts            Live 评分 + 8 种结局的正文与结算数据

  engine/types.ts            所有共享类型（GameState / LogLine / EventOutcome ...）
  engine/rng.ts              确定性随机数（mulberry32）
  engine/balance.ts          读 config，派生固定支出 / 涨粉规模 / 收入拆解 / 抽成三条曲线
  engine/resolve.ts          ★ 结算核心：行动结算、属性成长、心态模型、月末对账

  stores/game.ts             ★ 状态机：编成、执行一个月、事件、阶段推进、结局、存档
  stores/theme.ts            主题（light / dark / system）→ <html data-theme>
  stores/ui.ts               音频开关的共享状态

  render/color.ts            颜色工具 + 确定性伪随机
  render/avatar.ts           程序化立绘（240×300 逻辑坐标，canvas 2D）
  render/pixi/               Pixi 渲染层，全应用共用一个 WebGL 上下文：
                             textures  用 canvas 现画贴图（柔光点/荧光棒/光锥/星屑/纸纹）
                             palette   两套主题配色 + 直播间配色
                             ambient   常驻底噪：渐变底 + 漂移色斑 + 尘埃
                             stage     Live 直播间：虚拟舞台/大屏/八个人/灯牌人浪/粒子
                             backdrop  单例：场景启停、尺寸、主题，WebGL 失败时退回 CSS

  audio/engine.ts            Web Audio 合成器：7 套 BGM + 全部音效
  components/                TopBar Roster LogFeed OrderPanel ActionPicker EventModal
                             IdolDetail DataPanel ThemeToggle AudioToggle
                             PixiBackdrop IdolPortrait IdolIcon
  views/                     TitleScreen GameScreen LiveStage EndingScreen

scripts/sim.ts               无界面平衡模拟器
docs/                        截图（README 用）
```

---

## 4. 三条硬规矩

### ① 不引入任何素材文件

图片、音频、字体、图标库一律不加。需要图形就用 canvas 现画（然后给 Pixi 当贴图），
需要声音就用 Web Audio 现合成，需要字体就用系统字体栈（`--serif` / `--sans` / `--mono`）。
`index.html` 里的 favicon 也是内联的 SVG data URI。

### ② 数值不进代码

所有可调数字都在 `src/data/*.json` 里。代码只负责读取和派生。
判断标准：**如果策划想改这个数，它就不该出现在 `.ts` 里。**

例外：纯表现参数（动画时长、粒子数量、模糊半径）可以写在组件里。

### ③ 颜色不进组件

`.vue` 的 `<style>` 里不写颜色字面量，一律用 `base.css` 里的 CSS 变量。
需要新颜色就在 `html[data-theme='dark']` 和 `html[data-theme='light']` 两块里各加一个。

**唯一的例外**是 Live 舞台：直播间在两种主题下都是暗的，`LiveStage.vue` 里
和舞台视觉相关的颜色可以硬编码为暗色值。

---

## 5. 玩法与数值模型（接手必读）

### 回合

一个月一回合，每回合 **5 点行动点**。玩家挑行动 → 点「执行本月计划」→ 一次性结算 →
月末对账 → 随机事件 → 推进时间。两个阶段各 12 个月。

### 收入（这是最有意思的部分）

```
粉丝打赏（流水）= 总粉丝 × grossPerFan × 口碑倍率
  └ 平台先抽 platformCut（50%）
      └ 剩下的里面公会抽 guildCut（默认 30%，玩家可调 10%–50%）
          └ 其余给主播
周边与外快：不被抽成，但有上限（很难赚多）
商务恰饭：一次性外快，不进流水
```

`guildCut` 是全局最重要的杠杆，抽高了对公会有利，但有**四重代价**：

1. **涨粉变慢**（`growthPenalty`，抽满 50% 时内容产出只剩 64%）
2. **口碑下滑**（`reputationPenalty`）
3. **心态有天花板**（`aboveCapSensitivity`，抽 50% 时上限只剩 16）
4. **感知滞后**：成员记住的是长期分成，`guildCutPerceived` 每月只追 `adaptSpeed`，
   临时调低救不了场；单次改动超过 `changeThreshold` 还会额外掉心态

实测评级（`npm run sim`）：抽 30% 时 83% 活到第 24 个月、48 万粉、满月；
抽 50% 时 56% 活下来但只有 15 万粉、只亮了一排。**靠压榨能活，但梦会变小。**

### 状态与失败

- **资金**：每月固定支出 = 底薪 × 8 + 运营。不增长就会破产 → BE。
- **疲劳**：动作累加，每月只自然恢复一点点。超过 100 病倒（下月 AP −1）。
- **心态**：按月结算，取决于疲劳区间、粉丝增长、阶段、悲观螺旋、抽成感知。
  心态 ≤ 0 → 进入毕业倒计时（`riskMonths`）→ **任何一个人毕业，企划立刻结束**。
- **休息**是最便宜的心态/疲劳修复手段，但吃 AP ——这是核心的资源博弈。

### Live 与结局

第 24 个月月末结算后进 Live。评分 = 粉丝体量 + 成员能力 + 心态 + 口碑 + 3D 完成度
+ 制作规格 − 疲劳扣分（权重全在 `config.live.weights`）。

档位（`config.live.tiers`）：`legend` 88 / `perfect` 78 / `great` 62 / `ok` 46 / `poor` 0。

- **BE**：破产、有人毕业。子结局：破产清算、毕业、空城计。
- **HE**：按 Live 评分分四档 + 一个隐藏档「让山自己动起来」。
- HE 之后可进**无限流**：不触发事件、不判破产/毕业，纯跑数据。

---

## 6. 常见改动怎么做

### 加一个行动

1. `src/data/actions.json` 加一条（`id` 用英文小写，`tag` 决定 UI 分组）。
2. `src/data/narration.ts` 加同名的 `ACTION_NARRATION[id]`，四档（crit/good/ok/bad）各写 2–3 条。
3. 如果需要特殊结算（像 `clip` / `review` / `sponsor` / `rest` / `training` / `three_d` 那样），
   在 `src/engine/resolve.ts` 的 `resolveAction` 里加一个 `else if (action.id === 'xxx')` 分支；
   否则走通用路径（基础涨粉 × 发挥水平 × 规模 × 营销 × 抽成惩罚 × 浮动）。
4. 跑 `npm run sim` 看平衡有没有崩。

### 加一个随机事件

在 `src/data/events.ts` 的 `EVENTS` 里加一条：

```ts
{
  id: 'unique_id',
  title: '标题',
  weight: 7,                       // 权重，默认 5
  when: (c) => c.money > 100_000,  // 触发条件，c.state 是 GameState
  body: () => [line('narration', '……')],
  choices: (c) => [
    { label: '选项', hint: '代价说明', cost: 10_000, apply: () => outcome({ money: money(-10_000), logs: [...] }) },
  ],
}
```

`apply` 返回 `EventOutcome`，可以给 `money / fans / reputation / morale / fatigue / stat / flags`，
以及 `graduate: [id]`（**慎用**，会直接结束游戏，必须在选项文案里写明）。

不要写「随机一个选项有 45% 概率直接让成员毕业」这种——曾经有，体验很差，已删。

### 加一个成员

只改 `src/data/idols.json`。`look` 是 0–7 的发型编号，`line` 是 `light` / `gem`。
注意 `engine` 和 UI 里有几处按 8 人写死的地方（Live 舞台的登场人数、`fixedCost` 的 ×8），
加人之后要一起改，或者把 8 提进 config。

名字统一是「中文前缀 + 英文后缀」（如 `月白Mio`），`id` 保持英文不动——存档按 `id` 认人。

### 调难度

只改 `src/data/config.json`。常用旋钮：

| 想调整 | 改哪 |
| --- | --- |
| 钱不够 / 太松 | `economy.salaryPerIdol`、`economy.operationBase`、`revenue.grossPerFan` |
| 抽成杠杆太强/太弱 | `revenue.guildCut.*` |
| 涨粉太快/太慢 | `actions.json` 里的 `base`，或 `fanGrowth.fansScale` |
| 心态太高压/太宽松 | `morale.bands`、`morale.growthBonus`、`graduation.*` |
| Live 太难/太易 | `live.weights`、`live.tiers`、`live.venueCost` |

**改完一定跑 `npm run sim 300` 看存活率**，别凭感觉。

### 加一个界面

`src/views/` 新建组件 → 在 `App.vue` 的 `Transition` 块里加一个 `v-else-if` 分支 →
`stores/game.ts` 的 `Screen` 类型加上新值。

### 加一首 BGM

`src/audio/engine.ts` 的 `TRACKS` 里加一套（bpm / swing / 8 小节和弦 / 低音型 / 琶音型 / 主旋律 /
鼓型 / 混响量），然后在 `Mood` 类型和 `App.vue` 的 `mood` computed 里接上。

`drums` 是 16 格字符串：`k`/`K` 底鼓、`s`/`S` 军鼓、`h`/`H` 闭镲/开镲、`x` 鬼镲、`.` 休止。
低音型、琶音型、主旋律都是 16 步数组：低音写相对根音的半音偏移，琶音和主旋律写和弦音索引
（超过和弦音数量会自动升八度），`null` 是休止。鼓点的留白和加花由引擎按小节自动处理。

---

## 7. 代码约定

- **TypeScript strict**，`noUnusedLocals` 打开。`npm run typecheck` 必须干净。
- 缩进 2 空格，单引号，无分号。注释和界面文案用中文，标识符用英文。
- 注释解释「为什么」，不复述「做了什么」。
- 组件用 `<script setup lang="ts">`，样式用 `<style scoped>`。
- 状态只在 store 里改；组件只读和发事件。
- 日志统一走 `LogLine`：`narration` / `action` / `result` / `system` / `good` / `bad` / `quote` / `event` / `ledger`。
  账本用 `ledger` + `rows`，别用一堆 `result` 行拼表。
- 叙事文本的占位符：`{n}` 主目标、`{n2}` 第二目标、`{names}` 全员、`{r}` 罗马音。

---

## 8. 已知的坑

这些都是踩过的，别重复踩：

1. **休息的疲劳是负数**。`rest.fatigue = -34`，结算时直接加，**不能再取反**。
   曾经写成 `-action.fatigue`，导致「休息更累」，平衡全崩。
2. **阶段推进要先存旧的 phase**。第 12 个月同时满足「第一阶段结束」和「第二阶段结束」，
   必须先 `const wasPhase = phase` 再判断，否则第 12 个月直接跳 Live。
3. **预览状态不能写存档**。`?preview=stage` 会把 `gs` 改成假数据，
   `save()` 里有 `isPreview` 守卫，别删。
4. **旧存档兼容**。`load()` 里给后加的字段补默认值（`guildCut` 系列、`counters`）。
   加字段时记得补一行，或者干脆提升 `SAVE_KEY` 版本。
5. **心态是会溢出的**。`monthEnd` 里既要做边际递减，也要按抽成天花板夹住，
   别只 `Math.min(100, ...)`。
6. **立绘是 240×300 逻辑坐标**。所有绘制都按这个坐标系写，缩放交给 `drawAvatar` 的 `size` 和 dpr。
7. **Pixi 只有一个上下文**。`backdrop.ts` 是单例，加新的全屏效果请做成场景，
   不要 `new Application()`。浏览器对 WebGL 上下文数量有限制。
8. **主题切换要跟着重绘**。canvas 绘制的图表（`DataPanel`）和立绘都要 `watch(resolved, ...)` 重画，
   否则切主题后会残留旧颜色。

---

## 9. 调试与验证

### 网址参数

| 参数 | 作用 |
| --- | --- |
| `?phaseMonths=1` | 每个阶段压成 1 个月，快速走完结局流程 |
| `?preview=stage&fans=240000&threed=8` | 直接预览 Live 舞台（不写存档） |

### 提交前清单

```bash
npm run typecheck              # 必须无输出
npm run build                  # 必须成功
npm run sim 200                # 默认策略，存活率 ~98%（当前基线）
npm run sim 200 naive          # 什么都不管，存活率 0%
GUILD_CUT=0.3 npm run sim 200  # 固定抽成 30%，中标解：~83%
GUILD_CUT=0.2 npm run sim 200  # 固定抽成 20%，缺钱解：~9%
```

注意：**默认策略是脚本里写的机器策略，接近最优解，98% 是上限而不是人类难度。**
想判断「这个改动会不会让游戏变难/变简单」，看固定抽成的两行更有参考价值。

再手动点一遍：标题 → 开新局 → 编成 → 执行 → 事件 → 换主题 → 数据表 → 成员详情 → 结局。
至少确认**浅色和深色各看一遍**。

### 无界面模拟器

`scripts/sim.ts` 里有两个策略：默认的「还算会玩」（会按资金和心态调抽成、会轮休）
和 `naive`（不休息、不看心态、抽成拉满）。
它会打印存活率、破产/毕业比、粉丝区间、Live 评级分布。
环境变量可以定点测：`GUILD_CUT=0.4 npm run sim 150`。

改数值前先跑一次当基线，改完再跑一次对比。

---

## 10. 还没做的（欢迎接手）

- 存档只有自动存档一个槽位，没有多存档/导出。
- 事件没有复用标签（同一事件在同局只会出现一次，除非标 `repeatable`）。
- 手机端只做了基础的纵向堆叠，没有专门的交互设计。
- 无限流模式除了跑数据没有别的玩法。
- BGM 是七套 8 小节循环，有加花和留白，但没有真正的主歌/副歌段落。
- `src/render/avatar.ts` 的立绘还能再细化（现在的阴影和发丝是近似处理）。
