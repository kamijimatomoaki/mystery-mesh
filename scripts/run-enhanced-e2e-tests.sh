#!/bin/bash

# =============================================================================
# MisteryMesh Enhanced E2E Test Runner
# 強化されたE2Eテストスイートの実行スクリプト
# =============================================================================

set -e

# カラー出力設定
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# ロゴ表示
echo -e "${CYAN}"
cat << "EOF"
╔═══════════════════════════════════════════════════════════════╗
║                    MisteryMesh E2E Tests                      ║
║                   Enhanced Test Suite                         ║
╚═══════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"

# 設定
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RESULTS_DIR="$PROJECT_ROOT/test-results/enhanced_${TIMESTAMP}"
REPORT_FILE="$RESULTS_DIR/enhanced_test_report.html"

# オプション解析
BROWSER="chromium"
TEST_TYPE="all"
HEADED=false
DEBUG=false
PARALLEL=false
CI_MODE=false

show_help() {
    echo -e "${YELLOW}Usage: $0 [OPTIONS]${NC}"
    echo ""
    echo -e "${CYAN}Options:${NC}"
    echo -e "  -b, --browser      ブラウザ選択 (chromium|firefox|webkit|all) [default: chromium]"
    echo -e "  -t, --test-type    テスト種別 (auth|realtime|performance|security|existing|all) [default: all]"
    echo -e "  -h, --headed       ヘッドフルモードで実行"
    echo -e "  -d, --debug        デバッグモード"
    echo -e "  -p, --parallel     並行実行（注意: ゲーム状態の整合性に影響する可能性）"
    echo -e "  -c, --ci           CI モード"
    echo -e "  --help             このヘルプを表示"
    echo ""
    echo -e "${CYAN}Examples:${NC}"
    echo -e "  $0 -t auth -b chromium          # Chromium で認証テストのみ実行"
    echo -e "  $0 -t performance --headed      # ヘッドフルモードでパフォーマンステスト"
    echo -e "  $0 -b all -t security           # 全ブラウザでセキュリティテスト"
    echo -e "  $0 --ci                         # CI モードで全テスト実行"
}

# オプション処理
while [[ $# -gt 0 ]]; do
    case $1 in
        -b|--browser)
            BROWSER="$2"
            shift 2
            ;;
        -t|--test-type)
            TEST_TYPE="$2"
            shift 2
            ;;
        -h|--headed)
            HEADED=true
            shift
            ;;
        -d|--debug)
            DEBUG=true
            shift
            ;;
        -p|--parallel)
            PARALLEL=true
            shift
            ;;
        -c|--ci)
            CI_MODE=true
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# 前提条件チェック
echo -e "${BLUE}🔍 前提条件をチェックしています...${NC}"

# Node.js 確認
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js が見つかりません${NC}"
    exit 1
fi

# npm 確認
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm が見つかりません${NC}"
    exit 1
fi

# プロジェクトディレクトリ確認
if [ ! -f "$PROJECT_ROOT/package.json" ]; then
    echo -e "${RED}❌ package.json が見つかりません: $PROJECT_ROOT${NC}"
    exit 1
fi

# Playwright 設定確認
if [ ! -f "$PROJECT_ROOT/playwright.config.ts" ]; then
    echo -e "${RED}❌ playwright.config.ts が見つかりません${NC}"
    exit 1
fi

echo -e "${GREEN}✅ 前提条件OK${NC}"

# 結果ディレクトリ作成
mkdir -p "$RESULTS_DIR"

# プロジェクトディレクトリに移動
cd "$PROJECT_ROOT"

# 依存関係インストール確認
echo -e "${BLUE}📦 依存関係を確認しています...${NC}"
if [ ! -d "node_modules" ] || [ ! -f "node_modules/.package-lock.json" ]; then
    echo -e "${YELLOW}⚠️  依存関係をインストールしています...${NC}"
    npm install
fi

# Playwright ブラウザ確認
echo -e "${BLUE}🌐 Playwright ブラウザを確認しています...${NC}"
npx playwright install --with-deps

echo -e "${PURPLE}🧪 テストを実行しています...${NC}"
echo -e "${CYAN}テスト種別: $TEST_TYPE${NC}"
echo -e "${CYAN}ブラウザ: $BROWSER${NC}"
echo ""

# テスト実行
START_TIME=$(date +%s)

# テスト実行（シンプル版）
case $TEST_TYPE in
    "auth")
        npx playwright test e2e/auth.spec.ts --project=$BROWSER
        ;;
    "realtime")
        npx playwright test e2e/realtime.spec.ts --project=$BROWSER
        ;;
    "performance")
        npx playwright test e2e/performance.spec.ts --project=$BROWSER
        ;;
    "security")
        npx playwright test e2e/security.spec.ts --project=$BROWSER
        ;;
    "existing")
        npx playwright test e2e/critical-path.spec.ts e2e/agent-behavior.spec.ts e2e/card-operations.spec.ts --project=$BROWSER
        ;;
    "all"|*)
        npx playwright test e2e/ --project=$BROWSER
        ;;
esac

TEST_EXIT_CODE=$?
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# 結果判定
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✅ テスト実行完了（成功）${NC}"
    echo -e "${GREEN}🎉 全てのテストが正常に完了しました！${NC}"
else
    echo -e "${YELLOW}⚠️  テスト実行完了（一部失敗）${NC}"
fi

echo ""
echo -e "${CYAN}実行時間: ${DURATION}秒${NC}"

# レポート確認
if [ -f "$PROJECT_ROOT/playwright-report/index.html" ]; then
    echo -e "${GREEN}📊 HTMLレポートが生成されました:${NC}"
    echo -e "${BLUE}   file://$PROJECT_ROOT/playwright-report/index.html${NC}"
fi

exit $TEST_EXIT_CODE