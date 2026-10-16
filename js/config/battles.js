/* 战斗（纯数据）：事件与剧情里出现的战斗，用玩家「战力」对撞 */
const BATTLES_CONFIG = {
    huangsan: {
        id: 'huangsan', name: '黄三和他的跟班', power: 30,
        text: '七个对两个。你把最近的一个人先撂倒，剩下的往后退了两步。',
        winLoot: { '弹药': 12, '食物': 10 }, loseLoot: { '食物': 8 }, crystal: 1,
        winMorale: 6, loseMorale: -8,
    },
    nest: {
        id: 'nest', name: '楼道里的东西', power: 26,
        text: '你踹开门的时候它正背对着你。',
        winLoot: { '食物': 10 }, loseLoot: { '药品': 3 }, crystal: 1,
        winMorale: 3, loseMorale: -6,
    },
    scout: {
        id: 'scout', name: '侦察小队', power: 44,
        text: '三个人，两把枪。他们在排水沟里被打了个措手不及。',
        winLoot: { '弹药': 14, '零件': 10 }, loseLoot: { '食物': 12 }, crystal: 2,
        winMorale: 5, loseMorale: -9,
    },
    ransom: {
        id: 'ransom', name: '绑匪的据点', power: 78,
        text: '对方的窝在一栋写字楼里，入口只有一个。',
        winLoot: { '弹药': 24, '食物': 20, '药品': 10 }, loseLoot: { '药品': 12, '弹药': 8 }, crystal: 3,
        winMorale: 10, loseMorale: -12,
    },
    chenmo: {
        id: 'chenmo', name: '陈默', power: 52,
        text: '他比你想象的能打。钢筋铁骨不是白叫的。',
        winLoot: { '弹药': 10 }, loseLoot: { '药品': 10 }, crystal: 2,
        winMorale: 5, loseMorale: -10,
    },
    guchangan: {
        id: 'guchangan', name: '顾长安', power: 120,
        text: '他抬手，你脚下的水泥就塌了。这是 A 级的分量。',
        winLoot: { '零件': 20, '弹药': 20 }, loseLoot: { '建材': 30, '食物': 20 }, crystal: 4,
        winMorale: 12, loseMorale: -14,
    },
    enemy: {
        id: 'enemy', name: '末日里的敌人', power: 30,
        text: '没什么好说的，末日里每天都会遇到这种事。',
        winLoot: { '弹药': 8 }, loseLoot: { '食物': 8 }, crystal: 1,
        winMorale: 3, loseMorale: -6,
    },
    /* 仇家找上门：抢得越多，来的人越硬 */
    grudge: {
        id: 'grudge', name: '来算账的人', power: 60,
        text: '两个人，一把霰弹枪。他们不是来抢东西的。',
        winLoot: { '弹药': 10, '现金': 400 }, loseLoot: { '食物': 15, '药品': 5 }, crystal: 2,
        winMorale: 4, loseMorale: -8,
    },
    grudgeSquad: {
        id: 'grudgeSquad', name: '上门清算的一队人', power: 130,
        text: '三辆车，八个人，他们把车灯全开着照你的围墙。',
        winLoot: { '弹药': 24, '现金': 1200 }, loseLoot: { '食物': 30, '药品': 12, '弹药': 10 }, crystal: 4,
        winMorale: 10, loseMorale: -14,
    },
};
