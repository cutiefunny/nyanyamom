// 리듬 게임 설정 파일 (Reactive Game Configuration with Solid Store)
import { createStore } from 'solid-js/store'

export const [config, setConfig] = createStore({
  // 캔버스 설정
  canvas: {
    width: 1200,
    height: 420,
    backgroundColor: '#1e2433'
  },

  // 리듬 게임 설정
  rhythm: {
    bpm: 100, // 분당 비트 수
    travelBeats: 16, // 스폰 위치에서 밥그릇(판정선)까지 이동하는 데 걸리는 박자 수 (속도 2배 감속)
    spawnIntervalBeats: 2, // 고양이 스폰 주기 (박자 단위: 2비트마다)
    spawnChance: 0.75, // 스폰 확률 (0.75 = 75%)
    soundEnabled: true, // 효과음 활성화 여부
    metronomeSound: true, // 메트로놈 비트 사운드
    // 판정 범위 (오차 밀리초)
    perfectWindow: 65,
    greatWindow: 130,
    goodWindow: 200
  },

  // 고양이 관련 설정
  cat: {
    size: 70, // 일반 고양이 표시 크기
    specialChance: 0.2, // 특수개체(리더 고양이) 등장 확률
    specialFoodConsume: 3, // 특수개체 사료 소모량
    normalFoodConsume: 1 // 일반 고양이 사료 소모량
  },

  // 밥그릇 및 사료 설정
  bowl: {
    maxCapacity: 100,
    currentAmount: 100,
    refillAmount: 20
  },

  // 게임 진행 통계 (점수, 콤보 등)
  stats: {
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfect: 0,
    great: 0,
    good: 0,
    miss: 0
  }
})

