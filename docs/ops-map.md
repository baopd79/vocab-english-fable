# Bản đồ vận hành — vocabun.com

> Tra cứu nhanh sau khi MVP đã live (2026-07-09): dịch vụ nào giữ vai gì, khi nào
> phải vào đâu, và toàn bộ lệnh Linux từ setup tới vận hành hằng ngày.
> Lý thuyết nền: `deploy-guide.md` · khôi phục data: `restore-runbook.md` · những gì
> đã làm và bug đã dính: nhật ký Task 20–22 trong `django-guide.md`.

## 1. Bản đồ nhân vật

```
Laptop ──git push──▶ GitHub Actions ──build──▶ GHCR (kho image)
                        │                          │
                        └────SSH ra lệnh────▶ VPS (DigitalOcean) ◀──pull image──┘
                                               │  nginx + fe + be + worker + db + redis
Người dùng ──vocabun.com──▶ Cloudflare DNS ────┘        │
                                                         └──cron 2h sáng VN──▶ Backblaze B2
UptimeRobot ──ping /api/v1/health mỗi 5 phút──▶ sập ──▶ email
```

| Dịch vụ | Vai trò | Khi nào cần vào web dashboard |
|---|---|---|
| DigitalOcean | Cho thuê VPS ($6/tháng) | Xem graph RAM/CPU; resize gói; hóa đơn. ~1 lần/tháng |
| Cloudflare | DNS: `vocabun.com` → IP | Đổi IP, thêm subdomain. Gần như không bao giờ |
| GitHub | Chứa code + robot CI/CD + Secrets | Tab Actions khi muốn xem pipeline; Settings khi đổi secret |
| GHCR | Kho image private | Không |
| Backblaze B2 | Két backup offsite | Chỉ khi mất key rclone |
| Let's Encrypt | Cert HTTPS (tự gia hạn) | Không |
| UptimeRobot | Báo động khi sập | Khi nhận email báo sập |
| Google Console | OAuth | Thêm test user mới |

**Khi `git push` lên main:** CI chạy pytest+vitest (đỏ = dừng) → Deploy build 2 image → đẩy GHCR → SSH vào VPS: `git pull` + `docker compose pull` + `migrate` + `up -d` + `curl health`. Robot chỉ lặp lại đúng chuỗi lệnh đã làm tay ở Task 20–21.

## 2. Lệnh Linux theo tình huống

### 2.0 · Cài một lần cho đỡ mỏi tay (tùy chọn)

Mọi lệnh compose trên VPS cần chuỗi `-f ... -f ... --env-file ...` dài. Cài alias `dc` (chạy 1 lần trên VPS):

```bash
echo 'alias dc="docker compose -f ~/vocab-english-fable/docker-compose.prod.yml -f ~/vocab-english-fable/docker-compose.tls.yml --env-file ~/vocab-english-fable/.env.prod"' >> ~/.bashrc
source ~/.bashrc
dc ps   # test
```

Các mục dưới viết theo dạng đầy đủ; có alias thì thay bằng `dc`.

### 2.1 · Setup một lần (ĐÃ LÀM 2026-07-09 — chỉ cần lại khi dựng VPS mới)

Đây là "biên bản" những gì đã chạy, theo đúng thứ tự. Dựng VPS mới = chạy lại từ trên xuống (chi tiết giải thích: deploy-guide Phần 2).

