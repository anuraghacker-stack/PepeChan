import { db, auth, appId } from './config.js';
import { renderPost, REACTION_TYPES } from './ui.js';
import { 
    collection, query, onSnapshot, addDoc, doc, updateDoc, deleteDoc, 
    arrayUnion, arrayRemove, where, getDocs, setDoc
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";

const STATE = {
    board: 'b',
    view: 'catalog',
    threadId: null,
    isAdmin: false,
    showAdminMeta: false,
    user: null,
    posts: [],
    unsubscribe: null,
    announcement: "" // Храним текст объявления
};

// Пароль админа
const ADMIN_PASS = "basedpepe"; 

// СПИСОК ДОСОК (Для отображения названий)
const BOARDS = {
    'b': 'Random',
    'a': 'Anime & Manga',
    'v': 'Video Games',
    'vg': 'Video Game Generals',
    'mu': 'Music',
    'tv': 'Television & Film',
    'g': 'Technology',
    'gd': 'Graphic Design',
    'diy': 'Do It Yourself',
    'fit': 'Fitness',
    'sci': 'Science & Math',
    'his': 'History',
    'int': 'International',
    'po': 'Politach',
    's': 'Software'
};

document.addEventListener('DOMContentLoaded', () => {
    initAuth();
    setupEventListeners();
    
    // Глобальный клик для закрытия пикеров
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.reactions-container')) {
            document.querySelectorAll('.reaction-picker').forEach(el => el.style.display = 'none');
        }
    });
});

function updateStatus(isOnline, msg) {
    const el = document.getElementById('status-display');
    if (!el) return;
    if (isOnline) {
        el.textContent = "Online";
        el.className = "status-online";
        const warn = document.getElementById('config-warning');
        if (warn) warn.style.display = 'none';
    } else {
        el.textContent = "Offline " + (msg ? `(${msg})` : "");
        el.className = "status-offline";
    }
}

// --- Auth ---
function initAuth() {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            STATE.user = user;
            startListener();
        } else {
            signInAnonymously(auth).catch(e => {
                console.error("Auth fail", e);
                updateStatus(false, "Auth Fail");
                const warn = document.getElementById('config-warning');
                if (warn) {
                    warn.innerHTML = "Ошибка входа. Включите Anonymous Auth в консоли Firebase.";
                    warn.style.display = 'block';
                }
            });
        }
    });
}

// --- Data Listener ---
function startListener() {
    // Prevent duplicate listeners
    if (STATE.unsubscribe) {
        STATE.unsubscribe();
        STATE.unsubscribe = null;
    }

    const q = query(collection(db, 'artifacts', appId, 'public', 'data', 'posts'));
    
    STATE.unsubscribe = onSnapshot(q, (snapshot) => {
        const newPosts = [];
        snapshot.forEach(doc => {
            // Обработка специального документа с объявлением
            if (doc.id === 'ANNOUNCEMENT') {
                STATE.announcement = doc.data().text || "";
                renderAnnouncement(STATE.announcement);
            } else {
                newPosts.push({ _docId: doc.id, ...doc.data() });
            }
        });
        STATE.posts = newPosts;
        updateStatus(true);
        render();
    }, (err) => {
        console.error("DB Error", err);
        updateStatus(false, "DB Error");
        const warn = document.getElementById('config-warning');
        if (warn) {
            warn.innerHTML = "Ошибка базы данных. Проверьте Rules в консоли Firebase.";
            warn.style.display = 'block';
        }
    });
}

