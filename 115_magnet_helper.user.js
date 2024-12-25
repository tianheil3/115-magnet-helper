// ==UserScript==
// @name         115云盘磁力链接助手-- 天黑了
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  自动捕捉页面磁力链接并保存至115云盘
// @author       天黑了
// @license      MIT
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_log
// @connect      115.com
// @run-at       document-end
// @homepage     https://github.com/tianheil3/115-magnet-helper
// @supportURL   https://github.com/tianheil3/115-magnet-helper/issues
// @updateURL    https://raw.githubusercontent.com/tianheil3/115-magnet-helper/main/115_magnet_helper.user.js
// ==/UserScript==

(function() {
    'use strict';
    
    console.log('115云盘磁力链接助手已加载');
    
    // 调试函数
    function debug(msg, ...args) {
        console.log(`[115助手] ${msg}`, ...args);
    }

    // 匹配磁力链接的正则表达式
    const magnetRegex = /magnet:\?xt=urn:btih:[a-zA-Z0-9]{32,40}/gi;

    // 修改115图标的SVG，使用文字"115"
    const icon115 = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16">
        <text x="50%" y="50%" text-anchor="middle" dominant-baseline="central" 
            fill="white" font-family="Arial" font-weight="bold" font-size="10">115</text>
    </svg>`;

    // 修改按钮样式，移除定位相关的属性
    const buttonStyle = `
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 26px;
        height: 26px;
        background-color: #2777F8;
        border-radius: 50%;
        cursor: pointer;
        margin-left: 5px;
        color: white;
        font-family: Arial, sans-serif;
        font-size: 11px;
        font-weight: bold;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        transition: all 0.3s ease;
        opacity: 0.9;
        user-select: none;
        vertical-align: middle;
    `;

    // 存储已创建的按钮
    const createdButtons = new Set();

    // 保存到115云盘
    async function saveTo115(magnetLink) {
        try {
            // 检查登录状态
            const checkLogin = () => {
                return new Promise((resolve) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: 'https://115.com/?ct=offline&ac=space',
                        headers: {
                            'Accept': 'application/json',
                            'Referer': 'https://115.com/',
                            'User-Agent': window.navigator.userAgent
                        },
                        withCredentials: true,
                        onload: function(response) {
                            try {
                                const data = JSON.parse(response.responseText);
                                resolve(data.state);
                            } catch (error) {
                                resolve(false);
                            }
                        },
                        onerror: () => resolve(false)
                    });
                });
            };

            // 获取离线空间和用户ID
            const getOfflineSpace = () => {
                return new Promise((resolve) => {
                    GM_xmlhttpRequest({
                        method: 'GET',
                        url: 'https://115.com/?ct=offline&ac=space',
                        headers: {
                            'Accept': 'application/json',
                            'Referer': 'https://115.com/'
                        },
                        withCredentials: true,
                        onload: function(response) {
                            try {
                                const data = JSON.parse(response.responseText);
                                resolve(data);
                            } catch (error) {
                                resolve(null);
                            }
                        },
                        onerror: () => resolve(null)
                    });
                });
            };

            // 检查登录状态
            const isLoggedIn = await checkLogin();
            if (!isLoggedIn) {
                GM_notification({
                    text: '请先登录115云盘',
                    title: '115云盘助手',
                    timeout: 3000
                });
                window.open('https://115.com/?ct=login', '_blank');
                return false;
            }

            // 获取离线空间信息
            const spaceInfo = await getOfflineSpace();
            if (!spaceInfo || !spaceInfo.state) {
                throw new Error('获取离线空间信息失败');
            }

            // 添加离线任务
            return new Promise((resolve) => {
                GM_xmlhttpRequest({
                    method: 'POST',
                    url: 'https://115.com/web/lixian/?ct=lixian&ac=add_task_url',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Referer': 'https://115.com/',
                        'Origin': 'https://115.com',
                        'User-Agent': window.navigator.userAgent
                    },
                    data: `url=${encodeURIComponent(magnetLink)}`,
                    withCredentials: true,
                    onload: function(response) {
                        try {
                            // 检查响应文本
                            debug('API响应:', response.responseText);
                            
                            const result = JSON.parse(response.responseText);
                            if (result.state) {
                                GM_notification({
                                    text: '磁力链接已成功添加到离线下载队列',
                                    title: '115云盘助手',
                                    timeout: 3000
                                });
                                resolve(true);
                            } else {
                                // 处理不同类型的错误
                                let errorMessage = '添加任务失败';
                                
                                // 错误代码可能在 errno 或 errcode 中
                                const errorCode = result.errcode || result.errno;
                                
                                // 处理常见错误类型
                                const errorTypes = {
                                    911: '用户未登录',
                                    10008: '任务已存在',
                                    10009: '任务超出限制',
                                    10004: '空间不足',
                                    10002: '解析失败',
                                    // 可以继续添加其他错误类型
                                };

                                if (errorCode && errorTypes[errorCode]) {
                                    errorMessage = errorTypes[errorCode];
                                } else if (result.error_msg) {
                                    errorMessage = result.error_msg;
                                }

                                // 显示详细的错误通知
                                GM_notification({
                                    text: errorMessage,
                                    title: '115云盘助手',
                                    timeout: 5000
                                });

                                // 如果是警告类型的错误（如任务已存在），返回 true
                                if (result.errtype === 'war') {
                                    resolve(true);
                                } else {
                                    resolve(false);
                                }
                            }
                        } catch (error) {
                            console.error('解析响应失败:', error, response.responseText);
                            GM_notification({
                                text: '添加任务失败: ' + (error.message || '未知错误'),
                                title: '115云盘助手',
                                timeout: 3000
                            });
                            resolve(false);
                        }
                    },
                    onerror: function(error) {
                        console.error('请求失败:', error);
                        GM_notification({
                            text: '网络请求失败',
                            title: '115云盘助手',
                            timeout: 3000
                        });
                        resolve(false);
                    }
                });
            });
        } catch (error) {
            console.error('保存到115云盘失败:', error);
            GM_notification({
                text: '保存失败：' + error.message,
                title: '115云盘助手',
                timeout: 3000
            });
            return false;
        }
    }

    // 创建磁力链接按钮
    function createMagnetButton(magnetLink, element) {
        if (createdButtons.has(magnetLink)) return;
        debug('创建按钮:', magnetLink);

        // 创建一个包装容器
        const wrapper = document.createElement('span');
        wrapper.style.cssText = `
            display: inline-flex;
            align-items: center;
            white-space: nowrap;
            margin: 0 2px;
        `;

        // 创建按钮 - 改名为 buttonElement
        const buttonElement = document.createElement('span');
        buttonElement.innerHTML = '115';
        buttonElement.style.cssText = buttonStyle;
        buttonElement.title = '点击保存到115云盘';

        if (element.nodeType === Node.TEXT_NODE) {
            // 处理文本节点
            const text = element.textContent;
            const index = text.indexOf(magnetLink);
            if (index !== -1) {
                const beforeText = document.createTextNode(text.substring(0, index));
                const afterText = document.createTextNode(text.substring(index + magnetLink.length));
                const magnetSpan = document.createElement('span');
                magnetSpan.textContent = magnetLink;
                
                const parent = element.parentNode;
                parent.insertBefore(beforeText, element);
                parent.insertBefore(wrapper, element);
                wrapper.appendChild(magnetSpan);
                wrapper.appendChild(buttonElement);
                parent.insertBefore(afterText, element);
                parent.removeChild(element);
            }
        } else {
            // 处理元素节点
            if (element.tagName === 'A' || element.tagName === 'INPUT') {
                element.parentNode.insertBefore(wrapper, element.nextSibling);
                wrapper.appendChild(buttonElement);
            } else {
                element.appendChild(wrapper);
                wrapper.appendChild(buttonElement);
            }
        }

        // 添加按钮事件处理 - 直接使用 buttonElement
        if (buttonElement) {
            // 添加交互效果
            buttonElement.addEventListener('mouseenter', () => {
                buttonElement.style.transform = 'scale(1.1)';
                buttonElement.style.opacity = '1';
            });
            
            buttonElement.addEventListener('mouseleave', () => {
                buttonElement.style.transform = 'scale(1)';
                buttonElement.style.opacity = '0.9';
            });
            
            // 点击处理
            buttonElement.addEventListener('click', async (e) => {
                e.stopPropagation();
                e.preventDefault();
                debug('点击按钮，准备保存:', magnetLink);
                
                buttonElement.style.backgroundColor = '#1E5AC8';
                const success = await saveTo115(magnetLink);
                
                buttonElement.style.backgroundColor = success ? '#2777F8' : '#f44336';
                if (!success) {
                    setTimeout(() => {
                        buttonElement.style.backgroundColor = '#2777F8';
                    }, 2000);
                }
            });
        }

        createdButtons.add(magnetLink);
    }

    // 查找并处理磁力链接
    function findAndProcessMagnetLinks() {
        debug('开始查找磁力链接');
        
        // 使用 TreeWalker 遍历所有文本节点
        const processedLinks = new Set();
        const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    // 过滤掉不可见元素和脚本标签
                    const parent = node.parentElement;
                    if (!parent || 
                        parent.tagName === 'SCRIPT' || 
                        parent.tagName === 'STYLE' || 
                        parent.tagName === 'NOSCRIPT' ||
                        getComputedStyle(parent).display === 'none' ||
                        getComputedStyle(parent).visibility === 'hidden') {
                        return NodeFilter.FILTER_REJECT;
                    }
                    // 只接受包含磁力链接的文本节点
                    return node.textContent.includes('magnet:?') ? 
                        NodeFilter.FILTER_ACCEPT : 
                        NodeFilter.FILTER_SKIP;
                }
            }
        );

        const textNodes = [];
        while (walker.nextNode()) {
            textNodes.push(walker.currentNode);
        }

        // 处理找到的文本节点
        textNodes.forEach(node => {
            const matches = node.textContent.match(magnetRegex);
            if (matches) {
                matches.forEach(magnetLink => {
                    if (!processedLinks.has(magnetLink)) {
                        // 找到实际包含磁力链接的最小父元素
                        let targetElement = node;
                        let parent = node.parentElement;
                        while (parent && parent !== document.body) {
                            if (parent.textContent.trim() === node.textContent.trim()) {
                                targetElement = parent;
                                parent = parent.parentElement;
                            } else {
                                break;
                            }
                        }
                        createMagnetButton(magnetLink, targetElement);
                        processedLinks.add(magnetLink);
                    }
                });
            }
        });

        // 检查特殊属性（如链接和输入框）
        const elements = document.querySelectorAll('a[href], input[value], [data-url], [title], [data-clipboard-text]');
        elements.forEach(element => {
            const attributes = ['href', 'data-url', 'value', 'title', 'data-clipboard-text'];
            for (const attr of attributes) {
                const value = element.getAttribute(attr);
                if (value) {
                    const matches = value.match(magnetRegex);
                    if (matches) {
                        matches.forEach(magnetLink => {
                            if (!processedLinks.has(magnetLink)) {
                                createMagnetButton(magnetLink, element);
                                processedLinks.add(magnetLink);
                            }
                        });
                    }
                }
            }
        });
    }

    // 初始化
    function init() {
        debug('初始化脚本');
        findAndProcessMagnetLinks();

        // 使用 MutationObserver 监听页面变化
        const observer = new MutationObserver(() => {
            setTimeout(findAndProcessMagnetLinks, 500);
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 等待页面加载完成后初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(); 