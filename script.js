// ==========================================================================
// 📌 1. URL 파싱 및 [무서버 데이터 엔진] 탑재 (새로고침/링크 공유 방어)
// ==========================================================================
let urlParams = new URLSearchParams(window.location.search);
let roomCode = urlParams.get('room');

// 전역 변수 초기화 상태 선언
let roomData = [];
let myToken = localStorage.getItem('relay_user_token');
if (!myToken) {
    myToken = 'usr_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('relay_user_token', myToken);
}

let currentSelectedSender = ""; 
let selectedLetterIdForMenu = null;

// 다중 이미지 업로드 관리용 대기열 배열
let attachedImagesArray = []; 

// 글로벌 이미지 조작 및 슬라이더 인덱스 관리자
let activeImagesList = [];
let currentSliderIdx = 0;
let imgScale = 1;
let imgPanX = 0;
let imgPanY = 0;
let isDraggingImg = false;
let startDragX = 0;
let startDragY = 0;

// 모달 컴포넌트 바인딩
const menuLayer = document.getElementById('custom-menu');
const editModal = document.getElementById('edit-modal');
const deleteModal = document.getElementById('delete-modal');
const renameModal = document.getElementById('rename-modal');
const viewModal = document.getElementById('view-modal');
const modalTextArea = document.getElementById('modal-edit-text');

function showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 2500);
}

// 🌟 [핵심] 데이터를 로드할 때 URL 파라미터를 최우선으로 검증합니다.
function initRoom() {
    const encodedData = urlParams.get('data'); // 주소창에서 ?data= 값 추출

    if (encodedData) {
        // 1단계: 누군가로부터 공유받았거나 데이터가 구워진 링크로 들어온 경우
        try {
            // URL 안전 문자열을 디코딩하고 UTF-8 글자 깨짐을 방지하며 복원
            const decodedString = decodeURIComponent(atob(encodedData));
            const parsed = JSON.parse(decodedString);
            
            // 데이터 구조 분기 처리 (설정 설정 및 편지 리스트 추출)
            if (parsed.config && parsed.letters) {
                roomCode = parsed.roomCode || roomCode || "shared_room";
                roomData = parsed.letters;
                // 백업 보존용 local 보관함 동기화
                localStorage.setItem(`relay_config_${roomCode}`, JSON.stringify(parsed.config));
                localStorage.setItem(`relay_db_${roomCode}`, JSON.stringify(roomData));
            } else {
                // 구버전 배열 형태 예외 처리 방어
                roomData = Array.isArray(parsed) ? parsed : [];
            }
            
            document.getElementById('current-url-display').innerText = window.location.href;
            completeInitProcess();
            return; // 로컬 검증 과정을 생략하고 즉시 화면을 띄웁니다.
        } catch (e) {
            console.error("데이터 URL 복원 실패:", e);
            showToast("⚠️ 편지 데이터를 읽어오는 중 오류가 발생했습니다.");
        }
    }

    // 2단계: 주소창에 데이터가 없다면 일반적인 방 코드 생성 분기로 진입
    if (!roomCode) {
        createNewRoom();
    } else {
        document.getElementById('current-url-display').innerText = window.location.href;
        roomData = getRoomData();
        completeInitProcess();
    }
}

function createNewRoom() {
    const newCode = 'room_' + Math.random().toString(36).substring(2, 9);
    window.location.href = `?room=${newCode}`;
}

function getRoomData() {
    let data = localStorage.getItem(`relay_db_${roomCode}`);
    return data ? JSON.parse(data) : [];
}

// 🌟 데이터 저장 시 용량 초과 에러가 발생하면 사용자에게 경고하도록 보완
function saveRoomData(data) {
    try {
        roomData = data;
        localStorage.setItem(`relay_db_${roomCode}`, JSON.stringify(data));
        renderTimeline();
    } catch (error) {
        console.error("Storage error:", error);
        showToast("⚠️ 이미지 용량이 너무 커서 저장에 실패했습니다! 다른 사진을 이용해 주세요.");
    }
}

