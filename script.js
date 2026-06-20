// 1. 방 고유 코드 분기 및 URL 파싱 시스템
let urlParams = new URLSearchParams(window.location.search);
let roomCode = urlParams.get('room');
if (!roomCode) {
    createNewRoom();
} else {
    document.getElementById('current-url-display').innerText = window.location.href;
}

function createNewRoom() {
    const newCode = 'room_' + Math.random().toString(36).substring(2, 9);
    window.location.href = `?room=${newCode}`;
}

// 2. 비회원 검증 토큰 발급
let myToken = localStorage.getItem('relay_user_token');
if (!myToken) {
    myToken = 'usr_' + Math.random().toString(36).substring(2, 9);
    localStorage.setItem('relay_user_token', myToken);
}

let currentSelectedSender = ""; 
let selectedLetterIdForMenu = null;

// 🌟 다중 이미지 업로드 관리용 대기열 배열
let attachedImagesArray = []; 

// 🌟 글로벌 이미지 조작 및 슬라이더 인덱스 관리자
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
    const toast = document.createElement('div');
    toast.className = 'custom-toast';
    toast.innerText = message;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 2500);
}

function getRoomData() {
    let data = localStorage.getItem(`relay_db_${roomCode}`);
    return data ? JSON.parse(data) : [];
}

function saveRoomData(data) {
    localStorage.setItem(`relay_db_${roomCode}`, JSON.stringify(data));
    renderTimeline();
}

function getCharacterConfig() {
    let config = localStorage.getItem(`relay_config_${roomCode}`);
    return config ? JSON.parse(config) : null;
}

function initCheck() {
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
            img: ""
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
// 🌟 [용량 초과 방지] 이미지를 적정 크기로 압축하여 localStorage 보관을 가능하게 하는 엔진
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
                // 🌟 압축 캔버스 생성 (최대 해상도 가이드라인 1024px)
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 1024;
                const MAX_HEIGHT = 1024;
                let width = img.width;
                let height = img.height;

                // 비율 유지하며 크기 리사이징 계산
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

                // 🌟 화질을 0.7(70%) 정도로 압축하여 용량을 수십 분의 일로 다이어트!
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);

                attachedImagesArray.push({
                    name: file.name.replace(/\.[^/.]+$/, "") + ".jpg", // jpeg 포맷 통일
                    base64: compressedBase64
                });

                loadedCount++;
                // 모든 파일 변환 및 압축이 끝나면 화면에 칩 표시
                if (loadedCount === files.length) {
                    renderImagePreviewChips();
                    input.value = ""; 
                }
            };
        };
        reader.readAsDataURL(file);
    });
}

// 🌟 [추가 안전장치] 데이터 저장 시 용량 초과 에러가 발생하면 사용자에게 친절하게 경고창을 띄우도록 saveRoomData 함수도 보완합니다.
function saveRoomData(data) {
    try {
        localStorage.setItem(`relay_db_${roomCode}`, JSON.stringify(data));
        renderTimeline();
    } catch (error) {
        console.error("Storage error:", error);
        showToast("⚠️ 이미지 용량이 너무 커서 저장에 실패했습니다! 다른 사진을 이용해 주세요.");
    }
}
// 🌟 첨부 대기 이미지 정렬 칩 및 내비게이션 기능 렌더러
function renderImagePreviewChips() {
    const container = document.getElementById('preview-gallery-container');
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
    
    // 원소 스와핑
    const temp = attachedImagesArray[idx];
    attachedImagesArray[idx] = attachedImagesArray[targetIdx];
    attachedImagesArray[targetIdx] = temp;
    
    renderImagePreviewChips();
}

function removePreviewImage(idx) {
    attachedImagesArray.splice(idx, 1);
    renderImagePreviewChips();
}

