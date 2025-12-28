// ==================================================================
// 類別定義 (Class Definitions)
// ==================================================================

/**
 * 角色類別，用於管理所有角色（包括主角和NPC）
 */
class Character {
  constructor(config) {
    this.x = config.x;
    this.y = config.y;
    this.scale = config.scale || 1.0;
    this.direction = 1; // 1: 右, -1: 左
    this.visible = config.visible !== undefined ? config.visible : true;
    this.speed = config.speed || 5;

    this.state = 'idle'; // 'idle', 'walking', 'jumping', 'pushing'
    this.animations = {}; // 存放所有動畫幀
    this.animationCounters = {
      walk: 0, // 新增走路動畫計數器
      jump: 0,
      push: 0,
    };
    this.animationSpeed = 4;
  }

  // 添加動畫
  addAnimation(name, sheet, frameCount, frameWidth, frameHeight) {
    this.animations[name] = [];
    for (let i = 0; i < frameCount; i++) {
      let frame = sheet.get(i * frameWidth, 0, frameWidth, frameHeight);
      this.animations[name].push(frame);
    }
  }

  // 繪製角色
  display() {
    if (!this.visible) return;

    let currentAnimation;
    let frameImage;

    push();
    translate(this.x, this.y);
    scale(this.direction, 1);

    // 根據狀態選擇動畫
    switch (this.state) {
      case 'walking':
        currentAnimation = this.animations.walk; // 使用走路動畫
        this.animationCounters.walk = (this.animationCounters.walk + 1) % currentAnimation.length; // 更新走路動畫幀
        frameImage = currentAnimation[floor(frameCount / this.animationSpeed) % currentAnimation.length];
        image(frameImage, 0, 0, frameImage.width * this.scale, frameImage.height * this.scale);
        break;
      
      case 'jumping':
        // 跳躍的Y軸位移和動畫邏輯
        const jumpHeight = 200;
        // 使用 min() 確保計數器不會超過動畫陣列的最大索引
        const currentJumpFrame = min(this.animationCounters.jump, this.animations.jump.length - 1);
        const jumpProgress = currentJumpFrame / (this.animations.jump.length - 1);
        const yOffset = sin(jumpProgress * PI) * jumpHeight;
        
        frameImage = this.animations.jump[currentJumpFrame];
        // 在 translate 內部再次 translate 來實現位移
        translate(0, -yOffset);
        image(frameImage, 0, 0, frameImage.width * this.scale, frameImage.height * this.scale);

        // 在跳躍到最高點附近時，檢查是否碰到禮物
        const apexFrame = floor(this.animations.jump.length / 2);
        if (this.animationCounters.jump === apexFrame) {
            for (const gift of gifts) {
                if (gift.checkCollision(this)) {
                    gift.collect();
                }
            }
        }

        if (frameCount % this.animationSpeed === 0) {
          this.animationCounters.jump++;
        }

        // 動畫播放完畢後才切換狀態
        if (this.animationCounters.jump >= this.animations.jump.length) {
          this.state = 'idle';
          this.animationCounters.jump = 0; // 關鍵修正：重置計數器
        }
        break;

      case 'pushing':
        // 使用 min() 確保計數器不會超過動畫陣列的最大索引
        const currentPushFrame = min(this.animationCounters.push, this.animations.push.length - 1);
        frameImage = this.animations.push[currentPushFrame];
        image(frameImage, 0, 0, frameImage.width * this.scale, frameImage.height * this.scale);
        
        // 在攻擊動畫的特定幀發射武器
        if (this.animationCounters.push === 7 && !projectile.active) { // 確保只發射一次
            projectile.active = true;
            projectile.x = this.x + (50 * this.direction); // 在角色前方產生
            projectile.y = this.y;
            projectile.direction = this.direction;
        }

        if (frameCount % this.animationSpeed === 0) {
          this.animationCounters.push++;
        }
        // 攻擊動畫結束後回到待機
        if (this.animationCounters.push >= this.animations.push.length) {
          this.state = 'idle';
          this.animationCounters.push = 0;
        }
        break;

      case 'idle':
      default:
        currentAnimation = this.animations.idle;
        frameImage = currentAnimation[floor(frameCount / this.animationSpeed) % currentAnimation.length]; // 待機動畫
        image(frameImage, 0, 0, frameImage.width * this.scale, frameImage.height * this.scale);
        break;
    }
    pop();
  }
  