function getCharacterConfig() {
    let config = localStorage.getItem(`relay_config_${roomCode}`);
    return config ? JSON.parse(config) : null;
}

// 🌟 방 초기화 프로세스의 최종 마무리 단계 분리
function completeInitProcess() {
    const savedTheme = localStorage.getItem('relay_theme') || 'dark';
    document.body.className = `theme-${savedTheme}`;
    updateThemeButtonIcon(savedTheme);

    const config = getCharacterConfig();
    if (!config) {
        document.getElementById('setup-modal').style.display = 'flex';
    } else {
        updateSenderSelect(config);
        renderTimeline();
    }
    
    bindSenderSelectContextMenu();
    
    document.addEventListener('click', () => {
        const dropdown = document.getElementById('sender-select-container');
        if(dropdown) dropdown.classList.remove('open');
    });

    document.addEventListener('mouseup', () => { isDraggingImg = false; });
}

// 최초 로딩 타이밍 바인딩 엔진 교체
window.addEventListener('DOMContentLoaded', () => {
    initRoom();
});


// ==========================================================================
// 📌 2. 테마 설정 및 캐릭터 셋업 시스템
// ==========================================================================
function toggleTheme() {
    const currentTheme = document.body.classList.contains('theme-dark') ? 'dark' : 'light';
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.body.className = `theme-${nextTheme}`;
    localStorage.setItem('relay_theme', nextTheme);
    updateThemeButtonIcon(nextTheme);
}

function updateThemeButtonIcon(theme) {
    const btn = document.getElementById('theme-toggle-btn');
    if(btn) btn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
}

function submitCharacterSetup() {
    const char1 = document.getElementById('setup-char-1').value.trim();
    const char2 = document.getElementById('setup-char-2').value.trim();

    if (!char1 || !char2) return showToast("두 캐릭터의 이름을 모두 지정해 주세요.");
    if (char1 === char2) return showToast("서로 다른 이름을 부여해 주세요.");

    const config = { char1, char2 };
    localStorage.setItem(`relay_config_${roomCode}`, JSON.stringify(config));
    
    document.getElementById('setup-modal').style.display = 'none';
    updateSenderSelect(config);
    
    saveRoomData([
        {
            id: "init_system",
            writer: "system",
            sender: "시스템 안내",
            content: `🎭 두 캐릭터 [ ${char1} ] 와 [ ${char2} ] 의 교환편지가 배정되었습니다.\n\n선택창을 우클릭하면 등록한 두 캐릭터의 이름을 언제든 바꿀 수 있습니다.\n\n해당 웹사이트는 트위터(현 X) 카이싱(@eyemark10051)님의 \n7일 프로젝트(https://posty.pe/aflskd)를 기반으로 하여 만들어졌습니다.\n문제가 생길 경우 내려갈 수 있습니다.`,
            imgs: []
        }
    ]);
}

function toggleDropdown(event) {
    event.stopPropagation();
    document.getElementById('sender-select-container').classList.toggle('open');
}

function updateSenderSelect(config) {
    const menu = document.getElementById('custom-dropdown-menu');
    const label = document.getElementById('selected-sender-label');
    if(!menu) return;

    if (!currentSelectedSender || (currentSelectedSender !== config.char1 && currentSelectedSender !== config.char2)) {
        currentSelectedSender = config.char1;
    }
    label.innerText = `${currentSelectedSender} (으)로 보내기`;

    menu.innerHTML = `
        <div class="dropdown-item ${currentSelectedSender === config.char1 ? 'selected' : ''}" onclick="selectSender('${config.char1}')">
            <span>${config.char1} (으)로 보내기</span>
        </div>
        <div class="dropdown-item ${currentSelectedSender === config.char2 ? 'selected' : ''}" onclick="selectSender('${config.char2}')">
            <span>${config.char2} (으)로 보내기</span>
        </div>
    `;
}

