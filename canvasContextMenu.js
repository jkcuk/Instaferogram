const MENU_CLASS = 'canvas-image-context-menu';
const STATUS_CLASS = 'canvas-image-context-menu-status';

/**
 * Adds a save/copy context menu for a canvas element.
 * For WebGL canvases, create the renderer with preserveDrawingBuffer enabled.
 * @param {HTMLCanvasElement} canvas
 * @param {{ filename?: string }} [options]
 * @returns {() => void} Removes the menu and its event listeners.
 */
export function installCanvasContextMenu(canvas, { filename = 'image.png' } = {}) {
    if (!canvas || typeof canvas.toBlob !== 'function') {
        throw new TypeError('A canvas element with toBlob() is required.');
    }

    const style = document.createElement('style');
    style.textContent = `
        .${MENU_CLASS} {
            position: fixed;
            z-index: 10000;
            display: none;
            min-width: 180px;
            padding: 5px;
            border: 1px solid #555;
            border-radius: 6px;
            background: #222;
            color: #fff;
            box-shadow: 0 4px 12px #0008;
            font: 14px sans-serif;
        }
        .${MENU_CLASS} button {
            display: block;
            width: 100%;
            padding: 8px 10px;
            border: 0;
            border-radius: 3px;
            background: transparent;
            color: inherit;
            text-align: left;
            font: inherit;
            cursor: pointer;
        }
        .${MENU_CLASS} button:hover,
        .${MENU_CLASS} button:focus-visible {
            outline: none;
            background: #444;
        }
        .${STATUS_CLASS} {
            display: none;
            padding: 6px 10px;
            color: #ffb4ab;
            font-size: 12px;
        }
    `;
    document.head.appendChild(style);

    const menu = document.createElement('div');
    menu.className = MENU_CLASS;
    menu.setAttribute('role', 'menu');

    const saveButton = createMenuButton('Save image as PNG…');
    const copyButton = createMenuButton('Copy image');
    const status = document.createElement('div');
    status.className = STATUS_CLASS;
    status.setAttribute('role', 'status');
    menu.append(saveButton, copyButton, status);
    document.body.appendChild(menu);

    const onContextMenu = (event) => {
        event.preventDefault();
        status.style.display = 'none';
        menu.style.display = 'block';
        menu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - menu.offsetWidth - 8))}px`;
        menu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - menu.offsetHeight - 8))}px`;
    };
    const onPointerDown = (event) => {
        if (!menu.contains(event.target)) menu.style.display = 'none';
    };
    const onKeyDown = (event) => {
        if (event.key === 'Escape') menu.style.display = 'none';
    };
    const onResize = () => {
        menu.style.display = 'none';
    };

    canvas.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);

    saveButton.addEventListener('click', () => {
        saveCanvasImage(canvas, filename).then(() => {
            menu.style.display = 'none';
        }).catch((error) => {
            showMenuError('Could not save the image.');
            console.error('Could not save the canvas image:', error);
        });
    });
    copyButton.addEventListener('click', () => {
        copyCanvasImage(canvas).then(() => {
            menu.style.display = 'none';
        }).catch((error) => {
            showMenuError('Could not copy the image.');
            console.error('Could not copy the canvas image:', error);
        });
    });

    function showMenuError(message) {
        status.textContent = message;
        status.style.display = 'block';
    }

    return () => {
        canvas.removeEventListener('contextmenu', onContextMenu);
        document.removeEventListener('pointerdown', onPointerDown);
        document.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('resize', onResize);
        menu.remove();
        style.remove();
    };
}

function createMenuButton(label) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.setAttribute('role', 'menuitem');
    return button;
}

function getCanvasImageBlob(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas image encoding returned no data.'));
        }, 'image/png');
    });
}

async function saveCanvasImage(canvas, filename) {
    const blob = await getCanvasImageBlob(canvas);
    const imageUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(imageUrl), 1000);
}

async function copyCanvasImage(canvas) {
    if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
        throw new Error('Image clipboard access is not supported by this browser.');
    }

    const blob = await getCanvasImageBlob(canvas);
    await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
    ]);
}
