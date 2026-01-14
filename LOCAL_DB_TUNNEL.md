# 로컬 MySQL 외부 접근 방법

## 🎯 목표
로컬 MySQL을 그대로 사용하면서 클라우드 서비스에서 접근 가능하게 하기

## 옵션 1: ngrok TCP (카드 등록 필요) ⚠️

### 장점
- ✅ 설정 간단
- ✅ 안정적
- ✅ 무료 (카드 등록만)

### 단점
- ⚠️ 카드 정보 입력 필요 (무료이지만 검증용)

### 설정 방법
1. https://dashboard.ngrok.com/settings#id-verification 접속
2. 카드 정보 입력 (무료, 검증용)
3. ngrok TCP 터널 시작:
   ```powershell
   ngrok tcp 3306
   ```
4. Railway/Render 환경 변수에 ngrok URL 설정

## 옵션 2: Cloudflare Tunnel (무료, 카드 불필요) ⭐ 권장

### 장점
- ✅ 완전 무료
- ✅ 카드 등록 불필요
- ✅ 안정적
- ✅ 무제한

### 설정 방법

#### 1. Cloudflare 계정 생성
1. https://cloudflare.com 접속
2. 무료 계정 생성

#### 2. Cloudflared 설치
```powershell
# Chocolatey로 설치
choco install cloudflared -y

# 또는 직접 다운로드
# https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/
```

#### 3. Cloudflare Tunnel 생성
```powershell
# 로그인
cloudflared tunnel login

# 터널 생성
cloudflared tunnel create rpa-mysql

# 터널 실행 (MySQL)
cloudflared tunnel run rpa-mysql --url tcp://localhost:3306
```

#### 4. Railway/Render 환경 변수 설정
Cloudflare에서 제공하는 호스트와 포트 사용

## 옵션 3: localtunnel (무료, 카드 불필요)

### 장점
- ✅ 완전 무료
- ✅ 카드 불필요
- ✅ 설정 간단

### 단점
- ⚠️ URL이 매번 변경됨
- ⚠️ 안정성이 낮을 수 있음

### 설정 방법
```powershell
# 설치
npm install -g localtunnel

# MySQL 터널 시작
lt --port 3306 --subdomain rpa-mysql
```

## 옵션 4: SSH 터널링 (서버 필요)

로컬에 SSH 서버가 있거나 VPS를 사용하는 경우

### 설정 방법
```powershell
# SSH 터널 생성
ssh -L 3306:localhost:3306 user@your-server.com -N
```

## 🎯 권장 방법

### 1순위: Cloudflare Tunnel
- 완전 무료
- 카드 불필요
- 안정적

### 2순위: ngrok (카드 등록)
- 설정 간단
- 안정적
- 무료 (카드 검증만)

### 3순위: localtunnel
- 완전 무료
- 설정 간단
- 안정성 낮음

## 📋 빠른 시작: Cloudflare Tunnel

### 1단계: Cloudflared 설치
```powershell
choco install cloudflared -y
```

### 2단계: 로그인 및 터널 생성
```powershell
cloudflared tunnel login
cloudflared tunnel create rpa-mysql
```

### 3단계: 터널 실행
```powershell
cloudflared tunnel run rpa-mysql --url tcp://localhost:3306
```

### 4단계: Railway/Render 환경 변수 설정
Cloudflare에서 제공하는 연결 정보 사용

## ⚠️ 보안 주의사항

1. **강력한 비밀번호**: 로컬 MySQL 비밀번호를 강력하게 설정
2. **방화벽**: 로컬 방화벽에서 MySQL 포트 차단 (터널만 사용)
3. **접근 제한**: 가능하면 IP 화이트리스트 사용

