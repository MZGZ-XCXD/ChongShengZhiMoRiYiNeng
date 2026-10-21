# 给这个项目里的 AI 看的说明

这份文件是**换电脑 / 换 AI 之后的入口**：先读完它，再动手。所有路径都是相对工程根目录的。

## 这个项目是什么

《末日回声 · Echoes of Doom》—— 末日超能力生存题材的**纯前端零依赖**放置游戏。
双击 `index.html` 就能玩，没有构建步骤、没有 npm 依赖、没有本地服务器。

**零依赖是硬要求**：不要引入框架、不要装 npm 包、不要改成需要打包器才能跑的结构。

> 上一个参考项目（`魔法重建者`）和那份《开发避坑清单》**不在这台电脑上**，不要去别处找。
> 那份清单里真正有用的坑，已经全部总结在下面第 2 节。

## 1. 接手第一步：先自检，再动手

```
tools\run.ps1 tools\check-env.js     # 环境自检：node / PowerShell / 浏览器 / 写权限 / 产物
tools\check.ps1                      # 端到端自检，期望结尾是 ALL GREEN
```

`check.ps1` 不过就先别改代码 —— 那是「改之前是好的」，改完再不过就是你自己弄坏的。

## 2. 沙箱 / 本机环境的坑（踩过的，别重踩）

1. **不要直接 `node tools/xxx.js`**。沙箱里 node 的 realpath 被拦，会报
   `EPERM: operation not permitted, lstat '...'`。统一走
   `tools\run.ps1 tools\xxx.js [参数...]`（内部用 `node -e` + `vm.runInThisContext`）。
   同理 `node --check 路径` 也不可用。
2. **`require('./同目录文件.js')` 也会 EPERM**。要读工程里的 js，用
   `fs.readFileSync` + `vm` 自己加载（`tools/gen-asset-manifest.js` 里有现成写法）。
3. **`.ps1` 文件只能写 ASCII**。PowerShell 5.1 会把无 BOM 的 UTF-8 `.ps1` 当 GBK 读，
   中文会变成乱码甚至语法错误。中文放进 `.js` / `.json` / `.md`。
4. **改文件用 `apply_patch`，同一个文件一次只放一个 hunk**；单个补丁别超过 ~120 行，
   太大了会被规则串行吞掉内容。
5. **`apply_patch` 删不了二进制文件**（会当 UTF-8 读失败）。删图用 `Remove-Item`，
   先用 `Resolve-Path` 校验路径，并且把删除单独作为一条命令。
6. 需要浏览器（自检 / 截图 / 图片入库）时，路径由 `tools\lib-chrome.ps1` 自动探测
   （Chrome → Edge → PATH → 注册表）。装在奇怪位置就设环境变量 `CHROME_PATH`。

## 3. 代码分层（照这个来，别打乱）

```
js/config/   纯数据：资源、阶段、末日类型、地点、异能、设施、战斗、羁绊、事件、成就、重生、剧情、图片清单、更新日志
js/engine/   纯逻辑：state / effects / production / ability / scavenge / eventengine / bondengine /
             build / defense / achievements / story / rebirth / actions / save / loop
js/ui/       渲染：dom / tips / panels / modals / tab-* / app / acts / mapview / assets
tools/       构建与自检脚本
```

* 数据写进 `config`，规则写进 `engine`，**不要**把玩法逻辑塞进 `ui`。
* 新加一个数值加成时：先在 `js/engine/effects.js` 的登记表里加效果键，再写
  `tools/run.ps1 tools\scan-effect-keys.js` 验证 —— 配置里出现引擎不认识的键会直接报错。
* 改完跑 `tools\run.ps1 tools\audit.js`（配置体检：id 引用、解锁链死循环、数值极值）。

## 4. 存档

* `js/engine/state.js` 里的 `SAVE_VERSION` 管存档结构版本。
* 加了新字段就要写迁移，而且**迁移必须幂等**：连读两次结果一致，不能重复发奖励。
  `check.ps1` 里有断言盯着这一点。

## 5. 版本号与 Changelog

* **上线前版本号冻结在 `0.1.0`**（GitHub 仓库建立、正式上线之前不变）。
  所有改动写进 `CHANGELOG.md` 最上方的 `## [未发布]`。
* 上线之后才按规则递增：文案 / 界面 / 平衡 / Bug 修复 → `X.X.1`；新增系统或内容 → `X.1.0`。
* `CHANGELOG.md` 是**唯一数据源**，游戏内「设置 → 更新日志」读的是
  `tools/gen-changelog.js` 从它生成的 `js/config/changelog.js`，不要手写第二份。
* 提交信息用中文，写清根因（不是「修了个 bug」，而是「为什么会有这个 bug」）。

## 6. 固定流水线（顺序不能乱）