// --- Render Logic ---
function render() {
    const container = document.getElementById('main-content');
    const formContainer = document.getElementById('post-form');
    const boardNavs = document.querySelectorAll('#board-nav a[data-board]');
    
    // Nav highlight
    boardNavs.forEach(a => {
        const isActive = a.dataset.board === STATE.board;
        a.style.textDecoration = isActive ? "underline" : "none";
        a.style.color = isActive ? "#d00" : "#005500";
    });

    // Заголовок доски
    const boardName = BOARDS[STATE.board] || "Board";
    document.getElementById('board-title').textContent = `/${STATE.board}/ - ${boardName}`;
    
    container.innerHTML = '';
    
    // Filter posts for current board!
    const boardPosts = STATE.posts.filter(p => p.board === STATE.board);

    // Current Thread Logic
    let currentThread = null;
    if (STATE.view === 'thread') {
        currentThread = boardPosts.find(p => p.id === STATE.threadId);
        if (!currentThread) {
            // Thread deleted or not found in THIS board -> back to catalog
            STATE.view = 'catalog'; 
        }
    }

    if (STATE.view === 'catalog') {
        document.getElementById('thread-nav').classList.add('hidden');
        document.querySelector('.form-header').textContent = "Новый тред";
        formContainer.classList.remove('hidden');

        // Sort: Pinned first, then Newest ID (descending)
        const threads = boardPosts.filter(p => p.parentId === 0).sort((a, b) => {
            if (a.isPinned && !b.isPinned) return -1;
            if (!a.isPinned && b.isPinned) return 1;
            return b.id - a.id;
        });

        if (threads.length === 0) container.innerHTML = '<div style="text-align:center; padding:20px;">Доска пуста.</div>';

        threads.forEach(op => {
            const threadDiv = document.createElement('div');
            threadDiv.className = 'thread';
            
            const replies = boardPosts.filter(p => p.parentId === op.id);
            // Sort replies by ID asc (oldest first)
            replies.sort((a,b) => a.id - b.id);
            
            const preview = replies.slice(-3); 
            
            let html = renderPost(op, true, true, STATE.user, STATE.isAdmin, STATE.showAdminMeta);
            if (replies.length > 3) {
                html += `<div style="margin-left:20px; color:#557755; font-style:italic; font-size:12px;">Пропущено ${replies.length - 3} ответов. Нажмите "Ответ" чтобы читать.</div>`;
            }
            preview.forEach(rep => {
                html += renderPost(rep, false, false, STATE.user, STATE.isAdmin, STATE.showAdminMeta);
            });
            
            threadDiv.innerHTML = html;
            container.appendChild(threadDiv);
        });

    } else {
        // Thread View
        document.getElementById('thread-nav').classList.remove('hidden');
        document.querySelector('.form-header').textContent = `Ответ в тред №${currentThread.id}`;
        
        if (currentThread.isLocked) {
            formContainer.classList.add('hidden');
            container.innerHTML = `<h3 style="text-align:center; color:red">Тред закрыт 🔒</h3>`;
        } else {
            formContainer.classList.remove('hidden');
        }

        const threadDiv = document.createElement('div');
        threadDiv.className = 'thread';
        
        const replies = boardPosts.filter(p => p.parentId === currentThread.id).sort((a,b) => a.id - b.id);
        
        let html = renderPost(currentThread, true, false, STATE.user, STATE.isAdmin, STATE.showAdminMeta);
        replies.forEach(rep => {
            html += renderPost(rep, false, false, STATE.user, STATE.isAdmin, STATE.showAdminMeta);
        });
        
        threadDiv.innerHTML = html;
        container.appendChild(threadDiv);
    }
}

function renderAnnouncement(text) {
    const el = document.getElementById('global-announcement');
    const txt = document.getElementById('announcement-text');
    const editBtn = document.getElementById('announcement-edit');
    
    // Обновляем текст
    txt.textContent = text || (STATE.isAdmin ? "[Нет объявлений]" : "");

    // Логика видимости
    if (text) {
        el.classList.remove('hidden');
    } else {
        // Если текста нет, показываем блок только админу (чтобы мог добавить)
        if (STATE.isAdmin) el.classList.remove('hidden');
        else el.classList.add('hidden');
    }
    
    // Кнопка редактирования
    if (STATE.isAdmin) editBtn.classList.remove('hidden');
    else editBtn.classList.add('hidden');
}

// Helper to resize images
const compressImage = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
        const img = new Image();
        img.src = event.target.result;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800; 
            const scaleSize = MAX_WIDTH / img.width;
            if (scaleSize < 1) { canvas.width = MAX_WIDTH; canvas.height = img.height * scaleSize; } 
            else { canvas.width = img.width; canvas.height = img.height; }
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            resolve(canvas.toDataURL('image/jpeg', 0.7)); 
        };
        img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
});

