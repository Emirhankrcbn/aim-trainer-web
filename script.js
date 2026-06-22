const SUPABASE_URL = "https://ixhqhbdkaflrxhndimqm.supabase.co"; 
const SUPABASE_ANON_KEY = "sb_publishable_KWkMVvVrMgMHWYwWaOl_uQ_K_jFlppJ";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const hitSound = new Audio('vurus.mp3');
const headshotSound = new Audio('headshot.mp3');
const missSound = new Audio('iska.mp3');
const winSound = new Audio('kazandin.mp3');
const failSound = new Audio('kaybettin.mp3');
const countdownSound = new Audio('sayim.mp3'); 

let score = 0;
let timeLeft = 30;
let timerInterval;
let countInterval;

let clicks = 0;
let hits = 0;
let currentCombo = 0;
let maxCombo = 0;
let isGameRunning = false;

let targetTimeout;
let animationFrame;

const gameBoard = document.getElementById('game-board');
const scoreDisplay = document.getElementById('score');
const timeDisplay = document.getElementById('time');
const accuracyDisplay = document.getElementById('accuracy');
const comboDisplay = document.getElementById('combo');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');
const exitBtn = document.getElementById('exit-btn');
const usernameInput = document.getElementById('username');
const crosshairSelect = document.getElementById('crosshair-select');
const volumeSlider = document.getElementById('volume-slider');
const scoreList = document.getElementById('score-list');

function updateVolumes() {
    let v = parseFloat(volumeSlider.value);
    hitSound.volume = 0.5 * v;
    headshotSound.volume = 0.7 * v;
    missSound.volume = 0.2 * v;
    winSound.volume = 0.8 * v;
    failSound.volume = 0.8 * v;
    countdownSound.volume = 0.6 * v;
}

function stopMusic() {
    winSound.pause(); winSound.currentTime = 0;
    failSound.pause(); failSound.currentTime = 0;
    countdownSound.pause(); countdownSound.currentTime = 0;
}

document.addEventListener('DOMContentLoaded', () => {
    getLeaderboard();
    
    gameBoard.className = `crosshair-${crosshairSelect.value}`;
    crosshairSelect.addEventListener('change', (e) => {
        gameBoard.className = `crosshair-${e.target.value}`;
    });

    volumeSlider.addEventListener('input', updateVolumes);
    updateVolumes(); 

    startBtn.addEventListener('click', startCountdown);
    restartBtn.addEventListener('click', restartGame); 
    exitBtn.addEventListener('click', exitGame);
    
    gameBoard.addEventListener('mousedown', (e) => {
        if (!isGameRunning) return; 
        
        clicks++;
        currentCombo = 0; 
        score -= 1; // Iska (boşa tıklama) cezası
        updateStats();
        
        missSound.currentTime = 0; 
        missSound.play().catch(e => console.log(e));
        
        showFloatingText(e.clientX, e.clientY, "-1 Iska!", false, true);
    });
});

function restartGame() {
    stopMusic(); 
    clearInterval(timerInterval);
    clearInterval(countInterval);
    clearTimeout(targetTimeout);
    cancelAnimationFrame(animationFrame);
    
    isGameRunning = false;
    gameBoard.innerHTML = ''; 
    
    startCountdown(); 
}

function exitGame() {
    stopMusic(); 
    clearInterval(timerInterval);
    clearInterval(countInterval);
    clearTimeout(targetTimeout);
    cancelAnimationFrame(animationFrame);
    
    isGameRunning = false;
    gameBoard.innerHTML = ''; 
    
    startBtn.style.display = 'block';
    restartBtn.style.display = 'none';
    exitBtn.style.display = 'none';
    
    usernameInput.disabled = false;
    crosshairSelect.disabled = false;
    
    score = 0;
    clicks = 0;
    hits = 0;
    currentCombo = 0;
    maxCombo = 0;
    timeLeft = 30;
    
    updateStats();
    timeDisplay.innerText = timeLeft;
}

function startCountdown() {
    if (usernameInput.value.trim() === "") {
        alert("Lütfen önce Discord adını yaz!");
        return;
    }

    stopMusic(); 

    startBtn.style.display = 'none'; 
    restartBtn.style.display = 'block'; 
    exitBtn.style.display = 'block';
    
    usernameInput.disabled = true;
    crosshairSelect.disabled = true; 
    gameBoard.innerHTML = '<div id="countdown-overlay" class="countdown-anim">3</div>';
    
    countdownSound.currentTime = 0;
    countdownSound.play().catch(e => console.log("Ses oynatılamadı:", e));

    let overlay = document.getElementById('countdown-overlay');
    let count = 3;

    countInterval = setInterval(() => {
        count--;
        
        if (overlay) {
            overlay.classList.remove('countdown-anim');
            void overlay.offsetWidth; 
            overlay.classList.add('countdown-anim');
        }

        if (count > 0) {
            if(overlay) overlay.innerText = count;
        } else if (count === 0) {
            if(overlay) {
                overlay.innerText = "BAŞLA!";
                overlay.style.color = "#38bdf8"; 
            }
        } else {
            clearInterval(countInterval);
            if(overlay) overlay.remove(); 
            startRealGame();  
        }
    }, 1000);
}

