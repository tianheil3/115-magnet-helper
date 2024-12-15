// ==UserScript==
// @name         115云盘磁力链接助手-- 天黑了
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  自动捕捉页面磁力链接并保存至115云盘
// @author       天黑了
// @license      MIT
// @match        *://*/*
// @grant        GM_xmlhttpRequest
// @grant        GM_notification
// @grant        GM_log
// @connect      115.com
// @run-at       document-end
// @homepage     https://github.com/your-username/115-magnet-helper
// @supportURL   https://github.com/your-username/115-magnet-helper/issues
// @updateURL    https://raw.githubusercontent.com/your-username/115-magnet-helper/main/115_magnet_helper.user.js
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

    // 修改按钮样式，稍微调整大小以适应文字
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
                                throw new Error(result.error || '添加任务失败');
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

        // 创建按钮容器
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            position: relative;
            display: inline-block;
            margin-left: 5px;
            vertical-align: middle;
        `;

        // 创建按钮
        const button = document.createElement('span');
        button.innerHTML = '115';  // 直接使用文字
        button.style.cssText = buttonStyle;
        button.title = '点击保存到115云盘';
        buttonContainer.appendChild(button);

        // 插入按钮
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            // 对于输入框，在其后面插入按钮
            element.parentNode.insertBefore(buttonContainer, element.nextSibling);
        } else {
            // 对于其他元素，在其内部末尾插入按钮
            element.appendChild(buttonContainer);
        }

        // 添加交互效果
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'scale(1.1)';
            button.style.opacity = '1';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'scale(1)';
            button.style.opacity = '0.8';
        });
        
        // 点击处理
        button.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            debug('点击按钮，准备保存:', magnetLink);
            
            button.style.backgroundColor = '#1E5AC8';
            const success = await saveTo115(magnetLink);
            
            button.style.backgroundColor = success ? '#2777F8' : '#f44336';
            if (!success) {
                setTimeout(() => {
                    button.style.backgroundColor = '#2777F8';
                }, 2000);
            }
        });

        createdButtons.add(magnetLink);
    }

    // 查找并处理磁力链接
    function findAndProcessMagnetLinks() {
        debug('开始查找磁力链接');
        
        // 1. 首先查找页面上所有元素的文本内容
        const allElements = document.getElementsByTagName('*');
        const processedLinks = new Set();
        
        for (const element of allElements) {
            // 跳过脚本和样式标签
            if (element.tagName === 'SCRIPT' || 
                element.tagName === 'STYLE' || 
                element.tagName === 'NOSCRIPT') {
                continue;
            }

            // 检查元素的各种属性
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

            // 检查文本内容
            if (element.textContent) {
                const matches = element.textContent.match(magnetRegex);
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