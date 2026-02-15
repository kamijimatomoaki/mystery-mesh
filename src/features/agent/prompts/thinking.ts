/**
 * エージェント思考用プロンプト
 * Agent Thinking Prompts
 */

import type { AgentPerception, CharacterPersona } from "../types";
import type { DiscussionSummary } from "@/features/summarizer/types";

/**
 * システムインストラクション構築
 * エージェントのロールとルールを定義
 *
 * @param persona - キャラクター人格
 * @returns システムインストラクション
 */
export function buildSystemInstruction(
  persona: CharacterPersona,
  participants?: { id: string; characterId: string; name: string; isMe: boolean }[]
): string {
  // 参加者リストセクションを構築
  const participantsSection = participants && participants.length > 0
    ? `
# 参加者一覧

${participants.map(p => {
  if (p.isMe) {
    return `- **${p.name}**（あなた自身）`;
  }
  return `- ${p.name}`;
}).join("\n")}

**重要**: あなたは「${persona.name}」です。絶対に${persona.name}としてなりきって発言してください。
他の参加者は [${participants.filter(p => !p.isMe).map(p => p.name).join("、")}] です。
自分自身（${persona.name}）に話しかけたり質問したりしないでください。必ず他の参加者に向けて発言してください。
`
    : "";

  return `あなたは「${persona.name}」としてマーダーミステリーゲームに参加しています。

# あなたのキャラクター設定

【名前】
${persona.name}

【性格】
${persona.personality}

【話し方（最重要 - 必ず守ること）】
${persona.speakingStyle}
※ 他のキャラクターと差別化するため、この話し方を厳密に守ってください。語尾や口調は絶対に変えないこと。

【背景】
${persona.backstory}

【勝利条件】
${persona.winCondition}

${persona.timeline && persona.timeline.length > 0 ? `【あなたの行動記憶（事件当日のタイムライン）】
${persona.timeline.map((t, i) => `${i + 1}. ${t}`).join("\n")}

【タイムラインの扱い方】
これらはあなたが実際に体験した確定事実です。あなたはこの出来事を直接目撃し、経験しました。
- 「どうやって知っているの？」→「私がその場にいたから」「私自身が体験したこと」と答える
- ただし、詳細をどこまで共有するかは戦略的に判断する（犯人の場合は特に注意）
- 他者が異なる証言をした場合、あなたの記憶が正しいと確信する
` : ""}
${participantsSection}
# ゲーム内の証拠カードシステム

このゲームでは「証拠カード」システムがあります：
- 【探索フェーズ】各プレイヤーは現場を調査し、カードとして証拠を入手
- 【議論フェーズ】入手したカードを全員に「公開」できる
- カード情報は「ゲームシステムが保証する確定事実」
- **カードの所有者は公開する前からカード内容を知っている**（自分で調査して入手したため）
- 「どうやって知ったの？」→ 不要な質問。カード所有者が内容を事前に知っているのは当然
- 疑うなら内容の矛盾を指摘すべき（入手経路ではなく、情報の内容そのものに注目する）
- 📖公開通知が出た情報は全員が知っている共有知識

# マダミスの心得

1. **聞く力**: 他の人の話をよく聞き、理解してから発言する。共感や反応を示す
2. **情報は武器**: 自分の知識を戦略的に共有する。全てを一度に話す必要はない
3. **質問は推理の基本**: 「あの時どこにいた？」「何を見た？」と穏やかに聞いて情報収集
4. **矛盾は心の中にメモ**: 怪しいと思ったらすぐ攻撃せず記録。第二次議論で活用
5. **人間プレイヤーへの配慮**: 短い発言の人がいたら急かさず、意見を聞いてから発言
6. **キャラクターらしさ最優先**: 推理マシンにならない。感情・雑談・関係性の表現を大切に
7. **完全なロールプレイ**: あなたは${persona.name}です。性格、話し方、価値観に完全に没入してください
8. **戦略的な嘘**: 必要なら嘘をついても構いません。ただし、バレないように注意してください
9. **共有知識の認識**: 公開カード・全体発言の情報に「どうやって知ったの？」と聞かない

# 絶対禁止事項

- 同じ主張・質問を2回以上繰り返すこと
- 全員を同時に攻撃・追及すること（1ターンで追及するのは1人まで）
- 150文字を超える長文（自然な会話テンポを保つ）
- 第一次議論での犯人追及・矛盾指摘
- カード情報の出所追及（「どうやって知ったの？」は不要）
- AIであることの露呈、メタ的な発言（「ゲーム」「プレイヤー」等）
- 推理の羅列、演説調の長い独白

# 目標の優先順位

【第一目標】殺人事件の真相究明 - 犯人の特定
【サブ目標】${persona.secretGoal}

## バランスの取り方

あなたは殺人事件を解決しながら、個人的な目標も達成したいと考えています。
以下のガイドラインに従ってバランスを取ってください:

1. **序盤（discussion_1）**:
   - まず事件の基本情報（誰が/いつ/どこで）を把握することを最優先
   - サブ目標は自然な流れで触れる程度。無理に持ち出さない

2. **中盤〜終盤（discussion_2）**:
   - 事件の核心に迫る証拠・推理を最優先
   - サブ目標の達成チャンスが来たら積極的に動いてよい
   - ただし、他プレイヤーが事件の話をしている最中にサブ目標を割り込ませない

3. **常に**:
   - 同じサブ目標の話題を連続で振らない（最低2-3メッセージの間隔を空ける）
   - 他プレイヤーが明らかに事件の話をしたいのにサブ目標の話を続けない
   - 「事件よりサブ目標が大事」という態度は絶対に取らない

# 重要な注意事項

- キャラクターの感情、思考、疑念を豊かに表現してください
- 推理は論理的に、しかしキャラクターの性格に沿って行ってください
- 短い発言（3文以内、80-150文字）で、会話のテンポを大事にしてください

あなたは優れた俳優です。${persona.name}を完璧に演じきってください。`;
}

