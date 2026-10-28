# 資安回報 Security

發現安全問題（例如繞過審核、讀到不該公開的投稿聯絡方式、管理金鑰外洩、XSS）時，請**不要**開公開 issue，
改用 GitHub 的私下回報：repo 的 **Security → Report a vulnerability**。我們會盡快回覆並修正，修正後再公開說明。

## 設計重點

- 網站是純靜態頁面（GitHub Pages），資料存在 Supabase。資料表全部開啟 Row Level Security，匿名使用者不能直接讀寫任何資料表，
  只能呼叫少數 `security definer` 函式：
  - `encore_public_channels`：只回傳已上架頻道的公開欄位，投稿人的聯絡方式不會出現。
  - `encore_submit`：只收 `https://` 網址，有長度限制、同網址不重複、每小時上限。
  - `encore_chat_post`／`encore_chat_recent`：頂樓聊天，有長度、重複與每分鐘總量限制，管理員可以隱藏留言。
- 管理後台使用網址 `#` 後面的金鑰（不會送到伺服器記錄），資料庫只存 SHA-256 雜湊；後台可以一鍵換新金鑰，舊連結立即失效。
- 前端用的 Supabase key 是可公開的 publishable key，權限只有上述函式。
- Edge Function `encore-meta`（投稿時自動抓網頁標題）只接受 https、只連公開網域：每一次轉址都重新檢查，並確認網域解析到的不是內部或保留 IP。
- 投稿的舞台一律在 sandbox iframe 裡播放，且必須經管理員審核才會上架；建置時寫進分享頁的投稿文字都會先做 HTML 跳脫。
- 「上架後自動重建」用的 GitHub token 只存在 Supabase（`encore_settings`），只有 Edge Function `encore-rebuild` 讀得到，
  權限限定為這個 repo 的 Actions 讀寫。
- 投稿上傳的 HTML 由 Edge Function `encore-upload` 用站方的 Pinata 金鑰釘到 IPFS（金鑰只存在 `encore_settings`），
  頁面由 IPFS 閘道提供，跟 encore.taipei 是不同網域，碰不到本站的資料。上傳有次數與大小限制、只紀錄 IP 的雜湊值；
  上傳後一樣要審核才會上架。