function selectSender(name) {
    currentSelectedSender = name;
    const config = getCharacterConfig();
    if(config) updateSenderSelect(config);
    document.getElementById('sender-select-container').classList.remove('open');
}

function bindSenderSelectContextMenu() {
    const target = document.getElementById('sender-select-container');
    if(!target) return;
    target.addEventListener('contextmenu', (e) => { e.preventDefault(); openRenameModal(); });
}

function openRenameModal() {
    const config = getCharacterConfig();
    if (!config) return;
    document.getElementById('rename-char-1').value = config.char1;
    document.getElementById('rename-char-2').value = config.char2;
    renameModal.style.display = 'flex';
}

function closeRenameModal() { renameModal.style.display = 'none'; }

function submitRename() {
    const newChar1 = document.getElementById('rename-char-1').value.trim();
    const newChar2 = document.getElementById('rename-char-2').value.trim();
    const oldConfig = getCharacterConfig();

    if (!newChar1 || !newChar2) return showToast("빈 이름으로 설정할 수 없습니다.");
    const newConfig = { char1: newChar1, char2: newChar2 };
    localStorage.setItem(`relay_config_${roomCode}`, JSON.stringify(newConfig));

    let currentData = getRoomData().map(letter => {
        if(letter.writer !== "system") {
            if (letter.sender === oldConfig.char1) letter.sender = newChar1;
            else if (letter.sender === oldConfig.char2) letter.sender = newChar2;
        }
        return letter;
    });

    saveRoomData(currentData);
    updateSenderSelect(newConfig);
    closeRenameModal();
}


// ==========================================================================
// 📌 3. 이미지 압축 및 대기열 관리 기지
// ==========================================================================
function handleMultipleImageUpload(input) {
    const files = Array.from(input.files);
    if (files.length === 0) return;

    let loadedCount = 0;

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const img = new Image();
            img.src = e.target.result;
            
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1024;
                const MAX_HEIGHT = 1024;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                } else {
                    if (height > MAX_HEIGHT) {
                        width *= MAX_HEIGHT / height;
                        height = MAX_HEIGHT;
                    }
                }

                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // 화질을 0.7 정도로 압축하여 주소창 용량 폭발 사전 차단!
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

                attachedImagesArray.push({
                    name: file.name.replace(/\.[^/.]+$/, "") + ".jpg", 
                    base64: compressedBase64
                });

                loadedCount++;
                if (loadedCount === files.length) {
                    renderImagePreviewChips();
                    input.value = ""; 
                }
            };
        };
        reader.readAsDataURL(file);
    });
}

function renderImagePreviewChips() {
    const container = document.getElementById('preview-gallery-container');
    if(!container) return;
    container.innerHTML = "";

    attachedImagesArray.forEach((imgObj, idx) => {
        const chip = document.createElement('div');
        chip.className = 'img-manage-chip effect-ink';
        chip.innerHTML = `
            <button onclick="movePreviewOrder(${idx}, -1)" title="앞으로 이동"><i class="fas fa-arrow-left"></i></button>
            <span>${idx + 1}. ${imgObj.name}</span>
            <button onclick="movePreviewOrder(${idx}, 1)" title="뒤로 이동"><i class="fas fa-arrow-right"></i></button>
            <i class="fas fa-times-circle del-btn" onclick="removePreviewImage(${idx})" title="삭제"></i>
        `;
        container.appendChild(chip);
    });
}

function movePreviewOrder(idx, direction) {
    const targetIdx = idx + direction;
    if (targetIdx < 0 || targetIdx >= attachedImagesArray.length) return;
    
    const temp = attachedImagesArray[idx];
    attachedImagesArray[idx] = attachedImagesArray[targetIdx];
    attachedImagesArray[targetIdx] = temp;
    
    renderImagePreviewChips();
}

function removePreviewImage(idx) {
    attachedImagesArray.splice(idx, 1);
    renderImagePreviewChips();
}


