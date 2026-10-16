/* 据点设施（纯数据）
   effect(level) 返回标准效果表；produce(level) 返回每小时产出；power(level) 是耗电（折算成燃料/小时）
   cost(level) 是「升到 level 级」需要的材料 */
const FACILITIES_CONFIG = {
    doorReinforce: {
        id: 'doorReinforce', name: '门窗加固', icon: '🚪', tier: 1, maxLevel: 6,
        desc: '钢板钉门、木条封窗。第一夜能不能睡个整觉，就看这个。',
        cost: lv => ({ '建材': Math.round(10 * Math.pow(lv, 1.25)), '零件': Math.round(2 * lv) }),
        effect: lv => ({ defenseFlat: 4 * lv }),
    },
    fence: {
        id: 'fence', name: '铁栅栏', icon: '🚧', tier: 1, maxLevel: 6,
        desc: '把一楼到三楼的窗户外侧围一圈。伸手的会被割到。',
        cost: lv => ({ '建材': Math.round(16 * Math.pow(lv, 1.2)), '零件': Math.round(2 * lv) }),
        effect: lv => ({ defenseFlat: 6 * lv }),
    },
    storeroom: {
        id: 'storeroom', name: '储物间', icon: '🗄️', tier: 1, maxLevel: 6,
        desc: '空间之外的另一层收纳：把不急着用的东西挪出异能空间。',
        cost: lv => ({ '建材': Math.round(22 * Math.pow(lv, 1.2)), '零件': Math.round(3 * lv) }),
        effect: lv => ({ spaceCapFlat: 260 * lv }),
    },
    solarPanel: {
        id: 'solarPanel', name: '太阳能板', icon: '☀️', tier: 1, maxLevel: 6,
        desc: '白天攒电，晚上省油。极寒与核冬天里效果会打折扣。',
        cost: lv => ({ '零件': Math.round(8 * Math.pow(lv, 1.3)), '建材': Math.round(5 * lv) }),
        effect: lv => ({ powerUse: -0.1 * lv }),
    },
    waterTank: {
        id: 'waterTank', name: '储水与滤水', icon: '🛁', tier: 1, maxLevel: 6,
        desc: '雨布、沙层、活性炭。喝下去不拉肚子就是胜利。',
        cost: lv => ({ '建材': Math.round(12 * Math.pow(lv, 1.2)), '零件': Math.round(2 * lv) }),
        produce: lv => ({ '净水': 1.3 * lv }),
    },
    planter: {
        id: 'planter', name: '种植箱', icon: '🌱', tier: 1, maxLevel: 6,
        desc: '阳台上的六个塑料箱。豆芽、葱、生菜，长得比想象中快。',
        cost: lv => ({ '建材': Math.round(10 * Math.pow(lv, 1.2)), '食物': Math.round(3 * lv) }),
        produce: lv => ({ '食物': 1.1 * lv }),
    },
    medkit: {
        id: 'medkit', name: '家庭药箱', icon: '🧰', tier: 1, maxLevel: 6,
        desc: '碘伏、绷带、退烧药，外加一本手抄的急救笔记。药品是硬通货：' +
            '想往高里升级，光是备货就够你跑好几趟，还得有器械和单独的存放条件。',
        /* 成本随等级递增（药品是这条线的瓶颈）：Lv1 便宜，越往上越贵 */
        cost: lv => ({
            '药品': Math.round(9 * Math.pow(lv, 1.45)),
            '零件': Math.round(4 * Math.pow(lv, 1.25)),
            '建材': Math.round(6 * lv),
        }),
        /* 升级前置：越往上越苛刻 */
        reqAt: [
            { level: 3, req: [['toolbox', 2]] },
            { level: 5, req: [['storeroom', 3]] },
        ],
        effect: lv => ({ moraleRate: 0.04 * lv }),
    },
    toolbox: {
        id: 'toolbox', name: '工具角', icon: '🧲', tier: 1, maxLevel: 6,
        desc: '电钻、扳手、一箱螺丝。修东西的人心里有底。',
        cost: lv => ({ '零件': Math.round(6 * Math.pow(lv, 1.2)), '建材': Math.round(5 * lv) }),
        effect: lv => ({ buildCost: -0.05 * lv, defenseFlat: 2 * lv }),
    },
    camera: {
        id: 'camera', name: '监控与门铃', icon: '📹', tier: 1, maxLevel: 4,
        desc: '楼道、电梯口、大门外各一个。提前十秒知道谁来，就多十秒准备。',
        cost: lv => ({ '零件': Math.round(10 * Math.pow(lv, 1.3)), '建材': Math.round(4 * lv) }),
        effect: lv => ({ warning: 1.5 * lv, defenseFlat: 3 * lv }),
    },
    generator: {
        id: 'generator', name: '燃油发电机', icon: '🔌', tier: 1, maxLevel: 6,
        desc: '轰隆隆响一整晚，但所有设施都能转起来。',
        cost: lv => ({ '零件': Math.round(14 * Math.pow(lv, 1.3)), '建材': Math.round(8 * lv) }),
        effect: lv => ({ facilityProd: 0.15 * lv }),
        power: lv => 0.5 * lv,
    },
    wall: {
        id: 'wall', name: '围墙', icon: '🧱', tier: 2, maxLevel: 8,
        desc: '水泥墩加铁丝网，圈出一块「里面」。',
        cost: lv => ({ '建材': Math.round(30 * Math.pow(lv, 1.25)), '零件': Math.round(5 * lv) }),
        effect: lv => ({ defenseFlat: 15 * lv }),
    },
    tower: {
        id: 'tower', name: '哨塔', icon: '🗼', tier: 2, maxLevel: 6,
        desc: '两个人轮班，看得见围墙外面的东西。',
        cost: lv => ({ '建材': Math.round(24 * Math.pow(lv, 1.25)), '零件': Math.round(8 * lv) }),
        effect: lv => ({ defenseFlat: 8 * lv, warning: 2 * lv }),
    },
    farm: {
        id: 'farm', name: '农田', icon: '🌾', tier: 2, maxLevel: 8,
        desc: '把院子里的草皮全翻了。第一批青菜出来那天，整个据点都在笑。',
        cost: lv => ({ '建材': Math.round(18 * Math.pow(lv, 1.2)), '食物': Math.round(6 * lv) }),
        produce: lv => ({ '食物': 3.5 * lv }),
        req: [['planter', 2]],
    },
    purifier: {
        id: 'purifier', name: '净水装置', icon: '🚰', tier: 2, maxLevel: 8,
        desc: '反渗透膜加紫外线灯。水的问题解决一半，人就活下来一半。',
        cost: lv => ({ '建材': Math.round(20 * Math.pow(lv, 1.2)), '零件': Math.round(6 * lv) }),
        produce: lv => ({ '净水': 3.6 * lv }),
        power: lv => 0.35 * lv,
        req: [['waterTank', 2]],
    },
    clinic: {
        id: 'clinic', name: '医疗站', icon: '⛑️', tier: 2, maxLevel: 6,
        desc: '一张手术床、一台旧无影灯。有人受伤时，这里比围墙重要。',
        cost: lv => ({ '建材': Math.round(26 * Math.pow(lv, 1.2)), '药品': Math.round(8 * lv) }),
        effect: lv => ({ moraleRate: 0.09 * lv, defenseFlat: 3 * lv }),
        req: [['medkit', 2]],
    },
    dorm: {
        id: 'dorm', name: '宿舍', icon: '🛏️', tier: 2, maxLevel: 6,
        desc: '有床有门的地方，人才愿意留下。',
        cost: lv => ({ '建材': Math.round(24 * Math.pow(lv, 1.2)), '零件': Math.round(4 * lv) }),
        effect: lv => ({ residentCap: 0.2 * lv, moraleRate: 0.05 * lv }),
    },
    workshop: {
        id: 'workshop', name: '工坊', icon: '🛠️', tier: 3, maxLevel: 6,
        desc: '拆一台坏发电机，能凑出三台好水泵的零件。',
        cost: lv => ({ '建材': Math.round(40 * Math.pow(lv, 1.25)), '零件': Math.round(14 * lv) }),
        produce: lv => ({ '零件': 1.3 * lv }),
        effect: lv => ({ buildCost: -0.06 * lv }),
        power: lv => 0.4 * lv,
        req: [['toolbox', 3]],
    },
    traps: {
        id: 'traps', name: '陷阱区', icon: '🪤', tier: 3, maxLevel: 6,
        desc: '铁丝、深坑、削尖的钢管。让它们死在走到墙下之前。',
        cost: lv => ({ '建材': Math.round(34 * Math.pow(lv, 1.25)), '弹药': Math.round(3 * lv) }),
        effect: lv => ({ raidPower: -0.06 * lv, defenseFlat: 5 * lv }),
    },
    greenhouse: {
        id: 'greenhouse', name: '温室', icon: '🏡', tier: 3, maxLevel: 6,
        desc: '玻璃棚加补光灯，冬天也能出菜。核冬天的灰盖不住它太久。',
        cost: lv => ({ '建材': Math.round(45 * Math.pow(lv, 1.2)), '零件': Math.round(12 * lv) }),
        produce: lv => ({ '食物': 5 * lv }),
        effect: lv => ({ farm: { prod: 0.08 * lv } }),
        power: lv => 0.6 * lv,
        req: [['farm', 3]],
    },
    radar: {
        id: 'radar', name: '雷达站', icon: '📡', tier: 3, maxLevel: 5,
        desc: '监听电台、捕捉动静。什么时候来人、来多少人，心里有数。',
        cost: lv => ({ '零件': Math.round(30 * Math.pow(lv, 1.3)), '建材': Math.round(20 * lv) }),
        effect: lv => ({ warning: 3 * lv, eventRate: -0.08 * lv }),
        power: lv => 0.5 * lv,
        req: [['camera', 2]],
    },
    armory: {
        id: 'armory', name: '军械库', icon: '🔫', tier: 4, maxLevel: 6,
        desc: '枪架上锁，子弹清点。有人守着的地方，才叫据点。',
        cost: lv => ({ '建材': Math.round(60 * Math.pow(lv, 1.25)), '弹药': Math.round(10 * lv) }),
        effect: lv => ({ combatPowerFlat: 8 * lv, defenseFlat: 10 * lv }),
    },
    powerStation: {
        id: 'powerStation', name: '发电站', icon: '⚡', tier: 4, maxLevel: 6,
        desc: '把整栋楼的线路接到一台大机器上。灯亮着，人心就稳。',
        cost: lv => ({ '零件': Math.round(50 * Math.pow(lv, 1.3)), '建材': Math.round(40 * lv) }),
        effect: lv => ({ facilityProd: 0.2 * lv, powerUse: -0.1 * lv }),
        power: lv => 1.0 * lv,
        req: [['generator', 4]],
    },
};
const FACILITIES_ORDER = [
    'doorReinforce', 'fence', 'storeroom', 'solarPanel', 'waterTank', 'planter',
    'medkit', 'toolbox', 'camera', 'generator',
    'wall', 'tower', 'farm', 'purifier', 'clinic', 'dorm',
    'workshop', 'traps', 'greenhouse', 'radar',
    'armory', 'powerStation',
];