  // 取得角色的碰撞邊界
  getBounds() {
      const anim = this.animations[this.state] || this.animations.idle;
      if (!anim || anim.length === 0) return { x: this.x, y: this.y, w: 0, h: 0 };
      const w = anim[0].width * this.scale;
      const h = anim[0].height * this.scale;
      return {
          x: this.x - w / 2,
          y: this.y - h / 2,
          w: w,
          h: h,
      };
  }
}

/**
 * 禮物類別
 */
class Gift {
    constructor(x, y, image, associatedNPC) {
        this.x = x;
        this.y = y;
        this.image = image;
        this.w = image.width;
        this.h = image.height;
        this.visible = true;
        this.associatedNPC = associatedNPC; // 關聯的NPC物件
    }

    display() {
        if (!this.visible) return;
        image(this.image, this.x, this.y, this.w, this.h);
    }

    // 檢查與玩家的碰撞
    checkCollision(player) {
        if (!this.visible) return false;
        
        // 簡化後的碰撞檢測：只檢查玩家是否在禮物下方的一定水平範圍內
        const playerX = player.x;
        // 為了讓觸發更容易，我們把判斷範圍稍微加寬
        const isHorizontallyAligned = abs(playerX - this.x) < (this.w * 1.5); 

        // 由於玩家總是在禮物下方，我們只需要檢查水平對齊即可
        return isHorizontallyAligned;

    }

    // 收集禮物的動作
    collect() {
        // 當切換角色時，如果原本有問題產生，先自動隱藏
        if (quizManager && quizManager.active) {
            quizManager.end();
        }

        // 1. 隱藏當前禮物，並顯示其關聯的NPC
        this.visible = false;
        this.associatedNPC.visible = true; // 讓關聯的NPC顯示出來

        // 2. 遍歷所有NPC，處理互斥邏輯
        for (const otherNpc of npcs) {
            // 如果這個NPC不是我們剛剛顯示的那一個
            if (otherNpc !== this.associatedNPC) {
                // 3. 隱藏其他的NPC
                otherNpc.visible = false;

                // 4. 找到並重新顯示與該NPC關聯的禮物(寶箱)
                for (const otherGift of gifts) {
                    if (otherGift.associatedNPC === otherNpc) {
                        otherGift.visible = true;
                        break; // 找到對應的禮物後就跳出內層迴圈
                    }
                }
            }
        }

        // 觸發寶箱後自動開始問答
        quizManager.start(this.associatedNPC);
    }
}

/**
 * 問答管理器類別
 */