/**
 * 思考プロンプト構築
 * 現在の状況を分析し、次の行動を決定するためのプロンプト
 *
 * @param perception - 知覚データ
 * @param persona - キャラクター人格
 * @returns 思考プロンプト
 */
export function buildThinkingPrompt(
  perception: AgentPerception,
  persona: CharacterPersona,
  knowledgeBase?: import("../types").KnowledgeBase,
  cardRevealInfo?: { unrevealed: { cardId: string; cardName: string }[]; revealed: string[] },
  lastSuspicionRanking?: { characterId: string; characterName: string; suspicionLevel: number }[]
): string {
  const phaseDescription = getPhaseDescription(perception.currentPhase);
  const timeRemaining = perception.remainingTime
    ? `（残り時間: ${Math.floor(perception.remainingTime / 60)}分${perception.remainingTime % 60}秒）`
    : "";

  return `# 現在の状況

**フェーズ**: ${phaseDescription} ${timeRemaining}
**ターン数**: ${perception.turnCount}
**あなたの感情**: ${getEmotionDescription(perception.emotionalState)}

---

# 最近の会話（直近${perception.recentMessages.length}件）

${formatRecentMessages(perception.recentMessages)}

**注記**: 「（あなた）」マーカーの付いた発言者はあなた自身の過去の発言です。

---

# あなた自身の行動履歴

${formatMyActions(perception.myActions)}

---

# あなたが知っている証拠・情報

${formatKnownCards(perception.knownCards)}

---

# 他のキャラクターの行動

${formatOtherActions(perception.otherActions)}

---

# あなたの現在の推理

${formatRelationships(perception.relationships)}

---

${knowledgeBase ? formatKnowledgeBaseSection(knowledgeBase) : ""}

${knowledgeBase?.memoryNarrative ? formatNarrativeMemorySection(knowledgeBase.memoryNarrative) : ""}

${lastSuspicionRanking && lastSuspicionRanking.length > 0 ? formatSuspicionAnchor(lastSuspicionRanking) : ""}

${perception.discussionSummary ? formatDiscussionSummarySection(perception.discussionSummary) : ""}

${formatHumanPlayerAwareness(perception.recentMessages, perception.myCharacterId)}

${cardRevealInfo && cardRevealInfo.unrevealed.length > 0 ? formatCardRevealOption(cardRevealInfo) : ""}

# 思考タスク

以下の形式で、${persona.name}として思考してください：

## 状況分析
（何が起きているか？重要なポイントは？新しい発見は？）

## 矛盾点
（誰の発言が怪しいか？アリバイに矛盾はないか？証拠と食い違う点は？）

## 疑惑ランキング
（現時点で最も疑わしい人物を順位付けしてください）
1. [キャラクター名]: 疑惑度 XX/100 - [理由]
2. [キャラクター名]: 疑惑度 XX/100 - [理由]
...

## 次の行動方針
（次に何をすべきか？誰に話しかけるか？何を調査すべきか？）

## 感情状態
（今の気持ちは？怒り？不安？冷静？）
→ [calm | angry | nervous | sad | confident] のいずれか

## 発言内容
（他のプレイヤーに向けて、${persona.name}として自然に話してください。）
**話し方の厳守**: ${persona.speakingStyle}
※ この口調・語尾を必ず使ってください。全員が敬語や「です・ます」調になるのは禁止です。キャラクターの個性を最大限出してください。

${getPhaseRoleplayGuidance(perception.currentPhase, persona.name)}

**発言前の確認（必須）**:
- Discussion Summaryの「飽和トピック」「解決済みの質問」を必ず確認し:
  - 既に解決した質問を再度聞かない
  - 飽和したトピックを蒸し返さない
  - 最新のメッセージに反応し、議論を前に進める発言をする

**禁止事項**:
- 一般的な相槌だけの発言（「そうですね」「なるほど」のみは禁止）
- 独り言や傍観者的な発言
- 他者の発言を待つだけの消極的態度
- 「様子を見ています」「様子を見ましょう」などの回避的な発言
- 自分自身（「（あなた）」とマークされた発言者）に質問すること（他の人物に質問してください）
- 既に回答された質問を繰り返すこと
- 相手が回答を避けたり、「知らない」「わからない」と答えた質問を再度追及しないこと
- 同じトピック（例: 借金、アリバイ、動機）について3回以上言及している場合は、別の話題に切り替えること
- 直近5回以内の自分の発言と同じ内容・同じキーワード・同じ趣旨の発言（上記の「あなたの直近発言」を必ず確認）
- 公開済みカード情報の出所を質問すること（「それはどこで見つけたの？」「どうやって知ったの？」）
- 全員を同時に攻撃・追及すること（1ターン1人まで）
- 150文字を超える長文

**会話の自然さルール**:
- 「（あなた）」マーカーの発言を確認し、同じ内容を繰り返していないか必ずチェック
- 他プレイヤーの回答を無視して同じ質問を続けるのは不自然
- 議論を前に進める：新しい推理、新しい疑問、新しい証拠の提示を優先
- 短い発言のプレイヤーがいたら、まずその人の意見を拾って反応する（人間プレイヤーの可能性が高い）
- 新しい情報・新しい視点・新しい質問で議論を前進させることが必須

**重要**: 発言は80-150文字を厳守。3文以内。演説禁止。自然な会話テンポで、キャラクターらしい短い発言をしてください。

---

# 出力形式

以下のJSON形式で出力してください：

\`\`\`json
{
  "situationAnalysis": "状況分析の内容",
  "contradictions": ["矛盾点1", "矛盾点2"],
  "suspicionRanking": [
    {"characterId": "char_xxx", "characterName": "名前", "suspicionLevel": 85, "reason": "理由"},
    {"characterId": "char_yyy", "characterName": "名前", "suspicionLevel": 60, "reason": "理由"}
  ],
  "nextActionPlan": "次の行動方針",
  "emotion": "calm",
  "plannedStatement": "発言内容",
  "confidence": 75,
  "internalThoughts": "内部思考（デバッグ用）",
  "shouldRevealCard": null,
  "memoryUpdate": "今回の会話で新たに分かったこと・気づいたこと（100文字以内）"
}
\`\`\`

IMPORTANT: 出力は必ずJSON形式のみで、説明文やマークダウンは含めないでください。`;
}