// --- Event Listeners ---
function setupEventListeners() {
    // Board switch
    document.querySelectorAll('#board-nav a[data-board]').forEach(a => {
        a.onclick = () => {
            STATE.board = a.dataset.board;
            STATE.view = 'catalog';
            STATE.threadId = null;
            render();
        };
    });

    // Login Easter Egg
    let clicks = 0;
    let timer;
    document.getElementById('frog-logo').onclick = () => {
        clicks++;
        clearTimeout(timer);
        timer = setTimeout(() => { clicks = 0; }, 2000);
        
        if (clicks >= 10) {
            clicks = 0;
            if (STATE.isAdmin) {
                STATE.isAdmin = false;
                STATE.showAdminMeta = false;
                render(); // Перерисовываем для скрытия админских штук
                renderAnnouncement(STATE.announcement); // Обновляем видимость объявления
                alert("Admin Mode OFF");
            } else {
                document.getElementById('login-modal').classList.remove('hidden');
                document.getElementById('admin-pass-input').value = '';
                document.getElementById('admin-pass-input').focus();
            }
        }
    };

    document.getElementById('modal-close-btn').onclick = () => document.getElementById('login-modal').classList.add('hidden');
    
    document.getElementById('modal-login-btn').onclick = () => {
        const pass = document.getElementById('admin-pass-input').value.trim().toLowerCase();
        if (pass === ADMIN_PASS) {
            STATE.isAdmin = true;
            document.getElementById('login-modal').classList.add('hidden');
            
            // Показываем элементы админки
            document.getElementById('admin-indicator').classList.remove('hidden');
            document.getElementById('admin-posting-options').classList.remove('hidden');
            document.getElementById('toggle-ids-btn').style.display = 'inline-block';
            
            render(); 
            renderAnnouncement(STATE.announcement); // Чтобы появилась кнопка Edit
            alert("Admin Mode ON");
        } else {
            alert("Wrong password");
        }
    };
}