class QuizManager {
    constructor(quizTable) {
        this.table = quizTable;
        this.resetQuestions(); // 初始化題目列表
        this.active = false;
        this.currentNPC = null;
        this.currentQuestion = null;
        this.feedbackMessage = '';
        this.isCorrect = false;
        this.state = 'asking'; // 'asking', 'feedback'

        // 創建答案輸入框
        this.answerInput = createInput('');
        this.answerInput.position(-1000, -1000); // 先移出畫面外
        this.answerInput.size(100, 20);
        this.answerInput.style('border', '2px solid #000');
        this.answerInput.style('padding', '5px');
        
        // 綁定 Enter 鍵事件
        this.answerInput.elt.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.checkAnswer();
            }
        });
    }

    // 重置題目列表
    resetQuestions() {
        this.availableQuestionIndices = [];
        for (let i = 0; i < this.table.getRowCount(); i++) {
            this.availableQuestionIndices.push(i);
        }
    }

    // 開始問答
    start(npc) {
        if (this.active) return; // 如果已經在問答中，則不重複觸發

        // 如果題目用完了，重新填充（防止崩潰，雖然邏輯上應該夠用）
        if (this.availableQuestionIndices.length === 0) {
            this.resetQuestions();
        }

        this.active = true;
        this.currentNPC = npc;
        this.state = 'asking';
        this.feedbackMessage = '';

        // 從可用題目中隨機抽取一題並移除，避免重複
        const randIndex = floor(random(this.availableQuestionIndices.length));
        const questionIndex = this.availableQuestionIndices[randIndex];
        this.availableQuestionIndices.splice(randIndex, 1);
        this.currentQuestion = this.table.getRow(questionIndex);

        // 顯示並定位輸入框
        this.answerInput.value(''); // 清空上次的答案
        this.answerInput.position(this.currentNPC.x - 50, this.currentNPC.y + 140);
        this.answerInput.show();
        this.answerInput.elt.focus(); // 讓玩家可以直接輸入
    }

    // 檢查答案
    checkAnswer() {
        const userAnswer = this.answerInput.value().trim();
        const correctAnswer = this.currentQuestion.getString('answer');

        if (userAnswer === correctAnswer) {
            this.feedbackMessage = this.currentQuestion.getString('correct_feedback');
            this.isCorrect = true;
            score += 5;
        } else {
            this.feedbackMessage = this.currentQuestion.getString('wrong_feedback');
            this.isCorrect = false;
            lives -= 1;
        }
        this.state = 'feedback';
        this.answerInput.hide(); // 顯示回饋時隱藏輸入框

        // 檢查是否結束遊戲
        if (score >= 20 || lives <= 0) {
            setTimeout(() => {
                this.end();
                gameState = 'END';
            }, 2000);
        } else {
            // 2秒後自動結束問答
            setTimeout(() => this.end(), 2000);
        }
    }

    // 結束問答
    end() {
        this.active = false;
        this.currentNPC = null;
        this.currentQuestion = null;
        this.feedbackMessage = '';
        this.answerInput.hide();
        this.answerInput.position(-1000, -1000); // 移出畫面
    }

    // 繪製UI
    display() {
        if (!this.active || !this.currentNPC) return;

        const npcX = this.currentNPC.x;
        const npcY = this.currentNPC.y;
        const boxWidth = 300;
        const boxHeight = 100;

        fill(255, 255, 255, 220);
        stroke(0);
        rectMode(CENTER);
        rect(npcX, npcY + 80, boxWidth, boxHeight, 10);

        fill(0);
        noStroke();
        textAlign(CENTER, CENTER);
        textSize(16);
        text(this.state === 'asking' ? this.currentQuestion.getString('question') : this.feedbackMessage, npcX, npcY + 80, boxWidth - 20, boxHeight - 20);
    }
}

// ==================================================================
// 主程式 (Main Sketch)
// ==================================================================

// 資源變數
let giftImage;
let bgImage;
let coverImage;
let bgWin, bgLose;
let quizTable;
let spriteSheets = {};

// 物件變數
let player;
let npcs = [];
let gifts = [];
let prompter; // 角色6
let keyCharacter; // 角色7 (鑰匙)
let projectile; // 角色5
let quizManager; // 問答管理器
let gameState = 'START';
let startButton;
let restartButton;
let score = 0;
let lives = 3;
let fireworks = [];
let rainDrops = [];

// 通用設定
const animationSpeed = 4;