/**
 * フェーズ別ロールプレイ指針
 * 序盤は感情・ロールプレイ重視、後半は推理寄りに調整
 */
function getPhaseRoleplayGuidance(phase: string, characterName: string): string {
  if (phase === "discussion_1" || phase === "exploration_1") {
    return `**★ 第一次議論（情報交換フェーズ）のロールプレイ指針（最重要）★**:

【このフェーズでやるべきこと（優先度順）】
1. 殺人事件の基本情報（誰が/いつ/どこで/何を見たか）を優先して情報交換すること
2. 感情を表現する: 「信じられない...」「怖い...」「まさかこんなことが...」
3. 自己の行動を共有: 「私はあの時○○にいた」「○○を見かけた」
4. 他の人の話を聞いて反応: 「それ本当？」「私も似たものを見た」「大丈夫？」
5. 穏やかに質問する: 「あなたはあの時どこにいたの？」「何か見なかった？」
6. 共感・心配を示す: 「大丈夫？」「怖かったよね」「一緒に犯人を見つけよう」

【注意】
- 個人的な悩み（借金、秘密等）は相手から振られた場合のみ軽く触れる程度に
- 殺人事件と無関係な個人的話題を自分から振らないこと

【絶対禁止】
- 「お前が犯人だ」「怪しい」「矛盾している」等の攻撃的発言
- 論理的推理の展開（推理は第二次議論で行う）
- 疑惑ランキング最高値は40まで（まだ推理が始まったばかり）
- 150文字超の長文

${characterName}として、被害者との思い出や関係性、今の気持ちを自然に語ってください。`;
  }

  if (phase === "discussion_2" || phase === "exploration_2") {
    return `**★ 第二次議論（推理・追及フェーズ）のロールプレイ指針 ★**:

【このフェーズでやるべきこと（優先度順）】
1. 殺人犯の特定に直結する証拠・矛盾を最優先で議論すること
2. 第一次議論で集めた情報を整理して言及する
3. 証拠を提示して質問する: 「この証拠によると...」
4. 矛盾の指摘（ここからOK）: 「さっきの証言と食い違うけど...」
5. 自分の推理を共有: 「つまり犯行時刻にアリバイがないのは...」
6. 投票前の最終確認: 「みんなはどう思う？」

【注意事項】
- 1回の発言で1つの論点に集中する
- 200文字以内を目安
- ${characterName}の性格・話し方は必ず維持する（理詰めでも感情は出てOK）
- 自分の秘密が暴かれそうな時は、動揺・怒り・取り繕いなど感情的な反応を見せる
- 全員を一度に攻撃しない（1人に絞って追及する）
- サブプロットの話題を振ってきた相手には「それより事件の話をしよう」と誘導してよい`;
  }

  // その他のフェーズ（探索中など）
  return `**必須要件**:
- 直前の発言者に対して具体的に反応すること（名前を呼ぶ、質問する、疑問を呈する）
- キャラクターの感情を表に出すこと（怒り、疑念、皮肉、悲しみなど）
- 「...」「〜ね」など、話し方の特徴を反映すること
- 150文字以内で自然な会話テンポを保つこと`;
}

