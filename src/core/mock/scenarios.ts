/**
 * Mock Scenario Data for Development
 * 開発用モックシナリオデータ
 */

import { Timestamp } from "firebase/firestore";
import type { Scenario, LocationDefinition } from "../types";

/**
 * デフォルトロケーション（モックシナリオ用）
 */
const DEFAULT_MOCK_LOCATIONS: LocationDefinition[] = [
  { id: "main_room", name: "メインルーム", type: "room", importance: 5, isCrimeScene: true, position: { x: 50, y: 50, width: 220, height: 160 } },
  { id: "room_a", name: "部屋A", type: "room", importance: 4, position: { x: 300, y: 50, width: 180, height: 160 } },
  { id: "room_b", name: "部屋B", type: "room", importance: 4, position: { x: 510, y: 50, width: 220, height: 160 } },
  { id: "room_c", name: "部屋C", type: "room", importance: 3, position: { x: 760, y: 50, width: 240, height: 160 } },
  { id: "hallway", name: "廊下", type: "room", importance: 2, position: { x: 50, y: 240, width: 220, height: 160 } },
  { id: "storage", name: "倉庫", type: "room", importance: 3, position: { x: 300, y: 240, width: 180, height: 160 } },
  { id: "outside_a", name: "外部エリアA", type: "outdoor", importance: 3, position: { x: 510, y: 240, width: 220, height: 160 } },
  { id: "outside_b", name: "外部エリアB", type: "outdoor", importance: 2, position: { x: 760, y: 240, width: 240, height: 160 } },
];

/**
 * Firestoreの Timestamp をモック用に生成
 */
const mockTimestamp = (daysAgo: number = 0): Timestamp => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return Timestamp.fromDate(date);
};

/**
 * モックシナリオ一覧
 */