function preload() {
  quizTable = loadTable('quiz.csv', 'csv', 'header');
  // 載入所有圖片資源
  bgImage = loadImage('picture.png');
  coverImage = loadImage('picture2.png');
  bgWin = loadImage('picture3.png');
  bgLose = loadImage('picture4.png');
  giftImage = loadImage('0.png');
  
  // 主角動畫
  spriteSheets.player_idle = loadImage('1主角/stop/all.png');
  spriteSheets.player_jump = loadImage('1主角/jump/all.png');
  spriteSheets.player_walk = loadImage('1主角/walk/all.png');
  spriteSheets.player_push = loadImage('1主角/push/all.png');
  spriteSheets.player_tool = loadImage('1主角/tool/all.png');

  // NPC 動畫
  spriteSheets.npc2_idle = loadImage('2提問者一號/stop/all.png');
  spriteSheets.npc3_idle = loadImage('3提問者二號/stop/all.png');
  spriteSheets.npc4_idle = loadImage('4提問者三號/stop/all.png');
  spriteSheets.prompter_idle = loadImage('5提示者/stop/all.png');
  spriteSheets.key_idle = loadImage('6key/all.png'); // 載入鑰匙圖片
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  imageMode(CENTER);

  // --- 創建主角 ---
  player = new Character({
    x: width / 2,
    y: height / 2 + height * 0.2,
    scale: 2.25,
    speed: 5,
  });
  player.addAnimation('idle', spriteSheets.player_idle, 24, 1363 / 24, 106);
  player.addAnimation('jump', spriteSheets.player_jump, 21, 2137 / 21, 97);
  player.addAnimation('walk', spriteSheets.player_walk, 12, 775 / 12, 105);
  player.addAnimation('push', spriteSheets.player_push, 17, 1729 / 17, 118);

  // --- 創建武器 (角色5) ---
  // 武器比較特殊，我們只創建一個物件，需要時再啟用
  projectile = {
      active: false,
      x: 0, y: 0,
      direction: 1,
      speed: 10,
      scale: 2.25,
      frames: [],
      sheet: spriteSheets.player_tool,
      totalFrames: 15,
      frameWidth: 2110 / 15,
      frameHeight: 102,
  };
  for (let i = 0; i < projectile.totalFrames; i++) {
      let frame = projectile.sheet.get(i * projectile.frameWidth, 0, projectile.frameWidth, projectile.frameHeight);
      projectile.frames.push(frame);
  }


  // --- 創建 NPCs (角色 2, 3, 4) ---
  const npcConfigs = [
    { x: width / 3, y: height / 3 - height * 0.05, scale: 1.35, sheet: spriteSheets.npc2_idle, totalFrames: 18, frameWidth: 1597 / 18, frameHeight: 191, direction: 1 },
    { x: width / 2, y: height / 3 - height * 0.05, scale: 1.35, sheet: spriteSheets.npc3_idle, totalFrames: 8, frameWidth: 1107 / 8, frameHeight: 196, direction: 1 },
    { x: width * 2 / 3, y: height / 3 - height * 0.05, scale: 2.7, sheet: spriteSheets.npc4_idle, totalFrames: 6, frameWidth: 355 / 6, frameHeight: 87, direction: -1 }, // 角色4預設面向左
  ];

  npcConfigs.forEach(config => {
    let npc = new Character({
      x: config.x,
      y: config.y,
      scale: config.scale,
      visible: false, // 預設不可見
    });
    npc.addAnimation('idle', config.sheet, config.totalFrames, config.frameWidth, config.frameHeight);
    npc.direction = config.direction;
    npcs.push(npc);
    
    // --- 為每個 NPC 創建對應的禮物 ---
    let gift = new Gift(config.x, config.y + height * 0.13, giftImage, npc);
    gifts.push(gift);
  });

  // --- 創建提示者 (角色6) ---
  prompter = new Character({
      x: width * 2 / 3,
      y: (height * 2 / 3) + (height * 0.15),
      scale: 2.5,
      visible: false, // 預設隱藏
  });
  prompter.addAnimation('idle', spriteSheets.prompter_idle, 6, 343 / 6, 43);

  // --- 創建鑰匙 (角色7) ---
  keyCharacter = new Character({
      x: width - 150, // 畫面右下角
      y: height - 100,
      scale: 2.5,
  });
  // 根據您提供的資訊：寬475，10張圖
  keyCharacter.addAnimation('idle', spriteSheets.key_idle, 10, 475 / 10, 40);

  // --- 創建問答管理器 ---
  quizManager = new QuizManager(quizTable);

  // --- 創建開始按鈕 ---
  startButton = createButton('開始作答');
  startButton.position(width / 2 - 75, height / 2);
  startButton.size(150, 60);
  startButton.style('font-size', '24px');
  startButton.style('font-weight', 'bold');
  startButton.mousePressed(() => {
    gameState = 'PLAY';
    score = 0;
    lives = 3;
    startButton.hide();
  });

  // --- 創建重新開始按鈕 ---
  restartButton = createButton('重新開始');
  restartButton.position(width / 2 - 75, height / 2 + 100);
  restartButton.size(150, 50);
  restartButton.style('font-size', '20px');
  restartButton.style('font-weight', 'bold');
  restartButton.hide();
  restartButton.mousePressed(resetGame);
}