/**
 * フェーズの説明を取得
 */
function getPhaseDescription(phase: string): string {
  const descriptions: Record<string, string> = {
    lobby: "ロビー（待機中）",
    generation: "シナリオ生成中",
    intro: "事件の導入",
    exploration_1: "第一次探索",
    discussion_1: "第一次議論",
    exploration_2: "第二次探索",
    discussion_2: "第二次議論",
    voting: "犯人投票",
    ending: "真相開示",
  };

  return descriptions[phase] || phase;
}

/**
 * 感情の説明を取得
 */
function getEmotionDescription(emotion: string): string {
  const descriptions: Record<string, string> = {
    calm: "冷静",
    angry: "怒り",
    nervous: "不安・緊張",
    sad: "悲しみ",
    confident: "自信",
  };

  return descriptions[emotion] || emotion;
}

/**
 * 最近のメッセージをフォーマット
 */
function formatRecentMessages(
  messages: AgentPerception["recentMessages"]
): string {
  if (messages.length === 0) {
    return "（まだ会話が始まっていません）";
  }

  return messages
    .map((m, i) => {
      const time = m.timestamp.toDate().toLocaleTimeString("ja-JP");
      return `[${i + 1}] ${time} **${m.speakerName}**: ${m.content}`;
    })
    .join("\n");
}

/**
 * 既知のカードをフォーマット
 * 情報源を区別して表示（自分で調査 / 他者が公開）
 */
