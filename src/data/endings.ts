import type { EndingResult, GameState } from '../engine/types'
import { IDOL_BY_ID } from './idols'
import { CONFIG, fmtNum } from '../engine/balance'

export interface LiveGrade {
  score: number
  tier: 'legend' | 'perfect' | 'great' | 'ok' | 'poor'
  tierLabel: string
  breakdown: { label: string; value: number }[]
  attendance: number
  threeDCount: number
}

export function evaluateLive(state: GameState): LiveGrade {
  const fans = state.idols.reduce((s, i) => s + i.fans, 0)
  const avgStat =
    state.idols.reduce((s, i) => s + (i.stats.vocal + i.stats.dance + i.stats.talk + i.stats.charm) / 4, 0) /
    state.idols.length
  const avgMorale = state.idols.reduce((s, i) => s + i.morale, 0) / state.idols.length
  const avgFatigue = state.idols.reduce((s, i) => s + i.fatigue, 0) / state.idols.length
  const threeDCount = state.idols.filter((i) => i.threeD).length

  const fanScore = Math.max(0, Math.min(30, (Math.log10(Math.max(1000, fans) / 5000) / Math.log10(600)) * 30))
  const statScore = Math.max(0, Math.min(22, ((avgStat - 40) / 50) * 22))
  const moraleScore = Math.max(0, Math.min(12, ((avgMorale - 40) / 50) * 12))
  const repScore = (state.resources.reputation / 100) * 12
  const threeDScore = (threeDCount / 8) * 12
  const venueScore = state.flags['grandVenue'] ? 12 : 0
  const fatiguePenalty = Math.min(10, Math.max(0, (avgFatigue - 55) / 45) * 10)

  const score = Math.max(
    0,
    Math.min(100, fanScore + statScore + moraleScore + repScore + threeDScore + venueScore - fatiguePenalty),
  )

  let tier: LiveGrade['tier'] = 'poor'
  let tierLabel = '只亮了一排'
  if (score >= 88) {
    tier = 'legend'
    tierLabel = '让山自己动起来'
  } else if (score >= 78) {
    tier = 'perfect'
    tierLabel = '灯牌铺满'
  } else if (score >= 62) {
    tier = 'great'
    tierLabel = '满月'
  } else if (score >= 46) {
    tier = 'ok'
    tierLabel = '半场灯'
  }

  return {
    score,
    tier,
    tierLabel,
    attendance: Math.round(
      Math.min(CONFIG.live.attendance.max, CONFIG.live.attendance.base + fans * CONFIG.live.attendance.perFan) *
        (state.flags['grandVenue'] ? CONFIG.live.attendance.venueMul : 1),
    ),
    threeDCount,
    breakdown: [
      { label: '粉丝体量', value: fanScore },
      { label: '成员能力', value: statScore },
      { label: '成员心态', value: moraleScore },
      { label: '企划口碑', value: repScore },
      { label: '3D 完成度', value: threeDScore },
      { label: '制作规格', value: venueScore },
      { label: '疲劳扣分', value: -fatiguePenalty },
    ],
  }
}

function statsOf(state: GameState) {
  const fans = state.idols.reduce((s, i) => s + i.fans, 0)
  const threeD = state.idols.filter((i) => i.threeD).length
  return [
    { label: '企划总粉丝', value: fmtNum(fans) },
    { label: '剩余资金', value: `¥${state.resources.money.toLocaleString()}` },
    { label: '企划口碑', value: state.resources.reputation.toFixed(1) },
    { label: '存活月份', value: `${state.month - 1} 个月` },
    { label: '3D 化成员', value: `${threeD} / 8` },
  ]
}

function memberNotes(i: { morale: number; fatigue: number }) {
  if (i.morale >= 80) return '状态极好'
  if (i.morale >= 55) return '还算撑得住'
  if (i.morale >= 30) return '有点累了'
  return '差一点就崩了'
}

function castOf(state: GameState) {
  return state.idols.map((i) => {
    const def = IDOL_BY_ID.get(i.id)!
    return {
      id: i.id,
      name: def.name,
      prototype: def.prototype,
      fans: fmtNum(i.fans),
      morale: `${Math.round(i.morale)}`,
      threeD: i.threeD,
      note: memberNotes(i),
    }
  })
}

function lastWords(ids: string[]) {
  return ids.map((id) => {
    const def = IDOL_BY_ID.get(id)!
    return `「${def.name}」的账号还留着。最后一条动态是她走之前三天发的，只有一张空排练室的照片。`
  })
}

/* ------------------------------------------------------------------ */
/* BE                                                                  */
/* ------------------------------------------------------------------ */

