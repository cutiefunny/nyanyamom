// 게임 설정 파일 (Reactive Game Configuration with Solid Store)
import { createStore } from 'solid-js/store'

export const [config, setConfig] = createStore({
  // 캔버스 설정
  canvas: {
    width: 600,
    height: 600,
    backgroundColor: '#2d3748'
  },

  // 고양이 관련 설정
  cat: {
    // 고양이 생성 검사 주기 (ms)
    spawnInterval: 1000,
    
    // 고양이 생성 확률 (0.1 = 10%)
    spawnChance: 0.1,
    
    // 고양이 이동 속도 범위 (화면 밖 <-> 밥그릇 이동 시간 ms)
    minMoveDuration: 3000,
    maxMoveDuration: 6000,
    
    // 고양이 밥 먹는 시간 설정
    eating: {
      pulseDuration: 250,
      pulseRepeat: 3
    },
    
    // 고양이 표시 크기 (px)
    size: 64,

    // 특수개체(리더 고양이) 스폰 확률 (0.1 = 10%)
    specialChance: 0.1,

    // 특수개체 사료 소모량 (개)
    specialFoodConsume: 5
  },

  // 밥그릇 및 사료 설정
  bowl: {
    maxCapacity: 100,
    currentAmount: 100,
    refillAmount: 10,
    outerRadius: 50,
    mainRadius: 35,
    innerRadius: 25
  }
})