function renderTimeline() {
    const timeline = document.getElementById('letter-timeline');
    timeline.innerHTML = "";
    const letters = getRoomData();

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
        
        // 다중 이미지 렌더 바인딩 (첫 장만 대표로 출력)
        let imgHtml = "";
        if (letter.imgs && letter.imgs.length > 0) {
            let badgeHtml = letter.imgs.length > 1 ? `<div class="letter-img-count-badge">+${letter.imgs.length}장</div>` : "";
            imgHtml = `<div class="letter-img-box"><img src="${letter.imgs[0]}" alt="uploaded">${badgeHtml}</div>`;
        } else if (letter.img) { // 구버전 호환용
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
    if (!currentSelectedSender) return showToast("편지를 보내는 주체 캐릭터를 선택해 주세요.");
    const text = document.getElementById('reply-text').value.trim();

    if (!text && attachedImagesArray.length === 0) return showToast("편지 내용이나 이미지를 추가해 주세요.");

    let currentData = getRoomData();
    
    // 순서 정렬이 완수된 대기열 기지에서 base64 알맹이만 추출하여 저장
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
    document.getElementById('preview-gallery-container').innerHTML = "";

    setTimeout(() => { window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }); }, 100);
}

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
// 🌟 [최종 완성형 오픈 모달 엔진] 사진 유무 / 텍스트 유무에 따라 크기와 노출 여부를 동적 제어
function openViewModal(letter) {
    if (menuLayer && menuLayer.style.display === 'block') return;

    const headerZone = document.getElementById('view-modal-header');
    const containerZone = document.getElementById('view-modal-img-container');
    const textZone = document.getElementById('view-modal-text');
    const modalContent = document.querySelector('.modal-view-content');

    headerZone.innerHTML = `<span class="day-badge">${letter.calculatedDay}일차</span><span class="sender-name">${letter.sender}의 편지</span>`;
    
    // 1. 텍스트 바인딩 및 예외 처리 (텍스트가 아예 없거나 공백만 있다면 창 숨기기)
    const hasText = letter.content && letter.content.trim().length > 0;
    if (hasText) {
        textZone.innerText = letter.content;
        textZone.style.display = 'block'; // 텍스트 표시
    } else {
        textZone.innerText = "";
        textZone.style.display = 'none';  // 🌟 [텍스트 없음 빈 공간 박멸] 텍스트 창 자체를 증발시킴
    }
    
    // 다중 이미지 데이터 리스트 파싱
    activeImagesList = [];
    if (letter.imgs && letter.imgs.length > 0) {
        activeImagesList = letter.imgs;
    } else if (letter.img) {
        activeImagesList = [letter.img];
    }

    currentSliderIdx = 0;

    // 2. [가로/세로 최적화 맞춤 크기 오케스트라]
    if (activeImagesList.length > 0) {
        // 🖼️ 사진이 포함된 팝업인 경우: 화면을 시원하고 와이드하게 가득 채움
        modalContent.style.maxWidth = '1200px'; 
        containerZone.style.display = 'block';
        renderActiveSliderFrame(0, null);
    } else {
        // 🔤 텍스트만 있는 팝업인 경우: 사진 영역을 숨기고 글자 수에 딱 맞게 슬림 피팅
        containerZone.style.display = 'none';
        document.getElementById('view-modal-img-box').innerHTML = "";
        
        const textLen = letter.content ? letter.content.trim().length : 0;
        if (textLen < 30) {
            modalContent.style.maxWidth = '400px';   // 아주 단문일 때 귀엽게 밀착
        } else if (textLen < 150) {
            modalContent.style.maxWidth = '520px';   // 중문형 크기 방어
        } else {
            modalContent.style.maxWidth = '680px';   // 장문형 가로 폭
        }
    }

    viewModal.style.display = 'flex';
    const bodyZone = document.querySelector('.modal-view-body');
    if(bodyZone) bodyZone.scrollTop = 0;
}

// [애니메이션 프레임 제어 엔진]
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
    indicator.innerHTML = "";
    activeImagesList.forEach((_, i) => {
        const dot = document.createElement('div');
        dot.className = `slider-dot ${i === activeIdx ? 'active' : ''}`;
        indicator.appendChild(dot);
    });
}

// 🌟 슬라이드 제어 및 방향 판별자
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
function copyLink() { navigator.clipboard.writeText(window.location.href); showToast("주소가 복사되었습니다!"); }

initCheck();