function draw() {
  if (gameState === 'START') {
    background(0);
    image(coverImage, width / 2, height / 2, width, height);
    
    push();
    textAlign(CENTER, CENTER);
    textSize(60);
    fill(255);
    stroke(0);
    strokeWeight(5);
    text('淡江教育科技學系問答', width / 2, height / 3);

    textSize(24);
    strokeWeight(3);
    text('答對一題可得5分，滿分為20分，答錯扣一個生命值，共有三條生命值，生命值扣完或滿分即作答結束', width / 2, height / 2 + 100);
    pop();

    push();
    textAlign(LEFT, TOP);
    textSize(24);
    fill(255);
    stroke(0);
    strokeWeight(3);
    text('淡江大學教育科技學系', 20, 20);
    text('XXXXX0183 王o崴', 20, 50);
    pop();
    return;
  }

  if (gameState === 'END') {
    // 根據分數決定背景與特效
    if (score >= 20) {
        image(bgWin, width/2, height/2, width, height);
        
        // 煙火特效邏輯
        if (random(1) < 0.05) {
            fireworks.push(new Firework());
        }
        for (let i = fireworks.length - 1; i >= 0; i--) {
            fireworks[i].update();
            fireworks[i].show();
            if (fireworks[i].done()) {
                fireworks.splice(i, 1);
            }
        }

        fill(255);
        textAlign(CENTER, CENTER);
        textSize(50);
        text("恭喜獲得滿分！", width/2, height/2 - 50);
    } else {
        image(bgLose, width/2, height/2, width, height);
        
        // 下雨特效邏輯
        if (rainDrops.length === 0) {
             for (let i = 0; i < 500; i++) {
                rainDrops.push(new RainDrop());
             }
        }
        for (let drop of rainDrops) {
            drop.fall();
            drop.show();
        }

        fill(255);
        textAlign(CENTER, CENTER);
        textSize(50);
        text("遊戲結束", width/2, height/2 - 50);
    }
    textSize(30);
    text("最終得分: " + score, width/2, height/2 + 50);
    restartButton.show();
    return;
  }

  // 先清除畫面防止殘影，再繪製背景圖填滿視窗
  background(0);
  image(bgImage, width / 2, height / 2, width, height);
  
  handlePlayerInput();

  // --- 繪製圖層 ---
  // 順序: NPCs -> 禮物 -> 鑰匙 -> 提示者 -> 武器 -> 主角 -> 問答UI

  // 繪製 NPCs
  for (const npc of npcs) {
    npc.display();
  }

  // 繪製禮物
  for (const gift of gifts) {
    gift.display();
  }

  // 繪製鑰匙
  keyCharacter.display();

  // 繪製提示者
  prompter.display();

  // 如果提示者顯示中，顯示提示文字
  if (prompter.visible) {
      let hintText = "目前沒有題目喔";
      if (quizManager.active && quizManager.currentQuestion) {
          hintText = quizManager.currentQuestion.getString('hint');
      }

      push();
      fill(255, 255, 255, 220);
      stroke(0);
      rectMode(CENTER);
      rect(prompter.x, prompter.y - 100, 200, 80, 10);
      
      fill(0);
      noStroke();
      textAlign(CENTER, CENTER);
      textSize(16);
      text(hintText, prompter.x, prompter.y - 100, 180, 60);
      pop();
  }

  // 更新與繪製武器
  handleProjectile();
  
  // 繪製主角
  player.display();

  // 繪製問答UI (最上層)
  quizManager.display();

  // 繪製分數與生命值 UI
  push();
  fill(0, 150); // 半透明背景
  noStroke();
  rectMode(CORNER); // 確保矩形繪製模式正確
  rect(width - 230, 10, 220, 100, 10);
  fill(255);
  textAlign(RIGHT, TOP);
  textSize(24);
  text(`得分: ${score}`, width - 20, 25);
  text("生命值:", width - 110, 55);
  textAlign(LEFT, TOP);
  fill(255, 50, 50);
  for (let i = 0; i < lives; i++) {
      text("❤", width - 105 + (i * 30), 55);
  }
  fill(255);
  textAlign(RIGHT, TOP);
  textSize(16);
  text(`(一題五分，滿分20分)`, width - 20, 85);
  pop();
}

