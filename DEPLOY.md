# Jeong Yun Mi 포트폴리오 — 배포와 관리자 페이지 설정

사이트는 `site/` 폴더, 관리자 페이지는 `site/admin/`(Decap CMS)입니다.
관리자 페이지에서 저장하면 GitHub에 기록되고, Netlify가 약 1분 안에 사이트를 다시 배포합니다.

## 폴더 구성

| 경로 | 내용 |
|---|---|
| `site/index.html` | 첫 화면 (About + 메인 사진, 아래 Contact) |
| `site/portfolio.html` | 포트폴리오 3열 목록 + 카테고리 필터 |
| `site/post.html?id=…` | 게시물 상세 |
| `site/content/site.json` | 메인 사진, 소개글, 연락처 (관리자 페이지에서 수정) |
| `site/content/posts/*.json` | 게시물 1개당 파일 1개 (관리자 페이지에서 추가·수정) |
| `site/images/uploads/` | 관리자 페이지에서 올린 사진 |
| `site/data/posts.js` | 위 content를 합쳐 자동 생성되는 파일. 직접 고치지 않습니다 |
| `scripts/build-data.mjs` | `posts.js` 생성 스크립트 (Netlify가 배포할 때마다 실행) |

## 처음 한 번만 하는 설정

1. **GitHub 저장소**: `ran2989/jeongyunmi-portfolio` (비공개). 나중에 윤미 님 계정으로 옮기면 아래 2번의 저장소 이름도 바꿉니다.
2. **`site/admin/config.yml`**: `repo:` 값이 실제 저장소 이름과 같은지 확인합니다.
3. **Netlify**: Add new site → Import an existing project → GitHub → 이 저장소를 선택합니다.
   빌드 설정은 `netlify.toml`에서 자동으로 읽습니다 (publish `site`, command `node scripts/build-data.mjs`).
4. **GitHub OAuth 앱** (관리자 로그인용):
   - GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
   - Homepage URL: 사이트 주소 (예: `https://jeongyunmi.com`)
   - Authorization callback URL: `https://api.netlify.com/auth/done`
   - 만들어진 Client ID와 Client Secret을 복사합니다.
5. **Netlify에 OAuth 등록**: Site configuration → Access & security → OAuth → Install provider → GitHub에 Client ID와 Secret을 넣습니다.
6. **도메인 연결**: Netlify Domain management → Add a domain. Netlify가 보여 주는 A / CNAME 값을 가비아 DNS 설정에 넣습니다.

저장소가 윤미 님 계정이 아니면, 저장소 Settings → Collaborators에서 윤미 님 GitHub 계정을 추가해 쓰기 권한을 줍니다.

## 윤미 님이 쓰는 법

1. `https://사이트주소/admin` 접속 → **GitHub로 로그인**
2. **포트폴리오** → **새 포트폴리오 게시물**: 제목, 날짜, 카테고리, 사진, 크레딧을 넣고 **게시**
3. **사이트 설정** → **메인 화면 · 소개 · 연락처**: 메인 사진과 소개글 수정
4. 저장 후 1~2분 뒤 사이트에 반영됩니다.

사진은 원본 그대로 올려도 됩니다. 관리자 페이지가 올리기 전에 줄이고(긴 쪽 2400px) 자르기 화면을 보여 주며,
파일 이름 끝에 업로드 시각을 붙여 기존 사진을 덮어쓰지 않게 합니다.

## 윤미 님 게시가 배포되지 않을 때

Netlify Deploys에 `Build blocked: Unrecognized Git contributor`가 뜨면, 비공개 저장소에 Netlify 팀원이 아닌 계정
(`yaami0801`)이 올린 변경이라 막힌 것입니다. 해결 방법은 둘 중 하나입니다.

- Netlify 유료 요금제(Pro)에서 윤미 님을 팀원으로 초대하고, 윤미 님이 GitHub 계정으로 Netlify에 가입
- 저장소를 공개(Public)로 전환 (커밋 기록의 작성자 이메일도 공개되므로 먼저 확인)

급할 때는 저장소 주인 계정으로 아무 변경이나 하나 올리면, 그 배포에 그때까지의 게시물이 모두 반영됩니다.
배포 1번에 크레딧 15가 듭니다.

## 카테고리 바꾸기

`site/admin/config.yml`의 `options`와 `scripts/build-data.mjs`의 `CATEGORIES`를 같이 고칩니다.

## 내 컴퓨터에서 보기

```sh
node scripts/build-data.mjs
cd site && python3 -m http.server 8000   # http://localhost:8000
```
