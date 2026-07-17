# School_RPG_game
## 問題ファイルを追加する場合の形式

現時点のバトルでは問題ファイルを読み込まず、有効得点を常に `1` として技の効果を計算します。
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
- `explanation` には対戦後に表示できる短い解説を書きます。