// ==========================================================================
// 📌 4. 타임라인 렌더링 및 편지 전송 시스템
// ==========================================================================
function renderTimeline() {
    const timeline = document.getElementById('letter-timeline');
    if(!timeline) return;
    timeline.innerHTML = "";
    const letters = roomData; // 원본 구조 보존 동기화

    let currentDay = 1;
    let dayProgress = []; 
    let totalValidLetters = 0; 

    letters.forEach((letter) => {
        if (letter.writer !== "system") {
            totalValidLetters++;
            if (dayProgress.includes(letter.sender)) {
                currentDay += 1;
                dayProgress = []; 
            }
            dayProgress.push(letter.sender);
            letter.calculatedDay = currentDay;
        }

        const card = document.createElement('div');
        card.className = `letter-card effect-ink ${letter.writer !== "system" ? 'sealed' : ''}`;
        card.dataset.id = letter.id;

        const isMine = letter.writer === myToken;
        
        let imgHtml = "";
        if (letter.imgs && letter.imgs.length > 0) {
            let badgeHtml = letter.imgs.length > 1 ? `<div class="letter-img-count-badge">+${letter.imgs.length}장</div>` : "";
            imgHtml = `<div class="letter-img-box"><img src="${letter.imgs[0]}" alt="uploaded">${badgeHtml}</div>`;
        } else if (letter.img) { 
            imgHtml = `<div class="letter-img-box"><img src="${letter.img}" alt="uploaded"></div>`;
        }
        
        let dayHeaderHtml = letter.writer !== "system" 
            ? `<span class="day-badge">${letter.calculatedDay}일차</span><span class="sender-name"> ${letter.sender}의 편지</span>`
            : `<span class="day-badge" style="background:#555;">안내</span><span class="sender-name" style="color:#777;">${letter.sender}</span>`;

        let sealOverlayHtml = letter.writer !== "system" ? `<div class="letter-seal-overlay"><div class="seal-icon">✉️</div><div class="seal-text">클릭하여 읽기</div></div>` : '';

        card.innerHTML = `
            ${sealOverlayHtml}
            <div class="letter-meta"><div>${dayHeaderHtml}</div></div>
            ${imgHtml}
            <div class="letter-content">${letter.content}</div>
        `;

        if (letter.writer !== "system") {
            card.addEventListener('click', () => openViewModal(letter));
        }

        if (isMine && letter.writer !== "system") {
            card.addEventListener('contextmenu', (e) => openContextMenu(e, letter.id));
        }

        timeline.appendChild(card);
    });

    checkArchiveStatus(currentDay, totalValidLetters);
}

function checkArchiveStatus(finalDay, totalValidLetters) {
    const replyBoxZone = document.getElementById('reply-box-zone');
    if (!replyBoxZone) return;
    if (finalDay > 7 || totalValidLetters >= 14) {
        replyBoxZone.innerHTML = `<div class="archive-locked-box effect-ink"><h4>7일간의 기록 완료 (영구 보존 모드)</h4><button class="new-room-btn" onclick="createNewRoom()">새로운 방 생성하기</button></div>`;
    }
}

function sendLetter() {
    if (!currentSelectedSender) return showToast("편지를 보내는 주체 캐릭터를선택해 주세요.");
    const text = document.getElementById('reply-text').value.trim();

    if (!text && attachedImagesArray.length === 0) return showToast("편지 내용이나 이미지를 추가해 주세요.");

    let currentData = getRoomData();
    const finalImgs = attachedImagesArray.map(obj => obj.base64);

    const newLetter = {
        id: 'let_' + Date.now(),
        writer: myToken,
        sender: currentSelectedSender,
        content: text,
        imgs: finalImgs
    };

    currentData.push(newLetter);
    saveRoomData(currentData);

    document.getElementById('reply-text').value = "";
    attachedImagesArray = [];
    const previewGallery = document.getElementById('preview-gallery-container');
    if(previewGallery) previewGallery.innerHTML = "";

    setTimeout(() => { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }, 100);
}


