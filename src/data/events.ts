import type { EventContext, EventOutcome, GameEvent, LogLine } from '../engine/types'
import { IDOL_BY_ID } from './idols'

const money = (n: number): EventOutcome['money'] => n

function outcome(partial: EventOutcome): EventOutcome {
  return { ...partial, logs: partial.logs ?? [] }
}

function line(kind: LogLine['kind'], text: string, who?: string): LogLine {
  return { kind, text, who }
}

/** 找心情最差的成员 */
function worst(ctx: EventContext) {
  return [...ctx.idols].sort((a, b) => a.morale - b.morale)[0]
}

/** 找最累的成员 */
function tiredest(ctx: EventContext) {
  return [...ctx.idols].sort((a, b) => b.fatigue - a.fatigue)[0]
}

export const EVENTS: GameEvent[] = [
  {
    id: 'boss_sing',
    title: '老板亲自上阵',
    weight: 10,
    when: (c) => c.state.month >= 3 && !c.state.flags['bossSang'],
    body: () => [
      line('narration', '鼠标今天穿了件比较正式的衬衫，头发也梳了。'),
      line('narration', '他站在会议室门口，清了清嗓子，说：「我想上麦。就唱一首。」'),
      line('narration', '会议室里没人说话。运营把手里的笔转了一圈，笔掉了。'),
      line('quote', '“怎么，我唱得有那么差吗？”', '鼠标'),
      line('narration', '没有一个人回答。这个沉默比回答更狠。'),
    ],
    choices: () => [
      {
        label: '让他上',
        hint: '涨粉很猛，口碑很伤',
        apply: (c) => {
          c.state.flags['bossSang'] = true
          const gain = Math.round(c.fans * 0.055 * c.rand())
          return outcome({
            fans: gain,
            reputation: -9,
            morale: { all: true, delta: -4 },
            logs: [
              line('narration', '鼠标唱了三首。第一首跑调，第二首忘词，第三首跑调加忘词。'),
              line('narration', '弹幕从「老板好」变成了「老板好走」，然后是「再来一首」。'),
              line('narration', '切片播放量破了企划历史记录。评论区的第一条是：「谢谢老板，我们笑得很大声。」'),
              line('good', `企划涨粉 +${gain.toLocaleString()}。口碑 -9。`),
              line('bad', '成员们假装没看见，但没有一个人转发那条切片。'),
            ],
          })
        },
      },
      {
        label: '拦下他',
        hint: '保住口碑，伤他一点心',
        apply: (c) =>
          outcome({
            reputation: 2,
            morale: { all: true, delta: 1 },
            logs: [
              line('narration', '运营把手按在鼠标肩上，说：「老板，你的梦是想当偶像，还是想被人记住？」'),
              line('narration', '鼠标想了很久，说：「有区别吗？」'),
              line('narration', '运营说：「有。前一个可以慢慢做，后一个今晚就能做完。」'),
              line('quote', '“……好。我不上。”', '鼠标'),
              line('good', '口碑 +2。全企划心情 +1。'),
            ],
          }),
      },
      {
        label: '让他当「神秘嘉宾」主持',
        hint: '折中：涨粉中等，口碑小跌',
        apply: (c) => {
          const gain = Math.round(c.fans * 0.022)
          return outcome({
            fans: gain,
            reputation: -2,
            morale: { all: true, delta: 1 },
            logs: [
              line('narration', '最后定的是：鼠标当主持，唱歌环节取消。'),
              line('narration', '他主持得很好。好得让人有点意外。'),
              line('narration', '整场他只唱了一句，就是开场的那句「大家好」。'),
              line('good', `企划涨粉 +${gain.toLocaleString()}。口碑 -2。`),
            ],
          })
        },
      },
    ],
  },

  {
    id: 'bandwidth',
    title: '带宽不够',
    weight: 9,
    when: (c) => c.fans > 18000,
    body: () => [
      line('narration', '上周的一条切片被人转到了首页。'),
      line('narration', '流量进来了，画质也糊成了马赛克。评论区一半在夸，一半在问「这主播是怎么做到在 144p 下还这么可爱的」。'),
      line('quote', '“带宽够不够？”', '鼠标'),
      line('quote', '“不太够。”', '运营'),
    ],
    choices: (c) => [
      {
        label: '花钱扩容',
        hint: `¥${Math.round(c.fans * 0.22).toLocaleString()}`,
        cost: Math.round(c.fans * 0.22),
        apply: (c) => {
          const cost = Math.round(c.fans * 0.22)
          return outcome({
            money: money(-cost),
            fans: Math.round(c.fans * 0.04),
            reputation: 3,
            logs: [
              line('narration', '扩容当天就办完了。当晚的直播是全企划第一次做到 1080p60。'),
              line('narration', '有观众在弹幕里说「今天怎么这么清楚」，主播愣了一下，说：「一直都是。」'),
              line('good', `资金 -¥${cost.toLocaleString()}。涨粉 +${Math.round(c.fans * 0.04).toLocaleString()}。口碑 +3。`),
            ],
          })
        },
      },
      {
        label: '不扩，省下这笔钱',
        hint: '错过这波流量',
        apply: (c) =>
          outcome({
            money: money(0),
            reputation: -5,
            logs: [
              line('narration', '鼠标合上账本，说：「先不扩。」'),
              line('narration', '接下来三天，直播间的人数像一条抛物线，上去，然后下来。'),
              line('quote', '“至少验证了一件事。”', '鼠标'),
              line('quote', '“什么事？”', '运营'),
              line('quote', '“我们的成本模型是健康的。”', '鼠标'),
              line('bad', '口碑 -5。这波流量没有留下来。'),
            ],
          }),
      },
      {
        label: '临时降码率硬撑',
        hint: '什么都得不到，但也不花钱',
        apply: () =>
          outcome({
            reputation: -1,
            fans: 0,
            logs: [
              line('narration', '画质降到了 480p。人还是那些人，只是看起来像十年前。'),
              line('narration', '有个老粉说：「这样也挺好，像以前看直播的感觉。」'),
              line('system', '什么也没发生。'),
            ],
          }),
      },
    ],
  },

  {
    id: 'viral_clip',
    title: '二创爆了',
    weight: 8,
    when: (c) => c.state.month >= 2,
    body: (c) => {
      const who = c.pick([c.idols[Number(c.state.month) % c.idols.length]])[0]
      const def = IDOL_BY_ID.get(who.id)!
      return [
        line('narration', `一个二创作者用「${def.name}」的一段九秒钟素材做了个鬼畜，三天之内播放量破了六位数。`),
        line('narration', `那个二创作者在上面写了一行小字：「素材随便用，不用感谢。」`),
        line('quote', `“这种粉丝，用钱买不到。”`, '运营'),
        line('narration', '鼠标看着后台曲线，说：「那正好，我们没钱。」'),
      ]
    },
    choices: (c) => [
      {
        label: '官方转发，请他吃顿盒饭',
        hint: '小钱，大口碑',
        cost: 3_000,
        apply: (c) => {
          const who = c.pick([c.idols[Number(c.state.month) % c.idols.length]])[0]
          const gain = Math.round(c.fans * 0.035)
          return outcome({
            money: money(-3_000),
            fans: gain,
            reputation: 5,
            morale: { ids: [who.id], delta: 6 },
            logs: [
              line('narration', '运营联系上了那个二创作者，问他要不要来公司坐坐。'),
              line('narration', '他说不用，他只是喜欢。'),
              line('good', `涨粉 +${gain.toLocaleString()}。口碑 +5。`),
            ],
          })
        },
      },
      {
        label: '二创就是二创，不官方下场',
        hint: '不花钱，但错过一部分转化',
        apply: (c) =>
          outcome({
            fans: Math.round(c.fans * 0.018),
            reputation: 1,
            logs: [
              line('narration', '鼠标说：「别下场。观众自己玩起来的东西，官方一碰就凉。」'),
              line('good', `涨粉 +${Math.round(c.fans * 0.018).toLocaleString()}。`),
            ],
          }),
      },
      {
        label: '买下来做正式素材',
        hint: '花钱买断，涨粉更多',
        cost: 20_000,
        apply: (c) => {
          const gain = Math.round(c.fans * 0.055)
          return outcome({
            money: money(-20_000),
            fans: gain,
            reputation: 3,
            logs: [
              line('narration', '买断合同签下来的时候，那个二创作者问：「你们是不是其实挺缺素材的？」'),
              line('narration', '运营说：「缺的不是素材。」'),
              line('good', `涨粉 +${gain.toLocaleString()}。`),
            ],
          })
        },
      },
    ],
  },

  {
    id: 'flame',
    title: '炎上',
    weight: 7,
    when: (c) => c.reputation > 22 && c.state.month >= 4,
    body: (c) => {
      const who = worst(c)
      const def = IDOL_BY_ID.get(who.id)!
      return [
        line('bad', `「${def.name}」在昨晚的直播里开了一个玩笑，被截了出来，配上了不太友善的标题。`),
        line('narration', '转发在四个小时里涨到了四位数。评论区开始有人用「这个企划」来指代你们。'),
        line('quote', '“我是不是把企划搞砸了。”', def.name),
        line('narration', '群里没有人回这句话。'),
      ]
    },
    choices: (c) => {
      const who = worst(c)
      return [
        {
          label: '正式道歉',
          hint: '掉一点粉，保住大方向',
          apply: () =>
            outcome({
              fans: Math.round(-c.fans * 0.03),
              reputation: 4,
              morale: { ids: [who.id], delta: -6 },
              logs: [
                line('narration', '道歉声明在凌晨两点发出去。措辞改了七遍。'),
                line('narration', '有人接受了，有人没接受。这已经是最好的结果。'),
                line('good', '口碑 +4。'),
                line('bad', `粉丝 -${Math.round(c.fans * 0.03).toLocaleString()}。`),
              ],
            }),
        },
        {
          label: '冷处理，等它过去',
          hint: '口碑掉，但不用低头',
          apply: () =>
            outcome({
              reputation: -7,
              morale: { ids: [who.id], delta: -10 },
              logs: [
                line('narration', '企划什么都没说。三天之后，热度确实下去了。'),
                line('narration', '但「冷处理」这三个字被记住了。'),
                line('bad', '口碑 -7。'),
              ],
            }),
        },
        {
          label: '硬刚：把完整上下文放出来',
          hint: '高风险，高回报',
          apply: () => {
            const good = c.rand() < 0.55 + c.reputation / 300
            return good
              ? outcome({
                  reputation: 8,
                  morale: { ids: [who.id], delta: 12 },
                  fans: Math.round(c.fans * 0.02),
                  logs: [
                    line('narration', '完整录像放出来之后，风向一夜之间变了。'),
                    line('narration', '那个标题党被人挂了。'),
                    line('good', '口碑 +8。她终于敢开播了。'),
                  ],
                })
              : outcome({
                  reputation: -12,
                  morale: { ids: [who.id], delta: -18 },
                  fans: Math.round(-c.fans * 0.05),
                  logs: [
                    line('narration', '完整录像放出来之后，被剪成了二十个新的片段。'),
                    line('bad', '口碑 -12。事情变得比原来更大了。'),
                  ],
                })
          },
        },
      ]
    },
  },

  {
    id: 'raise',
    title: '有人想要涨薪',
    weight: 8,
    when: (c) => c.state.month >= 4 && c.state.phase === 1,
    body: (c) => {
      const who = c.pick(c.idols)[0]
      const def = IDOL_BY_ID.get(who.id)!
      return [
        line('narration', `「${def.name}」的抽屉里放着一张打印出来的工资条。已经很旧了，边角起了毛。`),
        line('narration', '她没提这件事。但她的直播时长从每周十二小时，变成了每周八小时。'),
        line('quote', '“老板，我们是不是……不太行啊。”', def.name),
      ]
    },
    choices: (c) => [
      {
        label: '全员涨薪 20%',
        hint: '固定支出永久上升，心态大涨',
        cost: 24_000,
        apply: (c) =>
          outcome({
            money: money(-24_000),
            morale: { all: true, delta: 14 },
            flags: { raised: true },
            logs: [
              line('narration', '涨薪通知发下去的当天晚上，群里的消息量是平时的四倍。'),
              line('narration', '有人在群里说：「谢谢老板。」鼠标回了个「嗯」。'),
              line('good', '全企划心情 +14。固定支出永久上涨。'),
            ],
          }),
      },
      {
        label: '只给她一个人涨',
        hint: '她会留下，别人会看着',
        cost: 8_000,
        apply: (c) => {
          const who = c.pick(c.idols)[0]
          return outcome({
            money: money(-8_000),
            morale: { ids: [who.id], delta: 18 },
            flags: { raiseSingle: true },
            logs: [
              line('narration', '涨薪的事只在她和财务之间发生。'),
              line('narration', '但第二个月，其他几个人的直播时长也都变短了。'),
              line('good', '她心情 +18。其他人的心情 -3。'),
            ],
          })
        },
      },
      {
        label: '画饼：「第二阶段之后一定」',
        hint: '不花钱，掉心态',
        apply: () =>
          outcome({
            morale: { all: true, delta: -8 },
            reputation: -1,
            logs: [
              line('narration', '鼠标说：「等我们上了第二阶段的线上演唱会，一定不会亏待大家。」'),
              line('narration', '会议室里有人点了点头。'),
              line('narration', '那个人后来是第一个走的。'),
              line('bad', '全企划心情 -8。'),
            ],
          }),
      },
    ],
  },

  {
    id: 'device_dead',
    title: '设备挂了',
    weight: 7,
    when: () => true,
    body: (c) => {
      const who = tiredest(c)
      const def = IDOL_BY_ID.get(who.id)!
      return [
        line('narration', `「${def.name}」的声卡在开播前五分钟烧了。`),
        line('narration', '那是一块用了三年、二手买来、拆过一次又装回去的声卡。'),
        line('quote', '“修还是换？”', '运营'),
        line('quote', '“先算。”', '鼠标'),
      ]
    },
    choices: () => [
      {
        label: '换新的（¥18,000）',
        hint: '一劳永逸',
        cost: 18_000,
        apply: (c) => {
          const who = tiredest(c)
          return outcome({
            money: money(-18_000),
            morale: { ids: [who.id], delta: 8 },
            reputation: 2,
            flags: { newSoundCard: true },
            logs: [
              line('narration', '新声卡到货的第三天，直播间的弹幕有人说：「今天声音怎么这么好听？」'),
              line('quote', '“一直都是。”', IDOL_BY_ID.get(who.id)!.name),
              line('good', '口碑 +2。她心情 +8。'),
            ],
          })
        },
      },
      {
        label: '修（¥4,000），凑合用',
        hint: '能撑住',
        cost: 4_000,
        apply: (c) => {
          const who = tiredest(c)
          return outcome({
            money: money(-4_000),
            morale: { ids: [who.id], delta: -3 },
            logs: [
              line('narration', '修好的声卡有底噪。录出来的每一条素材都得降噪，切片师骂了一晚上。'),
              line('system', '勉强能撑。'),
            ],
          })
        },
      },
      {
        label: '不修，让她用手机播',
        hint: '省下钱，掉心态和口碑',
        apply: (c) => {
          const who = tiredest(c)
          return outcome({
            money: money(0),
            morale: { ids: [who.id], delta: -14 },
            reputation: -3,
            logs: [
              line('narration', '手机播出来的声音像在铁皮桶里。她在镜头前笑着说「这样也很可爱吧」。'),
              line('narration', '下播之后，她在走廊里站了很久。'),
              line('bad', '口碑 -3。'),
            ],
          })
        },
      },
    ],
  },

  {
    id: 'fan_letter',
    title: '一封手写信',
    weight: 6,
    when: () => true,
    body: (c) => {
      const who = c.pick(c.idols)[0]
      const def = IDOL_BY_ID.get(who.id)!
      return [
        line('narration', `运营把一个快递盒放到「${def.name}」桌上。里面是一封手写的信，还有一张画得很拙劣的 Q 版。`),
        line('narration', '信里说：她高三，压力很大，每天晚上听着直播写题。'),
        line('narration', '「虽然你们一直不火，但我觉得这样就很好。」'),
      ]
    },
    choices: () => [
      {
        label: '让她录一条回信视频',
        apply: (c) => {
          const who = c.pick(c.idols)[0]
          return outcome({
            morale: { ids: [who.id], delta: 15 },
            reputation: 4,
            fans: Math.round(c.fans * 0.008),
            logs: [
              line('narration', '回信视频只有一分半。她念信的时候停了两次。'),
              line('narration', '视频发出去之后，评论区有很多人说「我也想被回信」。'),
              line('good', '口碑 +4。她心情 +15。'),
            ],
          })
        },
      },
      {
        label: '把那封信贴到墙上',
        apply: () => {
          return outcome({
            morale: { all: true, delta: 6 },
            reputation: 2,
            logs: [
              line('narration', '信被贴在了动捕服的旁边，那里现在有两样东西。'),
              line('narration', '一个是梦想的遗骸，一个是梦想的理由。'),
              line('good', '全企划心情 +6。'),
            ],
          })
        },
      },
    ],
  },

  {
    id: 'poach',
    title: '隔壁企划来挖人',
    weight: 7,
    when: (c) => c.state.month >= 6 && c.idols.some((i) => i.stats.vocal + i.stats.charm > 120),
    body: (c) => {
      const star = [...c.idols].sort((a, b) => b.stats.vocal + b.stats.charm - (a.stats.vocal + a.stats.charm))[0]
      const def = IDOL_BY_ID.get(star.id)!
      return [
        line('bad', `「${def.name}」收到了一份来自隔壁企划的合同。底薪是你们的三倍。`),
        line('narration', '她没有立刻答应，也没有立刻拒绝。她把合同拍了个照片，发给了运营。'),
        line('quote', '“老板，如果我说我想去，你会怎么想？”', def.name),
      ]
    },
    choices: (c) => {
      const star = [...c.idols].sort((a, b) => b.stats.vocal + b.stats.charm - (a.stats.vocal + a.stats.charm))[0]
      return [
        {
          label: '加钱留人',
          hint: '¥60,000',
          cost: 60_000,
          apply: () =>
            outcome({
              money: money(-60_000),
              morale: { ids: [star.id], delta: 20 },
              logs: [
                line('narration', '她留下了。合同签完，她说了句谢谢，然后回房间继续练。'),
                line('narration', '鼠标在办公室坐了很久。他算了一下：这六万，本来可以做半首原创。'),
                line('good', '她留下来了。'),
              ],
            }),
        },
        {
          label: '放她走，但要一份「转会费」',
          hint: '拿钱，但她会毕业 —— 企划立刻结束',
          apply: () =>
            outcome({
              money: money(80_000),
              morale: { ids: [star.id], delta: -40 },
              graduate: [star.id],
              logs: [
                line('narration', '转会费到账了。八十万，比企划半年的营收还多。'),
                line('narration', '她走的那天，把自己画的那些表情包留在了共享盘里。'),
                line('bad', '她走了。企划少了一个人。'),
                line('quote', '“你们会成功的。只是我可能等不到那天了。”', IDOL_BY_ID.get(star!.id)!.name),
              ],
            }),
        },
        {
          label: '真诚挽留：不谈钱，谈梦',
          hint: '赌她的心',
          apply: () => {
            const ok = c.rand() < 0.45 + star.morale / 250
            return ok
              ? outcome({
                  morale: { ids: [star.id], delta: 26 },
                  reputation: 2,
                  logs: [
                    line('narration', '鼠标说：「我没办法给你三倍。我只能给你一样东西——这里的每一首歌，都是为你写的。」'),
                    line('narration', '她笑了一下，说：「老板，你这句话练过吧。」'),
                    line('quote', '“练过。”', '鼠标'),
                    line('good', '她留下来了。'),
                  ],
                })
              : outcome({
                  morale: { ids: [star.id], delta: -34 },
                  reputation: -2,
                  logs: [
                    line('narration', '她说：「老板，你这句话，跟你上次画饼的时候一模一样。」'),
                    line('narration', '她没有走。但她那天之后，直播时长少了一半。'),
                    line('bad', `心态 -34。她现在离「毕业」只差几步了。`),
                  ],
                })
          },
        },
      ]
    },
  },

  {
    id: 'expo',
    title: '漫展的邀请',
    weight: 6,
    when: (c) => c.state.month >= 5,
    body: () => [
      line('narration', '一张展位邀请函寄到了公司。三天的漫展，一个三米乘三米的角落。'),
      line('narration', '展位费、物料、差旅，加起来大概四万。'),
      line('quote', '“去吗？”', '运营'),
      line('quote', '“能见到真人粉丝吗？”', '鼠标'),
      line('quote', '“能。”', '运营'),
      line('quote', '“那去。”', '鼠标'),
    ],
    choices: () => [
      {
        label: '去，做一次正式的展位',
        cost: 40_000,
        apply: (c) =>
          outcome({
            money: money(-40_000),
            fans: Math.round(c.fans * 0.055),
            reputation: 6,
            morale: { all: true, delta: 8 },
            logs: [
              line('narration', '三天，一共来了两百多个人。有人从外地坐火车过来，只为了在展位前说一句「我一直在看」。'),
              line('narration', '最后一天撤展的时候，几个人蹲在空展位旁边吃盒饭。'),
              line('quote', '“这算不算是舞台？”', '运营'),
              line('quote', '“算。纸糊的也算。”', '鼠标'),
              line('good', `涨粉 +${Math.round(c.fans * 0.055).toLocaleString()}。全企划心情 +8。`),
            ],
          }),
      },
      {
        label: '不去，钱留着做内容',
        apply: () =>
          outcome({
            morale: { all: true, delta: -2 },
            logs: [
              line('narration', '鼠标把邀请函夹进了企划书里，当成书签。'),
              line('narration', '那天他照常十点下班，路过公司楼下的便利店，买了一瓶水。'),
              line('system', '什么也没发生。'),
            ],
          }),
      },
    ],
  },

  {
    id: 'boss_meme',
    title: '老板上热搜了',
    weight: 6,
    when: (c) => c.state.month >= 5 && c.fans > 30000,
    body: () => [
      line('narration', '一条切片突然火了。内容不是任何一个成员，是鼠标。'),
      line('narration', '他在视频里说：「带宽够不够？」然后被人配上了各种音效。'),
      line('narration', '话题叫 #老板别唱了，阅读量破了千万。'),
      line('quote', '“老板，你火了。”', '运营'),
      line('narration', '鼠标沉默了很久，说：「我火了，她们没火。这算好事吗？」'),
    ],
    choices: () => [
      {
        label: '借势：让老板出镜做一期企划宣传',
        apply: (c) =>
          outcome({
            fans: Math.round(c.fans * 0.07),
            reputation: 2,
            morale: { all: true, delta: -2 },
            flags: { bossMemeUsed: true },
            logs: [
              line('narration', '鼠标破天荒地出现在了三分钟的宣传片里。他全程只说了一句话：「她们在直播，去看她们。」'),
              line('narration', '评论区说：「这老板有点东西。」'),
              line('good', `涨粉 +${Math.round(c.fans * 0.07).toLocaleString()}。`),
              line('narration', '成员们没说什么。但「老板别唱了」这个梗，从此贴在了企划的门口。'),
            ],
          }),
      },
      {
        label: '把流量全部导向成员',
        apply: (c) => {
          const gain = Math.round(c.fans * 0.045)
          return outcome({
            fans: gain,
            reputation: 5,
            morale: { all: true, delta: 5 },
            logs: [
              line('narration', '企划没有发任何关于鼠标的内容。他们把热搜的流量，全部导给了成员们的直播间。'),
              line('narration', '效果一般。转化率不到百分之三。'),
              line('narration', '但那天晚上，每个人的直播间里都多了几个陌生 ID，第一句话是「我是从老板那个视频来的」。'),
              line('good', `涨粉 +${gain.toLocaleString()}。全企划心情 +5。`),
            ],
          })
        },
      },
      {
        label: '装死，让这个梗自己消化',
        apply: () =>
          outcome({
            reputation: -1,
            logs: [
              line('narration', '企划官方账号一个字都没发。'),
              line('narration', '一周之后，热度过了。有人做了个合集，叫《鼠标的一生》，播放量八百万。'),
              line('system', '梗还在。只是和企划没关系了。'),
            ],
          }),
      },
    ],
  },

  {
    id: 'low_morale_talk',
    title: '深夜的私信',
    weight: 9,
    when: (c) => c.idols.some((i) => i.morale < 28),
    body: (c) => {
      const w = worst(c)
      const def = IDOL_BY_ID.get(w.id)!
      return [
        line('bad', `凌晨三点，「${def.name}」给你发了一条私信。`),
        line('narration', '「老板，我是不是不适合做这个。」'),
        line('narration', '「我每天都在播，但是我不知道自己在播什么。」'),
        line('narration', '「我不想成为你们的负担。」'),
      ]
    },
    choices: (c) => {
      const w = worst(c)
      return [
        {
          label: '明天给她放一天假，你亲自陪她聊聊',
          hint: '心态大幅回升',
          cost: 2_000,
          apply: () =>
            outcome({
              money: money(-2_000),
              morale: { ids: [w.id], delta: 24 },
              logs: [
                line('narration', '你请她吃了一顿不算贵的饭。整个过程你几乎没说话，只是听。'),
                line('narration', '最后她说：「老板，你其实不懂直播。」'),
                line('quote', '“我不懂。所以我只能听你们的。”', '鼠标'),
                line('narration', '她笑了。这是这个月第一次。'),
                line('good', `心情 +24。`),
              ],
            }),
        },
        {
          label: '把她的数据表打出来，一条一条讲给她听',
          hint: '鼠标式安慰，效果存疑',
          apply: () =>
            outcome({
              morale: { ids: [w.id], delta: c.rand() < 0.5 ? 14 : -8 },
              logs: [
                line('narration', '你把四十列的数据打印出来，铺了一桌子。'),
                line('narration', '「你看，你的互动率在同级里是前百分之三十。」'),
                line('narration', '她看着那张表，看了很久。'),
                line('quote', '“……老板，你真的很努力地在理解我们。”', IDOL_BY_ID.get(w.id)!.name),
                line('system', '她好像好了一点。也可能没有。'),
              ],
            }),
        },
        {
          label: '回复「再撑一下，快好了」',
          hint: '最省事，也最伤',
          apply: () =>
            outcome({
              morale: { ids: [w.id], delta: -12 },
              logs: [
                line('narration', '你打了四个字：「再撑一下。」'),
                line('narration', '她回了一个「好」。'),
                line('bad', '已读，回了一个「好」。这个字比任何回复都危险。'),
              ],
            }),
        },
      ]
    },
  },

  {
    id: 'platform_rule',
    title: '平台改了规则',
    weight: 6,
    when: (c) => c.state.month >= 3,
    body: () => [
      line('narration', '平台发了一则公告：直播打赏的分成比例调整，虚拟区额外抽成。'),
      line('narration', '运营把公告转进群里，配了一句：「早说了。」'),
      line('quote', '“提前算过吗？”', '鼠标'),
      line('quote', '“算过。没算到这么快。”', '运营'),
    ],
    choices: (c) => [
      {
        label: '调整结构，把重心转向会员和周边',
        cost: 25_000,
        apply: () =>
          outcome({
            money: money(-25_000),
            reputation: 4,
            fans: Math.round(c.fans * 0.01),
            flags: { shiftedToMerch: true },
            logs: [
              line('narration', '商城上线了。第一批周边是钥匙扣和亚克力立牌，一共六款。'),
              line('narration', '卖得比想象中好。有个粉丝买了一套之后留言：「请问有没有鼠标款？」'),
              line('quote', '“没有。”', '运营'),
              line('good', '口碑 +4。收入结构更稳了。'),
            ],
          }),
      },
      {
        label: '不改，先扛过去',
        apply: () =>
          outcome({
            reputation: -3,
            morale: { all: true, delta: -2 },
            logs: [
              line('narration', '企划什么都没改。下个月的收入少了一截，但也没到伤筋动骨。'),
              line('bad', '口碑 -3。'),
            ],
          }),
      },
    ],
  },

  {
    id: 'quiet_month',
    title: '什么也没发生的月份',
    weight: 5,
    when: () => true,
    body: () => [
      line('narration', '这个月什么也没发生。'),
      line('narration', '没有人爆火，没有人翻车，没有人说要走。'),
      line('narration', '直播照开，数据照拉，周报照写。'),
      line('narration', '你坐在办公室里，看着窗外，突然意识到这可能是最接近「正常」的一个月。'),
      line('quote', '“挺好的。”', '鼠标'),
    ],
    choices: () => [
      {
        label: '让所有人多休息两天',
        apply: () =>
          outcome({
            fatigue: { all: true, delta: -12 },
            morale: { all: true, delta: 4 },
            logs: [line('good', '全企划疲劳 -12，心情 +4。')],
          }),
      },
      {
        label: '照常推进，不要浪费任何一个星期',
        apply: () =>
          outcome({
            morale: { all: true, delta: -1 },
            logs: [
              line('narration', '你在群里发了一句：「这个月最后一周了，冲一下。」'),
              line('narration', '群里回复了八个「好」。'),
            ],
          }),
      },
    ],
  },

  {
    id: 'stage_dream',
    title: '凌晨三点的排练室',
    weight: 7,
    when: (c) => c.state.month >= 8,
    body: (c) => {
      const who = tiredest(c)
      const def = IDOL_BY_ID.get(who.id)!
      return [
        line('narration', '你半夜回公司拿东西，排练室的灯还亮着。'),
        line('narration', `「${def.name}」一个人在练。没有音乐，她在数着拍子跳。`),
        line('narration', '她看见你，停了下来，说：「老板，你怎么还没走。」'),
        line('narration', '你问她为什么也不走。'),
        line('quote', '“因为我想站在那个舞台上。”', def.name),
        line('quote', '“哪个舞台？”', '鼠标'),
        line('quote', '“就是……那个。有很多灯牌的那个。”', def.name),
      ]
    },
    choices: (c) => {
      const who = tiredest(c)
      return [
        {
          label: '坐下来，陪她看完这一遍',
          apply: () =>
            outcome({
              morale: { ids: [who.id], delta: 20 },
              fatigue: { ids: [who.id], delta: 8 },
              logs: [
                line('narration', '你在地板上坐下来。她跳完了整段。'),
                line('narration', '结束的时候，你鼓了掌。排练室很空，掌声有点响。'),
                line('narration', '她红着眼睛说：「老板，你鼓掌的样子好奇怪。」'),
                line('good', `心情 +20。疲劳 +8。`),
              ],
            }),
        },
        {
          label: '让她立刻回去睡觉',
          apply: () =>
            outcome({
              fatigue: { ids: [who.id], delta: -18 },
              morale: { ids: [who.id], delta: 6 },
              logs: [
                line('narration', '你说：「舞台不会跑。人会。」'),
                line('narration', '她愣了一下，然后关掉了排练室的灯。'),
                line('good', `疲劳 -18。心情 +6。`),
              ],
            }),
        },
        {
          label: '把这段拍下来，以后当宣传片素材',
          apply: () =>
            outcome({
              reputation: 3,
              fans: Math.round(c.fans * 0.012),
              morale: { ids: [who.id], delta: -6 },
              logs: [
                line('narration', '你举起了手机。她跳得更认真了。'),
                line('narration', '素材很好。好得让人有点难受。'),
                line('system', '涨粉 +，口碑 +3，但她知道你在拍。'),
              ],
            }),
        },
      ]
    },
  },

  {
    id: 'old_friend',
    title: '医疗器械的老同学',
    weight: 5,
    when: (c) => c.state.month >= 5,
    body: () => [
      line('narration', '大学同学打来电话。他现在在一家医疗器械公司做市场，想投一个「年轻化」的项目。'),
      line('narration', '预算六位数。条件是：企划得挂他们的 logo，并且做一期产品直播。'),
      line('quote', '“你不觉得这很讽刺吗？”', '运营'),
      line('quote', '“不觉得。这叫现金流。”', '鼠标'),
    ],
    choices: () => [
      {
        label: '接，做产品直播',
        apply: () =>
          outcome({
            money: money(120_000),
            reputation: -8,
            morale: { all: true, delta: -4 },
            logs: [
              line('narration', '产品直播做了两个小时。弹幕里有人问：「你们是不是被收购了？」'),
              line('narration', '运营说没有。'),
              line('narration', '六位数的转账到账那天，鼠标在办公室里一个人坐了一会儿。'),
              line('good', '资金 +¥120,000。'),
              line('bad', '口碑 -8。全企划心情 -4。'),
            ],
          }),
      },
      {
        label: '只接冠名，不做产品直播',
        apply: () =>
          outcome({
            money: money(50_000),
            reputation: 1,
            logs: [
              line('narration', '冠名的 logo 印在了所有物料的角落。很小，不显眼。'),
              line('narration', '老同学说：「你还是老样子。」'),
              line('quote', '“我只是不想再解释一次我在做什么。”', '鼠标'),
              line('good', '资金 +¥50,000。'),
            ],
          }),
      },
      {
        label: '拒绝',
        apply: () =>
          outcome({
            reputation: 4,
            morale: { all: true, delta: 4 },
            logs: [
              line('narration', '你说：「谢谢你想到我。但我想再试一次，不做这个也能活。」'),
              line('narration', '挂了电话之后，你打开了账本。'),
              line('quote', '“财务模型不健康。”你自己对自己说。'),
              line('narration', '然后你笑了。'),
              line('good', '口碑 +4。全企划心情 +4。'),
            ],
          }),
      },
    ],
  },

  {
    id: 'graduation_talk',
    title: '毕业',
    weight: 20,
    when: (c) => c.idols.some((i) => i.gradRisk >= 1),
    body: (c) => {
      const dying = c.idols.find((i) => i.gradRisk >= 1)!
      const def = IDOL_BY_ID.get(dying.id)!
      return [
        line('bad', `「${def.name}」说要跟你谈谈。她进门的时候手里拿着一张纸。`),
        line('narration', '那张纸是毕业申请书。已经写好了，只差签名。'),
        line('quote', '“我不是讨厌这里。”', def.name),
        line('quote', '“我只是……好像已经没有办法再开心地开播了。”', def.name),
      ]
    },
    choices: (c) => {
      const dying = c.idols.find((i) => i.gradRisk >= 1)!
      return [
        {
          label: '求她再给企划两个月',
          hint: '暂缓，心态大幅回升',
          apply: () =>
            outcome({
              morale: { ids: [dying.id], delta: 30 },
              logs: [
                line('narration', '你说：「两个月。如果两个月之后你还是想走，我签字。」'),
                line('narration', '她把那张纸折了起来，放进口袋。'),
                line('good', '倒计时重置。'),
              ],
            }),
        },
        {
          label: '给她一个「可以做自己」的新方向',
          hint: '花钱（¥30,000），彻底转向',
          cost: 30_000,
          apply: () =>
            outcome({
              money: money(-30_000),
              morale: { ids: [dying.id], delta: 34 },
              stat: { ids: [dying.id], key: 'charm', delta: 4 },
              flags: { savedWithDirection: true },
              logs: [
                line('narration', '你问她想做什么。她说了一个跟现在完全不一样的方向。'),
                line('narration', '你说：「那就做这个。」'),
                line('narration', '她抬起头看你，好像在确认你是不是认真的。'),
                line('good', '心态大幅回升。'),
              ],
            }),
        },
        {
          label: '签字，祝她前途光明',
          hint: '她走了',
          apply: () =>
            outcome({
              morale: { ids: [dying.id], delta: -100 },
              graduate: [dying.id],
              logs: [
                line('narration', '你签了字。她说了谢谢，说了对不起，说了很多。'),
                line('narration', '她走的时候，把自己那套皮套的数据打包发了过来，说：「这个留给你们。也许以后有人能用上。」'),
                line('bad', '企划少了一个人。'),
              ],
            }),
        },
      ]
    },
  },
]

export const EVENT_BY_ID = new Map(EVENTS.map((e) => [e.id, e]))
