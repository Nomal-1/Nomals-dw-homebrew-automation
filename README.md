# Nomal's DW 홈브루 자동화

던전월드(Dungeon World) GM이 실제 캠페인에서 쓰는 **커스텀(홈브루) 액션** 전용
자동화 모듈입니다. 공식 컴펜디엄 액션 자동화는 필수 모듈인
[dw-automation](https://github.com/Nomal-1/dw-automation)이 담당하고, 이
모듈은 그 위에서 홈브루 액션만 다룹니다.

## 필수 모듈

- [dw-automation](https://github.com/Nomal-1/dw-automation) — 이 모듈이
  노출하는 `game.modules.get("dw-automation").api`를 통해 무브 카드 파싱,
  선택지 다이얼로그, 채팅 알림 같은 공용 유틸을 가져다 씁니다.
- `lib-wrapper`
- [dungeonworld-ko](https://github.com/Nomal-1/t2) — 한글화 모듈

## 설계 원칙

dw-automation 저장소의 [ARCHITECTURE.md](https://github.com/Nomal-1/dw-automation/blob/main/ARCHITECTURE.md)에
정리된 원칙과 파일 구조 관례를 그대로 따라간다 — 특히 "번역된 자유 텍스트로
로직을 분기하지 않는다"는 원칙과, dw-automation 내부 파일을 직접 import하지
않고 공개 API로만 접근한다는 원칙.

## 현재 상태

- **길티기어 / 스트라이브** (전사 레벨업 액션): 게이지(0~5, 토큰 리소스 바로 표시
  가능) + 스턴엣지·다이어 에클라·폴트리스 디펜스, 6레벨 이후 스트라이브로
  세이크리드 엣지·라이드 더 라이트닝·드래곤 인스톨까지 해금되는 홈브루 액션
  세트. `scripts/features/guilty-gear-*.js` 참고.

다음 커스텀 액션이 정해지는 대로 같은 방식으로 하나씩 추가됩니다.
