# ngrok TCP 엔드포인트 문제 해결

## 문제
```
ERROR: failed to start tunnel: You must add a credit or debit card before you can use TCP endpoints on a free account.
```

## 해결 방법

### 옵션 1: ngrok에 카드 등록 (무료)

1. https://dashboard.ngrok.com/settings#id-verification 접속
2. 카드 정보 입력 (무료이지만 검증용)
3. 카드 등록 후 TCP 터널 사용 가능

**장점:**
- 로컬 DB 그대로 사용 가능
- 추가 비용 없음

**단점:**
- 카드 정보 입력 필요

### 옵션 2: Railway MySQL 사용 (권장) ⭐

ngrok 없이 Railway의 MySQL 서비스를 사용하는 것이 더 안정적입니다.

#### Railway MySQL 설정

1. Railway 프로젝트에서 "New" → "Database" → "Add MySQL" 클릭
2. MySQL 서비스 생성 완료
3. "Variables" 탭에서 연결 정보 확인:
   ```
   MYSQLHOST=containers-us-west-xxx.railway.app
   MYSQLPORT=3306
   MYSQLUSER=root
   MYSQLPASSWORD=xxxxx
   MYSQLDATABASE=railway
   ```

4. 백엔드 환경 변수 설정:
   ```
   DB_HOST=containers-us-west-xxx.railway.app
   DB_PORT=3306
   DB_USER=root
   DB_PASSWORD=xxxxx
   DB_NAME=railway
   ```

5. 스키마 마이그레이션:
   ```bash
   mysql -h containers-us-west-xxx.railway.app -P 3306 -u root -p railway < backend/sql/schema.sql
   ```

**장점:**
- ngrok 불필요
- 더 안정적
- 24/7 사용 가능
- 무료 티어 제공

**단점:**
- 로컬 DB가 아닌 클라우드 DB 사용

### 옵션 3: HTTP 터널만 사용 (제한적)

MySQL은 TCP가 필요하므로 이 방법은 사용할 수 없습니다.

## 권장 방법

**Railway MySQL 사용을 권장합니다.** (옵션 2)

이 방법이 가장 안정적이고 설정이 간단합니다.