export function beBankrupt(state: GameState): EndingResult {
  const phase1 = state.month <= 12
  return {
    id: 'be_bankrupt',
    type: 'BE',
    music: 'sad',
    title: '破产清算',
    subtitle: '成本模型是健康的。公司不是。',
    body: [
      '财务把最后一张报表推过来的时候，你正在看直播后台。',
      '余额是负数。三个月的工资、两个月的带宽、一笔没结的制作费，全部叠在一起，压在了那个数字上。',
      '',
      '你在会议室里站了大概十分钟，然后开始打电话。',
      '第一个电话打给制作公司，退了虚拟舞台的定金。第二个打给平台，问能不能预支。第三个你没打完，因为对方先挂了。',
      '',
      '那天晚上，你把这些年做的所有数据表导了出来，一共 42 列，19 个 sheet。',
      '你在最后加了一列，标题是「为什么失败」。',
      '然后你盯着那一列看了很久，最后什么也没填。',
      '',
      '因为你算不出来。',
      '',
      phase1
        ? '企划没有撑过第一阶段。企划书上「第一阶段」后面那行字，你一直没舍得划掉。'
        : '企划倒在了第二阶段的门槛外面。你甚至已经做过线上演唱会的完整方案了，报价单还压在抽屉里。',
      '',
      '成员们是分批知道这件事的。有人哭了，有人什么都没说，有人问「那我们以后还播吗」。',
      '你说：「播。自己播。」',
      '',
      '最后一天，你把办公室里那件动捕服取下来，叠好，放进纸箱。',
      '箱子最上面放着那份企划书，扉页上还写着那行小字：',
      '',
      '「第五阶段：让山自己动起来。」',
    ],
    epilogue: [...statsOf(state), { label: '死因', value: '资金链断裂' }],
    cast: state.idols.map((i) => {
      const def = IDOL_BY_ID.get(i.id)!
      return {
        id: i.id,
        name: def.name,
        prototype: def.prototype,
        fans: fmtNum(i.fans),
        morale: `${Math.round(i.morale)}`,
        threeD: i.threeD,
        note: i.morale >= 50 ? '她本来还能再撑一阵' : '她其实早就累了',
      }
    }),
  }
}

export function beGraduation(state: GameState, whoIds: string[]): EndingResult {
  const names = whoIds.map((id) => IDOL_BY_ID.get(id)!.name)
  const phase1 = state.month <= 12
  const all = whoIds.length >= 3
  return {
    id: all ? 'be_empty' : 'be_graduation',
    type: 'BE',
    music: 'sad',
    title: all ? '空城计' : '毕业',
    subtitle: all ? '舞台上还剩一盏灯。' : '有些人，是留不住的。',
    body: [
      all
        ? '人都走了。办公室里还留着八张椅子，七张是空的。'
        : `${names.join('、')} 走了。`,
      '',
      '你后来想过很多次，如果当时少排一场直播，多放一天假，事情会不会不一样。',
      '你也试过用数据回答这个问题。你建了一个新模型，变量里加了「休息天数」「私下沟通频次」「生日有没有记得」。',
      'R² 只有 0.19。',
      '',
      '这一次你没有说「说明还有上升空间」。',
      '你把那个模型删掉了。',
      '',
      phase1
        ? '企划没有撑过第一阶段。企划书上写着 12 个月，你们走了 ' + (state.month - 1) + ' 个月。'
        : '差一点就能站上那个舞台了。差的那一点，是人的心。',
      '',
      ...lastWords(whoIds),
      '',
      '鼠标这个人，最后没有成为偶像。',
      '他成了那个「开公会养梦的老板」。',
      '圈里人提起他的时候，语气里有一种奇怪的敬意。',
      '因为大家发现，这个梦虽然一直没实现，但鼠标也一直没放弃。',
      '',
      '只是这一次，他不打算再迭代了。',
    ],
    epilogue: [
      ...statsOf(state),
      { label: '死因', value: all ? '全员毕业' : '成员毕业' },
      { label: '离开的人', value: names.join('、') },
    ],
    cast: castOf(state),
  }
}

/* ------------------------------------------------------------------ */
/* HE                                                                  */
/* ------------------------------------------------------------------ */

const LIVE_OPENING = [
  '推流接通的那一秒，直播间里安静了一下。',
  '然后是弹幕。密密麻麻的，从屏幕右边滚到左边，快得看不清。',
]