```bash
# --- bằng root (lần SSH đầu tiên sau khi tạo droplet) ---
apt-get update && apt-get upgrade -y                      # vá OS

fallocate -l 1G /swapfile && chmod 600 /swapfile          # swap 1GB (gói RAM 1GB)
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
echo 'vm.swappiness=10' > /etc/sysctl.d/99-swappiness.conf

adduser --disabled-password --gecos '' deploy             # user làm việc, không dùng root
mkdir -p /home/deploy/.ssh && cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh && chmod 700 /home/deploy/.ssh
echo 'deploy ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/deploy

# khóa SSH — CHỈ sau khi đã test login được bằng deploy!
# (file 00- để thắng 50-cloud-init.conf: sshd lấy giá trị ĐẦU TIÊN đọc được)
printf 'PermitRootLogin no\nPasswordAuthentication no\n' > /etc/ssh/sshd_config.d/00-hardening.conf
sshd -t && systemctl restart ssh

# --- bằng deploy (từ đây trở đi không bao giờ đụng root nữa) ---
sudo ufw allow OpenSSH && sudo ufw allow 80/tcp && sudo ufw allow 443/tcp
sudo ufw --force enable

sudo apt-get install -y fail2ban unattended-upgrades      # chống dò pass + tự vá bảo mật
printf '[sshd]\nenabled = true\n' | sudo tee /etc/fail2ban/jail.local
sudo systemctl enable --now fail2ban

curl -fsSL https://get.docker.com | sudo sh               # Docker + compose plugin
sudo usermod -aG docker deploy                            # logout/login lại để có hiệu lực

# repo + secrets + registry
ssh-keygen -t ed25519 -f ~/.ssh/github_deploy -N ''       # pub key → GitHub repo Deploy keys
git clone git@github.com:baopd79/vocab-english-fable.git ~/vocab-english-fable
# tạo ~/vocab-english-fable/.env.prod (theo .env.prod.example), chmod 600
docker login ghcr.io -u baopd79                           # dán PAT read:packages

# HTTPS (cần DNS đã trỏ về IP này, port 80 trống)
sudo apt-get install -y certbot
sudo certbot certonly --standalone -d vocabun.com --non-interactive --agree-tos -m <email> \
  --pre-hook /usr/local/bin/vocab-nginx-stop --post-hook /usr/local/bin/vocab-nginx-start

# backup đêm (script: pg_dump | gzip, giữ 7 bản, rclone sync → B2)
rclone config create b2 b2 account <keyID> key <applicationKey>
echo "0 19 * * * /usr/local/bin/vocab-backup >> /home/deploy/backups/backup.log 2>&1" | crontab -
```

### 2.2 · Chẩn đoán — read-only, chạy thoải mái không sợ hỏng gì

Từ laptop: `ssh deploy@146.190.88.71`, rồi:

```bash
cd ~/vocab-english-fable
C="docker compose -f docker-compose.prod.yml -f docker-compose.tls.yml --env-file .env.prod"

$C ps                        # 6 service Up (healthy) không? — lệnh ĐẦU TIÊN khi có sự cố
$C logs -f backend           # log Django realtime (Ctrl+C thoát); thay backend = worker/nginx/frontend/db
$C logs --since 1h backend   # log 1 giờ gần nhất
docker stats --no-stream     # container nào đang ăn RAM/CPU
free -h                      # RAM + swap còn bao nhiêu
df -h /                      # disk còn bao nhiêu (đầy disk = Postgres ngừng ghi!)
git log --oneline -3         # VPS đang chạy bản code nào

sudo fail2ban-client status sshd      # bao nhiêu IP đang bị ban
sudo certbot certificates             # cert còn hạn đến ngày nào
crontab -l                            # cron backup còn đó không
tail ~/backups/backup.log             # backup đêm qua có lỗi không
ls -lh ~/backups/                     # đủ 7 bản, size tăng dần theo data
rclone ls b2:vocabun-backups          # bản mới nhất đã lên B2 chưa
```

### 2.3 · Can thiệp — thay đổi trạng thái, hiểu rồi hãy chạy

```bash
$C restart nginx             # khởi động lại 1 service (vd sau khi sửa nginx/tls.conf)
$C up -d                     # đồng bộ stack với file cấu hình hiện tại
$C stop / $C start           # tắt/bật cả stack (data không mất — nằm trong volume)
/usr/local/bin/vocab-backup  # chạy backup tay ngay (vd trước khi làm gì mạo hiểm)
$C run --rm backend python manage.py migrate          # migrate tay (bình thường robot làm)
$C run --rm backend python manage.py createsuperuser  # tạo tài khoản /admin
docker image prune -f        # dọn image cũ khi df -h báo chật
```

**Deploy KHÔNG nằm trong mục này** — deploy là `git push` từ laptop. Chỉ khi GitHub Actions sập mới deploy tay: `git pull && $C pull && $C run --rm backend python manage.py migrate && $C up -d`.

### 2.4 · Mất data → `restore-runbook.md`. Đừng ứng biến theo trí nhớ.

## 3. Phản xạ xử lý sự cố (thứ tự cố định)

1. Email UptimeRobot / user báo sập → mở `https://vocabun.com/api/v1/health` xem có thật không.
2. SSH vào → `$C ps` — service nào không `Up (healthy)`?
3. `$C logs --since 30m <service đó>` — đọc dòng ERROR cuối cùng.
4. `df -h /` và `free -h` — 2 nguyên nhân "chết từ từ" phổ biến nhất (đầy disk / hết RAM).
5. Sửa theo nguyên nhân; bất lực thì `$C restart <service>` là liều thuốc đầu tiên vô hại.
