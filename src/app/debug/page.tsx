/**
 * Debug / Component Showcase Page
 * 全UIコンポーネントのデモページ
 */

"use client";

import { useState } from "react";
import { Book, Star, Settings } from "lucide-react";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Textarea,
  Loading,
  Modal,
  ModalFooter,
  Checkbox,
  Radio,
  RadioGroup,
  Badge,
  BadgeGroup,
  Select,
  Progress,
  ProgressSteps,
  Tooltip,
  Tabs,
} from "@/components";

export default function DebugPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [textareaValue, setTextareaValue] = useState("");
  const [checkboxValue, setCheckboxValue] = useState(false);
  const [radioValue, setRadioValue] = useState("option1");
  const [selectValue, setSelectValue] = useState("");
  const [progressValue, setProgressValue] = useState(45);
  const [badges, setBadges] = useState([
    { id: 1, text: "泣ける" },
    { id: 2, text: "高難易度" },
    { id: 3, text: "初心者向け" },
  ]);

  return (
    <main className="min-h-screen bg-primary p-8">
      <div className="mx-auto max-w-6xl space-y-12">
        {/* ヘッダー */}
        <div className="text-center">
          <h1 className="font-serif text-5xl font-bold text-gradient mb-4">
            Component Showcase
          </h1>
          <p className="text-primary-foreground/80">
            MisteryMesh UI Components - Dark Academia Edition
          </p>
        </div>

        {/* Buttons */}
        <section>
          <h2 className="font-serif text-3xl font-bold text-primary-foreground mb-6">
            Buttons
          </h2>
          <Card>
            <CardContent className="space-y-6">
              {/* Variants */}
              <div>
                <h3 className="font-serif text-xl font-semibold mb-3">
                  Variants
                </h3>
                <div className="flex flex-wrap gap-4">
                  <Button variant="seal">封蝋ボタン (Seal)</Button>
                  <Button variant="quill">羽根ペン (Quill)</Button>
                  <Button variant="ghost">ゴースト (Ghost)</Button>
                  <Button variant="outline">アウトライン (Outline)</Button>
                </div>
              </div>

              {/* Sizes */}
              <div>
                <h3 className="font-serif text-xl font-semibold mb-3">Sizes</h3>
                <div className="flex flex-wrap items-center gap-4">
                  <Button size="sm">Small</Button>
                  <Button size="md">Medium</Button>
                  <Button size="lg">Large</Button>
                </div>
              </div>

              {/* States */}
              <div>
                <h3 className="font-serif text-xl font-semibold mb-3">States</h3>
                <div className="flex flex-wrap gap-4">
                  <Button>Normal</Button>
                  <Button disabled>Disabled</Button>
                  <Button isLoading>Loading</Button>
                </div>
              </div>

              {/* Full Width */}
              <div>
                <h3 className="font-serif text-xl font-semibold mb-3">
                  Full Width
                </h3>
                <Button fullWidth>Full Width Button</Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Cards */}
        <section>
          <h2 className="font-serif text-3xl font-bold text-primary-foreground mb-6">
            Cards
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            <Card variant="parchment">
              <CardHeader>
                <CardTitle>羊皮紙風カード</CardTitle>
                <CardDescription>
                  古い図書館の本のようなデザイン
                </CardDescription>
              </CardHeader>
              <CardContent>
                これは羊皮紙風のカードです。温かみのあるベージュ色と、古書のような質感が特徴です。
              </CardContent>
              <CardFooter>
                <Button variant="seal" size="sm">
                  詳細を見る
                </Button>
              </CardFooter>
            </Card>

            <Card variant="dark">
              <CardHeader>
                <CardTitle>ダークカード</CardTitle>
                <CardDescription>インク背景のカード</CardDescription>
              </CardHeader>
              <CardContent>
                これはダークモードのカードです。深いインクの色が神秘的な雰囲気を醸し出します。
              </CardContent>
              <CardFooter>
                <Button variant="quill" size="sm">
                  詳細を見る
                </Button>
              </CardFooter>
            </Card>

            <Card variant="outline">
              <CardHeader>
                <CardTitle>アウトラインカード</CardTitle>
                <CardDescription>境界線のみのカード</CardDescription>
              </CardHeader>
              <CardContent>
                これはアウトラインのみのカードです。ミニマルで控えめなデザインです。
              </CardContent>
            </Card>

            <Card variant="parchment" hover>
              <CardHeader>
                <CardTitle>ホバーエフェクト</CardTitle>
                <CardDescription>マウスを乗せてみてください</CardDescription>
              </CardHeader>
              <CardContent>
                このカードはホバー時に拡大します。インタラクティブな要素に最適です。
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Inputs */}
        <section>
          <h2 className="font-serif text-3xl font-bold text-primary-foreground mb-6">
            Inputs
          </h2>
          <Card>
            <CardContent className="space-y-6">
              <Input
                label="ユーザー名"
                placeholder="図書カードの名前を入力..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />

              <Input
                label="パスワード"
                type="password"
                placeholder="秘密の呪文を入力..."
                helperText="8文字以上で入力してください"
              />

              <Input
                label="エラー例"
                error
                helperText="この入力は必須です"
                placeholder="何か入力してください"
              />

              <Textarea
                label="メッセージ"
                placeholder="物語の一節を書き記してください..."
                value={textareaValue}
                onChange={(e) => setTextareaValue(e.target.value)}
                helperText="最大500文字まで"
              />
            </CardContent>
          </Card>
        </section>

        {/* Loading */}
        <section>
          <h2 className="font-serif text-3xl font-bold text-primary-foreground mb-6">
            Loading
          </h2>
          <Card>
            <CardContent>
              <div className="grid gap-8 md:grid-cols-3">
                <div className="text-center">
                  <h3 className="font-serif text-lg font-semibold mb-4">
                    Spinner
                  </h3>
                  <Loading variant="spinner" size="lg" text="読み込み中..." />
                </div>

                <div className="text-center">
                  <h3 className="font-serif text-lg font-semibold mb-4">
                    Hourglass
                  </h3>
                  <Loading
                    variant="hourglass"
                    size="lg"
                    text="物語を執筆中..."
                  />
                </div>

                <div className="text-center">
                  <h3 className="font-serif text-lg font-semibold mb-4">
                    Ink Spread
                  </h3>
                  <Loading variant="ink" size="lg" text="インクが滲んでいます..." />
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Modal */}
        <section>
          <h2 className="font-serif text-3xl font-bold text-primary-foreground mb-6">
            Modal
          </h2>
          <Card>
            <CardContent>
              <Button onClick={() => setIsModalOpen(true)}>
                モーダルを開く
              </Button>

              <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="図書館からのお知らせ"
                size="md"
              >
                <p className="mb-4">
                  これはモーダルダイアログです。重要な情報やフォームを表示するのに使用します。
                </p>
                <p className="mb-4">
                  ESCキーを押すか、背景をクリックすることで閉じることができます。
                </p>

                <ModalFooter>
                  <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
                    キャンセル
                  </Button>
                  <Button variant="seal" onClick={() => setIsModalOpen(false)}>
                    了解しました
                  </Button>
                </ModalFooter>
              </Modal>
            </CardContent>
          </Card>
        </section>

        {/* Checkbox & Radio */}
        <section>
          <h2 className="font-serif text-3xl font-bold text-primary-foreground mb-6">
            Checkbox & Radio
          </h2>
          <Card>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-serif text-xl font-semibold mb-3">
                  Checkboxes
                </h3>
                <div className="space-y-3">
                  <Checkbox
                    label="このシナリオを保存する"
                    description="図書館に公開せず、下書きとして保存します"
                    checked={checkboxValue}
                    onChange={(e) => setCheckboxValue(e.target.checked)}
                  />
                  <Checkbox label="利用規約に同意する" />
                  <Checkbox label="無効化された項目" disabled />
                  <Checkbox label="エラー状態" error />
                </div>
              </div>

              <div>
                <h3 className="font-serif text-xl font-semibold mb-3">
                  Radio Buttons
                </h3>
                <RadioGroup label="難易度を選択">
                  <Radio
                    name="difficulty"
                    value="easy"
                    label="簡単"
                    description="初心者向け"
                    checked={radioValue === "easy"}
                    onChange={(e) => setRadioValue(e.target.value)}
                  />
                  <Radio
                    name="difficulty"
                    value="normal"
                    label="普通"
                    description="標準的な難易度"
                    checked={radioValue === "normal"}
                    onChange={(e) => setRadioValue(e.target.value)}
                  />
                  <Radio
                    name="difficulty"
                    value="hard"
                    label="難しい"
                    description="上級者向け"
                    checked={radioValue === "hard"}
                    onChange={(e) => setRadioValue(e.target.value)}
                  />
                </RadioGroup>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Badge */}
        <section>
          <h2 className="font-serif text-3xl font-bold text-primary-foreground mb-6">
            Badges
          </h2>
          <Card>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-serif text-xl font-semibold mb-3">
                  Variants
                </h3>
                <BadgeGroup>
                  <Badge variant="default">デフォルト</Badge>
                  <Badge variant="primary">プライマリ</Badge>
                  <Badge variant="secondary">セカンダリ</Badge>
                  <Badge variant="success">成功</Badge>
                  <Badge variant="warning">警告</Badge>
                  <Badge variant="danger">危険</Badge>
                  <Badge variant="outline">アウトライン</Badge>
                </BadgeGroup>
              </div>

              <div>
                <h3 className="font-serif text-xl font-semibold mb-3">
                  Sizes
                </h3>
                <BadgeGroup>
                  <Badge size="sm">Small</Badge>
                  <Badge size="md">Medium</Badge>
                  <Badge size="lg">Large</Badge>
                </BadgeGroup>
              </div>

              <div>
                <h3 className="font-serif text-xl font-semibold mb-3">
                  Removable Tags
                </h3>
                <BadgeGroup>
                  {badges.map((badge) => (
                    <Badge
                      key={badge.id}
                      variant="primary"
                      removable
                      onRemove={() =>
                        setBadges(badges.filter((b) => b.id !== badge.id))
                      }
                    >
                      {badge.text}
                    </Badge>
                  ))}
                </BadgeGroup>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Select */}
        <section>
          <h2 className="font-serif text-3xl font-bold text-primary-foreground mb-6">
            Select
          </h2>
          <Card>
            <CardContent className="space-y-6">
              <Select
                label="ジャンルを選択"
                placeholder="ジャンルを選んでください"
                options={[
                  { value: "mansion", label: "館モノ" },
                  { value: "sf", label: "SF" },
                  { value: "school", label: "学園" },
                  { value: "fantasy", label: "ファンタジー" },
                ]}
                value={selectValue}
                onChange={setSelectValue}
                helperText="シナリオのジャンルを選択します"
              />

              <Select
                label="エラー状態"
                placeholder="選択してください"
                options={[
                  { value: "1", label: "オプション1" },
                  { value: "2", label: "オプション2" },
                ]}
                error
                helperText="この項目は必須です"
              />
            </CardContent>
          </Card>
        </section>

        {/* Progress */}
        <section>
          <h2 className="font-serif text-3xl font-bold text-primary-foreground mb-6">
            Progress
          </h2>
          <Card>
            <CardContent className="space-y-8">
              <div>
                <h3 className="font-serif text-xl font-semibold mb-4">
                  Progress Bar
                </h3>
                <div className="space-y-4">
                  <Progress
                    value={progressValue}
                    label="シナリオ生成中"
                    showLabel
                  />
                  <Progress value={75} variant="primary" showLabel />
                  <Progress value={100} variant="success" showLabel />

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        setProgressValue(Math.max(0, progressValue - 10))
                      }
                    >
                      -10
                    </Button>
                    <Button
                      size="sm"
                      onClick={() =>
                        setProgressValue(Math.min(100, progressValue + 10))
                      }
                    >
                      +10
                    </Button>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-serif text-xl font-semibold mb-4">
                  Progress Steps
                </h3>
                <ProgressSteps
                  currentStep={1}
                  steps={[
                    { label: "設定", description: "基本情報" },
                    { label: "生成", description: "AI処理中" },
                    { label: "検証", description: "確認" },
                    { label: "完了", description: "公開" },
                  ]}
                />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Tooltip */}
        <section>
          <h2 className="font-serif text-3xl font-bold text-primary-foreground mb-6">
            Tooltip
          </h2>
          <Card>
            <CardContent>
              <div className="flex flex-wrap gap-8 justify-center py-8">
                <Tooltip content="上に表示されるツールチップ" position="top">
                  <Button variant="outline">Top</Button>
                </Tooltip>

                <Tooltip content="下に表示されるツールチップ" position="bottom">
                  <Button variant="outline">Bottom</Button>
                </Tooltip>

                <Tooltip content="左に表示されるツールチップ" position="left">
                  <Button variant="outline">Left</Button>
                </Tooltip>

                <Tooltip content="右に表示されるツールチップ" position="right">
                  <Button variant="outline">Right</Button>
                </Tooltip>

                <Tooltip content="これはヘルプテキストです。ホバーして詳細を確認できます。">
                  <Badge variant="primary">ホバーしてみて</Badge>
                </Tooltip>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Tabs */}
        <section>
          <h2 className="font-serif text-3xl font-bold text-primary-foreground mb-6">
            Tabs
          </h2>
          <Card>
            <CardContent>
              <Tabs
                tabs={[
                  {
                    id: "overview",
                    label: "概要",
                    icon: <Book className="h-4 w-4" />,
                    content: (
                      <div className="space-y-4">
                        <h3 className="font-serif text-xl font-bold">
                          プロジェクト概要
                        </h3>
                        <p className="text-primary-foreground/80">
                          MisteryMeshは、AIと人間が協力してマーダーミステリーをプレイするプラットフォームです。
                        </p>
                      </div>
                    ),
                  },
                  {
                    id: "features",
                    label: "機能",
                    icon: <Star className="h-4 w-4" />,
                    content: (
                      <div className="space-y-4">
                        <h3 className="font-serif text-xl font-bold">主な機能</h3>
                        <ul className="list-disc list-inside space-y-2 text-primary-foreground/80">
                          <li>AIによる自動シナリオ生成</li>
                          <li>マルチモーダル生成（画像・動画）</li>
                          <li>シナリオ共有プラットフォーム</li>
                        </ul>
                      </div>
                    ),
                  },
                  {
                    id: "settings",
                    label: "設定",
                    icon: <Settings className="h-4 w-4" />,
                    content: (
                      <div className="space-y-4">
                        <h3 className="font-serif text-xl font-bold">設定</h3>
                        <p className="text-primary-foreground/80">
                          ここに設定画面が表示されます。
                        </p>
                      </div>
                    ),
                  },
                ]}
                variant="line"
              />

              <div className="mt-8">
                <h3 className="font-serif text-lg font-semibold mb-4">
                  Enclosed Variant
                </h3>
                <Tabs
                  tabs={[
                    {
                      id: "tab1",
                      label: "タブ1",
                      content: <p>タブ1のコンテンツ</p>,
                    },
                    {
                      id: "tab2",
                      label: "タブ2",
                      content: <p>タブ2のコンテンツ</p>,
                    },
                    {
                      id: "tab3",
                      label: "タブ3",
                      content: <p>タブ3のコンテンツ</p>,
                    },
                  ]}
                  variant="enclosed"
                />
              </div>
            </CardContent>
          </Card>
        </section>

        {/* フッター */}
        <div className="text-center pt-12 pb-8">
          <p className="text-primary-foreground/60 text-sm">
            MisteryMesh UI Components v0.2.0
          </p>
        </div>
      </div>
    </main>
  );
}