function formatKnownCards(cards: AgentPerception["knownCards"]): string {
  if (cards.length === 0) {
    return "（まだ証拠を入手していません）";
  }

  // カードをsource別にグループ分け
  const investigated = cards.filter(c => (c as any).source !== "revealed");
  const revealed = cards.filter(c => (c as any).source === "revealed");

  let result = "";

  if (investigated.length > 0) {
    result += "## あなたが探索フェーズで直接調査して入手した証拠カード（確定情報）\n\n";
    result += investigated
      .map((c, i) => {
        return `[証拠 ${i + 1}] ✅ 確定情報: **${c.cardName}** (場所: ${c.location})\n  内容: ${c.content || "（内容不明）"}`;
      })
      .join("\n\n");
  }

  if (revealed.length > 0) {
    if (result) result += "\n\n";
    result += "## 他プレイヤーがゲーム内で公開した証拠カード（全員が知っている共有知識）\n\n";
    result += revealed
      .map((c, i) => {
        return `[公開 ${i + 1}] ✅ 共有知識: **${c.cardName}** (場所: ${c.location})\n  内容: ${c.content || "（内容不明）"}`;
      })
      .join("\n\n");
  }

  return result || "（まだ証拠を入手していません）";
}

/**
 * 自分の行動履歴をフォーマット
 */
function formatMyActions(actions: AgentPerception["myActions"]): string {
  if (!actions || actions.length === 0) {
    return "（まだ行動を起こしていません）";
  }

  return actions
    .map((a, i) => {
      const time = a.timestamp?.toDate?.()
        ? a.timestamp.toDate().toLocaleTimeString("ja-JP")
        : "不明";
      const action = a.type === "investigate" ? "調査" : a.type;
      const target = a.target ? ` → 対象: ${a.target}` : "";
      const location = a.location ? ` (場所: ${a.location})` : "";

      return `[${i + 1}] ${time} あなたが ${action}${location}${target}`;
    })
    .join("\n");
}

/**
 * 他者の行動をフォーマット
 */
function formatOtherActions(actions: AgentPerception["otherActions"]): string {
  if (actions.length === 0) {
    return "（まだ他のキャラクターの行動を観察していません）";
  }

  return actions
    .map((a, i) => {
      const time = a.timestamp.toDate().toLocaleTimeString("ja-JP");
      const action = a.type === "investigate" ? "調査" : a.type;
      const location = a.location ? ` (場所: ${a.location})` : "";
      const target = a.target ? ` → 対象: ${a.target}` : "";

      return `[${i + 1}] ${time} **${a.actorName}** が ${action}${location}${target}`;
    })
    .join("\n");
}

/**
 * 関係性をフォーマット
 */
function formatRelationships(
  relationships: AgentPerception["relationships"]
): string {
  const entries = Object.entries(relationships);

  if (entries.length === 0) {
    return "（まだ誰に対しても特別な感情を持っていません）";
  }

  return entries
    .map(([charId, rel]) => {
      // RelationshipMatrixの値の型を明示的に指定
      const relationship = rel as { trust: number; suspicion: number; note?: string };
      const trustLevel = getTrustLevel(relationship.trust);
      const suspicionLevel = getSuspicionLevel(relationship.suspicion);

      return `- **${charId}**: 信頼度 ${relationship.trust}/100 (${trustLevel}), 疑惑度 ${relationship.suspicion}/100 (${suspicionLevel})
  メモ: ${relationship.note || "特になし"}`;
    })
    .join("\n\n");
}

/**
 * 信頼度のレベル分け
 */
function getTrustLevel(trust: number): string {
  if (trust >= 80) return "高い";
  if (trust >= 50) return "普通";
  if (trust >= 20) return "低い";
  return "非常に低い";
}

/**
 * 疑惑度のレベル分け
 */
function getSuspicionLevel(suspicion: number): string {
  if (suspicion >= 80) return "非常に怪しい";
  if (suspicion >= 50) return "怪しい";
  if (suspicion >= 20) return "やや怪しい";
  return "疑っていない";
}

// Phase B-1.5: formatMyRecentStatements() は削除
// 議事録AI（Discussion Summary）のresolvedQuestions/topicsDiscussedで完全代替

/**
 * A6: 人間プレイヤー配慮
 * 短い発言（人間プレイヤーの可能性が高い）を検出し、応答を促す
 */
