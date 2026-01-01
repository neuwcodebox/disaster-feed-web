# AGENTS.md

## 프로젝트 개요

실시간 재난/안전 현황들을 한 화면에서 사용자 조작이 없이도 최신으로 볼 수 있는 웹 애플리케이션.

## 작업 흐름

어떤 작업을 할 때마다 아래 단계를 충실히 따릅니다.

1. 요청 사항 및 AGENTS.md 검토
2. 요청에 맞는 작업 수행
3. 타입/린트 오류 검사 및 수정
  a. `npx tsc --noEmit` 실행
  b. `npm run lint:fix` 스크립트 실행
4. 필요한 경우 AGENTS.md 업데이트
5. 결과 보고 및 커밋 메시지 추천

## 이벤트 모델

- id: UUID v7
- source: 숫자 enum (앱에서 관리; DB에는 enum 제약 없음)
- kind: 숫자 enum (앱에서 관리; DB에는 enum 제약 없음)
- title: 한 줄
- body: 본문(선택)
- fetched_at: timestamptz (필수)
- 선택: occurred_at, region_text, payload(jsonb)
- level: 숫자 enum (필수)

## Coding conventions

- 보기 좋은 코드를 작성합니다.
- Type Safe를 준수합니다. `any` 사용을 금지하며 꼭 필요하다면 `unknown`을 사용합니다. Zod 스키마를 적극 활용합니다.
- Biome을 사용하여 코드 스타일을 강제합니다.
- `forEach` 대신 `for` 문을 사용합니다.
- `then` 대신 `async/await`를 사용합니다.
- 주석은 남용하지 말고 코드만 봐서 이해하기 어려운 부분에만 한국어로 작성합니다.
- Code smells를 피합니다. (예: 중복 코드, 긴 함수, 긴 매개변수 목록 등)
- 타입에는 PascalCase, 변수/함수/메서드에는 camelCase, 상수에는 UPPER_SNAKE_CASE를 사용합니다.
- enum 이름은 복수형으로 작성합니다.
- Zod 스키마 변수는 schemaXXX 형태의 camelCase로 작성합니다.

## Git commit style

- Conventional Commits 규칙을 따릅니다.
- 서로 다른 변경을 한 커밋에 묶지 않습니다.

## MCP and Skills

- use context7 for the latest information
