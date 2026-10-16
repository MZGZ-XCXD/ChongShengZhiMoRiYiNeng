/* 随机事件（纯数据）
   cond 是「出场条件」——按避坑清单的规矩：出场条件一律用仓储上限之类的天花板判断，
   而不是「你现在手里有多少」；选项能不能点才看当前资源。 */
const EVENTS_CONFIG = [
    {
        id: 'neighbourHelp', name: '邻居求助', icon: '🚪', phases: ['pre'], weight: 10,
        text: '402 的女主人抱着孩子站在门口，说家里的奶粉和退烧药都用完了，想问你借一点。',
        choices: [
            { text: '给她食物与药品', tip: '消耗 食物 8、药品 3。好感与士气提升，日后她会还你。', cost: { '食物': 8, '药品': 3 }, morale: 6, value: 3, gain: { '食物': 5 }, result: '她走的时候连说了三遍谢谢。第二天门口多了一袋米。' },
            { text: '只给她一点食物', tip: '消耗 食物 4。', cost: { '食物': 4 }, morale: 2, result: '她抱着孩子下楼，脚步很轻。' },
            { text: '关门', tip: '什么都不给。士气 -4。', morale: -4, result: '门关上之后，楼道里安静了很久。' },
        ],
    },
    {
        id: 'hiddenCache', name: '被钉死的木箱', icon: '📦', phases: ['pre'], weight: 8,
        cond: s => ResourcesManager.spaceCap(s) >= 240,
        text: '楼道尽头有个被钉死的木箱，以前堆着装修剩料。钉子已经锈了——里面可能有东西，也得有地方放。',
        choices: [
            { text: '撬开，全装进空间', tip: '需要空间容量 ≥ 240 格。获得建材与零件。', gain: { '建材': 24, '零件': 10 }, crystal: 1, result: '箱子里是前任房客存的整箱五金，还有一卷全新的防水布。' },
            { text: '只拿走轻的', tip: '拿一点，不占地方。', gain: { '零件': 6 }, result: '你挑了最值钱的几样带走。' },
            { text: '不动它', tip: '维持现状。', result: '你把钉子和箱子一起留在了那里。' },
        ],
    },
    {
        id: 'thugs', name: '过路费', icon: '🕶️', phases: ['pre'], weight: 9, once: true,
        bond: 'huangsan',
        text: '街口站着七八个人，为首的那个把手插在兜里，笑得很客气。',
        choices: [
            { text: '用现金打发他', tip: '消耗 现金 600，好感 +10。', cost: { '现金': 600 }, value: 10, meet: 'huangsan', result: '"痛快。"他拍了拍你的肩，"以后这条街给你留着。"' },
            { text: '直接动手', tip: '一场硬仗。赢了能拿东西，输了要吃亏。', battle: 'huangsan', value: -15, meet: 'huangsan', result: '你把最近的那个人先撂倒，剩下的往后退了两步。' },
            { text: '转身绕路', tip: '避开，但他们会盯着你。', value: -5, meet: 'huangsan', morale: -2, result: '你听见身后有人吹了声口哨。' },
        ],
    },
    {
        id: 'rushShopping', name: '超市抢购', icon: '🛒', phases: ['pre'], weight: 9,
        text: '货架前排了两条长队，有人在为一箱矿泉水推搡。收银员的喊声完全被淹没了。',
        choices: [
            { text: '挤进去，抢一批', tip: '获得物资，但会受伤（药品 -4）。', gain: { '食物': 18, '净水': 16 }, cost: { '药品': 4 }, morale: -3, result: '你的手背被人用购物车刮出一道口子，但推车里装满了。' },
            { text: '去后面仓库看看', tip: '绕过人群：收获少但更稳。', gain: { '食物': 8, '建材': 6 }, value: 0, result: '后门的仓库门没锁。你拿走了两箱罐头和几块木板。' },
            { text: '不凑这个热闹', tip: '什么都不做。', result: '你转身走了，身后传来玻璃碎的声音。' },
        ],
    },
    {
        id: 'blackmarket', name: '巷子里的交易', icon: '🧥', phases: ['pre'], weight: 7,
        cond: s => GameState.space.crystals >= 0,
        text: '一个穿风衣的人在巷子里等你，"听说你在收东西。我有别人没有的。"他打开箱子，里面是几颗会反光的石头。',
        choices: [
            { text: '把结晶全买下来', tip: '消耗 现金 2000，获得异能结晶 ×3。', cost: { '现金': 2000 }, crystal: 3, result: '石头在你手里微微发烫。你的空间，好像又往外撑了一点。' },
            { text: '只买一颗', tip: '消耗 现金 900，获得异能结晶 ×1。', cost: { '现金': 900 }, crystal: 1, result: '他把箱子合上，"剩下的留给识货的人。"' },
            { text: '不买', tip: '现金留着更实在。', result: '"随你。"风衣消失在巷子拐角。' },
        ],
    },
    {
        id: 'blackout', name: '整栋楼停电', icon: '🔌', phases: ['pre'], weight: 8,
        text: '晚上九点，走廊灯全灭。有人在台阶上摔了一跤，骂声从一楼传到十二楼。',
        choices: [
            { text: '用储能给楼道应急灯供电', tip: '消耗 燃料 6，士气 +6。', cost: { '燃料': 6 }, morale: 6, result: '应急灯亮起来的时候，楼道里有人鼓掌。' },
            { text: '趁黑把车里的东西搬完', tip: '获得物资，但危险度上升。', gain: { '建材': 10, '燃料': 6 }, danger: 0.1, result: '黑暗里没人看见你搬了多少趟。' },
            { text: '锁门睡觉', tip: '什么都不做。', result: '你听着外面的动静躺下，一直没有睡着。' },
        ],
    },
    {
        id: 'strayDog', name: '流浪狗', icon: '🐕', phases: ['pre', 'outbreak'], weight: 6,
        text: '一条瘦得看得见肋骨的狗在翻垃圾桶。它抬起头看了看你，没有跑。',
        choices: [
            { text: '喂它一顿，带回去', tip: '消耗 食物 5，士气 +8。它以后会帮着看门。', cost: { '食物': 5 }, morale: 8, temp: { name: '看门狗', effect: { warning: 1 }, hours: 336 }, result: '它跟在你身后三步远的位置，一直跟到了门口。' },
            { text: '赶走它', tip: '士气 -2。', morale: -2, result: '它钻回了垃圾桶后面。' },
        ],
    },
    {
        id: 'rumor', name: '谣言四起', icon: '📢', phases: ['pre'], weight: 7,
        text: '小区群里有人发了一段视频，说城西出现了"咬人的人"。十分钟后消息被撤回了，但截图已经在各个楼栋传开。',
        choices: [
            { text: '在群里发一份实在的准备清单', tip: '士气 +8，但会暴露你在囤东西。', morale: 8, danger: 0.05, result: '清单被转发了十几次。有人在楼下问你是不是做安防的。' },
            { text: '潜水，闷声自己干', tip: '不被注意。', result: '你什么都没说，继续把东西往上搬。' },
            { text: '趁机低价收购邻居的存货', tip: '获得物资，士气 -6。', gain: { '食物': 12, '建材': 8 }, morale: -6, value: -3, result: '你用三折的价钱买下了四户人的囤货。有人在你背后说了句什么。' },
        ],
    },
    {
        id: 'carAlarm', name: '响个不停的车', icon: '🚨', phases: ['pre', 'outbreak', 'apocalypse'], weight: 7,
        text: '楼下一辆车的警报器每隔几分钟就响一次。车主不见踪影。',
        choices: [
            { text: '把电池拆了', tip: '消耗 零件 2，消除隐患。', cost: { '零件': 2 }, morale: 3, result: '安静下来之后，整栋楼的人似乎都松了口气。' },
            { text: '顺手把车里的东西拿了', tip: '获得燃料与零件，但危险度上升。', gain: { '燃料': 8, '零件': 5 }, danger: 0.12, result: '后备箱里有一桶油和一个千斤顶。' },
            { text: '别管', tip: '什么都不做。', result: '那声音响了整夜。' },
        ],
    },
    {
        id: 'checkpoint', name: '临时检查站', icon: '🚧', phases: ['pre'], weight: 6,
        text: '路口架起了铁马，两个穿制服的人把一辆车拦下来检查。有人小声说，是在查"传播谣言的人"。',
        choices: [
            { text: '配合检查，顺便打听消息', tip: '消耗 时间不多，获得情报与一点点好感。', value: 4, morale: 3, result: '他们告诉你：出城的路已经在堵了。' },
            { text: '从旁边的小路绕过去', tip: '不惹麻烦。', result: '小路坑洼，轮胎上多了一圈泥。' },
        ],
    },
    /* ---------------- 爆发与末日阶段 ---------------- */
    {
        id: 'heiress', name: '带球杆的女孩', icon: '👱‍♀️', phases: ['outbreak', 'apocalypse'], weight: 8, once: true,
        bond: 'anqi',
        text: '别墅区的一栋房子亮着灯。门口站着一个女孩，手里举着高尔夫球杆，身后是整面墙的酒。',
        choices: [
            { text: '告诉她钱已经不值钱了', tip: '用物资换她的车库。', gain: { '食物': 20, '燃料': 10 }, value: 10, meet: 'anqi', result: '她愣了很久，把车库钥匙扔给了你。' },
            { text: '答应带她走', tip: '好感 +12，她带资源加入。', value: 12, morale: 3, meet: 'anqi', result: '她带了三箱酒、两台发电机和一整面墙的唱片。' },
            { text: '不理会，只拿走车库的东西', tip: '获得物资，好感 -18。', gain: { '燃料': 20, '零件': 12 }, value: -18, meet: 'anqi', result: '搬完最后一箱时，车库门在你身后缓缓关上。' },
        ],
    },
    {
        id: 'trainer', name: '体育馆里的口令声', icon: '🎖️', phases: ['outbreak', 'apocalypse'], weight: 8, once: true,
        bond: 'lutie',
        text: '体育馆里亮着一排应急灯，十几个活人排成一列在练劈砍。一个男人站在中间喊口令。',
        choices: [
            { text: '留下来跟着练', tip: '获得长期战力增益。', value: 15, meet: 'lutie', temp: { name: '陆铁的训练', effect: { combatPower: 0.25, defenseFlat: 10 }, hours: 96 }, crystal: 2, result: '第三天早上，你握刀的姿势已经不一样了。' },
            { text: '请他带人去据点', tip: '好感 +10，士气 +5。', value: 10, morale: 5, meet: 'lutie', result: '"我这儿有九个人。"他说，"你那儿管饭吗？"' },
            { text: '只是换些弹药', tip: '消耗 食物 20，获得弹药。', cost: { '食物': 20 }, gain: { '弹药': 18 }, value: 4, meet: 'lutie', result: '他把子弹一颗颗数给你。' },
        ],
    },
    {
        id: 'mechanic', name: '车底下的两条腿', icon: '🧑‍🔧', phases: ['outbreak', 'apocalypse'], weight: 8, once: true,
        bond: 'oldk',
        text: '修车铺里，一辆拆了一半的面包车底下露出两只沾满油泥的鞋。"别踩油管。"',
        choices: [
            { text: '请他跟你回据点', tip: '好感 +12，立刻获得零件。', value: 12, gain: { '零件': 16 }, meet: 'oldk', result: '他把工具箱往肩上一扛。' },
            { text: '请他先帮你修设施', tip: '工具角 +1 级。', value: 8, facility: { toolbox: 1 }, meet: 'oldk', result: '半天之后，你的工具角变成了一个像样的修理间。' },
            { text: '只换零件', tip: '消耗 食物 15，获得零件。', cost: { '食物': 15 }, gain: { '零件': 20 }, value: 4, meet: 'oldk', result: '他把零件按大小排好递给你。' },
        ],
    },
    {
        id: 'courier', name: '送不出去的包裹', icon: '🛵', phases: ['outbreak', 'apocalypse'], weight: 8, once: true,
        bond: 'xiaoma',
        text: '一个穿着橙色工服的年轻人坐在电动车上发呆，后座绑着三十几个包裹。',
        choices: [
            { text: '拆包裹，人也带走', tip: '获得杂货，好感 +10。', gain: { '食物': 14, '净水': 10, '药品': 4 }, value: 10, meet: 'xiaoma', result: '三十七个包裹里，有三瓶酒和两盒巧克力。' },
            { text: '让他到据点当跑腿', tip: '好感 +12，建立长期协助。', value: 12, morale: 3, meet: 'xiaoma', result: '他骑着车在前面带路，嘴里一直说哪儿能进去。' },
            { text: '不理会', tip: '好感 0。', value: 0, meet: 'xiaoma', result: '他把头盔戴上，继续往前骑。' },
        ],
    },
    {
        id: 'icegirl', name: '冻住的巷子', icon: '🧊', phases: ['outbreak', 'apocalypse'], weight: 7, once: true,
        bond: 'baimanman',
        text: '整条巷子的墙面结着厚厚的冰。巷口站着一个瘦小的女孩，手里的冰锥没有放下。',
        choices: [
            { text: '把武器放下，慢慢退后', tip: '好感 +15。', value: 15, meet: 'baimanman', result: '"你身上有很怪的味道。"她说。' },
            { text: '展示自己的异能', tip: '好感 +12，获得结晶。', value: 12, crystal: 3, meet: 'baimanman', result: '"你也觉醒了？"她的眼睛第一次亮起来。' },
            { text: '趁她分神动手', tip: '好感 -25，可能变成敌人。', value: -25, outcome: 'enemy', meet: 'baimanman', result: '你刚侧身，脚踝就冻在了地上。' },
        ],
    },
    {
        id: 'wanderDoc', name: '废墟里的缝合', icon: '🧑‍⚕️', phases: ['apocalypse'], weight: 7, once: true,
        bond: 'fangdoctor',
        text: '一个人在倒塌的药店门口给陌生人缝合伤口，旁边放着一个旧背包。',
        choices: [
            { text: '等他做完，请他吃饭', tip: '好感 +12，士气 +5。', value: 12, morale: 5, meet: 'fangdoctor', result: '他吃得很慢，"我三个月没吃过热的了。"' },
            { text: '请他到据点常驻', tip: '医疗站 +1 级，好感 +10。', value: 10, facility: { clinic: 1 }, meet: 'fangdoctor', result: '他把包放在医疗站门口。' },
            { text: '问他药品从哪来', tip: '获得药品，好感 +3。', value: 3, gain: { '药品': 6 }, meet: 'fangdoctor', result: '他指了个方向，"那边药房还有半层没被翻。"' },
        ],
    },
    {
        id: 'loner', name: '二十七层的钓鱼人', icon: '🕶️', phases: ['apocalypse'], weight: 6, once: true,
        bond: 'guchangan',
        cond: s => PlayerManager.combatPower(s) >= 30,
        text: '一整栋楼只有一间房亮着灯。阳台上坐着一个人，把鱼线垂到十几层楼下的水面上。',
        choices: [
            { text: '上去见他', tip: '好感 +8，获得结晶。', value: 8, crystal: 3, meet: 'guchangan', result: '"第二个觉醒空间异能的人。"他没有回头，"有意思。"' },
            { text: '提出结盟', tip: '消耗 食物 30，好感 +10。', cost: { '食物': 30 }, value: 10, meet: 'guchangan', result: '他收下食物，随手把身后的水泥墩抬起来又放下。' },
            { text: '退出去', tip: '安全，但错过一个强援。', value: 0, meet: 'guchangan', result: '你退到电梯口时，整栋楼晃了一下。' },
        ],
    },
    {
        id: 'knock', name: '敲门声', icon: '✊', phases: ['outbreak', 'apocalypse'], weight: 10,
        text: '门外有人敲门，三下一停。声音不大，但很执拗。',
        choices: [
            { text: '开门，看看是谁', tip: '可能是幸存者，也可能是别的东西。', gain: { '食物': 6 }, morale: 2, value: 4, result: '是两个饿得走不动路的学生。他们给你带来了一小块空投的饼干包装。' },
            { text: '隔着门问话', tip: '安全地了解情况，不消耗资源。', morale: 1, result: '"我们没恶意……"门外的声音越来越小，最后只剩下脚步声。' },
            { text: '不开门', tip: '不冒险。士气 -3。', morale: -3, result: '敲门声停了。你把耳朵贴在门上听了很久。' },
        ],
    },
    {
        id: 'supplyDrop', name: '空投', icon: '🪂', phases: ['outbreak', 'apocalypse'], weight: 6,
        text: '天上有运输机飞过，一个降落伞落在几百米外的空地。落点附近已经有几辆车在往那边开。',
        choices: [
            { text: '抢在别人前面去取', tip: '获得大量物资，危险度上升。', gain: { '食物': 22, '净水': 20, '药品': 8, '弹药': 10 }, danger: 0.2, crystal: 2, result: '你比所有人都快了一步，箱子里是标准配给的压缩口粮和净水片。' },
            { text: '等别人抢完再去捡剩下的', tip: '收获小，但安全。', gain: { '食物': 6, '零件': 4 }, result: '地上只剩空箱子，但夹层里还有几包没被发现的饼干。' },
            { text: '不去', tip: '避开冲突。', result: '半小时后那边传来了砰砰的声音。' },
        ],
    },
    {
        id: 'zombieNest', name: '楼道里的声响', icon: '🧟', phases: ['outbreak', 'apocalypse'], weight: 9,
        dooms: ['zombie'], danger: 0.15,
        text: '楼上的房间里有东西在反复撞门。声音不大，但节奏很规律。',
        choices: [
            { text: '清掉它，把房间翻一遍', tip: '一场战斗，赢了有物资。', battle: 'nest', gain: { '食物': 14, '药品': 6 }, crystal: 1, result: '房间里的东西曾经也是个人。你把他搬到了楼梯间，然后开始翻柜子。' },
            { text: '封住这层楼梯', tip: '消耗 建材 12，降低后续危险。', cost: { '建材': 12 }, morale: 3, temp: { name: '封住的楼梯', effect: { defenseFlat: 12 }, hours: 120 }, result: '你用钢筋和木板把这层彻底封死了。' },
            { text: '装作没听见', tip: '什么都不做，危险度上升。', danger: 0.12, morale: -4, result: '那声音持续到半夜才停。' },
        ],
    },
    {
        id: 'raiderScout', name: '墙外的脚步声', icon: '🔭', phases: ['apocalypse'], weight: 9,
        text: '哨塔上的人报告：围墙外面有三个人在来回走，已经看了十几分钟。',
        choices: [
            { text: '开灯，让他们看清这里有多少人', tip: '消耗 燃料 8，吓退侦察者。', cost: { '燃料': 8 }, morale: 3, temp: { name: '示强的灯光', effect: { raidPower: -0.08 }, hours: 96 }, result: '一排探照灯扫过去，三个人影退进了黑暗。' },
            { text: '悄悄派人在外面埋伏', tip: '一场战斗，赢了能拿到他们的东西。', battle: 'scout', gain: { '弹药': 12, '零件': 8 }, crystal: 2, result: '你的人在围墙外的排水沟里等了两个小时。' },
            { text: '不管他们', tip: '什么都不做。', danger: 0.1, result: '他们看够了就走了，但你的布防已经被数清楚了。' },
        ],
    },
    {
        id: 'trader', name: '过路商队', icon: '🐎', phases: ['outbreak', 'apocalypse'], weight: 8,
        text: '三辆改装过的皮卡停在围墙外，车上堆着货。领头的举着一块写着"换东西"的木板。',
        choices: [
            { text: '用食物换弹药', tip: '消耗 食物 30，获得弹药 20。', cost: { '食物': 30 }, gain: { '弹药': 20 }, value: 3, result: '他数得很快，递子弹的时候还送你一个弹匣。' },
            { text: '用零件换药品', tip: '消耗 零件 25，获得药品 20。', cost: { '零件': 25 }, gain: { '药品': 20 }, value: 3, result: '药盒上的字被水浸过，但里面的东西是干的。' },
            { text: '用结晶换情报', tip: '消耗 异能结晶 2，得到一份城北势力图。', crystal: -2, temp: { name: '城北情报', effect: { warning: 3, raidPower: -0.06 }, hours: 168 }, result: '他画图的手很稳，看得出来走过很多地方。' },
            { text: '不交易，注意警戒', tip: '什么都没换。', morale: -1, result: '商队走了，轮子在土路上留下很深的印子。' },
        ],
    },
    {
        id: 'coldSnap', name: '寒潮', icon: '❄️', phases: ['outbreak', 'apocalypse'], weight: 8,
        dooms: ['frost'],
        text: '气温一夜之间掉了十几度。水管冻裂，屋里呼出的气在灯下是白的。',
        choices: [
            { text: '把所有燃料拿去取暖', tip: '消耗 燃料 20，士气 +8。', cost: { '燃料': 20 }, morale: 8, result: '屋里终于暖起来了。有人把湿袜子挂在灯上烤。' },
            { text: '只烧一半，剩下的留着', tip: '消耗 燃料 10，士气 -3。', cost: { '燃料': 10 }, morale: -3, result: '半夜有人被冻醒，往火堆边挪了挪。' },
        ],
    },
    {
        id: 'floodSurge', name: '水位又涨了', icon: '🌊', phases: ['outbreak', 'apocalypse'], weight: 8,
        dooms: ['flood'],
        text: '早上起来，围墙外面的水又高了一掌。一楼的仓库开始渗水。',
        choices: [
            { text: '加固地基，把货物垫高', tip: '消耗 建材 30，防御不受影响。', cost: { '建材': 30 }, morale: 4, result: '一整天所有人都在搬东西、垒砖头。' },
            { text: '先把货搬走，地基以后再说', tip: '不消耗建材，但防线受损。', temp: { name: '渗水的地基', effect: { defenseFlat: -18 }, hours: 144 }, morale: -4, result: '水从裂缝里渗进来，留下一条长长的水印。' },
        ],
    },
    {
        id: 'mutantBeast', name: '变异兽', icon: '🐻', phases: ['outbreak', 'apocalypse'], weight: 8,
        dooms: ['nuclear'],
        text: '一头长着多余关节的野兽在围墙外绕圈，它的眼睛里有反光。',
        choices: [
            { text: '用陷阱和子弹解决它', tip: '消耗 弹药 12，获得食物与结晶。', cost: { '弹药': 12 }, gain: { '食物': 40 }, crystal: 3, result: '它倒下的时候还在动。肉不能吃，但皮和骨头有用。' },
            { text: '把它引到别处', tip: '不消耗弹药，但危险度上升。', danger: 0.15, morale: -2, result: '你用扩音器把它引向了城东，那边有人。' },
        ],
    },
    {
        id: 'orphan', name: '躲在货架后面的孩子', icon: '🧒', phases: ['outbreak', 'apocalypse'], weight: 7,
        text: '搜刮的时候，货架后面动了一下。一个七八岁的孩子抱着半袋饼干，缩在角落里发抖。',
        choices: [
            { text: '带他回据点', tip: '消耗 食物 15，士气 +10，但食物消耗上升。', cost: { '食物': 15 }, morale: 10, temp: { name: '多了一张嘴', effect: { foodUse: 0.08, moraleRate: 0.04 }, hours: 336 }, result: '他一路上都没说话，到了据点门口才小声说："谢谢。"' },
            { text: '给他留点吃的就走', tip: '消耗 食物 6，士气 +3。', cost: { '食物': 6 }, morale: 3, result: '你把食物放在地上，退出去关上了门。' },
            { text: '当作没看见', tip: '士气 -6。', morale: -6, result: '你搬完东西离开时，货架后面已经没有动静了。' },
        ],
    },
    {
        id: 'convoy', name: '废弃车队', icon: '🚚', phases: ['outbreak', 'apocalypse'], weight: 8,
        text: '高速匝道上堵着一列车，有几辆还盖着军绿色的篷布。车里早就没人了。',
        choices: [
            { text: '翻掉整列车队', tip: '获得大量物资，危险度高。', gain: { '燃料': 24, '建材': 26, '弹药': 12, '零件': 14 }, danger: 0.18, crystal: 2, result: '第四辆车的篷布下面是一整箱军用口粮。' },
            { text: '只拿最上面的', tip: '收获小，风险低。', gain: { '燃料': 8, '零件': 6 }, result: '你搬了两趟就撤了。' },
        ],
    },
    {
        id: 'betrayerWord', name: '熟悉的名字', icon: '📻', phases: ['outbreak'], weight: 7,
        text: '收音机里的杂音中间，有个声音在念一份名单，说这些人"占领了城北的仓库"。名单里有陈默。',
        choices: [
            { text: '记下频点和时间', tip: '获得情报，为之后的事做准备。', crystal: 2, temp: { name: '名单上的频点', effect: { warning: 2 }, hours: 120 }, result: '你把频点写在墙上，用红笔圈了三遍。' },
            { text: '关掉收音机', tip: '不想再听。士气 +2。', morale: 2, result: '屋子里安静下来，只有发电机的声音。' },
        ],
    },
    {
        id: 'healerRequest', name: '抬进来的人', icon: '🩸', phases: ['apocalypse'], weight: 8,
        text: '两个人抬着一个伤员到门口，说是在外面被咬了，"求你们，他有药就能活。"',
        choices: [
            { text: '收留并治疗', tip: '消耗 药品 18，士气 +6，可能多一个帮手。', cost: { '药品': 18 }, morale: 6, value: 6, crystal: 1, result: '三天后他能下地了，第一件事是去帮着搬砖。' },
            { text: '只给一点药，让他们另找地方', tip: '消耗 药品 8，士气 +1。', cost: { '药品': 8 }, morale: 1, result: '他们把伤员抬走了，走得很慢。' },
            { text: '关上门', tip: '士气 -8。', morale: -8, result: '门外有人开始骂，然后骂声变成了哭声。' },
        ],
    },
    {
        id: 'ransom', name: '勒索信', icon: '✉️', phases: ['apocalypse'], weight: 8,
        text: '围墙上钉着一封信：说你们据点里有个人的家人被他们带走了，限 24 小时内拿物资去换。',
        choices: [
            { text: '带人打过去', tip: '一场硬仗：赢了大涨士气。', battle: 'ransom', morale: 8, crystal: 3, result: '你带人端了他们的窝。被绑的人里有两个选择留下。' },
            { text: '付赎金', tip: '消耗 食物 60、药品 30。', cost: { '食物': 60, '药品': 30 }, morale: -4, value: 4, result: '人换回来了。他把脸埋在手里哭了很久。' },
            { text: '不理', tip: '士气 -10，好感下降。', morale: -10, value: -10, result: '第二天围墙上又多了一封信，信里是一只耳朵。' },
        ],
    },
    {
        id: 'gang', name: '占着油站的人', icon: '⛽', phases: ['pre', 'outbreak', 'apocalypse'], weight: 8, once: true,
        text: '加油站的卷帘门拉着，门口坐着五个人，两杆猎枪架在油桶上。"油是我们的。"领头的说，"想抽？拿东西换。"',
        choices: [
            { text: '用食物换油', tip: '消耗 食物 25，获得燃料。', cost: { '食物': 25 }, gain: { '燃料': 40 }, value: 4, result: '他们拿走了食物，把抽油泵的钥匙扔给你："快点，别磨蹭。"' },
            { text: '直接抢', tip: '一场硬仗：赢了能拿很多燃料。', battle: 'scout', gain: { '燃料': 60 }, value: -20, crystal: 2, result: '你把猎枪踢到油桶后面的时候，剩下的人已经跑出加油站了。' },
            { text: '不换，走人', tip: '什么都不做。', result: '你踩下油门离开，后视镜里他们还在原地坐着。' },
        ],
    },
    {
        id: 'survivorNurse', name: '五楼的值班室', icon: '🏥', phases: ['pre', 'outbreak', 'apocalypse'], weight: 8, once: true,
        text: '五楼的值班室门从里面用病床顶住了。门后有人小声说："我们是护士和伤员，一共四个人……你能帮我们把门打开吗？"',
        choices: [
            { text: '帮他们把门弄开', tip: '消耗 零件 6，获得药品与好感。', cost: { '零件': 6 }, gain: { '药品': 20, '净水': 10 }, morale: 6, value: 6, crystal: 1, result: '门开后是四个脸色发白的人，其中一个抱着还没拆封的药箱塞给你。' },
            { text: '隔门问清他们会不会给物资', tip: '现实一点：交换，不谈感情。', gain: { '药品': 12 }, value: 2, result: '他们从门缝里递出药品，说这是全部了。' },
            { text: '不管，先搜完这层', tip: '只拿药品，士气下降。', gain: { '药品': 8 }, morale: -6, result: '你搜完隔壁药房就走了。门后面一直有人在说话，声音很小。' },
        ],
    },
    /* ---------------- 仇家：抢过钱、动过手，就会有人来找你 ----------------
       这两个事件不是随机货，是「抢钱」那条路的后果，热度不够不会出现。 */
    {
        id: 'grudgeVisit', name: '有人来打听你', icon: '🚬', phases: ['outbreak', 'apocalypse'], weight: 12,
        cond: s => s.heat >= HEAT_RULES.visitAt,
        text: '围墙外面停了一辆车，下来两个人，没带家伙，说想跟你聊两句「上个月那笔账」。',
        choices: [
            { text: '赔钱了事', tip: '消耗 现金 800，仇家 -2。', cost: { '现金': 800 }, heat: -2, result: '你把钱数好递过去，他们点了两遍，说这事算了。' },
            { text: '硬顶回去', tip: '打一场：赢了仇家 -1，输了他们会记着。', battle: 'grudge', heatOnWin: -1, heatOnLose: 1, value: 0, result: '你把两个人按在墙上，其中一个说："行，我们记住了。"' },
            { text: '装听不懂', tip: '把人打发走，仇家 +1。', heat: 1, morale: -2, result: '他们笑着走了 —— 那种笑法说明还会再来。' },
        ],
    },
    {
        id: 'grudgeRaid', name: '上门清算', icon: '🚗', phases: ['apocalypse'], weight: 14,
        cond: s => s.heat >= HEAT_RULES.raidAt,
        text: '三辆车堵在路口，车灯全开着。有人拿喇叭喊你的名字，让你把「欠的东西」交出来。',
        choices: [
            { text: '带人打回去', tip: '一场硬仗：赢了大涨士气，输了据点受损。', battle: 'grudgeSquad', heatOnWin: -3, heatOnLose: 2, morale: 2, result: '你们从侧门出去绕到车后，第一辆车先着了火。' },
            { text: '交保护费', tip: '消耗 现金 1500，仇家 -3。', cost: { '现金': 1500 }, heat: -3, morale: -4, result: '钱和一部分面子一起给了出去。他们开走了，说以后每月来一次。' },
            { text: '关灯，装作没人在', tip: '士气 -6，仇家 -1，但据点里的人会失望。', heat: -1, morale: -6, result: '他们在门外骂了半个小时，最后走了。屋里没人说话。' },
        ],
    },
];
