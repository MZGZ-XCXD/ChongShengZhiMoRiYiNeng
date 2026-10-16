/* 地图与搜刮点（纯数据）
   uses = 一个刷新周期内能搜刮几次；refresh = 多少小时恢复一次；danger = 遭遇危险的基础概率 */
/* 稀有掉落概率：rare 里的 w 是权重，换算成概率 = w × 这个系数（w 3 ≈ 7.5%）。
   搜刮是异能结晶最稳定的来源，改这个数就等于调整整条成长线的速度。 */
const CRYSTAL_DROP_RATE = 0.025;

/* 搜刮时打输了：敌人会占住这个地方多久（游戏小时）。
   越危险的地方，来的人越多、赖得越久；想提前拿回来只能在地图上打一场「夺回」。 */
const OCCUPY_HOURS = { base: 10, perDanger: 14 };

const LOCATIONS_CONFIG = [
    {
        id: 'home', name: '自家公寓', icon: '🏠', unlock: { hours: 0 },
        desc: '住了三年的单间。上一世你在这里把最后的饼干吃到发霉。',
        uses: 6, refresh: 3, danger: 0.02,
        loot: [
            { res: '食物', min: 3, max: 9, w: 3 },
            { res: '零件', min: 1, max: 4, w: 2 },
            { res: '净水', min: 2, max: 6, w: 2 },
            { res: '药品', min: 1, max: 3, w: 1 },
        ],
    },
    {
        id: 'building', name: '公寓楼', icon: '🏢', unlock: { hours: 0 },
        desc: '十二层老楼，邻居比亲戚都熟。楼道里的杂物，平时没人要，现在全是宝贝。',
        uses: 10, refresh: 4, danger: 0.05,
        loot: [
            { res: '食物', min: 4, max: 12, w: 3 },
            { res: '建材', min: 2, max: 6, w: 3 },
            { res: '净水', min: 2, max: 8, w: 2 },
            { res: '药品', min: 1, max: 4, w: 1 },
        ],
        rare: [{ type: 'crystal', min: 1, max: 1, w: 3 }],
        story: 'neighbour',
    },
    {
        id: 'yard', name: '小区院内', icon: '🏘️', unlock: { hours: 2 },
        desc: '楼下的健身器材、快递柜和半死不活的花坛。快递柜里有别人的包裹。',
        uses: 8, refresh: 5, danger: 0.09,
        loot: [
            { res: '食物', min: 5, max: 14, w: 3 },
            { res: '建材', min: 3, max: 9, w: 3 },
            { res: '零件', min: 2, max: 6, w: 2 },
        ],
    },
    {
        id: 'conv', name: '楼下便利店', icon: '🏪', unlock: { hours: 4 },
        desc: '老板周恒还开着门，货架上已经在空。他说他等一个人。',
        uses: 6, refresh: 5, danger: 0.12,
        loot: [
            { res: '食物', min: 8, max: 20, w: 4 },
            { res: '净水', min: 6, max: 16, w: 4 },
            { res: '药品', min: 2, max: 5, w: 2 },
        ],
        bond: 'zhouheng',
    },
    {
        id: 'garage', name: '地下车库', icon: '🚗', unlock: { hours: 6 },
        desc: '灯光昏黄，一层的回音。这里有车，有工具，也有别人的秘密。',
        uses: 6, refresh: 8, danger: 0.14,
        loot: [
            { res: '燃料', min: 4, max: 12, w: 4 },
            { res: '零件', min: 3, max: 9, w: 3 },
            { res: '建材', min: 3, max: 8, w: 2 },
            { res: '弹药', min: 1, max: 4, w: 1 },
        ],
        rare: [{ type: 'crystal', min: 1, max: 1, w: 2 }],
    },
    {
        id: 'clinic', name: '社区诊所', icon: '🩺', unlock: { hours: 8 },
        desc: '两个诊室一个药房。护士沈雪还在值班，她说医院早就不要她去了。',
        uses: 5, refresh: 10, danger: 0.16,
        loot: [
            { res: '药品', min: 6, max: 16, w: 5 },
            { res: '净水', min: 3, max: 9, w: 2 },
            { res: '零件', min: 1, max: 4, w: 1 },
        ],
        rare: [{ type: 'crystal', min: 1, max: 2, w: 3 }],
        bond: 'shenxue',
    },
    {
        id: 'street', name: '商业街', icon: '🏬', unlock: { hours: 11 },
        desc: '白天人挤人的地方，现在卷帘门一半拉着，地上散着传单。',
        uses: 8, refresh: 7, danger: 0.22,
        loot: [
            { res: '食物', min: 6, max: 18, w: 3 },
            { res: '建材', min: 3, max: 10, w: 2 },
            { res: '零件', min: 2, max: 7, w: 2 },
            { res: '药品', min: 2, max: 6, w: 2 },
        ],
        rare: [{ type: 'crystal', min: 1, max: 1, w: 3 }],
        event: 'thugs',
    },
    {
        id: 'market', name: '大型超市', icon: '🛒', unlock: { hours: 15 },
        desc: '三层的大卖场。上一世你到得晚了一步，货架已经被搬空。',
        uses: 8, refresh: 12, danger: 0.28,
        loot: [
            { res: '食物', min: 14, max: 34, w: 5 },
            { res: '净水', min: 10, max: 26, w: 4 },
            { res: '建材', min: 3, max: 9, w: 2 },
            { res: '药品', min: 3, max: 9, w: 2 },
        ],
        rare: [{ type: 'crystal', min: 1, max: 2, w: 4 }],
    },
    {
        id: 'school', name: '实验中学', icon: '🏫', unlock: { hours: 20 },
        desc: '围墙很高，操场很空。校门口的保安亭里还挂着谁的红领巾。',
        uses: 6, refresh: 12, danger: 0.26,
        loot: [
            { res: '建材', min: 5, max: 14, w: 4 },
            { res: '食物', min: 5, max: 15, w: 3 },
            { res: '零件', min: 2, max: 7, w: 2 },
            { res: '药品', min: 2, max: 6, w: 2 },
        ],
        rare: [{ type: 'crystal', min: 1, max: 2, w: 3 }],
        bond: 'yanprof',
    },
    {
        id: 'gas', name: '加油站', icon: '⛽', unlock: { hours: 24 },
        desc: '两台加油机被人用铁链锁着，油罐车横在出口。有人比你先到过这里。',
        uses: 4, refresh: 10, danger: 0.34,
        loot: [
            { res: '燃料', min: 10, max: 26, w: 5 },
            { res: '零件', min: 3, max: 9, w: 3 },
            { res: '建材', min: 2, max: 6, w: 2 },
        ],
        rare: [{ type: 'crystal', min: 1, max: 2, w: 3 }],
        event: 'gang',
    },
    {
        id: 'warehouse', name: '物流仓库', icon: '📦', unlock: { hours: 30 },
        desc: '钢架顶棚下的货架有三层楼高。铲车停在门口，钥匙还插在上面。',
        uses: 5, refresh: 16, danger: 0.38,
        loot: [
            { res: '建材', min: 10, max: 26, w: 5 },
            { res: '零件', min: 5, max: 14, w: 4 },
            { res: '食物', min: 8, max: 20, w: 3 },
            { res: '燃料', min: 4, max: 12, w: 2 },
        ],
        rare: [{ type: 'crystal', min: 1, max: 2, w: 3 }],
    },
    {
        id: 'police', name: '辖区警局', icon: '🚓', unlock: { hours: 36 },
        desc: '卷帘门被撞开了一半，值班室的桌上还有半杯凉掉的茶。',
        uses: 4, refresh: 20, danger: 0.5,
        loot: [
            { res: '弹药', min: 6, max: 16, w: 5 },
            { res: '建材', min: 4, max: 12, w: 2 },
            { res: '零件', min: 3, max: 9, w: 2 },
            { res: '药品', min: 3, max: 8, w: 2 },
        ],
        rare: [{ type: 'crystal', min: 1, max: 2, w: 4 }],
        bond: 'zhengdui',
    },
    {
        id: 'hospital', name: '市立医院', icon: '🏥', unlock: { hours: 42 },
        desc: '走廊的应急灯还是绿的，输液架倒在门口。药房里那批货，上一世你连门都没摸到。',
        uses: 6, refresh: 18, danger: 0.55,
        loot: [
            { res: '药品', min: 12, max: 30, w: 5 },
            { res: '食物', min: 3, max: 10, w: 2 },
            { res: '净水', min: 5, max: 14, w: 2 },
            { res: '零件', min: 3, max: 9, w: 2 },
        ],
        rare: [{ type: 'crystal', min: 1, max: 3, w: 4 }],
        event: 'survivorNurse',
    },
    {
        id: 'farm', name: '郊外农庄', icon: '🌾', unlock: { hours: 52 },
        desc: '离城十公里。有井、有地窖、有一整墙的农具，还有老严堆在屋里没卖完的种子。',
        uses: 5, refresh: 20, danger: 0.5,
        loot: [
            { res: '食物', min: 14, max: 36, w: 5 },
            { res: '净水', min: 8, max: 22, w: 3 },
            { res: '建材', min: 4, max: 12, w: 3 },
            { res: '燃料', min: 3, max: 10, w: 2 },
        ],
        rare: [{ type: 'crystal', min: 2, max: 3, w: 4 }],
        bond: 'taotao',
    },
    {
        id: 'substation', name: '城东变电站', icon: '⚡', unlock: { hours: 58 },
        desc: '高压塔在风里发出嗡响。这里的铜和硅，是让据点亮起来的东西。',
        uses: 3, refresh: 24, danger: 0.56,
        loot: [
            { res: '零件', min: 12, max: 30, w: 5 },
            { res: '建材', min: 6, max: 16, w: 3 },
            { res: '燃料', min: 4, max: 12, w: 2 },
        ],
        rare: [{ type: 'crystal', min: 2, max: 4, w: 4 }],
    },
];