// ==========================================================================
// 📌 5. 컨텍스트 메뉴 및 수정/삭제 모달 분기
// ==========================================================================
function openContextMenu(e, letterId) {
    e.preventDefault(); e.stopPropagation(); 
    selectedLetterIdForMenu = letterId;
    menuLayer.style.display = 'block';
    menuLayer.style.left = `${e.pageX}px`; menuLayer.style.top = `${e.pageY}px`;
}

document.addEventListener('click', () => { if(menuLayer) menuLayer.style.display = 'none'; });

function openEditModal() {
    if (!selectedLetterIdForMenu) return;
    let target = getRoomData().find(l => l.id === selectedLetterIdForMenu);
    if (target) { modalTextArea.value = target.content; editModal.style.display = 'flex'; }
}
function closeEditModal() { editModal.style.display = 'none'; selectedLetterIdForMenu = null; }

function submitEdit() {
    if (!selectedLetterIdForMenu) return;
    let currentData = getRoomData();
    let target = currentData.find(l => l.id === selectedLetterIdForMenu);
    if (target) { target.content = modalTextArea.value; saveRoomData(currentData); }
    closeEditModal();
}

function openDeleteModal() { if (selectedLetterIdForMenu) deleteModal.style.display = 'flex'; }
function closeDeleteModal() { deleteModal.style.display = 'none'; selectedLetterIdForMenu = null; }

function submitDelete() {
    if (!selectedLetterIdForMenu) return;
    let currentData = getRoomData().filter(l => l.id !== selectedLetterIdForMenu);
    saveRoomData(currentData);
    closeDeleteModal();
}


// ==========================================================================
// 📌 6. [극장식 대화면 뷰어] 이미지 정중앙 슬라이더 정밀 제어 엔진
// ==========================================================================
function openViewModal(letter) {
    if (menuLayer && menuLayer.style.display === 'block') return;

    const headerZone = document.getElementById('view-modal-header');
    const containerZone = document.getElementById('view-modal-img-container');
    const textZone = document.getElementById('view-modal-text');
    const modalContent = document.querySelector('.modal-view-content');

    headerZone.innerHTML = `<span class="day-badge">${letter.calculatedDay}일차</span><span class="sender-name">${letter.sender}의 편지</span>`;
    
    const hasText = letter.content && letter.content.trim().length > 0;
    if (hasText) {
        textZone.innerText = letter.content;
        textZone.style.display = 'block'; 
    } else {
        textZone.innerText = "";
        textZone.style.display = 'none';  
    }
    
    activeImagesList = [];
    if (letter.imgs && letter.imgs.length > 0) {
        activeImagesList = letter.imgs;
    } else if (letter.img) {
        activeImagesList = [letter.img];
    }

    currentSliderIdx = 0;

    if (activeImagesList.length > 0) {
        modalContent.style.maxWidth = '1200px'; 
        containerZone.style.display = 'block';
        renderActiveSliderFrame(0, null);
    } else {
        containerZone.style.display = 'none';
        document.getElementById('view-modal-img-box').innerHTML = "";
        
        const textLen = letter.content ? letter.content.trim().length : 0;
        if (textLen < 30) {
            modalContent.style.maxWidth = '400px';   
        } else if (textLen < 150) {
            modalContent.style.maxWidth = '520px';   
        } else {
            modalContent.style.maxWidth = '680px';   
        }
    }

    viewModal.style.display = 'flex';
    const bodyZone = document.querySelector('.modal-view-body');
    if(bodyZone) bodyZone.scrollTop = 0;
}

function renderActiveSliderFrame(targetIdx, motionDirection) {
    const imgZone = document.getElementById('view-modal-img-box');
    
    imgScale = 1;
    imgPanX = 0;
    imgPanY = 0;

    document.getElementById('slide-prev-btn').disabled = (targetIdx === 0);
    document.getElementById('slide-next-btn').disabled = (targetIdx === activeImagesList.length - 1);

    const newImg = document.createElement('img');
    newImg.src = activeImagesList[targetIdx];
    newImg.id = "target-zoom-img";
    newImg.alt = "slide-frame";
    newImg.style.transform = `translate(0px, 0px) scale(1)`;

    if (motionDirection === "NEXT") {
        newImg.className = "slide-in-right";
    } else if (motionDirection === "PREV") {
        newImg.className = "slide-in-left"; 
    }

    imgZone.innerHTML = "";
    imgZone.appendChild(newImg);

    renderSliderDots(targetIdx);
    bindImageTransformEvents();
}

