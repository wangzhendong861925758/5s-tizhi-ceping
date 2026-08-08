// ============================================
// 数据层：生活习惯自检表
// 严格依据《功能新增.txt》###2 录入
// - 客户端基本信息 9 项（职业/工作环境/身体状况等）
// - 7 类生活方式问卷（饮食/睡觉/运动/毒素/寒湿/生活/情绪），勾选式
// - 7 类健康分析映射（贫血/微循环不通/毒素/血脂粘稠/寒凉湿症/免疫/情绪）
// ============================================

/**
 * 生活习惯自检表 - 客户端基本信息字段（9 项）
 * 前两项为单行文本，其余为多选/单选
 */
export const LIFESTYLE_INFO_FIELDS = [
  { key: 'profession', label: '职业', type: 'text', placeholder: '请输入您的职业', required: true },
  { key: 'workEnv', label: '工作环境', type: 'text', placeholder: '请描述您的工作环境', required: true },
  { key: 'bodyStatus', label: '目前身体状况', type: 'text', placeholder: '如：良好/有慢性病/易疲劳等', required: true },
  { key: 'mainSymptom', label: '目前最想解决的症状', type: 'text', placeholder: '请描述您最想改善的健康问题', required: true },
  { key: 'remark', label: '备注', type: 'textarea', placeholder: '其他需要说明的情况（选填）', required: false },
  {
    key: 'allergy',
    label: '有无过敏史',
    type: 'multi',
    options: [
      { value: 'drug', label: '药物过敏' },
      { value: 'food', label: '食物过敏' }
    ],
    required: false
  },
  { key: 'allergyOther', label: '其他', type: 'text', placeholder: '请填写其他过敏情况（选填）', required: false, parent: 'allergy' },
  {
    key: 'surgery',
    label: '是否做过手术',
    type: 'single',
    options: [
      { value: 'no', label: '否' },
      { value: 'yes', label: '是' }
    ],
    required: false
  },
  { key: 'surgeryContent', label: '手术内容', type: 'text', placeholder: '请填写手术内容（选填）', required: false, parent: 'surgery' },
  {
    key: 'history',
    label: '既往病史',
    type: 'multi',
    options: [
      { value: 'hypertension', label: '高血压' },
      { value: 'diabetes', label: '糖尿病' },
      { value: 'coronary', label: '冠心病' }
    ],
    required: false
  },
  { key: 'historyOther', label: '其他', type: 'text', placeholder: '请填写其他既往病史（选填）', required: false, parent: 'history' },
  {
    key: 'medication',
    label: '服用药物',
    type: 'multi',
    options: [
      { value: 'antihypertensive', label: '降压药' },
      { value: 'hypoglycemic', label: '降糖药' },
      { value: 'cardiovascular', label: '心脑血管病药物' }
    ],
    required: false
  },
  { key: 'medicationOther', label: '其他', type: 'text', placeholder: '请填写其他服用药物（选填）', required: false, parent: 'medication' }
];

/**
 * 7 类生活方式问卷
 * 每类包含若干条目，条目为「勾选式」（勾选=命中，未勾选=未命中）
 * key 命名规则：{categoryKey}-{seq}，如 diet-1、sleep-3
 */
