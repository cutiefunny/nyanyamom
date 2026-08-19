import { onMount, onCleanup } from 'solid-js'
import Phaser from 'phaser'
import catNormalImg from './assets/units/normal.png'
import catLeaderImg from './assets/units/leader.png'
import { config, setConfig } from './gameConfig'
import './App.css'

function App() {
  let gameContainer
  let spawnCatFunc = null

  onMount(() => {
    const phaserConfig = {
      type: Phaser.AUTO,
      width: config.canvas.width,
      height: config.canvas.height,
      parent: gameContainer,
      backgroundColor: config.canvas.backgroundColor,
      scene: {
        preload: preloadScene,
        create: createScene
      }
    }

    const game = new Phaser.Game(phaserConfig)

    function preloadScene() {
      // 일반 고양이 500x100px (5 frames of 100x100px)
      this.load.spritesheet('catNormal', catNormalImg, {
        frameWidth: 100,
        frameHeight: 100
      })

      // 특수개체(리더 고양이) 600x100px (6 frames of 100x100px)
      this.load.spritesheet('catLeader', catLeaderImg, {
        frameWidth: 100,
        frameHeight: 100
      })
    }

    function createScene() {
      const scene = this
      const width = this.cameras.main.width
      const height = this.cameras.main.height
      const centerX = width / 2
      const centerY = height / 2

      // 일반 고양이 애니메이션 (Idle: 0번, Walk: 1~2번)
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
          frameRate: 6,
          repeat: -1
        })
      }

      // 특수개체 리더 고양이 애니메이션 (Idle: 0번, Walk: 1~2번)
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
          frameRate: 6,
          repeat: -1
        })
      }

      // 밥그릇 컨테이너 생성 (기본 위치: 화면 중앙)
      const bowlContainer = this.add.container(centerX, centerY)

      // 밥그릇 하이라이트 링 (드래그 이동 모드 표시)
      const highlightRing = this.add.circle(0, 0, config.bowl.outerRadius + 8, 0x60a5fa, 0.4)
      highlightRing.setVisible(false)

      // 밥그릇 바깥 테두리/그림자
      const outerBowl = this.add.circle(0, 0, config.bowl.outerRadius, 0x4a5568)

      // 밥그릇 본체 (클릭 & 드래그 인터랙티브)
      const mainBowl = this.add.circle(0, 0, config.bowl.mainRadius, 0xe2e8f0)
      mainBowl.setInteractive({ useHandCursor: true })

      // 밥그릇 안쪽
      const innerBowl = this.add.circle(0, 0, config.bowl.innerRadius, 0xcbd5e1)

      // 고양이 밥그릇 아이콘
      const bowlIcon = this.add.text(0, 0, '🥣', { fontSize: '32px' }).setOrigin(0.5)

      // 밥 잔량 표시 텍스트 UI
      const bowlAmountText = this.add.text(0, 58, '', {
        fontSize: '15px',
        color: '#ffffff',
        backgroundColor: 'rgba(31, 41, 55, 0.9)',
        padding: { x: 10, y: 5 },
        fontStyle: 'bold'
      }).setOrigin(0.5)

      bowlContainer.add([highlightRing, outerBowl, mainBowl, innerBowl, bowlIcon, bowlAmountText])

      // 밥 잔량 실시간 업데이트
      this.time.addEvent({
        delay: 50,
        loop: true,
        callback: () => {
          bowlAmountText.setText(`🌾 사료: ${config.bowl.currentAmount} / ${config.bowl.maxCapacity}`)
        }
      })

      // 밥 충전 함수 (+10)
      function refillBowl() {
        const current = config.bowl.currentAmount
        const max = config.bowl.maxCapacity
        const add = config.bowl.refillAmount
        const nextAmount = Math.min(max, current + add)
        
        setConfig('bowl', 'currentAmount', nextAmount)

        // 클릭 효과 팝업 텍스트 (+10 🌾)
        const popup = scene.add.text(bowlContainer.x, bowlContainer.y - 20, `+${add} 🌾`, {
          fontSize: '22px',
          color: '#4ade80',
          fontStyle: 'bold'
        }).setOrigin(0.5)

        scene.tweens.add({
          targets: popup,
          y: bowlContainer.y - 65,
          alpha: 0,
          duration: 700,
          onComplete: () => popup.destroy()
        })

        // 밥그릇 클릭 애니메이션
        scene.tweens.add({
          targets: bowlContainer,
          scaleX: 1.15,
          scaleY: 1.15,
          duration: 100,
          yoyo: true
        })
      }

      // 활성 고양이 리스트 & 밥그릇 드래그 상태 관리
      const activeCats = []
      let isBowlDragging = false

      // 밥그릇 1초 롱프레스 (Long-press) & 드래그 로직
      let holdTimer = null
      let isDragging = false
      let holdStartTime = 0

      mainBowl.on('pointerdown', () => {
        holdStartTime = Date.now()
        isDragging = false

        // 1초(1000ms) 이상 유지 시 드래그 이동 모드 활성화
        holdTimer = setTimeout(() => {
          isDragging = true
          isBowlDragging = true
          highlightRing.setVisible(true)

          // 접근 중이던 모든 고양이를 '헤매는(CONFUSED)' 상태로 전환
          activeCats.forEach((catObj) => {
            if (catObj.state === 'APPROACHING') {
              catObj.pauseAndConfuse()
            }
          })

          // 밥그릇 떠오르는 애니메이션
          scene.tweens.add({
            targets: bowlContainer,
            scaleX: 1.18,
            scaleY: 1.18,
            duration: 150,
            ease: 'Back.out'
          })
        }, 1000)
      })

      // 마우스 이동 시 밥그릇 위치 변경
      this.input.on('pointermove', (pointer) => {
        if (isDragging && pointer.isDown) {
          const clampedX = Phaser.Math.Clamp(pointer.x, 60, width - 60)
          const clampedY = Phaser.Math.Clamp(pointer.y, 80, height - 60)
          bowlContainer.setPosition(clampedX, clampedY)
        }
      })

      // 마우스 버튼 떼었을 때 처리 (밥그릇 위치 고정 및 고양이 다시 추적)
      const handlePointerUp = () => {
        if (holdTimer) {
          clearTimeout(holdTimer)
          holdTimer = null
        }

        if (isDragging) {
          isDragging = false
          isBowlDragging = false
          highlightRing.setVisible(false)

          // 드래그 완료 후 원복 및 해당 위치 고정
          scene.tweens.add({
            targets: bowlContainer,
            scaleX: 1.0,
            scaleY: 1.0,
            duration: 150
          })

          // 헤매고 있던 모든 고양이를 새로운 밥그릇 위치로 다시 이동 시작
          activeCats.forEach((catObj) => {
            if (catObj.state === 'CONFUSED') {
              catObj.resumeApproach(bowlContainer.x, bowlContainer.y)
            }
          })

          // 위치 고정 알림 팝업
          const lockText = scene.add.text(bowlContainer.x, bowlContainer.y - 45, '📍 위치 고정!', {
            fontSize: '16px',
            color: '#60a5fa',
            fontStyle: 'bold'
          }).setOrigin(0.5)

          scene.tweens.add({
            targets: lockText,
            y: bowlContainer.y - 75,
            alpha: 0,
            duration: 800,
            onComplete: () => lockText.destroy()
          })
        } else {
          // 1초 미만 단순 클릭 시 밥 10 충전
          const elapsed = Date.now() - holdStartTime
          if (elapsed < 1000) {
            refillBowl()
          }
        }
      }

      this.input.on('pointerup', handlePointerUp)
      this.input.on('pointerupoutside', handlePointerUp)

      // 안내 문구 (Title Text)
      this.add.text(centerX, 40, '🐾 고양이 밥 주기 게임 🐾', {
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5)

      // 고양이 생성 함수 (forceSpecial: true일 경우 특수개체 고정 생성)
      function spawnCat(forceSpecial = false) {
        const baseSize = config.cat.size

        // 특수개체 여부
        const isSpecial = forceSpecial
        const spriteKey = isSpecial ? 'catLeader' : 'catNormal'
        const idleAnimKey = isSpecial ? 'cat-leader-idle' : 'cat-idle'
        const walkAnimKey = isSpecial ? 'cat-leader-walk' : 'cat-walk'

        // 특수개체 크기 120% (1.2배) 설정
        const displayCatSize = isSpecial ? Math.round(baseSize * 1.2) : baseSize

        // 고양이 개체 정보 관리 객체
        const catObj = {
          isSpecial,
          state: 'APPROACHING', // 'APPROACHING' | 'CONFUSED' | 'EATING' | 'RETURNING'
          catContainer: null,
          catSprite: null,
          moveTween: null,
          confusedText: null,
          wobbleTween: null,
          speed: 100,
          startX: 0,
          startY: 0,
          pauseAndConfuse: null,
          resumeApproach: null
        }

        // 화면 바깥 4개 영역 중 랜덤 위치 선정
        let startX, startY
        const edge = Math.floor(Math.random() * 4)
        const margin = displayCatSize

        switch (edge) {
          case 0: // 위쪽 (Top)
            startX = Phaser.Math.Between(0, width)
            startY = -margin
            break
          case 1: // 오른쪽 (Right)
            startX = width + margin
            startY = Phaser.Math.Between(0, height)
            break
          case 2: // 아래쪽 (Bottom)
            startX = Phaser.Math.Between(0, width)
            startY = height + margin
            break
          case 3: // 왼쪽 (Left)
            startX = -margin
            startY = Phaser.Math.Between(0, height)
            break
        }

        catObj.startX = startX
        catObj.startY = startY

        // 목표 밥그릇 위치
        const targetX = bowlContainer.x
        const targetY = bowlContainer.y

        // 이동 속도(px/sec) 계산
        const initialDist = Phaser.Math.Distance.Between(startX, startY, targetX, targetY)
        const minDur = Math.min(config.cat.minMoveDuration, config.cat.maxMoveDuration)
        const maxDur = Math.max(config.cat.minMoveDuration, config.cat.maxMoveDuration)
        const initialDuration = Phaser.Math.Between(minDur, maxDur)
        catObj.speed = initialDist / (initialDuration / 1000)

        // 고양이 스프라이트 생성 (120% 크기 적용)
        const catSprite = scene.add.sprite(0, 0, spriteKey, 0)
        catSprite.setDisplaySize(displayCatSize, displayCatSize)
        catSprite.play(walkAnimKey)
        catSprite.setFlipX(startX < targetX)

        // 고양이 컨테이너 생성
        const catContainer = scene.add.container(startX, startY, [catSprite])
        catObj.catContainer = catContainer
        catObj.catSprite = catSprite

        activeCats.push(catObj)

        // 목표 위치로 이동 시작 함수
        function startMovementTo(tx, ty) {
          catSprite.play(walkAnimKey)
          catSprite.setFlipX(catContainer.x < tx)

          const dist = Phaser.Math.Distance.Between(catContainer.x, catContainer.y, tx, ty)
          const dur = Math.max(300, (dist / catObj.speed) * 1000)

          catObj.state = 'APPROACHING'
          catObj.moveTween = scene.tweens.add({
            targets: catContainer,
            x: tx,
            y: ty,
            duration: dur,
            ease: 'Linear',
            onComplete: () => handleArrivalAtBowl()
          })
        }

        // 헤매기 모드(CONFUSED) 전환 함수
        catObj.pauseAndConfuse = () => {
          if (catObj.moveTween) {
            catObj.moveTween.stop()
            catObj.moveTween = null
          }
          catObj.state = 'CONFUSED'
          catSprite.play(idleAnimKey)

          if (!catObj.confusedText) {
            catObj.confusedText = scene.add.text(0, -(displayCatSize / 2 + 15), '❓', {
              fontSize: '22px'
            }).setOrigin(0.5)
            catContainer.add(catObj.confusedText)
          }

          catObj.wobbleTween = scene.tweens.add({
            targets: catContainer,
            angle: { from: -10, to: 10 },
            duration: 180,
            yoyo: true,
            repeat: -1
          })
        }

        // 다시 이동 모드(APPROACHING) 재개 함수
        catObj.resumeApproach = (newTargetX, newTargetY) => {
          if (catObj.confusedText) {
            catObj.confusedText.destroy()
            catObj.confusedText = null
          }
          if (catObj.wobbleTween) {
            catObj.wobbleTween.stop()
            catObj.wobbleTween = null
          }
          catContainer.setAngle(0)

          startMovementTo(newTargetX, newTargetY)
        }

        // 스폰 시점에 밥그릇이 이동 중이라면 즉시 헤매기 모드로 시작
        if (isBowlDragging) {
          catObj.pauseAndConfuse()
        } else {
          startMovementTo(targetX, targetY)
        }

        // 밥그릇 도착 시 처리
        function handleArrivalAtBowl() {
          catSprite.play(idleAnimKey)
          catObj.state = 'EATING'

          const hasFood = config.bowl.currentAmount > 0

          if (hasFood) {
            // 소모량 계산 (일반: 1개, 특수개체: 5개)
            const targetConsume = isSpecial ? (config.cat.specialFoodConsume || 5) : 1
            const actualConsumed = Math.min(config.bowl.currentAmount, targetConsume)

            // 사료 차감
            setConfig('bowl', 'currentAmount', config.bowl.currentAmount - actualConsumed)

            // 밥 먹기 효과 텍스트
            const eatLabel = isSpecial ? `특수개체 냠냠! 🐾 (-${actualConsumed})` : `냠냠! 🐾 (-${actualConsumed})`
            const eatColor = isSpecial ? '#f59e0b' : '#ffeb3b'

            const eatingText = scene.add.text(catContainer.x, catContainer.y - (displayCatSize / 2 + 15), eatLabel, {
              fontSize: '18px',
              color: eatColor,
              fontStyle: 'bold'
            }).setOrigin(0.5)

            // 냠냠 먹는 시간
            scene.tweens.add({
              targets: catContainer,
              scaleX: isSpecial ? 1.25 : 1.15,
              scaleY: isSpecial ? 1.25 : 1.15,
              duration: config.cat.eating.pulseDuration,
              yoyo: true,
              repeat: config.cat.eating.pulseRepeat,
              onComplete: () => {
                eatingText.destroy()
                finishEatingAndLeave()
              }
            })
          } else {
            // 밥이 없을 때 😿
            const noFoodText = scene.add.text(catContainer.x, catContainer.y - (displayCatSize / 2 + 15), '밥이 없어요! 😿', {
              fontSize: '18px',
              color: '#ef4444',
              fontStyle: 'bold'
            }).setOrigin(0.5)

            // 시무룩한 반응 후 퇴장
            scene.tweens.add({
              targets: catContainer,
              scaleX: 0.9,
              scaleY: 0.9,
              duration: 400,
              yoyo: true,
              repeat: 1,
              onComplete: () => {
                noFoodText.destroy()
                finishEatingAndLeave()
              }
            })
          }
        }

        // 식사 후 왔던 길로 퇴장 함수
        function finishEatingAndLeave() {
          catObj.state = 'RETURNING'
          catSprite.play(walkAnimKey)
          catSprite.setFlipX(catContainer.x < startX)

          const dist = Phaser.Math.Distance.Between(catContainer.x, catContainer.y, startX, startY)
          const returnDur = Math.max(500, (dist / catObj.speed) * 1000)

          scene.tweens.add({
            targets: catContainer,
            x: startX,
            y: startY,
            duration: returnDur,
            ease: 'Linear',
            onComplete: () => {
              const index = activeCats.indexOf(catObj)
              if (index > -1) {
                activeCats.splice(index, 1)
              }
              catContainer.destroy()
            }
          })
        }
      }

      spawnCatFunc = spawnCat

      // 실시간 시계 & 스폰 검사 루프 (100ms 누적)
      let timeAccumulator = 0
      let lastSpecialSpawnKey = ''

      this.time.addEvent({
        delay: 100,
        loop: true,
        callback: () => {
          const now = new Date()
          const currentSecond = now.getSeconds()
          const currentMinute = now.getMinutes()
          const spawnKey = `${currentMinute}:${currentSecond}`

          // 현재 시간의 초 단위가 01초가 되면 특수개체 고정 스폰 (매 분 01초당 1회)
          if (currentSecond === 1 && lastSpecialSpawnKey !== spawnKey) {
            lastSpecialSpawnKey = spawnKey
            spawnCat(true) // forceSpecial: true
          }

          // 일반 고양이 생성 주기 검사
          timeAccumulator += 100
          if (timeAccumulator >= config.cat.spawnInterval) {
            timeAccumulator = 0
            if (Math.random() <= config.cat.spawnChance) {
              spawnCat(false) // 일반 고양이
            }
          }
        }
      })
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

  // 밥 10 추가
  const handleAddFood = () => {
    const nextAmount = Math.min(config.bowl.maxCapacity, config.bowl.currentAmount + config.bowl.refillAmount)
    setConfig('bowl', 'currentAmount', nextAmount)
  }

  // 설정 초기화
  const handleResetConfig = () => {
    setConfig('cat', {
      spawnInterval: 1000,
      spawnChance: 0.1,
      minMoveDuration: 3000,
      maxMoveDuration: 6000,
      eating: {
        pulseDuration: 250,
        pulseRepeat: 3
      },
      size: 64
    })
    setConfig('bowl', 'currentAmount', config.bowl.maxCapacity)
  }

  return (
    <div class="game-wrapper">
      {/* Phaser 게임 캔버스 */}
      <div ref={gameContainer} class="phaser-container"></div>

      {/* 실시간 게임 설정 제어 콘솔 */}
      <div class="console-panel">
        <div class="console-header">
          <h2>⚙️ 설정 콘솔</h2>
          <p>게임 파라미터를 실시간으로 조절하세요</p>
        </div>

        <div class="console-controls">
          {/* 사료 잔량 게이지 표시 */}
          <div class="control-group food-status-group">
            <div class="control-label">
              <span>🌾 사료 잔량</span>
              <span class="value-badge food-badge">{config.bowl.currentAmount} / {config.bowl.maxCapacity}</span>
            </div>
            <div class="food-progress-bar">
              <div
                class="food-progress-fill"
                style={{ width: `${(config.bowl.currentAmount / config.bowl.maxCapacity) * 100}%` }}
              ></div>
            </div>
            <button class="btn btn-food" onClick={handleAddFood}>
              🥣 밥그릇 채우기 (+10)
            </button>
          </div>

          {/* 스폰 검사 주기 */}
          <div class="control-group">
            <div class="control-label">
              <span>⏱️ 스폰 주기</span>
              <span class="value-badge">{config.cat.spawnInterval} ms</span>
            </div>
            <input
              type="range"
              min="200"
              max="5000"
              step="100"
              value={config.cat.spawnInterval}
              onInput={(e) => setConfig('cat', 'spawnInterval', Number(e.target.value))}
            />
          </div>

          {/* 스폰 확률 */}
          <div class="control-group">
            <div class="control-label">
              <span>🎲 스폰 확률</span>
              <span class="value-badge">{Math.round(config.cat.spawnChance * 100)} %</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="1.0"
              step="0.05"
              value={config.cat.spawnChance}
              onInput={(e) => setConfig('cat', 'spawnChance', Number(e.target.value))}
            />
          </div>

          {/* 특수개체 스폰 조건 안내 */}
          <div class="control-group">
            <div class="control-label">
              <span>⭐ 특수개체 스폰 시각</span>
              <span class="value-badge special-time-badge">매 분 01초 고정</span>
            </div>
          </div>

          {/* 특수개체 사료 소모량 */}
          <div class="control-group">
            <div class="control-label">
              <span>⭐ 특수개체 사료 소모량</span>
              <span class="value-badge">{config.cat.specialFoodConsume} 개</span>
            </div>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={config.cat.specialFoodConsume}
              onInput={(e) => setConfig('cat', 'specialFoodConsume', Number(e.target.value))}
            />
          </div>

          {/* 최소 이동 시간 */}
          <div class="control-group">
            <div class="control-label">
              <span>🚀 최소 이동 시간</span>
              <span class="value-badge">{config.cat.minMoveDuration} ms</span>
            </div>
            <input
              type="range"
              min="1000"
              max="10000"
              step="500"
              value={config.cat.minMoveDuration}
              onInput={(e) => setConfig('cat', 'minMoveDuration', Number(e.target.value))}
            />
          </div>

          {/* 최대 이동 시간 */}
          <div class="control-group">
            <div class="control-label">
              <span>🐢 최대 이동 시간</span>
              <span class="value-badge">{config.cat.maxMoveDuration} ms</span>
            </div>
            <input
              type="range"
              min="1000"
              max="10000"
              step="500"
              value={config.cat.maxMoveDuration}
              onInput={(e) => setConfig('cat', 'maxMoveDuration', Number(e.target.value))}
            />
          </div>

          {/* 밥 먹는 횟수 */}
          <div class="control-group">
            <div class="control-label">
              <span>🍽️ 밥 먹는 시간 (펄스)</span>
              <span class="value-badge">{config.cat.eating.pulseRepeat} 회</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={config.cat.eating.pulseRepeat}
              onInput={(e) => setConfig('cat', 'eating', 'pulseRepeat', Number(e.target.value))}
            />
          </div>

          {/* 고양이 크기 */}
          <div class="control-group">
            <div class="control-label">
              <span>📐 일반 고양이 크기</span>
              <span class="value-badge">{config.cat.size} px</span>
            </div>
            <input
              type="range"
              min="32"
              max="128"
              step="4"
              value={config.cat.size}
              onInput={(e) => setConfig('cat', 'size', Number(e.target.value))}
            />
          </div>

          {/* 제어 버튼 영역 */}
          <div class="button-group">
            <button class="btn btn-primary" onClick={() => handleForceSpawn(false)}>
              🐱 일반 스폰
            </button>
            <button class="btn btn-special" onClick={() => handleForceSpawn(true)}>
              ⭐ 특수 스폰
            </button>
            <button class="btn btn-secondary" onClick={handleResetConfig}>
              🔄 초기화
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App


