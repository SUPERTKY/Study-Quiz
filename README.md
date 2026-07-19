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

## オンライン実施状態（KV）の準備

KV は Cloudflare の「Key-Value（キーと値）」保存場所です。この学習クイズでは、管理者が「実施する」を押したときの状態（実施中かどうか、選んだ教科）をオンラインで共有するために使います。

ローカルのブラウザ保存では、管理者の端末だけにしか実施状態が残りません。Cloudflare KV に保存すると、別の端末で開いた参加者画面も同じ実施状態を取得できます。

### Cloudflare Pages で必要な設定

1. Cloudflare ダッシュボードで、この Pages プロジェクトを開きます。
2. **Settings** → **Functions** → **KV namespace bindings** を開きます。
3. KV namespace を作成し、バインディング画面では次のように入力します。
   - **変数名**: `GAME_SESSION_KV`
   - **KV 名前空間**: 作成した KV namespace を選択
4. **Settings** → **Environment variables** で次の値を設定します。
   - `PASSWORD`: 参加者が学習クイズ画面へ入るためのパスワード
   - `ADMIN_PASSWORD`: 管理者画面と実施状態の更新に使うパスワード

   注意: `GAME_SESSION_KV` は Environment variables には作らないでください。通常の文字列変数として作ると KV として保存できません。
5. デプロイし直します。

### 補足

- KV の「エントリー」は手動で作らなくて大丈夫です。管理者画面で「実施する」を押すと、アプリが自動で `current` というエントリーを作成・更新します。
- パスワード変数が Cloudflare Functions から読めているか確認したい場合は、`/api/auth` に GET すると `PASSWORD` と `ADMIN_PASSWORD` の設定有無、文字数、空白混入の有無を確認できます。値そのものは返しません。
- 入力したパスワードと Cloudflare の値が一致しているかを詳しく確認したい場合は、`/api/auth` に `{"mode":"startup","password":"入力したパスワード","debug":true}` または `{"mode":"admin","password":"入力したパスワード","debug":true}` を POST してください。返却される `input.length` と `expected.length` が違う場合は、入力ミスや空白混入が疑われます。
- KV 設定を確認したい場合は、`/api/session` に `{"action":"diagnoseSessionStore","adminPassword":"管理者パスワード"}` を POST すると、バインディングが使えるかを確認できます。返却される `bindings` では、`configured` が設定有無、`isKvBinding` が実際に KV として使える状態かを示します。
- 学習中の生存確認は `match:<試合ID>:seen:<参加者ID>` という KV エントリーに保存されます。このエントリーは1時間後に自動削除されるため、過去試合の heartbeat が残り続けてストレージを圧迫することを防ぎます。
- すでに増えてしまった古い heartbeat は、通常の「実施終了」や「実施番号をリセット」からは削除しません。重い削除処理で実施状態の保存を止めないためです。加算が必要なときだけ、`/api/session` に `{"action":"cleanupMatchHeartbeats","adminPassword":"管理者パスワード","limit":100}` を POST して、`match:` から始まる heartbeat を少しずつ削除してください。返却された `cleanupComplete` が `false` の場合は、`cleanupCursor` を次のリクエストに含めて繰り返します。
- `GAME_SESSION_KV` が未設定でも、一時的なメモリ保存で動く場合があります。ただし、これはサーバーの再起動や別インスタンスでは消えるため、本番運用では必ず KV を設定してください。
- 参加受付と学習同期にも KV を使います。無料枠の容量が心配な場合は、Cloudflare ダッシュボードで `match:` から始まる古いエントリーが増え続けていないか確認してください。