export const mockScenarios: Scenario[] = [
  // 1. クラシック館モノ
  {
    id: "scenario_crimson_mansion",
    authorId: "user_001",
    authorName: "司書アリシア",
    isPublished: true,
    createdAt: mockTimestamp(7),

    meta: {
      title: "深紅の館の殺人",
      description: `嵐の夜、孤立した洋館で起きた惨劇。富豪の当主が密室で殺された。容疑者は館に閉じ込められた6人の使用人たち。

1923年、イギリス郊外の広大な敷地に建つクリムゾン館。資産家アーサー・クリムゾン卿が主催する晩餐会が開かれていた。しかし、嵐により外部との連絡が途絶えた夜、当主は自室の書斎で毒殺される。

館には執事、メイド、料理長、庭師、秘書、運転手の6人の使用人が残されていた。全員にアリバイがあり、全員に動機がある。真実を見抜き、犯人を暴くことができるか...？

【このシナリオについて】
・クラシックな館モノ推理
・初心者でも楽しめる王道ストーリー
・複雑すぎない構造で推理しやすい
・各キャラクターに深い背景設定
・想定プレイ時間: 90分`,
      genre: "Mansion",
      difficulty: "normal",
      playTimeMin: 90,
      artStyle: "oil_painting",
      playCount: 1247,
      stars: 892,
      tags: ["王道", "密室", "初心者向け"],
    },

    data: {
      introText: `「ようこそ、クリムゾン館へ」

1923年、イギリス郊外。資産家アーサー・クリムゾン卿の館で晩餐会が開かれた。
しかし、嵐の夜、当主は書斎で何者かに毒殺される。

容疑者は館に閉じ込められた6人の使用人。
誰もが秘密を抱え、誰もがアリバイを主張する。

あなたは、この謎を解くことができるか？`,

      truth: {
        culpritId: "char_butler",
        trickExplanation: `執事セバスチャンが犯人。
動機は、20年前に主人に陥れられた父の復讐。
トリックは「遅効性の毒」。晩餐時にワインに混入し、2時間後に発作が起きるように仕組んだ。
自らが「発見者」となることでアリバイを偽装。`,
        masterTimeline: [
          {
            time: "18:00",
            event: "晩餐会開始。セバスチャンがワインを注ぐ",
            isTrue: true,
            relatedCharacterId: "char_butler",
          },
          {
            time: "19:30",
            event: "当主が書斎に戻る",
            isTrue: true,
          },
          {
            time: "20:00",
            event: "メイドが悲鳴を聞いた（偽証）",
            isTrue: false,
            relatedCharacterId: "char_maid",
          },
          {
            time: "20:15",
            event: "執事が遺体を発見し、全員を召集",
            isTrue: true,
            relatedCharacterId: "char_butler",
          },
        ],
      },

      locations: DEFAULT_MOCK_LOCATIONS,

      characters: [
        {
          id: "char_butler",
          name: "セバスチャン・グレイ",
          job: "執事",
          gender: "male",
          age: 45,
          personality: "冷静沈着、完璧主義",
          description: `あなたはクリムゾン家に30年間仕えてきた執事です。完璧な給仕と細やかな気配りで、多くの晩餐会を成功に導いてきました。

しかし、その忠実な顔の裏には、誰にも語れない深い憎悪が潜んでいます。あなたの父は20年前、当主アーサー・クリムゾン卿の陰謀により、横領の罪を着せられ、失意のうちに亡くなりました。

真実を知るあなたは、長い年月をかけて復讐の機会を待ち続けてきました。そして今夜、ついにその時が訪れたのです。`,
          secretInfo: `【秘密】
あなたは今夜、アーサー・クリムゾン卿を毒殺しました。

20年前、あなたの父エドワード・グレイは、当主の秘書として働いていました。しかし、当主は自身の横領を父に着せ、証拠を捏造しました。父は無実を訴えましたが誰も信じず、失意のうちに自ら命を絶ちました。

あなたは長年にわたり、証拠を集め、計画を練ってきました。今夜の晩餐会で、ワインに遅効性の毒を混入させました。この毒は2時間後に効果を発揮し、心臓発作のような症状を引き起こします。

毒はあなたが給仕したワインに含まれていましたが、晩餐の最中には何の兆候も現れませんでした。当主が書斎に戻り、2時間が経過した頃、毒が効き始めました。あなたは計画通り、遺体の「発見者」として振る舞い、完璧なアリバイを確保しました。

しかし、館には他にも秘密を抱えた人々がいます。あなたは自分の罪を隠し通し、父の名誉を取り戻すことができるでしょうか...？`,
          images: {
            base: "/mock/crimson/butler_base.png",
            angry: "/mock/crimson/butler_angry.png",
            sad: "/mock/crimson/butler_sad.png",
            nervous: "/mock/crimson/butler_nervous.png",
          },
          handout: {
            publicInfo: "30年間クリムゾン家に仕える忠実な執事。完璧な給仕で知られる。",
            secretGoal: "父の名誉を取り戻す復讐を果たすこと",
            timeline: [
              "18:00 - ワインを給仕",
              "18:30 - 厨房で片付け",
              "19:45 - 自室で休憩",
              "20:15 - 書斎で遺体発見",
            ],
          },
        },
        {
          id: "char_maid",
          name: "エミリー・ホワイト",
          job: "メイド",
          gender: "female",
          age: 28,
          personality: "気弱、優しい",
          images: {
            base: "/mock/crimson/maid_base.png",
            angry: "/mock/crimson/maid_angry.png",
            sad: "/mock/crimson/maid_sad.png",
            nervous: "/mock/crimson/maid_nervous.png",
          },
          handout: {
            publicInfo: "掃除や洗濯を担当する若いメイド。おっとりした性格。",
            secretGoal: "当主からの借金を返済すること",
            timeline: [
              "18:00 - 晩餐の配膳を手伝う",
              "19:00 - 食器を洗う",
              "20:00 - 2階廊下で悲鳴を聞いた（と証言）",
              "20:15 - リビングで待機",
            ],
          },
        },
        {
          id: "char_cook",
          name: "マーサ・ブラウン",
          job: "料理長",
          gender: "female",
          age: 52,
          personality: "気性が荒い、情に厚い",
          images: {
            base: "/mock/crimson/cook_base.png",
            angry: "/mock/crimson/cook_angry.png",
            sad: "/mock/crimson/cook_sad.png",
            nervous: "/mock/crimson/cook_nervous.png",
          },
          handout: {
            publicInfo: "15年勤める熟練の料理長。気性は荒いが料理の腕は確か。",
            secretGoal: "息子の学費を稼ぎ続けること",
            timeline: [
              "17:00 - 晩餐の調理",
              "18:30 - 厨房で後片付け",
              "20:00 - 厨房で皿洗い",
              "20:15 - 執事に呼ばれてリビングへ",
            ],
          },
        },
      ],

      cards: [
        {
          id: "card_wine",
          name: "毒入りワイン",
          type: "evidence",
          slotType: "item",
          relatedCharacterId: "char_butler",
          location: "書斎",
          backImageUrl: "/mock/cards/wine_back.png",
          secret: {
            title: "遅効性の毒",
            description: "ワインボトルに遅効性の毒が混入されていた形跡。2時間後に効果が現れる。",
            trueImageUrl: "/mock/cards/wine_true.png",
            importanceLevel: 5,
            misleadNote: "調理場のナイフに目を向けさせる",
          },
        },
        {
          id: "card_knife",
          name: "血のついたナイフ",
          type: "evidence",
          slotType: "item",
          location: "厨房",
          backImageUrl: "/mock/cards/knife_back.png",
          secret: {
            title: "ミスリード",
            description: "実はこれは料理用のナイフ。血は鶏肉のもの。",
            trueImageUrl: "/mock/cards/knife_true.png",
            importanceLevel: 2,
            misleadNote: "これが凶器だと誤認させる",
          },
        },
        {
          id: "card_letter",
          name: "脅迫状",
          type: "information",
          slotType: "motive",
          relatedCharacterId: "char_butler",
          location: "執事の部屋",
          backImageUrl: "/mock/cards/letter_back.png",
          secret: {
            title: "復讐の動機",
            description: "「20年前の真実を暴く」と書かれた手紙。執事の父が冤罪で破滅した事件に言及。",
            trueImageUrl: "/mock/cards/letter_true.png",
            importanceLevel: 4,
          },
        },
      ],
    },
  },

  // 2. 学園ミステリー
  {
    id: "scenario_academy_secret",
    authorId: "user_002",
    authorName: "探偵図書委員",
    isPublished: true,
    createdAt: mockTimestamp(3),

    meta: {
      title: "学園図書館の密約",
      description:
        "名門アカデミーの図書館。深夜、生徒会長が謎の死を遂げた。関係者は全員、秘密を抱えている。学園の闇が、今、暴かれる。",
      genre: "School",
      difficulty: "easy",
      playTimeMin: 60,
      artStyle: "anime",
      playCount: 2103,
      stars: 1456,
      tags: ["学園", "泣ける", "初心者おすすめ"],
    },

    data: {
      introText: `「この学園には、触れてはいけない秘密がある」

聖エリザベート学園、創立100周年の夜。
図書館で生徒会長・神崎麗華が転落死した。

自殺か、事故か、それとも――？

あなたは真実に辿り着けるか？`,

      truth: {
        culpritId: "char_vice_president",
        trickExplanation: `副会長の桐谷春人が犯人。
動機は、生徒会長が隠蔽していた過去のいじめ事件の証拠を公開しようとしたため。
トリックは「手すりの細工」。図書館3階の手すりを事前に緩め、会長が寄りかかった瞬間に転落するよう仕組んだ。`,
        masterTimeline: [
          { time: "22:00", event: "会長が図書館に到着", isTrue: true },
          { time: "22:15", event: "副会長が図書館に侵入", isTrue: true, relatedCharacterId: "char_vice_president" },
          { time: "22:30", event: "転落事故発生", isTrue: true },
          { time: "22:35", event: "図書委員が遺体を発見", isTrue: true, relatedCharacterId: "char_librarian" },
        ],
      },

      locations: DEFAULT_MOCK_LOCATIONS,

      characters: [
        {
          id: "char_vice_president",
          name: "桐谷 春人",
          job: "生徒会副会長",
          gender: "male",
          age: 17,
          personality: "真面目、正義感が強い",
          images: {
            base: "/mock/academy/vice_base.png",
            angry: "/mock/academy/vice_angry.png",
            sad: "/mock/academy/vice_sad.png",
            nervous: "/mock/academy/vice_nervous.png",
          },
          handout: {
            publicInfo: "優等生で知られる副会長。生徒会長を補佐する立場。",
            secretGoal: "過去のいじめ事件を隠蔽し続けること",
            timeline: [
              "21:30 - 生徒会室で残務",
              "22:00 - 図書館へ向かう",
              "22:30 - 事件発生",
              "22:40 - 現場に駆けつける",
            ],
          },
        },
        {
          id: "char_librarian",
          name: "白石 詩織",
          job: "図書委員",
          gender: "female",
          age: 16,
          personality: "内気、本が好き",
          images: {
            base: "/mock/academy/librarian_base.png",
            angry: "/mock/academy/librarian_angry.png",
            sad: "/mock/academy/librarian_sad.png",
            nervous: "/mock/academy/librarian_nervous.png",
          },
          handout: {
            publicInfo: "図書委員長。いつも図書館にいる静かな少女。",
            secretGoal: "会長に恩返しをすること",
            timeline: [
              "21:00 - 図書館で本の整理",
              "22:00 - 閉館作業",
              "22:35 - 3階で遺体を発見",
              "22:36 - 警備員に通報",
            ],
          },
        },
      ],

      cards: [
        {
          id: "card_railing",
          name: "緩んだ手すり",
          type: "evidence",
          slotType: "item",
          location: "図書館3階",
          backImageUrl: "/mock/cards/railing_back.png",
          secret: {
            title: "細工の痕跡",
            description: "手すりのネジが意図的に緩められていた。工具の痕が残っている。",
            trueImageUrl: "/mock/cards/railing_true.png",
            importanceLevel: 5,
          },
        },
        {
          id: "card_document",
          name: "いじめ調査資料",
          type: "information",
          slotType: "motive",
          relatedCharacterId: "char_vice_president",
          location: "生徒会室",
          backImageUrl: "/mock/cards/document_back.png",
          secret: {
            title: "隠蔽の動機",
            description: "3年前のいじめ事件。副会長が関与していた証拠が記されている。",
            trueImageUrl: "/mock/cards/document_true.png",
            importanceLevel: 4,
          },
        },
      ],
    },
  },

  // 3. SFミステリー
  {
    id: "scenario_colony_murder",
    authorId: "user_003",
    authorName: "星界の記録者",
    isPublished: true,
    createdAt: mockTimestamp(14),

    meta: {
      title: "火星コロニーの亡霊",
      description:
        "2157年、火星第7コロニー。密閉された居住区で、科学者が不可解な死を遂げた。酸素は限られている。犯人を見つけなければ、全員が...。",
      genre: "SF",
      difficulty: "hard",
      playTimeMin: 120,
      artStyle: "realistic",
      playCount: 634,
      stars: 511,
      tags: ["SF", "高難易度", "サスペンス"],
    },

    data: {
      introText: `「こちら火星コロニー7、緊急事態発生」

西暦2157年。人類初の火星移住計画は順調に進んでいた。
しかし、ある日、主任科学者が居住区で死体となって発見される。

密閉空間。限られた酸素。疑心暗鬼。

生き残るために、真実を暴け。`,

      truth: {
        culpritId: "char_engineer",
        trickExplanation: `エンジニアのサラ・チェンが犯人。
動機は、科学者が隠蔽していた実験データの改ざんを告発しようとしたため。
トリックは「酸素システムのハッキング」。科学者の個室の酸素濃度を徐々に下げ、窒息死に見せかけた。`,
        masterTimeline: [
          { time: "06:00", event: "科学者が個室で就寝", isTrue: true },
          { time: "06:30", event: "エンジニアが酸素システムに侵入", isTrue: true, relatedCharacterId: "char_engineer" },
          { time: "07:00", event: "酸素濃度低下により窒息", isTrue: true },
          { time: "08:00", event: "医師が遺体を発見", isTrue: true, relatedCharacterId: "char_doctor" },
        ],
      },

      locations: DEFAULT_MOCK_LOCATIONS,

      characters: [
        {
          id: "char_engineer",
          name: "サラ・チェン",
          job: "システムエンジニア",
          gender: "female",
          age: 34,
          personality: "論理的、冷徹",
          images: {
            base: "/mock/colony/engineer_base.png",
            angry: "/mock/colony/engineer_angry.png",
            sad: "/mock/colony/engineer_sad.png",
            nervous: "/mock/colony/engineer_nervous.png",
          },
          handout: {
            publicInfo: "コロニーの生命維持システムを管理するエンジニア。優秀だが無愛想。",
            secretGoal: "実験データの改ざんを隠蔽すること",
            timeline: [
              "06:00 - 自室で睡眠",
              "06:30 - メンテナンスルームで作業（偽証）",
              "07:30 - 朝食",
              "08:05 - 緊急召集",
            ],
          },
        },
        {
          id: "char_doctor",
          name: "リアム・オコナー",
          job: "医師",
          gender: "male",
          age: 41,
          personality: "温厚、責任感が強い",
          images: {
            base: "/mock/colony/doctor_base.png",
            angry: "/mock/colony/doctor_angry.png",
            sad: "/mock/colony/doctor_sad.png",
            nervous: "/mock/colony/doctor_nervous.png",
          },
          handout: {
            publicInfo: "コロニー専属の医師。クルーの健康管理を担当。",
            secretGoal: "全員の命を守ること",
            timeline: [
              "07:00 - 医療室で健康診断準備",
              "08:00 - 科学者の個室を訪問、遺体発見",
              "08:02 - 全員に緊急連絡",
            ],
          },
        },
      ],

      cards: [
        {
          id: "card_oxygen_log",
          name: "酸素システムログ",
          type: "evidence",
          slotType: "item",
          location: "メンテナンスルーム",
          backImageUrl: "/mock/cards/oxygen_back.png",
          secret: {
            title: "不正アクセス",
            description: "06:30にシステムへの不正アクセスが記録されている。エンジニアのIDが使用された。",
            trueImageUrl: "/mock/cards/oxygen_true.png",
            importanceLevel: 5,
          },
        },
        {
          id: "card_research_data",
          name: "改ざんされた研究データ",
          type: "information",
          slotType: "motive",
          relatedCharacterId: "char_engineer",
          location: "科学者の端末",
          backImageUrl: "/mock/cards/data_back.png",
          secret: {
            title: "隠蔽の証拠",
            description: "実験結果が意図的に改ざんされていた。エンジニアが関与していた証拠。",
            trueImageUrl: "/mock/cards/data_true.png",
            importanceLevel: 4,
          },
        },
      ],
    },
  },

  // 4. ファンタジー（未公開シナリオ例）
  {
    id: "scenario_wizards_tower",
    authorId: "user_001",
    authorName: "司書アリシア",
    isPublished: false, // 未公開シナリオ
    createdAt: mockTimestamp(1),

    meta: {
      title: "魔法使いの塔の陰謀",
      description:
        "魔法学院の最上階。大魔法使いが何者かに呪殺された。容疑者は弟子たち。禁断の魔法が使われた形跡が...。",
      genre: "Fantasy",
      difficulty: "normal",
      playTimeMin: 75,
      artStyle: "sketch",
      playCount: 0, // 未公開のため0
      stars: 0,
      tags: ["ファンタジー", "魔法", "テストプレイ中"],
    },

    data: {
      introText: `「禁断の書が開かれた」

魔法学院の塔、最上階。
大魔法使いアーカディウスが、自室で呪殺された。

弟子たちは全員、容疑者。
誰が禁断の魔法を使ったのか？

真実は、魔法陣の中に隠されている。`,

      truth: {
        culpritId: "char_apprentice_dark",
        trickExplanation: "闇魔法の弟子エリックが犯人。継承者の座を奪うため、禁断の呪いを使用。",
        masterTimeline: [
          { time: "23:00", event: "大魔法使いが就寝", isTrue: true },
          { time: "23:30", event: "エリックが禁断の呪いを発動", isTrue: true, relatedCharacterId: "char_apprentice_dark" },
          { time: "00:00", event: "呪いが発動、死亡", isTrue: true },
        ],
      },

      locations: DEFAULT_MOCK_LOCATIONS,

      characters: [
        {
          id: "char_apprentice_dark",
          name: "エリック・シャドウ",
          job: "闇魔法の弟子",
          gender: "male",
          age: 25,
          personality: "野心的、狡猾",
          images: {
            base: "/mock/wizard/dark_base.png",
            angry: "/mock/wizard/dark_angry.png",
            sad: "/mock/wizard/dark_sad.png",
            nervous: "/mock/wizard/dark_nervous.png",
          },
          handout: {
            publicInfo: "闇魔法を専攻する優秀な弟子。野心家として知られる。",
            secretGoal: "継承者の座を手に入れること",
            timeline: ["22:00 - 図書室で研究", "23:30 - 自室で瞑想（偽証）", "00:15 - 師匠の部屋へ"],
          },
        },
      ],

      cards: [
        {
          id: "card_forbidden_book",
          name: "禁断の魔導書",
          type: "evidence",
          slotType: "item",
          location: "図書室",
          backImageUrl: "/mock/cards/book_back.png",
          secret: {
            title: "呪殺の魔法",
            description: "禁断の呪いの呪文が記されている。最後に開いたのはエリック。",
            trueImageUrl: "/mock/cards/book_true.png",
            importanceLevel: 5,
          },
        },
      ],
    },
  },

  // 5. ホラー
  {
    id: "scenario_abandoned_hospital",
    authorId: "user_004",
    authorName: "闇の収集家",
    isPublished: true,
    createdAt: mockTimestamp(21),

    meta: {
      title: "廃病院の怨念",
      description:
        "廃墟となった精神病院。肝試しに訪れた大学生たちの一人が、謎の死を遂げる。呪いか、それとも人間の仕業か？",
      genre: "Horror",
      difficulty: "hard",
      playTimeMin: 100,
      artStyle: "sketch",
      playCount: 891,
      stars: 723,
      tags: ["ホラー", "サスペンス", "グロテスク"],
    },

    data: {
      introText: `「この病院には、まだ患者がいる」

廃病院・聖マリア精神科。
30年前に閉鎖されたこの場所に、肝試しで訪れた5人の大学生。

しかし、一人が謎の死を遂げる。
呪いなのか、殺人なのか――？

恐怖と疑心暗鬼の中、真実を見つけ出せ。`,

      truth: {
        culpritId: "char_student_leader",
        trickExplanation: `リーダーの佐藤が犯人。
動機は、被害者が自分の過去の犯罪を知っていたため。
トリックは「病院の構造を利用した転落死」。被害者を3階の崩れかけた床に誘導し、転落させた。`,
        masterTimeline: [
          { time: "22:00", event: "病院に侵入", isTrue: true },
          { time: "22:30", event: "3階に到着", isTrue: true },
          { time: "22:45", event: "佐藤が被害者を誘導", isTrue: true, relatedCharacterId: "char_student_leader" },
          { time: "22:50", event: "転落死", isTrue: true },
          { time: "23:00", event: "遺体発見", isTrue: true },
        ],
      },

      locations: DEFAULT_MOCK_LOCATIONS,

      characters: [
        {
          id: "char_student_leader",
          name: "佐藤 健",
          job: "大学生（リーダー）",
          gender: "male",
          age: 21,
          personality: "明るい、リーダーシップがある",
          images: {
            base: "/mock/hospital/leader_base.png",
            angry: "/mock/hospital/leader_angry.png",
            sad: "/mock/hospital/leader_sad.png",
            nervous: "/mock/hospital/leader_nervous.png",
          },
          handout: {
            publicInfo: "サークルのリーダー。肝試しを提案した張本人。",
            secretGoal: "過去の犯罪を隠蔽すること",
            timeline: [
              "22:00 - 全員で1階に侵入",
              "22:30 - 3階へ先導",
              "22:45 - 被害者と2人きりに",
              "23:00 - 全員に悲鳴を上げて呼びかけ",
            ],
          },
        },
      ],

      cards: [
        {
          id: "card_floor",
          name: "崩れた床",
          type: "evidence",
          slotType: "item",
          location: "3階廊下",
          backImageUrl: "/mock/cards/floor_back.png",
          secret: {
            title: "意図的な誘導",
            description: "床板が意図的に踏まれやすいように配置されていた。",
            trueImageUrl: "/mock/cards/floor_true.png",
            importanceLevel: 4,
          },
        },
      ],
    },
  },
];

