# GitHub 저장소 푸시 명령어

## 저장소 생성 후 실행할 명령어

GitHub에서 저장소를 생성한 후, 아래 명령어를 실행하세요:

```powershell
# 원격 저장소 추가 (YOUR_USERNAME과 저장소 이름을 변경하세요)
git remote add origin https://github.com/YOUR_USERNAME/rpa-schedule-manager.git

# 기본 브랜치를 main으로 변경
git branch -M main

# 푸시
git push -u origin main
```

## 저장소 이름 예시

- `rpa-schedule-manager`
- `rpa-bot-scheduler`
- `rpa-calendar-system`

## GitHub 저장소 생성 방법

1. https://github.com 접속 → 로그인
2. 우측 상단 "+" → "New repository" 클릭
3. Repository name 입력
4. Description (선택): "RPA BOT Schedule Management System"
5. Public 또는 Private 선택
6. **"Initialize this repository with a README" 체크 해제** (이미 커밋이 있으므로)
7. "Create repository" 클릭