/* 据点：越往后越大，能建的设施也越多 */
const BASES_CONFIG = [
    {
        id: 'apartment', name: '顶层公寓', icon: '🏢', tier: 1, defense: 4, residentCap: 3,
        tiers: [1], perk: '高层视野：预警略微提前。',
        desc: '十二层，一梯两户。门是防盗门，窗外面是三十米的高度。',
        moveCost: null, req: null,
    },
    {
        id: 'compound', name: '小区物业楼', icon: '🏬', tier: 2, defense: 12, residentCap: 9,
        tiers: [1, 2], perk: '有院墙与两个出入口，能停得下三辆车。',
        desc: '两层小楼带院子，一楼是物业仓库，地下室堆着消防器材。',
        moveCost: { '建材': 140, '零件': 35 }, req: { hours: 96 },
    },
    {
        id: 'school', name: '实验中学', icon: '🏫', tier: 3, defense: 24, residentCap: 18,
        tiers: [1, 2, 3], perk: '自带围墙与操场：防御基础更高，能种地。',
        desc: '围墙三米高，食堂、宿舍、体育馆一应俱全。位置在城郊，离补给点远一点。',
        moveCost: { '建材': 340, '零件': 90, '食物': 60 }, req: { hours: 240, raidsWon: 2 },
    },
    {
        id: 'bunker', name: '城郊避难所', icon: '🛡️', tier: 4, defense: 42, residentCap: 36,
        tiers: [1, 2, 3, 4], perk: '混凝土结构：恶性事件强度额外 -10%。',
        desc: '半地下的防空设施，铁门有半米厚。上一世有人在这里活到了第九个月。',
        moveCost: { '建材': 700, '零件': 210, '食物': 160, '弹药': 40 },
        req: { hours: 480, raidsWon: 4, rebirth: 1 },
        raidPower: -0.1,
    },
];