/* ---------------- 城区地图（视图用纯数据） ----------------
   地图画布是 1000 × 660 的逻辑坐标，节点按 x / y 摆位置，region 对应下面的城区。
   这里只描述「世界长什么样」，几何（道路、河、街区轮廓）在 js/ui/mapview.js 里画。 */
const REGIONS_CONFIG = [
    {
        id: 'oldtown', name: '老城区', color: '#8a7355',
        desc: '你住了三年的地方：十二层的老楼、窄巷、到处是私搭的雨棚。',
    },
    {
        id: 'downtown', name: '商业区', color: '#9a7a4a',
        desc: '玻璃幕墙和卷帘门。上一世这里是第一个被打空的地方。',
    },
    {
        id: 'civic', name: '医疗与治安区', color: '#6f7d8c',
        desc: '诊所、医院、警局挤在三个街区内。药和枪都在这儿。',
    },
    {
        id: 'outskirts', name: '城郊', color: '#6d7a52',
        desc: '环城路以外：学校、仓库、农庄，还有那座还在嗡响的变电站。',
    },
];

const LOCATION_MAP = {
    home:       { x: 148, y: 112, region: 'oldtown' },
    building:   { x: 262, y: 196, region: 'oldtown' },
    yard:       { x: 132, y: 252, region: 'oldtown' },
    conv:       { x: 264, y: 322, region: 'oldtown' },
    garage:     { x: 108, y: 398, region: 'oldtown' },
    street:     { x: 452, y: 116, region: 'downtown' },
    market:     { x: 582, y: 198, region: 'downtown' },
    gas:        { x: 470, y: 318, region: 'downtown' },
    clinic:     { x: 352, y: 452, region: 'civic' },
    hospital:   { x: 470, y: 552, region: 'civic' },
    police:     { x: 246, y: 536, region: 'civic' },
    school:     { x: 704, y: 122, region: 'outskirts' },
    warehouse:  { x: 836, y: 214, region: 'outskirts' },
    farm:       { x: 866, y: 368, region: 'outskirts' },
    substation: { x: 740, y: 452, region: 'outskirts' },
};