export const LIFESTYLE_CATEGORIES = [
  {
    key: 'diet',
    name: '饮食',
    symbol: '食',
    color: '#D4A017',
    items: [
      '经常不吃早餐',
      '8点后吃晚饭/吃夜宵',
      '吃饭过饱/过急过快/过少',
      '常外面吃饭/点外卖',
      '常吃剩饭剩菜/爱吃动物内脏',
      '常吃肉食/吃菜喜油多',
      '偏辣/便咸(口味重)',
      '很少吃蔬菜/素食者',
      '喜欢吃烫食/烫水',
      '喜精米/精面/喜主食',
      '很少吃五谷杂粮',
      '偏食/挑食/嗜吃某种食物',
      '常喝酒/酗酒/冰啤酒',
      '喜饭后吃水果/偏水果',
      '爱吃反季节蔬菜、水果',
      '喜欢吃螃蟹/柿子',
      '不吃坚果/吃花生瓜子多',
      '喜欢吃方便面类/甜食',
      '吃油炸食品/腌制食品',
      '喜欢吃果脯蜜饯/罐头',
      '吃冰西瓜/偏水果/',
      '喜吃烧烤/零食/爱吃鸡头',
      '烧烤.火锅+冰啤饮料不喝水/很少喝水/喝凉水',
      '吃雪糕/冰冻甜品/饮料',
      '吃饭不分筷/吃饭快/吃烫饭/爱吃油炸物',
      '喜喝浓茶/咖啡/腌制食物',
      '饮食时间不规律，二手烟',
      '常吃中、西药/吃激素药',
      '吃过减肥药/做过减肥',
      '常吃海鲜，炒菜油冒烟'
    ]
  },
  {
    key: 'sleep',
    name: '睡觉',
    symbol: '眠',
    color: '#5BA3D0',
    items: [
      '晚过11点睡早9点后起',
      '经常上夜班(到天亮)',
      '睡眠不足7-8小时',
      '睡软床/枕高枕',
      '开空调/开窗睡觉',
      '饭后立刻睡觉',
      '睡觉把脚放被子外',
      '早睡早起5点前起',
      '蒙头睡觉'
    ]
  },
  {
    key: 'exercise',
    name: '运动',
    symbol: '动',
    color: '#9ACD32',
    items: [
      '早5点前晚7点后运动',
      '不运动/少运动/超运动',
      '久站/久坐/久伏案工作',
      '每天超过一万步',
      '长时间游泳/冬泳',
      '体力劳动过多/喜游泳',
      '练瑜伽',
      '曾经体育运动员'
    ]
  },
  {
    key: 'toxin',
    name: '毒素',
    symbol: '毒',
    color: '#8E7CC3',
    items: [
      '手机在床边充电/放头附近睡觉',
      '住房附近 20 公里有化工厂/药厂/化肥厂/造纸厂/印染厂/橡胶厂/接触建筑材料/石灰厂',
      '常烫发/染发/化妆品/涂指甲油',
      '不用抽油烟机或抽油烟机不好用',
      '长期受汽车尾气/灰尘/粉尘困扰',
      '小孩子用铅笔剃牙/涂抹祛斑霜',
      '爱用 84消毒液/脱色剂/强力除油剂',
      '爱用水果清洗剂',
      '不带正规放毒面具或者防护服喷洒农药',
      '叼着包装袋喝奶/喝饮料'
    ]
  },
  {
    key: 'cold',
    name: '寒湿',
    symbol: '寒',
    color: '#5BA3D0',
    items: [
      '开窗户、开空调睡觉',
      '很少晒太阳',
      '长期在空调房工作',
      '在地下室或冷库工作',
      '早上洗头洗澡',
      '晚上11点后洗头洗澡',
      '冷水洗头洗澡/天天洗澡',
      '洗头后不及时吹干',
      '运动后立即洗澡',
      '冷水洗脚不擦干',
      '喜欢光脚在地上走',
      '冬天冷水洗菜.碗衣物',
      '下河(有严重受寒经历)',
      '喜欢露肩/露腰/露脚踝',
      '四季穿凉鞋/冬天穿少穿薄',
      '睡觉时把脚放被子外',
      '骑电动车没有保护',
      '出汗时、生气时喝凉水'
    ]
  },
  {
    key: 'life',
    name: '生活',
    symbol: '生',
    color: '#A0826D',
    items: [
      '抽烟每天超过10根/吸二手烟',
      '低头玩手机/上电脑多',
      '经常过度疲劳/房屋过度装修',
      '经常憋尿/不按时排便',
      '手淫/意淫/看色情视频或资料',
      '性生活频繁/性欲低，',
      '戴深色口罩/住在变电站附近',
      '从小到大用过抗生素消炎药',
      '爱咬手指甲/咬笔杆/咬筷子',
      '爱躺着看电视/玩手机'
    ]
  },
  {
    key: 'emotion',
    name: '情绪',
    symbol: '情',
    color: '#A8324A',
    items: [
      '有重大变故(情感)',
      '经常生气/爱发脾气',
      '压力大/精神紧张',
      '愤怒/憎恨/内疚/心事重',
      '思念/思虑/担惊受怕',
      '遇事爱抱怨/找外因/善嫉妒',
      '父母离异/悲愤/有被遗弃感',
      '丧偶/丧子(女)/丧父(母)',
      '没有信念/空虚无助',
      '不情愿忍让/自己生闷气',
      '欲望得不到/失望(对人)',
      '莫名的暴躁/发脾气抑郁',
      '自卑/软弱/缺乏安全感/无助',
      '生气/气愤/发怒/恼怒/盛怒',
      '伤心/难受/痛苦/悲痛/哀痛',
      '忧虑/忧愁/哀愁/忧郁/抑郁',
      '害怕/惊慌/恐惧/恐慌/惊恐',
      '从小被打骂/冷落/嫌弃/刺激',
      '懒惰不上进没活力',
      '胆小怕事/长时间欲而不得',
      '心浮躁/无爱好/无主见',
      '抱怨命运不济/没事缠身',
      '月子里生气',
      '性子急/爱骂人',
      '喜欢追剧/看恐怖片',
      '爱攀比/气人有/笑人无',
      '过渡兴奋/激动/亢奋'
    ]
  }
];

