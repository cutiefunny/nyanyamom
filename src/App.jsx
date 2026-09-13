import { onMount, onCleanup } from 'solid-js'
import Phaser from 'phaser'
import catNormalImg from './assets/units/normal.png'
import catLeaderImg from './assets/units/leader.png'
import bowl0Img from './assets/bowls/bowl_0.png'
import bowl5Img from './assets/bowls/bowl_5.png'
import bowl50Img from './assets/bowls/bowl_50.png'
import bowl70Img from './assets/bowls/bowl_70.png'
import bowl100Img from './assets/bowls/bowl_100.png'
import { config, setConfig } from './gameConfig'
import {
  initAudio,
  playBeatSound,
  playHitSound,
  playMeowSound,
  playMissSound,
  playRefillSound
} from './soundManager'
import './App.css'

function getBowlTextureKey(currentAmount, maxCapacity = 100) {
  const percentage = (currentAmount / maxCapacity) * 100
  if (percentage <= 0) return 'bowl_0'
  if (percentage <= 20) return 'bowl_5'
  if (percentage <= 60) return 'bowl_50'
  if (percentage <= 85) return 'bowl_70'
  return 'bowl_100'
}

function App() {
  let gameContainer
  let spawnCatFunc = null
  let refillBowlFunc = null

  onMount(() => {
    const phaserConfig = {
      type: Phaser.AUTO,
      width: config.canvas.width,
      height: config.canvas.height,
      parent: gameContainer,
      backgroundColor: config.canvas.backgroundColor,
      scene: {
        preload: preloadScene,
        create: createScene,
        update: updateScene
      }
    }

    const game = new Phaser.Game(phaserConfig)
    let currentScene = null
    const activeCats = []

    function preloadScene() {
      // 일반 고양이 500x100px (5 frames)
      this.load.spritesheet('catNormal', catNormalImg, {
        frameWidth: 100,
        frameHeight: 100
      })

      // 특수개체 리더 고양이 600x100px (6 frames)
      this.load.spritesheet('catLeader', catLeaderImg, {
        frameWidth: 100,
        frameHeight: 100
      })

      // 밥그릇 이미지
      this.load.image('bowl_0', bowl0Img)
      this.load.image('bowl_5', bowl5Img)
      this.load.image('bowl_50', bowl50Img)
      this.load.image('bowl_70', bowl70Img)
      this.load.image('bowl_100', bowl100Img)
    }

    function createScene() {
      const scene = this
      currentScene = scene
      const width = this.cameras.main.width
      const height = this.cameras.main.height

      // 고양이 걷기 & 대기 애니메이션 생성
      if (!this.anims.exists('cat-idle')) {
        this.anims.create({
          key: 'cat-idle',
          frames: this.anims.generateFrameNumbers('catNormal', { start: 0, end: 0 }),
          frameRate: 1
        })
      }
      if (!this.anims.exists('cat-walk')) {
        this.anims.create({
          key: 'cat-walk',
          frames: this.anims.generateFrameNumbers('catNormal', { start: 1, end: 2 }),
          frameRate: 3,
          repeat: -1
        })
      }
      if (!this.anims.exists('cat-leader-idle')) {
        this.anims.create({
          key: 'cat-leader-idle',
          frames: this.anims.generateFrameNumbers('catLeader', { start: 0, end: 0 }),
          frameRate: 1
        })
      }
      if (!this.anims.exists('cat-leader-walk')) {
        this.anims.create({
          key: 'cat-leader-walk',
          frames: this.anims.generateFrameNumbers('catLeader', { start: 1, end: 2 }),
          frameRate: 3,
          repeat: -1
        })
      }

      // 리듬 레인 위치 설정 (수평 트랙)
      const laneY = 260
      const targetX = width - 110 // 오른쪽 끝 밥그릇 위치
      const spawnX = -70          // 왼쪽 화면 밖 스폰 위치

      // 1. 배경 레일 및 트랙 시각 효과
      const trackGraphics = this.add.graphics()
      
      // 트랙 레일 바닥면
      trackGraphics.fillStyle(0x131c2e, 0.8)
      trackGraphics.fillRoundedRect(20, laneY - 45, width - 40, 90, 16)
      
      // 네온 가이드 라인
      trackGraphics.lineStyle(2, 0x3b82f6, 0.4)
      trackGraphics.lineBetween(30, laneY, targetX - 50, laneY)

      // 박자 가이드 비트 눈금선
      const beatDist = (targetX - spawnX) / config.rhythm.travelBeats
      for (let i = 1; i <= config.rhythm.travelBeats; i++) {
        const markerX = targetX - (i * beatDist)
        if (markerX > 30) {
          trackGraphics.lineStyle(2, 0x475569, 0.35)
          trackGraphics.lineBetween(markerX, laneY - 35, markerX, laneY + 35)
        }
      }

      // 상단 게임 타이틀 및 스페이스바 조작 안내
      this.add.text(width / 2, 35, '🎵 냥냥 리듬 키친 (Nyan Rhythm) 🎵', {
        fontSize: '22px',
        color: '#f8fafc',
        fontStyle: 'bold'
      }).setOrigin(0.5)

      this.add.text(width / 2, 68, '고양이가 밥그릇에 닿을 때 [ SPACEBAR ] 를 누르세요! (R: 사료 채우기)', {
        fontSize: '13px',
        color: '#94a3b8'
      }).setOrigin(0.5)

      // 2. 오른쪽 끝 밥그릇 및 판정 구역 (Target Hit Zone)
      const bowlContainer = this.add.container(targetX, laneY)

      // 타겟 펄스 링 (비트마다 쿵쿵 뜀)
      const targetPulseRing = this.add.circle(0, 0, 48, 0x38bdf8, 0.15)
      targetPulseRing.setStrokeStyle(3, 0x38bdf8, 0.7)

      // 판정선 플래시 효과 원 (스페이스바 누를 때 번쩍임)
      const hitFlash = this.add.circle(0, 0, 52, 0xffffff, 0)

      // 밥그릇 스프라이트
      let currentBowlKey = getBowlTextureKey(config.bowl.currentAmount, config.bowl.maxCapacity)
      const bowlSprite = this.add.image(0, 0, currentBowlKey)
      bowlSprite.setDisplaySize(60, 60)
      bowlSprite.setInteractive({ useHandCursor: true })

      // 사료 잔량 텍스트
      const bowlText = this.add.text(0, -48, '', {
        fontSize: '13px',
        color: '#fef08a',
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        padding: { x: 7, y: 3 },
        fontStyle: 'bold'
      }).setOrigin(0.5)

      // 판정 지점 안내 화살표 / 인디케이터
      const targetLabel = this.add.text(0, 46, '▼ TARGET', {
        fontSize: '11px',
        color: '#38bdf8',
        fontStyle: 'bold'
      }).setOrigin(0.5)

      bowlContainer.add([targetPulseRing, hitFlash, bowlSprite, bowlText, targetLabel])

      // 밥 잔량 및 텍스처 주기적 갱신
      this.time.addEvent({
        delay: 50,
        loop: true,
        callback: () => {
          bowlText.setText(`🌾 ${config.bowl.currentAmount} / ${config.bowl.maxCapacity}`)
          const newKey = getBowlTextureKey(config.bowl.currentAmount, config.bowl.maxCapacity)
          if (currentBowlKey !== newKey) {
            currentBowlKey = newKey
            bowlSprite.setTexture(newKey)
          }
        }
      })

      // 사료 충전 함수 (R키 또는 클릭)
      function refillBowl() {
        initAudio()
        const current = config.bowl.currentAmount
        const max = config.bowl.maxCapacity
        const add = config.bowl.refillAmount
        const nextAmount = Math.min(max, current + add)
        setConfig('bowl', 'currentAmount', nextAmount)

        if (config.rhythm.soundEnabled) {
          playRefillSound()
        }

        // 충전 팝업
        const popup = scene.add.text(targetX, laneY - 60, `+${add} 🌾 충전!`, {
          fontSize: '18px',
          color: '#4ade80',
          fontStyle: 'bold'
        }).setOrigin(0.5)

        scene.tweens.add({
          targets: popup,
          y: laneY - 95,
          alpha: 0,
          duration: 700,
          onComplete: () => popup.destroy()
        })

        // 밥그릇 바운스
        scene.tweens.add({
          targets: bowlContainer,
          scaleX: 1.2,
          scaleY: 1.2,
          duration: 120,
          yoyo: true
        })
      }

      refillBowlFunc = refillBowl
      bowlSprite.on('pointerdown', refillBowl)

      // 판정 피드백 텍스트 및 이펙트 표시 함수
      function showJudgmentPopup(text, color, points) {
        // 판정 글자
        const popup = scene.add.text(targetX, laneY - 75, text, {
          fontSize: '24px',
          color: color,
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 4
        }).setOrigin(0.5)

        scene.tweens.add({
          targets: popup,
          y: laneY - 110,
          scaleX: 1.3,
          scaleY: 1.3,
          alpha: 0,
          duration: 650,
          ease: 'Power2',
          onComplete: () => popup.destroy()
        })

        // 타겟 플래시 효과
        hitFlash.setFillStyle(color === '#ef4444' ? 0xef4444 : 0x38bdf8, 0.45)
        hitFlash.setAlpha(1)
        scene.tweens.add({
          targets: hitFlash,
          alpha: 0,
          duration: 180
        })

        // 밥그릇 튕김
        scene.tweens.add({
          targets: bowlContainer,
          scaleX: 1.15,
          scaleY: 1.15,
          duration: 90,
          yoyo: true
        })
      }

      // 점수 및 콤보 갱신
      function recordHit(judgment, isSpecial = false) {
        const currentCombo = config.stats.combo + 1
        const maxCombo = Math.max(config.stats.maxCombo, currentCombo)

        let addScore = 50
        let color = '#38bdf8'

        if (judgment === 'PERFECT') {
          addScore = 100
          color = '#fbbf24'
          setConfig('stats', 'perfect', config.stats.perfect + 1)
        } else if (judgment === 'GREAT') {
          addScore = 70
          color = '#34d399'
          setConfig('stats', 'great', config.stats.great + 1)
        } else {
          addScore = 40
          color = '#60a5fa'
          setConfig('stats', 'good', config.stats.good + 1)
        }

        if (isSpecial) {
          addScore *= 2
        }

        setConfig('stats', {
          score: config.stats.score + addScore + (currentCombo * 5),
          combo: currentCombo,
          maxCombo: maxCombo
        })

        showJudgmentPopup(`${judgment}! +${addScore}`, color, addScore)
      }

      // MISS 처리
      function recordMiss() {
        setConfig('stats', {
          combo: 0,
          miss: config.stats.miss + 1
        })
        showJudgmentPopup('MISS... 😿', '#ef4444', 0)
        if (config.rhythm.soundEnabled) {
          playMissSound()
        }
      }

      // 고양이 생성 함수
      function spawnCat(forceSpecial = false) {
        const isSpecial = forceSpecial || (Math.random() < config.cat.specialChance)
        const spriteKey = isSpecial ? 'catLeader' : 'catNormal'
        const walkAnimKey = isSpecial ? 'cat-leader-walk' : 'cat-walk'
        const idleAnimKey = isSpecial ? 'cat-leader-idle' : 'cat-idle'
        const displaySize = isSpecial ? Math.round(config.cat.size * 1.25) : config.cat.size

        const beatMs = (60000 / config.rhythm.bpm)
        const travelDuration = beatMs * config.rhythm.travelBeats
        const expectedHitTime = scene.time.now + travelDuration

        // 고양이 스프라이트 (좌우반전: setFlipX(true))
        const catSprite = scene.add.sprite(0, 0, spriteKey, 0)
        catSprite.setDisplaySize(displaySize, displaySize)
        catSprite.play(walkAnimKey)
        catSprite.setFlipX(true)

        // 특수개체일 경우 반짝이는 오라 표시
        const catContainerItems = [catSprite]
        if (isSpecial) {
          const aura = scene.add.circle(0, 0, displaySize / 2 + 6, 0xf59e0b, 0.25)
          catContainerItems.unshift(aura)
          
          const starBadge = scene.add.text(0, -(displaySize / 2 + 10), '★ LEAD', {
            fontSize: '11px',
            color: '#fbbf24',
            fontStyle: 'bold'
          }).setOrigin(0.5)
          catContainerItems.push(starBadge)
        }

        const catContainer = scene.add.container(spawnX, laneY, catContainerItems)

        const catObj = {
          isSpecial,
          state: 'MOVING', // 'MOVING' | 'EATING' | 'MISSED' | 'DONE'
          catContainer,
          catSprite,
          displaySize,
          idleAnimKey,
          walkAnimKey,
          expectedHitTime,
          travelDuration,
          spawnTime: scene.time.now
        }

        activeCats.push(catObj)

        // 타겟(밥그릇) 위치로 등속 이동 tween
        catObj.moveTween = scene.tweens.add({
          targets: catContainer,
          x: targetX,
          duration: travelDuration,
          ease: 'Linear',
          onComplete: () => {
            // 타겟에 도달 후 스페이스바를 안 누르면 계속 지나쳐서 화면 오른쪽 밖으로 이동
            if (catObj.state === 'MOVING') {
              catObj.overrunTween = scene.tweens.add({
                targets: catContainer,
                x: width + 80,
                duration: beatMs * 1.5,
                ease: 'Linear',
                onComplete: () => {
                  destroyCat(catObj)
                }
              })
            }
          }
        })

        return catObj
      }

      spawnCatFunc = spawnCat

      // 고양이 제거 헬퍼
      function destroyCat(catObj) {
        catObj.state = 'DONE'
        const idx = activeCats.indexOf(catObj)
        if (idx > -1) {
          activeCats.splice(idx, 1)
        }
        if (catObj.moveTween) catObj.moveTween.stop()
        if (catObj.overrunTween) catObj.overrunTween.stop()
        catObj.catContainer.destroy()
      }

      // 스페이스바 판정 처리 (플레이어가 박자에 맞춰 스페이스를 눌렀을 때)
      function handleHit() {
        initAudio()

        const now = scene.time.now
        // 현재 이동 중인 고양이 중 타겟 시간(expectedHitTime)과 가장 가까운 고양이 찾기
        let closestCat = null
        let minDiff = Infinity

        for (const cat of activeCats) {
          if (cat.state === 'MOVING') {
            const diff = Math.abs(cat.expectedHitTime - now)
            if (diff < minDiff) {
              minDiff = diff
              closestCat = cat
            }
          }
        }

        // 판정 유효 범위 밖이면 무시
        if (!closestCat || minDiff > config.rhythm.goodWindow + 90) {
          return
        }

        // 판정 등급 판별
        let judgment = 'GOOD'
        if (minDiff <= config.rhythm.perfectWindow) {
          judgment = 'PERFECT'
        } else if (minDiff <= config.rhythm.greatWindow) {
          judgment = 'GREAT'
        } else if (minDiff <= config.rhythm.goodWindow) {
          judgment = 'GOOD'
        } else {
          // 너무 빠르거나 늦은 경우 MISS
          closestCat.state = 'MISSED'
          recordMiss()
          return
        }

        // 판정 성공 처리!
        closestCat.state = 'EATING'
        if (closestCat.moveTween) closestCat.moveTween.stop()
        if (closestCat.overrunTween) closestCat.overrunTween.stop()

        // 밥그릇 위치로 정확히 정렬
        closestCat.catContainer.x = targetX - (closestCat.displaySize / 2 + 10)
        closestCat.catSprite.play(closestCat.idleAnimKey)

        // 사료 차감 검사
        const needed = closestCat.isSpecial ? config.cat.specialFoodConsume : config.cat.normalFoodConsume
        const currentFood = config.bowl.currentAmount

        if (currentFood > 0) {
          const consume = Math.min(currentFood, needed)
          setConfig('bowl', 'currentAmount', currentFood - consume)

          // 밥 먹는 이펙트 텍스트
          const eatLabel = closestCat.isSpecial ? `특수개체 냠냠! 🐾 (-${consume})` : `냠냠! 🐾 (-${consume})`
          const eatPopup = scene.add.text(targetX, laneY - 45, eatLabel, {
            fontSize: '16px',
            color: '#facc15',
            fontStyle: 'bold'
          }).setOrigin(0.5)

          scene.tweens.add({
            targets: eatPopup,
            y: laneY - 75,
            alpha: 0,
            duration: 600,
            onComplete: () => eatPopup.destroy()
          })

          // 사운드 재생
          if (config.rhythm.soundEnabled) {
            playHitSound(judgment)
            playMeowSound(closestCat.isSpecial)
          }

          recordHit(judgment, closestCat.isSpecial)

          // 고양이가 밥 먹고 행복하게 통통 튀어 퇴장
          scene.tweens.add({
            targets: closestCat.catContainer,
            scaleX: 1.25,
            scaleY: 1.25,
            duration: 150,
            yoyo: true,
            repeat: 1,
            onComplete: () => {
              // 위로 살짝 점프하며 사라짐
              scene.tweens.add({
                targets: closestCat.catContainer,
                y: laneY - 60,
                alpha: 0,
                scaleX: 0.6,
                scaleY: 0.6,
                duration: 350,
                ease: 'Back.in',
                onComplete: () => {
                  destroyCat(closestCat)
                }
              })
            }
          })
        } else {
          // 사료가 없을 때
          const noFoodText = scene.add.text(targetX, laneY - 45, '사료가 부족해요! [R]', {
            fontSize: '15px',
            color: '#ef4444',
            fontStyle: 'bold'
          }).setOrigin(0.5)

          scene.tweens.add({
            targets: noFoodText,
            y: laneY - 75,
            alpha: 0,
            duration: 700,
            onComplete: () => noFoodText.destroy()
          })

          if (config.rhythm.soundEnabled) {
            playMissSound()
          }

          // 슬프게 돌아서서 퇴장 (퇴장 시에는 원래 방향으로)
          closestCat.catSprite.setFlipX(false)
          closestCat.catSprite.play(closestCat.walkAnimKey)
          scene.tweens.add({
            targets: closestCat.catContainer,
            x: width + 80,
            duration: 800,
            onComplete: () => destroyCat(closestCat)
          })
        }
      }

      // 키보드 입력 등록 (스페이스바 및 R키)
      this.input.keyboard.on('keydown-SPACE', (e) => {
        e.preventDefault()
        handleHit()
      })
      this.input.keyboard.on('keydown-R', () => {
        refillBowl()
      })

      // 캔버스 클릭 시에도 스페이스바 타격 지원 (모바일 및 마우스 편의성)
      this.input.on('pointerdown', (pointer) => {
        // 밥그릇 직접 클릭이 아닌 경우에만 판정
        const distToBowl = Phaser.Math.Distance.Between(pointer.x, pointer.y, targetX, laneY)
        if (distToBowl > 35) {
          handleHit()
        }
      })

      // 리듬 비트 타이머 (BPM에 맞춰 메트로놈 펄스 & 주기적 고양이 스폰)
      let beatCounter = 0
      let lastBeatTime = 0

      this.beatTimer = this.time.addEvent({
        delay: 50, // 50ms마다 비트 시간 경과 체크
        loop: true,
        callback: () => {
          const beatDuration = (60000 / config.rhythm.bpm)
          const now = scene.time.now

          if (now - lastBeatTime >= beatDuration) {
            lastBeatTime = now
            beatCounter++

            // 비트 펄스 애니메이션 (타겟 링 쿵쿵)
            scene.tweens.add({
              targets: targetPulseRing,
              scaleX: 1.25,
              scaleY: 1.25,
              alpha: 0.9,
              duration: 90,
              yoyo: true,
              ease: 'Quad.out'
            })

            // 메트로놈 비트 사운드
            if (config.rhythm.soundEnabled && config.rhythm.metronomeSound) {
              playBeatSound(beatCounter % 4 === 1)
            }

            // 스폰 주기 체크 (설정된 박자마다 고양이 스폰 시도)
            if (beatCounter % config.rhythm.spawnIntervalBeats === 0) {
              if (Math.random() <= config.rhythm.spawnChance) {
                spawnCat(false)
              }
            }
          }
        }
      })
    }

    // 매 프레임 업데이트: 타이밍을 놓쳐 지나친 고양이 MISS 자동 검사
    function updateScene() {
      const now = this.time.now
      const missThreshold = config.rhythm.goodWindow + 40

      for (let i = activeCats.length - 1; i >= 0; i--) {
        const cat = activeCats[i]
        if (cat.state === 'MOVING') {
          // 판정 시간을 지나쳤을 때 자동으로 MISS 처리
          if (now - cat.expectedHitTime > missThreshold) {
            cat.state = 'MISSED'
            
            // 콤보 리셋 및 미스 카운트
            setConfig('stats', {
              combo: 0,
              miss: config.stats.miss + 1
            })

            if (config.rhythm.soundEnabled) {
              playMissSound()
            }

            // MISS 텍스트 팝업
            const missText = this.add.text(cat.catContainer.x, 260 - 45, 'MISS... 😿', {
              fontSize: '16px',
              color: '#ef4444',
              fontStyle: 'bold'
            }).setOrigin(0.5)

            this.tweens.add({
              targets: missText,
              y: 260 - 75,
              alpha: 0,
              duration: 600,
              onComplete: () => missText.destroy()
            })
          }
        }
      }
    }

    onCleanup(() => {
      game.destroy(true)
    })
  })

  // 수동 고양이 생성
  const handleForceSpawn = (isSpecial = false) => {
    if (spawnCatFunc) {
      spawnCatFunc(isSpecial)
    }
  }

  // 밥 충전
  const handleAddFood = () => {
    if (refillBowlFunc) {
      refillBowlFunc()
    } else {
      const nextAmount = Math.min(config.bowl.maxCapacity, config.bowl.currentAmount + config.bowl.refillAmount)
      setConfig('bowl', 'currentAmount', nextAmount)
    }
  }

  // 점수 초기화
  const handleResetStats = () => {
    setConfig('stats', {
      score: 0,
      combo: 0,
      maxCombo: 0,
      perfect: 0,
      great: 0,
      good: 0,
      miss: 0
    })
  }

  // 설정 초기화
  const handleResetConfig = () => {
    setConfig('rhythm', {
      bpm: 100,
      travelBeats: 16,
      spawnIntervalBeats: 2,
      spawnChance: 0.75,
      soundEnabled: true,
      metronomeSound: true,
      perfectWindow: 65,
      greatWindow: 130,
      goodWindow: 200
    })
    setConfig('bowl', 'currentAmount', config.bowl.maxCapacity)
    handleResetStats()
  }


  return (
    <div class="game-wrapper">
      {/* Phaser 게임 캔버스 */}
      <div ref={gameContainer} class="phaser-container"></div>

      {/* 리듬 게임 제어 & 통계 패널 */}
      <div class="console-panel">
        <div class="console-header">
          <h2>🎵 리듬 게임 콘솔</h2>
          <p>박자에 맞춰 스페이스바로 밥을 주세요!</p>
        </div>

        {/* 실시간 점수 & 콤보 대시보드 */}
        <div class="score-board">
          <div class="score-card">
            <span class="score-title">SCORE</span>
            <span class="score-value">{config.stats.score.toLocaleString()}</span>
          </div>
          <div class="score-card">
            <span class="score-title">COMBO</span>
            <span class={`combo-value ${config.stats.combo > 5 ? 'combo-fire' : ''}`}>
              {config.stats.combo} <span class="max-combo-hint">(MAX: {config.stats.maxCombo})</span>
            </span>
          </div>
        </div>

        {/* 판정 통계 */}
        <div class="judgment-stats">
          <div class="stat-pill perfect-pill">
            <span>PERFECT</span>
            <b>{config.stats.perfect}</b>
          </div>
          <div class="stat-pill great-pill">
            <span>GREAT</span>
            <b>{config.stats.great}</b>
          </div>
          <div class="stat-pill good-pill">
            <span>GOOD</span>
            <b>{config.stats.good}</b>
          </div>
          <div class="stat-pill miss-pill">
            <span>MISS</span>
            <b>{config.stats.miss}</b>
          </div>
        </div>

        <div class="console-controls">
          {/* 사료 잔량 게이지 */}
          <div class="control-group food-status-group">
            <div class="control-label">
              <span>🌾 밥그릇 사료 잔량</span>
              <span class="value-badge food-badge">{config.bowl.currentAmount} / {config.bowl.maxCapacity}</span>
            </div>
            <div class="food-progress-bar">
              <div
                class="food-progress-fill"
                style={{ width: `${(config.bowl.currentAmount / config.bowl.maxCapacity) * 100}%` }}
              ></div>
            </div>
            <button class="btn btn-food" onClick={handleAddFood}>
              🥣 밥그릇 채우기 (+{config.bowl.refillAmount}) [R 키]
            </button>
          </div>

          {/* 템포 (BPM) 조절 */}
          <div class="control-group">
            <div class="control-label">
              <span>⚡ 템포 (BPM)</span>
              <span class="value-badge">{config.rhythm.bpm} BPM</span>
            </div>
            <input
              type="range"
              min="70"
              max="160"
              step="5"
              value={config.rhythm.bpm}
              onInput={(e) => setConfig('rhythm', 'bpm', Number(e.target.value))}
            />
          </div>

          {/* 스폰 간격 (박자 단위) */}
          <div class="control-group">
            <div class="control-label">
              <span>🥁 고양이 스폰 간격</span>
              <span class="value-badge">{config.rhythm.spawnIntervalBeats} 박자마다</span>
            </div>
            <input
              type="range"
              min="1"
              max="4"
              step="1"
              value={config.rhythm.spawnIntervalBeats}
              onInput={(e) => setConfig('rhythm', 'spawnIntervalBeats', Number(e.target.value))}
            />
          </div>

          {/* 스폰 확률 */}
          <div class="control-group">
            <div class="control-label">
              <span>🎲 비트당 스폰 확률</span>
              <span class="value-badge">{Math.round(config.rhythm.spawnChance * 100)} %</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="1.0"
              step="0.05"
              value={config.rhythm.spawnChance}
              onInput={(e) => setConfig('rhythm', 'spawnChance', Number(e.target.value))}
            />
          </div>

          {/* 특수개체 등장 확률 */}
          <div class="control-group">
            <div class="control-label">
              <span>⭐ 특수개체(리더) 확률</span>
              <span class="value-badge">{Math.round(config.cat.specialChance * 100)} %</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="0.5"
              step="0.05"
              value={config.cat.specialChance}
              onInput={(e) => setConfig('cat', 'specialChance', Number(e.target.value))}
            />
          </div>

          {/* 사운드 옵션 토글 */}
          <div class="toggle-group">
            <label class="toggle-label">
              <input
                type="checkbox"
                checked={config.rhythm.soundEnabled}
                onChange={(e) => setConfig('rhythm', 'soundEnabled', e.target.checked)}
              />
              <span>🔊 효과음 (타격/야옹)</span>
            </label>
            <label class="toggle-label">
              <input
                type="checkbox"
                checked={config.rhythm.metronomeSound}
                onChange={(e) => setConfig('rhythm', 'metronomeSound', e.target.checked)}
              />
              <span>⏱️ 메트로놈 비트음</span>
            </label>
          </div>

          {/* 제어 버튼 영역 */}
          <div class="button-group">
            <button class="btn btn-primary" onClick={() => handleForceSpawn(false)}>
              🐱 고양이 스폰
            </button>
            <button class="btn btn-special" onClick={() => handleForceSpawn(true)}>
              ⭐ 특수 스폰
            </button>
            <button class="btn btn-secondary" onClick={handleResetConfig}>
              🔄 리셋
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App


