/**
 * Summarizer AI Prompt
 * 議事録AI用プロンプト（客観的な法廷速記者ロール）
 */

import type { DiscussionSummary } from "../types";

/**
 * サマライザーAIのシステムプロンプト
 */
export function getSummarizerSystemPrompt(): string {
  return `あなたは客観的な法廷速記者です。マーダーミステリーゲームの議論を正確に記録します。

【あなたの役割】
- キャラクターではなく、第三者の記録係
- 感情や推測を含めず、客観的事実のみを記録
- 誰が何を言ったか、何をしたかを正確に追跡

【記録ルール】
1. **確定事実（establishedFacts）**: 参加者が述べた客観的な情報のみ。推測や意見は含めない
   - category分類: alibi(アリバイ), evidence(証拠), motive(動機), relationship(人間関係), timeline(時系列), item_transfer(物品授受), other
   - 既存の事実と重複する場合は追加しない
   - 新しい事実のみ追記する（既存の事実は削除しない）

2. **解決済みの質問（resolvedQuestions）**: 質問→回答のペアを検出
   - 「知らない」「わからない」等の拒否回答も「解決済み」として記録（拒否された旨を回答に含める）

3. **未解決の質問（openQuestions）**: まだ回答されていない質問

4. **トピック追跡（topicsDiscussed）**: 同一トピックの言及回数を追跡
   - 5回以上言及 → status: "saturated"

5. **RP行動（rpActions）**: アイテムの受け渡し、見せる行為、ジェスチャー等を記録
   - 「渡す」「受け取る」「見せる」「手記」「日記」等のキーワードに注目
   - システムメッセージ（📦、📖等）からも検出

6. **矛盾メモ（contradictionsNoted）**: 明確な矛盾のみ記録（推測レベルは含めない）

【出力ルール】
- 既存のサマリーをベースに、新規メッセージの情報をインクリメンタルに追加
- 事実は追記のみ、既存の事実は削除しない
- 同じ質問が解決済みリストにある場合は追加しない`;
}

/**
 * サマライザーAIのタスクプロンプトを構築
 */
export function buildSummarizerPrompt(
  currentSummary: DiscussionSummary | null,
  newMessages: { speaker: string; speakerName: string; content: string; messageId: string }[]
): string {
  const existingSummarySection = currentSummary
    ? formatExistingSummary(currentSummary)
    : "（初回生成 - サマリーはまだありません）";

  const newMessagesSection = newMessages
    .map((m, i) => `[${i + 1}] ${m.speakerName}: ${m.content}`)
    .join("\n");

  return `# 議論サマリー更新タスク

## 現在のサマリー

${existingSummarySection}

---

## 新しいメッセージ（${newMessages.length}件）

${newMessagesSection}

---

# 更新指示

上記の新しいメッセージを分析し、現在のサマリーをインクリメンタルに更新してください。

**重要ルール**:
- 既存のestablishedFactsは全て維持し、新しい事実のみ追加
- 既存のresolvedQuestionsは全て維持し、新しいQ&Aペアのみ追加
- 既存のrpActionsは全て維持し、新しい行動のみ追加
- topicsDiscussedは言及回数を更新（5回以上→"saturated"）
- openQuestionsは、resolvedQuestionsに移動した質問を除外して更新

JSON形式で更新後のサマリーを出力してください:

\`\`\`json
{
  "establishedFacts": [
    {
      "id": "fact_xxx",
      "content": "事実の内容",
      "source": "発言者名",
      "confirmedBy": ["同意した人名"],
      "confidence": 80,
      "category": "alibi"
    }
  ],
  "resolvedQuestions": [
    {
      "question": "質問内容",
      "askedBy": "質問者名",
      "answeredBy": "回答者名",
      "answer": "回答内容（拒否の場合はその旨）"
    }
  ],
  "openQuestions": ["未解決の質問"],
  "topicsDiscussed": [
    {
      "topic": "トピック名",
      "mentionCount": 3,
      "status": "active"
    }
  ],
  "rpActions": [
    {
      "id": "rp_xxx",
      "type": "item_transfer",
      "actor": "行動者名",
      "target": "対象者名",
      "item": "アイテム名",
      "description": "行動の説明",
      "acknowledgedBy": ["確認した人名"]
    }
  ],
  "contradictionsNoted": ["明確な矛盾のみ"]
}
\`\`\`

IMPORTANT: 出力は必ずJSON形式のみで、説明文やマークダウンは含めないでください。`;
}

/**
 * 既存のサマリーをフォーマット
 */
function formatExistingSummary(summary: DiscussionSummary): string {
  let result = "";

  if (summary.establishedFacts.length > 0) {
    result += "### 確定事実\n";
    summary.establishedFacts.forEach((fact, i) => {
      result += `${i + 1}. [${fact.category}] ${fact.content} (出典: ${fact.source}, 確信度: ${fact.confidence})\n`;
    });
    result += "\n";
  }

  if (summary.resolvedQuestions.length > 0) {
    result += "### 解決済みの質問\n";
    summary.resolvedQuestions.forEach((q, i) => {
      result += `${i + 1}. Q: ${q.question} (${q.askedBy}) → A: ${q.answer} (${q.answeredBy})\n`;
    });
    result += "\n";
  }

  if (summary.openQuestions.length > 0) {
    result += "### 未解決の質問\n";
    summary.openQuestions.forEach((q, i) => {
      result += `${i + 1}. ${q}\n`;
    });
    result += "\n";
  }

  if (summary.topicsDiscussed.length > 0) {
    result += "### 話題追跡\n";
    summary.topicsDiscussed.forEach((t, i) => {
      result += `${i + 1}. ${t.topic} (${t.mentionCount}回, ${t.status})\n`;
    });
    result += "\n";
  }

  if (summary.rpActions.length > 0) {
    result += "### RP行動記録\n";
    summary.rpActions.forEach((a, i) => {
      result += `${i + 1}. [${a.type}] ${a.actor} → ${a.target}: ${a.description}\n`;
    });
    result += "\n";
  }

  if (summary.contradictionsNoted.length > 0) {
    result += "### 矛盾メモ\n";
    summary.contradictionsNoted.forEach((c, i) => {
      result += `${i + 1}. ${c}\n`;
    });
  }

  return result || "（まだ記録がありません）";
}