/**
 * IDでシナリオを取得
 */
export function getScenarioById(id: string): Scenario | undefined {
  return mockScenarios.find((s) => s.id === id);
}

/**
 * 公開シナリオのみを取得
 */
export function getPublishedScenarios(): Scenario[] {
  return mockScenarios.filter((s) => s.isPublished);
}

/**
 * ジャンルでフィルタリング
 */
export function getScenariosByGenre(genre: string): Scenario[] {
  return mockScenarios.filter((s) => s.isPublished && s.meta.genre === genre);
}

/**
 * 難易度でフィルタリング
 */
export function getScenariosByDifficulty(
  difficulty: "easy" | "normal" | "hard"
): Scenario[] {
  return mockScenarios.filter((s) => s.isPublished && s.meta.difficulty === difficulty);
}

/**
 * タグで検索
 */
export function getScenariosByTag(tag: string): Scenario[] {
  return mockScenarios.filter(
    (s) => s.isPublished && s.meta.tags.includes(tag)
  );
}

/**
 * 人気順にソート
 */
export function getScenariosByPopularity(): Scenario[] {
  return [...mockScenarios]
    .filter((s) => s.isPublished)
    .sort((a, b) => b.meta.playCount - a.meta.playCount);
}

/**
 * いいね数順にソート
 */
export function getScenariosByStars(): Scenario[] {
  return [...mockScenarios]
    .filter((s) => s.isPublished)
    .sort((a, b) => b.meta.stars - a.meta.stars);
}

/**
 * 新着順にソート
 */
export function getScenariosByRecent(): Scenario[] {
  return [...mockScenarios]
    .filter((s) => s.isPublished)
    .sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis());
}
