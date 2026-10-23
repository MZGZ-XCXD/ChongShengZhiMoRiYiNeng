/* 羁绊角色（纯数据）
   相遇方式：locate.location（在该地点搜刮时遇到）或 locate.event（由随机事件引出）
   好感 value：-30 ~ 100。到 assist.at 开始提供协助；到 crossroad.at 触发关键节点。
   关键节点的选择会决定这个人最终是兄弟、伴侣、路人，还是敌人。 */
const BONDS_CONFIG = [
    {
        id: 'wangyi', name: '王姨', icon: '👩‍🍳', gender: '女', kind: 'ally',
        role: '楼下的邻居，退休食堂厨师', ability: null, phase: 'pre',
        locate: { location: 'building' },
        desc: '上一世她在楼道里敲过你的门，你没敢开。这一世她提着一锅汤站在门口。',
        gift: { res: '食物', amount: 8 }, giftLike: { res: '药品', bonus: 3 }, giftLimit: 3,
        assist: { at: 30, per: 0.1, effect: { resourceProd: { '食物': 0.2 } }, desc: '她掌勺：食物产出 +20% 起' },
        meet: {
            text: '王姨把一锅排骨汤塞进你手里，说楼下那家两口子昨晚吵到半夜，"小陈啊，最近是不是不太对劲？超市抢米的人比过年还多。"',
            choices: [
                { text: '把知道的都告诉她', tip: '如实相告：她会开始囤东西，也会帮你攒一份。', value: 12, morale: 3, result: '王姨愣了半分钟，转身就回家翻存折。第二天她拎着两袋米来找你。' },
                { text: '只说"最近是有点乱"', tip: '不多说。安全，但错过一个可靠的帮手。', value: 2, result: '她将信将疑地走了。' },
                { text: '让她赶紧回老家', tip: '劝她离开这座城市。好感 +6，但她会离开。', value: 6, outcome: 'left', result: '她红着眼睛收拾了行李。你大概不会再见到她。' },
            ],
        },
        crossroad: {
            at: 50, title: '王姨的请求',
            text: '王姨的小孙子还在城东的幼儿园。她说她一个人走不动那条路，问你借个人或者借点力气。',
            choices: [
                { text: '亲自跑一趟', tip: '消耗 食物 20、燃料 5，换回一个孩子和一个死心塌地的长辈。', cost: { '食物': 20, '燃料': 5 }, value: 25, morale: 6, crystal: 2, result: '你把孩子抱回来时，王姨在门口站了三个小时。那天晚上据点的饭特别香。' },
                { text: '给她一辆车和两桶油', tip: '消耗 燃料 10，好感 +12。', cost: { '燃料': 10 }, value: 12, result: '她开着车走了，第二天带着孩子和一车菜回来。' },
                { text: '现在去不了', tip: '拒绝。好感 -15，之后她会变得沉默。', value: -15, morale: -4, result: '她什么也没说，只是把汤锅收进了柜子。' },
            ],
        },
    },
    {
        id: 'laozhao', name: '老赵', icon: '👮', gender: '男', kind: 'ally',
        role: '小区保安，退伍侦察兵', ability: null, phase: 'pre',
        locate: { location: 'yard' },
        desc: '六十岁，守了这小区十一年。他记得每一辆车、每一个不常出门的人。',
        gift: { res: '弹药', amount: 4 }, giftLike: { res: '燃料', bonus: 3 }, giftLimit: 3,
        assist: { at: 25, per: 0.12, effect: { defenseFlat: 6, warning: 1 }, desc: '他排班守夜：防御 +6 起、预警 +1 小时' },
        fight: { at: 20, power: 14 },
        meet: {
            text: '老赵把巡逻的手电筒照在你脸上，"小伙子，你这两天买的东西不对劲——汽油、铁钉、净水片。你是不是知道什么事？"',
            choices: [
                { text: '把三天后的事说出来', tip: '说实话。他要么当你是疯子，要么跟你干。', value: 10, result: '他盯着你看了很久，然后从岗亭底下拖出一根钢管："我信你一次。"' },
                { text: '请他帮忙盯住几个出入口', tip: '不提末日，只谈安全。稳妥地建立合作。', value: 8, gain: { '零件': 4 }, result: '他答应每天替你巡两遍，还顺手给你凑了一把螺丝。' },
                { text: '敷衍过去', tip: '不招惹一个保安。', value: 0, result: '他点点头走了，手电筒的光在你背后拉得很长。' },
            ],
        },
        crossroad: {
            at: 55, title: '老赵的旧部',
            text: '老赵说他有三个老战友还留在城里，都带着家伙。"我去叫他们。但你要答应我一件事——不抢别人的东西。"',
            choices: [
                { text: '答应他，立规矩', tip: '据点防御与战力大幅提升，士气 +10。', value: 20, morale: 10, crystal: 2, temp: { name: '老赵的旧部', effect: { defenseFlat: 30, combatPowerFlat: 12 }, hours: 72 }, result: '三个人背着包来了。老赵在门口立了块木板，上面写着：不许抢，不许杀。' },
                { text: '答应，但要他们带弹药来', tip: '获得弹药，但士气略降。', value: 8, gain: { '弹药': 20 }, morale: -4, result: '他们带来了子弹，也带来了外面的脾气。' },
                { text: '不用了，人多口杂', tip: '拒绝。好感 -12。', value: -12, result: '他把手电筒关了。"行。"' },
            ],
        },
    },
    {
        id: 'zhouheng', name: '周恒', icon: '🧑‍💼', gender: '男', kind: 'ally',
        role: '便利店老板', ability: null, phase: 'pre',
        locate: { location: 'conv' },
        desc: '他把货架上的东西分成了两堆：卖的，和不卖的。不卖的那堆堆在后屋。',
        gift: { res: '食物', amount: 10 }, giftLike: { res: '现金', bonus: 4 }, giftLimit: 3,
        assist: { at: 25, per: 0.12, effect: { scavengeYield: 0.15 }, desc: '他懂货：搜刮产出 +15% 起' },
        meet: {
            text: '"别翻最上面那层，"周恒从柜台后面抬起头，"你要真打算囤东西，我告诉你哪儿还有货。仓库、批发市场，我给人送过货。"',
            choices: [
                { text: '和他互换情报', tip: '他知道城里所有的补货点。解锁两个搜刮地点。', value: 10, unlock: ['warehouse', 'gas'], result: '他掏出送货单，在背面画了张地图。' },
                { text: '用现金把存货全买下', tip: '消耗 现金 1500，换一批食物与净水。', cost: { '现金': 1500 }, gain: { '食物': 26, '净水': 26 }, value: 6, result: '他数钱的手很快，眼神却在门口。' },
                { text: '先拿点应急的', tip: '白拿一点。好感 -5。', value: -5, gain: { '食物': 10, '净水': 10 }, result: '他把东西推过来，没说话。' },
            ],
        },
        crossroad: {
            at: 55, title: '周恒的仓库',
            text: '"我把后屋的钥匙给你。"他把一把黄铜钥匙放在桌上，"里面是三个月前囤的货。条件是我妹妹要住进你那儿，她怀孕了。"',
            choices: [
                { text: '收下钥匙，也收下人', tip: '消耗 食物 30，获得大量物资与一个真心帮忙的人。', cost: { '食物': 30 }, gain: { '食物': 60, '净水': 40, '药品': 12, '零件': 10 }, value: 25, morale: 5, crystal: 2, result: '后屋的货堆到天花板。他妹妹是个会计，第二天就把据点所有东西记成了账。' },
                { text: '只收钥匙，不收人', tip: '拿货，但不加负担。好感 -8。', gain: { '食物': 50, '净水': 30 }, value: -8, result: '他把钥匙留下，人带走了。' },
                { text: '先照顾好你自己的人', tip: '什么都不要，好感 +12（他会记得）。', value: 12, crystal: 1, result: '"谢谢。"他说这两个字的时候声音有点抖。' },
            ],
        },
    },
    {
        id: 'shenxue', name: '沈雪', icon: '👩‍⚕️', gender: '女', kind: 'partner',
        role: '社区诊所护士，B 级·组织修复', ability: { tier: 'B', name: '组织修复' }, phase: 'pre',
        locate: { location: 'clinic' },
        desc: '她一个人守着小诊所，把最后一支抗生素锁在抽屉里。上一世你高烧时路过这里，门是锁着的。',
        gift: { res: '药品', amount: 6 }, giftLike: { res: '食物', bonus: 3 }, giftLimit: 3,
        assist: { at: 30, per: 0.12, effect: { moraleRate: 0.1, defenseFlat: 4 }, desc: '她管伤患：士气恢复 +0.1/小时、防御 +4 起' },
        fight: { at: 40, power: 12 },
        meet: {
            text: '"你手上这道口子不处理会发炎。"她没等你回答就拆开了棉签，"我觉得你知道点什么。你眼睛里没有那种慌。"',
            choices: [
                { text: '告诉她实情，请她一起准备', tip: '她会把诊所的药品分你一半，并答应去你的据点。', value: 12, gain: { '药品': 14 }, result: '她沉默了很久，然后开始把抽屉里的东西往外搬。' },
                { text: '请她只帮你留一批药', tip: '建立交易关系，好感较小。', value: 6, gain: { '药品': 8 }, result: '她把药装进纸袋："下次直接敲门。"' },
                { text: '不必，我不想欠人', tip: '保持距离。', value: -3, result: '她的手停了一下，把棉签丢进垃圾桶。' },
            ],
        },
        crossroad: {
            at: 60, title: '沈雪的选择',
            text: '"我哥还在城里的医院。"她把手套摘下来，"我知道回去可能回不来。但我得去。"',
            choices: [
                { text: '陪她一起去医院', tip: '消耗 弹药 15、药品 20，风险很大，但结果可能是她留下。', cost: { '弹药': 15, '药品': 20 }, value: 28, morale: 4, crystal: 3, outcome: 'partner', result: '你们在六楼的病房里找到了他——还有一整个还没被撬开的药品库。回来的车上，她一直握着你没松开。' },
                { text: '让别人去，你留下守据点', tip: '耗损小，但她的心会凉一点。', value: -10, result: '她走了三天。回来时瘦了一圈，什么也没说，只是不再叫你「医生」。' },
                { text: '劝她别去', tip: '留下人，但好感下降。', value: 5, morale: -2, result: '"你凭什么替我决定。"那天之后她的话变少了。' },
            ],
        },
    },
    {
        id: 'yanprof', name: '严教授', icon: '👴', gender: '男', kind: 'ally',
        role: '退休农学教授', ability: null, phase: 'pre',
        locate: { location: 'school' },
        desc: '他在空掉的教室里种着两盆番茄，说这是他老伴最后想吃的东西。',
        gift: { res: '食物', amount: 12 }, giftLike: { res: '现金', bonus: 4 }, giftLimit: 3,
        assist: { at: 30, per: 0.12, effect: { resourceProd: { '食物': 0.25 } }, desc: '他会种地：食物产出 +25% 起' },
        meet: {
            text: '"土壤、光照、水，就这三样。"他把手上的泥在裤子上抹了抹，"你要是真能撑过这个冬天，我给你种出一整个食堂。"',
            choices: [
                { text: '请他到据点专门管种植', tip: '好感 +12，获得种子与农具。', value: 12, gain: { '食物': 12, '建材': 6 }, result: '他把两盆番茄小心地抱上了车。' },
                { text: '问他怎么在室内种菜', tip: '学到土办法：种植箱立刻 +1 级。', value: 8, result: '他讲了两个小时，走后你照着做，阳台绿了起来。', facility: { planter: 1 } },
                { text: '只要他手里的种子', tip: '拿走种子，好感 -6。', gain: { '食物': 16 }, value: -6, result: '他给了你半袋种子，然后把剩下的藏进了讲台。' },
            ],
        },
        crossroad: {
            at: 55, title: '严教授的种子库',
            text: '"实验楼地下室有一批种子，干燥保存的。"他摊开一张手绘的图，"但我这把老骨头走不了地下三层了。"',
            choices: [
                { text: '带队下去搬', tip: '消耗 建材 40、燃料 8，换回大量食物与长期产能。', cost: { '建材': 40, '燃料': 8 }, value: 22, crystal: 3, temp: { name: '种子入库', effect: { resourceProd: { '食物': 0.3 } }, hours: 168 }, result: '十几箱种子搬上来的时候，老头子蹲在地上一箱一箱地摸。' },
                { text: '下次再去', tip: '推迟。好感 -10。', value: -10, result: '他把图纸叠好塞回口袋。' },
            ],
        },
    },
    {
        id: 'taotao', name: '陶陶', icon: '👧', gender: '女', kind: 'ally',
        role: '农庄长大的女孩，手里总有一把小刀', ability: null, phase: 'pre',
        locate: { location: 'farm' },
        desc: '十七岁，父母去城里没回来。她一个人守着农庄和一条土狗。',
        gift: { res: '食物', amount: 10 }, giftLike: { res: '药品', bonus: 3 }, giftLimit: 3,
        assist: { at: 25, per: 0.12, effect: { resourceProd: { '食物': 0.15 }, scavengeRefresh: 0.08 }, desc: '她熟路：食物 +15%、刷新更快' },
        fight: { at: 30, power: 8 },
        meet: {
            text: '她拿着柴刀站在地窖口，"这地方是我家的。"狗在她脚边龇着牙。',
            choices: [
                { text: '放下东西，慢慢说明来意', tip: '好感 +12，她会分你地窖里的东西。', value: 12, gain: { '食物': 18, '净水': 10 }, result: '她把柴刀放下，去地窖里抱出一筐土豆。' },
                { text: '提出用药品换粮', tip: '公平交易，好感 +6。', cost: { '药品': 6 }, gain: { '食物': 24 }, value: 6, result: '她挑了挑药盒，说了句"这盒还没过期"，然后把粮食堆在门口。' },
                { text: '绕开她，直接进院子', tip: '能拿到东西，但会被记住。好感 -15。', gain: { '食物': 20 }, value: -15, result: '狗叫了整夜。她站在门口看着你搬东西，一句话没说。' },
            ],
        },
        crossroad: {
            at: 55, title: '陶陶的狗',
            text: '土狗被咬了。她抱着它坐在门槛上，"它跟了我八年。你有药吗？"',
            choices: [
                { text: '把最好的药都用上', tip: '消耗 药品 15，好感 +22，士气 +5。', cost: { '药品': 15 }, value: 22, morale: 5, result: '两条腿的狗第三天就站起来了。从那以后它睡在你们据点门口。' },
                { text: '给她一半的药', tip: '尽力而为，好感 +10。', cost: { '药品': 7 }, value: 10, result: '她给狗喂了药，然后把它抱进屋里。' },
                { text: '药品要留给活人', tip: '好感 -12。', value: -12, morale: -3, result: '她点了点头，说"你说得对"，然后抱着狗走远了。' },
            ],
        },
    },
    {
        id: 'chenmo', name: '陈默', icon: '🧑', gender: '男', kind: 'betrayer',
        role: '一起长大的兄弟', ability: { tier: 'A', name: '钢筋铁骨（上一世觉醒）' }, phase: 'pre',
        locate: { location: 'building' },
        desc: '上一世，最后一次物资分配时，是他先动的手。这一世他还站在楼道里冲你笑。',
        gift: { res: '弹药', amount: 5 }, giftLike: { res: '现金', bonus: 4 }, giftLimit: 3,
        assist: { at: 40, per: 0.12, effect: { combatPowerFlat: 10, defenseFlat: 8 }, desc: '他确实能打：战力 +10、防御 +8 起' },
        fight: { at: 30, power: 22 },
        meet: {
            text: '"哥！"陈默一手搭上你的肩膀，另一只手还拎着两瓶啤酒，"我刚从城西回来，路上全是警察。你说这日子是不是要变天了？"',
            choices: [
                { text: '像上一世一样，把他当兄弟', tip: '暂时维持关系：他会给你物资，也会离你更近。', value: 10, gain: { '食物': 10, '弹药': 6 }, result: '他把啤酒塞给你，"我住 602，有事喊我。"你记得，上一世他也是这么说的。' },
                { text: '冷淡地应付过去', tip: '好感 +2，但你会让他觉得你变了。', value: 2, result: '他愣了一下，笑了笑，"行，你忙。"' },
                { text: '把话说开："离我远点"', tip: '直接翻脸。好感 -20，未来的复仇会更直接。', value: -20, morale: 3, result: '他脸上的笑僵了两秒。"……你是不是有病？"他转身上楼，脚步很重。' },
            ],
        },
        /* 陈默 / 林晴的账，在爆发阶段的主线「第四章 · 该算的账」里一次算清，
           所以这两人自己的关键节点关掉（at 设成够不到的值），相遇与送礼照常有效。 */
        crossroad: {
            at: 999, title: '陈默的邀请',
            text: '"城北有个仓库，我踩过点。"他压低声音，"我一个人搬不动。你空间那么大，一次就能装完。"听起来像上一世那句一模一样的话。',
            choices: [
                { text: '去。但这次你先动手', tip: '提前了结：获得大量物资，士气波动。', value: 0, outcome: 'enemy', gain: { '食物': 40, '弹药': 20, '建材': 30 }, morale: -6, crystal: 4, result: '仓库里确实是好货。回程的车上，他伸手去够你腰间的刀——这次你比他快了半秒。' },
                { text: '去。给他一次机会', tip: '赌他不会再来一次。结果由你们的好感决定。', value: 0, gamble: 'chenmo', crystal: 2, result: '你把装满的空间挂在腰上，把后背留给了他——这一次，他没有动手。' },
                { text: '拒绝，让他自己想办法', tip: '维持表面的兄弟，但错过一大批物资。好感 -10。', value: -10, result: '"算了。"他笑了一声，"你现在说话真难听。"' },
            ],
        },
    },
    {
        id: 'linqing', name: '林晴', icon: '👩', gender: '女', kind: 'betrayer',
        role: '上一世站在陈默那边的女人', ability: null, phase: 'pre',
        locate: { location: 'building' },
        desc: '上一世最后一夜的第三种声音。这一世她还在楼上晾衣服，见了你会笑。',
        gift: { res: '食物', amount: 6 }, giftLike: { res: '药品', bonus: 3 }, giftLimit: 3,
        assist: { at: 40, per: 0.1, effect: { bondGain: 0.15, eventRate: 0.1 }, desc: '她很会说话：好感获取 +15%' },
        meet: {
            text: '林晴从楼上探头，"你最近买的东西好奇怪呀，是不是在准备什么？"她的语气和上一世一模一样。',
            choices: [
                { text: '含糊过去', tip: '不给她任何信息。', value: 3, result: '她"哦"了一声，缩回屋里。' },
                { text: '把实情告诉她，试探反应', tip: '你在看她会不会露出什么。', value: 8, crystal: 1, result: '她的脸白了一下，随即笑起来："你别吓我。"' },
                { text: '"你离陈默远点。"', tip: '直接警告。好感 -10，但埋下一个变量。', value: -10, set: { warned: true }, result: '她张了张嘴，"你什么意思？"' },
            ],
        },
        crossroad: {
            at: 999, title: '林晴的求救',
            text: '她在对讲机里哭："陈默把我锁在屋里了，他说要拿我去换东西。你救我吗？"',
            choices: [
                { text: '去。不管上一世', tip: '救她：得到一位盟友，也可能多一个变数。', cost: { '弹药': 8 }, value: 25, outcome: 'ally', crystal: 2, result: '你砸开门的时候她坐在地上。她抓住你的袖子说："我知道他要去哪儿。"' },
                { text: '去。但要她先把上一世的事说清楚', tip: '逼问真相：获得情报与结晶，但她会怕你。', value: 10, crystal: 4, outcome: 'ally', result: '她说了半个小时。有些细节你自己都没记住。' },
                { text: '不去', tip: '让上一世的事重演一次。好感 -20，士气 -5。', value: -20, outcome: 'dead', morale: -5, result: '对讲机里的声音停了。第二天你路过 7 楼，门是开着的。' },
            ],
        },
    },
    {
        id: 'lutie', name: '陆铁', icon: '🎖️', gender: '男', kind: 'ally',
        role: '退伍教官，A 级·体质强化', ability: { tier: 'A', name: '体质强化' }, phase: 'outbreak',
        locate: { event: 'trainer' },
        desc: '他在体育馆里教一群活人怎么握刀。手法很旧，但管用。',
        gift: { res: '弹药', amount: 8 }, giftLike: { res: '食物', bonus: 4 }, giftLimit: 3,
        assist: { at: 30, per: 0.15, effect: { combatPower: 0.18, defenseFlat: 10 }, desc: '他练兵：战力 +18%、防御 +10 起' },
        fight: { at: 20, power: 32 },
        meet: {
            text: '"站直了。"他把你从门口拽进来，"你这身板，遇上三个以上的就活不了。想学就留下，不想学就走——但别在门口站着，会挡路。"',
            choices: [
                { text: '留下来练', tip: '消耗 3 天时间（世界时间照走），战力直接提升。', value: 15, temp: { name: '陆铁的训练', effect: { combatPower: 0.25, defenseFlat: 10 }, hours: 96 }, crystal: 2, result: '第三天早上你连握刀的姿势都变了。他说："行了，现在你会死得慢一点。"' },
                { text: '请他跟你回据点', tip: '好感 +10，他会带人过去。', value: 10, morale: 5, result: '"我这儿有九个人。"他说，"你那儿管饭吗？"' },
                { text: '只想换点弹药', tip: '交易关系，好感 +4。', cost: { '食物': 20 }, gain: { '弹药': 18 }, value: 4, result: '他把子弹一颗颗数给你。' },
            ],
        },
        crossroad: {
            at: 55, title: '陆铁的规矩',
            text: '"我可以把训练场搬到你这儿。"他说，"但有两条：不许丢下伤员；不许把新人当消耗品。做不到我现在就走。"',
            choices: [
                { text: '立下规矩', tip: '长期增益：战力与士气大涨，但今后食物消耗上升。', value: 22, morale: 8, crystal: 2, temp: { name: '陆铁的训练场', effect: { combatPower: 0.2, defenseFlat: 15, moraleRate: 0.06 }, hours: 240 }, result: '他把规矩刻在木牌上，钉在据点门口。第一天就有三个人来报名。' },
                { text: '答应，但只留一个月', tip: '收益较小，好感 +8。', value: 8, temp: { name: '临时训练场', effect: { combatPower: 0.1 }, hours: 96 }, result: '"一个月也行。"他开始训人。' },
                { text: '做不到，你走', tip: '好感 -15，损失一个强力角色。', value: -15, result: '他把刀插回鞘里，走了。' },
            ],
        },
    },
    {
        id: 'anqi', name: '苏晚棠', icon: '👱‍♀️', gender: '女', kind: 'ally',
        role: '富商的女儿，现金多到没处花', ability: null, phase: 'outbreak',
        locate: { event: 'heiress' },
        desc: '她家里有发电机、有存粮、有整面墙的酒。她说她爸上周坐直升机走了，没带她。',
        gift: { res: '药品', amount: 5 }, giftLike: { res: '净水', bonus: 3 }, giftLimit: 3,
        assist: { at: 25, per: 0.12, effect: { crystalGain: 0.12, eventRate: 0.1 }, desc: '她有钱也有消息：结晶收益 +12%' },
        meet: {
            text: '"你不是来抢东西的吧？"她堵在门口，手里举着一根高尔夫球杆，"我可以付钱，我有很多钱。"',
            choices: [
                { text: '告诉她钱已经不值钱了', tip: '现实一点：她会用物资换保护。', value: 10, gain: { '食物': 20, '燃料': 10 }, result: '她愣了很久，然后把车库钥匙扔给你："那这些呢？"' },
                { text: '答应保护她', tip: '好感 +12，她会搬到你的据点。', value: 12, morale: 3, result: '她带了三箱酒、两台发电机和一整面墙的唱片。' },
                { text: '顺手牵走车库里能拿的', tip: '拿东西，好感 -18。', gain: { '燃料': 20, '零件': 12 }, value: -18, result: '她站在门口看着你把东西搬上车，然后关上了车库门。' },
            ],
        },
        crossroad: {
            at: 50, title: '苏晚棠的爸爸',
            text: '"电台里有人用我爸的呼号发消息。"她拿着收音机的手在抖，"我想去那个频点回话。"',
            choices: [
                { text: '陪她发这通消息', tip: '消耗 燃料 10。结果可能是希望，也可能是打击。', cost: { '燃料': 10 }, value: 20, crystal: 3, result: '回话的是她爸的司机。她听完之后哭了一夜，第二天开始学着开卡车、修电路。' },
                { text: '让她别抱希望', tip: '更现实。好感 -8，但她会振作。', value: -8, morale: 4, result: '她把收音机收起来，"你说得对。"然后去仓库搬东西了。' },
            ],
        },
    },
    {
        id: 'oldk', name: '老K', icon: '🧑‍🔧', gender: '男', kind: 'ally',
        role: '修车工，能把任何东西拼起来', ability: null, phase: 'outbreak',
        locate: { event: 'mechanic' },
        desc: '他蹲在一辆拆了一半的面包车底下，只露出两只鞋。"别踩油管。"',
        gift: { res: '零件', amount: 8 }, giftLike: { res: '燃料', bonus: 4 }, giftLimit: 3,
        assist: { at: 25, per: 0.12, effect: { facilityProd: 0.15, buildCost: -0.06 }, desc: '他修东西：设施产出 +15%、建设成本 -6% 起' },
        meet: {
            text: '"想让我帮你改车？还是修发电机？"他从车底滑出来，"都可以，但我要零件，还要一个能锁门的房间。"',
            choices: [
                { text: '答应他，跟他回据点', tip: '好感 +12，立刻获得零件。', value: 12, gain: { '零件': 16 }, result: '他把工具箱往肩上一扛，跟在你身后走进了据点。' },
                { text: '先请他修一处设施', tip: '免费修一次设施等级 +1。', value: 8, facility: { toolbox: 1 }, result: '他花了半天，把你的工具角变成了一个像样的修理间。' },
                { text: '只是换点零件', tip: '消耗食物换零件。', cost: { '食物': 15 }, gain: { '零件': 20 }, value: 4, result: '他把零件按大小排好递给你。' },
            ],
        },
        crossroad: {
            at: 55, title: '老K的改装',
            text: '"我能给据点做一套外围电路——探照灯、电栅栏。"他摊开一张草图，"就是要的零件有点多。"',
            choices: [
                { text: '全力支持', tip: '消耗 零件 60、建材 40，换来长期防御与预警。', cost: { '零件': 60, '建材': 40 }, value: 20, crystal: 3, temp: { name: '外围电路', effect: { defenseFlat: 35, warning: 4 }, hours: 240 }, result: '第一次亮灯那晚，围墙外面的影子退了很远。' },
                { text: '先做一半', tip: '消耗 零件 25，收益较小。', cost: { '零件': 25 }, value: 10, temp: { name: '半套电路', effect: { defenseFlat: 15 }, hours: 168 }, result: '他做了前半段，尾部留了接口。' },
                { text: '以后再说', tip: '好感 -5。', value: -5, result: '"行，图我先收着。"' },
            ],
        },
    },
    {
        id: 'xiaoma', name: '小马', icon: '🛵', gender: '男', kind: 'ally',
        role: '快递员，跑遍过这座城市的每一栋楼', ability: null, phase: 'outbreak',
        locate: { event: 'courier' },
        desc: '他还穿着那身橙色工服，电动车后座绑着三十几个没送出去的包裹。',
        gift: { res: '食物', amount: 8 }, giftLike: { res: '燃料', bonus: 3 }, giftLimit: 3,
        assist: { at: 20, per: 0.1, effect: { scavengeRefresh: 0.15, hiddenFind: 0.15 }, desc: '他认路：刷新 +15%、隐藏物资点更容易发现' },
        fight: { at: 25, power: 9 },
        meet: {
            text: '"哥，你知道哪儿还有活人吗？"他把头盔摘下，"这些包裹我送了三天了，没人签收。"',
            choices: [
                { text: '把包裹拆了，人也带走', tip: '获得杂货，好感 +10。', value: 10, gain: { '食物': 14, '净水': 10, '药品': 4 }, result: '三十七个包裹里，有三瓶酒、两盒巧克力、一堆没人会穿的鞋。' },
                { text: '让他跟你去据点当跑腿', tip: '好感 +12，建立长期协助。', value: 12, morale: 3, result: '他骑着电动车在前面带路，一路上嘴里都在说哪儿能进去、哪儿有狗。' },
                { text: '不理会', tip: '好感 0。', value: 0, result: '他把头盔戴上，继续往前骑。' },
            ],
        },
        crossroad: {
            at: 45, title: '小马的记忆',
            text: '"我把这几个月跑过的地方画下来了。"他摊开一张拼接的纸，"哪些地方还有货、哪些地方进去的人没出来。"',
            choices: [
                { text: '按他的图重新规划', tip: '获得大量稀有物资与结晶。', value: 20, crystal: 4, gain: { '药品': 15, '弹药': 12, '零件': 15 }, result: '地图上标着三个红圈。跟着走的第一天，你就知道值了。' },
                { text: '让他带队去最危险的那个点', tip: '高回报也高风险。', value: 8, morale: -3, crystal: 3, result: '他们回来了，少了一个人。小马从此再没提过那张图。' },
            ],
        },
    },
    {
        id: 'baimanman', name: '白小满', icon: '🧊', gender: '女', kind: 'partner',
        role: 'S 级·绝对零度，独自活了两周', ability: { tier: 'S', name: '绝对零度' }, phase: 'outbreak',
        locate: { event: 'icegirl' },
        desc: '她把整条巷子冻成了一面墙。见到你时，她手里的冰锥没有放下。',
        gift: { res: '食物', amount: 10 }, giftLike: { res: '药品', bonus: 4 }, giftLimit: 3,
        assist: { at: 35, per: 0.15, effect: { defense: 0.2, combatPower: 0.15 }, desc: '她一个人能守一段墙：防御 +20%、战力 +15% 起' },
        fight: { at: 20, power: 38 },
        meet: {
            text: '"别过来。"她的声音很轻，冰锥尖上凝着一层白霜，"上一个说自己是好人的人，现在挂在那边。"',
            choices: [
                { text: '把武器放到地上，慢慢退后', tip: '用最笨的方式取得信任：好感 +15。', value: 15, result: '她看了你很久，才把冰锥收起来，"你身上有很怪的味道，像……另一个空间。"' },
                { text: '直接展示自己的异能', tip: '同类之间的对话：好感 +12，她会告诉你很多事。', value: 12, crystal: 3, result: '"你也觉醒了？"她的眼睛第一次亮起来，"那你知不知道这些到底是什么？"' },
                { text: '趁她分神动手', tip: '危险的选择。好感 -25，可能变成敌人。', value: -25, outcome: 'enemy', result: '你刚侧身，脚踝就冻在了地上。她走了，留你一个人在巷子里解冻了半小时。' },
            ],
        },
        crossroad: {
            at: 60, title: '白小满的过去',
            text: '"我杀过人。"她坐在屋顶边缘，"他们是来找我的人。我不知道自己现在算什么。"',
            choices: [
                { text: '"那就一起活下去，之后再想"', tip: '好感 +22，成为伴侣候选。', value: 22, morale: 5, crystal: 2, outcome: 'partner', result: '她把头靠在膝盖上，很久没有出声。第二天她在围墙上多冻了一层冰墙。' },
                { text: '"那些人该死"', tip: '认同她：好感 +10，但她会变得更冷。', value: 10, temp: { name: '冰墙', effect: { defenseFlat: 40 }, hours: 168 }, result: '她笑了一下，笑意没到眼睛里。' },
                { text: '"我也一样"', tip: '承认自己也做过同样的事：好感 +16。', value: 16, result: '"那就都不算了。"她说。' },
            ],
        },
    },
    {
        id: 'fangdoctor', name: '方医生', icon: '🧑‍⚕️', gender: '男', kind: 'ally',
        role: '流浪医生，背着一整个诊所的包', ability: null, phase: 'apocalypse',
        locate: { event: 'wanderDoc' },
        desc: '他在废墟里给不认识的人做缝合，收的报酬是一顿饭。',
        gift: { res: '药品', amount: 8 }, giftLike: { res: '食物', bonus: 4 }, giftLimit: 3,
        assist: { at: 25, per: 0.12, effect: { moraleRate: 0.12, foodUse: -0.05 }, desc: '他治伤也治饿：士气恢复 +0.12/小时' },
        meet: {
            text: '"缝合线我带了，麻醉药没有。"他头也不抬，"忍着。"',
            choices: [
                { text: '等他做完手术，请他吃饭', tip: '好感 +12，士气提升。', value: 12, morale: 5, result: '他吃得很慢，"我三个月没吃过热的了。"' },
                { text: '请他到据点常驻', tip: '好感 +10，医疗站立刻 +1 级。', value: 10, facility: { clinic: 1 }, result: '他把包放在医疗站门口，说："我住这儿了。"' },
                { text: '只问他药品从哪儿来', tip: '交易关系，好感 +3。', value: 3, gain: { '药品': 6 }, result: '他指了个方向，"那边药房还有半层没被翻。"' },
            ],
        },
        crossroad: {
            at: 50, title: '方医生的名单',
            text: '"我记着所有我救不回来的人。"他翻开一本卷了边的笔记本，"四十七个。我不想再加了。"',
            choices: [
                { text: '让他专心带医疗站', tip: '长期士气与防御增益。', value: 18, morale: 8, temp: { name: '医疗站常态化', effect: { moraleRate: 0.15, defenseFlat: 8 }, hours: 240 }, result: '从那天起，据点门口多了一块牌子：进门先洗手。' },
                { text: '让他跟着队伍出任务', tip: '战力与生存率提升，但风险高。', value: 10, temp: { name: '随队医生', effect: { combatPower: 0.12 }, hours: 168 }, result: '他学会了在枪声里缝合。' },
            ],
        },
    },
    {
        id: 'guchangan', name: '顾长安', icon: '🕶️', gender: '男', kind: 'neutral',
        role: 'A 级·重力控制，一个人占着一整栋楼', ability: { tier: 'A', name: '重力控制' }, phase: 'apocalypse',
        locate: { event: 'loner' },
        desc: '他坐在二十七层的阳台上钓鱼——钓的是楼下的水。他不缺任何东西，缺的是对手。',
        gift: { res: '弹药', amount: 10 }, giftLike: { res: '建材', bonus: 4 }, giftLimit: 3,
        assist: { at: 40, per: 0.15, effect: { combatPower: 0.25, defenseFlat: 20 }, desc: '他出手一次够顶一支队：战力 +25%、防御 +20 起' },
        fight: { at: 35, power: 48 },
        meet: {
            text: '"你站到这儿的时候，重力变了。"他没有回头，"第二个觉醒空间异能的人。有意思。"',
            choices: [
                { text: '问他想要什么', tip: '他不想要物资，他想要一件事。', value: 8, crystal: 3, result: '"我想看看你能活多久。"他说，"所以我不杀你。"' },
                { text: '提出结盟', tip: '好感 +10，但需要付出物资。', cost: { '食物': 30 }, value: 10, result: '他收下食物，随手把你身后的水泥墩抬起来又放下。' },
                { text: '不与他多说，退出去', tip: '安全。好感 0。', value: 0, result: '你退到电梯口时，整栋楼晃了一下。' },
            ],
        },
        crossroad: {
            at: 65, title: '顾长安的邀战',
            text: '"来打一场。"他把外套脱了，"你赢，我跟你走。你输，你的据点归我。"',
            choices: [
                { text: '应战', tip: '战力比拼：赢了得到一个强援，输了要付代价。', value: 10, duel: 'guchangan', crystal: 5, result: '你们把对面那栋楼打掉了两层。' },
                { text: '不打，改成比别的', tip: '消耗 结晶 6 打赌：赌他的情报。', cost: { '现金': 0 }, value: 6, crystal: -6, result: '他赌输了，交出一份城北的势力分布图。' },
                { text: '拒绝', tip: '好感 -10。', value: -10, result: '"无趣。"他转身回了阳台。' },
            ],
        },
    },
    {
        id: 'huangsan', name: '黄三', icon: '🕶️', gender: '男', kind: 'enemy',
        role: '街头混混头目，收了七个跟班', ability: null, phase: 'pre',
        locate: { event: 'thugs' },
        desc: '他带着人堵在商业街口收"过路费"。上一世他活到了冬天，靠的是抢。',
        gift: { res: '弹药', amount: 6 }, giftLike: { res: '现金', bonus: 3 }, giftLimit: 3,
        assist: { at: 55, per: 0.12, effect: { combatPowerFlat: 14, defenseFlat: 6 }, desc: '他手下有人：战力 +14、防御 +6 起' },
        fight: { at: 0, power: 26 },
        meet: {
            text: '"兄弟，这条街的规矩你懂吧？"他把手插在兜里，"过路费，随便给点。"',
            choices: [
                { text: '给他一笔钱，交个朋友', tip: '消耗 现金 800，好感 +12。', cost: { '现金': 800 }, value: 12, result: '他笑得很大声，"痛快！以后这条街没人敢动你。"' },
                { text: '打回去', tip: '一场硬仗：赢了拿东西，好感 -20。', value: -20, outcome: 'enemy', battle: 'huangsan', result: '他捂着鼻子往后退，剩下的几个人跑得比他还快。' },
                { text: '不理会，绕开走', tip: '好感 -5，不给东西。', value: -5, result: '他在你身后喊了两句，没敢真追上来。' },
            ],
        },
        crossroad: {
            at: 50, title: '黄三的投奔',
            text: '"我知道你那儿有墙。"他一个人来的，没带人，"我的人死了四个。收我吧，脏活我干。"',
            choices: [
                { text: '收下他和剩下的人', tip: '战力大涨，但士气会波动，而且他记仇。', value: 25, morale: -6, crystal: 2, temp: { name: '黄三的队伍', effect: { combatPowerFlat: 25, defenseFlat: 10 }, hours: 240 }, result: '他把刀往桌上一放，"我这条命押给你了。"' },
                { text: '只收他，不收他的人', tip: '好感 +10，收益较小。', value: 10, result: '他犹豫了两秒，点头："行。"' },
                { text: '让他滚', tip: '好感 -20，他可能带人来报复。', value: -20, result: '他笑了一声，"你会后悔的。"' },
            ],
        },
    },
    {
        id: 'zhengdui', name: '郑队', icon: '🎖️', gender: '男', kind: 'neutral',
        role: '警局留守的队长，还守着规矩', ability: { tier: 'C', name: '广域感知' }, phase: 'pre',
        locate: { location: 'police' },
        desc: '他没走。警局里还有六个人、三辆车、一间没被撬开的武器库。',
        gift: { res: '食物', amount: 12 }, giftLike: { res: '药品', bonus: 4 }, giftLimit: 3,
        assist: { at: 40, per: 0.12, effect: { defenseFlat: 18, warning: 2 }, desc: '他带人来轮岗：防御 +18、预警 +2 小时起' },
        fight: { at: 40, power: 30 },
        meet: {
            text: '"你是今天第三个来的。"他把枪放到桌上，"前两个想抢武器库。我给他们看了监控，他们就走了。"',
            choices: [
                { text: '出示身份，说明你想合作', tip: '好感 +10，他会和你换物资。', value: 10, gain: { '弹药': 12 }, result: '"我这里缺吃的。"他说，"子弹我有的是。"' },
                { text: '用末日情报换取信任', tip: '好感 +15，但他会开始怀疑消息来源。', value: 15, crystal: 2, result: '"你怎么知道？"他盯了你很久，"……算了，我信一半。"' },
                { text: '直接找机会进武器库', tip: '高风险：可能拿到弹药，也可能被当成敌人。', value: -10, outcome: 'enemy', result: '你刚碰到铁门，走廊的灯全亮了。' },
            ],
        },
        crossroad: {
            at: 60, title: '郑队的请求',
            text: '"我们守不住警局了。"他摊开地图，"要么带着人撤到别处，要么并入你那儿。我只有两个条件：不放弃伤员，不射杀手无寸铁的人。"',
            choices: [
                { text: '答应他', tip: '据点防御与预警长期提升，士气大涨。', value: 25, morale: 10, crystal: 3, temp: { name: '郑队的轮岗', effect: { defenseFlat: 45, warning: 3, moraleRate: 0.05 }, hours: 240 }, result: '六个人、三辆车、两箱子弹。门口多了两班岗。' },
                { text: '只接收武器库', tip: '拿弹药，不接人。好感 -15。', gain: { '弹药': 45 }, value: -15, result: '"你把子弹拿走吧。"他把门打开，"人会记住这一天的。"' },
                { text: '拒绝', tip: '好感 -25，可能成为敌人。', value: -25, outcome: 'enemy', result: '"那你走吧。"他把地图收了起来。' },
            ],
        },
    },
];