function startRealGame() {
    isGameRunning = true;
    score = 0;
    timeLeft = 30;
    clicks = 0;
    hits = 0;
    currentCombo = 0;
    maxCombo = 0;
    
    updateStats();
    timeDisplay.innerText = timeLeft;

    createTarget();

    timerInterval = setInterval(() => {
        timeLeft--;
        timeDisplay.innerText = timeLeft;

        if (timeLeft <= 0) {
            endGame();
        }
    }, 1000);
}

function updateStats() {
    scoreDisplay.innerText = score;
    comboDisplay.innerText = currentCombo + 'x';
    
    if(currentCombo >= 5) {
        comboDisplay.classList.add('active-combo');
    } else {
        comboDisplay.classList.remove('active-combo');
    }

    let accuracy = clicks === 0 ? 100 : Math.round((hits / clicks) * 100);
    accuracyDisplay.innerText = '%' + accuracy;
}

function createTarget() {
    gameBoard.innerHTML = '';
    clearTimeout(targetTimeout);
    cancelAnimationFrame(animationFrame);

    const target = document.createElement('div');
    target.classList.add('target');

    let x = Math.floor(Math.random() * (gameBoard.clientWidth - 40));
    let y = Math.floor(Math.random() * (gameBoard.clientHeight - 40));

    const targetType = Math.floor(Math.random() * 4);
    
    let isErratic = Math.random() < 0.25; 
    if (isErratic) {
        target.classList.add('erratic'); 
    }
    
    let dx = 0;
    let dy = 0;
    let timeToLive = 4000; 
    let humanTimer = 0; // A-D Strafe sayacı eklendi

    if (targetType === 1 || targetType === 3 || isErratic) {
        dx = (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.7); 
        dy = (Math.random() > 0.5 ? 1 : -1) * (0.5 + Math.random() * 0.7);
        timeToLive = 3500; 
    }

    if (targetType === 2 || targetType === 3) {
        target.classList.add('shrinking');
        timeToLive = targetType === 2 ? 2800 : 3200; 
    }

    target.style.left = `${x}px`;
    target.style.top = `${y}px`;

    target.addEventListener('mousedown', (e) => {
        e.stopPropagation(); 
        clearTimeout(targetTimeout);
        cancelAnimationFrame(animationFrame);

        clicks++;
        hits++;
        currentCombo++;
        if(currentCombo > maxCombo) maxCombo = currentCombo; 

        const rect = target.getBoundingClientRect();
        const targetCenterX = rect.left + rect.width / 2;
        const targetCenterY = rect.top + rect.height / 2;
        const dist = Math.hypot(e.clientX - targetCenterX, e.clientY - targetCenterY);

        let pointsEarned = 2; // Normal vuruş
        let isHeadshot = false;

        if (dist <= 12) { 
            pointsEarned = 3; // Headshot
            isHeadshot = true;
            headshotSound.currentTime = 0;
            headshotSound.play().catch(e => console.log(e));
        } else {
            hitSound.currentTime = 0;
            hitSound.play().catch(e => console.log(e));
        }

        // 10 Seride puanı 2'ye katla
        if (currentCombo >= 10) {
            pointsEarned *= 2; 
        }

        score += pointsEarned;
        updateStats();

        if (currentCombo === 10) {
            showFloatingText(e.clientX, e.clientY - 30, "2X AKTİF!", false, false, true);
        }

        let scoreText = isHeadshot ? `+${pointsEarned} HS!` : `+${pointsEarned}`;
        showFloatingText(e.clientX, e.clientY, scoreText, isHeadshot);

        createTarget();
    });

    gameBoard.appendChild(target);

    if (dx !== 0 || dy !== 0 || isErratic) {
        function moveTarget() {
            // CS2 A-D Strafing (Counter-Strafe) Fiziği
            if (isErratic) {
                humanTimer--;
                
                if (humanTimer <= 0) {
                    let action = Math.random();
                    
                    if (action < 0.25) {
                        // %25 İhtimalle DURUR (Ateş etme anı)
                        dx = 0;
                        dy = 0;
                        humanTimer = 15 + Math.floor(Math.random() * 15); 
                    } else {
                        // %75 İhtimalle A veya D tuşuna basar
                        let dirX = Math.random() > 0.5 ? 1 : -1; 
                        let dirY = (Math.random() - 0.5) * 0.3; 
                        
                        // YENİ: Hız tamamen tek yönde giden normal hedeflerle eşitlendi (0.5 - 1.2 arası)
                        let runSpeed = 0.5 + Math.random() * 0.7; 
                        
                        dx = dirX * runSpeed;
                        dy = dirY * runSpeed;
                        
                        humanTimer = 25 + Math.floor(Math.random() * 35); 
                    }
                }
            }

            x += dx;
            y += dy;

            if (x <= 0) { x = 0; dx *= -1; }
            if (x >= gameBoard.clientWidth - 40) { x = gameBoard.clientWidth - 40; dx *= -1; }
            if (y <= 0) { y = 0; dy *= -1; }
            if (y >= gameBoard.clientHeight - 40) { y = gameBoard.clientHeight - 40; dy *= -1; }

            target.style.left = `${x}px`;
            target.style.top = `${y}px`;

            animationFrame = requestAnimationFrame(moveTarget);
        }
        moveTarget(); 
    }

    targetTimeout = setTimeout(() => {
        currentCombo = 0; 
        updateStats();
        createTarget(); 
    }, timeToLive);
}

