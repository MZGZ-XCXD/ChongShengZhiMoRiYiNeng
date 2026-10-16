# assets/ 放图的地方

文件名就是 id，脚本会自动认出来，不需要改任何代码。

| 目录 | 放什么 | 文件名 | 建议尺寸 |
| --- | --- | --- | --- |
| `portraits/` | 羁绊角色的立绘 | `<羁绊id>.png` | 768 × 1024（3:4），透明底或深色底 |
| `scenes/` | 每个搜刮地点的背景图 | `<地点id>.jpg` | 1280 × 720（16:9） |
| `dooms/` | 末日类型的氛围图（剧情与地图顶部用） | `<末日id>.jpg` | 1280 × 720 |

支持 `.webp` / `.png` / `.jpg` / `.jpeg`；同一个 id 有多个格式时按 webp > png > jpg 取。
（`dooms/` 与 `doom/` 两个目录名都认，放哪个都行。）

## id 对照

**羁绊（portraits）**：wangyi 王姨、laozhao 老赵、zhouheng 周恒、shenxue 沈雪、yanprof 严教授、
taotao 陶陶、chenmo 陈默、linqing 林晴、lutie 陆铁、anqi 安琪、oldk 老K、xiaoma 小马、
baimanman 白小满、fangdoctor 方医生、guchangan 顾长安、huangsan 黄三、zhengdui 郑队

**地点（scenes）**：home 自家公寓、building 公寓楼、yard 小区院内、conv 楼下便利店、garage 地下车库、
street 商业街、market 大型超市、clinic 社区诊所、school 实验中学、gas 加油站、warehouse 物流仓库、
police 辖区警局、hospital 市立医院、farm 郊外农庄、substation 城东变电站

**末日（doom）**：zombie 丧尸末日、frost 极寒末日、flood 洪水末日、nuclear 核冬天

## 加完图之后

```
tools\run.ps1 tools\gen-asset-manifest.js   # 重新生成图片清单
tools\run.ps1 tools\build-single-file.js    # 单文件版会把图片内联进去（会报总体积）
```

没有图片也不影响玩：界面上会画一个「档案未归档」的占位框，位置和最终效果一致。
