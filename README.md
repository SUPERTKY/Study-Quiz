# School_Study_Quiz
## 問題ファイルを追加する場合の形式

現時点の学習セッションでは問題ファイルを読み込まず、有効得点を常に `1` として操作の効果を計算します。
将来、問題ファイルを作る場合は、教科・難易度ごとにJSONファイルを分け、次の形式で作成してください。

```json
[
  {
    "id": "math-normal-001",
    "subject": "数学",
    "difficulty": "normal",
    "question": "一次方程式 2x + 3 = 11 の解はどれですか。",
    "choices": ["x = 2", "x = 3", "x = 4", "x = 5"],
    "answerIndex": 2,
    "explanation": "2x + 3 = 11 なので、2x = 8、x = 4 です。"
  }
]
```

- `difficulty` は通常問題なら `normal`、難しい問題なら `hard` にします。
- `choices` は必ず4つにし、正解は1つだけにします。
- `answerIndex` は `choices` の0始まりの番号です。上の例では3番目の選択肢が正解なので `2` です。
- `explanation` には学習後に表示できる短い解説を書きます。

## オンライン実施状態（Durable Objects）の準備

この学習クイズの参加受付・対戦同期は短時間に同じ状態を何度も更新するため、Cloudflare KV ではなく **Cloudflare Durable Objects** を優先して使います。Durable Objects は同じセッション状態を1つの強整合な実行場所で扱えるため、35人規模の同時接続でも KV の読み書き上限や結果整合性の遅延に依存しにくくなります。

### Cloudflare Pages で必要な設定

1. `wrangler.session-do.toml` を使って Durable Object Worker をデプロイします。

   ```bash
   npx wrangler deploy -c wrangler.session-do.toml
   ```

2. Pages には `wrangler.toml` の `GAME_SESSION_DO` binding を反映してデプロイします。ダッシュボードで手動設定する場合も、次と同じ内容にしてください。
   - **変数名**: `GAME_SESSION_DO`
   - **Worker / script**: `school-rpg-session-do`
   - **Durable Object class / entrypoint**: `MyDurableObject`
   - `hello-world-do-template` などのテンプレート Worker を選ぶと、今回のように `Handler does not export a fetch() function.` になります。これは Durable Object のデータが壊れたのではなく、Pages が「このアプリ用の fetch() を持つ Durable Object クラス」ではないものへ接続している状態です。
3. **Settings** → **Environment variables** で次の値を設定します。
   - `PASSWORD`: 参加者が学習クイズ画面へ入るためのパスワード
   - `ADMIN_PASSWORD`: 管理者画面と実施状態の更新に使うパスワード
4. Pages プロジェクトをデプロイし直します。

### KV をフォールバックとして使う場合

`GAME_SESSION_DO` が未設定の場合は、従来どおり `GAME_SESSION_KV` / `GAME_SESSION` の KV binding を使って動作できます。ただし KV は高速な読み取り向けの仕組みで、リアルタイム対戦のように複数端末が短時間に同じ状態を読み書きする用途では、書いた直後の値が別端末にすぐ見えなかったり、古い値を読んだ端末の保存で新しい状態が上書きされたりする可能性があります。

KV を使う場合は **Settings** → **Functions** → **KV namespace bindings** で `GAME_SESSION_KV` を設定してください。`GAME_SESSION_KV` は Environment variables には作らないでください。通常の文字列変数として作ると KV として保存できません。

### セッション保存の診断

管理者画面の「KVデバッグ」、または `/api/session` に `{"action":"diagnoseSessionStore","adminPassword":"管理者パスワード"}` を POST すると、現在の保存先を確認できます。

- `activeBinding: "GAME_SESSION_DURABLE_STORAGE"` の場合は Durable Object 内部ストレージで読み書きできています。
- `activeBinding: "GAME_SESSION_KV"` または `"GAME_SESSION"` の場合は KV フォールバックで動いています。
- `GAME_SESSION_STORE_NOT_CONFIGURED` の場合は `GAME_SESSION_DO` または `GAME_SESSION_KV` の binding が Pages に設定されていません。
- `readWriteOk: false` の場合は、対象 binding の選択、Production / Preview の環境差、設定保存後の再デプロイを確認してください。

### 補足

- Durable Object Worker は `workers/session-do.js` から `MyDurableObject` と互換用の `SessionDurableObject` を公開します。Pages の binding は基本的に `MyDurableObject` を指定してください。
- Durable Object Worker の設定例は `wrangler.session-do.toml` にあります。Pages 側の binding 例は `wrangler.toml` にあります。
- 参加受付、試合状態、生存確認は Durable Object 内部ストレージに保存されます。
- KV フォールバック時のみ、学習中の生存確認は `match:<試合ID>:seen:<参加者ID>` という KV エントリーに保存されます。このエントリーは1時間後に自動削除されます。
- すでに増えてしまった古い KV heartbeat は、必要なときだけ `/api/session` に `{"action":"cleanupMatchHeartbeats","adminPassword":"管理者パスワード","limit":100}` を POST して少しずつ削除してください。返却された `cleanupComplete` が `false` の場合は、`cleanupCursor` を次のリクエストに含めて繰り返します。
- `GAME_SESSION_DO` と `GAME_SESSION_KV` のどちらも未設定でも、一時的なメモリ保存で動く場合があります。ただし、これはサーバーの再起動や別インスタンスでは消えるため、本番運用では必ず Durable Object binding を設定してください。