function renderSliderDots(activeIdx) {
    const indicator = document.getElementById('view-slider-indicator');
    if(!indicator) return;
    indicator.innerHTML = "";
    activeImagesList.forEach((_, i) => {
        const dot = document.createElement('div');
        dot.className = `slider-dot ${i === activeIdx ? 'active' : ''}`;
        indicator.appendChild(dot);
    });
}

function navigateSlider(step) {
    const nextIdx = currentSliderIdx + step;
    if (nextIdx < 0 || nextIdx >= activeImagesList.length) return;

    const direction = step > 0 ? "NEXT" : "PREV";
    currentSliderIdx = nextIdx;
    renderActiveSliderFrame(currentSliderIdx, direction);
}

function bindImageTransformEvents() {
    const box = document.getElementById('view-modal-img-box');
    if(!box) return;

    box.onwheel = function(e) {
        e.preventDefault();
        const img = document.getElementById('target-zoom-img');
        if(!img) return;

        if (e.deltaY < 0) { imgScale = Math.min(imgScale + 0.2, 8); } 
        else { imgScale = Math.max(imgScale - 0.2, 0.4); }
        img.style.transform = `translate(${imgPanX}px, ${imgPanY}px) scale(${imgScale})`;
    };

    box.onmousedown = function(e) {
        e.preventDefault();
        isDraggingImg = true;
        startDragX = e.clientX - imgPanX; startDragY = e.clientY - imgPanY;
    };

    box.onmousemove = function(e) {
        if (!isDraggingImg) return;
        const img = document.getElementById('target-zoom-img');
        if(!img) return;
        imgPanX = e.clientX - startDragX; imgPanY = e.clientY - startDragY;
        img.style.transform = `translate(${imgPanX}px, ${imgPanY}px) scale(${imgScale})`;
    };
}

function closeViewModal(e) { viewModal.style.display = 'none'; isDraggingImg = false; }


// ==========================================================================
// 📌 7. [마법의 무서버 링크 추출기] 공유용 고밀도 링크 복사 시스템
// ==========================================================================
function copyLink() {
    if (!roomCode) return;

    try {
        // 방 캐릭터 설정 정보와 편지 데이터를 하나의 캡슐 객체로 결합
        const config = getCharacterConfig();
        const packageData = {
            roomCode: roomCode,
            config: config,
            letters: roomData
        };

        // 데이터 캡슐을 문자열로 변환하고 Base64로 정밀 압축 인코딩 진행
        const jsonString = JSON.stringify(packageData);
        const encodedData = btoa(encodeURIComponent(jsonString));
        
        // 데이터가 통째로 구워진 독립적 마법의 웹 링크 조립
        const shareUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}&data=${encodedData}`;

        // 클립보드에 주소 주입 수행
        navigator.clipboard.writeText(shareUrl).then(() => {
            showToast("✉️ 편지 데이터가 포함된 특별 공유 링크가 복사되었습니다!");
        }).catch(err => {
            // 구형 기기 브라우저 대응 가상 textarea 풀백 로직
            const tArea = document.createElement("textarea");
            tArea.value = shareUrl;
            document.body.appendChild(tArea);
            tArea.select();
            document.execCommand('copy');
            document.body.removeChild(tArea);
            showToast("✉️ 특별 공유 링크가 복사되었습니다!");
        });
    } catch (error) {
        console.error("공유 링크 생성 실패:", error);
        showToast("⚠️ 이미지 용량 등이 너무 커서 링크 생성에 실패했습니다. 사진 수를 조금 줄여보세요!");
    }
}