/**
 * 为每条目生成唯一 key：{categoryKey}-{seq}
 */
LIFESTYLE_CATEGORIES.forEach((cat) => {
  cat.items = cat.items.map((text, idx) => ({
    key: `${cat.key}-${idx + 1}`,
    seq: idx + 1,
    text
  }));
});

/** 总条目数 */
export const LIFESTYLE_TOTAL = LIFESTYLE_CATEGORIES.reduce(
  (sum, c) => sum + c.items.length,
  0
);

/**
 * 7 类健康分析映射
 * 每类列出命中的条目 key（按"类别-序号"格式）
 * 严格按需求文档原文录入
 */
export const HEALTH_ANALYSIS = [
  {
    key: 'anemia',
    name: '贫血（气血不足）',
    symbol: '血',
    color: '#E8743C',
    mapping: [
      { cat: 'diet', seqs: [1, 2, 3, 7, 8, 11, 13, 14, 21, 23, 24, 26, 27, 29] },
      { cat: 'sleep', seqs: [1, 3, 7, 9] },
      { cat: 'exercise', seqs: [1, 2, 3] },
      { cat: 'cold', seqs: [1, 4, 6, 7, 10, 12, 14, 16] },
      { cat: 'emotion', seqs: [3, 10, 13, 23] },
      { cat: 'life', seqs: [4, 7, 10] }
    ]
  },
  {
    key: 'microcirculation',
    name: '微循环不通',
    symbol: '微',
    color: '#8E7CC3',
    mapping: [
      { cat: 'exercise', seqs: [1, 2, 3, 4, 5, 6, 8] },
      { cat: 'cold', seqs: [1, 3, 7, 11, 12, 14, 15, 16] },
      { cat: 'diet', seqs: [5, 6, 13, 20, 26, 28] },
      { cat: 'sleep', seqs: [2, 4, 6] },
      { cat: 'toxin', seqs: [1, 2, 4, 6, 8] },
      { cat: 'emotion', seqs: [12, 15, 16] },
      { cat: 'life', seqs: [2, 9] }
    ]
  },
  {
    key: 'toxin',
    name: '毒素',
    symbol: '毒',
    color: '#6B5B95',
    mapping: [
      { cat: 'toxin', seqs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      { cat: 'diet', seqs: [4, 5, 18, 22, 23, 28, 29, 30] },
      { cat: 'life', seqs: [1, 5, 8] },
      { cat: 'emotion', seqs: [17] }
    ]
  },
  {
    key: 'bloodFat',
    name: '血脂粘稠',
    symbol: '脂',
    color: '#D4A017',
    mapping: [
      { cat: 'diet', seqs: [4, 5, 6, 18, 20, 22, 30] },
      { cat: 'exercise', seqs: [3, 4, 8] },
      { cat: 'toxin', seqs: [4, 5, 7, 8] },
      { cat: 'life', seqs: [8] }
    ]
  },
  {
    key: 'coldWet',
    name: '寒凉湿症',
    symbol: '寒',
    color: '#5BA3D0',
    mapping: [
      { cat: 'cold', seqs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] },
      { cat: 'diet', seqs: [9, 14, 21, 23, 24] },
      { cat: 'sleep', seqs: [4, 7, 9] }
    ]
  },
  {
    key: 'immunity',
    name: '免疫',
    symbol: '免',
    color: '#20B2AA',
    mapping: [
      { cat: 'sleep', seqs: [1, 2, 3, 9] },
      { cat: 'exercise', seqs: [2, 6] },
      { cat: 'toxin', seqs: [1, 2, 3, 9] },
      { cat: 'cold', seqs: [2, 3, 8, 17] },
      { cat: 'emotion', seqs: [9, 18, 20] },
      { cat: 'diet', seqs: [8, 27, 28] },
      { cat: 'life', seqs: [8] }
    ]
  },
  {
    key: 'emotion',
    name: '情绪',
    symbol: '情',
    color: '#A8324A',
    mapping: [
      {
        cat: 'emotion',
        seqs: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27]
      }
    ]
  }
];

/** 通过 cat+seq 查询条目原文 */
export function findLifestyleItem(cat, seq) {
  const c = LIFESTYLE_CATEGORIES.find((x) => x.key === cat);
  if (!c) return null;
  return c.items.find((it) => it.seq === seq) || null;
}
