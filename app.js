document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const browseBtn = document.getElementById('browseBtn');
    const controlPanel = document.getElementById('controlPanel');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const formatSelect = document.getElementById('formatSelect');
    const qualityGroup = document.getElementById('qualityGroup');
    const qualityRange = document.getElementById('qualityRange');
    const qualityVal = document.getElementById('qualityVal');
    const convertAllBtn = document.getElementById('convertAllBtn');
    const downloadZipBtn = document.getElementById('downloadZipBtn');
    const queueStatus = document.getElementById('queueStatus');
    const queueContainer = document.getElementById('queueContainer');
    const queueList = document.getElementById('queueList');
    
    // Debug Console Elements
    const debugLogs = document.getElementById('debugLogs');
    const debugToggle = document.getElementById('debugToggle');
    const debugToggleIcon = document.getElementById('debugToggleIcon');

    // Array to store queue files
    let fileQueue = [];
    // Zip handler
    let convertedZip = null;

    // Log to screen function
    function logToScreen(message, type = 'info') {
        if (!debugLogs) return;
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        entry.textContent = `[${time}] ${message}`;
        debugLogs.appendChild(entry);
        debugLogs.scrollTop = debugLogs.scrollHeight;
    }

    // Toggle log visibility
    debugToggle.addEventListener('click', () => {
        debugLogs.classList.toggle('hidden');
        debugToggleIcon.classList.toggle('open');
    });

    // Intercept Console Logs
    const _log = console.log;
    const _error = console.error;
    const _warn = console.warn;

    console.log = function(...args) {
        _log.apply(console, args);
        logToScreen(args.join(' '), 'info');
    };
    console.error = function(...args) {
        _error.apply(console, args);
        logToScreen(args.join(' '), 'error');
    };
    console.warn = function(...args) {
        _warn.apply(console, args);
        logToScreen(args.join(' '), 'warn');
    };

    // Global uncaught errors
    window.addEventListener('error', (event) => {
        logToScreen(`Uncaught error: ${event.message} at ${event.filename}:${event.lineno}`, 'error');
    });

    window.addEventListener('unhandledrejection', (event) => {
        logToScreen(`Unhandled promise rejection: ${event.reason}`, 'error');
    });

    // Startup log check
    setTimeout(() => {
        console.log(`Checking system state...`);
        if (typeof heic2any === 'undefined') {
            console.error(`Library heic2any is UNDEFINED! Please check if heic2any.min.js was loaded correctly.`);
        } else {
            console.log(`Library heic2any loaded successfully.`);
        }
        if (typeof JSZip === 'undefined') {
            console.error(`Library JSZip is UNDEFINED!`);
        } else {
            console.log(`Library JSZip loaded successfully.`);
        }
    }, 100);

    // Initialize Lucide Icons
    lucide.createIcons();

    // Trigger browse file dialog
    browseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fileInput.click();
    });

    // File Input change event
    fileInput.addEventListener('change', handleFileSelection);

    // Drag and drop event handlers
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            addFilesToQueue(e.dataTransfer.files);
        }
    });

    // Format select change event (toggle quality slider)
    formatSelect.addEventListener('change', () => {
        const selectedFormat = formatSelect.value;
        if (selectedFormat === 'image/jpeg' || selectedFormat === 'image/webp') {
            qualityGroup.classList.remove('hidden');
        } else {
            qualityGroup.classList.add('hidden');
        }
    });

    // Quality slider change
    qualityRange.addEventListener('input', () => {
        qualityVal.textContent = `${qualityRange.value}%`;
    });

    // Clear all files
    clearAllBtn.addEventListener('click', clearQueue);

    // Convert all queue items
    convertAllBtn.addEventListener('click', convertQueue);

    // Download ZIP
    downloadZipBtn.addEventListener('click', downloadAllAsZip);

    // Handle File Selection
    function handleFileSelection(e) {
        if (e.target.files.length > 0) {
            addFilesToQueue(e.target.files);
            // Reset input so the same file can be selected again
            fileInput.value = '';
        }
    }

    // Add files to the queue representation
    function addFilesToQueue(files) {
        let filesAdded = false;

        Array.from(files).forEach(file => {
            const fileExt = file.name.split('.').pop().toLowerCase();
            const isHeic = fileExt === 'heic' || fileExt === 'heif' || file.type === 'image/heic' || file.type === 'image/heif';
            const isNormalImage = file.type.startsWith('image/') || ['heic', 'heif', 'tiff', 'tif'].includes(fileExt);

            if (!isNormalImage) {
                alert(`File "${file.name}" is not a supported image format.`);
                return;
            }

            // Create unique ID for the queue item
            const id = 'file_' + Math.random().toString(36).substr(2, 9);

            const queueItem = {
                id: id,
                file: file,
                name: file.name,
                size: formatBytes(file.size),
                isHeic: isHeic,
                status: 'waiting', // waiting, processing, completed, error
                progress: 0,
                convertedBlob: null,
                convertedName: null,
                thumbnail: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%2394a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'
            };

            fileQueue.push(queueItem);
            renderQueueItem(queueItem);
            generateThumbnail(queueItem);
            filesAdded = true;
        });

        if (filesAdded) {
            updateUIState();
        }
    }

    // Update visibility of panels and controls
    function updateUIState() {
        if (fileQueue.length > 0) {
            controlPanel.classList.remove('hidden');
            queueContainer.classList.remove('hidden');
            queueStatus.textContent = `Ready to convert ${fileQueue.length} file(s)`;
            
            // Check if all are completed to show download zip
            const allCompleted = fileQueue.every(item => item.status === 'completed');
            if (allCompleted) {
                downloadZipBtn.classList.remove('hidden');
            } else {
                downloadZipBtn.classList.add('hidden');
            }
        } else {
            controlPanel.classList.add('hidden');
            queueContainer.classList.add('hidden');
            downloadZipBtn.classList.add('hidden');
        }
    }

    // Render HTML for a queue item
    function renderQueueItem(item) {
        const itemEl = document.createElement('div');
        itemEl.className = 'queue-item';
        itemEl.id = item.id;

        itemEl.innerHTML = `
            <img class="thumbnail-preview" id="thumb_${item.id}" src="${item.thumbnail}" alt="Thumbnail">
            <div class="item-info">
                <span class="item-name" title="${item.name}">${item.name}</span>
                <div class="item-meta">
                    <span>${item.size}</span>
                    <span class="item-status status-waiting" id="status_${item.id}">
                        <i data-lucide="clock" style="width: 14px; height: 14px;"></i> Waiting
                    </span>
                </div>
            </div>
            <div class="item-controls">
                <button class="btn-icon delete" id="del_${item.id}" title="Remove file">
                    <i data-lucide="x" style="width: 16px; height: 16px;"></i>
                </button>
            </div>
            <div class="progress-container hidden" id="prog_container_${item.id}">
                <div class="progress-bar" id="prog_${item.id}"></div>
            </div>
        `;

        queueList.appendChild(itemEl);
        lucide.createIcons({attrs: {'style': 'width: 16px; height: 16px;'}});

        // Set up delete event
        document.getElementById(`del_${item.id}`).addEventListener('click', () => {
            removeFileFromQueue(item.id);
        });
    }

    // Generate thumbnails locally
    function generateThumbnail(item) {
        if (item.isHeic) {
            // For HEIC files, we don't render a thumbnail instantly to avoid freezing.
            // When converting, we will show the converted preview.
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const thumbImg = document.getElementById(`thumb_${item.id}`);
            if (thumbImg) {
                thumbImg.src = e.target.result;
            }
        };
        reader.readAsDataURL(item.file);
    }

    // Remove file from queue list
    function removeFileFromQueue(id) {
        fileQueue = fileQueue.filter(item => item.id !== id);
        const el = document.getElementById(id);
        if (el) {
            el.remove();
        }
        updateUIState();
    }

    // Clear entire queue
    function clearQueue() {
        fileQueue = [];
        queueList.innerHTML = '';
        convertedZip = null;
        updateUIState();
    }

    // Format bytes to human readable sizes
    function formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    // Convert full queue
    async function convertQueue() {
        const targetMime = formatSelect.value;
        const quality = parseFloat(qualityRange.value) / 100;
        
        convertAllBtn.disabled = true;
        convertAllBtn.innerHTML = `<i data-lucide="loader" class="animate-spin"></i> Converting...`;
        lucide.createIcons();

        for (let item of fileQueue) {
            // Only convert waiting or failed items
            if (item.status === 'completed') continue;

            console.log(`[Batch] Starting conversion for: ${item.name} (${item.size})`);
            updateItemStatus(item, 'processing', 'Converting...');
            showProgressBar(item, true);

            try {
                let blobToProcess = item.file;

                // Handle HEIC/HEIF files specifically using heic2any
                if (item.isHeic) {
                    console.log(`[HEIC] File "${item.name}" detected as HEIC format. Initializing heic2any decoder...`);
                    if (typeof heic2any === 'undefined') {
                        throw new Error('heic2any library is not loaded or failed to initialize.');
                    }
                    try {
                        updateItemStatus(item, 'processing', 'Decoding HEIC...');
                        
                        let conversionResult;
                        const startTime = performance.now();
                        
                        try {
                            console.log(`[HEIC] Invoking heic2any with multiple: true (to extract main frame from Live/Burst photos)...`);
                            conversionResult = await heic2any({
                                blob: item.file,
                                toType: 'image/jpeg',
                                quality: 0.95,
                                multiple: true
                            });
                        } catch (multipleError) {
                            console.warn(`[HEIC] Decoding with multiple: true failed, retrying standard mode... Error details:`, multipleError);
                            console.log(`[HEIC] Invoking heic2any standard mode (multiple: false)...`);
                            conversionResult = await heic2any({
                                blob: item.file,
                                toType: 'image/jpeg',
                                quality: 0.95
                            });
                        }
                        
                        const endTime = performance.now();
                        console.log(`[HEIC] Decoded successfully in ${((endTime - startTime) / 1000).toFixed(2)} seconds.`);
                        
                        blobToProcess = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
                        console.log(`[HEIC] Intermediate JPEG Blob created: size = ${formatBytes(blobToProcess.size)}`);
                    } catch (heicError) {
                        console.error(`[HEIC] Decoder failed: ${heicError.message || heicError}`);
                        throw new Error(`HEIC decoding failed: ${heicError.message || heicError || 'unknown library error'}`);
                    }
                }

                // Convert blob into target format using canvas
                console.log(`[Canvas] Loading blob into HTML5 Canvas to encode as ${targetMime} (quality: ${quality})...`);
                const convertedBlob = await processImageBlob(blobToProcess, targetMime, quality, item);
                console.log(`[Canvas] Processing complete! Converted size = ${formatBytes(convertedBlob.size)}`);
                
                item.convertedBlob = convertedBlob;
                item.status = 'completed';
                item.progress = 100;
                
                // Construct new filename
                const originalNameWithoutExt = item.name.substring(0, item.name.lastIndexOf('.'));
                const newExt = getExtensionForMime(targetMime);
                item.convertedName = `${originalNameWithoutExt}${newExt}`;
                console.log(`[Success] Output target file name: ${item.convertedName}`);

                updateItemStatus(item, 'completed', 'Done!');
                showProgressBar(item, false);
                replaceDownloadButton(item);

                // Update thumbnail for HEIC now that it's processed
                if (item.isHeic) {
                    const thumbUrl = URL.createObjectURL(convertedBlob);
                    document.getElementById(`thumb_${item.id}`).src = thumbUrl;
                    console.log(`[UI] Thumbnail updated for HEIC file.`);
                }
            } catch (err) {
                console.error(`[Error] Failed to convert "${item.name}":`, err.message || err);
                item.status = 'error';
                updateItemStatus(item, 'error', `Error: ${err.message || err}`);
                showProgressBar(item, false);
            }
        }

        convertAllBtn.disabled = false;
        convertAllBtn.innerHTML = `<i data-lucide="zap"></i> Convert All`;
        lucide.createIcons();
        updateUIState();
    }

    // Process normal image blobs (using canvas for conversions/resizing)
    function processImageBlob(blob, targetMime, quality, queueItem) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const objectURL = URL.createObjectURL(blob);
            
            img.onload = () => {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                
                ctx.drawImage(img, 0, 0);
                URL.revokeObjectURL(objectURL);

                canvas.toBlob((resultBlob) => {
                    if (resultBlob) {
                        resolve(resultBlob);
                    } else {
                        reject(new Error('Canvas conversion failed'));
                    }
                }, targetMime, quality);
            };

            img.onerror = () => {
                URL.revokeObjectURL(objectURL);
                reject(new Error('Failed to load image into canvas'));
            };

            img.src = objectURL;
        });
    }

    // Get file extension based on MIME type
    function getExtensionForMime(mime) {
        switch(mime) {
            case 'image/jpeg': return '.jpg';
            case 'image/png': return '.png';
            case 'image/webp': return '.webp';
            case 'image/gif': return '.gif';
            case 'image/bmp': return '.bmp';
            default: return '.jpg';
        }
    }

    // Update status text and style for an item
    function updateItemStatus(item, status, text) {
        const statusEl = document.getElementById(`status_${item.id}`);
        if (!statusEl) return;

        statusEl.className = `item-status status-${status}`;
        
        let iconHtml = '';
        if (status === 'waiting') iconHtml = '<i data-lucide="clock" style="width: 14px; height: 14px;"></i>';
        else if (status === 'processing') iconHtml = '<i data-lucide="loader" class="animate-spin" style="width: 14px; height: 14px;"></i>';
        else if (status === 'completed') iconHtml = '<i data-lucide="check-circle-2" style="width: 14px; height: 14px;"></i>';
        else if (status === 'error') iconHtml = '<i data-lucide="alert-circle" style="width: 14px; height: 14px;"></i>';

        statusEl.innerHTML = `${iconHtml} ${text}`;
        lucide.createIcons();
    }

    // Toggle/update progress bar for queue item
    function showProgressBar(item, show) {
        const container = document.getElementById(`prog_container_${item.id}`);
        const bar = document.getElementById(`prog_${item.id}`);
        if (!container || !bar) return;

        if (show) {
            container.classList.remove('hidden');
            bar.style.width = '70%'; // Artificial loading start
        } else {
            bar.style.width = '100%';
            setTimeout(() => {
                container.classList.add('hidden');
            }, 500);
        }
    }

    // Replace the delete button with a single-file download button upon completion
    function replaceDownloadButton(item) {
        const controlsEl = document.querySelector(`#${item.id} .item-controls`);
        if (!controlsEl) return;

        const downloadUrl = URL.createObjectURL(item.convertedBlob);

        controlsEl.innerHTML = `
            <a href="${downloadUrl}" download="${item.convertedName}" class="btn-icon" style="color: var(--secondary);" title="Download Image">
                <i data-lucide="download" style="width: 16px; height: 16px;"></i>
            </a>
            <button class="btn-icon delete" id="del_${item.id}" title="Remove file">
                <i data-lucide="x" style="width: 16px; height: 16px;"></i>
            </button>
        `;

        lucide.createIcons();

        // Re-attach delete listener
        document.getElementById(`del_${item.id}`).addEventListener('click', () => {
            removeFileFromQueue(item.id);
        });
    }

    // Package all completed images into a single ZIP and download it
    function downloadAllAsZip() {
        const completedItems = fileQueue.filter(item => item.status === 'completed');
        if (completedItems.length === 0) return;

        const zip = new JSZip();
        completedItems.forEach(item => {
            zip.file(item.convertedName, item.convertedBlob);
        });

        zip.generateAsync({type: 'blob'}).then((content) => {
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'pixelshift-converted-images.zip';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        });
    }
});