function handlePlayerInput() {
  // 只有在待機或走路時，才檢查走路輸入
  if (player.state === 'idle' || player.state === 'walking') {
    if (keyIsDown(RIGHT_ARROW)) {
      player.state = 'walking';
      player.direction = 1;
      player.x += player.speed;
    } else if (keyIsDown(LEFT_ARROW)) {
      player.state = 'walking';
      player.direction = -1;
      player.x -= player.speed;
    }
  }
}

function handleProjectile() {
    if (!projectile.active) return;

    projectile.x += projectile.speed * projectile.direction;

    const currentFrame = floor(frameCount / animationSpeed) % projectile.totalFrames;
    const frameImage = projectile.frames[currentFrame];
    push();
    translate(projectile.x, projectile.y);
    scale(projectile.direction, 1);
    image(frameImage, 0, 0, frameImage.width * projectile.scale, frameImage.height * projectile.scale);
    pop();

    if (projectile.x < 0 || projectile.x > width) {
        projectile.active = false;
    }
}

function keyPressed() {
  if (gameState !== 'PLAY') return;

  // 只有當玩家處於可以行動的狀態時，才處理按鍵
  if (player.state !== 'idle' && player.state !== 'walking') {
    return; // 如果正在跳躍或攻擊，則不處理新的按鍵事件
  }

  if (keyCode === UP_ARROW) {
    // 優先檢查是否要撿取禮物
    let collectedGift = false;
    for (const gift of gifts) {
      if (gift.checkCollision(player)) {
        gift.collect();
        collectedGift = true;
        break; // 找到一個就夠了，並觸發它
      }
    }

    // 如果沒有撿取任何禮物，才執行跳躍
    if (!collectedGift) {
      player.state = 'jumping';
      player.animationCounters.jump = 0;
    }
  } else if (keyCode === 32) { // 空白鍵觸發攻擊
      player.state = 'pushing';
      player.animationCounters.push = 0;
  }
}

function mousePressed() {
    if (gameState !== 'PLAY') return;

    // --- 鑰匙與提示者的切換邏輯 (優先處理，以便在問答中也能查看提示) ---

    // 1. 檢查是否點擊到 "鑰匙" (當它可見時)
    if (keyCharacter.visible) {
        const bounds = keyCharacter.getBounds();
        if (mouseX > bounds.x && mouseX < bounds.x + bounds.w &&
            mouseY > bounds.y && mouseY < bounds.y + bounds.h) {
            // 隱藏鑰匙，顯示提示者
            keyCharacter.visible = false;
            prompter.visible = true;
            return; // 處理完畢，結束函數
        }
    }

    // 2. 檢查是否點擊到 "提示者" (當它可見時)
    if (prompter.visible) {
        const bounds = prompter.getBounds();
        if (mouseX > bounds.x && mouseX < bounds.x + bounds.w &&
            mouseY > bounds.y && mouseY < bounds.y + bounds.h) {
            // 隱藏提示者，顯示鑰匙
            prompter.visible = false;
            keyCharacter.visible = true;
            return;
        }
    }

    // 如果正在問答中，則不觸發其他滑鼠事件
    if (quizManager.active) {
        return;
    }

    // 檢查是否點擊到NPC以觸發問答
    for (const npc of npcs) {
        if (npc.visible && mouseX > npc.getBounds().x && mouseX < npc.getBounds().x + npc.getBounds().w && mouseY > npc.getBounds().y && mouseY < npc.getBounds().y + npc.getBounds().h) {
            quizManager.start(npc);
            return; // 觸發問答後結束函數
        }
    }
}