function showFloatingText(x, y, text, isHeadshot = false, isMiss = false, isComboAlert = false) {
    const floatObj = document.createElement('div');
    floatObj.innerText = text;
    floatObj.classList.add('floating-text');
    
    if (isHeadshot) floatObj.classList.add('headshot-text');
    if (isMiss) floatObj.classList.add('miss-text');
    if (isComboAlert) {
        floatObj.classList.add('headshot-text');
        floatObj.style.fontSize = "32px";
    }

    floatObj.style.left = `${x - 20}px`;
    floatObj.style.top = `${y - 20}px`;

    document.body.appendChild(floatObj);

    setTimeout(() => {
        floatObj.remove();
    }, 600);
}

async function endGame() {
    isGameRunning = false;
    clearInterval(timerInterval);
    clearTimeout(targetTimeout);
    cancelAnimationFrame(animationFrame);
    gameBoard.innerHTML = '';
    
    startBtn.style.display = 'block'; 
    restartBtn.style.display = 'none'; 
    exitBtn.style.display = 'none';
    usernameInput.disabled = false;
    crosshairSelect.disabled = false; 
    
    let finalAccuracy = clicks === 0 ? 0 : Math.round((hits / clicks) * 100);
    
    const { data: existingData } = await supabaseClient
        .from('leaderboard')
        .select('score')
        .eq('username', usernameInput.value);

    let scoreToSave = score; 

    if (existingData && existingData.length > 0) {
        const highestOldScore = Math.max(...existingData.map(row => row.score));
        if (highestOldScore > score) {
            scoreToSave = highestOldScore;
        }
        await supabaseClient.from('leaderboard').delete().eq('username', usernameInput.value);
    }

    const { error } = await supabaseClient.from('leaderboard').insert([{ username: usernameInput.value, score: scoreToSave }]);
    
    if (!error) await getLeaderboard();

    const { data: top3Data } = await supabaseClient.from('leaderboard').select('score').order('score', { ascending: false }).limit(3);

    let resultMsg = `Süre bitti!\n\nSkorun: ${score}\nİsabet Oranın: %${finalAccuracy}\nEn Yüksek Seri: ${maxCombo}x\n\n`;

    if (top3Data && top3Data.length >= 3 && score < top3Data[2].score) {
        failSound.currentTime = 0;
        failSound.play().catch(e => console.log("Ses engellendi:", e));
        setTimeout(() => alert(resultMsg + "Maalesef ilk 3'e giremedin! Daha hızlı olmalısın 🥲"), 500);
    } else {
        winSound.currentTime = 0;
        winSound.play().catch(e => console.log("Ses engellendi:", e));
        setTimeout(() => alert(resultMsg + "TEBRİKLER! İlk 3'tesin! 🏆"), 500);
    }
}

async function getLeaderboard() {
    const { data, error } = await supabaseClient.from('leaderboard').select('username, score').order('score', { ascending: false }).limit(50); 
    if (error) return;

    scoreList.innerHTML = ''; 
    if (data.length === 0) {
        scoreList.innerHTML = '<li class="score-item loading">Henüz skor yok!</li>';
        return;
    }

    data.forEach((row, index) => {
        const li = document.createElement('li');
        li.classList.add('score-item');
        li.innerHTML = `
            <div class="rank-name"><span class="rank-number">${index + 1}.</span><span class="player-username">${escapeHtml(row.username)}</span></div>
            <span class="score-value">${row.score}</span>
        `;
        scoreList.appendChild(li);
    });
}

function escapeHtml(text) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}