// --- Global Actions (exposed to window) ---
window.app = {
    // Navigation
    backToCatalog: () => { STATE.view = 'catalog'; STATE.threadId = null; render(); },
    openThread: (id) => { STATE.view = 'thread'; STATE.threadId = id; render(); window.scrollTo(0,0); },
    replyTo: (id) => { 
        const area = document.getElementById('input-comment'); 
        area.value += `>>${id}\n`; 
        area.focus(); 
    },
    
    // UI Helpers
    updateNamePlaceholder: () => {
        const check = document.getElementById('admin-post-as-admin');
        const input = document.getElementById('input-name');
        input.placeholder = (STATE.isAdmin && check?.checked) ? "Admin" : "Аноним";
    },
    toggleAdminView: () => {
        STATE.showAdminMeta = !STATE.showAdminMeta;
        render();
    },

    // Admin Actions
    editAnnouncement: async () => {
        const newText = prompt("Текст объявления (оставьте пустым для удаления):", STATE.announcement);
        if (newText === null) return;
        try {
            // Сохраняем в специальный документ с ID 'ANNOUNCEMENT'
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'posts', 'ANNOUNCEMENT'), { text: newText });
        } catch(e) { alert("Ошибка сохранения: " + e.message); }
    },
    togglePin: (docId, current) => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'posts', docId), { isPinned: !current }),
    toggleLock: (docId, current) => updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'posts', docId), { isLocked: !current }),
    deletePost: async (docId, postId, parentId) => {
        if(!confirm("Удалить пост?")) return;
        
        try {
            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'posts', docId));
            // Каскадное удаление ответов (клиентское)
            const replies = STATE.posts.filter(p => p.parentId === postId);
            for(const r of replies) {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'posts', r._docId));
            }
            if (parentId === 0 && STATE.view === 'thread') window.app.backToCatalog();
        } catch(e) {
            alert("Error deleting: " + e.message);
        }
    },

    // Reactions
    toggleReactionPicker: (postId) => {
        const picker = document.getElementById(`picker-${postId}`);
        const isVisible = picker.style.display === 'block';
        document.querySelectorAll('.reaction-picker').forEach(el => el.style.display = 'none');
        if (!isVisible) picker.style.display = 'block';
    },
    toggleReaction: async (docId, postId, emoji) => {
        if (!STATE.user) return;
        
        // Hide picker
        const picker = document.getElementById(`picker-${postId}`);
        if(picker) picker.style.display = 'none';

        const postRef = doc(db, 'artifacts', appId, 'public', 'data', 'posts', docId);
        const post = STATE.posts.find(p => p._docId === docId);
        if (!post) return;
        
        // Init if needed
        if (!post.reactions) {
            try {
                await setDoc(postRef, { reactions: { [emoji]: [STATE.user.uid] } }, { merge: true });
            } catch (e) {}
            return;
        }

        let currentReaction = null;
        for (const [r, users] of Object.entries(post.reactions)) {
            if (users.includes(STATE.user.uid)) {
                currentReaction = r;
                break;
            }
        }

        const updates = {};
        if (currentReaction) {
            updates[`reactions.${currentReaction}`] = arrayRemove(STATE.user.uid);
            // Swap reaction
            if (currentReaction !== emoji) {
                updates[`reactions.${emoji}`] = arrayUnion(STATE.user.uid);
            }
        } else {
            // New reaction
            updates[`reactions.${emoji}`] = arrayUnion(STATE.user.uid);
        }

        try {
            await updateDoc(postRef, updates);
        } catch (e) {
             // Fallback init
             await setDoc(postRef, { reactions: { [emoji]: [STATE.user.uid] } }, { merge: true });
        }
    },

    // Posting
    submitPost: async () => {
        if (!STATE.user) return alert("Нет соединения");
        
        const nameIn = document.getElementById('input-name');
        const subIn = document.getElementById('input-subject');
        const commIn = document.getElementById('input-comment');
        const fileUrlIn = document.getElementById('input-file-url');
        const fileUp = document.getElementById('input-file-upload');
        const adminCheck = document.getElementById('admin-post-as-admin');

        let name = nameIn.value.trim();
        const subject = subIn.value.trim();
        const comment = commIn.value.trim();
        let file = fileUrlIn.value.trim();

        if (fileUp.files[0]) {
            try {
                file = await compressImage(fileUp.files[0]);
            } catch(e) { return alert("Ошибка файла"); }
        }

        if (!comment && !file) return alert("Введите текст или файл");
        
        // Banned names check (only for non-admins)
        const BANNED_NAMES = /^(admin|administrator|mod|moderator|root|moot|pepechan)$/i;
        if (!STATE.isAdmin && BANNED_NAMES.test(name)) { return alert("Это имя зарезервировано."); }

        const isPostAdmin = STATE.isAdmin && adminCheck?.checked;
        if (!name) name = isPostAdmin ? "Admin" : "Аноним";

        let ip = "Hidden";
        try {
            const res = await fetch('https://api.ipify.org?format=json');
            const j = await res.json();
            ip = j.ip;
        } catch(e) {}

        const postId = Date.now();
        const newPost = {
            id: postId,
            board: STATE.board, // <-- ВАЖНО: Используем текущую доску из STATE
            parentId: (STATE.view === 'thread') ? STATE.threadId : 0,
            name, subject, comment, file,
            date: new Date().toLocaleString('ru-RU'),
            authorUid: STATE.user.uid,
            isAdmin: isPostAdmin,
            ip: ip,
            isPinned: false, isLocked: false, reactions: {}
        };

        try {
            await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'posts'), newPost);
            
            subIn.value = ''; commIn.value = ''; fileUrlIn.value = ''; fileUp.value = '';
            
            if (STATE.view === 'catalog') {
                STATE.threadId = postId;
                STATE.view = 'thread';
            }
        } catch(e) {
            if (e.code === 'resource-exhausted') alert("Файл слишком большой (>1МБ)");
            else alert("Ошибка: " + e.message);
        }
    }
};