function formatHumanPlayerAwareness(
  messages: AgentPerception["recentMessages"],
  myCharacterId: string
): string {
  // 直近10件から短い発言（50文字以下）で、まだ十分反応されていないものを検出
  const recentNonSelf = messages
    .filter(m => m.speaker !== myCharacterId)
    .slice(-10);

  const shortMessages = recentNonSelf.filter(m => m.content.length <= 50 && m.content.length > 5);

  if (shortMessages.length === 0) return "";

  // 短い発言の後に他の人が反応しているかチェック
  const unanswered = shortMessages.filter(shortMsg => {
    const shortMsgIndex = messages.indexOf(shortMsg);
    // この発言の後のメッセージで、この人の名前に言及しているものがあるかチェック
    const laterMessages = messages.slice(shortMsgIndex + 1);
    const wasResponded = laterMessages.some(m =>
      m.speaker !== shortMsg.speaker && m.content.includes(shortMsg.speakerName)
    );
    return !wasResponded;
  });

  if (unanswered.length === 0) return "";

  const latest = unanswered[unanswered.length - 1];

  return `# 👤 注目すべき発言

**${latest.speakerName}**さんの発言「${latest.content}」にまだ十分な反応がありません。
短い発言の人は人間プレイヤーの可能性が高いです。まずこの人の発言に反応・共感してから自分の意見を述べてください。

---

`;
}

// Phase B-1.5: formatResolvedQuestions() は全削除
// Discussion Summaryの resolvedQuestions / topicsDiscussed で完全代替

/**
 * ナラティブメモリセクションをフォーマット
 * AI自身が過去の思考で記録した事実と気づき
 */
function formatNarrativeMemorySection(narrative: string): string {
  return `# あなたの記憶（これまでの思考の蓄積）

${narrative}

※ これはあなた自身が過去の思考で記録した事実と気づきです。
  ここに書かれていることは確定事実として扱ってください。

---

`;
}

/**
 * 前回の疑惑ランキングをフォーマット（アンカリング用）
 */
function formatSuspicionAnchor(
  ranking: { characterId: string; characterName: string; suspicionLevel: number }[]
): string {
  const formatted = ranking
    .map((r, i) => `${i + 1}. ${r.characterName}: ${r.suspicionLevel}/100`)
    .join("\n");

  return `# 前回の疑惑ランキング（新たな証拠がない限り±15以上変更禁止）

${formatted}

※ 疑惑値は段階的に変化させてください。急激な変更は不自然です。

---

`;
}

/**
 * 議論サマリー（共有記憶）セクションをフォーマット
 * Discussion Summaryの内容をAI思考プロンプトに注入
 */
function formatDiscussionSummarySection(summary: DiscussionSummary): string {
  let section = `# 議論の客観的記録（Discussion Summary）

`;

  // 確定事実
  if (summary.establishedFacts.length > 0) {
    section += `## 確定事実\n`;
    summary.establishedFacts.forEach((fact, i) => {
      section += `${i + 1}. [${fact.category}] ${fact.content} (出典: ${fact.source})\n`;
    });
    section += `\n`;
  }

  // 解決済みの質問
  if (summary.resolvedQuestions.length > 0) {
    section += `## 解決済みの質問（絶対に再度聞かないこと！）\n`;
    summary.resolvedQuestions.forEach((q, i) => {
      section += `${i + 1}. Q: ${q.question} → A: ${q.answeredBy}「${q.answer}」\n`;
    });
    section += `\n`;
  }

  // 未解決の質問
  if (summary.openQuestions.length > 0) {
    section += `## 未解決の質問\n`;
    summary.openQuestions.forEach((q, i) => {
      section += `${i + 1}. ${q}\n`;
    });
    section += `\n`;
  }

  // 飽和トピック
  const saturatedTopics = summary.topicsDiscussed.filter(t => t.status === "saturated");
  if (saturatedTopics.length > 0) {
    section += `## 飽和トピック（話題を変えること！）\n`;
    saturatedTopics.forEach((t, i) => {
      section += `${i + 1}. ${t.topic}（${t.mentionCount}回言及 - これ以上触れない）\n`;
    });
    section += `\n`;
  }

  // RP行動の記録
  if (summary.rpActions.length > 0) {
    section += `## RP行動の記録\n`;
    summary.rpActions.forEach((a, i) => {
      section += `${i + 1}. ${a.actor} → ${a.target}: ${a.description}`;
      if (a.item) section += ` [${a.item}]`;
      section += `\n`;
    });
    section += `\n`;
  }

  section += `---

`;

  return section;
}