function keyReleased() {
  // 當走路的按鍵放開時，如果角色還在走路狀態，就切換回待機
  if (
    (keyCode === LEFT_ARROW || keyCode === RIGHT_ARROW) &&
    player.state === 'walking'
  ) {
    player.state = 'idle';
  }
}

function resetGame() {
  gameState = 'START';
  score = 0;
  lives = 3;
  fireworks = [];
  rainDrops = [];
  
  // 重置角色位置與狀態
  player.x = width / 2;
  player.y = height / 2 + height * 0.2;
  player.state = 'idle';
  player.direction = 1;
  
  // 重置 NPC 與 禮物
  npcs.forEach(npc => npc.visible = false);
  gifts.forEach(gift => gift.visible = true);
  
  // 重置其他物件
  prompter.visible = false;
  keyCharacter.visible = true;
  projectile.active = false;
  
  // 重置問答管理器
  quizManager.end();
  quizManager.resetQuestions();
  
  restartButton.hide();
  startButton.show();
}

// ==================================================================
// 特效類別 (Effects Classes)
// ==================================================================

class Particle {
  constructor(x, y, hu, firework) {
    this.pos = createVector(x, y);
    this.firework = firework;
    this.lifespan = 255;
    this.hu = hu;
    this.acc = createVector(0, 0);
    if (this.firework) {
      this.vel = createVector(0, random(-12, -8));
    } else {
      this.vel = p5.Vector.random2D();
      this.vel.mult(random(2, 10));
    }
  }

  applyForce(force) {
    this.acc.add(force);
  }

  update() {
    if (!this.firework) {
      this.vel.mult(0.9);
      this.lifespan -= 4;
    }
    this.vel.add(this.acc);
    this.pos.add(this.vel);
    this.acc.mult(0);
  }

  done() {
    return this.lifespan < 0;
  }

  show() {
    push();
    colorMode(HSB);
    if (!this.firework) {
      strokeWeight(2);
      stroke(this.hu, 255, 255, this.lifespan);
    } else {
      strokeWeight(4);
      stroke(this.hu, 255, 255);
    }
    point(this.pos.x, this.pos.y);
    pop();
  }
}

class Firework {
  constructor() {
    this.hu = random(255);
    this.firework = new Particle(random(width), height, this.hu, true);
    this.exploded = false;
    this.particles = [];
  }

  done() {
    return this.exploded && this.particles.length === 0;
  }

  update() {
    if (!this.exploded) {
      this.firework.applyForce(createVector(0, 0.2));
      this.firework.update();
      if (this.firework.vel.y >= 0) {
        this.exploded = true;
        this.explode();
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      this.particles[i].applyForce(createVector(0, 0.2));
      this.particles[i].update();
      if (this.particles[i].done()) {
        this.particles.splice(i, 1);
      }
    }
  }

  explode() {
    for (let i = 0; i < 100; i++) {
      let p = new Particle(this.firework.pos.x, this.firework.pos.y, this.hu, false);
      this.particles.push(p);
    }
  }

  show() {
    if (!this.exploded) {
      this.firework.show();
    }
    for (let i = 0; i < this.particles.length; i++) {
      this.particles[i].show();
    }
  }
}

class RainDrop {
  constructor() {
    this.x = random(width);
    this.y = random(-500, -50);
    this.z = random(0, 20);
    this.len = map(this.z, 0, 20, 10, 20);
    this.yspeed = map(this.z, 0, 20, 1, 20);
  }

  fall() {
    this.y = this.y + this.yspeed;
    let grav = map(this.z, 0, 20, 0, 0.2);
    this.yspeed = this.yspeed + grav;

    if (this.y > height) {
      this.y = random(-200, -100);
      this.yspeed = map(this.z, 0, 20, 4, 10);
    }
  }

  show() {
    let thick = map(this.z, 0, 20, 1, 3);
    strokeWeight(thick);
    stroke(200, 200, 255);
    line(this.x, this.y, this.x, this.y + this.len);
  }
}