```
改代码 → 写 CHANGELOG → tools\run.ps1 tools\gen-changelog.js → tools\run.ps1 tools\build-single-file.js
      → tools\check.ps1 / tools\check-reset.ps1 / tools\smoke.ps1 → 提交
```

收工前这一套要全绿：

```
tools\run.ps1 tools\scan-effect-keys.js    # 效果键全量扫描
tools\run.ps1 tools\audit.js               # 配置体检
tools\check.ps1                            # 无头 Chrome 端到端（宽屏 + 窄屏各一轮，280+ 断言）
tools\check-reset.ps1                      # 「清除存档」真实 reload 路径
tools\smoke.ps1                            # 多文件版冒烟
tools\shots.ps1                            # 截界面图到 screenshots/
```

`work\` 是草稿目录（临时页面、自检报告），删掉不影响游戏。

## 7. 图片资源

图片按 **id 命名**放进 `assets/`，跑两个脚本就生效，不用改代码：

```
assets/portraits/<羁绊id>.jpg     立绘     768×1024（3:4）
assets/scenes/<地点id>.jpg        地点背景 1280×720（16:9）
assets/dooms/<末日id>.jpg         末日氛围 1280×720

tools\run.ps1 tools\gen-asset-manifest.js   # 扫 assets/，生成 js/config/assets.js
tools\run.ps1 tools\build-single-file.js    # 单文件版把图内联成 data URI
```

* id 对照表在 `assets/README.md`。没图也能玩，界面画「档案未归档」占位框。
* 手上有成图（比如豆包 / Gemini 出的）要入库：
  `.\tools\install-art.ps1 -Source "<图片路径>" -Id shenxue -CropBottom 0.06`
  —— 会裁掉底部水印条、缩到目标宽度、转 JPEG，落到 `assets/<kind>/<id>.jpg`。
* 出图提示词在 `tools/art-spec.js`（36 条），
  `tools\run.ps1 tools\gen-art.js --dump` 导出成人看的 `tools/art-prompts.md`。

## 8. 美术风格（已经和用户反复对齐过，别再改回去）

**目标是「电影级半写实 CG 角色渲染」，不是厚涂油画，也不是纪实摄影。**

* 要：皮肤有柔和的次表面散射与细腻高光、虹膜纹理与眼神光、发丝根根分明并且带逆光光晕；
  整体清晰锐利、笔触干净、有画意。
* 要：侧逆光窗光（暖金主光 + 冷灰蓝环境光）、轮廓光、光柱里的细小浮尘、浅景深；
  半身构图（头顶到腰），手和道具要完整入画。
* 要：**可以有网感** —— 五官精致、眼尾略上挑、妆容干净显气色，按写真 / 短视频那种一眼抓人的长相来画。
  用户明确否掉了「不要网红脸」这条限制，别再把它加回去。
* 不要：厚涂油画、柔焦糊脸、磨皮塑料、卡通 / 日系赛璐璐，以及**纪实摄影 / 新闻照 / 手机随手拍那种平光素人感**。
* 例外：陶陶 18 岁（刚满），按朴实、有孩子气的方向画，不做美艳与性感处理。
* 每位角色都有一条独立的「发型」和「机位与光线」（`HAIR` / `CAMERA` 表）——
  出图会靠这两条拉开剪影和镜头语言；改的时候别让两个角色的发型或机位重复。
* 画风基准图：`assets/portraits/baimanman.jpg`（白小满，冷硬英气）＋ 用户用 GPT 出的沈雪样图（电影级 CG 质感）。
  出图时传其中一张当参考图，并在提示词里写明「只参考画风，不参考动作与构图」。
* 用户是**手动**在豆包 / Gemini 网页出图，然后把图交给 AI 入库；
  自带的批量出图脚本（`tools/gen-art.js`）因为免费层额度为 0，暂时用不上。

## 9. 当前进度（接手时的起点）

* 版本 `0.1.0`，系统已经齐了：空间异能技能树、15 个地点的城区地图、遭遇战（战力/人数/胜率/逃跑）、
  地点被占领与夺回、隐藏物资点、现金只能借或抢 + 仇家、22 种设施 + 4 级据点迁移、
  17 位羁绊、36 项成就、第二异能抽卡（D~EX）、恶性事件与防御、重生与重生商店、4 种末日类型。
* 差的主要是**美术资源**（目前只有白小满 1 张立绘，15 个地点背景和 4 张末日图还没做）。
* `dist/echoes-of-doom.html` 是能直接双击玩的单文件版，改完代码记得重建。
* 桌面快捷方式工具在 `tools/make-desktop-shortcut.ps1`（换电脑要重跑一次，快捷方式不是文件）。

## 10. 沟通

用**中文**回复。改动要能一句话说清「玩家会感觉到什么」。
不确定要不要动玩法时先问，别自己发明新系统 —— 现在的数值和结构是反复调过的。