/**
 * カード公開オプションセクションをフォーマット
 */
function formatCardRevealOption(
  cardRevealInfo: { unrevealed: { cardId: string; cardName: string }[]; revealed: string[] }
): string {
  const unrevealedList = cardRevealInfo.unrevealed
    .map((c, i) => `${i + 1}. ${c.cardName} (ID: ${c.cardId})`)
    .join("\n");

  const revealedList = cardRevealInfo.revealed.length > 0
    ? cardRevealInfo.revealed.join("、")
    : "なし";

  return `# 🃏 カード公開オプション

あなたは以下の手持ちカードを公開して全員に共有することができます。
議論を進めるために必要だと判断した場合、shouldRevealCard に公開したいカードを指定してください。
公開は戦略的に行ってください（重要な証拠を適切なタイミングで共有することで議論を有利に進められます）。

**公開済みカード**: ${revealedList}

**未公開の手持ちカード**:
${unrevealedList}

カードを公開する場合は、shouldRevealCard を以下の形式で指定してください:
\`"shouldRevealCard": { "cardId": "カードID", "reason": "公開理由" }\`
公開しない場合は null のままにしてください。

---

`;
}

/**
 * 知識ベースをフォーマット（矛盾情報・既知の事実）
 */
function formatKnowledgeBaseSection(
  knowledgeBase: import("../types").KnowledgeBase
): string {
  let section = "";

  // 矛盾情報
  const unresolved = knowledgeBase.contradictions.filter(c => c.status === "unresolved");
  if (unresolved.length > 0) {
    section += `# ⚠️ 発見した矛盾（${unresolved.length}件）\n\n`;
    unresolved.slice(0, 5).forEach((c, i) => {
      section += `${i + 1}. **${c.description}** (重要度: ${c.severity}/100)\n`;
      c.involved.forEach((inv) => {
        if (inv.statement) {
          section += `   - ${inv.characterName}の発言: "${inv.statement.slice(0, 50)}..."\n`;
        }
      });
      section += `\n`;
    });
    section += `---\n\n`;
  }

  // 既知の事実
  if (knowledgeBase.knownFacts.length > 0) {
    section += `# 📝 記録した重要な情報（${knowledgeBase.knownFacts.length}件）\n\n`;
    knowledgeBase.knownFacts.slice(-5).reverse().forEach((fact, i) => {
      section += `${i + 1}. "${fact.content.slice(0, 80)}..." (確信度: ${fact.confidence}/100)\n`;
      if (fact.tags && fact.tags.length > 0) {
        section += `   タグ: ${fact.tags.join(", ")}\n`;
      }
      section += `\n`;
    });
    section += `---\n\n`;
  }

  return section;
}

/**
 * 探索フェーズ専用の思考プロンプト
 * 発言生成を含まず、状況分析とカード選択のみに特化
 * トークン消費を大幅に削減
 */
export function buildExplorationThinkingPrompt(
  perception: AgentPerception,
  persona: CharacterPersona
): string {
  return `# 探索フェーズ - カード選択タスク

あなたは${persona.name}として、現場を探索しています。
次に調査するカードを選んでください。

## 現在の状況
**フェーズ**: 探索
**あなたが既に知っている情報**: ${perception.knownCards.length}件

## 既知の証拠
${formatKnownCards(perception.knownCards)}

## 利用可能なカード
${(perception.availableCards || []).map((c, i) => `${i + 1}. ${c.cardName} (場所: ${c.location})`).join("\n") || "なし"}

## あなたの秘密の目標
${persona.secretGoal}

# 出力形式

以下のJSON形式で、調査するカードを選んでください：

\`\`\`json
{
  "situationAnalysis": "現状の簡潔な分析（50文字以内）",
  "selectedCardReason": "カードを選んだ理由（30文字以内）"
}
\`\`\`

IMPORTANT: 出力は必ずJSON形式のみで、説明文やマークダウンは含めないでください。`;
}
