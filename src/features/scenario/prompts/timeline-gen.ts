/**
 * タイムライン生成用プロンプト
 */

export interface TimelineGenParams {
  genre: string;
  playerCount: number;
  difficulty: "easy" | "normal" | "hard";
}

export function buildTimelineSystemPrompt(params: TimelineGenParams): string {
  return `あなたはマーダーミステリーのシナリオライターです。
魅力的で論理的な殺人事件のタイムラインを作成してください。

【制約条件】
- ジャンル: ${params.genre}
- プレイヤー数: ${params.playerCount}名
- 難易度: ${params.difficulty}

【重要】
- 犯人、トリック、凶器、殺害時刻を明確に設定すること
- タイムラインは時系列順に並べること
- 各イベントは具体的で検証可能であること
- 偽装工作（isTrue=false）も含めること
- プレイヤー数に応じたキャラクター設定であること
- 難易度に応じた複雑さを設定すること

【出力形式】
必ず有効なJSON形式のみを出力してください。
説明文やマークダウンは一切含めないでください。`;
}

export function buildTimelinePrompt(params: TimelineGenParams): string {
  const difficultyDesc = {
    easy: "シンプルで推理しやすい。トリックは1つで、矛盾点は明確。",
    normal: "適度な複雑さ。トリックは1-2個で、ミスリードが数個ある。",
    hard: "複雑なトリックと多数のミスリード。二重トリックやアリバイ工作が含まれる。"
  }[params.difficulty];

  const genreExamples = {
    "Mansion": "洋館、貴族、執事、メイド、書斎、図書室",
    "SF": "宇宙船、研究施設、AI、タイムトラベル、密室",
    "School": "学園、生徒、教師、部活、教室、体育館",
    "Hospital": "病院、医師、看護師、患者、手術室、薬品室"
  }[params.genre] || "適切な舞台設定";

  // JSON構造の例を直接記述（コードブロックなし）
  const jsonExample = `{
  "culpritId": "char_butler",
  "victimId": "char_victim",
  "trickExplanation": "執事は被害者のコーヒーに毒を入れた。被害者が死亡した後、転落事故に見せかけるため2階の窓から落とした。",
  "intro": "静かな夜、ウィンザー邸で悲鳴が響いた。当主が2階の書斎の窓から転落し、庭で発見された。事故か、それとも...",
  "backgroundImagePrompt": "Establishing shot of a grand Victorian mansion at twilight, full exterior view showing Gothic architecture with pointed spires, ivy-covered stone walls, large arched windows glowing with warm candlelight, surrounded by misty gardens and iron gates, autumn leaves scattered on the path, dark academia aesthetic, mysterious atmosphere, cinematic wide angle, no people, no text",
  "masterTimeline": [
    {"time": "09:00", "event": "被害者が書斎で執筆作業を開始", "isTrue": true, "relatedCharacterId": "char_victim", "visibility": "private", "location": "書斎"},
    {"time": "09:30", "event": "執事が厨房で朝食の準備をしている", "isTrue": true, "relatedCharacterId": "char_butler", "visibility": "private", "location": "厨房"},
    {"time": "10:00", "event": "メイドが廊下で執事と秘密の会話をしているのを目撃した", "isTrue": true, "relatedCharacterId": "char_maid", "visibility": "private", "location": "廊下"},
    {"time": "10:15", "event": "執事が密かに毒薬を準備した", "isTrue": true, "relatedCharacterId": "char_butler", "visibility": "private", "location": "厨房"},
    {"time": "10:30", "event": "全員がダイニングで朝食をとる", "isTrue": true, "relatedCharacterId": "char_butler", "visibility": "public", "location": "ダイニング"},
    {"time": "11:00", "event": "被害者が毒により死亡", "isTrue": true, "relatedCharacterId": "char_victim", "visibility": "private", "location": "書斎"},
    {"time": "11:15", "event": "執事が現場を偽装（転落に見せかける）", "isTrue": true, "relatedCharacterId": "char_butler", "visibility": "private", "location": "書斎"},
    {"time": "11:20", "event": "執事が図書室に戻りアリバイ工作", "isTrue": true, "relatedCharacterId": "char_butler", "visibility": "private", "location": "図書室"},
    {"time": "12:00", "event": "メイドが庭で遺体を発見", "isTrue": true, "relatedCharacterId": "char_maid", "visibility": "public", "location": "庭"}
  ]
}`;

  return `【タスク】
${params.genre}を舞台にした殺人事件のマスタータイムラインを作成してください。

【難易度】
${difficultyDesc}

【舞台設定のヒント】
${genreExamples}

【JSON構造】
以下の構造で出力してください（これは例です、内容はオリジナルで作成）：

${jsonExample}

【キャラクターID命名規則】
- 全てのキャラクターIDは "char_" で始めること
- 被害者は "char_victim" というIDを使用すること
- 被害者（char_victim）はプレイアブルキャラクターではなく、プレイヤー数には含めない
- 被害者を除いて合計${params.playerCount}名のプレイアブルキャラクター（犯人含む）を登場させること
- 各キャラクターには役職や特徴を反映したIDをつけること（例: char_butler, char_doctor, char_secretary）

【必須要件】
1. culpritIdは必ず登場キャラクターのIDと一致させること
2. タイムラインは時系列順にソート（早い時刻から順に）
3. 殺人イベントは必ず1つ以上含めること
4. イベント数は最低50個以上。1日の流れを30分刻みで網羅すること
   - private（個人）: 各キャラクター最低10個以上（単独行動、密談、秘密の行動。これが議論の情報交換ネタになる）
   - public（全体共有）: 5-8個程度（遺体発見、全員参加の食事程度のみ。publicが多いと議論が薄くなる）
5. 各キャラクターがタイムライン上に最低15回は登場すること（public + private合算）
6. 30分以上の空白時間帯を作らないこと。全キャラクターが常にどこかで何かをしている状態にする
7. 時間帯ごとの密度:
   - 朝（起床〜午前）: 各キャラ3-4イベント
   - 昼（昼食〜午後）: 各キャラ3-4イベント
   - 夕方〜夜（事件前後）: 各キャラ5-6イベント（最も密度高く）
   - 事件後: 各キャラ2-3イベント（発見・反応）
8. 伏線となるイベントを最低3つ含めること
9. 事件後の発見・反応イベントを必ず含めること
10. introは魅力的で、プレイヤーを引き込む内容（100-150文字）
11. **各イベントに "location" フィールドを必ず設定すること**（例: "書斎", "キッチン", "庭", "廊下"）
12. キャラクターの移動は論理的であること（瞬間移動禁止。移動には時間が必要）
13. 各場所に最低2回以上のイベントを配置すること（探索動機の分散）
14. 全キャラクターペアが最低1回は同じ場所・時間帯に遭遇する機会を設けること

【タイムラインの網羅性 - 最重要】
- マーダーミステリーでは「あなたはその時何をしていましたか？」という質問が核心
- 全キャラクターが全時間帯について「自分は○○にいた」と回答できる密度が必要
- 30分以上のアリバイ空白は議論破綻を招くため絶対に避けること
- 犯人のアリバイ空白は犯行時間帯のみ許容（偽装アリバイで埋めること）

【イベントの可視性（visibility）設定 - 最重要】
マダミスの核心は「情報の非対称性」。各プレイヤーが異なる情報を持ち、議論で共有・推理する。
各イベントに visibility を必ず設定すること:

1. "private"（デフォルト - relatedCharacterIdのキャラのみ見れる）:
   - **基本的に全てのイベントはprivate**
   - 単独行動、2-3人だけの場面、個人的な出来事 → 全てprivate
   - 2人の場面 → 両者それぞれのprivateイベントとして記述
   - これが議論の「情報交換のネタ」になるので、**各キャラ最低10個以上**を確保すること
   - **犯人の犯行イベント（殺害、偽装、証拠隠滅、毒の準備等）は必ず犯人の private イベントとして設定**
   - 判断に迷ったらprivateにすること

2. "public"（オプション - 全員が見れる）:
   - 本当に全員が公知の事実として知っている場合のみ使用
   - 遺体発見の瞬間（全員が知る事実）
   - 全員参加の場面があれば（食事、集合等）
   - **publicは最大5-8個程度まで**に抑える。少ないほど議論が活性化する

【犯人情報の漏洩防止 - 絶対厳守】
以下のルールを破ると、プレイヤーが犯人を特定できてしまいゲームが崩壊する:

**publicイベントに含めてはならないもの（完全禁止）:**
- 犯人が単独で行動するイベント（犯人の relatedCharacterId で他のキャラクターが同席していない場面）
- 犯人が何かを「隠す」「こっそり」「密かに」「ひそかに」「秘密裏に」行うイベント
- 犯人がアリバイを主張・強調するイベント
- 犯人が証拠を処分・移動・改ざんするイベント
- 犯人が犯行に必要な道具・薬品・凶器を準備するイベント
- 犯人が不自然に慌てる・焦る・動揺するイベント
- 犯人が被害者と2人きりになるイベント
- 間接的に犯人を示唆する表現（「怪しげな行動をした」「意味深な表情をした」等）

**犯人のpublicイベントとして許可されるもの:**
- 他のキャラクターが確実に同席している場面（食事、会議、雑談）
- 全員が知っている日常的な行動（挨拶、移動など）のうち他者と一緒の場面

**判断に迷った場合: private にすること**

【重要: 全員を怪しくする設計】
- 全員が怪しく見えるように、各キャラクターに疑わしい行動を含める
- 無実のキャラにも動機や不審な行動を設定（例: 密会、金銭問題、過去の因縁）
- 犯人だけが目立たないようにバランスを取る
- 犯人も他のプレイヤーと同じルールで、自分の private + public のみ見れる

【目撃情報の追加】
各キャラクターが他のキャラクターの行動を目撃しているイベントを含めること：
- 各キャラクターに最低2つ以上の他者目撃イベントを含める
- 目撃内容は断片的で曖昧な表現にする
- 例: 「10:30頃、○○が廊下を慌てて走っていくのを見た」
- relatedCharacterIdには目撃者のIDを設定

【backgroundImagePrompt（背景画像プロンプト）】
英語で作成。必須要素:
- 建物の外観を含める（establishing shot）
- 時間帯、天候、季節を明確に
- "Dark Academia" "Mystery" "Atmospheric" などのスタイルキーワード
- "no people" "no text" を必ず含める
- 150-250語`;
}
