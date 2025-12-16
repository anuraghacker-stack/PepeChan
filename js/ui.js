export const REACTION_TYPES = ['👍', '👎', '❤️', '🤣', '😭', '🤡', '💩', '🔥'];

export function renderPost(post, isOp, isCatalog, user, isAdminMode, showMeta) {
    const safeComment = escapeHtml(post.comment);
    const formattedComment = processGreentext(safeComment);
    
    let imageHtml = '';
    if (post.file) {
        // Простая проверка: если начинается с data:image - это base64, иначе считаем URL
        const isBase64 = post.file.startsWith('data:image');
        const hrefLink = isBase64 ? '#' : post.file;
        const linkAttr = isBase64 ? `onclick="window.app.toggleImage(this.parentElement.nextElementSibling); return false;"` : `target="_blank" rel="noopener noreferrer"`;
        const linkText = isBase64 ? '(Image)' : 'Link';
        
        imageHtml = `
            <div class="file-info">File: <a href="${hrefLink}" ${linkAttr}>${linkText}</a></div>
            <img src="${post.file}" class="post-image" loading="lazy" referrerpolicy="no-referrer" onclick="this.classList.toggle('expanded')"
                 onerror="this.onerror=null; this.src='https://placehold.co/200?text=Error'; this.style.border='1px solid red';">
        `;
    }

    let nameDisplay = post.name || "Anonymous";
    let nameClass = "name";
    
    if (post.isAdmin) {
        nameClass = "name admin-capcode";
        if (nameDisplay === 'Admin') nameDisplay = "# Admin #";
        else nameDisplay = `${nameDisplay} ## Admin`;
    }

    let statusIcons = "";
    if (isOp) {
        if (post.isPinned) statusIcons += `<span class="icon-pinned">📌</span>`;
        if (post.isLocked) statusIcons += `<span class="icon-locked">🔒</span>`;
    }

    let adminControls = "";
    if (isAdminMode) {
        if (showMeta) {
            const color = stringToColor(post.authorUid || "anon");
            adminControls += `<span class="admin-meta-info" style="background:${color}">ID: ${(post.authorUid || "?").slice(0,5)}</span>`;
            adminControls += `<span class="admin-meta-info">IP: ${post.ip || "?"}</span>`;
        }
        
        const docId = post._docId;
        adminControls += `<span class="admin-controls">`;
        if (isOp) {
            adminControls += `<span class="btn-control icon-pinned" onclick="window.app.togglePin('${docId}', ${post.isPinned})">[Pin]</span>`;
            adminControls += `<span class="btn-control icon-locked" onclick="window.app.toggleLock('${docId}', ${post.isLocked})">[Lock]</span>`;
        }
        adminControls += `<span class="btn-control" style="color:red" onclick="window.app.deletePost('${docId}', ${post.id}, ${post.parentId})">[Del]</span>`;
        adminControls += `</span>`;
    }

    const reactionsHtml = renderReactions(post, user);

    const headerHtml = `
        ${statusIcons}
        <span class="subject">${escapeHtml(post.subject || '')}</span>
        <span class="${nameClass}">${escapeHtml(nameDisplay)}</span>
        <span class="date">${post.date}</span>
        <span class="post-number" onclick="window.app.replyTo(${post.id})">No.${post.id}</span>
        ${adminControls}
        ${isOp && isCatalog && !post.isLocked ? `[<a onclick="window.app.openThread(${post.id})">Reply</a>]` : ''}
    `;

    const contentClass = isOp ? "post op-post" : "reply-container";
    
    return `
        <div class="${contentClass}" id="post-${post.id}">
            ${isOp ? imageHtml : ''}
            <div class="post-header">${headerHtml}</div>
            ${!isOp ? imageHtml : ''}
            <div class="post-message">${formattedComment}</div>
            ${reactionsHtml}
        </div>
        ${isOp ? '<div style="clear:both"></div>' : ''}
    `;
}

function renderReactions(post, user) {
    const myUid = user ? user.uid : null;
    const reactions = post.reactions || {};
    
    let tagsHtml = '';
    REACTION_TYPES.forEach(emoji => {
        const users = reactions[emoji] || [];
        if (users.length > 0) {
            const isActive = myUid && users.includes(myUid);
            tagsHtml += `
                <span class="reaction-tag ${isActive ? 'active' : ''}" 
                      onclick="window.app.toggleReaction('${post._docId}', ${post.id}, '${emoji}')">
                    ${emoji} ${users.length}
                </span>
            `;
        }
    });
    
    let pickerHtml = `<div class="reaction-picker" id="picker-${post.id}" style="display:none;">`;
    REACTION_TYPES.forEach(emoji => {
        pickerHtml += `<span class="reaction-option" onclick="window.app.toggleReaction('${post._docId}', ${post.id}, '${emoji}')">${emoji}</span>`;
    });
    pickerHtml += `</div>`;

    return `
        <div class="reactions-container">
            ${tagsHtml}
            <span class="reaction-picker-btn" onclick="window.app.toggleReactionPicker('${post.id}')">[+]</span>
            ${pickerHtml}
        </div>
    `;
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function processGreentext(text) {
    return text.split('\n').map(line => 
        line.startsWith('&gt;') ? `<span class="greentext">${line}</span>` : line
    ).join('<br>');
}

function stringToColor(str) {
    if (!str) return '#ccc';
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    let color = '#';
    for (let i = 0; i < 3; i++) {
        let value = (hash >> (i * 8)) & 0xFF;
        color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
}