export function heEnding(state: GameState, grade: LiveGrade): EndingResult {
  const base = {
    id: 'he_' + grade.tier,
    type: 'HE' as const,
    epilogue: [
      ...statsOf(state),
      { label: '峰值在线', value: `${grade.attendance.toLocaleString()} 人` },
      { label: 'Live 评分', value: `${grade.score.toFixed(1)} / 100` },
      { label: '结局评级', value: grade.tierLabel },
    ],
    cast: castOf(state),
  }

  if (grade.tier === 'legend') {
    return {
      ...base,
      music: 'epic',
      title: '让山自己动起来',
      subtitle: '这一次，山动了。',
      body: [
        ...LIVE_OPENING,
        '',
        '八个人站成一排。身后的环形大屏同时亮起，把整个虚拟舞台照得像白天。',
        '第一首歌是第一首原创。第二首是那首被吐槽过音准的翻唱，重新编了曲。',
        '第三首开始的时候，弹幕已经快得看不清了。',
        '',
        '最后一首歌之前，你走进画面，接过话筒。',
        '弹幕开始刷——不是刷她们的名字，是刷你的。',
        '「老板别唱了！老板别唱了！」',
        '',
        '你笑了，说：「今天不唱。今天我是来看的。」',
        '',
        '然后你退出画面，把 C 位留给了她们。',
        '',
        '关播之后，你在后台蹲了很久。',
        '运营过来问：「老板，你在算什么？」',
        '你说：「我在算，这个梦做了多久。」',
        '「多久？」',
        '「从初中的班会课，到今天。一共二十六年。」',
        '',
        '运营沉默了一会儿，说：「那挺值的。」',
        '',
        '你说：「值。而且——」',
        '你顿了一下。',
        '「而且山动了。」',
        '',
        '那天晚上，你把企划书的最后一页翻出来，在「第五阶段：让山自己动起来」后面，',
        '用笔添了一行字：',
        '',
        '「已完成。」',
      ],
    }
  }

  if (grade.tier === 'perfect') {
    return {
      ...base,
      music: 'epic',
      title: '灯牌铺满',
      subtitle: '从开场到关播，一盏都没灭。',
      body: [
        ...LIVE_OPENING,
        '',
        '你花了两分钟才看清——那一片光，是从直播间的这头一直铺到那头的。',
        '八种颜色。每一块灯牌上都写着名字。',
        '',
        '演出进行到最后一段的时候，有人的灯牌特效卡住了。',
        '他在弹幕里刷了一串「等等我」，然后重新点上，一直点到关播。',
        '',
        '你在导播台后面看着，突然想起很多年前，初中的班会课。',
        '台下有人在嗑瓜子，有人在写作业，有人问「你们什么时候结束」。',
        '',
        '那天你说，以后一定要让底下坐满人。',
        '这个「以后」，隔了很多年，隔了很多次失败，隔了一堆没有回报的账。',
        '',
        '今天到了。',
        '',
        '谢幕的时候，八个人手拉着手鞠躬。',
        '麦克风收进了一句很小声的话，是「小晴」说的：',
        '「我们做到了。」',
        '',
        '关播之后，运营问你：「老板，接下来呢？」',
        '你说：「接下来，做第二场。」',
      ],
    }
  }

  if (grade.tier === 'great') {
    return {
      ...base,
      music: 'epic',
      title: '满月',
      subtitle: '灯没有铺满，但亮的地方是真的。',
      body: [
        ...LIVE_OPENING,
        '',
        '在线人数没有想象中高。中场掉了一截，你能数得出来。',
        '但那些从头待到尾的人，一直在。',
        '',
        '安可的时候，只剩一首歌的时间。',
        '「月白Mio」站在台上，说：「谢谢你们来。」',
        '然后她停顿了很久，久到弹幕开始刷她的名字。',
        '',
        '她说：「我以前觉得，我这种人不适合站在台上。」',
        '「但是今天，我站了。」',
        '',
        '关播之后，你在空掉的直播间里坐了一会儿。',
        '推流停了，弹幕停了，屏幕上还留着最后一条「晚安」。',
        '',
        '运营问：「老板，算成功吗？」',
        '你想了想，说：「算。只是没有算到最好。」',
        '「那还做吗？」',
        '你说：「做。模型还要迭代。」',
      ],
    }
  }

  if (grade.tier === 'ok') {
    return {
      ...base,
      music: 'dream',
      title: '半场灯',
      subtitle: '一半的观众，一整份的勇气。',
      body: [
        ...LIVE_OPENING,
        '',
        '开场的第二首歌就出了问题。监听断了，有人在台上听不见自己的声音。',
        '她们撑下来了。没有一个人停下。',
        '',
        '中场之后，在线人数掉了一些。',
        '但弹幕里那一片灯牌还在。从开场亮到关播，没有灭。',
        '',
        '最后一首歌，唱到副歌的时候，弹幕里有人跟着打歌词。',
        '很散，不太齐，但是刷得很快。',
        '',
        '你在后台，听见「星野Saki」在耳返里说了一句话，',
        '不是对观众说的，是对后台说的：',
        '「谢谢。真的谢谢。」',
        '',
        '这就是你们的第一场线上演唱会。',
        '不完美，但是它存在过。',
      ],
    }
  }

  return {
    ...base,
    music: 'dream',
    title: '只亮了一排',
    subtitle: '灯牌没有铺满，但有人来了。',
    body: [
      ...LIVE_OPENING,
      '然后你看清了：只有一排。',
      '',
      '一整排灯牌，七八个人，刷得很高。',
      '在线人数在往下掉，显得它们很小。',
      '',
      '演出照常进行。没有出大错，也没有出彩。',
      '有人在台上跳得很用力，你看见她的膝盖在抖。',
      '',
      '到最后，那一排人还在。',
      '其中一个人的弹幕后面，挂着一块手写的灯牌，上面是歪歪扭扭的四个字：',
      '',
      '「我们来了。」',
      '',
      '关播之后，运营说：「老板，对不起。」',
      '你说：「对不起什么。」',
      '「我们没能让灯牌铺满。」',
      '',
      '你看着后台那条往下走的在线曲线，说：',
      '「今天峰值 ' + grade.attendance.toLocaleString() + ' 人在线。」',
      '「二十六个「以后」里面，这是第一个真的有人的。」',
      '',
      '「这就够了。」',
    ],
  }
}

